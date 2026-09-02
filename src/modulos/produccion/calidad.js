/**
 * CÓMO SALIÓ EL HIELO  (v3.1)
 *
 * La única fuente de verdad de los estados del hielo. Las pantallas, los
 * tickets, las estadísticas y la existencia leen de aquí; si mañana cambia
 * un nombre o entra un estado nuevo, se cambia en este archivo y ya.
 *
 * POR QUÉ HACÍA FALTA. El sistema distinguía tres cosas —salió, se rompió,
 * salió hueca— y la fábrica distingue muchas más. La diferencia importa
 * por dos razones muy concretas:
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
 * DOS COSAS DISTINTAS SE ANOTAN JUNTAS, y conviene no confundirlas:
 *
 *   CÓMO CONGELÓ    sellada · normal · un poco hueca · hueca · cáscara ·
 *                   aguada. Es un solo carril, de mejor a peor, y habla de
 *                   la fábrica: del frío de esa noche.
 *   QUÉ LE PASÓ     contaminada (se rompió el molde, le entró salmuera, se
 *                   oxidó el fondo, le cayó algo) y "otro". Eso no habla de
 *                   la fábrica: habla de UN MOLDE, y puede pasarle a hielo
 *                   perfectamente congelado.
 *
 * Van en la misma lista porque en la grúa se contesta una sola pregunta —
 * "¿cómo salió?"— y partirla en dos haría más lento justo el momento en
 * que hay menos tiempo. Pero por dentro se tratan distinto: mira `esFallo`.
 *
 * EL ORDEN DEL ARREGLO ES EL ORDEN REAL, de más a menos aprovechable.
 * Varias pantallas dependen de eso para dibujar la mezcla: no se reordena.
 */

/**
 * Los estados, con las palabras del dueño. `nota` es lo que se enseña en la
 * pantalla al elegir, para que dos personas distintas marquen lo mismo ante
 * el mismo hielo — si cada quien entiende "hueca" a su modo, el dato no
 * vale nada.
 */
const CALIDADES = [
  {
    clave: 'sellada', nombre: '100% sellada', plural: 'Selladas',
    corto: 'selladas', boton: 'sellada', icono: '🧊',
    nota: 'Bien congelada, el centro cerrado a tope. Sale cuando llueve ' +
          'mucho, cuando no hay venta, o cuando las máquinas están ' +
          'congelando muy bien.'
  },
  {
    clave: 'normal', nombre: 'Normal', plural: 'Normales',
    corto: 'normales', boton: 'normal', icono: '✓',
    nota: 'Casi selladas, o les falta poquito. Es lo de siempre: con estas ' +
          'no hay quejas.'
  },
  {
    clave: 'poco_hueca', nombre: 'Un poco hueca', plural: 'Un poco huecas',
    corto: 'poco huecas', boton: 'poco hueca', icono: '◔',
    nota: 'Del 70% al 60% selladas. Con una noche más hubieran quedado ' +
          'mejor. Alguna gente se queja.'
  },
  {
    clave: 'hueca', nombre: 'Hueca', plural: 'Huecas',
    corto: 'huecas', boton: 'hueca', icono: '◯',
    nota: 'El centro casi atraviesa la marqueta, y algunas sí lo hacen. La ' +
          'gente se queja pero por necesidad se la lleva.'
  },
  {
    clave: 'cascara', nombre: 'Cáscara', plural: 'Cáscaras',
    corto: 'cáscaras', boton: 'cáscara', icono: '⚠',
    nota: '30% de congelación o menos: el centro atraviesa y los laterales ' +
          'están delgados. Por lo general no se venden.'
  },
  {
    clave: 'contaminada', nombre: 'Salada o contaminada', plural: 'Saladas o contaminadas',
    corto: 'contaminadas', boton: 'salada', icono: '🧂',
    nota: 'Se rompió el molde y le entró salmuera, se oxidó el fondo, o le ' +
          'cayó algo. Puede estar bien congelada: el problema no es el ' +
          'frío. No se toma; a veces se vende a quien solo quiere enfriar.'
  },
  {
    clave: 'aguada', nombre: 'Aguada, pura agua', plural: 'Aguadas',
    corto: 'aguadas', boton: 'aguada', icono: '💧',
    nota: 'No congeló nada. Sale agua del molde: no hay marqueta que sacar.'
  },
  {
    clave: 'otro', nombre: 'Otro… (escribir qué pasó)', plural: 'Otra cosa',
    corto: 'otra cosa', boton: 'otro', icono: '✎', pideNota: true,
    nota: 'Para lo que no está en la lista. Hay que escribir qué pasó, y ' +
          'eso queda guardado con el paño.'
  }
];

/** Un molde que no dio nada aprovechable. No es una calidad: es una pérdida. */
const MERMA = 'merma';

const CLAVES_CALIDAD = CALIDADES.map((c) => c.clave);
const RESULTADOS = [...CLAVES_CALIDAD, MERMA];

/** Lo que por omisión sale de un molde: lo de siempre. */
const CALIDAD_POR_OMISION = 'normal';

/**
 * NO TODO LO QUE SALE DEL MOLDE ES HIELO QUE SE PUEDA VENDER.
 *
 * Estos tres estados obligan a decir A DÓNDE FUE ese hielo, porque la
 * respuesta cambia de un día a otro y de ella depende que el conteo del
 * cuarto frío cuadre. Los otros no se preguntan: una marqueta entera
 * siempre entra al cuarto frío, y de una aguada no hay nada que mandar a
 * ningún lado.
 */
const PIDEN_DESTINO = ['cascara', 'contaminada', 'otro'];

/** Los que no dejaron ni una marqueta: el molde se abrió para nada. */
const SIN_HIELO = ['aguada', MERMA];

/** Los que se venden sin preguntar nada. */
const VENDIBLES = CLAVES_CALIDAD.filter(
  (c) => !PIDEN_DESTINO.includes(c) && !SIN_HIELO.includes(c));

/** Los que obligan a escribir qué pasó. */
const PIDEN_NOTA = CALIDADES.filter((c) => c.pideNota).map((c) => c.clave);

const DESTINOS = [
  {
    clave: 'condensadores', nombre: 'A los condensadores', icono: '💨',
    nota: 'Lo normal con las cáscaras. Se echa a los condensadores para ' +
          'enfriarlos: no se tira del todo, trabaja.'
  },
  {
    clave: 'almacen', nombre: 'Al cuarto frío', icono: '❄️',
    nota: 'Cuando hay demanda y se va a vender más barata, o para quien ' +
          'solo quiere enfriar y no lo va a consumir. Entra a la ' +
          'existencia como una marqueta más.'
  },
  {
    clave: 'botada', nombre: 'Se botó', icono: '🗑️',
    nota: 'No se aprovechó de ninguna manera.'
  }
];

const CLAVES_DESTINO = DESTINOS.map((d) => d.clave);
const DESTINO_POR_OMISION = 'condensadores';

/**
 * EL CATÁLOGO VIAJA A LA PANTALLA CON LAS REGLAS YA RESUELTAS.
 *
 * La pantalla no tiene por qué saber cuáles estados piden destino ni cuáles
 * se venden solos: si lo supiera, sería una segunda copia de estas listas,
 * y el día que cambiara una, la otra se quedaría vieja sin que nadie se
 * diera cuenta. Cada estado carga sus banderas y se acabó.
 */
for (const c of CALIDADES) {
  c.pideDestino = PIDEN_DESTINO.includes(c.clave);
  c.pideNota = Boolean(c.pideNota);
  c.vendible = VENDIBLES.includes(c.clave);
  c.sinHielo = SIN_HIELO.includes(c.clave);
}

const CATALOGO = new Map(CALIDADES.map((c) => [c.clave, c]));

/** El nombre que se le enseña a una persona. */
function nombreDe(resultado) {
  if (resultado === MERMA) return 'Se rompió';
  return CATALOGO.get(resultado)?.nombre || resultado;
}

const pideDestino = (r) => PIDEN_DESTINO.includes(r);
const pideNota = (r) => PIDEN_NOTA.includes(r);

// ============================================================
// LOS PEDAZOS DE SQL — se escriben una vez y se usan en todas partes
// ============================================================

const lista = (claves) => claves.map((c) => `'${c}'`).join(',');

/**
 * LO QUE DE VERDAD ENTRA AL CUARTO FRÍO.
 *
 * Las marquetas enteras entran siempre. Las cáscaras, las contaminadas y
 * las de "otra cosa", solo si se decidió guardarlas: la mayoría se va a los
 * condensadores, y contarlas como existencia haría que el conteo del cuarto
 * frío no cuadrara jamás.
 *
 * Se pasa el alias que use la consulta (casi siempre `sm`).
 */
function alAlmacen(a = 'sm') {
  return `(${a}.resultado IN (${lista(VENDIBLES)})` +
         ` OR (${a}.resultado IN (${lista(PIDEN_DESTINO)}) AND ${a}.destino = 'almacen'))`;
}

/**
 * LO QUE SALIÓ HECHO HIELO, se venda o no.
 *
 * Es el número que se usa para el costo por marqueta: una cáscara que se
 * fue al condensador gastó la misma agua, la misma luz y el mismo molde que
 * una sellada. Las aguadas y las rotas NO están aquí porque de ellas no
 * salió marqueta ninguna — y no se puede repartir un costo entre marquetas
 * que no existen.
 */
function salioHielo(a = 'sm') {
  return `${a}.resultado NOT IN (${lista(SIN_HIELO)})`;
}

/** Las columnas que cuentan la mezcla completa, para un SELECT. */
function columnasMezcla(a = 'sm') {
  return RESULTADOS
    .map((c) => `COUNT(CASE WHEN ${a}.resultado = '${c}' THEN 1 END) AS ${c}`)
    .join(',\n      ');
}

/** Cuántas de las que piden destino se guardaron para vender. */
function columnaGuardadas(a = 'sm') {
  return `COUNT(CASE WHEN ${a}.resultado IN (${lista(PIDEN_DESTINO)})` +
         ` AND ${a}.destino = 'almacen' THEN 1 END)`;
}

/**
 * UN MOLDE QUE FALLA DE VERDAD.
 *
 * En la pantalla de producción cada molde lleva la cuenta de las veces
 * seguidas que ha fallado: un molde que aparece marcado siempre tiene un
 * problema físico —está chueco, gotea, le falta salmuera alrededor— y hay
 * que ir a verlo.
 *
 * LA REGLA ES COMPARARLO CON SU PROPIO PAÑO. Un molde falló cuando salió
 * PEOR QUE EL RESTO de los moldes que salieron con él.
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
 * salen normales queda marcado al instante.
 *
 * LA CONTAMINACIÓN ES LA EXCEPCIÓN, y por eso lleva su propio renglón
 * abajo: un molde roto por el que entra salmuera está roto aunque el paño
 * entero esté salado —eso querría decir que se rompieron varios— y ahí
 * marcarlos todos es exactamente lo que uno quiere.
 */
const RANGO = new Map([
  ['sellada', 0], ['normal', 1], ['poco_hueca', 2], ['hueca', 3],
  ['cascara', 4], ['otro', 4], ['contaminada', 5], ['aguada', 6], [MERMA, 7]
]);

function rangoDe(resultado) {
  return RANGO.has(resultado) ? RANGO.get(resultado) : 0;
}

function esFallo(resultado, referencia) {
  // La contaminación siempre señala al molde: es un daño físico, no frío.
  if (resultado === 'contaminada') return true;
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
 * LEE LO QUE MANDÓ LA PANTALLA y lo deja listo para guardar, o explica en
 * castellano qué está mal.
 *
 * Está aquí y no en las rutas porque son dos las que guardan hielo —la del
 * paño y la captura en lote— y una regla escrita dos veces es una regla que
 * tarde o temprano dice dos cosas distintas.
 *
 * `omision` es lo que se eligió para el paño entero: un molde suelto que no
 * diga a dónde fue su cáscara sigue al del paño, que es lo que uno espera.
 */
function interpretar(entrada = {}, omision = {}) {
  const resultado = String(entrada.resultado || omision.resultado || CALIDAD_POR_OMISION);
  if (!RESULTADOS.includes(resultado)) {
    throw new Error(`No conozco ese estado del hielo: ${resultado}.`);
  }

  let destino = null;
  if (pideDestino(resultado)) {
    destino = String(entrada.destino || omision.destino || DESTINO_POR_OMISION);
    if (!CLAVES_DESTINO.includes(destino)) {
      throw new Error(`No conozco ese destino: ${entrada.destino || destino}.`);
    }
  }

  // La nota es obligatoria en "otro" —un "otro" sin explicación no sirve
  // para nada dentro de un año— y opcional en todo lo demás, que a veces
  // hace falta: "hueca, se fue la luz a media noche".
  const escrita = String(entrada.nota ?? omision.nota ?? '').trim().slice(0, 300);
  if (pideNota(resultado) && !escrita) {
    throw new Error('Elegiste "Otro": escribe qué pasó, aunque sea corto.');
  }

  return { resultado, destino, nota: escrita || null };
}

/**
 * El resumen de una mezcla, con los totales que de verdad se enseñan.
 * `mezcla` es un objeto { sellada, normal, ..., merma }.
 */
function resumir(mezcla = {}, guardadas = 0) {
  const n = (c) => Number(mezcla[c] || 0);
  const guardo = Number(guardadas || 0);

  const salieron = RESULTADOS.reduce((t, c) => t + n(c), 0);
  const sinHielo = SIN_HIELO.reduce((t, c) => t + n(c), 0);
  const conDestino = PIDEN_DESTINO.reduce((t, c) => t + n(c), 0);
  const vendibles = VENDIBLES.reduce((t, c) => t + n(c), 0);

  return {
    ...Object.fromEntries(RESULTADOS.map((c) => [c, n(c)])),
    // De las que pedían destino, las que sí se guardaron para vender.
    guardadas: guardo,
    // Los moldes que se abrieron, incluidos los que no dieron nada.
    salieron,
    // Todo lo que salió hecho hielo, aunque acabara en el condensador.
    producidas: salieron - sinHielo,
    // Lo que quedó guardado para vender.
    alAlmacen: vendibles + guardo,
    // Hielo que se hizo pero que no se puede ir a buscar al cuarto frío.
    fueraDelAlmacen: conDestino - guardo
  };
}

module.exports = {
  CALIDADES, CLAVES_CALIDAD, RESULTADOS, MERMA, CALIDAD_POR_OMISION,
  DESTINOS, CLAVES_DESTINO, DESTINO_POR_OMISION,
  PIDEN_DESTINO, PIDEN_NOTA, SIN_HIELO, VENDIBLES,
  nombreDe, pideDestino, pideNota,
  alAlmacen, salioHielo, columnasMezcla, columnaGuardadas,
  esFallo, comoSalioLaMayoria, interpretar, resumir
};
