/**
 * MAYOREO  (v1.9)
 *
 * "Algunos clientes gozan de mayoreo, a partir de 1/2 marqueta."
 *
 * Dos ideas que conviene tener claras antes de tocar esto:
 *
 * EL MAYOREO ES UNA LISTA, NO UN DESCUENTO. No es "a Doña Mary le bajas el
 * 10%": es la lista "Mayoreo 1", donde la marqueta vale $240 en vez de $264
 * y cada fracción tiene su propio precio. Varios clientes comparten la
 * misma lista, y subirle el precio a la lista se lo sube a todos de una
 * vez, que es como se maneja de verdad.
 *
 * Y NO ES UN PORCENTAJE PAREJO. En la fábrica el 1/16 cuesta más de lo
 * proporcional porque cortar da trabajo, y ese trabajo no desaparece por
 * vender mucho. Por eso el mayoreo es su propia lista y no una regla de
 * tres sobre la de público (regla 7.2).
 *
 * SE MIDE SOBRE EL HIELO DE TODO EL TICKET. En la caja el hielo se acumula
 * en una sola línea: quien pide "5 marquetas" está pidiendo una cosa, no
 * cinco. Medirlo renglón por renglón dejaría fuera al que pide 1/4 y 1/4.
 */
const { bd } = require('../../db/conexion');
const { listaActiva } = require('./precios');

const MINIMO_POR_OMISION = 8;   // media marqueta

/** Desde cuánto hielo aplica el mayoreo, en dieciseisavos. */
function minimoMayoreo() {
  const valor = bd.prepare(
    "SELECT valor FROM configuracion WHERE clave = 'mayoreo_minimo_dieciseisavos'"
  ).get()?.valor;
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : MINIMO_POR_OMISION;
}

function guardarMinimoMayoreo(dieciseisavos, usuarioId) {
  bd.prepare(`
    INSERT INTO configuracion (clave, valor, actualizado_en, actualizado_por)
    VALUES ('mayoreo_minimo_dieciseisavos', ?, datetime('now'), ?)
    ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor,
      actualizado_en = excluded.actualizado_en, actualizado_por = excluded.actualizado_por
  `).run(String(dieciseisavos), usuarioId || null);
}

/** Las listas de mayoreo que se pueden asignar a un cliente. */
function listasDeMayoreo() {
  return bd.prepare(`
    SELECT * FROM listas_precios
     WHERE activo = 1 AND tipo = 'mayoreo'
     ORDER BY nombre
  `).all();
}

/**
 * QUÉ LISTA SE LE COBRA A ESTE TICKET.
 *
 * Devuelve { lista, esMayoreo, minimo, faltan } — `faltan` son los
 * dieciseisavos que le faltan al ticket para alcanzar el mayoreo, para
 * poder decírselo al cliente en la cara ("con media marqueta más te lo dejo
 * a precio de mayoreo").
 *
 * EL SERVIDOR MANDA. La pantalla calcula lo mismo para que el precio cambie
 * al instante, pero al cobrar se vuelve a decidir aquí desde cero: si no,
 * bastaría con mandar otro clienteId para llevarse el precio de mayoreo.
 */
function listaParaVenta(cliente, dieciseisavosDeHielo) {
  const publico = listaActiva();
  const minimo = minimoMayoreo();

  // Sin cliente, o dado de baja, se cobra público. A un cliente de baja se
  // le puede seguir cobrando de contado —llegó y pagó—, pero su precio de
  // mayoreo se le quitó junto con la baja.
  if (!cliente?.lista_id || !cliente.activo) {
    return { lista: publico, esMayoreo: false, minimo, faltan: 0 };
  }

  const suya = bd.prepare(
    'SELECT * FROM listas_precios WHERE id = ? AND activo = 1'
  ).get(cliente.lista_id);

  // La lista se dio de baja después de asignarla: se cobra público, que es
  // lo seguro. Cobrar con una lista muerta sería cobrar con precios que ya
  // nadie está manteniendo.
  if (!suya) return { lista: publico, esMayoreo: false, minimo, faltan: 0 };

  const alcanza = dieciseisavosDeHielo >= minimo;
  return {
    lista: alcanza ? suya : publico,
    esMayoreo: alcanza,
    listaDelCliente: suya,
    minimo,
    faltan: alcanza ? 0 : minimo - dieciseisavosDeHielo
  };
}

/**
 * Cuánto hielo lleva un conjunto de líneas, para medir el mínimo.
 *
 * Una línea llega de tres formas —por producto, por código tecleado, o
 * suelta desde la calculadora de fracciones— y las tres cuentan igual.
 */
function hieloDe(lineas, { porId, porCodigo }) {
  let total = 0;
  for (const l of lineas || []) {
    const n = Number(l.cantidad);
    const cantidad = Number.isInteger(n) && n > 0 ? n : 1;

    const p = l.productoId ? porId(l.productoId)
            : l.codigo     ? porCodigo(l.codigo)
            : null;

    if (p) {
      if (p.tipo === 'hielo') total += p.dieciseisavos * cantidad;
      continue;
    }
    // Sin producto es hielo suelto de la calculadora.
    const sueltos = Number(l.dieciseisavos);
    if (Number.isInteger(sueltos) && sueltos > 0) total += sueltos * cantidad;
  }
  return total;
}

module.exports = {
  minimoMayoreo, guardarMinimoMayoreo, listasDeMayoreo, listaParaVenta, hieloDe
};
