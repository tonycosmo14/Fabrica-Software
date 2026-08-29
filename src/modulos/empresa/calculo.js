/**
 * LAS CUENTAS DE LA EMPRESA  (v2.7)
 *
 * Todo lo de aquí se CALCULA de los renglones capturados y no se guarda
 * (regla 3.2). Un total guardado se desincroniza el día que alguien anule
 * una factura, y entonces la pantalla diría una cosa y los renglones otra.
 */
const { bd } = require('../../db/conexion');
const { producidoEntreDias } = require('../existencia/calculo');

/** Cuántos días hay entre dos días del calendario, contando los dos. */
function diasEntre(desde, hasta) {
  const a = new Date(`${desde}T12:00:00`);
  const b = new Date(`${hasta}T12:00:00`);
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

/** Cuántos días han pasado desde un día hasta hoy. */
function diasDesde(dia) {
  if (!dia) return null;
  const d = new Date(`${dia}T12:00:00`);
  const hoy = new Date();
  hoy.setHours(12, 0, 0, 0);
  return Math.round((hoy - d) / 86400000);
}


// ============================================================
// LOS GASTOS GRANDES
// ============================================================

/**
 * EN QUÉ SE VA EL DINERO, por concepto.
 *
 * Un renglón por cosa que se compra, con lo que lleva gastado en el
 * periodo, cuándo fue la última vez y cuánto costó la unidad. Ese último
 * número es el que contesta "¿está subiendo el barril de aceite?", y por
 * eso la cantidad y la unidad se capturan: sin ellas, $12,000 puede ser una
 * ganga o un robo y no hay forma de saberlo.
 */
function porConcepto({ desde = null, hasta = null } = {}) {
  const donde = ['g.anulado_en IS NULL'];
  const valores = [];
  if (desde) { donde.push('g.fecha >= ?'); valores.push(desde); }
  if (hasta) { donde.push('g.fecha <= ?'); valores.push(hasta); }

  const enElPeriodo = bd.prepare(`
    SELECT g.concepto_id AS id,
           COUNT(*)        AS veces,
           SUM(g.centavos) AS centavos,
           SUM(CASE WHEN g.cantidad > 0 THEN g.cantidad ELSE 0 END) AS cantidad
      FROM gastos_empresa g
     WHERE ${donde.join(' AND ')}
     GROUP BY g.concepto_id
  `).all(...valores);

  // La última compra se busca SIN el filtro del periodo: la pregunta
  // "¿hace cuánto que no compro sal?" no se contesta mirando solo este mes.
  // Si la última fue en marzo, la respuesta es marzo, no "nunca".
  const ultimas = bd.prepare(`
    SELECT g.concepto_id AS id,
           MAX(g.fecha)  AS ultima,
           COUNT(*)      AS vecesTotal,
           MIN(g.fecha)  AS primera
      FROM gastos_empresa g
     WHERE g.anulado_en IS NULL
     GROUP BY g.concepto_id
  `).all();

  const porId = new Map(enElPeriodo.map((f) => [f.id, f]));
  const ultimaPorId = new Map(ultimas.map((f) => [f.id, f]));

  const conceptos = bd.prepare(
    'SELECT * FROM conceptos_empresa ORDER BY activo DESC, orden, nombre'
  ).all();

  return conceptos.map((c) => {
    const e = porId.get(c.id);
    const u = ultimaPorId.get(c.id);
    const dias = diasDesde(u?.ultima);

    // CADA CUÁNTO SE COMPRA DE VERDAD, no cada cuánto dice el catálogo:
    // sale de repartir el tiempo entre la primera y la última compra entre
    // las veces que se compró. Con una sola compra no se puede saber.
    const ritmoReal = u && u.vecesTotal > 1
      ? Math.round(diasEntre(u.primera, u.ultima) / (u.vecesTotal - 1))
      : null;

    return {
      id: c.id,
      nombre: c.nombre,
      unidad: c.unidad,
      ayuda: c.ayuda,
      activo: c.activo,
      cadaDias: c.cada_dias,
      // Lo del periodo que se está mirando.
      veces: e?.veces || 0,
      centavos: e?.centavos || 0,
      cantidad: e?.cantidad || 0,
      // El precio por unidad del periodo. Se calcula, nunca se guarda.
      porUnidad: e && e.cantidad > 0 ? Math.round(e.centavos / e.cantidad) : null,
      // Y la historia, que no depende del periodo.
      ultima: u?.ultima || null,
      diasDesdeLaUltima: dias,
      ritmoReal,
      // "Toca pronto": pasó más tiempo del que suele pasar. No es una
      // alarma —nadie sabe cuándo se acaba un cilindro de amoniaco— sino un
      // recordatorio de mirarlo.
      tocaPronto: Boolean((c.cada_dias || ritmoReal) && dias !== null
                          && dias >= (c.cada_dias || ritmoReal))
    };
  });
}

/** Lo que se gastó en un periodo, en total. */
function totalGastado({ desde = null, hasta = null } = {}) {
  const donde = ['anulado_en IS NULL'];
  const valores = [];
  if (desde) { donde.push('fecha >= ?'); valores.push(desde); }
  if (hasta) { donde.push('fecha <= ?'); valores.push(hasta); }

  return bd.prepare(`
    SELECT COALESCE(SUM(centavos), 0) centavos, COUNT(*) cuantos
      FROM gastos_empresa WHERE ${donde.join(' AND ')}
  `).get(...valores);
}


// ============================================================
// LA LUZ
// ============================================================

/**
 * UN RECIBO DE CFE CON SUS CUENTAS.
 *
 * Las cuentas se hacen con LAS FECHAS DEL RECIBO, no con el mes del
 * negocio: el papel dice exactamente de cuándo a cuándo midieron, y ese es
 * el único periodo en el que esos kilowatts significan algo.
 *
 * El número que importa en una fábrica de hielo es el último: cuánta luz
 * cuesta cada marqueta. Es lo que dice si una máquina se está echando a
 * perder mucho antes de que se pare.
 */
function conCuentas(r) {
  if (!r) return null;
  const dias = diasEntre(r.desde, r.hasta);
  const marquetas = producidoEntreDias(r.desde, r.hasta);

  return {
    ...r,
    dias,
    // Cuánto cuesta el kilowatt, en centavos. Sube con las tarifas y con el
    // consumo, porque la CFE cobra por escalones.
    centavosPorKwh: r.kwh > 0 ? Math.round(r.centavos / r.kwh) : null,
    kwhPorDia: Math.round(r.kwh / dias),
    centavosPorDia: Math.round(r.centavos / dias),
    // Las marquetas de ese periodo, y lo que costó de luz cada una.
    marquetas,
    kwhPorMarqueta: marquetas > 0 ? Math.round((r.kwh / marquetas) * 100) / 100 : null,
    centavosPorMarqueta: marquetas > 0 ? Math.round(r.centavos / marquetas) : null
  };
}

/** Los recibos, del más nuevo al más viejo, con sus cuentas. */
function recibos({ limite = 24, incluirAnulados = false } = {}) {
  const filas = bd.prepare(`
    SELECT r.*, u.nombre AS capturista_nombre, a.nombre AS anulado_por_nombre
      FROM recibos_cfe r
      LEFT JOIN usuarios u ON u.id = r.capturista_id
      LEFT JOIN usuarios a ON a.id = r.anulado_por
     ${incluirAnulados ? '' : 'WHERE r.anulado_en IS NULL'}
     ORDER BY r.desde DESC
     LIMIT ?
  `).all(Math.min(Math.max(Number(limite) || 24, 1), 200));

  const conSusCuentas = filas.map(conCuentas);

  // Contra el recibo anterior: es la comparación que se hace de verdad al
  // abrir el sobre. Va aquí y no en la pantalla para que la haga uno solo.
  return conSusCuentas.map((r, i) => {
    const antes = conSusCuentas[i + 1];
    return {
      ...r,
      contraElAnterior: antes ? {
        kwh: r.kwh - antes.kwh,
        centavos: r.centavos - antes.centavos,
        // En por ciento, que es como se dice: "subió un 20%".
        porCiento: antes.centavos > 0
          ? Math.round(((r.centavos - antes.centavos) / antes.centavos) * 1000) / 10
          : null
      } : null
    };
  });
}

/**
 * LA LUZ QUE LE TOCA A UN PERIODO DEL NEGOCIO.
 *
 * El recibo de la CFE nunca empieza el día que empieza el mes del negocio:
 * el medidor se lee cuando pasa el señor, no cuando lo decide uno. Así que
 * para poder decir "este mes se fueron tantos pesos en cosas grandes"
 * incluyendo la luz —que es el gasto más caro de una fábrica de hielo—
 * hay que REPARTIR cada recibo entre los días que cubre y quedarse con los
 * que caen dentro del periodo.
 *
 * El número que sale es un REPARTO, no una factura, y por eso se devuelve
 * junto con `completo`: si hay días del periodo que ningún recibo cubre
 * todavía (lo normal, porque el recibo llega después), la pantalla tiene
 * que decir "va incompleto" en vez de presumir un total que va a subir.
 */
function luzEnPeriodo({ desde = null, hasta = null } = {}) {
  if (!desde || !hasta) return { centavos: 0, dias: 0, diasDelPeriodo: 0, completo: false, recibos: [] };

  const diasDelPeriodo = diasEntre(desde, hasta);

  // Los recibos que se cruzan con el periodo, aunque sea por un día.
  const filas = bd.prepare(`
    SELECT * FROM recibos_cfe
     WHERE anulado_en IS NULL AND hasta >= ? AND desde <= ?
     ORDER BY desde
  `).all(desde, hasta);

  let centavos = 0;
  let dias = 0;
  const partes = filas.map((r) => {
    const diasRecibo = diasEntre(r.desde, r.hasta);
    const cruceDesde = r.desde > desde ? r.desde : desde;
    const cruceHasta = r.hasta < hasta ? r.hasta : hasta;
    const diasCruce = diasEntre(cruceDesde, cruceHasta);
    const parte = Math.round((r.centavos / diasRecibo) * diasCruce);

    centavos += parte;
    dias += diasCruce;

    return {
      id: r.id,
      desde: r.desde,
      hasta: r.hasta,
      numero: r.numero,
      centavosDelRecibo: r.centavos,
      diasDelRecibo: diasRecibo,
      // Lo que de ese recibo le toca a este periodo.
      dias: diasCruce,
      centavos: parte,
      // Un recibo que cae entero dentro del periodo no está repartido: es
      // el número exacto del papel, y se puede decir sin advertencias.
      entero: diasCruce === diasRecibo
    };
  });

  return {
    centavos,
    dias,
    diasDelPeriodo,
    // Los recibos no se enciman (el índice único lo impide para periodos
    // iguales), así que sumar los días del cruce dice cuántos del periodo
    // están respaldados por un papel.
    completo: dias >= diasDelPeriodo,
    recibos: partes
  };
}

/** Un recibo solo, con sus cuentas. */
function recibo(id) {
  return conCuentas(bd.prepare(`
    SELECT r.*, u.nombre AS capturista_nombre, a.nombre AS anulado_por_nombre
      FROM recibos_cfe r
      LEFT JOIN usuarios u ON u.id = r.capturista_id
      LEFT JOIN usuarios a ON a.id = r.anulado_por
     WHERE r.id = ?
  `).get(id));
}

module.exports = {
  diasEntre, diasDesde, porConcepto, totalGastado, recibos, recibo, conCuentas,
  luzEnPeriodo
};
