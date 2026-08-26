/**
 * LOS SONIDOS DE LA CAJA  (v2.1)
 *
 * Un ruidito cuando algo se acepta y otro cuando algo falla. En un mostrador
 * con gente hablando, el cajero no está mirando la pantalla cuando aprieta
 * enter: está viendo al cliente y contando billetes. El oído le dice si el
 * ticket entró sin tener que voltear.
 *
 * SE HACEN AQUÍ, NO SON ARCHIVOS. Tres razones, y las tres importan:
 *
 *  · el programa vive en la fábrica sin internet, y unos MP3 son unos MP3
 *    que se pueden perder en una actualización
 *  · pesan cero
 *  · un tono hecho a mano suena igual en cualquier bocina, y se puede
 *    ajustar cambiando un número en vez de grabando otra vez
 *
 * SE GUARDA EN EL APARATO, no en el servidor. La computadora de la caja
 * tiene bocinas y el celular del reparto no debería ponerse a pitar en la
 * calle: es una preferencia de cada aparato, no del negocio.
 */

const LLAVE = 'lolha.sonido';

let contexto = null;
let encendido = leerPreferencia();

function leerPreferencia() {
  try { return localStorage.getItem(LLAVE) !== '0'; }   // encendido por omisión
  catch { return true; }
}

export function sonidoEncendido() { return encendido; }

export function cambiarSonido(valor) {
  encendido = Boolean(valor);
  try { localStorage.setItem(LLAVE, encendido ? '1' : '0'); } catch { /* modo privado */ }
  if (encendido) tono('bien');                          // que se oiga lo que se acaba de prender
  return encendido;
}

/**
 * El contexto de audio se crea al primer toque y no antes.
 *
 * Los navegadores no dejan sonar nada hasta que la persona toca algo, y
 * crearlo al cargar deja un contexto suspendido dando lata en la consola.
 */
function motor() {
  if (!contexto) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return null;
    try { contexto = new Audio(); } catch { return null; }
  }
  if (contexto.state === 'suspended') contexto.resume().catch(() => {});
  return contexto;
}

/**
 * Los tonos. Cada uno son dos o tres notas cortas, y se distinguen a
 * oscuras: eso es lo único que tienen que lograr.
 */
const TONOS = {
  // Algo se aceptó: dos notas subiendo. Es el de todos los días.
  bien:    [[880, 0.06], [1320, 0.09]],
  // Se cobró una venta: tres notas, un poco más de fiesta.
  cobrado: [[660, 0.06], [880, 0.06], [1320, 0.14]],
  // Algo falló: dos notas bajando y graves. No estridente: en un mostrador
  // un pitido feo cada rato acaba con el sonido apagado a la semana.
  error:   [[320, 0.10], [200, 0.16]],
  // Un aviso que no es ni bueno ni malo.
  aviso:   [[560, 0.07]]
};

/** Toca uno de los tonos. Si el aparato no puede, no pasa nada. */
export function tono(cual = 'bien') {
  if (!encendido) return;
  const notas = TONOS[cual];
  if (!notas) return;

  const ctx = motor();
  if (!ctx) return;

  let cuando = ctx.currentTime;
  for (const [hz, duracion] of notas) {
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();

    // Onda triangular: tiene cuerpo pero no raspa como la cuadrada, que a
    // la décima venta del día ya molesta.
    osc.type = 'triangle';
    osc.frequency.value = hz;

    // Sube y baja suave. Un tono que arranca de golpe hace "clic" en las
    // bocinas baratas, que son las que hay en una fábrica.
    vol.gain.setValueAtTime(0.0001, cuando);
    vol.gain.exponentialRampToValueAtTime(0.18, cuando + 0.012);
    vol.gain.exponentialRampToValueAtTime(0.0001, cuando + duracion);

    osc.connect(vol).connect(ctx.destination);
    osc.start(cuando);
    osc.stop(cuando + duracion + 0.02);
    cuando += duracion * 0.85;
  }
}
