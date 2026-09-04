/**
 * PRUEBAS DEL CÓDIGO QR  (v5.6)
 *
 * ============================================================
 * POR QUÉ ESTE ARCHIVO ES MÁS LARGO QUE OTROS
 * ============================================================
 *
 * Un QR mal hecho NO TRUENA. Sale un cuadrito con su dibujo, se ve
 * perfectamente bien impreso en la nota, y el teléfono del repartidor
 * simplemente no lo lee. Nadie se entera hasta que alguien está parado en
 * la calle intentando escanearlo, y ahí ya no hay a quién preguntarle.
 *
 * Así que se comprueba de tres maneras distintas, y las tres tienen que
 * salir bien:
 *
 *   1. CONTRA LA NORMA. Los códigos de corrección, los bits de formato y
 *      los de versión están publicados en las tablas del estándar. Se
 *      comparan letra por letra con esas tablas.
 *
 *   2. LEYÉNDOLO DE VUELTA. Aquí abajo hay un LECTOR de QR escrito
 *      aparte, que hace el camino contrario: mira el dibujo, averigua qué
 *      máscara se usó, la quita, lee los cuadritos en zigzag, desbaraja
 *      los bloques y saca el texto. Si lo que sale es lo que entró, el
 *      dibujo está bien puesto.
 *
 *   3. COMPROBANDO LAS CUENTAS DE CORRECCIÓN POR OTRO CAMINO. Un bloque
 *      bien construido vale CERO al evaluarlo en unos puntos concretos.
 *      Es la misma comprobación que hace el lector de un teléfono para
 *      saber si leyó bien, y no depende de nada de lo que hay arriba.
 */
const test = require('node:test');
const assert = require('node:assert');
const { qr, enlaceDeMapa, bitsDeFormato, bitsDeVersion,
        correccion } = require('../src/lib/qr');

/* ============================================================
 * 1. CONTRA LAS TABLAS DE LA NORMA
 * ============================================================ */

test('los códigos de corrección son los del ejemplo de la norma', () => {
  // El ejemplo que trae el estándar (ISO/IEC 18004, anexo I): versión 1,
  // corrección M. Estos dieciséis bytes de datos tienen que dar
  // exactamente estos diez de corrección. Es la prueba que no depende de
  // nada nuestro: los números están impresos en el documento.
  const datos = [0x10, 0x20, 0x0c, 0x56, 0x61, 0x80, 0xec, 0x11,
                 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11];
  assert.deepStrictEqual(correccion(datos, 10),
    [0xa5, 0x24, 0xd4, 0xc1, 0xed, 0x36, 0xc7, 0x87, 0x2c, 0x55]);
});

test('los bits de formato son los de la tabla C.1', () => {
  // Corrección M, una fila por máscara.
  const tabla = ['101010000010010', '101000100100101', '101111001111100',
                 '101101101001011', '100010111111001', '100000011001110',
                 '100111110010111', '100101010100000'];
  for (let m = 0; m < 8; m++) {
    assert.strictEqual(bitsDeFormato(m).toString(2).padStart(15, '0'), tabla[m],
      `la máscara ${m}`);
  }
});

test('los bits de versión son los de la tabla D.1', () => {
  // Solo hacen falta de la versión 7 en adelante; abajo de eso el lector
  // deduce la versión del tamaño del dibujo.
  const tabla = {
    7: '000111110010010100', 8: '001000010110111100',
    9: '001001101010011001', 10: '001010010011010011'
  };
  for (const [v, bits] of Object.entries(tabla)) {
    assert.strictEqual(bitsDeVersion(Number(v)).toString(2).padStart(18, '0'), bits,
      `la versión ${v}`);
  }
});

/* ============================================================
 * 2. EL LECTOR — el camino de vuelta
 * ============================================================ */

const BLOQUES = {
  1: { ec: 10, grupos: [[1, 16]] }, 2: { ec: 16, grupos: [[1, 28]] },
  3: { ec: 26, grupos: [[1, 44]] }, 4: { ec: 18, grupos: [[2, 32]] },
  5: { ec: 24, grupos: [[2, 43]] }, 6: { ec: 16, grupos: [[4, 27]] },
  7: { ec: 18, grupos: [[4, 31]] }, 8: { ec: 22, grupos: [[2, 38], [2, 39]] },
  9: { ec: 22, grupos: [[3, 36], [2, 37]] }, 10: { ec: 26, grupos: [[4, 43], [1, 44]] }
};
const ALINEACION = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
  7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
};

/** Qué casillas son dibujo fijo y no llevan datos. Escrito aparte a propósito. */
function fijas(version) {
  const n = version * 4 + 17;
  const f = Array.from({ length: n }, () => new Array(n).fill(false));
  const marcar = (x, y) => { if (x >= 0 && y >= 0 && x < n && y < n) f[y][x] = true; };

  for (const [fx, fy] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
    for (let dy = -1; dy <= 7; dy++) for (let dx = -1; dx <= 7; dx++) marcar(fx + dx, fy + dy);
  }
  for (let i = 0; i < n; i++) { marcar(i, 6); marcar(6, i); }
  const centros = ALINEACION[version];
  for (const cy of centros) for (const cx of centros) {
    if ((cx === 6 && cy === 6) || (cx === 6 && cy === n - 7) || (cx === n - 7 && cy === 6)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) marcar(cx + dx, cy + dy);
  }
  for (let i = 0; i <= 8; i++) { marcar(i, 8); marcar(8, i); }
  for (let i = 0; i < 8; i++) { marcar(n - 1 - i, 8); marcar(8, n - 1 - i); }
  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      marcar(Math.floor(i / 3), n - 11 + (i % 3));
      marcar(n - 11 + (i % 3), Math.floor(i / 3));
    }
  }
  return f;
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

/** Lee el dibujo y devuelve el texto que lleva dentro. */
function leerQR({ tamano: n, modulos, version }) {
  // QUÉ MÁSCARA SE USÓ. Se lee del propio dibujo, no se supone: es lo
  // mismo que hace un teléfono, y si estuviera mal escrita el texto
  // saldría convertido en basura.
  // El recorrido de la norma: baja por la columna 8, dobla, y sigue por
  // la fila 8 hacia la izquierda. (Antes estaba en espejo, igual que el
  // codificador, y por eso la ida y vuelta pasaba con un QR que ningún
  // teléfono leía. Ahora hay además una prueba contra un codificador de
  // fuera, que es la que de verdad manda.)
  let formato = 0;
  for (let i = 0; i <= 5; i++) formato |= modulos[i][8] << i;
  formato |= modulos[7][8] << 6;
  formato |= modulos[8][8] << 7;
  formato |= modulos[8][7] << 8;
  for (let i = 9; i <= 14; i++) formato |= modulos[8][14 - i] << i;
  const crudo = formato ^ 0b101010000010010;
  assert.strictEqual((crudo >> 13) & 0b11, 0b00, 'el nivel de corrección tiene que ser M');
  const mascara = (crudo >> 10) & 0b111;

  const f = fijas(version);
  const m = modulos.map((fila, y) => fila.map((v, x) => (!f[y][x] && MASCARAS[mascara](x, y) ? v ^ 1 : v)));

  // El zigzag, al revés.
  const bits = [];
  let subiendo = true;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let i = 0; i < n; i++) {
      const y = subiendo ? n - 1 - i : i;
      for (const x of [col, col - 1]) if (!f[y][x]) bits.push(m[y][x]);
    }
    subiendo = !subiendo;
  }
  const bytes = [];
  for (let p = 0; p + 8 <= bits.length; p += 8) {
    bytes.push(bits.slice(p, p + 8).reduce((v, b) => (v << 1) | b, 0));
  }

  // Desbarajar los bloques.
  const { ec, grupos } = BLOQUES[version];
  const tamanos = [];
  for (const [cuantos, tam] of grupos) for (let i = 0; i < cuantos; i++) tamanos.push(tam);
  const datos = tamanos.map(() => []);
  const total = tamanos.reduce((a, b) => a + b, 0);

  let p = 0;
  const masLargo = Math.max(...tamanos);
  for (let i = 0; i < masLargo; i++) {
    for (let b = 0; b < tamanos.length; b++) if (i < tamanos[b]) datos[b].push(bytes[p++]);
  }
  const paridad = tamanos.map(() => []);
  for (let i = 0; i < ec; i++) for (let b = 0; b < tamanos.length; b++) paridad[b].push(bytes[p++]);
  assert.strictEqual(p, total + ec * tamanos.length, 'la cuenta de bytes leídos');

  // Y el texto: modo, cuántas letras, y las letras.
  const flujo = datos.flat();
  const leerBits = (desde, cuantos) => {
    let v = 0;
    for (let i = 0; i < cuantos; i++) {
      const bit = desde + i;
      v = (v << 1) | ((flujo[bit >> 3] >> (7 - (bit & 7))) & 1);
    }
    return v;
  };
  assert.strictEqual(leerBits(0, 4), 0b0100, 'tiene que estar en modo byte');
  const anchoCuenta = version < 10 ? 8 : 16;
  const cuantas = leerBits(4, anchoCuenta);
  const letras = [];
  for (let i = 0; i < cuantas; i++) letras.push(leerBits(4 + anchoCuenta + i * 8, 8));

  return { texto: Buffer.from(letras).toString('utf8'), mascara, datos, paridad, ec };
}

test('lo que entra es lo que sale (ida y vuelta)', () => {
  const casos = [
    'A',
    'https://www.google.com/maps/search/?api=1&query=21.0163,-89.8756',
    'Abarrotes Juan — pedido 47',            // con acentos y raya larga
    'ñÑáéíóúü ¿qué tal?',                    // fuera de ASCII: dos bytes cada una
    'x'.repeat(120),                          // obliga a una versión grande
    'x'.repeat(213)                           // el tope de lo que cabe
  ];
  for (const texto of casos) {
    const codigo = qr(texto);
    assert.strictEqual(leerQR(codigo).texto, texto, `no volvió igual: ${texto.slice(0, 30)}`);
  }
});

/* ============================================================
 * 3. LAS CUENTAS DE CORRECCIÓN, POR OTRO CAMINO
 * ============================================================ */

test('cada bloque pasa la comprobación que hace el teléfono', () => {
  // Un bloque bien armado, evaluado en unos puntos concretos, da cero.
  // Es exactamente lo que comprueba el lector de un teléfono antes de
  // darse por leído. Se calcula aquí con su propia tabla, sin usar nada
  // del archivo que se está probando.
  const EXP = new Array(512);
  const LOG = new Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const por = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

  const codigo = qr('https://www.google.com/maps/search/?api=1&query=21.0163,-89.8756');
  const { datos, paridad, ec } = leerQR(codigo);

  datos.forEach((bloque, i) => {
    const completo = [...bloque, ...paridad[i]];
    for (let s = 0; s < ec; s++) {
      let suma = 0;
      for (const byte of completo) suma = por(suma, EXP[s]) ^ byte;
      assert.strictEqual(suma, 0, `el bloque ${i} no cuadra en el punto ${s}`);
    }
  });
});

/* ============================================================
 * EL DIBUJO, POR FUERA
 * ============================================================ */

test('los tres ojos de las esquinas están donde tienen que estar', () => {
  const { tamano: n, modulos } = qr('hola');
  for (const [fx, fy] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
    assert.strictEqual(modulos[fy][fx], 1);
    assert.strictEqual(modulos[fy + 3][fx + 3], 1, 'el centro del ojo');
    assert.strictEqual(modulos[fy + 1][fx + 1], 0, 'el anillo blanco del ojo');
  }
  // La esquina de abajo a la derecha NO lleva ojo: es lo que le dice al
  // lector cómo está girado el papel.
  assert.strictEqual(modulos[n - 4][n - 4], 0);
});

test('las rayitas de en medio alternan', () => {
  const { tamano: n, modulos } = qr('hola');
  for (let i = 8; i < n - 8; i++) {
    assert.strictEqual(modulos[6][i], i % 2 === 0 ? 1 : 0, `la columna ${i}`);
    assert.strictEqual(modulos[i][6], i % 2 === 0 ? 1 : 0, `el renglón ${i}`);
  }
});

test('el tamaño crece con el texto, y hay un tope', () => {
  assert.strictEqual(qr('hola').tamano, 21);                      // versión 1
  assert.ok(qr('x'.repeat(100)).tamano > 21);
  assert.throws(() => qr('x'.repeat(300)), /demasiado largo/);
  assert.throws(() => qr(''), /vacío/);
});

/* ============================================================
 * EL ENLACE DEL MAPA
 * ============================================================ */

test('el enlace lleva las coordenadas cuando las hay', () => {
  assert.strictEqual(
    enlaceDeMapa({ latitud: 21.0163, longitud: -89.8756 }),
    'https://www.google.com/maps/search/?api=1&query=21.0163,-89.8756');
});

test('sin coordenadas se va con la dirección escrita', () => {
  const e = enlaceDeMapa({ direccion: 'Calle 20 #145, Hunucmá' });
  assert.match(e, /query=Calle%2020/);
});

test('sin nada, no hay enlace', () => {
  // Y esto importa: un QR que lleva a "null,null" manda al repartidor al
  // golfo de Guinea, que es donde cae la coordenada cero. Más vale que la
  // nota salga sin QR.
  assert.strictEqual(enlaceDeMapa({}), null);
  assert.strictEqual(enlaceDeMapa({ latitud: null, longitud: null }), null);
  assert.strictEqual(enlaceDeMapa({ latitud: 21.01, longitud: null, direccion: '' }), null);
});

/* ============================================================
 * 4. CONTRA UN CODIFICADOR DE FUERA, CUADRITO POR CUADRITO  (v5.8.1)
 *
 * Es la prueba que faltaba, y la que habría cazado el error del formato
 * en espejo: las tres de arriba se hacían con piezas escritas aquí, y un
 * error repetido en las dos mitades pasa la ida y vuelta.
 *
 * Los dibujos de `qr-referencia.json` los produjo la librería `qrcode`
 * (la de npm, en una carpeta aparte, fuera de este sistema) para estos
 * textos, con corrección M. Se guardan como texto para que la prueba no
 * dependa de nada instalado: el sistema sigue sin más dependencia que
 * express.
 * ============================================================ */
test('sale IDÉNTICO a un codificador de fuera, con la misma máscara', () => {
  const referencias = require('./qr-referencia.json');
  for (const ref of referencias) {
    const mio = qr(ref.texto, { mascara: ref.mascara });
    const filas = mio.modulos.map((f) => f.join(''));
    assert.equal(filas.length, ref.filas.length, `tamaño distinto para ${ref.texto.slice(0, 20)}`);
    for (let y = 0; y < filas.length; y++) {
      assert.equal(filas[y], ref.filas[y],
        `${ref.texto.slice(0, 20)}: la fila ${y} no coincide`);
    }
  }
});
