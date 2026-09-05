/**
 * LA RAYA — las cuentas  (v4.8)
 *
 * Lo que se le paga a alguien una semana:
 *
 *     sueldo + extras − vales − otros descuentos = SE LE PAGA
 *
 * Nada de esto se guarda mientras no se pague (regla 3.2): se arma cada vez
 * que se pregunta, de lo que hay. Al pagar SÍ se congela todo en la fila de
 * la raya (regla 3.5), porque ese papel se firmó y no puede cambiar porque
 * mañana le suban el sueldo.
 */
const { bd } = require('../../db/conexion');
const { pendienteDe, adelantosDe } = require('../caja/vales');

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/**
 * LAS CUATRO FORMAS DE PAGO  (v6.8)
 *
 * "Hay trabajadores que se les paga por día, otros la quincena, otros a la
 *  semana, otros por horas."
 *
 * `porDia` dice si el tipo cuenta días trabajados —y por tanto si le
 * importa en qué día cayó el trabajo—. A quien se le paga la semana
 * completa le da igual que un día haya sido domingo.
 */
const TIPOS_SUELDO = [
  { clave: 'semanal', nombre: 'Por semana', unidad: 'la semana', porDia: false,
    ayuda: 'Una cantidad fija cada semana, venga los días que venga.' },
  { clave: 'quincenal', nombre: 'Por quincena', unidad: 'la quincena', porDia: false,
    ayuda: 'Una cantidad fija cada quincena.' },
  { clave: 'por_dia', nombre: 'Por día', unidad: 'el día', porDia: true,
    ayuda: 'Tanto por cada día que trabaja. El sábado, el domingo y los días ' +
           'especiales pueden pagarse distinto.' },
  { clave: 'por_hora', nombre: 'Por hora', unidad: 'la hora', porDia: true,
    ayuda: 'Tanto por cada hora trabajada. Se apunta la entrada y la salida, ' +
           'o las horas a secas.' }
];

const CLAVES_SUELDO = TIPOS_SUELDO.map((t) => t.clave);
const esPorDia = (tipo) => Boolean(TIPOS_SUELDO.find((t) => t.clave === tipo)?.porDia);

/**
 * LAS CLASES DE DÍA.
 *
 * El sábado y el domingo salen del calendario; el especial lo marca el
 * dueño a mano, porque no hay lista fija: "los días feriados o días
 * especiales entre la semana" cambian cada año y los decide él.
 */
const TIPOS_DIA = [
  { clave: 'entre_semana', nombre: 'Entre semana', corto: 'normal' },
  { clave: 'sabado', nombre: 'Sábado', corto: 'sábado' },
  { clave: 'domingo', nombre: 'Domingo', corto: 'domingo' },
  { clave: 'especial', nombre: 'Día especial', corto: 'especial' }
];

/** La columna del sueldo que lleva la tarifa de cada clase de día. */
const COLUMNA_TARIFA = {
  sabado: 'sabado_centavos',
  domingo: 'domingo_centavos',
  especial: 'especial_centavos'
};

/** Los días especiales marcados, del más nuevo al más viejo. */
function diasEspeciales({ desde = null, hasta = null } = {}) {
  const donde = [];
  const args = [];
  if (desde) { donde.push('d.dia >= ?'); args.push(desde); }
  if (hasta) { donde.push('d.dia <= ?'); args.push(hasta); }
  return bd.prepare(`
    SELECT d.*, u.nombre AS capturista_nombre
      FROM dias_especiales d
      LEFT JOIN usuarios u ON u.id = d.capturista_id
     ${donde.length ? `WHERE ${donde.join(' AND ')}` : ''}
     ORDER BY d.dia DESC
  `).all(...args);
}

/** ¿Ese día está marcado como especial? */
function esEspecial(dia) {
  return Boolean(bd.prepare('SELECT 1 FROM dias_especiales WHERE dia = ?').get(dia));
}

/**
 * QUÉ CLASE DE DÍA ES.
 *
 * El especial manda sobre todo lo demás: un 16 de septiembre que cae en
 * sábado se paga como especial, no como sábado.
 */
function tipoDeDia(dia) {
  if (esEspecial(dia)) return 'especial';
  const n = new Date(`${dia}T12:00:00`).getDay();
  if (n === 0) return 'domingo';
  if (n === 6) return 'sabado';
  return 'entre_semana';
}

/**
 * LO QUE VALE UN DÍA (o una hora) DE ESA CLASE.
 *
 * Sin tarifa propia se cobra la normal: quien gana lo mismo todos los días
 * no tiene que capturar cuatro números iguales.
 */
function tarifaDe(sueldo, tipoDia) {
  if (!sueldo) return 0;
  const propia = sueldo[COLUMNA_TARIFA[tipoDia]];
  return propia == null ? sueldo.centavos : propia;
}

/**
 * EL SUELDO QUE VALE HOY, o en la fecha que se pregunte.
 *
 * El más reciente cuya fecha ya pasó. Un aumento con fecha de mañana no
 * cambia la raya de esta semana, que es justo lo que se quiere: se puede
 * dejar apuntado antes de que entre en vigor.
 */
function sueldoVigente(usuarioId, hasta = null) {
  return bd.prepare(`
    SELECT s.*, u.nombre AS capturista_nombre
      FROM sueldos s
      LEFT JOIN usuarios u ON u.id = s.capturista_id
     WHERE s.usuario_id = ? AND s.anulado_en IS NULL AND s.desde <= ?
     ORDER BY s.desde DESC, s.fecha_alta DESC
     LIMIT 1
  `).get(usuarioId, hasta || hoy()) || null;
}

/** Todos los sueldos que ha tenido, del más nuevo al más viejo. */
function historialDeSueldos(usuarioId) {
  return bd.prepare(`
    SELECT s.*, u.nombre AS capturista_nombre
      FROM sueldos s
      LEFT JOIN usuarios u ON u.id = s.capturista_id
     WHERE s.usuario_id = ? AND s.anulado_en IS NULL
     ORDER BY s.desde DESC, s.fecha_alta DESC
  `).all(usuarioId);
}

/** Su horario de costumbre, de domingo a sábado. */
function horarioDe(usuarioId) {
  const filas = bd.prepare(
    'SELECT * FROM horarios_empleado WHERE usuario_id = ? ORDER BY dia'
  ).all(usuarioId);
  const porDia = new Map(filas.map((f) => [f.dia, f]));

  // Se devuelven LOS SIETE DÍAS, con los que no viene en `null`. Un hueco
  // en la semana es información —"el domingo no viene"— y devolver solo
  // los que trabaja obligaría a la pantalla a rellenar el resto.
  return DIAS.map((nombre, dia) => {
    const f = porDia.get(dia);
    return {
      dia, nombre,
      viene: Boolean(f),
      entra: f?.entra || null,
      sale: f?.sale || null,
      notas: f?.notas || null,
      horas: f ? horasEntre(f.entra, f.sale) : 0
    };
  });
}

/** Cuántas horas hay entre dos "HH:MM". Cruzar la medianoche cuenta bien. */
function horasEntre(entra, sale) {
  const min = (t) => {
    const [h, m] = String(t).split(':').map(Number);
    return h * 60 + (m || 0);
  };
  let d = min(sale) - min(entra);
  if (d < 0) d += 24 * 60;                 // el turno de noche cruza el día
  return Math.round((d / 60) * 100) / 100;
}

/**
 * LO QUE TRABAJÓ DE VERDAD, día por día  (v6.8)
 *
 * El horario de costumbre dice qué días VIENE; esto dice qué días VINO, y
 * a qué hora. Es de donde sale la raya del que cobra por día o por hora.
 */
function jornadasDe(usuarioId, desde, hasta) {
  return bd.prepare(`
    SELECT j.*, u.nombre AS capturista_nombre
      FROM jornadas j
      LEFT JOIN usuarios u ON u.id = j.capturista_id
     WHERE j.usuario_id = ? AND j.dia >= ? AND j.dia <= ? AND j.anulada_en IS NULL
     ORDER BY j.dia
  `).all(usuarioId, desde, hasta);
}

/** Los días de calendario entre dos fechas, incluidas las dos. */
function diasEntre(desde, hasta) {
  const dias = [];
  let d = desde;
  // Un tope duro para que una fecha mal tecleada no se lleve el servidor
  // por delante: nadie paga una raya de más de un año.
  for (let i = 0; d <= hasta && i < 400; i++) {
    dias.push(d);
    d = masDias(d, 1);
  }
  return dias;
}

/**
 * LA SEMANA (o la quincena) DÍA POR DÍA, para capturarla y para cobrarla.
 *
 * Devuelve TODOS los días del rango, con lo que se haya apuntado de cada
 * uno y con lo que valdría. Los días sin apuntar salen igual: un hueco es
 * lo que hay que ir a llenar, y esconderlo sería esconder el trabajo que
 * falta pagar.
 */
function diasDeLaRaya(usuarioId, { desde, hasta, sueldo = null }) {
  const apuntadas = new Map(jornadasDe(usuarioId, desde, hasta).map((j) => [j.dia, j]));
  const horario = horarioDe(usuarioId);
  const porHora = sueldo?.tipo === 'por_hora';

  return diasEntre(desde, hasta).map((dia) => {
    const j = apuntadas.get(dia) || null;
    const tipo = j ? j.tipo_dia : tipoDeDia(dia);
    const suyo = horario[new Date(`${dia}T12:00:00`).getDay()];
    const tarifa = tarifaDe(sueldo, tipo);
    const horas = j?.horas ?? null;

    // Lo que se le paga por ese día: la tarifa completa si cobra por día,
    // o las horas por la tarifa de la hora si cobra por hora.
    const centavos = !j || !j.vino ? 0
      : porHora ? Math.round((horas || 0) * tarifa)
      : tarifa;

    return {
      dia,
      nombreDia: DIAS[new Date(`${dia}T12:00:00`).getDay()],
      tipoDia: tipo,
      tipoDiaTexto: TIPOS_DIA.find((t) => t.clave === tipo)?.corto || tipo,
      apuntado: Boolean(j),
      jornadaId: j?.id || null,
      vino: j ? Boolean(j.vino) : null,
      entrada: j?.entrada || null,
      salida: j?.salida || null,
      horas,
      notas: j?.notas || null,
      // Lo que dice su horario de costumbre, para poder rellenar de un
      // golpe sin teclear siete veces lo mismo.
      deCostumbre: { viene: suyo.viene, entra: suyo.entra, sale: suyo.sale, horas: suyo.horas },
      tarifa,
      centavos
    };
  });
}

/** Las rayas que ya se le pagaron, de la más nueva a la más vieja. */
function rayasDe(usuarioId, limite = 20) {
  return bd.prepare(`
    SELECT r.*, u.nombre AS pagada_por_nombre, a.nombre AS anulada_por_nombre
      FROM rayas r
      LEFT JOIN usuarios u ON u.id = r.pagada_por
      LEFT JOIN usuarios a ON a.id = r.anulada_por
     WHERE r.usuario_id = ?
     ORDER BY r.hasta DESC, r.pagada_en DESC
     LIMIT ?
  `).all(usuarioId, limite);
}

/** La última raya pagada, para saber desde cuándo va la siguiente. */
function ultimaRaya(usuarioId) {
  return bd.prepare(`
    SELECT * FROM rayas
     WHERE usuario_id = ? AND anulada_en IS NULL
     ORDER BY hasta DESC, pagada_en DESC LIMIT 1
  `).get(usuarioId) || null;
}

/** Hoy, como día de calendario. */
function hoy() {
  return new Date().toISOString().slice(0, 10);
}

/** El día de la semana en que se paga, configurado. */
function diaDePago() {
  const v = bd.prepare("SELECT valor FROM configuracion WHERE clave = 'raya_dia_pago'")
    .get()?.valor;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 6 ? n : 6;
}

/** Suma días a una fecha de calendario, sin líos de zona horaria. */
function masDias(dia, n) {
  const d = new Date(`${dia}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * QUÉ SEMANA TOCA PAGARLE.
 *
 * Desde el día siguiente a su última raya hasta el próximo día de pago. Si
 * nunca se le ha pagado, la semana que termina en el próximo día de pago.
 * Es una propuesta: quien paga puede cambiar las dos fechas.
 */
function semanaQueTocaria(usuarioId) {
  const ultima = ultimaRaya(usuarioId);
  const pago = diaDePago();

  // El próximo día de pago desde hoy (hoy incluido).
  const ahora = new Date(`${hoy()}T12:00:00`);
  const faltan = (pago - ahora.getDay() + 7) % 7;
  const hasta = masDias(hoy(), faltan);

  const desde = ultima ? masDias(ultima.hasta, 1) : masDias(hasta, -6);
  // Si la última raya ya cubre hasta después de este día de pago —se pagó
  // por adelantado— la propuesta arranca donde quedó y dura una semana.
  return desde > hasta ? { desde, hasta: masDias(desde, 6) } : { desde, hasta };
}

/**
 * EL BALANCE DE UNA SEMANA, sin pagar nada todavía.
 *
 * Es lo que se enseña antes de darle el dinero, y lo que se imprime. Los
 * vales pendientes entran enteros: son de esta semana o de la anterior, y
 * el día de pago se descuentan todos.
 */
function balanceDe(usuarioId, { desde, hasta, dias = null, extras = 0, descuentos = 0 } = {}) {
  const u = bd.prepare('SELECT id, nombre, rol FROM usuarios WHERE id = ?').get(usuarioId);
  if (!u) return null;

  const sueldo = sueldoVigente(usuarioId, hasta);
  const horario = horarioDe(usuarioId);
  const diasQueViene = horario.filter((d) => d.viene).length;
  const tipo = sueldo?.tipo || 'semanal';
  const cuentaDias = esPorDia(tipo);

  // Los días del rango, con lo apuntado de cada uno. Se calculan siempre,
  // aunque cobre por semana: enseñar quién vino y quién no es la mitad de
  // para qué sirve esta pantalla.
  const detalleDias = diasDeLaRaya(usuarioId, { desde, hasta, sueldo });
  const trabajados = detalleDias.filter((d) => d.vino);
  const apuntados = detalleDias.filter((d) => d.apuntado);
  const sinApuntar = detalleDias.filter((d) => !d.apuntado);

  let diasContados = null;
  let horasContadas = null;
  let sueldoCentavos = 0;
  // Cuando no se ha apuntado ni un día, la raya no puede salir de la nada:
  // se cae al horario de costumbre y se dice bien claro que es una
  // suposición. Es lo que hacía el sistema entero antes de la v6.8.
  let porCostumbre = false;

  if (sueldo) {
    if (cuentaDias) {
      if (apuntados.length) {
        diasContados = trabajados.length;
        horasContadas = tipo === 'por_hora'
          ? Math.round(trabajados.reduce((n, d) => n + (d.horas || 0), 0) * 100) / 100
          : null;
        sueldoCentavos = trabajados.reduce((n, d) => n + d.centavos, 0);
      } else {
        porCostumbre = true;
        diasContados = Number.isInteger(dias) && dias >= 0 ? dias : diasQueViene;
        if (tipo === 'por_hora') {
          horasContadas = Math.round(horario.reduce((n, d) => n + d.horas, 0) * 100) / 100;
          sueldoCentavos = Math.round(horasContadas * sueldo.centavos);
        } else {
          sueldoCentavos = sueldo.centavos * diasContados;
        }
      }
      // Quien paga puede decir otro número de días y manda sobre todo lo
      // demás: a veces se acuerda pagarle completo aunque faltara un día.
      if (Number.isInteger(dias) && dias >= 0 && tipo === 'por_dia' && apuntados.length) {
        diasContados = dias;
        sueldoCentavos = trabajados.slice(0, dias).reduce((n, d) => n + d.centavos, 0)
          + Math.max(0, dias - trabajados.length) * tarifaDe(sueldo, 'entre_semana');
      }
    } else {
      sueldoCentavos = sueldo.centavos;
    }
  }

  // Cuánto de lo que se le paga vino de sábados, domingos y días
  // especiales. Es lo que explica por qué esta semana salió más cara.
  const porTipoDia = TIPOS_DIA.map((t) => {
    const suyos = trabajados.filter((d) => d.tipoDia === t.clave);
    return {
      ...t, dias: suyos.length,
      horas: Math.round(suyos.reduce((n, d) => n + (d.horas || 0), 0) * 100) / 100,
      centavos: suyos.reduce((n, d) => n + d.centavos, 0)
    };
  }).filter((t) => t.dias);

  const vales = pendienteDe(usuarioId);
  const pagado = sueldoCentavos + extras - vales.centavos - descuentos;

  return {
    usuario: u,
    desde,
    hasta,
    sueldo,
    tipo,
    tipoTexto: TIPOS_SUELDO.find((t) => t.clave === tipo)?.nombre || tipo,
    cuentaDias,
    // Sin sueldo capturado no se inventa un número: se dice que falta.
    sinSueldo: !sueldo,
    horario,
    diasQueViene,
    horasSemana: Math.round(horario.reduce((n, d) => n + d.horas, 0) * 100) / 100,
    // El día por día del rango, y lo que falta por apuntar.
    dias: detalleDias,
    diasSinApuntar: sinApuntar.length,
    porCostumbre,
    porTipoDia,
    diasContados,
    horasContadas,
    sueldoCentavos,
    extrasCentavos: extras,
    valesCentavos: vales.centavos,
    valesCuantos: vales.cuantos,
    vales: adelantosDe(usuarioId).filter((a) => !a.descontado_en && !a.anulado_en),
    descuentosCentavos: descuentos,
    pagadoCentavos: pagado,
    // Pagar en negativo no tiene sentido: debe más de lo que gana, y eso
    // se resuelve hablando, no con un número rojo en un papel.
    enNegativo: pagado < 0
  };
}

module.exports = {
  DIAS, TIPOS_SUELDO, CLAVES_SUELDO, TIPOS_DIA, esPorDia,
  sueldoVigente, historialDeSueldos, horarioDe, horasEntre,
  diasEspeciales, esEspecial, tipoDeDia, tarifaDe,
  jornadasDe, diasEntre, diasDeLaRaya,
  rayasDe, ultimaRaya, diaDePago, semanaQueTocaria, balanceDe, hoy, masDias
};
