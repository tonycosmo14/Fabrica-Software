/**
 * EL CATÁLOGO Y LA COTIZACIÓN
 *
 * Un solo lugar decide cuánto cuesta cualquier cosa que se toca en la caja.
 * Dos clases de producto, dos formas de sacar el precio:
 *
 *   hielo   → de la lista de precios por fracción (regla 7.2). El precio NO
 *             vive en el producto: si viviera en los dos lados, un día los
 *             dos números dirían cosas distintas.
 *   simple  → su propio precio, ahí mismo.
 *
 * La pantalla hace esta misma cuenta para responder al instante, pero EL QUE
 * MANDA ES ESTE: al cobrar, el servidor vuelve a cotizar desde cero.
 */
const { bd } = require('../../db/conexion');
const { precioDe } = require('../ventas/precios');

function categoriasActivas() {
  return bd.prepare('SELECT * FROM categorias WHERE activo = 1 ORDER BY orden, nombre').all();
}

function productosActivos() {
  return bd.prepare(`
    SELECT p.*, c.nombre AS categoria_nombre, c.color AS categoria_color,
           c.foto AS categoria_foto
      FROM productos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
     WHERE p.activo = 1
     ORDER BY p.orden, p.nombre
  `).all();
}

function productoPorId(id) {
  return bd.prepare('SELECT * FROM productos WHERE id = ? AND activo = 1').get(id || null) || null;
}

/**
 * Lo que teclea el cajero: "18" y enter.
 *
 * Sin distinguir mayúsculas de minúsculas: los códigos se guardan en
 * mayúsculas, pero nadie va a poner el bloqueo de mayúsculas para teclear
 * "1M" con un cliente enfrente, y un código que a veces funciona y a veces
 * no es peor que no tenerlo.
 */
function productoPorCodigo(codigo) {
  const limpio = String(codigo ?? '').trim();
  if (!limpio) return null;
  return bd.prepare(
    'SELECT * FROM productos WHERE upper(codigo) = upper(?) AND activo = 1'
  ).get(limpio) || null;
}

/**
 * Cuánto cuesta una línea, y cómo se llama en el ticket.
 *
 * Devuelve { centavos, dieciseisavos, concepto, desglose, faltan } o lanza
 * si no se puede cotizar. `faltan` son las fracciones sin precio en la
 * lista: hay que capturarlas antes de poder cobrar.
 */
function cotizar({ producto, dieciseisavos, listaId, cantidad = 1 }) {
  const veces = Number.isInteger(cantidad) && cantidad > 0 ? cantidad : 1;

  // Hielo suelto de la calculadora: no hay producto, solo una cantidad.
  if (!producto) {
    const p = precioDe(dieciseisavos, listaId);
    return {
      centavos: p.centavos * veces,
      dieciseisavos: dieciseisavos * veces,
      concepto: 'Hielo',
      desglose: p.desglose,
      faltan: p.faltan
    };
  }

  if (producto.tipo === 'hielo') {
    const total = producto.dieciseisavos * veces;
    const p = precioDe(total, listaId);
    return {
      centavos: p.centavos,
      dieciseisavos: total,
      concepto: producto.nombre,
      desglose: p.desglose,
      faltan: p.faltan
    };
  }

  // EL PRECIO POR VOLUMEN  (v7.1). "De cincuenta bolsas para arriba, a
  // $16.50." Le toca a QUIEN SEA que se lleve cincuenta: no es un trato
  // con nadie, es cuánto vale comprar mucho. El convenio de un cliente
  // concreto se aplica después y le gana (ventas/rutas.js).
  const unitario = precioPorVolumen(producto, veces);

  return {
    centavos: unitario * veces,
    dieciseisavos: 0,                       // no sale del cuarto frío
    concepto: producto.nombre,
    desglose: veces > 1 ? `${veces} × ${producto.nombre}` : null,
    // Para que el ticket y la pantalla puedan decir POR QUÉ salió más
    // barato. Sin esto, un total que no cuadra con el precio de la lista
    // parece un error del sistema.
    porVolumen: unitario !== producto.precio_centavos
      ? { desde: producto.mayoreo_desde, unitario } : null,
    faltan: []
  };
}

/**
 * CUÁNTO VALE LA PIEZA LLEVÁNDOSE ESTAS.
 *
 * Los dos datos van juntos: un "a partir de 50" sin precio, o un precio
 * sin "a partir de", no dicen nada y la regla no se aplica. Así no hace
 * falta un interruptor aparte que pueda quedar en desacuerdo con los
 * números.
 */
function precioPorVolumen(producto, cuantas) {
  const desde = producto?.mayoreo_desde;
  const precio = producto?.mayoreo_centavos;
  if (!Number.isInteger(desde) || desde < 1) return producto.precio_centavos;
  if (precio === null || precio === undefined) return producto.precio_centavos;
  return cuantas >= desde ? precio : producto.precio_centavos;
}

module.exports = {
  categoriasActivas, productosActivos, productoPorId, productoPorCodigo, cotizar,
  precioPorVolumen
};
