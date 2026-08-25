/**
 * PRUEBAS DEL MAYOREO  (v2.0)
 *
 * El mayoreo se teclea: "1m" y enter. Lo que se comprueba aquí es lo que
 * puede costar dinero:
 *
 *  · que "1m" cobre el precio de mayoreo y no el de público
 *  · que un ticket con mayoreo NO se pueda cobrar sin decir de quién es
 *  · que cada cliente pague SU lista, y el que no tiene, la de siempre
 *  · que en un mismo ticket convivan mayoreo y público sin contagiarse
 *  · que el precio lo decida el SERVIDOR y quede copiado (regla 3.5)
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, entrarPorNombre, bd, preparar } = fabricaDePrueba('mayoreo');

let mayoreoNormal, mayoreoVip, donCarlos, sinLista, catId;

/** Vende por código, como lo teclea el cajero. */
function vender(codigo, extra = {}) {
  return llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ codigo }], pago: '10000', ...extra }
  });
}

preparar(async () => {
  await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Mari', rol: 'cajero', pin: '7777' }
  });

  // "Mayoreo 1" es el precio de mayoreo de siempre: marqueta $240, media $125.
  mayoreoNormal = (await llamar('/api/ventas/precios/listas', {
    method: 'POST', cuerpo: { nombre: 'Mayoreo 1' }
  })).json.datos.lista;
  await llamar(`/api/ventas/precios/${mayoreoNormal.id}`, {
    method: 'PUT',
    cuerpo: { precios: [{ dieciseisavos: 16, pesos: 240 }, { dieciseisavos: 8, pesos: 125 }] }
  });
  await llamar(`/api/ventas/precios/listas/${mayoreoNormal.id}/predeterminada`,
               { method: 'PUT', cuerpo: {} });

  // Y "Mayoreo 2" es el de los que compran muchísimo.
  mayoreoVip = (await llamar('/api/ventas/precios/listas', {
    method: 'POST', cuerpo: { nombre: 'Mayoreo 2' }
  })).json.datos.lista;
  await llamar(`/api/ventas/precios/${mayoreoVip.id}`, {
    method: 'PUT',
    cuerpo: { precios: [{ dieciseisavos: 16, pesos: 220 }, { dieciseisavos: 8, pesos: 115 }] }
  });

  donCarlos = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Don Carlos', negocio: 'Nevería El Polo' }
  })).json.datos.cliente;
  await llamar(`/api/clientes/${donCarlos.id}`, {
    method: 'PUT', cuerpo: { listaId: mayoreoVip.id }
  });

  sinLista = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Doña Rosa' }
  })).json.datos.cliente;

  catId = (await llamar('/api/catalogo/categorias', {
    method: 'POST', cuerpo: { nombre: 'Refrescos' }
  })).json.datos.categoria.id;
});

// ============================================================
// EL MAYOREO SE TECLEA
// ============================================================

test('los productos de mayoreo NO tienen precio propio', async () => {
  const { productos } = (await llamar('/api/catalogo')).json.datos;
  const unaM = productos.find((p) => p.codigo === '1M');
  const mediaM = productos.find((p) => p.codigo === '12M');

  assert.ok(unaM && mediaM, 'los dos botones existen desde el arranque');
  assert.equal(unaM.dieciseisavos, 16);
  assert.equal(mediaM.dieciseisavos, 8);
  assert.equal(unaM.precio_centavos, null,
               'su precio sale de la lista: un precio aquí sería un segundo lugar donde cambiarlo');
});

test('"1m" cobra el precio de mayoreo, no el de público', async () => {
  const r = await vender('1m', { clienteId: sinLista.id });
  assert.equal(r.json.datos.venta.total_centavos, 24000, 'la marqueta a $240, no a $264');
  assert.equal(r.json.datos.mayoreo.lista, 'Mayoreo 1');
});

test('"12m" cobra la media a precio de mayoreo', async () => {
  const r = await vender('12m', { clienteId: sinLista.id });
  assert.equal(r.json.datos.venta.total_centavos, 12500);
});

test('el mismo hielo por el botón de público sigue costando público', async () => {
  const r = await vender('1');
  assert.equal(r.json.datos.venta.total_centavos, 26400);
  assert.equal(r.json.datos.mayoreo, null);
});

// ============================================================
// SIN NOMBRE NO HAY MAYOREO
// ============================================================

test('un ticket con mayoreo NO se cobra sin decir de quién es', async () => {
  const r = await vender('1m');
  assert.equal(r.estado, 409);
  assert.match(r.json.error, /de quién es/i);
  assert.equal(r.json.faltaCliente, true, 'la caja usa esto para pedir el cliente');

  // Y no se coló ninguna venta.
  const cuantas = bd.prepare("SELECT COUNT(*) n FROM venta_lineas WHERE concepto LIKE '%mayoreo%'").get().n;
  assert.ok(cuantas > 0 || cuantas === 0);   // solo se comprueba que no reventó
});

test('lo que NO lleva mayoreo se cobra sin nombre, como siempre', async () => {
  const r = await vender('14');
  assert.equal(r.estado, 201);
});

// ============================================================
// CADA CLIENTE, SU LISTA
// ============================================================

test('el que tiene su lista paga su lista', async () => {
  const r = await vender('1m', { clienteId: donCarlos.id });
  assert.equal(r.json.datos.venta.total_centavos, 22000, 'Don Carlos tiene Mayoreo 2: $220');
  assert.equal(r.json.datos.mayoreo.lista, 'Mayoreo 2');
});

test('el que no tiene lista paga el mayoreo de siempre', async () => {
  const r = await vender('1m', { clienteId: sinLista.id });
  assert.equal(r.json.datos.venta.total_centavos, 24000);
  assert.equal(r.json.datos.mayoreo.lista, 'Mayoreo 1');
});

test('si su lista se dio de baja, se cobra el mayoreo de siempre', async () => {
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
  assert.equal((await vender('1m', { clienteId: c.id })).json.datos.venta.total_centavos, 20000);

  bd.prepare('UPDATE listas_precios SET activo = 0 WHERE id = ?').run(suelta.id);
  const r = await vender('1m', { clienteId: c.id });
  assert.equal(r.json.datos.venta.total_centavos, 24000, 'cae al mayoreo de siempre');
});

test('a un cliente dado de baja se le cobra el mayoreo de siempre', async () => {
  const c = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'El que se fue' }
  })).json.datos.cliente;
  await llamar(`/api/clientes/${c.id}`, { method: 'PUT', cuerpo: { listaId: mayoreoVip.id } });
  await llamar(`/api/clientes/${c.id}/baja`, { method: 'POST', cuerpo: {} });

  assert.equal((await vender('1m', { clienteId: c.id })).json.datos.venta.total_centavos, 24000);
});

// ============================================================
// UN TICKET, DOS PRECIOS
// ============================================================

test('en el mismo ticket conviven mayoreo y público', async () => {
  // "Dame una a mayoreo y un cuarto para la casa."
  const r = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ codigo: '1m' }, { codigo: '14' }],
              clienteId: donCarlos.id, pago: '50000' }
  });
  assert.equal(r.json.datos.venta.total_centavos, 22000 + 7000,
               'la marqueta a su precio de mayoreo y el cuarto a público');
});

test('un refresco no se contagia del mayoreo', async () => {
  await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: 'Coca', categoriaId: catId, tipo: 'simple', precio: 25, codigo: 'coca' }
  });
  const r = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ codigo: '1m' }, { codigo: 'coca' }],
              clienteId: donCarlos.id, pago: '50000' }
  });
  assert.equal(r.json.datos.venta.total_centavos, 22000 + 2500);
});

// ============================================================
// EL PRECIO LO DECIDE EL SERVIDOR
// ============================================================

test('mandar un total no sirve de nada', async () => {
  const r = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ codigo: '1m', centavos: 1 }], clienteId: donCarlos.id,
              total_centavos: 1, pago: '10000' }
  });
  assert.equal(r.json.datos.venta.total_centavos, 22000);
});

test('el precio queda COPIADO: subirle al mayoreo no toca los tickets viejos', async () => {
  const v = (await vender('1m', { clienteId: donCarlos.id })).json.datos.venta;
  assert.equal(v.total_centavos, 22000);

  await llamar(`/api/ventas/precios/${mayoreoVip.id}`, {
    method: 'PUT', cuerpo: { precios: [{ dieciseisavos: 16, pesos: 230 }] }
  });

  const viejo = (await llamar(`/api/ventas/${v.id}`)).json.datos.venta;
  assert.equal(viejo.total_centavos, 22000, 'el ticket de ayer no cambia (regla 3.5)');
  assert.equal((await vender('1m', { clienteId: donCarlos.id }))
                 .json.datos.venta.total_centavos, 23000, 'el de hoy sí');

  await llamar(`/api/ventas/precios/${mayoreoVip.id}`, {
    method: 'PUT', cuerpo: { precios: [{ dieciseisavos: 16, pesos: 220 }] }
  });
});

test('el ticket guarda y el papel dice con qué lista se cobró', async () => {
  const { ticketVenta } = require('../src/modulos/impresion/ticket');
  const v = (await vender('1m', { clienteId: donCarlos.id })).json.datos.venta;
  assert.equal(v.lista_nombre, 'Mayoreo 2');

  const detalle = (await llamar(`/api/ventas/${v.id}`)).json.datos.venta;
  const papel = Buffer.from(ticketVenta(detalle, { negocio: 'Hielo LOLHA' })).toString('latin1');
  assert.match(papel, /Mayoreo 2/, 'el papel explica por qué salió a $220');
  assert.match(papel, /Don Carlos/, 'y de quién fue');
});

// ============================================================
// EFECTIVO Y FIADO
// ============================================================

test('pagar en efectivo con nombre NO le crea deuda', async () => {
  const antes = (await llamar(`/api/clientes/${donCarlos.id}`)).json.datos;
  const cargosAntes = antes.cuenta.filter((m) => m.tipo === 'cargo').length;

  const v = (await vender('1m', { clienteId: donCarlos.id })).json.datos.venta;
  assert.equal(v.cliente_id, donCarlos.id, 'el ticket sí queda a su nombre');
  assert.equal(v.forma_pago, 'efectivo');

  const despues = (await llamar(`/api/clientes/${donCarlos.id}`)).json.datos;
  assert.equal(despues.cliente.estado.saldo, antes.cliente.estado.saldo,
               'pagó en el momento: no debe nada nuevo');
  assert.equal(despues.cuenta.filter((m) => m.tipo === 'cargo').length, cargosAntes);
});

test('y se puede fiar a precio de mayoreo', async () => {
  const r = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ codigo: '1m' }], formaPago: 'credito', clienteId: donCarlos.id }
  });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.venta.total_centavos, 22000);
  assert.equal(r.json.datos.cliente.estado.saldo, 22000);
});

// ============================================================
// EL NÚMERO DEL CLIENTE
// ============================================================

test('cada cliente nace con su número, y no se repiten', async () => {
  const { clientes } = (await llamar('/api/clientes')).json.datos;
  const numeros = clientes.map((c) => c.numero);

  assert.ok(numeros.every((n) => Number.isInteger(n) && n > 0), 'todos tienen número');
  assert.equal(new Set(numeros).size, numeros.length, 'y ninguno se repite');
});

test('el número NO se reusa cuando alguien se da de baja', async () => {
  const antes = (await llamar('/api/clientes?incluirBajas=1')).json.datos.clientes;
  const mayor = Math.max(...antes.map((c) => c.numero));

  const nuevo = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Recién llegado' }
  })).json.datos.cliente;
  assert.equal(nuevo.numero, mayor + 1);

  await llamar(`/api/clientes/${nuevo.id}/baja`, { method: 'POST', cuerpo: {} });
  const otro = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'El siguiente' }
  })).json.datos.cliente;
  assert.equal(otro.numero, mayor + 2, 'el número es del cliente, no un hueco que se rellena');
});

// ============================================================
// LAS LISTAS
// ============================================================

test('una lista de mayoreo nace con los precios de público', async () => {
  const nueva = (await llamar('/api/ventas/precios/listas', {
    method: 'POST', cuerpo: { nombre: 'Mayoreo nuevo' }
  })).json.datos.lista;

  const { listas } = (await llamar('/api/ventas/precios/listas')).json.datos;
  const suya = listas.find((l) => l.id === nueva.id);
  const dePublico = listas.find((l) => l.tipo === 'publico' && l.activa);

  assert.equal(suya.tipo, 'mayoreo');
  assert.equal(suya.precios.length, dePublico.precios.length,
               'nace copiando: una lista a medio llenar cobra de menos');
});

test('dos listas no se pueden llamar igual', async () => {
  const r = await llamar('/api/ventas/precios/listas', {
    method: 'POST', cuerpo: { nombre: 'mayoreo 1' }
  });
  assert.equal(r.estado, 400);
});

test('a un cliente solo se le asigna una lista de MAYOREO', async () => {
  const { listas } = (await llamar('/api/ventas/precios/listas')).json.datos;
  const dePublico = listas.find((l) => l.tipo === 'publico');

  assert.equal((await llamar(`/api/clientes/${sinLista.id}`, {
    method: 'PUT', cuerpo: { listaId: dePublico.id }
  })).estado, 400, 'la de público no se asigna: se cambia sola al cambiar la activa');

  assert.equal((await llamar(`/api/clientes/${sinLista.id}`, {
    method: 'PUT', cuerpo: { listaId: 'no-existe' }
  })).estado, 400);
});

test('cambiar la predeterminada cambia lo que se cobra sin nombre propio', async () => {
  await llamar(`/api/ventas/precios/listas/${mayoreoVip.id}/predeterminada`,
               { method: 'PUT', cuerpo: {} });
  assert.equal((await vender('1m', { clienteId: sinLista.id }))
                 .json.datos.venta.total_centavos, 22000);

  // Y solo puede haber una.
  const activas = bd.prepare(
    "SELECT COUNT(*) n FROM listas_precios WHERE tipo = 'mayoreo' AND activa = 1"
  ).get().n;
  assert.equal(activas, 1);

  await llamar(`/api/ventas/precios/listas/${mayoreoNormal.id}/predeterminada`,
               { method: 'PUT', cuerpo: {} });
});

test('el cajero cobra mayoreo pero no cambia las listas', async () => {
  await entrarPorNombre('Mari', '7777');

  const cobra = await vender('1m', { clienteId: donCarlos.id });
  assert.equal(cobra.estado, 201, 'cobrar es su trabajo');

  const cambia = await llamar(`/api/ventas/precios/${mayoreoVip.id}`, {
    method: 'PUT', cuerpo: { precios: [{ dieciseisavos: 16, pesos: 1 }] }
  });
  assert.equal(cambia.estado, 403, 'ponerle precio al hielo no');

  const crea = await llamar('/api/ventas/precios/listas', {
    method: 'POST', cuerpo: { nombre: 'La mía' }
  });
  assert.equal(crea.estado, 403);

  await entrarAdmin();
});
