/**
 * EL PRECIO POR VOLUMEN Y LA CASCADA DE PRECIOS  (v7.1)
 *
 * "Hay mayoreo en algunos productos por cantidad —yo lo activo y decido
 *  cuál es esa cantidad— y precios especiales por clientes: cada cliente
 *  puede llegar a tener un precio diferente."
 *
 * Son dos cosas distintas y aquí se comprueba que no se pisan:
 *
 *   1. SU CONVENIO en ese producto              (cliente_precios, v6.9)
 *   2. EL PRECIO POR VOLUMEN, si se lleva bastante   ← lo que se prueba
 *   3. SU LISTA DE MAYOREO, para el hielo por fracción
 *   4. EL PRECIO DE MOSTRADOR
 *
 * Y lo de siempre: el precio se COPIA a la venta (regla 3.5), así que
 * cambiarlo mañana no toca un ticket de ayer.
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, bd, preparar } = fabricaDePrueba('volumen');

let categoria, bolsa, cliente;

preparar(async () => {
  categoria = (await llamar('/api/catalogo/categorias', {
    method: 'POST', cuerpo: { nombre: 'Reparto' } })).json.datos.categoria;

  bolsa = (await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: 'Bolsa de 5 kg', categoriaId: categoria.id, tipo: 'simple',
              precio: 20, costo: 12, codigo: 'B5' } })).json.datos.producto;

  cliente = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Mariscos El Faro' } })).json.datos.cliente;
});

/** Cobra `cuantas` bolsas y devuelve el total en centavos. */
async function cobrar(cuantas, clienteId = null) {
  const r = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: {
      lineas: [{ productoId: bolsa.id, cantidad: cuantas }],
      formaPago: 'efectivo', pago: 100000,
      ...(clienteId ? { clienteId } : {})
    }
  });
  assert.equal(r.estado, 201, JSON.stringify(r.json));
  return r.json.datos.venta.total_centavos;
}

// ============================================================
// ENCENDERLO Y APAGARLO
// ============================================================

test('sin precio por volumen, todas las piezas valen lo mismo', async () => {
  assert.equal(await cobrar(1), 2000);
  assert.equal(await cobrar(60), 120000, '60 × $20');
});

test('los dos datos van juntos: uno solo no enciende nada', async () => {
  // Solo el "a partir de": no dice a cómo, así que no aplica nada.
  let r = await llamar(`/api/catalogo/productos/${bolsa.id}`, {
    method: 'PUT', cuerpo: { mayoreoDesde: '50' } });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.producto.mayoreo_desde, null);
  assert.equal(r.json.datos.producto.mayoreo_centavos, null);

  // Solo el precio: no dice desde cuántas.
  r = await llamar(`/api/catalogo/productos/${bolsa.id}`, {
    method: 'PUT', cuerpo: { mayoreoPrecio: '16.50' } });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.producto.mayoreo_desde, null);
  assert.equal(r.json.datos.producto.mayoreo_centavos, null);
});

test('con los dos, de esa cantidad para arriba baja el precio', async () => {
  const r = await llamar(`/api/catalogo/productos/${bolsa.id}`, {
    method: 'PUT', cuerpo: { mayoreoDesde: '50', mayoreoPrecio: '16.50' } });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.producto.mayoreo_desde, 50);
  assert.equal(r.json.datos.producto.mayoreo_centavos, 1650);

  assert.equal(await cobrar(49), 98000, '49 todavía a $20');
  assert.equal(await cobrar(50), 82500, '50 justas ya son a $16.50');
  assert.equal(await cobrar(80), 132000, 'y de ahí para arriba también');
});

test('le toca a quien sea, tenga trato o no', async () => {
  // No es un trato con nadie: es cuánto vale comprar mucho.
  assert.equal(await cobrar(50, cliente.id), 82500);
});

test('se apaga vaciando los dos', async () => {
  const r = await llamar(`/api/catalogo/productos/${bolsa.id}`, {
    method: 'PUT', cuerpo: { mayoreoDesde: '', mayoreoPrecio: '' } });
  assert.equal(r.json.datos.producto.mayoreo_desde, null);
  assert.equal(await cobrar(50), 100000, 'de vuelta a $20');

  // Se vuelve a encender para las pruebas que siguen.
  await llamar(`/api/catalogo/productos/${bolsa.id}`, {
    method: 'PUT', cuerpo: { mayoreoDesde: '50', mayoreoPrecio: '16.50' } });
});

// ============================================================
// LO QUE NO SE DEJA CAPTURAR
// ============================================================

test('un mayoreo más caro que el mostrador es un dedazo y se frena', async () => {
  const r = await llamar(`/api/catalogo/productos/${bolsa.id}`, {
    method: 'PUT', cuerpo: { mayoreoDesde: '50', mayoreoPrecio: '25' } });
  assert.equal(r.estado, 400);
  assert.match(r.json.error, /menor que el de mostrador/i);
});

test('el mayoreo empieza desde 2 piezas: "desde 1" no es mayoreo', async () => {
  const r = await llamar(`/api/catalogo/productos/${bolsa.id}`, {
    method: 'PUT', cuerpo: { mayoreoDesde: '1', mayoreoPrecio: '16' } });
  assert.equal(r.estado, 400);
  assert.match(r.json.error, /2 piezas/i);
});

test('el hielo por fracción no lleva precio por volumen', async () => {
  // Ahí el volumen ya está en el propio botón —una marqueta entera ES el
  // mayoreo— y su precio sale de la lista, no de esta columna. Guardarlo
  // aquí sería un segundo lugar donde cambiarlo.
  const marqueta = bd.prepare("SELECT * FROM productos WHERE codigo = '1'").get();
  const r = await llamar(`/api/catalogo/productos/${marqueta.id}`, {
    method: 'PUT', cuerpo: { mayoreoDesde: '10', mayoreoPrecio: '200' } });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.producto.mayoreo_desde, null);
});

// ============================================================
// LA CASCADA: QUIÉN LE GANA A QUIÉN
// ============================================================

test('el convenio del cliente le gana al precio por volumen', async () => {
  // El producto está en "de 50 para arriba a $16.50". A El Faro se le dejó
  // en $15 la pieza, lleve una o lleve cien: es SU precio.
  const r = await llamar(`/api/clientes/${cliente.id}/precios`, {
    method: 'PUT', cuerpo: { productoId: bolsa.id, precio: 15 } });
  assert.equal(r.estado, 200);

  assert.equal(await cobrar(1, cliente.id), 1500, 'una sola, a su precio');
  assert.equal(await cobrar(50, cliente.id), 75000,
    'cincuenta también: su convenio le gana al $16.50 del volumen');

  // Y al que no tiene convenio le sigue tocando el precio por volumen.
  assert.equal(await cobrar(50), 82500);
});

test('el precio queda copiado en la venta: subirlo después no la toca', async () => {
  const antes = bd.prepare(
    'SELECT * FROM venta_lineas ORDER BY rowid DESC LIMIT 1').get();

  await llamar(`/api/catalogo/productos/${bolsa.id}`, {
    method: 'PUT', cuerpo: { precio: 30, mayoreoDesde: '50', mayoreoPrecio: '25' } });

  const despues = bd.prepare(
    'SELECT * FROM venta_lineas WHERE id = ?').get(antes.id);
  assert.equal(despues.centavos, antes.centavos, 'el ticket de ayer no cambió');

  // Se deja como estaba para lo que sigue.
  await llamar(`/api/catalogo/productos/${bolsa.id}`, {
    method: 'PUT', cuerpo: { precio: 20, mayoreoDesde: '50', mayoreoPrecio: '16.50' } });
});

// ============================================================
// LO QUE VE LA PANTALLA
// ============================================================

test('el catálogo dice a cuántos clientes se les dejó precio propio', async () => {
  const { json } = await llamar('/api/catalogo');
  const b = json.datos.productos.find((p) => p.id === bolsa.id);
  assert.equal(b.convenios, 1, 'El Faro');

  const otro = json.datos.productos.find((p) => p.codigo === '1');
  assert.equal(otro.convenios, 0);
});

test('el resumen del catálogo cuenta lo que hay, no lo que se guardó', async () => {
  const { json } = await llamar('/api/catalogo');
  const r = json.datos.resumen;
  assert.ok(r, 'viene el resumen');
  assert.equal(r.conMayoreo, 1, 'solo la bolsa tiene precio por volumen');
  assert.equal(typeof r.productos, 'number');
  assert.equal(typeof r.deBaja, 'number');
  assert.equal(typeof r.porPedir, 'number');
  assert.ok(r.margen > 0, 'la bolsa tiene costo capturado');
});

// ============================================================
// EL HISTORIAL Y LA COPIA
// ============================================================

test('el historial de precios sale de la bitácora, no de una tabla aparte', async () => {
  const { estado, json } = await llamar(`/api/catalogo/productos/${bolsa.id}/historial`);
  assert.equal(estado, 200);
  assert.ok(json.datos.cambios.length >= 1, 'ya se le movió el precio varias veces');

  const conMostrador = json.datos.cambios.find((c) => c.antes !== c.despues);
  assert.ok(conMostrador, 'y se ve de cuánto a cuánto');
  assert.ok(conMostrador.quien, 'y quién lo movió');

  const conVolumen = json.datos.cambios.find((c) => c.mayoreoDespues !== null);
  assert.ok(conVolumen, 'los cambios del precio por volumen también');
  assert.equal(conVolumen.desde, 50);

  // NO hay tabla de historial: si la hubiera, sería una segunda copia de
  // la misma verdad y un día dirían cosas distintas.
  const tabla = bd.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%historial%'").get();
  assert.equal(tabla, undefined);
});

test('duplicar copia todo menos el código, que es único', async () => {
  const r = await llamar(`/api/catalogo/productos/${bolsa.id}/duplicar`,
                         { method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 201);
  const copia = r.json.datos.producto;

  assert.equal(copia.nombre, 'Bolsa de 5 kg (copia)');
  assert.equal(copia.codigo, null, 'sin código: se teclea y no puede repetirse');
  assert.equal(copia.precio_centavos, 2000);
  assert.equal(copia.costo_centavos, 1200);
  assert.equal(copia.mayoreo_desde, 50);
  assert.equal(copia.mayoreo_centavos, 1650);
  assert.equal(copia.categoria_id, categoria.id);
  assert.notEqual(copia.id, bolsa.id, 'es otro producto, no el mismo');

  // La copia nace sin los convenios del original: un trato es con un
  // cliente sobre un producto concreto, no sobre "algo parecido".
  const { json } = await llamar('/api/catalogo');
  assert.equal(json.datos.productos.find((p) => p.id === copia.id).convenios, 0);
});

// ============================================================
// QUIÉN PUEDE
// ============================================================

test('el cajero no pone precios por volumen ni ve el historial', async () => {
  await entrarAdmin();
  await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Mari', rol: 'cajero', pin: '7777' } });
  const lista = (await llamar('/api/auth/usuarios-disponibles')).json.datos.usuarios;
  const mari = lista.find((u) => u.nombre === 'Mari');
  await llamar('/api/auth/entrar-pin', {
    method: 'POST', cuerpo: { usuarioId: mari.id, pin: '7777' } });

  const puesto = await llamar(`/api/catalogo/productos/${bolsa.id}`, {
    method: 'PUT', cuerpo: { mayoreoDesde: '10', mayoreoPrecio: '5' } });
  assert.equal(puesto.estado, 403);

  const hist = await llamar(`/api/catalogo/productos/${bolsa.id}/historial`);
  assert.equal(hist.estado, 403);

  const copia = await llamar(`/api/catalogo/productos/${bolsa.id}/duplicar`,
                             { method: 'POST', cuerpo: {} });
  assert.equal(copia.estado, 403);
});
