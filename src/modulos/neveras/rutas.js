/**
 * LAS NEVERAS EN COMODATO — la API  (v5.1)
 *
 * Dos cosas que se repiten en todo este archivo y conviene decir una vez:
 *
 * EL ESTADO DE LA NEVERA LO MANDA EL COMODATO, no la mano. Cuando se
 * presta, la nevera pasa a `prestada` sola; cuando se devuelve, vuelve a
 * `bodega`. Dejar que alguien ponga "en bodega" una nevera que sigue con
 * un cliente sería tener dos verdades sobre lo mismo, y la que se mira en
 * la lista sería la equivocada.
 *
 * NADA SE BORRA (regla 3.4). Una nevera de baja se queda con su historia
 * entera; un servicio se anula con su motivo; un comodato se cierra con
 * la fecha en que volvió y por qué.
 */
const express = require('express');
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');
const { ok, error } = require('../../lib/respuestas');
const { exigirPermiso } = require('../../middleware/sesion');
const { leerPesos } = require('../../lib/dinero');
const bitacora = require('../../lib/bitacora');
const archivos = require('../empresa/archivos');
const calculo = require('./calculo');
const documento = require('./documento');

const router = express.Router();

const ver = exigirPermiso('neveras.ver');
const administrar = exigirPermiso('neveras.administrar');

const texto = (v, largo = 200) => {
  const t = String(v ?? '').trim();
  return t ? t.slice(0, largo) : null;
};

/** Un número de pesos a centavos, o null si viene vacío. */
function centavos(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = leerPesos(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

/** Una coordenada creíble, o null. Fuera del planeta no se guarda. */
function coordenada(v, tope) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= tope ? n : null;
}

/**
 * ACOMODA EL ESTADO DE LA NEVERA A LO QUE DICEN SUS PAPELES.
 *
 * Se llama después de cada cosa que puede cambiarlo. Los estados que puso
 * una persona a propósito —de baja, perdida, por reparar— NO se pisan:
 * una nevera que se marcó como perdida sigue perdida aunque tenga un
 * comodato abierto, porque justamente eso es lo que pasó.
 */
function acomodarEstado(neveraId) {
  const n = bd.prepare('SELECT estado FROM neveras WHERE id = ?').get(neveraId);
  if (!n || ['baja', 'perdida', 'reparacion'].includes(n.estado)) return;

  const vigente = calculo.comodatoVigente(neveraId);
  const nuevo = !vigente ? 'bodega' : (vigente.tipo === 'fabrica' ? 'en_uso' : 'prestada');
  if (nuevo !== n.estado) {
    bd.prepare('UPDATE neveras SET estado = ? WHERE id = ?').run(nuevo, neveraId);
  }
}

// ============================================================
// LA LISTA
// ============================================================

router.get('/', ver, (req, res) => {
  const incluirBaja = req.query.baja === '1';
  return ok(res, {
    neveras: calculo.lista({ incluirBaja }),
    porEstado: calculo.porEstado(),
    pendientes: calculo.pendientesDeTodas(),
    diasAviso: calculo.diasAvisoGeneral(),
    mensajeWhatsapp: bd.prepare(
      "SELECT valor FROM configuracion WHERE clave = 'nevera_mensaje_whatsapp'").get()?.valor || '',
    estados: calculo.ESTADOS
  });
});

router.get('/:id', ver, (req, res) => {
  const n = calculo.completa(req.params.id);
  if (!n) return error(res, 'Esa nevera no existe.', 404);
  return ok(res, { nevera: n });
});

// ============================================================
// LOS AJUSTES
//
// VAN ANTES QUE LAS RUTAS CON /:id, Y NO ES CAPRICHO. Express prueba las
// rutas en el orden en que se escriben: con `PUT /:id` declarado arriba,
// un `PUT /neveras/ajustes` entraba ahí con el id "ajustes" y contestaba
// "esa nevera no existe" — o peor, en otro caso habría editado una.
// ============================================================

router.put('/ajustes', administrar, (req, res) => {
  const guardar = (clave, valor) => bd.prepare(`
    INSERT INTO configuracion (clave, valor, actualizado_en, actualizado_por)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor,
      actualizado_en = excluded.actualizado_en, actualizado_por = excluded.actualizado_por
  `).run(clave, String(valor), ahora(), req.usuario.id);

  if (req.body?.diasAviso !== undefined) {
    const n = Number(req.body.diasAviso);
    if (!Number.isInteger(n) || n < 1 || n > 365) return error(res, 'Esos días no se entienden.');
    guardar('nevera_dias_aviso', n);
  }
  if (req.body?.mensajeWhatsapp !== undefined) {
    guardar('nevera_mensaje_whatsapp', String(req.body.mensajeWhatsapp).slice(0, 600));
  }
  return ok(res, { guardado: true });
});

// ============================================================
// EL ALTA Y LA EDICIÓN
// ============================================================

function datosDeNevera(cuerpo, anterior = null) {
  const numero = texto(cuerpo?.numero, 20);
  if (!numero) return { problema: 'La nevera necesita su número, el que va pegado en ella.' };

  const bolsas = cuerpo?.bolsas === '' || cuerpo?.bolsas == null ? null : Number(cuerpo.bolsas);
  if (bolsas !== null && (!Number.isInteger(bolsas) || bolsas < 0 || bolsas > 10000)) {
    return { problema: 'Las bolsas que le caben no se entienden.' };
  }

  return {
    datos: {
      numero,
      marca: texto(cuerpo?.marca, 60),
      modelo: texto(cuerpo?.modelo, 60),
      serie: texto(cuerpo?.serie, 60),
      bolsas,
      costo_centavos: centavos(cuerpo?.costo) ?? anterior?.costo_centavos ?? null,
      fecha_compra: texto(cuerpo?.fechaCompra, 10),
      notas: texto(cuerpo?.notas, 500)
    }
  };
}

router.post('/', administrar, (req, res) => {
  const { datos, problema } = datosDeNevera(req.body);
  if (problema) return error(res, problema);

  const repetida = bd.prepare('SELECT id FROM neveras WHERE numero = ?').get(datos.numero);
  if (repetida) return error(res, `Ya hay una nevera con el número ${datos.numero}.`);

  const id = nuevoId();
  bd.prepare(`
    INSERT INTO neveras (id, numero, marca, modelo, serie, bolsas, costo_centavos,
                         fecha_compra, notas, estado, fecha_alta, creado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'bodega', ?, ?)
  `).run(id, datos.numero, datos.marca, datos.modelo, datos.serie, datos.bolsas,
         datos.costo_centavos, datos.fecha_compra, datos.notas, ahora(), req.usuario.id);

  bitacora.registrar({
    accion: 'nevera.alta', entidad: 'nevera', entidadId: id,
    ejecutorId: req.usuario.id, detalle: { numero: datos.numero, marca: datos.marca }
  });

  return ok(res, { nevera: calculo.completa(id) }, 201);
});

router.put('/:id', administrar, (req, res) => {
  const n = bd.prepare('SELECT * FROM neveras WHERE id = ?').get(req.params.id);
  if (!n) return error(res, 'Esa nevera no existe.', 404);

  const { datos, problema } = datosDeNevera(req.body, n);
  if (problema) return error(res, problema);

  const repetida = bd.prepare('SELECT id FROM neveras WHERE numero = ? AND id <> ?')
    .get(datos.numero, n.id);
  if (repetida) return error(res, `Ya hay otra nevera con el número ${datos.numero}.`);

  bd.prepare(`
    UPDATE neveras SET numero = ?, marca = ?, modelo = ?, serie = ?, bolsas = ?,
           costo_centavos = ?, fecha_compra = ?, notas = ?
     WHERE id = ?
  `).run(datos.numero, datos.marca, datos.modelo, datos.serie, datos.bolsas,
         datos.costo_centavos, datos.fecha_compra, datos.notas, n.id);

  bitacora.registrar({
    accion: 'nevera.edicion', entidad: 'nevera', entidadId: n.id,
    ejecutorId: req.usuario.id, detalle: { numero: datos.numero }
  });

  return ok(res, { nevera: calculo.completa(n.id) });
});

/**
 * PONERLE ESTADO A MANO.
 *
 * Solo para los tres que no salen de un comodato: por reparar, perdida, y
 * volver de cualquiera de las dos. `baja` tiene su propia ruta porque pide
 * motivo, y de esas no se vuelve sin querer.
 */
router.put('/:id/estado', administrar, (req, res) => {
  const n = bd.prepare('SELECT * FROM neveras WHERE id = ?').get(req.params.id);
  if (!n) return error(res, 'Esa nevera no existe.', 404);

  const permitidos = ['bodega', 'reparacion', 'perdida', 'en_uso'];
  const estado = String(req.body?.estado || '');
  if (!permitidos.includes(estado)) {
    return error(res, 'Ese estado no se pone a mano.');
  }

  // Una nevera que está con un cliente no puede estar "en bodega": eso
  // sería decir dos cosas distintas de la misma nevera.
  const vigente = calculo.comodatoVigente(n.id);
  if (vigente && estado === 'bodega') {
    return error(res, 'Esa nevera sigue prestada. Regístrala como devuelta primero.');
  }

  bd.prepare('UPDATE neveras SET estado = ? WHERE id = ?').run(estado, n.id);
  if (estado === 'bodega' || estado === 'en_uso') acomodarEstado(n.id);

  bitacora.registrar({
    accion: 'nevera.estado', entidad: 'nevera', entidadId: n.id,
    ejecutorId: req.usuario.id, detalle: { numero: n.numero, antes: n.estado, ahora: estado }
  });

  return ok(res, { nevera: calculo.completa(n.id) });
});

router.post('/:id/baja', administrar, (req, res) => {
  const n = bd.prepare('SELECT * FROM neveras WHERE id = ?').get(req.params.id);
  if (!n) return error(res, 'Esa nevera no existe.', 404);
  if (n.estado === 'baja') return error(res, 'Esa nevera ya está de baja.');

  const motivo = texto(req.body?.motivo, 300);
  if (!motivo) return error(res, 'Escribe por qué se da de baja.');

  bd.prepare(`
    UPDATE neveras SET estado = 'baja', baja_en = ?, baja_por = ?, motivo_baja = ?
     WHERE id = ?
  `).run(ahora(), req.usuario.id, motivo, n.id);

  bitacora.registrar({
    accion: 'nevera.baja', entidad: 'nevera', entidadId: n.id,
    ejecutorId: req.usuario.id, detalle: { numero: n.numero, motivo }
  });

  return ok(res, { nevera: calculo.completa(n.id) });
});

// ============================================================
// LA FOTO
// ============================================================

router.put('/:id/foto', administrar, (req, res) => {
  const n = bd.prepare('SELECT * FROM neveras WHERE id = ?').get(req.params.id);
  if (!n) return error(res, 'Esa nevera no existe.', 404);

  const r = archivos.guardar(req.body?.archivo, `nevera-${n.id}`);
  if (r.error) return error(res, r.error);

  if (n.foto) archivos.borrar(n.foto);
  bd.prepare('UPDATE neveras SET foto = ? WHERE id = ?').run(r.archivo, n.id);
  return ok(res, { foto: r.archivo });
});

router.get('/:id/foto', ver, (req, res) => {
  const n = bd.prepare('SELECT foto, numero FROM neveras WHERE id = ?').get(req.params.id);
  if (!n?.foto) return error(res, 'Esa nevera no tiene foto.', 404);
  return archivos.servir(res, n.foto, `nevera-${n.numero}`);
});

// ============================================================
// PRESTARLA Y RECOGERLA
// ============================================================

/**
 * ENTREGAR LA NEVERA.
 *
 * A un cliente dado de alta o a un nombre suelto —una feria de tres días
 * no merece un cliente en el catálogo para siempre—. Los dos caminos
 * llevan al mismo comodato; lo único que cambia es de dónde sale el
 * nombre.
 */
router.post('/:id/entregar', administrar, (req, res) => {
  const n = bd.prepare('SELECT * FROM neveras WHERE id = ?').get(req.params.id);
  if (!n) return error(res, 'Esa nevera no existe.', 404);
  if (n.estado === 'baja') return error(res, 'Esa nevera está dada de baja.');

  if (calculo.comodatoVigente(n.id)) {
    return error(res, 'Esa nevera ya está prestada. Regístrala como devuelta primero.');
  }

  const tipo = ['cliente', 'evento', 'fabrica'].includes(req.body?.tipo)
    ? req.body.tipo : 'cliente';

  let clienteId = null;
  let nombreLibre = null;

  if (tipo === 'fabrica') {
    nombreLibre = texto(req.body?.nombre, 120) || 'La fábrica';
  } else if (req.body?.clienteId) {
    const c = bd.prepare('SELECT id FROM clientes WHERE id = ? AND activo = 1')
      .get(req.body.clienteId);
    if (!c) return error(res, 'Ese cliente no existe.');
    clienteId = c.id;
  } else {
    nombreLibre = texto(req.body?.nombre, 120);
    if (!nombreLibre) return error(res, 'Dime a quién se le entrega.');
  }

  const dias = req.body?.diasAviso === '' || req.body?.diasAviso == null
    ? null : Number(req.body.diasAviso);
  if (dias !== null && (!Number.isInteger(dias) || dias < 1 || dias > 365)) {
    return error(res, 'Los días para el aviso no se entienden.');
  }

  const id = nuevoId();
  bd.prepare(`
    INSERT INTO comodatos (id, nevera_id, tipo, cliente_id, nombre_libre, desde,
                           hasta_previsto, direccion, referencias, latitud, longitud,
                           responsable, telefono, dias_aviso, notas,
                           fecha_alta, creado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, n.id, tipo, clienteId, nombreLibre,
         texto(req.body?.desde, 10) || calculo.hoy(),
         texto(req.body?.hastaPrevisto, 10),
         texto(req.body?.direccion, 300), texto(req.body?.referencias, 300),
         coordenada(req.body?.latitud, 90), coordenada(req.body?.longitud, 180),
         texto(req.body?.responsable, 120), texto(req.body?.telefono, 30),
         dias, texto(req.body?.notas, 500), ahora(), req.usuario.id);

  acomodarEstado(n.id);

  bitacora.registrar({
    accion: 'nevera.entregada', entidad: 'nevera', entidadId: n.id,
    ejecutorId: req.usuario.id,
    detalle: { numero: n.numero, tipo, quien: nombreLibre || clienteId }
  });

  return ok(res, { nevera: calculo.completa(n.id) }, 201);
});

/** Cambiar los datos del préstamo vigente sin cerrarlo. */
router.put('/comodatos/:id', administrar, (req, res) => {
  const co = bd.prepare('SELECT * FROM comodatos WHERE id = ?').get(req.params.id);
  if (!co) return error(res, 'Ese comodato no existe.', 404);

  const dias = req.body?.diasAviso === '' || req.body?.diasAviso == null
    ? null : Number(req.body.diasAviso);
  if (dias !== null && (!Number.isInteger(dias) || dias < 1 || dias > 365)) {
    return error(res, 'Los días para el aviso no se entienden.');
  }

  bd.prepare(`
    UPDATE comodatos SET direccion = ?, referencias = ?, latitud = ?, longitud = ?,
           responsable = ?, telefono = ?, dias_aviso = ?, hasta_previsto = ?, notas = ?
     WHERE id = ?
  `).run(texto(req.body?.direccion, 300), texto(req.body?.referencias, 300),
         coordenada(req.body?.latitud, 90), coordenada(req.body?.longitud, 180),
         texto(req.body?.responsable, 120), texto(req.body?.telefono, 30),
         dias, texto(req.body?.hastaPrevisto, 10), texto(req.body?.notas, 500), co.id);

  return ok(res, { nevera: calculo.completa(co.nevera_id) });
});

/** El papel firmado, escaneado o fotografiado. */
router.put('/comodatos/:id/documento', administrar, (req, res) => {
  const co = bd.prepare('SELECT * FROM comodatos WHERE id = ?').get(req.params.id);
  if (!co) return error(res, 'Ese comodato no existe.', 404);

  const r = archivos.guardar(req.body?.archivo, `comodato-${co.id}`);
  if (r.error) return error(res, r.error);

  if (co.documento) archivos.borrar(co.documento);
  bd.prepare('UPDATE comodatos SET documento = ?, documento_en = ? WHERE id = ?')
    .run(r.archivo, ahora(), co.id);

  return ok(res, { documento: r.archivo });
});

router.get('/comodatos/:id/documento', ver, (req, res) => {
  const co = bd.prepare(`
    SELECT co.documento, n.numero FROM comodatos co
      JOIN neveras n ON n.id = co.nevera_id WHERE co.id = ?
  `).get(req.params.id);
  if (!co?.documento) return error(res, 'Ese comodato no tiene documento.', 404);
  return archivos.servir(res, co.documento, `comodato-nevera-${co.numero}`);
});

/** Recogerla. El comodato se cierra; la nevera vuelve a bodega. */
router.post('/comodatos/:id/devolver', administrar, (req, res) => {
  const co = bd.prepare('SELECT * FROM comodatos WHERE id = ?').get(req.params.id);
  if (!co) return error(res, 'Ese comodato no existe.', 404);
  if (co.devuelta_en) return error(res, 'Esa nevera ya se había devuelto.');

  bd.prepare(`
    UPDATE comodatos SET devuelta_en = ?, devuelta_por = ?, motivo_retiro = ?
     WHERE id = ?
  `).run(ahora(), req.usuario.id, texto(req.body?.motivo, 300), co.id);

  // Vuelve descompuesta más veces de las que uno quisiera: si se dice que
  // así volvió, se marca de una vez y no se presta otra vez por error.
  if (req.body?.descompuesta) {
    bd.prepare("UPDATE neveras SET estado = 'reparacion' WHERE id = ?").run(co.nevera_id);
  } else {
    acomodarEstado(co.nevera_id);
  }

  bitacora.registrar({
    accion: 'nevera.devuelta', entidad: 'nevera', entidadId: co.nevera_id,
    ejecutorId: req.usuario.id, detalle: { motivo: req.body?.motivo || null }
  });

  return ok(res, { nevera: calculo.completa(co.nevera_id) });
});

// ============================================================
// FALLAS Y MANTENIMIENTOS
// ============================================================

/** "El cliente reporta falla" — un servicio que todavía no se ha hecho. */
router.post('/:id/servicios', ver, (req, res) => {
  const n = bd.prepare('SELECT * FROM neveras WHERE id = ?').get(req.params.id);
  if (!n) return error(res, 'Esa nevera no existe.', 404);

  const queTiene = texto(req.body?.queTiene, 500);
  if (!queTiene) return error(res, 'Escribe qué tiene la nevera.');

  const tipo = ['falla', 'preventivo', 'limpieza', 'otro'].includes(req.body?.tipo)
    ? req.body.tipo : 'falla';

  const id = nuevoId();
  const vigente = calculo.comodatoVigente(n.id);

  bd.prepare(`
    INSERT INTO nevera_servicios (id, nevera_id, comodato_id, tipo, reportado_en,
                                  reportado_por, quien_reporto, que_tiene)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, n.id, vigente?.id || null, tipo, ahora(), req.usuario.id,
         texto(req.body?.quienReporto, 120), queTiene);

  // Una falla deja la nevera marcada para que nadie la dé por buena. Un
  // preventivo o una limpieza no: la nevera sigue trabajando.
  if (tipo === 'falla' && !['baja', 'perdida'].includes(n.estado)) {
    bd.prepare("UPDATE neveras SET estado = 'reparacion' WHERE id = ?").run(n.id);
  }

  bitacora.registrar({
    accion: 'nevera.falla', entidad: 'nevera', entidadId: n.id,
    ejecutorId: req.usuario.id,
    detalle: { numero: n.numero, tipo, queTiene, quien: vigente?.quien || null }
  });

  return ok(res, { nevera: calculo.completa(n.id) }, 201);
});

/** Atenderlo: qué se hizo, quién y cuánto costó. */
router.post('/servicios/:id/atender', administrar, (req, res) => {
  const s = bd.prepare('SELECT * FROM nevera_servicios WHERE id = ?').get(req.params.id);
  if (!s) return error(res, 'Ese servicio no existe.', 404);
  if (s.atendido_en) return error(res, 'Ese servicio ya se había atendido.');
  if (s.anulado_en) return error(res, 'Ese servicio está anulado.');

  const queSeHizo = texto(req.body?.queSeHizo, 500);
  if (!queSeHizo) return error(res, 'Escribe qué se le hizo.');

  bd.prepare(`
    UPDATE nevera_servicios SET atendido_en = ?, atendido_por = ?, quien_lo_hizo = ?,
           que_se_hizo = ?, costo_centavos = ?
     WHERE id = ?
  `).run(ahora(), req.usuario.id, texto(req.body?.quienLoHizo, 120),
         queSeHizo, centavos(req.body?.costo) || 0, s.id);

  // Si ya no le queda nada pendiente, la nevera deja de estar "por
  // reparar" y vuelve a donde le toque por sus papeles.
  if (!calculo.pendientesDe(s.nevera_id).length) {
    const n = bd.prepare('SELECT estado FROM neveras WHERE id = ?').get(s.nevera_id);
    if (n?.estado === 'reparacion') {
      bd.prepare("UPDATE neveras SET estado = 'bodega' WHERE id = ?").run(s.nevera_id);
      acomodarEstado(s.nevera_id);
    }
  }

  bitacora.registrar({
    accion: 'nevera.mantenimiento', entidad: 'nevera', entidadId: s.nevera_id,
    ejecutorId: req.usuario.id,
    detalle: { queSeHizo, costo: centavos(req.body?.costo) || 0 }
  });

  return ok(res, { nevera: calculo.completa(s.nevera_id) });
});

router.post('/servicios/:id/anular', administrar, (req, res) => {
  const s = bd.prepare('SELECT * FROM nevera_servicios WHERE id = ?').get(req.params.id);
  if (!s) return error(res, 'Ese servicio no existe.', 404);
  if (s.anulado_en) return error(res, 'Ese servicio ya está anulado.');

  const motivo = texto(req.body?.motivo, 300);
  if (!motivo) return error(res, 'Escribe por qué se anula.');

  bd.prepare(`
    UPDATE nevera_servicios SET anulado_en = ?, anulado_por = ?, motivo_anulacion = ?
     WHERE id = ?
  `).run(ahora(), req.usuario.id, motivo, s.id);

  bitacora.registrar({
    accion: 'nevera.servicio_anulado', entidad: 'nevera', entidadId: s.nevera_id,
    ejecutorId: req.usuario.id, detalle: { motivo }
  });

  return ok(res, { nevera: calculo.completa(s.nevera_id) });
});

// ============================================================
// LO QUE SE REGALA
// ============================================================

router.post('/:id/cortesias', administrar, (req, res) => {
  const n = bd.prepare('SELECT * FROM neveras WHERE id = ?').get(req.params.id);
  if (!n) return error(res, 'Esa nevera no existe.', 404);

  const cuantas = Number(req.body?.cuantas);
  if (!Number.isInteger(cuantas) || cuantas < 1 || cuantas > 100000) {
    return error(res, 'Dime cuántas bolsas fueron.');
  }
  const motivo = ['cortesia', 'promocion', 'cambio', 'merma'].includes(req.body?.motivo)
    ? req.body.motivo : 'cortesia';

  const id = nuevoId();
  bd.prepare(`
    INSERT INTO nevera_cortesias (id, nevera_id, comodato_id, fecha, motivo,
                                  cuantas, centavos, notas, capturista_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, n.id, calculo.comodatoVigente(n.id)?.id || null, ahora(), motivo,
         cuantas, centavos(req.body?.valor) || 0, texto(req.body?.notas, 300),
         req.usuario.id);

  bitacora.registrar({
    accion: 'nevera.cortesia', entidad: 'nevera', entidadId: n.id,
    ejecutorId: req.usuario.id, detalle: { numero: n.numero, cuantas, motivo }
  });

  return ok(res, { nevera: calculo.completa(n.id) }, 201);
});

router.post('/cortesias/:id/anular', administrar, (req, res) => {
  const c = bd.prepare('SELECT * FROM nevera_cortesias WHERE id = ?').get(req.params.id);
  if (!c) return error(res, 'Eso no existe.', 404);
  if (c.anulado_en) return error(res, 'Ya está anulada.');

  bd.prepare('UPDATE nevera_cortesias SET anulado_en = ?, anulado_por = ? WHERE id = ?')
    .run(ahora(), req.usuario.id, c.id);
  return ok(res, { nevera: calculo.completa(c.nevera_id) });
});

// ============================================================
// EL CONTRATO
// ============================================================

/**
 * EL CONTRATO DE COMODATO, EN HOJA CARTA.
 *
 * Devuelve el HTML listo para imprimir y, aparte, la lista de huecos que
 * quedaron sin dato: la pantalla los enseña ANTES, porque descubrir que
 * falta el domicilio con el cliente enfrente y la pluma en la mano es la
 * peor forma de descubrirlo.
 */
router.get('/comodatos/:id/contrato', ver, (req, res) => {
  const co = bd.prepare(`
    SELECT co.*, COALESCE(c.nombre, co.nombre_libre) AS quien,
           COALESCE(co.telefono, c.telefono)  AS telefono,
           COALESCE(co.direccion, c.direccion) AS direccion
      FROM comodatos co
      LEFT JOIN clientes c ON c.id = co.cliente_id
     WHERE co.id = ?
  `).get(req.params.id);
  if (!co) return error(res, 'Ese comodato no existe.', 404);

  const nevera = bd.prepare('SELECT * FROM neveras WHERE id = ?').get(co.nevera_id);
  const { html, faltan } = documento.hoja({ nevera, comodato: co });
  return ok(res, { html, faltan });
});

/** El texto de la plantilla, para poder cambiarlo desde el sistema. */
router.get('/contrato/plantilla', administrar, (req, res) =>
  ok(res, { texto: documento.texto(), deFabrica: documento.PLANTILLA }));

router.put('/contrato/plantilla', administrar, (req, res) => {
  const t = String(req.body?.texto ?? '');
  if (t.length > 40000) return error(res, 'Ese texto es demasiado largo.');

  bd.prepare(`
    INSERT INTO configuracion (clave, valor, actualizado_en, actualizado_por)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor,
      actualizado_en = excluded.actualizado_en, actualizado_por = excluded.actualizado_por
  `).run(documento.CLAVE, t, ahora(), req.usuario.id);

  bitacora.registrar({
    accion: 'nevera.plantilla', entidad: 'configuracion', ejecutorId: req.usuario.id
  });
  return ok(res, { guardado: true });
});

module.exports = router;
