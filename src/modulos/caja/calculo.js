/**
 * EL ARQUEO DE LA CAJA
 *
 *     fondo + cobrado en efectivo + entradas − salidas = DEBERÍA HABER
 *     deberia haber − contado = DIFERENCIA
 *
 * Es la misma cuenta que el cuadre del cuarto frío, pero con billetes en vez
 * de marquetas. A propósito: quien ya entendió una, entiende la otra.
 *
 * Aquí NO hay ninguna columna "saldo" que se vaya sumando. Lo que hay en la
 * caja se calcula de los movimientos cada vez que se pregunta (regla 3.2).
 * Un saldo guardado se desincroniza el día que algo se corte a la mitad;
 * una suma de movimientos, no puede.
 */
const { bd } = require('../../db/conexion');

/** El turno de caja que está abierto ahora mismo. Solo puede haber uno. */
function sesionAbierta() {
  return bd.prepare(`
    SELECT c.*, u.nombre AS cajero_nombre
      FROM cajas c
      LEFT JOIN usuarios u ON u.id = c.cajero_id
     WHERE c.cerrada_en IS NULL
     ORDER BY c.abierta_en DESC LIMIT 1
  `).get() || null;
}

/**
 * Lo cobrado EN EFECTIVO en un turno.
 *
 * Solo el efectivo entra al arqueo: si mañana se cobra con transferencia,
 * ese dinero nunca pasó por el cajón y contarlo ahí haría que la caja
 * "sobrara" todos los días. Las canceladas tampoco cuentan.
 */
function vendidoEnEfectivo(cajaId) {
  return bd.prepare(`
    SELECT COALESCE(SUM(total_centavos), 0) n
      FROM ventas
     WHERE caja_id = ?
       AND cancelada_en IS NULL
       AND forma_pago = 'efectivo'
  `).get(cajaId).n;
}

/** Lo cobrado por otros medios, que se informa pero no se cuenta en el cajón. */
function vendidoSinEfectivo(cajaId) {
  return bd.prepare(`
    SELECT COALESCE(SUM(total_centavos), 0) n
      FROM ventas
     WHERE caja_id = ?
       AND cancelada_en IS NULL
       AND forma_pago <> 'efectivo'
  `).get(cajaId).n;
}

/**
 * Lo que salió FIADO en el turno.
 *
 * Va aparte de "otros medios" porque no es lo mismo: una transferencia ya
 * se cobró y solo entró por otro lado; lo fiado todavía está en la calle.
 * Al hacer el corte, esa diferencia es la que importa.
 */
function vendidoAlCredito(cajaId) {
  return bd.prepare(`
    SELECT COALESCE(SUM(total_centavos), 0) n
      FROM ventas
     WHERE caja_id = ?
       AND cancelada_en IS NULL
       AND forma_pago = 'credito'
  `).get(cajaId).n;
}

/** Entradas y salidas de dinero que no son ventas. Las anuladas no cuentan. */
function movimientos(cajaId, { incluirAnulados = false } = {}) {
  return bd.prepare(`
    SELECT m.*, u.nombre AS ejecutor_nombre, a.nombre AS anulado_por_nombre
      FROM movimientos_caja m
      LEFT JOIN usuarios u ON u.id = m.ejecutor_id
      LEFT JOIN usuarios a ON a.id = m.anulado_por
     WHERE m.caja_id = ?
       ${incluirAnulados ? '' : 'AND m.anulado_en IS NULL'}
     ORDER BY m.fecha DESC
  `).all(cajaId);
}

function sumaPorTipo(cajaId, tipo) {
  return bd.prepare(`
    SELECT COALESCE(SUM(centavos), 0) n
      FROM movimientos_caja
     WHERE caja_id = ? AND tipo = ? AND anulado_en IS NULL
  `).get(cajaId, tipo).n;
}

/** Cuántas ventas y cuántas canceladas lleva el turno, para el corte. */
function conteoVentas(cajaId) {
  return bd.prepare(`
    SELECT
      COUNT(*) FILTER (WHERE cancelada_en IS NULL) AS cobradas,
      COUNT(*) FILTER (WHERE cancelada_en IS NOT NULL) AS canceladas,
      COALESCE(SUM(CASE WHEN cancelada_en IS NOT NULL THEN total_centavos END), 0) AS canceladas_centavos
    FROM ventas WHERE caja_id = ?
  `).get(cajaId);
}

/**
 * Foto de cómo va un turno ahora mismo, sin cerrar nada.
 * Es lo que se ve en pantalla antes de contar el dinero.
 */
function estadoCaja(caja) {
  const vendido = vendidoEnEfectivo(caja.id);
  const otros = vendidoSinEfectivo(caja.id);
  const fiado = vendidoAlCredito(caja.id);
  const entradas = sumaPorTipo(caja.id, 'entrada');
  const salidas = sumaPorTipo(caja.id, 'salida');

  return {
    caja,
    fondo: caja.fondo_centavos,
    vendido,
    vendidoOtrosMedios: otros,
    // Lo fiado va aparte: eso todavía está en la calle, no cobrado.
    vendidoFiado: fiado,
    vendidoTransferencia: otros - fiado,
    entradas,
    salidas,
    // Lo que tiene que haber físicamente en el cajón.
    esperado: caja.fondo_centavos + vendido + entradas - salidas,
    ventas: conteoVentas(caja.id)
  };
}

module.exports = {
  sesionAbierta, vendidoEnEfectivo, vendidoSinEfectivo, vendidoAlCredito,
  movimientos, sumaPorTipo, conteoVentas, estadoCaja
};
