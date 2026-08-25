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
 *
 * Se parte en público y mayoreo porque son dos negocios distintos: el
 * mostrador de a cuarto y el mayorista que se lleva veinte marquetas. Ver
 * cuánto pesa cada uno es la mitad de saber cómo va la fábrica.
 */
function vendidoDesde(desde, almacenId) {
  return partidoPorLista(desde, almacenId).total;
}

function partidoPorLista(desde, almacenId) {
  const fila = bd.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN lp.tipo = 'mayoreo' THEN vl.dieciseisavos ELSE 0 END), 0) mayoreo,
      COALESCE(SUM(CASE WHEN lp.tipo = 'mayoreo' THEN 0 ELSE vl.dieciseisavos END), 0) publico
      FROM venta_lineas vl
      JOIN ventas v ON v.id = vl.venta_id
      LEFT JOIN listas_precios lp ON lp.id = v.lista_id
     WHERE v.fecha > ?
       AND v.cancelada_en IS NULL
       AND v.almacen_id = ?
  `).get(desde || '', almacenId);
  return { ...fila, total: fila.mayoreo + fila.publico };
}

/**
 * LO QUE SE DERRITIÓ, SE ROMPIÓ O SE REGALÓ  (v2.0)
 *
 * Hasta la v1.9 esto aparecía dentro del "faltante" a secas, mezclado con
 * el hielo que se fue sin pagar. Son dos cosas muy distintas: una es física
 * y no tiene remedio, la otra es un problema que hay que atender. Anotarlo
 * es lo que separa las dos.
 */
function mermaDesde(desde, almacenId) {
  const fila = bd.prepare(`
    SELECT COALESCE(SUM(dieciseisavos), 0) n
      FROM mermas_hielo
     WHERE fecha > ? AND almacen_id = ? AND anulada_en IS NULL
  `).get(desde || '', almacenId);
  return fila.n;
}

/** Las mermas con su detalle, para enseñarlas y poder anular una. */
function mermasDesde(desde, almacenId, limite = 50) {
  return bd.prepare(`
    SELECT m.*, u.nombre AS ejecutor_nombre, c.nombre AS capturista_nombre
      FROM mermas_hielo m
      LEFT JOIN usuarios u ON u.id = m.ejecutor_id
      LEFT JOIN usuarios c ON c.id = m.capturista_id
     WHERE m.fecha > ? AND m.almacen_id = ?
     ORDER BY m.fecha DESC LIMIT ?
  `).all(desde || '', almacenId, limite);
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
  const ventas = partidoPorLista(desde, almacen.id);
  const vendido = ventas.total;
  // Y lo que se explicó sin ticket: lo derretido, lo roto, lo regalado.
  const merma = mermaDesde(desde, almacen.id);
  const teorico = anterior + producido;

  return {
    almacen,
    ultimoConteo: ultimo,
    desde,
    existenciaAnterior: anterior,
    producido,
    vendido,
    vendidoPublico: ventas.publico,
    vendidoMayoreo: ventas.mayoreo,
    merma,
    // Lo que debería haber si nada hubiera salido.
    teorico,
    // Lo que debería haber ahora ya descontando todo lo que se explicó:
    // este es el número contra el que se compara el conteo físico.
    esperado: teorico - vendido - merma
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
  ultimoConteo, producidoDesde, vendidoDesde, partidoPorLista,
  mermaDesde, mermasDesde, estadoAlmacen,
  deMarquetas, aMarquetas, DIECISEISAVOS_POR_MARQUETA
};
