/**
 * MAYOREO  (v2.0)
 *
 * "Yo simplemente ponía 1m y se ponía el precio de mayoreo y listo."
 *
 * Así lo trabajaba Tony antes, y así se hace ahora: el mayoreo SE TECLEA.
 * Hay dos productos —"1m" y "12m"— que no tienen precio propio: su precio
 * sale de una lista de mayoreo. Teclear un código es un toque; buscar al
 * cliente en una lista antes de capturar son diez, y el cliente está
 * enfrente.
 *
 * TRES IDEAS QUE CONVIENE TENER CLARAS
 *
 * EL MAYOREO ES UNA LISTA, NO UN DESCUENTO. "Mayoreo 1" es la lista donde
 * la marqueta vale $240 en vez de $264 y cada fracción tiene su propio
 * precio. Varios clientes comparten la misma lista, y subirle el precio a
 * la lista se lo sube a todos de una vez, que es como se maneja de verdad.
 *
 * NO ES UN PORCENTAJE PAREJO. El 1/16 cuesta más de lo proporcional porque
 * cortar da trabajo, y ese trabajo no desaparece por vender mucho. Por eso
 * es su propia lista y no una regla de tres (regla 7.2).
 *
 * NO HAY MÍNIMO QUE VIGILAR. El mínimo lo dicen los productos que existen:
 * si solo hay botón de marqueta y de media, no hay forma de pedir mayoreo
 * por un cuarto. Un número configurable de más es un número que un día se
 * queda mal puesto.
 *
 * Y UNA REGLA QUE NO SE NEGOCIA: un ticket con mayoreo NO SE COBRA SIN
 * DECIR DE QUIÉN ES. El precio especial es de alguien; si no queda escrito
 * de quién, al mes nadie puede explicar por qué esa marqueta salió a $240.
 */
const { bd } = require('../../db/conexion');
const { listaActiva } = require('./precios');

/**
 * La lista de mayoreo que se le cobra a este cliente.
 *
 * La suya si tiene; si no, la lista de mayoreo activa, que es la de "precio
 * de mayoreo normal". Un cliente sin lista propia no es un cliente sin
 * mayoreo: es uno al que se le cobra el mayoreo de siempre.
 *
 * Puede devolver null si nadie ha creado todavía una lista de mayoreo. En
 * ese caso no hay con qué cobrar esos productos, y eso se dice.
 */
function listaDeMayoreo(cliente) {
  if (cliente?.lista_id && cliente.activo) {
    const suya = bd.prepare(
      "SELECT * FROM listas_precios WHERE id = ? AND activo = 1 AND tipo = 'mayoreo'"
    ).get(cliente.lista_id);
    // Su lista se dio de baja después de asignársela: se cae a la de
    // siempre. Cobrar con precios que ya nadie mantiene sería peor.
    if (suya) return suya;
  }
  return listaPorOmision();
}

/** La lista de mayoreo "normal": la que se cobra cuando no hay una propia. */
function listaPorOmision() {
  return bd.prepare(`
    SELECT * FROM listas_precios
     WHERE tipo = 'mayoreo' AND activo = 1
     ORDER BY activa DESC, nombre
     LIMIT 1
  `).get() || null;
}

/** Todas las que se le pueden asignar a un cliente. */
function listasDeMayoreo() {
  return bd.prepare(`
    SELECT * FROM listas_precios
     WHERE activo = 1 AND tipo = 'mayoreo'
     ORDER BY activa DESC, nombre
  `).all();
}

/**
 * ¿Este ticket lleva mayoreo?
 *
 * Una línea llega de dos formas —por producto o por código tecleado— y las
 * dos cuentan. El hielo suelto de la calculadora nunca es mayoreo: no salió
 * de un botón de mayoreo.
 */
function llevaMayoreo(lineas, { porId, porCodigo }) {
  return (lineas || []).some((l) => {
    const p = l.productoId ? porId(l.productoId)
            : l.codigo     ? porCodigo(l.codigo)
            : null;
    return Boolean(p?.mayoreo);
  });
}

module.exports = { listaDeMayoreo, listaPorOmision, listasDeMayoreo, llevaMayoreo };
