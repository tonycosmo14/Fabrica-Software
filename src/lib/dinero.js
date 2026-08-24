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

/**
 * Lee lo que TECLEÓ una persona y lo pasa a centavos. null si no es dinero.
 *
 * Esto existe porque limpiar a la brava —quitarle a la cadena todo lo que
 * no sea dígito— ya causó tres errores del mismo tipo: "mucho" se quedaba
 * en "" y se leía como 0, y "-500" perdía el signo y se leía como 500. Un
 * cero que nadie escribió es peor que un error: apaga límites, apaga avisos
 * y nadie se entera.
 *
 * Se acepta lo que de verdad teclea la gente: "1,200.50", " 80 ", "$45".
 * Lo demás se rechaza y la pantalla lo dice.
 */
function leerPesos(texto, { permitirCero = false, maximo = 100000000 } = {}) {
  if (texto === undefined || texto === null) return null;

  const limpio = String(texto).trim()
    .replace(/^\$/, '')        // el signo de pesos que a veces se teclea
    .replace(/,/g, '');        // los miles

  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;

  const centavos = Math.round(Number(limpio) * 100);
  if (!Number.isInteger(centavos) || centavos > maximo) return null;
  if (!permitirCero && centavos === 0) return null;
  return centavos;
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

module.exports = { aCentavos, leerPesos, aPesos, formato };
