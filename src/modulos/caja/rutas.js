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
  sesionAbierta, movimientos, estadoCaja, conteoVentas
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

  const lista = bd.prepare(`
    SELECT m.*, u.nombre AS ejecutor_nombre,
           c.folio AS caja_folio, c.cerrada_en AS caja_cerrada_en,
           cj.nombre AS caja_cajero
      FROM movimientos_caja m
      LEFT JOIN usuarios u  ON u.id = m.ejecutor_id
      LEFT JOIN cajas c     ON c.id = m.caja_id
      LEFT JOIN usuarios cj ON cj.id = c.cajero_id
     WHERE m.anulado_en IS NULL
       ${tipo ? 'AND m.tipo = ?' : ''}
     ORDER BY m.fecha DESC
     LIMIT ?
  `).all(...(tipo ? [tipo, limite] : [limite]));

  return ok(res, { movimientos: lista });
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

  const concepto = String(req.body?.concepto || '').trim();
  if (!concepto) return error(res, 'Escribe en qué se usó el dinero.');

  const id = nuevoId();
  const ejecutorId = req.body?.ejecutorId || req.usuario.id;

  bd.prepare(`
    INSERT INTO movimientos_caja
      (id, caja_id, fecha, tipo, concepto, centavos, ejecutor_id, capturista_id, notas)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, caja.id, ahora(), tipo, concepto.slice(0, 80), centavos,
         ejecutorId, req.usuario.id, req.body?.notas || null);

  bitacora.registrar({
    accion: `caja.${tipo}`, entidad: 'movimiento_caja', entidadId: id,
    ejecutorId, capturistaId: req.usuario.id,
    detalle: { concepto, centavos, cajaFolio: caja.folio }
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

  return {
    caja,
    movimientos: movimientos(id, { incluirAnulados: true }),
    ventas: conteoVentas(id)
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
