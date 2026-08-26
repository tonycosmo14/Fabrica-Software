/**
 * Pruebas de Personalizar: subir, servir y quitar el logo.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, carpeta, preparar, entrarAdmin, entrarPorNombre } = fabricaDePrueba('marca');

// PNG mínimo real de 1x1, para tener bytes con firma válida.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');


test('sin logo puesto, la ruta del logo responde 404', async () => {
  const r = await llamar('/marca/logo');
  assert.equal(r.estado, 404);
});

test('se sube un PNG y queda disponible', async () => {
  const r = await llamar('/api/personalizacion/logo', {
    method: 'POST',
    cuerpo: { variante: 'claro', archivo: `data:image/png;base64,${PNG_1X1.toString('base64')}` }
  });
  assert.equal(r.estado, 200);

  const servido = await llamar('/marca/logo');
  assert.equal(servido.estado, 200);
  assert.equal(servido.cabeceras.get('content-type'), 'image/png');
  assert.equal(servido.cabeceras.get('x-content-type-options'), 'nosniff');
});

test('el logo se guarda en datos/, no dentro del programa', async () => {
  assert.ok(fs.existsSync(path.join(carpeta, 'marca', 'logo_claro.png')));
});

test('se rechaza un archivo que dice ser PNG pero no lo es', async () => {
  const r = await llamar('/api/personalizacion/logo', {
    method: 'POST',
    cuerpo: { variante: 'claro', archivo: `data:image/png;base64,${Buffer.from('no soy un png').toString('base64')}` }
  });
  assert.equal(r.estado, 400);
});

test('se rechaza un SVG con código dentro', async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
  const r = await llamar('/api/personalizacion/logo', {
    method: 'POST',
    cuerpo: { variante: 'claro', archivo: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` }
  });
  assert.equal(r.estado, 400);
  assert.match(r.json.error, /código/);
});

test('se acepta un SVG limpio', async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
  const r = await llamar('/api/personalizacion/logo', {
    method: 'POST',
    cuerpo: { variante: 'oscuro', archivo: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` }
  });
  assert.equal(r.estado, 200);

  const servido = await llamar('/marca/logo-oscuro');
  assert.equal(servido.cabeceras.get('content-type'), 'image/svg+xml');
  assert.match(servido.cabeceras.get('content-security-policy'), /default-src 'none'/);
});

test('se rechaza un formato que no es imagen', async () => {
  const r = await llamar('/api/personalizacion/logo', {
    method: 'POST',
    cuerpo: { variante: 'claro', archivo: 'data:application/pdf;base64,JVBERi0x' }
  });
  assert.equal(r.estado, 400);
});

test('al quitar el logo se borra el archivo', async () => {
  const r = await llamar('/api/personalizacion/logo/quitar', { method: 'POST', cuerpo: { variante: 'claro' } });
  assert.equal(r.estado, 200);
  assert.ok(!fs.existsSync(path.join(carpeta, 'marca', 'logo_claro.png')));

  const servido = await llamar('/marca/logo');
  assert.equal(servido.estado, 404);
});

test('se guarda el nombre del negocio', async () => {
  await llamar('/api/personalizacion', { method: 'PUT', cuerpo: { nombreNegocio: 'Hielo LOLHA', ciudad: 'Hunucmá' } });
  const r = await llamar('/api/personalizacion');
  assert.equal(r.json.datos.nombreNegocio, 'Hielo LOLHA');
  assert.equal(r.json.datos.ciudad, 'Hunucmá');
});

test('un cajero no puede cambiar el logo', async () => {
  await llamar('/api/usuarios', { method: 'POST', cuerpo: { nombre: 'Ana', rol: 'cajero', pin: '5555' } });
  const { json } = await llamar('/api/auth/usuarios-disponibles');
  const ana = json.datos.usuarios.find((u) => u.nombre === 'Ana');
  await llamar('/api/auth/entrar-pin', { method: 'POST', cuerpo: { usuarioId: ana.id, pin: '5555' } });

  const r = await llamar('/api/personalizacion/logo', {
    method: 'POST',
    cuerpo: { variante: 'claro', archivo: `data:image/png;base64,${PNG_1X1.toString('base64')}` }
  });
  assert.equal(r.estado, 403);
});


// ============================================================
// EL TAMAÑO DE LOS CUADROS DE VENDER  (v2.3)
//
// No se guarda el alto en pixeles: se guarda CUÁNTOS cuadros quiere ver el
// dueño, y la caja reparte entre esos el sitio que tenga la pantalla. Los
// topes existen para que nadie se deje la caja inservible: dos columnas es
// una lista y quince son cuadros donde no cabe el nombre.
// ============================================================

test('la rejilla de la caja viene con sus topes y un tamaño de arranque', async () => {
  await entrarAdmin();
  const r = (await llamar('/api/personalizacion')).json.datos.rejilla;

  assert.ok(r.columnas >= r.topes.columnas.minimo && r.columnas <= r.topes.columnas.maximo);
  assert.ok(r.filas >= r.topes.filas.minimo && r.filas <= r.topes.filas.maximo);
  assert.ok(r.topes.columnas.maximo > r.topes.columnas.minimo, 'hay dónde elegir');
});

test('se puede elegir cuántos cuadros se ven, y se queda guardado', async () => {
  await entrarAdmin();
  const r = await llamar('/api/personalizacion', {
    method: 'PUT', cuerpo: { posColumnas: 4, posFilas: 2 }
  });
  assert.equal(r.estado, 200);

  const puesto = (await llamar('/api/personalizacion')).json.datos.rejilla;
  assert.equal(puesto.columnas, 4);
  assert.equal(puesto.filas, 2);
});

test('la caja recibe la rejilla con su contexto, sin preguntar aparte', async () => {
  await entrarAdmin();
  await llamar('/api/personalizacion', { method: 'PUT', cuerpo: { posColumnas: 6, posFilas: 4 } });

  const ctx = (await llamar('/api/ventas/contexto')).json.datos;
  assert.equal(ctx.rejilla.columnas, 6);
  assert.equal(ctx.rejilla.filas, 4);
});

test('un tamaño fuera de los topes se rechaza, no se recorta en silencio', async () => {
  await entrarAdmin();
  await llamar('/api/personalizacion', { method: 'PUT', cuerpo: { posColumnas: 6, posFilas: 4 } });

  for (const cuerpo of [{ posColumnas: 40 }, { posColumnas: 1 },
                        { posFilas: 0 }, { posFilas: 99 }, { posColumnas: 'muchas' }]) {
    const r = await llamar('/api/personalizacion', { method: 'PUT', cuerpo });
    assert.equal(r.estado, 400, JSON.stringify(cuerpo));
    assert.match(r.json.error, /van de \d+ a \d+/, 'y el aviso dice entre qué números');
  }

  // Y lo que ya estaba puesto no se movió.
  const puesto = (await llamar('/api/personalizacion')).json.datos.rejilla;
  assert.equal(puesto.columnas, 6);
  assert.equal(puesto.filas, 4);
});

test('cambiar el nombre del negocio no le cambia el tamaño a la caja', async () => {
  await entrarAdmin();
  await llamar('/api/personalizacion', { method: 'PUT', cuerpo: { posColumnas: 7, posFilas: 5 } });
  await llamar('/api/personalizacion', { method: 'PUT', cuerpo: { nombreNegocio: 'Hielo LOL-HA' } });

  const puesto = (await llamar('/api/personalizacion')).json.datos.rejilla;
  assert.equal(puesto.columnas, 7, 'lo que no se manda, no se toca');
  assert.equal(puesto.filas, 5);
});

test('solo quien configura el sistema le cambia el tamaño a los cuadros', async () => {
  await entrarPorNombre('Ana', '5555');
  const r = await llamar('/api/personalizacion', {
    method: 'PUT', cuerpo: { posColumnas: 2, posFilas: 1 }
  });
  assert.equal(r.estado, 403);
});
