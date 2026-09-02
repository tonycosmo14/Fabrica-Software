/**
 * LA TEMPERATURA — la API  (v3.6)
 *
 * Lo que se pide desde las pantallas: la de ahora (venta), la historia
 * (para comparar meses) y la de la salmuera de cada tanque.
 *
 * NINGUNA DE ESTAS RUTAS FALLA POR NO HABER INTERNET. Si el servicio del
 * clima no contesta, se devuelve la última que se pudo tomar diciendo de
 * cuándo es. Una fábrica que no puede vender hielo porque no cargó el
 * clima sería una fábrica peor que la de antes del sistema.
 */
const express = require('express');
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');
const { ok, error } = require('../../lib/respuestas');
const bitacora = require('../../lib/bitacora');
const { exigirPermiso } = require('../../middleware/sesion');
const { instantes } = require('../../lib/periodos');
const clima = require('./servicio');

const router = express.Router();
const ver = exigirPermiso('produccion.ver');
const medir = exigirPermiso('produccion.registrar');

/** La de afuera, ahora. Nunca falla. */
router.get('/', ver, async (req, res) => {
  return ok(res, { clima: await clima.ahoraMismo() });
});

/** Escribirla a mano, para cuando no hay internet. */
router.post('/', medir, (req, res) => {
  const t = Number(req.body?.temperatura);
  if (!Number.isFinite(t) || t < -20 || t > 60) {
    return error(res, 'Escribe la temperatura en grados, entre -20 y 60.');
  }
  const h = req.body?.humedad;
  const humedad = h === '' || h == null ? null : Number(h);
  if (humedad !== null && (!Number.isFinite(humedad) || humedad < 0 || humedad > 100)) {
    return error(res, 'La humedad va de 0 a 100.');
  }

  const registro = clima.aMano({ temperatura: t, humedad, ejecutorId: req.usuario.id });
  bitacora.registrar({
    accion: 'clima.a-mano', entidad: 'clima', entidadId: registro.id,
    ejecutorId: req.usuario.id, detalle: { temperatura: t, humedad }
  });
  return ok(res, { registro }, 201);
});

/** La máxima y la mínima de cada día. */
router.get('/historial', ver, (req, res) => {
  const desde = String(req.query.desde || '').slice(0, 10);
  const hasta = String(req.query.hasta || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
    return error(res, 'Faltan las fechas.');
  }
  const rango = instantes({ desde, hasta });
  return ok(res, { dias: clima.porDia(rango) });
});

// ============================================================
// LA SALMUERA DE LOS TANQUES
// ============================================================

/**
 * Tres tomas y su promedio: cerca de los serpentines, en la salida más
 * cercana y en la más lejana. El promedio NO se guarda —se calcula de las
 * tres cada vez (regla 3.2)—: un promedio guardado es un número que puede
 * dejar de cuadrar con los suyos si alguien corrige una toma.
 */
function conPromedio(f) {
  const tomas = [f.serpentines, f.salida_cerca, f.salida_lejos]
    .filter((n) => typeof n === 'number');
  return {
    ...f,
    tomas: tomas.length,
    promedio: tomas.length
      ? Math.round((tomas.reduce((a, b) => a + b, 0) / tomas.length) * 10) / 10
      : null
  };
}

/** Las mediciones de un tanque, de la más nueva a la más vieja. */
router.get('/salmuera', ver, (req, res) => {
  const tanqueId = req.query.tanque || null;
  const limite = Math.min(Number(req.query.limite) || 40, 200);

  const filas = bd.prepare(`
    SELECT s.*, t.nombre AS tanque,
           COALESCE(u.nombre, '—') AS ejecutor_nombre,
           COALESCE(c.nombre, '—') AS capturista_nombre
      FROM temperaturas_salmuera s
      JOIN tanques t        ON t.id = s.tanque_id
      LEFT JOIN usuarios u  ON u.id = s.ejecutor_id
      LEFT JOIN usuarios c  ON c.id = s.capturista_id
     WHERE (? IS NULL OR s.tanque_id = ?)
     ORDER BY s.fecha DESC
     LIMIT ?
  `).all(tanqueId, tanqueId, limite);

  // La última de CADA tanque, para el panel de producción.
  const ultimas = bd.prepare(`
    SELECT s.* FROM temperaturas_salmuera s
     WHERE s.anulada_en IS NULL
       AND s.fecha = (SELECT MAX(x.fecha) FROM temperaturas_salmuera x
                       WHERE x.tanque_id = s.tanque_id AND x.anulada_en IS NULL)
  `).all();

  return ok(res, {
    mediciones: filas.map(conPromedio),
    ultimaPorTanque: Object.fromEntries(ultimas.map((f) => [f.tanque_id, conPromedio(f)]))
  });
});

router.post('/salmuera', medir, (req, res) => {
  const tanque = bd.prepare('SELECT * FROM tanques WHERE id = ? AND activo = 1')
    .get(req.body?.tanqueId ?? null);
  if (!tanque) return error(res, 'Ese tanque no existe.', 404);

  // Las tres son opcionales por separado —a veces solo se alcanza una— pero
  // alguna tiene que venir: una medición vacía no es una medición.
  const leer = (v) => {
    if (v === '' || v == null) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < -40 || n > 60) return NaN;
    return Math.round(n * 10) / 10;
  };
  const serpentines = leer(req.body?.serpentines);
  const cerca = leer(req.body?.salidaCerca);
  const lejos = leer(req.body?.salidaLejos);

  if ([serpentines, cerca, lejos].some(Number.isNaN)) {
    return error(res, 'Las temperaturas van en grados, entre -40 y 60.');
  }
  if (serpentines === null && cerca === null && lejos === null) {
    return error(res, 'Escribe al menos una de las tres tomas.');
  }

  const id = nuevoId();
  bd.prepare(`
    INSERT INTO temperaturas_salmuera
      (id, tanque_id, fecha, serpentines, salida_cerca, salida_lejos, notas,
       ejecutor_id, capturista_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, tanque.id, ahora(), serpentines, cerca, lejos,
         String(req.body?.notas || '').trim().slice(0, 300) || null,
         req.body?.ejecutorId || req.usuario.id, req.usuario.id);

  const guardada = conPromedio(
    bd.prepare('SELECT * FROM temperaturas_salmuera WHERE id = ?').get(id));

  bitacora.registrar({
    accion: 'clima.salmuera', entidad: 'tanque', entidadId: tanque.id,
    ejecutorId: req.body?.ejecutorId || req.usuario.id, capturistaId: req.usuario.id,
    detalle: { tanque: tanque.nombre, serpentines, cerca, lejos,
               promedio: guardada.promedio }
  });

  return ok(res, { medicion: guardada }, 201);
});

router.post('/salmuera/:id/anular', exigirPermiso('produccion.corregir'), (req, res) => {
  const m = bd.prepare('SELECT * FROM temperaturas_salmuera WHERE id = ?').get(req.params.id);
  if (!m) return error(res, 'Esa medición no existe.', 404);
  if (m.anulada_en) return error(res, 'Esa medición ya está anulada.');

  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) return error(res, 'Escribe por qué se anula.');

  bd.prepare(`
    UPDATE temperaturas_salmuera
       SET anulada_en = ?, anulada_por = ?, motivo_anulacion = ? WHERE id = ?
  `).run(ahora(), req.usuario.id, motivo, m.id);

  bitacora.registrar({
    accion: 'clima.salmuera-anulada', entidad: 'tanque', entidadId: m.tanque_id,
    ejecutorId: req.usuario.id, detalle: { motivo }
  });
  return ok(res, { anulada: true });
});

module.exports = router;
