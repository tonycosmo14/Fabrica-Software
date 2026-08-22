/**
 * Sesion del dispositivo.
 * El token viaja en una cookie httpOnly: el navegador la manda sola y
 * el JavaScript de la pagina no puede leerla (mas seguro).
 */
const { bd } = require('../db/conexion');
const { hashToken } = require('../lib/seguridad');
const { puede } = require('../lib/roles');
const { error } = require('../lib/respuestas');

const NOMBRE_COOKIE = 'sesion_fabrica';

function leerCookies(req) {
  const crudo = req.headers.cookie || '';
  const salida = {};
  for (const parte of crudo.split(';')) {
    const i = parte.indexOf('=');
    if (i === -1) continue;
    salida[parte.slice(0, i).trim()] = decodeURIComponent(parte.slice(i + 1).trim());
  }
  return salida;
}

function ponerCookie(res, token, dias) {
  const segundos = dias * 24 * 60 * 60;
  res.setHeader('Set-Cookie',
    `${NOMBRE_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${segundos}`);
}

function borrarCookie(res) {
  res.setHeader('Set-Cookie', `${NOMBRE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/**
 * Se ejecuta en TODAS las peticiones: si hay sesion valida, deja al usuario
 * en req.usuario. No bloquea nada por si solo.
 */
function cargarUsuario(req, res, next) {
  req.usuario = null;
  const token = leerCookies(req)[NOMBRE_COOKIE];
  if (!token) return next();

  const fila = bd.prepare(`
    SELECT s.id AS sesion_id, s.expira_en, u.*
    FROM sesiones_dispositivo s
    JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.token_hash = ? AND s.cerrada_en IS NULL
  `).get(hashToken(token));

  if (!fila) return next();
  if (new Date(fila.expira_en) < new Date()) return next(); // sesion vencida
  if (!fila.activo) return next();                          // usuario dado de baja

  req.usuario = {
    id: fila.id,
    nombre: fila.nombre,
    usuario: fila.usuario,
    rol: fila.rol,
    sesionId: fila.sesion_id
  };
  next();
}

/** Bloquea la ruta si no hay sesion. */
function exigirSesion(req, res, next) {
  if (!req.usuario) return error(res, 'Necesitas iniciar sesión.', 401);
  next();
}

/** Bloquea la ruta si el rol no tiene el permiso. */
function exigirPermiso(permiso) {
  return (req, res, next) => {
    if (!req.usuario) return error(res, 'Necesitas iniciar sesión.', 401);
    if (!puede(req.usuario.rol, permiso)) {
      return error(res, 'Tu rol no tiene acceso a esta operación.', 403);
    }
    next();
  };
}

module.exports = {
  NOMBRE_COOKIE,
  cargarUsuario,
  exigirSesion,
  exigirPermiso,
  ponerCookie,
  borrarCookie
};
