/**
 * LA SERIE DEL AÑO EN EL TICKET  (v2.2)
 *
 * "El folio me llegó a preocupar: ¿qué va a pasar cuando el número esté tan
 * grande que se vea ridículamente grande?"
 *
 * Cada venta lleva DOS números y aquí se comprueba que no se confundan:
 *
 *   folio        la identidad. Nunca se reinicia, nunca se repite, y es lo
 *                que amarra un cambio con otro. No se enseña.
 *   2026-412     lo que se imprime y lo que el cliente dice por teléfono.
 *                El 1 de enero vuelve a empezar en 1.
 *
 * La prueba corre con el reloj de Yucatán puesto: el 31 de diciembre a las
 * 7 de la tarde de aquí ya es 1 de enero en UTC, y la serie tiene que
 * seguir el calendario de la fábrica, no el del meridiano.
 */
process.env.TZ = 'America/Merida';

const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, bd, preparar } = fabricaDePrueba('serie-anual');

const { numeroDeTicket, leerNumero } = require('../src/modulos/ventas/folio');

function vender(dieciseisavos = 16) {
  return llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos }], pago: '500' }
  }).then((r) => r.json.datos.venta);
}

const anioLocal = () => new Date().getFullYear();

// ============================================================
// CÓMO SE ESCRIBE Y CÓMO SE LEE
// ============================================================

test('el número se escribe año-número', () => {
  assert.equal(numeroDeTicket({ serie: 2026, folio_anual: 412, folio: 9999 }), '2026-412');
});

test('un ticket sin serie cae a su folio de siempre', () => {
  // Los de antes de esta versión. La migración se la puso, pero si algo
  // quedara sin ella el ticket tiene que seguir teniendo número.
  assert.equal(numeroDeTicket({ folio: 88 }), '88');
});

test('se lee como lo diga la gente', () => {
  assert.deepEqual(leerNumero('2026-412'), { serie: 2026, folioAnual: 412 });
  assert.deepEqual(leerNumero('#412'), { folioAnual: 412, folio: 412 });
  assert.deepEqual(leerNumero(' 2026 - 7 '), { serie: 2026, folioAnual: 7 });
  assert.equal(leerNumero('hola'), null);
  assert.equal(leerNumero(''), null);
});

// ============================================================
// AL COBRAR
// ============================================================

test('la primera venta del año es la número 1', async () => {
  const v = await vender();
  assert.equal(v.serie, anioLocal());
  assert.equal(v.folio_anual, 1);
  assert.equal(v.numero, `${anioLocal()}-1`);
});

test('la serie avanza de uno en uno, igual que el folio', async () => {
  const a = await vender();
  const b = await vender();
  assert.equal(b.folio_anual, a.folio_anual + 1);
  assert.equal(b.folio, a.folio + 1);
});

test('el folio de siempre NO se reinicia: es la identidad', async () => {
  // Se simula que el año pasado hubo cien tickets. La serie nueva empieza
  // en 1, pero el folio sigue subiendo desde donde iba.
  const antes = await vender();
  bd.prepare('UPDATE ventas SET serie = ?, folio_anual = ? WHERE id = ?')
    .run(anioLocal() - 1, 100, antes.id);

  const nueva = await vender();
  assert.equal(nueva.folio, antes.folio + 1, 'el folio no sabe de años');
  assert.equal(nueva.serie, anioLocal());
});

test('el año sale del reloj de la fábrica, no del de UTC', async () => {
  const v = await vender();
  assert.equal(v.serie, new Date().getFullYear(),
               'el 31 de diciembre a las 7 p.m. de aquí ya es enero en UTC');
});

test('dos tickets no pueden compartir número dentro del mismo año', async () => {
  const v = await vender();
  assert.throws(() => {
    bd.prepare('UPDATE ventas SET folio_anual = 1, serie = ? WHERE id = ?')
      .run(anioLocal(), v.id);
  }, /UNIQUE|constraint/i, 'la base lo impide, no solo el código');
});

// ============================================================
// DONDE SE VE
// ============================================================

test('el ticket impreso lleva el número de la serie', async () => {
  const { ticketVenta } = require('../src/modulos/impresion/ticket');
  const v = await vender();
  const detalle = (await llamar(`/api/ventas/${v.id}`)).json.datos.venta;

  assert.equal(detalle.numero, `${anioLocal()}-${detalle.folio_anual}`);
  const papel = Buffer.from(ticketVenta(detalle, { negocio: 'Hielo LOLHA' })).toString('latin1');
  assert.ok(papel.includes(detalle.numero), 'el papel dice lo mismo que la pantalla');
});

test('la caja dice qué número va a llevar el siguiente', async () => {
  const { siguienteNumero } = (await llamar('/api/ventas/contexto')).json.datos;
  const v = await vender();
  assert.equal(v.numero, siguienteNumero, 'lo que anunció es lo que salió');
});

// ============================================================
// BUSCARLO
// ============================================================

test('se busca por el número completo', async () => {
  const v = await vender();
  const { ventas } = (await llamar(
    `/api/ventas?busca=${encodeURIComponent(v.numero)}&limite=20`)).json.datos;
  assert.ok(ventas.some((x) => x.id === v.id));
});

test('y por el número a secas, que es como lo dice el cliente', async () => {
  const v = await vender();
  const { ventas } = (await llamar(`/api/ventas?busca=${v.folio_anual}&limite=20`)).json.datos;
  assert.ok(ventas.some((x) => x.id === v.id));
});

test('el historial también lo encuentra de las dos formas', async () => {
  const v = await vender();

  for (const como of [v.numero, String(v.folio_anual)]) {
    const r = await llamar(`/api/historial?folio=${encodeURIComponent(como)}`);
    assert.equal(r.estado, 200, `buscando "${como}"`);
    assert.ok(r.json.datos.movimientos.some((m) => m.id === v.id), `buscando "${como}"`);
  }
});

test('un número de otro año no trae el de este', async () => {
  const v = await vender();
  const r = await llamar(`/api/historial?folio=1999-${v.folio_anual}`);
  assert.equal(r.json.datos.movimientos.length, 0);
});

test('lo que no es un número se rechaza', async () => {
  assert.equal((await llamar('/api/historial?folio=hola')).estado, 400);
});

// ============================================================
// LOS CAMBIOS, CON SUS DOS NÚMEROS
// ============================================================

test('un cambio nombra a su pareja con el número de la serie', async () => {
  const vieja = await vender(8);
  const nueva = (await llamar(`/api/ventas/${vieja.id}/cambiar`, {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 4 }], motivo: 'Quería menos' }
  })).json.datos.venta;

  const { movimientos } = (await llamar('/api/historial?limite=300')).json.datos;
  const filaVieja = movimientos.find((m) => m.id === vieja.id);
  const filaNueva = movimientos.find((m) => m.id === nueva.id);

  assert.equal(filaVieja.cambiadoPorNumero, nueva.numero);
  assert.equal(filaNueva.cambioDeNumero, vieja.numero);
  assert.match(filaVieja.cambiadoPorNumero, /^\d{4}-\d+$/);
});
