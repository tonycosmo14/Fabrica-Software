/**
 * LO ENCOMENDADO  (v4.5)
 *
 * "A veces algún cliente nos regresa un poco de hielo, pero no es que lo
 *  devuelva: quiere que se lo guardemos para que pase por él más tarde o
 *  al otro día. Le decimos encomendados. Ese hielo ya está pagado, solo se
 *  guarda en el cuarto frío. Normalmente le hago un papelito con el nombre
 *  del cliente, la fecha y la hora."
 *
 * Lo que se pidió es el papelito. Lo que hace falta debajo es que el hielo
 * encomendado deje de romper el cuadre: como la venta ya lo restó del
 * cuarto frío y la marqueta sigue ahí, al contar aparecería un "SOBRA"
 * todos los días hasta que el cliente pasara por ella. La aritmética está
 * en `existencia/calculo.js`; aquí solo se guardan los renglones.
 *
 * NO ES UNA VENTA Y NO TOCA EL DINERO. La venta ya se hizo, con su ticket
 * y su folio; esto solo dice dónde está el hielo. Por eso no abre el cajón
 * ni entra en el corte de dinero.
 */
const express = require('express');
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');
const { ok, error } = require('../../lib/respuestas');
const bitacora = require('../../lib/bitacora');
const { exigirPermiso } = require('../../middleware/sesion');
const { sesionAbierta } = require('../caja/calculo');

const router = express.Router();

const verEncomiendas = exigirPermiso('venta.ver');
const operar = exigirPermiso('venta.registrar');
const corregir = exigirPermiso('venta.cancelar');

/** Cómo le dice esta fábrica. Sale impreso en el papelito del cliente. */
function comoSeLlama() {
  return bd.prepare("SELECT valor FROM configuracion WHERE clave = 'nombre_encomienda'")
    .get()?.valor || 'Encomendado';
}

const CAMPOS = `
  e.*, u.nombre AS capturista_nombre, d.nombre AS entregado_por_nombre,
  a.nombre AS almacen_nombre, c.negocio AS cliente_negocio
`;
const DE = `
  FROM encomiendas e
  LEFT JOIN usuarios u  ON u.id = e.capturista_id
  LEFT JOIN usuarios d  ON d.id = e.entregado_por
  LEFT JOIN almacenes a ON a.id = e.almacen_id
  LEFT JOIN clientes c  ON c.id = e.cliente_id
`;

function una(id) {
  return bd.prepare(`SELECT ${CAMPOS} ${DE} WHERE e.id = ?`).get(id) || null;
}

/** El cuarto frío que recibe la producción, que es donde se guarda todo. */
function almacenPorOmision(idPedido) {
  if (idPedido) {
    const a = bd.prepare('SELECT * FROM almacenes WHERE id = ? AND activo = 1').get(idPedido);
    if (a) return a;
  }
  return bd.prepare(`
    SELECT * FROM almacenes WHERE activo = 1 AND recibe_produccion = 1
     ORDER BY orden LIMIT 1
  `).get() || bd.prepare('SELECT * FROM almacenes WHERE activo = 1 ORDER BY orden LIMIT 1').get()
    || null;
}

/**
 * LO QUE ESTÁ GUARDADO AHORA MISMO.
 *
 * De la más vieja a la más nueva: la que lleva tres días esperando es la
 * que hay que mirar, no la de hace diez minutos.
 */
router.get('/', verEncomiendas, (req, res) => {
  const todas = req.query.todas === '1';
  const lista = bd.prepare(`
    SELECT ${CAMPOS} ${DE}
     WHERE e.anulado_en IS NULL ${todas ? '' : 'AND e.entregado_en IS NULL'}
     ORDER BY ${todas ? 'e.fecha DESC' : 'e.fecha'}
     LIMIT ?
  `).all(todas ? 100 : 200);

  const pendientes = lista.filter((e) => !e.entregado_en);
  return ok(res, {
    nombre: comoSeLlama(),
    encomiendas: lista,
    pendientes: pendientes.length,
    dieciseisavos: pendientes.reduce((n, e) => n + e.dieciseisavos, 0)
  });
});

/**
 * GUARDARLE HIELO A UN CLIENTE.
 *
 * El hielo ya se pagó: esto no cobra nada. Lo único que se exige es DE
 * QUIÉN ES y CUÁNTO, porque sin nombre el papelito no sirve para nada y
 * sin cantidad el cuarto frío no cuadra.
 */
router.post('/', operar, (req, res) => {
  const almacen = almacenPorOmision(req.body?.almacenId);
  if (!almacen) return error(res, 'No hay ningún cuarto frío dado de alta.', 409);

  const dieciseisavos = Math.round(Number(req.body?.dieciseisavos));
  if (!Number.isFinite(dieciseisavos) || dieciseisavos <= 0) {
    return error(res, 'Escribe cuánto hielo se le guarda.');
  }

  // De quién es: un cliente dado de alta, o un nombre escrito a mano para
  // el que pasa una vez al año. El nombre se copia SIEMPRE (regla 3.5): el
  // papel dice lo que decía ese día aunque después se renombre al cliente.
  let clienteId = null;
  let nombre = String(req.body?.clienteNombre || '').trim().slice(0, 60);
  if (req.body?.clienteId) {
    const c = bd.prepare('SELECT id, nombre FROM clientes WHERE id = ?').get(req.body.clienteId);
    if (!c) return error(res, 'Ese cliente no existe.', 404);
    clienteId = c.id;
    nombre = c.nombre;
  }
  if (!nombre) return error(res, 'Dinos de quién es el hielo.');

  const ventaId = req.body?.ventaId
    ? bd.prepare('SELECT id FROM ventas WHERE id = ?').get(req.body.ventaId)?.id || null
    : null;

  const id = nuevoId();
  bd.prepare(`
    INSERT INTO encomiendas
      (id, fecha, almacen_id, dieciseisavos, cliente_id, cliente_nombre,
       venta_id, notas, capturista_id, caja_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, ahora(), almacen.id, dieciseisavos, clienteId, nombre, ventaId,
         String(req.body?.notas || '').trim().slice(0, 120) || null,
         req.usuario.id, sesionAbierta()?.id || null);

  bitacora.registrar({
    accion: 'encomienda.guardada', entidad: 'encomienda', entidadId: id,
    ejecutorId: req.usuario.id,
    detalle: { cliente: nombre, dieciseisavos, almacen: almacen.nombre }
  });

  return ok(res, { encomienda: una(id), nombre: comoSeLlama() }, 201);
});

/**
 * YA PASÓ POR SU HIELO.
 *
 * No cobra nada tampoco: ya estaba pagado. Lo que cambia es que a partir
 * de ahora ese hielo SÍ salió del cuarto frío, y el cuadre lo resta.
 */
router.post('/:id/entregar', operar, (req, res) => {
  const e = bd.prepare('SELECT * FROM encomiendas WHERE id = ?').get(req.params.id);
  if (!e) return error(res, 'Esa encomienda no existe.', 404);
  if (e.anulado_en) return error(res, 'Esa encomienda está anulada.', 409);
  if (e.entregado_en) {
    return error(res, `${e.cliente_nombre} ya pasó por ese hielo.`, 409);
  }

  bd.prepare(`
    UPDATE encomiendas SET entregado_en = ?, entregado_por = ?, entregado_caja_id = ?
     WHERE id = ?
  `).run(ahora(), req.usuario.id, sesionAbierta()?.id || null, e.id);

  bitacora.registrar({
    accion: 'encomienda.entregada', entidad: 'encomienda', entidadId: e.id,
    ejecutorId: req.usuario.id,
    detalle: { cliente: e.cliente_nombre, dieciseisavos: e.dieciseisavos }
  });

  return ok(res, { encomienda: una(e.id) });
});

/**
 * DESHACER UNA ENTREGA mal marcada. Se tocó el renglón equivocado y el
 * hielo sigue ahí: vuelve a estar guardado, que es la verdad.
 */
router.post('/:id/deshacer-entrega', corregir, (req, res) => {
  const e = bd.prepare('SELECT * FROM encomiendas WHERE id = ?').get(req.params.id);
  if (!e) return error(res, 'Esa encomienda no existe.', 404);
  if (!e.entregado_en) return error(res, 'Esa encomienda sigue guardada.', 409);

  bd.prepare(`
    UPDATE encomiendas SET entregado_en = NULL, entregado_por = NULL,
                           entregado_caja_id = NULL
     WHERE id = ?
  `).run(e.id);

  bitacora.registrar({
    accion: 'encomienda.entrega-deshecha', entidad: 'encomienda', entidadId: e.id,
    ejecutorId: req.usuario.id, detalle: { cliente: e.cliente_nombre }
  });

  return ok(res, { encomienda: una(e.id) });
});

/** Mal capturada. No se borra: se anula con su motivo (regla 3.4). */
router.post('/:id/anular', corregir, (req, res) => {
  const e = bd.prepare('SELECT * FROM encomiendas WHERE id = ?').get(req.params.id);
  if (!e) return error(res, 'Esa encomienda no existe.', 404);
  if (e.anulado_en) return error(res, 'Esa encomienda ya está anulada.', 409);

  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) return error(res, 'Escribe por qué se anula.');

  bd.prepare(`
    UPDATE encomiendas SET anulado_en = ?, anulado_por = ?, motivo_anulacion = ?
     WHERE id = ?
  `).run(ahora(), req.usuario.id, motivo, e.id);

  bitacora.registrar({
    accion: 'encomienda.anulada', entidad: 'encomienda', entidadId: e.id,
    ejecutorId: req.usuario.id,
    detalle: { motivo, cliente: e.cliente_nombre, dieciseisavos: e.dieciseisavos }
  });

  return ok(res, { anulada: true });
});

module.exports = router;
module.exports.comoSeLlama = comoSeLlama;
