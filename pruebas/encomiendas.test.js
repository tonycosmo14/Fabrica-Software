/**
 * PRUEBAS DE LO ENCOMENDADO  (v4.5)
 *
 * "A veces algún cliente nos regresa un poco de hielo, pero no es que lo
 *  devuelva: quiere que se lo guardemos para que pase por él más tarde.
 *  Ese hielo ya está pagado, solo se guarda en el cuarto frío."
 *
 * Lo que se pidió es el papelito. Lo que hay que probar es lo de debajo:
 *
 *  · que el hielo encomendado NO aparezca como "sobra" al contar — la venta
 *    ya lo restó y la marqueta sigue ahí
 *  · que al entregarlo SÍ se reste, y no dos veces
 *  · que guardar y entregar el mismo día se cancele solo
 *  · que no cobre nada: la venta ya se hizo antes
 *  · que el papelito diga de quién es y cuánto
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, bd, preparar } = fabricaDePrueba('encomiendas');

let almacen;

preparar(async () => {
  almacen = (await llamar('/api/existencia')).json.datos.almacenes[0].almacen.id;
});

/** Cómo va el cuarto frío ahora mismo. */
async function estado() {
  const { almacenes } = (await llamar('/api/existencia')).json.datos;
  return almacenes[0];
}

/** Deja el cuarto frío en un número conocido y devuelve el estado. */
async function partirDe(marquetas) {
  await llamar('/api/existencia/conteos', {
    method: 'POST', cuerpo: { almacenId: almacen, dieciseisavos: marquetas * 16 }
  });
  return estado();
}

// ============================================================
// GUARDAR
// ============================================================

test('un encomendado necesita de quién es y cuánto', async () => {
  const sinNombre = await llamar('/api/encomiendas', {
    method: 'POST', cuerpo: { dieciseisavos: 16 }
  });
  assert.equal(sinNombre.estado, 400);
  assert.match(sinNombre.json.error, /de quién/i);

  const sinCuanto = await llamar('/api/encomiendas', {
    method: 'POST', cuerpo: { clienteNombre: 'Doña Mari' }
  });
  assert.equal(sinCuanto.estado, 400);
  assert.match(sinCuanto.json.error, /cuánto/i);
});

test('se le guarda hielo a alguien que ni siquiera está dado de alta', async () => {
  const r = await llamar('/api/encomiendas', {
    method: 'POST', cuerpo: { clienteNombre: 'Doña Mari de la esquina', dieciseisavos: 8 }
  });
  assert.equal(r.estado, 201);

  const e = r.json.datos.encomienda;
  assert.equal(e.cliente_nombre, 'Doña Mari de la esquina');
  assert.equal(e.cliente_id, null, 'no hace falta darlo de alta para media marqueta');
  assert.equal(e.dieciseisavos, 8);
  assert.equal(e.entregado_en, null);
});

test('NO cobra nada: la venta ya se hizo antes', async () => {
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 0 } })
    .catch(() => {});
  const antes = (await llamar('/api/caja')).json.datos.abierta;

  await llamar('/api/encomiendas', {
    method: 'POST', cuerpo: { clienteNombre: 'Otro', dieciseisavos: 16 }
  });

  const despues = (await llamar('/api/caja')).json.datos.abierta;
  assert.equal(despues.esperado, antes.esperado, 'ni un peso entró ni salió del cajón');
  assert.equal(despues.ventas.cobradas, antes.ventas.cobradas, 'y no es una venta');

  // Se deja limpio para las pruebas del cuadre.
  const ids = bd.prepare('SELECT id FROM encomiendas').all().map((x) => x.id);
  for (const id of ids) {
    await llamar(`/api/encomiendas/${id}/anular`, {
      method: 'POST', cuerpo: { motivo: 'Solo era para la prueba' } });
  }
});

// ============================================================
// EL CUADRE, QUE ES LO QUE IMPORTA
// ============================================================

test('el hielo encomendado NO sale como "sobra" al contar', async () => {
  await partirDe(40);

  // Se venden 3 marquetas. Una de ellas se queda guardada.
  await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 3 * 16 }], pago: 1000 } });
  await llamar('/api/encomiendas', {
    method: 'POST', cuerpo: { clienteNombre: 'Mario Cauich', dieciseisavos: 16 } });

  const e = await estado();
  assert.equal(e.vendido, 3 * 16, 'las tres se vendieron');
  assert.equal(e.guardado, 16, 'pero una se quedó');

  // FÍSICAMENTE quedan 38 en el cuarto: salieron dos, no tres.
  assert.equal(e.esperado, 38 * 16,
    'la marqueta encomendada sigue ahí y el sistema lo sabe');

  // Y al contarlas de verdad, cuadra.
  const conteo = await llamar('/api/existencia/conteos', {
    method: 'POST', cuerpo: { almacenId: almacen, dieciseisavos: 38 * 16 } });
  assert.equal(conteo.json.datos.resumen.faltante, 0,
    'sin esto saldría SOBRA 1 todos los días hasta que el cliente pasara');
});

test('cuando pasa por él, entonces sí se resta', async () => {
  const antes = await estado();
  const pendiente = (await llamar('/api/encomiendas')).json.datos.encomiendas[0];
  assert.ok(pendiente, 'la marqueta de Mario sigue guardada');

  const r = await llamar(`/api/encomiendas/${pendiente.id}/entregar`, { method: 'POST' });
  assert.equal(r.estado, 200);

  const despues = await estado();
  assert.equal(despues.esperado, antes.esperado - 16,
    'ahora sí salió del cuarto frío');
  assert.equal(despues.vendido, antes.vendido,
    'y no se vuelve a contar como venta: se vendió en su día');
});

test('nadie pasa dos veces por el mismo hielo', async () => {
  const e = (await llamar('/api/encomiendas?todas=1')).json.datos.encomiendas
    .find((x) => x.entregado_en);
  const r = await llamar(`/api/encomiendas/${e.id}/entregar`, { method: 'POST' });
  assert.equal(r.estado, 409);
  assert.match(r.json.error, /ya pasó/i);
});

test('guardar y entregar el mismo día se cancela solo en el cuadre', async () => {
  await partirDe(30);
  const antes = await estado();

  await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 500 } });
  const g = await llamar('/api/encomiendas', {
    method: 'POST', cuerpo: { clienteNombre: 'Vuelve al rato', dieciseisavos: 16 } });
  await llamar(`/api/encomiendas/${g.json.datos.encomienda.id}/entregar`, { method: 'POST' });

  const despues = await estado();
  assert.equal(despues.guardado, 16);
  assert.equal(despues.recogido, 16);
  assert.equal(despues.esperado, antes.esperado - 16,
    'se vendió una y se la llevó: el cuarto tiene una menos, ni más ni menos');
});

test('una encomienda anulada deja de contar en el cuadre', async () => {
  await partirDe(20);
  const antes = await estado();

  const g = await llamar('/api/encomiendas', {
    method: 'POST', cuerpo: { clienteNombre: 'Me equivoqué', dieciseisavos: 32 } });
  assert.equal((await estado()).esperado, antes.esperado + 32);

  const sinMotivo = await llamar(`/api/encomiendas/${g.json.datos.encomienda.id}/anular`,
    { method: 'POST', cuerpo: {} });
  assert.equal(sinMotivo.estado, 400, 'anular sin decir por qué, no');

  await llamar(`/api/encomiendas/${g.json.datos.encomienda.id}/anular`, {
    method: 'POST', cuerpo: { motivo: 'Se capturó dos veces' } });
  assert.equal((await estado()).esperado, antes.esperado);

  // No se borró: quedó marcada (regla 3.4).
  const fila = bd.prepare('SELECT * FROM encomiendas WHERE id = ?')
    .get(g.json.datos.encomienda.id);
  assert.ok(fila.anulado_en);
  assert.equal(fila.motivo_anulacion, 'Se capturó dos veces');
});

test('una entrega mal marcada se deshace y el hielo vuelve a estar guardado', async () => {
  await partirDe(25);
  const g = await llamar('/api/encomiendas', {
    method: 'POST', cuerpo: { clienteNombre: 'Toqué el renglón de al lado', dieciseisavos: 16 } });
  const id = g.json.datos.encomienda.id;
  const conGuardado = (await estado()).esperado;

  await llamar(`/api/encomiendas/${id}/entregar`, { method: 'POST' });
  assert.equal((await estado()).esperado, conGuardado - 16);

  const r = await llamar(`/api/encomiendas/${id}/deshacer-entrega`, { method: 'POST' });
  assert.equal(r.estado, 200);
  assert.equal((await estado()).esperado, conGuardado, 'el hielo nunca se fue');
});

// ============================================================
// EL PAPELITO
// ============================================================

test('el papelito dice de quién es, cuánto, y que ya está pagado', async () => {
  await entrarAdmin();
  const g = await llamar('/api/encomiendas', {
    method: 'POST', cuerpo: { clienteNombre: 'Abarrotes La Guadalupana', dieciseisavos: 24 } });

  const { renglones } = (await llamar(
    `/api/impresion/encomienda/${g.json.datos.encomienda.id}/previa`)).json.datos;
  const papel = renglones.map((r) => r.t).join('\n');

  assert.match(papel, /ENCOMENDADO/, 'la palabra que usa la fábrica');
  assert.match(papel, /1 1\/2/, 'cuánto, en grande');
  assert.match(papel, /Abarrotes La Guadalupana/, 'de quién es');
  assert.match(papel, /YA ESTA PAGADO/,
    'sin esto el papel se parece a un ticket y podrían cobrarlo otra vez');
  assert.match(papel, /ENTREGADO A/, 'y su raya para firmar al recogerlo');
});

test('a la palabra se le puede cambiar el nombre', async () => {
  const r = await llamar('/api/existencia/nombre-encomienda', {
    method: 'PUT', cuerpo: { nombre: 'Apartado' } });
  assert.equal(r.estado, 200);

  const g = await llamar('/api/encomiendas', {
    method: 'POST', cuerpo: { clienteNombre: 'Quien sea', dieciseisavos: 16 } });
  const { renglones } = (await llamar(
    `/api/impresion/encomienda/${g.json.datos.encomienda.id}/previa`)).json.datos;
  assert.match(renglones.map((x) => x.t).join('\n'), /APARTADO/);

  assert.equal((await llamar('/api/encomiendas')).json.datos.nombre, 'Apartado');
  await llamar('/api/existencia/nombre-encomienda', {
    method: 'PUT', cuerpo: { nombre: 'Encomendado' } });
});

// ============================================================
// EL CORTE
// ============================================================

test('el corte del hielo enseña lo guardado y lo recogido', async () => {
  await entrarAdmin();
  await partirDe(50);

  await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 2 * 16 }], pago: 1000 } });
  await llamar('/api/encomiendas', {
    method: 'POST', cuerpo: { clienteNombre: 'Se queda', dieciseisavos: 16 } });

  const caja = (await llamar('/api/caja')).json.datos.abierta.caja;
  await llamar('/api/existencia/conteos', {
    method: 'POST', cuerpo: { almacenId: almacen, dieciseisavos: 49 * 16, cajaId: caja.id } });
  const corte = (await llamar('/api/caja/cerrar', { method: 'POST', cuerpo: {} }))
    .json.datos.corte;

  assert.equal(corte.hielo.cuadre.guardado, 16);
  assert.equal(corte.hielo.cuadre.faltante, 0, 'cuadra, porque la marqueta sigue ahí');
});
