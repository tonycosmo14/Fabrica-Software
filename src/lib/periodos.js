/**
 * EL MES DEL NEGOCIO  (v2.7)
 *
 * "Debo poder elegir las fechas que considero un mes. Porque a veces pongo
 *  el mes en base al recibo de luz, y el recibo de luz no es del 1 al 30,
 *  es del 12 al 12, a veces del 15 al 15."
 *
 * El mes del calendario es una convención de los calendarios, no de las
 * fábricas. Si la luz —que es el gasto más grande de una fábrica de hielo—
 * se cobra del 12 al 12, comparar ese recibo contra las ventas del 1 al 31
 * es comparar dos cosas distintas y sacar una cuenta que no significa nada.
 *
 * Así que el mes del negocio empieza el día que Tony diga. Todo lo que se
 * mida "por mes" —los gastos, la producción, las ventas, las estadísticas
 * de la versión que viene— se mide con esta misma regla, y con una sola:
 * dos pantallas que partan el mes distinto darían dos verdades.
 *
 * ── CÓMO SE LLAMA UN PERIODO ──
 *
 * Con el corte en 12, el periodo que va del 12 de agosto al 11 de
 * septiembre se llama AGOSTO: por el mes en que empieza, que es como lo
 * dice la gente ("el recibo de agosto"). Su clave es 2026-08.
 *
 * ── LO QUE ESTO NO RESUELVE ──
 *
 * "A veces del 15 al 15": el día de corte cambia. Un día de corte fijo no
 * puede seguir a un recibo que se mueve, y fingir que sí sería inventar.
 * Por eso CADA RECIBO DE CFE guarda sus propias fechas, las que trae
 * impresas, y sus cuentas se hacen con esas. Este archivo es para todo lo
 * demás, donde hace falta una regla pareja y no la hay escrita en ningún
 * papel.
 */
const { bd } = require('../db/conexion');

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * El día en que empieza el mes del negocio.
 *
 * Del 1 al 28 y no al 31 a propósito: con el corte en 30, febrero no tiene
 * día 30 y el periodo empezaría un día distinto cada año. Con 28 todos los
 * meses tienen ese día y la regla no falla nunca.
 */
const MINIMO = 1;
const MAXIMO = 28;

function diaDeCorte() {
  const fila = bd.prepare("SELECT valor FROM configuracion WHERE clave = 'periodo_dia_corte'").get();
  const n = Math.round(Number(fila?.valor));
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(n, MINIMO), MAXIMO);
}

/** Una fecha como 2026-08-26, sin hora y sin zona que la mueva. */
function comoDia(d) {
  const dosDigitos = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
}

/**
 * A qué periodo pertenece un día.
 *
 * `dia` es una fecha local escrita como 2026-08-26, o nada para hoy. Se
 * trabaja con fechas locales de pared —no con instantes— porque la
 * pregunta "¿de qué mes es esto?" es una pregunta de calendario: en Yucatán
 * un gasto de las 6:30 de la tarde se guarda con la fecha del día
 * siguiente, y contarlo en el mes siguiente sería un error.
 */
function periodoDe(dia = null, corte = diaDeCorte()) {
  const hoy = dia ? new Date(`${dia}T12:00:00`) : new Date();
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth();

  // Antes del día de corte todavía se está en el periodo que empezó el mes
  // pasado: el 5 de septiembre, con corte en 12, es "agosto".
  const empiezaEn = hoy.getDate() >= corte ? mes : mes - 1;
  const desde = new Date(anio, empiezaEn, corte, 12);
  const hasta = new Date(anio, empiezaEn + 1, corte, 12);
  hasta.setDate(hasta.getDate() - 1);

  return armar(desde, hasta, corte);
}

function armar(desde, hasta, corte) {
  const mes = desde.getMonth();
  const anio = desde.getFullYear();
  const nombre = MESES[mes];

  return {
    clave: `${anio}-${String(mes + 1).padStart(2, '0')}`,
    desde: comoDia(desde),
    hasta: comoDia(hasta),
    nombre: `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`,
    // "12 ago — 11 sep". Es lo que va debajo del nombre en la pantalla,
    // para que nadie tenga que acordarse de cómo está puesto el corte.
    fechas: corte === 1 ? '' : `${desde.getDate()} ${MESES[mes].slice(0, 3)}` +
            ` — ${hasta.getDate()} ${MESES[hasta.getMonth()].slice(0, 3)}`,
    dias: Math.round((hasta - desde) / 86400000) + 1,
    corte
  };
}

/** El periodo anterior a uno dado. */
function anterior(periodo, corte = diaDeCorte()) {
  const desde = new Date(`${periodo.desde}T12:00:00`);
  desde.setMonth(desde.getMonth() - 1);
  const hasta = new Date(desde);
  hasta.setMonth(hasta.getMonth() + 1);
  hasta.setDate(hasta.getDate() - 1);
  return armar(desde, hasta, corte);
}

/** Los últimos N periodos, del más nuevo al más viejo. */
function ultimos(cuantos = 12, corte = diaDeCorte()) {
  const lista = [];
  let p = periodoDe(null, corte);
  for (let i = 0; i < Math.min(Math.max(cuantos, 1), 120); i++) {
    lista.push(p);
    p = anterior(p, corte);
  }
  return lista;
}

/**
 * DE DÍAS DE CALENDARIO A INSTANTES, para poder usar los índices.
 *
 * Las fechas se guardan como instantes UTC ("2026-08-26T18:30:00.000Z") y
 * los periodos se piensan como días de pared ("del 12 al 11"). Juntar las
 * dos cosas con  date(fecha,'localtime') >= date(?)  funciona, pero le pide
 * a SQLite que convierta CADA renglón de la tabla antes de compararlo: el
 * índice por fecha no sirve y se leen los cientos de miles de renglones
 * completos. En el corte del turno da igual; en una pantalla que suma un
 * año de ventas, no.
 *
 * Esto traduce el periodo UNA vez a los dos instantes que lo encierran, y
 * entonces  fecha >= ? AND fecha < ?  sí usa el índice. El final es
 * ABIERTO —el primer instante del día siguiente— porque el último día
 * también cuenta entero, hasta las 23:59:59.999.
 *
 * @returns {{ desde: string, hasta: string }} los dos instantes en ISO.
 */
function instantes({ desde, hasta }) {
  // new Date('2026-08-12T00:00:00') sin la Z se lee en la hora de esta
  // máquina, que es la de la fábrica: exactamente lo que se quiere.
  const inicio = new Date(`${desde}T00:00:00`);
  const fin = new Date(`${hasta}T00:00:00`);
  fin.setDate(fin.getDate() + 1);
  return { desde: inicio.toISOString(), hasta: fin.toISOString() };
}

/** El periodo de una clave como "2026-08". Null si no se entiende. */
function porClave(clave, corte = diaDeCorte()) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(clave || '').trim());
  if (!m) return null;
  const anio = Number(m[1]);
  const mes = Number(m[2]) - 1;
  if (mes < 0 || mes > 11 || anio < 2000 || anio > 2200) return null;

  const desde = new Date(anio, mes, corte, 12);
  const hasta = new Date(anio, mes + 1, corte, 12);
  hasta.setDate(hasta.getDate() - 1);
  return armar(desde, hasta, corte);
}

module.exports = { diaDeCorte, periodoDe, anterior, ultimos, porClave, instantes,
                   MINIMO, MAXIMO, MESES };
