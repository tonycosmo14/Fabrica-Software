/**
 * CÓMO SALIÓ EL HIELO  (v2.10)
 *
 * La única fuente de verdad de los estados del hielo. Las pantallas, los
 * tickets, las estadísticas y la existencia leen de aquí; si mañana cambia
 * un nombre o entra un estado nuevo, se cambia en este archivo y ya.
 *
 * POR QUÉ HACÍA FALTA. El sistema distinguía tres cosas —salió, se rompió,
 * salió hueca— y la fábrica distingue cinco. La diferencia importa por dos
 * razones muy concretas:
 *
 *   · SE VENDEN AL MISMO PRECIO PERO NO SON LO MISMO. Una marqueta un poco
 *     hueca se cobra igual que una sellada, así que en el dinero no se
 *     nota; se nota en el mostrador, en las quejas. Sin anotarlo, esa
 *     información se pierde el mismo día.
 *
 *   · ES EL AVISO TEMPRANO. Cuando la mezcla se corre hacia lo hueco varios
 *     días seguidos, algo está pasando —el amoniaco, un compresor, el calor
 *     de mayo— y se nota ANTES de que la máquina se pare. Un número de
 *     marquetas a secas no lo enseña: son las mismas marquetas, peores.
 *
 * EL ORDEN DEL ARREGLO ES EL ORDEN REAL, de mejor a peor. Varias pantallas
 * dependen de eso para dibujar la mezcla: no se reordena por gusto.
 */

/**
 * Los cinco estados, con las palabras del dueño. `nota` es lo que se
 * enseña en la pantalla al elegir, para que dos personas distintas marquen
 * lo mismo ante el mismo hielo — si cada quien entiende "hueca" a su modo,
 * el dato no vale nada.
 */
const CALIDADES = [
  {
    clave: 'sellada', nombre: '100% sellada', plural: 'Selladas', corto: 'selladas', icono: '🧊',
    nota: 'Bien congelada, el centro cerrado a tope. Sale cuando llueve ' +
          'mucho, cuando no hay venta, o cuando las máquinas están ' +
          'congelando muy bien.'
  },
  {
    clave: 'normal', nombre: 'Normal', plural: 'Normales', corto: 'normales', icono: '✓',
    nota: 'Casi selladas, o les falta poquito. Es lo de siempre: con estas ' +
          'no hay quejas.'
  },
  {
    clave: 'poco_hueca', nombre: 'Un poco hueca', plural: 'Un poco huecas', corto: 'poco huecas', icono: '◔',
    nota: 'Del 70% al 60% selladas. Con una noche más hubieran quedado ' +
          'mejor. Alguna gente se queja.'
  },
  {
    clave: 'hueca', nombre: 'Hueca', plural: 'Huecas', corto: 'huecas', icono: '◯',
    nota: 'El centro casi atraviesa la marqueta, y algunas sí lo hacen. La ' +
          'gente se queja pero por necesidad se la lleva.'
  },
  {
    clave: 'cascara', nombre: 'Cáscara', plural: 'Cáscaras', corto: 'cáscaras', icono: '⚠',
    nota: '30% de congelación o menos: el centro atraviesa y los laterales ' +
          'están delgados. Por lo general no se venden.'
  }
];

/** Un molde que no dio nada aprovechable. No es una calidad: es una pérdida. */
const MERMA = 'merma';

const CLAVES_CALIDAD = CALIDADES.map((c) => c.clave);
const RESULTADOS = [...CLAVES_CALIDAD, MERMA];

/** Lo que por omisión sale de un molde: lo de siempre. */
const CALIDAD_POR_OMISION = 'normal';

/**
 * QUÉ SE HACE CON UNA CÁSCARA. Solo las cáscaras llevan destino; una
 * marqueta entera siempre entra al cuarto frío.
 */
const DESTINOS = [
  {
    clave: 'condensadores', nombre: 'A los condensadores', icono: '💨',
    nota: 'Lo normal. Se echa a los condensadores para enfriarlos: no se ' +
          'tira del todo, trabaja.'
  },
  {
    clave: 'almacen', nombre: 'Al cuarto frío', icono: '❄️',
    nota: 'Cuando hay demanda y se va a vender más barata. Entra a la ' +
          'existencia como una marqueta más.'
  },
  {
    clave: 'botada', nombre: 'Se botó', icono: '🗑️',
    nota: 'No se aprovechó de ninguna manera.'
  }
];

const CLAVES_DESTINO = DESTINOS.map((d) => d.clave);
const DESTINO_POR_OMISION = 'condensadores';

/** El nombre que se le enseña a una persona. */
const CATALOGO = new Map([...CALIDADES.map((c) => [c.clave, c])]);
function nombreDe(resultado) {
  if (resultado === MERMA) return 'Se rompió';
  return CATALOGO.get(resultado)?.nombre || resultado;
}

// ============================================================
// LOS PEDAZOS DE SQL — se escriben una vez y se usan en todas partes
// ============================================================

/**
 * LO QUE DE VERDAD ENTRA AL CUARTO FRÍO.
 *
 * Las cuatro calidades que se venden entran siempre. Las cáscaras solo si
 * se decidió guardarlas: la mayoría se va a los condensadores y contarlas
 * como existencia haría que el conteo del cuarto frío no cuadrara jamás.
 *
 * Se pasa el alias que use la consulta (casi siempre `sm`).
 */
function alAlmacen(a = 'sm') {
  return `(${a}.resultado IN ('sellada','normal','poco_hueca','hueca')` +
         ` OR (${a}.resultado = 'cascara' AND ${a}.destino = 'almacen'))`;
}

/**
 * LO QUE COSTÓ DINERO HACER. Una cáscara gastó la misma agua, la misma luz
 * y el mismo molde que una sellada; para el costo por marqueta cuenta
 * igual, se haya vendido o no.
 */
function salioHielo(a = 'sm') {
  return `${a}.resultado <> '${MERMA}'`;
}

/** Las columnas que cuentan la mezcla completa, para un SELECT. */
function columnasMezcla(a = 'sm') {
  return CLAVES_CALIDAD
    .map((c) => `COUNT(CASE WHEN ${a}.resultado = '${c}' THEN 1 END) AS ${c}`)
    .join(',\n      ');
}

/**
 * UN MOLDE QUE FALLA DE VERDAD.
 *
 * En la pantalla de producción cada molde lleva la cuenta de las veces
 * seguidas que ha fallado: un molde que aparece marcado siempre tiene un
 * problema físico —está chueco, gotea, le falta salmuera alrededor— y hay
 * que ir a verlo.
 *
 * LA REGLA ES COMPARARLO CON SU PROPIO PAÑO, no con un ideal. Un molde
 * falló cuando salió PEOR QUE EL RESTO de los moldes que salieron con él.
 *
 * Se probaron antes dos reglas más simples y las dos mienten:
 *
 *   · "falló si no salió sellada" — en mayo, cuando calientan los tanques,
 *     no sale una sola sellada en toda la fábrica y la pantalla se pintaría
 *     entera de rojo, señalando cien moldes que no tienen nada.
 *   · "falló si salió cáscara o rota" — igual de malo el día en que el paño
 *     ENTERO sale en cáscaras: eso es la fábrica, no el molde.
 *
 * Comparándolo contra su paño, las dos cosas quedan bien dichas: la noche
 * mala no señala a nadie, y el molde que sale cáscara mientras sus vecinos
 * salen normales queda marcado al instante, que es justo el aviso que
 * sirve para ir a revisarlo.
 */
const RANGO = new Map(RESULTADOS.map((c, i) => [c, i]));

function rangoDe(resultado) {
  return RANGO.has(resultado) ? RANGO.get(resultado) : 0;
}

function esFallo(resultado, referencia) {
  return rangoDe(resultado) > rangoDe(referencia);
}

/**
 * Cómo salió LA MAYORÍA de un montón de resultados: la vara contra la que
 * se mide cada molde. Se toma el más repetido, y si hay empate el mejor de
 * los empatados —así una mitad normal y una mitad hueca deja marcada la
 * mitad hueca, que es la que hay que mirar—.
 */
function comoSalioLaMayoria(resultados = []) {
  if (!resultados.length) return CALIDAD_POR_OMISION;
  const cuenta = new Map();
  for (const r of resultados) cuenta.set(r, (cuenta.get(r) || 0) + 1);

  let mejor = null;
  for (const [r, n] of cuenta) {
    if (!mejor || n > mejor.n || (n === mejor.n && rangoDe(r) < rangoDe(mejor.r))) {
      mejor = { r, n };
    }
  }
  return mejor.r;
}

/**
 * El resumen de una mezcla, con los totales que de verdad se enseñan.
 * `mezcla` es un objeto { sellada, normal, ... , merma }.
 */
function resumir(mezcla = {}, cascarasAlAlmacen = 0) {
  const n = (c) => Number(mezcla[c] || 0);
  const producidas = CLAVES_CALIDAD.reduce((t, c) => t + n(c), 0);
  const cascaras = n('cascara');
  const guardadas = Number(cascarasAlAlmacen || 0);
  return {
    ...Object.fromEntries(CLAVES_CALIDAD.map((c) => [c, n(c)])),
    merma: n(MERMA),
    // De las cáscaras, las que sí se guardaron para vender.
    cascarasAlAlmacen: guardadas,
    // Todo lo que salió del molde hecho hielo, aunque acabara en el condensador.
    producidas,
    // Lo que quedó guardado para vender.
    alAlmacen: producidas - cascaras + guardadas,
    // Los moldes que se abrieron, incluidos los que no dieron nada.
    salieron: producidas + n(MERMA)
  };
}

module.exports = {
  CALIDADES, CLAVES_CALIDAD, RESULTADOS, MERMA, CALIDAD_POR_OMISION,
  DESTINOS, CLAVES_DESTINO, DESTINO_POR_OMISION,
  nombreDe, alAlmacen, salioHielo, columnasMezcla,
  esFallo, comoSalioLaMayoria, resumir
};
