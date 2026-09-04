/**
 * PRUEBAS DEL REPARTO  (v5.7)
 *
 * ============================================================
 * LO QUE ESTE ARCHIVO CUIDA
 * ============================================================
 *
 * Una liquidación mal hecha no truena: sale un número, alguien lo firma, y
 * el hueco aparece semanas después en un corte que nadie puede explicar.
 * Estos son los sitios donde eso pasa:
 *
 *   · Que el dinero NO SE CUENTE DOS VECES. Cada pedido entregado en
 *     efectivo ya cuenta en el arqueo del turno; si además se apuntara una
 *     entrada al cajón por lo que trae el repartidor, la caja sobraría
 *     todos los días.
 *
 *   · Que solo se le pida el EFECTIVO. Lo que se fue a crédito o por
 *     transferencia no viene en su bolsa.
 *
 *   · Que la MERMA salga de la resta y no de lo que alguien teclee, y que
 *     se cargue UNA sola vez al cuarto frío.
 *
 *   · Que la cajera pueda RECIBIR pero no CERRAR lo que no cuadró, y que
 *     el repartidor no pueda hacerse su propia liquidación.
 *
 *   · Que un pedido que vuelve sin entregar quede PENDIENTE otra vez y no
 *     colgado de un viaje que ya terminó.
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, entrarPorNombre, crearUsuario, bd,
        preparar } = fabricaDePrueba('reparto');

let camioneta, beto, tienda, otra, bolsa, mayoreo;

preparar(async () => {
  await crearUsuario('Mari', 'cajero', '7777');
  beto = await crearUsuario('Beto', 'repartidor', '8888');
  await crearUsuario('Leila', 'gerente', '9999');

  camioneta = (await llamar('/api/reparto/vehiculos', {
    method: 'POST',
    cuerpo: { nombre: 'La camioneta blanca', tipo: 'camioneta', capacidad: 40 }
  })).json.datos.vehiculo;

  mayoreo = (await llamar('/api/ventas/precios/listas', {
    method: 'POST', cuerpo: { nombre: 'Mayoreo 1' }
  })).json.datos.lista;
  await llamar(`/api/ventas/precios/${mayoreo.id}`, {
    method: 'PUT', cuerpo: { precios: [{ dieciseisavos: 16, pesos: 240 }] }
  });
  await llamar(`/api/ventas/precios/listas/${mayoreo.id}/predeterminada`,
               { method: 'PUT', cuerpo: {} });

  const cat = (await llamar('/api/catalogo/categorias', {
    method: 'POST', cuerpo: { nombre: 'Reparto' }
  })).json.datos.categoria.id;
  bolsa = (await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: 'Bolsa de 5 kg', categoriaId: cat, precio: '20', codigo: 'B5' }
  })).json.datos.producto;

  tienda = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Juan Pech', negocio: 'Abarrotes Juan' }
  })).json.datos.cliente;
  await llamar(`/api/clientes/${tienda.id}`, {
    method: 'PUT', cuerpo: { limite: '100000' }
  });
  otra = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Doña Rosa' }
  })).json.datos.cliente;
});

/** Toma un pedido, como lo tomaría la cajera desde Vender. */
async function pedido(clienteId, lineas, formaPago = 'efectivo') {
  const r = await llamar('/api/pedidos', {
    method: 'POST', cuerpo: { clienteId, lineas, formaPago }
  });
  assert.equal(r.estado, 201, r.json?.error);
  return r.json.datos.pedido;
}

/** Arma una salida con sus pedidos y la saca a la calle. */
async function salida({ pedidos = [], carga = [], sacar = true } = {}) {
  const s = (await llamar('/api/reparto', {
    method: 'POST', cuerpo: { repartidorId: beto.id, vehiculoId: camioneta.id }
  })).json.datos.salida;

  for (const p of pedidos) {
    const r = await llamar(`/api/reparto/${s.id}/pedidos`, {
      method: 'POST', cuerpo: { pedidoId: p.id }
    });
    assert.equal(r.estado, 201, r.json?.error);
  }
  for (const c of carga) {
    const r = await llamar(`/api/reparto/${s.id}/carga`, { method: 'POST', cuerpo: c });
    assert.equal(r.estado, 201, r.json?.error);
  }
  if (sacar) {
    const r = await llamar(`/api/reparto/${s.id}/salir`, { method: 'POST', cuerpo: {} });
    assert.equal(r.estado, 200, r.json?.error);
    return r.json.datos.salida;
  }
  return (await llamar(`/api/reparto/${s.id}`)).json.datos.salida;
}

const ver = async (id) => (await llamar(`/api/reparto/${id}`)).json.datos.salida;

// ============================================================
// ARMARLA
// ============================================================

test('una salida necesita quién se la lleva', async () => {
  const r = await llamar('/api/reparto', { method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 400);
  assert.match(r.json.error, /repartidor/i);
});

test('la camioneta no sale vacía', async () => {
  const s = (await llamar('/api/reparto', {
    method: 'POST', cuerpo: { repartidorId: beto.id }
  })).json.datos.salida;
  const r = await llamar(`/api/reparto/${s.id}/salir`, { method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 400);
  assert.match(r.json.error, /vac/i);
});

test('un pedido no puede ir en dos salidas a la vez', async () => {
  const p = await pedido(tienda.id, [{ productoId: bolsa.id, cantidad: 4 }]);
  const a = await salida({ pedidos: [p], sacar: false });

  const b = (await llamar('/api/reparto', {
    method: 'POST', cuerpo: { repartidorId: beto.id }
  })).json.datos.salida;
  const r = await llamar(`/api/reparto/${b.id}/pedidos`, {
    method: 'POST', cuerpo: { pedidoId: p.id }
  });
  assert.equal(r.estado, 409);
  assert.match(r.json.error, new RegExp(`salida #${a.folio}`));
});

test('ya en la calle no se le agrega ni se le baja carga', async () => {
  const s = await salida({ carga: [{ dieciseisavos: 32 }] });
  const a = await llamar(`/api/reparto/${s.id}/carga`, {
    method: 'POST', cuerpo: { dieciseisavos: 16 }
  });
  assert.equal(a.estado, 409);
  assert.match(a.json.error, /no subió al camión/i);
});

test('avisa cuando la carga no le cabe al vehículo', async () => {
  // La camioneta es de 40 marquetas; se le suben 60.
  const s = await salida({ carga: [{ dieciseisavos: 60 * 16 }], sacar: false });
  assert.equal(s.cabe, false, 'sobrecargarla es que el hielo llegue derretido');
  assert.equal(s.hielo.subio, 60 * 16);
});

test('lo de mayoreo no sube suelto: eso es un pedido con su cliente', async () => {
  const s = (await llamar('/api/reparto', {
    method: 'POST', cuerpo: { repartidorId: beto.id }
  })).json.datos.salida;
  const { productos } = (await llamar('/api/catalogo')).json.datos;
  const may = productos.find((p) => p.codigo === '1M');
  const r = await llamar(`/api/reparto/${s.id}/carga`, {
    method: 'POST', cuerpo: { productoId: may.id, cantidad: 1 }
  });
  assert.equal(r.estado, 409);
  assert.match(r.json.error, /pedido/i);
});

// ============================================================
// EL REGRESO Y LA MERMA
// ============================================================

test('la merma sale de la resta, no de lo que alguien teclee', async () => {
  // Suben 10 marquetas sueltas, vuelven 2 y se vendieron 7: 1 se derritió.
  const s = await salida({ carga: [{ dieciseisavos: 10 * 16 }] });
  await llamar(`/api/reparto/${s.id}/regreso`, { method: 'POST', cuerpo: {} });

  const linea = (await ver(s.id)).carga[0];
  await llamar(`/api/reparto/${s.id}/carga/${linea.id}/regreso`, {
    method: 'POST',
    cuerpo: { vendidoDieciseisavos: 7 * 16, regresoDieciseisavos: 2 * 16 }
  });

  const d = await ver(s.id);
  assert.equal(d.hielo.merma, 16, 'una marqueta');
  assert.equal(d.hielo.textos.merma, '1');
  assert.equal(d.hielo.porcientoMerma, 10);
});

test('no pueden volver y venderse más de lo que subió', async () => {
  const s = await salida({ carga: [{ dieciseisavos: 32 }] });
  await llamar(`/api/reparto/${s.id}/regreso`, { method: 'POST', cuerpo: {} });
  const linea = (await ver(s.id)).carga[0];

  const r = await llamar(`/api/reparto/${s.id}/carga/${linea.id}/regreso`, {
    method: 'POST', cuerpo: { vendidoDieciseisavos: 32, regresoDieciseisavos: 32 }
  });
  assert.equal(r.estado, 400);
});

test('la carga sin capturar NO cuenta como merma', async () => {
  // Es la trampa: cero volvió y cero se vendió NO es lo mismo que "todavía
  // no se ha contado". Si se confundieran, un viaje recién llegado saldría
  // con toda la carga derretida.
  const s = await salida({ carga: [{ dieciseisavos: 5 * 16 }] });
  await llamar(`/api/reparto/${s.id}/regreso`, { method: 'POST', cuerpo: {} });
  const d = await ver(s.id);
  assert.equal(d.hielo.merma, 0);
  assert.equal(d.carga[0].capturado, false);
});

// ============================================================
// EL DINERO
// ============================================================

test('solo se le pide el efectivo: lo fiado no viene en su bolsa', async () => {
  const aContado = await pedido(tienda.id, [{ productoId: bolsa.id, cantidad: 10 }]); // $200
  const aCredito = await pedido(otra.id, [{ productoId: bolsa.id, cantidad: 5 }], 'credito'); // $100
  const s = await salida({ pedidos: [aContado, aCredito] });

  await llamar(`/api/reparto/${s.id}/regreso`, { method: 'POST', cuerpo: {} });
  await llamar(`/api/reparto/${s.id}/pedidos/${aContado.id}/entregado`,
               { method: 'POST', cuerpo: { formaPago: 'efectivo' } });
  await llamar(`/api/reparto/${s.id}/pedidos/${aCredito.id}/entregado`,
               { method: 'POST', cuerpo: { formaPago: 'credito' } });

  const d = await ver(s.id);
  assert.equal(d.dinero.esperado, 20000, 'solo los $200 de contado');
  assert.equal(d.dinero.credito, 10000);
  assert.equal(d.total, 30000, 'pero el viaje sí vendió $300');
});

test('EL DINERO NO SE CUENTA DOS VECES en el corte', async () => {
  // Es la decisión que más se podría hacer al revés. Cada pedido entregado
  // en efectivo crea SU venta, y una venta en efectivo ya cuenta en el
  // arqueo del turno. Si al recibir se apuntara además una entrada al
  // cajón, la caja sobraría todos los días.
  // ESTA PRUEBA NECESITA UN TURNO ABIERTO: sin cajón no hay arqueo que
  // pueda contar el dinero dos veces, y la prueba pasaría por no probar
  // nada.
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 0 } });

  const entradasDeCaja = async () => {
    const c = (await llamar('/api/caja')).json.datos.abierta;
    return { entradas: c.entradas, vendido: c.vendido, esperado: c.esperado };
  };
  const antes = await entradasDeCaja();

  const p = await pedido(tienda.id, [{ productoId: bolsa.id, cantidad: 3 }]); // $60
  const s = await salida({ pedidos: [p] });
  await llamar(`/api/reparto/${s.id}/regreso`, { method: 'POST', cuerpo: {} });
  await llamar(`/api/reparto/${s.id}/pedidos/${p.id}/entregado`,
               { method: 'POST', cuerpo: { formaPago: 'efectivo' } });
  await llamar(`/api/reparto/${s.id}/recibir`, { method: 'POST', cuerpo: { efectivo: '60' } });

  const despues = await entradasDeCaja();
  assert.equal(despues.entradas, antes.entradas,
    'la liquidación NO mete una entrada al cajón: ese dinero ya entró con la venta');
  // Y sí subió por el otro lado: la venta en efectivo del pedido.
  assert.equal(despues.vendido - antes.vendido, 6000);
  assert.equal(despues.esperado - antes.esperado, 6000,
    'el cajón debe traer $60 más, una sola vez');

  // Y la venta sí está contada.
  const suyas = bd.prepare(
    "SELECT COUNT(*) n FROM ventas WHERE notas = ? AND forma_pago = 'efectivo'"
  ).get(`Pedido ${p.folio}`).n;
  assert.equal(suyas, 1);
});

test('cuadra: se cierra sola y carga la merma una sola vez', async () => {
  const p = await pedido(tienda.id, [{ productoId: bolsa.id, cantidad: 5 }]); // $100
  const s = await salida({ pedidos: [p], carga: [{ dieciseisavos: 4 * 16 }] });

  await llamar(`/api/reparto/${s.id}/regreso`, { method: 'POST', cuerpo: {} });
  await llamar(`/api/reparto/${s.id}/pedidos/${p.id}/entregado`,
               { method: 'POST', cuerpo: { formaPago: 'efectivo' } });

  const linea = (await ver(s.id)).carga[0];
  // Subieron 4 marquetas: se vendieron 2, volvió 1, se derritió 1.
  await llamar(`/api/reparto/${s.id}/carga/${linea.id}/regreso`, {
    method: 'POST', cuerpo: { vendidoDieciseisavos: 32, regresoDieciseisavos: 16 }
  });

  const conCuentas = await ver(s.id);
  // 2 marquetas de las 4 que subieron, a $264 la marqueta de público: $528
  assert.equal(conCuentas.dinero.suelto, conCuentas.carga[0].vendidoCentavos);
  const esperado = conCuentas.dinero.esperado;

  const r = await llamar(`/api/reparto/${s.id}/recibir`, {
    method: 'POST', cuerpo: { efectivo: String(esperado / 100) }
  });
  assert.equal(r.estado, 200, r.json?.error);
  assert.equal(r.json.datos.cuadro, true);
  assert.equal(r.json.datos.salida.estado, 'liquidada', 'el día normal no espera a nadie');

  // La merma quedó cargada al cuarto frío, una sola vez.
  const mermas = bd.prepare(
    'SELECT * FROM mermas_hielo WHERE notas LIKE ? AND anulada_en IS NULL'
  ).all(`%salida ${s.folio}%`);
  assert.equal(mermas.length, 1);
  assert.equal(mermas[0].dieciseisavos, 16);
  assert.equal(mermas[0].motivo, 'derretida');
});

test('la venta de lo suelto queda amarrada a su salida', async () => {
  const s = await salida({ carga: [{ productoId: bolsa.id, cantidad: 10 }] });
  await llamar(`/api/reparto/${s.id}/regreso`, { method: 'POST', cuerpo: {} });
  const linea = (await ver(s.id)).carga[0];
  await llamar(`/api/reparto/${s.id}/carga/${linea.id}/regreso`, {
    method: 'POST', cuerpo: { vendidoCantidad: 6, regresoCantidad: 4 }
  });

  const d = await ver(s.id);
  assert.equal(d.dinero.esperado, 12000, '6 bolsas a $20');

  await llamar(`/api/reparto/${s.id}/recibir`, { method: 'POST', cuerpo: { efectivo: '120' } });

  const venta = bd.prepare('SELECT * FROM ventas WHERE salida_id = ?').get(s.id);
  assert.ok(venta, 'sin esto, "cuánto vendió el reparto" no se puede contestar');
  assert.equal(venta.total_centavos, 12000);
  assert.match(venta.notas, /Venta en ruta/);
});

test('marcarlo entregado desde Pedidos también lo amarra a su viaje', async () => {
  // El mismo pedido se puede marcar entregado desde el cuadre de su salida
  // —que sabe de qué viaje es— o desde la pantalla de pedidos, que no. Si
  // el amarre dependiera de por dónde se marcó, la mitad de las ventas del
  // reparto quedarían sin viaje y «cuánto vendió el reparto» saldría mal
  // sin que nadie pudiera decir por qué.
  const p = await pedido(tienda.id, [{ productoId: bolsa.id, cantidad: 4 }]);
  const s = await salida({ pedidos: [p] });

  const r = await llamar(`/api/pedidos/${p.id}/entregar`, {
    method: 'POST', cuerpo: { formaPago: 'efectivo' }
  });
  assert.equal(r.estado, 200);

  const venta = bd.prepare('SELECT salida_id FROM ventas WHERE id = ?')
    .get(r.json.datos.venta.id);
  assert.equal(venta.salida_id, s.id);

  // Y la salida lo cuenta como entregado, con su dinero.
  const d = await ver(s.id);
  assert.equal(d.entregados, 1);
  assert.equal(d.dinero.esperado, 8000);
});

test('no se recibe con pedidos sin capturar', async () => {
  const p = await pedido(tienda.id, [{ productoId: bolsa.id, cantidad: 2 }]);
  const s = await salida({ pedidos: [p] });
  await llamar(`/api/reparto/${s.id}/regreso`, { method: 'POST', cuerpo: {} });

  const r = await llamar(`/api/reparto/${s.id}/recibir`, {
    method: 'POST', cuerpo: { efectivo: '40' }
  });
  assert.equal(r.estado, 409);
  assert.match(r.json.error, /por capturar/i);
});

test('el que vuelve sin entregar queda PENDIENTE otra vez', async () => {
  const p = await pedido(tienda.id, [{ productoId: bolsa.id, cantidad: 2 }]);
  const s = await salida({ pedidos: [p] });
  await llamar(`/api/reparto/${s.id}/regreso`, { method: 'POST', cuerpo: {} });

  const sinMotivo = await llamar(`/api/reparto/${s.id}/pedidos/${p.id}/no-entregado`,
                                 { method: 'POST', cuerpo: {} });
  assert.equal(sinMotivo.estado, 400, 'el motivo es lo que se le dice al cliente');

  await llamar(`/api/reparto/${s.id}/pedidos/${p.id}/no-entregado`,
               { method: 'POST', cuerpo: { motivo: 'Estaba cerrado' } });

  const d = await ver(s.id);
  assert.equal(d.pedidos[0].estado, 'pendiente');
  assert.equal(d.pedidos[0].noEntregadoMotivo, 'Estaba cerrado');
  assert.equal(d.dinero.esperado, 0, 'no se le pide dinero de lo que no entregó');

  // Y sigue saliendo en la lista de pendientes, que es donde se le busca.
  const pendientes = (await llamar('/api/pedidos')).json.datos.pedidos;
  assert.ok(pendientes.some((x) => x.id === p.id));
});

// ============================================================
// LA DIFERENCIA Y QUIÉN LA CIERRA
// ============================================================

test('si falta dinero, la salida NO se cierra sola', async () => {
  const p = await pedido(tienda.id, [{ productoId: bolsa.id, cantidad: 10 }]); // $200
  const s = await salida({ pedidos: [p] });
  await llamar(`/api/reparto/${s.id}/regreso`, { method: 'POST', cuerpo: {} });
  await llamar(`/api/reparto/${s.id}/pedidos/${p.id}/entregado`,
               { method: 'POST', cuerpo: { formaPago: 'efectivo' } });

  const r = await llamar(`/api/reparto/${s.id}/recibir`, {
    method: 'POST', cuerpo: { efectivo: '150' }
  });
  assert.equal(r.estado, 200, 'se recibe de todos modos: el dinero ya está en la mano');
  assert.equal(r.json.datos.diferencia, -5000);
  assert.equal(r.json.datos.salida.estado, 'regreso', 'queda abierta hasta que alguien la cierre');
  return s;
});

test('la cajera recibe, pero no cierra lo que no cuadró', async () => {
  const p = await pedido(tienda.id, [{ productoId: bolsa.id, cantidad: 10 }]);
  const s = await salida({ pedidos: [p] });

  await entrarPorNombre('Mari', '7777');
  await llamar(`/api/reparto/${s.id}/regreso`, { method: 'POST', cuerpo: {} });
  await llamar(`/api/reparto/${s.id}/pedidos/${p.id}/entregado`,
               { method: 'POST', cuerpo: { formaPago: 'efectivo' } });

  const recibe = await llamar(`/api/reparto/${s.id}/recibir`, {
    method: 'POST', cuerpo: { efectivo: '150' }
  });
  assert.equal(recibe.estado, 200, 'recibir sí: es contar billetes');

  const cierra = await llamar(`/api/reparto/${s.id}/cerrar`, {
    method: 'POST', cuerpo: { motivo: 'se le cayó' }
  });
  assert.equal(cierra.estado, 403,
    'cerrar es decidir quién se come la diferencia, y eso tiene dueño');

  // El gerente sí, y le pide el motivo.
  await entrarPorNombre('Leila', '9999');
  const sinMotivo = await llamar(`/api/reparto/${s.id}/cerrar`, { method: 'POST', cuerpo: {} });
  assert.equal(sinMotivo.estado, 400);
  assert.match(sinMotivo.json.error, /Faltan/);

  const conMotivo = await llamar(`/api/reparto/${s.id}/cerrar`, {
    method: 'POST', cuerpo: { motivo: 'Se le cayó un billete; se le descuenta' }
  });
  assert.equal(conMotivo.estado, 200);
  assert.equal(conMotivo.json.datos.salida.estado, 'liquidada');
  assert.equal(conMotivo.json.datos.salida.motivo_diferencia, 'Se le cayó un billete; se le descuenta');

  await entrarAdmin();
});

test('el repartidor no se cuadra a sí mismo', async () => {
  const p = await pedido(tienda.id, [{ productoId: bolsa.id, cantidad: 2 }]);
  const s = await salida({ pedidos: [p] });

  await entrarPorNombre('Beto', '8888');
  assert.equal((await llamar('/api/reparto')).estado, 200, 'verla sí: es su hoja de trabajo');

  const armando = await llamar('/api/reparto', {
    method: 'POST', cuerpo: { repartidorId: beto.id }
  });
  assert.equal(armando.estado, 403);

  const recibiendo = await llamar(`/api/reparto/${s.id}/recibir`, {
    method: 'POST', cuerpo: { efectivo: '40' }
  });
  assert.equal(recibiendo.estado, 403,
    'la persona a la que se le cuadra no puede ser la que cuadra');

  await entrarAdmin();
});

test('el operario no ve el reparto', async () => {
  await crearUsuario('Chema', 'operario', '2222');
  await entrarPorNombre('Chema', '2222');
  assert.equal((await llamar('/api/reparto')).estado, 403);
  await entrarAdmin();
});

// ============================================================
// LOS PAPELES
// ============================================================

test('la hoja de carga dice qué sube, sin precios', async () => {
  const p = await pedido(tienda.id, [{ productoId: bolsa.id, cantidad: 3 }]);
  const s = await salida({ pedidos: [p], carga: [{ dieciseisavos: 3 * 16 }], sacar: false });

  const r = await llamar(`/api/impresion/carga/${s.id}/previa`);
  assert.equal(r.estado, 200);
  const papel = r.json.datos.renglones.map((x) => x.t).join('\n');

  assert.match(papel, /CARGA/);
  assert.match(papel, /Juan Pech/);
  assert.match(papel, /SUELTO/);
  assert.match(papel, /La camioneta blanca/);
  assert.ok(!/\$/.test(papel),
    'en el patio, con el camión abierto, un renglón de dinero estorba');
});

test('la liquidación lleva las dos cuentas y el resultado en grande', async () => {
  const p = await pedido(tienda.id, [{ productoId: bolsa.id, cantidad: 10 }]);
  const s = await salida({ pedidos: [p], carga: [{ dieciseisavos: 4 * 16 }] });
  await llamar(`/api/reparto/${s.id}/regreso`, { method: 'POST', cuerpo: {} });
  await llamar(`/api/reparto/${s.id}/pedidos/${p.id}/entregado`,
               { method: 'POST', cuerpo: { formaPago: 'efectivo' } });
  const linea = (await ver(s.id)).carga[0];
  await llamar(`/api/reparto/${s.id}/carga/${linea.id}/regreso`, {
    method: 'POST', cuerpo: { vendidoDieciseisavos: 0, regresoDieciseisavos: 48 }
  });
  await llamar(`/api/reparto/${s.id}/recibir`, { method: 'POST', cuerpo: { efectivo: '200' } });

  const papel = (await llamar(`/api/impresion/liquidacion/${s.id}/previa`))
    .json.datos.renglones.map((x) => x.t).join('\n');

  assert.match(papel, /LIQUIDACION/);
  assert.match(papel, /SE DERRITIO/);
  assert.match(papel, /DEBIA TRAER/);
  assert.match(papel, /CUADRO/);
  assert.match(papel, /ENTREGO:/, 'la firma va debajo de la cuenta del dinero');
});

test('la liquidación separa lo que NO viene en efectivo', async () => {
  const fiado = await pedido(otra.id, [{ productoId: bolsa.id, cantidad: 5 }], 'credito');
  const s = await salida({ pedidos: [fiado] });
  await llamar(`/api/reparto/${s.id}/regreso`, { method: 'POST', cuerpo: {} });
  await llamar(`/api/reparto/${s.id}/pedidos/${fiado.id}/entregado`,
               { method: 'POST', cuerpo: { formaPago: 'credito' } });
  await llamar(`/api/reparto/${s.id}/recibir`, { method: 'POST', cuerpo: { efectivo: '0' } });

  const papel = (await llamar(`/api/impresion/liquidacion/${s.id}/previa`))
    .json.datos.renglones.map((x) => x.t).join('\n');
  assert.match(papel, /No viene en efectivo/);
  assert.match(papel, /A credito/);
});

// ============================================================
// LA LISTA DE LA CAJA
// ============================================================

test('las que esperan dinero salen en su propia lista', async () => {
  const p = await pedido(tienda.id, [{ productoId: bolsa.id, cantidad: 1 }]);
  const s = await salida({ pedidos: [p] });
  await llamar(`/api/reparto/${s.id}/regreso`, { method: 'POST', cuerpo: {} });

  const esperando = (await llamar('/api/reparto/por-recibir')).json.datos.salidas;
  assert.ok(esperando.some((x) => x.id === s.id));

  await llamar(`/api/reparto/${s.id}/pedidos/${p.id}/entregado`,
               { method: 'POST', cuerpo: { formaPago: 'efectivo' } });
  await llamar(`/api/reparto/${s.id}/recibir`, { method: 'POST', cuerpo: { efectivo: '20' } });

  const despues = (await llamar('/api/reparto/por-recibir')).json.datos.salidas;
  assert.ok(!despues.some((x) => x.id === s.id), 'ya le entregaron: sale de la lista');
});

test('cancelar una salida devuelve sus pedidos a la lista', async () => {
  const p = await pedido(tienda.id, [{ productoId: bolsa.id, cantidad: 2 }]);
  const s = await salida({ pedidos: [p], sacar: false });

  const r = await llamar(`/api/reparto/${s.id}/cancelar`, {
    method: 'POST', cuerpo: { motivo: 'Se descompuso la camioneta' }
  });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.salida.estado, 'cancelada');
  assert.equal(r.json.datos.salida.pedidos.length, 0);

  const pendientes = (await llamar('/api/pedidos')).json.datos.pedidos;
  assert.ok(pendientes.some((x) => x.id === p.id),
    'un pedido no se pierde porque el viaje no salió');
});
