/**
 * VOLVER A SACAR LOS NÚMEROS DE UN CONTEO YA HECHO  (v6.1)
 *
 * "Marqué un paño como hueco y era ahogado: el corte salió cinco marquetas
 *  y media corto, y el sistema no me dejaba corregirlo."
 *
 * Los números de un conteo se guardan CONGELADOS a propósito (regla 3.2 al
 * revés): son el papel que se firmó, y corregir una sacada vieja no debe
 * mover un corte sin que nadie lo pida. Pero cuando lo que se corrige es
 * justo lo que hizo que el corte saliera mal, dejar el papel intacto es
 * dejar escrito un faltante que no existió.
 *
 * Así que se vuelven a sacar de los registros, con los mismos cuidados que
 * el dinero (ver `recalcularCorte` en caja/calculo.js):
 *
 *   · LO CONTADO NO SE TOCA. Es lo que había en el cuarto frío cuando se
 *     contó, y eso no lo cambia ninguna captura posterior.
 *   · LO QUE DECÍA ANTES SE GUARDA, la primera vez, para poder enseñar las
 *     dos cifras.
 *   · EL CONTEO QUE SIGUE NO SE MUEVE: su "había" es lo contado aquí, que
 *     no cambió.
 */
const { bd } = require('../../db/conexion');
const { ahora } = require('../../lib/ids');
const calculo = require('./calculo');

/** Los números congelados de un conteo, tal como están en su fila. */
function numerosDe(c) {
  return {
    producido: c.producido, vendido: c.vendido, merma: c.merma,
    cortado: c.cortado, guardado: c.guardado || 0, recogido: c.recogido || 0,
    salidas: c.salidas
  };
}

/** Lo que debería haber quedado según unos números, y cuánto faltó. */
function faltanteCon(c, n) {
  const esperado = c.existencia_anterior + n.producido - n.vendido - n.merma
                   - n.cortado + (n.guardado || 0) - (n.recogido || 0);
  return { esperado, faltante: esperado - c.contado };
}

function recalcularConteo(conteoId, { usuarioId, motivo }) {
  const c = bd.prepare('SELECT * FROM conteos WHERE id = ? AND anulado_en IS NULL').get(conteoId);
  if (!c) return null;
  const almacen = bd.prepare('SELECT * FROM almacenes WHERE id = ?').get(c.almacen_id);
  if (!almacen) return null;

  const desde = c.desde || null;
  const hasta = c.fecha;
  const ahoraNumeros = {
    producido: almacen.recibe_produccion ? calculo.producidoDesde(desde, hasta) : 0,
    vendido: calculo.vendidoDesde(desde, almacen.id, hasta),
    merma: calculo.mermaDesde(desde, almacen.id, hasta),
    cortado: calculo.cortadoDesde(desde, almacen.id, hasta),
    guardado: calculo.guardadoDesde(desde, almacen.id, hasta),
    recogido: calculo.recogidoDesde(desde, almacen.id, hasta)
  };
  ahoraNumeros.salidas = c.existencia_anterior + ahoraNumeros.producido - c.contado;

  const antes = numerosDe(c);
  const original = c.original ? JSON.parse(c.original) : antes;

  bd.prepare(`
    UPDATE conteos SET
      original = COALESCE(original, ?),
      producido = ?, vendido = ?, merma = ?, cortado = ?, guardado = ?, recogido = ?,
      salidas = ?, corregido_en = ?, corregido_por = ?, motivo_correccion = ?,
      correcciones = correcciones + 1
    WHERE id = ?
  `).run(JSON.stringify(antes),
         ahoraNumeros.producido, ahoraNumeros.vendido, ahoraNumeros.merma,
         ahoraNumeros.cortado, ahoraNumeros.guardado, ahoraNumeros.recogido,
         ahoraNumeros.salidas, ahora(), usuarioId, String(motivo || '').slice(0, 200), c.id);

  return {
    id: c.id, cajaId: c.caja_id, almacen: almacen.nombre, fecha: c.fecha,
    antes: { ...antes, ...faltanteCon(c, antes) },
    original: { ...original, ...faltanteCon(c, original) },
    ahora: { ...ahoraNumeros, ...faltanteCon(c, ahoraNumeros) }
  };
}

/**
 * Los conteos vivos cuya ventana abarca un momento: del conteo anterior
 * (exclusivo) a ellos (inclusivo). Casi siempre es uno o ninguno.
 */
function conteosQueAbarcan(fecha, almacenId = null) {
  return bd.prepare(`
    SELECT * FROM conteos
     WHERE anulado_en IS NULL
       AND (desde IS NULL OR desde < ?)
       AND fecha >= ?
       AND (? IS NULL OR almacen_id = ?)
     ORDER BY fecha
  `).all(fecha, fecha, almacenId, almacenId);
}

/** Vuelve a sacar todos los conteos que abarcan ese momento. */
function corregirConteosQueAbarcan(fecha, { usuarioId, motivo, almacenId = null }) {
  return conteosQueAbarcan(fecha, almacenId)
    .map((c) => recalcularConteo(c.id, { usuarioId, motivo }))
    .filter(Boolean);
}

module.exports = { recalcularConteo, conteosQueAbarcan, corregirConteosQueAbarcan, faltanteCon };
