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
  // Un byte por letra, no dos: la ñ no se parte en n + tilde.
  assert.ok(b.includes(0xa4), 'la ñ va como un solo byte, el suyo en CP850');
  assert.ok(b.includes(0xa2), 'y la ó también');
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
  // EL DESGLOSE "(1/2 + 1/4)" SE QUITÓ  (v5.2.2). Decía de qué pedazos
  // salió la cuenta, y en el mostrador nadie lo miraba: lo que el cliente
  // comprueba es cuánto se llevó y cuánto costó, y eso ya está arriba.
  assert.ok(!papel.includes('1/2 + 1/4'),
            'el desglose entre paréntesis ya no va');
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
  assert.ok(papel.indexOf('COPIA') < papel.indexOf('#'),
            'la marca va antes que nada, hasta arriba del número');
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
  assert.match(papel, /Gasto/, 'arriba y en grande, qué es este papel');
  assert.match(papel, /Tony/, 'y debajo, de qué caja salió el dinero');
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
  assert.match(papel, /Hielo a sacar/, 'qué es este papel, arriba a la izquierda');
  assert.match(papel, /Tony/, 'y quién lo entregó, a la derecha del título');
  assert.match(papel, /FIRMA DEL OPERARIO/, 'vuelve firmado con lo que sacó de verdad');
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


// ============================================================
// EL CIERRE IMPRIME TRES COSAS  (v2.5)
//
// "Cuando hago el corte de turno me tiene que salir impreso: el ticket del
//  corte, cuánto hielo queda, y qué paños se sacaron en el día."
//
// Juntos, porque juntos es como se leen: si el cajón cuadra pero falta
// hielo, el problema no está en la caja.
// ============================================================

// EL RESUMEN DEL DÍA YA NO SALE CON EL CORTE  (v4.7)
//
// "Al hacer el corte me das 4 tickets, me parece mucho. El del día está
// genial, pero no quiero que se imprima cuando hago el corte: que lo pueda
// imprimir en otro lado, en un momento que quiera ver cómo está la cosa."
test('el corte ya NO arrastra el resumen del día', async () => {
  await entrarAdmin();
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 500 } });
  await llamar('/api/ventas', { method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 300 } });
  const cerrar = await llamar('/api/caja/cerrar', { method: 'POST', cuerpo: { contado: 764 } });
  const cajaId = cerrar.json.datos.corte.caja.id;

  limpiarPapel();
  const r = await llamar(`/api/impresion/corte/${cajaId}`, { method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 200);

  const papel = loImpreso();
  assert.match(papel, /Corte #/, 'el papel que se firma');
  assert.doesNotMatch(papel, /HIELO EN EL CUARTO FRIO/, 'eso es del papel del día');
  assert.doesNotMatch(papel, /PANOS SACADOS HOY/, 'y eso también');
  // Un corte de papel por cada papel: se entregan a personas distintas.
  assert.equal(papel.split('VB').length - 1, r.json.datos.papeles,
               'cada papel sale con su corte');
});

test('el papel del día sale cuando se pide, con quién sacó cada paño', async () => {
  await entrarAdmin();
  limpiarPapel();
  const r = await llamar('/api/impresion/dia', { method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 200);

  const papel = loImpreso();
  assert.match(papel, /El dia/, 'su propio papel');
  assert.match(papel, /HIELO EN EL CUARTO FRIO/, 'cuánto queda');
  assert.match(papel, /PANOS SACADOS HOY/, 'y qué se sacó');
});

// ============================================================
// EL CORTE EN DOS PAPELES  (v4.1)
//
// "Una como la que existe pero solo con el total de los gastos, corta el
// papel, y otra con los gastos, entradas y movimientos ya desglosaditos."
//
// Y no es solo gusto: el primero se firma y se entrega con el cajón; el
// segundo se queda en la carpeta. Son dos papeles porque son de dos
// personas distintas.
// ============================================================

test('el corte sale en dos papeles: el del dinero y el del detalle', async () => {
  await entrarAdmin();
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 500 } });
  await llamar('/api/ventas', { method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 300 } });
  await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', concepto: 'Gasolina', monto: 200 } });
  await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'entrada', concepto: 'Cambio del banco', monto: 500 } });
  const cerrar = await llamar('/api/caja/cerrar', { method: 'POST', cuerpo: {} });
  const cajaId = cerrar.json.datos.corte.caja.id;

  limpiarPapel();
  await llamar(`/api/impresion/corte/${cajaId}`, { method: 'POST', cuerpo: {} });
  const papel = loImpreso();

  // El primero lleva el TOTAL de gastos con su cuenta, pero no el desglose.
  const primero = papel.slice(0, papel.indexOf('Detalle #'));
  assert.match(primero, /Corte #/);
  assert.match(primero, /Gastos y retiros \(1\)/, 'el total, y cuántos son');
  assert.ok(!primero.includes('GASOLINA') && !primero.includes('Gasolina'),
            'el desglose NO va en el papel que se firma');

  // El segundo es el desglose, y va después de un corte de papel.
  assert.match(papel, /Detalle #/, 'el segundo papel');
  assert.match(papel, /GASTOS/);
  assert.match(papel, /Gasolina/);
  assert.match(papel, /ENTRADAS/);
  assert.match(papel, /Cambio del banco/);
});

test('sin gastos ni entradas no se imprime un papel de detalle en blanco', async () => {
  await entrarAdmin();
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 500 } });
  await llamar('/api/ventas', { method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 300 } });
  const cerrar = await llamar('/api/caja/cerrar', { method: 'POST', cuerpo: {} });

  limpiarPapel();
  await llamar(`/api/impresion/corte/${cerrar.json.datos.corte.caja.id}`, {
    method: 'POST', cuerpo: {} });
  const papel = loImpreso();
  assert.ok(!papel.includes('Detalle #'),
            'media hoja en blanco que dice GASTOS es papel tirado todos los días');
});

test('un corte sin contar no dice ni que cuadró ni que falta', async () => {
  await entrarAdmin();
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 500 } });
  await llamar('/api/ventas', { method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 300 } });
  const cerrar = await llamar('/api/caja/cerrar', { method: 'POST', cuerpo: {} });
  const caja = cerrar.json.datos.corte.caja;
  assert.equal(caja.diferencia_centavos, null, 'nadie ha contado: no hay diferencia');

  limpiarPapel();
  await llamar(`/api/impresion/corte/${caja.id}`, { method: 'POST', cuerpo: {} });
  const papel = loImpreso();
  assert.match(papel, /DEBERIA HABER/, 'lo que debía haber sí');
  assert.match(papel, /SIN CONTAR/, 'y que todavía no se ha contado');
  assert.match(papel, /Entregado \$/, 'con su raya para escribirlo a mano');
  assert.ok(!papel.includes('CUADRO'), 'decir que cuadró sin contar sería mentir');
});

test('si el turno se relevó, sale un papel por cada quien', async () => {
  await entrarAdmin();
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 500 } });
  await llamar('/api/ventas', { method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 300 } });

  await llamar('/api/usuarios', { method: 'POST', cuerpo: { nombre: 'Nico', rol: 'cajero', pin: '8181' } });
  const lista = (await llamar('/api/auth/usuarios-disponibles')).json.datos.usuarios;
  const nico = lista.find((u) => u.nombre === 'Nico');
  await llamar('/api/auth/entrar-pin', { method: 'POST', cuerpo: { usuarioId: nico.id, pin: '8181' } });
  await llamar('/api/ventas', { method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 8 }], pago: 200 } });

  await entrarAdmin();
  const cerrar = await llamar('/api/caja/cerrar', { method: 'POST', cuerpo: { contado: 1 } });
  const cajaId = cerrar.json.datos.corte.caja.id;

  limpiarPapel();
  const r = await llamar(`/api/impresion/corte/${cajaId}`, { method: 'POST', cuerpo: {} });
  assert.equal(r.json.datos.papeles, 3, 'el corte y uno por cada quien; el día va aparte');

  const papel = loImpreso();
  assert.match(papel, /Su parte del #/, 'cada uno firma lo suyo');
  assert.match(papel, /Nico/, 'el que llegó al relevo tiene su papel');
  assert.match(papel, /CADA QUIEN/, 'y el corte del turno los lista a los dos');
  assert.match(papel, /el arqueo va en el corte/,
               'porque el dinero del cajón es uno solo y no se parte');
});


// ============================================================
// LOS ACENTOS  (v2.5)
//
// Un error viejo y silencioso: el texto se mandaba en latin1 y a la
// impresora se le decía "usa la tabla 2", que es la CP850. No son la
// misma. "Cuarto frío" salía impreso "Cuarto frÝo".
// ============================================================

test('los acentos salen en la tabla que de verdad usa la impresora', () => {
  const bytes = new Ticket(80).linea('Cuarto frío').bytes();
  // í en CP850 es 0xA1. En latin1 es 0xED, que en CP850 es una Ý.
  assert.ok(bytes.includes(0xa1), 'la í va como í');
  assert.ok(!bytes.includes(0xed), 'y no como el byte de latin1');
});

test('la ñ y los signos de apertura también', () => {
  const bytes = [...new Ticket(80).linea('Año ¿Ñandú?').bytes()];
  assert.ok(bytes.includes(0xa4), 'ñ');
  assert.ok(bytes.includes(0xa5), 'Ñ');
  assert.ok(bytes.includes(0xa8), '¿');
  assert.ok(bytes.includes(0xa3), 'ú');
});

test('lo que no está en la tabla se queda sin acento, no en cuadrito', () => {
  // La ā con raya encima no existe en CP850: se prefiere "Baltico" a un
  // cuadro negro. (La ó sí existe, así que esa sí sale con su acento.)
  const papel = new Ticket(80).linea('Bāltico').bytes().toString('latin1');
  assert.match(papel, /Baltico/);
});

test('la impresora sigue arrancando con la tabla 2 (CP850)', () => {
  const bytes = new Ticket(80).bytes();
  assert.equal(bytes[2], 0x1b);
  assert.equal(bytes[3], 0x74);
  assert.equal(bytes[4], 2, 'si esto cambia, la tabla de acentos deja de valer');
});


// ============================================================
// EL AVANCE ANTES DE CORTAR  (v2.6)
//
// La cuchilla está uno o dos centímetros por encima del cabezal. La orden
// de cortar de ESC/POS ya dice "avanza hasta donde cortas y corta", así
// que en una impresora que la cumple, los renglones en blanco del final
// son papel tirado: cuatro son 12 mm EN CADA TICKET. Pero hay impresoras
// que cortan donde están. Por eso se configura y no se adivina.
// ============================================================

/**
 * Los saltos de línea seguidos que van justo antes de la orden de cortar.
 *
 * OJO: el último renglón de texto trae su propio salto, así que en un
 * ticket de verdad esto devuelve 1 + el avance. Para medir solo el avance
 * se corta un ticket sin nada escrito.
 */
function avanceAntesDelCorte(bytes) {
  const b = Buffer.from(bytes);
  const corte = b.indexOf(Buffer.from([0x1d, 0x56, 0x42, 0x00]));
  assert.ok(corte > 0, 'el ticket tiene que cortar el papel');
  let n = 0;
  for (let i = corte - 1; i >= 0 && b[i] === 0x0a; i--) n++;
  return n;
}

test('de fábrica el ticket avanza cuatro renglones antes de cortar', () => {
  assert.equal(avanceAntesDelCorte(new Ticket(80).cortar().bytes()), 4,
               'lo de siempre: nadie se queda sin papel al actualizar');
});

test('el avance se puede bajar a cero para no tirar papel', () => {
  assert.equal(avanceAntesDelCorte(new Ticket(80).cortar(0).bytes()), 0);
  assert.equal(avanceAntesDelCorte(new Ticket(80).cortar(2).bytes()), 2);
});

test('un avance absurdo se recorta en vez de gastar un rollo', () => {
  assert.equal(avanceAntesDelCorte(new Ticket(80).cortar(99).bytes()), 8);
  assert.equal(avanceAntesDelCorte(new Ticket(80).cortar(-5).bytes()), 0);
  assert.equal(avanceAntesDelCorte(new Ticket(80).cortar('mucho').bytes()), 0);
});

test('el avance se guarda y los tickets lo obedecen', async () => {
  await entrarAdmin();
  const r = await llamar('/api/impresion/config', { method: 'PUT', cuerpo: { avanceCorte: 1 } });
  assert.equal(r.estado, 200);
  assert.equal((await llamar('/api/impresion/config')).json.datos.impresion.avanceCorte, 1);

  const v = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 300 } });
  limpiarPapel();
  await llamar(`/api/impresion/venta/${v.json.datos.venta.id}`, { method: 'POST', cuerpo: {} });

  const conUno = avanceAntesDelCorte(Buffer.from(loImpreso(), 'latin1'));

  await llamar('/api/impresion/config', { method: 'PUT', cuerpo: { avanceCorte: 4 } });
  const v2 = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 300 } });
  limpiarPapel();
  await llamar(`/api/impresion/venta/${v2.json.datos.venta.id}`, { method: 'POST', cuerpo: {} });
  const conCuatro = avanceAntesDelCorte(Buffer.from(loImpreso(), 'latin1'));

  // Lo que importa no es el número absoluto —el último renglón de texto
  // trae su propio salto— sino que bajar el ajuste de verdad gasta menos
  // papel, renglón por renglón.
  assert.equal(conCuatro - conUno, 3, 'tres renglones menos son nueve milímetros menos');

  await llamar('/api/impresion/config', { method: 'PUT', cuerpo: { avanceCorte: 4 } });
});

test('un avance fuera de rango se rechaza, no se recorta en silencio', async () => {
  await entrarAdmin();
  for (const avanceCorte of [-1, 9, 2.5, 'dos']) {
    const r = await llamar('/api/impresion/config', { method: 'PUT', cuerpo: { avanceCorte } });
    assert.equal(r.estado, 400, String(avanceCorte));
  }
  assert.equal((await llamar('/api/impresion/config')).json.datos.impresion.avanceCorte, 4,
               'y lo que estaba puesto no se movió');
});


// ============================================================
// EL TICKET EN PANTALLA  (v2.7.1)
//
// El ojito del historial enseña el ticket con forma de ticket. Los
// renglones NO se arman aparte: son el espejo del mismo constructor que
// imprime, así que lo que se ve en pantalla es lo que sale en papel.
// ============================================================

test('el espejo trae los mismos renglones que el papel, con su estilo', () => {
  const t = new Ticket(80);
  t.centro().negrita().tamano(2, 1).linea('HIELO LOLHA').normal();
  t.izquierda().linea('renglón normal');
  t.derecha().linea('$100');
  const b = t.bytes();

  assert.equal(b.anchoTicket, 48);
  assert.deepEqual(b.espejo[0],
    { t: 'HIELO LOLHA', alin: 'centro', negrita: true, anchoLetra: 2, altoLetra: 1,
      subrayado: false, fuente: 'a' });
  assert.deepEqual(b.espejo[1],
    { t: 'renglón normal', alin: 'izquierda', negrita: false, anchoLetra: 1, altoLetra: 1,
      subrayado: false, fuente: 'a' });
  assert.equal(b.espejo[2].alin, 'derecha');
});

test('la previa de una venta devuelve el ticket como renglones', async () => {
  await entrarAdmin();
  const v = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 500 } });
  const venta = v.json.datos.venta;

  const r = await llamar(`/api/impresion/venta/${venta.id}/previa`);
  assert.equal(r.estado, 200);

  const { renglones, ancho } = r.json.datos;
  assert.equal(ancho, 48);
  const todo = renglones.map((x) => x.t).join('\n');
  assert.match(todo, new RegExp(venta.numero.replace('-', '\\-')), 'trae el folio');
  assert.match(todo, /TOTAL/, 'trae el total');
  assert.ok(renglones.some((x) => x.altoLetra > 1 || x.anchoLetra > 1),
            'y la cantidad va en grande, igual que en el papel');
  assert.ok(!renglones.length || renglones[renglones.length - 1].t.trim() !== '',
            'los saltos del corte no llegan a la pantalla');
});

test('la previa de un gasto también, y la de algo inexistente es 404', async () => {
  await entrarAdmin();
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 200 } });
  const g = await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', concepto: 'Gasolina', monto: 80 } });
  const id = g.json.datos.movimientoId;

  const r = await llamar(`/api/impresion/movimiento/${id}/previa`);
  assert.equal(r.estado, 200);
  assert.match(r.json.datos.renglones.map((x) => x.t).join('\n'), /GASOLINA/);

  assert.equal((await llamar('/api/impresion/venta/nope/previa')).estado, 404);
  assert.equal((await llamar('/api/impresion/movimiento/nope/previa')).estado, 404);
});

test('la previa no gasta papel: no imprime nada', async () => {
  await entrarAdmin();
  const v = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 4 }], pago: 100 } });
  limpiarPapel();
  await llamar(`/api/impresion/venta/${v.json.datos.venta.id}/previa`);
  assert.ok(!fs.existsSync(salida) || fs.readFileSync(salida).length === 0,
            'la impresora no recibió un solo byte');
});


// ============================================================
// LA COTIZACIÓN  (v2.8)
// ============================================================

test('la cotización imprime el precio sin vender nada', async () => {
  await entrarAdmin();
  const ventasAntes = (await llamar('/api/ventas?limite=1')).json.datos?.ventas?.length ?? null;

  limpiarPapel();
  const r = await llamar('/api/impresion/cotizacion', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 32 }] } });
  assert.equal(r.estado, 200);
  assert.ok(r.json.datos.total > 0, 'trae el total calculado por el servidor');

  const papel = fs.readFileSync(salida, 'latin1');
  assert.match(papel, /COTIZACION/);
  assert.match(papel, /PRECIOS SUJETOS A CAMBIO/);
  assert.match(papel, /SIN PREVIO AVISO/);
  assert.ok(!/PAGO/.test(papel), 'no hay pago: no es venta');
  // Sin pulso de cajón: no entró dinero. ESC p es 1B 70.
  assert.ok(!papel.includes('\x1b\x70'), 'el cajón no se abre');

  // Y no nació ninguna venta.
  const despues = (await llamar('/api/ventas?limite=1')).json.datos?.ventas?.length ?? null;
  assert.equal(despues, ventasAntes);
});

test('la cotización también viaja como renglones para la pantalla', async () => {
  await entrarAdmin();
  const r = await llamar('/api/impresion/cotizacion', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 8 }] } });
  const { renglones, ancho } = r.json.datos;
  assert.equal(ancho, 48);
  assert.match(renglones.map((x) => x.t).join('\n'), /COTIZACION/);
});

test('una cotización vacía o con producto inexistente se rechaza', async () => {
  await entrarAdmin();
  assert.equal((await llamar('/api/impresion/cotizacion', {
    method: 'POST', cuerpo: { lineas: [] } })).estado, 400);
  assert.equal((await llamar('/api/impresion/cotizacion', {
    method: 'POST', cuerpo: { lineas: [{ productoId: 'nope', cantidad: 1 }] } })).estado, 409);
});


// ============================================================
// OTRA COPIA DEL COMPROBANTE DE UN GASTO  (v4.0)
//
// "A los gastos se les puede sacar copias." El papel se pierde, se moja, o
// hace falta uno para quien se llevó el dinero y otro para la carpeta.
// ============================================================

test('al gasto se le puede sacar otra copia, marcada', async () => {
  await llamar('/api/auth/yo');
  await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', concepto: 'Refaccion', monto: 350 }
  });
  const mov = (await llamar('/api/caja')).json.datos.movimientos[0];

  limpiarPapel();
  const r = await llamar(`/api/impresion/movimiento/${mov.id}`, {
    method: 'POST', cuerpo: { copia: true } });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.copia, true);

  const papel = loImpreso();
  assert.match(papel, /\*\* COPIA \*\*/, 'una reimpresión se marca');
  assert.match(papel, /REFACCION/, 'y sigue siendo el mismo papel');
  // La marca va antes que nada, igual que en el ticket de venta: debajo
  // del concepto no la ve nadie.
  assert.ok(papel.indexOf('COPIA') < papel.indexOf('Gasto'),
            'la marca va hasta arriba, antes del título');
});

test('una copia NO vuelve a abrir el cajón', async () => {
  await llamar('/api/auth/yo');
  await llamar('/api/impresion/config', { method: 'PUT', cuerpo: { abrirCajon: true } });
  await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', concepto: 'Gasolina', monto: 100 }
  });
  const mov = (await llamar('/api/caja')).json.datos.movimientos[0];

  const original = await llamar(`/api/impresion/movimiento/${mov.id}`, {
    method: 'POST', cuerpo: {} });
  assert.equal(original.json.datos.cajon, true, 'el original sí: de ahí salen los billetes');

  const copia = await llamar(`/api/impresion/movimiento/${mov.id}`, {
    method: 'POST', cuerpo: { copia: true } });
  assert.equal(copia.json.datos.cajon, false,
    'el dinero ya se movió; abrirlo otra vez es abrirlo por nada');
});

test('el historial dice qué renglones tienen papel que reimprimir', async () => {
  await llamar('/api/auth/yo');
  const { movimientos } = (await llamar('/api/historial')).json.datos;

  const gasto = movimientos.find((m) => m.tipo === 'gasto');
  assert.ok(gasto, 'hay gastos capturados');
  assert.equal(gasto.movimiento_id, gasto.id, 'un gasto es su propio renglón del cajón');

  const venta = movimientos.find((m) => m.tipo === 'venta');
  assert.equal(venta.movimiento_id, null, 'una venta no deja renglón en el cajón');
});


// ============================================================
// EL PAPEL DEL HIELO  (v4.2)
//
// "Cuando pongo el hielo que hay en el cuarto frío y termino, simplemente
// me modifica la existencia y no me dice si faltó o no faltó hielo."
// El corte enseñaba el dinero con todo detalle y del hielo no decía nada,
// cuando el hielo es el producto.
// ============================================================

test('el corte imprime el cuadre del hielo, con lo que faltó', async () => {
  await entrarAdmin();
  const alm = (await llamar('/api/existencia')).json.datos.almacenes[0].almacen.id;

  // Un conteo anterior, para tener desde dónde comparar.
  await llamar('/api/existencia/conteos', {
    method: 'POST', cuerpo: { almacenId: alm, dieciseisavos: 20 * 16 } });

  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 0 } });
  await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 300 } });
  await llamar('/api/existencia/mermas', {
    method: 'POST', cuerpo: { almacenId: alm, dieciseisavos: 8, motivo: 'derretida' } });

  const caja = (await llamar('/api/caja')).json.datos.abierta.caja;
  // Se cuenta 2 marquetas menos de las que deberían quedar.
  await llamar('/api/existencia/conteos', {
    method: 'POST',
    cuerpo: { almacenId: alm, dieciseisavos: 20 * 16 - 16 - 8 - 2 * 16, cajaId: caja.id } });
  const cerrar = await llamar('/api/caja/cerrar', { method: 'POST', cuerpo: {} });
  const cajaId = cerrar.json.datos.corte.caja.id;

  // El cuadre viaja con el corte, para la pantalla.
  const h = cerrar.json.datos.corte.hielo;
  assert.ok(h, 'el corte trae su cuadre de hielo');
  assert.equal(h.cuadre.vendido, 16, 'una marqueta vendida');
  assert.equal(h.cuadre.merma, 8, 'y media derretida');
  assert.equal(h.cuadre.faltante, 2 * 16, 'faltan dos marquetas que nadie explicó');

  limpiarPapel();
  await llamar(`/api/impresion/corte/${cajaId}`, { method: 'POST', cuerpo: {} });
  const papel = loImpreso();

  assert.match(papel, /Hielo #/, 'su propio papel');
  assert.match(papel, /TENIA QUE HABER/);
  assert.match(papel, /DEBERIA QUEDAR/);
  assert.match(papel, /CONTADO/);
  assert.match(papel, /FALTA 2/, 'y el número que se viene a ver');
  assert.match(papel, /SE VENDIO/);

  // LOS PAÑOS NO VAN AQUÍ  (v4.7). "Solo deja paños sacados para lo del
  // día, y déjame toda la info de cuarto frío, se vendió, con eso." Son
  // producción del DÍA, no del turno de caja, y ya salen en el papel del
  // día con quién los sacó: repetirlos aquí era el mismo dato dos veces en
  // dos papeles que se imprimían juntos.
  assert.doesNotMatch(papel, /PANOS SACADOS\n/);

  // EL PAPEL SE ACORTÓ A PROPÓSITO  (v4.4). "Quiero que me muestre más
  // simple: qué paños salieron y quién los sacó, y cuántas marquetas a
  // precio normal y cuántas a mayoreo. Es todo." Los pedazos uno por uno,
  // las mermas por motivo y lo cortado para bolsas SIGUEN restados arriba,
  // en el cuadre; lo que se quitó es el desglose que nadie leía.
  assert.doesNotMatch(papel, /DERRETIDO O ROTO/);
  assert.doesNotMatch(papel, /CORTADO PARA BOLSAS/);
  assert.doesNotMatch(papel, /x 1\/8/, 'los pedazos uno por uno ya no van');
  assert.match(papel, /Publico/, 'pero sí cuánto se fue a cada precio');
});

test('un turno que no contó hielo no imprime un cuadre en cero', async () => {
  await entrarAdmin();
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 0 } });
  await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 300 } });
  const cerrar = await llamar('/api/caja/cerrar', { method: 'POST', cuerpo: {} });

  assert.equal(cerrar.json.datos.corte.hielo, null,
    'sin conteo no hay cuadre: inventarlo haría creer que se contó y salió cero');

  limpiarPapel();
  await llamar(`/api/impresion/corte/${cerrar.json.datos.corte.caja.id}`, {
    method: 'POST', cuerpo: {} });
  assert.ok(!loImpreso().includes('Hielo #'), 'y no sale el papel');
});

test('los pedazos se agrupan por su tamaño, no por su nombre', async () => {
  await entrarAdmin();
  const alm = (await llamar('/api/existencia')).json.datos.almacenes[0].almacen.id;
  await llamar('/api/existencia/conteos', {
    method: 'POST', cuerpo: { almacenId: alm, dieciseisavos: 40 * 16 } });

  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 0 } });
  // Tres octavos por el botón (concepto "1/8") y uno tecleado a mano
  // (concepto "Hielo"): son el mismo pedazo y tienen que sumar juntos.
  await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ codigo: '18', cantidad: 3 }], pago: 300 } });
  await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 2 }], pago: 300 } });

  const caja = (await llamar('/api/caja')).json.datos.abierta.caja;
  const r = await llamar('/api/existencia/conteos', {
    method: 'POST', cuerpo: { almacenId: alm, dieciseisavos: 39 * 16, cajaId: caja.id } });
  assert.equal(r.estado, 201);
  const corte = (await llamar('/api/caja/cerrar', { method: 'POST', cuerpo: {} }))
    .json.datos.corte;

  const octavos = corte.hielo.pedazos.find((p) => p.pedazo === 2);
  assert.ok(octavos, 'hay un renglón de octavos');
  assert.equal(octavos.piezas, 4, 'los tres del botón y el tecleado a mano, juntos');
  assert.equal(octavos.texto, '1/8');
});
