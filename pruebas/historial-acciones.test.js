/**
 * LO QUE SE PUEDE HACER DESDE EL HISTORIAL  (v2.0)
 *
 * Buscar un ticket por su número, sacarle una copia, cancelarlo y —solo el
 * administrador, y solo mientras el turno sigue abierto— borrarlo.
 *
 * La regla que se comprueba con más cuidado es la del papel firmado: en
 * cuanto se corta un turno, sus tickets ya no se borran. Ese papel lleva un
 * total, y borrar un renglón dejaría al papel diciendo una cosa y al
 * sistema otra.
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba, ADMIN } = require('./ayudante');

const { llamar, entrarAdmin, entrarPorNombre, bd, preparar } = fabricaDePrueba('hist-acc');

let admin, mari;

preparar(async () => {
  mari = (await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Mari', rol: 'cajero', pin: '7777' }
  })).json.datos.usuario;
  admin = bd.prepare("SELECT * FROM usuarios WHERE rol = 'admin'").get();
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: '500' } });
});

function vender(dieciseisavos = 16) {
  return llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos }], pago: '1000' }
  });
}

const claveAdmin = () => ({ usuarioId: admin.id, contrasena: ADMIN.contrasena });

// ============================================================
// BUSCAR
// ============================================================

test('se busca un ticket por su número', async () => {
  const v = (await vender()).json.datos.venta;

  const r = await llamar(`/api/historial?folio=${v.folio}`);
  assert.equal(r.json.datos.movimientos.length, 1);
  assert.equal(r.json.datos.movimientos[0].folio, v.folio);
});

test('el número de ticket manda sobre los demás filtros', async () => {
  const v = (await vender()).json.datos.venta;
  // Un rango de fechas donde ese ticket no cae: el número gana igual, que
  // es lo que espera quien escribe "#412" para verlo.
  const r = await llamar(`/api/historial?folio=${v.folio}&tipos=gasto`);
  assert.equal(r.json.datos.movimientos.length, 1);
  assert.equal(r.json.datos.movimientos[0].tipo, 'venta');
});

test('un número que no existe no devuelve nada, no revienta', async () => {
  const r = await llamar('/api/historial?folio=99999');
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.movimientos.length, 0);
});

test('lo que no es un número se rechaza', async () => {
  const r = await llamar('/api/historial?folio=hola');
  assert.equal(r.estado, 400);
});

// ============================================================
// LOS CAMBIOS SE VEN DE LOS DOS LADOS
// ============================================================

test('un cambio deja los dos tickets apuntándose', async () => {
  const vieja = (await vender(8)).json.datos.venta;
  const cambio = await llamar(`/api/ventas/${vieja.id}/cambiar`, {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 4 }], motivo: 'Quería menos' }
  });
  assert.equal(cambio.estado, 201);
  const nueva = cambio.json.datos.venta;

  const { movimientos } = (await llamar('/api/historial?limite=300')).json.datos;
  const filaVieja = movimientos.find((m) => m.folio === vieja.folio);
  const filaNueva = movimientos.find((m) => m.folio === nueva.folio);

  assert.equal(filaVieja.cambiado_por, nueva.folio,
               'el viejo dice por cuál se cambió');
  assert.equal(filaNueva.cambio_de, vieja.folio,
               'y el nuevo dice de cuál viene: cayendo en cualquiera se ve la historia');
});

// ============================================================
// EL DETALLE
// ============================================================

test('cada renglón dice qué se llevó, sin abrir el ticket', async () => {
  const v = (await vender(16)).json.datos.venta;
  const { movimientos } = (await llamar(`/api/historial?folio=${v.folio}`)).json.datos;
  assert.match(movimientos[0].detalle, /Hielo/,
               'el "se llevó" viene en la lista: abrirlo para leerlo era un paso de más');
});

// ============================================================
// BORRAR: SOLO EL ADMINISTRADOR, SOLO CON SU CONTRASEÑA
// ============================================================

test('el cajero no puede borrar un ticket', async () => {
  const v = (await vender()).json.datos.venta;
  await entrarPorNombre('Mari', '7777');

  const r = await llamar(`/api/ventas/${v.id}`, { method: 'DELETE', cuerpo: {} });
  assert.equal(r.estado, 403);
  assert.ok(bd.prepare('SELECT 1 FROM ventas WHERE id = ?').get(v.id), 'sigue ahí');

  await entrarAdmin();
});

test('sin la contraseña no se borra, aunque seas el administrador', async () => {
  const v = (await vender()).json.datos.venta;
  const r = await llamar(`/api/ventas/${v.id}`, { method: 'DELETE', cuerpo: {} });
  assert.equal(r.estado, 403);
  assert.equal(r.json.requiereContrasena, true);
  assert.ok(bd.prepare('SELECT 1 FROM ventas WHERE id = ?').get(v.id));
});

test('con una contraseña equivocada tampoco', async () => {
  const v = (await vender()).json.datos.venta;
  const r = await llamar(`/api/ventas/${v.id}`, {
    method: 'DELETE',
    cuerpo: { autorizacion: { usuarioId: admin.id, contrasena: 'la-que-no-es' } }
  });
  assert.equal(r.estado, 403);
  assert.ok(bd.prepare('SELECT 1 FROM ventas WHERE id = ?').get(v.id));
});

test('el administrador borra un ticket del turno abierto, con sus líneas', async () => {
  const v = (await vender()).json.datos.venta;

  const r = await llamar(`/api/ventas/${v.id}`, {
    method: 'DELETE', cuerpo: { autorizacion: claveAdmin() }
  });
  assert.equal(r.estado, 200);
  assert.equal(bd.prepare('SELECT 1 FROM ventas WHERE id = ?').get(v.id), undefined);
  assert.equal(bd.prepare('SELECT 1 FROM venta_lineas WHERE venta_id = ?').get(v.id), undefined,
               'no quedan líneas huérfanas');

  const rastro = bd.prepare("SELECT * FROM bitacora WHERE accion = 'venta.borrada'").get();
  assert.ok(rastro, 'lo único que no se borra es la constancia de que alguien borró');
});

test('un ticket de un turno YA CORTADO no se borra: se cancela', async () => {
  const v = (await vender()).json.datos.venta;

  // Se cierra el turno: ya hay un papel firmado con ese ticket dentro.
  const estado = (await llamar('/api/caja')).json.datos.abierta;
  await llamar('/api/caja/cerrar', {
    method: 'POST', cuerpo: { contado: String(estado.esperado / 100) }
  });

  const r = await llamar(`/api/ventas/${v.id}`, {
    method: 'DELETE', cuerpo: { autorizacion: claveAdmin() }
  });
  assert.equal(r.estado, 409);
  assert.equal(r.json.sugerencia, 'cancelar');
  assert.ok(bd.prepare('SELECT 1 FROM ventas WHERE id = ?').get(v.id), 'sigue ahí');

  // Y cancelarlo sí se puede: es justo lo que la respuesta sugiere.
  const cancela = await llamar(`/api/ventas/${v.id}/cancelar`, {
    method: 'POST', cuerpo: { motivo: 'Se capturó de más' }
  });
  assert.equal(cancela.estado, 200);
});

test('un ticket que es parte de un cambio no se borra suelto', async () => {
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: '500' } });

  const vieja = (await vender(8)).json.datos.venta;
  const nueva = (await llamar(`/api/ventas/${vieja.id}/cambiar`, {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 4 }], motivo: 'Quería menos' }
  })).json.datos.venta;

  for (const id of [vieja.id, nueva.id]) {
    const r = await llamar(`/api/ventas/${id}`, {
      method: 'DELETE', cuerpo: { autorizacion: claveAdmin() }
    });
    assert.equal(r.estado, 409, 'borrar uno dejaría al otro apuntando a la nada');
    assert.equal(r.json.sugerencia, 'cancelar');
  }
});

// ============================================================
// LA COPIA
// ============================================================

test('cualquiera que pueda vender saca una copia', async () => {
  const v = (await vender()).json.datos.venta;
  await entrarPorNombre('Mari', '7777');

  // Sin impresora configurada contesta que no imprimió, no revienta: la
  // pantalla lo resuelve con el navegador.
  const r = await llamar(`/api/impresion/venta/${v.id}`, {
    method: 'POST', cuerpo: { copia: true }
  });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.impreso, false);
  assert.equal(r.json.datos.motivo, 'sin-destino');

  await entrarAdmin();
});
