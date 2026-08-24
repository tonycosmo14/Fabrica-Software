/**
 * PRUEBAS DEL CATÁLOGO  (v0.10)
 *
 * Lo que se toca en la caja son datos, no código. Aquí se comprueba que:
 *
 *  · el código tecleado ("18" + enter) encuentra el producto
 *  · el precio del hielo sale de la lista, no del producto
 *  · un producto no se puede quedar sin precio ni sin cantidad
 *  · nada se borra, se da de baja, y los tickets viejos no cambian
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, bd, preparar } = fabricaDePrueba('cat');

let catRefrescos;


preparar(async () => {
  await llamar('/api/usuarios', { method: 'POST', cuerpo: { nombre: 'Rosa', rol: 'cajero', pin: '4444' } });
});

// ============================================================
// EL CATÁLOGO DE ARRANQUE
// ============================================================

test('la fábrica arranca con el hielo dado de alta', async () => {
  const { json } = await llamar('/api/catalogo');
  assert.equal(json.datos.categorias.length, 1);
  assert.equal(json.datos.categorias[0].nombre, 'Hielo');
  assert.equal(json.datos.productos.length, 5);

  const codigos = json.datos.productos.map((p) => p.codigo).sort();
  assert.deepEqual(codigos, ['1', '116', '12', '14', '18']);
});

/**
 * Esto es lo que hace rápida la caja: el cajero con práctica no busca el
 * botón del octavo, teclea 18 y da enter.
 */
test('el código tecleado agrega el producto correcto', async () => {
  const r = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ codigo: '18' }] }
  });
  assert.equal(r.estado, 201);

  const v = r.json.datos.venta;
  assert.equal(v.lineas[0].dieciseisavos, 2);      // 1/8
  assert.equal(v.total_centavos, 3600);
});

test('el precio del hielo sale de la lista, no del producto', async () => {
  // Se sube el precio del 1/8 y el botón tiene que cobrar el nuevo.
  await llamar('/api/ventas/precios/lista-normal', {
    method: 'PUT', cuerpo: { precios: [{ dieciseisavos: 2, pesos: 40 }] }
  });

  const r = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ codigo: '18' }] }
  });
  assert.equal(r.json.datos.venta.total_centavos, 4000);

  await llamar('/api/ventas/precios/lista-normal', {
    method: 'PUT', cuerpo: { precios: [{ dieciseisavos: 2, pesos: 36 }] }
  });
});

/**
 * Tres octavos por cantidad tienen que costar lo mismo que 3/8 de una vez.
 * Si no, el ticket diría "3/8" y cobraría otra cosa.
 */
test('la cantidad se cobra como la fracción total, no multiplicando', async () => {
  const porCantidad = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ codigo: '18', cantidad: 3 }] }
  });
  const deUnaVez = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 6 }] }
  });

  assert.equal(porCantidad.json.datos.venta.total_centavos, 10600);   // 1/4 + 1/8
  assert.equal(deUnaVez.json.datos.venta.total_centavos, 10600);
  assert.equal(porCantidad.json.datos.venta.lineas[0].dieciseisavos, 6);
});

// ============================================================
// ALTA DE PRODUCTOS QUE NO SON HIELO
// ============================================================

test('se da de alta una categoría y un refresco', async () => {
  const cat = await llamar('/api/catalogo/categorias', {
    method: 'POST', cuerpo: { nombre: 'Refrescos', color: '#c02a20' }
  });
  assert.equal(cat.estado, 201);
  catRefrescos = cat.json.datos.categoria.id;

  const prod = await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: 'Coca 600', categoriaId: catRefrescos, tipo: 'simple', precio: 25, codigo: 'coca' }
  });
  assert.equal(prod.estado, 201);
  assert.equal(prod.json.datos.producto.precio_centavos, 2500);
  assert.equal(prod.json.datos.producto.codigo, 'COCA', 'el código se guarda en mayúsculas');
});

test('un refresco se cobra a su precio y NO descuenta hielo', async () => {
  const r = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ codigo: 'COCA', cantidad: 2 }] }
  });
  const v = r.json.datos.venta;
  assert.equal(v.total_centavos, 5000);
  assert.equal(v.lineas[0].dieciseisavos, 0, 'un refresco no sale del cuarto frío');
});

test('se puede vender hielo y refresco en el mismo ticket', async () => {
  const r = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ dieciseisavos: 8 }, { codigo: 'COCA' }] }
  });
  const v = r.json.datos.venta;
  assert.equal(v.total_centavos, 13500 + 2500);
  assert.equal(v.lineas.length, 2);
});

// ============================================================
// LO QUE NO SE DEBE PODER HACER
// ============================================================

test('un producto de hielo sin cantidad, o uno normal sin precio, se rechaza', async () => {
  const sinCantidad = await llamar('/api/catalogo/productos', {
    method: 'POST', cuerpo: { nombre: 'Raro', categoriaId: catRefrescos, tipo: 'hielo' }
  });
  assert.equal(sinCantidad.estado, 400);

  const sinPrecio = await llamar('/api/catalogo/productos', {
    method: 'POST', cuerpo: { nombre: 'Raro', categoriaId: catRefrescos, tipo: 'simple' }
  });
  assert.equal(sinPrecio.estado, 400);

  const fraccionRara = await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: 'Un tercio', categoriaId: catRefrescos, tipo: 'hielo', dieciseisavos: 5 }
  });
  assert.equal(fraccionRara.estado, 400);
});

test('dos productos activos no pueden compartir código', async () => {
  const r = await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: 'Otra coca', categoriaId: catRefrescos, tipo: 'simple', precio: 30, codigo: 'coca' }
  });
  assert.equal(r.estado, 400);
  assert.match(r.json.error, /ya lo usa/i);
});

test('el código no admite espacios ni cosas que no se puedan teclear', async () => {
  const r = await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: 'Malo', categoriaId: catRefrescos, tipo: 'simple', precio: 10, codigo: 'a b' }
  });
  assert.equal(r.estado, 400);
});

test('dos categorías activas no pueden llamarse igual', async () => {
  const r = await llamar('/api/catalogo/categorias', {
    method: 'POST', cuerpo: { nombre: 'Refrescos' }
  });
  assert.equal(r.estado, 400);
});

// ============================================================
// BAJAS: NADA SE BORRA
// ============================================================

test('dar de baja un producto lo saca de la caja pero no de los tickets viejos', async () => {
  const antes = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ codigo: 'COCA' }] }
  });
  const ventaVieja = antes.json.datos.venta;

  const prod = bd.prepare("SELECT id FROM productos WHERE codigo = 'COCA'").get();
  await llamar(`/api/catalogo/productos/${prod.id}/baja`, { method: 'POST', cuerpo: {} });

  // Ya no aparece en la caja...
  const cat = await llamar('/api/catalogo');
  assert.ok(!cat.json.datos.productos.some((p) => p.id === prod.id));

  // ...y no se puede volver a vender por código...
  const intento = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ codigo: 'COCA' }] }
  });
  assert.equal(intento.estado, 409);

  // ...pero el ticket de antes dice exactamente lo mismo que decía.
  const r = await llamar(`/api/ventas/${ventaVieja.id}`);
  assert.equal(r.json.datos.venta.total_centavos, 2500);
  assert.equal(r.json.datos.venta.lineas[0].concepto, 'Coca 600');

  // Y el producto sigue en la base, solo que marcado.
  const guardado = bd.prepare('SELECT * FROM productos WHERE id = ?').get(prod.id);
  assert.ok(guardado);
  assert.equal(guardado.activo, 0);
  assert.ok(guardado.fecha_baja);
});

test('dar de baja una categoría se lleva sus productos', async () => {
  await llamar('/api/catalogo/categorias', {
    method: 'POST', cuerpo: { nombre: 'Temporal' }
  });
  const cat = bd.prepare("SELECT id FROM categorias WHERE nombre = 'Temporal'").get();
  await llamar('/api/catalogo/productos', {
    method: 'POST', cuerpo: { nombre: 'Paleta', categoriaId: cat.id, tipo: 'simple', precio: 15 }
  });

  const r = await llamar(`/api/catalogo/categorias/${cat.id}/baja`, { method: 'POST', cuerpo: {} });
  assert.equal(r.json.datos.productosDadosDeBaja, 1);

  const vivos = bd.prepare(
    'SELECT COUNT(*) n FROM productos WHERE categoria_id = ? AND activo = 1'
  ).get(cat.id).n;
  assert.equal(vivos, 0);
});

test('un código liberado por una baja se puede volver a usar', async () => {
  const r = await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: 'Coca nueva', categoriaId: catRefrescos, tipo: 'simple', precio: 28, codigo: 'coca' }
  });
  assert.equal(r.estado, 201);
});

// ============================================================
// QUIÉN PUEDE QUÉ
// ============================================================

test('el cajero ve el catálogo pero no lo modifica', async () => {
  await entrarAdmin();
  const lista = (await llamar('/api/auth/usuarios-disponibles')).json.datos.usuarios;
  const rosa = lista.find((u) => u.nombre === 'Rosa');
  await llamar('/api/auth/entrar-pin', { method: 'POST', cuerpo: { usuarioId: rosa.id, pin: '4444' } });

  assert.equal((await llamar('/api/catalogo')).estado, 200);

  const alta = await llamar('/api/catalogo/productos', {
    method: 'POST', cuerpo: { nombre: 'No', categoriaId: catRefrescos, tipo: 'simple', precio: 1 }
  });
  assert.equal(alta.estado, 403);

  const cat = await llamar('/api/catalogo/categorias', {
    method: 'POST', cuerpo: { nombre: 'Tampoco' }
  });
  assert.equal(cat.estado, 403);
});
