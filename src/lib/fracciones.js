/**
 * REGLA DE ORO 3.1 — La unidad atomica del hielo es 1/16 de marqueta.
 *
 * En la base de datos NUNCA se guardan decimales: se guardan dieciseisavos
 * enteros. 1 marqueta = 16, 1/2 = 8, 1/4 = 4, 1/8 = 2, 1/16 = 1.
 *
 * Este archivo es el unico lugar del sistema autorizado a convertir entre
 * "lo que ve el usuario" (3/8) y "lo que guarda la base" (6).
 *
 * Se construye desde la v0.1 aunque el punto de venta llegue en la v0.3,
 * porque despues seria un parche.
 */

const DIECISEISAVOS_POR_MARQUETA = 16;

/** Fracciones que existen como boton en el teclado del punto de venta. */
const FRACCIONES = [
  { etiqueta: '1', dieciseisavos: 16 },
  { etiqueta: '1/2', dieciseisavos: 8 },
  { etiqueta: '1/4', dieciseisavos: 4 },
  { etiqueta: '1/8', dieciseisavos: 2 },
  { etiqueta: '1/16', dieciseisavos: 1 }
];

/** Maximo comun divisor, para reducir la fraccion antes de mostrarla. */
function mcd(a, b) {
  return b === 0 ? a : mcd(b, a % b);
}

/**
 * Convierte dieciseisavos a texto legible.
 *   6  -> "3/8"
 *   16 -> "1"
 *   20 -> "1 1/4"
 *   0  -> "0"
 */
function aTexto(dieciseisavos) {
  const n = Math.trunc(Number(dieciseisavos) || 0);
  if (n === 0) return '0';

  const signo = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const enteros = Math.floor(abs / DIECISEISAVOS_POR_MARQUETA);
  const resto = abs % DIECISEISAVOS_POR_MARQUETA;

  if (resto === 0) return `${signo}${enteros}`;

  const d = mcd(resto, DIECISEISAVOS_POR_MARQUETA);
  const fraccion = `${resto / d}/${DIECISEISAVOS_POR_MARQUETA / d}`;

  return enteros === 0 ? `${signo}${fraccion}` : `${signo}${enteros} ${fraccion}`;
}

/**
 * Convierte marquetas completas a dieciseisavos.
 * Solo acepta enteros: si alguien intenta pasar 1.5 marquetas es un error de
 * programacion, no un caso valido.
 */
function deMarquetas(marquetas) {
  if (!Number.isInteger(marquetas)) {
    throw new Error('Las marquetas se cuentan en enteros. Usa dieciseisavos para las partes.');
  }
  return marquetas * DIECISEISAVOS_POR_MARQUETA;
}

/** Valida que un valor sea un numero entero de dieciseisavos. */
function validar(dieciseisavos) {
  if (!Number.isInteger(dieciseisavos)) {
    throw new Error(`Cantidad inválida: ${dieciseisavos}. El hielo se guarda en dieciseisavos enteros.`);
  }
  return dieciseisavos;
}

/** Suma una lista de fracciones tocadas en el teclado. */
function sumar(lista) {
  return lista.reduce((total, n) => total + validar(n), 0);
}

module.exports = {
  DIECISEISAVOS_POR_MARQUETA,
  FRACCIONES,
  aTexto,
  deMarquetas,
  validar,
  sumar
};
