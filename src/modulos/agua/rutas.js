/**
 * LA PLANTA DE AGUA — la API  (v5.2)
 *
 * Dos cosas que valen para todo el archivo:
 *
 * LAS LECTURAS NO SE EDITAN, SE ANULAN (regla 3.2 y 3.4). Una lectura es
 * lo que marcaba el aparato ese día, y eso no cambia. Si se anotó mal se
 * anula con su motivo y se toma otra: así el historial dice la verdad,
 * incluida la de que alguien se equivocó.
 *
 * QUIÉN PUEDE QUÉ. Tomar la lectura y reportar una falla es trabajo de
 * turno: el operario da la vuelta con el medidor de TDS en la mano. Poner
 * y quitar equipos, capturar lo que costó una membrana y mover los
 * límites no lo es — eso es del administrador.
 */
const express = require('express');
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');
const { ok, error } = require('../../lib/respuestas');
const { exigirPermiso } = require('../../middleware/sesion');
const { leerPesos } = require('../../lib/dinero');
const bitacora = require('../../lib/bitacora');
const calculo = require('./calculo');

const router = express.Router();

const ver = exigirPermiso('agua.ver');
const anotar = exigirPermiso('agua.anotar');
const administrar = exigirPermiso('agua.administrar');

const texto = (v, largo = 300) => {
  const t = String(v ?? '').trim();
  return t ? t.slice(0, largo) : null;
};

/** Un importe de pesos a centavos, o null si viene vacío. */
function centavos(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = leerPesos(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

/**
 * Un número medido, o null si no se midió.
 *
 * Vacío es vacío y cero es cero: son cosas distintas y aquí la diferencia
 * importa más que en ningún otro lado. "Cloro: 0" quiere decir que se
 * midió y salió limpio —que es la buena noticia del día—; "cloro: vacío"
 * quiere decir que nadie lo midió. Confundirlos daría por bueno un
 * carbón saturado.
 */
function medida(v, tope) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > tope) return undefined;   // mal escrito
  return Math.round(n * 100) / 100;
}

/** Un entero positivo, o null si viene vacío; undefined si está mal. */
function entero(v, tope) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > tope) return undefined;
  return n;
}

// ============================================================
// LA PLANTA
// ============================================================

router.get('/', ver, (req, res) => ok(res, {
  equipos: calculo.planta({ verBaja: req.query.baja === '1' }),
  pendientes: calculo.pendientes(),
  tendencia: calculo.tendencia(30),
  tipos: calculo.TIPOS,
  estados: calculo.ESTADOS,
  servicios: calculo.SERVICIOS
}));

/**
 * EL CUADRE DEL AGUA. Va antes que /:id por la misma razón que los
 * ajustes de las neveras: Express prueba en orden, y "cuadre" habría
 * entrado como el id de un equipo.
 */
router.get('/cuadre', ver, (req, res) => {
  const hasta = texto(req.query.hasta, 10) || calculo.hoy();
  const desde = texto(req.query.desde, 10)
    || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  return ok(res, { cuadre: calculo.elAgua(desde, hasta) });
});

router.get('/lecturas', ver, (req, res) => ok(res, {
  lecturas: calculo.lecturas({
    desde: texto(req.query.desde, 10),
    hasta: texto(req.query.hasta, 10),
    limite: Math.min(Number(req.query.limite) || 60, 500)
  }),
  ajustes: calculo.ajustes()
}));

router.put('/ajustes', administrar, (req, res) => {
  const guardar = (clave, valor) => bd.prepare(`
    INSERT INTO configuracion (clave, valor, actualizado_en, actualizado_por)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor,
      actualizado_en = excluded.actualizado_en, actualizado_por = excluded.actualizado_por
  `).run(clave, String(valor), ahora(), req.usuario.id);

  const campos = [
    ['agua_tds_maximo', req.body?.tdsMaximo, 5000],
    ['agua_rechazo_minimo', req.body?.rechazoMinimo, 100],
    ['agua_dureza_maxima', req.body?.durezaMaxima, 5000],
    ['agua_dias_sin_lectura', req.body?.diasSinLectura, 365],
    ['agua_litros_marqueta', req.body?.litrosMarqueta, 1000]
  ];
  for (const [clave, valor, tope] of campos) {
    if (valor === undefined || valor === null || valor === '') continue;
    const n = Number(valor);
    if (!Number.isFinite(n) || n < 0 || n > tope) {
      return error(res, 'Alguno de los límites no se entiende.');
    }
    guardar(clave, n);
  }

  bitacora.registrar({
    accion: 'agua.ajustes', entidad: 'configuracion', entidadId: 'agua',
    ejecutorId: req.usuario.id, detalle: calculo.ajustes()
  });
  return ok(res, { ajustes: calculo.ajustes() });
});

// ============================================================
// LAS LECTURAS
// ============================================================

/**
 * ANOTAR UNA VUELTA DE REVISIÓN.
 *
 * Se exige al menos UN dato: una lectura con todo vacío no es una
 * lectura, es un renglón que después nadie sabe qué quiso decir.
 */
router.post('/lecturas', anotar, (req, res) => {
  const campos = {
    tds_entrada: entero(req.body?.tdsEntrada, 100000),
    tds_salida: entero(req.body?.tdsSalida, 100000),
    litros_entrada: entero(req.body?.litrosEntrada, 2000000000),
    litros_salida: entero(req.body?.litrosSalida, 2000000000),
    cloro: medida(req.body?.cloro, 100),
    dureza: medida(req.body?.dureza, 5000),
    presion: medida(req.body?.presion, 500)
  };

  for (const [k, v] of Object.entries(campos)) {
    if (v === undefined) return error(res, `El valor de ${k.replace('_', ' ')} no se entiende.`);
  }
  if (Object.values(campos).every((v) => v === null)) {
    return error(res, 'Anota al menos una medición.');
  }

  // EL AGUA NO SE PURIFICA AL REVÉS. Si la salida trae más sales que la
  // entrada, o se cambiaron las dos sondas de lugar o se anotó al revés;
  // guardarlo daría un rechazo negativo y el aviso se dispararía solo.
  if (campos.tds_entrada != null && campos.tds_salida != null
      && campos.tds_salida > campos.tds_entrada) {
    return error(res, 'El TDS de salida no puede ser mayor que el de entrada. '
      + '¿Están al revés?');
  }

  const id = nuevoId();
  const fecha = ahora();
  bd.prepare(`
    INSERT INTO agua_lecturas (id, fecha, tds_entrada, tds_salida, litros_entrada,
                               litros_salida, cloro, dureza, presion, notas,
                               ejecutor_id, capturista_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, fecha, campos.tds_entrada, campos.tds_salida, campos.litros_entrada,
         campos.litros_salida, campos.cloro, campos.dureza, campos.presion,
         texto(req.body?.notas, 500),
         req.body?.ejecutorId || req.usuario.id, req.usuario.id);

  const ultima = calculo.ultimaLectura();

  bitacora.registrar({
    accion: 'agua.lectura', entidad: 'agua', entidadId: id,
    ejecutorId: req.body?.ejecutorId || req.usuario.id,
    capturistaId: req.usuario.id,
    detalle: {
      tdsEntrada: campos.tds_entrada, tdsSalida: campos.tds_salida,
      rechazo: ultima?.rechazo, cloro: campos.cloro, dureza: campos.dureza
    }
  });

  return ok(res, { lectura: ultima, pendientes: calculo.pendientes() }, 201);
});

router.post('/lecturas/:id/anular', administrar, (req, res) => {
  const l = bd.prepare('SELECT * FROM agua_lecturas WHERE id = ?').get(req.params.id);
  if (!l) return error(res, 'Esa lectura no existe.', 404);
  if (l.anulado_en) return error(res, 'Esa lectura ya estaba anulada.');

  const motivo = texto(req.body?.motivo, 300);
  if (!motivo) return error(res, 'Escribe por qué se anula.');

  bd.prepare(`
    UPDATE agua_lecturas SET anulado_en = ?, anulado_por = ?, motivo_anulacion = ?
     WHERE id = ?
  `).run(ahora(), req.usuario.id, motivo, l.id);

  bitacora.registrar({
    accion: 'agua.lectura.anulada', entidad: 'agua', entidadId: l.id,
    ejecutorId: req.usuario.id, detalle: { motivo, fecha: l.fecha }
  });
  return ok(res, { pendientes: calculo.pendientes() });
});

// ============================================================
// LOS EQUIPOS
// ============================================================

/** Lo que se puede escribir de un equipo, revisado. */
function datosDeEquipo(cuerpo, previo = null) {
  const nombre = texto(cuerpo?.nombre, 120) || previo?.nombre;
  if (!nombre) return { problema: 'Ponle nombre al equipo.' };

  const tipo = Object.keys(calculo.TIPOS).includes(cuerpo?.tipo)
    ? cuerpo.tipo : (previo?.tipo || 'otro');

  const orden = entero(cuerpo?.orden, 9999);
  if (orden === undefined) return { problema: 'El orden se escribe con números.' };

  const vidaDias = entero(cuerpo?.vidaDias, 36500);
  if (vidaDias === undefined) return { problema: 'La vida en días se escribe con números.' };
  const vidaLitros = entero(cuerpo?.vidaLitros, 2000000000);
  if (vidaLitros === undefined) return { problema: 'La vida en litros se escribe con números.' };

  return {
    datos: {
      nombre, tipo,
      orden: orden ?? previo?.orden ?? 0,
      capacidad: texto(cuerpo?.capacidad, 60)
        ?? (cuerpo?.capacidad === '' ? null : previo?.capacidad ?? null),
      vida_dias: vidaDias ?? (cuerpo?.vidaDias === '' ? null : previo?.vida_dias ?? null),
      vida_litros: vidaLitros ?? (cuerpo?.vidaLitros === '' ? null : previo?.vida_litros ?? null),
      notas: texto(cuerpo?.notas, 500) ?? (cuerpo?.notas === '' ? null : previo?.notas ?? null)
    }
  };
}

router.post('/equipos', administrar, (req, res) => {
  const { datos, problema } = datosDeEquipo(req.body);
  if (problema) return error(res, problema);

  const id = nuevoId();
  bd.prepare(`
    INSERT INTO agua_equipos (id, orden, tipo, nombre, capacidad, vida_dias,
                              vida_litros, notas, estado, activo, fecha_alta, creado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'trabajando', 1, ?, ?)
  `).run(id, datos.orden, datos.tipo, datos.nombre, datos.capacidad,
         datos.vida_dias, datos.vida_litros, datos.notas, ahora(), req.usuario.id);

  bitacora.registrar({
    accion: 'agua.equipo.alta', entidad: 'agua', entidadId: id,
    ejecutorId: req.usuario.id, detalle: { nombre: datos.nombre, tipo: datos.tipo }
  });
  return ok(res, { equipo: calculo.completo(id) }, 201);
});

router.get('/:id', ver, (req, res) => {
  const e = calculo.completo(req.params.id);
  if (!e) return error(res, 'Ese equipo no existe.', 404);
  return ok(res, {
    equipo: e,
    piezas: calculo.piezasDe(e.id),
    servicios: calculo.serviciosDe(e.id)
  });
});

router.put('/:id', administrar, (req, res) => {
  const e = bd.prepare('SELECT * FROM agua_equipos WHERE id = ?').get(req.params.id);
  if (!e) return error(res, 'Ese equipo no existe.', 404);

  const { datos, problema } = datosDeEquipo(req.body, e);
  if (problema) return error(res, problema);

  bd.prepare(`
    UPDATE agua_equipos SET nombre = ?, tipo = ?, orden = ?, capacidad = ?,
                            vida_dias = ?, vida_litros = ?, notas = ?
     WHERE id = ?
  `).run(datos.nombre, datos.tipo, datos.orden, datos.capacidad,
         datos.vida_dias, datos.vida_litros, datos.notas, e.id);

  bitacora.registrar({
    accion: 'agua.equipo.editado', entidad: 'agua', entidadId: e.id,
    ejecutorId: req.usuario.id, detalle: { antes: e.nombre, ahora: datos.nombre }
  });
  return ok(res, { equipo: calculo.completo(e.id) });
});

router.put('/:id/estado', administrar, (req, res) => {
  const e = bd.prepare('SELECT * FROM agua_equipos WHERE id = ?').get(req.params.id);
  if (!e) return error(res, 'Ese equipo no existe.', 404);

  const estado = ['trabajando', 'reparacion'].includes(req.body?.estado)
    ? req.body.estado : null;
  if (!estado) return error(res, 'Ese estado no existe.');

  bd.prepare('UPDATE agua_equipos SET estado = ? WHERE id = ?').run(estado, e.id);
  bitacora.registrar({
    accion: 'agua.equipo.estado', entidad: 'agua', entidadId: e.id,
    ejecutorId: req.usuario.id, detalle: { nombre: e.nombre, antes: e.estado, ahora: estado }
  });
  return ok(res, { equipo: calculo.completo(e.id) });
});

/** Darlo de baja: se queda con toda su historia (regla 3.4). */
router.post('/:id/baja', administrar, (req, res) => {
  const e = bd.prepare('SELECT * FROM agua_equipos WHERE id = ?').get(req.params.id);
  if (!e) return error(res, 'Ese equipo no existe.', 404);
  if (e.estado === 'baja') return error(res, 'Ese equipo ya está de baja.');

  const motivo = texto(req.body?.motivo, 300);
  if (!motivo) return error(res, 'Escribe por qué se da de baja.');

  bd.prepare(`
    UPDATE agua_equipos SET estado = 'baja', activo = 0, baja_en = ?, baja_por = ?,
                            motivo_baja = ?
     WHERE id = ?
  `).run(ahora(), req.usuario.id, motivo, e.id);

  bitacora.registrar({
    accion: 'agua.equipo.baja', entidad: 'agua', entidadId: e.id,
    ejecutorId: req.usuario.id, detalle: { nombre: e.nombre, motivo }
  });
  return ok(res, { equipo: calculo.completo(e.id) });
});

// ============================================================
// LAS PIEZAS
// ============================================================

/**
 * PONER UNA PIEZA NUEVA.
 *
 * Cambiar una membrana son dos cosas a la vez: se quita la vieja y se
 * pone la nueva. Se hacen juntas y en una sola transacción, porque un
 * equipo con dos piezas puestas al mismo tiempo no existe en la realidad
 * y no debe existir aquí tampoco.
 *
 * Y se anota LO QUE MARCABA EL MEDIDOR al ponerla: sin eso, "le quedan
 * treinta mil litros" no se puede calcular nunca.
 */
router.post('/:id/piezas', administrar, (req, res) => {
  const e = bd.prepare('SELECT * FROM agua_equipos WHERE id = ?').get(req.params.id);
  if (!e) return error(res, 'Ese equipo no existe.', 404);
  if (e.estado === 'baja') return error(res, 'Ese equipo está dado de baja.');

  const costo = centavos(req.body?.costo);
  const litros = entero(req.body?.litros, 2000000000);
  if (litros === undefined) return error(res, 'Los litros del medidor se escriben con números.');

  const motivo = ['vida', 'falla', 'preventivo', 'otro'].includes(req.body?.motivo)
    ? req.body.motivo : 'vida';

  const vieja = calculo.piezaDe(e.id);
  const id = nuevoId();
  const fecha = ahora();

  bd.transaction(() => {
    if (vieja) {
      bd.prepare('UPDATE agua_piezas SET quitada_en = ?, motivo_quitada = ? WHERE id = ?')
        .run(fecha, motivo, vieja.id);
    }
    bd.prepare(`
      INSERT INTO agua_piezas (id, equipo_id, nombre, marca, modelo, serie,
                               costo_centavos, puesta_en, litros_al_poner, notas,
                               capturista_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, e.id, texto(req.body?.nombre, 120), texto(req.body?.marca, 80),
           texto(req.body?.modelo, 80), texto(req.body?.serie, 80), costo,
           texto(req.body?.puestaEn, 10) || calculo.hoy(),
           litros ?? calculo.litrosHoy(), texto(req.body?.notas, 500), req.usuario.id);

    // Cambiar la pieza deja el equipo trabajando: es lo que se acaba de
    // arreglar. Si sigue mal, se vuelve a marcar a mano.
    if (e.estado === 'reparacion') {
      bd.prepare("UPDATE agua_equipos SET estado = 'trabajando' WHERE id = ?").run(e.id);
    }
  })();

  bitacora.registrar({
    accion: 'agua.pieza.cambiada', entidad: 'agua', entidadId: e.id,
    ejecutorId: req.usuario.id,
    detalle: { equipo: e.nombre, marca: texto(req.body?.marca, 80), motivo, costo }
  });
  return ok(res, { equipo: calculo.completo(e.id), piezas: calculo.piezasDe(e.id) }, 201);
});

router.post('/piezas/:id/anular', administrar, (req, res) => {
  const p = bd.prepare('SELECT * FROM agua_piezas WHERE id = ?').get(req.params.id);
  if (!p) return error(res, 'Esa pieza no existe.', 404);
  if (p.anulado_en) return error(res, 'Esa pieza ya estaba anulada.');

  bd.prepare('UPDATE agua_piezas SET anulado_en = ?, anulado_por = ? WHERE id = ?')
    .run(ahora(), req.usuario.id, p.id);

  bitacora.registrar({
    accion: 'agua.pieza.anulada', entidad: 'agua', entidadId: p.equipo_id,
    ejecutorId: req.usuario.id, detalle: { motivo: texto(req.body?.motivo, 300) }
  });
  return ok(res, { equipo: calculo.completo(p.equipo_id), piezas: calculo.piezasDe(p.equipo_id) });
});

// ============================================================
// LOS SERVICIOS
// ============================================================

/**
 * REPORTAR ALGO. Lo puede hacer quien da la vuelta, no solo el
 * administrador: la falla se ve cuando se ve.
 *
 * Una FALLA deja el equipo marcado para que nadie lo dé por bueno. Un
 * retrolavado o una regeneración no: son trabajo normal y el equipo
 * sigue trabajando.
 */
router.post('/:id/servicios', anotar, (req, res) => {
  const e = bd.prepare('SELECT * FROM agua_equipos WHERE id = ?').get(req.params.id);
  if (!e) return error(res, 'Ese equipo no existe.', 404);

  const queTiene = texto(req.body?.queTiene, 500);
  if (!queTiene) return error(res, 'Escribe qué pasó o qué se hizo.');

  const tipo = Object.keys(calculo.SERVICIOS).includes(req.body?.tipo)
    ? req.body.tipo : 'falla';

  const id = nuevoId();
  const fecha = ahora();

  // Un retrolavado o una regeneración se anotan YA HECHOS: nadie
  // "reporta" un retrolavado y espera a que alguien vaya. Una falla sí
  // queda pendiente hasta que alguien la atienda.
  const yaHecho = ['retrolavado', 'regeneracion', 'sanitizacion', 'preventivo']
    .includes(tipo);

  bd.transaction(() => {
    bd.prepare(`
      INSERT INTO agua_servicios (id, equipo_id, tipo, reportado_en, reportado_por,
                                  quien_reporto, que_tiene, atendido_en, atendido_por,
                                  que_se_hizo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, e.id, tipo, fecha, req.usuario.id, texto(req.body?.quienReporto, 120),
           queTiene, yaHecho ? fecha : null, yaHecho ? req.usuario.id : null,
           yaHecho ? queTiene : null);

    if (tipo === 'falla' && e.estado === 'trabajando') {
      bd.prepare("UPDATE agua_equipos SET estado = 'reparacion' WHERE id = ?").run(e.id);
    }
  })();

  bitacora.registrar({
    accion: tipo === 'falla' ? 'agua.falla' : 'agua.servicio',
    entidad: 'agua', entidadId: e.id, ejecutorId: req.usuario.id,
    detalle: { equipo: e.nombre, tipo, queTiene }
  });
  return ok(res, { equipo: calculo.completo(e.id), servicios: calculo.serviciosDe(e.id) }, 201);
});

router.post('/servicios/:id/atender', administrar, (req, res) => {
  const s = bd.prepare('SELECT * FROM agua_servicios WHERE id = ?').get(req.params.id);
  if (!s) return error(res, 'Ese servicio no existe.', 404);
  if (s.anulado_en) return error(res, 'Ese servicio está anulado.');
  if (s.atendido_en) return error(res, 'Ese ya estaba atendido.');

  const queSeHizo = texto(req.body?.queSeHizo, 500);
  if (!queSeHizo) return error(res, 'Escribe qué se hizo.');

  bd.transaction(() => {
    bd.prepare(`
      UPDATE agua_servicios SET atendido_en = ?, atendido_por = ?, quien_atendio = ?,
                                que_se_hizo = ?, costo_centavos = ?
       WHERE id = ?
    `).run(ahora(), req.usuario.id, texto(req.body?.quienAtendio, 120),
           queSeHizo, centavos(req.body?.costo), s.id);

    // Si ya no le queda nada pendiente, el equipo vuelve a trabajar.
    if (s.equipo_id && !calculo.pendientesDe(s.equipo_id).length) {
      bd.prepare(`
        UPDATE agua_equipos SET estado = 'trabajando'
         WHERE id = ? AND estado = 'reparacion'
      `).run(s.equipo_id);
    }
  })();

  bitacora.registrar({
    accion: 'agua.servicio.atendido', entidad: 'agua', entidadId: s.equipo_id,
    ejecutorId: req.usuario.id, detalle: { queSeHizo, costo: centavos(req.body?.costo) }
  });
  return ok(res, {
    equipo: s.equipo_id ? calculo.completo(s.equipo_id) : null,
    servicios: s.equipo_id ? calculo.serviciosDe(s.equipo_id) : []
  });
});

router.post('/servicios/:id/anular', administrar, (req, res) => {
  const s = bd.prepare('SELECT * FROM agua_servicios WHERE id = ?').get(req.params.id);
  if (!s) return error(res, 'Ese servicio no existe.', 404);
  if (s.anulado_en) return error(res, 'Ese servicio ya estaba anulado.');

  const motivo = texto(req.body?.motivo, 300);
  if (!motivo) return error(res, 'Escribe por qué se anula.');

  bd.transaction(() => {
    bd.prepare(`
      UPDATE agua_servicios SET anulado_en = ?, anulado_por = ?, motivo_anulacion = ?
       WHERE id = ?
    `).run(ahora(), req.usuario.id, motivo, s.id);

    if (s.equipo_id && !calculo.pendientesDe(s.equipo_id).length) {
      bd.prepare(`
        UPDATE agua_equipos SET estado = 'trabajando'
         WHERE id = ? AND estado = 'reparacion'
      `).run(s.equipo_id);
    }
  })();

  bitacora.registrar({
    accion: 'agua.servicio.anulado', entidad: 'agua', entidadId: s.equipo_id,
    ejecutorId: req.usuario.id, detalle: { motivo }
  });
  return ok(res, {
    equipo: s.equipo_id ? calculo.completo(s.equipo_id) : null,
    servicios: s.equipo_id ? calculo.serviciosDe(s.equipo_id) : []
  });
});

module.exports = router;
