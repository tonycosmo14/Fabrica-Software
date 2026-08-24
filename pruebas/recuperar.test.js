/**
 * PRUEBAS DE RECUPERAR Y DE LA BAJA CON MERCANCÍA  (v1.4)
 *
 * "Nada se borra" no vale de nada si no hay forma de traerlo de vuelta:
 * para el usuario, un producto que no puede recuperar está borrado.
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, bd, carpeta, preparar } = fabricaDePrueba('recup');

let catId;


preparar(async () => {
  catId = (await llamar('/api/catalogo/categorias', {
    method: 'POST', cuerpo: { nombre: 'Refrescos' }
  })).json.datos.categoria.id;
  await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Mari', rol: 'gerente', pin: '7777' }
  });
});

// ============================================================
// EL BUG: NO SE PODÍAN RECUPERAR
// ============================================================

test('un pedazo de hielo dado de baja se puede volver a dar de alta', async () => {
  const octavo = bd.prepare("SELECT * FROM productos WHERE codigo = '18'").get();

  await llamar(`/api/catalogo/productos/${octavo.id}/baja`, { method: 'POST', cuerpo: {} });

  // Deja de salir en la caja...
  let cat = await llamar('/api/catalogo');
  assert.ok(!cat.json.datos.productos.some((p) => p.id === octavo.id));

  // ...pero se puede pedir la lista con las bajas, que es como se recupera.
  cat = await llamar('/api/catalogo?incluirBajas=1');
  const debaja = cat.json.datos.productos.find((p) => p.id === octavo.id);
  assert.ok(debaja, 'aparece en la lista con bajas');
  assert.equal(debaja.activo, 0);

  const r = await llamar(`/api/catalogo/productos/${octavo.id}/alta`, {
    method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 200);

  cat = await llamar('/api/catalogo');
  const vivo = cat.json.datos.productos.find((p) => p.id === octavo.id);
  assert.ok(vivo, 'volvió a la caja');
  assert.equal(vivo.codigo, '18', 'con su código de siempre');
});

test('no se puede dar de alta algo que ya está activo', async () => {
  const octavo = bd.prepare("SELECT * FROM productos WHERE codigo = '18'").get();
  const r = await llamar(`/api/catalogo/productos/${octavo.id}/alta`, {
    method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 400);
});

test('si otro tomó su código mientras no estaba, vuelve sin código', async () => {
  const medio = bd.prepare("SELECT * FROM productos WHERE codigo = '12'").get();
  await llamar(`/api/catalogo/productos/${medio.id}/baja`, { method: 'POST', cuerpo: {} });

  // Alguien más usa el 12 mientras tanto.
  await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: 'Otro', categoriaId: catId, tipo: 'simple', precio: 10, codigo: '12' }
  });

  const r = await llamar(`/api/catalogo/productos/${medio.id}/alta`, {
    method: 'POST', cuerpo: {} });
  // Se recupera igual: traer el producto de vuelta importa más que el código.
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.codigoPerdido, '12');
  assert.equal(r.json.datos.producto.codigo, null);
});

test('recuperar un producto revive su categoría si se fue con él', async () => {
  const cat = (await llamar('/api/catalogo/categorias', {
    method: 'POST', cuerpo: { nombre: 'Temporal' }
  })).json.datos.categoria;
  const prod = (await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: 'Paleta', categoriaId: cat.id, tipo: 'simple', precio: 15 }
  })).json.datos.producto;

  await llamar(`/api/catalogo/categorias/${cat.id}/baja`, { method: 'POST', cuerpo: {} });
  assert.equal(bd.prepare('SELECT activo FROM productos WHERE id = ?').get(prod.id).activo, 0);

  await llamar(`/api/catalogo/productos/${prod.id}/alta`, { method: 'POST', cuerpo: {} });

  assert.equal(bd.prepare('SELECT activo FROM categorias WHERE id = ?').get(cat.id).activo, 1,
    'sin su carpeta, el producto volvería a la nada');
  assert.equal(bd.prepare('SELECT activo FROM productos WHERE id = ?').get(prod.id).activo, 1);
});

test('una categoría se recupera sola, salvo que su nombre ya lo tenga otra', async () => {
  const cat = (await llamar('/api/catalogo/categorias', {
    method: 'POST', cuerpo: { nombre: 'Botanas' }
  })).json.datos.categoria;
  await llamar(`/api/catalogo/categorias/${cat.id}/baja`, { method: 'POST', cuerpo: {} });

  // Alguien crea otra con el mismo nombre.
  await llamar('/api/catalogo/categorias', { method: 'POST', cuerpo: { nombre: 'Botanas' } });

  const choca = await llamar(`/api/catalogo/categorias/${cat.id}/alta`, {
    method: 'POST', cuerpo: {} });
  assert.equal(choca.estado, 409);
  assert.match(choca.json.error, /Renómbrala/i);
});

// ============================================================
// DAR DE BAJA ALGO QUE TODAVÍA TIENE MERCANCÍA
// ============================================================

test('con piezas en el almacén, la baja pide autorización', async () => {
  const p = (await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: 'Sabritas', categoriaId: catId, tipo: 'simple',
              precio: 20, llevaInventario: true }
  })).json.datos.producto;

  await llamar(`/api/inventario/${p.id}/movimientos`, {
    method: 'POST', cuerpo: { tipo: 'entrada', cantidad: 12 }
  });

  const r = await llamar(`/api/catalogo/productos/${p.id}/baja`, {
    method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 403);
  assert.equal(r.json.requiereAutorizacion, true);
  assert.equal(r.json.quedan, 12, 'dice cuántas quedan, para que se decida sabiendo');
  assert.ok(r.json.responsables.length > 0, 'y a quién pedírsela');

  // Sigue activo: no se dio de baja a medias.
  assert.equal(bd.prepare('SELECT activo FROM productos WHERE id = ?').get(p.id).activo, 1);
});

test('con el PIN de un responsable sí se da de baja', async () => {
  const p = bd.prepare("SELECT * FROM productos WHERE nombre = 'Sabritas'").get();
  const mari = bd.prepare("SELECT id FROM usuarios WHERE nombre = 'Mari'").get();

  const malo = await llamar(`/api/catalogo/productos/${p.id}/baja`, {
    method: 'POST', cuerpo: { autorizacion: { usuarioId: mari.id, pin: '0000' } } });
  assert.equal(malo.estado, 403);
  assert.match(malo.json.error, /PIN incorrecto/i);

  const bueno = await llamar(`/api/catalogo/productos/${p.id}/baja`, {
    method: 'POST', cuerpo: { autorizacion: { usuarioId: mari.id, pin: '7777' } } });
  assert.equal(bueno.estado, 200);
  assert.equal(bueno.json.datos.quedaban, 12);
});

test('sin mercancía, la baja no molesta a nadie', async () => {
  const p = (await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: 'Chicles', categoriaId: catId, tipo: 'simple', precio: 5 }
  })).json.datos.producto;

  const r = await llamar(`/api/catalogo/productos/${p.id}/baja`, {
    method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.quedaban, 0);
});

// ============================================================
// QUIÉN PUEDE QUÉ
// ============================================================

test('el gerente administra productos; el cajero no', async () => {
  await entrarAdmin();
  const lista = (await llamar('/api/auth/usuarios-disponibles')).json.datos.usuarios;
  const mari = lista.find((u) => u.nombre === 'Mari');
  await llamar('/api/auth/entrar-pin', { method: 'POST', cuerpo: { usuarioId: mari.id, pin: '7777' } });

  const alta = await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: 'Del gerente', categoriaId: catId, tipo: 'simple', precio: 12 } });
  assert.equal(alta.estado, 201);

  await entrarAdmin();
  await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Rosa', rol: 'cajero', pin: '4444' } });
  const l2 = (await llamar('/api/auth/usuarios-disponibles')).json.datos.usuarios;
  const rosa = l2.find((u) => u.nombre === 'Rosa');
  await llamar('/api/auth/entrar-pin', { method: 'POST', cuerpo: { usuarioId: rosa.id, pin: '4444' } });

  const suya = await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: 'Del cajero', categoriaId: catId, tipo: 'simple', precio: 12 } });
  assert.equal(suya.estado, 403);
});
