/**
 * PRUEBAS DEL MAPA  (v5.1)
 *
 * El mapa está escrito a mano, sin librería, y lo que lleva dentro es la
 * proyección de Mercator. Una proyección mal escrita no truena: pone las
 * chinchetas cien metros más allá y nadie se entera hasta que un
 * repartidor no encuentra la tienda.
 *
 * Por eso se prueba contra números que se pueden comprobar aparte: el
 * mosaico que le toca a una coordenada conocida es el mismo que sirve
 * cualquier mapa del mundo, y se puede mirar en openstreetmap.org.
 */
const test = require('node:test');
const assert = require('node:assert');

/**
 * CÓMO SE CARGA UN MÓDULO DE PANTALLA DESDE AQUÍ.
 *
 * El código de `public/` está escrito como módulo de navegador (import y
 * export), y el del servidor como módulo de Node (require). El
 * `package.json` dice que los `.js` son de Node, así que pedirlo con
 * `import()` a secas contesta «Unexpected token 'export'».
 *
 * Se lee el archivo y se importa como si fuera una dirección: es la forma
 * de decirle a Node «esto SÍ es un módulo de navegador», sin tener que
 * renombrar el archivo ni duplicar el código en dos sitios.
 *
 * Lo que se prueba son funciones puras —cuentas de geometría—, así que no
 * hace falta ningún navegador.
 */
const fs = require('node:fs');
const path = require('node:path');

let mapa;
test.before(async () => {
  const fuente = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'js', 'mapa.js'), 'utf8');
  mapa = await import(`data:text/javascript,${encodeURIComponent(fuente)}`);
});

const TAMANO = 256;

test('una coordenada cae en el mosaico que le toca', () => {
  // Hunucmá, Yucatán. En el acercamiento 13 su mosaico es el 2050/3606 —
  // el mismo que sirve cualquier mapa del mundo para ese punto. Se puede
  // comprobar aparte: tile.openstreetmap.org/13/2050/3606.png sale
  // Hunucmá.
  const lat = 21.0167;
  const lon = -89.8744;

  assert.equal(Math.floor(mapa.aX(lon, 13) / TAMANO), 2050);
  assert.equal(Math.floor(mapa.aY(lat, 13) / TAMANO), 3606);

  // Y en el acercamiento 0 el mundo entero es UN mosaico: cualquier punto
  // cae dentro de él.
  assert.ok(mapa.aX(lon, 0) >= 0 && mapa.aX(lon, 0) < TAMANO);
  assert.ok(mapa.aY(lat, 0) >= 0 && mapa.aY(lat, 0) < TAMANO);
});

test('el meridiano cero y el ecuador caen justo en el centro', () => {
  // Es el punto de control de cualquier proyección: si esto se corre,
  // todo el mapa está desplazado.
  for (const z of [0, 5, 13, 18]) {
    const mitad = (TAMANO * (2 ** z)) / 2;
    assert.ok(Math.abs(mapa.aX(0, z) - mitad) < 0.001, `longitud 0 en zoom ${z}`);
    assert.ok(Math.abs(mapa.aY(0, z) - mitad) < 0.001, `latitud 0 en zoom ${z}`);
  }
});

test('ir y volver da lo mismo: la conversión no pierde el punto', () => {
  for (const [lat, lon] of [[21.0167, -89.8744], [19.4326, -99.1332],
                            [-33.8688, 151.2093], [60.1699, 24.9384]]) {
    for (const z of [3, 10, 16]) {
      const x = mapa.aX(lon, z);
      const y = mapa.aY(lat, z);
      assert.ok(Math.abs(mapa.aLon(x, z) - lon) < 1e-9, `longitud ida y vuelta, zoom ${z}`);
      assert.ok(Math.abs(mapa.aLat(y, z) - lat) < 1e-9, `latitud ida y vuelta, zoom ${z}`);
    }
  }
});

test('acercarse duplica: es lo que hace que partir un mosaico en cuatro funcione', () => {
  const lon = -89.8744;
  for (let z = 3; z < 18; z++) {
    assert.ok(Math.abs(mapa.aX(lon, z + 1) - mapa.aX(lon, z) * 2) < 1e-6);
  }
});

test('el encuadre mete a TODAS las neveras dentro de la pantalla', () => {
  // Cuatro puntos repartidos por Hunucmá, como los del mapa de verdad.
  const puntos = [
    { lat: 21.0180, lon: -89.8760 }, { lat: 21.0140, lon: -89.8700 },
    { lat: 21.0210, lon: -89.8810 }, { lat: 21.0100, lon: -89.8730 }
  ];
  const ancho = 800;
  const alto = 400;
  const v = mapa.encuadrar(puntos, ancho, alto);

  assert.ok(v.zoom >= 3 && v.zoom <= 18);

  // Con ese encuadre, todos los puntos tienen que caer dentro del recuadro.
  const x0 = mapa.aX(v.centro.lon, v.zoom) - ancho / 2;
  const y0 = mapa.aY(v.centro.lat, v.zoom) - alto / 2;
  for (const p of puntos) {
    const px = mapa.aX(p.lon, v.zoom) - x0;
    const py = mapa.aY(p.lat, v.zoom) - y0;
    assert.ok(px >= 0 && px <= ancho, `se salió a lo ancho: ${px}`);
    assert.ok(py >= 0 && py <= alto, `se salió a lo alto: ${py}`);
  }

  // Y tiene que ser el MÁS CERCA posible: uno más y ya no cabrían.
  const masCerca = v.zoom + 1;
  const xs = puntos.map((p) => mapa.aX(p.lon, masCerca));
  const ys = puntos.map((p) => mapa.aY(p.lat, masCerca));
  assert.ok(Math.max(...xs) - Math.min(...xs) > ancho - 120
    || Math.max(...ys) - Math.min(...ys) > alto - 120,
    'si con un acercamiento más todavía cupieran, se está viendo de más lejos de lo necesario');
});

test('una nevera sola se ve de cerca, no el planeta entero', () => {
  const v = mapa.encuadrar([{ lat: 21.0167, lon: -89.8744 }], 800, 400);
  assert.equal(v.zoom, 16, 'un punto no tiene extensión: se le pone zoom de calle');
  assert.equal(v.centro.lat, 21.0167);
});

test('sin ni un punto con coordenadas no hay encuadre que hacer', () => {
  assert.equal(mapa.encuadrar([], 800, 400), null);
  assert.equal(mapa.encuadrar([{ lat: null, lon: null }], 800, 400), null);
});

// ============================================================
// EL ENLACE DE GOOGLE MAPS
//
// Nadie va a teclear una latitud a mano: se pega el enlace que da el
// botón de compartir. Google lo escribe de varias formas y hay que
// entenderlas todas, porque el usuario no sabe cuál le tocó.
// ============================================================

test('las coordenadas se sacan de cualquiera de las formas de Google', () => {
  const casos = [
    ['https://www.google.com/maps/@21.0167,-89.8744,17z', 21.0167, -89.8744],
    ['https://maps.google.com/?q=21.0167,-89.8744', 21.0167, -89.8744],
    ['21.0167, -89.8744', 21.0167, -89.8744],
    ['  21.0167,-89.8744  ', 21.0167, -89.8744],
    ['https://www.google.com/maps/place/Hunucma/@21.0167,-89.8744,15z/data=!3m1',
     21.0167, -89.8744]
  ];

  for (const [texto, lat, lon] of casos) {
    const p = mapa.leerEnlace(texto);
    assert.ok(p, `no salió nada de: ${texto}`);
    assert.equal(p.lat, lat);
    assert.equal(p.lon, lon);
  }
});

test('lo que no trae coordenadas se dice que no, en vez de inventarlas', () => {
  for (const texto of ['', null, 'Calle 20 x 15 y 17',
                       'https://www.google.com/maps/place/Hunucma',
                       '999.5, -89.8']) {
    assert.equal(mapa.leerEnlace(texto), null, `no debería salir nada de: ${texto}`);
  }
});

test('el enlace para ir sale con las coordenadas, y si no, con el nombre', () => {
  assert.match(mapa.enlaceMaps(21.0167, -89.8744),
               /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=21\.0167,-89\.8744$/);

  // Sin coordenadas se busca por la dirección escrita, que es la que
  // siempre está: el mapa es el lujo, la dirección es la que manda.
  assert.match(mapa.enlaceMaps(null, null, 'Calle 20 x 15, Hunucmá'),
               /query=Calle%2020%20x%2015%2C%20Hunucm/);

  assert.equal(mapa.enlaceMaps(null, null, ''), null);
});
