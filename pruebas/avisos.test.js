/**
 * PRUEBAS DE LOS AVISOS DE LA CAJA  (v1.5)
 *
 * Dos avisos que se parecen y se comportan al revés:
 *
 *  · UN REFRESCO se cuenta pieza por pieza. Si el sistema dice cero, es
 *    cero, y venderlo solo genera un problema en el mostrador. Se bloquea.
 *
 *  · EL HIELO no. Los obreros sacan hielo toda la mañana y reportan lo que
 *    sacaron hasta como las 3 de la tarde, así que el número del sistema es
 *    "lo capturado", no "lo que hay". Avisa y jamás bloquea: parar la venta
 *    de hielo por un dato que todavía no llega sería parar la fábrica.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'fabrica-avisos-'));
process.env.CARPETA_DATOS = carpeta;
process.env.ARCHIVO_BD = path.join(carpeta, 'prueba.db');

const { migrar } = require('../src/db/migrar');
const { crearApp } = require('../src/servidor');

migrar({ silencioso: true });

let servidor, base, cookie = '', catId, coca, agua;

async function llamar(ruta, opciones = {}) {
  const r = await fetch(base + ruta, {
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    ...opciones,
    body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined
  });
  const set = r.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  return { estado: r.status, json: await r.json() };
}

const avisos = async () => (await llamar('/api/inventario/avisos')).json.datos;

test.before(async () => {
  servidor = crearApp().listen(0);
  await new Promise((r) => servidor.once('listening', r));
  base = `http://127.0.0.1:${servidor.address().port}`;

  await llamar('/api/auth/configuracion-inicial', {
    method: 'POST',
    cuerpo: { nombre: 'Tony', usuario: 'tony', contrasena: 'clavelarga1', pin: '1111' }
  });

  catId = (await llamar('/api/catalogo/categorias', {
    method: 'POST', cuerpo: { nombre: 'Refrescos' }
  })).json.datos.categoria.id;

  coca = (await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: 'Coca 600', categoriaId: catId, tipo: 'simple',
              precio: 25, codigo: 'COCA', llevaInventario: true, minimo: 6 }
  })).json.datos.producto;

  // Este no lleva cuenta: es de los que nunca se acaban en el sistema.
  agua = (await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: 'Agua 1 L', categoriaId: catId, tipo: 'simple',
              precio: 10, codigo: 'AGUA' }
  })).json.datos.producto;
});

test.after(() => {
  servidor.close();
  fs.rmSync(carpeta, { recursive: true, force: true });
});

// ============================================================
// LA BOLITA DE LOS PRODUCTOS
// ============================================================

test('en cero, un producto con inventario ya cuenta como agotado', async () => {
  const a = await avisos();
  assert.equal(a.bajos, 1);
  assert.equal(a.agotados, 1);
  assert.equal(a.productos[0].nombre, 'Coca 600');
  assert.equal(a.productos[0].agotado, true);
});

test('lo que no lleva inventario nunca sale en la lista', async () => {
  const a = await avisos();
  assert.ok(!a.productos.some((p) => p.id === agua.id));
  assert.equal(a.existencias[agua.id], undefined);
});

test('con mercancía de sobra no hay nada que avisar', async () => {
  await llamar(`/api/inventario/${coca.id}/movimientos`, {
    method: 'POST', cuerpo: { tipo: 'entrada', cantidad: 24 }
  });
  const a = await avisos();
  assert.equal(a.bajos, 0);
  assert.equal(a.agotados, 0);
  assert.equal(a.existencias[coca.id], 24);
});

test('al bajar del mínimo aparece el aviso, pero todavía se puede vender', async () => {
  // 24 − 19 = 5, y el mínimo es 6
  await llamar(`/api/inventario/${coca.id}/movimientos`, {
    method: 'POST', cuerpo: { tipo: 'salida', cantidad: 19, concepto: 'Se prestaron' }
  });

  const a = await avisos();
  assert.equal(a.bajos, 1);
  assert.equal(a.agotados, 0, 'todavía hay, solo que poco');
  assert.equal(a.productos[0].quedan, 5);

  const v = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ codigo: 'COCA', cantidad: 1 }] }
  });
  assert.equal(v.estado, 201);
});

// ============================================================
// NO SE VENDE LO QUE NO HAY
// ============================================================

test('no se pueden vender más piezas de las que quedan', async () => {
  const r = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ codigo: 'COCA', cantidad: 10 }] }
  });
  assert.equal(r.estado, 409);
  assert.match(r.json.error, /quedan 4/i);
});

test('cuando se acaba, la venta se rechaza y lo dice claro', async () => {
  await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ codigo: 'COCA', cantidad: 4 }] }
  });
  assert.equal((await avisos()).existencias[coca.id], 0);

  const r = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ codigo: 'COCA', cantidad: 1 }] }
  });
  assert.equal(r.estado, 409);
  assert.match(r.json.error, /se acabó/i);
});

test('lo ilimitado se sigue vendiendo aunque nadie lleve su cuenta', async () => {
  const r = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ codigo: 'AGUA', cantidad: 99 }] }
  });
  assert.equal(r.estado, 201);
});

test('lo que entra vuelve a habilitar la venta', async () => {
  await llamar(`/api/inventario/${coca.id}/movimientos`, {
    method: 'POST', cuerpo: { tipo: 'entrada', cantidad: 12 }
  });
  const r = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ codigo: 'COCA', cantidad: 2 }] }
  });
  assert.equal(r.estado, 201);
});

// ============================================================
// EL HIELO: AVISA, NO BLOQUEA
// ============================================================

test('el aviso del hielo arranca en 10 marquetas', async () => {
  const { hielo } = await avisos();
  assert.equal(hielo.minimoMarquetas, 10);
});

test('el mínimo del hielo se configura', async () => {
  const r = await llamar('/api/inventario/hielo-minimo', {
    method: 'PUT', cuerpo: { marquetas: 25 }
  });
  assert.equal(r.estado, 200);
  assert.equal((await avisos()).hielo.minimoMarquetas, 25);
});

test('un mínimo que no es un número se rechaza', async () => {
  for (const malo of ['muchas', '', null, -3]) {
    const r = await llamar('/api/inventario/hielo-minimo', {
      method: 'PUT', cuerpo: { marquetas: malo }
    });
    assert.equal(r.estado, 400, `debería rechazar ${malo}`);
  }
  assert.equal((await avisos()).hielo.minimoMarquetas, 25, 'no se movió');
});

/**
 * La prueba que importa. El cuarto frío en cero según el sistema significa
 * "nadie ha capturado", no "no hay hielo". A media mañana es lo normal.
 */
test('con el hielo por los suelos el aviso salta, y aun así se vende', async () => {
  const { hielo } = await avisos();
  assert.equal(hielo.bajo, true, 'el aviso tiene que estar encendido');

  const r = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 8 }] }
  });
  assert.equal(r.estado, 201, 'el hielo JAMÁS se bloquea por el aviso');
});

// ============================================================
// LO QUE VE LA CAJA AL ABRIR
// ============================================================

test('la pantalla de venta recibe los avisos con el contexto', async () => {
  const r = await llamar('/api/ventas/contexto');
  assert.equal(r.estado, 200);
  assert.ok(r.json.datos.avisos, 'sin esto la bolita no se pinta al abrir');
  assert.ok('existencias' in r.json.datos.avisos);
  assert.ok('hielo' in r.json.datos.avisos);
});
