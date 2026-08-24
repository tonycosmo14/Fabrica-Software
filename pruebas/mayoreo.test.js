/**
 * PRUEBAS DEL MAYOREO  (v1.9)
 *
 * "Algunos clientes gozan de mayoreo, a partir de 1/2 marqueta."
 *
 * Lo que se comprueba es lo que puede costar dinero:
 *
 *  · que el mayoreo sea una LISTA y no un descuento inventado
 *  · que aplique desde el mínimo y NO antes
 *  · que el precio lo decida el SERVIDOR, no lo que mande la pantalla
 *  · que se mida sobre todo el hielo del ticket, no renglón por renglón
 *  · que el precio quede COPIADO en el ticket (regla 3.5)
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, entrarPorNombre, bd, preparar } = fabricaDePrueba('mayoreo');

let mayoreo1, donCarlos, publico, catId;

/** Vende hielo y devuelve el total cobrado. */
async function vender(dieciseisavos, extra = {}) {
  const r = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos }], pago: '10000', ...extra }
  });
  return r;
}

preparar(async () => {
  await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Mari', rol: 'cajero', pin: '7777' }
  });

  // Mayoreo 1: la marqueta a $240 en vez de $264, y el medio a $125.
  mayoreo1 = (await llamar('/api/ventas/precios/listas', {
    method: 'POST', cuerpo: { nombre: 'Mayoreo 1' }
  })).json.datos.lista;

  await llamar(`/api/ventas/precios/${mayoreo1.id}`, {
    method: 'PUT',
    cuerpo: { precios: [{ dieciseisavos: 16, pesos: 240 },
                        { dieciseisavos: 8, pesos: 125 },
                        { dieciseisavos: 4, pesos: 65 }] }
  });

  donCarlos = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Don Carlos' }
  })).json.datos.cliente;
  await llamar(`/api/clientes/${donCarlos.id}`, {
    method: 'PUT', cuerpo: { listaId: mayoreo1.id }
  });

  publico = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Doña Rosa' }   // sin mayoreo
  })).json.datos.cliente;

  catId = (await llamar('/api/catalogo/categorias', {
    method: 'POST', cuerpo: { nombre: 'Refrescos' }
  })).json.datos.categoria.id;
});

// ============================================================
// LA LISTA
// ============================================================

test('una lista de mayoreo nace con los precios de público', async () => {
  const nueva = (await llamar('/api/ventas/precios/listas', {
    method: 'POST', cuerpo: { nombre: 'Mayoreo 2' }
  })).json.datos.lista;

  const { listas } = (await llamar('/api/ventas/precios/listas')).json.datos;
  const suya = listas.find((l) => l.id === nueva.id);
  const dePublico = listas.find((l) => l.tipo === 'publico' && l.activa);

  assert.equal(suya.tipo, 'mayoreo');
  assert.equal(suya.precios.length, dePublico.precios.length,
               'nace copiando, no vacía: una lista a medio llenar cobra de menos');
  assert.equal(suya.precios.find((p) => p.dieciseisavos === 16).centavos,
               dePublico.precios.find((p) => p.dieciseisavos === 16).centavos);
});

test('dos listas no se pueden llamar igual', async () => {
  const r = await llamar('/api/ventas/precios/listas', {
    method: 'POST', cuerpo: { nombre: 'mayoreo 1' }
  });
  assert.equal(r.estado, 400);
});

test('una lista sin nombre se rechaza', async () => {
  const r = await llamar('/api/ventas/precios/listas', { method: 'POST', cuerpo: { nombre: '  ' } });
  assert.equal(r.estado, 400);
});

test('a un cliente solo se le asigna una lista de MAYOREO', async () => {
  const { listas } = (await llamar('/api/ventas/precios/listas')).json.datos;
  const dePublico = listas.find((l) => l.tipo === 'publico');

  const r = await llamar(`/api/clientes/${publico.id}`, {
    method: 'PUT', cuerpo: { listaId: dePublico.id }
  });
  assert.equal(r.estado, 400, 'la de público no se asigna: se cambia sola al cambiar la activa');

  const inventada = await llamar(`/api/clientes/${publico.id}`, {
    method: 'PUT', cuerpo: { listaId: 'no-existe' }
  });
  assert.equal(inventada.estado, 400);
});

// ============================================================
// CUÁNDO APLICA
// ============================================================

test('sin cliente se cobra precio de público', async () => {
  const r = await vender(16);
  assert.equal(r.json.datos.venta.total_centavos, 26400);
  assert.equal(r.json.datos.mayoreo, null);
});

test('con el mayorista y una marqueta, se cobra su precio', async () => {
  const r = await vender(16, { clienteId: donCarlos.id });
  assert.equal(r.json.datos.venta.total_centavos, 24000, 'la marqueta a $240');
  assert.equal(r.json.datos.mayoreo.lista, 'Mayoreo 1');
});

test('desde media marqueta aplica', async () => {
  const r = await vender(8, { clienteId: donCarlos.id });
  assert.equal(r.json.datos.venta.total_centavos, 12500, 'el medio a $125');
  assert.ok(r.json.datos.mayoreo);
});

test('POR DEBAJO del mínimo NO aplica, aunque sea el mayorista', async () => {
  // Un cuarto son 4 dieciseisavos y el mínimo son 8. Se cobra público.
  const r = await vender(4, { clienteId: donCarlos.id });
  assert.equal(r.json.datos.venta.total_centavos, 7000, 'el cuarto sigue a $70');
  assert.equal(r.json.datos.mayoreo, null);
});

test('el mínimo se mide sobre TODO el hielo del ticket', async () => {
  // Dos cuartos son 8 dieciseisavos: alcanza, aunque ninguna línea sola lo
  // haga. Quien pide "un cuarto y un cuarto" pide media marqueta.
  const r = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ dieciseisavos: 4 }, { dieciseisavos: 4 }],
              clienteId: donCarlos.id, pago: '10000' }
  });
  assert.ok(r.json.datos.mayoreo, 'dos cuartos alcanzan el mínimo de media marqueta');

  // Alcanzar el mínimo NO convierte dos cuartos en un medio: cada fracción
  // se sigue cobrando a SU precio, el de mayoreo (regla 7.2). Dos cuartos
  // son dos cortes, y cortar cuesta lo mismo se venda mucho o poco.
  assert.equal(r.json.datos.venta.total_centavos, 6500 * 2, 'dos cuartos de mayoreo, $65 cada uno');
});

test('un cliente sin lista paga público aunque se le nombre', async () => {
  const r = await vender(16, { clienteId: publico.id });
  assert.equal(r.json.datos.venta.total_centavos, 26400);
  assert.equal(r.json.datos.mayoreo, null);
});

test('el mayoreo aplica pagando en efectivo, no solo fiado', async () => {
  // El caso de Tony: llegan, piden cinco marquetas y pagan en el momento.
  const r = await vender(16 * 5, { clienteId: donCarlos.id });
  assert.equal(r.json.datos.venta.forma_pago, 'efectivo');
  assert.equal(r.json.datos.venta.total_centavos, 24000 * 5);
});

test('pagar en efectivo con nombre NO le crea deuda', async () => {
  // El peligro de guardar el cliente en un ticket de contado: que la cuenta
  // del cliente lo cuente como fiado y salga a cobrarle algo que ya pagó.
  const antes = (await llamar(`/api/clientes/${donCarlos.id}`)).json.datos;
  const cargosAntes = antes.cuenta.filter((m) => m.tipo === 'cargo').length;

  const v = (await vender(16 * 3, { clienteId: donCarlos.id })).json.datos.venta;
  assert.equal(v.cliente_id, donCarlos.id, 'el ticket sí queda a su nombre');

  const despues = (await llamar(`/api/clientes/${donCarlos.id}`)).json.datos;
  assert.equal(despues.cliente.estado.saldo, antes.cliente.estado.saldo,
               'pagó en el momento: no debe nada nuevo');
  assert.equal(despues.cuenta.filter((m) => m.tipo === 'cargo').length, cargosAntes,
               'y no le aparece un cargo en su cuenta');
});

test('y fiado también', async () => {
  const r = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ dieciseisavos: 16 }], formaPago: 'credito', clienteId: donCarlos.id }
  });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.venta.total_centavos, 24000);
  assert.equal(r.json.datos.cliente.estado.saldo, 24000);
});

// ============================================================
// EL PRECIO LO DECIDE EL SERVIDOR
// ============================================================

test('mandar un total no sirve de nada', async () => {
  const r = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ dieciseisavos: 16, centavos: 1 }], clienteId: donCarlos.id,
              total_centavos: 1, pago: '10000' }
  });
  assert.equal(r.json.datos.venta.total_centavos, 24000);
});

test('el ticket guarda con qué lista se cobró', async () => {
  const r = await vender(16, { clienteId: donCarlos.id });
  assert.equal(r.json.datos.venta.lista_nombre, 'Mayoreo 1');
});

test('el precio queda COPIADO: subirle al mayoreo no toca los tickets viejos', async () => {
  const v = (await vender(16, { clienteId: donCarlos.id })).json.datos.venta;
  assert.equal(v.total_centavos, 24000);

  await llamar(`/api/ventas/precios/${mayoreo1.id}`, {
    method: 'PUT', cuerpo: { precios: [{ dieciseisavos: 16, pesos: 250 }] }
  });

  const viejo = (await llamar(`/api/ventas/${v.id}`)).json.datos.venta;
  assert.equal(viejo.total_centavos, 24000, 'el ticket de ayer no cambia (regla 3.5)');

  const nuevo = await vender(16, { clienteId: donCarlos.id });
  assert.equal(nuevo.json.datos.venta.total_centavos, 25000, 'el de hoy sí');
});

test('si la lista del cliente se da de baja, se cobra público', async () => {
  const suelta = (await llamar('/api/ventas/precios/listas', {
    method: 'POST', cuerpo: { nombre: 'Mayoreo temporal' }
  })).json.datos.lista;
  await llamar(`/api/ventas/precios/${suelta.id}`, {
    method: 'PUT', cuerpo: { precios: [{ dieciseisavos: 16, pesos: 200 }] }
  });

  const c = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'De temporada' }
  })).json.datos.cliente;
  await llamar(`/api/clientes/${c.id}`, { method: 'PUT', cuerpo: { listaId: suelta.id } });
  assert.equal((await vender(16, { clienteId: c.id })).json.datos.venta.total_centavos, 20000);

  // Se da de baja la lista. Cobrar con precios que ya nadie mantiene sería
  // peor que cobrar público.
  bd.prepare('UPDATE listas_precios SET activo = 0 WHERE id = ?').run(suelta.id);
  const r = await vender(16, { clienteId: c.id });
  assert.equal(r.json.datos.venta.total_centavos, 26400);
  assert.equal(r.json.datos.mayoreo, null);
});

test('a un cliente dado de baja se le cobra público', async () => {
  const c = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'El que se fue' }
  })).json.datos.cliente;
  await llamar(`/api/clientes/${c.id}`, { method: 'PUT', cuerpo: { listaId: mayoreo1.id } });
  await llamar(`/api/clientes/${c.id}/baja`, { method: 'POST', cuerpo: {} });

  const r = await vender(16, { clienteId: c.id });
  assert.equal(r.json.datos.mayoreo, null);
  assert.equal(r.json.datos.venta.total_centavos, 26400);
});

test('el ticket impreso dice a qué precio salió', async () => {
  const { ticketVenta } = require('../src/modulos/impresion/ticket');
  const v = (await vender(16, { clienteId: donCarlos.id })).json.datos.venta;
  const detalle = (await llamar(`/api/ventas/${v.id}`)).json.datos.venta;

  const papel = Buffer.from(ticketVenta(detalle, { negocio: 'Hielo LOLHA' })).toString('latin1');
  assert.match(papel, /Mayoreo 1/,
               'el papel tiene que explicar por qué la marqueta salió a $240');
  assert.match(papel, /Don Carlos/, 'y de quién fue');
});

// ============================================================
// EL MÍNIMO SE CONFIGURA
// ============================================================

test('el mínimo arranca en media marqueta', async () => {
  const { mayoreo } = (await llamar('/api/ventas/contexto')).json.datos;
  assert.equal(mayoreo.minimo, 8);
  assert.ok(mayoreo.listas.some((l) => l.nombre === 'Mayoreo 1'),
            'la caja necesita los precios para recalcular al instante');
});

test('el mínimo se cambia y manda de inmediato', async () => {
  await llamar('/api/ventas/precios/mayoreo-minimo', {
    method: 'PUT', cuerpo: { dieciseisavos: 16 }
  });

  // Ahora media marqueta ya no alcanza.
  const r = await vender(8, { clienteId: donCarlos.id });
  assert.equal(r.json.datos.mayoreo, null);
  assert.equal(r.json.datos.venta.total_centavos, 13500, 'precio de público');

  await llamar('/api/ventas/precios/mayoreo-minimo', {
    method: 'PUT', cuerpo: { dieciseisavos: 8 }
  });
});

test('un mínimo que no es un número se rechaza', async () => {
  for (const malo of ['medio', '', '-4', '0']) {
    const r = await llamar('/api/ventas/precios/mayoreo-minimo', {
      method: 'PUT', cuerpo: { dieciseisavos: malo }
    });
    assert.equal(r.estado, 400, `debería rechazar ${malo}`);
  }
  assert.equal((await llamar('/api/ventas/contexto')).json.datos.mayoreo.minimo, 8);
});

// ============================================================
// LO QUE NO ES HIELO
// ============================================================

test('el mayoreo no toca el precio de un refresco', async () => {
  // Las listas son de fracciones de hielo. Un refresco tiene su propio
  // precio y no cambia por quién lo compre.
  await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: 'Coca 600', categoriaId: catId, tipo: 'simple', precio: 25, codigo: 'COCA' }
  });

  const r = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ codigo: 'COCA', cantidad: 2 }], clienteId: donCarlos.id, pago: '10000' }
  });
  assert.equal(r.json.datos.venta.total_centavos, 5000);
});

test('un refresco no ayuda a alcanzar el mínimo de hielo', async () => {
  const r = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ dieciseisavos: 4 }, { codigo: 'COCA', cantidad: 10 }],
              clienteId: donCarlos.id, pago: '10000' }
  });
  assert.equal(r.json.datos.mayoreo, null, 'el mínimo es de hielo, no de dinero');
});

// ============================================================
// PERMISOS
// ============================================================

test('el cajero cobra mayoreo pero no cambia las listas', async () => {
  await entrarPorNombre('Mari', '7777');

  const venta = await vender(16, { clienteId: donCarlos.id });
  assert.equal(venta.estado, 201, 'el cajero es quien está en el mostrador');

  assert.equal((await llamar('/api/ventas/precios/listas', {
    method: 'POST', cuerpo: { nombre: 'Mayoreo del cajero' }
  })).estado, 403);
  assert.equal((await llamar('/api/ventas/precios/mayoreo-minimo', {
    method: 'PUT', cuerpo: { dieciseisavos: 1 }
  })).estado, 403);

  await entrarAdmin();
});
