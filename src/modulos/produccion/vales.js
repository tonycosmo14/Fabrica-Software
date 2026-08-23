/**
 * VALES DE AUTORIZACIÓN
 *
 * Cuando alguien quiere sacar un paño que no toca, primero pide permiso y
 * DESPUÉS ve las opciones. Entre esos dos momentos hay que recordar que la
 * autorización existe, sin quedarse guardando el PIN de nadie.
 *
 * Para eso está el vale: el gerente teclea su PIN una vez, el servidor
 * comprueba y devuelve un vale con fecha de caducidad. La pantalla guarda
 * ese vale (que no sirve para nada más) y lo entrega al registrar.
 *
 * Los vales viven solo en la memoria del programa: si el sistema se
 * reinicia, se pierden y hay que volver a autorizar. Es lo correcto.
 */
const { randomUUID } = require('node:crypto');

const MINUTOS_VIDA = 15;
const vales = new Map();

function limpiar() {
  const ahora = Date.now();
  for (const [id, v] of vales) if (v.expira < ahora) vales.delete(id);
}

/** Crea un vale para un paño concreto. */
function crear({ usuarioId, usuarioNombre, panoId, motivo }) {
  limpiar();
  const id = randomUUID();
  vales.set(id, {
    usuarioId, usuarioNombre, panoId, motivo,
    expira: Date.now() + MINUTOS_VIDA * 60000,
    usado: false
  });
  return { id, expiraEnMinutos: MINUTOS_VIDA };
}

/**
 * Consume un vale. Solo sirve una vez y solo para el paño para el que se pidió.
 * Devuelve { error } o { vale }.
 */
function usar(id, panoId) {
  limpiar();
  const v = vales.get(id);

  if (!v) return { error: 'La autorización caducó. Hay que pedirla otra vez.' };
  if (v.usado) return { error: 'Esa autorización ya se usó.' };
  if (v.panoId !== panoId) return { error: 'Esa autorización era para otro paño.' };

  v.usado = true;
  vales.delete(id);
  return { vale: v };
}

/** Solo para las pruebas: deja la memoria limpia entre casos. */
function vaciar() { vales.clear(); }

module.exports = { crear, usar, vaciar, MINUTOS_VIDA };
