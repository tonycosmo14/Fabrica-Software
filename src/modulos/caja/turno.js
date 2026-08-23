/**
 * ABRIR EL TURNO AL ENTRAR  (v0.10)
 *
 * En la fábrica nadie va a una pantalla aparte a "abrir la caja". Se llega,
 * se pone el PIN y se empieza a cobrar. Así que el turno lo abre el propio
 * PIN: quien entra es quien se hace responsable del dinero.
 *
 * El turno arranca en CERO. Si el cajón trae fondo, se agrega desde la misma
 * pantalla de venta con el botón de meter dinero, y queda anotado como el
 * movimiento que es.
 *
 * Reglas que se respetan:
 *  · Solo se abre si NO hay ninguno abierto. Si Rosa dejó el turno abierto y
 *    entra Mari, Mari sigue en el turno de Rosa: dos turnos a la vez harían
 *    que ninguna venta supiera a cuál pertenece.
 *  · Solo para quien maneja dinero. Un operario que entra a ver los tanques
 *    no abre ninguna caja.
 */
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');
const { puede } = require('../../lib/roles');
const bitacora = require('../../lib/bitacora');
const { sesionAbierta } = require('./calculo');

/**
 * Abre el turno si hace falta. Devuelve el turno vigente, o null si este
 * usuario no maneja caja.
 */
function abrirTurnoSiHaceFalta(usuario) {
  if (!puede(usuario.rol, 'caja.operar')) return null;

  const abierto = sesionAbierta();
  if (abierto) return abierto;

  const id = nuevoId();
  const abrir = bd.transaction(() => {
    const folio = bd.prepare('SELECT COALESCE(MAX(folio), 0) n FROM cajas').get().n + 1;
    bd.prepare(`
      INSERT INTO cajas (id, folio, cajero_id, abierta_por, abierta_en, fondo_centavos, notas_apertura)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(id, folio, usuario.id, usuario.id, ahora(), 'Abierto al entrar al sistema');
    return folio;
  });
  const folio = abrir();

  bitacora.registrar({
    accion: 'caja.abierta', entidad: 'caja', entidadId: id,
    ejecutorId: usuario.id, capturistaId: usuario.id,
    detalle: { folio, fondo: 0, automatico: true }
  });

  return sesionAbierta();
}

module.exports = { abrirTurnoSiHaceFalta };
