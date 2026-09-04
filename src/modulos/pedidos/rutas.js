/**
 * LOS PEDIDOS — la API  (v5.6)
 *
 * ============================================================
 * DÓNDE NACE Y DÓNDE MUERE UN PEDIDO
 * ============================================================
 *
 * NACE en la caja: llaman por teléfono, mandan a alguien, o llega un
 * mensaje. La cajera lo captura como capturaría una venta —los mismos
 * productos, los mismos precios— pero sin cobrar.
 *
 * MUERE de una de dos formas:
 *
 *   ENTREGADO — y ahí nace su venta, con los precios que el pedido ya
 *   llevaba escritos. Es el momento en que el hielo sale del cuarto frío
 *   de verdad y el cliente debe o paga.
 *
 *   CANCELADO — con su motivo. Nada se borra (regla 3.4): un pedido
 *   cancelado se queda para poder contestar "¿y el de la tiendita, qué
 *   pasó?" tres semanas después.
 *
 * ============================================================
 * EL PRECIO SE COTIZA UNA VEZ, AL TOMARLO
 * ============================================================
 *
 * Con el MISMO cotizador que una venta —incluida la lista de mayoreo del
 * cliente—, y se copia (regla 3.5). Al entregar no se vuelve a cotizar:
 * lo que se cobra es lo que dice el papel que el repartidor lleva en la
 * mano. Recalcular ahí sería mandarlo a discutir precios en la puerta del
 * cliente, que es donde no se puede ganar esa discusión.
 */
const express = require('express');
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');
const { ok, error } = require('../../lib/respuestas');
const { exigirPermiso } = require('../../middleware/sesion');
const bitacora = require('../../lib/bitacora');
const calculo = require('./calculo');

const { prepararLineas } = require('../ventas/rutas');
const { listaDeMayoreo } = require('../ventas/mayoreo');
const { listaActiva } = require('../ventas/precios');
// ENTREGAR VIVE APARTE (v5.7). Lo llaman dos sitios: esta pantalla, de uno
// en uno, y el cuadre de una salida, donde se capturan los ocho de un
// viaje seguidos. Copiado en dos lados, el día que se arregle uno se
// quedaría el otro.
const { entregarPedido, FORMAS } = require('./entrega');
const { marcarLoQueCompra } = require('../clientes/etiquetas');

const router = express.Router();

const ver = exigirPermiso('pedidos.ver');
const tomar = exigirPermiso('pedidos.tomar');
const entregar = exigirPermiso('pedidos.entregar');

const texto = (v, largo = 300) => {
  const t = String(v ?? '').trim();
  return t ? t.slice(0, largo) : null;
};

// ============================================================
// VER
// ============================================================

router.get('/', ver, (req, res) => ok(res, {
  pedidos: calculo.lista({
    estado: texto(req.query.estado, 20) || 'pendiente',
    hasta: texto(req.query.hasta, 10),
    cliente: texto(req.query.cliente, 60)
  }),
  pendientes: calculo.cuantosPendientes(),
  areas: calculo.AREAS
}));

/**
 * LO QUE HAY QUE PREPARAR. Va antes que /:id porque Express prueba en
 * orden y "preparacion" habría entrado como el id de un pedido.
 */
router.get('/preparacion', ver, (req, res) => ok(res, {
  preparacion: calculo.preparacion({ hasta: texto(req.query.hasta, 10) || calculo.hoy() })
}));

router.get('/:id', ver, (req, res) => {
  const p = calculo.completo(req.params.id);
  if (!p) return error(res, 'Ese pedido no existe.', 404);
  return ok(res, { pedido: p });
});

// ============================================================
// TOMAR UN PEDIDO
// ============================================================

router.post('/', tomar, (req, res) => {
  const lineas = req.body?.lineas;
  if (!Array.isArray(lineas) || !lineas.length) {
    return error(res, 'El pedido está vacío.');
  }
  if (lineas.length > 50) return error(res, 'Demasiadas líneas en un pedido.');

  // A QUIÉN. Un pedido siempre es de alguien: sin nombre no hay a dónde
  // llevarlo, y una nota de entrega sin destinatario no sirve de nada.
  // El `?? null` no es adorno: a node:sqlite hay que darle null, nunca
  // undefined —revienta con un error del motor—, y sin cliente el cuerpo
  // no trae nada. Sin esto, tomar un pedido sin elegir cliente contestaba
  // «ocurrió un error en el servidor» en vez de decir qué falta.
  const cliente = bd.prepare('SELECT * FROM clientes WHERE id = ? AND activo = 1')
    .get(req.body?.clienteId ?? null);
  if (!cliente) {
    return error(res, 'Un pedido es de alguien: elige al cliente o dalo de alta.');
  }

  const lista = listaActiva();
  if (!lista) return error(res, 'No hay ninguna lista de precios activa.', 409);

  // El mismo cotizador que una venta, con la lista de mayoreo del cliente
  // si le toca: el pedido tiene que decir el precio que se le va a cobrar,
  // no otro.
  const preparadas = prepararLineas(lineas, lista, listaDeMayoreo(cliente));
  if (preparadas.error) return error(res, preparadas.error, preparadas.codigo || 400);

  const formaPago = FORMAS.includes(req.body?.formaPago) ? req.body.formaPago : 'efectivo';
  const paraCuando = texto(req.body?.paraCuando, 10) || calculo.hoy();

  const id = nuevoId();
  const fecha = ahora();

  const guardar = bd.transaction(() => {
    const folio = bd.prepare('SELECT COALESCE(MAX(folio), 0) n FROM pedidos').get().n + 1;

    bd.prepare(`
      INSERT INTO pedidos (id, folio, fecha, para_cuando, cliente_id,
                           direccion, referencias, horario, telefono,
                           latitud, longitud, estado, notas, forma_pago,
                           ejecutor_id, capturista_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?, ?, ?)
    `).run(id, folio, fecha, paraCuando, cliente.id,
           // COPIADOS del cliente (regla 3.5): si se muda, la nota de este
           // pedido sigue diciendo a dónde se llevó.
           cliente.direccion, cliente.referencias, cliente.horario_entrega,
           cliente.telefono, cliente.latitud, cliente.longitud,
           texto(req.body?.notas, 500), formaPago,
           req.body?.ejecutorId || req.usuario.id, req.usuario.id);

    const meter = bd.prepare(`
      INSERT INTO pedido_lineas (id, pedido_id, producto_id, concepto, cantidad,
                                 dieciseisavos, precio_centavos, desglose)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const l of preparadas.lineas) {
      meter.run(nuevoId(), id, l.productoId, l.concepto, l.cantidad ?? 1,
                l.dieciseisavos, l.centavos, l.desglose);
    }
    return folio;
  });
  const folio = guardar();
  // El que pide agua es cliente del agua desde hoy, aunque todavía no se
  // le haya entregado (v5.7.1): es lo que lo pone en su pestaña.
  marcarLoQueCompra(cliente.id, preparadas.lineas);

  bitacora.registrar({
    accion: 'pedido.tomado', entidad: 'pedido', entidadId: id,
    ejecutorId: req.body?.ejecutorId || req.usuario.id, capturistaId: req.usuario.id,
    detalle: { folio, cliente: cliente.nombre, total: preparadas.total,
               lineas: preparadas.lineas.length, paraCuando }
  });

  return ok(res, { pedido: calculo.completo(id) }, 201);
});

// ============================================================
// ENTREGARLO: aquí nace la venta
// ============================================================

/**
 * "Cuando el repartidor regrese hay que liquidarle todas las cuentas de lo
 *  que repartió."
 *
 * Eso, en lote y por viaje, es la versión que viene. Esto es la pieza de
 * abajo: UN pedido que llegó a su destino.
 *
 * La venta se crea con las líneas del pedido TAL CUAL, sin volver a
 * cotizar. Es lo que promete el papel que el cliente tiene enfrente.
 */
router.post('/:id/entregar', entregar, (req, res) => {
  const r = entregarPedido({
    pedidoId: req.params.id,
    formaPago: req.body?.formaPago,
    usuario: req.usuario,
    ejecutorId: req.body?.cajeroId || null
  });
  if (r.error) return error(res, r.error, r.codigo || 400);
  return ok(res, r);
});

// ============================================================
// CANCELARLO
// ============================================================

router.post('/:id/cancelar', tomar, (req, res) => {
  const p = bd.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
  if (!p) return error(res, 'Ese pedido no existe.', 404);
  if (p.estado === 'entregado') {
    return error(res, 'Ese pedido ya se entregó. Lo que se cancela es su ticket.', 409);
  }
  if (p.estado === 'cancelado') return error(res, 'Ese pedido ya estaba cancelado.');

  const motivo = texto(req.body?.motivo, 300);
  if (!motivo) return error(res, 'Escribe por qué se cancela.');

  bd.prepare(`
    UPDATE pedidos SET estado = 'cancelado', cancelado_en = ?, cancelado_por = ?,
                       motivo_cancelacion = ?
     WHERE id = ?
  `).run(ahora(), req.usuario.id, motivo, p.id);

  bitacora.registrar({
    accion: 'pedido.cancelado', entidad: 'pedido', entidadId: p.id,
    ejecutorId: req.usuario.id, detalle: { folio: p.folio, motivo }
  });

  return ok(res, { pedido: calculo.completo(p.id) });
});

// ============================================================
// CORREGIRLO
//
// Un pedido pendiente todavía no ha pasado nada: se puede cambiar la fecha,
// las notas o cómo va a pagar sin tocar nada más. Las LÍNEAS no se editan
// —se cancela y se toma otro— porque cambiar lo que pidió después de haber
// impreso su nota es la forma de que salga una cosa y llegue otra.
// ============================================================

router.put('/:id', tomar, (req, res) => {
  const p = bd.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
  if (!p) return error(res, 'Ese pedido no existe.', 404);
  if (p.estado !== 'pendiente') {
    return error(res, 'Solo se puede corregir un pedido que todavía no salió.', 409);
  }

  const campos = {};
  if (req.body?.paraCuando !== undefined) {
    campos.para_cuando = texto(req.body.paraCuando, 10) || calculo.hoy();
  }
  if (req.body?.notas !== undefined) campos.notas = texto(req.body.notas, 500);
  if (req.body?.formaPago !== undefined) {
    if (!FORMAS.includes(req.body.formaPago)) return error(res, 'Esa forma de pago no existe.');
    campos.forma_pago = req.body.formaPago;
  }

  const claves = Object.keys(campos);
  if (!claves.length) return ok(res, { pedido: calculo.completo(p.id) });

  bd.prepare(`UPDATE pedidos SET ${claves.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .run(...claves.map((k) => campos[k]), p.id);

  bitacora.registrar({
    accion: 'pedido.editado', entidad: 'pedido', entidadId: p.id,
    ejecutorId: req.usuario.id, detalle: { folio: p.folio, ...campos }
  });
  return ok(res, { pedido: calculo.completo(p.id) });
});

module.exports = router;
