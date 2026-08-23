/**
 * Roles y permisos (seccion 4 del plan).
 * Un permiso es una etiqueta corta. Las rutas piden permisos, no roles,
 * asi agregar un rol nuevo despues no obliga a tocar todas las rutas.
 */

const ROLES = ['operario', 'cajero', 'repartidor', 'gerente', 'admin'];

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

  // El gerente de turno: todo lo del cajero, más autorizar lo que se sale
  // de la regla (sacar un paño fuera de orden) y corregir errores.
  gerente: [
    'produccion.ver',
    'produccion.registrar',
    'produccion.autorizar',
    'produccion.corregir',
    'caja.ver',
    'caja.operar',
    'venta.registrar',
    'reparto.ver'
  ],
  admin: ['*'] // el comodin abre todo
};

const ETIQUETAS_ROL = {
  operario: 'Operario',
  cajero: 'Cajero',
  repartidor: 'Repartidor',
  gerente: 'Gerente de turno',
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
