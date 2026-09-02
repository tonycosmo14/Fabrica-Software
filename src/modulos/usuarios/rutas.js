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

/**
 * LO QUE CADA QUIEN HA HECHO  (v3.8)
 *
 * La pantalla de usuarios enseñaba nombre, rol y nada más, y con eso no se
 * puede contestar ninguna de las preguntas que uno se hace mirándola:
 * ¿quién entró esta semana?, ¿este cajero sigue trabajando aquí?, ¿cuánto
 * lleva Chuy en la fábrica? Aquí se juntan esos datos.
 *
 * Va en consultas aparte y agrupadas —no una por usuario— porque con
 * quince empleados serían sesenta consultas para pintar una lista.
 *
 * Se cuenta el ÚLTIMO MES CORRIDO (treinta días hacia atrás), no el mes
 * del negocio: la pregunta es "¿está trabajando?", no "¿cuánto lleva este
 * periodo?", y un día 2 del mes todos aparecerían en cero.
 */
function actividadDeTodos() {
  const treintaDias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const porUsuario = new Map();
  const meter = (id, campo, valor) => {
    if (!id) return;
    if (!porUsuario.has(id)) porUsuario.set(id, {});
    porUsuario.get(id)[campo] = valor;
  };

  // La última vez que entró al sistema. Es el dato que contesta "¿este
  // usuario sigue sirviendo para algo o quedó de un empleado que se fue?".
  for (const f of bd.prepare(`
    SELECT usuario_id, MAX(creada_en) ultima
      FROM sesiones_dispositivo GROUP BY usuario_id
  `).all()) meter(f.usuario_id, 'ultimaEntrada', f.ultima);

  // Lo que vendió, como cajero del turno (no como capturista): es de quien
  // era el turno, que es lo que se mira.
  for (const f of bd.prepare(`
    SELECT cajero_id, COUNT(*) cuantas, COALESCE(SUM(total_centavos), 0) centavos,
           MAX(fecha) ultima
      FROM ventas
     WHERE cancelada_en IS NULL AND fecha >= ?
     GROUP BY cajero_id
  `).all(treintaDias)) {
    meter(f.cajero_id, 'ventas', f.cuantas);
    meter(f.cajero_id, 'vendidoCentavos', f.centavos);
    meter(f.cajero_id, 'ultimaVenta', f.ultima);
  }

  // Los turnos de caja que abrió.
  for (const f of bd.prepare(`
    SELECT cajero_id, COUNT(*) cuantos FROM cajas
     WHERE abierta_en >= ? GROUP BY cajero_id
  `).all(treintaDias)) meter(f.cajero_id, 'turnos', f.cuantos);

  // Los paños que sacó. Cuenta el EJECUTOR: el que metió las manos al
  // tanque, no el que lo capturó desde la caja (regla 3.6).
  for (const f of bd.prepare(`
    SELECT ejecutor_id, COUNT(*) cuantos, MAX(iniciada_en) ultima
      FROM sacadas_pano
     WHERE iniciada_en >= ? AND (notas IS NULL OR notas NOT LIKE 'ANULADA%')
     GROUP BY ejecutor_id
  `).all(treintaDias)) {
    meter(f.ejecutor_id, 'panos', f.cuantos);
    meter(f.ejecutor_id, 'ultimoPano', f.ultima);
  }

  return porUsuario;
}

/** Listar. Por defecto solo activos; ?incluirInactivos=1 muestra el historico. */
router.get('/', (req, res) => {
  const incluirInactivos = req.query.incluirInactivos === '1';
  const sql = `SELECT ${CAMPOS_PUBLICOS} FROM usuarios
               ${incluirInactivos ? '' : 'WHERE activo = 1'}
               ORDER BY activo DESC, nombre`;
  const usuarios = bd.prepare(sql).all();

  // La actividad solo se calcula si la piden: la pantalla de usuarios la
  // quiere, pero hay otras que solo necesitan la lista de nombres.
  if (req.query.actividad !== '1') return ok(res, { usuarios });

  const actividad = actividadDeTodos();
  return ok(res, {
    desdeCuando: 30,
    usuarios: usuarios.map((u) => ({ ...u, actividad: actividad.get(u.id) || {} }))
  });
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
