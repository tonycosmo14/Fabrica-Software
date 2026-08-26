/**
 * QUÉ SE SACÓ HOY  (v2.5)
 *
 * Al cerrar el turno hace falta un papel con el trabajo del día: qué paños
 * salieron, de qué tanque, cuántas marquetas buenas dio cada uno y cuántas
 * se rompieron. Es lo que se compara contra el conteo del cuarto frío
 * cuando la cuenta no cuadra.
 *
 * Se calcula de las sacadas, nunca de un contador guardado (regla 3.2).
 *
 * TODO EN HORA LOCAL. Las fechas se guardan en UTC, y en Yucatán un paño
 * sacado a las 6:30 de la tarde queda con la fecha del día siguiente:
 * comparando sin convertir, el corte de la noche no enseñaría el trabajo de
 * la tarde, que es justo el que interesa.
 */
const { bd } = require('../../db/conexion');

/** Los paños sacados en un día, con lo que dio cada uno. */
function panosDelDia(dia = null) {
  const filas = bd.prepare(`
    SELECT sp.id,
           p.numero            AS pano,
           t.nombre            AS tanque,
           MIN(s.fecha)        AS empezo,
           MAX(s.fecha)        AS termino,
           u.nombre            AS quien,
           sp.terminada_en,
           sp.notas,
           COUNT(*) FILTER (WHERE sm.resultado = 'ok')    AS buenas,
           COUNT(*) FILTER (WHERE sm.resultado = 'merma') AS rotas,
           COUNT(*) FILTER (WHERE sm.resultado = 'hueco') AS huecos
      FROM sacadas_pano sp
      JOIN panos p          ON p.id = sp.pano_id
      JOIN tanques t        ON t.id = p.tanque_id
      JOIN sacadas s        ON s.sacada_pano_id = sp.id
      JOIN sacadas_moldes sm ON sm.sacada_id = s.id
      LEFT JOIN usuarios u  ON u.id = sp.ejecutor_id
     WHERE date(sp.iniciada_en, 'localtime') = date(${dia ? '?' : "'now'"}, 'localtime')
       AND (sp.notas IS NULL OR sp.notas NOT LIKE 'ANULADA%')
     GROUP BY sp.id
     ORDER BY t.nombre, MIN(s.fecha)
  `).all(...(dia ? [dia] : []));

  return filas.map((f) => ({
    ...f,
    enProceso: !f.terminada_en
  }));
}

/** El resumen de un día: cuántos paños, cuántas marquetas, cuántas rotas. */
function resumenDelDia(dia = null) {
  const panos = panosDelDia(dia);
  return {
    panos,
    cuantos: panos.length,
    buenas: panos.reduce((n, p) => n + p.buenas, 0),
    rotas: panos.reduce((n, p) => n + p.rotas, 0),
    huecos: panos.reduce((n, p) => n + p.huecos, 0),
    enProceso: panos.filter((p) => p.enProceso).length
  };
}

module.exports = { panosDelDia, resumenDelDia };
