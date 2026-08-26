/**
 * EL NÚMERO DEL TICKET  (v2.2)
 *
 * Lo que se dice en voz alta: "el 2026-412".
 *
 * Por dentro cada venta tiene DOS números y conviene no confundirlos:
 *
 *   folio        el de siempre. Nunca se reinicia, nunca se repite, y es
 *                lo que amarra un cambio con otro y un ticket con su corte.
 *                Es la identidad; no se enseña.
 *
 *   serie +      el año y el número dentro del año. Es lo que se imprime,
 *   folio_anual  lo que se busca y lo que el cliente dice por teléfono. El
 *                1 de enero vuelve a empezar en 1.
 *
 * Separarlos es lo que permite reiniciar la cuenta cada año sin tocarle la
 * identidad a papeles que ya se firmaron.
 */

/** El año del reloj de la FÁBRICA, no el de UTC. */
function serieDeHoy(bd) {
  // El 31 de diciembre a las 7 de la tarde en Yucatán ya es 1 de enero en
  // UTC. Sin 'localtime', la serie nueva empezaría un día antes.
  return Number(bd.prepare("SELECT strftime('%Y', 'now', 'localtime') a").get().a);
}

/** El siguiente número dentro de un año. Se toma dentro de la transacción. */
function siguienteEnLaSerie(bd, serie) {
  return bd.prepare(
    'SELECT COALESCE(MAX(folio_anual), 0) n FROM ventas WHERE serie = ?'
  ).get(serie).n + 1;
}

/**
 * Cómo se escribe: "2026-412".
 *
 * Los tickets de antes de la v2.2 no tienen serie —la migración se la puso,
 * pero por si acaso— y caen al folio de siempre.
 */
function numeroDeTicket(venta) {
  if (!venta) return '';
  if (venta.serie && venta.folio_anual) return `${venta.serie}-${venta.folio_anual}`;
  return String(venta.folio ?? '');
}

/**
 * Lee lo que alguien escribió buscando un ticket.
 *
 * Se acepta como lo diga: "2026-412", "412", "#412". Un número suelto es el
 * de la serie —es lo que la gente tiene en la mano— y también se prueba
 * contra el folio de siempre, por si alguien se sabe ese.
 */
function leerNumero(texto) {
  const t = String(texto ?? '').trim().replace(/^#/, '');
  if (!t) return null;

  const conSerie = t.match(/^(\d{4})\s*-\s*(\d{1,9})$/);
  if (conSerie) return { serie: Number(conSerie[1]), folioAnual: Number(conSerie[2]) };

  if (/^\d{1,9}$/.test(t)) return { folioAnual: Number(t), folio: Number(t) };
  return null;
}

module.exports = { serieDeHoy, siguienteEnLaSerie, numeroDeTicket, leerNumero };
