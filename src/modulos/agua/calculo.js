/**
 * LA PLANTA DE AGUA — las cuentas  (v5.2)
 *
 * ============================================================
 * EL NÚMERO QUE MANDA
 * ============================================================
 *
 * De la planta entera, uno solo: **el rechazo de sales**.
 *
 *     (TDS de entrada − TDS de salida) ÷ TDS de entrada
 *
 * Con membranas nuevas anda en 96–98 %. Cuando baja de 90, las membranas
 * ya no purifican: cuelan. Y lo grave es que eso no se ve — el agua sigue
 * saliendo transparente y los garrafones se siguen llenando igual.
 *
 * Por eso la pantalla lo pone grande. Es el equivalente al "¿ya se pagó?"
 * de las neveras: un número que decide una acción.
 *
 * ============================================================
 * LOS MEDIDORES SON TOTALIZADORES
 * ============================================================
 *
 * Un medidor de flujo nunca se pone en cero: solo sube. Se guarda LO QUE
 * MARCA y lo gastado se saca restando la lectura anterior, igual que los
 * recibos de la luz.
 *
 * Eso tiene una consecuencia buena: un día que nadie anotó no se pierde,
 * se recupera solo en la siguiente vuelta, porque el medidor lo siguió
 * contando. Y una mala que hay que atender: si el medidor se cambia, la
 * lectura BAJA, y una resta a ciegas daría un consumo negativo. Cuando
 * eso pasa se marca el renglón y no se cuenta, en vez de inventar un
 * número.
 *
 * Nada de esto se guarda calculado (regla 3.2): las lecturas y los
 * cambios de pieza son lo que está escrito; todo lo demás se saca.
 */
const { bd } = require('../../db/conexion');
const existencia = require('../existencia/calculo');

/** Cada tipo de equipo, con su nombre y su emoji para la lista. */
const TIPOS = {
  clorinador: { nombre: 'Clorinador', emoji: '🧪' },
  filtro: { nombre: 'Filtro', emoji: '🪣' },
  suavizador: { nombre: 'Suavizador', emoji: '🧂' },
  membrana: { nombre: 'Membrana', emoji: '🌀' },
  tinaco: { nombre: 'Tinaco', emoji: '🛢️' },
  ozono: { nombre: 'Ozono', emoji: '💠' },
  uv: { nombre: 'Luz ultravioleta', emoji: '💡' },
  medidor: { nombre: 'Medidor', emoji: '📟' },
  bomba: { nombre: 'Bomba', emoji: '⚙️' },
  otro: { nombre: 'Otro', emoji: '🔧' }
};

const ESTADOS = {
  trabajando: { nombre: 'Trabajando', tono: 'bien' },
  reparacion: { nombre: 'Por reparar', tono: 'malo' },
  baja: { nombre: 'De baja', tono: 'baja' }
};

/** Los servicios, con el nombre que usa quien los hace. */
const SERVICIOS = {
  falla: 'Falla',
  retrolavado: 'Retrolavado',
  regeneracion: 'Regeneración',
  sanitizacion: 'Sanitización',
  cambio_pieza: 'Cambio de pieza',
  preventivo: 'Preventivo',
  otro: 'Otro'
};

const hoy = () => new Date().toISOString().slice(0, 10);
const ahora = () => new Date().toISOString();

/** Cuántos días de calendario van de una fecha a otra. */
function diasEntre(desde, hasta = hoy()) {
  if (!desde) return null;
  const a = new Date(`${String(desde).slice(0, 10)}T12:00:00`);
  const b = new Date(`${String(hasta).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b - a) / 86400000);
}

/** Un número de la configuración, o el de fábrica si está vacío o mal. */
function ajuste(clave, porDefecto) {
  const v = Number(bd.prepare('SELECT valor FROM configuracion WHERE clave = ?')
    .get(clave)?.valor);
  return Number.isFinite(v) && v >= 0 ? v : porDefecto;
}

function ajustes() {
  return {
    tdsMaximo: ajuste('agua_tds_maximo', 50),
    rechazoMinimo: ajuste('agua_rechazo_minimo', 90),
    durezaMaxima: ajuste('agua_dureza_maxima', 20),
    diasSinLectura: ajuste('agua_dias_sin_lectura', 2),
    litrosMarqueta: ajuste('agua_litros_marqueta', 150)
  };
}

// ============================================================
// LAS LECTURAS
// ============================================================

/**
 * LO QUE SE SACA DE CADA LECTURA.
 *
 * Se le pasa la lectura y la ANTERIOR, porque los litros solo existen
 * como diferencia entre dos. Todo lo que no se pueda calcular queda en
 * `null` y la pantalla lo enseña vacío: un cero aquí sería mentira.
 */
function cuentasDe(l, anterior) {
  const a = ajustes();

  // El rechazo de sales. Pide las dos lecturas y que la de entrada no sea
  // cero — dividir entre cero daría Infinity y se vería como un 100 %
  // perfecto justo cuando no se sabe nada.
  const rechazo = (l.tds_entrada > 0 && l.tds_salida != null)
    ? Math.round(((l.tds_entrada - l.tds_salida) / l.tds_entrada) * 1000) / 10
    : null;

  // Los litros del periodo: la resta contra la lectura anterior. Si baja,
  // el medidor se cambió o se reinició; no se inventa un consumo.
  const restar = (ahora_, antes) => {
    if (ahora_ == null || antes == null) return null;
    const d = ahora_ - antes;
    return d >= 0 ? d : null;
  };
  const gastoEntrada = restar(l.litros_entrada, anterior?.litros_entrada);
  const gastoSalida = restar(l.litros_salida, anterior?.litros_salida);
  const medidorAlReves =
    (l.litros_entrada != null && anterior?.litros_entrada != null
      && l.litros_entrada < anterior.litros_entrada)
    || (l.litros_salida != null && anterior?.litros_salida != null
      && l.litros_salida < anterior.litros_salida);

  const recuperacion = (gastoEntrada > 0 && gastoSalida != null)
    ? Math.round((gastoSalida / gastoEntrada) * 1000) / 10
    : null;

  return {
    rechazo,
    recuperacion,
    gastoEntrada,
    gastoSalida,
    tirada: (gastoEntrada != null && gastoSalida != null)
      ? Math.max(0, gastoEntrada - gastoSalida) : null,
    medidorAlReves,
    // Las banderas: lo que hay que hacer HOY por esta lectura.
    hayCloro: l.cloro != null && l.cloro > 0,
    tdsAlto: l.tds_salida != null && l.tds_salida > a.tdsMaximo,
    rechazoBajo: rechazo != null && rechazo < a.rechazoMinimo,
    durezaAlta: l.dureza != null && l.dureza > a.durezaMaxima
  };
}

/**
 * Las lecturas con sus cuentas ya hechas.
 *
 * Se piden en orden viejo→nuevo para poder restar contra la anterior, y
 * se devuelven al revés, que es como se leen.
 */
function lecturas({ desde = null, hasta = null, limite = 60 } = {}) {
  const donde = ['anulado_en IS NULL'];
  const args = [];
  if (desde) { donde.push('date(fecha) >= date(?)'); args.push(desde); }
  if (hasta) { donde.push('date(fecha) <= date(?)'); args.push(hasta); }

  const filas = bd.prepare(`
    SELECT l.*, u.nombre AS ejecutor
      FROM agua_lecturas l
      LEFT JOIN usuarios u ON u.id = l.ejecutor_id
     WHERE ${donde.join(' AND ')}
     ORDER BY l.fecha ASC
  `).all(...args);

  // La lectura anterior a la primera del rango, para que esa también
  // pueda decir cuántos litros pasaron. Sin esto el primer renglón de
  // cada mes saldría siempre vacío.
  const primera = filas[0];
  const previa = primera ? bd.prepare(`
    SELECT * FROM agua_lecturas
     WHERE anulado_en IS NULL AND fecha < ?
     ORDER BY fecha DESC LIMIT 1
  `).get(primera.fecha) : null;

  const conCuentas = filas.map((l, i) => ({
    ...l, ...cuentasDe(l, i === 0 ? previa : filas[i - 1])
  }));

  return conCuentas.reverse().slice(0, limite);
}

/** La última lectura que se tomó, con sus cuentas. */
function ultimaLectura() {
  const l = bd.prepare(`
    SELECT l.*, u.nombre AS ejecutor
      FROM agua_lecturas l
      LEFT JOIN usuarios u ON u.id = l.ejecutor_id
     WHERE l.anulado_en IS NULL
     ORDER BY l.fecha DESC LIMIT 1
  `).get();
  if (!l) return null;

  const anterior = bd.prepare(`
    SELECT * FROM agua_lecturas
     WHERE anulado_en IS NULL AND fecha < ?
     ORDER BY fecha DESC LIMIT 1
  `).get(l.fecha);

  return { ...l, ...cuentasDe(l, anterior), dias: diasEntre(l.fecha) };
}

/** Lo que marca hoy el medidor de salida, para la vida de las piezas. */
function litrosHoy() {
  return bd.prepare(`
    SELECT litros_salida FROM agua_lecturas
     WHERE anulado_en IS NULL AND litros_salida IS NOT NULL
     ORDER BY fecha DESC LIMIT 1
  `).get()?.litros_salida ?? null;
}

// ============================================================
// LOS EQUIPOS Y SUS PIEZAS
// ============================================================

/** La pieza que está puesta hoy en ese equipo. */
function piezaDe(equipoId) {
  return bd.prepare(`
    SELECT * FROM agua_piezas
     WHERE equipo_id = ? AND quitada_en IS NULL AND anulado_en IS NULL
     ORDER BY puesta_en DESC LIMIT 1
  `).get(equipoId) || null;
}

/** Todas las que han pasado por ese puesto, la de hoy primero. */
function piezasDe(equipoId) {
  return bd.prepare(`
    SELECT p.*, u.nombre AS capturista
      FROM agua_piezas p
      LEFT JOIN usuarios u ON u.id = p.capturista_id
     WHERE p.equipo_id = ? AND p.anulado_en IS NULL
     ORDER BY p.puesta_en DESC
  `).all(equipoId);
}

/**
 * CUÁNTA VIDA LE QUEDA A LO QUE ESTÁ PUESTO.
 *
 * Se mide por días, por litros, o por las dos. Manda la que vaya más
 * adelantada: una lámpara de UV se acaba por meses aunque no pase agua, y
 * una membrana por litros aunque el calendario no avance.
 *
 * Si el equipo no tiene vida puesta —un tinaco, un medidor— no hay nada
 * que vigilar y se contesta que no, en vez de un cero que se leería como
 * "ya se venció".
 */
function vidaDe(equipo, pieza, litros = null) {
  if (!equipo.vida_dias && !equipo.vida_litros) return null;

  // Sin pieza capturada se cuenta desde que se dio de alta el equipo: es
  // lo que hay, y es mejor que no decir nada. Se marca para que la
  // pantalla pueda pedir que se capture.
  const desde = pieza?.puesta_en || equipo.fecha_alta;
  const sinPieza = !pieza;

  const usados = diasEntre(desde);
  const porDias = equipo.vida_dias
    ? Math.round((usados / equipo.vida_dias) * 100) : null;

  const litrosUsados = (equipo.vida_litros && litros != null
                        && pieza?.litros_al_poner != null)
    ? Math.max(0, litros - pieza.litros_al_poner) : null;
  const porLitros = (equipo.vida_litros && litrosUsados != null)
    ? Math.round((litrosUsados / equipo.vida_litros) * 100) : null;

  const gastada = Math.max(porDias ?? 0, porLitros ?? 0);

  return {
    sinPieza,
    desde,
    diasUsados: usados,
    diasVida: equipo.vida_dias || null,
    litrosUsados,
    litrosVida: equipo.vida_litros || null,
    gastada,
    // A los tres cuartos ya conviene ir pidiéndola: una membrana no llega
    // en el día, y quedarse sin ella es parar la planta.
    porVencer: gastada >= 75 && gastada < 100,
    vencida: gastada >= 100
  };
}

/** Los servicios de un equipo, el más nuevo primero. */
function serviciosDe(equipoId, limite = 30) {
  return bd.prepare(`
    SELECT s.*, r.nombre AS reportador, a.nombre AS atendedor,
           e.nombre AS equipo
      FROM agua_servicios s
      LEFT JOIN usuarios r     ON r.id = s.reportado_por
      LEFT JOIN usuarios a     ON a.id = s.atendido_por
      LEFT JOIN agua_equipos e ON e.id = s.equipo_id
     WHERE s.equipo_id = ? AND s.anulado_en IS NULL
     ORDER BY s.reportado_en DESC LIMIT ?
  `).all(equipoId, limite);
}

/** Lo que está reportado y todavía nadie atiende. */
function pendientesDe(equipoId) {
  return bd.prepare(`
    SELECT * FROM agua_servicios
     WHERE equipo_id = ? AND atendido_en IS NULL AND anulado_en IS NULL
     ORDER BY reportado_en DESC
  `).all(equipoId);
}

/** Lo que se ha gastado en ese puesto: sus piezas más sus reparaciones. */
function gastoDe(equipoId) {
  const piezas = bd.prepare(`
    SELECT COALESCE(SUM(costo_centavos), 0) c, COUNT(*) n
      FROM agua_piezas WHERE equipo_id = ? AND anulado_en IS NULL
  `).get(equipoId);
  const servicios = bd.prepare(`
    SELECT COALESCE(SUM(costo_centavos), 0) c, COUNT(*) n
      FROM agua_servicios
     WHERE equipo_id = ? AND anulado_en IS NULL AND atendido_en IS NOT NULL
  `).get(equipoId);
  return {
    piezasCentavos: piezas.c, piezas: piezas.n,
    serviciosCentavos: servicios.c, servicios: servicios.n,
    centavos: piezas.c + servicios.c
  };
}

/** Un equipo con todo lo suyo. */
function completo(id, litros = litrosHoy()) {
  const e = bd.prepare('SELECT * FROM agua_equipos WHERE id = ?').get(id);
  if (!e) return null;
  const pieza = piezaDe(e.id);
  return {
    ...e,
    tipoNombre: TIPOS[e.tipo]?.nombre || e.tipo,
    emoji: TIPOS[e.tipo]?.emoji || '🔧',
    etiqueta: ESTADOS[e.estado]?.nombre || e.estado,
    tono: ESTADOS[e.estado]?.tono || 'bien',
    pieza,
    vida: vidaDe(e, pieza, litros),
    pendientes: pendientesDe(e.id),
    gasto: gastoDe(e.id)
  };
}

/** Toda la planta, en el orden en que el agua la atraviesa. */
function planta({ verBaja = false } = {}) {
  const litros = litrosHoy();
  const filas = bd.prepare(`
    SELECT id FROM agua_equipos
     ${verBaja ? '' : 'WHERE activo = 1'}
     ORDER BY orden, nombre
  `).all();
  return filas.map((f) => completo(f.id, litros));
}

// ============================================================
// LO QUE HAY QUE ATENDER HOY
// ============================================================

/**
 * EL TABLERO. Lo mismo que en las neveras: si hay que hacer algo, que se
 * vea al entrar y no haya que ir a buscarlo.
 *
 * El orden no es casual — está por lo que cuesta no atenderlo:
 *   1. Cloro después del carbón: se está comiendo las membranas AHORA.
 *   2. TDS alto: el agua que se está embotellando no cumple.
 *   3. Rechazo bajo: las membranas se están acabando.
 *   4. Dureza: hay que regenerar antes de que haga sarro.
 */
function pendientes() {
  const a = ajustes();
  const ultima = ultimaLectura();
  const equipos = planta();

  const sinLectura = !ultima
    || (ultima.dias != null && ultima.dias > a.diasSinLectura);

  return {
    ajustes: a,
    ultima,
    sinLectura,
    diasSinLectura: ultima?.dias ?? null,
    cloro: ultima?.hayCloro ? ultima : null,
    tds: ultima?.tdsAlto ? ultima : null,
    rechazo: ultima?.rechazoBajo ? ultima : null,
    dureza: ultima?.durezaAlta ? ultima : null,
    vencidas: equipos.filter((e) => e.vida?.vencida),
    porVencer: equipos.filter((e) => e.vida?.porVencer),
    descompuestos: equipos.filter((e) => e.estado === 'reparacion'),
    fallas: equipos.filter((e) => e.pendientes.length)
  };
}

// ============================================================
// A DÓNDE SE FUE EL AGUA
// ============================================================

/**
 * EL CUADRE DEL AGUA.
 *
 * "Se supone que la marqueta pesa 150 kg si está entera y sellada, por lo
 *  que son 150 L. Todo lo que se saca se vuelve a llenar; el detalle es
 *  que a veces se llena de más y a veces de menos."
 *
 * Ese "a veces de más" es agua que se derrama y que hoy no ve nadie. Es
 * el mismo cuadre del cuarto frío, pero con litros:
 *
 *     LO QUE MARCA EL MEDIDOR  contra  LO QUE DEBIÓ LLEVARSE EL HIELO
 *
 * La teoría es marquetas × 150 L. La verdad es el medidor. La diferencia
 * es lo que se derramó — o, si sale al revés, que los moldes se están
 * llenando de menos y las marquetas salen chicas.
 *
 * OJO CON LO QUE TODAVÍA NO SE PUEDE RESTAR: los garrafones y las
 * botellas salen de la misma agua y todavía no se registran (van en la
 * v5.3). Mientras tanto la diferencia los lleva dentro, y por eso la
 * pantalla lo dice en vez de presumir un cuadre que no es.
 */
function elAgua(desde, hasta = hoy()) {
  const a = ajustes();
  const filas = lecturas({ desde, hasta, limite: 10000 });

  let entrada = 0;
  let salida = 0;
  let conMedidor = 0;
  let saltos = 0;
  for (const l of filas) {
    if (l.gastoEntrada != null) { entrada += l.gastoEntrada; conMedidor++; }
    if (l.gastoSalida != null) salida += l.gastoSalida;
    if (l.medidorAlReves) saltos++;
  }

  const marquetas = existencia.producidoEntreDias(desde, hasta);
  const teoriaHielo = marquetas * a.litrosMarqueta;

  return {
    desde,
    hasta,
    entrada,
    producida: salida,
    tirada: Math.max(0, entrada - salida),
    marquetas,
    litrosMarqueta: a.litrosMarqueta,
    teoriaHielo,
    // Lo que sobra después de descontar lo que en teoría se llevó el
    // hielo. Hoy incluye los garrafones; en la v5.3 se le restarán.
    sinExplicar: salida - teoriaHielo,
    lecturas: conMedidor,
    saltos,
    // Sin al menos dos lecturas con medidor no hay resta que hacer, y
    // decirlo vale más que enseñar ceros.
    hayDatos: conMedidor > 0
  };
}

/**
 * CÓMO VA EL RECHAZO CON EL TIEMPO.
 *
 * Un solo dato no dice nada: el TDS del pozo cambia con la lluvia. Lo que
 * importa es la línea — si el rechazo lleva tres meses bajando, las
 * membranas se están acabando aunque hoy todavía cumpla.
 */
function tendencia(cuantas = 30) {
  return lecturas({ limite: cuantas })
    .filter((l) => l.rechazo != null)
    .map((l) => ({ fecha: l.fecha, rechazo: l.rechazo, tds: l.tds_salida }))
    .reverse();
}

module.exports = {
  TIPOS, ESTADOS, SERVICIOS,
  hoy, ahora, diasEntre, ajustes,
  cuentasDe, lecturas, ultimaLectura, litrosHoy,
  piezaDe, piezasDe, vidaDe, serviciosDe, pendientesDe, gastoDe,
  completo, planta, pendientes, elAgua, tendencia
};
