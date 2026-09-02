/**
 * ESTADO DE LAS CANASTAS — deducido, nunca guardado.
 *
 * REGLA DE ORO 3.2: no existe ninguna columna "estado" que se edite.
 * El estado sale de mirar cuál fue el último evento de cada canasta:
 *
 *   último = rellenado  y aún no cumple las horas  ->  CONGELANDO
 *   último = rellenado  y ya cumplió las horas     ->  LISTA
 *   último = sacada                                ->  FUERA  (alerta)
 *   sin eventos todavía                            ->  LISTA (sin registro)
 *
 * Lo bueno de esto: los cortes, auditorías y reportes de cualquier fecha
 * se pueden reconstruir, porque los eventos nunca cambian.
 */
const { bd } = require('../../db/conexion');
const { siguientePano, explicar, ordenIntercalado } = require('./rotacion');
const { esFallo, comoSalioLaMayoria, alAlmacen } = require('./calidad');

const ESTADOS = {
  CONGELANDO: 'congelando',
  LISTA: 'lista',
  FUERA: 'fuera'
};

/** Horas transcurridas entre dos fechas ISO. */
function horasDesde(iso, hasta = new Date()) {
  return (hasta.getTime() - new Date(iso).getTime()) / 3600000;
}

/**
 * Último evento de cada canasta de un tanque, en una sola consulta.
 * Devuelve un mapa: canasta_id -> { tipo, fecha, ... }
 */
function ultimosEventos(tanqueId) {
  const filas = bd.prepare(`
    WITH eventos AS (
      SELECT r.canasta_id, 'rellenado' AS tipo, r.fecha, r.id AS evento_id,
             r.tipo_agua, r.ejecutor_id
      FROM rellenados r
      JOIN canastas c ON c.id = r.canasta_id
      JOIN panos p    ON p.id = c.pano_id
      WHERE p.tanque_id = ?

      UNION ALL

      SELECT s.canasta_id, 'sacada' AS tipo, s.fecha, s.id AS evento_id,
             NULL AS tipo_agua, s.ejecutor_id
      FROM sacadas s
      JOIN canastas c ON c.id = s.canasta_id
      JOIN panos p    ON p.id = c.pano_id
      WHERE p.tanque_id = ?
    )
    SELECT e.*
      FROM eventos e
      JOIN (
        SELECT canasta_id, MAX(fecha) AS ultima
          FROM eventos GROUP BY canasta_id
      ) u ON u.canasta_id = e.canasta_id AND u.ultima = e.fecha
  `).all(tanqueId, tanqueId);

  const mapa = new Map();
  for (const f of filas) {
    // Si un rellenado y una sacada cayeran en el mismo instante, manda el
    // rellenado: es lo que ocurre al sacar y rellenar de corrido.
    const previo = mapa.get(f.canasta_id);
    if (!previo || f.tipo === 'rellenado') mapa.set(f.canasta_id, f);
  }
  return mapa;
}

/**
 * Calcula el estado de una canasta a partir de su último evento.
 * horasTanque = las horas de congelación configuradas en el tanque.
 */
function estadoDeCanasta(ultimo, horasTanque) {
  if (!ultimo) {
    return { estado: ESTADOS.LISTA, sinRegistro: true, horas: null, listaEn: null };
  }

  if (ultimo.tipo === 'sacada') {
    return {
      estado: ESTADOS.FUERA,
      sinRegistro: false,
      horas: horasDesde(ultimo.fecha),      // cuánto lleva fuera del tanque
      listaEn: null,
      desde: ultimo.fecha
    };
  }

  const horas = horasDesde(ultimo.fecha);
  const cumplio = horas >= horasTanque;
  return {
    estado: cumplio ? ESTADOS.LISTA : ESTADOS.CONGELANDO,
    sinRegistro: false,
    horas,
    listaEn: cumplio ? 0 : horasTanque - horas,
    tipoAgua: ultimo.tipo_agua,
    desde: ultimo.fecha,
    rellenadoId: ultimo.evento_id
  };
}

/**
 * Último resultado conocido de cada molde de un tanque.
 * Sirve para pintar en la pantalla el molde que falló la última vez: si uno
 * aparece marcado siempre, hay un problema físico en ese molde concreto.
 *
 * QUÉ CUENTA COMO FALLO: que ese molde saliera PEOR QUE EL RESTO de los
 * que salieron con él, en su mismo paño. La regla y el porqué están en
 * calidad.js; lo que aquí importa es que por eso hace falta leer también a
 * qué sacada perteneció cada renglón, para saber contra qué compararlo.
 */
function ultimoResultadoPorMolde(tanqueId) {
  // Historial completo de cada molde, del más reciente al más antiguo.
  const filas = bd.prepare(`
    SELECT sm.molde_id, sm.resultado, s.fecha, s.sacada_pano_id
      FROM sacadas_moldes sm
      JOIN sacadas s   ON s.id = sm.sacada_id
      JOIN canastas c  ON c.id = s.canasta_id
      JOIN panos p     ON p.id = c.pano_id
     WHERE p.tanque_id = ?
     ORDER BY sm.molde_id, s.fecha DESC
  `).all(tanqueId);

  // Cómo salió la mayoría de cada paño: es la vara contra la que se mide
  // cada molde. Se calcula una vez para todos y no molde por molde.
  const porSacada = new Map();
  for (const f of filas) {
    const clave = f.sacada_pano_id || `suelta:${f.fecha}`;
    if (!porSacada.has(clave)) porSacada.set(clave, []);
    porSacada.get(clave).push(f.resultado);
  }
  const mayoria = new Map(
    [...porSacada].map(([clave, lista]) => [clave, comoSalioLaMayoria(lista)]));

  const vara = (f) => mayoria.get(f.sacada_pano_id || `suelta:${f.fecha}`);
  const fallo = (f) => esFallo(f.resultado, vara(f));

  const mapa = new Map();
  for (const f of filas) {
    const previo = mapa.get(f.molde_id);

    if (!previo) {
      // La primera fila de cada molde es su última salida.
      mapa.set(f.molde_id, {
        resultado: f.resultado,
        racha: fallo(f) ? 1 : 0,
        contando: fallo(f)
      });
      continue;
    }

    // Cuántas veces SEGUIDAS ha fallado: en cuanto sale bien una vez, se
    // corta la cuenta. Un molde con racha alta tiene un problema físico;
    // uno con racha de 1 fue mala suerte de ese día.
    if (previo.contando && fallo(f)) previo.racha++;
    else previo.contando = false;
  }
  return mapa;
}

/** Sacadas de paño empezadas y sin terminar en un tanque. */
function panosEnProceso(tanqueId) {
  return bd.prepare(`
    SELECT sp.*, p.numero AS pano_numero,
           COALESCE(u.nombre, sp.ejecutor_libre) AS ejecutor_nombre
      FROM sacadas_pano sp
      JOIN panos p ON p.id = sp.pano_id
      LEFT JOIN usuarios u ON u.id = sp.ejecutor_id
     WHERE p.tanque_id = ? AND sp.terminada_en IS NULL AND p.activo = 1
     ORDER BY sp.iniciada_en
  `).all(tanqueId);
}

/**
 * LA ÚLTIMA VEZ QUE SE SACÓ CADA PAÑO.
 *
 * Cuándo, quién y cuántas horas llevaba congelando. Es lo primero que se
 * pregunta mirando la lista de paños, y hasta ahora había que entrar paño
 * por paño para averiguarlo.
 *
 * QUIÉN puede ser MÁS DE UNO. Un paño se puede sacar canasta por canasta, y
 * pasa que lo empieza el turno de la tarde y lo termina el de la mañana
 * siguiente: cada canasta guarda su propio responsable. Aquí se juntan los
 * nombres de todos los que le metieron mano, sin repetir.
 *
 * Los paños anulados no cuentan: si alguien se equivocó de paño y lo anuló,
 * ese paño NO se sacó, y decir lo contrario mandaría a la gente a buscar
 * hielo que no existe.
 */
function ultimaSacadaPorPano(tanqueId) {
  const filas = bd.prepare(`
    SELECT sp.id, sp.pano_id, sp.iniciada_en, sp.terminada_en,
           COALESCE(u.nombre, sp.ejecutor_libre) AS quien
      FROM sacadas_pano sp
      JOIN panos p         ON p.id = sp.pano_id
      LEFT JOIN usuarios u ON u.id = sp.ejecutor_id
     WHERE p.tanque_id = ?
       AND sp.terminada_en IS NOT NULL
       AND (sp.notas IS NULL OR sp.notas NOT LIKE 'ANULADA%')
     ORDER BY sp.pano_id, sp.terminada_en DESC
  `).all(tanqueId);

  // La primera fila de cada paño es su última sacada: la consulta ya viene
  // ordenada de la más nueva a la más vieja dentro de cada paño.
  const mapa = new Map();
  for (const f of filas) if (!mapa.has(f.pano_id)) mapa.set(f.pano_id, f);
  if (!mapa.size) return mapa;

  const ids = [...mapa.values()].map((f) => f.id);
  const huecos = ids.map(() => '?').join(',');

  // Los responsables de cada canasta y las horas que estuvo congelando.
  const detalle = bd.prepare(`
    SELECT s.sacada_pano_id,
           COALESCE(u.nombre, '') AS nombre,
           AVG(s.horas_congelacion) AS horas
      FROM sacadas s
      LEFT JOIN usuarios u ON u.id = s.ejecutor_id
     WHERE s.sacada_pano_id IN (${huecos})
     GROUP BY s.sacada_pano_id, s.ejecutor_id
  `).all(...ids);

  const alMacen = bd.prepare(`
    SELECT s.sacada_pano_id, COUNT(*) AS n
      FROM sacadas_moldes sm
      JOIN sacadas s ON s.id = sm.sacada_id
     WHERE s.sacada_pano_id IN (${huecos})
       AND ${alAlmacen('sm')}
     GROUP BY s.sacada_pano_id
  `).all(...ids);
  const marquetas = new Map(alMacen.map((f) => [f.sacada_pano_id, f.n]));

  for (const [panoId, f] of mapa) {
    const suyas = detalle.filter((d) => d.sacada_pano_id === f.id);
    const nombres = new Set([f.quien, ...suyas.map((d) => d.nombre)].filter(Boolean));
    const horas = suyas.map((d) => d.horas).filter((h) => h != null);

    mapa.set(panoId, {
      fecha: f.terminada_en,
      empezada: f.iniciada_en,
      quienes: [...nombres],
      horas: horas.length ? horas.reduce((a, b) => a + b, 0) / horas.length : null,
      marquetas: marquetas.get(f.id) || 0
    });
  }
  return mapa;
}

/**
 * Estructura completa de un tanque con el estado de cada canasta.
 * Es lo que pinta la pantalla de producción.
 */
function tanqueConEstado(tanqueId) {
  const tanque = bd.prepare('SELECT * FROM tanques WHERE id = ? AND activo = 1').get(tanqueId);
  if (!tanque) return null;

  const eventos = ultimosEventos(tanqueId);
  const resultados = ultimoResultadoPorMolde(tanqueId);
  const ultimas = ultimaSacadaPorPano(tanqueId);
  const enProceso = panosEnProceso(tanqueId);
  const panosEnProcesoIds = new Set(enProceso.map((x) => x.pano_id));

  const panos = bd.prepare(
    'SELECT * FROM panos WHERE tanque_id = ? AND activo = 1 ORDER BY numero'
  ).all(tanqueId);

  const canastasDe = bd.prepare(
    'SELECT * FROM canastas WHERE pano_id = ? AND activo = 1 ORDER BY numero'
  );
  const moldesDe = bd.prepare(
    'SELECT id, numero FROM moldes WHERE canasta_id = ? AND activo = 1 ORDER BY numero'
  );

  for (const pano of panos) {
    pano.canastas = canastasDe.all(pano.id).map((c) => {
      const info = estadoDeCanasta(eventos.get(c.id), tanque.horas_congelacion);
      const moldes = moldesDe.all(c.id).map((m) => {
        const h = resultados.get(m.id);
        return {
          ...m,
          ultimoResultado: h?.resultado || null,
          // Que la pantalla no tenga que saber cuáles resultados son un
          // fallo: la regla vive en un solo sitio y viaja ya resuelta.
          ultimoFallo: Boolean(h?.racha),
          rachaFallos: h?.racha || 0
        };
      });
      return { ...c, ...info, moldes };
    });

    pano.total_moldes = pano.canastas.reduce((n, c) => n + c.moldes.length, 0);

    // El estado del paño es el de sus canastas: si alguna está fuera, el
    // paño entero está en alerta; si todas están listas, el paño está listo.
    const estados = pano.canastas.map((c) => c.estado);
    pano.estado = estados.includes(ESTADOS.FUERA) ? ESTADOS.FUERA
                : estados.every((e) => e === ESTADOS.LISTA) ? ESTADOS.LISTA
                : ESTADOS.CONGELANDO;

    // Las horas que se muestran a la derecha del paño: las de la canasta
    // que lleva menos tiempo, que es la que marca cuándo estará listo todo.
    const congelando = pano.canastas.filter((c) => c.estado === ESTADOS.CONGELANDO);
    pano.horas = congelando.length ? Math.min(...congelando.map((c) => c.horas)) : null;
    pano.sinRegistro = pano.canastas.every((c) => c.sinRegistro);

    // Un paño empezado y sin terminar: alguien tiene que ir a acabarlo.
    pano.enProceso = panosEnProcesoIds.has(pano.id);
    if (pano.enProceso) {
      const abierta = enProceso.find((x) => x.pano_id === pano.id);
      pano.sacadaPanoId = abierta.id;
      pano.empezadoPor = abierta.ejecutor_nombre;
      pano.empezadoEn = abierta.iniciada_en;
      pano.estado = 'proceso';
    }

    // Moldes señalados en este paño: los que vienen saliendo peor que sus
    // vecinos. Es el número rojo del renglón.
    pano.moldesMarcados = pano.canastas.reduce(
      (n, c) => n + c.moldes.filter((m) => m.ultimoFallo).length, 0);

    // La última vez que este paño se sacó de verdad: cuándo, quién y
    // cuántas horas llevaba congelando. Es lo que se pregunta al mirar la
    // lista —"¿este cuándo se sacó?"— y antes había que entrar a buscarlo.
    pano.ultimaSacada = ultimas.get(pano.id) || null;
  }

  tanque.panos = panos;

  // Qué paño toca, según la rotación intercalada.
  const numeros = panos.map((p) => p.numero);
  const numerosEnProceso = panos.filter((p) => p.enProceso).map((p) => p.numero);
  const toca = siguientePano(numeros, tanque.ultimo_pano_sacado, numerosEnProceso);

  // El orden completo de la rotación viaja a la pantalla: así, al marcar
  // varios paños seguidos, la pantalla sabe cuál sería el siguiente sin
  // preguntarle al servidor en cada toque.
  tanque.ordenRotacion = ordenIntercalado(numeros);
  tanque.ultimoPanoSacado = tanque.ultimo_pano_sacado;

  // Cuándo salió hielo de este tanque por última vez. Va junto al "toca"
  // porque la pregunta viene enseguida: "¿y eso cuándo fue?".
  const fechas = [...ultimas.values()].map((u) => u.fecha).filter(Boolean).sort();
  tanque.ultimaSalida = fechas.length ? fechas[fechas.length - 1] : null;

  tanque.siguiente = toca == null ? null : {
    numero: toca,
    id: panos.find((p) => p.numero === toca)?.id || null,
    porque: explicar(numeros, tanque.ultimo_pano_sacado, numerosEnProceso)
  };

  return tanque;
}

/**
 * SECCIÓN 6.5 — Rotación intercalada.
 * No se configura: emerge del dato. Se sugiere el paño LISTO que lleva más
 * tiempo congelando; la rotación 1, 3, 5... 2, 4, 6... aparece sola.
 */
function panoSugerido(tanque) {
  const listos = tanque.panos.filter((p) => p.estado === ESTADOS.LISTA);
  if (!listos.length) return null;

  // Entre los listos, el que se rellenó primero (más tiempo congelando).
  const conFecha = listos
    .map((p) => {
      const fechas = p.canastas.map((c) => c.desde).filter(Boolean);
      return { pano: p, desde: fechas.length ? fechas.sort()[0] : null };
    });

  // Los que nunca se han registrado van al final: primero lo que sí tiene historia.
  const conHistoria = conFecha.filter((x) => x.desde);
  if (conHistoria.length) {
    conHistoria.sort((a, b) => a.desde.localeCompare(b.desde));
    return conHistoria[0].pano;
  }
  return listos[0];
}

/** Canastas que se sacaron y quedaron sin rellenar. Alerta al cerrar el turno (6.3). */
function canastasFuera() {
  return bd.prepare(`
    WITH ultimo AS (
      SELECT canasta_id, MAX(fecha) AS fecha FROM (
        SELECT canasta_id, fecha FROM rellenados
        UNION ALL
        SELECT canasta_id, fecha FROM sacadas
      ) GROUP BY canasta_id
    )
    SELECT s.canasta_id, s.fecha, c.numero AS canasta, p.numero AS pano, t.nombre AS tanque
      FROM sacadas s
      JOIN ultimo u   ON u.canasta_id = s.canasta_id AND u.fecha = s.fecha
      JOIN canastas c ON c.id = s.canasta_id
      JOIN panos p    ON p.id = c.pano_id
      JOIN tanques t  ON t.id = p.tanque_id
     WHERE c.activo = 1 AND p.activo = 1 AND t.activo = 1
       AND NOT EXISTS (
         SELECT 1 FROM rellenados r
          WHERE r.canasta_id = s.canasta_id AND r.fecha >= s.fecha
       )
     ORDER BY t.nombre, p.numero, c.numero
  `).all();
}

module.exports = {
  ESTADOS, horasDesde, ultimosEventos, estadoDeCanasta,
  tanqueConEstado, panoSugerido, canastasFuera,
  ultimoResultadoPorMolde, panosEnProceso, ultimaSacadaPorPano
};
