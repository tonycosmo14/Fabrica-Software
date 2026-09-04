/**
 * LAS NEVERAS — las cuentas  (v5.1)
 *
 * EL NÚMERO QUE DECIDE TODO
 *
 * De cada nevera, uno solo: **¿ya se pagó?**
 *
 *     lo que ha comprado de bolsas
 *   − lo que costó la nevera
 *   − lo que han costado sus mantenimientos
 *   − lo que se le ha regalado
 *   = a favor  (o lo que le falta para pagarse)
 *
 * Ese número es el que dice qué neveras valen la pena y cuáles hay que
 * recoger, y es la razón de que existan las cortesías como tabla: sin
 * restar lo regalado, la nevera del cliente al que más se le consiente es
 * justo la que sale mejor.
 *
 * Nada de esto se guarda (regla 3.2): se saca cada vez de las ventas, los
 * servicios y las cortesías, que son los que sí están escritos.
 */
const { bd } = require('../../db/conexion');

/**
 * Cada estado con dos nombres. El `corto` es para el renglón de la lista,
 * donde hay ochenta píxeles; el `nombre` es para la ficha, donde sí cabe
 * decir las cosas como son.
 */
const ESTADOS = {
  bodega: { nombre: 'En bodega', corto: 'En bodega', tono: 'libre' },
  prestada: { nombre: 'Prestada', corto: 'Prestada', tono: 'bien' },
  en_uso: { nombre: 'La usa la fábrica', corto: 'En la fábrica', tono: 'propio' },
  reparacion: { nombre: 'Por reparar', corto: 'Por reparar', tono: 'malo' },
  perdida: { nombre: 'No se sabe dónde está', corto: 'Perdida', tono: 'perdida' },
  baja: { nombre: 'De baja', corto: 'De baja', tono: 'baja' }
};

const hoy = () => new Date().toISOString().slice(0, 10);

/** Cuántos días pasaron entre dos fechas de calendario. */
function diasEntre(desde, hasta = hoy()) {
  if (!desde) return null;
  const a = new Date(`${String(desde).slice(0, 10)}T12:00:00`);
  const b = new Date(`${String(hasta).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(a.getTime())) return null;
  return Math.round((b - a) / 86400000);
}

/** Los días de aviso que se usan cuando la nevera no trae los suyos. */
function diasAvisoGeneral() {
  const v = Number(bd.prepare(
    "SELECT valor FROM configuracion WHERE clave = 'nevera_dias_aviso'").get()?.valor);
  return Number.isInteger(v) && v > 0 ? v : 21;
}

// ============================================================
// EL COMODATO VIGENTE
// ============================================================

/**
 * El préstamo que está corriendo ahora, con el nombre de a quién.
 *
 * `COALESCE` sobre el cliente y el nombre libre: una feria de tres días no
 * merece un cliente en el catálogo para siempre, pero sí merece salir con
 * su nombre en la lista.
 */
function comodatoVigente(neveraId) {
  return bd.prepare(`
    SELECT co.*,
           COALESCE(c.nombre, co.nombre_libre)     AS quien,
           c.negocio                               AS negocio,
           COALESCE(co.telefono, c.telefono)       AS telefono_util,
           COALESCE(co.direccion, c.direccion)     AS direccion_util
      FROM comodatos co
      LEFT JOIN clientes c ON c.id = co.cliente_id
     WHERE co.nevera_id = ? AND co.devuelta_en IS NULL
     ORDER BY co.desde DESC
     LIMIT 1
  `).get(neveraId) || null;
}

/** Todos los préstamos por los que ha pasado, del más nuevo al más viejo. */
function comodatosDe(neveraId) {
  return bd.prepare(`
    SELECT co.*, COALESCE(c.nombre, co.nombre_libre) AS quien, c.negocio
      FROM comodatos co
      LEFT JOIN clientes c ON c.id = co.cliente_id
     WHERE co.nevera_id = ?
     ORDER BY co.desde DESC, co.fecha_alta DESC
  `).all(neveraId);
}

// ============================================================
// LO QUE HA VENDIDO
// ============================================================

/**
 * LO QUE SE LE HA VENDIDO A ESTA NEVERA.
 *
 * Solo los productos marcados `para_nevera` —las bolsas de cubos—, y solo
 * dentro de las fechas de cada comodato. Las dos condiciones importan:
 *
 *   · Sin la primera, una marqueta que el mismo cliente compró para otra
 *     cosa haría parecer que la nevera se pagó sola.
 *   · Sin la segunda, la nevera se llevaría el crédito de lo que ese
 *     cliente compró antes de tenerla, o después de devolverla.
 *
 * Un comodato a nombre libre —una feria— no tiene cliente y por lo tanto
 * no tiene ventas atadas: ahí el número sale en cero, que es la verdad.
 */
function vendidoDe(neveraId) {
  const filas = bd.prepare(`
    SELECT COALESCE(SUM(vl.precio_centavos), 0) AS centavos,
           COALESCE(SUM(vl.cantidad), 0)        AS piezas,
           COUNT(DISTINCT v.id)                 AS veces,
           MAX(v.fecha)                         AS ultima
      FROM comodatos co
      JOIN ventas v        ON v.cliente_id = co.cliente_id
                          AND v.cancelada_en IS NULL
                          AND date(v.fecha) >= date(co.desde)
                          AND (co.devuelta_en IS NULL
                               OR date(v.fecha) <= date(co.devuelta_en))
      JOIN venta_lineas vl ON vl.venta_id = v.id
      JOIN productos p     ON p.id = vl.producto_id AND p.para_nevera = 1
     WHERE co.nevera_id = ? AND co.cliente_id IS NOT NULL
  `).get(neveraId);

  return {
    centavos: filas?.centavos || 0,
    piezas: filas?.piezas || 0,
    veces: filas?.veces || 0,
    ultima: filas?.ultima || null
  };
}

/** Lo que han costado sus reparaciones. */
function mantenimientoDe(neveraId) {
  const r = bd.prepare(`
    SELECT COALESCE(SUM(costo_centavos), 0) AS centavos,
           COUNT(*)                         AS cuantos,
           MAX(atendido_en)                 AS ultimo
      FROM nevera_servicios
     WHERE nevera_id = ? AND anulado_en IS NULL AND atendido_en IS NOT NULL
  `).get(neveraId);
  return { centavos: r?.centavos || 0, cuantos: r?.cuantos || 0, ultimo: r?.ultimo || null };
}

/** Lo que se le ha regalado. */
function cortesiasDe(neveraId) {
  const r = bd.prepare(`
    SELECT COALESCE(SUM(centavos), 0) AS centavos,
           COALESCE(SUM(cuantas), 0)  AS piezas,
           COUNT(*)                   AS veces
      FROM nevera_cortesias
     WHERE nevera_id = ? AND anulado_en IS NULL
  `).get(neveraId);
  return { centavos: r?.centavos || 0, piezas: r?.piezas || 0, veces: r?.veces || 0 };
}

/** Los reportes de falla que siguen sin atender. */
function pendientesDe(neveraId) {
  return bd.prepare(`
    SELECT s.*, u.nombre AS reportado_por_nombre
      FROM nevera_servicios s
      LEFT JOIN usuarios u ON u.id = s.reportado_por
     WHERE s.nevera_id = ? AND s.atendido_en IS NULL AND s.anulado_en IS NULL
     ORDER BY s.reportado_en
  `).all(neveraId);
}

function serviciosDe(neveraId, limite = 40) {
  return bd.prepare(`
    SELECT s.*, u.nombre AS reportado_por_nombre, a.nombre AS atendido_por_nombre
      FROM nevera_servicios s
      LEFT JOIN usuarios u ON u.id = s.reportado_por
      LEFT JOIN usuarios a ON a.id = s.atendido_por
     WHERE s.nevera_id = ?
     ORDER BY s.reportado_en DESC
     LIMIT ?
  `).all(neveraId, limite);
}

// ============================================================
// ¿YA SE PAGÓ?
// ============================================================

/**
 * LA CUENTA DE LA NEVERA.
 *
 * `aFavor` positivo quiere decir que ya se pagó y va ganando; negativo,
 * lo que le falta. Se devuelven las cuatro partes además del total porque
 * un "le faltan $3,400" sin decir que $2,000 fueron mantenimientos no
 * sirve para decidir nada.
 */
function cuenta(nevera) {
  const vendido = vendidoDe(nevera.id);
  const mantenimiento = mantenimientoDe(nevera.id);
  const cortesias = cortesiasDe(nevera.id);
  const costo = nevera.costo_centavos || 0;

  const aFavor = vendido.centavos - costo - mantenimiento.centavos - cortesias.centavos;

  return {
    vendido, mantenimiento, cortesias,
    costoCentavos: costo,
    aFavor,
    sePago: aFavor >= 0,
    // Sin costo capturado no se puede decir si se pagó: se dice que falta
    // el dato en vez de inventar que la nevera salió gratis.
    sinCosto: !costo
  };
}

// ============================================================
// ¿HACE CUÁNTO NO PIDE?
// ============================================================

/**
 * CUÁNTO LLEVA SIN PEDIR, Y SI YA SE PASÓ.
 *
 * El límite sale del comodato si lo trae —"la cantidad de días la decido
 * yo por cada cliente, hay unos más lentos y otros más rápidos"— y si no,
 * del número general.
 *
 * Una nevera recién puesta que todavía no ha pedido nada cuenta desde el
 * día que se le entregó: es la que más interesa vigilar, porque si a la
 * semana no ha pedido, algo salió mal con esa entrega.
 */
function ritmo(nevera, vigente, vendido) {
  if (!vigente || nevera.estado !== 'prestada') {
    return { dias: null, limite: null, seTardo: false, nuncaPidio: false };
  }

  const limite = vigente.dias_aviso || diasAvisoGeneral();
  const desde = vendido.ultima || vigente.desde;
  const dias = diasEntre(desde);

  return {
    dias,
    limite,
    desdeCuando: desde,
    nuncaPidio: !vendido.ultima,
    seTardo: dias != null && dias > limite
  };
}

// ============================================================
// LA LISTA
// ============================================================

/**
 * TODAS LAS NEVERAS, con lo que hace falta para decidir de un vistazo.
 *
 * La cuenta de cada una se saca aquí y no en la pantalla porque son cuatro
 * consultas por nevera: con cincuenta neveras son doscientas, y hacerlas
 * desde el navegador serían doscientas idas y vueltas.
 */
function lista({ incluirBaja = false } = {}) {
  const neveras = bd.prepare(`
    SELECT * FROM neveras
     ${incluirBaja ? '' : "WHERE estado <> 'baja'"}
     ORDER BY CAST(numero AS INTEGER), numero
  `).all();

  return neveras.map((n) => {
    const vigente = comodatoVigente(n.id);
    const c = cuenta(n);
    return {
      ...n,
      etiqueta: ESTADOS[n.estado]?.nombre || n.estado,
      corto: ESTADOS[n.estado]?.corto || n.estado,
      tono: ESTADOS[n.estado]?.tono || 'libre',
      comodato: vigente,
      cuenta: c,
      ritmo: ritmo(n, vigente, c.vendido),
      pendientes: pendientesDe(n.id).length
    };
  });
}

/** Una nevera con todo lo suyo, para su ficha. */
function completa(id) {
  const n = bd.prepare('SELECT * FROM neveras WHERE id = ?').get(id);
  if (!n) return null;

  const vigente = comodatoVigente(id);
  const c = cuenta(n);

  return {
    ...n,
    etiqueta: ESTADOS[n.estado]?.nombre || n.estado,
    corto: ESTADOS[n.estado]?.corto || n.estado,
    tono: ESTADOS[n.estado]?.tono || 'libre',
    comodato: vigente,
    comodatos: comodatosDe(id),
    cuenta: c,
    ritmo: ritmo(n, vigente, c.vendido),
    servicios: serviciosDe(id),
    pendientes: pendientesDe(id),
    cortesias: bd.prepare(`
      SELECT co.*, u.nombre AS capturista_nombre
        FROM nevera_cortesias co
        LEFT JOIN usuarios u ON u.id = co.capturista_id
       WHERE co.nevera_id = ? AND co.anulado_en IS NULL
       ORDER BY co.fecha DESC LIMIT 30
    `).all(id),
    pedidos: ultimosPedidos(id)
  };
}

/** Los últimos pedidos de bolsas de esa nevera, para su historial. */
function ultimosPedidos(neveraId, limite = 20) {
  return bd.prepare(`
    SELECT v.id, v.folio, v.fecha, v.total_centavos, v.forma_pago,
           SUM(vl.cantidad)        AS piezas,
           SUM(vl.precio_centavos) AS centavos
      FROM comodatos co
      JOIN ventas v        ON v.cliente_id = co.cliente_id
                          AND v.cancelada_en IS NULL
                          AND date(v.fecha) >= date(co.desde)
                          AND (co.devuelta_en IS NULL
                               OR date(v.fecha) <= date(co.devuelta_en))
      JOIN venta_lineas vl ON vl.venta_id = v.id
      JOIN productos p     ON p.id = vl.producto_id AND p.para_nevera = 1
     WHERE co.nevera_id = ? AND co.cliente_id IS NOT NULL
     GROUP BY v.id
     ORDER BY v.fecha DESC
     LIMIT ?
  `).all(neveraId, limite);
}

// ============================================================
// LO QUE HAY QUE ATENDER HOY
// ============================================================

/**
 * EL TABLERO: las tres cosas que piden acción.
 *
 * Va arriba de la lista y es lo único que se mira cuando se abre la
 * pantalla con prisa. Lo demás es para cuando se viene a buscar algo.
 */
function pendientesDeTodas() {
  const todas = lista();
  return {
    sinPedir: todas.filter((n) => n.ritmo.seTardo),
    descompuestas: todas.filter((n) => n.pendientes > 0 || n.estado === 'reparacion'),
    // Las prestadas para un evento que ya se pasaron de la fecha en que
    // se dijo que volvían. Con un cliente esto no aplica: son años.
    vencidas: todas.filter((n) => n.comodato?.hasta_previsto
      && n.comodato.hasta_previsto < hoy()),
    perdidas: todas.filter((n) => n.estado === 'perdida')
  };
}

/** Cuántas hay de cada estado, para el resumen de arriba. */
function porEstado() {
  const filas = bd.prepare(
    'SELECT estado, COUNT(*) c FROM neveras GROUP BY estado').all();
  const mapa = Object.fromEntries(Object.keys(ESTADOS).map((e) => [e, 0]));
  for (const f of filas) mapa[f.estado] = f.c;
  return mapa;
}

module.exports = {
  ESTADOS, hoy, diasEntre, diasAvisoGeneral,
  comodatoVigente, comodatosDe, vendidoDe, mantenimientoDe, cortesiasDe,
  pendientesDe, serviciosDe, cuenta, ritmo,
  lista, completa, ultimosPedidos, pendientesDeTodas, porEstado
};
