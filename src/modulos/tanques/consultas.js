/**
 * Consultas de la estructura fisica. Separadas de las rutas para que la
 * pantalla de produccion (v0.3) pueda reusarlas sin pasar por HTTP.
 */
const { bd } = require('../../db/conexion');

/** Lista de tanques con sus totales ya calculados. */
function listarTanques({ incluirInactivos = false } = {}) {
  return bd.prepare(`
    SELECT
      t.*,
      (SELECT COUNT(*) FROM panos p
        WHERE p.tanque_id = t.id AND p.activo = 1) AS total_panos,
      (SELECT COUNT(*) FROM canastas c
        JOIN panos p ON p.id = c.pano_id
        WHERE p.tanque_id = t.id AND p.activo = 1 AND c.activo = 1) AS total_canastas,
      (SELECT COUNT(*) FROM moldes m
        JOIN canastas c ON c.id = m.canasta_id
        JOIN panos p ON p.id = c.pano_id
        WHERE p.tanque_id = t.id AND p.activo = 1 AND c.activo = 1 AND m.activo = 1) AS total_moldes
    FROM tanques t
    ${incluirInactivos ? '' : 'WHERE t.activo = 1'}
    ORDER BY t.activo DESC, t.orden, t.nombre
  `).all();
}

/** Un tanque con todos sus paños, canastas y moldes anidados. */
function detalleTanque(tanqueId, { incluirInactivos = false } = {}) {
  const tanque = bd.prepare('SELECT * FROM tanques WHERE id = ?').get(tanqueId);
  if (!tanque) return null;

  const filtro = incluirInactivos ? '' : 'AND activo = 1';

  const panos = bd.prepare(
    `SELECT * FROM panos WHERE tanque_id = ? ${filtro} ORDER BY numero`
  ).all(tanqueId);

  const canastasDe = bd.prepare(
    `SELECT * FROM canastas WHERE pano_id = ? ${filtro} ORDER BY numero`
  );
  const moldesDe = bd.prepare(
    `SELECT * FROM moldes WHERE canasta_id = ? ${filtro} ORDER BY numero`
  );

  for (const pano of panos) {
    pano.canastas = canastasDe.all(pano.id);
    for (const canasta of pano.canastas) {
      canasta.moldes = moldesDe.all(canasta.id);
      canasta.total_moldes = canasta.moldes.filter((m) => m.activo).length;
    }
    pano.total_moldes = pano.canastas.reduce((n, c) => n + c.total_moldes, 0);
  }

  tanque.panos = panos;
  tanque.total_panos = panos.filter((p) => p.activo).length;
  tanque.total_canastas = panos.reduce((n, p) => n + p.canastas.filter((c) => c.activo).length, 0);
  tanque.total_moldes = panos.reduce((n, p) => n + p.total_moldes, 0);

  return tanque;
}

/** Total de moldes activos de toda la fábrica. */
function totalMoldesFabrica() {
  return bd.prepare(`
    SELECT COUNT(*) n FROM moldes m
    JOIN canastas c ON c.id = m.canasta_id
    JOIN panos p    ON p.id = c.pano_id
    JOIN tanques t  ON t.id = p.tanque_id
    WHERE m.activo = 1 AND c.activo = 1 AND p.activo = 1 AND t.activo = 1
  `).get().n;
}

module.exports = { listarTanques, detalleTanque, totalMoldesFabrica };
