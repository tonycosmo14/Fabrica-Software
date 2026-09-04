/**
 * EL REPARTO — la API  (v5.7)
 *
 * ============================================================
 * LA VIDA DE UNA SALIDA
 * ============================================================
 *
 *   SE ARMA      se elige vehículo y repartidor, se le cuelgan los
 *                pedidos del día y se le sube lo suelto.
 *   SALE         y ya no se le agregan cosas: lo que se le agregara
 *                después sería carga que nunca subió al camión.
 *   REGRESA      se captura qué llegó a su puerta, qué se vendió suelto
 *                y qué volvió. De ahí sale la merma, sola.
 *   SE LIQUIDA   la cajera recibe el dinero. Si cuadra, se cierra ahí
 *                mismo; si no, se avisa y lo cierra un responsable.
 *
 * ============================================================
 * DOS CARAS DE LA MISMA PANTALLA
 * ============================================================
 *
 * "Que las liquidaciones se puedan hacer en el módulo vender, porque
 *  cuando el repartidor regrese a quien le va a entregar el dinero es a
 *  quien esté en caja. Ella no debe poder hacer mucho, simplemente
 *  recibir, y el administrador y el gerente son los que tienen más
 *  opciones."
 *
 * Así está partido, y el permiso es la línea:
 *
 *   `reparto.operar`  armar, sacar, capturar el regreso y RECIBIR el
 *                     dinero. Contar billetes y decir cuántos son.
 *   `reparto.cuadrar` cerrar una salida que NO cuadró, con su motivo.
 *                     Eso ya no es contar: es decidir quién se come la
 *                     diferencia, y esa decisión tiene dueño.
 *
 * Y el repartidor no tiene ninguno de los dos: la persona a la que se le
 * cuadra no puede ser la que cuadra.
 */
const express = require('express');
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');
const { ok, error } = require('../../lib/respuestas');
const { exigirPermiso } = require('../../middleware/sesion');
const { aCentavos, formato } = require('../../lib/dinero');
const { aTexto, validar } = require('../../lib/fracciones');
const bitacora = require('../../lib/bitacora');
const calculo = require('./calculo');
const pedidosCalculo = require('../pedidos/calculo');
const { entregarPedido } = require('../pedidos/entrega');
const { crearVenta } = require('../ventas/rutas');
const { listaActiva } = require('../ventas/precios');
const { productoPorId, cotizar } = require('../catalogo/catalogo');

const router = express.Router();

const ver = exigirPermiso('reparto.ver');
const operar = exigirPermiso('reparto.operar');
const cuadrar = exigirPermiso('reparto.cuadrar');

const texto = (v, largo = 300) => {
  const t = String(v ?? '').trim();
  return t ? t.slice(0, largo) : null;
};

const entero = (v, tope = 100000) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > tope) return null;
  return n;
};

const almacenDeSalida = () => bd.prepare(
  'SELECT * FROM almacenes WHERE activo = 1 AND recibe_produccion = 1 ORDER BY orden LIMIT 1'
).get() || null;

// ============================================================
// LOS VEHÍCULOS
// ============================================================

router.get('/vehiculos', ver, (req, res) => ok(res, {
  vehiculos: bd.prepare(`
    SELECT v.*, (SELECT COUNT(*) FROM salidas s WHERE s.vehiculo_id = v.id) AS viajes
      FROM vehiculos v
     WHERE v.activo = 1 OR ? = 1
     ORDER BY v.activo DESC, v.nombre
  `).all(req.query.baja === '1' ? 1 : 0)
}));

// Dar de alta un vehículo es comprometer un fierro, no una operación de
// turno: el permiso no lo lista ningún rol, así que solo lo alcanza el
// comodín del administrador. Es la misma regla que las neveras.
router.post('/vehiculos', exigirPermiso('vehiculos.administrar'), (req, res) => {
  const nombre = texto(req.body?.nombre, 60);
  if (!nombre) return error(res, 'Ponle nombre: «La camioneta blanca».');

  const tipo = ['camioneta', 'moto', 'triciclo', 'otro'].includes(req.body?.tipo)
    ? req.body.tipo : 'camioneta';
  const capacidad = req.body?.capacidad === undefined || req.body.capacidad === ''
    ? null : entero(req.body.capacidad, 5000);
  if (capacidad === null && req.body?.capacidad) {
    return error(res, 'La capacidad se escribe en marquetas, con números.');
  }

  const id = nuevoId();
  bd.prepare(`
    INSERT INTO vehiculos (id, nombre, placas, tipo, capacidad_marquetas, notas,
                           activo, fecha_alta, creado_por)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, nombre, texto(req.body?.placas, 20), tipo, capacidad,
         texto(req.body?.notas, 300), ahora(), req.usuario.id);

  bitacora.registrar({
    accion: 'vehiculo.alta', entidad: 'vehiculo', entidadId: id,
    ejecutorId: req.usuario.id, detalle: { nombre, tipo }
  });
  return ok(res, { vehiculo: bd.prepare('SELECT * FROM vehiculos WHERE id = ?').get(id) }, 201);
});

router.put('/vehiculos/:id', exigirPermiso('vehiculos.administrar'), (req, res) => {
  const v = bd.prepare('SELECT * FROM vehiculos WHERE id = ?').get(req.params.id);
  if (!v) return error(res, 'Ese vehículo no existe.', 404);

  const campos = {};
  if (req.body?.nombre !== undefined) {
    const n = texto(req.body.nombre, 60);
    if (!n) return error(res, 'El vehículo necesita un nombre.');
    campos.nombre = n;
  }
  if (req.body?.placas !== undefined) campos.placas = texto(req.body.placas, 20);
  if (req.body?.notas !== undefined) campos.notas = texto(req.body.notas, 300);
  if (req.body?.tipo !== undefined) {
    if (!['camioneta', 'moto', 'triciclo', 'otro'].includes(req.body.tipo)) {
      return error(res, 'Ese tipo de vehículo no existe.');
    }
    campos.tipo = req.body.tipo;
  }
  if (req.body?.capacidad !== undefined) {
    campos.capacidad_marquetas = req.body.capacidad === '' || req.body.capacidad === null
      ? null : entero(req.body.capacidad, 5000);
  }
  // Nada se borra (regla 3.4): un vehículo se da de baja y sus viajes
  // siguen contando quién llevó qué.
  if (req.body?.activo !== undefined) {
    campos.activo = req.body.activo ? 1 : 0;
    campos.fecha_baja = req.body.activo ? null : ahora();
  }

  const claves = Object.keys(campos);
  if (!claves.length) return ok(res, { vehiculo: v });

  bd.prepare(`UPDATE vehiculos SET ${claves.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .run(...claves.map((k) => campos[k]), v.id);

  bitacora.registrar({
    accion: 'vehiculo.edicion', entidad: 'vehiculo', entidadId: v.id,
    ejecutorId: req.usuario.id, detalle: { nombre: campos.nombre || v.nombre, ...campos }
  });
  return ok(res, { vehiculo: bd.prepare('SELECT * FROM vehiculos WHERE id = ?').get(v.id) });
});

// ============================================================
// VER LAS SALIDAS
// ============================================================

router.get('/', ver, (req, res) => ok(res, {
  salidas: calculo.lista({
    estado: texto(req.query.estado, 20) || 'abiertas',
    repartidor: texto(req.query.repartidor, 60),
    desde: texto(req.query.desde, 10)
  }),
  abiertas: calculo.cuantasAbiertas(),
  estados: calculo.ESTADOS,
  // Quién puede llevarse una camioneta. El reparto es de los repartidores,
  // pero en una fábrica chica el gerente también sale un día.
  repartidores: bd.prepare(`
    SELECT id, nombre, rol FROM usuarios
     WHERE activo = 1 AND rol IN ('repartidor','gerente','admin','cajero')
     ORDER BY CASE rol WHEN 'repartidor' THEN 0 ELSE 1 END, nombre
  `).all(),
  vehiculos: bd.prepare('SELECT * FROM vehiculos WHERE activo = 1 ORDER BY nombre').all()
}));

/** Las que esperan que alguien en la caja les reciba el dinero. */
router.get('/por-recibir', ver, (req, res) =>
  ok(res, { salidas: calculo.porRecibir() }));

router.get('/:id', ver, (req, res) => {
  const s = calculo.completa(req.params.id);
  if (!s) return error(res, 'Esa salida no existe.', 404);
  return ok(res, { salida: s });
});

// ============================================================
// ARMARLA
// ============================================================

router.post('/', operar, (req, res) => {
  const repartidor = bd.prepare('SELECT * FROM usuarios WHERE id = ? AND activo = 1')
    .get(req.body?.repartidorId ?? null);
  if (!repartidor) return error(res, '¿Quién se la lleva? Elige al repartidor.');

  const vehiculo = req.body?.vehiculoId
    ? bd.prepare('SELECT * FROM vehiculos WHERE id = ? AND activo = 1').get(req.body.vehiculoId)
    : null;
  if (req.body?.vehiculoId && !vehiculo) return error(res, 'Ese vehículo no existe.');

  const id = nuevoId();
  const guardar = bd.transaction(() => {
    const folio = bd.prepare('SELECT COALESCE(MAX(folio), 0) n FROM salidas').get().n + 1;
    bd.prepare(`
      INSERT INTO salidas (id, folio, fecha, vehiculo_id, repartidor_id, estado,
                           notas, ejecutor_id, capturista_id)
      VALUES (?, ?, ?, ?, ?, 'cargando', ?, ?, ?)
    `).run(id, folio, ahora(), vehiculo?.id || null, repartidor.id,
           texto(req.body?.notas, 300), req.usuario.id, req.usuario.id);
    return folio;
  });
  const folio = guardar();

  bitacora.registrar({
    accion: 'salida.abierta', entidad: 'salida', entidadId: id,
    ejecutorId: req.usuario.id,
    detalle: { folio, repartidor: repartidor.nombre, vehiculo: vehiculo?.nombre || null }
  });
  return ok(res, { salida: calculo.completa(id) }, 201);
});

/** Cuelga un pedido a la salida. */
router.post('/:id/pedidos', operar, (req, res) => {
  const s = bd.prepare('SELECT * FROM salidas WHERE id = ?').get(req.params.id);
  if (!s) return error(res, 'Esa salida no existe.', 404);
  if (s.estado !== 'cargando') {
    return error(res, 'Ya salió: lo que se le agregue ahora no subió al camión.', 409);
  }

  const p = bd.prepare("SELECT * FROM pedidos WHERE id = ? AND estado = 'pendiente'")
    .get(req.body?.pedidoId ?? null);
  if (!p) return error(res, 'Ese pedido no existe o ya no está pendiente.', 409);

  // UN PEDIDO VA EN UNA SALIDA A LA VEZ. En dos, el hielo se contaría dos
  // veces y las dos camionetas irían a la misma puerta.
  const otra = calculo.salidaDelPedido(p.id);
  if (otra && otra.id !== s.id) {
    return error(res, `Ese pedido ya va en la salida #${otra.folio}.`, 409);
  }
  if (otra) return ok(res, { salida: calculo.completa(s.id) });

  bd.prepare('INSERT INTO salida_pedidos (id, salida_id, pedido_id) VALUES (?, ?, ?)')
    .run(nuevoId(), s.id, p.id);
  return ok(res, { salida: calculo.completa(s.id) }, 201);
});

router.delete('/:id/pedidos/:pedidoId', operar, (req, res) => {
  const s = bd.prepare('SELECT * FROM salidas WHERE id = ?').get(req.params.id);
  if (!s) return error(res, 'Esa salida no existe.', 404);
  if (s.estado !== 'cargando') {
    return error(res, 'Ya salió: bajarle un pedido ahora no lo baja del camión.', 409);
  }
  bd.prepare('DELETE FROM salida_pedidos WHERE salida_id = ? AND pedido_id = ?')
    .run(s.id, req.params.pedidoId);
  return ok(res, { salida: calculo.completa(s.id) });
});

/**
 * LO SUELTO.
 *
 * Se cotiza con la lista de PÚBLICO y se copia (regla 3.5): lo que se
 * venda en la calle no es de nadie todavía, así que no hay lista de
 * mayoreo que aplicar. Si un cliente de mayoreo lo para en la calle, eso
 * es un pedido y se toma como pedido.
 */
router.post('/:id/carga', operar, (req, res) => {
  const s = bd.prepare('SELECT * FROM salidas WHERE id = ?').get(req.params.id);
  if (!s) return error(res, 'Esa salida no existe.', 404);
  if (s.estado !== 'cargando') {
    return error(res, 'Ya salió: lo que se le agregue ahora no subió al camión.', 409);
  }

  const lista = listaActiva();
  if (!lista) return error(res, 'No hay ninguna lista de precios activa.', 409);

  const producto = req.body?.productoId ? productoPorId(req.body.productoId) : null;
  if (req.body?.productoId && !producto) {
    return error(res, 'Ese producto ya no existe o se dio de baja.', 409);
  }
  if (producto?.mayoreo) {
    return error(res, 'Lo de mayoreo va como pedido, con su cliente: en la calle no hay a quién cobrárselo.', 409);
  }

  const cantidad = producto ? (entero(req.body?.cantidad ?? 1, 500) ?? 0) : 1;
  if (producto && cantidad < 1) return error(res, 'La cantidad no es válida.');

  let sueltos = 0;
  if (!producto) {
    sueltos = Number(req.body?.dieciseisavos);
    try { validar(sueltos); } catch { return error(res, 'Esa cantidad de hielo no es válida.'); }
    if (sueltos <= 0) return error(res, 'Cantidad fuera de rango.');
  }

  const c = cotizar({ producto, dieciseisavos: sueltos, listaId: lista.id, cantidad });
  if (c.faltan?.length) {
    return error(res, `Falta poner precio a ${c.faltan.map(aTexto).join(', ')}.`, 409);
  }

  // EL PRECIO SE GUARDA POR PIEZA CUANDO SON PIEZAS.
  //
  // El cotizador devuelve el importe de la LÍNEA ENTERA —diez bolsas a
  // $20 son $200—, y guardarlo así hacía que al vender seis se cobraran
  // seis veces $200. Del hielo se guarda el importe de la línea completa,
  // porque ahí lo que se vende es una fracción y el precio se reparte a
  // prorrata: no hay "pieza" que valga nada por sí sola.
  const precio = producto && !c.dieciseisavos
    ? Math.round(c.centavos / cantidad)
    : c.centavos;

  bd.prepare(`
    INSERT INTO salida_carga (id, salida_id, producto_id, concepto, cantidad,
                              dieciseisavos, precio_centavos, desglose)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(nuevoId(), s.id, producto?.id || null, String(c.concepto).slice(0, 40),
         cantidad, c.dieciseisavos, precio, c.desglose);

  return ok(res, { salida: calculo.completa(s.id) }, 201);
});

router.delete('/:id/carga/:lineaId', operar, (req, res) => {
  const s = bd.prepare('SELECT * FROM salidas WHERE id = ?').get(req.params.id);
  if (!s) return error(res, 'Esa salida no existe.', 404);
  if (s.estado !== 'cargando') {
    return error(res, 'Ya salió: bajarle carga ahora no la baja del camión.', 409);
  }
  bd.prepare('DELETE FROM salida_carga WHERE id = ? AND salida_id = ?')
    .run(req.params.lineaId, s.id);
  return ok(res, { salida: calculo.completa(s.id) });
});

// ============================================================
// QUE SALGA
// ============================================================

router.post('/:id/salir', operar, (req, res) => {
  const s = calculo.completa(req.params.id);
  if (!s) return error(res, 'Esa salida no existe.', 404);
  if (s.estado !== 'cargando') return error(res, 'Esa salida ya salió.', 409);
  if (!s.pedidos.length && !s.carga.length) {
    return error(res, 'La camioneta va vacía: cuélgale sus pedidos o súbele carga.');
  }

  bd.prepare("UPDATE salidas SET estado = 'en_ruta', salio_en = ?, salio_por = ? WHERE id = ?")
    .run(ahora(), req.usuario.id, s.id);

  bitacora.registrar({
    accion: 'salida.salio', entidad: 'salida', entidadId: s.id,
    ejecutorId: s.repartidor_id, capturistaId: req.usuario.id,
    detalle: { folio: s.folio, repartidor: s.repartidor_nombre,
               pedidos: s.pedidos.length, hielo: s.hielo.textos.subio,
               vehiculo: s.vehiculo_nombre }
  });
  return ok(res, { salida: calculo.completa(s.id) });
});

// ============================================================
// EL REGRESO
// ============================================================

/**
 * VOLVIÓ. Solo cambia el estado: a partir de aquí se puede capturar qué
 * pasó, y hasta aquí no —capturar entregas de un camión que sigue en la
 * calle es inventarlas—.
 */
router.post('/:id/regreso', operar, (req, res) => {
  const s = bd.prepare('SELECT * FROM salidas WHERE id = ?').get(req.params.id);
  if (!s) return error(res, 'Esa salida no existe.', 404);
  if (s.estado === 'regreso') return ok(res, { salida: calculo.completa(s.id) });
  if (s.estado !== 'en_ruta') return error(res, 'Esa salida no anda en la calle.', 409);

  bd.prepare("UPDATE salidas SET estado = 'regreso', regreso_en = ?, regreso_por = ? WHERE id = ?")
    .run(ahora(), req.usuario.id, s.id);

  bitacora.registrar({
    accion: 'salida.regreso', entidad: 'salida', entidadId: s.id,
    ejecutorId: req.usuario.id, detalle: { folio: s.folio }
  });
  return ok(res, { salida: calculo.completa(s.id) });
});

/**
 * QUÉ PASÓ CON CADA PEDIDO.
 *
 * Entregado, con la forma de pago que de verdad usó —en la puerta el
 * cliente cambia de opinión— o no entregado, con el motivo, y entonces
 * vuelve a la lista de pendientes.
 */
router.post('/:id/pedidos/:pedidoId/entregado', operar, (req, res) => {
  const s = bd.prepare('SELECT * FROM salidas WHERE id = ?').get(req.params.id);
  if (!s) return error(res, 'Esa salida no existe.', 404);
  if (s.estado !== 'regreso') {
    return error(res, 'Primero hay que marcar que el camión regresó.', 409);
  }
  const enLaSalida = bd.prepare(
    'SELECT * FROM salida_pedidos WHERE salida_id = ? AND pedido_id = ?'
  ).get(s.id, req.params.pedidoId);
  if (!enLaSalida) return error(res, 'Ese pedido no iba en esta salida.', 409);

  const r = entregarPedido({
    pedidoId: req.params.pedidoId,
    formaPago: req.body?.formaPago,
    usuario: req.usuario,
    salidaId: s.id
  });
  if (r.error) return error(res, r.error, r.codigo || 400);

  bd.prepare('UPDATE salida_pedidos SET no_entregado_motivo = NULL WHERE id = ?')
    .run(enLaSalida.id);

  return ok(res, { salida: calculo.completa(s.id), avisoCredito: r.avisoCredito });
});

/** No llegó a su puerta: vuelve a quedar pendiente, con el motivo escrito. */
router.post('/:id/pedidos/:pedidoId/no-entregado', operar, (req, res) => {
  const s = bd.prepare('SELECT * FROM salidas WHERE id = ?').get(req.params.id);
  if (!s) return error(res, 'Esa salida no existe.', 404);
  if (s.estado !== 'regreso') {
    return error(res, 'Primero hay que marcar que el camión regresó.', 409);
  }

  const motivo = texto(req.body?.motivo, 200);
  if (!motivo) return error(res, '¿Por qué no se entregó? Es lo que se le dice al cliente.');

  const p = bd.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.pedidoId);
  if (!p) return error(res, 'Ese pedido no existe.', 404);
  if (p.estado === 'entregado') {
    return error(res, 'Ese pedido ya se marcó entregado. Cancela su ticket si fue un error.', 409);
  }

  bd.prepare('UPDATE salida_pedidos SET no_entregado_motivo = ? WHERE salida_id = ? AND pedido_id = ?')
    .run(motivo, s.id, p.id);

  bitacora.registrar({
    accion: 'pedido.no_entregado', entidad: 'pedido', entidadId: p.id,
    ejecutorId: req.usuario.id, detalle: { folio: p.folio, salida: s.folio, motivo }
  });
  return ok(res, { salida: calculo.completa(s.id) });
});

/**
 * LO SUELTO, AL VOLVER.
 *
 * Se teclea lo que se PUEDE CONTAR: cuánto se vendió y cuánto volvió. La
 * merma sale de la resta y no se teclea nunca — teclearla sería pedirle a
 * alguien que confiese, y lo que se confiesa se redondea.
 */
router.post('/:id/carga/:lineaId/regreso', operar, (req, res) => {
  const s = bd.prepare('SELECT * FROM salidas WHERE id = ?').get(req.params.id);
  if (!s) return error(res, 'Esa salida no existe.', 404);
  if (s.estado !== 'regreso') {
    return error(res, 'Primero hay que marcar que el camión regresó.', 409);
  }

  const l = bd.prepare('SELECT * FROM salida_carga WHERE id = ? AND salida_id = ?')
    .get(req.params.lineaId, s.id);
  if (!l) return error(res, 'Esa línea de carga no existe.', 404);

  if (l.dieciseisavos > 0) {
    const vendido = Number(req.body?.vendidoDieciseisavos ?? 0);
    const regreso = Number(req.body?.regresoDieciseisavos ?? 0);
    for (const n of [vendido, regreso]) {
      if (!Number.isInteger(n) || n < 0) return error(res, 'Esa cantidad de hielo no es válida.');
    }
    if (vendido + regreso > l.dieciseisavos) {
      return error(res,
        `De ahí subieron ${aTexto(l.dieciseisavos)}: no pueden volver y venderse más.`);
    }
    bd.prepare(`UPDATE salida_carga SET vendido_dieciseisavos = ?, regreso_dieciseisavos = ?,
                       vendido_cantidad = 0, regreso_cantidad = 0 WHERE id = ?`)
      .run(vendido, regreso, l.id);
  } else {
    const vendido = entero(req.body?.vendidoCantidad ?? 0, 100000);
    const regreso = entero(req.body?.regresoCantidad ?? 0, 100000);
    if (vendido === null || regreso === null) return error(res, 'Esa cantidad no es válida.');
    if (vendido + regreso > l.cantidad) {
      return error(res, `De ${l.concepto} subieron ${l.cantidad}: no pueden volver y venderse más.`);
    }
    bd.prepare(`UPDATE salida_carga SET vendido_cantidad = ?, regreso_cantidad = ?,
                       vendido_dieciseisavos = 0, regreso_dieciseisavos = 0 WHERE id = ?`)
      .run(vendido, regreso, l.id);
  }

  return ok(res, { salida: calculo.completa(s.id) });
});

// ============================================================
// RECIBIR EL DINERO — lo que hace la cajera
// ============================================================

/**
 * "Debe de ser fácil que la cajera simplemente reciba el dinero que le
 *  están dando."
 *
 * Eso es todo lo que pasa aquí: se cuenta lo que trae y se apunta. No se
 * decide nada, no se arregla nada y no se cierra nada que no cuadre.
 *
 * Y NO SE APUNTA NINGUNA ENTRADA AL CAJÓN. Cada pedido entregado en
 * efectivo ya creó su venta, y una venta en efectivo ya cuenta en el
 * arqueo del turno. Meter además una entrada contaría el mismo dinero dos
 * veces y la caja sobraría todos los días.
 *
 * Si falta dinero, el turno va a salir corto — y así tiene que ser: el
 * hueco es real y el papel donde se busca es el corte.
 */
router.post('/:id/recibir', operar, (req, res) => {
  const s = calculo.completa(req.params.id);
  if (!s) return error(res, 'Esa salida no existe.', 404);
  if (s.estado !== 'regreso') {
    return error(res, 'Esa salida no está esperando que le reciban el dinero.', 409);
  }
  if (s.recibido_en) return error(res, 'A esa salida ya le recibieron el dinero.', 409);

  // Nada de recibir con entregas a medias: el número que se le pide al
  // repartidor tiene que salir de lo que YA se capturó, o se le va a pedir
  // dinero de pedidos que todavía nadie dijo si llegaron.
  const sinCapturar = s.pedidos.filter(
    (p) => p.estado === 'pendiente' && !p.noEntregadoMotivo);
  if (sinCapturar.length) {
    return error(res,
      `Faltan ${sinCapturar.length} pedido${sinCapturar.length === 1 ? '' : 's'} por capturar: `
      + 'di si llegaron o por qué no.', 409,
      { faltanPedidos: sinCapturar.map((p) => p.folio) });
  }
  const cargaSinCapturar = s.carga.filter((l) => !l.capturado);
  if (cargaSinCapturar.length) {
    return error(res, 'Falta contar lo que volvió de la carga suelta.', 409,
                 { faltaCarga: cargaSinCapturar.map((l) => l.concepto) });
  }

  let recibido;
  try { recibido = aCentavos(String(req.body?.efectivo ?? '').replace(/[^0-9.]/g, '')); }
  catch { return error(res, 'Ese importe no es válido.'); }
  if (recibido === null || recibido === undefined || recibido < 0) {
    return error(res, '¿Cuánto te entregó? Cuéntalo y escríbelo.');
  }

  const resultado = bd.transaction(() => {
    // LA VENTA DE LO SUELTO, una sola por viaje. En la calle no se dan
    // tickets: lo que hay es un total al final del día, y partirlo en
    // ventas inventadas sería inventar clientes.
    const vendido = s.carga.filter((l) => l.vendidoCentavos > 0);
    let ventaSuelto = null;
    if (vendido.length) {
      const lista = listaActiva();
      const total = vendido.reduce((n, l) => n + l.vendidoCentavos, 0);
      ventaSuelto = crearVenta({
        lineas: vendido.map((l) => ({
          concepto: l.concepto,
          dieciseisavos: l.vendidoDieciseisavos,
          centavos: l.vendidoCentavos,
          desglose: l.desglose,
          productoId: l.producto_id,
          cantidad: l.vendidoCantidad || 1
        })),
        total,
        pago: total,
        lista,
        almacenId: almacenDeSalida()?.id || null,
        cajeroId: s.repartidor_id,
        capturistaId: req.usuario.id,
        formaPago: 'efectivo',
        notas: `Venta en ruta · salida ${s.folio}`
      });
      bd.prepare('UPDATE ventas SET salida_id = ? WHERE id = ?').run(s.id, ventaSuelto.id);
    }

    bd.prepare(`
      UPDATE salidas SET efectivo_esperado_centavos = ?, efectivo_recibido_centavos = ?,
                         recibido_en = ?, recibido_por = ?, venta_suelto_id = ?
       WHERE id = ?
    `).run(s.dinero.esperado, recibido, ahora(), req.usuario.id,
           ventaSuelto?.id || null, s.id);

    return ventaSuelto;
  })();

  const diferencia = recibido - s.dinero.esperado;

  // SI CUADRA, SE CIERRA AQUÍ MISMO. Ese es el día normal y no tiene por
  // qué esperar a que un gerente venga a apretar otro botón: obligarlo
  // dejaría veinte salidas abiertas y nadie miraría ninguna.
  if (diferencia === 0) cerrar(s.id, req.usuario.id, null);

  bitacora.registrar({
    accion: diferencia === 0 ? 'salida.recibida' : 'salida.descuadrada',
    entidad: 'salida', entidadId: s.id,
    ejecutorId: s.repartidor_id, capturistaId: req.usuario.id,
    detalle: {
      folio: s.folio, repartidor: s.repartidor_nombre,
      esperado: s.dinero.esperado, recibido, diferencia,
      merma: s.hielo.merma, mermaTexto: aTexto(s.hielo.merma),
      porcientoMerma: s.hielo.porcientoMerma,
      entregados: s.entregados, sinEntregar: s.sinEntregar,
      recibio: req.usuario.nombre
    }
  });

  return ok(res, {
    salida: calculo.completa(s.id),
    diferencia,
    cuadro: diferencia === 0,
    ventaSuelto: resultado?.folio || null
  });
});

// ============================================================
// CERRARLA — lo que hace el gerente
// ============================================================

/**
 * Deja la salida liquidada y carga la merma al cuarto frío.
 *
 * La merma se carga AQUÍ y no al recibir, porque una salida que se cierra
 * dos veces cargaría el hielo derretido dos veces. `merma_id` es la
 * marca: si ya está, no se vuelve a cargar.
 */
function cerrar(salidaId, usuarioId, motivo) {
  const s = calculo.completa(salidaId);
  if (!s || s.estado === 'liquidada') return s;

  bd.transaction(() => {
    let mermaId = s.merma_id;

    if (!mermaId && s.hielo.merma > 0) {
      const almacen = almacenDeSalida();
      if (almacen) {
        mermaId = nuevoId();
        bd.prepare(`
          INSERT INTO mermas_hielo (id, fecha, almacen_id, dieciseisavos, motivo, notas,
                                    ejecutor_id, capturista_id)
          VALUES (?, ?, ?, ?, 'derretida', ?, ?, ?)
        `).run(mermaId, ahora(), almacen.id, s.hielo.merma,
               `Se derritió en el reparto · salida ${s.folio}`,
               s.repartidor_id, usuarioId);
      }
    }

    // La merma de lo que se cuenta por piezas —bolsas rotas, garrafones
    // que se cayeron— sale del inventario por su propio camino, que es el
    // que ya sabe restar piezas.
    for (const l of s.carga) {
      if (!l.producto_id || !l.lleva_inventario || l.mermaCantidad <= 0) continue;
      const yaEsta = bd.prepare(`
        SELECT 1 FROM movimientos_inventario
         WHERE producto_id = ? AND concepto = ? AND anulado_en IS NULL
      `).get(l.producto_id, `Merma del reparto · salida ${s.folio}`);
      if (yaEsta) continue;
      bd.prepare(`
        INSERT INTO movimientos_inventario
          (id, producto_id, fecha, tipo, cantidad, concepto, ejecutor_id, capturista_id)
        VALUES (?, ?, ?, 'salida', ?, ?, ?, ?)
      `).run(nuevoId(), l.producto_id, ahora(), l.mermaCantidad,
             `Merma del reparto · salida ${s.folio}`, s.repartidor_id, usuarioId);
    }

    bd.prepare(`
      UPDATE salidas SET estado = 'liquidada', liquidada_en = ?, liquidada_por = ?,
                         merma_id = ?, motivo_diferencia = COALESCE(?, motivo_diferencia)
       WHERE id = ?
    `).run(ahora(), usuarioId, mermaId || null, motivo, s.id);
  })();

  return calculo.completa(salidaId);
}

/**
 * CERRAR UNA SALIDA QUE NO CUADRÓ.
 *
 * Con su motivo, y solo quien puede `reparto.cuadrar`. No es contar
 * billetes: es decidir qué pasa con el dinero que falta, y esa decisión
 * tiene dueño.
 */
router.post('/:id/cerrar', cuadrar, (req, res) => {
  const s = calculo.completa(req.params.id);
  if (!s) return error(res, 'Esa salida no existe.', 404);
  if (s.estado === 'liquidada') return error(res, 'Esa salida ya está liquidada.', 409);
  if (s.estado !== 'regreso') return error(res, 'Esa salida todavía no regresa.', 409);
  if (!s.recibido_en) return error(res, 'Primero hay que recibirle el dinero.', 409);

  const motivo = texto(req.body?.motivo, 300);
  if (s.dinero.diferencia !== 0 && !motivo) {
    return error(res,
      `${s.dinero.diferencia < 0 ? 'Faltan' : 'Sobran'} `
      + `${formato(Math.abs(s.dinero.diferencia))}: escribe qué pasó antes de cerrarla.`);
  }

  const cerrada = cerrar(s.id, req.usuario.id, motivo);

  bitacora.registrar({
    accion: 'salida.liquidada', entidad: 'salida', entidadId: s.id,
    ejecutorId: req.usuario.id,
    detalle: { folio: s.folio, repartidor: s.repartidor_nombre,
               diferencia: s.dinero.diferencia, motivo,
               merma: s.hielo.merma, mermaTexto: aTexto(s.hielo.merma) }
  });
  return ok(res, { salida: cerrada });
});

/** Se canceló: no salió. Solo mientras esté cargando. */
router.post('/:id/cancelar', operar, (req, res) => {
  const s = bd.prepare('SELECT * FROM salidas WHERE id = ?').get(req.params.id);
  if (!s) return error(res, 'Esa salida no existe.', 404);
  if (s.estado !== 'cargando') {
    return error(res, 'Solo se cancela una salida que todavía no sale.', 409);
  }
  const motivo = texto(req.body?.motivo, 200);
  if (!motivo) return error(res, 'Escribe por qué se cancela.');

  bd.transaction(() => {
    // Los pedidos vuelven a la lista: no se pierden porque el viaje no
    // salió, que es lo que pasaría si quedaran colgados de una salida
    // muerta.
    bd.prepare('DELETE FROM salida_pedidos WHERE salida_id = ?').run(s.id);
    bd.prepare(`UPDATE salidas SET estado = 'cancelada', cancelada_en = ?,
                       cancelada_por = ?, motivo_cancelacion = ? WHERE id = ?`)
      .run(ahora(), req.usuario.id, motivo, s.id);
  })();

  bitacora.registrar({
    accion: 'salida.cancelada', entidad: 'salida', entidadId: s.id,
    ejecutorId: req.usuario.id, detalle: { folio: s.folio, motivo }
  });
  return ok(res, { salida: calculo.completa(s.id) });
});

module.exports = router;
module.exports.cerrarSalida = cerrar;
