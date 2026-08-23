/**
 * AUTORIZACIÓN DE UN RESPONSABLE
 *
 * Cuando alguien quiere hacer algo que se sale de lo normal —sacar un paño
 * fuera de orden, dar de baja un producto que todavía tiene mercancía— no
 * basta con que esté dentro del sistema: hace falta que un responsable lo
 * autorice ahí mismo con su PIN.
 *
 * EL PIN SE COMPRUEBA AQUÍ, en el servidor. La pantalla nunca sabe si un PIN
 * es correcto: solo manda lo que tecleó la persona.
 */
const { bd } = require('../db/conexion');
const { verificar } = require('./seguridad');
const { puede, ETIQUETAS_ROL } = require('./roles');

/**
 * Comprueba que quien autoriza exista, tenga el permiso y sepa su PIN.
 * Devuelve { usuario } o { error }.
 */
function comprobar(autorizacion, permiso) {
  if (!autorizacion?.usuarioId || !autorizacion?.pin) {
    return { error: 'Falta la autorización de un responsable.' };
  }

  const u = bd.prepare('SELECT * FROM usuarios WHERE id = ? AND activo = 1')
    .get(autorizacion.usuarioId);
  if (!u) return { error: 'Ese responsable no existe.' };

  if (!puede(u.rol, permiso)) {
    return { error: `${u.nombre} no puede autorizar esto. Solo un gerente o el administrador.` };
  }
  if (!verificar(autorizacion.pin, u.pin_hash, u.pin_sal)) {
    return { error: 'PIN incorrecto.' };
  }
  return { usuario: u };
}

/** Quiénes pueden autorizar. La pantalla los ofrece en una lista. */
function responsables() {
  return bd.prepare(`
    SELECT id, nombre, rol FROM usuarios
     WHERE activo = 1 AND rol IN ('gerente','admin') AND pin_hash IS NOT NULL
     ORDER BY CASE rol WHEN 'gerente' THEN 0 ELSE 1 END, nombre
  `).all().map((u) => ({ ...u, rolEtiqueta: ETIQUETAS_ROL[u.rol] }));
}

module.exports = { comprobar, responsables };
