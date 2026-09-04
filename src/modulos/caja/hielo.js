/**
 * EL CUADRE DEL HIELO DE UN CORTE  (v4.2)
 *
 * "Cuando pongo el hielo que hay en el cuarto frío y termino, simplemente
 * me modifica la existencia y no me dice si faltó o no faltó hielo."
 *
 * Tenía razón: el conteo se guardaba y ahí moría. El corte enseñaba el
 * dinero con todo detalle y del hielo no decía nada, cuando el hielo es el
 * producto. Esto es la otra mitad del corte:
 *
 *     lo que había  +  lo que se produjo   =  lo que TENÍA que haber
 *     menos lo vendido, lo derretido y lo cortado
 *     contra lo que se CONTÓ                =  lo que FALTÓ o SOBRÓ
 *
 * Todo sale de la fila del conteo, que guarda sus números CONGELADOS en el
 * momento en que se hizo (regla 3.2 al revés, y a propósito): si mañana se
 * corrige una sacada vieja, el corte que ya se firmó no se mueve.
 *
 * Y la ventana es la del conteo —del conteo anterior a este—, no el turno:
 * es lo que pidió el dueño, "todo comparado desde la última vez que se
 * cortó". Un turno que no contó hielo no tiene cuadre, y eso se dice en
 * vez de inventarlo.
 */
const { bd } = require('../../db/conexion');
const { aTexto } = require('../../lib/fracciones');
const { panosEntre, resumenEntre } = require('../produccion/dia');

/** El conteo que se hizo dentro de este turno, si se hizo. */
function conteoDelTurno(cajaId) {
  return bd.prepare(`
    SELECT c.*, a.nombre AS almacen_nombre, u.nombre AS ejecutor_nombre
      FROM conteos c
      LEFT JOIN almacenes a ON a.id = c.almacen_id
      LEFT JOIN usuarios u  ON u.id = c.ejecutor_id
     WHERE c.caja_id = ? AND c.anulado_en IS NULL
     ORDER BY c.fecha DESC LIMIT 1
  `).get(cajaId) || null;
}

/** El hielo que se cortó para bolsas dentro de este turno. */
function cortesDelTurno(cajaId) {
  return bd.prepare(`
    SELECT ch.*, p.nombre AS producto_nombre
      FROM cortes_hielo ch
      LEFT JOIN productos p ON p.id = ch.producto_id
     WHERE ch.caja_id = ? AND ch.anulado_en IS NULL
     ORDER BY ch.fecha
  `).all(cajaId);
}

/**
 * QUÉ PEDAZOS SE VENDIERON, en la ventana del conteo.
 *
 * "Cuántos de cada pedazo se vendieron: 15 de 1/8, así."
 *
 * Se agrupa por EL TAMAÑO DEL PEDAZO —los dieciseisavos de UNA pieza— y no
 * por el nombre del renglón. El nombre no sirve: cuando el cajero toca el
 * botón dice "1/8", pero cuando teclea la fracción a mano dice "Hielo" a
 * secas, y las dos son el mismo octavo. El tamaño no miente nunca.
 *
 * `cantidad` son las piezas de ese renglón y `dieciseisavos` el total, así
 * que el pedazo es la división de los dos: tres octavos vendidos juntos
 * son cantidad 3 y 6 dieciseisavos → pedazo de 2, o sea 1/8.
 *
 * Las canceladas no cuentan: ese hielo nunca salió del cuarto frío.
 */
function pedazosVendidos({ desde, hasta, almacenId }) {
  return bd.prepare(`
    SELECT vl.dieciseisavos / MAX(vl.cantidad, 1) AS pedazo,
           SUM(vl.cantidad)      AS piezas,
           SUM(vl.dieciseisavos) AS dieciseisavos,
           COUNT(*)              AS renglones
      FROM venta_lineas vl
      JOIN ventas v ON v.id = vl.venta_id
     WHERE v.cancelada_en IS NULL
       AND v.almacen_id = ?
       AND v.fecha > ? AND v.fecha <= ?
       AND vl.dieciseisavos > 0
     GROUP BY pedazo
     ORDER BY pedazo DESC
  `).all(almacenId, desde || '', hasta)
    .map((f) => ({ ...f, texto: aTexto(f.pedazo) }));
}

/**
 * CUÁNTO SALIÓ A PRECIO DE MAYOREO Y CUÁNTO AL PÚBLICO.
 *
 * Son dos negocios distintos —el mostrador de a cuarto y el que se lleva
 * veinte marquetas— y ver cuánto pesa cada uno es la mitad de saber cómo
 * va la fábrica. Se parte por el TIPO de la lista con la que se cobró.
 */
function porTipoDeLista({ desde, hasta, almacenId }) {
  return bd.prepare(`
    SELECT COALESCE(lp.tipo, 'publico')          AS tipo,
           COALESCE(v.lista_nombre, 'Público')   AS lista,
           SUM(vl.dieciseisavos)                 AS dieciseisavos,
           COUNT(DISTINCT v.id)                  AS tickets
      FROM venta_lineas vl
      JOIN ventas v ON v.id = vl.venta_id
      LEFT JOIN listas_precios lp ON lp.id = v.lista_id
     WHERE v.cancelada_en IS NULL
       AND v.almacen_id = ?
       AND v.fecha > ? AND v.fecha <= ?
       AND vl.dieciseisavos > 0
     GROUP BY tipo, lista
     ORDER BY SUM(vl.dieciseisavos) DESC
  `).all(almacenId, desde || '', hasta);
}

/** Lo que se derritió, se rompió o se regaló en la ventana. */
function mermasEntre({ desde, hasta, almacenId }) {
  return bd.prepare(`
    SELECT m.motivo, SUM(m.dieciseisavos) AS dieciseisavos, COUNT(*) AS veces
      FROM mermas_hielo m
     WHERE m.almacen_id = ? AND m.anulada_en IS NULL
       AND m.fecha > ? AND m.fecha <= ?
     GROUP BY m.motivo
     ORDER BY SUM(m.dieciseisavos) DESC
  `).all(almacenId, desde || '', hasta);
}

/**
 * EL CUADRE COMPLETO DEL HIELO DE UN TURNO.
 *
 * Devuelve `null` cuando ese turno no contó hielo: sin conteo no hay
 * cuadre, y enseñar un papel de hielo con todo en cero haría creer que se
 * contó y salió cero.
 */
/** Lo que decía el cuadre cuando se firmó, para enseñarlo junto a lo de ahora. */
function corregidoDe(conteo, faltanteAhora) {
  let faltanteAntes = null;
  try {
    const o = JSON.parse(conteo.original || 'null');
    if (o) {
      const esperado = conteo.existencia_anterior + o.producido - o.vendido - o.merma
                       - o.cortado + (o.guardado || 0) - (o.recogido || 0);
      faltanteAntes = esperado - conteo.contado;
    }
  } catch { faltanteAntes = null; }
  const quien = conteo.corregido_por
    ? bd.prepare('SELECT nombre FROM usuarios WHERE id = ?').get(conteo.corregido_por)?.nombre
    : null;
  return {
    en: conteo.corregido_en, por: quien || null, motivo: conteo.motivo_correccion,
    veces: conteo.correcciones, faltanteAntes, faltanteAhora
  };
}

function cuadreDeHielo(cajaId) {
  const conteo = conteoDelTurno(cajaId);
  if (!conteo) return null;

  const ventana = { desde: conteo.desde, hasta: conteo.fecha, almacenId: conteo.almacen_id };

  // Lo que TENÍA que haber, y lo que faltó. Todo de la fila congelada.
  const teorico = conteo.existencia_anterior + conteo.producido;
  // Lo encomendado va en las dos direcciones: lo que se vendió pero se
  // quedó guardado SUMA (sigue en el cuarto), y lo que un cliente vino a
  // recoger de una venta vieja RESTA (salió, pero se vendió antes).
  const esperado = teorico - conteo.vendido - conteo.merma - conteo.cortado
                   + (conteo.guardado || 0) - (conteo.recogido || 0);
  // El faltante es lo que NADIE explicó: ni la caja, ni lo derretido, ni
  // lo que se cortó. Ese es el número que hay que vigilar.
  const faltante = esperado - conteo.contado;

  const cortes = cortesDelTurno(cajaId);

  return {
    conteo,
    almacen: conteo.almacen_nombre,
    desde: conteo.desde,
    hasta: conteo.fecha,
    // Sin conteo anterior, "lo que había" es cero porque nunca se contó,
    // no porque el cuarto estuviera vacío. Hay que poder decirlo.
    primerConteo: !conteo.desde,

    cuadre: {
      anterior: conteo.existencia_anterior,
      producido: conteo.producido,
      teorico,
      vendido: conteo.vendido,
      merma: conteo.merma,
      cortado: conteo.cortado,
      guardado: conteo.guardado || 0,
      recogido: conteo.recogido || 0,
      esperado,
      contado: conteo.contado,
      faltante
    },

    // SI SE CORRIGIÓ (v6.1): con qué faltante se firmó y quién lo cambió.
    corregido: conteo.corregido_en ? corregidoDe(conteo, esperado - conteo.contado) : null,

    panos: panosEntre(conteo.desde, conteo.fecha),
    produccion: resumenEntre(conteo.desde, conteo.fecha),
    pedazos: pedazosVendidos(ventana),
    listas: porTipoDeLista(ventana),
    mermas: mermasEntre(ventana),
    cortes: cortes.map((c) => ({ ...c, texto: aTexto(c.dieciseisavos) }))
  };
}

module.exports = { cuadreDeHielo, conteoDelTurno };
