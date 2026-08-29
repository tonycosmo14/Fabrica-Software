/**
 * LA CAJA  (v0.9)
 *
 * Un turno de caja se abre con un fondo, se le van pegando las ventas solas,
 * se le anotan los gastos y los retiros, y se cierra contando el dinero.
 *
 * Reglas que mandan aquí:
 *
 *  3.2  No hay saldo guardado: el dinero se calcula de los movimientos.
 *  3.4  Nada se borra. Un movimiento mal capturado se anula, con motivo.
 *  3.6  Doble responsable: quién se llevó el dinero y quién lo anotó.
 *
 * Y una regla propia de este módulo: SOLO PUEDE HABER UN TURNO ABIERTO.
 * Con dos turnos abiertos a la vez, ninguna venta sabría a cuál pertenece y
 * los dos cortes saldrían mal.
 */
const express = require('express');
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');
const { ok, error } = require('../../lib/respuestas');
const { leerPesos } = require('../../lib/dinero');
const bitacora = require('../../lib/bitacora');
const { exigirPermiso } = require('../../middleware/sesion');
const { comprobarAdmin, administradores } = require('../../lib/autorizacion');
const {
  sesionAbierta, movimientos, estadoCaja, conteoVentas, desglosePorPersona
} = require('./calculo');

const router = express.Router();

const verCaja = exigirPermiso('caja.ver');
const operarCaja = exigirPermiso('caja.operar');
const corregir = exigirPermiso('venta.cancelar');   // gerente y administrador

/**
 * Lee un importe tecleado. Vive en lib/dinero porque el mismo error
 * —limpiar la cadena a la brava y quedarse con un 0 que nadie escribió—
 * ya apareció en tres módulos distintos.
 */
function leerImporte(valor, { permitirCero = true } = {}) {
  return leerPesos(valor, { permitirCero });
}

// ============================================================
// EL TURNO
// ============================================================

/** Cómo va la caja ahora mismo. Es la pantalla principal del módulo. */
router.get('/', verCaja, (req, res) => {
  const caja = sesionAbierta();
  if (!caja) {
    const ultima = bd.prepare(`
      SELECT c.*, u.nombre AS cajero_nombre FROM cajas c
        LEFT JOIN usuarios u ON u.id = c.cajero_id
       ORDER BY c.cerrada_en DESC LIMIT 1
    `).get() || null;
    return ok(res, { abierta: null, ultimoCorte: ultima });
  }

  return ok(res, {
    abierta: estadoCaja(caja),
    movimientos: movimientos(caja.id),
    sinDueno: !caja.cajero_id
  });
});

/** Abrir el turno con el fondo con el que arranca el cajón. */
router.post('/abrir', operarCaja, (req, res) => {
  if (sesionAbierta()) {
    return error(res, 'Ya hay un turno de caja abierto. Ciérralo antes de abrir otro.', 409);
  }

  const fondo = leerImporte(req.body?.fondo ?? 0);
  if (fondo === null) return error(res, 'El fondo no es un importe válido.');

  const id = nuevoId();
  const cajeroId = req.body?.cajeroId || req.usuario.id;

  const abrir = bd.transaction(() => {
    // El folio se toma dentro de la transacción, igual que en las ventas.
    const folio = bd.prepare('SELECT COALESCE(MAX(folio), 0) n FROM cajas').get().n + 1;
    bd.prepare(`
      INSERT INTO cajas (id, folio, cajero_id, abierta_por, abierta_en, fondo_centavos, notas_apertura)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, folio, cajeroId, req.usuario.id, ahora(), fondo, req.body?.notas || null);
    return folio;
  });
  const folio = abrir();

  bitacora.registrar({
    accion: 'caja.abierta', entidad: 'caja', entidadId: id,
    ejecutorId: cajeroId, capturistaId: req.usuario.id,
    detalle: { folio, fondo }
  });

  return ok(res, { abierta: estadoCaja(sesionAbierta()), movimientos: [] }, 201);
});

/**
 * Cerrar el turno: se cuenta el dinero y el sistema dice si cuadra.
 * Los números quedan CONGELADOS (regla 3.2): cancelar mañana una venta de
 * hoy no cambia un corte que ya se firmó.
 */
router.post('/cerrar', operarCaja, (req, res) => {
  const caja = sesionAbierta();
  if (!caja) return error(res, 'No hay ningún turno de caja abierto.', 409);

  const contado = leerImporte(req.body?.contado);
  if (contado === null) return error(res, 'Escribe cuánto dinero contaste.');

  const estado = estadoCaja(caja);
  const diferencia = contado - estado.esperado;

  bd.prepare(`
    UPDATE cajas SET
      cerrada_en = ?, cerrada_por = ?, contado_centavos = ?, esperado_centavos = ?,
      diferencia_centavos = ?, vendido_centavos = ?, entradas_centavos = ?,
      salidas_centavos = ?, notas_cierre = ?
    WHERE id = ?
  `).run(ahora(), req.usuario.id, contado, estado.esperado, diferencia,
         estado.vendido, estado.entradas, estado.salidas,
         req.body?.notas || null, caja.id);

  bitacora.registrar({
    accion: 'caja.cerrada', entidad: 'caja', entidadId: caja.id,
    ejecutorId: caja.cajero_id, capturistaId: req.usuario.id,
    detalle: { folio: caja.folio, esperado: estado.esperado, contado, diferencia }
  });

  return ok(res, { corte: detalleCorte(caja.id) });
});

/**
 * ENTREGAR EL TURNO sin que haya llegado el que sigue.
 *
 * Es el caso de las 2:30 de la tarde: se entrega la existencia y se cuenta
 * el dinero del cajero que se va, pero el que entra todavía no llega y la
 * venta no se puede parar.
 *
 * Se cierra el turno del que se va y se abre uno NUEVO SIN DUEÑO. Las
 * ventas siguen entrando ahí, y quedan apartadas para quien llegue: en
 * cuanto ponga su PIN, el turno se le asigna. Cada venta guarda además
 * quién la tecleó, así que el histórico no miente.
 */
router.post('/entregar', operarCaja, (req, res) => {
  const caja = sesionAbierta();
  if (!caja) return error(res, 'No hay ningún turno de caja abierto.', 409);
  if (!caja.cajero_id) {
    return error(res, 'Ese turno todavía está esperando dueño. No se puede entregar dos veces.', 409);
  }

  const contado = leerImporte(req.body?.contado);
  if (contado === null) return error(res, 'Escribe cuánto dinero contaste.');

  const estado = estadoCaja(caja);
  const diferencia = contado - estado.esperado;
  const fecha = ahora();
  const nuevoId2 = nuevoId();

  const entregar = bd.transaction(() => {
    bd.prepare(`
      UPDATE cajas SET
        cerrada_en = ?, cerrada_por = ?, contado_centavos = ?, esperado_centavos = ?,
        diferencia_centavos = ?, vendido_centavos = ?, entradas_centavos = ?,
        salidas_centavos = ?, notas_cierre = ?
      WHERE id = ?
    `).run(fecha, req.usuario.id, contado, estado.esperado, diferencia,
           estado.vendido, estado.entradas, estado.salidas,
           req.body?.notas || 'Entrega de turno', caja.id);

    const folio = bd.prepare('SELECT COALESCE(MAX(folio), 0) n FROM cajas').get().n + 1;
    // cajero_id va en NULL a propósito: ese es el turno que espera dueño.
    bd.prepare(`
      INSERT INTO cajas (id, folio, cajero_id, abierta_por, abierta_en, fondo_centavos, notas_apertura)
      VALUES (?, ?, NULL, ?, ?, 0, ?)
    `).run(nuevoId2, folio, req.usuario.id, fecha, 'Esperando al cajero que entra');
    return folio;
  });
  const folioNuevo = entregar();

  bitacora.registrar({
    accion: 'caja.entregada', entidad: 'caja', entidadId: caja.id,
    ejecutorId: caja.cajero_id, capturistaId: req.usuario.id,
    detalle: { folio: caja.folio, esperado: estado.esperado, contado, diferencia, folioNuevo }
  });

  return ok(res, { corte: detalleCorte(caja.id), turnoNuevo: folioNuevo });
});

// ============================================================
// GASTOS Y RETIROS
// ============================================================

/**
 * EL HISTORIAL DEL CAJÓN, CRUZANDO TURNOS.
 *
 * El de la pantalla de Caja solo trae el turno de ahora, y eso deja fuera
 * justo lo que se busca: "¿y la gasolina de la mañana quién la sacó?".
 * Aquí vienen los últimos movimientos con el turno al que pertenece cada
 * uno, para que la lista pueda partirse con la raya de "de aquí para abajo
 * es del turno de Fulano".
 */
router.get('/movimientos', verCaja, (req, res) => {
  const tipo = req.query.tipo === 'entrada' || req.query.tipo === 'salida'
    ? req.query.tipo : null;
  const limite = Math.min(Math.max(Number(req.query.limite) || 40, 1), 200);

  // DE ENTRADA, SOLO LOS DE HOY.
  //
  // La caja pregunta "¿qué ha salido del cajón?", y eso es una pregunta de
  // hoy: lo de la semana pasada ya se cortó y vive en el historial. Sin
  // esto la lista traía los últimos cuarenta pasara el tiempo que pasara, y
  // en un día flojo salían gastos de hace tres días como si fueran de este
  // turno.
  //
  // 'localtime' en el campo guardado, no en el reloj: las fechas se guardan
  // en UTC y en Yucatán un gasto de las 6:30 de la tarde cae en el día
  // siguiente. Comparar sin convertir escondía los de la tarde.
  const soloHoy = req.query.todo !== '1';

  const filtros = ['m.anulado_en IS NULL'];
  const valores = [];
  if (tipo) { filtros.push('m.tipo = ?'); valores.push(tipo); }
  if (soloHoy) filtros.push("date(m.fecha, 'localtime') = date('now', 'localtime')");

  const lista = bd.prepare(`
    SELECT m.*, u.nombre AS ejecutor_nombre,
           c.folio AS caja_folio, c.cerrada_en AS caja_cerrada_en,
           cj.nombre AS caja_cajero
      FROM movimientos_caja m
      LEFT JOIN usuarios u  ON u.id = m.ejecutor_id
      LEFT JOIN cajas c     ON c.id = m.caja_id
      LEFT JOIN usuarios cj ON cj.id = c.cajero_id
     WHERE ${filtros.join(' AND ')}
     ORDER BY m.fecha DESC
     LIMIT ?
  `).all(...valores, limite);

  return ok(res, { movimientos: lista, soloHoy });
});

// ============================================================
// LOS GASTOS QUE SE REPITEN
//
// El desayuno de los muchachos es todos los días y nunca es igual. Escrito
// a mano, al final del mes hay "Desayuno", "desayunos", "Desayuno de los
// muchachos" y "DESAYUNO": cuatro conceptos y ninguna estadística. Dados
// de alta una vez y tocados, es un solo renglón que se puede sumar.
// ============================================================

/** Los conceptos que se pueden tocar. Los usa la caja al anotar un gasto. */
router.get('/conceptos', verCaja, (req, res) => {
  const todos = req.query.todos === '1';
  const lista = bd.prepare(`
    SELECT c.*,
           -- Cuántas veces se ha usado. Es lo que deja saber si un concepto
           -- se puede dar de baja sin que nadie lo extrañe.
           (SELECT COUNT(*) FROM movimientos_caja m WHERE m.concepto_id = c.id) AS usos
      FROM conceptos_gasto c
     ${todos ? '' : 'WHERE c.activo = 1'}
     ORDER BY c.activo DESC, c.orden, c.nombre
  `).all();
  return ok(res, { conceptos: lista });
});

/**
 * CUÁNTO SE HA GASTADO EN CADA COSA.
 *
 * "Al final del mes quiero ver cuánto gasté en desayunos." Esto es esa
 * pregunta: un renglón por concepto, con su total y cuántas veces.
 *
 * Se suma por CONCEPTO_ID, no por el texto: los gastos escritos a mano se
 * juntan todos en un renglón aparte —"escritos a mano"— porque no hay
 * forma honesta de agruparlos, y decir que sí la hay sería inventar
 * números.
 */
router.get('/conceptos/resumen', verCaja, (req, res) => {
  const desde = leerDia(req.query.desde);
  const hasta = leerDia(req.query.hasta);
  if (req.query.desde && !desde) return error(res, 'Esa fecha no se entiende.');
  if (req.query.hasta && !hasta) return error(res, 'Esa fecha no se entiende.');

  const donde = ['m.anulado_en IS NULL'];
  const valores = [];
  // En hora local: un gasto de las 6:30 de la tarde se guarda con la fecha
  // del día siguiente, y sin convertir caería en el mes que no es.
  if (desde) { donde.push("date(m.fecha, 'localtime') >= date(?)"); valores.push(desde); }
  if (hasta) { donde.push("date(m.fecha, 'localtime') <= date(?)"); valores.push(hasta); }

  const porConcepto = bd.prepare(`
    SELECT c.id, c.nombre, c.tipo, c.activo, c.es_traspaso,
           COUNT(*) AS veces,
           SUM(m.centavos) AS centavos,
           MIN(m.fecha) AS primero,
           MAX(m.fecha) AS ultimo
      FROM movimientos_caja m
      JOIN conceptos_gasto c ON c.id = m.concepto_id
     WHERE ${donde.join(' AND ')}
     GROUP BY c.id
     ORDER BY SUM(m.centavos) DESC
  `).all(...valores);

  // LOS TRASPASOS VAN APARTE. Un retiro a la caja fuerte salió del cajón,
  // sí, pero la fábrica no lo gastó: el dinero cambió de sitio. Si después
  // ese mismo efectivo paga el amoniaco y el amoniaco se anota en los
  // gastos grandes de la empresa, sumar las dos cosas contaría el mismo
  // peso dos veces. Por eso el total sale partido en dos y quien lo lea
  // decide cuál de los dos números necesita.
  const gastado = porConcepto
    .filter((r) => !r.es_traspaso)
    .reduce((n, r) => n + r.centavos, 0);
  const traspasado = porConcepto
    .filter((r) => r.es_traspaso)
    .reduce((n, r) => n + r.centavos, 0);

  const sueltos = bd.prepare(`
    SELECT m.tipo, COUNT(*) AS veces, SUM(m.centavos) AS centavos
      FROM movimientos_caja m
     WHERE m.concepto_id IS NULL AND ${donde.join(' AND ')}
     GROUP BY m.tipo
  `).all(...valores);

  return ok(res, { desde, hasta, porConcepto, sueltos, gastado, traspasado });
});

/** Un día del calendario: 2026-08-26. Nada más. */
function leerDia(valor) {
  const t = String(valor || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

/** Dar de alta uno nuevo. Del gerente para arriba: es catálogo, no caja. */
router.post('/conceptos', corregir, (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  if (!nombre) return error(res, 'Escribe cómo se llama el gasto.');
  if (nombre.length > 40) return error(res, 'El nombre es demasiado largo.');

  const tipo = req.body?.tipo === 'entrada' ? 'entrada' : 'salida';

  const repetido = bd.prepare(
    'SELECT id FROM conceptos_gasto WHERE lower(nombre) = lower(?) AND activo = 1'
  ).get(nombre);
  if (repetido) return error(res, `Ya hay un concepto que se llama "${nombre}".`, 409);

  const id = nuevoId();
  const siguiente = bd.prepare(
    'SELECT COALESCE(MAX(orden), 0) n FROM conceptos_gasto'
  ).get().n + 1;

  bd.prepare(`
    INSERT INTO conceptos_gasto (id, nombre, tipo, orden, ayuda, es_traspaso, fecha_alta)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, nombre, tipo, siguiente,
         String(req.body?.ayuda || '').trim().slice(0, 120) || null,
         req.body?.esTraspaso ? 1 : 0, ahora());

  bitacora.registrar({
    accion: 'caja.concepto_alta', entidad: 'concepto_gasto', entidadId: id,
    ejecutorId: req.usuario.id, detalle: { nombre, tipo }
  });

  return ok(res, { concepto: bd.prepare('SELECT * FROM conceptos_gasto WHERE id = ?').get(id) }, 201);
});

/**
 * Editar uno: el nombre, la nota, el orden, o darlo de baja.
 *
 * EL ID NO CAMBIA NUNCA (regla 3.3). Renombrar "Desayuno" a "Comida de los
 * muchachos" no parte la estadística en dos: los gastos viejos siguen
 * colgando del mismo id, y sus comprobantes siguen diciendo "Desayuno"
 * porque el texto se copió al movimiento (regla 3.5).
 */
router.put('/conceptos/:id', corregir, (req, res) => {
  const c = bd.prepare('SELECT * FROM conceptos_gasto WHERE id = ?').get(req.params.id);
  if (!c) return error(res, 'Ese concepto no existe.', 404);

  const cambios = {};

  if (req.body?.nombre !== undefined) {
    const nombre = String(req.body.nombre).trim();
    if (!nombre) return error(res, 'El nombre no puede quedar vacío.');
    if (nombre.length > 40) return error(res, 'El nombre es demasiado largo.');
    const otro = bd.prepare(
      'SELECT id FROM conceptos_gasto WHERE lower(nombre) = lower(?) AND activo = 1 AND id <> ?'
    ).get(nombre, c.id);
    if (otro) return error(res, `Ya hay un concepto que se llama "${nombre}".`, 409);
    cambios.nombre = nombre;
  }

  if (req.body?.ayuda !== undefined) {
    cambios.ayuda = String(req.body.ayuda).trim().slice(0, 120) || null;
  }
  if (req.body?.orden !== undefined) {
    const n = Number(req.body.orden);
    if (!Number.isFinite(n)) return error(res, 'Ese orden no se entiende.');
    cambios.orden = Math.round(n);
  }

  // EL DINERO QUE SOLO SE MUEVE. Un retiro a la caja fuerte no es un gasto:
  // el dinero no salió de la empresa, cambió de sitio. Marcarlo evita que
  // más adelante se cuente dos veces —una como retiro y otra como la cosa
  // que se pagó con ese efectivo—.
  if (req.body?.esTraspaso !== undefined) {
    cambios.es_traspaso = req.body.esTraspaso ? 1 : 0;
  }

  // DAR DE BAJA NO ES BORRAR (regla 3.4). Deja de salir en la caja, y los
  // gastos que ya se anotaron con él siguen sumando en la estadística: un
  // gasto de marzo no desaparece porque en agosto se deje de usar.
  if (req.body?.activo !== undefined) {
    cambios.activo = req.body.activo ? 1 : 0;
    cambios.fecha_baja = req.body.activo ? null : ahora();
  }

  if (!Object.keys(cambios).length) return error(res, 'No mandaste nada que cambiar.');

  const campos = Object.keys(cambios).map((k) => `${k} = ?`).join(', ');
  bd.prepare(`UPDATE conceptos_gasto SET ${campos} WHERE id = ?`)
    .run(...Object.values(cambios), c.id);

  bitacora.registrar({
    accion: 'caja.concepto_editado', entidad: 'concepto_gasto', entidadId: c.id,
    ejecutorId: req.usuario.id, detalle: { antes: c.nombre, ...cambios }
  });

  return ok(res, { concepto: bd.prepare('SELECT * FROM conceptos_gasto WHERE id = ?').get(c.id) });
});

/**
 * Sacar o meter dinero que no es una venta.
 *
 * Salidas: la gasolina, el refresco de los muchachos, el retiro a la caja
 * fuerte cuando ya hay mucho efectivo junto.
 * Entradas: el cambio que se trae del banco a media tarde.
 */
router.post('/movimientos', operarCaja, (req, res) => {
  const caja = sesionAbierta();
  if (!caja) return error(res, 'Abre el turno de caja antes de anotar movimientos.', 409);

  const tipo = req.body?.tipo;
  if (tipo !== 'entrada' && tipo !== 'salida') {
    return error(res, 'El movimiento tiene que ser una entrada o una salida.');
  }

  const centavos = leerImporte(req.body?.monto, { permitirCero: false });
  if (centavos === null) return error(res, 'Escribe de cuánto es el movimiento.');

  // DE DÓNDE SALE EL CONCEPTO.
  //
  // Si viene un conceptoId, el texto lo pone el catálogo y NO el que llama:
  // es lo único que garantiza que los cien desayunos del mes se llamen
  // igual. Si no viene, se escribe a mano, que es lo de siempre y sigue
  // valiendo para el gasto raro que no se va a repetir.
  let conceptoId = null;
  let concepto = String(req.body?.concepto || '').trim();

  if (req.body?.conceptoId) {
    const c = bd.prepare('SELECT * FROM conceptos_gasto WHERE id = ? AND activo = 1')
      .get(req.body.conceptoId);
    if (!c) return error(res, 'Ese concepto no existe o se dio de baja.', 409);
    if (c.tipo !== tipo) {
      return error(res, `"${c.nombre}" es de ${c.tipo === 'salida' ? 'salidas' : 'entradas'}.`);
    }
    conceptoId = c.id;
    concepto = c.nombre;
  }

  if (!concepto) return error(res, 'Escribe en qué se usó el dinero.');

  const id = nuevoId();
  const ejecutorId = req.body?.ejecutorId || req.usuario.id;

  bd.prepare(`
    INSERT INTO movimientos_caja
      (id, caja_id, fecha, tipo, concepto, centavos, ejecutor_id, capturista_id,
       notas, concepto_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, caja.id, ahora(), tipo, concepto.slice(0, 80), centavos,
         ejecutorId, req.usuario.id, req.body?.notas || null, conceptoId);

  bitacora.registrar({
    accion: `caja.${tipo}`, entidad: 'movimiento_caja', entidadId: id,
    ejecutorId, capturistaId: req.usuario.id,
    detalle: { concepto, conceptoId, centavos, cajaFolio: caja.folio }
  });

  return ok(res, {
    movimientoId: id,
    abierta: estadoCaja(sesionAbierta()),
    movimientos: movimientos(caja.id)
  }, 201);
});

/** Anular un movimiento mal capturado. No se borra: se marca (regla 3.4). */
router.post('/movimientos/:id/anular', corregir, (req, res) => {
  const m = bd.prepare('SELECT * FROM movimientos_caja WHERE id = ?').get(req.params.id);
  if (!m) return error(res, 'Ese movimiento no existe.', 404);
  if (m.anulado_en) return error(res, 'Ese movimiento ya está anulado.');

  const caja = bd.prepare('SELECT * FROM cajas WHERE id = ?').get(m.caja_id);
  if (caja?.cerrada_en) {
    return error(res, 'Ese turno ya está cerrado. Un corte firmado no se toca.', 409);
  }

  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) return error(res, 'Escribe por qué se anula.');

  bd.prepare(`
    UPDATE movimientos_caja SET anulado_en = ?, anulado_por = ?, motivo_anulacion = ?
     WHERE id = ?
  `).run(ahora(), req.usuario.id, motivo, m.id);

  bitacora.registrar({
    accion: 'caja.movimiento.anulado', entidad: 'movimiento_caja', entidadId: m.id,
    ejecutorId: req.usuario.id, detalle: { motivo, concepto: m.concepto, centavos: m.centavos }
  });

  return ok(res, {
    abierta: caja ? estadoCaja(bd.prepare('SELECT * FROM cajas WHERE id = ?').get(caja.id)) : null,
    movimientos: movimientos(m.caja_id)
  });
});

// ============================================================
// LOS CORTES
// ============================================================

function detalleCorte(id) {
  const caja = bd.prepare(`
    SELECT c.*, u.nombre AS cajero_nombre, v.nombre AS cerrada_por_nombre
      FROM cajas c
      LEFT JOIN usuarios u ON u.id = c.cajero_id
      LEFT JOIN usuarios v ON v.id = c.cerrada_por
     WHERE c.id = ?
  `).get(id);
  if (!caja) return null;

  const porPersona = desglosePorPersona(id);

  return {
    caja,
    movimientos: movimientos(id, { incluirAnulados: true }),
    ventas: conteoVentas(id),
    // Quién metió qué dentro del turno. Con una sola persona no dice nada
    // que el corte no diga ya, y por eso viene vacío: así ni la pantalla ni
    // la impresora tienen que decidir cuándo enseñarlo.
    porPersona: porPersona.length > 1 ? porPersona : []
  };
}

/** Historial de cortes: el de cada turno, del más nuevo al más viejo. */
router.get('/cortes', verCaja, (req, res) => {
  const limite = Math.min(Number(req.query.limite) || 30, 200);
  const cortes = bd.prepare(`
    SELECT c.*, u.nombre AS cajero_nombre FROM cajas c
      LEFT JOIN usuarios u ON u.id = c.cajero_id
     WHERE c.cerrada_en IS NOT NULL
     ORDER BY c.cerrada_en DESC LIMIT ?
  `).all(limite);
  return ok(res, { cortes });
});

router.get('/cortes/:id', verCaja, (req, res) => {
  const corte = detalleCorte(req.params.id);
  if (!corte) return error(res, 'Ese corte no existe.', 404);
  return ok(res, { corte });
});

/**
 * BORRAR UN MOVIMIENTO DEL CAJÓN.
 *
 * Anular deja el renglón tachado con su motivo, y para el día a día es lo
 * correcto: se ve qué pasó. Pero un gasto capturado tres veces por un dedazo
 * deja tres renglones tachados en una lista que ya es larga, y eso tampoco
 * ayuda a nadie.
 *
 * Así que el administrador —solo él, y con su CONTRASEÑA— puede borrarlo.
 * Queda en la bitácora: lo que no se puede borrar nunca es la constancia de
 * que alguien lo borró.
 *
 * OJO CON LOS TURNOS YA CORTADOS. Los totales del corte están congelados,
 * así que las cifras no cambian; pero la lista de movimientos que se
 * reimprima ya no va a coincidir con el papel que se firmó. La pantalla lo
 * dice antes de preguntar.
 */
router.delete('/movimientos/:id', verCaja, (req, res) => {
  const m = bd.prepare('SELECT * FROM movimientos_caja WHERE id = ?').get(req.params.id ?? null);
  if (!m) return error(res, 'Ese movimiento no existe.', 404);

  const caja = bd.prepare('SELECT * FROM cajas WHERE id = ?').get(m.caja_id);

  const auth = comprobarAdmin(req.body?.autorizacion);
  if (auth.error) {
    return error(res, auth.error, 403, {
      requiereContrasena: true,
      administradores: administradores(),
      turnoCerrado: Boolean(caja?.cerrada_en),
      folio: caja?.folio || null
    });
  }

  // Un abono de crédito deja su renglón aquí. Si se borra el renglón hay que
  // soltar el enlace, o el abono apuntaría a un movimiento que ya no existe.
  const borrar = bd.transaction(() => {
    bd.prepare('UPDATE abonos SET movimiento_id = NULL WHERE movimiento_id = ?').run(m.id);
    bd.prepare('DELETE FROM movimientos_caja WHERE id = ?').run(m.id);
  });
  borrar();

  bitacora.registrar({
    accion: 'caja.movimiento-borrado', entidad: 'movimiento_caja', entidadId: m.id,
    ejecutorId: auth.usuario.id, capturistaId: req.usuario.id,
    detalle: { concepto: m.concepto, tipo: m.tipo, centavos: m.centavos,
               cajaFolio: caja?.folio, turnoCerrado: Boolean(caja?.cerrada_en) }
  });

  return ok(res, { borrado: m.concepto });
});

module.exports = router;
