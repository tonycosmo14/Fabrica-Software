/**
 * PRECIOS POR FRACCIÓN
 *
 * SECCIÓN 7.2 DEL PLAN — Cada fracción tiene precio propio e independiente.
 * NO se derivan dividiendo el de la marqueta.
 *
 * Ejemplo real de la fábrica: si la marqueta vale $264, el 1/16 proporcional
 * serían $16.50, pero se cobra $18 porque requiere más cortes. La fórmula
 * proporcional solo SUGIERE al capturar; el precio final lo pone el admin.
 */
const { bd } = require('../../db/conexion');
const { descomponer, desglose } = require('../../lib/fracciones');

/** La lista que se está cobrando ahora. */
function listaActiva(tipo = 'publico') {
  return bd.prepare(`
    SELECT * FROM listas_precios
     WHERE activa = 1 AND activo = 1 AND tipo = ?
     ORDER BY fecha_alta DESC LIMIT 1
  `).get(tipo) || null;
}

/** Los precios de una lista, como mapa dieciseisavos -> centavos. */
function preciosDe(listaId) {
  const filas = bd.prepare('SELECT dieciseisavos, centavos FROM precios WHERE lista_id = ?').all(listaId);
  return new Map(filas.map((f) => [f.dieciseisavos, f.centavos]));
}

/**
 * Cuánto cuesta una cantidad con una lista.
 * Se parte en las fracciones más grandes y se suman sus precios.
 *
 * Devuelve { centavos, desglose, faltan } — faltan son las fracciones que
 * la lista no tiene con precio, que hay que capturar antes de poder cobrar.
 */
function precioDe(dieciseisavos, listaId) {
  const precios = preciosDe(listaId);
  const partes = descomponer(dieciseisavos);

  let centavos = 0;
  const faltan = new Set();

  for (const parte of partes) {
    const p = precios.get(parte);
    if (p == null) faltan.add(parte);
    else centavos += p;
  }

  return { centavos, desglose: desglose(dieciseisavos), faltan: [...faltan] };
}

/** El precio proporcional, solo como sugerencia al capturar (7.2). */
function sugerencia(centavosMarqueta, dieciseisavos) {
  return Math.round((centavosMarqueta / 16) * dieciseisavos);
}

module.exports = { listaActiva, preciosDe, precioDe, sugerencia };
