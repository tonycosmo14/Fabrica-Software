/**
 * PUNTO DE VENTA  (v0.8)
 *
 * Reglas que manda el plan:
 *
 *  3.1  El hielo se cobra en dieciseisavos enteros.
 *  3.5  El precio se COPIA dentro de la venta. Si mañana suben los precios,
 *       los tickets de ayer no cambian.
 *  7.2  Cada fracción tiene su precio; no se divide el de la marqueta.
 *  7.3  Folio consecutivo histórico. Nunca se reinicia ni se reutiliza.
 *  7.4  Una venta cobrada NO SE EDITA. Si algo salió mal se cancela, y la
 *       cancelación es un registro aparte con su motivo y su responsable.
 */
const express = require('express');
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');
const { ok, error } = require('../../lib/respuestas');
const { aTexto, validar } = require('../../lib/fracciones');
const { aCentavos, formato } = require('../../lib/dinero');
const bitacora = require('../../lib/bitacora');
const { exigirPermiso } = require('../../middleware/sesion');
const { listaActiva, preciosDe, precioDe, sugerencia } = require('./precios');
const { sesionAbierta } = require('../caja/calculo');
const { productoPorId, productoPorCodigo, cotizar,
        categoriasActivas, productosActivos } = require('../catalogo/catalogo');

const router = express.Router();

const verVentas = exigirPermiso('caja.ver');
const vender = exigirPermiso('venta.registrar');
const configurarPrecios = exigirPermiso('precios.configurar');

const MAX_DIECISEISAVOS = 16 * 500;      // 500 marquetas de tope por venta

// ============================================================
// LO QUE NECESITA LA PANTALLA DE VENTA
// ============================================================

router.get('/contexto', vender, (req, res) => {
  const lista = listaActiva();
  if (!lista) return error(res, 'No hay ninguna lista de precios activa.', 409);

  const precios = [...preciosDe(lista.id).entries()]
    .map(([dieciseisavos, centavos]) => ({ dieciseisavos, centavos, etiqueta: aTexto(dieciseisavos) }))
    .sort((a, b) => b.dieciseisavos - a.dieciseisavos);

  const almacenes = bd.prepare(
    'SELECT id, nombre FROM almacenes WHERE activo = 1 AND recibe_produccion = 1 ORDER BY orden'
  ).all();

  const ultimoFolio = bd.prepare('SELECT COALESCE(MAX(folio), 0) n FROM ventas').get().n;

  // Se puede cobrar sin turno de caja abierto: la fábrica no se para porque
  // alguien olvidó abrirla. Pero ese dinero no entra en ningún corte, así
  // que la pantalla tiene que decirlo bien claro.
  const caja = sesionAbierta();

  return ok(res, {
    lista, precios, almacenes,
    siguienteFolio: ultimoFolio + 1,
    caja: caja ? { folio: caja.folio, cajero: caja.cajero_nombre } : null,
    categorias: categoriasActivas(),
    productos: productosActivos()
  });
});

/** Cuánto costaría una cantidad, sin registrar nada. */
router.get('/precio', vender, (req, res) => {
  const lista = listaActiva();
  if (!lista) return error(res, 'No hay ninguna lista de precios activa.', 409);

  const cantidad = Number(req.query.dieciseisavos);
  if (!Number.isInteger(cantidad) || cantidad <= 0) return error(res, 'Cantidad inválida.');

  return ok(res, { ...precioDe(cantidad, lista.id), cantidad, texto: aTexto(cantidad) });
});

// ============================================================
// COBRAR
// ============================================================

router.post('/', vender, (req, res) => {
  const lineas = req.body?.lineas;
  if (!Array.isArray(lineas) || !lineas.length) return error(res, 'La venta está vacía.');
  if (lineas.length > 50) return error(res, 'Demasiadas líneas en una sola venta.');

  const lista = listaActiva();
  if (!lista) return error(res, 'No hay ninguna lista de precios activa.', 409);

  // Ojo: a SQLite hay que darle null, nunca undefined. Si la pantalla no
  // manda almacén, se cobra contra el cuarto frío que recibe la producción.
  const almacen = bd.prepare(
    'SELECT * FROM almacenes WHERE id = ? AND activo = 1'
  ).get(req.body?.almacenId ?? null) || bd.prepare(
    'SELECT * FROM almacenes WHERE activo = 1 AND recibe_produccion = 1 ORDER BY orden LIMIT 1'
  ).get();

  const preparadas = prepararLineas(lineas, lista);
  if (preparadas.error) return error(res, preparadas.error, preparadas.codigo || 400);

  // --- Pago ---
  let pago = null;
  if (req.body?.pago !== undefined && req.body.pago !== null && req.body.pago !== '') {
    try { pago = aCentavos(req.body.pago); } catch { return error(res, 'El pago no es un importe válido.'); }
    if (pago < preparadas.total) return error(res, 'El pago es menor que el total.');
  }

  const venta = crearVenta({
    lineas: preparadas.lineas,
    total: preparadas.total,
    pago,
    lista,
    almacenId: almacen?.id || null,
    cajeroId: req.body?.cajeroId || req.usuario.id,
    capturistaId: req.usuario.id,
    formaPago: req.body?.formaPago || 'efectivo',
    notas: req.body?.notas || null
  });

  bitacora.registrar({
    accion: 'venta.registrada', entidad: 'venta', entidadId: venta.id,
    ejecutorId: req.body?.cajeroId || req.usuario.id, capturistaId: req.usuario.id,
    detalle: { folio: venta.folio, total: preparadas.total,
               lineas: preparadas.lineas.length, cajaFolio: venta.cajaFolio }
  });

  return ok(res, { venta: detalleVenta(venta.id) }, 201);
});

/**
 * Cotiza todas las líneas de una venta.
 *
 * EL PRECIO SE CALCULA AQUÍ, en el servidor, no se cree lo que mande la
 * pantalla. Devuelve { lineas, total } o { error } — nunca a medias.
 */
function prepararLineas(lineas, lista) {
  const preparadas = [];
  let total = 0;

  for (const l of lineas) {
    // Una línea puede venir de un botón del catálogo (productoId o código)
    // o de la calculadora de fracciones (solo dieciseisavos).
    const producto = l.productoId ? productoPorId(l.productoId)
                   : l.codigo     ? productoPorCodigo(l.codigo)
                   : null;

    if ((l.productoId || l.codigo) && !producto) {
      return { error: 'Ese producto ya no existe o se dio de baja.', codigo: 409 };
    }

    const cantidad = Number(l.cantidad ?? 1);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 500) {
      return { error: 'La cantidad de una línea no es válida.' };
    }

    let sueltos = 0;
    if (!producto) {
      sueltos = Number(l.dieciseisavos);
      try { validar(sueltos); } catch { return { error: 'Cantidad inválida en una línea.' }; }
      if (sueltos <= 0) return { error: 'Cantidad fuera de rango.' };
    }

    const c = cotizar({ producto, dieciseisavos: sueltos, listaId: lista.id, cantidad });

    if (c.dieciseisavos > MAX_DIECISEISAVOS) return { error: 'Cantidad fuera de rango.' };
    if (c.faltan.length) {
      return {
        error: `Falta poner precio a ${c.faltan.map(aTexto).join(', ')} en la lista ${lista.nombre}.`,
        codigo: 409
      };
    }

    preparadas.push({
      productoId: producto?.id || null,
      concepto: String(c.concepto).slice(0, 40),
      dieciseisavos: c.dieciseisavos,
      // Cuántas piezas: el inventario descuenta por esto, no por renglones.
      cantidad,
      centavos: c.centavos,
      desglose: c.desglose
    });
    total += c.centavos;
  }

  return { lineas: preparadas, total };
}

/**
 * Guarda la venta y sus líneas. El folio se toma DENTRO de la transacción
 * para que dos cajas cobrando al mismo tiempo no saquen el mismo número.
 */
function crearVenta({ lineas, total, pago, lista, almacenId, cajeroId, capturistaId,
                      formaPago = 'efectivo', notas = null, cambioDe = null }) {
  const id = nuevoId();
  const fecha = ahora();
  const cambio = pago === null || pago === undefined ? null : pago - total;

  // La venta queda amarrada al turno de caja abierto en este momento. Si no
  // hay turno abierto se cobra igual, pero queda fuera de todo corte.
  const turno = sesionAbierta();

  const guardar = bd.transaction(() => {
    const folio = bd.prepare('SELECT COALESCE(MAX(folio), 0) n FROM ventas').get().n + 1;

    bd.prepare(`
      INSERT INTO ventas (id, folio, fecha, cajero_id, capturista_id, almacen_id,
                          lista_id, lista_nombre, total_centavos, pago_centavos,
                          cambio_centavos, forma_pago, notas, caja_id, cambio_de_venta_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, folio, fecha, cajeroId, capturistaId, almacenId,
           lista.id, lista.nombre, total, pago ?? null, cambio,
           formaPago, notas, turno?.id || null, cambioDe);

    const insertar = bd.prepare(`
      INSERT INTO venta_lineas
        (id, venta_id, concepto, dieciseisavos, precio_centavos, desglose,
         producto_id, cantidad)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const l of lineas) {
      insertar.run(nuevoId(), id, l.concepto, l.dieciseisavos, l.centavos,
                   l.desglose, l.productoId, l.cantidad ?? 1);
    }
    return folio;
  });

  const folio = guardar();
  return { id, folio, cajaId: turno?.id || null, cajaFolio: turno?.folio || null };
}

function detalleVenta(id) {
  const venta = bd.prepare(`
    SELECT v.*, u.nombre AS cajero_nombre, a.nombre AS almacen_nombre,
           c.nombre AS cancelada_por_nombre
      FROM ventas v
      LEFT JOIN usuarios u  ON u.id = v.cajero_id
      LEFT JOIN almacenes a ON a.id = v.almacen_id
      LEFT JOIN usuarios c  ON c.id = v.cancelada_por
     WHERE v.id = ?
  `).get(id);
  if (!venta) return null;

  venta.lineas = bd.prepare('SELECT * FROM venta_lineas WHERE venta_id = ?').all(id)
    .map((l) => ({ ...l, texto: aTexto(l.dieciseisavos) }));
  return venta;
}

// ============================================================
// CONSULTA Y CANCELACIÓN
// ============================================================

/** Buscador rápido: por folio, monto u hora. Abre con las últimas 20 (7.3). */
router.get('/', verVentas, (req, res) => {
  const limite = Math.min(Number(req.query.limite) || 20, 200);
  const busca = String(req.query.busca || '').trim();

  let filas;
  if (busca) {
    const comoNumero = Number(busca.replace(/[^0-9.]/g, ''));
    filas = bd.prepare(`
      SELECT v.*, u.nombre AS cajero_nombre FROM ventas v
        LEFT JOIN usuarios u ON u.id = v.cajero_id
       WHERE v.folio = ?
          OR v.total_centavos = ?
          OR v.fecha LIKE ?
       ORDER BY v.fecha DESC LIMIT ?
    `).all(Math.trunc(comoNumero) || -1, Math.round(comoNumero * 100) || -1, `%${busca}%`, limite);
  } else {
    filas = bd.prepare(`
      SELECT v.*, u.nombre AS cajero_nombre FROM ventas v
        LEFT JOIN usuarios u ON u.id = v.cajero_id
       ORDER BY v.fecha DESC LIMIT ?
    `).all(limite);
  }

  return ok(res, { ventas: filas });
});

router.get('/:id', verVentas, (req, res) => {
  const venta = detalleVenta(req.params.id);
  if (!venta) return error(res, 'Esa venta no existe.', 404);
  return ok(res, { venta });
});

/**
 * Cancelar una venta. NUNCA se edita ni se borra (7.4): se marca cancelada
 * con su motivo y su responsable, y el ticket original sigue existiendo.
 */
router.post('/:id/cancelar', exigirPermiso('venta.cancelar'), (req, res) => {
  const v = bd.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.id);
  if (!v) return error(res, 'Esa venta no existe.', 404);
  if (v.cancelada_en) return error(res, 'Esa venta ya está cancelada.');

  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) return error(res, 'Escribe por qué se cancela.');

  bd.prepare('UPDATE ventas SET cancelada_en = ?, cancelada_por = ?, motivo_cancelacion = ? WHERE id = ?')
    .run(ahora(), req.usuario.id, motivo, v.id);

  bitacora.registrar({
    accion: 'venta.cancelada', entidad: 'venta', entidadId: v.id,
    ejecutorId: req.usuario.id, detalle: { folio: v.folio, total: v.total_centavos, motivo }
  });

  return ok(res, { cancelada: true });
});

// ============================================================
// CAMBIOS DE TICKET
// ============================================================

/**
 * CAMBIAR UN TICKET.
 *
 * El caso clásico del mostrador: "pedí 1/2 pero no sabía que era tanto,
 * quería 1/8". El cliente devuelve el ticket y se le hace el cambio.
 *
 * Cómo se registra: el ticket viejo se CANCELA y se hace uno nuevo, y los
 * dos quedan amarrados. No se inventa un tipo de venta aparte, y no es por
 * pereza: un cambio son dos hechos que el sistema ya sabía registrar, y al
 * hacerlo así el hielo vuelve solo al cuarto frío y la caja cuadra sola,
 * sin ninguna cuenta especial que se pueda desincronizar.
 *
 * LA CAJA. Si el ticket viejo es de ESTE turno, la cuenta sale sola:
 * cancelarlo le quita su importe a lo cobrado y la venta nueva le suma el
 * suyo, así que lo esperado en el cajón cambia exactamente en la
 * diferencia, que es lo que se cobró o se devolvió de verdad.
 *
 * Si el ticket viejo es de un turno YA CERRADO, ese dinero entró otro día y
 * cancelarlo hoy no le quita nada a la caja de hoy. Pero hoy sí sale (o
 * entra) la diferencia. Para que el arqueo no salga corto, se anota un
 * movimiento por el importe del ticket viejo: es lo que el cliente "pagó"
 * con papel en vez de con billetes.
 */
router.post('/:id/cambiar', vender, (req, res) => {
  const vieja = bd.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.id);
  if (!vieja) return error(res, 'Ese ticket no existe.', 404);
  // El que ya se cambió también está cancelado, así que este aviso va
  // primero: dice más que "está cancelado".
  if (vieja.cambiada_por_venta_id) {
    const reemplazo = bd.prepare('SELECT folio FROM ventas WHERE id = ?')
      .get(vieja.cambiada_por_venta_id);
    return error(res,
      `El ticket #${vieja.folio} ya se cambió por el #${reemplazo?.folio ?? '?'}.`, 409);
  }
  if (vieja.cancelada_en) return error(res, `El ticket #${vieja.folio} ya está cancelado.`, 409);

  const lineas = req.body?.lineas;
  if (!Array.isArray(lineas) || !lineas.length) {
    return error(res, 'Elige por qué se cambia.');
  }
  if (lineas.length > 50) return error(res, 'Demasiadas líneas en un solo ticket.');

  const lista = listaActiva();
  if (!lista) return error(res, 'No hay ninguna lista de precios activa.', 409);

  const preparadas = prepararLineas(lineas, lista);
  if (preparadas.error) return error(res, preparadas.error, preparadas.codigo || 400);

  const aFavor = vieja.total_centavos;
  const diferencia = preparadas.total - aFavor;   // + cobra, − devuelve

  // Si se lleva más, tiene que pagar la diferencia.
  let pago = null;
  if (diferencia > 0 && req.body?.pago !== undefined && req.body.pago !== null
      && req.body.pago !== '') {
    try { pago = aCentavos(req.body.pago); }
    catch { return error(res, 'El pago no es un importe válido.'); }
    if (pago < diferencia) {
      return error(res, `Faltan ${formato(diferencia - pago)} para completar el cambio.`);
    }
  }

  const turno = sesionAbierta();
  const mismoTurno = Boolean(turno && vieja.caja_id === turno.id);
  const fecha = ahora();

  let nueva;
  const hacer = bd.transaction(() => {
    bd.prepare(`
      UPDATE ventas SET cancelada_en = ?, cancelada_por = ?, motivo_cancelacion = ?
       WHERE id = ?
    `).run(fecha, req.usuario.id,
           String(req.body?.motivo || 'Cambio de ticket').slice(0, 200), vieja.id);

    // La venta nueva se cobra COMPLETA: lo que el cliente entrega en
    // billetes es solo la diferencia, pero el ticket vale lo que vale.
    nueva = crearVenta({
      lineas: preparadas.lineas,
      total: preparadas.total,
      // El pago se guarda en total para que el ticket cuadre solo; el
      // cambio a devolver se calcula sobre el total, no sobre la diferencia.
      pago: preparadas.total,
      lista,
      almacenId: vieja.almacen_id,
      cajeroId: req.usuario.id,
      capturistaId: req.usuario.id,
      notas: `Cambio del ticket #${vieja.folio}`,
      cambioDe: vieja.id
    });

    bd.prepare('UPDATE ventas SET cambiada_por_venta_id = ? WHERE id = ?')
      .run(nueva.id, vieja.id);

    // Turno cerrado: el dinero del ticket viejo no está en este cajón, así
    // que se anota para que el arqueo de hoy no salga corto.
    if (!mismoTurno && turno) {
      bd.prepare(`
        INSERT INTO movimientos_caja
          (id, caja_id, fecha, tipo, concepto, centavos, ejecutor_id, capturista_id, notas)
        VALUES (?, ?, ?, 'salida', ?, ?, ?, ?, ?)
      `).run(nuevoId(), turno.id, fecha,
             `Cambio del ticket #${vieja.folio}`, aFavor,
             req.usuario.id, req.usuario.id,
             'El cliente pago con un ticket de otro turno, no con efectivo');
    }
  });
  hacer();

  bitacora.registrar({
    accion: 'venta.cambiada', entidad: 'venta', entidadId: vieja.id,
    ejecutorId: req.usuario.id,
    detalle: {
      folioViejo: vieja.folio, folioNuevo: nueva.folio,
      aFavor, nuevoTotal: preparadas.total, diferencia, mismoTurno
    }
  });

  return ok(res, {
    venta: detalleVenta(nueva.id),
    anterior: detalleVenta(vieja.id),
    aFavor,
    diferencia,
    // Positivo: el cliente paga. Negativo: se le devuelve.
    porCobrar: diferencia > 0 ? diferencia : 0,
    porDevolver: diferencia < 0 ? -diferencia : 0
  }, 201);
});

// ============================================================
// LISTAS DE PRECIOS — solo admin
// ============================================================

router.get('/precios/listas', verVentas, (req, res) => {
  const listas = bd.prepare('SELECT * FROM listas_precios WHERE activo = 1 ORDER BY tipo, nombre').all()
    .map((l) => ({
      ...l,
      precios: [...preciosDe(l.id).entries()]
        .map(([dieciseisavos, centavos]) => ({ dieciseisavos, centavos, etiqueta: aTexto(dieciseisavos) }))
        .sort((a, b) => b.dieciseisavos - a.dieciseisavos)
    }));
  return ok(res, { listas });
});

router.put('/precios/:listaId', configurarPrecios, (req, res) => {
  const lista = bd.prepare('SELECT * FROM listas_precios WHERE id = ?').get(req.params.listaId);
  if (!lista) return error(res, 'Esa lista no existe.', 404);

  const cambios = req.body?.precios;
  if (!Array.isArray(cambios) || !cambios.length) return error(res, 'No mandaste ningún precio.');

  const validos = [16, 8, 4, 2, 1];
  for (const c of cambios) {
    if (!validos.includes(Number(c.dieciseisavos))) {
      return error(res, `Fracción desconocida: ${c.dieciseisavos}.`);
    }
    const n = Number(c.pesos);
    if (!Number.isFinite(n) || n < 0 || n > 100000) {
      return error(res, `Precio inválido para ${aTexto(c.dieciseisavos)}.`);
    }
  }

  const guardar = bd.transaction(() => {
    const sql = bd.prepare(`
      INSERT INTO precios (id, lista_id, dieciseisavos, centavos, actualizado_en, actualizado_por)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(lista_id, dieciseisavos) DO UPDATE SET
        centavos = excluded.centavos,
        actualizado_en = excluded.actualizado_en,
        actualizado_por = excluded.actualizado_por
    `);
    for (const c of cambios) {
      sql.run(nuevoId(), lista.id, Number(c.dieciseisavos), aCentavos(c.pesos), ahora(), req.usuario.id);
    }
  });
  guardar();

  bitacora.registrar({
    accion: 'precios.cambio', entidad: 'lista_precios', entidadId: lista.id,
    ejecutorId: req.usuario.id, detalle: { lista: lista.nombre, cambios }
  });

  return ok(res, { lista: lista.nombre, precios: [...preciosDe(lista.id).entries()] });
});

/** El precio proporcional que sugiere el sistema, para comparar (7.2). */
router.get('/precios/sugerencia', configurarPrecios, (req, res) => {
  const marqueta = Number(req.query.marqueta);
  if (!Number.isFinite(marqueta) || marqueta <= 0) return error(res, 'Precio de marqueta inválido.');

  const centavosMarqueta = aCentavos(marqueta);
  return ok(res, {
    sugerencias: [8, 4, 2, 1].map((d) => ({
      dieciseisavos: d,
      etiqueta: aTexto(d),
      centavos: sugerencia(centavosMarqueta, d)
    }))
  });
});

module.exports = router;
