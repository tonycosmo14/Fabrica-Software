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
const calidad = require('./calidad');

/**
 * Los paños sacados ENTRE DOS INSTANTES, con lo que dio cada uno.
 *
 * Es el mismo cálculo que `panosDelDia` pero acotado por los dos lados, y
 * por instante y no por día de calendario: el corte de un turno abarca de
 * un conteo al siguiente, y esa ventana casi nunca empieza a medianoche.
 */
function panosEntre(desde, hasta) {
  return armar(`sp.iniciada_en > ? AND sp.iniciada_en <= ?`, [desde || '', hasta]);
}

/** Los paños sacados en un día, con lo que dio cada uno. */
function panosDelDia(dia = null) {
  return armar(`date(sp.iniciada_en, 'localtime') = date(${dia ? '?' : "'now'"}, 'localtime')`,
               dia ? [dia] : []);
}

/**
 * El cuerpo de la consulta, que es el mismo para las dos: lo único que
 * cambia es cómo se acota el tiempo. Copiada, se arreglaría una y la otra
 * seguiría diciendo otra cosa.
 */
function armar(cuando, valores) {
  const filas = bd.prepare(`
    SELECT sp.id,
           p.numero            AS pano,
           t.nombre            AS tanque,
           MIN(s.fecha)        AS empezo,
           MAX(s.fecha)        AS termino,
           COALESCE(u.nombre, sp.ejecutor_libre) AS quien,
           sp.terminada_en,
           sp.notas,
           COUNT(*) FILTER (WHERE ${calidad.alAlmacen('sm')})      AS al_almacen,
           COUNT(*) FILTER (WHERE ${calidad.salioHielo('sm')})     AS producidas,
           COUNT(*) FILTER (WHERE NOT (${calidad.alAlmacen('sm')})) AS merma,
           ${calidad.columnasMezcla('sm')}
      FROM sacadas_pano sp
      JOIN panos p          ON p.id = sp.pano_id
      JOIN tanques t        ON t.id = p.tanque_id
      JOIN sacadas s        ON s.sacada_pano_id = sp.id
      JOIN sacadas_moldes sm ON sm.sacada_id = s.id
      LEFT JOIN usuarios u  ON u.id = sp.ejecutor_id
     WHERE ${cuando}
       AND sp.anulada_en IS NULL
     GROUP BY sp.id
     ORDER BY t.nombre, MIN(s.fecha)
  `).all(...valores);

  return filas.map((f) => ({
    ...f,
    alAlmacen: f.al_almacen,
    enProceso: !f.terminada_en
  }));
}

/**
 * El resumen de un día: cuántos paños, cuánto hielo entró al cuarto frío y
 * CÓMO SALIÓ ESE HIELO.
 *
 * La mezcla va aquí y no solo el total a propósito: el total de un día malo
 * y el de un día bueno se parecen —son los mismos moldes— y lo que los
 * distingue es el reparto. Un corte que enseñara nada más el total estaría
 * escondiendo justo el dato que sirve.
 */
function resumenDelDia(dia = null) {
  return resumirPanos(panosDelDia(dia));
}

/** Lo mismo, para una ventana entre dos instantes. */
function resumenEntre(desde, hasta) {
  return resumirPanos(panosEntre(desde, hasta));
}

function resumirPanos(panos) {
  const suma = (campo) => panos.reduce((n, p) => n + (p[campo] || 0), 0);

  // La merma sale de la propia mezcla desde la v6.5: es todo lo que no
  // entró al cuarto frío —hueca, salada, aguada y "otro"—, y ya no hay un
  // renglón aparte de "rotas" que pudiera contarse dos veces.
  const mezcla = calidad.resumir(
    Object.fromEntries(calidad.CLAVES_CALIDAD.map((c) => [c, suma(c)])));

  return {
    panos,
    cuantos: panos.length,
    ...mezcla,
    enProceso: panos.filter((p) => p.enProceso).length
  };
}

module.exports = { panosDelDia, panosEntre, resumenDelDia, resumenEntre };
