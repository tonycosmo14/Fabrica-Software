/**
 * PRUEBAS DEL INVENTARIO  (v0.13)
 *
 *     había + entró − vendido − otras salidas = DEBERÍA HABER
 *     debería haber − contado = FALTA
 *
 * Es la misma cuenta que la existencia del cuarto frío, pero con piezas y a
 * otro ritmo: el hielo se cuenta dos veces al día, un refresco cuando toca.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'fabrica-inv-'));
process.env.CARPETA_DATOS = carpeta;
process.env.ARCHIVO_BD = path.join(carpeta, 'prueba.db');

const { migrar } = require('../src/db/migrar');
const { crearApp } = require('../src/servidor');
const { bd } = require('../src/db/conexion');

migrar({ silencioso: true });

let servidor, base, cookie = '', catId, coca;

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

async function entrarAdmin() {
  await llamar('/api/auth/entrar-contrasena', {
    method: 'POST', cuerpo: { usuario: 'tony', contrasena: 'clavelarga1' }
  });
}

const estado = async () =>
  (await llamar(`/api/inventario/${coca.id}`)).json.datos.estado;

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
              precio: 25, costo: 18, codigo: 'COCA', llevaInventario: true, minimo: 6 }
  })).json.datos.producto;
});

test.after(() => {
  servidor.close();
  fs.rmSync(carpeta, { recursive: true, force: true });
});

// ============================================================
// COSTO Y GANANCIA
// ============================================================

test('el producto guarda a cómo se compra y a cómo se vende', () => {
  assert.equal(coca.precio_centavos, 2500);
  assert.equal(coca.costo_centavos, 1800);
  assert.equal(coca.lleva_inventario, 1);
  assert.equal(coca.minimo, 6);
});

test('el hielo nunca lleva inventario de piezas', async () => {
  const r = await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: '1/4 especial', categoriaId: catId, tipo: 'hielo',
              dieciseisavos: 4, llevaInventario: true }
  });
  // Se acepta el producto, pero el inventario se ignora: el hielo se mide
  // en marquetas y su control es la Existencia.
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.producto.lleva_inventario, 0);
});

// ============================================================
// LA CUENTA
// ============================================================

test('arranca en cero hasta que entre mercancía', async () => {
  const e = await estado();
  assert.equal(e.anterior, 0);
  assert.equal(e.esperado, 0);
});

test('lo que llega suma', async () => {
  const r = await llamar(`/api/inventario/${coca.id}/movimientos`, {
    method: 'POST', cuerpo: { tipo: 'entrada', cantidad: 24, costo: 18 }
  });
  assert.equal(r.estado, 201);
  assert.equal((await estado()).esperado, 24);
});

test('lo que se vende resta, y por PIEZAS no por renglones', async () => {
  await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ codigo: 'COCA', cantidad: 3 }] }
  });

  const e = await estado();
  assert.equal(e.vendido, 3, 'tres refrescos, no un renglón');
  assert.equal(e.esperado, 21);
});

test('una venta cancelada devuelve las piezas', async () => {
  const v = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ codigo: 'COCA', cantidad: 2 }] }
  });
  assert.equal((await estado()).esperado, 19);

  await llamar(`/api/ventas/${v.json.datos.venta.id}/cancelar`, {
    method: 'POST', cuerpo: { motivo: 'Se equivocó' }
  });
  assert.equal((await estado()).esperado, 21);
});

test('una salida que no es venta también resta', async () => {
  await llamar(`/api/inventario/${coca.id}/movimientos`, {
    method: 'POST', cuerpo: { tipo: 'salida', cantidad: 1, concepto: 'Se rompió' }
  });
  const e = await estado();
  assert.equal(e.salidas, 1);
  assert.equal(e.esperado, 20);
});

// ============================================================
// CONTAR
// ============================================================

test('el conteo dice cuánto falta y deja el punto de partida nuevo', async () => {
  const antes = await estado();
  assert.equal(antes.esperado, 20);

  const r = await llamar(`/api/inventario/${coca.id}/conteo`, {
    method: 'POST', cuerpo: { contado: 18 }
  });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.resumen.falta, 2, 'faltaron dos');

  // A partir de aquí la cuenta arranca de lo contado, no de lo que decía.
  const despues = await estado();
  assert.equal(despues.anterior, 18);
  assert.equal(despues.entradas, 0);
  assert.equal(despues.vendido, 0);
  assert.equal(despues.esperado, 18);
});

test('el aviso de "hay que pedir" se enciende al bajar del mínimo', async () => {
  assert.equal((await estado()).bajo, false);

  await llamar(`/api/inventario/${coca.id}/conteo`, {
    method: 'POST', cuerpo: { contado: 5 }
  });
  const e = await estado();
  assert.equal(e.esperado, 5);
  assert.equal(e.bajo, true, '5 está por debajo del mínimo de 6');

  const lista = (await llamar('/api/inventario')).json.datos;
  assert.equal(lista.bajos, 1);
});

test('anular un movimiento lo saca de la cuenta sin borrarlo', async () => {
  await llamar(`/api/inventario/${coca.id}/movimientos`, {
    method: 'POST', cuerpo: { tipo: 'entrada', cantidad: 12, costo: 18 }
  });
  assert.equal((await estado()).esperado, 17);

  const movs = (await llamar(`/api/inventario/${coca.id}`)).json.datos.movimientos;
  const entrada = movs.find((m) => m.tipo === 'entrada' && m.cantidad === 12);

  await llamar(`/api/inventario/movimientos/${entrada.id}/anular`, {
    method: 'POST', cuerpo: { motivo: 'Se capturó dos veces' }
  });
  assert.equal((await estado()).esperado, 5);

  const guardado = bd.prepare('SELECT * FROM movimientos_inventario WHERE id = ?')
    .get(entrada.id);
  assert.ok(guardado, 'sigue existiendo');
  assert.ok(guardado.anulado_en);
});

// ============================================================
// LO QUE NO SE DEBE PODER
// ============================================================

test('no se puede mover el inventario de algo que no lo lleva', async () => {
  const otro = (await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: 'Bolsa', categoriaId: catId, tipo: 'simple', precio: 5 }
  })).json.datos.producto;

  const r = await llamar(`/api/inventario/${otro.id}/movimientos`, {
    method: 'POST', cuerpo: { tipo: 'entrada', cantidad: 10 }
  });
  assert.equal(r.estado, 409);
  assert.match(r.json.error, /no lleva inventario/i);
});

test('una cantidad en cero o con letras se rechaza', async () => {
  for (const mala of [0, '', 'muchas', -5]) {
    const r = await llamar(`/api/inventario/${coca.id}/movimientos`, {
      method: 'POST', cuerpo: { tipo: 'entrada', cantidad: mala }
    });
    assert.equal(r.estado, 400, `debería rechazar ${JSON.stringify(mala)}`);
  }
});

test('un tipo de movimiento inventado se rechaza', async () => {
  const r = await llamar(`/api/inventario/${coca.id}/movimientos`, {
    method: 'POST', cuerpo: { tipo: 'regalo', cantidad: 1 }
  });
  assert.equal(r.estado, 400);
});

test('anular exige motivo', async () => {
  const movs = (await llamar(`/api/inventario/${coca.id}`)).json.datos.movimientos;
  const vivo = movs.find((m) => !m.anulado_en);
  const r = await llamar(`/api/inventario/movimientos/${vivo.id}/anular`, {
    method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 400);
});

// ============================================================
// QUIÉN PUEDE QUÉ
// ============================================================

/**
 * El cajero entra al inventario solo para saber cuántas hay e imprimir la
 * hoja con la que va a contar. Lo que cuestan las cosas es información del
 * negocio, no del mostrador.
 */
test('el cajero ve cuántas hay, pero NO lo que cuestan', async () => {
  await entrarAdmin();
  await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Rosa', rol: 'cajero', pin: '4444' }
  });
  const lista = (await llamar('/api/auth/usuarios-disponibles')).json.datos.usuarios;
  const rosa = lista.find((u) => u.nombre === 'Rosa');
  await llamar('/api/auth/entrar-pin', { method: 'POST', cuerpo: { usuarioId: rosa.id, pin: '4444' } });

  const r = await llamar('/api/inventario');
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.conCostos, false);

  const suyo = r.json.datos.inventario.find((i) => i.producto.id === coca.id);
  assert.ok(suyo, 'sí ve el producto');
  assert.equal(typeof suyo.esperado, 'number', 'y cuántas hay');
  assert.equal(suyo.producto.costo_centavos, undefined, 'pero no lo que costó');

  // Ni siquiera pidiéndolo de frente: el dato no sale del servidor.
  const uno = await llamar(`/api/inventario/${coca.id}`);
  assert.equal(uno.json.datos.producto.costo_centavos, undefined);
  for (const m of uno.json.datos.movimientos) {
    assert.equal(m.costo_centavos, undefined);
  }
});

test('el cajero no mueve ni cuenta el inventario de productos', async () => {
  assert.equal((await llamar(`/api/inventario/${coca.id}/conteo`, {
    method: 'POST', cuerpo: { contado: 4 } })).estado, 403);

  assert.equal((await llamar(`/api/inventario/${coca.id}/movimientos`, {
    method: 'POST', cuerpo: { tipo: 'entrada', cantidad: 5 } })).estado, 403);

  assert.equal((await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: 'No', categoriaId: catId, tipo: 'simple', precio: 1 } })).estado, 403);
});

test('el gerente sí ve los costos y sí mueve el inventario', async () => {
  await entrarAdmin();
  await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Mari', rol: 'gerente', pin: '7777' }
  });
  const lista = (await llamar('/api/auth/usuarios-disponibles')).json.datos.usuarios;
  const mari = lista.find((u) => u.nombre === 'Mari');
  await llamar('/api/auth/entrar-pin', { method: 'POST', cuerpo: { usuarioId: mari.id, pin: '7777' } });

  const r = await llamar('/api/inventario');
  assert.equal(r.json.datos.conCostos, true);
  const suyo = r.json.datos.inventario.find((i) => i.producto.id === coca.id);
  assert.equal(suyo.producto.costo_centavos, 1800);

  assert.equal((await llamar(`/api/inventario/${coca.id}/conteo`, {
    method: 'POST', cuerpo: { contado: 4 } })).estado, 201);
});

test('un operario no ve el inventario', async () => {
  await entrarAdmin();
  await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Chema', rol: 'operario', pin: '5555' }
  });
  const lista = (await llamar('/api/auth/usuarios-disponibles')).json.datos.usuarios;
  const chema = lista.find((u) => u.nombre === 'Chema');
  await llamar('/api/auth/entrar-pin', { method: 'POST', cuerpo: { usuarioId: chema.id, pin: '5555' } });

  assert.equal((await llamar('/api/inventario')).estado, 403);
});
