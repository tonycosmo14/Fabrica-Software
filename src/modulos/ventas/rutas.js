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
const { aCentavos } = require('../../lib/dinero');
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

  // --- Se calcula el precio EN EL SERVIDOR, nunca se confía en la pantalla ---
  const preparadas = [];
  let total = 0;

  for (const l of lineas) {
    // Una línea puede venir de un botón del catálogo (productoId o código)
    // o de la calculadora de fracciones (solo dieciseisavos).
    const producto = l.productoId ? productoPorId(l.productoId)
                   : l.codigo     ? productoPorCodigo(l.codigo)
                   : null;

    if ((l.productoId || l.codigo) && !producto) {
      return error(res, 'Ese producto ya no existe o se dio de baja.', 409);
    }

    const cantidad = Number(l.cantidad ?? 1);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 500) {
      return error(res, 'La cantidad de una línea no es válida.');
    }

    let sueltos = 0;
    if (!producto) {
      sueltos = Number(l.dieciseisavos);
      try { validar(sueltos); } catch { return error(res, 'Cantidad inválida en una línea.'); }
      if (sueltos <= 0) return error(res, 'Cantidad fuera de rango.');
    }

    const c = cotizar({ producto, dieciseisavos: sueltos, listaId: lista.id, cantidad });

    if (c.dieciseisavos > MAX_DIECISEISAVOS) return error(res, 'Cantidad fuera de rango.');
    if (c.faltan.length) {
      return error(res,
        `Falta poner precio a ${c.faltan.map(aTexto).join(', ')} en la lista ${lista.nombre}.`, 409);
    }

    preparadas.push({
      productoId: producto?.id || null,
      concepto: String(c.concepto).slice(0, 40),
      dieciseisavos: c.dieciseisavos,
      centavos: c.centavos,
      desglose: c.desglose
    });
    total += c.centavos;
  }

  // --- Pago ---
  let pago = null;
  let cambio = null;
  if (req.body?.pago !== undefined && req.body.pago !== null && req.body.pago !== '') {
    try { pago = aCentavos(req.body.pago); } catch { return error(res, 'El pago no es un importe válido.'); }
    if (pago < total) return error(res, 'El pago es menor que el total.');
    cambio = pago - total;
  }

  const id = nuevoId();
  const fecha = ahora();

  // La venta queda amarrada al turno de caja abierto en este momento. Si no
  // hay turno abierto se cobra igual, pero queda fuera de todo corte.
  const turno = sesionAbierta();

  // El folio se toma dentro de la transacción para que dos cajas al mismo
  // tiempo no puedan sacar el mismo número.
  const guardar = bd.transaction(() => {
    const folio = bd.prepare('SELECT COALESCE(MAX(folio), 0) n FROM ventas').get().n + 1;

    bd.prepare(`
      INSERT INTO ventas (id, folio, fecha, cajero_id, capturista_id, almacen_id,
                          lista_id, lista_nombre, total_centavos, pago_centavos,
                          cambio_centavos, forma_pago, notas, caja_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, folio, fecha, req.body?.cajeroId || req.usuario.id, req.usuario.id,
           almacen?.id || null, lista.id, lista.nombre, total, pago, cambio,
           req.body?.formaPago || 'efectivo', req.body?.notas || null,
           turno?.id || null);

    const insertar = bd.prepare(`
      INSERT INTO venta_lineas
        (id, venta_id, concepto, dieciseisavos, precio_centavos, desglose, producto_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const l of preparadas) {
      insertar.run(nuevoId(), id, l.concepto, l.dieciseisavos, l.centavos,
                   l.desglose, l.productoId);
    }
    return folio;
  });

  const folio = guardar();

  bitacora.registrar({
    accion: 'venta.registrada', entidad: 'venta', entidadId: id,
    ejecutorId: req.body?.cajeroId || req.usuario.id, capturistaId: req.usuario.id,
    detalle: { folio, total, lineas: preparadas.length, cajaFolio: turno?.folio || null }
  });

  return ok(res, { venta: detalleVenta(id) }, 201);
});

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
