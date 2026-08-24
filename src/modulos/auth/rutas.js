/**
 * Entrada al sistema.
 *  - Operarios, cajeros y repartidores: tocan su nombre y escriben su PIN.
 *  - Admin: tambien puede entrar con usuario y contraseña.
 */
const express = require('express');
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');
const { hashear, verificar, nuevoToken, hashToken, esPinValido } = require('../../lib/seguridad');
const { permisosDe } = require('../../lib/roles');
const { ok, error } = require('../../lib/respuestas');
const bitacora = require('../../lib/bitacora');
const { abrirTurnoSiHaceFalta } = require('../caja/turno');
const { exigirSesion, ponerCookie, borrarCookie, NOMBRE_COOKIE } = require('../../middleware/sesion');
const config = require('../../config');

const router = express.Router();

function hayUsuarios() {
  return bd.prepare('SELECT COUNT(*) n FROM usuarios').get().n > 0;
}

/**
 * ¿El sistema ya esta configurado?
 * Si la base esta vacia, la aplicacion muestra el asistente de primer
 * arranque en vez de la pantalla de entrada.
 */
router.get('/estado-inicial', (req, res) =>
  ok(res, { configurado: hayUsuarios() }));

/**
 * PRIMER ARRANQUE — crear la cuenta del administrador.
 *
 * El sistema NO trae ningun usuario de fabrica: un PIN por omision seria
 * una puerta trasera que nadie se acuerda de cerrar. La primera cuenta la
 * crea quien enciende el sistema, y esta ruta solo funciona mientras no
 * exista ningun usuario.
 */
router.post('/configuracion-inicial', (req, res) => {
  if (hayUsuarios()) {
    return error(res, 'El sistema ya está configurado.', 409);
  }

  const { nombre, usuario, contrasena, pin } = req.body || {};

  if (!nombre || !String(nombre).trim()) return error(res, 'Escribe tu nombre.');
  if (!usuario || !/^[a-zA-Z0-9._-]{3,20}$/.test(String(usuario).trim())) {
    return error(res, 'El usuario debe tener de 3 a 20 caracteres, sin espacios ni acentos.');
  }
  if (!contrasena || String(contrasena).length < 8) {
    return error(res, 'La contraseña debe tener al menos 8 caracteres.');
  }
  if (!esPinValido(pin)) return error(res, 'El PIN debe ser de 4 a 6 dígitos.');

  const id = nuevoId();
  const p = hashear(pin);
  const c = hashear(contrasena);

  bd.prepare(`
    INSERT INTO usuarios (id, nombre, usuario, rol, pin_hash, pin_sal,
                          contrasena_hash, contrasena_sal, activo, fecha_alta)
    VALUES (?, ?, ?, 'admin', ?, ?, ?, ?, 1, ?)
  `).run(id, String(nombre).trim(), String(usuario).trim().toLowerCase(),
         p.hash, p.sal, c.hash, c.sal, ahora());

  const creado = bd.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);

  crearSesion(res, creado, req.headers['user-agent']);
  bitacora.registrar({
    accion: 'sistema.configuracion_inicial', entidad: 'usuario', entidadId: id,
    ejecutorId: id, detalle: { nombre: creado.nombre }
  });

  return ok(res, datosSesion(creado), 201);
});

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

function datosSesion(usuario, turno) {
  return {
    usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
    permisos: permisosDe(usuario.rol),
    // Quien entra y maneja dinero abre turno de caja con el mismo PIN.
    caja: turno ? { folio: turno.folio, cajero: turno.cajero_nombre } : null
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
  // Teclear el PIN es la señal de que el cajero que entra ya llegó: aquí sí
  // se adopta el turno que quedó esperando dueño.
  return ok(res, datosSesion(u, abrirTurnoSiHaceFalta(u, { adoptar: true })));
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
  return ok(res, datosSesion(u, abrirTurnoSiHaceFalta(u, { adoptar: true })));
});

/**
 * Quién soy. El frontend lo llama al abrir para saber si ya hay sesión.
 *
 * Aquí también se ABRE el turno: la sesión dura 30 días, así que la mayoría
 * de las mañanas nadie vuelve a teclear el PIN. Si el turno solo se abriera
 * al teclearlo, el primer día se abriría y los siguientes no.
 *
 * Pero NO se ADOPTA el que quedó esperando dueño. Refrescar la pantalla no
 * es que haya llegado nadie: si adoptara, el cajero que acaba de entregar
 * su turno se lo volvería a quedar sin darse cuenta.
 */
router.get('/yo', (req, res) => {
  if (!req.usuario) return ok(res, { usuario: null, permisos: [] });
  return ok(res, datosSesion(req.usuario, abrirTurnoSiHaceFalta(req.usuario)));
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
