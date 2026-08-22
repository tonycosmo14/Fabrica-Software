/**
 * Roles y permisos (seccion 4 del plan).
 * Un permiso es una etiqueta corta. Las rutas piden permisos, no roles,
 * asi agregar un rol nuevo despues no obliga a tocar todas las rutas.
 */

const ROLES = ['operario', 'cajero', 'repartidor', 'admin'];

const PERMISOS_POR_ROL = {
  operario: ['produccion.ver', 'produccion.registrar'],
  cajero: [
    'produccion.ver',
    'produccion.registrar',
    'caja.ver',
    'caja.operar',
    'venta.registrar'
  ],
  repartidor: ['reparto.ver', 'reparto.operar'],
  admin: ['*'] // el comodin abre todo
};

const ETIQUETAS_ROL = {
  operario: 'Operario',
  cajero: 'Cajero',
  repartidor: 'Repartidor',
  admin: 'Administrador'
};

function permisosDe(rol) {
  return PERMISOS_POR_ROL[rol] || [];
}

function puede(rol, permiso) {
  const permisos = permisosDe(rol);
  return permisos.includes('*') || permisos.includes(permiso);
}

module.exports = { ROLES, ETIQUETAS_ROL, PERMISOS_POR_ROL, permisosDe, puede };
