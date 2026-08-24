/**
 * INVENTARIO: entradas, salidas y conteos  (v0.13)
 *
 * Lo que hace falta saber de un refresco no es cuánto queda cada hora, es
 * "¿ya hay que pedir?". Por eso esto se revisa cuando toca, y no dos veces
 * al día como el hielo.
 *
 * Nada se borra: un movimiento mal capturado se anula, con motivo (3.4).
 * Y no hay columna con la existencia: se calcula de los movimientos (3.2).
 */
const express = require('express');
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');
const { ok, error } = require('../../lib/respuestas');
const { aCentavos } = require('../../lib/dinero');
const bitacora = require('../../lib/bitacora');
const { exigirPermiso } = require('../../middleware/sesion');
const { puede } = require('../../lib/roles');
const { estadoProducto, movimientos, inventarioCompleto } = require('./inventario');
const { avisos, minimoHielo, guardarMinimoHielo } = require('./avisos');

const router = express.Router();

// El cajero entra a ver cuántas hay y a imprimir la hoja para contar.
const verInventario = exigirPermiso('inventario.ver');
// Registrar entradas, salidas y conteos es del gerente y del administrador.
const moverInventario = exigirPermiso('inventario.mover');
const verCostos = exigirPermiso('costos.ver');

const MAX_PIEZAS = 1000000;

/**
 * Lee una cantidad de piezas. null si no se entiende.
 *
 * No se "limpia" el texto quitándole lo que estorba: si alguien escribe -5,
 * borrarle el signo lo convertiría en una entrada de 5 piezas que nadie
 * pidió. Lo que no sea un número entero de piezas se rechaza y ya.
 */
function leerPiezas(valor, { permitirCero = true } = {}) {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  if (!/^\d+$/.test(texto)) return null;

  const n = Number(texto);
  if (!Number.isInteger(n) || n > MAX_PIEZAS) return null;
  if (!permitirCero && n === 0) return null;
  return n;
}

/**
 * A cómo se compra cada cosa es información del negocio, no del mostrador.
 * A quien no tiene permiso se le quita antes de mandarla: esconderla solo
 * en la pantalla no serviría de nada, los datos igual viajan.
 */
function sinCostos(producto) {
  const { costo_centavos, ...resto } = producto;
  return resto;
}

function puedeVerCostos(req) {
  return Boolean(req.usuario) && puede(req.usuario.rol, 'costos.ver');
}

/**
 * Lo que la caja necesita saber de un vistazo: qué se está acabando y cómo
 * va el hielo. Se declara ANTES que /:productoId, o Express creería que
 * "avisos" es el id de un producto.
 */
router.get('/avisos', verInventario, (req, res) => {
  return ok(res, avisos());
});

/**
 * Cuántas marquetas tienen que quedar para que salte el aviso del hielo.
 * Lo pone quien administra los productos: es el mismo tipo de decisión que
 * el "avisar cuando baje de" de cada refresco.
 */
router.put('/hielo-minimo', exigirPermiso('productos.administrar'), (req, res) => {
  // Sin limpiar a la brava: si "muchas" se convirtiera en 0, el aviso
  // quedaría apagado sin que nadie lo pidiera, y un -3 se leería como 3.
  const crudo = String(req.body?.marquetas ?? '').trim();
  const n = Number(crudo);
  if (!/^\d+$/.test(crudo) || !Number.isInteger(n) || n > 100000) {
    return error(res, 'Escribe con cuántas marquetas quieres que avise.');
  }
  guardarMinimoHielo(n, req.usuario.id);
  bitacora.registrar({
    accion: 'avisos.hielo', entidad: 'configuracion',
    ejecutorId: req.usuario.id, detalle: { marquetas: n }
  });
  return ok(res, { minimoMarquetas: minimoHielo() });
});

/** Todo lo que lleva inventario, con lo que debería haber de cada cosa. */
router.get('/', verInventario, (req, res) => {
  const conCostos = puedeVerCostos(req);
  const inventario = inventarioCompleto().map((i) => ({
    ...i,
    producto: conCostos ? i.producto : sinCostos(i.producto)
  }));

  return ok(res, {
    inventario,
    conCostos,
    // Lo que ya toca pedir: es la razón de ser de esta pantalla.
    bajos: inventario.filter((i) => i.bajo).length
  });
});

router.get('/:productoId', verInventario, (req, res) => {
  const p = bd.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.productoId);
  if (!p) return error(res, 'Ese producto no existe.', 404);

  const conCostos = puedeVerCostos(req);
  return ok(res, {
    producto: conCostos ? p : sinCostos(p),
    estado: estadoProducto(p),
    conCostos,
    // Los movimientos traen el costo de cada compra: mismo criterio.
    movimientos: movimientos(p.id).map((m) =>
      conCostos ? m : { ...m, costo_centavos: undefined })
  });
});

// ============================================================
// ENTRADAS Y SALIDAS
// ============================================================

/**
 * Entró mercancía (llegó el proveedor) o salió sin venderse (se rompió, se
 * la llevaron para la fiesta de la fábrica...).
 */
router.post('/:productoId/movimientos', moverInventario, (req, res) => {
  const p = bd.prepare('SELECT * FROM productos WHERE id = ? AND activo = 1')
    .get(req.params.productoId);
  if (!p) return error(res, 'Ese producto no existe.', 404);
  if (!p.lleva_inventario) {
    return error(res, `${p.nombre} no lleva inventario. Actívalo primero.`, 409);
  }

  const tipo = req.body?.tipo;
  if (tipo !== 'entrada' && tipo !== 'salida') {
    return error(res, 'El movimiento es una entrada o una salida.');
  }

  const cantidad = leerPiezas(req.body?.cantidad, { permitirCero: false });
  if (cantidad === null) return error(res, 'Escribe cuántas piezas.');

  // El costo solo tiene sentido cuando entra mercancía, y se COPIA aquí
  // (regla 3.5): si mañana sube el proveedor, lo que costó esta compra no
  // cambia.
  let costo = null;
  if (tipo === 'entrada' && req.body?.costo !== undefined
      && req.body.costo !== null && req.body.costo !== '') {
    try { costo = aCentavos(String(req.body.costo).replace(/[^0-9.]/g, '')); }
    catch { return error(res, 'Ese costo no es válido.'); }
  }

  const id = nuevoId();
  const ejecutorId = req.body?.ejecutorId || req.usuario.id;

  const guardar = bd.transaction(() => {
    bd.prepare(`
      INSERT INTO movimientos_inventario
        (id, producto_id, fecha, tipo, cantidad, costo_centavos, concepto,
         ejecutor_id, capturista_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, p.id, ahora(), tipo, cantidad, costo,
           String(req.body?.concepto || '').slice(0, 80) || null,
           ejecutorId, req.usuario.id);

    // El último costo de compra se guarda en el producto para tenerlo a
    // mano al ver la ganancia, pero el bueno de cada compra vive en su
    // movimiento.
    if (costo !== null) {
      bd.prepare('UPDATE productos SET costo_centavos = ? WHERE id = ?').run(costo, p.id);
    }
  });
  guardar();

  bitacora.registrar({
    accion: `inventario.${tipo}`, entidad: 'producto', entidadId: p.id,
    ejecutorId, capturistaId: req.usuario.id,
    detalle: { producto: p.nombre, cantidad, costo }
  });

  return ok(res, { estado: estadoProducto(p), movimientos: movimientos(p.id) }, 201);
});

/**
 * CONTAR. Se cuenta lo que hay físicamente y el sistema dice si falta.
 * El conteo se guarda con los números congelados, igual que el del cuarto
 * frío: corregir después una entrada vieja no cambia un conteo ya hecho.
 */
router.post('/:productoId/conteo', moverInventario, (req, res) => {
  const p = bd.prepare('SELECT * FROM productos WHERE id = ? AND activo = 1')
    .get(req.params.productoId);
  if (!p) return error(res, 'Ese producto no existe.', 404);
  if (!p.lleva_inventario) {
    return error(res, `${p.nombre} no lleva inventario. Actívalo primero.`, 409);
  }

  const contado = leerPiezas(req.body?.contado);
  if (contado === null) return error(res, 'Escribe cuántas piezas contaste.');

  const antes = estadoProducto(p);
  const falta = antes.esperado - contado;

  const id = nuevoId();
  bd.prepare(`
    INSERT INTO movimientos_inventario
      (id, producto_id, fecha, tipo, cantidad, concepto, ejecutor_id, capturista_id)
    VALUES (?, ?, ?, 'conteo', ?, ?, ?, ?)
  `).run(id, p.id, ahora(), contado,
         falta === 0 ? 'Cuadró' : falta > 0 ? `Faltaron ${falta}` : `Sobraron ${-falta}`,
         req.body?.ejecutorId || req.usuario.id, req.usuario.id);

  bitacora.registrar({
    accion: 'inventario.conteo', entidad: 'producto', entidadId: p.id,
    ejecutorId: req.body?.ejecutorId || req.usuario.id, capturistaId: req.usuario.id,
    detalle: { producto: p.nombre, esperado: antes.esperado, contado, falta }
  });

  return ok(res, {
    resumen: { ...antes, contado, falta },
    estado: estadoProducto(p)
  }, 201);
});

/** Anular un movimiento mal capturado. No se borra: se marca. */
router.post('/movimientos/:id/anular', verCostos, (req, res) => {
  const m = bd.prepare('SELECT * FROM movimientos_inventario WHERE id = ?')
    .get(req.params.id);
  if (!m) return error(res, 'Ese movimiento no existe.', 404);
  if (m.anulado_en) return error(res, 'Ese movimiento ya está anulado.');

  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) return error(res, 'Escribe por qué se anula.');

  bd.prepare(`
    UPDATE movimientos_inventario
       SET anulado_en = ?, anulado_por = ?, motivo_anulacion = ?
     WHERE id = ?
  `).run(ahora(), req.usuario.id, motivo, m.id);

  bitacora.registrar({
    accion: 'inventario.anulado', entidad: 'producto', entidadId: m.producto_id,
    ejecutorId: req.usuario.id, detalle: { motivo, tipo: m.tipo, cantidad: m.cantidad }
  });

  const p = bd.prepare('SELECT * FROM productos WHERE id = ?').get(m.producto_id);
  return ok(res, { estado: estadoProducto(p), movimientos: movimientos(p.id) });
});

module.exports = router;
