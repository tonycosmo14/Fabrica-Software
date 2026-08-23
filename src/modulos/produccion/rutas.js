/**
 * PRODUCCIÓN  (v0.4 — modelo real de la fábrica)
 *
 * Cómo trabaja la fábrica de verdad, y por qué el módulo está así:
 *
 *  · LA UNIDAD ES EL PAÑO. Se empieza y se termina completo. Si el obrero se
 *    va o se acaba el agua, el paño queda EN PROCESO y otro lo continúa.
 *
 *  · SACAR Y RELLENAR SON UN SOLO MOVIMIENTO en la práctica: los moldes
 *    siempre se vuelven a llenar. En la base siguen siendo dos eventos —el
 *    reloj de congelación depende de eso—, pero el usuario da un solo toque.
 *    Dejar una canasta fuera (limpieza, se acabó el agua) es la excepción y
 *    se marca a propósito.
 *
 *  · LA ROTACIÓN INTERCALADA ES REGLA, no sugerencia: 1, 3, 5... y luego
 *    2, 4, 6... Sacar el que no toca exige autorización de admin o gerente,
 *    con motivo, y queda registrado.
 *
 *  · NO HAY TURNOS QUE ABRIR NI CERRAR. Cada movimiento guarda su hora y
 *    quién lo hizo. Los obreros no reportan uno por uno: al final de su
 *    jornada dan los números de los paños que sacaron y el cajero los
 *    captura de golpe (ver /lote).
 */
const express = require('express');
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');
const { ok, error } = require('../../lib/respuestas');
const { puede, ETIQUETAS_ROL } = require('../../lib/roles');
const { verificar } = require('../../lib/seguridad');
const bitacora = require('../../lib/bitacora');
const { exigirPermiso } = require('../../middleware/sesion');
const { tanqueConEstado, canastasFuera, horasDesde } = require('./estado');

const router = express.Router();

const verProduccion = exigirPermiso('produccion.ver');
const registrar = exigirPermiso('produccion.registrar');

const RESULTADOS = ['ok', 'merma', 'hueco'];
const TIPOS_AGUA = ['purificada', 'potable'];

/** Quién lo hizo físicamente: puede ser otro obrero distinto de quien captura. */
function resolverEjecutor(req) {
  const pedido = req.body?.ejecutorId;
  if (!pedido || pedido === req.usuario.id) return req.usuario.id;
  const existe = bd.prepare('SELECT 1 FROM usuarios WHERE id = ? AND activo = 1').get(pedido);
  return existe ? pedido : req.usuario.id;
}

/**
 * Comprueba la autorización de un responsable.
 * El PIN se verifica AQUÍ, en el servidor: la pantalla nunca sabe si un PIN
 * es correcto, solo manda lo que tecleó la persona.
 */
function comprobarAutorizacion(autorizacion) {
  if (!autorizacion?.usuarioId || !autorizacion?.pin) {
    return { error: 'Falta la autorización de un responsable.' };
  }

  const u = bd.prepare('SELECT * FROM usuarios WHERE id = ? AND activo = 1').get(autorizacion.usuarioId);
  if (!u) return { error: 'Ese responsable no existe.' };
  if (!puede(u.rol, 'produccion.autorizar')) {
    return { error: `${u.nombre} no puede autorizar esto. Solo un gerente o el administrador.` };
  }
  if (!verificar(autorizacion.pin, u.pin_hash, u.pin_sal)) {
    return { error: 'PIN incorrecto.' };
  }
  return { usuario: u };
}

/** Quiénes pueden autorizar. La pantalla los ofrece en una lista. */
function responsables() {
  return bd.prepare(`
    SELECT id, nombre, rol FROM usuarios
     WHERE activo = 1 AND rol IN ('gerente','admin') AND pin_hash IS NOT NULL
     ORDER BY CASE rol WHEN 'gerente' THEN 0 ELSE 1 END, nombre
  `).all().map((u) => ({ ...u, rolEtiqueta: ETIQUETAS_ROL[u.rol] }));
}

function datosPano(panoId) {
  return bd.prepare(`
    SELECT p.*, t.id AS tanque_id, t.nombre AS tanque_nombre,
           t.horas_congelacion, t.ultimo_pano_sacado
      FROM panos p
      JOIN tanques t ON t.id = p.tanque_id
     WHERE p.id = ? AND p.activo = 1 AND t.activo = 1
  `).get(panoId);
}

// ============================================================
// ESTADO DE LA PANTALLA
// ============================================================

router.get('/estado', verProduccion, (req, res) => {
  const tanques = bd.prepare(
    'SELECT id, nombre FROM tanques WHERE activo = 1 ORDER BY orden, nombre'
  ).all();

  if (!tanques.length) return ok(res, { tanques: [], tanque: null });

  const elegido = tanques.find((t) => t.id === req.query.tanque) || tanques[0];
  const tanque = tanqueConEstado(elegido.id);

  return ok(res, {
    tanques,
    tanque,
    fuera: canastasFuera().length,
    puedeAutorizar: puede(req.usuario.rol, 'produccion.autorizar'),
    responsables: responsables()
  });
});

/**
 * LOS NÚMEROS QUE SIGUEN, para imprimirlos y dárselos a los obreros.
 * Solo gerente o administrador: son ellos quienes reparten el trabajo.
 */
router.get('/siguientes', exigirPermiso('produccion.autorizar'), (req, res) => {
  const tanques = bd.prepare(
    'SELECT id, nombre FROM tanques WHERE activo = 1 ORDER BY orden, nombre'
  ).all();

  const lista = tanques.map((t) => {
    const estado = tanqueConEstado(t.id);
    const orden = [];
    let ultimo = estado.ultimo_pano_sacado;

    // Los siguientes de la rotación, no solo el primero: el obrero se lleva
    // una lista para toda su jornada.
    const numeros = estado.panos.map((p) => p.numero);
    const enProceso = estado.panos.filter((p) => p.enProceso).map((p) => p.numero);
    const { siguientePano } = require('./rotacion');

    for (let i = 0; i < Math.min(6, numeros.length); i++) {
      const n = siguientePano(numeros, ultimo, i === 0 ? enProceso : []);
      if (n == null || orden.includes(n)) break;
      const pano = estado.panos.find((p) => p.numero === n);
      orden.push(n);
      if (!(i === 0 && enProceso.length)) ultimo = n;
      if (!pano) break;
    }

    return {
      tanque: t.nombre,
      siguientes: orden,
      enProceso,
      horasConfiguradas: estado.horas_congelacion
    };
  });

  return ok(res, { fecha: ahora(), lista, entregadoPor: req.usuario.nombre });
});

/** Obreros a los que se les puede atribuir el trabajo. */
router.get('/obreros', verProduccion, (req, res) => {
  const obreros = bd.prepare(`
    SELECT id, nombre, rol FROM usuarios
     WHERE activo = 1 AND rol IN ('operario','cajero','gerente','admin')
     ORDER BY CASE rol WHEN 'operario' THEN 0 ELSE 1 END, nombre
  `).all();
  return ok(res, { obreros });
});

// ============================================================
// SACAR UN PAÑO — el movimiento principal
// ============================================================

/**
 * Saca un paño (o lo continúa si quedó a medias) y lo rellena en el mismo
 * movimiento, que es lo que pasa en la realidad.
 *
 * Cuerpo:
 *   ejecutorId   quién lo sacó físicamente
 *   tipoAgua     'purificada' | 'potable'
 *   rellenar     false para dejarlo fuera (limpieza, se acabó el agua)
 *   canastas     ids concretos; si no se manda, todas las que falten
 *   resultados   [{ moldeId, resultado }] solo para la merma
 *   motivo       obligatorio si se saca un paño que no toca
 */
router.post('/panos/:id/sacar', registrar, (req, res) => {
  const pano = datosPano(req.params.id);
  if (!pano) return error(res, 'Ese paño no existe o está dado de baja.', 404);

  const rellenar = req.body?.rellenar !== false;
  const tipoAgua = String(req.body?.tipoAgua || 'purificada');
  if (rellenar && !TIPOS_AGUA.includes(tipoAgua)) {
    return error(res, 'Indica si se rellena con agua purificada o potable.');
  }

  // --- La rotación es regla: si no toca, hace falta autorización ---
  const estadoTanque = tanqueConEstado(pano.tanque_id);
  const toca = estadoTanque.siguiente;
  const esElQueToca = !toca || toca.id === pano.id;

  let autorizadaPor = null;
  let motivo = String(req.body?.motivo || '').trim();

  // Salirse de la rotación siempre exige la firma de un responsable: motivo
  // escrito y el PIN de un gerente o del administrador. Da igual quién esté
  // usando la pantalla; lo que vale es quién autorizó.
  if (!esElQueToca) {
    const auth = req.body?.autorizacion;
    if (!auth) {
      return error(res,
        `Toca el paño ${toca.numero}, no el ${pano.numero}.`, 409,
        { requiereAutorizacion: true, tocaPano: toca.numero, porque: toca.porque });
    }

    const comprobado = comprobarAutorizacion(auth);
    if (comprobado.error) return error(res, comprobado.error, 403, { requiereAutorizacion: true });

    motivo = String(auth.motivo || motivo).trim();
    if (!motivo) return error(res, 'Escribe por qué se saca este paño.', 400, { requiereAutorizacion: true });

    autorizadaPor = comprobado.usuario.id;
  }

  // --- Qué canastas faltan por sacar en este paño ---
  const panoActual = estadoTanque.panos.find((p) => p.id === pano.id);
  if (!panoActual) return error(res, 'Ese paño no está activo.', 404);

  const pendientes = panoActual.canastas.filter((c) => c.estado !== 'fuera');
  const pedidas = req.body?.canastas;
  const canastas = pedidas?.length
    ? pendientes.filter((c) => pedidas.includes(c.id))
    : pendientes;

  if (!canastas.length) {
    return error(res, 'Este paño ya está fuera del tanque. Lo que falta es rellenarlo.', 409);
  }

  // --- Resultados por molde. Lo normal: todos bien ---
  const marcas = new Map();
  for (const r of req.body?.resultados || []) {
    if (!RESULTADOS.includes(r.resultado)) return error(res, `Resultado inválido: ${r.resultado}.`);
    marcas.set(r.moldeId, r.resultado);
  }

  const fecha = ahora();
  const ejecutorId = resolverEjecutor(req);

  // --- ¿Continúa una sacada a medias, o empieza una nueva? ---
  let sacadaPano = bd.prepare(
    'SELECT * FROM sacadas_pano WHERE pano_id = ? AND terminada_en IS NULL ORDER BY iniciada_en LIMIT 1'
  ).get(pano.id);

  const resumen = { ok: 0, merma: 0, hueco: 0 };

  const guardar = bd.transaction(() => {
    if (!sacadaPano) {
      const id = nuevoId();
      bd.prepare(`
        INSERT INTO sacadas_pano (id, pano_id, iniciada_en, ejecutor_id, capturista_id,
                                  autorizada_por, motivo_orden, notas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, pano.id, fecha, ejecutorId, req.usuario.id,
             autorizadaPor, motivo || null, req.body?.notas || null);
      sacadaPano = { id, pano_id: pano.id };
    }

    const insertarSacada = bd.prepare(`
      INSERT INTO sacadas (id, canasta_id, fecha, ejecutor_id, capturista_id,
                           rellenado_id, horas_congelacion, sacada_pano_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertarMolde = bd.prepare(
      'INSERT INTO sacadas_moldes (id, sacada_id, molde_id, resultado) VALUES (?, ?, ?, ?)'
    );
    const insertarRellenado = bd.prepare(`
      INSERT INTO rellenados (id, canasta_id, fecha, ejecutor_id, capturista_id,
                              tipo_agua, sacada_pano_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const buscarRellenado = bd.prepare(
      'SELECT id, fecha FROM rellenados WHERE canasta_id = ? ORDER BY fecha DESC LIMIT 1'
    );

    for (const c of canastas) {
      const previo = buscarRellenado.get(c.id);
      const horas = previo ? horasDesde(previo.fecha, new Date(fecha)) : null;
      const sacadaId = nuevoId();

      insertarSacada.run(sacadaId, c.id, fecha, ejecutorId, req.usuario.id,
                         previo?.id || null, horas, sacadaPano.id);

      for (const m of c.moldes) {
        const r = marcas.get(m.id) || 'ok';
        insertarMolde.run(nuevoId(), sacadaId, m.id, r);
        resumen[r]++;
      }

      // Los moldes se vuelven a llenar en el mismo movimiento, salvo que se
      // marque a propósito que la canasta se queda fuera.
      if (rellenar) {
        insertarRellenado.run(nuevoId(), c.id, fecha, ejecutorId, req.usuario.id,
                              tipoAgua, sacadaPano.id);
      }
    }

    // ¿Quedó completo el paño? Si sí, se cierra y avanza la rotación.
    const total = panoActual.canastas.length;
    const hechas = bd.prepare(
      'SELECT COUNT(DISTINCT canasta_id) n FROM sacadas WHERE sacada_pano_id = ?'
    ).get(sacadaPano.id).n;

    if (hechas >= total) {
      bd.prepare('UPDATE sacadas_pano SET terminada_en = ? WHERE id = ?').run(fecha, sacadaPano.id);

      // Ojo: la rotación solo avanza cuando se sacó EL PAÑO QUE TOCABA.
      // Si se sacó otro con autorización, la secuencia normal sigue en su
      // sitio: el paño de emergencia no debe descolocar la rotación.
      if (esElQueToca) {
        bd.prepare('UPDATE tanques SET ultimo_pano_sacado = ? WHERE id = ?')
          .run(pano.numero, pano.tanque_id);
      }
    }
  });
  guardar();

  const terminada = bd.prepare('SELECT terminada_en FROM sacadas_pano WHERE id = ?')
    .get(sacadaPano.id).terminada_en;

  bitacora.registrar({
    accion: terminada ? 'produccion.pano_sacado' : 'produccion.pano_en_proceso',
    entidad: 'pano', entidadId: pano.id,
    ejecutorId, capturistaId: req.usuario.id,
    detalle: {
      tanque: pano.tanque_nombre, pano: pano.numero, canastas: canastas.length,
      resumen, rellenado: rellenar, tipoAgua: rellenar ? tipoAgua : null,
      fueraDeOrden: !esElQueToca, motivo: motivo || null
    }
  });

  return ok(res, {
    marquetas: resumen.ok,
    merma: resumen.merma + resumen.hueco,
    terminado: Boolean(terminada),
    canastas: canastas.length
  }, 201);
});

/**
 * RELLENAR un paño que se quedó fuera del tanque.
 *
 * Antes esto no existía y era un callejón sin salida: un paño marcado como
 * "fuera" no respondía al tocarlo, porque ya no había nada que sacar.
 */
router.post('/panos/:id/rellenar', registrar, (req, res) => {
  const pano = datosPano(req.params.id);
  if (!pano) return error(res, 'Ese paño no existe o está dado de baja.', 404);

  const tipoAgua = String(req.body?.tipoAgua || 'purificada');
  if (!TIPOS_AGUA.includes(tipoAgua)) {
    return error(res, 'Indica si se rellena con agua purificada o potable.');
  }

  const estadoTanque = tanqueConEstado(pano.tanque_id);
  const panoActual = estadoTanque.panos.find((p) => p.id === pano.id);
  const fuera = panoActual.canastas.filter((c) => c.estado === 'fuera');

  if (!fuera.length) return error(res, 'Ese paño no tiene canastas fuera del tanque.', 409);

  const fecha = ahora();
  const ejecutorId = resolverEjecutor(req);

  const guardar = bd.transaction(() => {
    const insertar = bd.prepare(`
      INSERT INTO rellenados (id, canasta_id, fecha, ejecutor_id, capturista_id, tipo_agua)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const c of fuera) insertar.run(nuevoId(), c.id, fecha, ejecutorId, req.usuario.id, tipoAgua);
  });
  guardar();

  bitacora.registrar({
    accion: 'produccion.rellenado', entidad: 'pano', entidadId: pano.id,
    ejecutorId, capturistaId: req.usuario.id,
    detalle: { tanque: pano.tanque_nombre, pano: pano.numero, canastas: fuera.length, tipoAgua }
  });

  return ok(res, { rellenadas: fuera.length, tipoAgua }, 201);
});

// ============================================================
// CAPTURA EN LOTE — el flujo real de las 3 de la tarde
// ============================================================

/**
 * El obrero llega y dice: "saqué los paños 1, 3 y 5". Se capturan todos de
 * golpe, a su nombre. Es como funciona hoy en la fábrica.
 *
 * Aquí no se aplica la regla de rotación paño por paño: se está registrando
 * algo que YA pasó. Pero sí se anota si el orden no fue el esperado.
 */
router.post('/lote', registrar, (req, res) => {
  const panosIds = req.body?.panos;
  if (!Array.isArray(panosIds) || !panosIds.length) {
    return error(res, 'Marca al menos un paño.');
  }
  if (panosIds.length > 60) return error(res, 'Son demasiados paños de una vez.');

  const tipoAgua = String(req.body?.tipoAgua || 'purificada');
  if (!TIPOS_AGUA.includes(tipoAgua)) {
    return error(res, 'Indica si se rellenó con agua purificada o potable.');
  }

  const ejecutorId = resolverEjecutor(req);
  const fecha = ahora();
  const hechos = [];
  let marquetas = 0;

  const guardar = bd.transaction(() => {
    for (const panoId of panosIds) {
      const pano = datosPano(panoId);
      if (!pano) continue;

      const estadoTanque = tanqueConEstado(pano.tanque_id);
      const panoActual = estadoTanque.panos.find((p) => p.id === pano.id);
      const canastas = panoActual.canastas.filter((c) => c.estado !== 'fuera');
      if (!canastas.length) continue;

      const sacadaPanoId = nuevoId();
      bd.prepare(`
        INSERT INTO sacadas_pano (id, pano_id, iniciada_en, terminada_en,
                                  ejecutor_id, capturista_id, notas)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(sacadaPanoId, pano.id, fecha, fecha, ejecutorId, req.usuario.id,
             req.body?.notas || 'Capturado en lote al final de la jornada');

      for (const c of canastas) {
        const previo = bd.prepare(
          'SELECT id, fecha FROM rellenados WHERE canasta_id = ? ORDER BY fecha DESC LIMIT 1'
        ).get(c.id);
        const sacadaId = nuevoId();

        bd.prepare(`
          INSERT INTO sacadas (id, canasta_id, fecha, ejecutor_id, capturista_id,
                               rellenado_id, horas_congelacion, sacada_pano_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(sacadaId, c.id, fecha, ejecutorId, req.usuario.id, previo?.id || null,
               previo ? horasDesde(previo.fecha, new Date(fecha)) : null, sacadaPanoId);

        for (const m of c.moldes) {
          bd.prepare('INSERT INTO sacadas_moldes (id, sacada_id, molde_id, resultado) VALUES (?, ?, ?, ?)')
            .run(nuevoId(), sacadaId, m.id, 'ok');
          marquetas++;
        }

        bd.prepare(`
          INSERT INTO rellenados (id, canasta_id, fecha, ejecutor_id, capturista_id,
                                  tipo_agua, sacada_pano_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(nuevoId(), c.id, fecha, ejecutorId, req.usuario.id, tipoAgua, sacadaPanoId);
      }

      bd.prepare('UPDATE tanques SET ultimo_pano_sacado = ? WHERE id = ?')
        .run(pano.numero, pano.tanque_id);

      hechos.push({ tanque: pano.tanque_nombre, pano: pano.numero });
    }
  });
  guardar();

  bitacora.registrar({
    accion: 'produccion.captura_lote', entidad: 'usuario', entidadId: ejecutorId,
    ejecutorId, capturistaId: req.usuario.id,
    detalle: { panos: hechos, marquetas, tipoAgua }
  });

  return ok(res, { panos: hechos, marquetas }, 201);
});

// ============================================================
// CORRECCIONES — solo admin o gerente
// ============================================================

/**
 * Se equivocaron de paño. No se borra nada: se anula la sacada con un
 * movimiento nuevo que la compensa (regla de oro 3.2).
 */
/** Anula la ÚLTIMA sacada de un paño, esté terminada o a medias. */
router.post('/panos/:id/anular-ultima', exigirPermiso('produccion.corregir'), (req, res) => {
  const ultima = bd.prepare(`
    SELECT id FROM sacadas_pano
     WHERE pano_id = ? AND (notas IS NULL OR notas NOT LIKE 'ANULADA%')
     ORDER BY iniciada_en DESC LIMIT 1
  `).get(req.params.id);

  if (!ultima) return error(res, 'Ese paño no tiene ninguna sacada que anular.', 404);

  req.params.id = ultima.id;
  return anularSacadaPano(req, res);
});

router.post('/sacadas-pano/:id/anular', exigirPermiso('produccion.corregir'), (req, res) =>
  anularSacadaPano(req, res));

function anularSacadaPano(req, res) {
  const sp = bd.prepare(`
    SELECT sp.*, p.numero AS pano_numero, p.tanque_id, t.nombre AS tanque_nombre
      FROM sacadas_pano sp
      JOIN panos p   ON p.id = sp.pano_id
      JOIN tanques t ON t.id = p.tanque_id
     WHERE sp.id = ?
  `).get(req.params.id);
  if (!sp) return error(res, 'Ese registro no existe.', 404);
  if (sp.notas && sp.notas.startsWith('ANULADA')) return error(res, 'Ese registro ya está anulado.');

  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) return error(res, 'Escribe por qué se anula.');

  const anular = bd.transaction(() => {
    // Se marca la sacada como anulada y se retiran sus rellenados, dejando
    // el paño como estaba. Los eventos originales NO se borran.
    bd.prepare('UPDATE sacadas_pano SET notas = ?, terminada_en = COALESCE(terminada_en, ?) WHERE id = ?')
      .run(`ANULADA: ${motivo}`, ahora(), sp.id);

    bd.prepare('DELETE FROM rellenados WHERE sacada_pano_id = ?').run(sp.id);
    bd.prepare(`
      DELETE FROM sacadas_moldes
       WHERE sacada_id IN (SELECT id FROM sacadas WHERE sacada_pano_id = ?)
    `).run(sp.id);
    bd.prepare('DELETE FROM sacadas WHERE sacada_pano_id = ?').run(sp.id);
  });
  anular();

  bitacora.registrar({
    accion: 'produccion.anulacion', entidad: 'pano', entidadId: sp.pano_id,
    ejecutorId: req.usuario.id,
    detalle: { tanque: sp.tanque_nombre, pano: sp.pano_numero, motivo }
  });

  return ok(res, { anulado: true });
}

// ============================================================
// LO DE HOY
// ============================================================

router.get('/hoy', verProduccion, (req, res) => {
  const desde = req.query.desde || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  const marquetas = bd.prepare(`
    SELECT COUNT(*) n FROM sacadas_moldes sm
      JOIN sacadas s ON s.id = sm.sacada_id
     WHERE s.fecha >= ? AND sm.resultado = 'ok'
  `).get(desde).n;

  const merma = bd.prepare(`
    SELECT COUNT(*) n FROM sacadas_moldes sm
      JOIN sacadas s ON s.id = sm.sacada_id
     WHERE s.fecha >= ? AND sm.resultado IN ('merma','hueco')
  `).get(desde).n;

  const porObrero = bd.prepare(`
    SELECT u.nombre, COUNT(DISTINCT sp.id) AS panos,
           (SELECT COUNT(*) FROM sacadas_moldes sm
              JOIN sacadas s ON s.id = sm.sacada_id
             WHERE s.sacada_pano_id IN (
                     SELECT id FROM sacadas_pano WHERE ejecutor_id = u.id AND iniciada_en >= ?)
               AND sm.resultado = 'ok') AS marquetas
      FROM sacadas_pano sp
      JOIN usuarios u ON u.id = sp.ejecutor_id
     WHERE sp.iniciada_en >= ?
     GROUP BY u.id ORDER BY marquetas DESC
  `).all(desde, desde);

  const panos = bd.prepare(`
    SELECT sp.id, sp.iniciada_en, sp.terminada_en, sp.notas,
           t.nombre AS tanque, p.numero AS pano, u.nombre AS quien,
           sp.autorizada_por, sp.motivo_orden,
           (SELECT COUNT(*) FROM sacadas_moldes sm
              JOIN sacadas s ON s.id = sm.sacada_id
             WHERE s.sacada_pano_id = sp.id AND sm.resultado = 'ok') AS marquetas
      FROM sacadas_pano sp
      JOIN panos p   ON p.id = sp.pano_id
      JOIN tanques t ON t.id = p.tanque_id
      LEFT JOIN usuarios u ON u.id = sp.ejecutor_id
     WHERE sp.iniciada_en >= ?
     ORDER BY sp.iniciada_en DESC
  `).all(desde);

  return ok(res, { desde, marquetas, merma, porObrero, panos, fuera: canastasFuera().length });
});

module.exports = router;
