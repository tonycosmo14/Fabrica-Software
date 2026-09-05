/**
 * CÓMO SALIÓ EL HIELO  (v3.1, rehecho en la v6.5)
 *
 * La única fuente de verdad de los estados del hielo. Las pantallas, los
 * tickets, las estadísticas y la existencia leen de aquí; si mañana cambia
 * un nombre o entra un estado nuevo, se cambia en este archivo y ya.
 *
 * POR QUÉ HACÍA FALTA. El sistema distinguía tres cosas —salió, se rompió,
 * salió hueca— y la fábrica distingue muchas más. La diferencia importa
 * por dos razones muy concretas:
 *
 *   · SE VENDEN AL MISMO PRECIO PERO NO SON LO MISMO. Una marqueta al 60%
 *     se cobra igual que una sellada, así que en el dinero no se nota; se
 *     nota en el mostrador, en las quejas. Sin anotarlo, esa información
 *     se pierde el mismo día.
 *
 *   · ES EL AVISO TEMPRANO. Cuando la mezcla se corre hacia abajo varios
 *     días seguidos, algo está pasando —el amoniaco, un compresor, el calor
 *     de mayo— y se nota ANTES de que la máquina se pare. Un número de
 *     marquetas a secas no lo enseña: son las mismas marquetas, peores.
 *
 * ============================================================
 * LA ESCALA, COMO LA DICTÓ EL DUEÑO  (v6.5)
 * ============================================================
 *
 * "Hueca y cáscara son lo mismo, y cuando salen así no se cuentan: damos
 *  por entendido que se botaron, sea a donde sea que vayan. Salada y
 *  contaminada igual: es merma. Aguada o ahogada lo mismo. Quitamos el
 *  estado un poco hueco. Se queda 100% sellada, y donde decía normal que
 *  pregunte mejor el estado de congelación."
 *
 * De ahí salen dos grupos y ninguna pregunta más:
 *
 *   LO QUE SE VENDE    100% sellada · del 80 al 90% · del 60 al 80% ·
 *                      del 40 al 60%. Es un solo carril, de mejor a peor,
 *                      y habla de la fábrica: del frío de esa noche.
 *   LO QUE SE BOTA     hueca o cáscara (menos del 40%), salada o
 *                      contaminada, aguada o ahogada, y "otro" con lo que
 *                      haya pasado escrito. Nada de esto entra al cuarto
 *                      frío.
 *
 * YA NO SE PREGUNTA A DÓNDE FUE. Antes, de una cáscara había que decir si
 * se iba a los condensadores, al cuarto frío o a la basura, y de esa
 * respuesta dependía si contaba como existencia. Era una pregunta de más
 * en el peor momento —de pie, con las manos mojadas— y una forma de que el
 * conteo no cuadrara si alguien contestaba de prisa. Ahora la regla es una
 * sola: si no es de las cuatro primeras, no está en el cuarto frío.
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
          'congelando muy bien. Del 90% para arriba ya es esto.'
  },
  {
    clave: 'c80', nombre: 'Del 80 al 90% congelada', plural: 'Del 80 al 90%',
    corto: 'del 80 al 90%', boton: '80-90%', icono: '◕',
    nota: 'Casi sellada, le falta poquito. Es lo de siempre: con estas no ' +
          'hay quejas.'
  },
  {
    clave: 'c60', nombre: 'Del 60 al 80% congelada', plural: 'Del 60 al 80%',
    corto: 'del 60 al 80%', boton: '60-80%', icono: '◑',
    nota: 'Con una noche más hubieran quedado mejor. Alguna gente se queja.'
  },
  {
    clave: 'c40', nombre: 'Del 40 al 60% congelada', plural: 'Del 40 al 60%',
    corto: 'del 40 al 60%', boton: '40-60%', icono: '◔',
    nota: 'Se vende, pero se nota. Si varios días seguidos sale así, algo ' +
          'está pasando con el frío.'
  },
  {
    clave: 'hueca', nombre: 'Hueca o cáscara', plural: 'Huecas o cáscaras',
    corto: 'huecas', boton: 'hueca', icono: '◯', merma: true,
    nota: 'Menos del 40%: el centro atraviesa la marqueta y los laterales ' +
          'están delgados. No se cuenta: se botó.'
  },
  {
    clave: 'contaminada', nombre: 'Salada o contaminada', plural: 'Saladas o contaminadas',
    corto: 'contaminadas', boton: 'salada', icono: '🧂', merma: true,
    nota: 'Se rompió el molde y le entró salmuera, se oxidó el fondo, o le ' +
          'cayó algo. Puede estar bien congelada: el problema no es el ' +
          'frío. No se cuenta: se botó.'
  },
  {
    clave: 'aguada', nombre: 'Aguada o ahogada, pura agua', plural: 'Aguadas',
    corto: 'aguadas', boton: 'aguada', icono: '💧', merma: true,
    nota: 'No congeló nada, o se ahogó. Sale agua del molde: no hay ' +
          'marqueta que sacar.'
  },
  {
    clave: 'otro', nombre: 'Otro… (escribir qué pasó)', plural: 'Otra cosa',
    corto: 'otra cosa', boton: 'otro', icono: '✎', pideNota: true, merma: true,
    nota: 'Para darle de baja esa marqueta por lo que sea que le pasó. Hay ' +
          'que escribir qué fue, y eso queda guardado con el paño.'
  }
];

const CLAVES_CALIDAD = CALIDADES.map((c) => c.clave);

/**
 * Se llamaba RESULTADOS porque además de las calidades había un "se rompió"
 * que no era una calidad. Ese se fue en la v6.5 —lo que se rompe se anota
 * como "otro" con su explicación— así que hoy resultados y calidades son
 * exactamente lo mismo. El nombre se queda porque es el de la columna.
 */
const RESULTADOS = CLAVES_CALIDAD;

/** Lo que por omisión sale de un molde: lo de siempre. */
const CALIDAD_POR_OMISION = 'c80';

/** Lo que entra al cuarto frío y se puede vender. */
const VENDIBLES = CALIDADES.filter((c) => !c.merma).map((c) => c.clave);

/** Lo que se botó: no es existencia, se venga de donde se venga. */
const MERMAS = CALIDADES.filter((c) => c.merma).map((c) => c.clave);

/** Los que obligan a escribir qué pasó. */
const PIDEN_NOTA = CALIDADES.filter((c) => c.pideNota).map((c) => c.clave);

/**
 * De estos NO SALE NI UNA MARQUETA.
 *
 * Solo la aguada: de un molde que no congeló sale agua y nada más. Las
 * demás mermas sí dieron una marqueta —gastaron la misma agua, la misma
 * luz y el mismo molde— aunque después se haya ido a la basura, y por eso
 * cuentan para el costo por marqueta y no para la existencia.
 */
const SIN_HIELO = ['aguada'];

/**
 * EL CATÁLOGO VIAJA A LA PANTALLA CON LAS REGLAS YA RESUELTAS.
 *
 * La pantalla no tiene por qué saber cuáles cuentan y cuáles no: si lo
 * supiera, sería una segunda copia de estas listas, y el día que cambiara
 * una, la otra se quedaría vieja sin que nadie se diera cuenta. Cada estado
 * carga sus banderas y se acabó.
 */
for (const c of CALIDADES) {
  c.merma = Boolean(c.merma);
  c.pideNota = Boolean(c.pideNota);
  c.vendible = !c.merma;
  c.sinHielo = SIN_HIELO.includes(c.clave);
}

const CATALOGO = new Map(CALIDADES.map((c) => [c.clave, c]));

/** El nombre que se le enseña a una persona. */
function nombreDe(resultado) {
  return CATALOGO.get(resultado)?.nombre || resultado;
}

const pideNota = (r) => PIDEN_NOTA.includes(r);

// ============================================================
// LOS PEDAZOS DE SQL — se escriben una vez y se usan en todas partes
// ============================================================

const lista = (claves) => claves.map((c) => `'${c}'`).join(',');

/**
 * LO QUE DE VERDAD ENTRA AL CUARTO FRÍO.
 *
 * Las cuatro que se venden, y nada más. Contar aquí una hueca o una salada
 * haría que el conteo del cuarto frío no cuadrara jamás, y andarías
 * buscando marquetas que alguien botó.
 *
 * Se pasa el alias que use la consulta (casi siempre `sm`).
 */
function alAlmacen(a = 'sm') {
  return `${a}.resultado IN (${lista(VENDIBLES)})`;
}

/**
 * LO QUE SALIÓ HECHO HIELO, se venda o no.
 *
 * Es el número que se usa para el costo por marqueta: una hueca que se
 * botó gastó la misma agua, la misma luz y el mismo molde que una sellada.
 * Las aguadas NO están aquí porque de ellas no salió marqueta ninguna — y
 * no se puede repartir un costo entre marquetas que no existen.
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
 *   · "falló si salió hueca" — igual de malo el día en que el paño ENTERO
 *     sale hueco: eso es la fábrica, no el molde.
 *
 * Comparándolo contra su paño, las dos cosas quedan bien dichas: la noche
 * mala no señala a nadie, y el molde que sale hueco mientras sus vecinos
 * salen al 80% queda marcado al instante.
 *
 * LA CONTAMINACIÓN ES LA EXCEPCIÓN, y por eso lleva su propio renglón
 * abajo: un molde roto por el que entra salmuera está roto aunque el paño
 * entero esté salado —eso querría decir que se rompieron varios— y ahí
 * marcarlos todos es exactamente lo que uno quiere.
 */
const RANGO = new Map([
  ['sellada', 0], ['c80', 1], ['c60', 2], ['c40', 3],
  ['hueca', 4], ['otro', 4], ['contaminada', 5], ['aguada', 6]
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
 * los empatados —así una mitad al 80% y una mitad hueca deja marcada la
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
 * Está aquí y no en las rutas porque son tres las que guardan hielo —la del
 * paño, la captura en lote y la corrección— y una regla escrita tres veces
 * es una regla que tarde o temprano dice tres cosas distintas.
 *
 * `omision` es lo que se eligió para el paño entero: un molde suelto que no
 * diga nada sigue al del paño, que es lo que uno espera.
 */
function interpretar(entrada = {}, omision = {}) {
  const resultado = String(entrada.resultado || omision.resultado || CALIDAD_POR_OMISION);
  if (!RESULTADOS.includes(resultado)) {
    throw new Error(`No conozco ese estado del hielo: ${resultado}.`);
  }

  // La nota es obligatoria en "otro" —un "otro" sin explicación no sirve
  // para nada dentro de un año— y opcional en todo lo demás, que a veces
  // hace falta: "hueca, se fue la luz a media noche".
  const escrita = String(entrada.nota ?? omision.nota ?? '').trim().slice(0, 300);
  if (pideNota(resultado) && !escrita) {
    throw new Error('Elegiste "Otro": escribe qué pasó, aunque sea corto.');
  }

  return { resultado, nota: escrita || null };
}

/**
 * El resumen de una mezcla, con los totales que de verdad se enseñan.
 * `mezcla` es un objeto { sellada, c80, ..., otro }.
 */
function resumir(mezcla = {}) {
  const n = (c) => Number(mezcla[c] || 0);

  const salieron = RESULTADOS.reduce((t, c) => t + n(c), 0);
  const sinHielo = SIN_HIELO.reduce((t, c) => t + n(c), 0);
  const vendibles = VENDIBLES.reduce((t, c) => t + n(c), 0);

  return {
    ...Object.fromEntries(RESULTADOS.map((c) => [c, n(c)])),
    // Los moldes que se abrieron, incluidos los que no dieron nada.
    salieron,
    // Todo lo que salió hecho hielo, aunque se haya botado.
    producidas: salieron - sinHielo,
    // Lo que quedó en el cuarto frío para vender.
    alAlmacen: vendibles,
    // Lo que se botó: hueca, salada, aguada y "otro". Es el número que dice
    // cómo va el frío, y antes quedaba escondido detrás del destino.
    merma: salieron - vendibles,
    porcientoMerma: salieron ? Math.round(((salieron - vendibles) / salieron) * 100) : 0
  };
}

module.exports = {
  CALIDADES, CLAVES_CALIDAD, RESULTADOS, CALIDAD_POR_OMISION,
  PIDEN_NOTA, SIN_HIELO, VENDIBLES, MERMAS,
  nombreDe, pideNota,
  alAlmacen, salioHielo, columnasMezcla,
  esFallo, comoSalioLaMayoria, interpretar, resumir
};
