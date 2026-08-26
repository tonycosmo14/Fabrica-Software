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

test('el número del ticket va arriba del todo, y a la izquierda', () => {
  const l = renglones(ticket.ticketVenta(venta, { negocio: 'Hielo LOLHA' }));

  assert.match(l[0], /^#\d{4}-\d+$/, 'el primer renglón es el número, y nada más');
  assert.match(l[1], /^Atendio: /, 'debajo, quién estaba en la caja');
  assert.match(l[2], /^\d+\/[A-Z][a-z]{2}\/\d{4} \d{1,2}:\d{2}(am|pm)$/,
               'y la fecha con el mes en letras: 26/Ago/2026 5:45pm');
});

test('la fecha lleva el mes en letras para que no se confunda con el día', () => {
  assert.equal(ticket.fechaTicket('2026-08-26T17:45:00'), '26/Ago/2026 5:45pm');
  assert.equal(ticket.fechaTicket('2026-01-02T00:05:00'), '2/Ene/2026 12:05am');
  assert.equal(ticket.fechaTicket('2026-12-31T12:00:00'), '31/Dic/2026 12:00pm');
});


// ============================================================
// EL CUERPO
// ============================================================

test('el hielo va en grande y su desglose lleva el precio con puntitos', () => {
  const l = renglones(ticket.ticketVenta(venta, { negocio: 'Hielo LOLHA' }));

  const grande = donde(l, '3/8');
  assert.ok(grande > 0, 'lo que se llevó, en su renglón');

  const desglose = l[grande + 1];
  assert.match(desglose, /\.{5,}/, 'los puntos llevan el ojo hasta el precio');
  assert.match(desglose, /\$\d/, 'y ahí está el precio');
});

test('los artículos llevan cuántos eran', () => {
  const l = renglones(ticket.ticketVenta(venta, { negocio: 'Hielo LOLHA' }));
  const coca = l.find((r) => r.includes('Coca 600'));
  assert.ok(coca, 'el refresco sale en el ticket');
  assert.match(coca, /^2 Coca 600 \.+ \$50/, 'dos, con su precio al final');
});

test('total, pago y cambio van juntos y alineados a la derecha', () => {
  const l = renglones(ticket.ticketVenta(venta, { negocio: 'Hielo LOLHA' }));
  const t = donde(l, 'TOTAL:');

  assert.ok(t > 0);
  assert.match(l[t + 1], /^PAGO: +\$500/);
  assert.match(l[t + 2], /^CAMBIO: +\$/);

  // Los tres importes terminan en la misma columna. Es lo que permite
  // comprobar el cambio de un vistazo sin leer los números enteros.
  const sinCortar = Buffer.from(ticket.ticketVenta(venta, { negocio: 'Hielo LOLHA' }))
    .toString('latin1').split('\n').map((r) => r.replace(/[\x00-\x1f]/g, ''));
  const tres = sinCortar.filter((r) => /TOTAL:|PAGO:|CAMBIO:/.test(r));
  assert.equal(tres.length, 3);
  assert.equal(new Set(tres.map((r) => r.length)).size, 1,
               'los tres renglones miden lo mismo: los pesos quedan en columna');
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

test('un pago justo sí dice cambio $0: el cliente pagó exacto, no es que falte', () => {
  const l = renglones(ticket.ticketVenta(
    { ...venta, pago_centavos: venta.total_centavos, cambio_centavos: 0 },
    { negocio: 'Hielo LOLHA' }));
  assert.match(l[donde(l, 'CAMBIO:')], /\$0/);
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

  assert.equal(l[0], 'Gasto');
  assert.equal(l[1], 'Atendio: Tony Castilla', 'quien tiene el turno de caja');
  assert.match(l[2], /26\/Ago\/2026/);
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
