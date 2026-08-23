/**
 * EL CUADRE DE LA EXISTENCIA
 *
 *      existencia anterior  +  producido  −  contado  =  SALIDAS
 *
 * Las salidas son todo lo que dejó el cuarto frío: lo vendido, lo que se
 * derritió, lo que se cayó y lo que falta sin explicación. Mientras no
 * exista el punto de venta van juntas; cuando llegue, la parte que no
 * cuadre con las ventas registradas es lo que hay que revisar.
 *
 * Las cantidades se guardan en dieciseisavos (regla 3.1) aunque se cuenten
 * en marquetas.
 */
const { bd } = require('../../db/conexion');
const { DIECISEISAVOS_POR_MARQUETA } = require('../../lib/fracciones');

/** El último conteo válido de un almacén. Los anulados no cuentan. */
function ultimoConteo(almacenId) {
  return bd.prepare(`
    SELECT c.*, u.nombre AS ejecutor_nombre
      FROM conteos c
      LEFT JOIN usuarios u ON u.id = c.ejecutor_id
     WHERE c.almacen_id = ? AND c.anulado_en IS NULL
     ORDER BY c.fecha DESC LIMIT 1
  `).get(almacenId) || null;
}

/**
 * Marquetas buenas que salieron de los tanques desde una fecha.
 * Es lo que ENTRÓ al cuarto frío en esa ventana.
 */
function producidoDesde(desde) {
  const fila = bd.prepare(`
    SELECT COUNT(*) n
      FROM sacadas_moldes sm
      JOIN sacadas s      ON s.id = sm.sacada_id
      JOIN sacadas_pano sp ON sp.id = s.sacada_pano_id
     WHERE sm.resultado = 'ok'
       AND s.fecha > ?
       AND (sp.notas IS NULL OR sp.notas NOT LIKE 'ANULADA%')
  `).get(desde || '');
  return fila.n * DIECISEISAVOS_POR_MARQUETA;
}

/**
 * Foto de cómo va un almacén ahora mismo, sin registrar nada.
 * Es lo que se ve en pantalla antes de contar.
 */
function estadoAlmacen(almacen) {
  const ultimo = ultimoConteo(almacen.id);
  const desde = ultimo?.fecha || null;

  // Solo el almacén que recibe la producción suma lo que sale de los tanques.
  const producido = almacen.recibe_produccion ? producidoDesde(desde) : 0;
  const anterior = ultimo?.contado ?? 0;

  return {
    almacen,
    ultimoConteo: ultimo,
    desde,
    existenciaAnterior: anterior,
    producido,
    // Lo que debería haber si nada hubiera salido.
    teorico: anterior + producido
  };
}

/** Convierte marquetas enteras a dieciseisavos. */
function deMarquetas(marquetas) {
  return Math.round(marquetas) * DIECISEISAVOS_POR_MARQUETA;
}

/** Y al revés, para mostrar. */
function aMarquetas(dieciseisavos) {
  return dieciseisavos / DIECISEISAVOS_POR_MARQUETA;
}

module.exports = {
  ultimoConteo, producidoDesde, estadoAlmacen,
  deMarquetas, aMarquetas, DIECISEISAVOS_POR_MARQUETA
};
