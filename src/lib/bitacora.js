/**
 * REGLA DE ORO 3.6 — Doble responsable en cada registro.
 * Cada evento guarda quien lo ejecuto y quien lo capturo.
 * Normalmente son la misma persona; cuando no, quedan los dos.
 */
const { bd } = require('../db/conexion');
const { nuevoId, ahora } = require('./ids');

function registrar({ accion, entidad = null, entidadId = null, ejecutorId = null, capturistaId = null, detalle = null }) {
  bd.prepare(`
    INSERT INTO bitacora (id, fecha, accion, entidad, entidad_id, ejecutor_id, capturista_id, detalle)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    nuevoId(),
    ahora(),
    accion,
    entidad,
    entidadId,
    ejecutorId,
    capturistaId ?? ejecutorId, // si no se especifica, ejecutor y capturista son el mismo
    detalle ? JSON.stringify(detalle) : null
  );
}

function ultimos(limite = 50) {
  return bd.prepare(`
    SELECT b.*, u.nombre AS ejecutor_nombre, c.nombre AS capturista_nombre
    FROM bitacora b
    LEFT JOIN usuarios u ON u.id = b.ejecutor_id
    LEFT JOIN usuarios c ON c.id = b.capturista_id
    ORDER BY b.fecha DESC
    LIMIT ?
  `).all(limite);
}

module.exports = { registrar, ultimos };
