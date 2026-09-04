/**
 * ENTREGAR UN PEDIDO  (v5.6, sacado a su propio archivo en la v5.7)
 *
 * Estaba escrito dentro de la ruta de pedidos, que era el único sitio que
 * lo hacía. Desde la v5.7 hay dos: la pantalla de pedidos, uno por uno, y
 * el cuadre de una salida, donde se capturan los ocho de un viaje seguidos.
 *
 * Y entregar un pedido no es un UPDATE: son tres cosas que tienen que
 * pasar juntas o ninguna.
 *
 *   1. Nace la VENTA, con las líneas del pedido tal cual — sin volver a
 *      cotizar, porque lo que se cobra es lo que dice el papel que el
 *      cliente tiene enfrente.
 *   2. El pedido queda marcado como entregado y amarrado a esa venta.
 *   3. Si iba a crédito, se mira si se pasó de su límite — para avisar,
 *      no para frenar.
 *
 * Si esto viviera copiado en dos sitios, el día que alguien arregle uno se
 * quedaría el otro, y la diferencia sería un pedido entregado sin venta o
 * una venta sin pedido. Por eso está aquí una sola vez.
 */
const { bd } = require('../../db/conexion');
const { ahora } = require('../../lib/ids');
const bitacora = require('../../lib/bitacora');
const calculo = require('./calculo');
const { crearVenta, detalleVenta } = require('../ventas/rutas');
const { listaActiva } = require('../ventas/precios');
const { cabeElCredito, estadoCliente } = require('../clientes/calculo');

const FORMAS = ['efectivo', 'transferencia', 'credito'];

/** El cuarto frío del que sale. El que recibe la producción, si nadie dice otro. */
const almacenDeSalida = () => bd.prepare(
  'SELECT * FROM almacenes WHERE activo = 1 AND recibe_produccion = 1 ORDER BY orden LIMIT 1'
).get() || null;

/**
 * Entrega un pedido y devuelve { pedido, venta, avisoCredito } o { error }.
 *
 * @param pedidoId   cuál
 * @param formaPago  cómo pagó DE VERDAD; si no se dice, la del pedido
 * @param usuario    quién lo está tecleando
 * @param salidaId   de qué viaje viene, si viene de uno
 */
function entregarPedido({ pedidoId, formaPago, usuario, salidaId = null, ejecutorId = null,
                          pago = null, abono = null, abonoFormaPago = 'efectivo',
                          autorizadoPor = null, notas = null }) {
  const p = calculo.completo(pedidoId);
  if (!p) return { error: 'Ese pedido no existe.', codigo: 404 };
  if (p.estado === 'entregado') return { error: 'Ese pedido ya se había entregado.' };
  if (p.estado === 'cancelado') return { error: 'Ese pedido está cancelado.' };

  const forma = FORMAS.includes(formaPago) ? formaPago : p.forma_pago;

  const cliente = bd.prepare('SELECT * FROM clientes WHERE id = ?').get(p.cliente_id);
  if (!cliente) return { error: 'El cliente de ese pedido ya no existe.', codigo: 409 };

  // ============================================================
  // EL LÍMITE DE CRÉDITO AQUÍ AVISA, NO FRENA
  // ============================================================
  //
  // En el mostrador, pasarse del límite se detiene y se pide autorización:
  // el hielo todavía está del lado de acá y no se ha entregado nada.
  //
  // Aquí es al revés. Cuando esto se toca, el repartidor YA dejó los
  // garrafones en la tienda y ya vino de regreso. Negarse a apuntarlo no
  // devuelve la mercancía: solo deja la entrega sin registrar, y entonces
  // el cliente debe dinero que no está escrito en ningún lado — que es
  // exactamente el problema que este módulo vino a resolver.
  //
  // Así que se apunta, y se avisa. Quien está en la caja se entera en el
  // momento, y el que decide qué hacer es el gerente, con el dato delante.
  let avisoCredito = null;
  if (forma === 'credito') {
    const cabe = cabeElCredito(cliente, p.total);
    if (!cabe.alcanza) avisoCredito = cabe.motivo;
  }

  const lista = listaActiva();
  if (!lista) return { error: 'No hay ninguna lista de precios activa.', codigo: 409 };

  const venta = crearVenta({
    lineas: p.lineas.map((l) => ({
      concepto: l.concepto,
      dieciseisavos: l.dieciseisavos,
      centavos: l.precio_centavos,
      desglose: l.desglose,
      productoId: l.producto_id,
      cantidad: l.cantidad
    })),
    total: p.total,
    // A crédito no lleva pago: el cliente no pagó nada. De contado, lo
    // que se tecleó si se cobró en la caja —para que salga el cambio— y
    // si no, pagado justo: el repartidor trajo el dinero exacto de ese
    // ticket, y el cambio lo dio él en la calle.
    pago: forma === 'credito' ? null : (pago ?? p.total),
    lista,
    almacenId: almacenDeSalida()?.id || null,
    cajeroId: ejecutorId || usuario.id,
    capturistaId: usuario.id,
    formaPago: forma,
    notas: notas ? `Pedido ${p.folio} · ${notas}` : `Pedido ${p.folio}`,
    clienteId: p.cliente_id,
    autorizadoPor,
    // Lo que dejó en el mostrador al llevárselo a crédito (v5.3), igual
    // que en cualquier venta: se guarda dentro de la misma transacción.
    abono: forma === 'credito' && abono ? abono : null,
    abonoFormaPago,
    cliente
  });

  bd.prepare(`
    UPDATE pedidos SET estado = 'entregado', venta_id = ?, entregado_en = ?,
                       entregado_por = ?, forma_pago = ?
     WHERE id = ?
  `).run(venta.id, ahora(), usuario.id, forma, p.id);

  // DE QUÉ VIAJE VIENE. Sin esto, en el historial el ticket de un pedido
  // repartido y el de una venta de mostrador se ven iguales, y "cuánto
  // vendió el reparto este mes" no se puede contestar.
  //
  // Se BUSCA si no lo dijeron: el mismo pedido se puede marcar entregado
  // desde el cuadre de su salida —que sí lo sabe— o desde la pantalla de
  // pedidos, que no. Si dependiera de quién lo marcó, la mitad de las
  // ventas del reparto quedarían sin viaje y el número saldría mal sin que
  // nadie pudiera decir por qué.
  const viaje = salidaId || bd.prepare(`
    SELECT s.id FROM salida_pedidos sp
      JOIN salidas s ON s.id = sp.salida_id
     WHERE sp.pedido_id = ? AND s.estado <> 'cancelada'
     ORDER BY s.fecha DESC LIMIT 1
  `).get(p.id)?.id || null;
  if (viaje) bd.prepare('UPDATE ventas SET salida_id = ? WHERE id = ?').run(viaje, venta.id);

  bitacora.registrar({
    accion: 'pedido.entregado', entidad: 'pedido', entidadId: p.id,
    ejecutorId: ejecutorId || usuario.id, capturistaId: usuario.id,
    detalle: { folio: p.folio, cliente: p.cliente_nombre, total: p.total,
               formaPago: forma, venta: venta.folio,
               ...(viaje ? { salidaId: viaje } : {}),
               ...(avisoCredito ? { avisoCredito } : {}) }
  });

  return {
    pedido: calculo.completo(p.id),
    venta: detalleVenta(venta.id),
    // El cliente con su cuenta al día, para poder decirle en la cara
    // cuánto debe ahora. Es lo mismo que devuelve una venta de mostrador.
    cliente: { ...cliente, estado: estadoCliente(cliente) },
    avisoCredito,
    // Sin turno abierto el abono se guardó igual, pero fuera de todo corte.
    abonoSinTurno: venta.abonoSinTurno || false
  };
}

module.exports = { entregarPedido, FORMAS, almacenDeSalida };
