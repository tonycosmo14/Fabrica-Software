/**
 * LAS COORDENADAS QUE VIENEN EN UN ENLACE DE GOOGLE MAPS  (v5.7.1)
 *
 * ============================================================
 * POR QUÉ ESTO VIVE EN EL SERVIDOR
 * ============================================================
 *
 * El enlace que da el celular al tocar «Compartir» es CORTO:
 *
 *     https://maps.app.goo.gl/AbCdEf12
 *
 * y no trae las coordenadas adentro: es una redirección al enlace largo,
 * que sí las trae. Seguir esa redirección no lo puede hacer la pantalla
 * —el navegador no deja leer a dónde manda un enlace de otro sitio— pero
 * el servidor sí: pide el enlace sin seguirlo, lee a dónde lo mandan, y
 * saca las coordenadas de ahí.
 *
 * ============================================================
 * SOLO SE SIGUEN ENLACES DE GOOGLE
 * ============================================================
 *
 * Es un servidor pidiendo direcciones de internet que le pegó un usuario.
 * Sin una lista corta de sitios permitidos, cualquiera con acceso podría
 * usarlo para que la PC de la fábrica pida lo que sea. Aquí solo se
 * siguen los dominios de Google Maps, y a nada más.
 */

/** Los sitios que se pueden seguir. Cualquier otro se rechaza sin pedirlo. */
const PERMITIDOS = [
  /^maps\.app\.goo\.gl$/i, /^goo\.gl$/i, /^g\.co$/i,
  /^(www\.|maps\.)?google\.[a-z.]+$/i
];

const patrones = [
  /@(-?\d+\.\d+),(-?\d+\.\d+)/,
  /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
  /[?&](?:q|query|ll|destination|daddr|center)=(-?\d+\.\d+)\s*(?:,|%2C)\s*(-?\d+\.\d+)/i,
  /^geo:(-?\d+\.\d+),(-?\d+\.\d+)/,
  /^(-?\d+\.\d+)\s*[,;]\s*(-?\d+\.\d+)$/
];

/** Las coordenadas que traiga el texto, o null. Mismos patrones que la pantalla. */
function coordenadasDe(texto) {
  const t = decodeURIComponent(String(texto || '').trim());
  for (const p of patrones) {
    const m = p.exec(t);
    if (!m) continue;
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon };
  }
  return null;
}

function hostPermitido(url) {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== 'https:' && protocol !== 'http:') return false;
    return PERMITIDOS.some((p) => p.test(hostname));
  } catch { return false; }
}

/**
 * Sigue un enlace de Google Maps hasta encontrar coordenadas.
 *
 * Devuelve { lat, lon } o null. `traer` se reemplaza en las pruebas para
 * no depender de internet, igual que en el clima.
 */
async function resolverEnlace(enlace, traer = fetch, { saltos = 6, esperaMs = 6000 } = {}) {
  let url = String(enlace || '').trim();
  const directo = coordenadasDe(url);
  if (directo) return directo;
  if (!hostPermitido(url)) return null;

  for (let i = 0; i < saltos; i++) {
    let res;
    try {
      res = await traer(url, { redirect: 'manual', signal: AbortSignal.timeout(esperaMs),
                               headers: { 'user-agent': 'Mozilla/5.0 (HieloLOLHA)' } });
    } catch { return null; }

    const siguiente = res.headers?.get?.('location');
    if (siguiente) {
      // La redirección puede venir relativa; se resuelve contra la actual.
      url = new URL(siguiente, url).toString();
      // PRIMERO se mira a dónde manda, y DESPUÉS se leen coordenadas. Al
      // revés, un enlace que redirigiera fuera de Google con coordenadas
      // en la dirección colaría un punto que nadie pidió a Google.
      if (!hostPermitido(url)) return null;
      const c = coordenadasDe(url);
      if (c) return c;
      continue;
    }

    // Llegó a una página sin coordenadas en la dirección. A veces vienen
    // en el cuerpo, en el mismo formato que en los enlaces largos.
    try {
      const cuerpo = (await res.text()).slice(0, 400000);
      const m = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(cuerpo)
             || /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(cuerpo)
             || /center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/.exec(cuerpo);
      if (m) {
        const lat = Number(m[1]);
        const lon = Number(m[2]);
        if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon };
      }
    } catch { /* sin cuerpo legible */ }
    return null;
  }
  return null;
}

module.exports = { coordenadasDe, resolverEnlace, hostPermitido };
