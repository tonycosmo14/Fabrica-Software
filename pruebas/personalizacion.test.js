/**
 * Pruebas de Personalizar: subir, servir y quitar el logo.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, carpeta, preparar } = fabricaDePrueba('marca');

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
