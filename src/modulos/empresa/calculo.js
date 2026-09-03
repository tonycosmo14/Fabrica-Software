/**
 * LAS CUENTAS DE LA EMPRESA  (v2.7)
 *
 * Todo lo de aquí se CALCULA de los renglones capturados y no se guarda
 * (regla 3.2). Un total guardado se desincroniza el día que alguien anule
 * una factura, y entonces la pantalla diría una cosa y los renglones otra.
 */
const { bd } = require('../../db/conexion');
const { producidoEntreDias, producidoPorRangos } = require('../existencia/calculo');

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
  ).all()
    // Un concepto eliminado desaparece de la tabla… salvo que tenga dinero
    // en el periodo que se está mirando: entonces su renglón se queda, para
    // que la tabla siga cuadrando con el total de abajo. Eliminar esconde
    // el botón, no las compras que ya se hicieron (regla 3.4).
    .filter((c) => !c.oculto || (porId.get(c.id)?.veces > 0));

  return conceptos.map((c) => {
    const e = porId.get(c.id);
    const u = ultimaPorId.get(c.id);
    const dias = diasDesde(u?.ultima);

    // CADA CUÁNTO SE COMPRA DE VERDAD, no cada cuánto dice el catálogo:
    // sale de repartir el tiempo entre la primera y la última compra entre
    // las veces que se compró. Con una sola compra no se puede saber.
    // OJO CON EL UNO: `diasEntre` cuenta los dos extremos —del 1 al 3 son
    // tres días— y aquí lo que se quiere es el hueco entre una compra y la
    // siguiente. Comprando el día 1 y el día 91 pasaron 90 días, no 91.
    const ritmoReal = u && u.vecesTotal > 1
      ? Math.round((diasEntre(u.primera, u.ultima) - 1) / (u.vecesTotal - 1))
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
      // "Toca pronto" sale del RITMO MEDIDO y ya no de un número escrito a
      // mano. Estas compras no tienen periodo fijo —entre una y otra pueden
      // pasar quince días o dos años— así que preguntarlo era pedir una
      // adivinanza y después creérsela. Con dos compras ya hay ritmo.
      tocaPronto: Boolean(ritmoReal && dias !== null && dias >= ritmoReal)
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


/**
 * CADA CUÁNTO SE COMPRA DE VERDAD CADA COSA.
 *
 * Se mide, no se pregunta: el tiempo entre la primera compra y la última,
 * repartido entre las veces que se compró. Con una sola compra no hay
 * ritmo que medir y se devuelve nulo.
 *
 * Antes esto era un campo que había que llenar a mano ("cada cuántos días
 * se compra"), y era pedir una adivinanza: entre un cilindro de amoniaco y
 * el siguiente pueden pasar quince días o dos años, según cómo se venda.
 * Un número inventado ahí ensuciaba el costo por marqueta de todos los
 * meses. Medido, se corrige solo con cada compra nueva.
 */
function ritmoPorConcepto() {
  const filas = bd.prepare(`
    SELECT concepto_id,
           COUNT(*)   AS veces,
           MIN(fecha) AS primera,
           MAX(fecha) AS ultima
      FROM gastos_empresa
     WHERE anulado_en IS NULL AND concepto_id IS NOT NULL
     GROUP BY concepto_id
  `).all();

  const mapa = new Map();
  for (const f of filas) {
    if (f.veces < 2) continue;
    const dias = Math.round((diasEntre(f.primera, f.ultima) - 1) / (f.veces - 1));
    // Un tope de dos años: más allá, repartir deja de decir nada útil y
    // obligaría a leer la historia entera de la fábrica en cada consulta.
    mapa.set(f.concepto_id, Math.max(1, Math.min(dias, 730)));
  }
  return mapa;
}

/**
 * LOS GASTOS GRANDES, REPARTIDOS A SU RITMO  (v2.9)
 *
 * EL PROBLEMA QUE ESTO ARREGLA. Un cilindro de amoniaco cuesta $38,500 y
 * dura noventa días. Cargándolo entero al mes en que se compró, ese mes se
 * ve carísimo y los dos siguientes baratísimos —sin que en la fábrica haya
 * pasado absolutamente nada distinto—. El costo por marqueta salta al
 * cuádruple y vuelve a bajar, y entonces el número deja de servir para lo
 * único que sirve: comparar un mes contra otro.
 *
 * Así que se reparte. Cada compra se estira sobre los días que dura —y
 * desde la v3.5 esos días se MIDEN de las compras anteriores en vez de
 * preguntarse— y a cada periodo le toca solo el pedazo que cae dentro. Una
 * compra de julio sigue costando en agosto, que es la verdad: el amoniaco
 * de julio es el que está enfriando en agosto.
 *
 * Lo que todavía NO tiene ritmo —una compostura, unas refacciones, o algo
 * que solo se ha comprado una vez— va entero al mes en que pasó, porque no
 * hay nada medido con qué repartirlo: hacerlo sería inventar.
 *
 * Los dos números se devuelven y la pantalla enseña los dos. El repartido
 * dice cuánto cuesta un mes normal; el del mes dice cuánto dinero salió
 * de verdad. Ninguno de los dos sobra y ninguno de los dos es "el bueno".
 */
function gastosParejos({ desde, hasta }) {
  const dias = diasEntre(desde, hasta);

  // Solo las compras cuyo periodo de vida se cruza con el que se mira:
  // empezaron antes de que acabara, y todavía no se habían acabado cuando
  // empezó. Las de hace dos años no se leen siquiera.
  const ritmo = ritmoPorConcepto();

  // El ritmo más largo que hay marca hasta dónde hay que mirar hacia atrás:
  // una compra más vieja que eso ya se acabó y no toca este periodo.
  const masLargo = Math.max(1, ...ritmo.values());
  const arranque = new Date(`${desde}T12:00:00`);
  arranque.setDate(arranque.getDate() - masLargo);

  const filas = bd.prepare(`
    SELECT g.fecha, g.centavos, g.concepto, g.concepto_id
      FROM gastos_empresa g
     WHERE g.anulado_en IS NULL
       AND g.fecha <= ? AND g.fecha >= ?
  `).all(hasta, comoDia(arranque))
    .map((f) => ({ ...f, dura: ritmo.get(f.concepto_id) || 1 }))
    .filter((f) => {
      // Las que ya se acabaron antes de que empezara el periodo, fuera.
      const fin = new Date(`${f.fecha}T12:00:00`);
      fin.setDate(fin.getDate() + f.dura - 1);
      return comoDia(fin) >= desde;
    });

  let centavos = 0;
  const porConcepto = new Map();

  for (const f of filas) {
    // Los días de esta compra que caen dentro del periodo.
    const cruceDesde = f.fecha > desde ? f.fecha : desde;
    const finCompra = new Date(`${f.fecha}T12:00:00`);
    finCompra.setDate(finCompra.getDate() + f.dura - 1);
    const ultimoDeLaCompra = comoDia(finCompra);
    const cruceHasta = ultimoDeLaCompra < hasta ? ultimoDeLaCompra : hasta;
    if (cruceHasta < cruceDesde) continue;

    const diasCruce = diasEntre(cruceDesde, cruceHasta);
    const parte = Math.round((f.centavos / f.dura) * diasCruce);
    centavos += parte;

    const clave = f.concepto_id || `libre:${f.concepto}`;
    const previo = porConcepto.get(clave) || { nombre: f.concepto, centavos: 0, repartido: false };
    previo.centavos += parte;
    if (f.dura > 1) previo.repartido = true;
    porConcepto.set(clave, previo);
  }

  return {
    centavos,
    dias,
    porConcepto: [...porConcepto.values()].sort((a, b) => b.centavos - a.centavos)
  };
}

/** Una fecha como 2026-08-26, sin hora y sin zona que la mueva. */
function comoDia(d) {
  const dd = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;
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
function conCuentas(r, marquetasYaContadas = null) {
  if (!r) return null;
  const dias = diasEntre(r.desde, r.hasta);
  // Las marquetas pueden venir ya contadas: al pintar la tabla entera se
  // cuentan todas de una pasada en vez de una vez por recibo (v2.9).
  const marquetas = marquetasYaContadas != null
    ? marquetasYaContadas
    : producidoEntreDias(r.desde, r.hasta);

  // LO QUE SE PUEDE DECIR DEL DETALLE, cuando viene capturado.
  //
  // En GDMTH el mismo kilowatt cuesta distinto según la hora, y lo que
  // decide si conviene mover producción de horario no es cuántos kWh de
  // punta hubo, sino QUÉ TANTO DEL RECIBO son. Por eso se saca el
  // porcentaje: 8 % de punta y 30 % de punta son dos fábricas distintas.
  const franjas = ['base', 'intermedia', 'punta']
    .map((f) => ({ franja: f, kwh: r[`kwh_${f}`], centavos: r[`centavos_${f}`] }))
    .filter((f) => f.kwh != null || f.centavos != null);
  const kwhFranjas = franjas.reduce((n, f) => n + (f.kwh || 0), 0);

  // El medidor: lo que avanzó por su cuenta, y por el multiplicador que
  // trae el recibo cuando lo hay. Sirve para cachar un recibo mal
  // capturado —o mal facturado— antes de pagarlo.
  const avance = r.lectura_actual != null && r.lectura_anterior != null
    ? Math.round((r.lectura_actual - r.lectura_anterior) * 100) / 100
    : null;
  const kwhDelMedidor = avance != null
    ? Math.round(avance * (r.multiplicador || 1))
    : null;

  return {
    ...r,
    dias,
    // Cuánto cuesta el kilowatt, en centavos. Sube con las tarifas y con el
    // consumo, porque la CFE cobra por escalones.
    centavosPorKwh: r.kwh > 0 ? Math.round(r.centavos / r.kwh) : null,
    avanceMedidor: avance,
    kwhDelMedidor,
    // Si el medidor y los kWh cobrados no coinciden, se dice. Se admite un
    // 2 % de diferencia por el redondeo del propio recibo.
    medidorCuadra: kwhDelMedidor == null ? null
      : Math.abs(kwhDelMedidor - r.kwh) <= Math.max(10, r.kwh * 0.02),
    franjas: franjas.map((f) => ({
      ...f,
      porCiento: kwhFranjas > 0 && f.kwh != null
        ? Math.round((f.kwh / kwhFranjas) * 1000) / 10 : null,
      centavosPorKwh: f.kwh > 0 && f.centavos != null
        ? Math.round(f.centavos / f.kwh) : null
    })),
    kwhFranjas,
    // Las franjas capturadas deberían sumar los kWh del recibo. Si no
    // suman, falta capturar una o hay un dedazo.
    franjasCuadran: kwhFranjas > 0
      ? Math.abs(kwhFranjas - r.kwh) <= Math.max(10, r.kwh * 0.02) : null,
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

  // UNA sola pasada por la producción para todos los recibos: preguntando
  // de uno en uno, veinticuatro recibos recorrían la producción entera
  // veinticuatro veces.
  const marquetas = producidoPorRangos(filas.map((f) => ({ desde: f.desde, hasta: f.hasta })));
  const conSusCuentas = filas.map((f, i) => conCuentas(f, marquetas[i]));

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
  if (!desde || !hasta) {
    return { centavos: 0, kwh: 0, centavosPorKwh: null, dias: 0,
             diasDelPeriodo: 0, completo: false, recibos: [] };
  }

  const diasDelPeriodo = diasEntre(desde, hasta);

  // Los recibos que se cruzan con el periodo, aunque sea por un día.
  const filas = bd.prepare(`
    SELECT * FROM recibos_cfe
     WHERE anulado_en IS NULL AND hasta >= ? AND desde <= ?
     ORDER BY desde
  `).all(desde, hasta);

  let centavos = 0;
  let kwh = 0;
  let dias = 0;
  const partes = filas.map((r) => {
    const diasRecibo = diasEntre(r.desde, r.hasta);
    const cruceDesde = r.desde > desde ? r.desde : desde;
    const cruceHasta = r.hasta < hasta ? r.hasta : hasta;
    const diasCruce = diasEntre(cruceDesde, cruceHasta);
    const parte = Math.round((r.centavos / diasRecibo) * diasCruce);
    // Los kilowatts se reparten igual que los pesos: por días. Hacen falta
    // para poder separar "gastamos más luz" de "la luz subió de precio",
    // que es la pregunta de verdad (v4.6).
    const parteKwh = Math.round(((r.kwh || 0) / diasRecibo) * diasCruce);

    centavos += parte;
    kwh += parteKwh;
    dias += diasCruce;

    return {
      id: r.id,
      desde: r.desde,
      hasta: r.hasta,
      numero: r.numero,
      centavosDelRecibo: r.centavos,
      kwhDelRecibo: r.kwh || 0,
      diasDelRecibo: diasRecibo,
      // Lo que de ese recibo le toca a este periodo.
      dias: diasCruce,
      centavos: parte,
      kwh: parteKwh,
      // Un recibo que cae entero dentro del periodo no está repartido: es
      // el número exacto del papel, y se puede decir sin advertencias.
      entero: diasCruce === diasRecibo
    };
  });

  return {
    centavos,
    kwh,
    // EL PRECIO DE LA LUZ, en centavos por kilowatt. Es el número que
    // separa "consumimos más" de "está más cara": si sube este, no es la
    // fábrica, es la CFE.
    centavosPorKwh: kwh > 0 ? Math.round(centavos / kwh) : null,
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

// ============================================================
// EL IVA QUE SE PUEDE RECUPERAR
//
// La fábrica paga IVA en todo lo que compra —y sobre todo en la luz, que
// es su gasto más caro— y ese IVA no es suyo: se acredita o se pide de
// vuelta. El problema que resuelve esto es exactamente el que dijo el
// dueño: "a veces ya no se sabe qué IVA nos deben".
//
// La cuenta es de las que no se guardan (regla 3.2). Se saca de tres
// lugares —el IVA de los recibos de luz, el de las compras grandes, y lo
// que Hacienda ha devuelto— y la resta se hace al momento. Si mañana se
// corrige un recibo, el pendiente se corrige solo.
// ============================================================

/** El año de un día "2026-08-26". */
function anioDe(dia) {
  return String(dia || '').slice(0, 4);
}

/**
 * EL IVA AÑO POR AÑO.
 *
 * Un recibo de luz que va del 12 de diciembre al 12 de enero se cuenta en
 * el año de su fecha de FIN, que es cuando se facturó y cuando se puede
 * acreditar. Partirlo por días complicaría la cuenta sin ganar nada: lo
 * que se declara es el recibo entero.
 */
function ivaPorAnio() {
  const luz = bd.prepare(`
    SELECT substr(hasta, 1, 4) anio,
           COALESCE(SUM(iva_centavos), 0) centavos,
           COUNT(iva_centavos) cuantos
      FROM recibos_cfe
     WHERE anulado_en IS NULL AND iva_centavos IS NOT NULL
     GROUP BY anio
  `).all();

  const compras = bd.prepare(`
    SELECT substr(fecha, 1, 4) anio,
           COALESCE(SUM(iva_centavos), 0) centavos,
           COUNT(iva_centavos) cuantos
      FROM gastos_empresa
     WHERE anulado_en IS NULL AND iva_centavos IS NOT NULL
     GROUP BY anio
  `).all();

  const devuelto = bd.prepare(`
    SELECT substr(fecha, 1, 4) anio,
           COALESCE(SUM(centavos), 0) centavos,
           COUNT(*) cuantos
      FROM iva_devoluciones
     WHERE anulado_en IS NULL
     GROUP BY anio
  `).all();

  const anios = new Map();
  const meter = (filas, campo) => {
    for (const f of filas) {
      if (!anios.has(f.anio)) {
        anios.set(f.anio, {
          anio: f.anio, luz: 0, compras: 0, devuelto: 0,
          recibos: 0, gastos: 0, devoluciones: 0
        });
      }
      const a = anios.get(f.anio);
      a[campo] = f.centavos;
      a[{ luz: 'recibos', compras: 'gastos', devuelto: 'devoluciones' }[campo]] = f.cuantos;
    }
  };
  meter(luz, 'luz');
  meter(compras, 'compras');
  meter(devuelto, 'devuelto');

  return [...anios.values()]
    .map((a) => ({ ...a, pagado: a.luz + a.compras, pendiente: a.luz + a.compras - a.devuelto }))
    .sort((a, b) => b.anio.localeCompare(a.anio));
}

/**
 * EL BALANCE COMPLETO: lo pagado, lo devuelto y lo que falta.
 *
 * El pendiente se lleva ACUMULADO, no año por año, porque las devoluciones
 * de Hacienda llegan tarde y con frecuencia caen en el año siguiente al
 * del gasto. Restarlas dentro del mismo año dejaría un año en rojo y el
 * otro en verde sin que falte ni sobre nada.
 */
function balanceIva() {
  const anios = ivaPorAnio();
  const luz = anios.reduce((n, a) => n + a.luz, 0);
  const compras = anios.reduce((n, a) => n + a.compras, 0);
  const devuelto = anios.reduce((n, a) => n + a.devuelto, 0);

  // Cuántos papeles van SIN el IVA anotado. Es lo que hace que el
  // pendiente se quede corto, y hay que decirlo junto al número.
  const faltanRecibos = bd.prepare(
    'SELECT COUNT(*) n FROM recibos_cfe WHERE anulado_en IS NULL AND iva_centavos IS NULL'
  ).get().n;
  const faltanGastos = bd.prepare(
    'SELECT COUNT(*) n FROM gastos_empresa WHERE anulado_en IS NULL AND iva_centavos IS NULL'
  ).get().n;

  return {
    luz,
    compras,
    pagado: luz + compras,
    devuelto,
    pendiente: luz + compras - devuelto,
    anios,
    faltanRecibos,
    faltanGastos,
    // Con papeles sin IVA capturado, el pendiente es un mínimo, no el dato.
    completo: faltanRecibos === 0 && faltanGastos === 0
  };
}

/** Las devoluciones capturadas, de la más nueva a la más vieja. */
function devolucionesIva({ limite = 100, incluirAnuladas = false } = {}) {
  return bd.prepare(`
    SELECT d.*, u.nombre AS capturista_nombre, a.nombre AS anulado_por_nombre
      FROM iva_devoluciones d
      LEFT JOIN usuarios u ON u.id = d.capturista_id
      LEFT JOIN usuarios a ON a.id = d.anulado_por
     ${incluirAnuladas ? '' : 'WHERE d.anulado_en IS NULL'}
     ORDER BY d.fecha DESC, d.fecha_captura DESC
     LIMIT ?
  `).all(Math.min(Math.max(Number(limite) || 100, 1), 500));
}

/**
 * DE DÓNDE SALIÓ EL IVA PAGADO, papel por papel.
 *
 * Sin esto el balance es un número sin respaldo: al reclamar en el SAT
 * hace falta poder decir de qué recibo y de qué factura salió cada peso.
 */
function ivaPagadoDetalle({ anio = null, limite = 200 } = {}) {
  const tope = Math.min(Math.max(Number(limite) || 200, 1), 1000);
  const luz = bd.prepare(`
    SELECT id, hasta AS fecha, numero AS folio, iva_centavos AS centavos, archivo
      FROM recibos_cfe
     WHERE anulado_en IS NULL AND iva_centavos IS NOT NULL
       ${anio ? "AND substr(hasta, 1, 4) = ?" : ''}
     ORDER BY hasta DESC LIMIT ?
  `).all(...(anio ? [anio, tope] : [tope]))
    .map((f) => ({ ...f, de: 'luz', concepto: 'Recibo de luz' }));

  const compras = bd.prepare(`
    SELECT id, fecha, factura AS folio, iva_centavos AS centavos, archivo, concepto, proveedor
      FROM gastos_empresa
     WHERE anulado_en IS NULL AND iva_centavos IS NOT NULL
       ${anio ? "AND substr(fecha, 1, 4) = ?" : ''}
     ORDER BY fecha DESC LIMIT ?
  `).all(...(anio ? [anio, tope] : [tope]))
    .map((f) => ({ ...f, de: 'compra' }));

  return [...luz, ...compras].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, tope);
}


module.exports = {
  diasEntre, diasDesde, porConcepto, totalGastado, recibos, recibo, conCuentas,
  luzEnPeriodo, gastosParejos,
  ivaPorAnio, balanceIva, devolucionesIva, ivaPagadoDetalle
};
