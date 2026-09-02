/**
 * LA EXISTENCIA  (v0.7)
 *
 * A las 3 y a las 8 alguien cuenta las marquetas que quedan en el cuarto
 * frío. El sistema compara ese número con lo que debería haber:
 *
 *     existencia anterior + producido − contado = SALIDAS
 *
 * Desde la v0.8 esas salidas se parten en dos: lo que la caja explicó con
 * tickets, y el FALTANTE, que es lo que se derritió, lo que se cayó y lo
 * que se fue sin pagar.
 *
 * El conteo se captura en marquetas Y FRACCIONES, porque así lo dictan en
 * la fábrica: "quedan 14 marquetas y 5/8".
 */
const express = require('express');
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');
const { ok, error } = require('../../lib/respuestas');
const bitacora = require('../../lib/bitacora');
const { exigirPermiso } = require('../../middleware/sesion');
const { estadoAlmacen, ultimoConteo, mermasDesde, cortesDesde } = require('./calculo');
const { aTexto, DIECISEISAVOS_POR_MARQUETA } = require('../../lib/fracciones');

const router = express.Router();

const verExistencia = exigirPermiso('existencia.ver');
const contar = exigirPermiso('existencia.contar');
const configurar = exigirPermiso('sistema.configurar');

const MAX_DIECISEISAVOS = 100000 * DIECISEISAVOS_POR_MARQUETA;

/**
 * EL PRODUCTO AL QUE LE ENTRAN LAS BOLSAS  (v4.1)
 *
 * Cortar marquetas para hielo gourmet no es una pérdida: es una
 * TRANSFORMACIÓN. Sale del cuarto frío y entra al inventario como bolsas,
 * y desde ahí se vende como cualquier otra cosa. La bolsa viene sembrada
 * con la migración 032; si alguien la borró, el corte se sigue anotando
 * —el hielo salió igual— pero sin sumarle bolsas a nadie.
 */
const BOLSA_POR_OMISION = 'prod-bolsa-gourmet';

function productoDeBolsas(idPedido) {
  const id = idPedido || BOLSA_POR_OMISION;
  // Sin filtrar por `activo`: la bolsa nace dada de baja y se da de alta
  // sola con el primer corte que le meta bolsas (ver más abajo).
  return bd.prepare(
    "SELECT * FROM productos WHERE id = ? AND tipo = 'simple' AND lleva_inventario = 1"
  ).get(id) || null;
}

/** Un turno de caja al que colgar esto, si viene y existe. */
function cajaDe(id) {
  if (!id) return null;
  return bd.prepare('SELECT id FROM cajas WHERE id = ?').get(id)?.id || null;
}

/**
 * Lee la cantidad que mandó la pantalla.
 *
 * Se acepta en dieciseisavos (que es como los manda el teclado) y también
 * en marquetas enteras, que es como lo mandaban las pantallas viejas.
 * Devuelve null si no se entiende: nunca adivina un número de existencia.
 */
function leerCantidad(cuerpo) {
  if (cuerpo?.dieciseisavos !== undefined && cuerpo.dieciseisavos !== null) {
    const n = Number(cuerpo.dieciseisavos);
    return Number.isInteger(n) && n >= 0 && n <= MAX_DIECISEISAVOS ? n : null;
  }
  if (cuerpo?.marquetas !== undefined && cuerpo.marquetas !== null) {
    const n = Number(cuerpo.marquetas);
    if (!Number.isInteger(n) || n < 0) return null;
    const total = n * DIECISEISAVOS_POR_MARQUETA;
    return total <= MAX_DIECISEISAVOS ? total : null;
  }
  return null;
}

function almacenesActivos() {
  return bd.prepare('SELECT * FROM almacenes WHERE activo = 1 ORDER BY orden, nombre').all();
}

/** Las horas del día en las que toca contar, tal como están configuradas. */
function horariosConteo() {
  const valor = bd.prepare("SELECT valor FROM configuracion WHERE clave = 'conteo_horarios'")
    .get()?.valor || '';
  return valor.split(',').map((h) => h.trim()).filter(Boolean);
}

/**
 * ¿Toca contar? Se compara la hora de ahora con los horarios configurados
 * y con la hora del último conteo del día.
 */
function pendienteDeConteo(almacen) {
  const horarios = horariosConteo();
  if (!horarios.length) return null;

  const ahoraFecha = new Date();
  const hoy = ahoraFecha.toISOString().slice(0, 10);
  const minutosAhora = ahoraFecha.getHours() * 60 + ahoraFecha.getMinutes();

  const ultimo = ultimoConteo(almacen.id);
  const minutosUltimo = ultimo && ultimo.fecha.slice(0, 10) === hoy
    ? (() => { const d = new Date(ultimo.fecha); return d.getHours() * 60 + d.getMinutes(); })()
    : -1;

  // El horario más reciente que ya pasó y que todavía no se ha cubierto.
  let pendiente = null;
  for (const h of horarios) {
    const [hh, mm] = h.split(':').map(Number);
    const minutos = hh * 60 + (mm || 0);
    if (minutos <= minutosAhora && minutos > minutosUltimo) pendiente = h;
  }
  return pendiente;
}

// ============================================================
// ESTADO
// ============================================================

router.get('/', verExistencia, (req, res) => {
  const almacenes = almacenesActivos().map((a) => {
    const estado = estadoAlmacen(a);
    return {
      ...estado,
      pendiente: pendienteDeConteo(a),
      // El mismo número escrito como lo dice la gente: "14 5/8"
      textos: {
        anterior: aTexto(estado.existenciaAnterior),
        producido: aTexto(estado.producido),
        teorico: aTexto(estado.teorico),
        vendido: aTexto(estado.vendido),
        vendidoPublico: aTexto(estado.vendidoPublico),
        vendidoMayoreo: aTexto(estado.vendidoMayoreo),
        merma: aTexto(estado.merma),
        cortado: aTexto(estado.cortado),
        esperado: aTexto(estado.esperado)
      }
    };
  });

  return ok(res, { almacenes, horarios: horariosConteo() });
});

/**
 * LO QUE SE DERRITIÓ, SE ROMPIÓ O SE REGALÓ.
 *
 * Se anota igual que un gasto del cajón: quién lo vio, quién lo capturó y
 * cuándo (regla 3.6). Y como todo lo demás, nada se borra: un renglón mal
 * capturado se anula y queda tachado con su motivo (regla 3.4).
 */
const MOTIVOS_MERMA = ['derretida', 'rota', 'regalada', 'autoconsumo', 'otro'];

router.get('/mermas', verExistencia, (req, res) => {
  const almacen = bd.prepare('SELECT * FROM almacenes WHERE id = ?').get(req.query.almacenId ?? null)
    || almacenesActivos()[0];
  if (!almacen) return error(res, 'No hay ningún cuarto frío dado de alta.', 404);

  const ultimo = ultimoConteo(almacen.id);
  return ok(res, {
    almacen: { id: almacen.id, nombre: almacen.nombre },
    motivos: MOTIVOS_MERMA,
    mermas: mermasDesde(ultimo?.fecha || null, almacen.id).map((m) => ({
      ...m, texto: aTexto(m.dieciseisavos)
    }))
  });
});

router.post('/mermas', contar, (req, res) => {
  const almacen = bd.prepare('SELECT * FROM almacenes WHERE id = ? AND activo = 1')
    .get(req.body?.almacenId ?? null) || almacenesActivos()[0];
  if (!almacen) return error(res, 'No hay ningún cuarto frío dado de alta.', 404);

  const cantidad = Number(req.body?.dieciseisavos);
  if (!Number.isInteger(cantidad) || cantidad <= 0 || cantidad > MAX_DIECISEISAVOS) {
    return error(res, 'Escribe cuánto hielo se perdió.');
  }

  const motivo = String(req.body?.motivo || '').trim();
  if (!MOTIVOS_MERMA.includes(motivo)) return error(res, 'Ese motivo no existe.');

  const id = nuevoId();
  bd.prepare(`
    INSERT INTO mermas_hielo (id, fecha, almacen_id, dieciseisavos, motivo, notas,
                              ejecutor_id, capturista_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, ahora(), almacen.id, cantidad, motivo,
         String(req.body?.notas || '').trim().slice(0, 200) || null,
         req.body?.ejecutorId || req.usuario.id, req.usuario.id);

  bitacora.registrar({
    accion: 'existencia.merma', entidad: 'merma', entidadId: id,
    ejecutorId: req.body?.ejecutorId || req.usuario.id, capturistaId: req.usuario.id,
    detalle: { almacen: almacen.nombre, dieciseisavos: cantidad, texto: aTexto(cantidad), motivo }
  });

  return ok(res, { merma: bd.prepare('SELECT * FROM mermas_hielo WHERE id = ?').get(id) }, 201);
});

router.post('/mermas/:id/anular', exigirPermiso('existencia.corregir'), (req, res) => {
  const m = bd.prepare('SELECT * FROM mermas_hielo WHERE id = ?').get(req.params.id);
  if (!m) return error(res, 'Esa merma no existe.', 404);
  if (m.anulada_en) return error(res, 'Esa merma ya está anulada.');

  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) return error(res, 'Escribe por qué se anula.');

  bd.prepare(`
    UPDATE mermas_hielo SET anulada_en = ?, anulada_por = ?, motivo_anulacion = ? WHERE id = ?
  `).run(ahora(), req.usuario.id, motivo, m.id);

  bitacora.registrar({
    accion: 'existencia.merma-anulada', entidad: 'merma', entidadId: m.id,
    ejecutorId: req.usuario.id, detalle: { dieciseisavos: m.dieciseisavos, motivo }
  });

  return ok(res, { anulada: true });
});

/**
 * EL HIELO QUE SE CORTÓ para volverlo gourmet.
 *
 * Sale del cuarto frío igual que una venta, pero no pasa por la caja ni se
 * derritió: dejó de ser marqueta. Se anota aparte para que el FALTANTE —el
 * número que de verdad hay que vigilar— siga significando lo que significa.
 */
router.get('/cortes', verExistencia, (req, res) => {
  const almacen = bd.prepare('SELECT * FROM almacenes WHERE id = ?').get(req.query.almacenId ?? null)
    || almacenesActivos()[0];
  if (!almacen) return ok(res, { cortes: [] });

  const ultimo = ultimoConteo(almacen.id);
  return ok(res, {
    almacen,
    cortes: cortesDesde(ultimo?.fecha || null, almacen.id).map((c) => ({
      ...c, texto: aTexto(c.dieciseisavos)
    }))
  });
});

router.post('/cortes', contar, (req, res) => {
  const almacen = bd.prepare('SELECT * FROM almacenes WHERE id = ? AND activo = 1')
    .get(req.body?.almacenId ?? null) || almacenesActivos()[0];
  if (!almacen) return error(res, 'No hay ningún cuarto frío dado de alta.', 404);

  const cantidad = Number(req.body?.dieciseisavos);
  if (!Number.isInteger(cantidad) || cantidad <= 0 || cantidad > MAX_DIECISEISAVOS) {
    return error(res, 'Escribe cuánto hielo se cortó.');
  }

  // Las bolsas son opcionales: si nadie las contó, se deja vacío en vez de
  // guardar un cero que después parecería un dato.
  let bolsas = null;
  if (req.body?.bolsas !== undefined && req.body?.bolsas !== null && req.body?.bolsas !== '') {
    bolsas = Number(req.body.bolsas);
    if (!Number.isInteger(bolsas) || bolsas < 0 || bolsas > 1000000) {
      return error(res, 'Las bolsas se escriben en números enteros.');
    }
  }

  const ejecutorId = req.body?.ejecutorId || req.usuario.id;
  const id = nuevoId();
  const fecha = ahora();
  const cajaId = cajaDe(req.body?.cajaId);

  // LAS BOLSAS ENTRAN AL INVENTARIO  (v4.1)
  //
  // Cortar marquetas no es perder hielo: es transformarlo. Sale del cuarto
  // frío y entra como bolsas, y desde ahí se vende como cualquier otra
  // cosa — con la misma cuenta de siempre, que no guarda ningún "cuántas
  // hay" (regla 3.2). Sin bolsas contadas no se mueve nada: un cero que
  // nadie contó parecería un dato dentro de un año.
  const producto = bolsas ? productoDeBolsas(req.body?.productoId) : null;
  const movimientoId = producto && bolsas > 0 ? nuevoId() : null;

  bd.transaction(() => {
    if (movimientoId) {
      bd.prepare(`
        INSERT INTO movimientos_inventario
          (id, producto_id, fecha, tipo, cantidad, concepto, ejecutor_id, capturista_id)
        VALUES (?, ?, ?, 'entrada', ?, ?, ?, ?)
      `).run(movimientoId, producto.id, fecha, bolsas,
             `Cortadas de ${aTexto(cantidad)} del cuarto frío`,
             ejecutorId, req.usuario.id);

      // LA BOLSA SE DA DE ALTA SOLA con el primer corte. Nace de baja
      // porque un producto en cero sale como AGOTADO en la caja, y una
      // fábrica que todavía no corta hielo tendría ese aviso puesto para
      // siempre. En cuanto hay bolsas de verdad, existe.
      if (!producto.activo) {
        bd.prepare('UPDATE productos SET activo = 1, fecha_baja = NULL WHERE id = ?')
          .run(producto.id);
      }
    }
    bd.prepare(`
      INSERT INTO cortes_hielo (id, fecha, almacen_id, dieciseisavos, bolsas, notas,
                                ejecutor_id, capturista_id, caja_id,
                                producto_id, movimiento_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, fecha, almacen.id, cantidad, bolsas,
           String(req.body?.notas || '').trim().slice(0, 200) || null,
           ejecutorId, req.usuario.id, cajaId,
           producto?.id || null, movimientoId);
  })();

  bitacora.registrar({
    accion: 'existencia.corte', entidad: 'corte', entidadId: id,
    ejecutorId, capturistaId: req.usuario.id,
    detalle: { almacen: almacen.nombre, dieciseisavos: cantidad,
               texto: aTexto(cantidad), bolsas,
               producto: producto?.nombre || null, cajaId }
  });

  return ok(res, {
    corte: bd.prepare('SELECT * FROM cortes_hielo WHERE id = ?').get(id),
    // La pantalla avisa si la bolsa todavía no tiene precio: sin él no se
    // puede vender, y es lo primero que hay que arreglar.
    producto: producto ? { id: producto.id, nombre: producto.nombre,
                           sinPrecio: !producto.precio_centavos,
                           recienActivado: Boolean(movimientoId) && !producto.activo } : null
  }, 201);
});

router.post('/cortes/:id/anular', exigirPermiso('existencia.corregir'), (req, res) => {
  const c = bd.prepare('SELECT * FROM cortes_hielo WHERE id = ?').get(req.params.id);
  if (!c) return error(res, 'Ese corte no existe.', 404);
  if (c.anulado_en) return error(res, 'Ese corte ya está anulado.');

  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) return error(res, 'Escribe por qué se anula.');

  const fecha = ahora();
  bd.transaction(() => {
    bd.prepare(`
      UPDATE cortes_hielo SET anulado_en = ?, anulado_por = ?, motivo_anulacion = ? WHERE id = ?
    `).run(fecha, req.usuario.id, motivo, c.id);

    // Y las bolsas que le entraron al inventario se anulan con él: si no,
    // el hielo volvería al cuarto frío y las bolsas se quedarían, que es
    // tener el mismo hielo contado dos veces.
    if (c.movimiento_id) {
      bd.prepare(`
        UPDATE movimientos_inventario
           SET anulado_en = ?, anulado_por = ?, motivo_anulacion = ?
         WHERE id = ? AND anulado_en IS NULL
      `).run(fecha, req.usuario.id, `Se anuló el corte de hielo: ${motivo}`, c.movimiento_id);
    }
  })();

  bitacora.registrar({
    accion: 'existencia.corte-anulado', entidad: 'corte', entidadId: c.id,
    ejecutorId: req.usuario.id,
    detalle: { dieciseisavos: c.dieciseisavos, motivo, bolsas: c.bolsas }
  });

  return ok(res, { anulado: true });
});

/** Historial de conteos de un almacén. */
router.get('/conteos', verExistencia, (req, res) => {
  const limite = Math.min(Number(req.query.limite) || 30, 200);
  const almacenId = req.query.almacen;

  const filas = bd.prepare(`
    SELECT c.*, a.nombre AS almacen, u.nombre AS ejecutor_nombre,
           v.nombre AS anulado_por_nombre
      FROM conteos c
      JOIN almacenes a ON a.id = c.almacen_id
      LEFT JOIN usuarios u ON u.id = c.ejecutor_id
      LEFT JOIN usuarios v ON v.id = c.anulado_por
     ${almacenId ? 'WHERE c.almacen_id = ?' : ''}
     ORDER BY c.fecha DESC LIMIT ?
  `).all(...(almacenId ? [almacenId, limite] : [limite]));

  return ok(res, { conteos: filas });
});

// ============================================================
// HACER EL CONTEO
// ============================================================

router.post('/conteos', contar, (req, res) => {
  const almacen = bd.prepare('SELECT * FROM almacenes WHERE id = ? AND activo = 1')
    .get(req.body?.almacenId ?? null);
  if (!almacen) return error(res, 'Ese cuarto frío no existe.', 404);

  const contado = leerCantidad(req.body);
  if (contado === null) {
    return error(res, 'Escribe cuánto contaste. Puede llevar fracción: 14 y 5/8.');
  }

  // La foto de cómo estaba justo antes de contar: se guarda congelada, para
  // que corregir una sacada vieja no cambie un corte que ya se hizo.
  const estado = estadoAlmacen(almacen);
  const salidas = estado.teorico - contado;
  // El faltante es lo que NADIE explicó: ni la caja, ni lo que se derritió,
  // ni lo que se cortó para gourmet. Ese es el número que hay que vigilar.
  const faltante = salidas - estado.vendido - estado.merma - estado.cortado;

  const ejecutorId = req.body?.ejecutorId || req.usuario.id;
  const id = nuevoId();
  const fecha = ahora();

  bd.prepare(`
    INSERT INTO conteos (id, almacen_id, fecha, ejecutor_id, capturista_id, contado,
                         existencia_anterior, producido, vendido, merma, cortado,
                         salidas, desde, notas, caja_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, almacen.id, fecha, ejecutorId, req.usuario.id, contado,
         estado.existenciaAnterior, estado.producido, estado.vendido,
         estado.merma, estado.cortado, salidas,
         estado.desde, req.body?.notas || null, cajaDe(req.body?.cajaId));

  bitacora.registrar({
    accion: 'existencia.conteo', entidad: 'almacen', entidadId: almacen.id,
    ejecutorId, capturistaId: req.usuario.id,
    detalle: {
      almacen: almacen.nombre,
      contado: aTexto(contado),
      anterior: aTexto(estado.existenciaAnterior),
      producido: aTexto(estado.producido),
      vendido: aTexto(estado.vendido),
      merma: aTexto(estado.merma),
      cortado: aTexto(estado.cortado),
      salidas: aTexto(salidas),
      faltante: aTexto(faltante)
    }
  });

  return ok(res, {
    conteo: bd.prepare('SELECT * FROM conteos WHERE id = ?').get(id),
    resumen: {
      anterior: estado.existenciaAnterior,
      producido: estado.producido,
      teorico: estado.teorico,
      vendido: estado.vendido,
      merma: estado.merma,
      cortado: estado.cortado,
      esperado: estado.esperado,
      contado,
      salidas,
      faltante,
      primerConteo: !estado.ultimoConteo
    }
  }, 201);
});

/**
 * Anular un conteo mal capturado. No se borra: se marca.
 * Al anularlo, el conteo anterior vuelve a ser el bueno.
 */
router.post('/conteos/:id/anular', exigirPermiso('existencia.corregir'), (req, res) => {
  const c = bd.prepare('SELECT * FROM conteos WHERE id = ?').get(req.params.id);
  if (!c) return error(res, 'Ese conteo no existe.', 404);
  if (c.anulado_en) return error(res, 'Ese conteo ya está anulado.');

  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) return error(res, 'Escribe por qué se anula.');

  bd.prepare('UPDATE conteos SET anulado_en = ?, anulado_por = ?, motivo_anulacion = ? WHERE id = ?')
    .run(ahora(), req.usuario.id, motivo, c.id);

  bitacora.registrar({
    accion: 'existencia.anulacion', entidad: 'conteo', entidadId: c.id,
    ejecutorId: req.usuario.id, detalle: { motivo, contado: aTexto(c.contado) }
  });

  return ok(res, { anulado: true });
});

// ============================================================
// CUARTOS FRÍOS — solo el administrador
// ============================================================

router.get('/almacenes', verExistencia, (req, res) => {
  const incluirInactivos = req.query.incluirInactivos === '1';
  const filas = bd.prepare(`
    SELECT * FROM almacenes ${incluirInactivos ? '' : 'WHERE activo = 1'}
     ORDER BY activo DESC, orden, nombre
  `).all();
  return ok(res, { almacenes: filas, horarios: horariosConteo() });
});

router.post('/almacenes', configurar, (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  if (!nombre) return error(res, 'El cuarto frío necesita un nombre.');

  const id = nuevoId();
  const orden = bd.prepare('SELECT COALESCE(MAX(orden), 0) n FROM almacenes').get().n + 1;

  bd.prepare(`
    INSERT INTO almacenes (id, nombre, orden, recibe_produccion, notas, activo, fecha_alta, creado_por)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, nombre, orden, req.body?.recibeProduccion ? 1 : 0,
         req.body?.notas || null, ahora(), req.usuario.id);

  bitacora.registrar({
    accion: 'almacen.alta', entidad: 'almacen', entidadId: id,
    ejecutorId: req.usuario.id, detalle: { nombre }
  });

  return ok(res, { almacen: bd.prepare('SELECT * FROM almacenes WHERE id = ?').get(id) }, 201);
});

router.put('/almacenes/:id', configurar, (req, res) => {
  const a = bd.prepare('SELECT * FROM almacenes WHERE id = ?').get(req.params.id);
  if (!a) return error(res, 'Ese cuarto frío no existe.', 404);

  const nombre = req.body?.nombre !== undefined
    ? String(req.body.nombre).trim() : a.nombre;
  if (!nombre) return error(res, 'El nombre no puede quedar vacío.');

  const recibe = req.body?.recibeProduccion !== undefined
    ? (req.body.recibeProduccion ? 1 : 0) : a.recibe_produccion;

  // Alguien tiene que recibir el hielo de los tanques.
  if (!recibe && a.recibe_produccion) {
    const otros = bd.prepare(
      'SELECT COUNT(*) n FROM almacenes WHERE activo = 1 AND recibe_produccion = 1 AND id <> ?'
    ).get(a.id).n;
    if (otros === 0) {
      return error(res, 'Algún cuarto frío tiene que recibir la producción de los tanques.');
    }
  }

  bd.prepare('UPDATE almacenes SET nombre = ?, recibe_produccion = ?, notas = ? WHERE id = ?')
    .run(nombre, recibe, req.body?.notas !== undefined ? req.body.notas : a.notas, a.id);

  bitacora.registrar({
    accion: 'almacen.edicion', entidad: 'almacen', entidadId: a.id,
    ejecutorId: req.usuario.id, detalle: { nombre, recibeProduccion: Boolean(recibe) }
  });

  return ok(res, { almacen: bd.prepare('SELECT * FROM almacenes WHERE id = ?').get(a.id) });
});

router.post('/almacenes/:id/baja', configurar, (req, res) => {
  const a = bd.prepare('SELECT * FROM almacenes WHERE id = ?').get(req.params.id);
  if (!a) return error(res, 'Ese cuarto frío no existe.', 404);

  const activos = bd.prepare('SELECT COUNT(*) n FROM almacenes WHERE activo = 1').get().n;
  if (activos <= 1) return error(res, 'Es el único cuarto frío. No se puede dar de baja.');

  bd.prepare('UPDATE almacenes SET activo = 0, fecha_baja = ? WHERE id = ?').run(ahora(), a.id);
  bitacora.registrar({
    accion: 'almacen.baja', entidad: 'almacen', entidadId: a.id, ejecutorId: req.usuario.id
  });
  return ok(res, { dadoDeBaja: true });
});

/** Horarios en los que toca contar. */
router.put('/horarios', configurar, (req, res) => {
  const lista = Array.isArray(req.body?.horarios) ? req.body.horarios : [];
  const limpios = [];

  for (const h of lista) {
    const texto = String(h).trim();
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(texto)) {
      return error(res, `"${texto}" no es una hora válida. Se escriben así: 15:00`);
    }
    limpios.push(texto.padStart(5, '0'));
  }
  if (!limpios.length) return error(res, 'Pon al menos una hora de conteo.');

  bd.prepare(`
    INSERT INTO configuracion (clave, valor, actualizado_en, actualizado_por)
    VALUES ('conteo_horarios', ?, ?, ?)
    ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor,
      actualizado_en = excluded.actualizado_en, actualizado_por = excluded.actualizado_por
  `).run(limpios.sort().join(','), ahora(), req.usuario.id);

  bitacora.registrar({
    accion: 'existencia.horarios', entidad: 'configuracion',
    ejecutorId: req.usuario.id, detalle: { horarios: limpios }
  });

  return ok(res, { horarios: limpios });
});

module.exports = router;
