/**
 * Pruebas del configurador de tanques.
 * Se crean los tres tanques reales de la fábrica y se comprueba que los
 * totales cuadren con el plan: 2N=182, T=156, N=234, total 572 moldes.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'fabrica-tanques-'));
process.env.CARPETA_DATOS = carpeta;
process.env.ARCHIVO_BD = path.join(carpeta, 'prueba.db');

const { migrar } = require('../src/db/migrar');
const { crearApp } = require('../src/servidor');

migrar({ silencioso: true });

let servidor, base, cookie = '';

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

test.before(async () => {
  servidor = crearApp().listen(0);
  await new Promise((r) => servidor.once('listening', r));
  base = `http://127.0.0.1:${servidor.address().port}`;

  await llamar('/api/auth/configuracion-inicial', {
    method: 'POST',
    cuerpo: { nombre: 'Tony', usuario: 'tony', contrasena: 'clavelarga1', pin: '1234' }
  });
});

test.after(() => {
  servidor.close();
  fs.rmSync(carpeta, { recursive: true, force: true });
});

test('la fábrica arranca sin tanques', async () => {
  const { json } = await llamar('/api/tanques');
  assert.equal(json.datos.tanques.length, 0);
  assert.equal(json.datos.totalMoldes, 0);
});

test('el tanque 2N se crea completo: 14 paños de 13 marquetas = 182 moldes', async () => {
  const r = await llamar('/api/tanques', {
    method: 'POST',
    cuerpo: { nombre: '2N', panos: 14, plantilla: [3, 3, 3, 4], horasCongelacion: 24 }
  });
  assert.equal(r.estado, 201);

  const t = r.json.datos.tanque;
  assert.equal(t.total_panos, 14);
  assert.equal(t.total_canastas, 56);   // 14 paños x 4 canastas
  assert.equal(t.total_moldes, 182);    // 14 x 13
});

test('cada molde es una fila real con su posición', async () => {
  const { json } = await llamar('/api/tanques');
  const id = json.datos.tanques[0].id;
  const { json: det } = await llamar(`/api/tanques/${id}`);

  const primerPano = det.datos.tanque.panos[0];
  assert.equal(primerPano.numero, 1);
  assert.equal(primerPano.canastas.length, 4);
  assert.deepEqual(primerPano.canastas.map((c) => c.total_moldes), [3, 3, 3, 4]);
  assert.deepEqual(primerPano.canastas[3].moldes.map((m) => m.numero), [1, 2, 3, 4]);
});

test('los tanques T y N completan los 572 moldes de la fábrica', async () => {
  await llamar('/api/tanques', {
    method: 'POST',
    cuerpo: { nombre: 'T', panos: 13, plantilla: [3, 3, 3, 3], horasCongelacion: 24 }
  });
  await llamar('/api/tanques', {
    method: 'POST',
    cuerpo: { nombre: 'N', panos: 18, plantilla: [3, 3, 3, 4], horasCongelacion: 24 }
  });

  const { json } = await llamar('/api/tanques');
  const porNombre = Object.fromEntries(json.datos.tanques.map((t) => [t.nombre, t.total_moldes]));

  assert.equal(porNombre['2N'], 182);
  assert.equal(porNombre['T'], 156);
  assert.equal(porNombre['N'], 234);
  assert.equal(json.datos.totalMoldes, 572);
});

test('renombrar un tanque no cambia su ID ni sus moldes', async () => {
  const { json } = await llamar('/api/tanques');
  const t = json.datos.tanques.find((x) => x.nombre === 'T');

  const r = await llamar(`/api/tanques/${t.id}`, { method: 'PUT', cuerpo: { nombre: 'Tanque Grande' } });
  assert.equal(r.json.datos.tanque.id, t.id);
  assert.equal(r.json.datos.tanque.nombre, 'Tanque Grande');
  assert.equal(r.json.datos.tanque.total_moldes, 156);
});

test('agregar un paño suma sus moldes al total', async () => {
  const { json } = await llamar('/api/tanques');
  const t = json.datos.tanques.find((x) => x.nombre === '2N');

  const r = await llamar(`/api/tanques/${t.id}/panos`, {
    method: 'POST', cuerpo: { plantilla: [3, 3, 3, 4] }
  });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.tanque.total_panos, 15);
  assert.equal(r.json.datos.tanque.total_moldes, 195);
});

test('bajar el número de moldes de una canasta no borra los moldes', async () => {
  const { json } = await llamar('/api/tanques');
  const t = json.datos.tanques.find((x) => x.nombre === 'N');
  const { json: det } = await llamar(`/api/tanques/${t.id}`);
  const canasta = det.datos.tanque.panos[0].canastas[3];   // la de 4 moldes

  const r = await llamar(`/api/tanques/canastas/${canasta.id}/moldes`, {
    method: 'PUT', cuerpo: { moldes: 2 }
  });
  assert.equal(r.json.datos.tanque.total_moldes, 232);     // 234 - 2

  // Los moldes retirados siguen existiendo, marcados como inactivos.
  const { json: conBajas } = await llamar(`/api/tanques/${t.id}?incluirInactivos=1`);
  const misma = conBajas.datos.tanque.panos[0].canastas[3];
  assert.equal(misma.moldes.length, 4);
  assert.equal(misma.moldes.filter((m) => !m.activo).length, 2);
});

test('un tanque dado de baja desaparece de la lista pero conserva su historial', async () => {
  const { json } = await llamar('/api/tanques');
  const t = json.datos.tanques.find((x) => x.nombre === 'Tanque Grande');

  await llamar(`/api/tanques/${t.id}/baja`, { method: 'POST', cuerpo: {} });

  const activos = await llamar('/api/tanques');
  assert.ok(!activos.json.datos.tanques.some((x) => x.id === t.id));

  const todos = await llamar('/api/tanques?incluirInactivos=1');
  assert.ok(todos.json.datos.tanques.some((x) => x.id === t.id));
});

test('se rechaza un tanque sin nombre o con paños absurdos', async () => {
  const a = await llamar('/api/tanques', {
    method: 'POST', cuerpo: { nombre: '', panos: 5, plantilla: [3], horasCongelacion: 24 }
  });
  assert.equal(a.estado, 400);

  const b = await llamar('/api/tanques', {
    method: 'POST', cuerpo: { nombre: 'X', panos: 0, plantilla: [3], horasCongelacion: 24 }
  });
  assert.equal(b.estado, 400);

  const c = await llamar('/api/tanques', {
    method: 'POST', cuerpo: { nombre: 'X', panos: 5, plantilla: [], horasCongelacion: 24 }
  });
  assert.equal(c.estado, 400);
});

test('un operario ve los tanques pero no puede modificarlos', async () => {
  await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Juan', rol: 'operario', pin: '4321' }
  });
  const { json } = await llamar('/api/auth/usuarios-disponibles');
  const juan = json.datos.usuarios.find((u) => u.nombre === 'Juan');
  await llamar('/api/auth/entrar-pin', { method: 'POST', cuerpo: { usuarioId: juan.id, pin: '4321' } });

  const ver = await llamar('/api/tanques');
  assert.equal(ver.estado, 200);

  const crear = await llamar('/api/tanques', {
    method: 'POST', cuerpo: { nombre: 'Pirata', panos: 1, plantilla: [3], horasCongelacion: 24 }
  });
  assert.equal(crear.estado, 403);
});
