/**
 * DEVOLUCIONES COMPLETAS  (v2.1)
 *
 * "A veces los clientes se cansan de esperar su hielo o la fila y regresan
 * a la caja y nos piden que les devolvamos su dinero."
 *
 * Una devolución completa ES cancelar el ticket: el hielo vuelve al cuarto
 * frío solo y la caja se ajusta sola. Lo que se comprueba aquí es que las
 * dos cuentas cuadren de verdad, y el caso que se olvida siempre: el ticket
 * de AYER, cuyo dinero entró en otro turno pero sale del cajón de hoy.
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, entrarPorNombre, bd, preparar } = fabricaDePrueba('devoluciones');

preparar(async () => {
  await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Mari', rol: 'cajero', pin: '7777' }
  });
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: '500' } });
});

function vender(dieciseisavos = 16) {
  return llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos }], pago: '500' }
  }).then((r) => r.json.datos.venta);
}

const caja = () => llamar('/api/caja').then((r) => r.json.datos.abierta);
const existencia = () => llamar('/api/existencia').then((r) => r.json.datos.almacenes[0]);

// ============================================================
// LA DEVOLUCIÓN DE UN TICKET DE HOY
// ============================================================

test('devolver un ticket saca su importe del cajón', async () => {
  const antes = await caja();
  const v = await vender(16);
  assert.equal((await caja()).esperado, antes.esperado + v.total_centavos);

  const r = await llamar(`/api/ventas/${v.id}/devolver`, {
    method: 'POST', cuerpo: { motivo: 'espera' }
  });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.centavos, v.total_centavos, 'dice cuánto sacar del cajón');
  assert.equal(r.json.datos.enEfectivo, true);

  assert.equal((await caja()).esperado, antes.esperado,
               'la caja vuelve a donde estaba: el dinero se fue con el cliente');
});

test('y el hielo vuelve al cuarto frío', async () => {
  const antes = await existencia();
  const v = await vender(16);
  assert.equal((await existencia()).esperado, antes.esperado - 16);

  await llamar(`/api/ventas/${v.id}/devolver`, { method: 'POST', cuerpo: { motivo: 'calidad' } });
  assert.equal((await existencia()).esperado, antes.esperado,
               'nunca salió de la fábrica');
});

test('el ticket queda marcado con el motivo, no borrado', async () => {
  const v = await vender(8);
  await llamar(`/api/ventas/${v.id}/devolver`, { method: 'POST', cuerpo: { motivo: 'prisa' } });

  const fila = bd.prepare('SELECT * FROM ventas WHERE id = ?').get(v.id);
  assert.ok(fila, 'el ticket sigue existiendo (regla 3.4)');
  assert.ok(fila.cancelada_en);
  assert.match(fila.motivo_cancelacion, /Devolución/);
  assert.match(fila.motivo_cancelacion, /prisa/i);
});

test('queda en la bitácora como devolución, no como cancelación a secas', async () => {
  const v = await vender(4);
  await llamar(`/api/ventas/${v.id}/devolver`, { method: 'POST', cuerpo: { motivo: 'espera' } });

  const b = bd.prepare(
    "SELECT * FROM bitacora WHERE accion = 'venta.devuelta' ORDER BY fecha DESC LIMIT 1").get();
  assert.ok(b, 'se distingue de una cancelación: veinte "se cansó de esperar" son un problema de la fila');
  const detalle = JSON.parse(b.detalle);
  assert.equal(detalle.motivo, 'espera');
  assert.equal(detalle.folio, v.folio);
});

// ============================================================
// EL CASO QUE SE OLVIDA: UN TICKET DE OTRO TURNO
// ============================================================

test('devolver un ticket de un turno cerrado saca el dinero del cajón de HOY', async () => {
  const v = await vender(16);

  // Se cierra el turno con ese dinero dentro, y se abre otro.
  const cerrado = await caja();
  await llamar('/api/caja/cerrar', {
    method: 'POST', cuerpo: { contado: String(cerrado.esperado / 100) }
  });
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: '500' } });

  const antes = await caja();
  const r = await llamar(`/api/ventas/${v.id}/devolver`, {
    method: 'POST', cuerpo: { motivo: 'calidad' }
  });
  assert.equal(r.json.datos.deOtroTurno, true);

  const despues = await caja();
  assert.equal(despues.esperado, antes.esperado - v.total_centavos,
               'del cajón de hoy salen los billetes aunque el ticket sea de ayer');

  // Y queda el renglón que lo explica, para que el arqueo se entienda.
  const mov = bd.prepare(
    "SELECT * FROM movimientos_caja WHERE concepto LIKE 'Devolución%' ORDER BY fecha DESC").get();
  assert.ok(mov);
  assert.equal(mov.centavos, v.total_centavos);
  assert.equal(mov.tipo, 'salida');
});

// ============================================================
// FIADO
// ============================================================

test('devolver un fiado no saca dinero: le quita la deuda', async () => {
  const c = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Don Beto' }
  })).json.datos.cliente;

  const v = (await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ dieciseisavos: 16 }], formaPago: 'credito', clienteId: c.id }
  })).json.datos.venta;

  const antesCaja = await caja();
  const r = await llamar(`/api/ventas/${v.id}/devolver`, {
    method: 'POST', cuerpo: { motivo: 'calidad' }
  });

  assert.equal(r.json.datos.enEfectivo, false, 'no entró dinero: no sale dinero');
  assert.equal(r.json.datos.centavos, 0);
  assert.equal((await caja()).esperado, antesCaja.esperado, 'el cajón no se mueve');

  const ficha = (await llamar(`/api/clientes/${c.id}`)).json.datos.cliente;
  assert.equal(ficha.estado.saldo, 0, 'y deja de deberlo, que es la devolución de verdad');
});

// ============================================================
// LO QUE NO SE VALE
// ============================================================

test('hace falta un motivo, y de la lista', async () => {
  const v = await vender(4);
  assert.equal((await llamar(`/api/ventas/${v.id}/devolver`,
    { method: 'POST', cuerpo: {} })).estado, 400);
  assert.equal((await llamar(`/api/ventas/${v.id}/devolver`,
    { method: 'POST', cuerpo: { motivo: 'porque sí' } })).estado, 400);
});

test('"otro motivo" obliga a escribir cuál', async () => {
  const v = await vender(4);
  assert.equal((await llamar(`/api/ventas/${v.id}/devolver`,
    { method: 'POST', cuerpo: { motivo: 'otro' } })).estado, 400);

  const r = await llamar(`/api/ventas/${v.id}/devolver`, {
    method: 'POST', cuerpo: { motivo: 'otro', nota: 'Se le rompió la bolsa aquí mismo' }
  });
  assert.equal(r.estado, 200);
  assert.match(bd.prepare('SELECT motivo_cancelacion m FROM ventas WHERE id = ?').get(v.id).m,
               /bolsa/);
});

test('un ticket ya devuelto no se devuelve dos veces', async () => {
  const v = await vender(4);
  await llamar(`/api/ventas/${v.id}/devolver`, { method: 'POST', cuerpo: { motivo: 'espera' } });
  const otra = await llamar(`/api/ventas/${v.id}/devolver`, {
    method: 'POST', cuerpo: { motivo: 'espera' }
  });
  assert.equal(otra.estado, 400, 'devolverlo dos veces sacaría el doble del cajón');
});

test('un ticket que ya se cambió por otro manda al nuevo', async () => {
  const vieja = await vender(8);
  await llamar(`/api/ventas/${vieja.id}/cambiar`, {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 4 }], motivo: 'Quería menos' }
  });
  const r = await llamar(`/api/ventas/${vieja.id}/devolver`, {
    method: 'POST', cuerpo: { motivo: 'espera' }
  });
  assert.equal(r.estado, 409);
  assert.match(r.json.error, /nuevo/i);
});

test('el cajero solo NO devuelve: eso lo revisa un gerente', async () => {
  const v = await vender(4);
  await entrarPorNombre('Mari', '7777');
  const r = await llamar(`/api/ventas/${v.id}/devolver`, {
    method: 'POST', cuerpo: { motivo: 'espera' }
  });
  assert.equal(r.estado, 403, 'sacar dinero del cajón por un ticket ya cobrado no es de cajero');
  await entrarAdmin();
});

test('la lista de motivos se puede pedir para armar la pantalla', async () => {
  const r = await llamar('/api/ventas/motivos-devolucion');
  assert.equal(r.estado, 200);
  const ids = r.json.datos.motivos.map((m) => m.id);
  assert.ok(ids.includes('espera'));
  assert.ok(ids.includes('calidad'));
});
