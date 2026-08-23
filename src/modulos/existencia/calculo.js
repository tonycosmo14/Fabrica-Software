/**
 * EL CUADRE DE LA EXISTENCIA
 *
 *      existencia anterior  +  producido  −  contado  =  SALIDAS
 *
 * Las salidas son todo lo que dejó el cuarto frío. Desde la v0.8 se parten
 * en dos, que es de lo que se trataba todo:
 *
 *      vendido   = lo que dicen los tickets de la caja
 *      faltante  = salidas − vendido
 *
 * El faltante es lo que se derritió, lo que se cayó y lo que se fue sin
 * pagar. Ese es el número que hay que vigilar.
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
 * Marquetas VENDIDAS con ticket desde una fecha, en un almacén.
 * Las ventas canceladas no cuentan: nunca salieron del cuarto frío.
 */
function vendidoDesde(desde, almacenId) {
  const fila = bd.prepare(`
    SELECT COALESCE(SUM(vl.dieciseisavos), 0) n
      FROM venta_lineas vl
      JOIN ventas v ON v.id = vl.venta_id
     WHERE v.fecha > ?
       AND v.cancelada_en IS NULL
       AND v.almacen_id = ?
  `).get(desde || '', almacenId);
  return fila.n;
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

  // Lo que la caja ya explicó con tickets desde el último conteo.
  const vendido = vendidoDesde(desde, almacen.id);
  const teorico = anterior + producido;

  return {
    almacen,
    ultimoConteo: ultimo,
    desde,
    existenciaAnterior: anterior,
    producido,
    vendido,
    // Lo que debería haber si nada hubiera salido.
    teorico,
    // Lo que debería haber ahora ya descontando lo vendido: este es el
    // número contra el que se compara el conteo físico.
    esperado: teorico - vendido
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
  ultimoConteo, producidoDesde, vendidoDesde, estadoAlmacen,
  deMarquetas, aMarquetas, DIECISEISAVOS_POR_MARQUETA
};
