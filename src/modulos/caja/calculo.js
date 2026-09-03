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
const { salidasPartidas } = require('./vales');

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
    // Las salidas partidas en dos: lo que la fábrica GASTÓ y lo que
    // alguien SE LLEVÓ contra su firma. Las dos ya están restadas de
    // `salidas`; esto solo dice cuánto es cada montón (v4.3).
    porVales: salidasPartidas(caja.id),
    // Lo que tiene que haber físicamente en el cajón.
    esperado: caja.fondo_centavos + vendido + entradas - salidas,
    ventas: conteoVentas(caja.id)
  };
}

/**
 * QUIÉN HIZO QUÉ DENTRO DE UN MISMO TURNO.
 *
 * EL CASO: son las diez de la noche, se va la luz y el turno no se puede
 * cortar. A la mañana siguiente llega otro cajero, pone su PIN y sigue
 * vendiendo sobre el turno que quedó abierto. Cuando por fin se corta, el
 * papel sale a nombre del primero y el segundo aparece por ningún lado.
 *
 * El dinero del cajón es UNO SOLO y el arqueo sigue siendo del turno: eso
 * no se parte, porque los billetes no saben de quién son. Lo que sí se
 * puede decir es CUÁNTO METIÓ CADA UNO, y eso sale de un dato que ya se
 * guarda desde el principio: cada venta y cada movimiento llevan su
 * capturista, que es quien lo tecleó (regla 3.6).
 *
 * Devuelve un renglón por persona, del que más cobró al que menos. Si solo
 * hubo una, devuelve un solo renglón: quien llama decide si vale la pena
 * imprimirlo aparte.
 */
function desglosePorPersona(cajaId) {
  const ventas = bd.prepare(`
    SELECT v.capturista_id AS id, u.nombre,
           COALESCE(SUM(CASE WHEN v.cancelada_en IS NULL AND v.forma_pago = 'efectivo'
                             THEN v.total_centavos END), 0) AS efectivo,
           COALESCE(SUM(CASE WHEN v.cancelada_en IS NULL AND v.forma_pago = 'credito'
                             THEN v.total_centavos END), 0) AS fiado,
           COALESCE(SUM(CASE WHEN v.cancelada_en IS NULL AND v.forma_pago = 'transferencia'
                             THEN v.total_centavos END), 0) AS transferencia,
           COUNT(*) FILTER (WHERE v.cancelada_en IS NULL) AS cobradas,
           COUNT(*) FILTER (WHERE v.cancelada_en IS NOT NULL) AS canceladas,
           MIN(v.fecha) AS primera, MAX(v.fecha) AS ultima
      FROM ventas v
      LEFT JOIN usuarios u ON u.id = v.capturista_id
     WHERE v.caja_id = ?
     GROUP BY v.capturista_id
  `).all(cajaId);

  const movs = bd.prepare(`
    SELECT m.capturista_id AS id, u.nombre,
           COALESCE(SUM(CASE WHEN m.tipo = 'entrada' THEN m.centavos END), 0) AS entradas,
           COALESCE(SUM(CASE WHEN m.tipo = 'salida'  THEN m.centavos END), 0) AS salidas
      FROM movimientos_caja m
      LEFT JOIN usuarios u ON u.id = m.capturista_id
     WHERE m.caja_id = ? AND m.anulado_en IS NULL
     GROUP BY m.capturista_id
  `).all(cajaId);

  const porId = new Map();
  const vacio = (id, nombre) => ({
    usuarioId: id, nombre: nombre || 'Sin nombre',
    efectivo: 0, fiado: 0, transferencia: 0,
    cobradas: 0, canceladas: 0, entradas: 0, salidas: 0,
    primera: null, ultima: null
  });

  for (const v of ventas) {
    const fila = porId.get(v.id) || vacio(v.id, v.nombre);
    Object.assign(fila, {
      efectivo: v.efectivo, fiado: v.fiado, transferencia: v.transferencia,
      cobradas: v.cobradas, canceladas: v.canceladas,
      primera: v.primera, ultima: v.ultima
    });
    porId.set(v.id, fila);
  }
  for (const m of movs) {
    const fila = porId.get(m.id) || vacio(m.id, m.nombre);
    fila.entradas = m.entradas;
    fila.salidas = m.salidas;
    porId.set(m.id, fila);
  }

  return [...porId.values()]
    .map((f) => ({ ...f, aportado: f.efectivo + f.entradas - f.salidas }))
    .sort((a, b) => b.efectivo - a.efectivo);
}

module.exports = {
  sesionAbierta, vendidoEnEfectivo, vendidoSinEfectivo, vendidoAlCredito,
  movimientos, sumaPorTipo, conteoVentas, estadoCaja, desglosePorPersona
};
