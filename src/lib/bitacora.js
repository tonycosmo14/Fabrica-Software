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

  avisar({ accion, entidad, entidadId, ejecutorId, capturistaId: capturistaId ?? ejecutorId, detalle });
}

/**
 * LOS AVISOS POR CORREO CUELGAN DE AQUÍ  (v4.9)
 *
 * Todo lo que pasa en la fábrica ya pasaba por esta función, así que es
 * el único sitio donde hay que mirar. Un aviso nuevo se agrega en
 * `modulos/correo/avisos.js` y no se toca ni la caja, ni las ventas, ni
 * la producción — y por lo tanto no se puede romper nada de eso.
 *
 * Se pide aquí dentro y no arriba a propósito: así este archivo, que es
 * de los primeros que se cargan, no arrastra medio sistema detrás.
 *
 * Y va entero dentro de un try. Un correo que no se pudo armar es un
 * correo que no llega; que además tumbara el cierre de un turno sería
 * indefendible.
 */
function avisar(evento) {
  try { require('../modulos/correo/avisos').mirar(evento); }
  catch (e) { console.error('  Avisos por correo:', e.message); }
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
