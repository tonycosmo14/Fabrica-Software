/**
 * LA CUENTA DE CADA CLIENTE  (v1.6)
 *
 * Una sola cuenta:
 *
 *     lo que se llevó a crédito  −  lo que ha abonado  =  DEBE
 *
 * NO HAY SALDO GUARDADO (regla 3.2). Se suma cada vez que se pregunta.
 * Un número guardado se desincroniza el día que se cancele un ticket viejo
 * o se anule un abono mal capturado, y ese día el papel del cliente y la
 * pantalla de la fábrica dejan de decir lo mismo. Una suma no puede.
 *
 * Los abonos NO se aplican a un ticket concreto, y es a propósito: el
 * cliente llega y deja $500 a cuenta, no dice "esto es del ticket 412".
 * Amarrar cada abono a un ticket obligaría al cajero a decidir algo que el
 * cliente no dijo.
 */
const { bd } = require('../../db/conexion');

/** Lo que se llevó fiado y todavía cuenta. Lo cancelado no cuenta. */
function cargadoA(clienteId) {
  return bd.prepare(`
    SELECT COALESCE(SUM(total_centavos), 0) n
      FROM ventas
     WHERE cliente_id = ?
       AND forma_pago = 'credito'
       AND cancelada_en IS NULL
  `).get(clienteId).n;
}

/** Lo que ha pagado. Lo anulado no cuenta. */
function abonadoPor(clienteId) {
  return bd.prepare(`
    SELECT COALESCE(SUM(centavos), 0) n
      FROM abonos
     WHERE cliente_id = ? AND anulado_en IS NULL
  `).get(clienteId).n;
}

/** Cuánto debe ahora mismo. Puede salir negativo: pagó de más, tiene saldo a favor. */
function saldoDe(clienteId) {
  return cargadoA(clienteId) - abonadoPor(clienteId);
}

/**
 * El ticket fiado más viejo que sigue sin cubrirse.
 *
 * Como los abonos van a la cuenta y no a un ticket, "cuál está vencido" se
 * resuelve por antigüedad: lo que se abona tapa primero lo más viejo, que
 * es como lo cuenta cualquiera en el mostrador. Devuelve la fecha de ese
 * ticket, o null si no debe nada.
 */
function desdeCuandoDebe(clienteId) {
  const abonado = abonadoPor(clienteId);
  const ventas = bd.prepare(`
    SELECT fecha, total_centavos
      FROM ventas
     WHERE cliente_id = ? AND forma_pago = 'credito' AND cancelada_en IS NULL
     ORDER BY fecha
  `).all(clienteId);

  let cubierto = abonado;
  for (const v of ventas) {
    if (cubierto >= v.total_centavos) { cubierto -= v.total_centavos; continue; }
    return v.fecha;                      // este es el más viejo sin cubrir
  }
  return null;
}

/** Días que lleva debiendo el ticket más viejo sin cubrir. */
function diasDebiendo(clienteId) {
  const desde = desdeCuandoDebe(clienteId);
  if (!desde) return 0;
  const dias = Math.floor((Date.now() - new Date(desde).getTime()) / 86400000);
  return dias > 0 ? dias : 0;
}

/**
 * Cómo va un cliente. Es lo que la pantalla necesita para pintar su ficha
 * y lo que la caja necesita para decidir si le puede fiar.
 */
function estadoCliente(cliente) {
  const cargado = cargadoA(cliente.id);
  const abonado = abonadoPor(cliente.id);
  const saldo = cargado - abonado;
  const dias = diasDebiendo(cliente.id);

  // Sin límite escrito, no hay nada de qué pasarse.
  const limite = cliente.limite_centavos ?? null;
  const disponible = limite === null ? null : limite - saldo;

  return {
    cargado,
    abonado,
    saldo,
    limite,
    disponible,
    // Vencido solo si tiene plazo escrito y ya se pasó. Sin plazo no hay
    // nada vencido: no se puede llegar tarde a una cita que nadie puso.
    diasDebiendo: dias,
    vencido: Boolean(cliente.dias_plazo) && saldo > 0 && dias > cliente.dias_plazo,
    desdeCuandoDebe: desdeCuandoDebe(cliente.id)
  };
}

/**
 * ¿Se le puede fiar esto?
 *
 * Devuelve { alcanza: true } si sí; si no, dice por qué y si un responsable
 * puede autorizarlo de todos modos. Pasarse del límite NUNCA se rechaza a
 * secas: se pide PIN. Al de la ferretería que lleva veinte años comprando
 * no se le para la venta por un número que alguien escribió hace meses.
 */
function cabeElCredito(cliente, centavos) {
  if (!cliente.activo) {
    return { alcanza: false, autorizable: false,
             motivo: `${cliente.nombre} está dado de baja.` };
  }

  const estado = estadoCliente(cliente);
  if (estado.limite === null) return { alcanza: true, estado };
  if (estado.saldo + centavos <= estado.limite) return { alcanza: true, estado };

  return {
    alcanza: false,
    autorizable: true,
    estado,
    motivo: estado.saldo >= estado.limite
      ? `${cliente.nombre} ya llegó a su límite.`
      : `Con esto ${cliente.nombre} se pasa de su límite.`
  };
}

/**
 * LA CUENTA CORRIENTE: cargos y abonos mezclados, del más nuevo al más
 * viejo, como un estado de cuenta. Es lo que se le enseña al cliente
 * cuando pregunta "¿yo cuánto debo?".
 */
function cuentaCorriente(clienteId, { limite = 60 } = {}) {
  const cargos = bd.prepare(`
    SELECT id, fecha, folio, total_centavos, cancelada_en, motivo_cancelacion
      FROM ventas
     WHERE cliente_id = ? AND forma_pago = 'credito'
     ORDER BY fecha DESC
     LIMIT ?
  `).all(clienteId, limite).map((v) => ({
    tipo: 'cargo',
    id: v.id,
    fecha: v.fecha,
    folio: v.folio,
    centavos: v.total_centavos,
    cancelado: Boolean(v.cancelada_en),
    motivo: v.motivo_cancelacion
  }));

  const pagos = bd.prepare(`
    SELECT a.*, u.nombre AS recibio, n.nombre AS anulado_por_nombre
      FROM abonos a
      LEFT JOIN usuarios u ON u.id = a.ejecutor_id
      LEFT JOIN usuarios n ON n.id = a.anulado_por
     WHERE a.cliente_id = ?
     ORDER BY a.fecha DESC
     LIMIT ?
  `).all(clienteId, limite).map((a) => ({
    tipo: 'abono',
    id: a.id,
    fecha: a.fecha,
    centavos: a.centavos,
    formaPago: a.forma_pago,
    recibio: a.recibio,
    notas: a.notas,
    cancelado: Boolean(a.anulado_en),
    motivo: a.motivo_anulacion
  }));

  return [...cargos, ...pagos]
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))
    .slice(0, limite);
}

/** Todos los clientes con su estado. Para la lista y para la cobranza. */
function clientesConEstado({ incluirBajas = false } = {}) {
  const clientes = bd.prepare(`
    SELECT * FROM clientes
     ${incluirBajas ? '' : 'WHERE activo = 1'}
     ORDER BY activo DESC, nombre
  `).all();

  return clientes.map((c) => ({ ...c, estado: estadoCliente(c) }));
}

/** Lo que la fábrica tiene en la calle, de un vistazo. */
function resumenCartera() {
  const todos = clientesConEstado();
  const deben = todos.filter((c) => c.estado.saldo > 0);
  return {
    clientes: todos.length,
    deudores: deben.length,
    enLaCalle: deben.reduce((t, c) => t + c.estado.saldo, 0),
    vencidos: deben.filter((c) => c.estado.vencido).length,
    vencidoCentavos: deben.filter((c) => c.estado.vencido)
                          .reduce((t, c) => t + c.estado.saldo, 0)
  };
}

module.exports = {
  cargadoA, abonadoPor, saldoDe, diasDebiendo, desdeCuandoDebe,
  estadoCliente, cabeElCredito, cuentaCorriente, clientesConEstado, resumenCartera
};
