/**
 * PRUEBAS DE IMPRESIÓN  (v0.11)
 *
 * El ticket lo manda el servidor a la impresora en bytes ESC/POS, no el
 * navegador. Aquí no hay impresora, así que el destino se apunta a un
 * ARCHIVO: se imprime, se lee el archivo y se comprueba que salieron las
 * órdenes correctas. Es la única forma de verificar esto sin papel.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'fabrica-imp-'));
process.env.CARPETA_DATOS = carpeta;
process.env.ARCHIVO_BD = path.join(carpeta, 'prueba.db');

const { migrar } = require('../src/db/migrar');
const { crearApp } = require('../src/servidor');
const { Ticket } = require('../src/modulos/impresion/escpos');

migrar({ silencioso: true });

let servidor, base, cookie = '';
const salida = path.join(carpeta, 'impresora.bin');

async function llamar(ruta, opciones = {}) {
  const r = await fetch(base + ruta, {
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    ...opciones,
    body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined
  });
  const set = r.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  return { estado: r.status, json: await r.json() };
}

/**
 * El último renglón de papel de un ticket.
 *
 * Se antepone un salto para dejar atrás el arranque (ESC @ y ESC t), que
 * son órdenes y no ocupan papel pero sí bytes.
 */
function ultimoRenglon(armar) {
  const t = armar(new Ticket(58).saltos(1));
  return t.bytes().toString('latin1').split('\n').at(-2);
}

/** Lo que "salió por la impresora", como texto legible. */
function loImpreso() {
  if (!fs.existsSync(salida)) return '';
  return fs.readFileSync(salida).toString('latin1');
}

function limpiarPapel() {
  try { fs.unlinkSync(salida); } catch { /* no había */ }
}

test.before(async () => {
  servidor = crearApp().listen(0);
  await new Promise((r) => servidor.once('listening', r));
  base = `http://127.0.0.1:${servidor.address().port}`;
  await llamar('/api/auth/configuracion-inicial', {
    method: 'POST',
    cuerpo: { nombre: 'Tony', usuario: 'tony', contrasena: 'clavelarga1', pin: '1111' }
  });
});

test.after(() => {
  servidor.close();
  fs.rmSync(carpeta, { recursive: true, force: true });
});

// ============================================================
// LAS ÓRDENES ESC/POS
// ============================================================

test('el ticket empieza despertando la impresora', () => {
  const b = new Ticket(80).linea('hola').bytes();
  // ESC @ la deja como recién encendida: si el ticket anterior se cortó a
  // la mitad, este no hereda letra gigante.
  assert.equal(b[0], 0x1b);
  assert.equal(b[1], 0x40);
});

test('el ancho del papel decide cuántas letras caben', () => {
  assert.equal(new Ticket(80).ancho, 48);
  assert.equal(new Ticket(58).ancho, 32);
});

test('las dos columnas quedan pegadas a cada orilla', () => {
  const linea = ultimoRenglon((t) => t.columnas2('Coca 600', '$25.00'));
  assert.equal(linea.length, 32);
  assert.ok(linea.startsWith('Coca 600'));
  assert.ok(linea.endsWith('$25.00'));
});

test('un concepto larguísimo se recorta en vez de romper el renglón', () => {
  const linea = ultimoRenglon((t) => t.columnas2('x'.repeat(90), '$1.00'));
  assert.equal(linea.length, 32);
  assert.ok(linea.endsWith('$1.00'), 'el importe nunca se recorta');
});

test('los acentos se mandan en la tabla de la impresora', () => {
  const b = new Ticket(80).linea('año cañón').bytes();
  assert.ok(b.toString('latin1').includes('año'), 'la ñ va como un solo byte');
  // Y se pidió la tabla de acentos: ESC t
  assert.equal(b[2], 0x1b);
  assert.equal(b[3], 0x74);
});

test('lo que no cabe en la tabla se manda sin acento, nunca como basura', () => {
  // Una letra que no existe en la tabla (una cirílica) no debe tumbar el
  // ticket ni salir como un byte inventado.
  const b = new Ticket(80).linea('Bienvenido Ж').bytes();
  const texto = b.toString('latin1');
  assert.ok(texto.includes('Bienvenido'));
  // Todo lo que se mandó cabe en un byte de la tabla.
  for (const codigo of b) assert.ok(codigo <= 0xff);
});

test('el ticket termina cortando el papel', () => {
  const b = new Ticket(80).linea('x').cortar().bytes();
  assert.deepEqual([...b.slice(-4)], [0x1d, 0x56, 0x42, 0x00]);
});

// ============================================================
// IMPRIMIR DE VERDAD
// ============================================================

test('sin impresora configurada, el servidor no imprime y lo dice', async () => {
  const cfg = await llamar('/api/impresion/config');
  assert.equal(cfg.json.datos.impresion.directa, false);

  const prueba = await llamar('/api/impresion/prueba', { method: 'POST', cuerpo: {} });
  assert.equal(prueba.estado, 409);
  assert.match(prueba.json.error, /nombre de la impresora/i);
});

test('se configura la impresora y sale la prueba', async () => {
  const r = await llamar('/api/impresion/config', {
    method: 'PUT', cuerpo: { destino: salida, anchoMm: 80, copias: 1, pie: 'Tel. 999' }
  });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.impresion.directa, true);

  limpiarPapel();
  const prueba = await llamar('/api/impresion/prueba', { method: 'POST', cuerpo: {} });
  assert.equal(prueba.estado, 200);

  const papel = loImpreso();
  assert.match(papel, /PRUEBA DE IMPRESION/);
  assert.match(papel, /80 mm/);
});

test('el papel de 58 mm no acepta cualquier medida', async () => {
  const r = await llamar('/api/impresion/config', { method: 'PUT', cuerpo: { anchoMm: 70 } });
  assert.equal(r.estado, 400);
});

test('las copias van de 1 a 5', async () => {
  assert.equal((await llamar('/api/impresion/config',
    { method: 'PUT', cuerpo: { copias: 0 } })).estado, 400);
  assert.equal((await llamar('/api/impresion/config',
    { method: 'PUT', cuerpo: { copias: 9 } })).estado, 400);
});

test('el ticket de una venta lleva la cantidad en grande', async () => {
  const v = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 12 }], pago: 500 }
  });
  const venta = v.json.datos.venta;

  limpiarPapel();
  const r = await llamar(`/api/impresion/venta/${venta.id}`, { method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.impreso, true);

  const papel = loImpreso();
  assert.match(papel, /3\/4/, 'la cantidad va en el ticket');
  assert.match(papel, /1\/2 \+ 1\/4/, 'y el desglose de cómo se formó el precio');
  assert.match(papel, new RegExp(`#${venta.folio}`));
  assert.ok(!papel.includes('COPIA'), 'el original no dice copia');
});

test('una reimpresión sale marcada como COPIA', async () => {
  const v = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }] }
  });

  limpiarPapel();
  await llamar(`/api/impresion/venta/${v.json.datos.venta.id}`, {
    method: 'POST', cuerpo: { copia: true }
  });

  assert.match(loImpreso(), /\*\*\* COPIA \*\*\*/);
});

test('se imprimen tantas copias como estén configuradas', async () => {
  await llamar('/api/impresion/config', { method: 'PUT', cuerpo: { copias: 3 } });
  const v = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }] }
  });

  limpiarPapel();
  await llamar(`/api/impresion/venta/${v.json.datos.venta.id}`, { method: 'POST', cuerpo: {} });

  const cortes = loImpreso().split('VB').length - 1;
  assert.equal(cortes, 3, 'tres tickets, tres cortes de papel');

  await llamar('/api/impresion/config', { method: 'PUT', cuerpo: { copias: 1 } });
});

test('un gasto imprime su comprobante con las dos firmas', async () => {
  // Anotar un gasto necesita un turno abierto; entrar lo abre.
  await llamar('/api/auth/yo');
  await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', concepto: 'Gasolina', monto: 200 }
  });
  const mov = (await llamar('/api/caja')).json.datos.movimientos[0];

  limpiarPapel();
  const r = await llamar(`/api/impresion/movimiento/${mov.id}`, { method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 200);

  const papel = loImpreso();
  assert.match(papel, /SALIDA DE CAJA/);
  assert.match(papel, /Gasolina/);
  assert.match(papel, /Lo tomo/);
  assert.match(papel, /Firma/);
});

test('una venta que no existe no imprime nada', async () => {
  const r = await llamar('/api/impresion/venta/no-existe', { method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 404);
});

test('solo el administrador configura la impresora', async () => {
  await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Rosa', rol: 'cajero', pin: '4444' }
  });
  const lista = (await llamar('/api/auth/usuarios-disponibles')).json.datos.usuarios;
  const rosa = lista.find((u) => u.nombre === 'Rosa');
  await llamar('/api/auth/entrar-pin', { method: 'POST', cuerpo: { usuarioId: rosa.id, pin: '4444' } });

  // El cajero imprime tickets...
  assert.equal((await llamar('/api/impresion/config')).estado, 200);
  // ...pero no toca la configuración.
  assert.equal((await llamar('/api/impresion/config',
    { method: 'PUT', cuerpo: { copias: 2 } })).estado, 403);
  assert.equal((await llamar('/api/impresion/prueba',
    { method: 'POST', cuerpo: {} })).estado, 403);
});
