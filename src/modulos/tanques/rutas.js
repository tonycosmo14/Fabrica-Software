/**
 * CONFIGURADOR DE TANQUES  (v0.2)
 *
 * La fábrica está en expansión constante, así que crear tanques, paños y
 * canastas es una función del sistema, nunca algo escrito en el código
 * (error 11 del plan).
 *
 * Ver: cualquiera con acceso a producción. Modificar: solo admin.
 */
const express = require('express');
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');
const { ok, error } = require('../../lib/respuestas');
const bitacora = require('../../lib/bitacora');
const { exigirPermiso } = require('../../middleware/sesion');
const { listarTanques, detalleTanque, totalMoldesFabrica } = require('./consultas');

const router = express.Router();

const verTanques = exigirPermiso('produccion.ver');
const configurar = exigirPermiso('tanques.configurar');   // solo admin

const MAX_PANOS = 100;
const MAX_CANASTAS = 20;
const MAX_MOLDES = 20;

/** Siguiente número de posición, contando también los dados de baja
 *  para no reciclar números y no confundir el historial. */
function siguienteNumero(tabla, columna, id) {
  const fila = bd.prepare(
    `SELECT COALESCE(MAX(numero), 0) AS n FROM ${tabla} WHERE ${columna} = ?`
  ).get(id);
  return fila.n + 1;
}

/** Crea una canasta con sus moldes. Devuelve el id de la canasta. */
function crearCanasta(panoId, numero, cuantosMoldes) {
  const canastaId = nuevoId();
  bd.prepare(`
    INSERT INTO canastas (id, pano_id, numero, activo, fecha_alta)
    VALUES (?, ?, ?, 1, ?)
  `).run(canastaId, panoId, numero, ahora());

  const insertarMolde = bd.prepare(`
    INSERT INTO moldes (id, canasta_id, numero, activo, fecha_alta)
    VALUES (?, ?, ?, 1, ?)
  `);
  for (let i = 1; i <= cuantosMoldes; i++) {
    insertarMolde.run(nuevoId(), canastaId, i, ahora());
  }
  return canastaId;
}

/** Crea un paño completo a partir de una plantilla de canastas. */
function crearPano(tanqueId, numero, plantilla) {
  const panoId = nuevoId();
  bd.prepare(`
    INSERT INTO panos (id, tanque_id, numero, activo, fecha_alta)
    VALUES (?, ?, ?, 1, ?)
  `).run(panoId, tanqueId, numero, ahora());

  plantilla.forEach((moldes, i) => crearCanasta(panoId, i + 1, moldes));
  return panoId;
}

/**
 * Valida la plantilla de canastas de un paño.
 * Llega como arreglo de números: [3, 3, 3, 4] = cuatro canastas,
 * las tres primeras de 3 moldes y la última de 4.
 */
function validarPlantilla(plantilla) {
  if (!Array.isArray(plantilla) || plantilla.length === 0) {
    return 'Indica cuántas canastas lleva cada paño.';
  }
  if (plantilla.length > MAX_CANASTAS) {
    return `Son demasiadas canastas por paño (máximo ${MAX_CANASTAS}).`;
  }
  for (const moldes of plantilla) {
    if (!Number.isInteger(moldes) || moldes < 1 || moldes > MAX_MOLDES) {
      return `Cada canasta debe tener entre 1 y ${MAX_MOLDES} moldes.`;
    }
  }
  return null;
}

// ============================================================
// TANQUES
// ============================================================

router.get('/', verTanques, (req, res) => {
  const tanques = listarTanques({ incluirInactivos: req.query.incluirInactivos === '1' });
  return ok(res, { tanques, totalMoldes: totalMoldesFabrica() });
});

router.get('/:id', verTanques, (req, res) => {
  const tanque = detalleTanque(req.params.id, { incluirInactivos: req.query.incluirInactivos === '1' });
  if (!tanque) return error(res, 'Ese tanque no existe.', 404);
  return ok(res, { tanque });
});

/**
 * Alta de tanque. Se crea entero de un golpe: el tanque, sus paños, las
 * canastas de cada paño y los moldes de cada canasta. Crear 18 paños a
 * mano sería una tortura.
 */
router.post('/', configurar, (req, res) => {
  const { nombre, panos, plantilla, horasCongelacion, notas } = req.body || {};

  if (!nombre || !String(nombre).trim()) return error(res, 'El tanque necesita un nombre.');
  if (!Number.isInteger(panos) || panos < 1 || panos > MAX_PANOS) {
    return error(res, `El tanque debe tener entre 1 y ${MAX_PANOS} paños.`);
  }
  const problema = validarPlantilla(plantilla);
  if (problema) return error(res, problema);

  const horas = Number(horasCongelacion);
  if (!Number.isFinite(horas) || horas <= 0 || horas > 240) {
    return error(res, 'Las horas de congelación deben ser un número mayor que cero.');
  }

  const id = nuevoId();
  const orden = bd.prepare('SELECT COALESCE(MAX(orden), 0) AS n FROM tanques').get().n + 1;

  // Todo o nada: si algo falla a mitad, no queda un tanque incompleto.
  const crearTodo = bd.transaction(() => {
    bd.prepare(`
      INSERT INTO tanques (id, nombre, orden, horas_congelacion, notas, activo, fecha_alta, creado_por)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, String(nombre).trim(), orden, horas,
           notas ? String(notas).trim() : null, ahora(), req.usuario.id);

    for (let n = 1; n <= panos; n++) crearPano(id, n, plantilla);
  });
  crearTodo();

  const tanque = detalleTanque(id);
  bitacora.registrar({
    accion: 'tanque.alta', entidad: 'tanque', entidadId: id, ejecutorId: req.usuario.id,
    detalle: { nombre, panos, plantilla, moldes: tanque.total_moldes }
  });

  return ok(res, { tanque }, 201);
});

/** Editar nombre, horas de congelación y notas. El ID nunca cambia. */
router.put('/:id', configurar, (req, res) => {
  const t = bd.prepare('SELECT * FROM tanques WHERE id = ?').get(req.params.id);
  if (!t) return error(res, 'Ese tanque no existe.', 404);

  const { nombre, horasCongelacion, notas } = req.body || {};
  if (nombre !== undefined && !String(nombre).trim()) {
    return error(res, 'El nombre no puede quedar vacío.');
  }

  let horas = t.horas_congelacion;
  if (horasCongelacion !== undefined) {
    horas = Number(horasCongelacion);
    if (!Number.isFinite(horas) || horas <= 0 || horas > 240) {
      return error(res, 'Las horas de congelación deben ser un número mayor que cero.');
    }
  }

  bd.prepare('UPDATE tanques SET nombre = ?, horas_congelacion = ?, notas = ? WHERE id = ?')
    .run(nombre !== undefined ? String(nombre).trim() : t.nombre,
         horas,
         notas !== undefined ? (String(notas).trim() || null) : t.notas,
         t.id);

  bitacora.registrar({
    accion: 'tanque.edicion', entidad: 'tanque', entidadId: t.id, ejecutorId: req.usuario.id,
    detalle: { antes: { nombre: t.nombre, horas: t.horas_congelacion }, despues: { nombre, horas } }
  });

  return ok(res, { tanque: detalleTanque(t.id) });
});

router.post('/:id/baja', configurar, (req, res) => {
  const t = bd.prepare('SELECT * FROM tanques WHERE id = ?').get(req.params.id);
  if (!t) return error(res, 'Ese tanque no existe.', 404);
  if (!t.activo) return error(res, 'Ese tanque ya está fuera de servicio.');

  bd.prepare('UPDATE tanques SET activo = 0, fecha_baja = ? WHERE id = ?').run(ahora(), t.id);
  bitacora.registrar({ accion: 'tanque.baja', entidad: 'tanque', entidadId: t.id, ejecutorId: req.usuario.id });
  return ok(res, { dadoDeBaja: true });
});

router.post('/:id/alta', configurar, (req, res) => {
  const t = bd.prepare('SELECT * FROM tanques WHERE id = ?').get(req.params.id);
  if (!t) return error(res, 'Ese tanque no existe.', 404);

  bd.prepare('UPDATE tanques SET activo = 1, fecha_baja = NULL WHERE id = ?').run(t.id);
  bitacora.registrar({ accion: 'tanque.reactivacion', entidad: 'tanque', entidadId: t.id, ejecutorId: req.usuario.id });
  return ok(res, { reactivado: true });
});

// ============================================================
// PAÑOS
// ============================================================

/**
 * Agregar paños. Acepta "cantidad" para meter varios de un golpe: borrarlos
 * y volverlos a poner uno por uno era una tortura.
 */
/**
 * SUBIR O BAJAR UN TANQUE EN LA LISTA  (v4.7)
 *
 * "Que pueda subir o bajar los tanques para cambiar el orden en el que se
 *  muestran, sin necesidad de eliminarlos."
 *
 * El orden importa: es el que sigue el ojo del que va a sacar hielo, y
 * tenía que coincidir con el orden en que están puestos en el cuarto de
 * máquinas. Hasta hoy solo se podía cambiar dando de baja y volviendo a
 * crear, que se lleva por delante todo el historial del tanque.
 *
 * Se intercambia con el vecino, no se reescribe la lista entera: así dos
 * personas moviendo cosas a la vez no se pisan.
 */
router.post('/:id/mover', configurar, (req, res) => {
  const t = bd.prepare('SELECT * FROM tanques WHERE id = ? AND activo = 1').get(req.params.id);
  if (!t) return error(res, 'Ese tanque no existe.', 404);

  const cuanto = Number(req.body?.cuanto);
  if (cuanto !== -1 && cuanto !== 1) return error(res, 'Solo se puede mover uno arriba o abajo.');

  // El vecino en esa dirección. Se busca por (orden, nombre) y no solo por
  // `orden`, porque dos tanques pueden compartir número: los sembrados en
  // la puesta en marcha nacen todos en cero.
  const lista = bd.prepare(
    'SELECT id, orden FROM tanques WHERE activo = 1 ORDER BY orden, nombre'
  ).all();
  const i = lista.findIndex((x) => x.id === t.id);
  const j = i + cuanto;
  if (j < 0 || j >= lista.length) {
    return error(res, cuanto < 0 ? 'Ese tanque ya es el primero.' : 'Ese tanque ya es el último.');
  }

  // Se renumera la lista entera de 1 en adelante con los dos cambiados. Es
  // lo único que deja el orden limpio cuando todos venían en cero.
  const nueva = [...lista];
  [nueva[i], nueva[j]] = [nueva[j], nueva[i]];

  const poner = bd.prepare('UPDATE tanques SET orden = ? WHERE id = ?');
  bd.transaction(() => {
    nueva.forEach((x, n) => poner.run(n + 1, x.id));
  })();

  bitacora.registrar({
    accion: 'tanque.orden', entidad: 'tanque', entidadId: t.id, ejecutorId: req.usuario.id,
    detalle: { nombre: t.nombre, hacia: cuanto < 0 ? 'arriba' : 'abajo' }
  });

  return ok(res, { tanques: listarTanques({ incluirInactivos: true }) });
});

router.post('/:id/panos', configurar, (req, res) => {
  const t = bd.prepare('SELECT * FROM tanques WHERE id = ?').get(req.params.id);
  if (!t) return error(res, 'Ese tanque no existe.', 404);

  const plantilla = req.body?.plantilla;
  const problema = validarPlantilla(plantilla);
  if (problema) return error(res, problema);

  const cantidad = req.body?.cantidad === undefined ? 1 : Number(req.body.cantidad);
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_PANOS) {
    return error(res, `Se pueden agregar entre 1 y ${MAX_PANOS} paños a la vez.`);
  }

  const activos = bd.prepare('SELECT COUNT(*) n FROM panos WHERE tanque_id = ? AND activo = 1').get(t.id).n;
  if (activos + cantidad > MAX_PANOS) {
    return error(res, `El tanque tiene ${activos} paños y el máximo son ${MAX_PANOS}.`);
  }

  // Todo o nada: si falla a la mitad, no quedan paños sueltos.
  const crear = bd.transaction(() => {
    let numero = siguienteNumero('panos', 'tanque_id', t.id);
    for (let i = 0; i < cantidad; i++) crearPano(t.id, numero++, plantilla);
  });
  crear();

  bitacora.registrar({
    accion: 'pano.alta', entidad: 'tanque', entidadId: t.id, ejecutorId: req.usuario.id,
    detalle: { tanque: t.nombre, cantidad, plantilla }
  });

  return ok(res, { tanque: detalleTanque(t.id), agregados: cantidad }, 201);
});

/**
 * Quitar de golpe los últimos N paños. Es el arreglo natural de
 * "me pasé de paños al crear el tanque".
 */
router.post('/:id/panos/quitar-ultimos', configurar, (req, res) => {
  const t = bd.prepare('SELECT * FROM tanques WHERE id = ?').get(req.params.id);
  if (!t) return error(res, 'Ese tanque no existe.', 404);

  const cantidad = Number(req.body?.cantidad);
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    return error(res, 'Indica cuántos paños quitar.');
  }

  const activos = bd.prepare(
    'SELECT id, numero FROM panos WHERE tanque_id = ? AND activo = 1 ORDER BY numero DESC'
  ).all(t.id);

  if (cantidad >= activos.length) {
    return error(res, 'El tanque se quedaría sin paños. Si ya no sirve, dalo de baja completo.');
  }

  const quitar = bd.transaction(() => {
    const baja = bd.prepare('UPDATE panos SET activo = 0, fecha_baja = ? WHERE id = ?');
    for (const p of activos.slice(0, cantidad)) baja.run(ahora(), p.id);
  });
  quitar();

  bitacora.registrar({
    accion: 'pano.baja_multiple', entidad: 'tanque', entidadId: t.id,
    ejecutorId: req.usuario.id, detalle: { cantidad, desde: activos[0].numero }
  });

  return ok(res, { tanque: detalleTanque(t.id), quitados: cantidad });
});

router.post('/panos/:id/baja', configurar, (req, res) => {
  const p = bd.prepare('SELECT * FROM panos WHERE id = ?').get(req.params.id);
  if (!p) return error(res, 'Ese paño no existe.', 404);
  if (!p.activo) return error(res, 'Ese paño ya está dado de baja.');

  bd.prepare('UPDATE panos SET activo = 0, fecha_baja = ? WHERE id = ?').run(ahora(), p.id);
  bitacora.registrar({ accion: 'pano.baja', entidad: 'pano', entidadId: p.id, ejecutorId: req.usuario.id });
  return ok(res, { tanque: detalleTanque(p.tanque_id) });
});

router.post('/panos/:id/alta', configurar, (req, res) => {
  const p = bd.prepare('SELECT * FROM panos WHERE id = ?').get(req.params.id);
  if (!p) return error(res, 'Ese paño no existe.', 404);

  const ocupado = bd.prepare(
    'SELECT 1 FROM panos WHERE tanque_id = ? AND numero = ? AND activo = 1 AND id <> ?'
  ).get(p.tanque_id, p.numero, p.id);
  if (ocupado) return error(res, `Ya hay otro paño activo en la posición ${p.numero}.`);

  bd.prepare('UPDATE panos SET activo = 1, fecha_baja = NULL WHERE id = ?').run(p.id);
  bitacora.registrar({ accion: 'pano.reactivacion', entidad: 'pano', entidadId: p.id, ejecutorId: req.usuario.id });
  return ok(res, { tanque: detalleTanque(p.tanque_id) });
});

// ============================================================
// CANASTAS
// ============================================================

router.post('/panos/:id/canastas', configurar, (req, res) => {
  const p = bd.prepare('SELECT * FROM panos WHERE id = ?').get(req.params.id);
  if (!p) return error(res, 'Ese paño no existe.', 404);

  const moldes = Number(req.body?.moldes);
  if (!Number.isInteger(moldes) || moldes < 1 || moldes > MAX_MOLDES) {
    return error(res, `La canasta debe tener entre 1 y ${MAX_MOLDES} moldes.`);
  }

  const activas = bd.prepare('SELECT COUNT(*) n FROM canastas WHERE pano_id = ? AND activo = 1').get(p.id).n;
  if (activas >= MAX_CANASTAS) return error(res, `Ese paño ya tiene ${MAX_CANASTAS} canastas.`);

  const numero = siguienteNumero('canastas', 'pano_id', p.id);
  const crear = bd.transaction(() => crearCanasta(p.id, numero, moldes));
  const canastaId = crear();

  bitacora.registrar({
    accion: 'canasta.alta', entidad: 'canasta', entidadId: canastaId,
    ejecutorId: req.usuario.id, detalle: { pano: p.numero, moldes }
  });

  return ok(res, { tanque: detalleTanque(p.tanque_id) }, 201);
});

router.post('/canastas/:id/baja', configurar, (req, res) => {
  const c = bd.prepare('SELECT * FROM canastas WHERE id = ?').get(req.params.id);
  if (!c) return error(res, 'Esa canasta no existe.', 404);
  if (!c.activo) return error(res, 'Esa canasta ya está dada de baja.');

  bd.prepare('UPDATE canastas SET activo = 0, fecha_baja = ? WHERE id = ?').run(ahora(), c.id);
  bitacora.registrar({ accion: 'canasta.baja', entidad: 'canasta', entidadId: c.id, ejecutorId: req.usuario.id });

  const p = bd.prepare('SELECT tanque_id FROM panos WHERE id = ?').get(c.pano_id);
  return ok(res, { tanque: detalleTanque(p.tanque_id) });
});

/**
 * Cambiar cuántos moldes tiene una canasta.
 * Si sube, se agregan moldes nuevos. Si baja, los sobrantes se dan de baja
 * (nunca se borran: su historial de producción tiene que seguir existiendo).
 */
router.put('/canastas/:id/moldes', configurar, (req, res) => {
  const c = bd.prepare('SELECT * FROM canastas WHERE id = ?').get(req.params.id);
  if (!c) return error(res, 'Esa canasta no existe.', 404);

  const destino = Number(req.body?.moldes);
  if (!Number.isInteger(destino) || destino < 1 || destino > MAX_MOLDES) {
    return error(res, `La canasta debe tener entre 1 y ${MAX_MOLDES} moldes.`);
  }

  const actuales = bd.prepare(
    'SELECT * FROM moldes WHERE canasta_id = ? AND activo = 1 ORDER BY numero'
  ).all(c.id);

  const ajustar = bd.transaction(() => {
    if (destino > actuales.length) {
      let numero = siguienteNumero('moldes', 'canasta_id', c.id);
      const insertar = bd.prepare(
        'INSERT INTO moldes (id, canasta_id, numero, activo, fecha_alta) VALUES (?, ?, ?, 1, ?)'
      );
      for (let i = actuales.length; i < destino; i++) insertar.run(nuevoId(), c.id, numero++, ahora());
    } else if (destino < actuales.length) {
      const baja = bd.prepare('UPDATE moldes SET activo = 0, fecha_baja = ?, motivo_baja = ? WHERE id = ?');
      for (const m of actuales.slice(destino)) baja.run(ahora(), 'ajuste de configuración', m.id);
    }
  });
  ajustar();

  bitacora.registrar({
    accion: 'canasta.moldes', entidad: 'canasta', entidadId: c.id, ejecutorId: req.usuario.id,
    detalle: { antes: actuales.length, despues: destino }
  });

  const p = bd.prepare('SELECT tanque_id FROM panos WHERE id = ?').get(c.pano_id);
  return ok(res, { tanque: detalleTanque(p.tanque_id) });
});

// ============================================================
// MOLDES — dar de baja uno concreto (roto, con fuga)
// ============================================================

router.post('/moldes/:id/baja', configurar, (req, res) => {
  const m = bd.prepare('SELECT * FROM moldes WHERE id = ?').get(req.params.id);
  if (!m) return error(res, 'Ese molde no existe.', 404);
  if (!m.activo) return error(res, 'Ese molde ya está dado de baja.');

  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) return error(res, 'Escribe el motivo de la baja del molde.');

  bd.prepare('UPDATE moldes SET activo = 0, fecha_baja = ?, motivo_baja = ? WHERE id = ?')
    .run(ahora(), motivo, m.id);
  bitacora.registrar({
    accion: 'molde.baja', entidad: 'molde', entidadId: m.id,
    ejecutorId: req.usuario.id, detalle: { motivo }
  });

  return ok(res, { dadoDeBaja: true });
});

router.post('/moldes/:id/alta', configurar, (req, res) => {
  const m = bd.prepare('SELECT * FROM moldes WHERE id = ?').get(req.params.id);
  if (!m) return error(res, 'Ese molde no existe.', 404);

  const ocupado = bd.prepare(
    'SELECT 1 FROM moldes WHERE canasta_id = ? AND numero = ? AND activo = 1 AND id <> ?'
  ).get(m.canasta_id, m.numero, m.id);
  if (ocupado) return error(res, `Ya hay otro molde activo en la posición ${m.numero}.`);

  bd.prepare('UPDATE moldes SET activo = 1, fecha_baja = NULL, motivo_baja = NULL WHERE id = ?').run(m.id);
  bitacora.registrar({ accion: 'molde.reactivacion', entidad: 'molde', entidadId: m.id, ejecutorId: req.usuario.id });
  return ok(res, { reactivado: true });
});

module.exports = router;
