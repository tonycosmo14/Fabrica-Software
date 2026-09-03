/**
 * CÓMO SE CONSTRUYE UN TICKET  (v2.3)
 *
 * Tony trajo una foto de cómo tiene que verse cualquier papel del negocio:
 * arriba a la izquierda QUÉ es, arriba a la derecha QUIÉN y CUÁNDO, en
 * medio el contenido entre dos rayas, abajo el negocio.
 *
 * Estas pruebas son esa foto escrita. Aquí no hay impresora: se arma la
 * tira de bytes, se le quitan las órdenes ESC/POS y queda el papel como
 * texto, renglón por renglón. Así se puede afirmar "el número va ANTES que
 * la fecha", que es justo lo que una prueba de "contiene tal palabra" no
 * distingue.
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, preparar, bd } = fabricaDePrueba('ticket');

/**
 * El papel como lo leería una persona: sin órdenes, un renglón por línea.
 *
 * Las órdenes de ESC/POS son bytes sueltos metidos entre el texto (ESC a 1
 * para centrar, GS ! para el tamaño...). Si no se quitan, aparecen dentro
 * de los renglones y cualquier comparación falla por un carácter invisible.
 */
function renglones(bytes) {
  const b = Buffer.from(bytes);
  const salida = [];
  let linea = '';
  for (let i = 0; i < b.length; i++) {
    const c = b[i];
    if (c === 0x1b) {                       // ESC
      const que = b[i + 1];
      if (que === 0x40) { i += 1; continue; }                    // ESC @
      if (que === 0x70) { i += 4; continue; }                    // ESC p (cajón)
      i += 2; continue;                                          // ESC x n
    }
    if (c === 0x1d) {                       // GS
      i += b[i + 1] === 0x56 ? 3 : 2;
      continue;
    }
    if (c === 0x0a) { salida.push(linea.trim()); linea = ''; continue; }
    linea += Buffer.from([c]).toString('latin1');
  }
  if (linea.trim()) salida.push(linea.trim());
  return salida.filter((l) => l !== '');
}

/** En qué renglón aparece algo. -1 si no está. */
function donde(lista, texto) {
  return lista.findIndex((l) => l.includes(texto));
}

let ticket;
let venta;

preparar(async () => {
  ticket = require('../src/modulos/impresion/ticket');

  // Un ticket de verdad: hielo de dos piezas más un refresco, pagado con
  // billete grande. Es el caso de la foto.
  const cat = (await llamar('/api/catalogo/categorias', {
    method: 'POST', cuerpo: { nombre: 'Refrescos' }
  })).json.datos.categoria;

  const coca = (await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: 'Coca 600', categoriaId: cat.id, tipo: 'simple',
              precio: 25, codigo: 'coca' }
  })).json.datos.producto;

  const r = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: {
      lineas: [{ dieciseisavos: 6 }, { productoId: coca.id, cantidad: 2 }],
      pago: 500
    }
  });
  venta = (await llamar(`/api/ventas/${r.json.datos.venta.id}`)).json.datos.venta;
});


// ============================================================
// LA ESQUINA DE ARRIBA
// ============================================================

test('el número a la izquierda y quién lo hizo a la derecha, en un renglón', () => {
  const l = renglones(ticket.ticketVenta(venta, { negocio: 'Hielo LOLHA' }));

  // EL DISEÑO DE LA v5.0: los dos datos que se miran primero comparten el
  // renglón de arriba, uno pegado a cada orilla.
  assert.match(l[0], /^#\d{4}-\d+ +\S.*$/, 'el número, y a la derecha el nombre');
  assert.ok(l[0].includes(venta.cajero_nombre), 'el nombre, sin el «Atendio:» de antes');
  assert.equal(l[0].length, 48, 'de orilla a orilla del papel');

  // Y la fecha debajo, pegada a la derecha.
  assert.match(l[1], /\d+\/[A-Z][a-z]{2}\/\d{4} \d{1,2}:\d{2}(am|pm)$/,
               'la fecha, en el segundo renglón');
});

test('con un nombre largo, quién y cuándo se separan antes que recortarse', () => {
  const largo = { ...venta, cajero_nombre: 'Maria Guadalupe de los Angeles Chan Cauich' };
  const l = renglones(ticket.ticketVenta(largo, { negocio: 'Hielo LOLHA' }));

  // El nombre entero, aunque cueste dos renglones: antes de recortar el
  // nombre de alguien, se gasta el papel.
  assert.ok(l.join(' ').includes('Maria Guadalupe de los Angeles Chan Cauich'));
  assert.match(l.find((r) => /\d+\/[A-Z][a-z]{2}\/\d{4}/.test(r)),
               /\d+\/[A-Z][a-z]{2}\/\d{4} \d{1,2}:\d{2}(am|pm)$/, 'y la fecha aparte');
  // Partido por palabras aquí, no por la impresora a media palabra.
  for (const r of l) assert.ok(r.length <= 48, `se salió del papel: "${r}"`);
});

test('la fecha lleva el mes en letras para que no se confunda con el día', () => {
  assert.equal(ticket.fechaTicket('2026-08-26T17:45:00'), '26/Ago/2026 5:45pm');
  assert.equal(ticket.fechaTicket('2026-01-02T00:05:00'), '2/Ene/2026 12:05am');
  assert.equal(ticket.fechaTicket('2026-12-31T12:00:00'), '31/Dic/2026 12:00pm');
});


// ============================================================
// EL CUERPO
// ============================================================

test('el hielo va en grande y CON SU PRECIO en el mismo renglón', () => {
  const l = renglones(ticket.ticketVenta(venta, { negocio: 'Hielo LOLHA' }));

  // v5.0: el hielo y lo que costó son el renglón que el cliente comprueba.
  // Antes eran dos —el hielo grande y debajo el importe— y son uno.
  const grande = donde(l, '3/8');
  assert.ok(grande > 0, 'lo que se llevó, en su renglón');
  assert.match(l[grande], /\.{5,}/, 'los puntos llevan el ojo hasta el precio');
  assert.match(l[grande], /\$\d/, 'y ahí está el precio, en el mismo renglón');
});

test('los artículos llevan cuántos eran', () => {
  const l = renglones(ticket.ticketVenta(venta, { negocio: 'Hielo LOLHA' }));
  const coca = l.find((r) => r.includes('Coca 600'));
  assert.ok(coca, 'el refresco sale en el ticket');
  assert.match(coca, /^2 +Coca 600 \.+ \$50/, 'dos, con su precio al final');
});

test('total, pago y cambio en UN renglón, repartidos a lo ancho', () => {
  const l = renglones(ticket.ticketVenta(venta, { negocio: 'Hielo LOLHA' }));
  const t = donde(l, 'TOTAL:');

  assert.ok(t > 0);
  // v5.0: los tres números de la venta en el mismo renglón, uno a cada
  // tercio, como en el diseño. Eran dos renglones.
  assert.match(l[t], /^TOTAL: \$\d+ +PAGO: \$500 +CAMBIO: \$/);
  // De orilla a orilla del papel: el renglón se arma contando columnas, y
  // si la cuenta se desfasa la impresora lo parte en dos.
  assert.equal(l[t].length, 48, 'llega justo a la orilla');
});

test('el nombre del negocio cierra el ticket, abajo a la izquierda', () => {
  const l = renglones(ticket.ticketVenta(venta, { negocio: 'Hielo LOLHA' }));
  assert.equal(l.at(-1), 'HIELO LOLHA');
});

test('sin pago tecleado no se inventa un cambio', () => {
  const l = renglones(ticket.ticketVenta({ ...venta, pago_centavos: null, cambio_centavos: null },
                                         { negocio: 'Hielo LOLHA' }));
  assert.ok(donde(l, 'TOTAL:') > 0);
  assert.equal(donde(l, 'PAGO:'), -1);
  assert.equal(donde(l, 'CAMBIO:'), -1);
});

test('pagando justo no se imprime PAGO ni CAMBIO: no dirían nada', () => {
  // Era la mitad de los tickets del mostrador, y en esos dos renglones
  // decía "PAGO $660 · CAMBIO $0": el total otra vez, y un cero.
  const l = renglones(ticket.ticketVenta(
    { ...venta, pago_centavos: venta.total_centavos, cambio_centavos: 0 },
    { negocio: 'Hielo LOLHA' }));

  assert.ok(donde(l, 'TOTAL:') > 0, 'el total sí, siempre');
  assert.equal(donde(l, 'PAGO:'), -1);
  assert.equal(donde(l, 'CAMBIO:'), -1);
});

// ============================================================
// LAS MARCAS: COPIA Y CAMBIO
// ============================================================

test('la copia se marca con asteriscos de lado a lado y hasta arriba', () => {
  const l = renglones(ticket.ticketVenta(venta, { copia: true, negocio: 'Hielo LOLHA' }));

  assert.match(l[0], /^\*+$/, 'una raya de asteriscos abre el papel');
  assert.match(l[1], /COPIA/);
  assert.match(l[2], /^\*+$/, 'y otra la cierra');
  assert.ok(donde(l, 'COPIA') < donde(l, '#'), 'antes del número, no después');
});

test('el original no lleva ninguna marca de copia', () => {
  const l = renglones(ticket.ticketVenta(venta, { negocio: 'Hielo LOLHA' }));
  assert.equal(donde(l, 'COPIA'), -1);
});

test('un cambio dice de qué ticket viene', () => {
  const l = renglones(ticket.ticketVenta({ ...venta, cambioDeNumero: '2026-142' },
                                         { negocio: 'Hielo LOLHA' }));
  assert.equal(l.at(-1), 'CAMBIO DEL #2026-142',
               'lo último que se lee: este hielo ya se había pagado en otro papel');
});

test('el papel de un cambio dice cuánto se le devuelve al cliente', () => {
  // El cliente trajo un vale de $314 y se llevó $132 de hielo: le tocan
  // $182. Por dentro la venta nueva se guarda como pagada completa para
  // que el cajón cuadre, y eso hacía que el papel dijera "PAGO $132 ·
  // CAMBIO $0", que para el cliente no quiere decir nada.
  const l = renglones(ticket.ticketVenta(
    { ...venta, total_centavos: 13200, pago_centavos: 13200, cambio_centavos: 0,
      cambioDeNumero: '2026-30', cambioDeTotal: 31400 },
    { negocio: 'Hielo LOLHA' }));

  assert.match(l[donde(l, 'TOTAL:')], /\$132/);
  assert.match(l[donde(l, 'VALE #2026-30:')], /\$314/, 'con cuánto valía el que trajo');
  assert.match(l[donde(l, 'SE LE DEVUELVE:')], /\$182/, 'y lo que se lleva en billetes');

  assert.equal(donde(l, 'PAGO:'), -1, 'no pagó con billetes: pagó con un ticket');
  assert.equal(donde(l, 'CAMBIO:'), -1);
});

test('si el cambio es por algo más caro, el papel dice cuánto puso de más', () => {
  const l = renglones(ticket.ticketVenta(
    { ...venta, total_centavos: 40000, pago_centavos: 40000, cambio_centavos: 0,
      cambioDeNumero: '2026-30', cambioDeTotal: 31400 },
    { negocio: 'Hielo LOLHA' }));

  assert.match(l[donde(l, 'VALE #2026-30:')], /\$314/);
  assert.match(l[donde(l, 'PAGO ADEMAS:')], /\$86/);
});

test('el cambio de un ticket se imprime con el renglón puesto', async () => {
  // El aviso no puede depender de que alguien se acuerde de pasarlo: sale
  // de la propia venta, mirando de cuál viene.
  const vieja = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 300 }
  });
  const nueva = await llamar(`/api/ventas/${vieja.json.datos.venta.id}/cambiar`, {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 8 }] }
  });
  assert.equal(nueva.estado, 201, JSON.stringify(nueva.json));

  const id = nueva.json.datos.venta.id;
  const fila = bd.prepare('SELECT cambio_de_venta_id FROM ventas WHERE id = ?').get(id);
  assert.ok(fila.cambio_de_venta_id, 'la venta nueva sabe de cuál viene');

  const r = await llamar(`/api/impresion/venta/${id}`, { method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 200, 'sin impresora puesta contesta que no imprimió, no falla');
});


// ============================================================
// EL COMPROBANTE DE GASTO
// ============================================================

test('el gasto se arma igual que el ticket: qué, quién y cuándo', () => {
  const l = renglones(ticket.ticketMovimiento({
    tipo: 'salida', fecha: '2026-08-26T17:45:00', centavos: 625000,
    concepto: 'Gasolina para limpiar piezas',
    cajero_nombre: 'Tony Castilla', ejecutor_nombre: 'Luis'
  }, { negocio: 'Hielo LOLHA' }));

  // v5.0: el título en grande y al centro, y debajo quién y cuándo, uno a
  // cada orilla — como en el diseño que mandó Tony.
  assert.equal(l[0], 'Gasto');
  assert.match(l[1], /^Tony Castilla\s+26\/Ago\/2026 5:45pm$/,
               'quién tiene el turno de caja y a qué hora, en un renglón');
  assert.equal(l[1].length, 48, 'de orilla a orilla');
  assert.match(l[donde(l, '$')], /^\$6,250$/, 'el importe, solo, en grande');
  assert.match(l.join('\n'), /GASOLINA PARA LIMPIAR PIEZAS/, 'el concepto en mayúsculas');
  assert.ok(donde(l, 'FIRMA') > 0, 'alguien se llevó dinero: se firma');
});

test('meter dinero al cajón no lleva firma: nadie firma por dejar', () => {
  const l = renglones(ticket.ticketMovimiento({
    tipo: 'entrada', fecha: '2026-08-26T17:45:00', centavos: 50000,
    concepto: 'Cambio para el cajón', cajero_nombre: 'Tony Castilla'
  }, { negocio: 'Hielo LOLHA' }));

  assert.equal(l[0], 'Entrada');
  assert.equal(donde(l, 'FIRMA'), -1);
});

test('el gasto no dice ya "lo tomó" ni "lo anotó"', () => {
  const papel = renglones(ticket.ticketMovimiento({
    tipo: 'salida', fecha: '2026-08-26T17:45:00', centavos: 200,
    concepto: 'Gasolina', cajero_nombre: 'Tony Castilla',
    ejecutor_nombre: 'Luis', capturista_nombre: 'Rosa'
  }, { negocio: 'Hielo LOLHA' })).join('\n');

  assert.doesNotMatch(papel, /Lo tomo|Lo anoto/);
  assert.doesNotMatch(papel, /Luis|Rosa/, 'ni sus nombres por otro lado');
});

test('un concepto largo se corta por palabras, no a media palabra', () => {
  const concepto = 'Gasolina para limpiar piezas de la maquina nueva en reparacion';
  const l = renglones(ticket.ticketMovimiento({
    tipo: 'salida', fecha: '2026-08-26T17:45:00', centavos: 625000,
    concepto, cajero_nombre: 'Tony'
  }, { negocio: 'Hielo LOLHA' }));

  // Ningún renglón se sale del papel de 80 mm.
  for (const r of l) assert.ok(r.length <= 48, `renglón de ${r.length}: "${r}"`);

  // Y juntando los renglones vuelve a salir el concepto entero: no se
  // perdió ni se partió ninguna palabra por la mitad.
  const juntos = l.join(' ').replace(/ +/g, ' ');
  assert.ok(juntos.includes(concepto.toUpperCase()),
            'el concepto se lee completo repartido en varios renglones');
});

// ============================================================
// LOS SIGNOS QUE LA IMPRESORA DIBUJA MAL
// ============================================================

test('el "por" del desglose sale como una x, no como una cruz de rayitas', () => {
  const { Ticket } = require('../src/modulos/impresion/escpos');
  const papel = new Ticket(80).linea('2 × 1/4 — "hola"').bytes().toString('latin1');
  assert.match(papel, /2 x 1\/4 - "hola"/);
});


// ============================================================
// EL PAPEL QUE SE GASTA  (v2.6)
//
// "El ticket lo más pequeño que se pueda." Se imprimen cientos al día:
// cada renglón de más son metros de papel al mes. Estas pruebas no miran
// cómo queda —eso se mira en papel— sino que no vuelva a crecer sin que
// nadie se dé cuenta.
// ============================================================

/**
 * Los RENGLONES DE PAPEL que ocupa un ticket.
 *
 * Un renglón a doble alto ocupa dos y a triple ocupa tres: el alto es lo
 * único que se traduce en centímetros. El ancho es gratis, y por eso los
 * números grandes van a doble ANCHO y alto sencillo.
 */
function renglonesDePapel(bytes) {
  const b = Buffer.from(bytes);
  let alto = 1, total = 0;
  for (let i = 0; i < b.length;) {
    if (b[i] === 0x1b) { i += b[i + 1] === 0x40 ? 2 : b[i + 1] === 0x70 ? 5 : 3; continue; }
    if (b[i] === 0x1d) {
      if (b[i + 1] === 0x21) { alto = (b[i + 2] & 0x07) + 1; i += 3; continue; }
      i += b[i + 1] === 0x56 ? 4 : 3; continue;
    }
    if (b[i] === 0x0a) { total += alto; }
    i++;
  }
  return total;
}

/** Ningún renglón puede salirse del papel: son 48 columnas y punto. */
function seSaleDelPapel(bytes) {
  const b = Buffer.from(bytes);
  let col = 0, ancho = 1, peor = 0;
  for (let i = 0; i < b.length;) {
    if (b[i] === 0x1b) { i += b[i + 1] === 0x40 ? 2 : b[i + 1] === 0x70 ? 5 : 3; continue; }
    if (b[i] === 0x1d) {
      if (b[i + 1] === 0x21) { ancho = (b[i + 2] >> 4) + 1; i += 3; continue; }
      i += b[i + 1] === 0x56 ? 4 : 3; continue;
    }
    if (b[i] === 0x0a) { peor = Math.max(peor, col * ancho); col = 0; i++; continue; }
    col++; i++;
  }
  return Math.max(peor, col * ancho) > 48;
}

const TOPES = {
  'venta completa': 17,
  'venta de 1/16': 14,
  'gasto': 15
};

test('una venta no gasta más renglones de los que gastaba', () => {
  const papel = ticket.ticketVenta(venta, { negocio: 'Hielo LOLHA' });
  const n = renglonesDePapel(papel);
  assert.ok(n <= TOPES['venta completa'],
            `la venta creció a ${n} renglones (el tope son ${TOPES['venta completa']})`);
  assert.ok(!seSaleDelPapel(papel), 'y no se sale de las 48 columnas');
});

test('el ticket más común de todos —un pedazo de hielo— es el más barato', () => {
  const suelta = {
    ...venta, pago_centavos: 1700, total_centavos: 1700, cambio_centavos: 0,
    cliente_nombre: null,
    lineas: [{ concepto: '1/16', dieciseisavos: 1, precio_centavos: 1700, cantidad: 1 }]
  };
  const n = renglonesDePapel(ticket.ticketVenta(suelta, { negocio: 'Hielo LOLHA' }));
  assert.ok(n <= TOPES['venta de 1/16'],
            `el ticket de mostrador creció a ${n} renglones`);
});

test('ningún ticket se sale de las 48 columnas, ni con los datos más largos', () => {
  const largo = {
    ...venta,
    cajero_nombre: 'Maria Guadalupe de los Angeles Chan Cauich',
    cliente_nombre: 'Abarrotes y Cremeria La Guadalupana del Centro',
    total_centavos: 99999999, pago_centavos: 100000000, cambio_centavos: 1,
    lineas: [
      { concepto: 'Un producto con un nombre larguisimo que no cabe',
        dieciseisavos: 0, precio_centavos: 12345678, cantidad: 99 },
      { concepto: 'Marqueta', dieciseisavos: 7999, precio_centavos: 87654321, cantidad: 499 }
    ]
  };
  assert.ok(!seSaleDelPapel(ticket.ticketVenta(largo, { negocio: 'Hielo LOLHA' })));
  assert.ok(!seSaleDelPapel(ticket.ticketVenta(largo, { copia: true, negocio: 'Hielo LOLHA' })));

  assert.ok(!seSaleDelPapel(ticket.ticketMovimiento({
    tipo: 'salida', fecha: '2026-08-26T17:45:00', centavos: 99999999,
    concepto: 'Un concepto larguisimo que se escribio sin pensar en el papel',
    cajero_nombre: 'Maria Guadalupe de los Angeles Chan Cauich'
  }, { negocio: 'Hielo LOLHA' })));
});

test('la raya para firmar llega a la orilla, y con letrero largo se parte', () => {
  const { Ticket } = require('../src/modulos/impresion/escpos');

  // `renglones` ya quita las órdenes de ESC/POS: sin eso, la "a" de
  // "ESC a 0" (alinear) se cuela en el texto y todo mide uno de más.
  const corta = renglones(new Ticket(80).firma('FIRMA').bytes());
  assert.equal(corta.length, 1, 'un solo renglón: el letrero y la raya juntos');
  assert.equal(corta[0].length, 48, 'y la raya llega hasta la orilla del papel');
  assert.match(corta[0], /^FIRMA: _+$/);

  // Con un letrero que no deja sitio para firmar, el letrero se va arriba
  // y la raya abajo: ahí sí valen los dos renglones.
  const larga = renglones(
    new Ticket(80).firma('FIRMA DE QUIEN RECIBIO EL DINERO EN MANO Y LO CONTO').bytes());
  for (const r of larga) assert.ok(r.length <= 48, `se salió: "${r}"`);
  assert.match(larga.at(-1), /^_{40,}$/, 'y queda raya de sobra donde firmar');
  assert.ok(larga.join(' ').includes('FIRMA DE QUIEN RECIBIO EL DINERO EN MANO Y LO CONTO'),
            'sin comerse ni una palabra del letrero');
});


// ============================================================
// EL DISEÑO DE LA v5.0
//
// Tony mandó cuatro papeles dibujados. Lo que se prueba aquí es lo que
// esos dibujos tienen en común y que antes no estaba: todo por renglones
// del mismo ancho, con puntitos que llevan el ojo hasta el número, una
// raya encima del resultado y el resultado subrayado.
// ============================================================

const { Ticket } = require('../src/modulos/impresion/escpos');

test('la cuenta va con puntitos y con los números en la misma columna', () => {
  const t = new Ticket(80);
  t.bloquePunteado([
    ['Cobrado', '+$5,785'],
    ['Gastos y retiros', '-$785'],
    { etiqueta: 'Deberia haber', valor: '$455', raya: true },
    ['Entregado', '-$450']
  ]);
  const l = t.espejo.map((r) => r.t);

  for (const r of l) assert.equal(r.length, 48, `"${r}" no llega a la orilla`);

  // Los importes, todos terminando en la misma columna: es lo que hace que
  // la cuenta se lea como una cuenta y no como cuatro renglones sueltos.
  const conNumero = l.filter((r) => /\$/.test(r));
  assert.equal(new Set(conNumero.map((r) => r.length)).size, 1);
  assert.ok(conNumero.every((r) => r.endsWith(r.trimEnd().slice(-r.trimEnd().length))));

  // Y la raya de la suma, justo encima del resultado.
  const raya = l.findIndex((r) => /^ +_+$/.test(r));
  assert.ok(raya > 0, 'hay una raya');
  assert.match(l[raya + 1], /Deberia haber/, 'y debajo va el resultado');
});

test('el resultado del corte va subrayado, que es lo que hace una térmica en vez de cursiva', () => {
  const t = new Ticket(80);
  t.centro().negrita().subrayado().linea('FALTA $55').normal();
  assert.equal(t.espejo[0].subrayado, 1, 'el espejo lo lleva, para que la pantalla lo pinte');

  const crudo = Buffer.from(t.bytes()).toString('latin1');
  assert.ok(crudo.includes('\x1b-\x01'), 'y la impresora recibe la orden de subrayar');
  assert.ok(crudo.includes('\x1b-\x00'), 'y la de dejar de subrayar');
});

test('la raya que separa bloques lleva hueco entre guión y guión', () => {
  const l = new Ticket(80).separador().espejo.map((r) => r.t);
  assert.match(l[0], /^(- )+-$/, 'guión, hueco, guión — como en un recibo de papel');
  assert.ok(l[0].length <= 48);
});

test('un párrafo justificado llega justo a la orilla, menos el último renglón', () => {
  const t = new Ticket(80);
  t.parrafo('GASOLINA PARA LIMPIAR LAS PIEZAS DE LA MAQUINA NUEVA QUE ESTA EN '
          + 'REPARACION DESDE LA SEMANA PASADA EN EL TALLER DE ENFRENTE',
    { justificado: true });
  const l = t.espejo.map((r) => r.t);

  assert.ok(l.length > 2);
  for (const r of l.slice(0, -1)) assert.equal(r.length, 48, `"${r}" no llegó a la orilla`);
  assert.ok(l.at(-1).length < 48, 'el último no se estira: quedaría ridículo');
});

// ============================================================
// EL TAMAÑO DE LA LETRA
// ============================================================

test('la letra chica cabe más por renglón; la grande no desacomoda nada', () => {
  assert.equal(new Ticket(80, 2, 'chica').ancho, 64, 'fuente B: 64 columnas');
  assert.equal(new Ticket(80, 2, 'normal').ancho, 48);
  assert.equal(new Ticket(80, 2, 'grande').ancho, 48,
    'la grande dobla el ALTO, no el ancho: las columnas no cambian');

  // Y en papel de 58 mm, lo mismo a otra escala.
  assert.equal(new Ticket(58, 2, 'chica').ancho, 42);
  assert.equal(new Ticket(58, 2, 'normal').ancho, 32);
});

test('la letra grande escala TODO, así que las proporciones no cambian', () => {
  const grande = new Ticket(80, 2, 'grande');
  grande.linea('normal').tamano(2, 1).linea('el titulo');

  assert.equal(grande.espejo[0].altoLetra, 2, 'lo normal ya sale al doble');
  assert.equal(grande.espejo[1].altoLetra, 2, 'y un titulo de ancho doble, también');
  assert.equal(grande.espejo[1].anchoLetra, 2, 'sigue siendo el doble de ancho que el texto');
});

test('cada tamaño manda su orden de fuente a la impresora', () => {
  const orden = (tamano) => Buffer.from(new Ticket(80, 2, tamano).bytes()).toString('latin1');
  assert.ok(orden('chica').includes('\x1bM\x01'), 'ESC M 1 elige la fuente B');
  assert.ok(orden('normal').includes('\x1bM\x00'), 'ESC M 0 elige la fuente A');
  assert.ok(orden('grande').includes('\x1bM\x00'), 'la grande es la A, multiplicada');
});

test('un tamaño inventado no rompe nada: se cae en el normal', () => {
  assert.equal(new Ticket(80, 2, 'gigantesca').ancho, 48);
  assert.equal(new Ticket(80, 2, undefined).ancho, 48);
});

// ============================================================
// EL VALE ES EL PAPEL DEL GASTO CON OTRO TÍTULO
// ============================================================

test('el vale dice DE QUIÉN es en el título, como el gasto dice Gasto', () => {
  const l = renglones(ticket.ticketVale({
    fecha: '2026-08-26T17:45:00', centavos: 200000, esRaya: true, folio: 11,
    concepto: 'Vale sueldo', ejecutor_nombre: 'Jesus Pech Canul',
    capturista_nombre: 'Tony Castilla'
  }, { negocio: 'Hielo LOLHA' }));

  assert.equal(l[0], 'Vale de Jesus', 'el título lleva su nombre, no la palabra "Vale" a secas');
  assert.match(l[1], /^Tony Castilla\s+26\/Ago\/2026 5:45pm$/, 'quién lo dio y cuándo');
  assert.ok(l.includes('$2,000'), 'el importe, en grande');
  assert.ok(l.includes('Jesus Pech Canul'), 'y el nombre completo debajo');
  assert.ok(donde(l, 'FIRMA') > 0, 'se firma');
});

test('el gasto y el vale son el mismo papel: mismo orden de renglones', () => {
  const forma = (l) => [
    /^[A-Za-z]/.test(l[0]),                       // un título
    /\d{1,2}:\d{2}(am|pm)$/.test(l[1]),           // quién y cuándo
    /^(- )+-$/.test(l[2]),                        // la raya
    l.some((r) => /^\$[\d,]+$/.test(r)),          // el importe solo, en grande
    donde(l, 'FIRMA') > 0                         // y la raya para firmar
  ];

  const gasto = renglones(ticket.ticketMovimiento({
    tipo: 'salida', fecha: '2026-08-26T17:45:00', centavos: 625000,
    concepto: 'Gasolina', cajero_nombre: 'Tony Castilla'
  }, { negocio: 'Hielo LOLHA' }));

  const vale = renglones(ticket.ticketVale({
    fecha: '2026-08-26T17:45:00', centavos: 200000, concepto: 'Vale',
    ejecutor_nombre: 'Jesus Pech', capturista_nombre: 'Tony Castilla'
  }, { negocio: 'Hielo LOLHA' }));

  assert.deepEqual(forma(gasto), [true, true, true, true, true]);
  assert.deepEqual(forma(vale), forma(gasto), 'la misma forma, con otro texto');
});

// ============================================================
// HIELO A SACAR
// ============================================================

test('los números a sacar van en un renglón por tanque, en grande', () => {
  const l = renglones(ticket.ticketProduccion({
    fecha: '2026-08-31T09:15:00', entregadoPor: 'Tony Castilla',
    lista: [
      { tanque: 'N', siguientes: [11, 13, 15, 17] },
      { tanque: 'T', siguientes: [11, 13, 15, 17] },
      { tanque: '2N', siguientes: [11, 13, 15, 17],
        aMedias: [{ pano: 11, faltan: 2, total: 6, empezadoPor: 'Chuy' }] }
    ]
  }, { negocio: 'Hielo LOLHA' }));

  assert.equal(l[0].slice(0, 13), 'Hielo a sacar');
  assert.ok(l[0].includes('Tony Castilla'), 'y quién lo entregó, a la derecha');

  // Un renglón por tanque, con la letra del tanque en una columna fija
  // para que todos los números arranquen a la misma altura.
  assert.equal(l.filter((r) => /^N +11 \. 13 \. 15 \. 17$/.test(r)).length, 1);
  assert.equal(l.filter((r) => /^2N +11 \. 13 \. 15 \. 17$/.test(r)).length, 1);
  const n = l.find((r) => r.startsWith('N '));
  const dosN = l.find((r) => r.startsWith('2N'));
  assert.equal(n.indexOf('11'), dosN.indexOf('11'), 'los números, a la misma altura');

  // Y una raya entre tanque y tanque, pero no después del último.
  assert.equal(l.filter((r) => /^_{40,}$/.test(r)).length, 2, 'dos rayas para tres tanques');

  assert.ok(l.some((r) => /pano 11 incompleto/.test(r)), 'lo que quedó a medias, debajo');
  assert.ok(l.some((r) => /lo empezo Chuy/.test(r)), 'y quién lo empezó');
});
