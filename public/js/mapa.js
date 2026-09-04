/**
 * UN MAPA, SIN LIBRERÍA  (v5.1)
 *
 * "Usa OpenStreetMap."
 *
 * POR QUÉ ESTÁ ESCRITO A MANO
 *
 * Lo normal sería meter Leaflet, que son 140 KB de librería. Pero este
 * sistema no tiene ni una dependencia en la pantalla, a propósito: se
 * copia la carpeta y funciona. Y resulta que un mapa que solo tiene que
 * enseñar cincuenta chinchetas y dejarse arrastrar cabe en este archivo.
 *
 * CÓMO FUNCIONA UN MAPA, QUE ES MÁS SIMPLE DE LO QUE PARECE
 *
 * El mundo entero está partido en cuadritos —"mosaicos"— de 256 píxeles.
 * En el acercamiento 0 hay UN cuadrito con el planeta completo; en el 1
 * hay cuatro; en el 2, dieciséis. Cada vez que se acerca, cada cuadrito
 * se parte en cuatro. En el acercamiento 16 —el de una calle— hay 4,294
 * millones, y cada uno es una imagen que vive en una dirección así:
 *
 *     https://tile.openstreetmap.org/16/15043/26428.png
 *                                    zoom  x     y
 *
 * O sea que dibujar un mapa es: calcular qué cuadritos tocan la pantalla,
 * pedirlos como imágenes normales, y acomodarlos en una cuadrícula. Nada
 * más. Arrastrar es mover esa cuadrícula; acercarse es volver a calcular.
 *
 * LO QUE HAY QUE SABER
 *
 *   · LOS MOSAICOS VIENEN DE INTERNET. Sin internet no hay fondo — pero
 *     las chinchetas, la lista y las direcciones escritas siguen ahí.
 *     Por eso la dirección escrita es la que manda y el mapa es el lujo.
 *   · OPENSTREETMAP LOS REGALA, y son de una asociación sin fines de
 *     lucro que paga esos servidores. Por eso aquí se piden pocos: una
 *     pantalla de cincuenta neveras, cuando alguien la abre. Nada de
 *     recargar solo ni de precargar el estado.
 *   · EL CRÉDITO ES OBLIGATORIO. Va abajo a la derecha y no se quita.
 */

const TAMANO = 256;                       // lo que mide un mosaico
const SERVIDOR = 'https://tile.openstreetmap.org';
const ZOOM_MIN = 3;
const ZOOM_MAX = 18;

// ============================================================
// LAS CUENTAS DEL MAPA
//
// Convertir "latitud y longitud" a "qué píxel de la cuadrícula" y al
// revés. Es la proyección de Mercator, la misma que usa cualquier mapa
// de internet — la que hace que Groenlandia salga enorme.
// ============================================================

/** De longitud (−180 a 180) a píxel horizontal en ese acercamiento. */
function aX(lon, zoom) {
  return ((Number(lon) + 180) / 360) * TAMANO * (2 ** zoom);
}

/** De latitud a píxel vertical. Aquí es donde entra Mercator. */
function aY(lat, zoom) {
  const rad = (Number(lat) * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
  return y * TAMANO * (2 ** zoom);
}

/** Y de vuelta, para saber sobre qué punto se soltó el dedo. */
function aLon(x, zoom) {
  return (x / (TAMANO * (2 ** zoom))) * 360 - 180;
}

function aLat(y, zoom) {
  const n = Math.PI - (2 * Math.PI * y) / (TAMANO * (2 ** zoom));
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/**
 * EL ENCUADRE QUE HACE QUE SE VEAN TODAS.
 *
 * Se busca el acercamiento más grande en el que todavía quepan todos los
 * puntos con un margen. Se prueba de cerca a lejos y se para en el
 * primero que cumple: así se ve lo más cerca posible sin dejar a nadie
 * fuera.
 */
function encuadrar(puntos, ancho, alto, margen = 60) {
  const utiles = puntos.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (!utiles.length) return null;

  const lats = utiles.map((p) => p.lat);
  const lons = utiles.map((p) => p.lon);
  const centro = {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lon: (Math.min(...lons) + Math.max(...lons)) / 2
  };

  // Un solo punto no tiene "extensión": se le pone un acercamiento de
  // calle y ya, que es lo que se quiere ver de una nevera sola.
  if (utiles.length === 1) return { centro, zoom: 16 };

  for (let z = ZOOM_MAX; z >= ZOOM_MIN; z--) {
    const xs = lons.map((l) => aX(l, z));
    const ys = lats.map((l) => aY(l, z));
    if (Math.max(...xs) - Math.min(...xs) <= ancho - margen * 2
      && Math.max(...ys) - Math.min(...ys) <= alto - margen * 2) {
      return { centro, zoom: z };
    }
  }
  return { centro, zoom: ZOOM_MIN };
}

// ============================================================
// EL MAPA
// ============================================================

/**
 * Pinta un mapa dentro de un elemento y devuelve con qué manejarlo.
 *
 *   puntos   [{ lat, lon, etiqueta, tono, id }]
 *   alTocar  qué hacer cuando se toca una chincheta
 */
export function mapa(caja, { puntos = [], alTocar = null, centro = null, zoom = null } = {}) {
  const conCoordenadas = puntos
    .map((p) => ({ ...p, lat: Number(p.lat), lon: Number(p.lon) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));

  const ancho = caja.clientWidth || 600;
  const alto = caja.clientHeight || 400;

  const vista = centro && zoom
    ? { centro, zoom }
    : encuadrar(conCoordenadas, ancho, alto)
      // Sin ni un punto con coordenadas, el mapa se planta en Hunucmá:
      // es donde está la fábrica y desde ahí se empieza a buscar.
      || { centro: { lat: 21.0167, lon: -89.8744 }, zoom: 13 };

  let z = Math.min(Math.max(vista.zoom, ZOOM_MIN), ZOOM_MAX);
  // El píxel de la cuadrícula que queda en la esquina de arriba a la
  // izquierda de lo que se ve. Mover el mapa es cambiar estos dos.
  let x0 = aX(vista.centro.lon, z) - ancho / 2;
  let y0 = aY(vista.centro.lat, z) - alto / 2;

  caja.classList.add('mapa');
  caja.innerHTML = `
    <div class="mapa-lienzo"></div>
    <div class="mapa-chinchetas"></div>
    <div class="mapa-mandos">
      <button type="button" data-mas title="Acercar">+</button>
      <button type="button" data-menos title="Alejar">−</button>
      <button type="button" data-todo title="Ver todas">⤢</button>
    </div>
    <div class="mapa-credito">
      <a href="https://www.openstreetmap.org/copyright" target="_blank"
         rel="noopener">© OpenStreetMap</a>
    </div>
    <div class="mapa-sinred" hidden>Sin internet no se ve el mapa,
      pero las direcciones siguen en la lista.</div>`;

  const lienzo = caja.querySelector('.mapa-lienzo');
  const capaChinchetas = caja.querySelector('.mapa-chinchetas');
  const sinRed = caja.querySelector('.mapa-sinred');

  let fallaron = 0;
  let cargados = 0;

  /** Pide los mosaicos que tocan la pantalla y los acomoda. */
  function pintarMosaicos() {
    const total = 2 ** z;
    const desdeX = Math.floor(x0 / TAMANO);
    const desdeY = Math.floor(y0 / TAMANO);
    const hastaX = Math.floor((x0 + ancho) / TAMANO);
    const hastaY = Math.floor((y0 + alto) / TAMANO);

    const trozos = [];
    for (let ty = desdeY; ty <= hastaY; ty++) {
      // Arriba del polo o abajo del otro no hay mosaico que pedir.
      if (ty < 0 || ty >= total) continue;
      for (let tx = desdeX; tx <= hastaX; tx++) {
        // A lo ancho el mundo da la vuelta: el mosaico −1 es el último.
        const vueltaX = ((tx % total) + total) % total;
        trozos.push(`<img src="${SERVIDOR}/${z}/${vueltaX}/${ty}.png"
          alt="" loading="lazy" draggable="false"
          style="left:${tx * TAMANO - x0}px;top:${ty * TAMANO - y0}px">`);
      }
    }
    lienzo.innerHTML = trozos.join('');

    // Si NINGUNO carga, es que no hay internet: se dice, en vez de dejar
    // un cuadro gris que parece un programa roto.
    fallaron = 0; cargados = 0;
    const imagenes = lienzo.querySelectorAll('img');
    imagenes.forEach((img) => {
      img.onload = () => { cargados++; sinRed.hidden = true; };
      img.onerror = () => {
        fallaron++;
        // Un icono de imagen rota se ve peor que un hueco: el fondo del
        // mapa ya es de color, y ahí se queda.
        img.style.visibility = 'hidden';
        if (!cargados && fallaron >= imagenes.length) sinRed.hidden = false;
      };
    });
  }

  /** Las chinchetas van encima, cada una en su píxel. */
  function pintarChinchetas() {
    capaChinchetas.innerHTML = conCoordenadas.map((p) => {
      const px = aX(p.lon, z) - x0;
      const py = aY(p.lat, z) - y0;
      // Fuera de la pantalla no se dibuja: con cincuenta da igual, pero
      // es lo que deja que esto aguante quinientas el día del agua.
      if (px < -40 || py < -60 || px > ancho + 40 || py > alto + 60) return '';
      return `<button type="button" class="mapa-pin ${p.tono || ''}"
        style="left:${px}px;top:${py}px" data-punto="${p.id || ''}"
        title="${(p.etiqueta || '').replace(/"/g, '&quot;')}">
        <span>${p.numero ?? ''}</span></button>`;
    }).join('');

    if (alTocar) {
      capaChinchetas.querySelectorAll('[data-punto]').forEach((b) => {
        b.onclick = (e) => { e.stopPropagation(); alTocar(b.dataset.punto); };
      });
    }
  }

  function pintar() { pintarMosaicos(); pintarChinchetas(); }

  // ---- ARRASTRAR ----
  // Con eventos de puntero, que sirven igual para el ratón y para el
  // dedo: la pantalla de la fábrica es táctil.
  let arrastrando = null;
  caja.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.mapa-mandos, .mapa-pin, .mapa-credito')) return;
    arrastrando = { x: e.clientX, y: e.clientY };
    caja.setPointerCapture(e.pointerId);
    caja.classList.add('agarrando');
  });
  caja.addEventListener('pointermove', (e) => {
    if (!arrastrando) return;
    x0 -= e.clientX - arrastrando.x;
    y0 -= e.clientY - arrastrando.y;
    arrastrando = { x: e.clientX, y: e.clientY };
    pintar();
  });
  const soltar = () => { arrastrando = null; caja.classList.remove('agarrando'); };
  caja.addEventListener('pointerup', soltar);
  caja.addEventListener('pointercancel', soltar);

  /** Acercar o alejar dejando quieto el punto que se está mirando. */
  function acercar(cuanto, haciaX = ancho / 2, haciaY = alto / 2) {
    const nuevo = Math.min(Math.max(z + cuanto, ZOOM_MIN), ZOOM_MAX);
    if (nuevo === z) return;
    const factor = 2 ** (nuevo - z);
    x0 = (x0 + haciaX) * factor - haciaX;
    y0 = (y0 + haciaY) * factor - haciaY;
    z = nuevo;
    pintar();
  }

  caja.querySelector('[data-mas]').onclick = () => acercar(1);
  caja.querySelector('[data-menos]').onclick = () => acercar(-1);
  caja.querySelector('[data-todo]').onclick = () => {
    const v = encuadrar(conCoordenadas, ancho, alto);
    if (!v) return;
    z = v.zoom;
    x0 = aX(v.centro.lon, z) - ancho / 2;
    y0 = aY(v.centro.lat, z) - alto / 2;
    pintar();
  };

  // La rueda del ratón acerca. `passive: false` porque hay que impedir
  // que la página entera se desplace mientras se usa el mapa.
  caja.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = caja.getBoundingClientRect();
    acercar(e.deltaY < 0 ? 1 : -1, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  pintar();

  return {
    pintar,
    /** Centrar en un punto, para cuando se toca una nevera de la lista. */
    ir(lat, lon, zoom = 17) {
      z = Math.min(Math.max(zoom, ZOOM_MIN), ZOOM_MAX);
      x0 = aX(lon, z) - ancho / 2;
      y0 = aY(lat, z) - alto / 2;
      pintar();
    },
    get cuantas() { return conCoordenadas.length; }
  };
}

/**
 * EL ENLACE A GOOGLE MAPS.
 *
 * El mapa de aquí sirve para ver dónde están todas; para IR hasta una,
 * lo que sirve es el teléfono con su navegador y sus indicaciones. Por
 * eso cada nevera lleva además este botón.
 */
/**
 * ¿ESTO ES UNA COORDENADA DE VERDAD, O ESTÁ VACÍO?
 *
 * Hay que preguntarlo aparte porque `Number(null)` da 0, y el 0 es un
 * número perfectamente finito: es donde se cruzan el ecuador y el
 * meridiano cero, en medio del golfo de Guinea. O sea que preguntar solo
 * «¿es finito?» deja pasar las neveras que NO tienen ubicación puesta y
 * manda al repartidor al Atlántico.
 */
function hayCoordenada(v) {
  if (v === null || v === undefined || v === '') return false;
  return Number.isFinite(Number(v));
}

export function enlaceMaps(lat, lon, nombre = '') {
  if (hayCoordenada(lat) && hayCoordenada(lon)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  }
  if (nombre) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nombre)}`;
  return null;
}

/** Sacar lat/lon de un enlace de Google Maps pegado a mano. */
export function leerEnlace(texto) {
  const t = String(texto || '');
  // Las tres formas en que Google mete las coordenadas en una dirección.
  const patrones = [/@(-?\d+\.\d+),(-?\d+\.\d+)/, /[?&]q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
                    /^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/];
  for (const p of patrones) {
    const m = p.exec(t);
    if (m) {
      const lat = Number(m[1]);
      const lon = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon };
    }
  }
  return null;
}

export { aX, aY, aLat, aLon, encuadrar };
