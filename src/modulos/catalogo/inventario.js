/**
 * INVENTARIO DE LO QUE NO ES HIELO  (v0.13)
 *
 *     lo que había + lo que entró − lo vendido = DEBERÍA HABER
 *     debería haber − contado = FALTA
 *
 * La misma cuenta que la existencia del cuarto frío, a propósito: quien
 * entendió una entiende la otra. Lo que cambia es el ritmo. El hielo se
 * cuenta dos veces al día porque se derrite; los refrescos se cuentan
 * cuando toca, y lo que se quiere saber de ellos es qué hay que pedir.
 *
 * REGLA 3.2: aquí no hay ninguna columna con "cuántos hay". Se calcula de
 * los movimientos cada vez que se pregunta. Un número guardado se
 * desincroniza el día que algo se corte a la mitad; una suma, no puede.
 */
const { bd } = require('../../db/conexion');

/** El último conteo válido de un producto. Los anulados no cuentan. */
function ultimoConteo(productoId) {
  return bd.prepare(`
    SELECT * FROM movimientos_inventario
     WHERE producto_id = ? AND tipo = 'conteo' AND anulado_en IS NULL
     ORDER BY fecha DESC LIMIT 1
  `).get(productoId) || null;
}

/** Entradas y salidas capturadas a mano desde una fecha. */
function movidoDesde(productoId, desde) {
  const fila = bd.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN cantidad END), 0) AS entradas,
      COALESCE(SUM(CASE WHEN tipo = 'salida'  THEN cantidad END), 0) AS salidas
    FROM movimientos_inventario
     WHERE producto_id = ? AND anulado_en IS NULL AND fecha > ?
  `).get(productoId, desde || '');
  return fila;
}

/**
 * Piezas vendidas con ticket desde una fecha. Las canceladas no cuentan.
 * Se suman PIEZAS, no renglones: "2 × Coca" son dos refrescos.
 */
function vendidoDesde(productoId, desde) {
  return bd.prepare(`
    SELECT COALESCE(SUM(vl.cantidad), 0) n
      FROM venta_lineas vl
      JOIN ventas v ON v.id = vl.venta_id
     WHERE vl.producto_id = ?
       AND v.cancelada_en IS NULL
       AND v.fecha > ?
  `).get(productoId, desde || '').n;
}

/**
 * Foto de cómo va un producto ahora mismo.
 * `esperado` es contra lo que se compara al contar.
 */
function estadoProducto(producto) {
  const conteo = ultimoConteo(producto.id);
  const desde = conteo?.fecha || null;
  const { entradas, salidas } = movidoDesde(producto.id, desde);
  const vendido = vendidoDesde(producto.id, desde);
  const anterior = conteo?.cantidad ?? 0;

  return {
    ultimoConteo: conteo,
    anterior,
    entradas,
    salidas,
    vendido,
    esperado: anterior + entradas - salidas - vendido,
    bajo: producto.minimo != null &&
          (anterior + entradas - salidas - vendido) <= producto.minimo
  };
}

/** Los movimientos de un producto, del más nuevo al más viejo. */
function movimientos(productoId, limite = 30) {
  return bd.prepare(`
    SELECT m.*, u.nombre AS ejecutor_nombre, a.nombre AS anulado_por_nombre
      FROM movimientos_inventario m
      LEFT JOIN usuarios u ON u.id = m.ejecutor_id
      LEFT JOIN usuarios a ON a.id = m.anulado_por
     WHERE m.producto_id = ?
     ORDER BY m.fecha DESC LIMIT ?
  `).all(productoId, limite);
}

/** Todo lo que lleva inventario, con su estado. Para la pantalla y el conteo. */
function inventarioCompleto() {
  const productos = bd.prepare(`
    SELECT p.*, c.nombre AS categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
     WHERE p.activo = 1 AND p.lleva_inventario = 1
     ORDER BY c.orden, p.orden, p.nombre
  `).all();

  return productos.map((p) => ({ producto: p, ...estadoProducto(p) }));
}

module.exports = {
  ultimoConteo, movidoDesde, vendidoDesde, estadoProducto,
  movimientos, inventarioCompleto
};
