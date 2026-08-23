/**
 * PRODUCCIÓN  (v0.3)
 *
 * El trabajo diario en los tanques: sacar y rellenar canastas.
 *
 * Dos ideas que vienen del plan y no se negocian:
 *  - Sacar y rellenar son DOS eventos separados (6.3). Se pueden hacer
 *    seguidos, pero se registran aparte, porque cuando hay mucha demanda
 *    las canastas se sacan y se dejan a un lado para rellenar después.
 *  - Un tap en la canasta = todos los moldes salieron bien (6.6).
 *    Marcar molde por molde es la excepción, no el flujo normal.
 */
const express = require('express');
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');
const { ok, error } = require('../../lib/respuestas');
const bitacora = require('../../lib/bitacora');
const { exigirPermiso } = require('../../middleware/sesion');
const { tanqueConEstado, panoSugerido, canastasFuera, horasDesde, ESTADOS } = require('./estado');

const router = express.Router();

const verProduccion = exigirPermiso('produccion.ver');
const registrar = exigirPermiso('produccion.registrar');

const RESULTADOS = ['ok', 'merma', 'hueco'];
const TIPOS_AGUA = ['purificada', 'potable'];

function turnoAbierto() {
  return bd.prepare(`
    SELECT t.*, u.nombre AS abierto_por_nombre
      FROM turnos_produccion t
      LEFT JOIN usuarios u ON u.id = t.abierto_por
     WHERE t.cerrado_en IS NULL
     ORDER BY t.abierto_en DESC LIMIT 1
  `).get() || null;
}

/** Quién ejecutó el movimiento: puede ser otro obrero distinto de quien captura. */
function resolverEjecutor(req) {
  const pedido = req.body?.ejecutorId;
  if (!pedido || pedido === req.usuario.id) return req.usuario.id;

  const existe = bd.prepare('SELECT 1 FROM usuarios WHERE id = ? AND activo = 1').get(pedido);
  return existe ? pedido : req.usuario.id;
}

// ============================================================
// ESTADO DE LA PANTALLA
// ============================================================

router.get('/estado', verProduccion, (req, res) => {
  const tanques = bd.prepare(
    'SELECT id, nombre, horas_congelacion FROM tanques WHERE activo = 1 ORDER BY orden, nombre'
  ).all();

  if (!tanques.length) return ok(res, { tanques: [], tanque: null, turno: turnoAbierto() });

  const elegido = tanques.find((t) => t.id === req.query.tanque) || tanques[0];
  const tanque = tanqueConEstado(elegido.id);
  const sugerido = panoSugerido(tanque);

  return ok(res, {
    tanques,
    tanque,
    sugerido: sugerido ? { id: sugerido.id, numero: sugerido.numero } : null,
    turno: turnoAbierto(),
    fuera: canastasFuera().length
  });
});

// ============================================================
// TURNO DE PRODUCCIÓN
// ============================================================

router.get('/turno', verProduccion, (req, res) => ok(res, { turno: turnoAbierto() }));

router.post('/turno/abrir', registrar, (req, res) => {
  if (turnoAbierto()) return error(res, 'Ya hay un turno abierto.', 409);

  const id = nuevoId();
  const nombre = String(req.body?.nombre || '').trim() || null;

  bd.prepare(`
    INSERT INTO turnos_produccion (id, nombre, abierto_en, abierto_por)
    VALUES (?, ?, ?, ?)
  `).run(id, nombre, ahora(), req.usuario.id);

  bitacora.registrar({
    accion: 'turno.abierto', entidad: 'turno_produccion', entidadId: id,
    ejecutorId: req.usuario.id, detalle: { nombre }
  });

  return ok(res, { turno: turnoAbierto() }, 201);
});

/**
 * Cerrar el turno. Si quedaron canastas fuera del tanque sin rellenar,
 * NO se cierra a la primera: primero avisa (sección 6.3). Se puede forzar,
 * pero entonces queda constancia de cuántas quedaron.
 */
router.post('/turno/cerrar', registrar, (req, res) => {
  const turno = turnoAbierto();
  if (!turno) return error(res, 'No hay ningún turno abierto.');

  const fuera = canastasFuera();
  if (fuera.length && !req.body?.forzar) {
    return error(res, `Quedan ${fuera.length} canastas fuera del tanque sin rellenar.`, 409, {
      canastasFuera: fuera
    });
  }

  bd.prepare('UPDATE turnos_produccion SET cerrado_en = ?, cerrado_por = ?, notas = ? WHERE id = ?')
    .run(ahora(), req.usuario.id, req.body?.notas || null, turno.id);

  bitacora.registrar({
    accion: 'turno.cerrado', entidad: 'turno_produccion', entidadId: turno.id,
    ejecutorId: req.usuario.id, detalle: { canastasFuera: fuera.length }
  });

  return ok(res, { cerrado: true, canastasFuera: fuera.length });
});

// ============================================================
// SACAR
// ============================================================

/**
 * Sacar una canasta. Nace el hielo.
 * Sin "resultados" se asume que todos los moldes salieron bien, que es
 * el caso normal. Con "resultados" se marca molde por molde.
 */
router.post('/sacar', registrar, (req, res) => {
  const turno = turnoAbierto();
  if (!turno) return error(res, 'Abre un turno de producción antes de registrar.', 409);

  const canasta = bd.prepare(`
    SELECT c.*, p.numero AS pano_numero, p.tanque_id, t.nombre AS tanque_nombre
      FROM canastas c
      JOIN panos p   ON p.id = c.pano_id
      JOIN tanques t ON t.id = p.tanque_id
     WHERE c.id = ? AND c.activo = 1 AND p.activo = 1 AND t.activo = 1
  `).get(req.body?.canastaId);
  if (!canasta) return error(res, 'Esa canasta no existe o está dada de baja.', 404);

  const moldes = bd.prepare(
    'SELECT id, numero FROM moldes WHERE canasta_id = ? AND activo = 1 ORDER BY numero'
  ).all(canasta.id);
  if (!moldes.length) return error(res, 'Esa canasta no tiene moldes activos.');

  // El último rellenado de esta canasta: de ahí sale el tiempo real congelando.
  const rellenado = bd.prepare(
    'SELECT * FROM rellenados WHERE canasta_id = ? ORDER BY fecha DESC LIMIT 1'
  ).get(canasta.id);

  const ultimaSacada = bd.prepare(
    'SELECT fecha FROM sacadas WHERE canasta_id = ? ORDER BY fecha DESC LIMIT 1'
  ).get(canasta.id);

  // Si la última sacada es posterior al último rellenado, la canasta ya
  // estaba fuera: sacarla otra vez no tiene sentido.
  if (ultimaSacada && (!rellenado || ultimaSacada.fecha >= rellenado.fecha)) {
    return error(res, 'Esa canasta ya está fuera del tanque. Lo que falta es rellenarla.', 409);
  }

  // Resultado por molde. Lo normal: todos ok.
  const pedidos = new Map();
  for (const r of req.body?.resultados || []) {
    if (!RESULTADOS.includes(r.resultado)) {
      return error(res, `Resultado inválido: ${r.resultado}.`);
    }
    pedidos.set(r.moldeId, r.resultado);
  }
  for (const moldeId of pedidos.keys()) {
    if (!moldes.some((m) => m.id === moldeId)) {
      return error(res, 'Uno de los moldes no pertenece a esta canasta.');
    }
  }

  const fecha = ahora();
  const ejecutorId = resolverEjecutor(req);
  const sacadaId = nuevoId();
  const horas = rellenado ? horasDesde(rellenado.fecha, new Date(fecha)) : null;

  const guardar = bd.transaction(() => {
    bd.prepare(`
      INSERT INTO sacadas (id, canasta_id, turno_id, fecha, ejecutor_id, capturista_id,
                           rellenado_id, horas_congelacion, notas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(sacadaId, canasta.id, turno.id, fecha, ejecutorId, req.usuario.id,
           rellenado?.id || null, horas, req.body?.notas || null);

    const insertar = bd.prepare(
      'INSERT INTO sacadas_moldes (id, sacada_id, molde_id, resultado) VALUES (?, ?, ?, ?)'
    );
    for (const m of moldes) insertar.run(nuevoId(), sacadaId, m.id, pedidos.get(m.id) || 'ok');
  });
  guardar();

  const cuenta = bd.prepare(`
    SELECT resultado, COUNT(*) n FROM sacadas_moldes WHERE sacada_id = ? GROUP BY resultado
  `).all(sacadaId);
  const resumen = Object.fromEntries(cuenta.map((c) => [c.resultado, c.n]));

  bitacora.registrar({
    accion: 'produccion.sacada', entidad: 'canasta', entidadId: canasta.id,
    ejecutorId, capturistaId: req.usuario.id,
    detalle: {
      tanque: canasta.tanque_nombre, pano: canasta.pano_numero, canasta: canasta.numero,
      moldes: moldes.length, resumen, horas
    }
  });

  return ok(res, {
    sacada: { id: sacadaId, horas, resumen, moldes: moldes.length },
    marquetas: resumen.ok || 0
  }, 201);
});

// ============================================================
// RELLENAR
// ============================================================

/** Rellenar una canasta. Arranca el reloj de congelación. */
router.post('/rellenar', registrar, (req, res) => {
  const turno = turnoAbierto();
  if (!turno) return error(res, 'Abre un turno de producción antes de registrar.', 409);

  const tipoAgua = String(req.body?.tipoAgua || '');
  if (!TIPOS_AGUA.includes(tipoAgua)) {
    return error(res, 'Indica si se rellenó con agua purificada o potable.');
  }

  const canasta = bd.prepare(`
    SELECT c.*, p.numero AS pano_numero, t.nombre AS tanque_nombre
      FROM canastas c
      JOIN panos p   ON p.id = c.pano_id
      JOIN tanques t ON t.id = p.tanque_id
     WHERE c.id = ? AND c.activo = 1 AND p.activo = 1 AND t.activo = 1
  `).get(req.body?.canastaId);
  if (!canasta) return error(res, 'Esa canasta no existe o está dada de baja.', 404);

  const id = nuevoId();
  const ejecutorId = resolverEjecutor(req);

  bd.prepare(`
    INSERT INTO rellenados (id, canasta_id, turno_id, fecha, ejecutor_id, capturista_id, tipo_agua, notas)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, canasta.id, turno.id, ahora(), ejecutorId, req.usuario.id, tipoAgua, req.body?.notas || null);

  bitacora.registrar({
    accion: 'produccion.rellenado', entidad: 'canasta', entidadId: canasta.id,
    ejecutorId, capturistaId: req.usuario.id,
    detalle: { tanque: canasta.tanque_nombre, pano: canasta.pano_numero,
               canasta: canasta.numero, tipoAgua }
  });

  return ok(res, { rellenado: { id, tipoAgua } }, 201);
});

// ============================================================
// HISTORIAL
// ============================================================

/** Lo que ha pasado en el turno abierto (o en el último cerrado). */
router.get('/movimientos', verProduccion, (req, res) => {
  const limite = Math.min(Number(req.query.limite) || 30, 200);

  const filas = bd.prepare(`
    SELECT * FROM (
      SELECT s.fecha, 'sacada' AS tipo, t.nombre AS tanque, p.numero AS pano,
             c.numero AS canasta, u.nombre AS quien, NULL AS tipo_agua,
             s.horas_congelacion AS horas,
             (SELECT COUNT(*) FROM sacadas_moldes sm
               WHERE sm.sacada_id = s.id AND sm.resultado = 'ok') AS marquetas
        FROM sacadas s
        JOIN canastas c ON c.id = s.canasta_id
        JOIN panos p    ON p.id = c.pano_id
        JOIN tanques t  ON t.id = p.tanque_id
        LEFT JOIN usuarios u ON u.id = s.ejecutor_id

      UNION ALL

      SELECT r.fecha, 'rellenado' AS tipo, t.nombre, p.numero, c.numero,
             u.nombre, r.tipo_agua, NULL, NULL
        FROM rellenados r
        JOIN canastas c ON c.id = r.canasta_id
        JOIN panos p    ON p.id = c.pano_id
        JOIN tanques t  ON t.id = p.tanque_id
        LEFT JOIN usuarios u ON u.id = r.ejecutor_id
    )
    ORDER BY fecha DESC LIMIT ?
  `).all(limite);

  return ok(res, { movimientos: filas });
});

/** Resumen del turno abierto: cuántas marquetas se han sacado. */
router.get('/resumen-turno', verProduccion, (req, res) => {
  const turno = turnoAbierto();
  if (!turno) return ok(res, { turno: null });

  const marquetas = bd.prepare(`
    SELECT COUNT(*) n FROM sacadas_moldes sm
      JOIN sacadas s ON s.id = sm.sacada_id
     WHERE s.turno_id = ? AND sm.resultado = 'ok'
  `).get(turno.id).n;

  const merma = bd.prepare(`
    SELECT COUNT(*) n FROM sacadas_moldes sm
      JOIN sacadas s ON s.id = sm.sacada_id
     WHERE s.turno_id = ? AND sm.resultado IN ('merma','hueco')
  `).get(turno.id).n;

  const sacadas = bd.prepare('SELECT COUNT(*) n FROM sacadas WHERE turno_id = ?').get(turno.id).n;
  const rellenados = bd.prepare('SELECT COUNT(*) n FROM rellenados WHERE turno_id = ?').get(turno.id).n;

  return ok(res, {
    turno, marquetas, merma, sacadas, rellenados, fuera: canastasFuera().length
  });
});

module.exports = router;
