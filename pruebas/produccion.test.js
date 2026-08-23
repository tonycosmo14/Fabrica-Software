/**
 * Pruebas de Producción con el modelo real de la fábrica.
 *
 * Lo que se comprueba:
 *  - La rotación intercalada (1, 3, 5... luego 2, 4, 6...) es regla.
 *  - Sacar un paño lo rellena en el mismo movimiento.
 *  - Un paño a medias queda en proceso y otro lo puede terminar.
 *  - Solo gerente o admin se saltan la rotación, y con motivo.
 *  - La captura en lote registra la jornada completa de un obrero.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'fabrica-prod-'));
process.env.CARPETA_DATOS = carpeta;
process.env.ARCHIVO_BD = path.join(carpeta, 'prueba.db');

const { migrar } = require('../src/db/migrar');
const { crearApp } = require('../src/servidor');
const { bd } = require('../src/db/conexion');

migrar({ silencioso: true });

let servidor, base, cookie = '', tanqueId, panos, operarioId;

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

async function entrarComo(pin) {
  const { json } = await llamar('/api/auth/usuarios-disponibles');
  const u = json.datos.usuarios.find((x) => x.pin === pin) || null;
  return u;
}

async function estadoTanque() {
  const { json } = await llamar(`/api/produccion/estado?tanque=${tanqueId}`);
  return json.datos;
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

  const o = await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Don Chema', rol: 'operario', pin: '2222' }
  });
  operarioId = o.json.datos.usuario.id;
});

test.after(() => {
  servidor.close();
  fs.rmSync(carpeta, { recursive: true, force: true });
});

test('el primero de la rotación es el paño 1', async () => {
  const d = await estadoTanque();
  assert.equal(d.tanque.siguiente.numero, 1);
});

test('sacar un paño lo rellena en el mismo movimiento', async () => {
  const r = await llamar(`/api/produccion/panos/${panos[0].id}/sacar`, {
    method: 'POST', cuerpo: { tipoAgua: 'purificada', ejecutorId: operarioId }
  });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.marquetas, 6);      // 2 canastas x 3 moldes
  assert.equal(r.json.datos.terminado, true);

  // El paño quedó congelando, no fuera: los moldes se volvieron a llenar.
  const d = await estadoTanque();
  assert.equal(d.tanque.panos[0].estado, 'congelando');
  assert.equal(d.fuera, 0);
});

test('tras el paño 1 toca el 3, no el 2', async () => {
  const d = await estadoTanque();
  assert.equal(d.tanque.siguiente.numero, 3);
});

test('un operario NO puede saltarse la rotación', async () => {
  const chema = (await llamar('/api/auth/usuarios-disponibles')).json.datos.usuarios
    .find((u) => u.nombre === 'Don Chema');
  await llamar('/api/auth/entrar-pin', { method: 'POST', cuerpo: { usuarioId: chema.id, pin: '2222' } });

  const r = await llamar(`/api/produccion/panos/${panos[1].id}/sacar`, {
    method: 'POST', cuerpo: { tipoAgua: 'purificada' }
  });
  assert.equal(r.estado, 403);
  assert.match(r.json.error, /Toca el paño 3/);
  assert.equal(r.json.tocaPano, 3);
});

test('el operario sí puede sacar el que le toca', async () => {
  const r = await llamar(`/api/produccion/panos/${panos[2].id}/sacar`, {
    method: 'POST', cuerpo: { tipoAgua: 'potable' }
  });
  assert.equal(r.estado, 201);

  const d = await estadoTanque();
  assert.equal(d.tanque.siguiente.numero, 5);
});

test('el admin se salta la rotación, pero tiene que escribir el motivo', async () => {
  await llamar('/api/auth/entrar-contrasena', {
    method: 'POST', cuerpo: { usuario: 'tony', contrasena: 'clavelarga1' }
  });

  const sinMotivo = await llamar(`/api/produccion/panos/${panos[1].id}/sacar`, {
    method: 'POST', cuerpo: { tipoAgua: 'purificada' }
  });
  assert.equal(sinMotivo.estado, 400);
  assert.equal(sinMotivo.json.requiereMotivo, true);

  const conMotivo = await llamar(`/api/produccion/panos/${panos[1].id}/sacar`, {
    method: 'POST', cuerpo: { tipoAgua: 'purificada', motivo: 'Se necesitaba hielo ya' }
  });
  assert.equal(conMotivo.estado, 201);

  const sp = bd.prepare('SELECT * FROM sacadas_pano WHERE motivo_orden IS NOT NULL').get();
  assert.ok(sp.autorizada_por);
  assert.equal(sp.motivo_orden, 'Se necesitaba hielo ya');
});

test('un paño a medias queda en proceso y es el siguiente que toca', async () => {
  // Solo la primera canasta del paño 5: al obrero se le acabó el agua.
  const d0 = await estadoTanque();
  const pano5 = d0.tanque.panos.find((p) => p.numero === 5);

  const r = await llamar(`/api/produccion/panos/${pano5.id}/sacar`, {
    method: 'POST',
    cuerpo: { tipoAgua: 'purificada', canastas: [pano5.canastas[0].id], ejecutorId: operarioId }
  });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.terminado, false);

  const d = await estadoTanque();
  const p5 = d.tanque.panos.find((p) => p.numero === 5);
  assert.equal(p5.enProceso, true);
  assert.equal(d.tanque.siguiente.numero, 5);            // primero se termina lo empezado
  assert.match(d.tanque.siguiente.porque, /a medias/);
});

test('otro obrero termina el paño que quedó a medias', async () => {
  const d0 = await estadoTanque();
  const pano5 = d0.tanque.panos.find((p) => p.numero === 5);

  const r = await llamar(`/api/produccion/panos/${pano5.id}/sacar`, {
    method: 'POST', cuerpo: { tipoAgua: 'purificada' }
  });
  assert.equal(r.json.datos.terminado, true);

  const d = await estadoTanque();
  assert.equal(d.tanque.panos.find((p) => p.numero === 5).enProceso, false);

  // Los dos obreros quedaron registrados en las canastas que hizo cada uno.
  const quienes = bd.prepare(`
    SELECT DISTINCT ejecutor_id FROM sacadas
     WHERE sacada_pano_id = (SELECT id FROM sacadas_pano WHERE pano_id = ? ORDER BY iniciada_en DESC LIMIT 1)
  `).all(pano5.id);
  assert.equal(quienes.length, 2);
});

test('dejar un paño fuera NO lo rellena y sale en la alerta', async () => {
  const d0 = await estadoTanque();
  const siguiente = d0.tanque.panos.find((p) => p.numero === d0.tanque.siguiente.numero);

  await llamar(`/api/produccion/panos/${siguiente.id}/sacar`, {
    method: 'POST', cuerpo: { rellenar: false, motivo: 'Limpieza del molde' }
  });

  const d = await estadoTanque();
  assert.ok(d.fuera > 0);
  assert.equal(d.tanque.panos.find((p) => p.id === siguiente.id).estado, 'fuera');
});

test('la merma se guarda y el molde recuerda que falló', async () => {
  const d0 = await estadoTanque();
  const pano = d0.tanque.panos.find((p) => p.estado === 'congelando');
  const molde = pano.canastas[0].moldes[0];

  await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST',
    cuerpo: {
      tipoAgua: 'purificada', motivo: 'Prueba de merma',
      resultados: [{ moldeId: molde.id, resultado: 'merma' }]
    }
  });

  const d = await estadoTanque();
  const mismo = d.tanque.panos.find((p) => p.id === pano.id)
                  .canastas[0].moldes.find((m) => m.id === molde.id);
  assert.equal(mismo.ultimoResultado, 'merma');
});

test('la captura en lote registra la jornada completa de un obrero', async () => {
  const r2 = await llamar('/api/tanques', {
    method: 'POST', cuerpo: { nombre: 'T', panos: 4, plantilla: [3], horasCongelacion: 24 }
  });
  const nuevos = r2.json.datos.tanque.panos;

  const r = await llamar('/api/produccion/lote', {
    method: 'POST',
    cuerpo: {
      ejecutorId: operarioId, tipoAgua: 'potable',
      panos: [nuevos[0].id, nuevos[1].id, nuevos[2].id]
    }
  });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.panos.length, 3);
  assert.equal(r.json.datos.marquetas, 9);       // 3 paños x 3 moldes

  // Todo quedó a nombre del obrero, no de quien lo capturó.
  const filas = bd.prepare(`
    SELECT ejecutor_id, capturista_id FROM sacadas_pano
     WHERE notas LIKE 'Capturado en lote%'
  `).all();
  assert.equal(filas.length, 3);
  assert.ok(filas.every((f) => f.ejecutor_id === operarioId));
  assert.ok(filas.every((f) => f.capturista_id !== operarioId));
});

test('el resumen del día reparte las marquetas por obrero', async () => {
  const { json } = await llamar('/api/produccion/hoy');
  const chema = json.datos.porObrero.find((o) => o.nombre === 'Don Chema');
  assert.ok(chema);
  assert.ok(chema.marquetas > 0);
  assert.ok(json.datos.panos.length > 0);
});

test('un gerente puede autorizar y corregir; un cajero no', async () => {
  await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Lupita', rol: 'gerente', pin: '3333' }
  });
  await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Rosa', rol: 'cajero', pin: '4444' }
  });

  const lista = (await llamar('/api/auth/usuarios-disponibles')).json.datos.usuarios;
  const lupita = lista.find((u) => u.nombre === 'Lupita');
  const rosa = lista.find((u) => u.nombre === 'Rosa');

  await llamar('/api/auth/entrar-pin', { method: 'POST', cuerpo: { usuarioId: rosa.id, pin: '4444' } });
  const d = await estadoTanque();
  assert.equal(d.puedeAutorizar, false);

  await llamar('/api/auth/entrar-pin', { method: 'POST', cuerpo: { usuarioId: lupita.id, pin: '3333' } });
  const d2 = await estadoTanque();
  assert.equal(d2.puedeAutorizar, true);
});

test('anular un registro equivocado deja el paño como estaba', async () => {
  await llamar('/api/auth/entrar-contrasena', {
    method: 'POST', cuerpo: { usuario: 'tony', contrasena: 'clavelarga1' }
  });

  const antes = bd.prepare('SELECT COUNT(*) n FROM sacadas').get().n;
  const sp = bd.prepare(
    'SELECT id FROM sacadas_pano WHERE notas LIKE \'Capturado en lote%\' LIMIT 1'
  ).get();

  const r = await llamar(`/api/produccion/sacadas-pano/${sp.id}/anular`, {
    method: 'POST', cuerpo: { motivo: 'Se equivocaron de paño' }
  });
  assert.equal(r.estado, 200);

  const despues = bd.prepare('SELECT COUNT(*) n FROM sacadas').get().n;
  assert.ok(despues < antes);

  // La sacada del paño no se borra: queda marcada como anulada.
  const marcada = bd.prepare('SELECT notas FROM sacadas_pano WHERE id = ?').get(sp.id);
  assert.match(marcada.notas, /^ANULADA/);

  // Y quedó anotado en la bitácora.
  const evento = bd.prepare(
    "SELECT * FROM bitacora WHERE accion = 'produccion.anulacion' ORDER BY fecha DESC LIMIT 1"
  ).get();
  assert.ok(evento);
});

test('anular exige motivo', async () => {
  const sp = bd.prepare(
    'SELECT id FROM sacadas_pano WHERE notas NOT LIKE \'ANULADA%\' OR notas IS NULL LIMIT 1'
  ).get();
  const r = await llamar(`/api/produccion/sacadas-pano/${sp.id}/anular`, {
    method: 'POST', cuerpo: {}
  });
  assert.equal(r.estado, 400);
});
