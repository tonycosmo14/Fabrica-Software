/**
 * EL TAMAÑO DE LOS CUADROS DE VENDER  (v2.3)
 *
 * No se guarda el alto ni el ancho en pixeles: se guarda cuántos cuadros
 * quiere ver el dueño de una vez, y la caja reparte entre esos el sitio que
 * haya. Así la misma configuración sirve para la pantalla de 15 pulgadas del
 * mostrador y para el monitor grande de la oficina, sin tocar nada.
 *
 * LOS TOPES no son por gusto:
 *   · Menos de 2 columnas no es una rejilla, es una lista.
 *   · Más de 10 columnas deja cuadros donde no cabe el nombre del producto,
 *     y un botón que hay que leer con lupa se toca mal.
 *   · Más de 8 filas es más de lo que se recorre con la vista sin perderse;
 *     para eso están los códigos rápidos.
 *
 * Vive aparte de las rutas porque lo leen DOS módulos: Personalizar, que lo
 * configura, y la caja, que se pinta con ello.
 */
const { bd } = require('../../db/conexion');

const REJILLA = {
  columnas: { minimo: 2, maximo: 10, omision: 5 },
  filas:    { minimo: 1, maximo: 8,  omision: 3 }
};

/** Un número dentro de sus topes, o el de siempre si viene cualquier cosa. */
function dentroDeTopes(valor, topes) {
  const n = Math.round(Number(valor));
  if (!Number.isFinite(n)) return topes.omision;
  return Math.min(Math.max(n, topes.minimo), topes.maximo);
}

function leer(clave) {
  return bd.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(clave)?.valor || null;
}

/** Cómo está puesta la rejilla ahora mismo, con sus topes para la pantalla. */
function rejillaDeLaCaja() {
  return {
    columnas: dentroDeTopes(leer('pos_columnas'), REJILLA.columnas),
    filas: dentroDeTopes(leer('pos_filas'), REJILLA.filas),
    topes: REJILLA
  };
}

module.exports = { REJILLA, rejillaDeLaCaja, dentroDeTopes };
