/**
 * Datos iniciales. Solo corren si la base esta vacia de usuarios.
 * Crea el primer administrador para que alguien pueda entrar.
 */
const { bd } = require('./db/conexion');
const { nuevoId, ahora } = require('./lib/ids');
const { hashear } = require('./lib/seguridad');
const config = require('./config');

function sembrar() {
  const hay = bd.prepare('SELECT COUNT(*) n FROM usuarios').get().n;
  if (hay > 0) return null;

  const { nombre, usuario, contrasena, pin } = config.ADMIN_INICIAL;
  const id = nuevoId();
  const p = hashear(pin);
  const c = hashear(contrasena);

  bd.prepare(`
    INSERT INTO usuarios (id, nombre, usuario, rol, pin_hash, pin_sal,
                          contrasena_hash, contrasena_sal, activo, fecha_alta)
    VALUES (?, ?, ?, 'admin', ?, ?, ?, ?, 1, ?)
  `).run(id, nombre, usuario, p.hash, p.sal, c.hash, c.sal, ahora());

  return { usuario, contrasena, pin };
}

module.exports = { sembrar };
