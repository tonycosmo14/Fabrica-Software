/**
 * Pruebas de la Existencia: el cuadre del cuarto frío.
 *
 *     existencia anterior + producido − contado = SALIDAS
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'fabrica-exis-'));
process.env.CARPETA_DATOS = carpeta;
process.env.ARCHIVO_BD = path.join(carpeta, 'prueba.db');

const { migrar } = require('../src/db/migrar');
const { crearApp } = require('../src/servidor');
const { bd } = require('../src/db/conexion');

migrar({ silencioso: true });

let servidor, base, cookie = '', tanqueId, panos, almacenId;

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

/** Saca el paño que toca en el tanque, sin pedir autorización. */
async function sacarElQueToca() {
  const { json } = await llamar(`/api/produccion/estado?tanque=${tanqueId}`);
  const toca = json.datos.tanque.siguiente;
  await llamar(`/api/produccion/panos/${toca.id}/sacar`, {
    method: 'POST', cuerpo: { tipoAgua: 'purificada' }
  });
  return json.datos.tanque.panos.find((p) => p.id === toca.id).total_moldes;
}

test.before(async () => {
  servidor = crearApp().listen(0);
  await new Promise((r) => servidor.once('listening', r));
  base = `http://127.0.0.1:${servidor.address().port}`;

  await llamar('/api/auth/configuracion-inicial', {
    method: 'POST',
    cuerpo: { nombre: 'Tony', usuario: 'tony', contrasena: 'clavelarga1', pin: '1111' }
  });

  const r = await llamar('/api/tanques', {
    method: 'POST',
    cuerpo: { nombre: '2N', panos: 6, plantilla: [3, 3], horasCongelacion: 24 }
  });
  tanqueId = r.json.datos.tanque.id;
  panos = r.json.datos.tanque.panos;

  const a = await llamar('/api/existencia/almacenes');
  almacenId = a.json.datos.almacenes[0].id;
});

test.after(() => {
  servidor.close();
  fs.rmSync(carpeta, { recursive: true, force: true });
});

test('el sistema arranca con un cuarto frío listo', async () => {
  const { json } = await llamar('/api/existencia');
  assert.equal(json.datos.almacenes.length, 1);
  assert.equal(json.datos.almacenes[0].almacen.nombre, 'Cuarto frío');
  assert.deepEqual(json.datos.horarios, ['15:00', '20:00']);
});

test('lo que sale de los tanques suma a lo que debería haber', async () => {
  const moldes = await sacarElQueToca();      // 6 marquetas

  const { json } = await llamar('/api/existencia');
  const a = json.datos.almacenes[0];
  assert.equal(a.enMarquetas.anterior, 0);
  assert.equal(a.enMarquetas.producido, moldes);
  assert.equal(a.enMarquetas.teorico, moldes);
});

test('el primer conteo solo fija el punto de partida', async () => {
  const r = await llamar('/api/existencia/conteos', {
    method: 'POST', cuerpo: { almacenId, marquetas: 6 }
  });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.resumen.primerConteo, true);
  assert.equal(r.json.datos.resumen.contado, 6);
});

test('el segundo conteo revela lo que salió del cuarto frío', async () => {
  await sacarElQueToca();                     // +6 marquetas producidas

  // De las 12 que debería haber, solo quedan 4: salieron 8.
  const r = await llamar('/api/existencia/conteos', {
    method: 'POST', cuerpo: { almacenId, marquetas: 4 }
  });
  const s = r.json.datos.resumen;

  assert.equal(s.anterior, 6);
  assert.equal(s.producido, 6);
  assert.equal(s.teorico, 12);
  assert.equal(s.contado, 4);
  assert.equal(s.salidas, 8);
});

test('si sobran marquetas, las salidas salen en negativo', async () => {
  const r = await llamar('/api/existencia/conteos', {
    method: 'POST', cuerpo: { almacenId, marquetas: 10 }
  });
  // Debería haber 4 (no se produjo nada) y hay 10: sobran 6.
  assert.equal(r.json.datos.resumen.salidas, -6);
});

test('el conteo se guarda en dieciseisavos, aunque se capture en marquetas', () => {
  const c = bd.prepare('SELECT * FROM conteos ORDER BY fecha DESC LIMIT 1').get();
  assert.equal(c.contado, 10 * 16);
  assert.equal(Number.isInteger(c.contado), true);
});

test('el conteo congela los números: corregir producción vieja no lo cambia', async () => {
  const antes = bd.prepare('SELECT * FROM conteos ORDER BY fecha DESC LIMIT 1').get();

  // Se anula una sacada anterior al conteo.
  const sp = bd.prepare('SELECT id, pano_id FROM sacadas_pano ORDER BY iniciada_en LIMIT 1').get();
  await llamar(`/api/produccion/panos/${sp.pano_id}/anular-ultima`, {
    method: 'POST', cuerpo: { motivo: 'Prueba de que el histórico no se mueve' }
  });

  const despues = bd.prepare('SELECT * FROM conteos WHERE id = ?').get(antes.id);
  assert.equal(despues.producido, antes.producido);
  assert.equal(despues.salidas, antes.salidas);
  assert.equal(despues.existencia_anterior, antes.existencia_anterior);
});

test('anular un conteo devuelve el anterior como bueno', async () => {
  const ultimo = bd.prepare('SELECT * FROM conteos WHERE anulado_en IS NULL ORDER BY fecha DESC LIMIT 1').get();
  const previo = bd.prepare(`
    SELECT * FROM conteos WHERE anulado_en IS NULL AND fecha < ? ORDER BY fecha DESC LIMIT 1
  `).get(ultimo.fecha);

  const r = await llamar(`/api/existencia/conteos/${ultimo.id}/anular`, {
    method: 'POST', cuerpo: { motivo: 'Se contó mal' }
  });
  assert.equal(r.estado, 200);

  const { json } = await llamar('/api/existencia');
  assert.equal(json.datos.almacenes[0].existenciaAnterior, previo.contado);
});

test('anular exige motivo', async () => {
  const c = bd.prepare('SELECT id FROM conteos WHERE anulado_en IS NULL LIMIT 1').get();
  const r = await llamar(`/api/existencia/conteos/${c.id}/anular`, { method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 400);
});

test('se puede dar de alta un segundo cuarto frío que no recibe producción', async () => {
  const r = await llamar('/api/existencia/almacenes', {
    method: 'POST', cuerpo: { nombre: 'Bodega chica', recibeProduccion: false }
  });
  assert.equal(r.estado, 201);

  const { json } = await llamar('/api/existencia');
  const bodega = json.datos.almacenes.find((a) => a.almacen.nombre === 'Bodega chica');
  assert.equal(bodega.producido, 0);          // no recibe lo de los tanques
  assert.equal(bodega.enMarquetas.teorico, 0);
});

test('no se puede dejar la fábrica sin un cuarto que reciba la producción', async () => {
  const { json } = await llamar('/api/existencia/almacenes');
  const principal = json.datos.almacenes.find((a) => a.recibe_produccion);

  const r = await llamar(`/api/existencia/almacenes/${principal.id}`, {
    method: 'PUT', cuerpo: { recibeProduccion: false }
  });
  assert.equal(r.estado, 400);
  assert.match(r.json.error, /tiene que recibir la producción/);
});

test('los horarios de conteo se validan', async () => {
  const mala = await llamar('/api/existencia/horarios', {
    method: 'PUT', cuerpo: { horarios: ['25:00'] }
  });
  assert.equal(mala.estado, 400);

  const buena = await llamar('/api/existencia/horarios', {
    method: 'PUT', cuerpo: { horarios: ['15:00', '20:00', '07:30'] }
  });
  assert.equal(buena.estado, 200);
  assert.deepEqual(buena.json.datos.horarios, ['07:30', '15:00', '20:00']);
});

test('un cajero cuenta pero no configura ni anula', async () => {
  await llamar('/api/usuarios', { method: 'POST', cuerpo: { nombre: 'Rosa', rol: 'cajero', pin: '4444' } });
  const lista = (await llamar('/api/auth/usuarios-disponibles')).json.datos.usuarios;
  const rosa = lista.find((u) => u.nombre === 'Rosa');
  await llamar('/api/auth/entrar-pin', { method: 'POST', cuerpo: { usuarioId: rosa.id, pin: '4444' } });

  const cuenta = await llamar('/api/existencia/conteos', {
    method: 'POST', cuerpo: { almacenId, marquetas: 3 }
  });
  assert.equal(cuenta.estado, 201);

  const c = bd.prepare('SELECT id FROM conteos WHERE anulado_en IS NULL ORDER BY fecha DESC LIMIT 1').get();
  const anula = await llamar(`/api/existencia/conteos/${c.id}/anular`, {
    method: 'POST', cuerpo: { motivo: 'No debería poder' }
  });
  assert.equal(anula.estado, 403);

  const config = await llamar('/api/existencia/horarios', {
    method: 'PUT', cuerpo: { horarios: ['10:00'] }
  });
  assert.equal(config.estado, 403);
});

test('un operario no ve la existencia', async () => {
  await entrarAdmin();
  await llamar('/api/usuarios', { method: 'POST', cuerpo: { nombre: 'Chema', rol: 'operario', pin: '5555' } });
  const lista = (await llamar('/api/auth/usuarios-disponibles')).json.datos.usuarios;
  const chema = lista.find((u) => u.nombre === 'Chema');
  await llamar('/api/auth/entrar-pin', { method: 'POST', cuerpo: { usuarioId: chema.id, pin: '5555' } });

  const r = await llamar('/api/existencia');
  assert.equal(r.estado, 403);
});
