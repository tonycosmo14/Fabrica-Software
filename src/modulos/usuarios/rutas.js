/**
 * Administracion de usuarios. Solo el admin entra aqui.
 * REGLA DE ORO 3.4 — Nada se borra: se marca inactivo con fecha de baja.
 */
const express = require('express');
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');
const { hashear, esPinValido } = require('../../lib/seguridad');
const { ROLES } = require('../../lib/roles');
const { ok, error } = require('../../lib/respuestas');
const bitacora = require('../../lib/bitacora');
const { exigirPermiso } = require('../../middleware/sesion');

const router = express.Router();

// Todo este modulo requiere permiso de admin.
router.use(exigirPermiso('usuarios.administrar'));

const CAMPOS_PUBLICOS = `
  id, nombre, usuario, rol, activo, fecha_alta, fecha_baja,
  (pin_hash IS NOT NULL) AS tiene_pin,
  (contrasena_hash IS NOT NULL) AS tiene_contrasena
`;

/** Listar. Por defecto solo activos; ?incluirInactivos=1 muestra el historico. */
router.get('/', (req, res) => {
  const incluirInactivos = req.query.incluirInactivos === '1';
  const sql = `SELECT ${CAMPOS_PUBLICOS} FROM usuarios
               ${incluirInactivos ? '' : 'WHERE activo = 1'}
               ORDER BY activo DESC, nombre`;
  return ok(res, { usuarios: bd.prepare(sql).all() });
});

/** Alta. */
router.post('/', (req, res) => {
  const { nombre, rol, pin, usuario, contrasena } = req.body || {};

  if (!nombre || !String(nombre).trim()) return error(res, 'El nombre es obligatorio.');
  if (!ROLES.includes(rol)) return error(res, 'Rol inválido.');
  if (!esPinValido(pin)) return error(res, 'El PIN debe ser de 4 a 6 dígitos.');

  if (usuario && bd.prepare('SELECT 1 FROM usuarios WHERE usuario = ?').get(String(usuario).trim())) {
    return error(res, 'Ese nombre de usuario ya existe.');
  }
  if (rol === 'admin' && !contrasena) {
    return error(res, 'El administrador necesita usuario y contraseña además del PIN.');
  }
  if (contrasena && String(contrasena).length < 8) {
    return error(res, 'La contraseña debe tener al menos 8 caracteres.');
  }

  const id = nuevoId();
  const p = hashear(pin);
  const c = contrasena ? hashear(contrasena) : { hash: null, sal: null };

  bd.prepare(`
    INSERT INTO usuarios (id, nombre, usuario, rol, pin_hash, pin_sal,
                          contrasena_hash, contrasena_sal, activo, fecha_alta, creado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, String(nombre).trim(), usuario ? String(usuario).trim() : null, rol,
         p.hash, p.sal, c.hash, c.sal, ahora(), req.usuario.id);

  bitacora.registrar({
    accion: 'usuario.alta', entidad: 'usuario', entidadId: id,
    ejecutorId: req.usuario.id, detalle: { nombre, rol }
  });

  return ok(res, { usuario: bd.prepare(`SELECT ${CAMPOS_PUBLICOS} FROM usuarios WHERE id = ?`).get(id) }, 201);
});

/** Editar nombre y rol. El ID nunca cambia (regla 3.3). */
router.put('/:id', (req, res) => {
  const u = bd.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
  if (!u) return error(res, 'Usuario no encontrado.', 404);

  const { nombre, rol } = req.body || {};
  if (nombre !== undefined && !String(nombre).trim()) return error(res, 'El nombre no puede quedar vacío.');
  if (rol !== undefined && !ROLES.includes(rol)) return error(res, 'Rol inválido.');

  // No dejar al sistema sin ningun admin activo.
  if (rol && rol !== 'admin' && u.rol === 'admin') {
    const otros = bd.prepare("SELECT COUNT(*) n FROM usuarios WHERE rol='admin' AND activo=1 AND id <> ?").get(u.id).n;
    if (otros === 0) return error(res, 'Es el único administrador activo. Crea otro antes de cambiarle el rol.');
  }

  bd.prepare('UPDATE usuarios SET nombre = ?, rol = ? WHERE id = ?')
    .run(nombre !== undefined ? String(nombre).trim() : u.nombre, rol || u.rol, u.id);

  bitacora.registrar({
    accion: 'usuario.edicion', entidad: 'usuario', entidadId: u.id,
    ejecutorId: req.usuario.id, detalle: { antes: { nombre: u.nombre, rol: u.rol }, despues: { nombre, rol } }
  });

  return ok(res, { usuario: bd.prepare(`SELECT ${CAMPOS_PUBLICOS} FROM usuarios WHERE id = ?`).get(u.id) });
});

/** Cambiar PIN. */
router.post('/:id/pin', (req, res) => {
  const u = bd.prepare('SELECT id FROM usuarios WHERE id = ?').get(req.params.id);
  if (!u) return error(res, 'Usuario no encontrado.', 404);
  if (!esPinValido(req.body?.pin)) return error(res, 'El PIN debe ser de 4 a 6 dígitos.');

  const p = hashear(req.body.pin);
  bd.prepare('UPDATE usuarios SET pin_hash = ?, pin_sal = ? WHERE id = ?').run(p.hash, p.sal, u.id);

  bitacora.registrar({ accion: 'usuario.cambio_pin', entidad: 'usuario', entidadId: u.id, ejecutorId: req.usuario.id });
  return ok(res, { cambiado: true });
});

/** Cambiar contraseña. */
router.post('/:id/contrasena', (req, res) => {
  const u = bd.prepare('SELECT id, usuario FROM usuarios WHERE id = ?').get(req.params.id);
  if (!u) return error(res, 'Usuario no encontrado.', 404);
  const { contrasena } = req.body || {};
  if (!contrasena || String(contrasena).length < 8) return error(res, 'La contraseña debe tener al menos 8 caracteres.');
  if (!u.usuario) return error(res, 'Primero asígnale un nombre de usuario para poder entrar con contraseña.');

  const c = hashear(contrasena);
  bd.prepare('UPDATE usuarios SET contrasena_hash = ?, contrasena_sal = ? WHERE id = ?').run(c.hash, c.sal, u.id);

  bitacora.registrar({ accion: 'usuario.cambio_contrasena', entidad: 'usuario', entidadId: u.id, ejecutorId: req.usuario.id });
  return ok(res, { cambiado: true });
});

/** Baja (no borrado). Sus registros historicos siguen intactos. */
router.post('/:id/baja', (req, res) => {
  const u = bd.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
  if (!u) return error(res, 'Usuario no encontrado.', 404);
  if (!u.activo) return error(res, 'Ese usuario ya está dado de baja.');
  if (u.id === req.usuario.id) return error(res, 'No puedes darte de baja a ti mismo.');

  if (u.rol === 'admin') {
    const otros = bd.prepare("SELECT COUNT(*) n FROM usuarios WHERE rol='admin' AND activo=1 AND id <> ?").get(u.id).n;
    if (otros === 0) return error(res, 'Es el único administrador activo.');
  }

  bd.prepare('UPDATE usuarios SET activo = 0, fecha_baja = ? WHERE id = ?').run(ahora(), u.id);
  // Cierra sus sesiones abiertas en cualquier dispositivo.
  bd.prepare('UPDATE sesiones_dispositivo SET cerrada_en = ? WHERE usuario_id = ? AND cerrada_en IS NULL')
    .run(ahora(), u.id);

  bitacora.registrar({ accion: 'usuario.baja', entidad: 'usuario', entidadId: u.id, ejecutorId: req.usuario.id });
  return ok(res, { dadoDeBaja: true });
});

/** Reactivar. */
router.post('/:id/alta', (req, res) => {
  const u = bd.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
  if (!u) return error(res, 'Usuario no encontrado.', 404);

  bd.prepare('UPDATE usuarios SET activo = 1, fecha_baja = NULL WHERE id = ?').run(u.id);
  bitacora.registrar({ accion: 'usuario.reactivacion', entidad: 'usuario', entidadId: u.id, ejecutorId: req.usuario.id });
  return ok(res, { reactivado: true });
});

module.exports = router;
