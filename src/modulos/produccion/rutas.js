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
const autorizar = require('../../lib/autorizacion');
const { verificar } = require('../../lib/seguridad');
const { numerosASacar } = require('./siguientes');
const bitacora = require('../../lib/bitacora');
const { exigirPermiso } = require('../../middleware/sesion');
const { tanqueConEstado, canastasFuera, horasDesde } = require('./estado');
const vales = require('./vales');
const calidad = require('./calidad');

const router = express.Router();

const verProduccion = exigirPermiso('produccion.ver');
const registrar = exigirPermiso('produccion.registrar');

const TIPOS_AGUA = ['purificada', 'potable'];

/**
 * Quién lo hizo físicamente: puede ser otro obrero distinto de quien captura,
 * o alguien sin usuario —un eventual de un día, el dueño— cuyo nombre llega
 * escrito en ejecutorNombre. En ese caso el id queda vacío y el nombre se
 * copia al registro (regla 3.5); el capturista sigue siendo la sesión (3.6).
 */
function resolverQuien(req) {
  const pedido = req.body?.ejecutorId;
  if (pedido) {
    const existe = bd.prepare('SELECT 1 FROM usuarios WHERE id = ? AND activo = 1').get(pedido);
    if (existe) return { id: pedido, libre: null };
  }
  const nombre = String(req.body?.ejecutorNombre || '').trim().slice(0, 40);
  if (nombre) return { id: null, libre: nombre };
  return { id: req.usuario.id, libre: null };
}

/** Comprobar el PIN de quien autoriza. El ayudante vive en lib. */
function comprobarAutorizacion(autorizacion) {
  return autorizar.comprobar(autorizacion, 'produccion.autorizar');
}

const responsables = autorizar.responsables;

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
    responsables: responsables(),
    // Los estados del hielo viajan del servidor a la pantalla, no
    // copiados a mano en el JavaScript de enfrente: así hay un solo
    // lugar donde dicen cómo se llaman y qué significan (calidad.js).
    calidades: calidad.CALIDADES,
    destinos: calidad.DESTINOS
  });
});

/**
 * PEDIR AUTORIZACIÓN para un paño que no toca.
 *
 * Se pide ANTES de ver las opciones: el gerente teclea su PIN una vez y a
 * partir de ahí la pantalla puede mostrar qué se puede hacer con ese paño.
 */
router.post('/autorizar', registrar, (req, res) => {
  const { panoId, motivo, usuarioId, pin } = req.body || {};

  const pano = datosPano(panoId);
  if (!pano) return error(res, 'Ese paño no existe.', 404);

  const texto = String(motivo || '').trim();
  if (!texto) return error(res, 'Escribe por qué se va a sacar este paño.');

  const comprobado = comprobarAutorizacion({ usuarioId, pin });
  if (comprobado.error) return error(res, comprobado.error, 403);

  const vale = vales.crear({
    usuarioId: comprobado.usuario.id,
    usuarioNombre: comprobado.usuario.nombre,
    panoId: pano.id,
    motivo: texto
  });

  bitacora.registrar({
    accion: 'produccion.autorizacion', entidad: 'pano', entidadId: pano.id,
    ejecutorId: comprobado.usuario.id, capturistaId: req.usuario.id,
    detalle: { tanque: pano.tanque_nombre, pano: pano.numero, motivo: texto }
  });

  return ok(res, {
    vale: vale.id,
    autorizadaPor: comprobado.usuario.nombre,
    motivo: texto,
    expiraEnMinutos: vale.expiraEnMinutos
  }, 201);
});

/**
 * LOS NÚMEROS QUE SIGUEN, para imprimirlos y dárselos a los obreros.
 *
 * Permiso propio, distinto del de autorizar: el cajero es quien está en el
 * mostrador cuando el obrero llega a preguntar qué paño toca, y hacerlo
 * esperar a que aparezca un gerente para leerle una lista no tiene sentido.
 * Decidir que se saque uno FUERA de orden sigue siendo del gerente.
 */
router.get('/siguientes', exigirPermiso('produccion.numeros'), (req, res) => {
  return ok(res, numerosASacar(req.usuario.nombre));
});

/** Obreros a los que se les puede atribuir el trabajo. */
router.get('/obreros', verProduccion, (req, res) => {
  // Solo los operarios: sacar paños es su trabajo. Cuando saca alguien más
  // —un eventual, el dueño— su nombre se escribe con la opción "Otro" y se
  // guarda tal cual; darlo de alta como usuario para un día no tiene caso.
  const obreros = bd.prepare(`
    SELECT id, nombre, rol FROM usuarios
     WHERE activo = 1 AND rol = 'operario'
     ORDER BY nombre
  `).all();
  return ok(res, { obreros });
});

// ============================================================
// SACAR UN PAÑO — el movimiento principal
// ============================================================

/**
 * LA FICHA DE UN PAÑO — para MIRAR, no para tocar.
 *
 * Antes, tocar un paño que no era el que tocaba pedía el PIN antes de
 * enseñar nada. Está bien para SACARLO, pero no para lo otro que se hace
 * todo el día: ver un molde marcado en rojo y querer saber qué le pasó.
 * Para eso no hace falta autorización de nadie —no se cambia nada— y
 * pedirla convertía una consulta de dos segundos en ir a buscar al gerente.
 *
 * Así que esto se abre con el permiso de VER, y lo que devuelve es
 * historia: cuándo se sacó la última vez, quién, cuántas horas llevaba
 * congelando y qué salió de cada molde. Para modificar algo sigue haciendo
 * falta el PIN, y ese se pide desde dentro cuando de verdad se va a hacer.
 */
router.get('/panos/:id/ficha', verProduccion, (req, res) => {
  const pano = bd.prepare(`
    SELECT p.*, t.nombre AS tanque_nombre, t.id AS tanque_id, t.horas_congelacion
      FROM panos p JOIN tanques t ON t.id = p.tanque_id
     WHERE p.id = ? AND p.activo = 1
  `).get(req.params.id);
  if (!pano) return error(res, 'Ese paño no existe.', 404);

  // Las últimas veces que se sacó, de la más nueva a la más vieja. Seis
  // bastan: es más de una vuelta completa de la rotación en cualquier
  // tanque, y con eso se ve si algo viene repitiéndose.
  const sacadas = bd.prepare(`
    SELECT sp.id, sp.iniciada_en, sp.terminada_en, sp.notas, sp.motivo_orden,
           COALESCE(u.nombre, sp.ejecutor_libre, '—') AS quien,
           COALESCE(a.nombre, '')                     AS autorizo
      FROM sacadas_pano sp
      LEFT JOIN usuarios u ON u.id = sp.ejecutor_id
      LEFT JOIN usuarios a ON a.id = sp.autorizada_por
     WHERE sp.pano_id = ?
     ORDER BY sp.iniciada_en DESC
     LIMIT 6
  `).all(pano.id);

  const cuentaDe = bd.prepare(`
    SELECT ${calidad.columnasMezcla('sm')},
           ${calidad.columnaGuardadas('sm')} AS guardadas,
           AVG(s.horas_congelacion)          AS horas
      FROM sacadas_moldes sm
      JOIN sacadas s ON s.id = sm.sacada_id
     WHERE s.sacada_pano_id = ?
  `);
  // Quiénes le metieron mano: un paño se puede sacar canasta por canasta y
  // terminarlo otro turno, y cada canasta guarda su propio responsable.
  const quienesDe = bd.prepare(`
    SELECT DISTINCT COALESCE(u.nombre, '') AS nombre
      FROM sacadas s LEFT JOIN usuarios u ON u.id = s.ejecutor_id
     WHERE s.sacada_pano_id = ?
  `);

  const historial = sacadas.map((sp) => {
    const cuenta = cuentaDe.get(sp.id);
    const anulada = Boolean(sp.notas && sp.notas.startsWith('ANULADA'));
    return {
      id: sp.id,
      fecha: sp.terminada_en || sp.iniciada_en,
      empezada: sp.iniciada_en,
      terminada: Boolean(sp.terminada_en),
      anulada,
      motivoAnulada: anulada ? sp.notas : null,
      quienes: [...new Set([sp.quien, ...quienesDe.all(sp.id).map((f) => f.nombre)])]
        .filter((n) => n && n !== '—'),
      autorizo: sp.autorizo || null,
      motivoOrden: sp.motivo_orden || null,
      horas: cuenta.horas,
      mezcla: calidad.resumir(cuenta, cuenta.guardadas)
    };
  });

  // Molde por molde, cómo salió la última vez. Es lo que se viene a ver
  // cuando un molde aparece marcado en la pantalla.
  const ultima = historial.find((x) => !x.anulada) || null;
  const moldes = ultima ? bd.prepare(`
    SELECT c.numero AS canasta, m.numero AS molde,
           sm.resultado, sm.destino, sm.nota
      FROM sacadas_moldes sm
      JOIN sacadas s  ON s.id = sm.sacada_id
      JOIN moldes m   ON m.id = sm.molde_id
      JOIN canastas c ON c.id = m.canasta_id
     WHERE s.sacada_pano_id = ?
     ORDER BY c.numero, m.numero
  `).all(ultima.id) : [];

  return ok(res, {
    pano: {
      id: pano.id, numero: pano.numero,
      tanque: pano.tanque_nombre, tanqueId: pano.tanque_id,
      horasCongelacion: pano.horas_congelacion
    },
    ultima, moldes, historial,
    calidades: calidad.CALIDADES,
    destinos: calidad.DESTINOS
  });
});

/**
 * Saca un paño (o lo continúa si quedó a medias) y lo rellena en el mismo
 * movimiento, que es lo que pasa en la realidad.
 *
 * Cuerpo:
 *   ejecutorId   quién lo sacó físicamente
 *   tipoAgua     'purificada' | 'potable'
 *   rellenar     false para dejarlo fuera (limpieza, se acabó el agua)
 *   canastas     ids concretos; si no se manda, todas las que falten
 *   calidad      cómo salió el paño en general (por omisión 'normal')
 *   destino      a dónde fue el hielo que no se vende solo (cáscara,
 *                contaminada, otro)
 *   nota         qué pasó; obligatoria si la calidad es 'otro'
 *   resultados   [{ moldeId, resultado, destino, nota }] los moldes que
 *                salieron distintos del resto del paño
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
    // Dos maneras de traer el permiso: un vale pedido antes (lo normal, así
    // se ven las opciones sin volver a teclear el PIN) o el PIN directo.
    if (req.body?.vale) {
      const usado = vales.usar(req.body.vale, pano.id);
      if (usado.error) return error(res, usado.error, 403, { requiereAutorizacion: true });
      autorizadaPor = usado.vale.usuarioId;
      motivo = usado.vale.motivo;
    } else {
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
  }

  // --- Qué canastas faltan por sacar en este paño ---
  const panoActual = estadoTanque.panos.find((p) => p.id === pano.id);
  if (!panoActual) return error(res, 'Ese paño no está activo.', 404);

  //
  // LAS QUE YA SE SACARON EN ESTA MISMA FAENA NO VUELVEN A SALIR. Al sacar
  // una canasta se rellena en el mismo movimiento, así que al ratito vuelve
  // a verse "congelando"; sin esta resta, terminar un paño a medias
  // inventaría otra vez las canastas de ayer.
  const yaSacada = new Set(
    panoActual.canastas.filter((c) => c.yaSacada).map((c) => c.id));

  const pendientes = panoActual.canastas
    .filter((c) => c.estado !== 'fuera' && !yaSacada.has(c.id));

  const pedidas = req.body?.canastas;
  const canastas = pedidas?.length
    ? pendientes.filter((c) => pedidas.includes(c.id))
    : pendientes;

  if (!canastas.length) {
    return error(res, yaSacada.size
      ? 'De este paño ya no falta ninguna canasta por sacar.'
      : 'Este paño ya está fuera del tanque. Lo que falta es rellenarlo.', 409);
  }

  // --- CÓMO SALIÓ EL HIELO ---
  //
  // Primero cómo salió EL PAÑO, que es lo que de verdad pasa: la fábrica
  // congela bien o mal esa noche y el paño entero sale parecido. Después,
  // los moldes sueltos que salieron distintos.
  //
  // Un molde suelto que no diga a dónde fue su cáscara sigue al del paño:
  // eso es lo que resuelve `interpretar` pasándole `porOmision`.
  let porOmision;
  const marcas = new Map();
  try {
    porOmision = calidad.interpretar(req.body?.calidad
      ? { resultado: req.body.calidad, destino: req.body.destino, nota: req.body.nota }
      : { destino: req.body?.destino, nota: req.body?.nota });

    for (const r of req.body?.resultados || []) {
      marcas.set(r.moldeId, calidad.interpretar(r, {
        destino: porOmision.destino || req.body?.destino,
        // La nota del paño NO se hereda: si un molde salió con otra cosa,
        // lo que pasó ahí no es lo que pasó en el resto.
        nota: null
      }));
    }
  } catch (e) { return error(res, e.message); }

  const general = porOmision.resultado;

  const fecha = ahora();
  const quien = resolverQuien(req);
  // En los renglones hijos (sacadas, rellenados) el responsable con usuario:
  // el ejecutor si lo hay, si no el capturista. El nombre escrito vive en
  // sacadas_pano, que es el registro del paño.
  const ejecutorId = quien.id || req.usuario.id;

  // --- ¿Continúa una sacada a medias, o empieza una nueva? ---
  let sacadaPano = bd.prepare(
    'SELECT * FROM sacadas_pano WHERE pano_id = ? AND terminada_en IS NULL ORDER BY iniciada_en LIMIT 1'
  ).get(pano.id);

  const mezcla = Object.fromEntries(calidad.RESULTADOS.map((c) => [c, 0]));
  let guardadas = 0;

  const guardar = bd.transaction(() => {
    if (!sacadaPano) {
      const id = nuevoId();
      bd.prepare(`
        INSERT INTO sacadas_pano (id, pano_id, iniciada_en, ejecutor_id, ejecutor_libre,
                                  capturista_id, autorizada_por, motivo_orden, notas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, pano.id, fecha, quien.id, quien.libre, req.usuario.id,
             autorizadaPor, motivo || null, req.body?.notas || null);
      sacadaPano = { id, pano_id: pano.id };
    }

    const insertarSacada = bd.prepare(`
      INSERT INTO sacadas (id, canasta_id, fecha, ejecutor_id, capturista_id,
                           rellenado_id, horas_congelacion, sacada_pano_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertarMolde = bd.prepare(
      `INSERT INTO sacadas_moldes (id, sacada_id, molde_id, resultado, destino, nota)
       VALUES (?, ?, ?, ?, ?, ?)`
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
        const marca = marcas.get(m.id) || porOmision;
        insertarMolde.run(nuevoId(), sacadaId, m.id,
                          marca.resultado, marca.destino, marca.nota);
        mezcla[marca.resultado]++;
        if (marca.destino === 'almacen') guardadas++;
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
      calidad: general, nota: porOmision.nota, mezcla, rellenado: rellenar,
      tipoAgua: rellenar ? tipoAgua : null,
      fueraDeOrden: !esElQueToca, motivo: motivo || null
    }
  });

  const cuenta = calidad.resumir(mezcla, guardadas);

  return ok(res, {
    // "marquetas" siguió llamándose así, pero ahora quiere decir lo que de
    // verdad entró al cuarto frío: las cáscaras que se fueron a los
    // condensadores no están ahí, y contarlas descuadraría el conteo.
    marquetas: cuenta.alAlmacen,
    producidas: cuenta.producidas,
    merma: cuenta.merma,
    mezcla: cuenta,
    terminado: Boolean(terminada),
    canastas: canastas.length,
    // Cuántas quedaron para otro rato (o para otro turno).
    faltan: panoActual.canastas.length - yaSacada.size - canastas.length
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
  const quien = resolverQuien(req);
  const ejecutorId = quien.id || req.usuario.id;

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

  // Cómo salió el hielo de esa jornada. Aquí es UNA respuesta para toda la
  // captura y no molde por molde a propósito: se está anotando algo que ya
  // pasó, de memoria, y pedir detalle que nadie apuntó solo produciría
  // datos inventados. El detalle fino se marca cuando se saca el paño en
  // el momento, en la pantalla del paño.
  let comoSalio;
  try {
    comoSalio = calidad.interpretar({
      resultado: req.body?.calidad, destino: req.body?.destino, nota: req.body?.nota
    });
  } catch (e) { return error(res, e.message); }
  const general = comoSalio.resultado;

  const quien = resolverQuien(req);
  const ejecutorId = quien.id || req.usuario.id;
  const fecha = ahora();
  const hechos = [];
  let producidas = 0;

  // Los paños que se marcaron fuera de la rotación traen su vale.
  const autorizados = new Map();
  for (const [panoId, valeId] of Object.entries(req.body?.vales || {})) {
    const usado = vales.usar(valeId, panoId);
    if (!usado.error) autorizados.set(panoId, usado.vale);
  }

  const guardar = bd.transaction(() => {
    for (const panoId of panosIds) {
      const pano = datosPano(panoId);
      if (!pano) continue;
      const permiso = autorizados.get(panoId);

      const estadoTanque = tanqueConEstado(pano.tanque_id);
      const panoActual = estadoTanque.panos.find((p) => p.id === pano.id);
      const canastas = panoActual.canastas.filter((c) => c.estado !== 'fuera');
      if (!canastas.length) continue;

      const sacadaPanoId = nuevoId();
      bd.prepare(`
        INSERT INTO sacadas_pano (id, pano_id, iniciada_en, terminada_en,
                                  ejecutor_id, ejecutor_libre, capturista_id,
                                  autorizada_por, motivo_orden, notas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(sacadaPanoId, pano.id, fecha, fecha, quien.id, quien.libre, req.usuario.id,
             permiso?.usuarioId || null, permiso?.motivo || null,
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
          bd.prepare(`INSERT INTO sacadas_moldes (id, sacada_id, molde_id, resultado, destino, nota)
                      VALUES (?, ?, ?, ?, ?, ?)`)
            .run(nuevoId(), sacadaId, m.id, general, comoSalio.destino, comoSalio.nota);
          producidas++;
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
    detalle: { panos: hechos, moldes: producidas, calidad: general,
               destino: comoSalio.destino, nota: comoSalio.nota, tipoAgua }
  });

  // Toda la captura salió igual, así que basta con resumir un solo estado
  // repetido tantas veces como moldes se abrieron.
  const cuenta = calidad.resumir(
    { [general]: producidas },
    comoSalio.destino === 'almacen' ? producidas : 0
  );

  return ok(res, {
    panos: hechos, marquetas: cuenta.alAlmacen, producidas: cuenta.producidas,
    calidad: general, mezcla: cuenta
  }, 201);
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

  // La mezcla del día en una sola pasada: cuántas de cada estado, y
  // cuántas cáscaras se guardaron en vez de irse a los condensadores.
  const cuenta = bd.prepare(`
    SELECT ${calidad.columnasMezcla('sm')},
           ${calidad.columnaGuardadas('sm')} AS guardadas
      FROM sacadas_moldes sm
      JOIN sacadas s ON s.id = sm.sacada_id
     WHERE s.fecha >= ?
  `).get(desde);

  const mezcla = calidad.resumir(cuenta, cuenta.guardadas);
  const marquetas = mezcla.alAlmacen;
  const merma = mezcla.merma;

  // Los de nombre escrito ("Otro") también cuentan aquí, agrupados por su
  // nombre: si Juan el eventual sacó tres paños, sus tres paños son suyos,
  // no del cajero que los capturó.
  const porObrero = bd.prepare(`
    SELECT COALESCE(u.nombre, sp.ejecutor_libre, '—') AS nombre,
           COUNT(DISTINCT sp.id) AS panos,
           (SELECT COUNT(*) FROM sacadas_moldes sm
              JOIN sacadas s ON s.id = sm.sacada_id
              JOIN sacadas_pano sp2 ON sp2.id = s.sacada_pano_id
             WHERE COALESCE(sp2.ejecutor_id, 'L:' || sp2.ejecutor_libre)
                   = COALESCE(sp.ejecutor_id, 'L:' || sp.ejecutor_libre)
               AND sp2.iniciada_en >= ?
               AND ${calidad.alAlmacen('sm')}) AS marquetas
      FROM sacadas_pano sp
      LEFT JOIN usuarios u ON u.id = sp.ejecutor_id
     WHERE sp.iniciada_en >= ?
     GROUP BY COALESCE(sp.ejecutor_id, 'L:' || sp.ejecutor_libre)
     ORDER BY marquetas DESC
  `).all(desde, desde);

  const panos = bd.prepare(`
    SELECT sp.id, sp.iniciada_en, sp.terminada_en, sp.notas,
           t.nombre AS tanque, p.numero AS pano,
           COALESCE(u.nombre, sp.ejecutor_libre) AS quien,
           sp.autorizada_por, sp.motivo_orden,
           (SELECT COUNT(*) FROM sacadas_moldes sm
              JOIN sacadas s ON s.id = sm.sacada_id
             WHERE s.sacada_pano_id = sp.id
               AND ${calidad.alAlmacen('sm')}) AS marquetas,
           (SELECT COUNT(*) FROM sacadas_moldes sm
              JOIN sacadas s ON s.id = sm.sacada_id
             WHERE s.sacada_pano_id = sp.id
               AND ${calidad.salioHielo('sm')}) AS producidas
      FROM sacadas_pano sp
      JOIN panos p   ON p.id = sp.pano_id
      JOIN tanques t ON t.id = p.tanque_id
      LEFT JOIN usuarios u ON u.id = sp.ejecutor_id
     WHERE sp.iniciada_en >= ?
     ORDER BY sp.iniciada_en DESC
  `).all(desde);

  return ok(res, {
    desde, marquetas, merma, mezcla, porObrero, panos,
    calidades: calidad.CALIDADES,
    fuera: canastasFuera().length
  });
});

module.exports = router;
