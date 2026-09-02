/**
 * LA TEMPERATURA DE AFUERA  (v3.6)
 *
 * En una fábrica de hielo el clima es materia prima. En mayo, cuando
 * calientan los tanques, el hielo simplemente no se forma por más días que
 * pase en el molde; y cuando llueve mucho sale sellado sin que nadie haya
 * hecho nada distinto. Ese dato no estaba en ninguna parte, y dentro de un
 * año, mirando un mes malo, no habría manera de saber si hizo calor.
 *
 * SE PIDE A OPEN-METEO, que es gratis y no pide registrarse ni llave: una
 * llave es una cosa más que caduca, que hay que guardar y que un día deja
 * de funcionar sin que nadie sepa por qué. La dirección y el formato de la
 * respuesta están escritos abajo, para que dentro de tres años se pueda
 * arreglar sin adivinar.
 *
 * SI NO HAY INTERNET NO PASA ABSOLUTAMENTE NADA.
 *
 * Esto es lo más importante de todo el archivo. La fábrica vende hielo sin
 * internet, así que la temperatura es un dato de más y nunca una condición:
 *
 *   · la llamada lleva reloj (8 segundos) y si no contesta, se abandona;
 *   · si falla, se devuelve la última que se pudo tomar, diciendo de
 *     cuándo es, para que nadie confunda la de hoy con la del martes;
 *   · si nunca se pudo tomar ninguna, se devuelve nulo y las pantallas
 *     simplemente no la enseñan;
 *   · un error de red NO se le grita al usuario ni se apunta como avería:
 *     se guarda el motivo por si alguien pregunta.
 *
 * NO SE PIDE A CADA RATO. Como mucho una vez cada quince minutos, que es
 * cada cuánto cambia de verdad, y se guarda como mucho una por hora: con
 * la máxima y la mínima de cada día alcanza para lo que sirve, sin llenar
 * la base de renglones que nadie va a leer.
 */
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');

/** Cada cuánto se le pregunta a internet. */
const CADA_MINUTOS = 15;
/** Cada cuánto se guarda un renglón. */
const GUARDAR_CADA_MINUTOS = 60;
/** Lo que se espera a que conteste antes de rendirse. */
const ESPERA_MS = 8000;

/**
 * LA DIRECCIÓN, ESCRITA ENTERA A PROPÓSITO.
 *
 *   https://api.open-meteo.com/v1/forecast
 *     ?latitude=21.0167&longitude=-89.8747
 *     &current=temperature_2m,relative_humidity_2m,apparent_temperature
 *     &timezone=auto
 *
 * Y lo que contesta:
 *
 *   { "current": { "time": "2026-09-02T18:30",
 *                  "temperature_2m": 31.2,
 *                  "relative_humidity_2m": 70,
 *                  "apparent_temperature": 38.1 } }
 */
const BASE = 'https://api.open-meteo.com/v1/forecast';

/** Lo último que se supo, en memoria, para no ir a la base a cada pregunta. */
let enMemoria = null;      // { dato, cuando, error }

function configuracion() {
  const filas = bd.prepare(
    "SELECT clave, valor FROM configuracion WHERE clave LIKE 'clima_%'").all();
  const c = Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
  return {
    latitud: Number(c.clima_latitud ?? 21.0167),
    longitud: Number(c.clima_longitud ?? -89.8747),
    activo: c.clima_activo !== '0'
  };
}

/** El último registro guardado, venga de donde venga. */
function ultimoGuardado() {
  return bd.prepare(
    'SELECT * FROM clima_registros ORDER BY fecha DESC LIMIT 1').get() || null;
}

const minutosDesde = (iso) =>
  iso ? Math.round((Date.now() - new Date(iso).getTime()) / 60000) : null;

/**
 * Le pregunta a internet. Devuelve el dato o lanza: quien llama decide qué
 * hacer con el error, y en este módulo nadie lo convierte en un problema
 * para el usuario.
 *
 * `traer` se puede reemplazar en las pruebas: así se comprueba todo el
 * comportamiento —el reloj, el guardado, lo que pasa cuando falla— sin
 * depender de que haya internet mientras se prueba.
 */
async function pedirAInternet(traer = fetch) {
  const { latitud, longitud } = configuracion();
  const url = `${BASE}?latitude=${latitud}&longitude=${longitud}` +
              '&current=temperature_2m,relative_humidity_2m,apparent_temperature' +
              '&timezone=auto';

  // El reloj es lo que hace que una red lenta no cuelgue una pantalla.
  const corte = AbortSignal.timeout(ESPERA_MS);
  const res = await traer(url, { signal: corte });
  if (!res.ok) throw new Error(`El servicio del clima contestó ${res.status}.`);

  const j = await res.json();
  const c = j?.current;
  if (!c || typeof c.temperature_2m !== 'number') {
    throw new Error('El servicio del clima contestó algo que no se entiende.');
  }

  return {
    temperatura: Math.round(c.temperature_2m * 10) / 10,
    sensacion: typeof c.apparent_temperature === 'number'
      ? Math.round(c.apparent_temperature * 10) / 10 : null,
    humedad: typeof c.relative_humidity_2m === 'number'
      ? Math.round(c.relative_humidity_2m) : null
  };
}

/** Guarda, pero solo si ya pasó una hora desde el último renglón. */
function guardarSiToca(dato) {
  const ultimo = ultimoGuardado();
  const edad = minutosDesde(ultimo?.fecha);
  if (ultimo && edad !== null && edad < GUARDAR_CADA_MINUTOS) return ultimo;

  const id = nuevoId();
  bd.prepare(`
    INSERT INTO clima_registros (id, fecha, temperatura, sensacion, humedad, fuente)
    VALUES (?, ?, ?, ?, ?, 'internet')
  `).run(id, ahora(), dato.temperatura, dato.sensacion, dato.humedad);
  return bd.prepare('SELECT * FROM clima_registros WHERE id = ?').get(id);
}

/**
 * LA TEMPERATURA DE AHORA, para las pantallas.
 *
 * Nunca lanza. Devuelve siempre un objeto que dice de cuándo es el dato y
 * si se pudo hablar con internet, y las pantallas deciden qué enseñar.
 */
async function ahoraMismo({ traer, forzar = false } = {}) {
  const { activo } = configuracion();
  const ultimo = ultimoGuardado();

  const respuesta = (extra = {}) => ({
    temperatura: ultimo?.temperatura ?? null,
    sensacion: ultimo?.sensacion ?? null,
    humedad: ultimo?.humedad ?? null,
    fuente: ultimo?.fuente ?? null,
    cuando: ultimo?.fecha ?? null,
    minutos: minutosDesde(ultimo?.fecha),
    ...extra
  });

  if (!activo) return respuesta({ hayInternet: null, apagado: true });

  // Recién preguntado: no se vuelve a preguntar.
  const edadMemoria = enMemoria ? minutosDesde(enMemoria.cuando) : null;
  if (!forzar && enMemoria && edadMemoria !== null && edadMemoria < CADA_MINUTOS) {
    return respuesta({
      temperatura: enMemoria.dato?.temperatura ?? ultimo?.temperatura ?? null,
      sensacion: enMemoria.dato?.sensacion ?? ultimo?.sensacion ?? null,
      humedad: enMemoria.dato?.humedad ?? ultimo?.humedad ?? null,
      cuando: enMemoria.dato ? enMemoria.cuando : (ultimo?.fecha ?? null),
      minutos: minutosDesde(enMemoria.dato ? enMemoria.cuando : ultimo?.fecha),
      fuente: enMemoria.dato ? 'internet' : (ultimo?.fuente ?? null),
      hayInternet: Boolean(enMemoria.dato)
    });
  }

  try {
    const dato = await pedirAInternet(traer);
    enMemoria = { dato, cuando: ahora(), error: null };
    guardarSiToca(dato);
    return {
      ...dato, fuente: 'internet', cuando: enMemoria.cuando,
      minutos: 0, hayInternet: true
    };
  } catch (e) {
    // NO SE GRITA. Se apunta y se sigue con lo último que se supo.
    enMemoria = { dato: null, cuando: ahora(), error: e.message };
    return respuesta({ hayInternet: false, porque: e.message });
  }
}

/** Escribirla a mano, para cuando no hay internet y alguien mira el termómetro. */
function aMano({ temperatura, humedad = null, ejecutorId = null }) {
  const id = nuevoId();
  bd.prepare(`
    INSERT INTO clima_registros (id, fecha, temperatura, sensacion, humedad, fuente, ejecutor_id)
    VALUES (?, ?, ?, NULL, ?, 'mano', ?)
  `).run(id, ahora(), Math.round(Number(temperatura) * 10) / 10,
         humedad == null ? null : Math.round(Number(humedad)), ejecutorId);
  enMemoria = null;         // que la siguiente pregunta vuelva a mirar
  return bd.prepare('SELECT * FROM clima_registros WHERE id = ?').get(id);
}

/** La máxima y la mínima de cada día, que es lo que sirve para comparar. */
function porDia({ desde, hasta }) {
  return bd.prepare(`
    SELECT date(fecha, 'localtime') AS dia,
           ROUND(MIN(temperatura), 1) AS minima,
           ROUND(MAX(temperatura), 1) AS maxima,
           ROUND(AVG(temperatura), 1) AS media,
           COUNT(*) AS medidas
      FROM clima_registros
     WHERE fecha >= ? AND fecha < ?
     GROUP BY dia
     ORDER BY dia
  `).all(desde, hasta);
}

/** Para las pruebas: olvidar lo que se tiene en memoria. */
function olvidar() { enMemoria = null; }

module.exports = {
  ahoraMismo, aMano, porDia, configuracion, ultimoGuardado, olvidar,
  CADA_MINUTOS, GUARDAR_CADA_MINUTOS, ESPERA_MS
};
