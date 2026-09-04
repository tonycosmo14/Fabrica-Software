/**
 * PRUEBAS DE LAS NEVERAS EN COMODATO  (v5.1)
 *
 * Lo que se prueba es lo que decide el diseño:
 *
 *  · que LA NEVERA Y EL PRÉSTAMO sean dos cosas — que una nevera pueda
 *    pasar por dos clientes sin perder su historia
 *  · que "¿ya se pagó?" cuente lo que hay que contar: las bolsas de ESE
 *    cliente y en ESAS fechas, menos el costo, los mantenimientos y lo
 *    regalado
 *  · que el estado se acomode solo, para que nunca haya dos verdades
 *    sobre dónde está una nevera
 *  · que el aviso de "no ha pedido" use los días de cada cliente
 *  · que el contrato salga relleno y diga qué le falta
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, entrarPorNombre, bd, preparar } = fabricaDePrueba('neveras');

const calculo = require('../src/modulos/neveras/calculo');
const documento = require('../src/modulos/neveras/documento');

let cliente;      // Don Chuy, el de siempre
let otro;         // la tienda de la esquina
let bolsa;        // el producto que cuenta para la nevera

preparar(async () => {
  cliente = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Don Chuy', telefono: '9991234567' }
  })).json.datos.cliente;

  otro = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Tienda La Esquina' }
  })).json.datos.cliente;

  bolsa = bd.prepare("SELECT * FROM productos WHERE para_nevera = 1 LIMIT 1").get();
});

const nueva = async (cuerpo) => (await llamar('/api/neveras', {
  method: 'POST', cuerpo: { numero: '1', costo: 8000, bolsas: 60, ...cuerpo }
})).json.datos.nevera;

const traer = async (id) => (await llamar(`/api/neveras/${id}`)).json.datos.nevera;

/** Un cliente nuevo para cada prueba: si se comparten, las ventas de una
 *  se le cuentan a la nevera de la siguiente. */
let cuantos = 0;
const clienteNuevo = async (nombre = null) => (await llamar('/api/clientes', {
  method: 'POST', cuerpo: { nombre: nombre || `Cliente ${++cuantos}`, telefono: '9990000000' }
})).json.datos.cliente;

/** Le vende bolsas a un cliente, que es lo que cuenta para su nevera. */
function venderBolsas(clienteId, cuantas, centavos, fecha = null) {
  const { nuevoId, ahora } = require('../src/lib/ids');
  const ventaId = nuevoId();
  bd.prepare(`
    INSERT INTO ventas (id, folio, fecha, total_centavos, forma_pago, cliente_id,
                        cajero_id, capturista_id)
    VALUES (?, (SELECT COALESCE(MAX(folio), 0) + 1 FROM ventas), ?, ?, 'efectivo', ?,
            (SELECT id FROM usuarios LIMIT 1), (SELECT id FROM usuarios LIMIT 1))
  `).run(ventaId, fecha || ahora(), centavos, clienteId);

  bd.prepare(`
    INSERT INTO venta_lineas (id, venta_id, concepto, dieciseisavos, precio_centavos,
                              producto_id, cantidad)
    VALUES (?, ?, 'Bolsa', 0, ?, ?, ?)
  `).run(nuevoId(), ventaId, centavos, bolsa.id, cuantas);
  return ventaId;
}

// ============================================================
// 1 · LA NEVERA Y EL PRÉSTAMO SON DOS COSAS
// ============================================================

test('el número no se puede repetir: es como se le llama a la nevera', async () => {
  await entrarAdmin();
  await nueva({ numero: '7' });

  const r = await llamar('/api/neveras', { method: 'POST', cuerpo: { numero: '7' } });
  assert.equal(r.estado, 400);
  assert.match(r.json.error, /Ya hay una nevera con el número 7/);
});

test('UNA NEVERA PASA POR DOS CLIENTES Y NO PIERDE SU HISTORIA', async () => {
  await entrarAdmin();
  const n = await nueva({ numero: '10' });

  // Con Don Chuy, y le compra.
  await llamar(`/api/neveras/${n.id}/entregar`, {
    method: 'POST', cuerpo: { tipo: 'cliente', clienteId: cliente.id, direccion: 'Calle 20' }
  });
  venderBolsas(cliente.id, 10, 50000);

  let ficha = await traer(n.id);
  assert.equal(ficha.estado, 'prestada', 'el estado se acomoda solo al entregarla');
  assert.equal(ficha.comodato.quien, 'Don Chuy');
  assert.equal(ficha.cuenta.vendido.centavos, 50000);

  // Se recoge y se le da a la tienda de la esquina.
  await llamar(`/api/neveras/comodatos/${ficha.comodato.id}/devolver`, {
    method: 'POST', cuerpo: { motivo: 'cerró el negocio' }
  });
  ficha = await traer(n.id);
  assert.equal(ficha.estado, 'bodega', 'al devolverla vuelve a bodega sola');
  assert.equal(ficha.comodato, null);

  await llamar(`/api/neveras/${n.id}/entregar`, {
    method: 'POST', cuerpo: { tipo: 'cliente', clienteId: otro.id }
  });
  venderBolsas(otro.id, 4, 20000);

  ficha = await traer(n.id);
  assert.equal(ficha.comodato.quien, 'Tienda La Esquina', 'ahora es de la tienda');
  assert.equal(ficha.comodatos.length, 2, 'y guarda por cuántas manos ha pasado');
  assert.equal(ficha.cuenta.vendido.centavos, 70000,
    'la nevera acumula lo de los DOS clientes: es la misma nevera');
  assert.equal(ficha.comodatos[1].motivo_retiro, 'cerró el negocio',
    'y por qué se recogió del anterior');
});

test('una nevera prestada no se puede volver a prestar', async () => {
  await entrarAdmin();
  const n = await nueva({ numero: '11' });
  await llamar(`/api/neveras/${n.id}/entregar`, {
    method: 'POST', cuerpo: { tipo: 'cliente', clienteId: cliente.id } });

  const r = await llamar(`/api/neveras/${n.id}/entregar`, {
    method: 'POST', cuerpo: { tipo: 'cliente', clienteId: otro.id } });
  assert.equal(r.estado, 400);
  assert.match(r.json.error, /ya está prestada/);
});

test('y tampoco se puede decir que está en bodega mientras esté prestada', async () => {
  await entrarAdmin();
  const n = await nueva({ numero: '12' });
  await llamar(`/api/neveras/${n.id}/entregar`, {
    method: 'POST', cuerpo: { tipo: 'cliente', clienteId: cliente.id } });

  const r = await llamar(`/api/neveras/${n.id}/estado`, {
    method: 'PUT', cuerpo: { estado: 'bodega' } });
  assert.equal(r.estado, 400, 'serían dos verdades sobre la misma nevera');
});

test('una feria se presta a un nombre suelto, sin dar de alta un cliente', async () => {
  await entrarAdmin();
  const n = await nueva({ numero: '13' });

  const r = await llamar(`/api/neveras/${n.id}/entregar`, {
    method: 'POST',
    cuerpo: { tipo: 'evento', nombre: 'Feria de Hunucmá', hastaPrevisto: '2020-01-05' }
  });
  assert.equal(r.estado, 201);

  const ficha = await traer(n.id);
  assert.equal(ficha.comodato.quien, 'Feria de Hunucmá');
  assert.equal(ficha.comodato.cliente_id, null, 'sin ensuciar el catálogo de clientes');
  assert.equal(ficha.cuenta.vendido.centavos, 0,
    'un nombre suelto no tiene ventas atadas, y eso es la verdad');

  // Esa fecha ya pasó: tiene que salir en el tablero de lo que hay que hacer.
  const lista = (await llamar('/api/neveras')).json.datos;
  assert.ok(lista.pendientes.vencidas.some((x) => x.id === n.id),
    'una prestada que se pasó de la fecha sale como vencida');
});

test('la que la usa la fábrica queda «en uso», no «prestada»', async () => {
  await entrarAdmin();
  const n = await nueva({ numero: '14' });
  await llamar(`/api/neveras/${n.id}/entregar`, {
    method: 'POST', cuerpo: { tipo: 'fabrica' } });

  assert.equal((await traer(n.id)).estado, 'en_uso');
});

// ============================================================
// 2 · ¿YA SE PAGÓ?
// ============================================================

test('LA CUENTA: ventas menos costo, menos reparaciones, menos lo regalado', async () => {
  await entrarAdmin();
  const suyo = await clienteNuevo();
  const n = await nueva({ numero: '20', costo: 8000 });     // $8,000
  await llamar(`/api/neveras/${n.id}/entregar`, {
    method: 'POST', cuerpo: { tipo: 'cliente', clienteId: suyo.id } });

  venderBolsas(suyo.id, 200, 1000000);                      // $10,000 vendidos

  let f = await traer(n.id);
  assert.equal(f.cuenta.aFavor, 1000000 - 800000, 'vendido menos costo');
  assert.equal(f.cuenta.sePago, true);

  // Una reparación de $1,500 resta.
  await llamar(`/api/neveras/${n.id}/servicios`, {
    method: 'POST', cuerpo: { queTiene: 'No enfría', tipo: 'falla' } });
  f = await traer(n.id);
  await llamar(`/api/neveras/servicios/${f.pendientes[0].id}/atender`, {
    method: 'POST', cuerpo: { queSeHizo: 'Se cambió el termostato', costo: 1500 } });

  f = await traer(n.id);
  assert.equal(f.cuenta.mantenimiento.centavos, 150000);
  assert.equal(f.cuenta.aFavor, 1000000 - 800000 - 150000);

  // Y las bolsas regaladas también.
  await llamar(`/api/neveras/${n.id}/cortesias`, {
    method: 'POST', cuerpo: { cuantas: 20, motivo: 'cortesia', valor: 400 } });

  f = await traer(n.id);
  assert.equal(f.cuenta.cortesias.piezas, 20);
  assert.equal(f.cuenta.aFavor, 1000000 - 800000 - 150000 - 40000,
    'sin restar lo regalado, la nevera del cliente consentido sale la mejor');
});

test('sin costo capturado se dice que falta el dato, no que salió gratis', async () => {
  await entrarAdmin();
  const n = await nueva({ numero: '21', costo: '' });
  const f = await traer(n.id);

  assert.equal(f.cuenta.sinCosto, true);
  assert.equal(f.cuenta.costoCentavos, 0);
});

test('solo cuentan las bolsas, y solo las de las fechas de ESE préstamo', async () => {
  await entrarAdmin();

  // El cliente compró ANTES de que existiera la nevera.
  venderBolsas(otro.id, 50, 300000, '2020-01-01T10:00:00');

  const n = await nueva({ numero: '22', costo: 5000 });
  await llamar(`/api/neveras/${n.id}/entregar`, {
    method: 'POST', cuerpo: { tipo: 'cliente', clienteId: otro.id } });

  const antes = (await traer(n.id)).cuenta.vendido.centavos;
  venderBolsas(otro.id, 10, 60000);
  const despues = (await traer(n.id)).cuenta.vendido.centavos;

  assert.equal(despues - antes, 60000, 'solo suma lo de después de entregarla');

  // Y una marqueta que ese mismo cliente compró no es de la nevera.
  const { nuevoId, ahora } = require('../src/lib/ids');
  const v = nuevoId();
  bd.prepare(`
    INSERT INTO ventas (id, folio, fecha, total_centavos, forma_pago, cliente_id,
                        cajero_id, capturista_id)
    VALUES (?, 9999, ?, 26400, 'efectivo', ?, (SELECT id FROM usuarios LIMIT 1),
            (SELECT id FROM usuarios LIMIT 1))
  `).run(v, ahora(), otro.id);
  bd.prepare(`
    INSERT INTO venta_lineas (id, venta_id, concepto, dieciseisavos, precio_centavos, cantidad)
    VALUES (?, ?, 'Hielo', 16, 26400, 1)
  `).run(nuevoId(), v);

  assert.equal((await traer(n.id)).cuenta.vendido.centavos, despues,
    'una marqueta no la pagó la nevera');
});

// ============================================================
// 3 · FALLAS
// ============================================================

test('reportar una falla deja la nevera marcada, y atenderla la libera', async () => {
  await entrarAdmin();
  const n = await nueva({ numero: '30' });
  await llamar(`/api/neveras/${n.id}/entregar`, {
    method: 'POST', cuerpo: { tipo: 'cliente', clienteId: cliente.id } });

  await llamar(`/api/neveras/${n.id}/servicios`, {
    method: 'POST', cuerpo: { queTiene: 'Hace ruido', quienReporto: 'Don Chuy' } });

  let f = await traer(n.id);
  assert.equal(f.estado, 'reparacion', 'nadie la va a dar por buena sin querer');
  assert.equal(f.pendientes.length, 1);
  assert.equal(f.pendientes[0].quien_reporto, 'Don Chuy');

  await llamar(`/api/neveras/servicios/${f.pendientes[0].id}/atender`, {
    method: 'POST', cuerpo: { queSeHizo: 'Se apretó el compresor', quienLoHizo: 'Luis' } });

  f = await traer(n.id);
  assert.equal(f.pendientes.length, 0);
  assert.equal(f.estado, 'prestada',
    'sin nada pendiente vuelve a donde le toca por sus papeles');
  assert.equal(f.servicios[0].que_se_hizo, 'Se apretó el compresor');
});

test('un preventivo NO marca la nevera: sigue trabajando', async () => {
  await entrarAdmin();
  const n = await nueva({ numero: '31' });
  await llamar(`/api/neveras/${n.id}/entregar`, {
    method: 'POST', cuerpo: { tipo: 'cliente', clienteId: cliente.id } });

  await llamar(`/api/neveras/${n.id}/servicios`, {
    method: 'POST', cuerpo: { queTiene: 'Limpieza de rutina', tipo: 'limpieza' } });

  assert.equal((await traer(n.id)).estado, 'prestada');
});

test('el cajero puede reportar una falla, pero no prestar la nevera', async () => {
  await entrarAdmin();
  const n = await nueva({ numero: '32' });
  await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Rosa Canul', rol: 'cajero', pin: '4477' } });

  await entrarPorNombre('Rosa Canul', '4477');
  assert.equal((await llamar('/api/neveras')).estado, 200, 'las ve');
  assert.equal((await llamar(`/api/neveras/${n.id}/servicios`, {
    method: 'POST', cuerpo: { queTiene: 'No enfría' } })).estado, 201,
    'y puede anotar lo que el cliente reporta en el mostrador');

  assert.equal((await llamar(`/api/neveras/${n.id}/entregar`, {
    method: 'POST', cuerpo: { tipo: 'cliente', clienteId: cliente.id } })).estado, 403,
    'prestar una nevera es firmar un contrato: no es de turno');
  assert.equal((await llamar(`/api/neveras/${n.id}/baja`, {
    method: 'POST', cuerpo: { motivo: 'x' } })).estado, 403);

  await entrarAdmin();
});

// ============================================================
// 4 · EL AVISO DE "NO HA PEDIDO"
// ============================================================

test('los días para avisar son los de CADA cliente, no uno para todos', async () => {
  await entrarAdmin();
  const lento = await nueva({ numero: '40' });
  const rapido = await nueva({ numero: '41' });
  const clienteLento = await clienteNuevo('El Lento');
  const clienteRapido = await clienteNuevo('El Rapido');

  // A los dos se les entregó hace 30 días y ninguno ha pedido nunca.
  const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  await llamar(`/api/neveras/${lento.id}/entregar`, {
    method: 'POST',
    cuerpo: { tipo: 'cliente', clienteId: clienteLento.id, desde: hace30, diasAviso: 60 } });
  await llamar(`/api/neveras/${rapido.id}/entregar`, {
    method: 'POST',
    cuerpo: { tipo: 'cliente', clienteId: clienteRapido.id, desde: hace30, diasAviso: 7 } });

  const f1 = await traer(lento.id);
  const f2 = await traer(rapido.id);

  assert.equal(f1.ritmo.limite, 60);
  assert.equal(f2.ritmo.limite, 7);
  assert.equal(f1.ritmo.dias, 30, 'cuenta desde que se le entregó');
  assert.equal(f1.ritmo.seTardo, false, 'a 30 días, el lento todavía va bien');
  assert.equal(f2.ritmo.seTardo, true, 'el mismo tiempo, y el rápido ya se pasó');
  assert.equal(f2.ritmo.nuncaPidio, true);

  // Y el de los siete días sale en el tablero; el de sesenta, no.
  const p = (await llamar('/api/neveras')).json.datos.pendientes;
  assert.ok(p.sinPedir.some((x) => x.id === rapido.id));
  assert.ok(!p.sinPedir.some((x) => x.id === lento.id));
});

test('sin días propios se usa el general', async () => {
  await entrarAdmin();
  const n = await nueva({ numero: '42' });
  const suyo = await clienteNuevo();
  await llamar(`/api/neveras/${n.id}/entregar`, {
    method: 'POST', cuerpo: { tipo: 'cliente', clienteId: suyo.id } });

  assert.equal((await traer(n.id)).ritmo.limite, calculo.diasAvisoGeneral());

  await llamar('/api/neveras/ajustes', { method: 'PUT', cuerpo: { diasAviso: 5 } });
  assert.equal((await traer(n.id)).ritmo.limite, 5);
  await llamar('/api/neveras/ajustes', { method: 'PUT', cuerpo: { diasAviso: 21 } });
});

// ============================================================
// 5 · EL CONTRATO
// ============================================================

test('el contrato sale relleno con el cliente y la nevera', async () => {
  await entrarAdmin();
  const n = await nueva({ numero: '50', costo: 12000 });
  await llamar(`/api/neveras/${n.id}/entregar`, {
    method: 'POST',
    cuerpo: { tipo: 'cliente', clienteId: cliente.id, direccion: 'Calle 20 x 15',
              responsable: 'Jesús Pech' }
  });

  const f = await traer(n.id);
  const r = await llamar(`/api/neveras/comodatos/${f.comodato.id}/contrato`);
  assert.equal(r.estado, 200);

  const html = r.json.datos.html;
  assert.match(html, /CONTRATO DE COMODATO/);
  assert.match(html, /Don Chuy/, 'el cliente');
  assert.match(html, /Jesús Pech|Jes&#/, 'quien firma');
  assert.match(html, /Calle 20 x 15/, 'dónde queda');
  assert.match(html, /\$12,000/, 'el valor del bien, que es lo que se reclama');
  assert.match(html, /size: letter/, 'en hoja carta');

  // Los comentarios para quien edita la plantilla no salen impresos.
  assert.ok(!html.includes('Ésta es la cláusula'), 'las notas no son parte del contrato');
});

test('el contrato dice QUÉ LE FALTA antes de imprimirlo', async () => {
  await entrarAdmin();
  const n = await nueva({ numero: '51' });
  await llamar(`/api/neveras/${n.id}/entregar`, {
    method: 'POST', cuerpo: { tipo: 'cliente', clienteId: otro.id } });

  const f = await traer(n.id);
  const r = await llamar(`/api/neveras/comodatos/${f.comodato.id}/contrato`);

  // Sin representante ni domicilio del negocio capturados, hay que
  // saberlo ANTES: con el cliente enfrente y la pluma en la mano es tarde.
  assert.ok(r.json.datos.faltan.includes('representante'));
  assert.ok(r.json.datos.faltan.includes('domicilio_negocio'));
  assert.match(r.json.datos.html, /_{8,}/, 'y salen como raya para llenar a mano');
});

test('la plantilla se puede cambiar sin actualizar el programa', async () => {
  await entrarAdmin();
  await llamar('/api/neveras/contrato/plantilla', {
    method: 'PUT', cuerpo: { texto: 'MI CONTRATO\n\nPara {cliente}, nevera {nevera_numero}.' }
  });

  const n = await nueva({ numero: '52' });
  await llamar(`/api/neveras/${n.id}/entregar`, {
    method: 'POST', cuerpo: { tipo: 'cliente', clienteId: cliente.id } });
  const f = await traer(n.id);

  const html = (await llamar(`/api/neveras/comodatos/${f.comodato.id}/contrato`))
    .json.datos.html;
  assert.match(html, /MI CONTRATO/);
  assert.match(html, /Para Don Chuy, nevera 52/);

  // Y se puede volver a la de fábrica dejándola en blanco.
  await llamar('/api/neveras/contrato/plantilla', { method: 'PUT', cuerpo: { texto: '' } });
  assert.match(documento.texto(), /CONTRATO DE COMODATO/);
});

// ============================================================
// 6 · NADA SE BORRA
// ============================================================

test('dar de baja una nevera la deja con toda su historia', async () => {
  await entrarAdmin();
  const n = await nueva({ numero: '60', costo: 5000 });
  await llamar(`/api/neveras/${n.id}/entregar`, {
    method: 'POST', cuerpo: { tipo: 'cliente', clienteId: cliente.id } });
  venderBolsas(cliente.id, 5, 25000);

  const f = await traer(n.id);
  await llamar(`/api/neveras/comodatos/${f.comodato.id}/devolver`, {
    method: 'POST', cuerpo: { motivo: 'se acabó' } });
  await llamar(`/api/neveras/${n.id}/baja`, {
    method: 'POST', cuerpo: { motivo: 'ya no sirve, se vendió como fierro' } });

  const baja = await traer(n.id);
  assert.equal(baja.estado, 'baja');
  assert.equal(baja.motivo_baja, 'ya no sirve, se vendió como fierro');
  assert.equal(baja.comodatos.length, 1, 'su historia sigue entera');
  assert.ok(baja.cuenta.vendido.centavos > 0, 'y lo que ganó también');

  // Y de la lista normal desaparece, pero se puede pedir.
  const normal = (await llamar('/api/neveras')).json.datos.neveras;
  const conBaja = (await llamar('/api/neveras?baja=1')).json.datos.neveras;
  assert.ok(!normal.some((x) => x.id === n.id));
  assert.ok(conBaja.some((x) => x.id === n.id));
});

test('una nevera perdida se puede decir, y no es lo mismo que darla de baja', async () => {
  await entrarAdmin();
  const n = await nueva({ numero: '61' });
  await llamar(`/api/neveras/${n.id}/estado`, {
    method: 'PUT', cuerpo: { estado: 'perdida' } });

  const f = await traer(n.id);
  assert.equal(f.estado, 'perdida');

  const lista = (await llamar('/api/neveras')).json.datos;
  assert.ok(lista.pendientes.perdidas.some((x) => x.id === n.id),
    'sale en el tablero: es algo que hay que resolver, no un archivo muerto');
  assert.ok(lista.neveras.some((x) => x.id === n.id),
    'y sigue en la lista, a diferencia de una de baja');
});

test('una cortesía anulada deja de restar, pero se queda escrita', async () => {
  await entrarAdmin();
  const n = await nueva({ numero: '62', costo: 1000 });
  await llamar(`/api/neveras/${n.id}/cortesias`, {
    method: 'POST', cuerpo: { cuantas: 10, valor: 200 } });

  let f = await traer(n.id);
  assert.equal(f.cuenta.cortesias.centavos, 20000);
  const id = f.cortesias[0].id;

  await llamar(`/api/neveras/cortesias/${id}/anular`, { method: 'POST', cuerpo: {} });
  f = await traer(n.id);
  assert.equal(f.cuenta.cortesias.centavos, 0, 'deja de restar');
  assert.ok(bd.prepare('SELECT anulado_en FROM nevera_cortesias WHERE id = ?').get(id).anulado_en,
    'pero la fila sigue ahí con su marca (regla 3.4)');
});
