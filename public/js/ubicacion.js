/**
 * LA UBICACIÓN DE UN CLIENTE, DE DOS FORMAS  (v5.7.1)
 *
 * "La ubicación de los clientes es un botón donde tengo que poner las
 *  coordenadas, pero si yo pongo el link de Google Maps lo rechaza. Lo
 *  ideal es usar el mapa igual."
 *
 * Lo rechazaba porque el enlace que da el celular al compartir es un
 * enlace CORTO —maps.app.goo.gl/xxxx— que no trae las coordenadas adentro:
 * están en el enlace largo al que ese redirige. Y seguir esa redirección
 * no lo puede hacer el navegador; lo hace el servidor.
 *
 * Así que ahora hay dos caminos y los dos llegan:
 *   PEGAR EL ENLACE — el que sea. Si trae las coordenadas, se leen aquí;
 *                     si es corto, se le pide al servidor que lo siga.
 *   TOCAR EL MAPA   — el mismo mapa de las neveras, con una chincheta que
 *                     va a donde se toque.
 */
import { api } from './api.js';
import { mapa, leerEnlace, esEnlaceCorto } from './mapa.js';
import { armarDialogo } from './dialogo.js';

/**
 * Saca { lat, lon } de lo que se pegó, pidiéndole ayuda al servidor si
 * hace falta. Devuelve null si de ahí no salen coordenadas.
 */
export async function ubicacionDe(texto) {
  const t = String(texto || '').trim();
  if (!t) return null;
  const directo = leerEnlace(t);
  if (directo) return directo;
  if (!esEnlaceCorto(t) && !/^https?:\/\//i.test(t)) return null;
  try {
    const r = await api.enviar('/clientes/ubicacion', { enlace: t });
    return r.lat != null && r.lon != null ? { lat: r.lat, lon: r.lon } : null;
  } catch { return null; }
}

/**
 * EL MAPA PARA ELEGIR TOCANDO. Devuelve { lat, lon } o null si canceló.
 *
 * Arranca donde ya estaba la chincheta si la había, o en Hunucmá.
 */
export function elegirEnMapa({ titulo = '¿Dónde está?', lat = null, lon = null } = {}) {
  const hay = lat != null && lon != null;
  const d = armarDialogo(`
    <h3 class="dialogo-titulo">${titulo}</h3>
    <p class="dialogo-texto">Toca el mapa donde está la puerta. Arrastra para moverte; + y − para acercar.</p>
    <div class="mapa-elegir" id="mapa-elegir"></div>
    <p class="ayuda" id="mapa-donde" style="margin:8px 0 0">
      ${hay ? `Ahora: ${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}` : 'Todavía no has tocado el mapa.'}
    </p>
    <div class="dialogo-botones">
      <button class="secundario" data-no>Cancelar</button>
      <button data-si ${hay ? '' : 'disabled'}>Guardar aquí</button>
    </div>`);

  let elegido = hay ? { lat: Number(lat), lon: Number(lon) } : null;
  const donde = d.caja.querySelector('#mapa-donde');
  const guardar = d.caja.querySelector('[data-si]');

  // El mapa se arma cuando la caja ya mide algo: antes su ancho es cero y
  // los mosaicos saldrían apilados en la esquina.
  setTimeout(() => {
    const m = mapa(d.caja.querySelector('#mapa-elegir'), {
      puntos: hay ? [{ id: '__elegido', lat, lon, tono: 'elegido', numero: '📍' }] : [],
      centro: hay ? { lat, lon } : { lat: 21.0167, lon: -89.8744 },
      zoom: hay ? 17 : 15,
      alTocarMapa: (la, lo) => {
        elegido = { lat: Math.round(la * 1e6) / 1e6, lon: Math.round(lo * 1e6) / 1e6 };
        m.ponerPunto(elegido.lat, elegido.lon);
        donde.textContent = `Aquí: ${elegido.lat.toFixed(5)}, ${elegido.lon.toFixed(5)}`;
        guardar.disabled = false;
      }
    });
  }, 60);

  d.caja.querySelector('[data-no]').onclick = () => d.salir(null);
  guardar.onclick = () => d.salir(elegido);
  return d.hecho;
}
