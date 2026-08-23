/**
 * PRUEBAS DE CAMBIOS DE TICKET  (v0.12)
 *
 * "Pedí 1/2 pero no sabía que era tanto, quería 1/8." Pasa seguido.
 *
 * Lo que se comprueba es que el cambio no rompa nada de lo que ya estaba:
 * el hielo tiene que volver al cuarto frío, la caja tiene que seguir
 * cuadrando, y los dos tickets tienen que quedar amarrados.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'fabrica-cambio-'));
process.env.CARPETA_DATOS = carpeta;
process.env.ARCHIVO_BD = path.join(carpeta, 'prueba.db');

const { migrar } = require('../src/db/migrar');
const { crearApp } = require('../src/servidor');
const { bd } = require('../src/db/conexion');

migrar({ silencioso: true });

let servidor, base, cookie = '', almacenId;

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

/** Vende y devuelve la venta. */
async function vender(dieciseisavos, extra = {}) {
  const r = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos }], ...extra }
  });
  return r.json.datos?.venta;
}

const esperadoCaja = async () =>
  (await llamar('/api/caja')).json.datos.abierta.esperado;

test.before(async () => {
  servidor = crearApp().listen(0);
  await new Promise((r) => servidor.once('listening', r));
  base = `http://127.0.0.1:${servidor.address().port}`;
  await llamar('/api/auth/configuracion-inicial', {
    method: 'POST',
    cuerpo: { nombre: 'Tony', usuario: 'tony', contrasena: 'clavelarga1', pin: '1111' }
  });
  await llamar('/api/auth/yo');                 // abre el turno
  almacenId = (await llamar('/api/existencia/almacenes')).json.datos.almacenes[0].id;
});

test.after(() => {
  servidor.close();
  fs.rmSync(carpeta, { recursive: true, force: true });
});

// ============================================================
// EL CASO DE TODOS LOS DÍAS
// ============================================================

test('cambiar 1/2 por 1/8 devuelve la diferencia', async () => {
  const vieja = await vender(8);                 // 1/2 = $135
  assert.equal(vieja.total_centavos, 13500);

  const r = await llamar(`/api/ventas/${vieja.id}/cambiar`, {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 2 }] }   // 1/8 = $36
  });
  assert.equal(r.estado, 201);

  const d = r.json.datos;
  assert.equal(d.aFavor, 13500, 'lo que traía a favor');
  assert.equal(d.venta.total_centavos, 3600, 'lo que se lleva ahora');
  assert.equal(d.porDevolver, 9900, 'se le regresan $99');
  assert.equal(d.porCobrar, 0);
});

test('el ticket viejo queda cancelado y amarrado al nuevo', async () => {
  const vieja = await vender(8);
  const r = await llamar(`/api/ventas/${vieja.id}/cambiar`, {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 2 }] }
  });
  const nueva = r.json.datos.venta;

  const guardadaVieja = bd.prepare('SELECT * FROM ventas WHERE id = ?').get(vieja.id);
  assert.ok(guardadaVieja.cancelada_en, 'el viejo se cancela');
  assert.equal(guardadaVieja.cambiada_por_venta_id, nueva.id, 'y apunta al nuevo');
  assert.equal(guardadaVieja.total_centavos, 13500, 'pero no se le tocó el importe');

  const guardadaNueva = bd.prepare('SELECT * FROM ventas WHERE id = ?').get(nueva.id);
  assert.equal(guardadaNueva.cambio_de_venta_id, vieja.id, 'el nuevo apunta al viejo');
});

test('si se lleva más, se le cobra la diferencia', async () => {
  const vieja = await vender(2);                 // 1/8 = $36
  const r = await llamar(`/api/ventas/${vieja.id}/cambiar`, {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 8 }] }   // 1/2 = $135
  });
  const d = r.json.datos;
  assert.equal(d.porCobrar, 9900);
  assert.equal(d.porDevolver, 0);
});

test('si el pago no alcanza la diferencia, no se hace el cambio', async () => {
  const vieja = await vender(2);
  const r = await llamar(`/api/ventas/${vieja.id}/cambiar`, {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 8 }], pago: 10 }
  });
  assert.equal(r.estado, 400);
  assert.match(r.json.error, /faltan/i);

  // Y el ticket viejo sigue vivo: no se cancela a medias.
  const g = bd.prepare('SELECT * FROM ventas WHERE id = ?').get(vieja.id);
  assert.equal(g.cancelada_en, null);
});

// ============================================================
// EL HIELO VUELVE AL CUARTO FRÍO
// ============================================================

test('el hielo que se devuelve deja de contar como vendido', async () => {
  await entrarAdmin();
  await llamar('/api/existencia/conteos', {
    method: 'POST', cuerpo: { almacenId, dieciseisavos: 0 }
  });

  const vieja = await vender(8, { almacenId });          // salen 8/16
  let a = (await llamar('/api/existencia')).json.datos.almacenes[0];
  assert.equal(a.vendido, 8);

  await llamar(`/api/ventas/${vieja.id}/cambiar`, {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 2 }], almacenId }
  });

  a = (await llamar('/api/existencia')).json.datos.almacenes[0];
  assert.equal(a.vendido, 2, 'solo salieron los 2/16 que de verdad se llevó');
});

// ============================================================
// LA CAJA SIGUE CUADRANDO
// ============================================================

/**
 * ESTA ES LA PRUEBA IMPORTANTE. Lo esperado en el cajón tiene que moverse
 * exactamente en la diferencia: ni un peso más, ni uno menos.
 */
test('en el mismo turno, la caja se mueve solo la diferencia', async () => {
  const antes = await esperadoCaja();

  const vieja = await vender(8);                          // entran $135
  assert.equal(await esperadoCaja(), antes + 13500);

  await llamar(`/api/ventas/${vieja.id}/cambiar`, {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 2 }] }
  });

  // Se le devolvieron $99, así que en el cajón deben quedar $36 de esta venta.
  assert.equal(await esperadoCaja(), antes + 3600);
});

/**
 * Si el ticket es de un turno ya cerrado, ese dinero entró otro día. Hoy
 * solo sale la diferencia, así que hay que anotarlo o el arqueo sale corto.
 */
test('con un ticket de un turno cerrado, la caja de hoy no sale corta', async () => {
  const vieja = await vender(8);                          // $135 en el turno de hoy

  // Se cierra el turno y se abre otro: ahora el ticket es "de ayer".
  const e = (await llamar('/api/caja')).json.datos.abierta;
  await llamar('/api/caja/cerrar', { method: 'POST', cuerpo: { contado: e.esperado / 100 } });
  await llamar('/api/auth/yo');                           // entrar abre uno nuevo

  const antes = await esperadoCaja();
  assert.equal(antes, 0, 'el turno nuevo arranca en cero');

  await llamar(`/api/ventas/${vieja.id}/cambiar`, {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 2 }] }
  });

  // El cliente no dio billetes: pagó con un ticket de $135 y se llevó $36.
  // De este cajón salieron $99 en efectivo.
  assert.equal(await esperadoCaja(), -9900);

  const mov = (await llamar('/api/caja')).json.datos.movimientos[0];
  assert.equal(mov.tipo, 'salida');
  assert.equal(mov.centavos, 13500);
  assert.match(mov.concepto, /Cambio del ticket/);
});

// ============================================================
// LO QUE NO SE DEBE PODER
// ============================================================

test('un ticket ya cambiado no se cambia otra vez', async () => {
  const vieja = await vender(8);
  await llamar(`/api/ventas/${vieja.id}/cambiar`, {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 2 }] }
  });

  const otra = await llamar(`/api/ventas/${vieja.id}/cambiar`, {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 4 }] }
  });
  assert.equal(otra.estado, 409);
  assert.match(otra.json.error, /ya se cambió/i);
});

test('un ticket cancelado no se puede cambiar', async () => {
  const v = await vender(8);
  await llamar(`/api/ventas/${v.id}/cancelar`, {
    method: 'POST', cuerpo: { motivo: 'Se capturó mal' }
  });

  const r = await llamar(`/api/ventas/${v.id}/cambiar`, {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 2 }] }
  });
  assert.equal(r.estado, 409);
});

test('un cambio vacío se rechaza', async () => {
  const v = await vender(8);
  const r = await llamar(`/api/ventas/${v.id}/cambiar`, {
    method: 'POST', cuerpo: { lineas: [] }
  });
  assert.equal(r.estado, 400);
});

test('un ticket que no existe no se cambia', async () => {
  const r = await llamar('/api/ventas/no-existe/cambiar', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 2 }] }
  });
  assert.equal(r.estado, 404);
});

test('el cambio queda en la bitácora con los dos folios', async () => {
  const vieja = await vender(8);
  const r = await llamar(`/api/ventas/${vieja.id}/cambiar`, {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 2 }] }
  });

  const fila = bd.prepare(`
    SELECT * FROM bitacora WHERE accion = 'venta.cambiada' AND entidad_id = ?
  `).get(vieja.id);
  assert.ok(fila, 'quedó anotado');

  const detalle = JSON.parse(fila.detalle);
  assert.equal(detalle.folioViejo, vieja.folio);
  assert.equal(detalle.folioNuevo, r.json.datos.venta.folio);
  assert.equal(detalle.diferencia, -9900);
});
