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

  // Cuánto le toca de sueldo. Por día, se multiplica por los días que se
  // le cuenten —los de su horario, salvo que quien paga diga otra cosa—.
  let diasContados = null;
  let sueldoCentavos = 0;
  if (sueldo) {
    if (sueldo.tipo === 'por_dia') {
      diasContados = Number.isInteger(dias) && dias >= 0 ? dias : diasQueViene;
      sueldoCentavos = sueldo.centavos * diasContados;
    } else {
      sueldoCentavos = sueldo.centavos;
    }
  }

  const vales = pendienteDe(usuarioId);
  const pagado = sueldoCentavos + extras - vales.centavos - descuentos;

  return {
    usuario: u,
    desde,
    hasta,
    sueldo,
    // Sin sueldo capturado no se inventa un número: se dice que falta.
    sinSueldo: !sueldo,
    horario,
    diasQueViene,
    horasSemana: Math.round(horario.reduce((n, d) => n + d.horas, 0) * 100) / 100,
    diasContados,
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
  DIAS, sueldoVigente, historialDeSueldos, horarioDe, horasEntre,
  rayasDe, ultimaRaya, diaDePago, semanaQueTocaria, balanceDe, hoy, masDias
};
