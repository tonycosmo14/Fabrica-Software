/**
 * LA PUESTA EN MARCHA  (v2.8)
 *
 * La fábrica ya trabaja; el sistema apenas llega. El día del arranque hay
 * que decirle al sistema cómo está el mundo REAL a esa hora: qué paños
 * llevan horas congelando, cuál fue el último que se sacó y cuánto hielo
 * hay en el cuarto frío. Este módulo es ese día.
 *
 * LO QUE CAMBIÓ EN LA v5.2.1, DESPUÉS DE USARLO DE VERDAD
 *
 *   · EL HIELO SE CAPTURA AQUÍ. Antes había un enlace a "ir a contar el
 *     cuarto frío", y ahí no se podía: contar solo existía dentro del
 *     cierre de turno. O sea que el paso 5 mandaba a un sitio donde no se
 *     podía hacer el paso 5.
 *   · EL DINERO YA NO SE PREGUNTA. La caja empieza en CERO — ese fue el
 *     acuerdo— así que preguntar cuánto hay solo servía para meter un
 *     número que después no cuadraba con nada.
 *   · LO QUE SE BORRA VIVE EN `limpieza.js`, clasificado tabla por tabla,
 *     con una prueba que revienta si aparece una sin clasificar. La lista
 *     vieja era de la v2.8 y se había quedado a medias.
 *
 * Lo demás sigue igual: los productos se cuentan en su pantalla, y lo
 * único que no se podía capturar en ningún lado —el estado de los paños y
 * la rotación— se captura aquí.
 *
 * CÓMO SE FIJA UN PAÑO SIN MENTIR (regla 3.2: estado derivado, jamás
 * guardado): no se escribe ningún estado. Se registra el EVENTO real que
 * pasó fuera del sistema —"este paño se rellenó ayer a las 8"— como un
 * rellenado con esa fecha y la nota PUESTA EN MARCHA. El estado sale solo,
 * del mismo cálculo de siempre. Jamás se inventa una sacada CON MOLDES:
 * serían marquetas fantasma en las estadísticas de producción.
 *
 * Las filas sembradas son estadísticamente inertes a propósito: las
 * marquetas se cuentan por sacadas_moldes (aquí no se inserta ninguno) y
 * el papel del día exige sacada_pano (aquí va NULL).
 */
const express = require('express');
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');
const { ok, error } = require('../../lib/respuestas');
const { exigirPermiso } = require('../../middleware/sesion');
const { comprobarAdmin, administradores } = require('../../lib/autorizacion');
const { respaldar } = require('../../db/respaldar');
const { tanqueConEstado } = require('../produccion/estado');
const { ordenIntercalado, siguientePano } = require('../produccion/rotacion');
const bitacora = require('../../lib/bitacora');
const limpieza = require('./limpieza');

const router = express.Router();

// Solo el comodín del administrador tiene este permiso: ningún rol lo
// lista. Ese es el "botón exclusivo del super administrador".
const soloAdmin = exigirPermiso('sistema.puesta_en_marcha');

const MARCA = 'PUESTA EN MARCHA';
const MARCA_CUADRE = 'CUADRE';

function constancia() {
  const fila = bd.prepare(
    "SELECT valor FROM configuracion WHERE clave = 'puesta_en_marcha'"
  ).get();
  try { return fila ? JSON.parse(fila.valor) : null; } catch { return null; }
}

/** ¿La historia de estas canastas es solo de siembra (o está vacía)? */
function soloSembrado(panoId) {
  const real = bd.prepare(`
    SELECT COUNT(*) n FROM (
      SELECT r.id FROM rellenados r
        JOIN canastas c ON c.id = r.canasta_id
       WHERE c.pano_id = ? AND (r.notas IS NULL OR r.notas NOT LIKE ?)
      UNION ALL
      SELECT s.id FROM sacadas s
        JOIN canastas c ON c.id = s.canasta_id
       WHERE c.pano_id = ? AND (s.notas IS NULL OR s.notas NOT LIKE ?)
    )
  `).get(panoId, `${MARCA}%`, panoId, `${MARCA}%`);
  return real.n === 0;
}

/** Un ISO de fecha/hora válido, no futuro y no más viejo que `diasAtras`. */
function leerCuando(valor, diasAtras = 7) {
  const d = new Date(String(valor || ''));
  if (Number.isNaN(d.getTime())) return null;
  const hoy = Date.now();
  if (d.getTime() > hoy + 5 * 60 * 1000) return null;                    // futuro no
  if (d.getTime() < hoy - diasAtras * 24 * 3600 * 1000) return null;     // ni prehistoria
  return d.toISOString();
}

// ============================================================
// EL CHECKLIST — todo derivado, nada guardado
// ============================================================

router.get('/estado', soloAdmin, (req, res) => {
  const tanques = bd.prepare(
    'SELECT id FROM tanques WHERE activo = 1 ORDER BY orden'
  ).all().map((t) => {
    const d = tanqueConEstado(t.id);
    return {
      id: d.id,
      nombre: d.nombre,
      horasCongelacion: d.horas_congelacion,
      ultimoPanoSacado: d.ultimo_pano_sacado,
      ordenRotacion: d.ordenRotacion,
      siguiente: d.siguiente?.numero ?? null,
      panos: d.panos.map((p) => ({
        id: p.id,
        numero: p.numero,
        estado: p.estado,
        horas: p.horas,
        canastas: p.canastas.length,
        sinRegistro: p.canastas.every((c) => c.sinRegistro),
        // ¿Se puede sembrar? Solo si su historia está vacía o es de siembra.
        sembrable: soloSembrado(p.id)
      }))
    };
  });

  const conteo = bd.prepare(
    'SELECT COUNT(*) n FROM conteos'
  ).get().n;
  const ultimoConteo = bd.prepare(`
    SELECT c.contado, c.fecha, a.nombre AS almacen
      FROM conteos c LEFT JOIN almacenes a ON a.id = c.almacen_id
     WHERE c.anulado_en IS NULL
     ORDER BY c.fecha DESC LIMIT 1
  `).get() || null;
  const productosSinConteo = bd.prepare(`
    SELECT COUNT(*) n FROM productos p
     WHERE p.activo = 1 AND p.lleva_inventario = 1
       AND NOT EXISTS (SELECT 1 FROM movimientos_inventario m
                        WHERE m.producto_id = p.id AND m.tipo = 'conteo')
  `).get().n;
  const movimientos = {
    ventas: bd.prepare('SELECT COUNT(*) n FROM ventas').get().n,
    sacadas: bd.prepare('SELECT COUNT(*) n FROM sacadas').get().n,
    turnos: bd.prepare('SELECT COUNT(*) n FROM cajas').get().n
  };
  const cuadres = bd.prepare(
    "SELECT COUNT(*) n FROM bitacora WHERE accion = 'arranque.cuadre'"
  ).get().n;

  return ok(res, {
    terminada: constancia(),
    tanques,
    hieloContado: conteo > 0,
    ultimoConteo,
    productosSinConteo,
    movimientos,
    cuadres,
    // LO QUE SE VA A BORRAR, CON SUS CUENTAS, antes de apretar el botón.
    // Ver "3 cortes de caja · 48 ventas" es lo que hace que la decisión
    // sea una decisión y no un salto al vacío.
    porBorrar: limpieza.loQueSeVaABorrar(bd),
    seQueda: Object.values(limpieza.SE_QUEDA),
    almacenes: bd.prepare(
      'SELECT id, nombre FROM almacenes WHERE activo = 1 ORDER BY orden, nombre').all()
  });
});

// ============================================================
// CERRAR LAS PRUEBAS — una sola vez, y con la contraseña
// ============================================================

/**
 * Borra los MOVIMIENTOS de ensayo: ventas, sacadas, conteos, turnos…
 * Se queda todo lo que costó trabajo armar: usuarios, tanques, productos,
 * precios, clientes, conceptos, configuración. Y LA BITÁCORA ÍNTEGRA.
 *
 * Es la única excepción deliberada a la regla 3.4 en todo el sistema, y
 * por eso va triple candada: respaldo automático antes, la contraseña del
 * administrador, y un solo uso —en cuanto existe la constancia de puesta
 * en marcha, responde 410 y no vuelve—. Lo capturado en las pruebas es
 * ensayo, no historia; el respaldo conserva el ensayo.
 */
router.post('/cerrar-pruebas', soloAdmin, (req, res) => {
  if (constancia()) {
    return error(res, 'La puesta en marcha ya se hizo. Esto era de una sola vez.', 410);
  }

  const auth = comprobarAdmin(req.body?.autorizacion);
  if (auth.error) {
    return error(res, auth.error, 403,
                 { requiereContrasena: true, administradores: administradores() });
  }

  const respaldo = respaldar('antes-de-produccion');

  // La lista vive en `limpieza.js`, clasificada y probada. Aquí solo se
  // recorre: así una tabla nueva no se puede quedar fuera sin que alguien
  // lo haya decidido a propósito.
  const TABLAS = limpieza.MOVIMIENTOS.map((m) => m.tabla);

  const borradas = {};
  bd.transaction(() => {
    for (const tabla of TABLAS) {
      // Alguna tabla puede no existir en una instalación vieja: se salta.
      try {
        borradas[tabla] = bd.prepare(`DELETE FROM ${tabla}`).run().changes;
      } catch { borradas[tabla] = null; }
    }
    // El cursor de la rotación era de las pruebas: se limpia también, y la
    // pantalla de rotación de la puesta en marcha lo vuelve a fijar.
    bd.prepare('UPDATE tanques SET ultimo_pano_sacado = NULL').run();
  })();

  bitacora.registrar({
    accion: 'arranque.cierre_pruebas', entidad: 'sistema', entidadId: 'arranque',
    ejecutorId: req.usuario.id,
    detalle: { borradas, respaldo: respaldo?.archivo || respaldo || 'hecho' }
  });

  return ok(res, { borradas, respaldo: true });
});

// ============================================================
// EL ESTADO DE LOS PAÑOS — lo único que no existía
// ============================================================

/**
 * Registra cómo está cada paño en la realidad, ANTES del primer movimiento:
 *   { panos: [{ panoId, situacion: 'congelando'|'fuera', desde, tipoAgua }] }
 *
 * congelando → un rellenado por canasta con la fecha declarada.
 * fuera      → una sacada "pelada" por canasta: sin moldes (cero marquetas
 *              fantasma), sin sacada_pano (no es papel de producción).
 *
 * Solo se puede sembrar un paño cuya historia esté vacía o sea de siembra;
 * re-sembrar borra únicamente las filas con la marca, en la misma
 * transacción. Un paño real jamás se pisa desde aquí.
 */
router.post('/panos', soloAdmin, (req, res) => {
  return fijarPanos(req, res, { modo: 'siembra' });
});

/**
 * EL CUADRE PERMANENTE. La misma captura, para DESPUÉS de la puesta en
 * marcha: el apagón, la semana que nadie capturó, el compresor
 * descompuesto. Cambian tres cosas: no exige historia virgen, el motivo es
 * OBLIGATORIO y queda en la nota y en la bitácora, y la fecha declarada
 * debe ser POSTERIOR al último evento real de cada canasta —se captura
 * tarde un hecho real; no se reescribe lo ya registrado—.
 */
router.post('/cuadre-panos', soloAdmin, (req, res) => {
  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) return error(res, 'Escribe por qué se está cuadrando a mano.');
  return fijarPanos(req, res, { modo: 'cuadre', motivo });
});

function fijarPanos(req, res, { modo, motivo = null }) {
  const pedidos = req.body?.panos;
  if (!Array.isArray(pedidos) || !pedidos.length) {
    return error(res, 'No mandaste ningún paño.');
  }
  if (pedidos.length > 200) return error(res, 'Son demasiados paños de una vez.');

  const nota = modo === 'cuadre' ? `${MARCA_CUADRE}: ${motivo}`.slice(0, 200) : MARCA;
  const hechos = [];

  for (const pd of pedidos) {
    const pano = bd.prepare(`
      SELECT p.*, t.nombre AS tanque_nombre, t.id AS tanque_id
        FROM panos p JOIN tanques t ON t.id = p.tanque_id
       WHERE p.id = ?
    `).get(pd?.panoId);
    if (!pano) return error(res, 'Uno de los paños no existe.', 404);

    const situacion = String(pd?.situacion || '');
    if (!['congelando', 'fuera'].includes(situacion)) {
      return error(res, `La situación de un paño es "congelando" o "fuera", no "${situacion}".`);
    }

    const cuando = leerCuando(pd?.desde, modo === 'cuadre' ? 30 : 7);
    if (!cuando) {
      return error(res, 'La fecha de un paño no se entiende, es futura o es demasiado vieja.');
    }

    const tipoAgua = String(pd?.tipoAgua || 'purificada');
    if (!['purificada', 'potable'].includes(tipoAgua)) {
      return error(res, 'El agua es purificada o potable.');
    }

    const abierta = bd.prepare(
      'SELECT 1 FROM sacadas_pano WHERE pano_id = ? AND terminada_en IS NULL'
    ).get(pano.id);
    if (abierta) {
      return error(res, `El paño ${pano.numero} tiene una sacada a medias; primero se termina o se anula.`, 409);
    }

    if (modo === 'siembra' && !soloSembrado(pano.id)) {
      return error(res,
        `El paño ${pano.numero} de ${pano.tanque_nombre} ya tiene registros de verdad; ` +
        'la siembra es solo para paños sin historia. Para corregir uno con historia está el cuadre.',
        409);
    }

    const canastas = bd.prepare(
      'SELECT id FROM canastas WHERE pano_id = ? AND activo = 1'
    ).all(pano.id);
    if (!canastas.length) continue;

    if (modo === 'cuadre') {
      // Un cuadre captura tarde un hecho real: va DESPUÉS de lo registrado.
      const ultimo = bd.prepare(`
        SELECT MAX(fecha) f FROM (
          SELECT r.fecha FROM rellenados r JOIN canastas c ON c.id = r.canasta_id WHERE c.pano_id = ?
          UNION ALL
          SELECT s.fecha FROM sacadas s JOIN canastas c ON c.id = s.canasta_id WHERE c.pano_id = ?
        )
      `).get(pano.id, pano.id).f;
      if (ultimo && cuando <= ultimo) {
        return error(res,
          `El paño ${pano.numero} tiene un registro del ${ultimo}; el cuadre debe ser posterior. ` +
          'Lo ya registrado no se reescribe.', 409);
      }
    }

    bd.transaction(() => {
      if (modo === 'siembra') {
        // Re-sembrar reemplaza SOLO lo sembrado, nunca un registro real.
        bd.prepare(`
          DELETE FROM rellenados WHERE notas LIKE ? AND canasta_id IN
            (SELECT id FROM canastas WHERE pano_id = ?)
        `).run(`${MARCA}%`, pano.id);
        bd.prepare(`
          DELETE FROM sacadas WHERE notas LIKE ? AND canasta_id IN
            (SELECT id FROM canastas WHERE pano_id = ?)
        `).run(`${MARCA}%`, pano.id);
      }

      for (const c of canastas) {
        if (situacion === 'congelando') {
          bd.prepare(`
            INSERT INTO rellenados (id, canasta_id, fecha, ejecutor_id, capturista_id,
                                    tipo_agua, notas)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(nuevoId(), c.id, cuando, null, req.usuario.id, tipoAgua, nota);
        } else {
          bd.prepare(`
            INSERT INTO sacadas (id, canasta_id, fecha, ejecutor_id, capturista_id, notas)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(nuevoId(), c.id, cuando, null, req.usuario.id, nota);
        }
      }
    })();

    bitacora.registrar({
      accion: modo === 'cuadre' ? 'arranque.cuadre' : 'arranque.pano_fijado',
      entidad: 'pano', entidadId: pano.id, ejecutorId: req.usuario.id,
      detalle: { tanque: pano.tanque_nombre, pano: pano.numero, situacion,
                 desde: cuando, canastas: canastas.length,
                 ...(motivo ? { motivo } : {}) }
    });

    hechos.push({ tanque: pano.tanque_nombre, pano: pano.numero, situacion });
  }

  return ok(res, { hechos }, 201);
}

// ============================================================
// LA ROTACIÓN — cuál fue el último que se sacó
// ============================================================

router.post('/rotacion', soloAdmin, (req, res) => {
  const tanque = bd.prepare('SELECT * FROM tanques WHERE id = ? AND activo = 1')
    .get(req.body?.tanqueId);
  if (!tanque) return error(res, 'Ese tanque no existe.', 404);

  const numeros = bd.prepare(
    'SELECT numero FROM panos WHERE tanque_id = ? AND activo = 1'
  ).all(tanque.id).map((p) => p.numero);

  let ultimo = req.body?.ultimoPanoSacado;
  if (ultimo !== null && ultimo !== undefined) {
    ultimo = Number(ultimo);
    if (!numeros.includes(ultimo)) {
      return error(res, `El tanque ${tanque.nombre} no tiene un paño ${req.body.ultimoPanoSacado}.`);
    }
  } else ultimo = null;

  const antes = tanque.ultimo_pano_sacado;
  bd.prepare('UPDATE tanques SET ultimo_pano_sacado = ? WHERE id = ?').run(ultimo, tanque.id);

  bitacora.registrar({
    accion: 'arranque.rotacion_fijada', entidad: 'tanque', entidadId: tanque.id,
    ejecutorId: req.usuario.id, detalle: { tanque: tanque.nombre, antes, despues: ultimo }
  });

  // "Entonces toca el N": la vista previa que evita fijar el equivocado.
  return ok(res, {
    ultimoPanoSacado: ultimo,
    entoncesToca: siguientePano(numeros, ultimo),
    orden: ordenIntercalado(numeros)
  });
});

// ============================================================
// LA CONSTANCIA
// ============================================================

router.post('/terminar', soloAdmin, (req, res) => {
  if (constancia()) return error(res, 'La puesta en marcha ya estaba dada por hecha.');

  const valor = JSON.stringify({ terminada_en: ahora(), usuario_id: req.usuario.id });
  bd.prepare(`
    INSERT INTO configuracion (clave, valor, actualizado_en, actualizado_por)
    VALUES ('puesta_en_marcha', ?, ?, ?)
    ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor,
      actualizado_en = excluded.actualizado_en, actualizado_por = excluded.actualizado_por
  `).run(valor, ahora(), req.usuario.id);

  bitacora.registrar({
    accion: 'arranque.terminado', entidad: 'sistema', entidadId: 'arranque',
    ejecutorId: req.usuario.id, detalle: {}
  });
  return ok(res, { terminada: JSON.parse(valor) });
});

module.exports = router;
