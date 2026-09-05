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
           c.numero AS cliente_numero, c.giro AS cliente_giro,
           c.razon_social AS cliente_razon_social, c.rfc AS cliente_rfc,
           c.zona AS cliente_zona, c.dias_plazo AS cliente_dias_plazo,
           c.metodo_pago AS cliente_metodo_pago,
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
           u.telefono AS repartidor_telefono,
           v.nombre AS vehiculo_nombre, v.placas AS vehiculo_placas
      FROM salida_pedidos sp
      JOIN salidas s ON s.id = sp.salida_id
      LEFT JOIN usuarios  u ON u.id = s.repartidor_id
      LEFT JOIN vehiculos v ON v.id = s.vehiculo_id
     WHERE sp.pedido_id = ? AND s.estado IN ('cargando','en_ruta','regreso')
  `).get(p.id) || null;
  p.etapa = etapaDe(p);
  p.etapaTexto = ETAPAS.find((e) => e.clave === p.etapa) || null;
  p.total = p.lineas.reduce((n, l) => n + l.precio_centavos, 0);
  p.dieciseisavos = p.lineas.reduce((n, l) => n + l.dieciseisavos, 0);
  // Qué áreas toca este pedido. Lo usa la nota para saber si hay que
  // bajar hielo primero.
  p.areas = [...new Set(p.lineas.map((l) => l.area))];
  return p;
}

/**
 * LAS ETAPAS POR LAS QUE PASA UN PEDIDO  (v7.0)
 *
 * En la base solo hay TRES estados —pendiente, entregado, cancelado— y
 * está bien que así sea: son los tres que cambian el dinero. Pero quien
 * mira la pantalla de despacho necesita ver cinco, porque un pendiente
 * que sigue en la planta y uno que ya va en la camioneta no se atienden
 * igual.
 *
 * Las dos de en medio NO son columnas nuevas: SE DEDUCEN de si el pedido
 * está metido en una salida y de cómo va esa salida. Guardarlas sería
 * tener dos verdades sobre lo mismo, y el día que no cuadren nadie sabría
 * cuál creer — que es exactamente lo que pasa con los contadores.
 *
 *   pendiente     tomado, todavía en la planta, sin camioneta
 *   preparacion   ya está en una salida que se está cargando
 *   ruta          su salida ya salió (o viene de regreso)
 *   entregado     llegó y se convirtió en venta
 *   cancelado     no se va a llevar
 */
// `nombre` es el rótulo de la tarjeta, que cuenta varios; `uno` es cómo se
// dice de UN pedido en su ficha. "Entregados" encima de un solo pedido se
// lee mal, y ponerlo en singular en la tarjeta se leería peor.
const ETAPAS = [
  { clave: 'todos', nombre: 'Todos', uno: 'Todos', emoji: '📋', pie: 'del flujo' },
  { clave: 'pendiente', nombre: 'Pendientes', uno: 'Pendiente', emoji: '🕒', pie: 'en la planta' },
  { clave: 'preparacion', nombre: 'En preparación', uno: 'En preparación', emoji: '❄️', pie: 'cargando' },
  { clave: 'ruta', nombre: 'En ruta', uno: 'En ruta', emoji: '🚚', pie: 'en la calle' },
  { clave: 'entregado', nombre: 'Entregados', uno: 'Entregado', emoji: '✅', pie: 'con firma' },
  { clave: 'cancelado', nombre: 'Cancelados', uno: 'Cancelado', emoji: '⛔', pie: 'no se llevaron' }
];

/** En qué etapa está este pedido, mirando su estado y su salida. */
function etapaDe(p) {
  if (p.estado === 'entregado') return 'entregado';
  if (p.estado === 'cancelado') return 'cancelado';
  if (!p.salida) return 'pendiente';
  return p.salida.estado === 'cargando' ? 'preparacion' : 'ruta';
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

function lista({ estado = 'pendiente', hasta = null, desde = null, cliente = null,
                 tipo = null, busca = null, producto = null, etapa = null,
                 limite = 200 } = {}) {
  const donde = [];
  const args = [];

  if (estado && estado !== 'todos') { donde.push('pe.estado = ?'); args.push(estado); }
  if (tipo && TIPOS[tipo]) { donde.push('pe.tipo = ?'); args.push(tipo); }
  if (hasta) { donde.push('date(pe.para_cuando) <= date(?)'); args.push(hasta); }
  if (desde) { donde.push('date(pe.para_cuando) >= date(?)'); args.push(desde); }
  if (cliente) { donde.push('pe.cliente_id = ?'); args.push(cliente); }

  // BUSCAR POR LO QUE UNO SE ACUERDA  (v7.0): el número de guía, el
  // nombre, el rótulo o la calle. Nadie se acuerda del id.
  if (busca) {
    const t = `%${String(busca).trim().toLowerCase()}%`;
    // El folio se busca aparte y por igualdad: "8" tiene que traer el
    // pedido 8, no los ciento ochenta que lo llevan dentro.
    const soloNumero = /^#?(?:gl-)?0*(\d+)$/i.exec(String(busca).trim());
    donde.push(`(
      ${soloNumero ? 'pe.folio = ? OR' : ''}
      lower(COALESCE(c.nombre, '')) LIKE ? OR
      lower(COALESCE(c.negocio, '')) LIKE ? OR
      lower(COALESCE(c.giro, '')) LIKE ? OR
      lower(COALESCE(pe.direccion, '')) LIKE ?
    )`);
    if (soloNumero) args.push(Number(soloNumero[1]));
    args.push(t, t, t, t);
  }

  // POR PRODUCTO: los pedidos que llevan ESA cosa. Es la pregunta de
  // "¿quién pidió garrafones hoy?" cuando la planta va corta.
  if (producto) {
    donde.push(`EXISTS (SELECT 1 FROM pedido_lineas pl
                         WHERE pl.pedido_id = pe.id AND pl.producto_id = ?)`);
    args.push(producto);
  }

  const filas = bd.prepare(`
    SELECT pe.id FROM pedidos pe
      LEFT JOIN clientes c ON c.id = pe.cliente_id
     ${donde.length ? `WHERE ${donde.join(' AND ')}` : ''}
     ORDER BY date(pe.para_cuando) ASC, pe.folio ASC
     LIMIT ?
  `).all(...args, limite);

  const pedidos = filas.map((f) => completo(f.id));

  // La etapa se filtra AQUÍ y no en el SQL porque se deduce de la salida,
  // y esa vive en otras dos tablas. Con doscientos pedidos como tope, la
  // consulta que lo haría en SQL costaría más de leer que de correr.
  return etapa && etapa !== 'todos'
    ? pedidos.filter((p) => p.etapa === etapa)
    : pedidos;
}

/**
 * CUÁNTOS HAY EN CADA ETAPA, para los números de arriba.
 *
 * Se cuentan sobre EL MISMO RANGO que se está mirando: si la pantalla
 * enseña lo de hoy, los números son de hoy. Unos contadores de todo el
 * año encima de una lista de hoy no dicen nada de lo que hay que hacer.
 */
function resumen({ hasta = null, desde = null } = {}) {
  const todos = lista({ estado: 'todos', hasta, desde, limite: 2000 });

  const cuenta = {};
  for (const e of ETAPAS) cuenta[e.clave] = 0;
  cuenta.todos = todos.length;
  for (const p of todos) cuenta[p.etapa] = (cuenta[p.etapa] || 0) + 1;

  // Las camionetas distintas que andan en la calle con algo de esto.
  const unidades = new Set(
    todos.filter((p) => p.etapa === 'ruta' && p.salida?.vehiculo_nombre)
         .map((p) => p.salida.vehiculo_nombre)
  );

  return {
    ...cuenta,
    unidades: unidades.size,
    // Cuánto vale lo que está en pie: lo entregado ya es una venta y lo
    // cancelado no vale nada.
    porCobrar: todos.filter((p) => p.estado === 'pendiente')
                    .reduce((n, p) => n + p.total, 0),
    // Qué parte del flujo se canceló. Cero es la respuesta buena.
    porcentajeCancelados: todos.length
      ? Math.round((cuenta.cancelado / todos.length) * 1000) / 10 : 0
  };
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
  AREAS, TIPOS, ETAPAS, etapaDe, areaDe, hoy, lineasDe, completo, lista,
  preparacion, cuantosPendientes, resumen
};
