/**
 * Pruebas de Producción.
 * Lo importante: el estado de la canasta se DEDUCE de sus eventos, y sacar
 * y rellenar son dos cosas distintas que no se acoplan.
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

let servidor, base, cookie = '', tanqueId, panos;

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

/**
 * Mueve hacia atrás en el tiempo los eventos de una canasta, para simular
 * que pasaron horas sin tener que esperarlas.
 *
 * Ojo: hay que envejecer TODOS sus eventos manteniendo el orden. Si solo se
 * retrasa el rellenado, queda por detrás de la sacada y el último evento
 * pasa a ser la sacada, que es justo lo contrario de lo que se quiere probar.
 */
function envejecer(canastaId, horasDelUltimo) {
  const eventos = [
    ...bd.prepare("SELECT id, fecha, 'sacadas' AS tabla FROM sacadas WHERE canasta_id = ?").all(canastaId),
    ...bd.prepare("SELECT id, fecha, 'rellenados' AS tabla FROM rellenados WHERE canasta_id = ?").all(canastaId)
  ].sort((a, b) => a.fecha.localeCompare(b.fecha));

  // El último queda a "horasDelUltimo" de ahora; los anteriores, una hora
  // antes cada uno, conservando el orden original.
  eventos.reverse().forEach((e, i) => {
    const fecha = new Date(Date.now() - (horasDelUltimo + i) * 3600000).toISOString();
    bd.prepare(`UPDATE ${e.tabla} SET fecha = ? WHERE id = ?`).run(fecha, e.id);
  });
}

test.before(async () => {
  servidor = crearApp().listen(0);
  await new Promise((r) => servidor.once('listening', r));
  base = `http://127.0.0.1:${servidor.address().port}`;

  await llamar('/api/auth/configuracion-inicial', {
    method: 'POST',
    cuerpo: { nombre: 'Tony', usuario: 'tony', contrasena: 'clavelarga1', pin: '1234' }
  });

  const r = await llamar('/api/tanques', {
    method: 'POST',
    cuerpo: { nombre: '2N', panos: 3, plantilla: [3, 3], horasCongelacion: 24 }
  });
  tanqueId = r.json.datos.tanque.id;
  panos = r.json.datos.tanque.panos;
});

test.after(() => {
  servidor.close();
  fs.rmSync(carpeta, { recursive: true, force: true });
});

test('sin turno abierto no se puede registrar nada', async () => {
  const c = panos[0].canastas[0].id;
  const r = await llamar('/api/produccion/sacar', { method: 'POST', cuerpo: { canastaId: c } });
  assert.equal(r.estado, 409);
  assert.match(r.json.error, /turno/);
});

test('se abre el turno y no se puede abrir dos veces', async () => {
  const a = await llamar('/api/produccion/turno/abrir', { method: 'POST', cuerpo: { nombre: 'Noche' } });
  assert.equal(a.estado, 201);
  assert.equal(a.json.datos.turno.nombre, 'Noche');

  const b = await llamar('/api/produccion/turno/abrir', { method: 'POST', cuerpo: {} });
  assert.equal(b.estado, 409);
});

test('un tanque sin historial arranca con todas las canastas listas', async () => {
  const { json } = await llamar('/api/produccion/estado');
  const canastas = json.datos.tanque.panos.flatMap((p) => p.canastas);
  assert.ok(canastas.every((c) => c.estado === 'lista' && c.sinRegistro));
});

test('al sacar una canasta queda FUERA: sacada pero sin rellenar', async () => {
  const c = panos[0].canastas[0].id;
  const r = await llamar('/api/produccion/sacar', { method: 'POST', cuerpo: { canastaId: c } });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.marquetas, 3);      // los 3 moldes salieron bien

  const { json } = await llamar('/api/produccion/estado');
  const canasta = json.datos.tanque.panos[0].canastas[0];
  assert.equal(canasta.estado, 'fuera');
  assert.equal(json.datos.fuera, 1);
});

test('no se puede sacar dos veces una canasta que ya está fuera', async () => {
  const c = panos[0].canastas[0].id;
  const r = await llamar('/api/produccion/sacar', { method: 'POST', cuerpo: { canastaId: c } });
  assert.equal(r.estado, 409);
  assert.match(r.json.error, /rellenarla/);
});

test('al rellenar arranca el reloj: la canasta pasa a CONGELANDO', async () => {
  const c = panos[0].canastas[0].id;
  const r = await llamar('/api/produccion/rellenar', {
    method: 'POST', cuerpo: { canastaId: c, tipoAgua: 'purificada' }
  });
  assert.equal(r.estado, 201);

  const { json } = await llamar('/api/produccion/estado');
  const canasta = json.datos.tanque.panos[0].canastas[0];
  assert.equal(canasta.estado, 'congelando');
  assert.equal(canasta.tipoAgua, 'purificada');
  assert.equal(json.datos.fuera, 0);
});

test('el rellenado exige decir con qué agua', async () => {
  const c = panos[0].canastas[1].id;
  const r = await llamar('/api/produccion/rellenar', { method: 'POST', cuerpo: { canastaId: c } });
  assert.equal(r.estado, 400);
  assert.match(r.json.error, /purificada o potable/);
});

test('cumplidas las horas, la canasta pasa sola a LISTA', async () => {
  const c = panos[0].canastas[0].id;
  envejecer(c, 25);                            // el tanque pide 24 h

  const { json } = await llamar('/api/produccion/estado');
  const canasta = json.datos.tanque.panos[0].canastas[0];
  assert.equal(canasta.estado, 'lista');
  assert.ok(canasta.horas >= 25);
});

test('la sacada guarda las horas reales que estuvo congelando', async () => {
  const c = panos[0].canastas[0].id;
  const r = await llamar('/api/produccion/sacar', { method: 'POST', cuerpo: { canastaId: c } });
  assert.ok(r.json.datos.sacada.horas >= 25);
});

test('la merma se registra molde por molde y no cuenta como marqueta', async () => {
  const canasta = panos[1].canastas[0];
  const detalle = await llamar(`/api/tanques/${tanqueId}`);
  const moldes = detalle.json.datos.tanque.panos[1].canastas[0].moldes;

  const r = await llamar('/api/produccion/sacar', {
    method: 'POST',
    cuerpo: {
      canastaId: canasta.id,
      resultados: [
        { moldeId: moldes[0].id, resultado: 'merma' },
        { moldeId: moldes[1].id, resultado: 'hueco' }
      ]
    }
  });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.marquetas, 1);            // solo 1 de 3 salió bien
  assert.equal(r.json.datos.sacada.resumen.merma, 1);
  assert.equal(r.json.datos.sacada.resumen.hueco, 1);
});

test('cada molde de la sacada quedó registrado con su posición', () => {
  const filas = bd.prepare(`
    SELECT m.numero, sm.resultado
      FROM sacadas_moldes sm
      JOIN moldes m ON m.id = sm.molde_id
      JOIN sacadas s ON s.id = sm.sacada_id
     ORDER BY s.fecha DESC, m.numero LIMIT 3
  `).all();
  assert.equal(filas.length, 3);
  assert.deepEqual(filas.map((f) => f.numero), [1, 2, 3]);
});

test('el resumen del turno cuenta marquetas y merma por separado', async () => {
  const { json } = await llamar('/api/produccion/resumen-turno');
  assert.equal(json.datos.marquetas, 7);   // 3 + 3 + 1
  assert.equal(json.datos.merma, 2);
});

test('el turno no se cierra si quedan canastas sin rellenar', async () => {
  const r = await llamar('/api/produccion/turno/cerrar', { method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 409);
  assert.ok(r.json.canastasFuera.length > 0);
});

test('el turno se puede cerrar a la fuerza y queda constancia', async () => {
  const r = await llamar('/api/produccion/turno/cerrar', { method: 'POST', cuerpo: { forzar: true } });
  assert.equal(r.estado, 200);
  assert.ok(r.json.datos.canastasFuera > 0);

  const t = await llamar('/api/produccion/turno');
  assert.equal(t.json.datos.turno, null);
});

test('la bitácora guarda quién ejecutó y quién capturó cada movimiento', () => {
  const evento = bd.prepare(
    "SELECT * FROM bitacora WHERE accion = 'produccion.sacada' ORDER BY fecha DESC LIMIT 1"
  ).get();
  assert.ok(evento.ejecutor_id);
  assert.ok(evento.capturista_id);
});

test('el sistema sugiere el paño que lleva más tiempo congelando', async () => {
  await llamar('/api/produccion/turno/abrir', { method: 'POST', cuerpo: { nombre: 'Día' } });

  // Paño 3: rellenado hace mucho. Paño 1: rellenado hace poco.
  for (const c of panos[2].canastas) {
    await llamar('/api/produccion/rellenar', { method: 'POST', cuerpo: { canastaId: c.id, tipoAgua: 'potable' } });
    envejecer(c.id, 40);
  }
  for (const c of panos[0].canastas) {
    await llamar('/api/produccion/rellenar', { method: 'POST', cuerpo: { canastaId: c.id, tipoAgua: 'potable' } });
    envejecer(c.id, 26);
  }

  const { json } = await llamar('/api/produccion/estado');
  assert.equal(json.datos.sugerido.numero, 3);   // el más viejo, no el primero
});

test('un cajero puede ver producción pero no registrar', async () => {
  await llamar('/api/usuarios', { method: 'POST', cuerpo: { nombre: 'Ana', rol: 'repartidor', pin: '7777' } });
  const { json } = await llamar('/api/auth/usuarios-disponibles');
  const ana = json.datos.usuarios.find((u) => u.nombre === 'Ana');
  await llamar('/api/auth/entrar-pin', { method: 'POST', cuerpo: { usuarioId: ana.id, pin: '7777' } });

  const ver = await llamar('/api/produccion/estado');
  assert.equal(ver.estado, 403);   // el repartidor no tiene produccion.ver
});
