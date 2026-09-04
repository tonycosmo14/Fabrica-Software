/**
 * CÓMO SE APUNTA UN ABONO  (v5.3)
 *
 * Estaba escrito dentro de la ruta de cobranza, que era el único sitio que
 * lo hacía. Desde la v5.3 hay dos: la cobranza de siempre, y el mostrador
 * —cuando el cliente se lleva algo a crédito y deja una parte en el
 * momento—.
 *
 * Y un abono no es una fila: son DOS cosas que tienen que pasar juntas o
 * ninguna.
 *
 *   1. El renglón en `abonos`, que es lo que le baja la deuda al cliente.
 *   2. La entrada al cajón, si fue en efectivo y hay un turno abierto,
 *      que es lo que hace que el corte cuadre al final del día.
 *
 * Si esto viviera copiado en dos sitios, el día que alguien arregle uno se
 * quedaría el otro — y el resultado sería dinero en el cajón que ningún
 * papel explica, o una deuda que baja sin que entre un peso. Por eso está
 * aquí una sola vez.
 *
 * La transacción es de quien llama: en el mostrador el abono y la venta
 * son el mismo gesto y tienen que guardarse juntos.
 */
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');

/**
 * Apunta un abono. Devuelve { id, movimientoId, fecha }.
 *
 * @param cliente      el cliente, ya buscado
 * @param centavos     cuánto abona, en centavos
 * @param formaPago    'efectivo' | 'transferencia'
 * @param turno        el turno de caja abierto, o null
 * @param ejecutorId   quién recibió el dinero
 * @param capturistaId quién lo está tecleando (regla 3.6)
 * @param notas        para el renglón del cajón y el del abono
 * @param concepto     cómo se lee en el cajón; por defecto "Abono de Fulano"
 */
function apuntarAbono({ cliente, centavos, formaPago = 'efectivo', turno = null,
                        ejecutorId, capturistaId, notas = null, concepto = null,
                        ventaId = null }) {
  const id = nuevoId();
  const fecha = ahora();
  let movimientoId = null;

  // EL DINERO SOLO ENTRA AL CAJÓN SI FUE EFECTIVO Y HAY TURNO.
  //
  // Una transferencia no pasa por el cajón: contarla ahí dejaría el arqueo
  // sobrado todos los días. Y sin turno abierto no hay cajón al que
  // entrar: el abono se guarda igual —la deuda sí bajó— pero queda fuera
  // del corte, y quien llamó se entera por `sinTurno`.
  if (formaPago === 'efectivo' && turno) {
    movimientoId = nuevoId();
    bd.prepare(`
      INSERT INTO movimientos_caja
        (id, caja_id, fecha, tipo, concepto, centavos, ejecutor_id, capturista_id, notas)
      VALUES (?, ?, ?, 'entrada', ?, ?, ?, ?, ?)
    `).run(movimientoId, turno.id, fecha,
           (concepto || `Abono de ${cliente.nombre}`).slice(0, 80), centavos,
           ejecutorId, capturistaId, notas || 'Cobranza de crédito');
  }

  bd.prepare(`
    INSERT INTO abonos (id, cliente_id, fecha, centavos, forma_pago, notas,
                        caja_id, movimiento_id, ejecutor_id, capturista_id, venta_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, cliente.id, fecha, centavos, formaPago,
         (notas || '').trim().slice(0, 200) || null,
         turno?.id || null, movimientoId, ejecutorId, capturistaId, ventaId);

  return { id, movimientoId, fecha, ventaId };
}

module.exports = { apuntarAbono };
