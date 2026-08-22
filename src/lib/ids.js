/**
 * Regla de oro 3.3: IDs internos estables, nombres editables.
 * Todo lo que exista en la base nace con un UUID que jamas cambia.
 */
const { randomUUID } = require('node:crypto');

function nuevoId() {
  return randomUUID();
}

/** Fecha y hora en formato ISO. Todo el sistema guarda tiempo asi. */
function ahora() {
  return new Date().toISOString();
}

module.exports = { nuevoId, ahora };
