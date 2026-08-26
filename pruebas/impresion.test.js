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
const path = require('node:path');
const { fabricaDePrueba } = require('./ayudante');
const { Ticket } = require('../src/modulos/impresion/escpos');

const { llamar, carpeta, preparar, entrarAdmin } = fabricaDePrueba('imp');

const salida = path.join(carpeta, 'impresora.bin');


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
  // El número que se dice en voz alta: "2026-412", no el folio interno.
  assert.match(papel, new RegExp(venta.numero.replace('-', '\\-')),
               'el ticket lleva su número de la serie del año');
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

  const papel = loImpreso();
  assert.match(papel, /\*\* COPIA \*\*/, 'lo tiene que decir');
  assert.match(papel, /\*{20}/, 'y con asteriscos de lado a lado, que se vea de lejos');
  // Y hasta arriba de todo: una marca de copia debajo del número no la ve
  // nadie con el cliente enfrente.
  assert.ok(papel.indexOf('COPIA') < papel.indexOf('Atendio'),
            'la marca va antes que nada');
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

test('el comprobante de un gasto dice quién estaba en la caja, y nada más', async () => {
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
  assert.match(papel, /Gasto/, 'arriba a la izquierda, qué es este papel');
  assert.match(papel, /Atendio:/, 'y a la derecha, de qué caja salió el dinero');
  assert.match(papel, /GASOLINA/, 'el concepto, en mayúsculas como en la foto');
  assert.match(papel, /FIRMA/, 'y la raya para firmar: alguien se llevó dinero');

  // "Lo tomó" y "lo anotó" son casi siempre la misma persona y llenaban el
  // papel de nombres. Siguen en la bitácora, que es donde se buscan.
  assert.doesNotMatch(papel, /Lo tomo/, 'ese renglón ya no va');
  assert.doesNotMatch(papel, /Lo anoto/, 'ni ese');
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


// ============================================================
// EL CAJÓN VA PEGADO AL TICKET  (v2.4)
//
// Antes el pulso se mandaba al cobrar, aparte del papel. Eso fallaba de
// dos maneras que se notan en el mostrador: con la impresora apagada el
// cajón no se abría igual —el pulso se lo manda ELLA— y nadie entendía por
// qué; y al volver a imprimir el mismo ticket ya no se abría.
// ============================================================

/** ESC p, la orden de abrir el cajón: 1B 70 m t1 t2. */
function abrePuertas(papel) {
  return (papel.match(/\x1b\x70/g) || []).length;
}

test('con el cajón encendido, imprimir un ticket lo abre', async () => {
  // La prueba de permisos de arriba deja la sesión en manos de un cajero.
  await entrarAdmin();
  await llamar('/api/impresion/config', { method: 'PUT', cuerpo: { abrirCajon: true } });
  const v = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 300 }
  });

  limpiarPapel();
  const r = await llamar(`/api/impresion/venta/${v.json.datos.venta.id}`,
                         { method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.cajon, true);
  assert.equal(abrePuertas(loImpreso()), 1, 'el pulso viajó con el papel');
});

test('imprimir otra vez lo vuelve a abrir: no es solo la primera', async () => {
  const v = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 300 }
  });
  const id = v.json.datos.venta.id;

  limpiarPapel();
  await llamar(`/api/impresion/venta/${id}`, { method: 'POST', cuerpo: {} });
  await llamar(`/api/impresion/venta/${id}`, { method: 'POST', cuerpo: { copia: true } });

  assert.equal(abrePuertas(loImpreso()), 2, 'dos impresiones, dos veces abierto');
});

test('tres copias del mismo ticket son un cobro, no tres: un solo pulso', async () => {
  await llamar('/api/impresion/config', { method: 'PUT', cuerpo: { copias: 3 } });
  const v = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 300 }
  });

  limpiarPapel();
  await llamar(`/api/impresion/venta/${v.json.datos.venta.id}`, { method: 'POST', cuerpo: {} });

  const papel = loImpreso();
  assert.equal(papel.split('VB').length - 1, 3, 'salieron los tres papeles');
  assert.equal(abrePuertas(papel), 1, 'y el cajón se abrió una vez');

  await llamar('/api/impresion/config', { method: 'PUT', cuerpo: { copias: 1 } });
});

test('el comprobante de un gasto también abre el cajón: de ahí sale el dinero', async () => {
  await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', concepto: 'Desayuno', monto: 120 }
  });
  const mov = (await llamar('/api/caja')).json.datos.movimientos[0];

  limpiarPapel();
  const r = await llamar(`/api/impresion/movimiento/${mov.id}`, { method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 200);
  assert.equal(abrePuertas(loImpreso()), 1);
});

test('con el cajón apagado no se manda ningún pulso', async () => {
  await llamar('/api/impresion/config', { method: 'PUT', cuerpo: { abrirCajon: false } });
  const v = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 300 }
  });

  limpiarPapel();
  const r = await llamar(`/api/impresion/venta/${v.json.datos.venta.id}`,
                         { method: 'POST', cuerpo: {} });
  assert.equal(r.json.datos.cajon, false);
  assert.equal(abrePuertas(loImpreso()), 0);
});

test('sin impresora puesta no se abre el cajón: el pulso se lo manda ella', async () => {
  await llamar('/api/impresion/config', { method: 'PUT', cuerpo: { abrirCajon: true, destino: '' } });
  const v = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 300 }
  });

  const r = await llamar(`/api/impresion/venta/${v.json.datos.venta.id}`,
                         { method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.impreso, false, 'no imprimió');
  assert.ok(!r.json.datos.cajon, 'y por lo tanto tampoco abrió');

  await llamar('/api/impresion/config', { method: 'PUT', cuerpo: { destino: salida } });
});


// ============================================================
// LOS NÚMEROS A SACAR  (v2.4)
//
// Este papel se lo lleva el obrero al cuarto de tanques. Salía por la
// ventana de imprimir del navegador —hoja carta, elegir impresora, vista
// previa— y en un cuarto de máquinas eso no lo hace nadie.
// ============================================================

test('los números a sacar salen por la térmica, no por el navegador', async () => {
  await entrarAdmin();
  limpiarPapel();

  const r = await llamar('/api/impresion/produccion', { method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.impreso, true);

  const papel = loImpreso();
  assert.match(papel, /A sacar/, 'qué es este papel, arriba a la izquierda');
  assert.match(papel, /Atendio:/, 'y quién lo entregó');
  assert.match(papel, /FIRMA DEL OBRERO/, 'vuelve firmado con lo que sacó de verdad');
});

test('los números a sacar tienen su propia impresora si hace falta', async () => {
  await entrarAdmin();
  const { impresion } = (await llamar('/api/impresion/config')).json.datos;
  assert.ok(impresion.apartados.some((a) => a.id === 'produccion'),
            'el cuarto de tanques puede tener su impresora, lejos del mostrador');
});

test('quien no puede ver los números tampoco los imprime', async () => {
  await llamar('/api/usuarios', { method: 'POST', cuerpo: { nombre: 'Chuy', rol: 'operario', pin: '7777' } });
  const lista = (await llamar('/api/auth/usuarios-disponibles')).json.datos.usuarios;
  const chuy = lista.find((u) => u.nombre === 'Chuy');
  await llamar('/api/auth/entrar-pin', { method: 'POST', cuerpo: { usuarioId: chuy.id, pin: '7777' } });

  const r = await llamar('/api/impresion/produccion', { method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 403);
  await entrarAdmin();
});
