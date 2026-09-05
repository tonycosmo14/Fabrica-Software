/**
 * PRODUCCIÓN  (v0.4 — modelo real de la fábrica)
 *
 * Cómo trabaja la fábrica de verdad, y por qué el módulo está así:
 *
 *  · LA UNIDAD ES EL PAÑO. Se empieza y se termina completo. Si el operario se
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
 *    quién lo hizo. Los operarios no reportan uno por uno: al final de su
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

/** Un texto de la pantalla, recortado y sin espacios de sobra. Null si viene vacío. */
function texto(v, largo = 300) {
  const t = String(v ?? '').trim();
  return t ? t.slice(0, largo) : null;
}

/** "hace 7 horas", "hace un rato", "hace 2 días" — para decírselo a alguien. */
function fraseHoras(horas) {
  if (horas < 1) return 'hace menos de una hora';
  if (horas < 2) return 'hace una hora';
  if (horas < 36) return `hace ${Math.round(horas)} horas`;
  return `hace ${Math.round(horas / 24)} días`;
}
const vales = require('./vales');
const calidad = require('./calidad');
// El cuarto frío se lee desde aquí para poder enseñarlo en Producción sin
// pedir el permiso de existencia, que el operario no tiene.
const { hieloQueQueda } = require('../existencia/calculo');
const { aTexto } = require('../../lib/fracciones');

const router = express.Router();

const verProduccion = exigirPermiso('produccion.ver');
const registrar = exigirPermiso('produccion.registrar');

const TIPOS_AGUA = ['purificada', 'potable'];

/**
 * Quién lo hizo físicamente: puede ser otro operario distinto de quien captura,
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
    calidadPorOmision: calidad.CALIDAD_POR_OMISION,
    calidadSalio: calidad.SALIO,
    preguntaGrado: calidad.PREGUNTA_GRADO,
    // CUÁNTO HIELO QUEDA EN EL CUARTO FRÍO  (v4.1)
    //
    // Va aquí y no detrás del permiso de existencia a propósito: el operario
    // que saca el hielo es quien más falta le hace saber si el cuarto está
    // vacío, y ese permiso no lo tiene. Es un número para mirar, no para
    // tocar — contar sigue siendo del cajero y del gerente.
    cuartoFrio: conTexto(hieloQueQueda())
  });
});

/** El mismo dato con su texto ya armado: "14 y 5/8". */
function conTexto(h) {
  return h ? { ...h, texto: aTexto(h.dieciseisavos) } : null;
}


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
 * LOS NÚMEROS QUE SIGUEN, para imprimirlos y dárselos a los operarios.
 *
 * Permiso propio, distinto del de autorizar: el cajero es quien está en el
 * mostrador cuando el operario llega a preguntar qué paño toca, y hacerlo
 * esperar a que aparezca un gerente para leerle una lista no tiene sentido.
 * Decidir que se saque uno FUERA de orden sigue siendo del gerente.
 */
router.get('/siguientes', exigirPermiso('produccion.numeros'), (req, res) => {
  return ok(res, numerosASacar(req.usuario.nombre));
});

/** Operarios a los que se les puede atribuir el trabajo. */
router.get('/operarios', verProduccion, (req, res) => {
  // Solo los operarios: sacar paños es su trabajo. Cuando saca alguien más
  // —un eventual, el dueño— su nombre se escribe con la opción "Otro" y se
  // guarda tal cual; darlo de alta como usuario para un día no tiene caso.
  const operarios = bd.prepare(`
    SELECT id, nombre, rol FROM usuarios
     WHERE activo = 1 AND rol = 'operario'
     ORDER BY nombre
  `).all();
  return ok(res, { operarios });
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

  // Las últimas veces que se sacó, de la más nueva a la más vieja.
  //
  // Eran seis, y se quedaron cortas (v6.6): "nos ha pasado que el error
  // aparece hasta que le damos la vuelta completa a ese paño, por lo que
  // tenemos que retroceder en las fechas hasta la última vez que se sacó y
  // modificarlo ahí". Con treinta caben varias vueltas del tanque más
  // grande.
  const sacadas = bd.prepare(`
    SELECT sp.id, sp.iniciada_en, sp.terminada_en, sp.notas, sp.motivo_orden,
           sp.anulada_en, sp.motivo_anulacion,
           sp.corregida_en, sp.motivo_correccion, sp.correcciones,
           COALESCE(u.nombre, sp.ejecutor_libre, '—') AS quien,
           COALESCE(a.nombre, '')                     AS autorizo,
           an.nombre                                  AS anulada_por_nombre,
           co.nombre                                  AS corregida_por_nombre
      FROM sacadas_pano sp
      LEFT JOIN usuarios u  ON u.id = sp.ejecutor_id
      LEFT JOIN usuarios a  ON a.id = sp.autorizada_por
      LEFT JOIN usuarios an ON an.id = sp.anulada_por
      LEFT JOIN usuarios co ON co.id = sp.corregida_por
     WHERE sp.pano_id = ?
     ORDER BY sp.iniciada_en DESC
     LIMIT 30
  `).all(pano.id);

  const cuentaDe = bd.prepare(`
    SELECT ${calidad.columnasMezcla('sm')},
           AVG(s.horas_congelacion) AS horas
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
    // ANULADA: ahora con sus columnas propias, y con QUIÉN la anuló — que
    // era el dato que faltaba: "si no, jamás me voy a enterar" (v4.7).
    const anulada = Boolean(sp.anulada_en);
    return {
      id: sp.id,
      fecha: sp.terminada_en || sp.iniciada_en,
      empezada: sp.iniciada_en,
      terminada: Boolean(sp.terminada_en),
      anulada,
      anuladaEn: sp.anulada_en || null,
      anuladaPor: sp.anulada_por_nombre || null,
      motivoAnulada: sp.motivo_anulacion || null,
      // Si se corrigió cómo salió (v6.1): cuándo, quién y por qué.
      corregidaEn: sp.corregida_en || null,
      corregidaPor: sp.corregida_por_nombre || null,
      motivoCorreccion: sp.motivo_correccion || null,
      notas: sp.notas || null,
      quienes: [...new Set([sp.quien, ...quienesDe.all(sp.id).map((f) => f.nombre)])]
        .filter((n) => n && n !== '—'),
      autorizo: sp.autorizo || null,
      motivoOrden: sp.motivo_orden || null,
      horas: cuenta.horas,
      mezcla: calidad.resumir(cuenta)
    };
  });

  // Molde por molde, cómo salió la última vez. Es lo que se viene a ver
  // cuando un molde aparece marcado en la pantalla.
  const ultima = historial.find((x) => !x.anulada) || null;
  const moldes = ultima ? bd.prepare(`
    SELECT c.numero AS canasta, m.numero AS molde,
           sm.resultado, sm.nota
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
    calidadPorOmision: calidad.CALIDAD_POR_OMISION,
    calidadSalio: calidad.SALIO,
    preguntaGrado: calidad.PREGUNTA_GRADO
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
 *   calidad      cómo salió el paño en general (por omisión, del 80 al 90%)
 *   nota         qué pasó; obligatoria si la calidad es 'otro'
 *   resultados   [{ moldeId, resultado, nota }] los moldes que salieron
 *                distintos del resto del paño
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

  // ============================================================
  // UN PAÑO NO SE SACA DOS VECES EL MISMO DÍA  (v6.6)
  // ============================================================
  //
  // "Un paño no se puede sacar dos veces el mismo día. Es imposible,
  //  simplemente no ha congelado, por lo que desbloquearlo no me lo debe
  //  de contar."
  //
  // Antes, desbloquear un paño ya sacado y volver a capturarlo creaba una
  // sacada NUEVA y sumaba otra vez sus marquetas: el cuarto frío crecía
  // con hielo que no existe, y el error aparecía días después en el
  // conteo. Lo que se quería hacer casi siempre era CORREGIR la sacada de
  // hoy, así que eso es lo que se ofrece en vez del error.
  //
  // Se mide por DÍA y no por horas de congelación a propósito: un paño que
  // se sacó ayer y todavía no cumple sus horas sí se puede sacar —pasa en
  // mayo, cuando el tanque va lento— y para eso está la regla de la
  // rotación, que pide la firma de un responsable. Lo del mismo día no es
  // discutible: el agua no se hizo hielo en seis horas.
  const hoySalio = bd.prepare(`
    SELECT sp.id, sp.terminada_en,
           COALESCE(u.nombre, sp.ejecutor_libre, '—') AS quien
      FROM sacadas_pano sp
      LEFT JOIN usuarios u ON u.id = sp.ejecutor_id
     WHERE sp.pano_id = ? AND sp.anulada_en IS NULL
       AND sp.terminada_en IS NOT NULL
       AND date(sp.terminada_en, 'localtime') = date('now', 'localtime')
     ORDER BY sp.terminada_en DESC LIMIT 1
  `).get(pano.id);

  if (hoySalio) {
    return error(res,
      `El paño ${pano.numero} ya se sacó hoy, y lo reportó ${hoySalio.quien}. ` +
      'No puede volver a salir: el hielo no congela en unas horas. Si lo de ' +
      'esa sacada quedó mal anotado, se corrige ahí mismo, en su historia.',
      409, {
        yaSeSacoHoy: true, sacadaId: hoySalio.id,
        cuando: hoySalio.terminada_en, quien: hoySalio.quien
      });
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
      ? { resultado: req.body.calidad, nota: req.body.nota }
      : { nota: req.body?.nota });

    for (const r of req.body?.resultados || []) {
      // La nota del paño NO se hereda: si un molde salió con otra cosa,
      // lo que pasó ahí no es lo que pasó en el resto.
      marcas.set(r.moldeId, calidad.interpretar(r, { nota: null }));
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
      `INSERT INTO sacadas_moldes (id, sacada_id, molde_id, resultado, nota)
       VALUES (?, ?, ?, ?, ?)`
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
        insertarMolde.run(nuevoId(), sacadaId, m.id, marca.resultado, marca.nota);
        mezcla[marca.resultado]++;
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

  const cuenta = calidad.resumir(mezcla);

  return ok(res, {
    // "marquetas" siguió llamándose así, pero ahora quiere decir lo que de
    // verdad entró al cuarto frío: lo que salió hueco o salado no está ahí,
    // y contarlo descuadraría el conteo.
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
 * El operario llega y dice: "saqué los paños 1, 3 y 5". Se capturan todos de
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
      resultado: req.body?.calidad, nota: req.body?.nota
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
          bd.prepare(`INSERT INTO sacadas_moldes (id, sacada_id, molde_id, resultado, nota)
                      VALUES (?, ?, ?, ?, ?)`)
            .run(nuevoId(), sacadaId, m.id, general, comoSalio.nota);
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
               nota: comoSalio.nota, tipoAgua }
  });

  // Toda la captura salió igual, así que basta con resumir un solo estado
  // repetido tantas veces como moldes se abrieron.
  const cuenta = calidad.resumir({ [general]: producidas });

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
     WHERE pano_id = ? AND anulada_en IS NULL
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
  if (sp.anulada_en) return error(res, 'Ese registro ya está anulado.');

  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) return error(res, 'Escribe por qué se anula.');

  const anular = bd.transaction(() => {
    // Se marca la sacada como anulada y se retiran sus rellenados, dejando
    // el paño como estaba. Los eventos originales NO se borran.
    // La nota del paño NO se toca: si alguien escribió "la grúa se atoró",
    // eso sigue siendo verdad después de anular la sacada.
    bd.prepare(`
      UPDATE sacadas_pano
         SET anulada_en = ?, anulada_por = ?, motivo_anulacion = ?,
             terminada_en = COALESCE(terminada_en, ?)
       WHERE id = ?
    `).run(ahora(), req.usuario.id, motivo, ahora(), sp.id);

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

/**
 * CORREGIR CÓMO SALIÓ UNA SACADA  (v6.1)
 *
 * "Marqué un paño como hueco y era ahogado. Cinco marquetas y media de
 *  diferencia, y el sistema no me dejaba corregirlo después del corte."
 *
 * Anular y volver a sacar no sirve: la rotación ya pasó de ese paño, y la
 * sacada nueva saldría con la fecha de hoy. Lo que se corrige es CÓMO
 * SALIÓ: el estado de todos sus moldes, con su nota. La
 * sacada guarda cuándo se corrigió, quién y por qué, y en la bitácora
 * queda la mezcla de antes y la de después.
 *
 * Y como la razón de corregirlo casi siempre es un corte que salió mal,
 * los conteos de hielo que abarcan esa sacada se vuelven a sacar solos
 * (ver existencia/correccion.js). Lo contado no se toca; lo que "debía
 * haber", sí.
 */
router.post('/sacadas-pano/:id/corregir', exigirPermiso('produccion.corregir'), (req, res) => {
  const sp = bd.prepare(`
    SELECT sp.*, p.numero AS pano_numero, t.nombre AS tanque_nombre
      FROM sacadas_pano sp
      JOIN panos p   ON p.id = sp.pano_id
      JOIN tanques t ON t.id = p.tanque_id
     WHERE sp.id = ?
  `).get(req.params.id);
  if (!sp) return error(res, 'Ese registro no existe.', 404);
  if (sp.anulada_en) return error(res, 'Esa sacada está anulada: no hay nada que corregir.', 409);

  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) return error(res, 'Escribe por qué se corrige. Un registro no se cambia sin razón.');
  if (!req.body?.calidad) return error(res, 'Di cómo salió de verdad.');

  let como;
  try {
    como = calidad.interpretar({
      resultado: req.body.calidad, nota: req.body.nota
    });
  } catch (e) { return error(res, e.message); }

  const cuentaDe = bd.prepare(`
    SELECT ${calidad.columnasMezcla('sm')},
           MIN(s.fecha) AS primera
      FROM sacadas_moldes sm JOIN sacadas s ON s.id = sm.sacada_id
     WHERE s.sacada_pano_id = ?
  `);
  const antesFila = cuentaDe.get(sp.id);
  if (!antesFila.primera) return error(res, 'Esa sacada no tiene moldes registrados.', 409);
  const antes = calidad.resumir(antesFila);

  bd.transaction(() => {
    bd.prepare(`
      UPDATE sacadas_moldes SET resultado = ?, nota = ?
       WHERE sacada_id IN (SELECT id FROM sacadas WHERE sacada_pano_id = ?)
    `).run(como.resultado, como.nota, sp.id);
    bd.prepare(`
      UPDATE sacadas_pano
         SET corregida_en = ?, corregida_por = ?, motivo_correccion = ?,
             correcciones = correcciones + 1
       WHERE id = ?
    `).run(ahora(), req.usuario.id, motivo.slice(0, 200), sp.id);
  })();

  const despuesFila = cuentaDe.get(sp.id);
  const despues = calidad.resumir(despuesFila);

  // Los conteos que ya contaban esa sacada se vuelven a sacar solos.
  const { corregirConteosQueAbarcan } = require('../existencia/correccion');
  const conteos = corregirConteosQueAbarcan(antesFila.primera, {
    usuarioId: req.usuario.id,
    motivo: `Se corrigió cómo salió el paño ${sp.pano_numero}: ${motivo}`
  });

  bitacora.registrar({
    accion: 'produccion.correccion', entidad: 'pano', entidadId: sp.pano_id,
    ejecutorId: req.usuario.id,
    detalle: {
      tanque: sp.tanque_nombre, pano: sp.pano_numero, motivo,
      antes: { alAlmacen: antes.alAlmacen, producidas: antes.producidas },
      ahora: { resultado: como.resultado,
               alAlmacen: despues.alAlmacen, producidas: despues.producidas },
      conteosCorregidos: conteos.length
    }
  });

  return ok(res, {
    corregida: true,
    antes, despues,
    conteos: conteos.map((c) => ({
      id: c.id, cajaId: c.cajaId, fecha: c.fecha,
      faltanteAntes: c.antes.faltante, faltanteAhora: c.ahora.faltante
    }))
  });
});

/**
 * LOS MOLDES DE UNA SACADA CUALQUIERA  (v6.6)
 *
 * La ficha del paño trae el mapa de moldes de la ÚLTIMA vez. Para corregir
 * una de hace tres días hace falta el de aquella, y por eso se pide
 * aparte: es la pantalla de corregir la que sabe cuál eligió el gerente.
 */
router.get('/sacadas-pano/:id/moldes', verProduccion, (req, res) => {
  const sp = bd.prepare(`
    SELECT sp.*, p.numero AS pano_numero, t.nombre AS tanque_nombre,
           COALESCE(u.nombre, sp.ejecutor_libre, '—') AS quien
      FROM sacadas_pano sp
      JOIN panos p   ON p.id = sp.pano_id
      JOIN tanques t ON t.id = p.tanque_id
      LEFT JOIN usuarios u ON u.id = sp.ejecutor_id
     WHERE sp.id = ?
  `).get(req.params.id);
  if (!sp) return error(res, 'Ese registro no existe.', 404);

  const moldes = bd.prepare(`
    SELECT sm.molde_id AS moldeId, c.numero AS canasta, m.numero AS molde,
           sm.resultado, sm.nota, s.fecha
      FROM sacadas_moldes sm
      JOIN sacadas s  ON s.id = sm.sacada_id
      JOIN moldes m   ON m.id = sm.molde_id
      JOIN canastas c ON c.id = m.canasta_id
     WHERE s.sacada_pano_id = ?
     ORDER BY c.numero, m.numero
  `).all(sp.id);

  // Lo que ya se le corrigió antes, para poder enseñarlo.
  const correcciones = bd.prepare(`
    SELECT cm.*, u.nombre AS quien
      FROM correcciones_moldes cm
      LEFT JOIN usuarios u ON u.id = cm.ejecutor_id
     WHERE cm.sacada_pano_id = ?
     ORDER BY cm.fecha DESC
  `).all(sp.id);

  return ok(res, {
    sacada: {
      id: sp.id, pano: sp.pano_numero, tanque: sp.tanque_nombre,
      fecha: sp.terminada_en || sp.iniciada_en, quien: sp.quien,
      anulada: Boolean(sp.anulada_en), correcciones: sp.correcciones
    },
    moldes,
    mezcla: calidad.resumir(cuentaDeMezcla(moldes)),
    correcciones,
    calidades: calidad.CALIDADES,
    calidadPorOmision: calidad.CALIDAD_POR_OMISION,
    calidadSalio: calidad.SALIO,
    preguntaGrado: calidad.PREGUNTA_GRADO
  });
});

/**
 * CORREGIR MOLDE POR MOLDE, EN SU FECHA  (v6.6)
 *
 * "Si aprieto corregir cómo salió y uso uno, me cambia completamente
 *  todas. Y a veces las correcciones son de una canasta o de un molde nada
 *  más. Cuando quiera corregir algo, debería corregirlo en base al
 *  historial de ese paño: yo selecciono el movimiento, la fecha que quiero
 *  corregir, para que se refleje en los cortes de esa fecha."
 *
 * Se entra por la HISTORIA del paño y se elige la sacada por su fecha, así
 * que esto corrige lo de aquel día, no lo de hoy. Dos cosas se pueden
 * hacer, y son muy distintas:
 *
 *   CAMBIAR CÓMO SALIÓ un molde o una canasta — la hueca que era ahogada.
 *   El hielo sí salió; lo que estaba mal era la anotación.
 *
 *   QUITARLO DE LA SACADA — "esa canasta no se sacó". Es el caso del que
 *   reporta el paño completo y deja una canasta adentro para venderla otro
 *   día. Esos moldes NO salieron nunca: su renglón se borra, el rellenado
 *   que se había apuntado se deshace y la canasta vuelve al tanque como
 *   estaba, con su hielo. La producción de aquel día baja, y con ella el
 *   corte de aquel día.
 *
 * Todo queda escrito en `correcciones_moldes`, que solo se agrega: qué
 * decía, qué dice, quién y por qué. Y los conteos de hielo que ya contaban
 * esa sacada se vuelven a sacar solos (existencia/correccion.js): lo
 * contado en el cuarto frío no se toca, lo que "debía haber" sí.
 */
router.post('/sacadas-pano/:id/corregir-moldes', exigirPermiso('produccion.corregir'), (req, res) => {
  const sp = bd.prepare(`
    SELECT sp.*, p.numero AS pano_numero, p.tanque_id, t.nombre AS tanque_nombre
      FROM sacadas_pano sp
      JOIN panos p   ON p.id = sp.pano_id
      JOIN tanques t ON t.id = p.tanque_id
     WHERE sp.id = ?
  `).get(req.params.id);
  if (!sp) return error(res, 'Ese registro no existe.', 404);
  if (sp.anulada_en) return error(res, 'Esa sacada está anulada: no hay nada que corregir.', 409);

  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) return error(res, 'Escribe por qué se corrige. Un registro no se cambia sin razón.');

  // Lo que hay ahora mismo en esa sacada, molde por molde.
  const filas = bd.prepare(`
    SELECT sm.id, sm.molde_id, sm.resultado, sm.nota, sm.sacada_id,
           s.canasta_id, s.fecha, c.numero AS canasta, m.numero AS molde
      FROM sacadas_moldes sm
      JOIN sacadas s  ON s.id = sm.sacada_id
      JOIN moldes m   ON m.id = sm.molde_id
      JOIN canastas c ON c.id = m.canasta_id
     WHERE s.sacada_pano_id = ?
  `).all(sp.id);
  if (!filas.length) return error(res, 'Esa sacada no tiene moldes registrados.', 409);

  const porMolde = new Map(filas.map((f) => [f.molde_id, f]));
  const cambios = Array.isArray(req.body?.cambios) ? req.body.cambios : [];
  const quitar = (Array.isArray(req.body?.quitar) ? req.body.quitar : []).map(String);

  if (!cambios.length && !quitar.length) {
    return error(res, 'No dijiste qué corregir: toca los moldes que salieron distinto.');
  }

  // Se comprueba TODO antes de tocar nada: media corrección aplicada es
  // peor que ninguna.
  const listos = [];
  for (const c of cambios) {
    const fila = porMolde.get(String(c?.moldeId));
    if (!fila) return error(res, 'Uno de esos moldes no es de esta sacada.', 409);
    if (quitar.includes(String(c.moldeId))) {
      return error(res, 'Un molde no se puede cambiar y quitar a la vez.');
    }
    let como;
    try { como = calidad.interpretar({ resultado: c.resultado, nota: c.nota }); }
    catch (e) { return error(res, e.message); }
    listos.push({ fila, como });
  }
  for (const id of quitar) {
    if (!porMolde.has(id)) return error(res, 'Uno de esos moldes no es de esta sacada.', 409);
  }

  const antes = calidad.resumir(cuentaDeMezcla(filas));
  const fecha = ahora();

  bd.transaction(() => {
    const apunte = bd.prepare(`
      INSERT INTO correcciones_moldes
        (id, sacada_pano_id, molde_id, que, antes, antes_nota, despues, despues_nota,
         motivo, fecha, ejecutor_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const { fila, como } of listos) {
      if (fila.resultado === como.resultado && (fila.nota || null) === (como.nota || null)) continue;
      bd.prepare('UPDATE sacadas_moldes SET resultado = ?, nota = ? WHERE id = ?')
        .run(como.resultado, como.nota, fila.id);
      apunte.run(nuevoId(), sp.id, fila.molde_id, 'cambio', fila.resultado, fila.nota,
                 como.resultado, como.nota, motivo.slice(0, 200), fecha, req.usuario.id);
    }

    for (const id of quitar) {
      const fila = porMolde.get(id);
      bd.prepare('DELETE FROM sacadas_moldes WHERE id = ?').run(fila.id);
      apunte.run(nuevoId(), sp.id, fila.molde_id, 'quitado', fila.resultado, fila.nota,
                 null, null, motivo.slice(0, 200), fecha, req.usuario.id);
    }

    // LA CANASTA QUE SE QUEDÓ ADENTRO vuelve al tanque como estaba: sin
    // sacada y sin el rellenado que se había apuntado. Si no se deshiciera
    // el rellenado, el sistema creería que ahí hay agua empezando a
    // congelar cuando lo que hay es el hielo de siempre.
    const vacias = bd.prepare(`
      SELECT s.id, s.canasta_id FROM sacadas s
       WHERE s.sacada_pano_id = ?
         AND NOT EXISTS (SELECT 1 FROM sacadas_moldes sm WHERE sm.sacada_id = s.id)
    `).all(sp.id);
    for (const v of vacias) {
      bd.prepare('DELETE FROM rellenados WHERE sacada_pano_id = ? AND canasta_id = ?')
        .run(sp.id, v.canasta_id);
      bd.prepare('DELETE FROM sacadas WHERE id = ?').run(v.id);
    }

    // Si no quedó ni un molde, esa sacada no ocurrió.
    const quedan = bd.prepare(`
      SELECT COUNT(*) n FROM sacadas_moldes sm
        JOIN sacadas s ON s.id = sm.sacada_id
       WHERE s.sacada_pano_id = ?
    `).get(sp.id).n;
    if (!quedan) {
      bd.prepare(`
        UPDATE sacadas_pano
           SET anulada_en = ?, anulada_por = ?, motivo_anulacion = ?
         WHERE id = ?
      `).run(fecha, req.usuario.id, `No se sacó: ${motivo}`.slice(0, 200), sp.id);
    }

    bd.prepare(`
      UPDATE sacadas_pano
         SET corregida_en = ?, corregida_por = ?, motivo_correccion = ?,
             correcciones = correcciones + 1
       WHERE id = ?
    `).run(fecha, req.usuario.id, motivo.slice(0, 200), sp.id);
  })();

  const quedaron = bd.prepare(`
    SELECT sm.resultado FROM sacadas_moldes sm
      JOIN sacadas s ON s.id = sm.sacada_id
     WHERE s.sacada_pano_id = ?
  `).all(sp.id);
  const despues = calidad.resumir(cuentaDeMezcla(quedaron));

  // Los conteos que ya contaban esa sacada se vuelven a sacar solos.
  const { corregirConteosQueAbarcan } = require('../existencia/correccion');
  const conteos = corregirConteosQueAbarcan(filas[0].fecha, {
    usuarioId: req.usuario.id,
    motivo: `Se corrigió el paño ${sp.pano_numero}: ${motivo}`
  });

  bitacora.registrar({
    accion: 'produccion.correccion', entidad: 'pano', entidadId: sp.pano_id,
    ejecutorId: req.usuario.id,
    detalle: {
      tanque: sp.tanque_nombre, pano: sp.pano_numero, motivo,
      cambiados: listos.length, quitados: quitar.length,
      antes: { alAlmacen: antes.alAlmacen, producidas: antes.producidas },
      ahora: { alAlmacen: despues.alAlmacen, producidas: despues.producidas },
      conteosCorregidos: conteos.length
    }
  });

  return ok(res, {
    corregida: true,
    antes, despues,
    cambiados: listos.length,
    quitados: quitar.length,
    anulada: !quedaron.length,
    conteos: conteos.map((c) => ({
      id: c.id, cajaId: c.cajaId, fecha: c.fecha,
      faltanteAntes: c.antes.faltante, faltanteAhora: c.ahora.faltante
    }))
  });
});

/** Cuenta cuántos moldes de cada estado hay en una lista de renglones. */
function cuentaDeMezcla(filas) {
  const cuenta = Object.fromEntries(calidad.RESULTADOS.map((c) => [c, 0]));
  for (const f of filas) if (cuenta[f.resultado] !== undefined) cuenta[f.resultado]++;
  return cuenta;
}

// ============================================================
// LA REVISIÓN DEL TANQUE  (v6.7)
// ============================================================
//
// Corregir sirve para arreglar; esto sirve para DESCUBRIR. El sistema dice
// qué debería tener cada paño AHORA MISMO —"se sacó hoy a las 6:10, lo
// reportó Chema, debe tener agua"— y se camina el tanque marcando lo que
// de verdad hay. Cada diferencia queda escrita con quién reportó aquella
// sacada, y desde ahí se va a corregirla.

const revisar = exigirPermiso('produccion.revisar');

/** Qué es lo que se espera de cada estado, dicho para una persona. */
const QUE_DEBE_TENER = {
  congelando: { texto: 'agua congelando', ayuda: 'se sacó hace poco y se rellenó' },
  lista:      { texto: 'hielo, listo', ayuda: 'lleva sus horas y no se ha sacado' },
  fuera:      { texto: 'nada: está fuera del tanque', ayuda: 'se sacó y no se rellenó' },
  proceso:    { texto: 'a medias', ayuda: 'se empezó a sacar y no se terminó' }
};

/**
 * La última sacada reportada de cada paño de un tanque: cuál es, cuándo y
 * quién la reportó.
 *
 * Se pregunta aquí y no se toma de `tanqueConEstado`, que resume las horas
 * y los nombres para pintar la lista pero no guarda el id de la sacada — y
 * el id es justo lo que hace falta: es la que se va a ir a corregir.
 */
function ultimasReportadas(tanqueId) {
  const filas = bd.prepare(`
    SELECT sp.pano_id, sp.id, sp.terminada_en,
           COALESCE(u.nombre, sp.ejecutor_libre, '—') AS quien
      FROM sacadas_pano sp
      JOIN panos p ON p.id = sp.pano_id
      LEFT JOIN usuarios u ON u.id = sp.ejecutor_id
     WHERE p.tanque_id = ? AND sp.terminada_en IS NOT NULL AND sp.anulada_en IS NULL
     ORDER BY sp.pano_id, sp.terminada_en DESC
  `).all(tanqueId);
  const mapa = new Map();
  for (const f of filas) if (!mapa.has(f.pano_id)) mapa.set(f.pano_id, f);
  return mapa;
}

/** Lo que el sistema dice que debería haber en cada paño, para ir a verlo. */
router.get('/revision', revisar, (req, res) => {
  const tanqueId = req.query.tanque
    || bd.prepare('SELECT id FROM tanques WHERE activo = 1 ORDER BY orden LIMIT 1').get()?.id;
  const tanque = tanqueId ? tanqueConEstado(tanqueId) : null;
  if (!tanque) return error(res, 'Ese tanque no existe.', 404);

  const ultimas = ultimasReportadas(tanque.id);
  const hoy = new Date().toISOString().slice(0, 10);
  const panos = tanque.panos.map((p) => {
    // La sacada que quedaría en entredicho si el paño tiene hielo: la
    // última que se reportó.
    const u = ultimas.get(p.id) || null;
    return {
      id: p.id,
      numero: p.numero,
      esperado: p.estado,
      debeTener: QUE_DEBE_TENER[p.estado] || QUE_DEBE_TENER.lista,
      horas: p.horas == null ? null : Math.round(p.horas),
      ultimaSacada: u
        ? { id: u.id, fecha: u.terminada_en, quien: u.quien,
            hoy: String(u.terminada_en).slice(0, 10) === hoy }
        : null
    };
  });

  return ok(res, {
    tanques: bd.prepare('SELECT id, nombre FROM tanques WHERE activo = 1 ORDER BY orden').all(),
    tanque: { id: tanque.id, nombre: tanque.nombre },
    panos,
    ultima: bd.prepare(`
      SELECT r.*, u.nombre AS quien FROM revisiones_tanque r
        LEFT JOIN usuarios u ON u.id = r.ejecutor_id
       WHERE r.tanque_id = ? ORDER BY r.fecha DESC LIMIT 1
    `).get(tanque.id) || null
  });
});

/**
 * Guarda la vuelta al tanque.
 *
 * Cuerpo: { tanqueId, notas, panos: [{ panoId, encontrado, notas }] }
 *
 * Se guarda TODA la vuelta, no solo lo que no cuadró: "se revisaron los 18
 * y cuadraron 17" es un dato, y "solo se revisó uno" es otro muy distinto.
 */
router.post('/revision', revisar, (req, res) => {
  const tanque = bd.prepare('SELECT * FROM tanques WHERE id = ? AND activo = 1')
    .get(req.body?.tanqueId ?? null);
  if (!tanque) return error(res, 'Ese tanque no existe.', 404);

  const marcados = Array.isArray(req.body?.panos) ? req.body.panos : [];
  if (!marcados.length) return error(res, 'No se revisó ningún paño.');

  const estado = tanqueConEstado(tanque.id);
  const porId = new Map(estado.panos.map((p) => [p.id, p]));
  const ultimas = ultimasReportadas(tanque.id);
  const VALIDOS = ['cuadra', 'con_hielo', 'con_agua', 'vacio'];

  const filas = [];
  for (const m of marcados) {
    const pano = porId.get(String(m?.panoId));
    if (!pano) return error(res, 'Uno de esos paños no es de este tanque.', 409);
    const encontrado = String(m?.encontrado || '');
    if (!VALIDOS.includes(encontrado)) return error(res, 'Esa respuesta no existe.');
    filas.push({ pano, encontrado, notas: texto(m?.notas, 300) });
  }

  const diferencias = filas.filter((f) => f.encontrado !== 'cuadra');
  const id = nuevoId();
  const fecha = ahora();

  bd.transaction(() => {
    bd.prepare(`
      INSERT INTO revisiones_tanque (id, tanque_id, fecha, ejecutor_id, notas, panos, diferencias)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, tanque.id, fecha, req.usuario.id, texto(req.body?.notas, 500),
           filas.length, diferencias.length);

    const meter = bd.prepare(`
      INSERT INTO revisiones_panos
        (id, revision_id, pano_id, esperado, encontrado, sacada_pano_id, reporto, reportado_en, notas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const f of filas) {
      const u = ultimas.get(f.pano.id) || null;
      meter.run(nuevoId(), id, f.pano.id, f.pano.estado, f.encontrado,
                u?.id ?? null, u?.quien ?? null, u?.terminada_en ?? null, f.notas);
    }
  })();

  bitacora.registrar({
    accion: diferencias.length ? 'produccion.revision_no_cuadra' : 'produccion.revision',
    entidad: 'tanque', entidadId: tanque.id, ejecutorId: req.usuario.id,
    detalle: {
      tanque: tanque.nombre, panos: filas.length, diferencias: diferencias.length,
      cuales: diferencias.map((f) => ({
        pano: f.pano.numero, esperado: f.pano.estado, encontrado: f.encontrado,
        reporto: ultimas.get(f.pano.id)?.quien || null
      }))
    }
  });

  return ok(res, { revision: detalleRevision(id) }, 201);
});

/** Las vueltas que se han dado, de la más nueva a la más vieja. */
router.get('/revisiones', revisar, (req, res) => {
  const filas = bd.prepare(`
    SELECT r.*, t.nombre AS tanque, u.nombre AS quien
      FROM revisiones_tanque r
      JOIN tanques t ON t.id = r.tanque_id
      LEFT JOIN usuarios u ON u.id = r.ejecutor_id
     ORDER BY r.fecha DESC LIMIT 40
  `).all();
  return ok(res, { revisiones: filas.map((f) => detalleRevision(f.id, f)) });
});

function detalleRevision(id, cabeza = null) {
  const r = cabeza || bd.prepare(`
    SELECT r.*, t.nombre AS tanque, u.nombre AS quien
      FROM revisiones_tanque r
      JOIN tanques t ON t.id = r.tanque_id
      LEFT JOIN usuarios u ON u.id = r.ejecutor_id
     WHERE r.id = ?
  `).get(id);
  if (!r) return null;
  return {
    ...r,
    // Solo lo que NO cuadró: los que cuadraron ya están contados arriba, y
    // una lista de dieciocho "todo bien" no la lee nadie.
    problemas: bd.prepare(`
      SELECT rp.*, p.numero AS pano
        FROM revisiones_panos rp
        JOIN panos p ON p.id = rp.pano_id
       WHERE rp.revision_id = ? AND rp.encontrado <> 'cuadra'
       ORDER BY p.numero
    `).all(r.id)
  };
}

// ============================================================
// LO DE HOY
// ============================================================

router.get('/hoy', verProduccion, (req, res) => {
  const desde = req.query.desde || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  // La mezcla del día en una sola pasada: cuántas de cada estado, y
  // cuántas cáscaras se guardaron en vez de irse a los condensadores.
  const cuenta = bd.prepare(`
    SELECT ${calidad.columnasMezcla('sm')}
      FROM sacadas_moldes sm
      JOIN sacadas s ON s.id = sm.sacada_id
     WHERE s.fecha >= ?
  `).get(desde);

  const mezcla = calidad.resumir(cuenta);
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
