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
const { cuadreDeHielo } = require('./hielo');
const {
  conceptosDeVale, salidasPartidas, adelantosDelTurno, adelantoDelMovimiento
} = require('./vales');

const router = express.Router();

const verCaja = exigirPermiso('caja.ver');
const operarCaja = exigirPermiso('caja.operar');
const corregir = exigirPermiso('venta.cancelar');   // gerente y administrador

// DAR DE ALTA UN CONCEPTO RECURRENTE ES COSA DEL ADMINISTRADOR.
//
// No es capturar un gasto —eso lo hace el cajero todos los días— sino
// decidir CÓMO se va a sumar el mes. Un concepto de más ("Desayunos" y
// "Desayuno muchachos") parte la estadística en dos y ya no se junta:
// justo lo que estos conceptos vinieron a evitar. Ningún rol lista este
// permiso, así que solo lo alcanza el comodín del administrador.
const conceptos = exigirPermiso('caja.conceptos');

// CORREGIR UN CORTE YA FIRMADO ES SOLO DEL ADMINISTRADOR.
//
// No es lo mismo que anular un movimiento del turno abierto —eso lo hace
// el gerente y es trabajo del día—: esto toca un papel que ya se firmó y
// cambia un faltante que ya se dio por bueno. Ningún rol lista este
// permiso, así que solo lo alcanza el comodín del administrador.
const corregirCorte = exigirPermiso('caja.corregir_corte');

// RECIBIR EL DINERO DE UN TURNO. El cajero entrega el cajón y se va; quien
// cuenta es el dueño o el gerente cuando llegan. No es del cajero: sería
// firmarse a sí mismo la entrega.
const recibirEntrega = exigirPermiso('caja.recibir');

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
/**
 * CERRAR EL TURNO — SIN CONTAR EL DINERO  (v4.1)
 *
 * "Como los cortes son rápidos y se tiene que seguir atendiendo, no hay que
 * anotar cuánto dinero hay físicamente, sino imprimir el ticket con el
 * dinero que debería haber."
 *
 * Así que el corte se cierra sin contar: sale el papel con lo que DEBÍA
 * haber, el cajero entrega el cajón y sigue vendiendo. Cuando el dueño o el
 * gerente llegan, anotan cuánto les entregaron y esa es la diferencia
 * (ver `POST /cortes/:id/entregado`).
 *
 * `contado` se sigue aceptando por si alguien tiene tiempo de contar en el
 * momento, pero ya no hace falta. Sin ninguno de los dos, la diferencia se
 * queda VACÍA en vez de en cero: decir "cuadró exacto" cuando nadie ha
 * contado sería inventarse un dato.
 */
router.post('/cerrar', operarCaja, (req, res) => {
  const caja = sesionAbierta();
  if (!caja) return error(res, 'No hay ningún turno de caja abierto.', 409);

  const seContó = req.body?.contado !== undefined && req.body?.contado !== null
                  && String(req.body.contado).trim() !== '';
  const contado = seContó ? leerImporte(req.body.contado) : null;
  if (seContó && contado === null) return error(res, 'Ese importe no se entiende.');

  const estado = estadoCaja(caja);
  const diferencia = contado === null ? null : contado - estado.esperado;

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

  // Igual que al cerrar: contar es opcional desde la v4.1. En el relevo de
  // las 2:30 hay todavía menos tiempo que al cierre.
  const seContó = req.body?.contado !== undefined && req.body?.contado !== null
                  && String(req.body.contado).trim() !== '';
  const contado = seContó ? leerImporte(req.body.contado) : null;
  if (seContó && contado === null) return error(res, 'Ese importe no se entiende.');

  const estado = estadoCaja(caja);
  const diferencia = contado === null ? null : contado - estado.esperado;
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
  // Los ocultos no salen NUNCA, ni con todos=1: "eliminar" es para que el
  // renglón deje de estorbar en la pantalla. Sus gastos viejos siguen
  // sumando en las estadísticas y en el historial (regla 3.4).
  const lista = bd.prepare(`
    SELECT c.*,
           -- Cuántas veces se ha usado. Es lo que deja saber si un concepto
           -- se puede dar de baja sin que nadie lo extrañe.
           (SELECT COUNT(*) FROM movimientos_caja m WHERE m.concepto_id = c.id) AS usos
      FROM conceptos_gasto c
     WHERE c.oculto = 0 ${todos ? '' : 'AND c.activo = 1'}
     ORDER BY c.activo DESC, c.orden, c.nombre
  `).all();
  return ok(res, { conceptos: lista });
});

/**
 * BORRARLO DE LA LISTA, ahora sí "para siempre".
 *
 * Dar de baja lo deja tachado en la pantalla de conceptos, por si vuelve
 * (la temporada, el proveedor que regresa). Eliminar lo esconde del todo:
 * ni activo ni tachado. Pero NO borra nada (regla 3.4): los gastos que se
 * anotaron con él siguen en el historial y siguen sumando. Solo puede el
 * gerente o el administrador, y queda en la bitácora quién fue.
 */
router.post('/conceptos/:id/eliminar', conceptos, (req, res) => {
  const c = bd.prepare('SELECT * FROM conceptos_gasto WHERE id = ? AND oculto = 0')
    .get(req.params.id);
  if (!c) return error(res, 'Ese concepto no existe.', 404);

  bd.prepare('UPDATE conceptos_gasto SET oculto = 1, activo = 0, fecha_baja = COALESCE(fecha_baja, ?) WHERE id = ?')
    .run(ahora(), c.id);

  bitacora.registrar({
    accion: 'caja.concepto_eliminado', entidad: 'concepto_gasto', entidadId: c.id,
    ejecutorId: req.usuario.id,
    detalle: { nombre: c.nombre, nota: 'Se ocultó de la lista; sus gastos siguen contando.' }
  });

  return ok(res, { eliminado: true });
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
router.post('/conceptos', conceptos, (req, res) => {
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
router.put('/conceptos/:id', conceptos, (req, res) => {
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

// ============================================================
// LOS VALES  (v4.3)
// ============================================================

/**
 * A QUIÉN SE LE PUEDE DAR UN VALE, y de qué clase.
 *
 * Son dos listas distintas porque son dos cosas distintas:
 *
 *   · El RETIRO se lo lleva quien manda —el dueño, un gerente—. Ofrecer
 *     ahí a toda la fábrica sería ofrecerle a la cajera llevarse el dinero
 *     del cajón con un toque.
 *   · El de RAYA lo pide cualquiera que cobre sueldo, que son todos.
 *
 * Esta ruta la puede leer el cajero, y a propósito: cuando el papá del
 * dueño llega y se lleva el efectivo, él no toca la computadora. Ella lo
 * anota a nombre de él, y el papel sale con los dos nombres.
 */
router.get('/vales', verCaja, (req, res) => {
  const gente = bd.prepare(`
    SELECT id, nombre, rol FROM usuarios WHERE activo = 1 ORDER BY nombre
  `).all();
  const mandan = new Set(['gerente', 'admin']);

  return ok(res, {
    conceptos: conceptosDeVale().filter((c) => c.activo),
    gente: {
      retiro: gente.filter((u) => mandan.has(u.rol)),
      raya: gente
    }
  });
});

/**
 * UN VALE: ALGUIEN SE LLEVÓ DINERO DEL CAJÓN.
 *
 * Es una salida como cualquier otra —ya estaba— pero con dos cosas que un
 * gasto no tiene y un vale no puede no tener:
 *
 *   · QUIÉN SE LO LLEVÓ, con nombre. Es obligatorio. Un vale sin nombre no
 *     es un vale, es un faltante.
 *   · SU PAPEL FIRMADO, por duplicado: uno para quien se llevó el dinero y
 *     otro que se queda en el cajón.
 *
 * Lo captura el cajero, no el que se lleva el dinero, y a propósito: el
 * papá del dueño llega, se lleva el efectivo y no toca la computadora. Por
 * eso quién se lo llevó y quién lo anotó son dos campos distintos desde el
 * primer día (regla 3.6), y por eso el papel lleva raya para firmar.
 */
router.post('/vales', operarCaja, (req, res) => {
  const caja = sesionAbierta();
  if (!caja) return error(res, 'Abre el turno de caja antes de dar un vale.', 409);

  const clase = req.body?.clase === 'raya' ? 'raya' : 'retiro';
  const conceptoId = clase === 'raya' ? 'gasto-vale-raya' : 'gasto-retiro';
  const concepto = bd.prepare('SELECT * FROM conceptos_gasto WHERE id = ?').get(conceptoId);
  if (!concepto || !concepto.activo) {
    return error(res, 'Ese vale se dio de baja en los gastos que se repiten.', 409);
  }

  const centavos = leerImporte(req.body?.monto, { permitirCero: false });
  if (centavos === null) return error(res, 'Escribe de cuánto es el vale.');

  const quien = bd.prepare('SELECT id, nombre, rol, activo FROM usuarios WHERE id = ?')
    .get(req.body?.ejecutorId || '');
  if (!quien) return error(res, 'Dinos quién se llevó el dinero.');
  if (!quien.activo) return error(res, `${quien.nombre} está dado de baja.`, 409);

  // EL RETIRO SE LO LLEVA QUIEN MANDA. Sin esta regla, un vale de retiro
  // sería una manera de sacar dinero del cajón a nombre propio y que el
  // corte lo diera por bueno: no cuenta como gasto y nadie queda debiendo.
  // Un adelanto de sueldo sí lo puede pedir cualquiera — ese sí se debe.
  if (clase === 'retiro' && !['gerente', 'admin'].includes(quien.rol)) {
    return error(res,
      `Un retiro se lo lleva el dueño o un gerente. Si ${quien.nombre} pidió ` +
      'dinero a cuenta de su sueldo, es un vale de raya.', 409);
  }

  const id = nuevoId();
  const adelantoId = clase === 'raya' ? nuevoId() : null;
  const fecha = ahora();
  const notas = String(req.body?.notas || '').trim() || null;

  bd.transaction(() => {
    bd.prepare(`
      INSERT INTO movimientos_caja
        (id, caja_id, fecha, tipo, concepto, centavos, ejecutor_id, capturista_id,
         notas, concepto_id)
      VALUES (?, ?, ?, 'salida', ?, ?, ?, ?, ?, ?)
    `).run(id, caja.id, fecha, concepto.nombre, centavos,
           quien.id, req.usuario.id, notas, concepto.id);

    // El de raya, además, se apunta en su libreta: es el recordatorio de
    // que el día de la raya se le paga de menos. El dinero ya salió aquí
    // arriba; abajo no sale otra vez.
    if (adelantoId) {
      bd.prepare(`
        INSERT INTO adelantos
          (id, usuario_id, fecha, centavos, movimiento_id, caja_id, capturista_id, notas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(adelantoId, quien.id, fecha, centavos, id, caja.id, req.usuario.id, notas);
    }
  })();

  bitacora.registrar({
    accion: `caja.vale.${clase}`, entidad: 'movimiento_caja', entidadId: id,
    ejecutorId: quien.id, capturistaId: req.usuario.id,
    detalle: { clase, centavos, quien: quien.nombre, cajaFolio: caja.folio, adelantoId }
  });

  return ok(res, {
    movimientoId: id,
    adelantoId,
    clase,
    quien: quien.nombre,
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

  // SI ERA UN VALE DE RAYA, su renglón de la libreta se va con él: dejarlo
  // vivo haría que el sábado se le descontara un dinero que nunca salió.
  // Salvo que ya se le haya descontado — entonces la raya ya se pagó de
  // menos, y borrar el vale ahora dejaría al trabajador debiendo un sueldo
  // que sí cobró. Eso se arregla en su ficha, no aquí.
  const adelanto = adelantoDelMovimiento(m.id);
  if (adelanto?.descontado_en) {
    return error(res,
      'Ese vale ya se le descontó de su raya. Para deshacerlo hay que ' +
      'quitarle antes el descuento en su ficha.', 409);
  }

  const fecha = ahora();
  bd.transaction(() => {
    bd.prepare(`
      UPDATE movimientos_caja SET anulado_en = ?, anulado_por = ?, motivo_anulacion = ?
       WHERE id = ?
    `).run(fecha, req.usuario.id, motivo, m.id);

    if (adelanto) {
      bd.prepare(`
        UPDATE adelantos SET anulado_en = ?, anulado_por = ?, motivo_anulacion = ?
         WHERE id = ?
      `).run(fecha, req.usuario.id, motivo, adelanto.id);
    }
  })();

  bitacora.registrar({
    accion: 'caja.movimiento.anulado', entidad: 'movimiento_caja', entidadId: m.id,
    ejecutorId: req.usuario.id,
    detalle: { motivo, concepto: m.concepto, centavos: m.centavos, adelantoId: adelanto?.id }
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
    SELECT c.*, u.nombre AS cajero_nombre, v.nombre AS cerrada_por_nombre,
           g.nombre AS corregido_por_nombre, r.nombre AS recibido_por_nombre
      FROM cajas c
      LEFT JOIN usuarios u ON u.id = c.cajero_id
      LEFT JOIN usuarios v ON v.id = c.cerrada_por
      LEFT JOIN usuarios g ON g.id = c.corregido_por
      LEFT JOIN usuarios r ON r.id = c.recibido_por
     WHERE c.id = ?
  `).get(id);
  if (!caja) return null;

  const porPersona = desglosePorPersona(id);

  return {
    caja,
    movimientos: movimientos(id, { incluirAnulados: true }),
    ventas: conteoVentas(id),
    // LAS SALIDAS, PARTIDAS EN DOS (v4.3). La gasolina de la camioneta y
    // los $2,000 que se llevó el patrón salen del mismo cajón y no son lo
    // mismo: una se gastó y la otra nada más cambió de sitio. Sumadas en
    // el mismo renglón, un corte con mucha salida no dice cuál de las dos
    // fue. Ninguna cuenta cambia: las dos ya están restadas del esperado.
    salidas: salidasPartidas(id),
    // Los vales de raya que salieron de este turno, con nombre. Van aparte
    // de la lista de arriba porque cada uno deja una deuda que el día de
    // la raya hay que descontar, y eso conviene verlo desde el corte.
    adelantos: adelantosDelTurno(id),
    // EL CUADRE DEL HIELO de ese turno: cuánto había, cuánto se produjo,
    // cuánto se contó y cuánto faltó. Viene `null` cuando ese turno no
    // contó hielo — sin conteo no hay cuadre, y un papel con todo en cero
    // haría creer que se contó y salió cero.
    hielo: cuadreDeHielo(id),
    // Quién metió qué dentro del turno. Con una sola persona no dice nada
    // que el corte no diga ya, y por eso viene vacío: así ni la pantalla ni
    // la impresora tienen que decidir cuándo enseñarlo.
    porPersona: porPersona.length > 1 ? porPersona : []
  };
}

/**
 * VOLVER A SACAR LAS CUENTAS DE UN CORTE YA CERRADO  (v3.9)
 *
 * Los totales de un corte están congelados a propósito: son el papel que
 * se firmó. Pero cuando aparece un gasto que se había olvidado, dejar el
 * papel intacto es dejar escrito un faltante que no existió — y ese
 * faltante es exactamente lo que se viene a arreglar.
 *
 * Así que se vuelven a sacar de los movimientos, con dos cuidados:
 *
 *   · LO CONTADO NO SE TOCA. Es el dinero que había en el cajón cuando se
 *     contó, y no lo cambia ningún ticket que aparezca después.
 *   · LO QUE DECÍA ANTES SE GUARDA, la primera vez. Un corte corregido
 *     tiene que poder enseñar las dos cifras.
 */
function recalcularCorte(cajaId, { usuarioId, motivo }) {
  const caja = bd.prepare('SELECT * FROM cajas WHERE id = ?').get(cajaId);
  if (!caja) return null;

  const estado = estadoCaja(caja);
  // Manda lo ENTREGADO cuando lo hay: es el dinero que de verdad llegó a
  // manos del dueño. Si nadie contó ni entregó todavía, no hay diferencia
  // que enseñar — y eso es un dato, no un cero.
  const referencia = caja.entregado_centavos ?? caja.contado_centavos ?? null;
  const diferencia = referencia === null ? null : referencia - estado.esperado;

  // Solo la PRIMERA vez: si se corrige dos veces, lo original sigue siendo
  // lo del papel firmado, no lo de la corrección anterior.
  const guardarOriginal = caja.esperado_original_centavos === null
                       || caja.esperado_original_centavos === undefined;

  bd.prepare(`
    UPDATE cajas SET
      esperado_original_centavos   = COALESCE(esperado_original_centavos, ?),
      diferencia_original_centavos = COALESCE(diferencia_original_centavos, ?),
      salidas_original_centavos    = COALESCE(salidas_original_centavos, ?),
      entradas_original_centavos   = COALESCE(entradas_original_centavos, ?),
      esperado_centavos = ?, diferencia_centavos = ?,
      vendido_centavos = ?, entradas_centavos = ?, salidas_centavos = ?,
      corregido_en = ?, corregido_por = ?, motivo_correccion = ?,
      correcciones = correcciones + 1
    WHERE id = ?
  `).run(caja.esperado_centavos, caja.diferencia_centavos,
         caja.salidas_centavos, caja.entradas_centavos,
         estado.esperado, diferencia,
         estado.vendido, estado.entradas, estado.salidas,
         ahora(), usuarioId, motivo.slice(0, 200), caja.id);

  return { guardarOriginal, antes: caja, ahora: bd.prepare('SELECT * FROM cajas WHERE id = ?').get(caja.id) };
}

/**
 * CUÁNTO DINERO ENTREGARON DE VERDAD  (v4.1)
 *
 * El turno se cierra sin contar: sale el papel con lo que debía haber, el
 * cajero entrega el cajón y sigue vendiendo. Esto es la otra mitad — el
 * momento en que el dueño o el gerente cuentan lo que les dieron.
 *
 * De aquí sale la diferencia de verdad, y por eso no se puede anotar dos
 * veces sin querer: si ya había una entrega anotada, hay que decir que se
 * está corrigiendo.
 */
router.post('/cortes/:id/entregado', recibirEntrega, (req, res) => {
  const caja = bd.prepare('SELECT * FROM cajas WHERE id = ?').get(req.params.id);
  if (!caja) return error(res, 'Ese corte no existe.', 404);
  if (!caja.cerrada_en) return error(res, 'Ese turno todavía no se ha cerrado.', 409);

  const centavos = leerImporte(req.body?.monto);
  if (centavos === null) return error(res, 'Escribe cuánto dinero te entregaron.');

  if (caja.entregado_centavos !== null && caja.entregado_centavos !== undefined
      && req.body?.corregir !== true) {
    return error(res,
      `Ya se anotó una entrega de este turno (${(caja.entregado_centavos / 100).toFixed(2)}). ` +
      'Para cambiarla hay que decir que se está corrigiendo.', 409);
  }

  const diferencia = centavos - (caja.esperado_centavos ?? 0);

  bd.prepare(`
    UPDATE cajas SET entregado_centavos = ?, recibido_por = ?, recibido_en = ?,
                     notas_entrega = ?, diferencia_centavos = ?
     WHERE id = ?
  `).run(centavos, req.usuario.id, ahora(),
         String(req.body?.notas || '').trim().slice(0, 300) || null,
         diferencia, caja.id);

  bitacora.registrar({
    accion: 'caja.entrega_recibida', entidad: 'caja', entidadId: caja.id,
    ejecutorId: req.usuario.id,
    detalle: {
      folio: caja.folio, cajero: caja.cajero_id,
      esperado: caja.esperado_centavos, entregado: centavos, diferencia,
      corregida: caja.entregado_centavos != null
    }
  });

  return ok(res, { corte: detalleCorte(caja.id) });
});

/**
 * AGREGARLE A UN CORTE UN GASTO QUE SE OLVIDÓ.
 *
 * "A la cajera se le olvidó poner algo y tiene las pruebas para
 * demostrarlo." El renglón entra al turno que ya se cerró, marcado como
 * agregado después, y el corte se vuelve a sacar.
 */
router.post('/cortes/:id/movimientos', corregirCorte, (req, res) => {
  const caja = bd.prepare('SELECT * FROM cajas WHERE id = ?').get(req.params.id);
  if (!caja) return error(res, 'Ese corte no existe.', 404);
  if (!caja.cerrada_en) {
    return error(res, 'Ese turno sigue abierto: anótalo como cualquier otro movimiento.', 409);
  }

  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) {
    return error(res, 'Escribe por qué se corrige. Un corte firmado no se cambia sin razón.');
  }

  const tipo = req.body?.tipo;
  if (tipo !== 'entrada' && tipo !== 'salida') {
    return error(res, 'El movimiento tiene que ser una entrada o una salida.');
  }

  const centavos = leerImporte(req.body?.monto, { permitirCero: false });
  if (centavos === null) return error(res, 'Escribe de cuánto es el movimiento.');

  // El concepto lo pone el catálogo cuando viene, igual que en el turno
  // normal: es lo que hace que los cien desayunos del mes se llamen igual.
  let conceptoId = null;
  let concepto = String(req.body?.concepto || '').trim();
  if (req.body?.conceptoId) {
    const c = bd.prepare('SELECT * FROM conceptos_gasto WHERE id = ?').get(req.body.conceptoId);
    if (!c) return error(res, 'Ese concepto no existe.', 409);
    if (c.tipo !== tipo) {
      return error(res, `"${c.nombre}" es de ${c.tipo === 'salida' ? 'salidas' : 'entradas'}.`);
    }
    conceptoId = c.id;
    concepto = c.nombre;
  }
  if (!concepto) return error(res, 'Escribe en qué se usó el dinero.');

  const id = nuevoId();

  // LA FECHA DEL MOVIMIENTO ES LA DEL TURNO, no la de hoy.
  //
  // El gasto ocurrió dentro de ese turno; anotarlo con la fecha de hoy lo
  // sacaría del periodo al que pertenece y lo metería en el de este mes,
  // donde no pasó nada. Se le pone la hora del cierre, que es el último
  // instante en que ese turno todavía existía.
  const cuando = caja.cerrada_en;

  bd.transaction(() => {
    bd.prepare(`
      INSERT INTO movimientos_caja
        (id, caja_id, fecha, tipo, concepto, centavos, ejecutor_id, capturista_id,
         notas, concepto_id, tras_corte)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(id, caja.id, cuando, tipo, concepto.slice(0, 80), centavos,
           req.body?.ejecutorId || caja.cajero_id, req.usuario.id,
           String(req.body?.notas || '').trim().slice(0, 300) || null, conceptoId);

    recalcularCorte(caja.id, { usuarioId: req.usuario.id, motivo });
  })();

  const despues = bd.prepare('SELECT * FROM cajas WHERE id = ?').get(caja.id);
  bitacora.registrar({
    accion: 'caja.corte_corregido', entidad: 'caja', entidadId: caja.id,
    ejecutorId: req.usuario.id,
    detalle: {
      folio: caja.folio, agrego: concepto, tipo, centavos, motivo,
      diferenciaAntes: caja.diferencia_centavos,
      diferenciaAhora: despues.diferencia_centavos
    }
  });

  return ok(res, { corte: detalleCorte(caja.id) }, 201);
});

/**
 * QUITARLE A UN CORTE UN GASTO QUE NO ERA.
 *
 * No se borra el renglón (regla 3.4): se anula con su motivo y deja de
 * contar. En la lista sigue saliendo tachado, que es lo que permite
 * entender después qué pasó con ese corte.
 */
router.post('/cortes/:id/movimientos/:movimiento/quitar', corregirCorte, (req, res) => {
  const caja = bd.prepare('SELECT * FROM cajas WHERE id = ?').get(req.params.id);
  if (!caja) return error(res, 'Ese corte no existe.', 404);
  if (!caja.cerrada_en) {
    return error(res, 'Ese turno sigue abierto: anúlalo como cualquier otro movimiento.', 409);
  }

  const m = bd.prepare('SELECT * FROM movimientos_caja WHERE id = ? AND caja_id = ?')
    .get(req.params.movimiento, caja.id);
  if (!m) return error(res, 'Ese movimiento no es de este corte.', 404);
  if (m.anulado_en) return error(res, 'Ese movimiento ya está anulado.');

  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) {
    return error(res, 'Escribe por qué se quita. Un corte firmado no se cambia sin razón.');
  }

  bd.transaction(() => {
    bd.prepare(`
      UPDATE movimientos_caja SET anulado_en = ?, anulado_por = ?, motivo_anulacion = ?
       WHERE id = ?
    `).run(ahora(), req.usuario.id, motivo.slice(0, 200), m.id);

    recalcularCorte(caja.id, { usuarioId: req.usuario.id, motivo });
  })();

  const despues = bd.prepare('SELECT * FROM cajas WHERE id = ?').get(caja.id);
  bitacora.registrar({
    accion: 'caja.corte_corregido', entidad: 'caja', entidadId: caja.id,
    ejecutorId: req.usuario.id,
    detalle: {
      folio: caja.folio, quito: m.concepto, tipo: m.tipo, centavos: m.centavos, motivo,
      diferenciaAntes: caja.diferencia_centavos,
      diferenciaAhora: despues.diferencia_centavos
    }
  });

  return ok(res, { corte: detalleCorte(caja.id) });
});

/** Historial de cortes: el de cada turno, del más nuevo al más viejo. */
router.get('/cortes', verCaja, (req, res) => {
  const limite = Math.min(Number(req.query.limite) || 30, 200);
  const cortes = bd.prepare(`
    SELECT c.*, u.nombre AS cajero_nombre, g.nombre AS corregido_por_nombre,
           r.nombre AS recibido_por_nombre
      FROM cajas c
      LEFT JOIN usuarios u ON u.id = c.cajero_id
      LEFT JOIN usuarios g ON g.id = c.corregido_por
      LEFT JOIN usuarios r ON r.id = c.recibido_por
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
  //
  // Un vale de raya deja el suyo en la libreta, y ahí SÍ se borra entero:
  // este botón existe para el gasto capturado tres veces, y dejar el vale
  // vivo sin su dinero descontaría el sábado algo que ya no está escrito
  // en ningún lado.
  const borrar = bd.transaction(() => {
    bd.prepare('UPDATE abonos SET movimiento_id = NULL WHERE movimiento_id = ?').run(m.id);
    bd.prepare('DELETE FROM adelantos WHERE movimiento_id = ?').run(m.id);
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
