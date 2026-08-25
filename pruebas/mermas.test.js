/**
 * MERMAS DEL CUARTO FRÍO  (v2.0)
 *
 * Hasta la v1.9 el hielo derretido aparecía dentro del "faltante" a secas,
 * mezclado con el que se fue sin pagar. Son dos cosas muy distintas: una es
 * física y no tiene remedio, la otra es un problema que hay que atender.
 *
 * Y el desglose de la existencia: cuánto se fue al público y cuánto a
 * mayoreo, que son dos negocios distintos dentro de la misma fábrica.
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, entrarPorNombre, bd, preparar } = fabricaDePrueba('mermas');

let almacenId, mayoreo;

preparar(async () => {
  await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Rosa', rol: 'cajero', pin: '5555' }
  });
  almacenId = bd.prepare('SELECT id FROM almacenes WHERE activo = 1 LIMIT 1').get().id;

  mayoreo = (await llamar('/api/ventas/precios/listas', {
    method: 'POST', cuerpo: { nombre: 'Mayoreo 1' }
  })).json.datos.lista;
  await llamar(`/api/ventas/precios/${mayoreo.id}`, {
    method: 'PUT', cuerpo: { precios: [{ dieciseisavos: 16, pesos: 240 }] }
  });
  await llamar(`/api/ventas/precios/listas/${mayoreo.id}/predeterminada`,
               { method: 'PUT', cuerpo: {} });
});

function estado() {
  return llamar('/api/existencia').then((r) => r.json.datos.almacenes[0]);
}

// ============================================================
// ANOTAR LO QUE SE PERDIÓ
// ============================================================

test('se anota una merma y baja lo que debería haber', async () => {
  const antes = await estado();

  const r = await llamar('/api/existencia/mermas', {
    method: 'POST',
    cuerpo: { almacenId, dieciseisavos: 16, motivo: 'derretida' }
  });
  assert.equal(r.estado, 201);

  const despues = await estado();
  assert.equal(despues.esperado, antes.esperado - 16,
               'una marqueta derretida es una marqueta que ya no está');
  assert.equal(despues.merma, 16);
});

test('la merma sale en su propio renglón, no revuelta con lo vendido', async () => {
  const a = await estado();
  assert.equal(a.vendido, 0, 'no se ha vendido nada');
  assert.ok(a.merma > 0, 'pero sí se perdió hielo');
  assert.equal(a.textos.merma, '1', 'y se dice en marquetas, como se habla');
});

test('un motivo inventado se rechaza', async () => {
  const r = await llamar('/api/existencia/mermas', {
    method: 'POST', cuerpo: { almacenId, dieciseisavos: 4, motivo: 'se la robaron los duendes' }
  });
  assert.equal(r.estado, 400);
});

test('una cantidad de cero o negativa se rechaza', async () => {
  for (const mala of [0, -4, 'medio', null]) {
    const r = await llamar('/api/existencia/mermas', {
      method: 'POST', cuerpo: { almacenId, dieciseisavos: mala, motivo: 'derretida' }
    });
    assert.equal(r.estado, 400, `debería rechazar ${mala}`);
  }
});

test('anular una merma la devuelve a la cuenta, tachada', async () => {
  const antes = await estado();
  const m = (await llamar('/api/existencia/mermas', {
    method: 'POST', cuerpo: { almacenId, dieciseisavos: 8, motivo: 'rota' }
  })).json.datos.merma;

  assert.equal((await estado()).esperado, antes.esperado - 8);

  const r = await llamar(`/api/existencia/mermas/${m.id}/anular`, {
    method: 'POST', cuerpo: { motivo: 'Me equivoqué de cantidad' }
  });
  assert.equal(r.estado, 200);
  assert.equal((await estado()).esperado, antes.esperado, 'la cuenta vuelve a donde estaba');

  // Nada se borra (regla 3.4): el renglón sigue ahí, tachado y con su motivo.
  const fila = bd.prepare('SELECT * FROM mermas_hielo WHERE id = ?').get(m.id);
  assert.ok(fila.anulada_en);
  assert.equal(fila.motivo_anulacion, 'Me equivoqué de cantidad');
});

test('queda quién la vio y quién la capturó', async () => {
  const m = (await llamar('/api/existencia/mermas', {
    method: 'POST', cuerpo: { almacenId, dieciseisavos: 2, motivo: 'regalada' }
  })).json.datos.merma;

  assert.ok(m.ejecutor_id, 'quién');
  assert.ok(m.capturista_id, 'y quién lo anotó (regla 3.6)');
});

// ============================================================
// PÚBLICO Y MAYOREO, POR SEPARADO
// ============================================================

test('la existencia parte lo vendido en público y mayoreo', async () => {
  const cliente = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Don Carlos' }
  })).json.datos.cliente;

  const antes = await estado();

  await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ codigo: '1' }], pago: '30000' }
  });
  await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ codigo: '1m' }], clienteId: cliente.id, pago: '30000' }
  });

  const despues = await estado();
  assert.equal(despues.vendidoPublico, antes.vendidoPublico + 16);
  assert.equal(despues.vendidoMayoreo, antes.vendidoMayoreo + 16);
  assert.equal(despues.vendido, antes.vendido + 32, 'y los dos suman el total de siempre');
  assert.equal(despues.esperado, antes.esperado - 32);
});

test('una venta cancelada no cuenta en ninguna de las dos', async () => {
  const antes = await estado();
  const v = (await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ codigo: '1' }], pago: '30000' }
  })).json.datos.venta;

  await llamar(`/api/ventas/${v.id}/cancelar`, {
    method: 'POST', cuerpo: { motivo: 'Se arrepintió' }
  });

  const despues = await estado();
  assert.equal(despues.vendidoPublico, antes.vendidoPublico, 'nunca salió del cuarto frío');
  assert.equal(despues.esperado, antes.esperado);
});

// ============================================================
// QUIÉN PUEDE
// ============================================================

test('quien cuenta el cuarto frío también anota mermas', async () => {
  await entrarPorNombre('Rosa', '5555');
  const r = await llamar('/api/existencia/mermas', {
    method: 'POST', cuerpo: { almacenId, dieciseisavos: 4, motivo: 'derretida' }
  });
  assert.equal(r.estado, 201, 'el que cuenta el cuarto frío es el que la ve');

  // Pero anular es corregir, y eso no es suyo.
  const m = r.json.datos.merma;
  const anula = await llamar(`/api/existencia/mermas/${m.id}/anular`, {
    method: 'POST', cuerpo: { motivo: 'ups' }
  });
  assert.equal(anula.estado, 403);

  await entrarAdmin();
});
