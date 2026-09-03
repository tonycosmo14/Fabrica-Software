/**
 * LA RAYA — la API  (v4.8)
 *
 * "Necesito una forma más visual donde anotar cuánto gana, qué días viene,
 *  a qué hora llega, a qué hora se va, cuántos vales, e imprimir su
 *  balance para darle su sueldo."
 *
 * Y la pregunta que decide el diseño: "a veces el sueldo se agarra de la
 * caja, a veces se hace el corte y luego se le da".
 *
 * DE DÓNDE SALE EL DINERO es obligatorio, y solo hay dos respuestas:
 *
 *   · DEL CAJÓN — deja su salida en la caja y el corte de ese turno la
 *     resta. Si no, al contar el dinero va a faltar y nadie sabrá por qué.
 *   · DE FUERA — de la caja fuerte, del dinero ya retirado, de una
 *     transferencia. El cajón NO se entera: ese dinero ya salió de ahí
 *     como retiro, y restarlo otra vez sería contarlo dos veces.
 *
 * Las dos son gasto de la fábrica y las dos suman en el costo por marqueta;
 * lo único que cambia es por cuál de las dos bolsas entra.
 */
const express = require('express');
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');
const { ok, error } = require('../../lib/respuestas');
const { leerPesos } = require('../../lib/dinero');
const bitacora = require('../../lib/bitacora');
const { exigirPermiso } = require('../../middleware/sesion');
const { sesionAbierta } = require('../caja/calculo');
const calculo = require('./calculo');

const router = express.Router();

// LOS SUELDOS SON DEL ADMINISTRADOR.
//
// Cuánto gana cada quien no es un dato de operación: es de los pocos que
// no debe ver ni el gerente de turno. Ningún rol lista este permiso, así
// que solo lo alcanza el comodín del administrador.
const verRaya = exigirPermiso('raya.ver');
const pagarRaya = exigirPermiso('raya.pagar');

const HORA = /^([01]?\d|2[0-3]):[0-5]\d$/;

function leerImporte(v, { permitirCero = true } = {}) {
  return leerPesos(v, { permitirCero });
}

function leerDia(v) {
  const t = String(v || '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

function usuarioActivo(id) {
  return bd.prepare('SELECT id, nombre, rol, activo FROM usuarios WHERE id = ?').get(id) || null;
}

// ============================================================
// LA LISTA: TODA LA GENTE Y CÓMO VA SU SEMANA
// ============================================================

/**
 * La pantalla principal de la raya. Un renglón por persona con lo único
 * que hace falta para decidir a quién se le paga hoy: cuánto gana, qué
 * debe de vales, y cuándo se le pagó por última vez.
 */
router.get('/', verRaya, (req, res) => {
  const gente = bd.prepare(`
    SELECT id, nombre, rol FROM usuarios WHERE activo = 1 ORDER BY nombre
  `).all();

  return ok(res, {
    diaDePago: calculo.diaDePago(),
    dias: calculo.DIAS,
    gente: gente.map((u) => {
      const sueldo = calculo.sueldoVigente(u.id);
      const ultima = calculo.ultimaRaya(u.id);
      const horario = calculo.horarioDe(u.id);
      const vales = require('../caja/vales').pendienteDe(u.id);
      return {
        ...u,
        sueldo,
        vales,
        ultimaRaya: ultima,
        diasQueViene: horario.filter((d) => d.viene).length,
        horasSemana: Math.round(horario.reduce((n, d) => n + d.horas, 0) * 100) / 100
      };
    })
  });
});

/** Todo lo de una persona: su sueldo, su horario, sus vales y sus rayas. */
router.get('/:id', verRaya, (req, res) => {
  const u = usuarioActivo(req.params.id);
  if (!u) return error(res, 'Esa persona no existe.', 404);

  const semana = calculo.semanaQueTocaria(u.id);
  return ok(res, {
    usuario: u,
    sueldo: calculo.sueldoVigente(u.id),
    sueldos: calculo.historialDeSueldos(u.id),
    horario: calculo.horarioDe(u.id),
    rayas: calculo.rayasDe(u.id),
    semana,
    balance: calculo.balanceDe(u.id, semana),
    diaDePago: calculo.diaDePago(),
    dias: calculo.DIAS
  });
});

// ============================================================
// CUÁNTO GANA
// ============================================================

/**
 * Ponerle sueldo, o cambiárselo.
 *
 * No se edita el que había: se agrega uno nuevo con su fecha. Un aumento
 * de agosto no puede reescribir lo que ganaba en marzo, y con el histórico
 * se puede mirar una raya vieja y entender de dónde salió el número.
 */
router.post('/:id/sueldo', pagarRaya, (req, res) => {
  const u = usuarioActivo(req.params.id);
  if (!u) return error(res, 'Esa persona no existe.', 404);

  const tipo = req.body?.tipo === 'por_dia' ? 'por_dia' : 'semanal';
  const centavos = leerImporte(req.body?.monto, { permitirCero: false });
  if (centavos === null) return error(res, 'Escribe cuánto gana.');

  const desde = leerDia(req.body?.desde) || calculo.hoy();

  const id = nuevoId();
  bd.prepare(`
    INSERT INTO sueldos (id, usuario_id, desde, tipo, centavos, notas, capturista_id, fecha_alta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, u.id, desde, tipo, centavos,
         String(req.body?.notas || '').trim().slice(0, 200) || null,
         req.usuario.id, ahora());

  bitacora.registrar({
    accion: 'raya.sueldo', entidad: 'usuario', entidadId: u.id,
    ejecutorId: u.id, capturistaId: req.usuario.id,
    detalle: { tipo, centavos, desde, quien: u.nombre }
  });

  return ok(res, { sueldo: calculo.sueldoVigente(u.id) }, 201);
});

/** Un sueldo mal capturado se anula; el anterior vuelve a valer. */
router.post('/sueldos/:id/anular', pagarRaya, (req, res) => {
  const s = bd.prepare('SELECT * FROM sueldos WHERE id = ?').get(req.params.id);
  if (!s) return error(res, 'Ese sueldo no existe.', 404);
  if (s.anulado_en) return error(res, 'Ese sueldo ya está anulado.');

  bd.prepare('UPDATE sueldos SET anulado_en = ?, anulado_por = ? WHERE id = ?')
    .run(ahora(), req.usuario.id, s.id);

  bitacora.registrar({
    accion: 'raya.sueldo-anulado', entidad: 'usuario', entidadId: s.usuario_id,
    ejecutorId: req.usuario.id, detalle: { centavos: s.centavos, desde: s.desde }
  });

  return ok(res, { sueldo: calculo.sueldoVigente(s.usuario_id) });
});

// ============================================================
// QUÉ DÍAS VIENE Y A QUÉ HORA
// ============================================================

/**
 * El horario entero de un jalón: los siete días.
 *
 * Se manda completo y se reemplaza completo. Guardar día por día obligaría
 * a la pantalla a llevar la cuenta de lo que cambió, y el horario de una
 * persona se toca de tarde en tarde: no hay nada que optimizar.
 */
router.put('/:id/horario', pagarRaya, (req, res) => {
  const u = usuarioActivo(req.params.id);
  if (!u) return error(res, 'Esa persona no existe.', 404);

  const dias = Array.isArray(req.body?.dias) ? req.body.dias : null;
  if (!dias) return error(res, 'Mándame los días.');

  const limpios = [];
  for (const d of dias) {
    if (!d || d.viene === false) continue;
    const n = Number(d.dia);
    if (!Number.isInteger(n) || n < 0 || n > 6) return error(res, 'Ese día no existe.');
    if (!HORA.test(String(d.entra || '')) || !HORA.test(String(d.sale || ''))) {
      return error(res, `Las horas del ${calculo.DIAS[n]} se escriben así: 07:00`);
    }
    if (limpios.some((x) => x.dia === n)) return error(res, 'Hay un día repetido.');
    limpios.push({
      dia: n,
      entra: String(d.entra).padStart(5, '0'),
      sale: String(d.sale).padStart(5, '0'),
      notas: String(d.notas || '').trim().slice(0, 80) || null
    });
  }

  bd.transaction(() => {
    bd.prepare('DELETE FROM horarios_empleado WHERE usuario_id = ?').run(u.id);
    const meter = bd.prepare(`
      INSERT INTO horarios_empleado (id, usuario_id, dia, entra, sale, notas)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const d of limpios) meter.run(nuevoId(), u.id, d.dia, d.entra, d.sale, d.notas);
  })();

  bitacora.registrar({
    accion: 'raya.horario', entidad: 'usuario', entidadId: u.id,
    ejecutorId: u.id, capturistaId: req.usuario.id,
    detalle: { dias: limpios.length, quien: u.nombre }
  });

  return ok(res, { horario: calculo.horarioDe(u.id) });
});

// ============================================================
// PAGARLE
// ============================================================

/** El balance de una semana, para verlo antes de pagar. */
router.get('/:id/balance', verRaya, (req, res) => {
  const u = usuarioActivo(req.params.id);
  if (!u) return error(res, 'Esa persona no existe.', 404);

  const semana = calculo.semanaQueTocaria(u.id);
  const desde = leerDia(req.query.desde) || semana.desde;
  const hasta = leerDia(req.query.hasta) || semana.hasta;
  if (hasta < desde) return error(res, 'La fecha de fin va después de la de inicio.');

  return ok(res, {
    balance: calculo.balanceDe(u.id, {
      desde, hasta,
      dias: req.query.dias !== undefined ? Number(req.query.dias) : null,
      extras: leerImporte(req.query.extras) || 0,
      descuentos: leerImporte(req.query.descuentos) || 0
    })
  });
});

/**
 * PAGARLE LA SEMANA.
 *
 * Todo lo que se guarda va COPIADO (regla 3.5): el sueldo, los extras, los
 * vales y el total. Subirle el sueldo mañana no puede cambiar el papel que
 * firmó hoy.
 *
 * Y los vales que se descontaron quedan atados a esta raya: sin eso, "ya se
 * le descontó" se queda sin respaldo — no se podría decir de qué pago salió.
 */
router.post('/:id/pagar', pagarRaya, (req, res) => {
  const u = usuarioActivo(req.params.id);
  if (!u) return error(res, 'Esa persona no existe.', 404);

  const semana = calculo.semanaQueTocaria(u.id);
  const desde = leerDia(req.body?.desde) || semana.desde;
  const hasta = leerDia(req.body?.hasta) || semana.hasta;
  if (hasta < desde) return error(res, 'La fecha de fin va después de la de inicio.');

  const deDonde = req.body?.deDonde;
  if (deDonde !== 'cajon' && deDonde !== 'fuera') {
    return error(res, 'Dinos de dónde sale el dinero: del cajón, o de fuera.');
  }

  const extras = leerImporte(req.body?.extras) || 0;
  const descuentos = leerImporte(req.body?.descuentos) || 0;
  const dias = req.body?.dias !== undefined && req.body?.dias !== null
    ? Number(req.body.dias) : null;

  const b = calculo.balanceDe(u.id, { desde, hasta, dias, extras, descuentos });
  if (b.sinSueldo && !extras) {
    return error(res, `A ${u.nombre} no se le ha puesto sueldo todavía.`, 409);
  }
  if (b.enNegativo) {
    return error(res,
      `Le tocarían ${b.pagadoCentavos / 100} pesos: debe más de vales que lo que gana ` +
      'esta semana. Eso se arregla hablando, no con un papel en rojo.', 409);
  }
  if (b.pagadoCentavos === 0 && !b.valesCentavos) {
    return error(res, 'No hay nada que pagar.', 409);
  }

  const caja = sesionAbierta();
  if (deDonde === 'cajon' && !caja) {
    return error(res, 'Para pagar del cajón tiene que haber un turno de caja abierto.', 409);
  }

  const id = nuevoId();
  const fecha = ahora();
  const concepto = `Sueldo de ${u.nombre}`;
  let movimientoId = null;
  let gastoId = null;

  bd.transaction(() => {
    // EL DINERO. Del cajón deja su salida y el corte la resta; de fuera
    // entra por los gastos de la empresa y el cajón no se entera.
    if (b.pagadoCentavos > 0) {
      if (deDonde === 'cajon') {
        movimientoId = nuevoId();
        bd.prepare(`
          INSERT INTO movimientos_caja
            (id, caja_id, fecha, tipo, concepto, centavos, ejecutor_id, capturista_id,
             notas, concepto_id)
          VALUES (?, ?, ?, 'salida', ?, ?, ?, ?, ?, 'gasto-sueldos')
        `).run(movimientoId, caja.id, fecha, concepto, b.pagadoCentavos,
               u.id, req.usuario.id, `Del ${desde} al ${hasta}`);
      } else {
        gastoId = nuevoId();
        bd.prepare(`
          INSERT INTO gastos_empresa
            (id, fecha, concepto_id, concepto, centavos, forma_pago, notas,
             ejecutor_id, capturista_id, fecha_captura)
          VALUES (?, ?, 'emp-sueldos', ?, ?, 'efectivo', ?, ?, ?, ?)
        `).run(gastoId, fecha.slice(0, 10), concepto, b.pagadoCentavos,
               `Del ${desde} al ${hasta}`, u.id, req.usuario.id, fecha);
      }
    }

    bd.prepare(`
      INSERT INTO rayas
        (id, usuario_id, desde, hasta, sueldo_centavos, dias_trabajados,
         extras_centavos, extras_notas, vales_centavos, descuentos_centavos,
         descuentos_notas, pagado_centavos, de_donde, movimiento_id, gasto_empresa_id,
         pagada_en, pagada_por, notas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, u.id, desde, hasta, b.sueldoCentavos, b.diasContados,
           extras, String(req.body?.extrasNotas || '').trim().slice(0, 200) || null,
           b.valesCentavos, descuentos,
           String(req.body?.descuentosNotas || '').trim().slice(0, 200) || null,
           b.pagadoCentavos, deDonde, movimientoId, gastoId,
           fecha, req.usuario.id,
           String(req.body?.notas || '').trim().slice(0, 300) || null);

    // Los vales que se acaban de descontar quedan atados a esta raya.
    bd.prepare(`
      UPDATE adelantos
         SET descontado_en = ?, descontado_por = ?, raya_id = ?,
             descontado_nota = ?
       WHERE usuario_id = ? AND descontado_en IS NULL AND anulado_en IS NULL
    `).run(fecha, req.usuario.id, id, `Raya del ${desde} al ${hasta}`, u.id);
  })();

  bitacora.registrar({
    accion: 'raya.pagada', entidad: 'usuario', entidadId: u.id,
    ejecutorId: u.id, capturistaId: req.usuario.id,
    detalle: {
      quien: u.nombre, desde, hasta, deDonde,
      sueldo: b.sueldoCentavos, extras, vales: b.valesCentavos,
      descuentos, pagado: b.pagadoCentavos
    }
  });

  return ok(res, { raya: rayaCompleta(id) }, 201);
});

/** Una raya con todo lo que necesita su papel. */
function rayaCompleta(id) {
  const r = bd.prepare(`
    SELECT r.*, u.nombre AS usuario_nombre, u.rol AS usuario_rol,
           p.nombre AS pagada_por_nombre, a.nombre AS anulada_por_nombre
      FROM rayas r
      LEFT JOIN usuarios u ON u.id = r.usuario_id
      LEFT JOIN usuarios p ON p.id = r.pagada_por
      LEFT JOIN usuarios a ON a.id = r.anulada_por
     WHERE r.id = ?
  `).get(id);
  if (!r) return null;
  r.vales = bd.prepare(
    'SELECT * FROM adelantos WHERE raya_id = ? ORDER BY fecha').all(id);
  return r;
}

router.get('/rayas/:id', verRaya, (req, res) => {
  const r = rayaCompleta(req.params.id);
  if (!r) return error(res, 'Esa raya no existe.', 404);
  return ok(res, { raya: r });
});

/**
 * ANULAR UNA RAYA mal pagada.
 *
 * Se deshace todo: el dinero vuelve al cajón (o el gasto se anula) y los
 * vales que llevaba vuelven a estar pendientes. No se borra nada (regla
 * 3.4): la raya se queda marcada con quién la anuló y por qué.
 */
router.post('/rayas/:id/anular', pagarRaya, (req, res) => {
  const r = bd.prepare('SELECT * FROM rayas WHERE id = ?').get(req.params.id);
  if (!r) return error(res, 'Esa raya no existe.', 404);
  if (r.anulada_en) return error(res, 'Esa raya ya está anulada.');

  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) return error(res, 'Escribe por qué se anula.');

  const fecha = ahora();
  bd.transaction(() => {
    bd.prepare(`
      UPDATE rayas SET anulada_en = ?, anulada_por = ?, motivo_anulacion = ? WHERE id = ?
    `).run(fecha, req.usuario.id, motivo, r.id);

    if (r.movimiento_id) {
      bd.prepare(`
        UPDATE movimientos_caja
           SET anulado_en = ?, anulado_por = ?, motivo_anulacion = ?
         WHERE id = ? AND anulado_en IS NULL
      `).run(fecha, req.usuario.id, `Raya anulada: ${motivo}`, r.movimiento_id);
    }
    if (r.gasto_empresa_id) {
      bd.prepare(`
        UPDATE gastos_empresa
           SET anulado_en = ?, anulado_por = ?, motivo_anulacion = ?
         WHERE id = ? AND anulado_en IS NULL
      `).run(fecha, req.usuario.id, `Raya anulada: ${motivo}`, r.gasto_empresa_id);
    }

    // Los vales vuelven a estar pendientes: si la raya no valió, tampoco
    // valió el descuento.
    bd.prepare(`
      UPDATE adelantos
         SET descontado_en = NULL, descontado_por = NULL, descontado_nota = NULL, raya_id = NULL
       WHERE raya_id = ?
    `).run(r.id);
  })();

  bitacora.registrar({
    accion: 'raya.anulada', entidad: 'usuario', entidadId: r.usuario_id,
    ejecutorId: req.usuario.id,
    detalle: { motivo, pagado: r.pagado_centavos, desde: r.desde, hasta: r.hasta }
  });

  return ok(res, { anulada: true });
});

/** El día de la semana en que se paga. */
router.put('/dia-pago', pagarRaya, (req, res) => {
  const n = Number(req.body?.dia);
  if (!Number.isInteger(n) || n < 0 || n > 6) return error(res, 'Ese día no existe.');

  bd.prepare(`
    INSERT INTO configuracion (clave, valor, actualizado_en, actualizado_por)
    VALUES ('raya_dia_pago', ?, ?, ?)
    ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor,
      actualizado_en = excluded.actualizado_en, actualizado_por = excluded.actualizado_por
  `).run(String(n), ahora(), req.usuario.id);

  return ok(res, { diaDePago: n });
});

/**
 * EL BALANCE, VESTIDO DE RAYA, para poder enseñar el papel antes de pagar.
 *
 * No guarda nada ni toca nada: arma el mismo objeto que tendría la raya si
 * se pagara ahora mismo, para que el ticket se dibuje con el mismo código
 * y no haya dos papeles que se parezcan pero no sean iguales.
 */
function balanceComoRaya(usuarioId, q = {}) {
  const u = usuarioActivo(usuarioId);
  if (!u) return null;

  const semana = calculo.semanaQueTocaria(u.id);
  const desde = leerDia(q.desde) || semana.desde;
  const hasta = leerDia(q.hasta) || semana.hasta;
  if (hasta < desde) return { error: 'La fecha de fin va después de la de inicio.' };

  const b = calculo.balanceDe(u.id, {
    desde, hasta,
    dias: q.dias !== undefined ? Number(q.dias) : null,
    extras: leerImporte(q.extras) || 0,
    descuentos: leerImporte(q.descuentos) || 0
  });

  return {
    usuario_nombre: u.nombre,
    usuario_rol: u.rol,
    desde, hasta,
    sueldo_centavos: b.sueldoCentavos,
    dias_trabajados: b.diasContados,
    extras_centavos: b.extrasCentavos,
    extras_notas: String(q.extrasNotas || '').trim() || null,
    vales_centavos: b.valesCentavos,
    descuentos_centavos: b.descuentosCentavos,
    descuentos_notas: String(q.descuentosNotas || '').trim() || null,
    pagado_centavos: b.pagadoCentavos,
    de_donde: null,               // todavía no se ha decidido de dónde sale
    pagada_en: null,
    pagada_por_nombre: null,
    notas: null,
    anulada_en: null,
    vales: b.vales
  };
}

module.exports = router;
module.exports.rayaCompleta = rayaCompleta;
module.exports.balanceComoRaya = balanceComoRaya;
