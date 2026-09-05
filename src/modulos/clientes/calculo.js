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
/**
 * EL RITMO: ¿ES DE SIEMPRE O DE UNA VEZ?  (v6.4)
 *
 * "Separar los clientes de verdad frecuentes —los de todos los días— de
 *  los de una entrega de una vez."
 *
 * Sale de los tickets, no de una marca a mano: cuántas veces se le ha
 * vendido en los últimos 30 días y cuándo fue la última. Es "de siempre"
 * a partir de tantos tickets como diga `clientes_frecuente_tickets`
 * (cuatro, de fábrica: uno por semana). El de una vez es el que no llega.
 */
function cuantosParaSerDeSiempre() {
  const f = bd.prepare("SELECT valor FROM configuracion WHERE clave = 'clientes_frecuente_tickets'").get();
  const n = Number(f?.valor);
  return Number.isInteger(n) && n > 0 ? n : 4;
}

function ritmoDe(clienteId, tope = cuantosParaSerDeSiempre()) {
  const fila = bd.prepare(`
    SELECT COUNT(CASE WHEN fecha >= datetime('now', '-30 days') THEN 1 END) AS tickets30,
           COUNT(*) AS tickets,
           MAX(fecha) AS ultima
      FROM ventas
     WHERE cliente_id = ? AND cancelada_en IS NULL
  `).get(clienteId);
  const dias = fila.ultima
    ? Math.floor((Date.now() - new Date(fila.ultima).getTime()) / 86400000) : null;
  return {
    tickets30: fila.tickets30,
    tickets: fila.tickets,
    ultimaCompra: fila.ultima || null,
    diasSinComprar: dias,
    frecuente: fila.tickets30 >= tope,
    tope
  };
}

/**
 * LOS GARRAFONES QUE TRAE  (v6.9)
 *
 * No hay contador: se suman los movimientos. Positivo es lo que se le
 * entregó, negativo lo que devolvió, y la resta es lo que hay en su patio.
 * Un contador editable acabaría diciendo 15 con 9 en el patio, y nadie
 * sabría desde cuándo.
 */
function garrafonesDe(clienteId, cliente = null) {
  const c = cliente || bd.prepare(
    'SELECT garrafones_limite, garrafon_deposito_centavos FROM clientes WHERE id = ?'
  ).get(clienteId) || {};

  const fila = bd.prepare(`
    SELECT COALESCE(SUM(cuantos), 0) AS retenidos, MAX(fecha) AS ultimo
      FROM garrafones_movimientos
     WHERE cliente_id = ? AND anulado_en IS NULL
  `).get(clienteId);

  const retenidos = fila.retenidos;
  const limite = c.garrafones_limite ?? null;
  const deposito = c.garrafon_deposito_centavos ?? null;

  return {
    retenidos,
    limite,
    // Sin límite escrito no hay de qué pasarse, igual que con el crédito.
    pasado: limite !== null && retenidos > limite,
    depositoUnitario: deposito,
    // Lo que el cliente dejó en garantía por los que trae. Va APARTE del
    // saldo a propósito: una garantía no es una deuda, y sumarla al saldo
    // haría que la cobranza saliera a cobrar dinero que nadie debe.
    depositoCentavos: deposito === null ? null : Math.max(0, retenidos) * deposito,
    ultimoMovimiento: fila.ultimo || null
  };
}

/** Sus movimientos de garrafones, del más nuevo al más viejo. */
function garrafonesHistorial(clienteId, limite = 30) {
  return bd.prepare(`
    SELECT g.*, u.nombre AS ejecutor_nombre, a.nombre AS anulado_por_nombre
      FROM garrafones_movimientos g
      LEFT JOIN usuarios u ON u.id = g.ejecutor_id
      LEFT JOIN usuarios a ON a.id = g.anulado_por
     WHERE g.cliente_id = ?
     ORDER BY g.fecha DESC
     LIMIT ?
  `).all(clienteId, limite);
}

/**
 * LO QUE SE LLEVA AL MES, en las dos unidades que se usan aquí.
 *
 * El hielo se cuenta en KILOS y no en marquetas porque es como lo pide el
 * cliente ("mándame tres toneladas") y como se compara entre uno que lleva
 * barras y otro que lleva bolsas. Los garrafones van aparte: no son kilos
 * de nada y juntarlos sería sumar peras con agua.
 *
 * Sale de los últimos 30 días de tickets no cancelados.
 */
function consumoDe(clienteId) {
  const kilosPorMarqueta = 150;   // una marqueta entera

  const fila = bd.prepare(`
    SELECT COALESCE(SUM(vl.dieciseisavos), 0) AS dieciseisavos,
           COALESCE(SUM(CASE WHEN p.para_agua = 1 THEN vl.cantidad ELSE 0 END), 0) AS garrafones,
           COUNT(DISTINCT v.id) AS tickets
      FROM venta_lineas vl
      JOIN ventas v ON v.id = vl.venta_id
      LEFT JOIN productos p ON p.id = vl.producto_id
     WHERE v.cliente_id = ? AND v.cancelada_en IS NULL
       AND v.fecha >= datetime('now', '-30 days')
  `).get(clienteId);

  return {
    kilos: Math.round((fila.dieciseisavos / 16) * kilosPorMarqueta),
    dieciseisavos: fila.dieciseisavos,
    garrafones: fila.garrafones,
    tickets: fila.tickets
  };
}

/**
 * SUS PRECIOS PROPIOS, producto por producto.
 *
 * Trae al lado el precio de mostrador para poder enseñar los dos y la
 * diferencia: un precio acordado sin el de lista al lado no dice si es un
 * buen trato o un regalo.
 */
function preciosDe(clienteId) {
  return bd.prepare(`
    SELECT cp.*, p.nombre AS producto_nombre, p.codigo, p.tipo AS producto_tipo,
           p.dieciseisavos, p.precio_centavos, p.activo AS producto_activo,
           u.nombre AS actualizado_por_nombre
      FROM cliente_precios cp
      JOIN productos p ON p.id = cp.producto_id
      LEFT JOIN usuarios u ON u.id = cp.actualizado_por
     WHERE cp.cliente_id = ?
     ORDER BY p.tipo DESC, p.dieciseisavos DESC, p.nombre
  `).all(clienteId).map((f) => {
    // OJO: la consulta trae el tipo como `producto_tipo` para no chocar con
    // nada; `precioDeMostrador` espera un producto tal cual.
    const lista = precioDeMostrador({
      tipo: f.producto_tipo,
      dieciseisavos: f.dieciseisavos,
      precio_centavos: f.precio_centavos
    });
    return {
      ...f,
      lista_centavos: lista,
      // Cuánto por debajo del mostrador quedó. Es el número que dice si un
      // trato viejo se quedó regalado cuando subieron los precios.
      diferencia: lista
        ? Math.round(((f.centavos - lista) / lista) * 1000) / 10 : null
    };
  });
}

/**
 * LO QUE ESE PRODUCTO CUESTA DE MOSTRADOR.
 *
 * Un refresco lo lleva en su propia columna. El hielo NO: su precio sale
 * de la lista activa según la fracción, así que hay que ir a buscarlo. Sin
 * esto la tabla de tarifas enseñaba "—" en la columna de lista justo para
 * los productos que más se negocian.
 */
function precioDeMostrador(producto) {
  if (producto.tipo !== 'hielo') return producto.precio_centavos || null;
  const { listaActiva, precioDe } = require('../ventas/precios');
  const lista = listaActiva();
  if (!lista || !producto.dieciseisavos) return null;
  const p = precioDe(producto.dieciseisavos, lista.id);
  return p.faltan?.length ? null : p.centavos;
}

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
    desdeCuandoDebe: desdeCuandoDebe(cliente.id),
    ritmo: ritmoDe(cliente.id),
    consumo: consumoDe(cliente.id),
    garrafones: garrafonesDe(cliente.id, cliente)
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

/**
 * LO QUE LA FÁBRICA TIENE EN LA CALLE, de un vistazo.
 *
 * Los cuatro números de arriba de la pantalla de clientes. Cada uno lleva
 * su renglón chico —el "de qué" — porque un número solo no dice nada: 84
 * cuentas con crédito no significa lo mismo si son 84 de 100 que 84 de 342.
 */
function resumenCartera() {
  const todos = clientesConEstado({ incluirBajas: true });
  const activos = todos.filter((c) => c.activo);
  const deben = activos.filter((c) => c.estado.saldo > 0);
  const vencidos = deben.filter((c) => c.estado.vencido);
  const conCredito = activos.filter((c) => c.limite_centavos != null || c.dias_plazo != null);
  const enLaCalle = deben.reduce((t, c) => t + c.estado.saldo, 0);
  const vencidoCentavos = vencidos.reduce((t, c) => t + c.estado.saldo, 0);

  // LOS NUEVOS: este mes y el anterior, para poder decir si se está
  // creciendo o solo se está reponiendo lo que se cae.
  const nuevos = (desde, hasta) => bd.prepare(`
    SELECT COUNT(*) n FROM clientes
     WHERE fecha_alta >= datetime('now', ?) ${hasta ? "AND fecha_alta < datetime('now', ?)" : ''}
  `).get(...(hasta ? [desde, hasta] : [desde])).n;

  const esteMes = nuevos('-30 days', null);
  const mesPrevio = nuevos('-60 days', '-30 days');

  return {
    clientes: activos.length,
    deudores: deben.length,
    enLaCalle,
    vencidos: vencidos.length,
    vencidoCentavos,
    // Cuántos de los dados de alta siguen operando. Un padrón de 342 con
    // 40 dados de baja no es un padrón de 342.
    total: todos.length,
    operativos: todos.length ? Math.round((activos.length / todos.length) * 1000) / 10 : 100,
    conCredito: conCredito.length,
    // Cuánto de lo que está en la calle todavía no se ha pasado del plazo.
    alCorriente: enLaCalle ? Math.round(((enLaCalle - vencidoCentavos) / enLaCalle) * 100) : 100,
    nuevosMes: esteMes,
    nuevosMesPrevio: mesPrevio,
    // Sin mes previo no hay contra qué comparar, y un "+100%" sacado de
    // cero no significa nada.
    variacionNuevos: mesPrevio
      ? Math.round(((esteMes - mesPrevio) / mesPrevio) * 1000) / 10 : null
  };
}

module.exports = {
  cargadoA, abonadoPor, saldoDe, diasDebiendo, desdeCuandoDebe,
  estadoCliente, cabeElCredito, cuentaCorriente, clientesConEstado, resumenCartera,
  ritmoDe, cuantosParaSerDeSiempre,
  garrafonesDe, garrafonesHistorial, consumoDe, preciosDe, precioDeMostrador
};
