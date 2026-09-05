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
const { estadoProducto } = require('./inventario');
const { comprobar: comprobarAutorizacion, responsables,
        comprobarAdmin, administradores } = require('../../lib/autorizacion');
const fotos = require('./fotos');

const router = express.Router();

const verCatalogo = exigirPermiso('venta.registrar');
// Dar de alta y de baja productos y categorías: gerente y administrador.
// Los precios del hielo siguen siendo solo del administrador.
const administrar = exigirPermiso('productos.administrar');

const FRACCIONES_VALIDAS = [16, 8, 4, 2, 1];

/**
 * El catálogo entero, listo para pintar los botones.
 *
 * Con ?incluirBajas=1 vienen también los dados de baja. Sirve para poder
 * recuperarlos: nada se borra, pero si no hay forma de verlos, para el
 * usuario es como si se hubieran borrado.
 */
/**
 * LOS CUATRO NÚMEROS DE ABAJO  (v7.1)
 *
 * Cuántos productos se venden, cuánto vale lo que hay en el mostrador,
 * qué se gana en promedio y cuántos hay que pedir. Se sacan de lo que ya
 * está guardado; nada de esto es un contador.
 */
function resumenCatalogo() {
  const activos = bd.prepare(
    'SELECT * FROM productos WHERE activo = 1').all();
  const deBaja = bd.prepare(
    'SELECT COUNT(*) n FROM productos WHERE activo = 0').get().n;

  // EL MARGEN PROMEDIO: solo de los que tienen costo puesto. Meter en el
  // promedio a los que no lo tienen sería contarlos como si se regalaran.
  const conCosto = activos.filter((p) => p.costo_centavos > 0 && p.precio_centavos > 0);
  const margen = conCosto.length
    ? Math.round((conCosto.reduce((n, p) =>
        n + ((p.precio_centavos - p.costo_centavos) / p.precio_centavos), 0)
        / conCosto.length) * 1000) / 10
    : null;

  // LO QUE HAY EN EL MOSTRADOR, a precio de venta. Solo lo que lleva
  // cuenta de piezas: el hielo se mide en marquetas y su valor vive en la
  // Existencia del cuarto frío.
  let valor = 0;
  let porPedir = 0;
  for (const p of activos.filter((x) => x.lleva_inventario)) {
    const e = estadoProducto(p);
    valor += Math.max(0, e.esperado) * (p.precio_centavos || 0);
    if (e.bajo) porPedir++;
  }

  return {
    productos: activos.length,
    deBaja,
    conMayoreo: activos.filter((p) => p.mayoreo_desde).length,
    sinCosto: activos.length - conCosto.length,
    margen,
    valorMostrador: valor,
    porPedir
  };
}

/**
 * A CUÁNTOS CLIENTES SE LES DEJÓ UN PRECIO PROPIO EN CADA PRODUCTO  (v7.1)
 *
 * "Precios especiales por clientes: cada cliente puede llegar a tener un
 *  precio diferente."
 *
 * En la ficha del producto se ve el número, no la lista: quien está
 * poniendo precios necesita saber que ese renglón lo tienen amarrado
 * catorce clientes ANTES de moverlo. Los catorce nombres se ven en
 * Clientes, que es donde se cambian.
 */
function conveniosPorProducto() {
  const filas = bd.prepare(`
    SELECT cp.producto_id AS id, COUNT(*) AS n
      FROM cliente_precios cp
      JOIN clientes c ON c.id = cp.cliente_id AND c.activo = 1
     GROUP BY cp.producto_id
  `).all();
  return new Map(filas.map((f) => [f.id, f.n]));
}

function conConvenios(productos) {
  const cuenta = conveniosPorProducto();
  for (const p of productos) p.convenios = cuenta.get(p.id) || 0;
  return productos;
}

router.get('/', verCatalogo, (req, res) => {
  const conBajas = req.query.incluirBajas === '1';

  if (!conBajas) {
    return ok(res, {
      categorias: categoriasActivas(), productos: conConvenios(productosActivos()),
      resumen: resumenCatalogo()
    });
  }

  const categorias = bd.prepare(
    'SELECT * FROM categorias ORDER BY activo DESC, orden, nombre'
  ).all();
  const productos = bd.prepare(`
    SELECT p.*, c.nombre AS categoria_nombre, c.color AS categoria_color
      FROM productos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
     ORDER BY p.activo DESC, p.orden, p.nombre
  `).all();

  return ok(res, { categorias, productos: conConvenios(productos), resumen: resumenCatalogo() });
});

/**
 * QUÉ HA COSTADO ESTE PRODUCTO A LO LARGO DEL TIEMPO  (v7.1)
 *
 * No hay una tabla de historial de precios, y no hace falta: cada cambio
 * ya quedó escrito en la BITÁCORA con lo que decía antes y lo que dice
 * después. Leerlo de ahí es leer la misma verdad que audita todo lo
 * demás; una tabla aparte sería una segunda copia que el día que se
 * desincronice nadie sabría cuál creer.
 */
router.get('/productos/:id/historial', administrar, (req, res) => {
  const p = bd.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
  if (!p) return error(res, 'Ese producto no existe.', 404);

  const filas = bd.prepare(`
    SELECT b.fecha, b.detalle, u.nombre AS quien
      FROM bitacora b
      LEFT JOIN usuarios u ON u.id = b.ejecutor_id
     WHERE b.entidad = 'producto' AND b.entidad_id = ?
       AND b.accion IN ('producto.alta', 'producto.edicion')
     ORDER BY b.fecha DESC
     LIMIT 60
  `).all(p.id);

  const cambios = [];
  for (const f of filas) {
    let d = null;
    try { d = JSON.parse(f.detalle || '{}'); } catch { d = null; }
    if (!d) continue;
    // Solo los renglones donde el precio de verdad se movió: en la
    // bitácora también quedan los cambios de nombre y de mínimo, y
    // enseñarlos aquí sería llenar el historial de ruido.
    const antes = d.antes?.precio_centavos ?? null;
    const despues = d.despues?.precio_centavos ?? d.precio_centavos ?? null;
    const mayoreoAntes = d.antes?.mayoreo_centavos ?? null;
    const mayoreoDespues = d.despues?.mayoreo_centavos ?? null;
    const movioMostrador = despues !== null && antes !== despues;
    const movioMayoreo = mayoreoAntes !== mayoreoDespues;
    if (!movioMostrador && !movioMayoreo) continue;
    cambios.push({
      fecha: f.fecha, quien: f.quien,
      antes, despues,
      mayoreoAntes, mayoreoDespues,
      desde: d.despues?.mayoreo_desde ?? null
    });
  }

  return ok(res, { producto: { id: p.id, nombre: p.nombre }, cambios });
});

/**
 * DUPLICAR UN PRODUCTO.
 *
 * Dar de alta la bolsa de 10 kg cuando ya existe la de 5 es copiar ocho
 * campos y cambiar dos. El código NO se copia —es único y se teclea— y
 * el nombre lleva "(copia)" para que nadie se confunda con el original
 * mientras lo termina de ajustar.
 */
router.post('/productos/:id/duplicar', administrar, (req, res) => {
  const p = bd.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
  if (!p) return error(res, 'Ese producto no existe.', 404);

  const id = nuevoId();
  const orden = bd.prepare(
    'SELECT COALESCE(MAX(orden), 0) n FROM productos WHERE categoria_id = ?'
  ).get(p.categoria_id).n + 1;

  bd.prepare(`
    INSERT INTO productos (id, codigo, nombre, categoria_id, tipo, dieciseisavos,
                           precio_centavos, color, orden, activo, fecha_alta, creado_por,
                           costo_centavos, minimo, lleva_inventario, para_agua,
                           para_nevera, mayoreo, mayoreo_desde, mayoreo_centavos)
    VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, `${p.nombre} (copia)`.slice(0, 60), p.categoria_id, p.tipo,
         p.dieciseisavos, p.precio_centavos, p.color, orden, ahora(), req.usuario.id,
         p.costo_centavos, p.minimo, p.lleva_inventario, p.para_agua,
         p.para_nevera, p.mayoreo, p.mayoreo_desde, p.mayoreo_centavos);

  bitacora.registrar({
    accion: 'producto.alta', entidad: 'producto', entidadId: id,
    ejecutorId: req.usuario.id,
    detalle: { nombre: `${p.nombre} (copia)`, copiadoDe: p.nombre,
               precio_centavos: p.precio_centavos }
  });

  return ok(res, {
    producto: bd.prepare('SELECT * FROM productos WHERE id = ?').get(id)
  }, 201);
});

// ============================================================
// CATEGORÍAS
// ============================================================

router.post('/categorias', administrar, (req, res) => {
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

router.put('/categorias/:id', administrar, (req, res) => {
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
router.post('/categorias/:id/baja', administrar, (req, res) => {
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

  // Costo de compra: sirve para saber la ganancia. Puede quedar vacío.
  let costo = anterior?.costo_centavos ?? null;
  if (cuerpo?.costo !== undefined) {
    const texto = String(cuerpo.costo ?? '').replace(/[^0-9.]/g, '');
    if (texto === '') costo = null;
    else {
      try { costo = aCentavos(texto); }
      catch { return { error: 'Ese costo no es válido.' }; }
      if (costo > 100000000) return { error: 'Ese costo es demasiado alto.' };
    }
  }

  // EL PRECIO POR VOLUMEN  (v7.1)
  //
  // "De cincuenta bolsas para arriba, a $16.50." Le toca a quien sea que
  // se lleve cincuenta. Los dos datos van juntos: vaciar cualquiera de
  // los dos apaga la regla, y por eso no hay un interruptor aparte que
  // pueda quedar en desacuerdo con los números.
  //
  // El hielo por fracción no lo usa: ahí el volumen ya está en el propio
  // botón —una marqueta entera es el mayoreo— y su precio sale de la
  // lista, no de esta columna.
  let mayoreoDesde = anterior?.mayoreo_desde ?? null;
  let mayoreoCentavos = anterior?.mayoreo_centavos ?? null;

  if (cuerpo?.mayoreoDesde !== undefined) {
    const t = String(cuerpo.mayoreoDesde ?? '').replace(/[^0-9]/g, '');
    mayoreoDesde = t === '' ? null : Number(t);
    if (mayoreoDesde !== null && (mayoreoDesde < 2 || mayoreoDesde > 100000)) {
      return { error: 'El mayoreo empieza desde 2 piezas o más.' };
    }
  }
  if (cuerpo?.mayoreoPrecio !== undefined) {
    const t = String(cuerpo.mayoreoPrecio ?? '').replace(/[^0-9.]/g, '');
    if (t === '') mayoreoCentavos = null;
    else {
      try { mayoreoCentavos = aCentavos(t); }
      catch { return { error: 'Ese precio de mayoreo no es válido.' }; }
      if (mayoreoCentavos > 100000000) return { error: 'Ese precio es demasiado alto.' };
    }
  }
  // Uno sin el otro no dice nada: se apagan los dos juntos.
  if (mayoreoDesde === null || mayoreoCentavos === null) {
    mayoreoDesde = null; mayoreoCentavos = null;
  }
  if (tipo === 'hielo') { mayoreoDesde = null; mayoreoCentavos = null; }
  // Un "mayoreo" más caro que el mostrador es un dedazo, y se descubre
  // el día que alguien se lleve cincuenta y pague de más.
  if (mayoreoCentavos !== null && centavos !== null && mayoreoCentavos > centavos) {
    return { error: 'El precio de mayoreo tiene que ser menor que el de mostrador.' };
  }

  // Aviso de "ya hay que pedir".
  let minimo = anterior?.minimo ?? null;
  if (cuerpo?.minimo !== undefined) {
    const texto = String(cuerpo.minimo ?? '').replace(/[^0-9]/g, '');
    minimo = texto === '' ? null : Number(texto);
    if (minimo !== null && (!Number.isInteger(minimo) || minimo < 0 || minimo > 1000000)) {
      return { error: 'Ese mínimo no es válido.' };
    }
  }

  // El hielo nunca lleva inventario de piezas: se mide en marquetas y ya
  // tiene su control en la Existencia.
  let llevaInventario = anterior?.lleva_inventario ?? 0;
  if (cuerpo?.llevaInventario !== undefined) llevaInventario = cuerpo.llevaInventario ? 1 : 0;
  if (tipo === 'hielo') llevaInventario = 0;

  // ¿ESTO ES AGUA?  (v5.6, y desde la v6.9 ya no se pregunta)
  //
  // "Toda la fábrica es una misma, no hay dos partes. Un cliente puede
  //  pedir en la caja agua, hielo, refrescos, lo que quiera, y creo que es
  //  obvio con lo que compre."
  //
  // Tiene razón, así que la pregunta se fue de la ficha del producto. La
  // marca se queda porque de ella salen dos cosas útiles —la pestaña de
  // «clientes de agua» y el bloque del agua en la hoja de preparación— y
  // se DEDUCE del nombre, que es de donde salió la primera vez (043).
  //
  // Adivinar por el nombre falla el día que alguien dé de alta "Hielo en
  // botella", y se asume: lo único que se equivoca entonces es en qué
  // pestaña sale un cliente. Ni un peso depende de esto. Y se puede
  // seguir mandando `paraAgua` a mano, que gana a la deducción.
  const suenaAAgua = /garraf|botell|agua/i.test(nombre);
  let paraAgua = anterior ? anterior.para_agua : (suenaAAgua ? 1 : 0);
  // Al renombrar un producto se vuelve a deducir: "Coca" que pasa a
  // llamarse "Agua Ciel" es agua desde ese día.
  if (anterior && nombre !== anterior.nombre) paraAgua = suenaAAgua ? 1 : 0;
  if (cuerpo?.paraAgua !== undefined) paraAgua = cuerpo.paraAgua ? 1 : 0;
  if (tipo === 'hielo') paraAgua = 0;

  return { nombre, tipo, dieciseisavos, centavos, codigo, costo, minimo,
           llevaInventario, paraAgua, mayoreoDesde, mayoreoCentavos };
}

router.post('/productos', administrar, (req, res) => {
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
                           precio_centavos, color, orden, activo, fecha_alta, creado_por,
                           costo_centavos, minimo, lleva_inventario, para_agua,
                           mayoreo_desde, mayoreo_centavos)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, datos.codigo, datos.nombre, categoria.id, datos.tipo,
         datos.dieciseisavos, datos.centavos, req.body?.color || null,
         orden, ahora(), req.usuario.id,
         datos.costo, datos.minimo, datos.llevaInventario, datos.paraAgua,
         datos.mayoreoDesde, datos.mayoreoCentavos);

  bitacora.registrar({
    accion: 'producto.alta', entidad: 'producto', entidadId: id,
    ejecutorId: req.usuario.id,
    // El precio va en la bitácora desde el alta: es el primer renglón de
    // su historial, y sin él el historial empieza a media película.
    detalle: { nombre: datos.nombre, tipo: datos.tipo, codigo: datos.codigo,
               precio_centavos: datos.centavos }
  });

  return ok(res, { producto: bd.prepare('SELECT * FROM productos WHERE id = ?').get(id) }, 201);
});

router.put('/productos/:id', administrar, (req, res) => {
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
      dieciseisavos = ?, precio_centavos = ?, color = ?, orden = ?,
      costo_centavos = ?, minimo = ?, lleva_inventario = ?, para_agua = ?,
      mayoreo_desde = ?, mayoreo_centavos = ?
    WHERE id = ?
  `).run(datos.codigo, datos.nombre, categoria.id, datos.tipo,
         datos.dieciseisavos, datos.centavos,
         req.body?.color !== undefined ? req.body.color : p.color,
         req.body?.orden !== undefined ? Number(req.body.orden) || 0 : p.orden,
         datos.costo, datos.minimo, datos.llevaInventario, datos.paraAgua,
         datos.mayoreoDesde, datos.mayoreoCentavos,
         p.id);

  bitacora.registrar({
    accion: 'producto.edicion', entidad: 'producto', entidadId: p.id,
    ejecutorId: req.usuario.id,
    // ANTES Y DESPUÉS del precio, para que el historial salga de aquí y
    // no de una tabla aparte que se pueda desincronizar.
    detalle: {
      nombre: datos.nombre,
      antes: { precio_centavos: p.precio_centavos, costo_centavos: p.costo_centavos,
               mayoreo_desde: p.mayoreo_desde, mayoreo_centavos: p.mayoreo_centavos },
      despues: { precio_centavos: datos.centavos, costo_centavos: datos.costo,
                 mayoreo_desde: datos.mayoreoDesde, mayoreo_centavos: datos.mayoreoCentavos }
    }
  });

  return ok(res, { producto: bd.prepare('SELECT * FROM productos WHERE id = ?').get(p.id) });
});

/**
 * La foto del producto. Llega como texto "data:image/png;base64,..." desde
 * el navegador, igual que el logo.
 */
router.post('/categorias/:id/foto', administrar, (req, res) => {
  const c = bd.prepare('SELECT * FROM categorias WHERE id = ?').get(req.params.id);
  if (!c) return error(res, 'Esa categoría no existe.', 404);

  const r = fotos.guardar(c.id, req.body?.archivo);
  if (r.error) return error(res, r.error);

  bd.prepare('UPDATE categorias SET foto = ? WHERE id = ?').run(r.archivo, c.id);
  bitacora.registrar({
    accion: 'categoria.foto', entidad: 'categoria', entidadId: c.id,
    ejecutorId: req.usuario.id, detalle: { nombre: c.nombre }
  });
  return ok(res, { categoria: bd.prepare('SELECT * FROM categorias WHERE id = ?').get(c.id) });
});

router.post('/categorias/:id/foto/quitar', administrar, (req, res) => {
  const c = bd.prepare('SELECT * FROM categorias WHERE id = ?').get(req.params.id);
  if (!c) return error(res, 'Esa categoría no existe.', 404);

  fotos.quitar(c.id);
  bd.prepare('UPDATE categorias SET foto = NULL WHERE id = ?').run(c.id);
  return ok(res, { quitada: true });
});

router.post('/productos/:id/foto', administrar, (req, res) => {
  const p = bd.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
  if (!p) return error(res, 'Ese producto no existe.', 404);

  const r = fotos.guardar(p.id, req.body?.archivo);
  if (r.error) return error(res, r.error);

  bd.prepare('UPDATE productos SET foto = ? WHERE id = ?').run(r.archivo, p.id);
  bitacora.registrar({
    accion: 'producto.foto', entidad: 'producto', entidadId: p.id,
    ejecutorId: req.usuario.id, detalle: { nombre: p.nombre }
  });

  return ok(res, { producto: bd.prepare('SELECT * FROM productos WHERE id = ?').get(p.id) });
});

router.post('/productos/:id/foto/quitar', administrar, (req, res) => {
  const p = bd.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
  if (!p) return error(res, 'Ese producto no existe.', 404);

  fotos.quitar(p.id);
  bd.prepare('UPDATE productos SET foto = NULL WHERE id = ?').run(p.id);
  bitacora.registrar({
    accion: 'producto.foto.quitada', entidad: 'producto', entidadId: p.id,
    ejecutorId: req.usuario.id, detalle: { nombre: p.nombre }
  });

  return ok(res, { quitada: true });
});

/**
 * VOLVER A DAR DE ALTA.
 *
 * Sin esto, dar de baja era una puerta de un solo sentido: el producto
 * seguía en la base pero nadie podía traerlo de vuelta, así que para el
 * usuario estaba borrado. Eso contradice la regla de que nada se borra.
 */
router.post('/productos/:id/alta', administrar, (req, res) => {
  const p = bd.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
  if (!p) return error(res, 'Ese producto no existe.', 404);
  if (p.activo) return error(res, 'Ese producto ya está activo.');

  // Su categoría pudo haberse dado de baja con él: se revive también, o el
  // producto volvería a una carpeta que no existe.
  const cat = bd.prepare('SELECT * FROM categorias WHERE id = ?').get(p.categoria_id);
  if (!cat) return error(res, 'Su categoría ya no existe. Elige otra al editarlo.', 409);

  // Si el código lo tomó otro mientras estaba de baja, se devuelve sin
  // código en vez de fallar: recuperar el producto importa más.
  let codigo = p.codigo;
  if (codigo) {
    const ocupado = bd.prepare(
      'SELECT nombre FROM productos WHERE codigo = ? AND activo = 1 AND id <> ?'
    ).get(codigo, p.id);
    if (ocupado) codigo = null;
  }

  const revivir = bd.transaction(() => {
    if (!cat.activo) {
      bd.prepare('UPDATE categorias SET activo = 1, fecha_baja = NULL WHERE id = ?').run(cat.id);
    }
    bd.prepare('UPDATE productos SET activo = 1, fecha_baja = NULL, codigo = ? WHERE id = ?')
      .run(codigo, p.id);
  });
  revivir();

  bitacora.registrar({
    accion: 'producto.alta', entidad: 'producto', entidadId: p.id,
    ejecutorId: req.usuario.id,
    detalle: { nombre: p.nombre, codigoLiberado: codigo === null && p.codigo ? p.codigo : null }
  });

  return ok(res, {
    producto: bd.prepare('SELECT * FROM productos WHERE id = ?').get(p.id),
    codigoPerdido: codigo === null && p.codigo ? p.codigo : null
  });
});

router.post('/categorias/:id/alta', administrar, (req, res) => {
  const c = bd.prepare('SELECT * FROM categorias WHERE id = ?').get(req.params.id);
  if (!c) return error(res, 'Esa categoría no existe.', 404);
  if (c.activo) return error(res, 'Esa categoría ya está activa.');

  const repetida = bd.prepare(
    'SELECT id FROM categorias WHERE nombre = ? AND activo = 1'
  ).get(c.nombre);
  if (repetida) {
    return error(res, `Ya hay otra categoría llamada "${c.nombre}". Renómbrala primero.`, 409);
  }

  bd.prepare('UPDATE categorias SET activo = 1, fecha_baja = NULL WHERE id = ?').run(c.id);
  bitacora.registrar({
    accion: 'categoria.alta', entidad: 'categoria', entidadId: c.id,
    ejecutorId: req.usuario.id, detalle: { nombre: c.nombre, recuperada: true }
  });

  return ok(res, { categoria: bd.prepare('SELECT * FROM categorias WHERE id = ?').get(c.id) });
});

/**
 * Dar de baja un producto.
 *
 * Si todavía tiene mercancía, no se hace a la primera: quedan piezas
 * físicas que nadie va a volver a contar, y eso es dinero que se pierde de
 * vista. Se avisa cuántas hay y se pide el PIN de un responsable.
 */
router.post('/productos/:id/baja', administrar, (req, res) => {
  const p = bd.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
  if (!p) return error(res, 'Ese producto no existe.', 404);

  const inv = p.lleva_inventario ? estadoProducto(p) : null;
  const quedan = inv?.esperado || 0;

  if (quedan > 0) {
    const auth = comprobarAutorizacion(req.body?.autorizacion, 'productos.administrar');
    if (auth.error) {
      return error(res, auth.error, 403, {
        requiereAutorizacion: true,
        quedan,
        responsables: responsables()
      });
    }
  }

  bd.prepare('UPDATE productos SET activo = 0, fecha_baja = ? WHERE id = ?').run(ahora(), p.id);
  bitacora.registrar({
    accion: 'producto.baja', entidad: 'producto', entidadId: p.id,
    ejecutorId: req.usuario.id, detalle: { nombre: p.nombre, quedaban: quedan }
  });
  return ok(res, { dadoDeBaja: true, quedaban: quedan });
});

// ============================================================
// BORRAR DE VERDAD
//
// DAR DE BAJA y ELIMINAR no son lo mismo, y la diferencia la puso Tony:
//
//   · Se da de BAJA lo de temporada, lo que va a volver. Sigue existiendo,
//     deja de salir en la caja y se recupera cuando toca.
//   · Se ELIMINA lo que nunca debió estar: el producto de prueba, el que se
//     dio de alta dos veces, el que ya no se va a vender jamás. Si algún día
//     hace falta, se vuelve a dar de alta en dos segundos.
//
// PERO LOS TICKETS VIEJOS NO SE TOCAN. Por eso solo se puede eliminar lo
// que NUNCA SE USÓ: en cuanto algo se vendió, su nombre vive en tickets y
// en las cuentas del día, y borrarlo dejaría el histórico mintiendo. Eso se
// da de baja, no se elimina.
//
// Y borrar pide la CONTRASEÑA del administrador, no un PIN: el PIN se
// teclea veinte veces al día delante de quien sea.
// ============================================================

/** Cuántas veces se ha vendido algo. Es lo que decide si se puede borrar. */
function vecesVendido(productoId) {
  return bd.prepare(
    'SELECT COUNT(*) n FROM venta_lineas WHERE producto_id = ?'
  ).get(productoId).n;
}

router.delete('/productos/:id', administrar, (req, res) => {
  const p = bd.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
  if (!p) return error(res, 'Ese producto no existe.', 404);

  const vendido = vecesVendido(p.id);
  if (vendido > 0) {
    return error(res,
      `${p.nombre} ya se vendió ${vendido} ${vendido === 1 ? 'vez' : 'veces'}. ` +
      'Eso no se borra, porque su nombre está en tickets ya cobrados. Dale de baja.',
      409, { seVendio: vendido, sugerencia: 'baja' });
  }

  const auth = comprobarAdmin(req.body?.autorizacion);
  if (auth.error) {
    return error(res, auth.error, 403, {
      requiereContrasena: true, administradores: administradores()
    });
  }

  const borrar = bd.transaction(() => {
    // Sus movimientos de inventario se van con él: son la cuenta de piezas
    // de algo que ya no existe, y sin el producto no dicen nada.
    bd.prepare('DELETE FROM movimientos_inventario WHERE producto_id = ?').run(p.id);
    bd.prepare('DELETE FROM productos WHERE id = ?').run(p.id);
  });
  borrar();

  bitacora.registrar({
    accion: 'producto.eliminado', entidad: 'producto', entidadId: p.id,
    ejecutorId: auth.usuario.id, capturistaId: req.usuario.id,
    detalle: { nombre: p.nombre, codigo: p.codigo, categoriaId: p.categoria_id }
  });

  return ok(res, { eliminado: p.nombre });
});

router.delete('/categorias/:id', administrar, (req, res) => {
  const c = bd.prepare('SELECT * FROM categorias WHERE id = ?').get(req.params.id);
  if (!c) return error(res, 'Esa categoría no existe.', 404);

  const dentro = bd.prepare('SELECT COUNT(*) n FROM productos WHERE categoria_id = ?')
    .get(c.id).n;
  if (dentro > 0) {
    return error(res,
      `${c.nombre} todavía tiene ${dentro} producto${dentro === 1 ? '' : 's'} dentro. ` +
      'Saca o borra sus productos primero.', 409, { dentro });
  }

  const auth = comprobarAdmin(req.body?.autorizacion);
  if (auth.error) {
    return error(res, auth.error, 403, {
      requiereContrasena: true, administradores: administradores()
    });
  }

  bd.prepare('DELETE FROM categorias WHERE id = ?').run(c.id);
  bitacora.registrar({
    accion: 'categoria.eliminada', entidad: 'categoria', entidadId: c.id,
    ejecutorId: auth.usuario.id, capturistaId: req.usuario.id,
    detalle: { nombre: c.nombre }
  });

  return ok(res, { eliminada: c.nombre });
});

module.exports = router;
