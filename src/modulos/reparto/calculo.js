/**
 * EL REPARTO — las cuentas  (v5.7)
 *
 * ============================================================
 * DOS CUENTAS, Y NINGUNA SE GUARDA SUMADA
 * ============================================================
 *
 *     LA MERCANCÍA
 *     lo que subió − lo vendido − lo que volvió = LA MERMA
 *
 *     EL DINERO
 *     lo cobrado en efectivo − lo que entregó = LA DIFERENCIA
 *
 * Las dos salen de las líneas, cada vez que se preguntan (regla 3.2). Una
 * columna "total" guardada aquí se desincronizaría el día que alguien
 * corrija una entrega, y nadie volvería a confiar en el cuadre.
 *
 * ============================================================
 * POR QUÉ LA MERMA SE CALCULA Y NO SE TECLEA
 * ============================================================
 *
 * Porque teclearla es pedirle a alguien que confiese. Lo que se teclea es
 * lo que se puede contar con las manos —cuánto volvió— y la merma sale
 * sola de la resta. Así el número es el que es, y la conversación deja de
 * ser "¿cuánto se te derritió?" para ser "volvieron dos, ¿verdad?".
 */
const { bd } = require('../../db/conexion');
const { aTexto } = require('../../lib/fracciones');
const pedidos = require('../pedidos/calculo');

const ajuste = (clave, porOmision) => {
  const f = bd.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(clave);
  return f?.valor ?? porOmision;
};

const ESTADOS = {
  cargando:  { texto: 'Cargando',    emoji: '📦', ayuda: 'Se le está subiendo la carga' },
  en_ruta:   { texto: 'En la calle', emoji: '🚚', ayuda: 'Salió y todavía no vuelve' },
  regreso:   { texto: 'Regresó',     emoji: '🏠', ayuda: 'Volvió; falta cuadrarla' },
  liquidada: { texto: 'Liquidada',   emoji: '✅', ayuda: 'Cuadrada y cerrada' },
  cancelada: { texto: 'Cancelada',   emoji: '✖️', ayuda: 'No salió' }
};

/**
 * Reparte un importe entre la parte que se vendió.
 *
 * Se redondea al PESO más cercano y no al centavo: en la calle no hay
 * monedas de veinte centavos, y un ticket que pide $126.40 obliga al
 * repartidor a inventar el cambio.
 */
function prorrata(centavos, total, parte) {
  if (!total || !parte) return 0;
  if (parte >= total) return centavos;
  return Math.round((centavos * parte) / total / 100) * 100;
}

/** Lo que lleva de carga suelta, con lo capturado al volver si ya volvió. */
function cargaDe(salidaId) {
  return bd.prepare(`
    SELECT sc.*, p.nombre AS producto_nombre, p.para_agua, p.lleva_inventario
      FROM salida_carga sc
      LEFT JOIN productos p ON p.id = sc.producto_id
     WHERE sc.salida_id = ?
     ORDER BY sc.rowid
  `).all(salidaId).map((l) => {
    // NULL en vendido/regreso significa "todavía no se ha capturado", que
    // no es lo mismo que cero: confundirlos cargaría de merma un viaje que
    // todavía no ha terminado.
    const capturado = l.vendido_cantidad !== null || l.regreso_cantidad !== null;
    const vendidoC = l.vendido_cantidad ?? 0;
    const vendidoD = l.vendido_dieciseisavos ?? 0;
    const regresoC = l.regreso_cantidad ?? 0;
    const regresoD = l.regreso_dieciseisavos ?? 0;

    return {
      ...l,
      capturado,
      vendidoCantidad: vendidoC,
      vendidoDieciseisavos: vendidoD,
      regresoCantidad: regresoC,
      regresoDieciseisavos: regresoD,
      mermaCantidad: capturado ? Math.max(0, l.cantidad - vendidoC - regresoC) : 0,
      mermaDieciseisavos: capturado ? Math.max(0, l.dieciseisavos - vendidoD - regresoD) : 0,
      // Lo que valió lo vendido de esta línea, al precio que se copió al
      // salir. El hielo va a prorrata de lo que subió, que es la única
      // forma de repartir el precio de una línea entre fracciones sin
      // volver a cotizar — y volver a cotizar cambiaría lo prometido.
      vendidoCentavos: l.dieciseisavos > 0
        ? prorrata(l.precio_centavos, l.dieciseisavos, vendidoD)
        : l.precio_centavos * vendidoC,
      texto: l.dieciseisavos > 0 ? aTexto(l.dieciseisavos) : String(l.cantidad)
    };
  });
}

/** Los pedidos que lleva, con todo lo suyo. */
function pedidosDe(salidaId) {
  const filas = bd.prepare(`
    SELECT sp.pedido_id, sp.no_entregado_motivo
      FROM salida_pedidos sp
      JOIN pedidos pe ON pe.id = sp.pedido_id
     WHERE sp.salida_id = ?
     ORDER BY pe.folio
  `).all(salidaId);
  return filas
    .map((f) => {
      const p = pedidos.completo(f.pedido_id);
      return p ? { ...p, noEntregadoMotivo: f.no_entregado_motivo } : null;
    })
    .filter(Boolean);
}

/**
 * UNA SALIDA CON TODAS SUS CUENTAS.
 *
 * Es lo que lee la pantalla del cuadre: los tres números de los que se
 * habla con el repartidor enfrente —qué llevaba, qué trajo de vuelta y
 * cuánto dinero debería traer—.
 */
function completa(id) {
  const s = bd.prepare(`
    SELECT s.*, v.nombre AS vehiculo_nombre, v.capacidad_marquetas,
           r.nombre AS repartidor_nombre,
           re.nombre AS recibido_por_nombre, li.nombre AS liquidada_por_nombre,
           ve.folio AS venta_suelto_folio
      FROM salidas s
      LEFT JOIN vehiculos v ON v.id = s.vehiculo_id
      LEFT JOIN usuarios  r ON r.id = s.repartidor_id
      LEFT JOIN usuarios re ON re.id = s.recibido_por
      LEFT JOIN usuarios li ON li.id = s.liquidada_por
      LEFT JOIN ventas   ve ON ve.id = s.venta_suelto_id
     WHERE s.id = ?
  `).get(id);
  if (!s) return null;

  s.estadoTexto = ESTADOS[s.estado] || ESTADOS.cargando;
  s.pedidos = pedidosDe(s.id);
  s.carga = cargaDe(s.id);

  // ---- LA MERCANCÍA ----
  const hieloPedidos = s.pedidos.reduce((n, p) => n + p.dieciseisavos, 0);
  const hieloSuelto = s.carga.reduce((n, l) => n + l.dieciseisavos, 0);

  s.hielo = {
    pedidos: hieloPedidos,
    suelto: hieloSuelto,
    subio: hieloPedidos + hieloSuelto,
    // De los pedidos no hay merma que calcular: o llegaron a su puerta o
    // volvieron enteros. La merma vive en lo suelto, que es lo que anduvo
    // dando vueltas medio día.
    merma: 0
  };
  s.hielo.merma = s.carga.reduce((n, l) => n + l.mermaDieciseisavos, 0);
  s.hielo.textos = {
    subio: aTexto(s.hielo.subio), suelto: aTexto(s.hielo.suelto),
    pedidos: aTexto(s.hielo.pedidos), merma: aTexto(s.hielo.merma)
  };
  s.hielo.porcientoMerma = s.hielo.suelto
    ? Math.round((s.hielo.merma / s.hielo.suelto) * 100) : 0;
  s.hielo.mermaNormal = Number(ajuste('reparto_merma_normal', '8')) || 8;
  s.hielo.mermaAlta = s.hielo.porcientoMerma > s.hielo.mermaNormal;

  // ¿Cabe en el vehículo? Avisa ANTES de salir, que es cuando sirve de
  // algo: sobrecargar la camioneta es la forma más común de que el hielo
  // llegue derretido.
  s.cabe = s.capacidad_marquetas ? s.hielo.subio <= s.capacidad_marquetas * 16 : true;

  // ---- EL DINERO ----
  //
  // Solo el EFECTIVO. Lo que se fue a crédito o por transferencia no viene
  // en la bolsa del repartidor, y pedírselo sería pedirle dinero que nadie
  // le dio.
  const entregados = s.pedidos.filter((p) => p.estado === 'entregado');
  const enEfectivo = entregados.filter((p) => p.forma_pago === 'efectivo');

  s.dinero = {
    pedidosEfectivo: enEfectivo.reduce((n, p) => n + p.total, 0),
    suelto: s.carga.reduce((n, l) => n + l.vendidoCentavos, 0),
    credito: entregados.filter((p) => p.forma_pago === 'credito')
      .reduce((n, p) => n + p.total, 0),
    transferencia: entregados.filter((p) => p.forma_pago === 'transferencia')
      .reduce((n, p) => n + p.total, 0)
  };
  s.dinero.esperado = s.dinero.pedidosEfectivo + s.dinero.suelto;
  // Lo que se le pidió el día que se recibió, copiado (regla 3.5): si
  // después se corrige una entrega, el papel que firmó sigue diciendo lo
  // que decía cuando lo firmó.
  s.dinero.esperadoAlRecibir = s.efectivo_esperado_centavos;
  s.dinero.recibido = s.efectivo_recibido_centavos;
  s.dinero.diferencia = s.efectivo_recibido_centavos === null ? null
    : s.efectivo_recibido_centavos - (s.efectivo_esperado_centavos ?? s.dinero.esperado);
  s.dinero.cuadra = s.dinero.diferencia === 0;

  s.entregados = entregados.length;
  s.sinEntregar = s.pedidos.filter((p) => p.estado === 'pendiente').length;
  s.total = s.dinero.esperado + s.dinero.credito + s.dinero.transferencia;

  return s;
}

/** Las salidas, filtradas como las pide la pantalla. */
function lista({ estado = null, repartidor = null, desde = null, limite = 60 } = {}) {
  const donde = [];
  const args = [];
  if (estado === 'abiertas') donde.push("s.estado IN ('cargando','en_ruta','regreso')");
  else if (estado && estado !== 'todas') { donde.push('s.estado = ?'); args.push(estado); }
  if (repartidor) { donde.push('s.repartidor_id = ?'); args.push(repartidor); }
  if (desde) { donde.push('date(s.fecha) >= date(?)'); args.push(desde); }

  return bd.prepare(`
    SELECT s.id FROM salidas s
     ${donde.length ? `WHERE ${donde.join(' AND ')}` : ''}
     ORDER BY s.fecha DESC, s.folio DESC
     LIMIT ?
  `).all(...args, limite).map((f) => completa(f.id));
}

/**
 * LAS QUE ESPERAN DINERO EN LA CAJA.
 *
 * "Cuando el repartidor regrese, a quien le va a entregar el dinero es a
 *  quien esté en caja."
 *
 * Es lo que se le enseña a la cajera dentro de vender: las que ya
 * volvieron y todavía no le han entregado el efectivo.
 */
function porRecibir() {
  return bd.prepare(`
    SELECT id FROM salidas
     WHERE estado = 'regreso' AND recibido_en IS NULL
     ORDER BY regreso_en
  `).all().map((f) => completa(f.id));
}

/** Cuántas andan en la calle, para el numerito de la caja. */
function cuantasAbiertas() {
  return bd.prepare(
    "SELECT COUNT(*) n FROM salidas WHERE estado IN ('cargando','en_ruta','regreso')"
  ).get().n;
}

/** ¿Este pedido ya va en alguna salida viva? Uno no puede ir en dos. */
function salidaDelPedido(pedidoId) {
  return bd.prepare(`
    SELECT s.id, s.folio, s.estado
      FROM salida_pedidos sp
      JOIN salidas s ON s.id = sp.salida_id
     WHERE sp.pedido_id = ? AND s.estado IN ('cargando','en_ruta','regreso')
  `).get(pedidoId) || null;
}

module.exports = {
  ESTADOS, prorrata, cargaDe, pedidosDe, completa, lista, porRecibir,
  cuantasAbiertas, salidaDelPedido, ajuste
};
