/**
 * DINERO
 *
 * Se guarda en CENTAVOS enteros, por la misma razón que el hielo se guarda
 * en dieciseisavos: con decimales, los centavos se pierden en el redondeo y
 * al final del mes el corte no cuadra por unos pesos que nadie encuentra.
 *
 * $264.00  ->  26400
 */

/** De pesos (lo que teclea el usuario) a centavos. */
function aCentavos(pesos) {
  const n = Number(pesos);
  if (!Number.isFinite(n) || n < 0) throw new Error('Importe inválido.');
  return Math.round(n * 100);
}

/** De centavos a pesos, para mostrar. */
function aPesos(centavos) {
  return (Number(centavos) || 0) / 100;
}

/** Formato mexicano: $1,234.50 */
function formato(centavos) {
  return aPesos(centavos).toLocaleString('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 2
  });
}

module.exports = { aCentavos, aPesos, formato };
