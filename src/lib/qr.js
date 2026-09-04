/**
 * EL CÓDIGO QR  (v5.6)
 *
 * ============================================================
 * PARA QUÉ
 * ============================================================
 *
 * "Esa orden de entrega también debe tener un QR que el repartidor podrá
 *  escanear y le saldrá la ubicación en Google Maps del cliente."
 *
 * Una dirección escrita lleva al rumbo. El QR lleva a la puerta, y sobre
 * todo se lee con el teléfono en una mano y sin teclear nada — que es la
 * única forma de usarlo cuando se va manejando.
 *
 * ============================================================
 * POR QUÉ ESTÁ ESCRITO AQUÍ Y NO SE BAJÓ DE INTERNET
 * ============================================================
 *
 * Hay dos caminos más cortos y los dos están cerrados:
 *
 *   PEDIRLE LA IMAGEN A UN SERVICIO DE INTERNET. La fábrica trabaja con
 *   la luz que hay y con el internet que hay. El día que se caiga —y se
 *   cae— las notas de entrega saldrían sin QR, que es justo el día en que
 *   se necesita todo funcionando.
 *
 *   AGREGAR UNA LIBRERÍA. Este sistema tiene UNA dependencia (express) a
 *   propósito: se instala en una PC de una fábrica de hielo y tiene que
 *   arrancar dentro de cinco años sin que nadie sepa qué es npm.
 *
 * Así que el QR se dibuja aquí. Son ciento y pico de líneas de una norma
 * que no cambia desde 1994 (ISO/IEC 18004), y a cambio la nota de entrega
 * sale igual con internet y sin internet.
 *
 * ============================================================
 * QUÉ HACE Y QUÉ NO
 * ============================================================
 *
 * Modo BYTE (sirve para cualquier texto), corrección M, versiones 1 a 10
 * — hasta 213 letras. Un enlace de Google Maps con sus coordenadas mide
 * unas 65, así que sobra sitio.
 *
 * Corrección M significa que el código se sigue leyendo con hasta un 15%
 * del dibujo perdido. No es un lujo: esta nota va doblada en la bolsa del
 * repartidor, con las manos mojadas, y al mediodía trae una arruga.
 */

/* ============================================================
 * LA ARITMÉTICA RARA (campo de Galois GF(256))
 *
 * Los códigos de corrección se calculan en una aritmética donde sumar es
 * el XOR y multiplicar se hace con dos tablas. No hay que entenderla para
 * mantener este archivo: es una calculadora, y está aquí porque el resto
 * la usa.
 * ============================================================ */
const EXP = new Array(512);
const LOG = new Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;      // el polinomio que manda la norma
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const por = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** El polinomio generador para `grado` códigos de corrección. */
function generador(grado) {
  let g = [1];
  for (let i = 0; i < grado; i++) {
    const nuevo = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      nuevo[j] ^= g[j];
      nuevo[j + 1] ^= por(g[j], EXP[i]);
    }
    g = nuevo;
  }
  return g;
}

/**
 * LOS BYTES DE CORRECCIÓN de un bloque de datos.
 *
 * Es la división larga de toda la vida, pero con la aritmética de arriba:
 * lo que queda es el resto, y ese resto es lo que permite leer el código
 * aunque le falte un pedazo.
 */
function correccion(datos, cuantos) {
  const g = generador(cuantos);
  const resto = new Array(cuantos).fill(0);
  for (const byte of datos) {
    const factor = byte ^ resto[0];
    resto.shift();
    resto.push(0);
    if (factor !== 0) {
      for (let i = 0; i < cuantos; i++) resto[i] ^= por(g[i + 1], factor);
    }
  }
  return resto;
}

/* ============================================================
 * LAS TABLAS DE LA NORMA
 *
 * Cuántos bloques lleva cada versión y de qué tamaño. No se deducen: son
 * las que están impresas en el estándar, copiadas tal cual.
 * ============================================================ */

// version: { ec: bytes de corrección por bloque, grupos: [[cuántos, datos]] }
const BLOQUES = {
  1:  { ec: 10, grupos: [[1, 16]] },
  2:  { ec: 16, grupos: [[1, 28]] },
  3:  { ec: 26, grupos: [[1, 44]] },
  4:  { ec: 18, grupos: [[2, 32]] },
  5:  { ec: 24, grupos: [[2, 43]] },
  6:  { ec: 16, grupos: [[4, 27]] },
  7:  { ec: 18, grupos: [[4, 31]] },
  8:  { ec: 22, grupos: [[2, 38], [2, 39]] },
  9:  { ec: 22, grupos: [[3, 36], [2, 37]] },
  10: { ec: 26, grupos: [[4, 43], [1, 44]] }
};

// Dónde van los cuadritos de alineación (los ojos chiquitos del interior).
const ALINEACION = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
  7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
};

// Bits sueltos que sobran al final de la rejilla y se rellenan con ceros.
const SOBRANTES = { 1: 0, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7, 7: 0, 8: 0, 9: 0, 10: 0 };

/** Cuántos bytes de datos caben en una versión (sin contar la cabecera). */
function datosDe(version) {
  const b = BLOQUES[version];
  return b.grupos.reduce((n, [cuantos, tam]) => n + cuantos * tam, 0);
}

/** El renglón de bits que dice "cuántas letras vienen" mide 8 o 16. */
const bitsDeCuenta = (version) => (version < 10 ? 8 : 16);

function versionQueAlcanza(cuantosBytes) {
  for (let v = 1; v <= 10; v++) {
    const cabe = datosDe(v) - 2 - (bitsDeCuenta(v) === 16 ? 1 : 0);
    if (cuantosBytes <= cabe) return v;
  }
  return null;
}

/* ============================================================
 * ARMAR LA TIRA DE BITS
 * ============================================================ */
function tiraDeBits(bytes, version) {
  const bits = [];
  const meter = (valor, cuantos) => {
    for (let i = cuantos - 1; i >= 0; i--) bits.push((valor >> i) & 1);
  };

  meter(0b0100, 4);                              // modo byte
  meter(bytes.length, bitsDeCuenta(version));
  for (const b of bytes) meter(b, 8);

  const tope = datosDe(version) * 8;
  // El terminador: hasta cuatro ceros, y ni uno más de los que caben.
  for (let i = 0; i < 4 && bits.length < tope; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);

  // Lo que sobra se rellena con estos dos bytes alternados. Son los que
  // dice la norma; sirven para que el dibujo no quede con un manchón.
  const relleno = [0xec, 0x11];
  let i = 0;
  const cw = [];
  for (let p = 0; p < bits.length; p += 8) {
    cw.push(bits.slice(p, p + 8).reduce((n, b) => (n << 1) | b, 0));
  }
  while (cw.length < datosDe(version)) cw.push(relleno[i++ % 2]);
  return cw;
}

/**
 * LOS BLOQUES, INTERCALADOS.
 *
 * No se escriben uno tras otro sino barajados —el primer byte de cada
 * bloque, luego el segundo de cada uno...— para que una mancha de tinta
 * no se coma un bloque entero, sino un poco de cada uno, que sí se puede
 * corregir.
 */
function intercalar(codewords, version) {
  const { ec, grupos } = BLOQUES[version];
  const bloques = [];
  let p = 0;
  for (const [cuantos, tam] of grupos) {
    for (let i = 0; i < cuantos; i++) {
      const datos = codewords.slice(p, p + tam);
      p += tam;
      bloques.push({ datos, ec: correccion(datos, ec) });
    }
  }

  const salida = [];
  const masLargo = Math.max(...bloques.map((b) => b.datos.length));
  for (let i = 0; i < masLargo; i++) {
    for (const b of bloques) if (i < b.datos.length) salida.push(b.datos[i]);
  }
  for (let i = 0; i < ec; i++) for (const b of bloques) salida.push(b.ec[i]);
  return salida;
}

/* ============================================================
 * LOS DIBUJOS QUE NO SON DATOS
 * ============================================================ */

/**
 * Los tres cuadros de las esquinas, las rayitas de en medio, los cuadritos
 * de alineación y los huecos apartados para la información de formato.
 *
 * Devuelve { modulos, fijo }: el dibujo, y qué casillas ya están ocupadas
 * y no admiten datos.
 */
function armazon(version) {
  const n = version * 4 + 17;
  const modulos = Array.from({ length: n }, () => new Array(n).fill(0));
  const fijo = Array.from({ length: n }, () => new Array(n).fill(false));
  const poner = (x, y, v) => {
    if (x < 0 || y < 0 || x >= n || y >= n) return;
    modulos[y][x] = v ? 1 : 0;
    fijo[y][x] = true;
  };

  // LOS TRES OJOS de las esquinas, con su marco blanco alrededor.
  for (const [fx, fy] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
    for (let dy = -1; dy <= 7; dy++) {
      for (let dx = -1; dx <= 7; dx++) {
        const dentro = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
        const borde = dentro && (dx === 0 || dx === 6 || dy === 0 || dy === 6);
        const centro = dentro && dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
        poner(fx + dx, fy + dy, borde || centro);
      }
    }
  }

  // LAS RAYITAS que cruzan el código y le dicen al lector el tamaño del
  // cuadrito.
  for (let i = 8; i < n - 8; i++) {
    poner(i, 6, i % 2 === 0);
    poner(6, i, i % 2 === 0);
  }

  // LOS CUADRITOS DE ALINEACIÓN: los que enderezan la lectura cuando el
  // papel está torcido o arrugado.
  const centros = ALINEACION[version];
  for (const cy of centros) {
    for (const cx of centros) {
      const esquinaDeOjo = (cx === 6 && cy === 6)
        || (cx === 6 && cy === n - 7) || (cx === n - 7 && cy === 6);
      if (esquinaDeOjo) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const anillo = Math.abs(dx) === 2 || Math.abs(dy) === 2;
          poner(cx + dx, cy + dy, anillo || (dx === 0 && dy === 0));
        }
      }
    }
  }

  // El punto negro que siempre está ahí, sin más razón que la norma.
  poner(8, n - 8, true);

  // Sitio apartado para el formato (se llena al final, con la máscara ya
  // elegida). Se marca como fijo para que los datos lo esquiven.
  //
  // SE SALTA EL 6, y no es un detalle: en (6,8) y en (8,6) el formato se
  // cruza con las rayitas de en medio, y ahí mandan las rayitas. Aquí
  // estaban borradas —dos cuadritos negros puestos en blanco— y el dibujo
  // salía perfecto a la vista y sin leerse en ningún teléfono.
  for (let i = 0; i <= 8; i++) {
    if (i === 6) continue;
    poner(i, 8, false);
    poner(8, i, false);
  }
  for (let i = 0; i < 8; i++) { poner(n - 1 - i, 8, false); poner(8, n - 1 - i, false); }
  // El renglón de arriba acaba de pisar el punto negro de siempre —cae
  // dentro de la tira de abajo— así que se vuelve a poner.
  poner(8, n - 8, true);

  // Y de la versión 7 en adelante, el bloque que dice qué versión es.
  if (version >= 7) {
    const bits = bitsDeVersion(version);
    for (let i = 0; i < 18; i++) {
      const b = (bits >> i) & 1;
      poner(Math.floor(i / 3), n - 11 + (i % 3), b);
      poner(n - 11 + (i % 3), Math.floor(i / 3), b);
    }
  }

  return { n, modulos, fijo };
}

/** Los 18 bits que dicen la versión, con su propia corrección. */
function bitsDeVersion(version) {
  let resto = version << 12;
  // Seis vueltas: se limpian los seis bits de la versión (del 17 al 12) y
  // lo que queda debajo ES el resto. Con más vueltas el desplazamiento se
  // vuelve negativo y JavaScript lo interpreta al revés — sale basura.
  for (let i = 0; i < 6; i++) {
    if (resto & (1 << (17 - i))) resto ^= 0x1f25 << (5 - i);
  }
  return (version << 12) | resto;
}

/** Los 15 bits del formato: nivel de corrección M y qué máscara se usó. */
function bitsDeFormato(mascara) {
  const datos = (0b00 << 3) | mascara;          // 00 = corrección M
  let resto = datos << 10;
  for (let i = 0; i < 5; i++) {
    if (resto & (1 << (14 - i))) resto ^= 0x537 << (4 - i);
  }
  return ((datos << 10) | resto) ^ 0b101010000010010;
}

/* ============================================================
 * ESCRIBIR LOS DATOS Y ELEGIR LA MÁSCARA
 * ============================================================ */

/**
 * Los bytes se escriben en zigzag, de abajo a la derecha hacia arriba, en
 * columnas de dos. La columna 6 se salta porque ahí van las rayitas.
 */
function escribirDatos(n, modulos, fijo, bytes, sobrantes) {
  const bits = [];
  for (const b of bytes) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  for (let i = 0; i < sobrantes; i++) bits.push(0);

  let p = 0;
  let subiendo = true;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let i = 0; i < n; i++) {
      const y = subiendo ? n - 1 - i : i;
      for (const x of [col, col - 1]) {
        if (fijo[y][x]) continue;
        modulos[y][x] = p < bits.length ? bits[p++] : 0;
      }
    }
    subiendo = !subiendo;
  }
}

const MASCARAS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
];

/**
 * LA NOTA DE FEALDAD.
 *
 * Se prueban las ocho máscaras y gana la que deja el dibujo menos
 * problemático: sin rayas largas, sin cuadros de un solo color, sin
 * parecerse a los ojos de las esquinas y con blanco y negro repartidos.
 * Un código "feo" se lee peor, y esto es lo que lo evita.
 */
function fealdad(n, m) {
  let total = 0;

  // 1. Rachas de cinco o más del mismo color, en filas y en columnas.
  for (let i = 0; i < n; i++) {
    for (const fila of [true, false]) {
      let color = -1;
      let racha = 0;
      for (let j = 0; j < n; j++) {
        const v = fila ? m[i][j] : m[j][i];
        if (v === color) racha++;
        else { color = v; racha = 1; }
        if (racha === 5) total += 3;
        else if (racha > 5) total += 1;
      }
    }
  }

  // 2. Cuadros de 2x2 del mismo color.
  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      const v = m[y][x];
      if (v === m[y][x + 1] && v === m[y + 1][x] && v === m[y + 1][x + 1]) total += 3;
    }
  }

  // 3. El dibujo que se parece a un ojo de esquina (1:1:3:1:1 con blanco
  //    a un lado). Confunde al lector, y por eso cuesta caro.
  const patrones = [
    [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1]
  ];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j + 11 <= n; j++) {
      for (const p of patrones) {
        let fila = true;
        let col = true;
        for (let k = 0; k < 11; k++) {
          if (m[i][j + k] !== p[k]) fila = false;
          if (m[j + k][i] !== p[k]) col = false;
        }
        if (fila) total += 40;
        if (col) total += 40;
      }
    }
  }

  // 4. Qué tan desbalanceado está el blanco contra el negro.
  let negros = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) negros += m[y][x];
  const porciento = (negros * 100) / (n * n);
  total += Math.floor(Math.abs(porciento - 50) / 5) * 10;

  return total;
}

/* ============================================================
 * LA PUERTA DE ENTRADA
 * ============================================================ */

/**
 * Devuelve el código QR de un texto:
 *
 *   { version, tamano, modulos }   modulos[y][x] es 1 (negro) o 0 (blanco)
 *
 * NO incluye el margen blanco de alrededor. Ese margen —cuatro cuadritos
 * por lado, la "zona tranquila"— es obligatorio para que se lea, y lo pone
 * quien dibuja: en papel térmico lo hace `Ticket.qr()`, en pantalla el
 * dibujo de la vista previa.
 */
function qr(texto) {
  const bytes = [...Buffer.from(String(texto ?? ''), 'utf8')];
  if (!bytes.length) throw new Error('Un QR vacío no lleva a ninguna parte.');

  const version = versionQueAlcanza(bytes.length);
  if (!version) throw new Error('Ese texto es demasiado largo para un QR.');

  const codewords = intercalar(tiraDeBits(bytes, version), version);
  const { n, modulos: base, fijo } = armazon(version);

  let mejor = null;
  for (let mascara = 0; mascara < 8; mascara++) {
    const m = base.map((f) => [...f]);
    escribirDatos(n, m, fijo, codewords, SOBRANTES[version]);

    // La máscara se aplica SOLO a lo que no es dibujo fijo: pintar encima
    // de los ojos de las esquinas dejaría el código ilegible.
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (!fijo[y][x] && MASCARAS[mascara](x, y)) m[y][x] ^= 1;
      }
    }
    ponerFormato(n, m, mascara);

    const nota = fealdad(n, m);
    if (!mejor || nota < mejor.nota) mejor = { nota, modulos: m };
  }

  return { version, tamano: n, modulos: mejor.modulos };
}

/** Los 15 bits del formato van dos veces, repartidos por el dibujo. */
function ponerFormato(n, m, mascara) {
  const bits = bitsDeFormato(mascara);
  const b = (i) => (bits >> i) & 1;

  for (let i = 0; i <= 5; i++) m[8][i] = b(i);
  m[8][7] = b(6);
  m[8][8] = b(7);
  m[7][8] = b(8);
  for (let i = 9; i <= 14; i++) m[14 - i][8] = b(i);

  for (let i = 0; i <= 7; i++) m[n - 1 - i][8] = b(i);
  for (let i = 8; i <= 14; i++) m[8][n - 15 + i] = b(i);
  m[n - 8][8] = 1;                        // el punto negro de siempre
}

/**
 * EL ENLACE QUE SE METE EN EL QR.
 *
 * El formato oficial de Google Maps para "llévame aquí". Con coordenadas
 * si las hay —que es lo que sirve— y con la dirección escrita si no, que
 * al menos deja al repartidor en la calle correcta.
 */
function enlaceDeMapa({ latitud, longitud, direccion } = {}) {
  const bien = (v) => v !== null && v !== undefined && v !== ''
    && Number.isFinite(Number(v));
  if (bien(latitud) && bien(longitud)) {
    return `https://www.google.com/maps/search/?api=1&query=${Number(latitud)},${Number(longitud)}`;
  }
  const texto = String(direccion || '').trim();
  if (!texto) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(texto.slice(0, 120))}`;
}

module.exports = { qr, enlaceDeMapa, bitsDeFormato, bitsDeVersion, correccion };
