/**
 * CATÁLOGO: categorías y productos  (v0.10)
 *
 * Lo que se ve en los botones de la caja se da de alta aquí, sin tocar el
 * programa. Nada se borra: se da de baja (regla 3.4), porque un producto
 * borrado dejaría tickets viejos apuntando al vacío.
 */
const express = require('express');
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');
const { ok, error } = require('../../lib/respuestas');
const { aCentavos } = require('../../lib/dinero');
const bitacora = require('../../lib/bitacora');
const { exigirPermiso } = require('../../middleware/sesion');
const { categoriasActivas, productosActivos } = require('./catalogo');

const router = express.Router();

const verCatalogo = exigirPermiso('venta.registrar');
const configurar = exigirPermiso('sistema.configurar');

const FRACCIONES_VALIDAS = [16, 8, 4, 2, 1];

/** El catálogo entero, listo para pintar los botones. */
router.get('/', verCatalogo, (req, res) => {
  return ok(res, { categorias: categoriasActivas(), productos: productosActivos() });
});

// ============================================================
// CATEGORÍAS
// ============================================================

router.post('/categorias', configurar, (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  if (!nombre) return error(res, 'La categoría necesita un nombre.');

  const repetida = bd.prepare(
    'SELECT id FROM categorias WHERE nombre = ? AND activo = 1'
  ).get(nombre);
  if (repetida) return error(res, `Ya hay una categoría que se llama "${nombre}".`);

  const id = nuevoId();
  const orden = bd.prepare('SELECT COALESCE(MAX(orden), 0) n FROM categorias').get().n + 1;

  bd.prepare(`
    INSERT INTO categorias (id, nombre, color, orden, activo, fecha_alta, creado_por)
    VALUES (?, ?, ?, ?, 1, ?, ?)
  `).run(id, nombre, req.body?.color || null, orden, ahora(), req.usuario.id);

  bitacora.registrar({
    accion: 'categoria.alta', entidad: 'categoria', entidadId: id,
    ejecutorId: req.usuario.id, detalle: { nombre }
  });

  return ok(res, { categoria: bd.prepare('SELECT * FROM categorias WHERE id = ?').get(id) }, 201);
});

router.put('/categorias/:id', configurar, (req, res) => {
  const c = bd.prepare('SELECT * FROM categorias WHERE id = ?').get(req.params.id);
  if (!c) return error(res, 'Esa categoría no existe.', 404);

  const nombre = req.body?.nombre !== undefined ? String(req.body.nombre).trim() : c.nombre;
  if (!nombre) return error(res, 'El nombre no puede quedar vacío.');

  const repetida = bd.prepare(
    'SELECT id FROM categorias WHERE nombre = ? AND activo = 1 AND id <> ?'
  ).get(nombre, c.id);
  if (repetida) return error(res, `Ya hay una categoría que se llama "${nombre}".`);

  bd.prepare('UPDATE categorias SET nombre = ?, color = ?, orden = ? WHERE id = ?')
    .run(nombre,
         req.body?.color !== undefined ? req.body.color : c.color,
         req.body?.orden !== undefined ? Number(req.body.orden) || 0 : c.orden,
         c.id);

  bitacora.registrar({
    accion: 'categoria.edicion', entidad: 'categoria', entidadId: c.id,
    ejecutorId: req.usuario.id, detalle: { nombre }
  });

  return ok(res, { categoria: bd.prepare('SELECT * FROM categorias WHERE id = ?').get(c.id) });
});

/** Dar de baja una categoría se lleva sus productos: si no, quedan huérfanos. */
router.post('/categorias/:id/baja', configurar, (req, res) => {
  const c = bd.prepare('SELECT * FROM categorias WHERE id = ?').get(req.params.id);
  if (!c) return error(res, 'Esa categoría no existe.', 404);

  const cuantos = bd.prepare(
    'SELECT COUNT(*) n FROM productos WHERE categoria_id = ? AND activo = 1'
  ).get(c.id).n;

  const bajar = bd.transaction(() => {
    bd.prepare('UPDATE categorias SET activo = 0, fecha_baja = ? WHERE id = ?').run(ahora(), c.id);
    bd.prepare('UPDATE productos SET activo = 0, fecha_baja = ? WHERE categoria_id = ? AND activo = 1')
      .run(ahora(), c.id);
  });
  bajar();

  bitacora.registrar({
    accion: 'categoria.baja', entidad: 'categoria', entidadId: c.id,
    ejecutorId: req.usuario.id, detalle: { nombre: c.nombre, productos: cuantos }
  });

  return ok(res, { dadaDeBaja: true, productosDadosDeBaja: cuantos });
});

// ============================================================
// PRODUCTOS
// ============================================================

/** Valida y normaliza lo que llega de la pantalla. */
function leerProducto(cuerpo, anterior = null) {
  const nombre = cuerpo?.nombre !== undefined
    ? String(cuerpo.nombre).trim() : anterior?.nombre;
  if (!nombre) return { error: 'El producto necesita un nombre.' };

  const tipo = cuerpo?.tipo !== undefined ? String(cuerpo.tipo) : (anterior?.tipo || 'simple');
  if (tipo !== 'hielo' && tipo !== 'simple') {
    return { error: 'El producto es de hielo o es simple, no hay otra.' };
  }

  let dieciseisavos = null;
  let centavos = null;

  if (tipo === 'hielo') {
    const d = cuerpo?.dieciseisavos !== undefined
      ? Number(cuerpo.dieciseisavos) : anterior?.dieciseisavos;
    if (!FRACCIONES_VALIDAS.includes(d)) {
      return { error: 'Un botón de hielo entrega 1, 1/2, 1/4, 1/8 o 1/16 de marqueta.' };
    }
    dieciseisavos = d;
  } else {
    const pesos = cuerpo?.precio !== undefined
      ? cuerpo.precio
      : (anterior ? anterior.precio_centavos / 100 : undefined);
    if (pesos === undefined || pesos === null || pesos === '') {
      return { error: 'Ponle precio al producto.' };
    }
    try { centavos = aCentavos(String(pesos).replace(/[^0-9.]/g, '')); }
    catch { return { error: 'Ese precio no es válido.' }; }
    if (centavos > 100000000) return { error: 'Ese precio es demasiado alto.' };
  }

  // El código es opcional, pero si se pone tiene que ser tecleable de
  // corrido: sin espacios, para que no haya dos que se vean iguales.
  let codigo = cuerpo?.codigo !== undefined
    ? String(cuerpo.codigo).trim().toUpperCase() : (anterior?.codigo ?? null);
  if (codigo === '') codigo = null;
  if (codigo && !/^[A-Z0-9._-]{1,12}$/.test(codigo)) {
    return { error: 'El código son hasta 12 letras o números, sin espacios.' };
  }

  return { nombre, tipo, dieciseisavos, centavos, codigo };
}

router.post('/productos', configurar, (req, res) => {
  const datos = leerProducto(req.body);
  if (datos.error) return error(res, datos.error);

  if (datos.codigo) {
    const repetido = bd.prepare(
      'SELECT nombre FROM productos WHERE codigo = ? AND activo = 1'
    ).get(datos.codigo);
    if (repetido) return error(res, `El código ${datos.codigo} ya lo usa "${repetido.nombre}".`);
  }

  const categoria = bd.prepare('SELECT id FROM categorias WHERE id = ? AND activo = 1')
    .get(req.body?.categoriaId ?? null);
  if (!categoria) return error(res, 'Elige una categoría para el producto.');

  const id = nuevoId();
  const orden = bd.prepare(
    'SELECT COALESCE(MAX(orden), 0) n FROM productos WHERE categoria_id = ?'
  ).get(categoria.id).n + 1;

  bd.prepare(`
    INSERT INTO productos (id, codigo, nombre, categoria_id, tipo, dieciseisavos,
                           precio_centavos, color, orden, activo, fecha_alta, creado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, datos.codigo, datos.nombre, categoria.id, datos.tipo,
         datos.dieciseisavos, datos.centavos, req.body?.color || null,
         orden, ahora(), req.usuario.id);

  bitacora.registrar({
    accion: 'producto.alta', entidad: 'producto', entidadId: id,
    ejecutorId: req.usuario.id,
    detalle: { nombre: datos.nombre, tipo: datos.tipo, codigo: datos.codigo }
  });

  return ok(res, { producto: bd.prepare('SELECT * FROM productos WHERE id = ?').get(id) }, 201);
});

router.put('/productos/:id', configurar, (req, res) => {
  const p = bd.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
  if (!p) return error(res, 'Ese producto no existe.', 404);

  const datos = leerProducto(req.body, p);
  if (datos.error) return error(res, datos.error);

  if (datos.codigo) {
    const repetido = bd.prepare(
      'SELECT nombre FROM productos WHERE codigo = ? AND activo = 1 AND id <> ?'
    ).get(datos.codigo, p.id);
    if (repetido) return error(res, `El código ${datos.codigo} ya lo usa "${repetido.nombre}".`);
  }

  const categoriaId = req.body?.categoriaId !== undefined
    ? req.body.categoriaId : p.categoria_id;
  const categoria = bd.prepare('SELECT id FROM categorias WHERE id = ? AND activo = 1')
    .get(categoriaId ?? null);
  if (!categoria) return error(res, 'Elige una categoría para el producto.');

  bd.prepare(`
    UPDATE productos SET codigo = ?, nombre = ?, categoria_id = ?, tipo = ?,
      dieciseisavos = ?, precio_centavos = ?, color = ?, orden = ?
    WHERE id = ?
  `).run(datos.codigo, datos.nombre, categoria.id, datos.tipo,
         datos.dieciseisavos, datos.centavos,
         req.body?.color !== undefined ? req.body.color : p.color,
         req.body?.orden !== undefined ? Number(req.body.orden) || 0 : p.orden,
         p.id);

  bitacora.registrar({
    accion: 'producto.edicion', entidad: 'producto', entidadId: p.id,
    ejecutorId: req.usuario.id, detalle: { nombre: datos.nombre }
  });

  return ok(res, { producto: bd.prepare('SELECT * FROM productos WHERE id = ?').get(p.id) });
});

router.post('/productos/:id/baja', configurar, (req, res) => {
  const p = bd.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
  if (!p) return error(res, 'Ese producto no existe.', 404);

  bd.prepare('UPDATE productos SET activo = 0, fecha_baja = ? WHERE id = ?').run(ahora(), p.id);
  bitacora.registrar({
    accion: 'producto.baja', entidad: 'producto', entidadId: p.id,
    ejecutorId: req.usuario.id, detalle: { nombre: p.nombre }
  });
  return ok(res, { dadoDeBaja: true });
});

module.exports = router;
