/**
 * IMPRIMIR POR RED  (v2.0.1)
 *
 * La térmica de la fábrica es de red: vive en su propia dirección y escucha
 * en el puerto 9100. Hasta la v2.0 el sistema solo sabía escribirle a un
 * nombre compartido de Windows, que obliga a compartir la impresora y a que
 * el driver esté puesto. Por red no hace falta nada de eso.
 *
 * Aquí se levanta una impresora de mentiras —un servidor que escucha en un
 * puerto y guarda lo que le llega— y se comprueba que:
 *
 *  · los bytes llegan tal cual, sin que nadie los toque
 *  · una impresora apagada NO deja colgada la venta
 *  · los errores se dicen para poder arreglarlos, no como los dice Node
 */
const test = require('node:test');
const assert = require('node:assert');
const net = require('node:net');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, bd, preparar } = fabricaDePrueba('impresora-red');

const {
  tipoDeDestino, imprimirCrudo, guardarAjuste
} = require('../src/modulos/impresion/impresora');

/** Una impresora de mentiras: escucha, guarda lo que le llega y se calla. */
function impresoraDeMentiras() {
  const recibido = [];
  const servidor = net.createServer((s) => {
    const partes = [];
    s.on('data', (d) => partes.push(d));
    s.on('end', () => recibido.push(Buffer.concat(partes)));
    s.on('error', () => { /* al cerrar de golpe, ni caso */ });
  });
  return new Promise((resolver) => {
    servidor.listen(0, '127.0.0.1', () => resolver({
      puerto: servidor.address().port,
      recibido,
      cerrar: () => new Promise((r) => servidor.close(r))
    }));
  });
}

/** Espera a que la impresora de mentiras termine de recibir. */
function esperar(ms = 120) { return new Promise((r) => setTimeout(r, ms)); }

// ============================================================
// QUÉ ENTIENDE DE LO QUE SE ESCRIBE
// ============================================================

test('una IP sola quiere decir "por red, puerto 9100"', () => {
  const c = tipoDeDestino('192.168.1.65');
  assert.equal(c.tipo, 'red');
  assert.equal(c.host, '192.168.1.65');
  assert.equal(c.puerto, 9100, 'el 9100 es por donde escuchan todas las térmicas');
});

test('se puede pedir otro puerto', () => {
  assert.deepEqual(
    { ...tipoDeDestino('192.168.1.65:9101'), texto: undefined },
    { tipo: 'red', host: '192.168.1.65', puerto: 9101, texto: undefined });
});

test('un nombre compartido sigue siendo un nombre compartido', () => {
  assert.equal(tipoDeDestino('\\\\localhost\\TICKET').tipo, 'compartida');
});

test('LPT1 y COM3 son puertos, no direcciones', () => {
  assert.equal(tipoDeDestino('LPT1:').tipo, 'puerto');
  assert.equal(tipoDeDestino('COM3').tipo, 'puerto');
});

test('una ruta es una ruta, no una máquina de la red', () => {
  // Si "tickets" se leyera como un nombre de red, una carpeta llamada así
  // mandaría los tickets a buscar una computadora que no existe.
  assert.equal(tipoDeDestino('C:\\tickets').tipo, 'archivo');
  assert.equal(tipoDeDestino('/tmp/tickets').tipo, 'archivo');
  assert.equal(tipoDeDestino('tickets').tipo, 'archivo');
});

test('vacío quiere decir que el servidor no imprime', () => {
  assert.equal(tipoDeDestino('').tipo, 'ninguno');
  assert.equal(tipoDeDestino('   ').tipo, 'ninguno');
});

// ============================================================
// MANDAR EL TICKET
// ============================================================

test('los bytes llegan a la impresora tal cual', async () => {
  const imp = await impresoraDeMentiras();
  guardarAjuste('impresora_destino', `127.0.0.1:${imp.puerto}`);

  const ticket = Buffer.from([0x1b, 0x40, 65, 66, 67, 0x0a]);
  const r = await imprimirCrudo(ticket);
  await esperar();

  assert.equal(r.impreso, true);
  assert.equal(r.motivo, 'red');
  assert.equal(imp.recibido.length, 1);
  assert.deepEqual(imp.recibido[0], ticket, 'ni un byte de más ni de menos');

  await imp.cerrar();
});

test('dos tickets seguidos llegan los dos', async () => {
  const imp = await impresoraDeMentiras();
  guardarAjuste('impresora_destino', `127.0.0.1:${imp.puerto}`);

  await imprimirCrudo(Buffer.from('uno'));
  await imprimirCrudo(Buffer.from('dos'));
  await esperar();

  assert.equal(imp.recibido.length, 2);
  assert.equal(Buffer.concat(imp.recibido).toString(), 'unodos');

  await imp.cerrar();
});

test('una impresora que no acepta conexiones NO tumba la venta', async () => {
  const imp = await impresoraDeMentiras();
  const puerto = imp.puerto;
  await imp.cerrar();                       // se apaga antes de imprimir

  guardarAjuste('impresora_destino', `127.0.0.1:${puerto}`);
  const r = await imprimirCrudo(Buffer.from('x'));

  assert.equal(r.impreso, false, 'no se imprimió...');
  assert.match(r.motivo, /9100|puerto/i, '...y el mensaje dice por dónde buscar');
  // Lo importante: contestó. Una excepción aquí se llevaría por delante una
  // venta que el cliente ya pagó.
});

test('el mensaje de una dirección inalcanzable se entiende', async () => {
  // 192.0.2.x es el rango reservado para ejemplos: no existe en ninguna red.
  guardarAjuste('impresora_destino', '192.0.2.77:9100');
  const r = await imprimirCrudo(Buffer.from('x'));

  assert.equal(r.impreso, false);
  assert.match(r.motivo, /red|contesta|llega/i,
               'tiene que decir qué revisar, no "ECONNREFUSED"');
});

// ============================================================
// LA CONFIGURACIÓN LO CUENTA
// ============================================================

test('la configuración dice por dónde va a salir el ticket', async () => {
  const r = await llamar('/api/impresion/config', {
    method: 'PUT', cuerpo: { destino: '192.168.1.65' }
  });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.impresion.comoSeManda.tipo, 'red');
  assert.equal(r.json.datos.impresion.comoSeManda.puerto, 9100);
  assert.equal(r.json.datos.impresion.directa, true);
});

test('se puede preguntar qué entiende sin guardar nada', async () => {
  const antes = (await llamar('/api/impresion/config')).json.datos.impresion.destino;

  const r = await llamar('/api/impresion/entender?destino=10.0.0.5%3A9101');
  assert.equal(r.json.datos.como.tipo, 'red');
  assert.equal(r.json.datos.como.puerto, 9101);

  assert.equal((await llamar('/api/impresion/config')).json.datos.impresion.destino, antes,
               'preguntar no cambia nada');
});

test('la lista de impresoras contesta aunque no sea Windows', async () => {
  const r = await llamar('/api/impresion/impresoras');
  assert.equal(r.estado, 200);
  assert.ok(Array.isArray(r.json.datos.impresoras),
            'fuera de Windows viene vacía, pero viene: la pantalla no se rompe');
});

test('la impresora se puede elegir por su nombre de Windows', () => {
  const c = tipoDeDestino('windows:ch-e80print en 192.168.1.65');
  assert.equal(c.tipo, 'windows');
  assert.equal(c.nombre, 'ch-e80print en 192.168.1.65',
               'el nombre lleva espacios y puntos: no se puede recortar');
});

test('el guion de Windows no lleva comillas sueltas ni barras invertidas', () => {
  // Es C# dentro de PowerShell dentro de JavaScript. Una comilla mal
  // escapada ahí no falla al guardar: falla la noche que alguien imprime.
  const fuente = require('node:fs')
    .readFileSync(require.resolve('../src/modulos/impresion/impresora'), 'utf8');
  const guion = fuente.match(/const GUION_RAW = `([\s\S]*?)`;/)[1];

  assert.ok(guion.includes('[LolhaRaw]::Mandar'), 'el guion está entero');
  assert.ok(guion.includes('Add-Type -TypeDefinition @"'), 'abre el bloque de C#');
  assert.ok(/\n"@\n/.test(guion), 'y lo cierra');

  // Las dos líneas que abren y cierran el bloque llevan una comilla suelta a
  // propósito: son el delimitador de PowerShell, no texto.
  const cuerpo = guion.split('\n')
    .filter((l) => !l.includes('Add-Type -TypeDefinition') && l.trim() !== '"@');

  for (const linea of cuerpo) {
    assert.equal((linea.match(/"/g) || []).length % 2, 0,
                 `comillas sin pareja: ${linea}`);
    assert.ok(!linea.includes('\\'),
              `una barra invertida en el C# es una bomba de tiempo: ${linea}`);
  }
});

test('fuera de Windows, mandar por nombre avisa en vez de reventar', async () => {
  if (process.platform === 'win32') return;
  guardarAjuste('impresora_destino', 'windows:La que sea');
  const r = await imprimirCrudo(Buffer.from('x'));
  assert.equal(r.impreso, false);
  assert.match(r.motivo, /Windows/);
});

// ============================================================
// EL CAJÓN DEL DINERO
// ============================================================

test('el pulso del cajón lleva el comando de siempre', () => {
  const { pulsoCajon } = require('../src/modulos/impresion/ticket');
  const bytes = [...pulsoCajon(2)];

  // ESC p 0 25 250: abrir por la salida 2, pulso de 50 ms.
  const dondeEmpieza = bytes.findIndex((b, i) =>
    b === 0x1b && bytes[i + 1] === 0x70);
  assert.ok(dondeEmpieza >= 0, 'el comando está');
  assert.deepEqual(bytes.slice(dondeEmpieza, dondeEmpieza + 5),
                   [0x1b, 0x70, 0x00, 0x19, 0xfa]);
});

test('la otra salida del conector cambia un byte, no el resto', () => {
  const { pulsoCajon } = require('../src/modulos/impresion/ticket');
  const dos = [...pulsoCajon(2)];
  const cinco = [...pulsoCajon(5)];

  assert.equal(dos.length, cinco.length);
  const distintos = dos.filter((b, i) => b !== cinco[i]).length;
  assert.equal(distintos, 1, 'solo cambia por cuál salida se manda');
});

test('el cajón se abre mandándole los bytes a la impresora', async () => {
  const imp = await impresoraDeMentiras();
  guardarAjuste('impresora_destino', `127.0.0.1:${imp.puerto}`);
  guardarAjuste('ticket_abrir_cajon', '1');

  const r = await llamar('/api/impresion/cajon', { method: 'POST', cuerpo: {} });
  await esperar();

  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.abierto, true);
  assert.equal(imp.recibido.length, 1, 'el cajón cuelga de la impresora: se le habla a ella');
  assert.ok(imp.recibido[0].includes(Buffer.from([0x1b, 0x70])), 'y va el comando de abrir');

  await imp.cerrar();
});

test('sin impresora configurada, abrir el cajón no revienta', async () => {
  guardarAjuste('impresora_destino', '');
  const r = await llamar('/api/impresion/cajon', { method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.abierto, false);
  assert.equal(r.json.datos.motivo, 'sin-destino');
});

test('la salida del cajón solo puede ser la 2 o la 5', async () => {
  const r = await llamar('/api/impresion/config', {
    method: 'PUT', cuerpo: { salidaCajon: 7 }
  });
  assert.equal(r.estado, 400);
});

// ============================================================
// CADA APARTADO A SU IMPRESORA
// ============================================================

test('un apartado sin impresora propia usa la de tickets', async () => {
  const tickets = await impresoraDeMentiras();
  guardarAjuste('impresora_destino', `127.0.0.1:${tickets.puerto}`);
  guardarAjuste('impresora_destino_corte', '');

  const { imprimirCrudo: mandar } = require('../src/modulos/impresion/impresora');
  await mandar(Buffer.from('corte'), { seccion: 'corte' });
  await esperar();

  assert.equal(tickets.recibido.length, 1, 'cae en la de tickets, que es lo que se espera');
  await tickets.cerrar();
});

test('un apartado con su propia impresora va a la suya', async () => {
  const tickets = await impresoraDeMentiras();
  const oficina = await impresoraDeMentiras();
  guardarAjuste('impresora_destino', `127.0.0.1:${tickets.puerto}`);
  guardarAjuste('impresora_destino_corte', `127.0.0.1:${oficina.puerto}`);

  const { imprimirCrudo: mandar } = require('../src/modulos/impresion/impresora');
  await mandar(Buffer.from('el corte'), { seccion: 'corte' });
  await mandar(Buffer.from('un ticket'), { seccion: 'venta' });
  await esperar();

  assert.equal(oficina.recibido.length, 1);
  assert.equal(oficina.recibido[0].toString(), 'el corte');
  assert.equal(tickets.recibido.length, 1);
  assert.equal(tickets.recibido[0].toString(), 'un ticket');

  await tickets.cerrar(); await oficina.cerrar();
  guardarAjuste('impresora_destino_corte', '');
});

test('la configuración dice qué tiene puesto cada apartado', async () => {
  const r = await llamar('/api/impresion/config');
  const apartados = r.json.datos.impresion.apartados;

  assert.deepEqual(apartados.map((a) => a.id), ['venta', 'corte', 'gasto', 'conteo']);
  assert.ok(apartados.every((a) => a.comoSeManda),
            'cada uno dice por dónde va a salir, tenga impresora propia o no');
});

test('el cajero no configura la impresora', async () => {
  await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Mari', rol: 'cajero', pin: '7777' }
  });
  const u = bd.prepare("SELECT id FROM usuarios WHERE nombre = 'Mari'").get();
  await llamar('/api/auth/entrar-pin', {
    method: 'POST', cuerpo: { usuarioId: u.id, pin: '7777' }
  });

  assert.equal((await llamar('/api/impresion/impresoras')).estado, 403);
  assert.equal((await llamar('/api/impresion/entender?destino=1.2.3.4')).estado, 403);
});
