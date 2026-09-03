/**
 * LOS VALES  (v4.3)
 *
 * En la fábrica hay dos papelitos que se llaman igual y son opuestos:
 *
 *   · VALE DE RETIRO — alguien se llevó efectivo del cajón para que no se
 *     junte mucho dinero. Cambió de sitio; no se gastó, y nadie debe nada.
 *
 *   · VALE DE RAYA — un trabajador se llevó por adelantado parte de su
 *     sueldo de la semana. Sí es gasto (el sueldo lo es), y además hay que
 *     acordarse el sábado de pagarle de menos.
 *
 * Los dos salen del cajón igual y por eso viven en `movimientos_caja` como
 * cualquier otra salida. Lo que los separa del desayuno y la gasolina es
 * `conceptos_gasto.es_vale`: el dinero se lo llevó UNA PERSONA CON NOMBRE,
 * contra su firma.
 *
 * De lo que se debe NO HAY NINGUNA COLUMNA (regla 3.2): se suma de los
 * renglones cada vez que se pregunta.
 */
const { bd } = require('../../db/conexion');

/**
 * LOS DOS VALES, tal como tienen que existir.
 *
 * Están escritos aquí y no solo sembrados en la base: un vale es una parte
 * del programa, no un gasto que alguien dio de alta. La lista de "gastos
 * que se repiten" se edita, se da de baja y se limpia —y así tiene que
 * ser—, pero si al hacerlo se llevaba por delante el botón de vales, el
 * programa quedaba roto desde una pantalla de ajustes. Eso fue justo lo
 * que pasó.
 */
const VALES = {
  retiro: {
    id: 'gasto-retiro', nombre: 'Retiro a la caja fuerte', traspaso: 1, orden: 3,
    ayuda: 'Cuando ya hay mucho efectivo junto'
  },
  raya: {
    // "Vales no se llama vale en raya, no sé qué es eso; sería mejor Vale
    // sueldo." El id no cambia (regla 3.3): los vales viejos siguen
    // colgando de él.
    id: 'gasto-vale-raya', nombre: 'Vale sueldo', traspaso: 0, orden: 6,
    ayuda: 'Parte de su sueldo de la semana, pedida antes'
  }
};

/** Un concepto vivo que ya se llame así. El nombre es único entre los vivos. */
function vivoConEseNombre(nombre, salvo = '') {
  return bd.prepare(`
    SELECT * FROM conceptos_gasto
     WHERE activo = 1 AND oculto = 0 AND lower(nombre) = lower(?) AND id <> ?
  `).get(nombre, salvo) || null;
}

/**
 * EL CONCEPTO DE UN VALE, PASE LO QUE PASE.
 *
 * Si está, se usa. Si lo dieron de baja o lo quitaron de la lista, SE
 * REVIVE. Si nunca existió, se crea. Nunca devuelve nada que impida hacer
 * un vale, porque no hay ningún ajuste que deba poder impedirlo.
 *
 * El único caso raro: que alguien haya creado a mano otro concepto con ese
 * mismo nombre. Entonces se adopta el suyo —es el que la gente ya está
 * tocando— y se le ponen las banderas que le tocan.
 */
function conceptoDeVale(clase) {
  const def = VALES[clase];
  if (!def) return null;

  const marcar = (id) => {
    bd.prepare('UPDATE conceptos_gasto SET es_vale = 1, es_traspaso = ? WHERE id = ?')
      .run(def.traspaso, id);
    return bd.prepare('SELECT * FROM conceptos_gasto WHERE id = ?').get(id);
  };

  const mio = bd.prepare('SELECT * FROM conceptos_gasto WHERE id = ?').get(def.id);

  if (mio && mio.activo && !mio.oculto) {
    return mio.es_vale ? mio : marcar(mio.id);
  }

  // Lo dieron de baja, lo ocultaron, o nunca estuvo. Antes de revivirlo o
  // crearlo hay que mirar si ya hay otro vivo con ese nombre: los nombres
  // de los conceptos vivos no se repiten.
  const ajeno = vivoConEseNombre(def.nombre, def.id);
  if (ajeno) return marcar(ajeno.id);

  if (mio) {
    bd.prepare(`
      UPDATE conceptos_gasto
         SET activo = 1, oculto = 0, fecha_baja = NULL, es_vale = 1, es_traspaso = ?
       WHERE id = ?
    `).run(def.traspaso, mio.id);
    return bd.prepare('SELECT * FROM conceptos_gasto WHERE id = ?').get(mio.id);
  }

  bd.prepare(`
    INSERT INTO conceptos_gasto
      (id, nombre, tipo, orden, ayuda, es_vale, es_traspaso, fecha_alta)
    VALUES (?, ?, 'salida', ?, ?, 1, ?, datetime('now'))
  `).run(def.id, def.nombre, def.orden, def.ayuda, def.traspaso);
  return bd.prepare('SELECT * FROM conceptos_gasto WHERE id = ?').get(def.id);
}

/** Los dos, listos para usarse. Los revive si hace falta. */
function conceptosDeVale() {
  return Object.keys(VALES).map((clase) => conceptoDeVale(clase)).filter(Boolean);
}

/** ¿Este concepto es el de un vale? Los vales no se dan de baja a mano. */
function esConceptoDeVale(id) {
  return Object.values(VALES).some((v) => v.id === id)
    || Boolean(bd.prepare('SELECT es_vale FROM conceptos_gasto WHERE id = ?').get(id)?.es_vale);
}

/**
 * LAS SALIDAS DEL TURNO, PARTIDAS EN DOS.
 *
 * "Que el corte separe gastos de vales/retiros."
 *
 * Sumar en el mismo renglón la gasolina de la camioneta con los $2,000 que
 * se llevó el patrón hace que un corte con mucha salida no diga nada: no se
 * sabe si la fábrica gastó mucho o si nada más movieron el dinero.
 *
 * Ojo: los dos ya están restados del "debería haber". Esto no cambia
 * ninguna cuenta, solo parte la explicación en dos montones.
 */
function salidasPartidas(cajaId) {
  const filas = bd.prepare(`
    SELECT m.*, u.nombre AS ejecutor_nombre,
           COALESCE(c.es_vale, 0)      AS es_vale,
           COALESCE(c.es_traspaso, 0)  AS es_traspaso
      FROM movimientos_caja m
      LEFT JOIN usuarios u        ON u.id = m.ejecutor_id
      LEFT JOIN conceptos_gasto c ON c.id = m.concepto_id
     WHERE m.caja_id = ? AND m.tipo = 'salida' AND m.anulado_en IS NULL
     ORDER BY m.fecha
  `).all(cajaId);

  const vales = filas.filter((f) => f.es_vale);
  const gastos = filas.filter((f) => !f.es_vale);
  const suma = (lista) => lista.reduce((n, f) => n + f.centavos, 0);

  return {
    gastos,
    vales,
    gastosCentavos: suma(gastos),
    valesCentavos: suma(vales),
    // Lo que se llevaron y NO era gasto de la fábrica: el retiro a la caja
    // fuerte. Es el dinero del turno que ya está en manos del dueño, y por
    // eso se suma aparte con lo que entreguen al final.
    traspasadoCentavos: suma(vales.filter((f) => f.es_traspaso))
  };
}

// ============================================================
// LA LIBRETA DE LOS VALES DE RAYA
// ============================================================

const CAMPOS_ADELANTO = `
  a.*, u.nombre AS usuario_nombre, cap.nombre AS capturista_nombre,
  des.nombre AS descontado_por_nombre, anu.nombre AS anulado_por_nombre,
  cj.folio AS caja_folio
`;
const DE_ADELANTO = `
  FROM adelantos a
  LEFT JOIN usuarios u   ON u.id = a.usuario_id
  LEFT JOIN usuarios cap ON cap.id = a.capturista_id
  LEFT JOIN usuarios des ON des.id = a.descontado_por
  LEFT JOIN usuarios anu ON anu.id = a.anulado_por
  LEFT JOIN cajas cj     ON cj.id = a.caja_id
`;

/** Los vales de raya de una persona, del más nuevo al más viejo. */
function adelantosDe(usuarioId, { limite = 40 } = {}) {
  return bd.prepare(`
    SELECT ${CAMPOS_ADELANTO} ${DE_ADELANTO}
     WHERE a.usuario_id = ?
     ORDER BY a.fecha DESC
     LIMIT ?
  `).all(usuarioId, limite);
}

/**
 * CUÁNTO SE LE TIENE QUE DESCONTAR EL DÍA DE LA RAYA.
 *
 * Los que ya se descontaron no cuentan, y los anulados tampoco. Nunca se
 * guarda: se suma aquí cada vez.
 */
function pendienteDe(usuarioId) {
  return bd.prepare(`
    SELECT COALESCE(SUM(centavos), 0) AS centavos, COUNT(*) AS cuantos,
           MIN(fecha) AS desde
      FROM adelantos
     WHERE usuario_id = ? AND descontado_en IS NULL AND anulado_en IS NULL
  `).get(usuarioId);
}

/** Lo mismo para toda la fábrica de un jalón, para pintar la lista. */
function pendientesDeTodos() {
  const filas = bd.prepare(`
    SELECT usuario_id, COALESCE(SUM(centavos), 0) AS centavos,
           COUNT(*) AS cuantos, MIN(fecha) AS desde
      FROM adelantos
     WHERE descontado_en IS NULL AND anulado_en IS NULL
     GROUP BY usuario_id
  `).all();
  return new Map(filas.map((f) => [f.usuario_id, f]));
}

/** Los vales de raya que salieron de un turno, para su corte. */
function adelantosDelTurno(cajaId) {
  return bd.prepare(`
    SELECT ${CAMPOS_ADELANTO} ${DE_ADELANTO}
     WHERE a.caja_id = ? AND a.anulado_en IS NULL
     ORDER BY a.fecha
  `).all(cajaId);
}

/** Un vale de raya por el movimiento del que salió, para poder anularlo con él. */
function adelantoDelMovimiento(movimientoId) {
  return bd.prepare(
    'SELECT * FROM adelantos WHERE movimiento_id = ? AND anulado_en IS NULL'
  ).get(movimientoId) || null;
}

module.exports = {
  VALES, conceptoDeVale, conceptosDeVale, esConceptoDeVale, salidasPartidas,
  adelantosDe, pendienteDe, pendientesDeTodos, adelantosDelTurno, adelantoDelMovimiento
};
