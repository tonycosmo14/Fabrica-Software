/**
 * PIN y contraseñas.
 * Nunca se guarda el PIN en claro: se guarda un hash con sal (scrypt).
 * Se usa el modulo crypto que ya trae Node, sin librerias externas.
 */
const crypto = require('node:crypto');

const LARGO_SAL = 16;
const LARGO_HASH = 64;

function hashear(texto) {
  const sal = crypto.randomBytes(LARGO_SAL).toString('hex');
  const hash = crypto.scryptSync(String(texto), sal, LARGO_HASH).toString('hex');
  return { hash, sal };
}

function verificar(texto, hashGuardado, sal) {
  if (!hashGuardado || !sal) return false;
  const hash = crypto.scryptSync(String(texto), sal, LARGO_HASH).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(hashGuardado, 'hex');
  if (a.length !== b.length) return false;
  // Comparacion en tiempo constante: no revela informacion por el tiempo de respuesta.
  return crypto.timingSafeEqual(a, b);
}

/** Token de sesion para el dispositivo. */
function nuevoToken() {
  return crypto.randomBytes(32).toString('hex');
}

/** En la base solo se guarda el hash del token, no el token. */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Un PIN valido es de 4 a 6 digitos, nada mas. */
function esPinValido(pin) {
  return /^[0-9]{4,6}$/.test(String(pin || ''));
}

module.exports = { hashear, verificar, nuevoToken, hashToken, esPinValido };
