/**
 * LOS PEDIDOS — las cuentas  (v5.6)
 *
 * ============================================================
 * DOS FORMAS DE VER LO MISMO, Y LAS DOS HACEN FALTA
 * ============================================================
 *
 * "Los pedidos necesito verlos de dos formas: una, al momento de
 *  prepararlos, o sea saber cuántos botellones voy a llenar y cuántas
 *  bolsas voy a subir. Y otra, imprimir las notas de cada uno para que el
 *  repartidor sepa cuánto le toca a cada quien."
 *
 * Son la misma lista mirada desde dos sitios distintos del trabajo:
 *
 *   LO QUE HAY QUE PREPARAR — todo junto, sumado por producto. Es lo que
 *   se lee en la planta con las manos mojadas: "180 bolsas y 40
 *   garrafones". A nadie le importa ahí de quién es cada cosa.
 *
 *   LA NOTA DE CADA UNO — separado por cliente, con su precio y su
 *   dirección. Es lo que va en la mano del repartidor, y ahí lo que no
 *   importa es el total.
 *
 * Sumarlo mal en cualquiera de las dos cuesta un viaje: de menos, se
 * queda un cliente sin su pedido; de más, el hielo se derrite en la
 * camioneta.
 *
 * Nada de esto se guarda sumado (regla 3.2): las líneas de cada pedido
 * son lo que está escrito, y las dos vistas salen de ahí.
 */
const { bd } = require('../../db/conexion');
const { aTexto } = require('../../lib/fracciones');

const hoy = () => new Date().toISOString().slice(0, 10);

/**
 * EN QUÉ ÁREA SE PREPARA CADA COSA.
 *
 * "No estoy seguro si deba haber un botón de tomar un pedido de hielo y
 *  tomar un pedido de agua."
 *
 * No hace falta: un pedido es UNA llamada de UN cliente —"diez garrafones
 * y cincuenta bolsas"— y partirla en dos al capturarla haría que el
 * repartidor llegara con dos notas a la misma puerta.
 *
 * Lo que sí se parte es la PREPARACIÓN, porque ahí sí son dos áreas
 * distintas con dos personas distintas. Y eso se decide por el producto,
 * no por quien capturó.
 */
function areaDe(producto) {
  if (!producto) return 'hielo';                       // hielo suelto
  if (producto.para_agua) return 'agua';
  return 'hielo';
}

const AREAS = {
  hielo: { nombre: 'Hielo', emoji: '🧊' },
  agua: { nombre: 'Agua', emoji: '💧' }
};

/** Las líneas de un pedido, con el área de cada una. */
function lineasDe(pedidoId) {
  return bd.prepare(`
    SELECT pl.*, p.para_agua, p.tipo AS producto_tipo
      FROM pedido_lineas pl
      LEFT JOIN productos p ON p.id = pl.producto_id
     WHERE pl.pedido_id = ?
     ORDER BY pl.rowid
  `).all(pedidoId).map((l) => ({
    ...l,
    area: areaDe(l),
    texto: l.dieciseisavos > 0 ? aTexto(l.dieciseisavos) : String(l.cantidad)
  }));
}

/** Un pedido con todo lo suyo. */
function completo(id) {
  const p = bd.prepare(`
    SELECT pe.*, c.nombre AS cliente_nombre, c.negocio AS cliente_negocio,
           c.numero AS cliente_numero,
           u.nombre AS tomado_por, v.folio AS venta_folio,
           v.serie AS venta_serie, v.folio_anual AS venta_folio_anual
      FROM pedidos pe
      LEFT JOIN clientes c ON c.id = pe.cliente_id
      LEFT JOIN usuarios u ON u.id = pe.ejecutor_id
      LEFT JOIN ventas   v ON v.id = pe.venta_id
     WHERE pe.id = ?
  `).get(id);
  if (!p) return null;

  p.lineas = lineasDe(p.id);
  p.tipoTexto = TIPOS[p.tipo] || TIPOS.domicilio;
  // EN QUÉ CAMIONETA VA  (v6.3), si ya va en una viva. Se consulta aquí
  // mismo y no en reparto/calculo, que a su vez lee de este archivo.
  p.salida = bd.prepare(`
    SELECT s.id, s.folio, s.estado, sp.orden, u.nombre AS repartidor_nombre,
           v.nombre AS vehiculo_nombre
      FROM salida_pedidos sp
      JOIN salidas s ON s.id = sp.salida_id
      LEFT JOIN usuarios  u ON u.id = s.repartidor_id
      LEFT JOIN vehiculos v ON v.id = s.vehiculo_id
     WHERE sp.pedido_id = ? AND s.estado IN ('cargando','en_ruta','regreso')
  `).get(p.id) || null;
  p.total = p.lineas.reduce((n, l) => n + l.precio_centavos, 0);
  p.dieciseisavos = p.lineas.reduce((n, l) => n + l.dieciseisavos, 0);
  // Qué áreas toca este pedido. Lo usa la nota para saber si hay que
  // bajar hielo primero.
  p.areas = [...new Set(p.lineas.map((l) => l.area))];
  return p;
}

/**
 * LA LISTA.
 *
 * Por omisión, lo que está pendiente para hoy o para antes: un pedido de
 * ayer que no salió sigue debiéndose, y esconderlo porque cambió el día
 * es la forma más fácil de perder un cliente.
 */
const TIPOS = {
  domicilio: { texto: 'A domicilio', emoji: '🚚', ayuda: 'Sale en la camioneta con su nota' },
  recoger: { texto: 'Lo recogen', emoji: '🏪', ayuda: 'Se queda aquí hasta que pasen por él' }
};

function lista({ estado = 'pendiente', hasta = null, cliente = null, tipo = null,
                 limite = 200 } = {}) {
  const donde = [];
  const args = [];

  if (estado && estado !== 'todos') { donde.push('pe.estado = ?'); args.push(estado); }
  if (tipo && TIPOS[tipo]) { donde.push('pe.tipo = ?'); args.push(tipo); }
  if (hasta) { donde.push('date(pe.para_cuando) <= date(?)'); args.push(hasta); }
  if (cliente) { donde.push('pe.cliente_id = ?'); args.push(cliente); }

  const filas = bd.prepare(`
    SELECT pe.id FROM pedidos pe
     ${donde.length ? `WHERE ${donde.join(' AND ')}` : ''}
     ORDER BY date(pe.para_cuando) ASC, pe.folio ASC
     LIMIT ?
  `).all(...args, limite);

  return filas.map((f) => completo(f.id));
}

/**
 * LO QUE HAY QUE PREPARAR, sumado por producto y partido por área.
 *
 * El hielo se suma en dieciseisavos y se enseña en marquetas, porque es
 * como se saca del cuarto frío. Lo demás se cuenta en piezas.
 */
function preparacion({ hasta = hoy() } = {}) {
  const pedidos = lista({ estado: 'pendiente', hasta });

  const porArea = {};
  for (const p of pedidos) {
    for (const l of p.lineas) {
      const area = (porArea[l.area] ||= {
        area: l.area, ...AREAS[l.area], productos: new Map(),
        dieciseisavos: 0, centavos: 0
      });
      // La clave es el producto; el hielo suelto —sin producto— se junta
      // todo bajo su concepto, que es lo que se saca del cuarto frío.
      const clave = l.producto_id || `suelto:${l.concepto}`;
      const antes = area.productos.get(clave) || {
        productoId: l.producto_id, concepto: l.concepto,
        cantidad: 0, dieciseisavos: 0, centavos: 0, clientes: 0
      };
      antes.cantidad += l.cantidad;
      antes.dieciseisavos += l.dieciseisavos;
      antes.centavos += l.precio_centavos;
      antes.clientes += 1;
      area.productos.set(clave, antes);

      area.dieciseisavos += l.dieciseisavos;
      area.centavos += l.precio_centavos;
    }
  }

  return {
    hasta,
    pedidos: pedidos.length,
    // Cuántos salen en la camioneta y cuántos se quedan esperando a que
    // pasen por ellos: la planta los prepara todos, pero el que carga el
    // camión necesita saber cuáles NO sube.
    aDomicilio: pedidos.filter((p) => p.tipo === 'domicilio').length,
    aRecoger: pedidos.filter((p) => p.tipo === 'recoger').length,
    clientes: new Set(pedidos.map((p) => p.cliente_id)).size,
    total: pedidos.reduce((n, p) => n + p.total, 0),
    areas: Object.values(porArea).map((a) => ({
      ...a,
      productos: [...a.productos.values()]
        .map((x) => ({ ...x, texto: x.dieciseisavos > 0 ? aTexto(x.dieciseisavos) : String(x.cantidad) }))
        .sort((x, y) => y.cantidad - x.cantidad)
    }))
  };
}

/** Cuántos hay esperando, para el numerito de la caja. */
function cuantosPendientes() {
  return bd.prepare(`
    SELECT COUNT(*) n FROM pedidos
     WHERE estado = 'pendiente' AND date(para_cuando) <= date(?)
  `).get(hoy()).n;
}

module.exports = {
  AREAS, TIPOS, areaDe, hoy, lineasDe, completo, lista, preparacion, cuantosPendientes
};
