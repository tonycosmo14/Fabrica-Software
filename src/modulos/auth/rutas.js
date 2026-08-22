/**
 * Entrada al sistema.
 *  - Operarios, cajeros y repartidores: tocan su nombre y escriben su PIN.
 *  - Admin: tambien puede entrar con usuario y contraseña.
 */
const express = require('express');
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');
const { verificar, nuevoToken, hashToken } = require('../../lib/seguridad');
const { permisosDe } = require('../../lib/roles');
const { ok, error } = require('../../lib/respuestas');
const bitacora = require('../../lib/bitacora');
const { exigirSesion, ponerCookie, borrarCookie, NOMBRE_COOKIE } = require('../../middleware/sesion');
const config = require('../../config');

const router = express.Router();

/** Lista de caras para la pantalla de entrada. Publica a proposito: solo nombres. */
router.get('/usuarios-disponibles', (req, res) => {
  const filas = bd.prepare(`
    SELECT id, nombre, rol FROM usuarios
    WHERE activo = 1 AND pin_hash IS NOT NULL
    ORDER BY nombre
  `).all();
  return ok(res, { usuarios: filas });
});

function crearSesion(res, usuario, dispositivo) {
  const token = nuevoToken();
  const expira = new Date(Date.now() + config.DIAS_SESION * 86400000).toISOString();

  bd.prepare(`
    INSERT INTO sesiones_dispositivo (id, usuario_id, token_hash, creada_en, expira_en, dispositivo)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(nuevoId(), usuario.id, hashToken(token), ahora(), expira, dispositivo || null);

  ponerCookie(res, token, config.DIAS_SESION);
}

function datosSesion(usuario) {
  return {
    usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
    permisos: permisosDe(usuario.rol)
  };
}

/** Entrar con PIN. */
router.post('/entrar-pin', (req, res) => {
  const { usuarioId, pin } = req.body || {};
  if (!usuarioId || !pin) return error(res, 'Falta el usuario o el PIN.');

  const u = bd.prepare('SELECT * FROM usuarios WHERE id = ? AND activo = 1').get(usuarioId);
  if (!u || !verificar(pin, u.pin_hash, u.pin_sal)) {
    return error(res, 'PIN incorrecto.', 401);
  }

  crearSesion(res, u, req.headers['user-agent']);
  bitacora.registrar({ accion: 'sesion.inicio', entidad: 'usuario', entidadId: u.id, ejecutorId: u.id, detalle: { via: 'pin' } });
  return ok(res, datosSesion(u));
});

/** Entrar con usuario y contraseña (admin). */
router.post('/entrar-contrasena', (req, res) => {
  const { usuario, contrasena } = req.body || {};
  if (!usuario || !contrasena) return error(res, 'Falta el usuario o la contraseña.');

  const u = bd.prepare('SELECT * FROM usuarios WHERE usuario = ? AND activo = 1').get(String(usuario).trim());
  if (!u || !verificar(contrasena, u.contrasena_hash, u.contrasena_sal)) {
    return error(res, 'Usuario o contraseña incorrectos.', 401);
  }

  crearSesion(res, u, req.headers['user-agent']);
  bitacora.registrar({ accion: 'sesion.inicio', entidad: 'usuario', entidadId: u.id, ejecutorId: u.id, detalle: { via: 'contrasena' } });
  return ok(res, datosSesion(u));
});

/** Quien soy. El frontend lo llama al abrir para saber si ya hay sesion. */
router.get('/yo', (req, res) => {
  if (!req.usuario) return ok(res, { usuario: null, permisos: [] });
  return ok(res, datosSesion(req.usuario));
});

/** Salir. Cierra la sesion de ESTE dispositivo, no las demas. */
router.post('/salir', exigirSesion, (req, res) => {
  bd.prepare('UPDATE sesiones_dispositivo SET cerrada_en = ? WHERE id = ?')
    .run(ahora(), req.usuario.sesionId);
  borrarCookie(res);
  bitacora.registrar({ accion: 'sesion.fin', entidad: 'usuario', entidadId: req.usuario.id, ejecutorId: req.usuario.id });
  return ok(res, { salio: true });
});

module.exports = router;
