/**
 * CLIENTES Y CRÉDITO  (v1.6)
 *
 * Regla del negocio: se le fía SOLO a clientes registrados. El público en
 * general paga y se va. Por eso el cliente se da de alta ANTES de que haya
 * una venta a crédito, no en medio del cobro con gente esperando.
 *
 * Reglas que mandan aquí:
 *
 *  3.2  No hay saldo guardado: se suma cada vez (ver calculo.js).
 *  3.3  El nombre se edita; el id no cambia nunca.
 *  3.4  Nada se borra. Un cliente que se fue se da de baja.
 *  3.6  Doble responsable: quién recibió el dinero y quién lo anotó.
 */
const express = require('express');
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');
const { ok, error } = require('../../lib/respuestas');
const { leerPesos } = require('../../lib/dinero');
const bitacora = require('../../lib/bitacora');
const { exigirPermiso } = require('../../middleware/sesion');
const { sesionAbierta } = require('../caja/calculo');
const {
  estadoCliente, cuentaCorriente, clientesConEstado, resumenCartera
} = require('./calculo');

const router = express.Router();

const verClientes = exigirPermiso('clientes.ver');
const administrar = exigirPermiso('clientes.administrar');
const cobrar = exigirPermiso('credito.cobrar');
const corregir = exigirPermiso('venta.cancelar');   // gerente y administrador

/**
 * Lee un entero de un campo que puede venir vacío a propósito.
 *
 * Vacío significa "sin límite" o "sin plazo", que no es lo mismo que cero:
 * un límite de cero sería no fiarle nada. Sin limpiar a la brava, además:
 * "muchos" convertido en 0 pondría un límite que nadie pidió.
 */
function leerEnteroOpcional(valor, tope) {
  if (valor === undefined) return { omitido: true };
  const crudo = String(valor ?? '').trim();
  if (crudo === '') return { valor: null };
  if (!/^\d+$/.test(crudo)) return { error: true };
  const n = Number(crudo);
  if (!Number.isInteger(n) || n > tope) return { error: true };
  return { valor: n };
}

function clientePorId(id) {
  return bd.prepare('SELECT * FROM clientes WHERE id = ?').get(id ?? null) || null;
}

function conEstado(c) {
  return { ...c, estado: estadoCliente(c) };
}

// ============================================================
// LA LISTA
// ============================================================

/**
 * Todos los clientes con lo que deben.
 * Con ?incluirBajas=1 vienen también los dados de baja, para recuperarlos.
 * Con ?deben=1 solo los que tienen saldo: es la lista de cobranza.
 */
router.get('/', verClientes, (req, res) => {
  let clientes = clientesConEstado({ incluirBajas: req.query.incluirBajas === '1' });
  if (req.query.deben === '1') clientes = clientes.filter((c) => c.estado.saldo > 0);

  const busca = String(req.query.busca || '').trim().toLowerCase();
  if (busca) {
    clientes = clientes.filter((c) =>
      `${c.nombre} ${c.negocio || ''} ${c.telefono || ''}`.toLowerCase().includes(busca));
  }

  return ok(res, { clientes, cartera: resumenCartera() });
});

/** Un cliente con su cuenta corriente: es la ficha completa. */
router.get('/:id', verClientes, (req, res) => {
  const c = clientePorId(req.params.id);
  if (!c) return error(res, 'Ese cliente no existe.', 404);
  return ok(res, { cliente: conEstado(c), cuenta: cuentaCorriente(c.id) });
});

// ============================================================
// ALTA Y EDICIÓN
// ============================================================

router.post('/', administrar, (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  if (!nombre) return error(res, 'Escribe el nombre del cliente.');

  // Vacío o ausente = sin límite. No es lo mismo que cero, que sería no
  // fiarle nada.
  let limiteCentavos = null;
  if (String(req.body?.limite ?? '').trim() !== '') {
    limiteCentavos = leerPesos(req.body.limite, { permitirCero: true });
    if (limiteCentavos === null) {
      return error(res, 'El límite de crédito no es un importe válido.');
    }
  }

  const plazo = leerEnteroOpcional(req.body?.diasPlazo, 3650);
  if (plazo.error) return error(res, 'El plazo se escribe en días, con números.');

  const id = nuevoId();
  bd.prepare(`
    INSERT INTO clientes (id, nombre, negocio, telefono, direccion, notas,
                          limite_centavos, dias_plazo, fecha_alta, creado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, nombre.slice(0, 80),
         (req.body?.negocio || '').trim().slice(0, 80) || null,
         (req.body?.telefono || '').trim().slice(0, 30) || null,
         (req.body?.direccion || '').trim().slice(0, 200) || null,
         (req.body?.notas || '').trim().slice(0, 500) || null,
         limiteCentavos,
         plazo.omitido ? null : plazo.valor,
         ahora(), req.usuario.id);

  bitacora.registrar({
    accion: 'cliente.alta', entidad: 'cliente', entidadId: id,
    ejecutorId: req.usuario.id, detalle: { nombre }
  });

  return ok(res, { cliente: conEstado(clientePorId(id)) }, 201);
});

/**
 * Editar en el sitio, como los productos: llega un solo campo y se guarda.
 * El id nunca cambia (regla 3.3), así que renombrar a un cliente no rompe
 * ninguno de sus tickets viejos.
 */
router.put('/:id', administrar, (req, res) => {
  const c = clientePorId(req.params.id);
  if (!c) return error(res, 'Ese cliente no existe.', 404);

  const campos = {};

  if (req.body?.nombre !== undefined) {
    const nombre = String(req.body.nombre).trim();
    if (!nombre) return error(res, 'El cliente tiene que llevar nombre.');
    campos.nombre = nombre.slice(0, 80);
  }
  for (const [clave, columna, largo] of [
    ['negocio', 'negocio', 80], ['telefono', 'telefono', 30],
    ['direccion', 'direccion', 200], ['notas', 'notas', 500]
  ]) {
    if (req.body?.[clave] !== undefined) {
      campos[columna] = String(req.body[clave]).trim().slice(0, largo) || null;
    }
  }

  if (req.body?.limite !== undefined) {
    const crudo = String(req.body.limite).trim();
    if (crudo === '') {
      campos.limite_centavos = null;             // vacío = sin límite
    } else {
      const centavos = leerPesos(crudo, { permitirCero: true });
      if (centavos === null) return error(res, 'El límite de crédito no es un importe válido.');
      campos.limite_centavos = centavos;
    }
  }

  if (req.body?.diasPlazo !== undefined) {
    const plazo = leerEnteroOpcional(req.body.diasPlazo, 3650);
    if (plazo.error) return error(res, 'El plazo se escribe en días, con números.');
    campos.dias_plazo = plazo.valor;
  }

  const claves = Object.keys(campos);
  if (!claves.length) return ok(res, { cliente: conEstado(c) });

  bd.prepare(`UPDATE clientes SET ${claves.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .run(...claves.map((k) => campos[k]), c.id);

  bitacora.registrar({
    accion: 'cliente.editado', entidad: 'cliente', entidadId: c.id,
    ejecutorId: req.usuario.id, detalle: campos
  });

  return ok(res, { cliente: conEstado(clientePorId(c.id)) });
});

/**
 * Dar de baja. Nada se borra (regla 3.4): deja de salir en la caja, pero
 * sus tickets viejos siguen existiendo tal cual.
 *
 * Un cliente que todavía debe NO se da de baja: desaparecería de la lista
 * de cobranza con dinero en la calle, que es la forma más fácil de perderlo.
 */
router.post('/:id/baja', administrar, (req, res) => {
  const c = clientePorId(req.params.id);
  if (!c) return error(res, 'Ese cliente no existe.', 404);
  if (!c.activo) return error(res, 'Ese cliente ya está dado de baja.');

  const { saldo } = estadoCliente(c);
  if (saldo > 0) {
    return error(res,
      `${c.nombre} todavía debe. Cóbrale o deja el saldo en cero antes de darlo de baja.`, 409);
  }

  bd.prepare('UPDATE clientes SET activo = 0, fecha_baja = ? WHERE id = ?').run(ahora(), c.id);
  bitacora.registrar({
    accion: 'cliente.baja', entidad: 'cliente', entidadId: c.id,
    ejecutorId: req.usuario.id, detalle: { nombre: c.nombre }
  });

  return ok(res, { cliente: conEstado(clientePorId(c.id)) });
});

router.post('/:id/alta', administrar, (req, res) => {
  const c = clientePorId(req.params.id);
  if (!c) return error(res, 'Ese cliente no existe.', 404);
  if (c.activo) return error(res, 'Ese cliente ya está activo.');

  bd.prepare('UPDATE clientes SET activo = 1, fecha_baja = NULL WHERE id = ?').run(c.id);
  bitacora.registrar({
    accion: 'cliente.alta', entidad: 'cliente', entidadId: c.id,
    ejecutorId: req.usuario.id, detalle: { nombre: c.nombre, recuperado: true }
  });

  return ok(res, { cliente: conEstado(clientePorId(c.id)) });
});

// ============================================================
// LOS ABONOS
// ============================================================

/**
 * El cliente pasa a pagar.
 *
 * Si paga EN EFECTIVO, además se anota como entrada en el cajón: ese billete
 * sí llegó ahí y el corte tiene que cuadrar. Si paga por transferencia, no:
 * ese dinero nunca pasó por el cajón y contarlo haría que la caja sobrara.
 */
router.post('/:id/abonos', cobrar, (req, res) => {
  const c = clientePorId(req.params.id);
  if (!c) return error(res, 'Ese cliente no existe.', 404);

  const centavos = leerPesos(req.body?.monto);
  if (centavos === null) return error(res, 'Escribe de cuánto es el abono.');

  const formaPago = req.body?.formaPago === 'transferencia' ? 'transferencia' : 'efectivo';
  const { saldo } = estadoCliente(c);

  // Pagar de más se permite —queda a favor y se le descuenta la próxima—,
  // pero se avisa, porque casi siempre es un dedazo.
  const deMas = centavos > saldo ? centavos - saldo : 0;

  const id = nuevoId();
  const fecha = ahora();
  const turno = sesionAbierta();
  const ejecutorId = req.body?.ejecutorId || req.usuario.id;
  let movimientoId = null;

  const guardar = bd.transaction(() => {
    if (formaPago === 'efectivo' && turno) {
      movimientoId = nuevoId();
      bd.prepare(`
        INSERT INTO movimientos_caja
          (id, caja_id, fecha, tipo, concepto, centavos, ejecutor_id, capturista_id, notas)
        VALUES (?, ?, ?, 'entrada', ?, ?, ?, ?, ?)
      `).run(movimientoId, turno.id, fecha,
             `Abono de ${c.nombre}`.slice(0, 80), centavos,
             ejecutorId, req.usuario.id, 'Cobranza de crédito');
    }

    bd.prepare(`
      INSERT INTO abonos (id, cliente_id, fecha, centavos, forma_pago, notas,
                          caja_id, movimiento_id, ejecutor_id, capturista_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, c.id, fecha, centavos, formaPago,
           (req.body?.notas || '').trim().slice(0, 200) || null,
           turno?.id || null, movimientoId, ejecutorId, req.usuario.id);
  });
  guardar();

  bitacora.registrar({
    accion: 'credito.abono', entidad: 'cliente', entidadId: c.id,
    ejecutorId, capturistaId: req.usuario.id,
    detalle: { abonoId: id, centavos, formaPago, saldoAntes: saldo }
  });

  const despues = estadoCliente(clientePorId(c.id));
  return ok(res, {
    abonoId: id,
    movimientoId,
    cliente: conEstado(clientePorId(c.id)),
    // Para que la pantalla pueda avisar sin tener que hacer la resta.
    deMas,
    sinTurno: formaPago === 'efectivo' && !turno,
    saldo: despues.saldo
  }, 201);
});

/**
 * Anular un abono mal capturado. No se borra: se marca (regla 3.4).
 * Su renglón en el cajón se anula también, o el corte quedaría con un
 * ingreso que ya no existe.
 */
router.post('/abonos/:id/anular', corregir, (req, res) => {
  const a = bd.prepare('SELECT * FROM abonos WHERE id = ?').get(req.params.id ?? null);
  if (!a) return error(res, 'Ese abono no existe.', 404);
  if (a.anulado_en) return error(res, 'Ese abono ya está anulado.');

  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) return error(res, 'Escribe por qué se anula.');

  if (a.movimiento_id) {
    const caja = bd.prepare(`
      SELECT c.* FROM cajas c
        JOIN movimientos_caja m ON m.caja_id = c.id
       WHERE m.id = ?
    `).get(a.movimiento_id);
    if (caja?.cerrada_en) {
      return error(res,
        'Ese abono es de un turno que ya se cortó. Un corte firmado no se toca: ' +
        'anótalo como movimiento del turno de ahora.', 409);
    }
  }

  const fecha = ahora();
  const anular = bd.transaction(() => {
    bd.prepare(`
      UPDATE abonos SET anulado_en = ?, anulado_por = ?, motivo_anulacion = ? WHERE id = ?
    `).run(fecha, req.usuario.id, motivo, a.id);

    if (a.movimiento_id) {
      bd.prepare(`
        UPDATE movimientos_caja SET anulado_en = ?, anulado_por = ?, motivo_anulacion = ?
         WHERE id = ? AND anulado_en IS NULL
      `).run(fecha, req.usuario.id, motivo, a.movimiento_id);
    }
  });
  anular();

  bitacora.registrar({
    accion: 'credito.abono-anulado', entidad: 'cliente', entidadId: a.cliente_id,
    ejecutorId: req.usuario.id, detalle: { abonoId: a.id, centavos: a.centavos, motivo }
  });

  return ok(res, { cliente: conEstado(clientePorId(a.cliente_id)) });
});

module.exports = router;
