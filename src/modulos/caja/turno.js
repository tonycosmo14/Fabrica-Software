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
 *
 * EL TURNO SIN DUEÑO
 *
 * En la fábrica la existencia se entrega como a las 2:30 y el cajero que
 * sigue llega a las 3. En ese rato el que está sigue cobrando, pero ese
 * dinero ya es del que viene: lo va apartando y se lo entrega cuando llega.
 *
 * Para eso existe el turno SIN DUEÑO. A las 2:30 se entrega el turno: se
 * cuenta el dinero del que se va y se abre uno nuevo sin cajero asignado.
 * Las ventas siguen entrando ahí. Cuando el que sigue llega y pone su PIN,
 * el turno se le asigna, y en cada venta queda anotado que la capturó el
 * otro. Eso es la regla 3.6: uno es el responsable del dinero y otro el que
 * tecleó.
 */
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');
const { puede } = require('../../lib/roles');
const bitacora = require('../../lib/bitacora');
const { sesionAbierta } = require('./calculo');

/**
 * Abre el turno si hace falta. Devuelve el turno vigente, o null si este
 * usuario no maneja caja.
 *
 * `adoptar` distingue DOS COSAS QUE NO SON LO MISMO:
 *
 *  · ABRIR un turno cuando no hay ninguno. Eso pasa también al recargar la
 *    la pantalla, y está bien: la sesión dura 30 días y casi ninguna mañana
 *    se vuelve a teclear el PIN.
 *
 *  · ADOPTAR el turno que quedó esperando dueño. Eso solo lo hace quien
 *    TECLEA su PIN, porque es la señal de que el cajero que entra ya llegó.
 *    Si lo hiciera cualquier arranque de pantalla, el que acaba de entregar
 *    su turno se lo volvería a quedar con solo refrescar el navegador, y el
 *    relevo de las 2:30 no serviría de nada.
 */
function abrirTurnoSiHaceFalta(usuario, { adoptar = false } = {}) {
  if (!puede(usuario.rol, 'caja.operar')) return null;

  const abierto = sesionAbierta();
  if (abierto) {
    // Un turno esperando dueño: el que llega se hace cargo de él y del
    // dinero que se apartó mientras no estaba.
    if (!abierto.cajero_id && adoptar) return adoptarTurno(abierto, usuario);
    return abierto;
  }

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

/** El que llega se hace cargo del turno que quedó esperando. */
function adoptarTurno(turno, usuario) {
  bd.prepare('UPDATE cajas SET cajero_id = ? WHERE id = ?').run(usuario.id, turno.id);

  bitacora.registrar({
    accion: 'caja.adoptada', entidad: 'caja', entidadId: turno.id,
    ejecutorId: usuario.id, capturistaId: usuario.id,
    detalle: { folio: turno.folio, abiertaEn: turno.abierta_en }
  });

  return sesionAbierta();
}

module.exports = { abrirTurnoSiHaceFalta, adoptarTurno };
