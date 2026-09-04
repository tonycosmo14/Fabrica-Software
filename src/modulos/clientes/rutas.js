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
const { resolverEnlace } = require('../../lib/enlaces-mapa');
const { comprobarAdmin, administradores } = require('../../lib/autorizacion');
const { sesionAbierta } = require('../caja/calculo');
const { apuntarAbono } = require('./abonos');
const { listasDeMayoreo, listaPorOmision } = require('../ventas/mayoreo');
const {
  estadoCliente, cuentaCorriente, clientesConEstado, resumenCartera
} = require('./calculo');
// Las mismas fotos que las de los productos: misma carpeta, mismas
// comprobaciones y el mismo sitio para servirlas. Un logo de tienda no
// tiene nada de secreto —está pintado en la fachada— así que no hace
// falta el trato de los papeles de la empresa.
const fotos = require('../catalogo/fotos');

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
  const lista = c.lista_id
    ? bd.prepare('SELECT id, nombre, activo FROM listas_precios WHERE id = ?').get(c.lista_id)
    : null;
  return { ...c, estado: estadoCliente(c), lista: lista || null };
}

// ============================================================
// LA LISTA
// ============================================================

/**
 * Todos los clientes con lo que deben.
 * Con ?incluirBajas=1 vienen también los dados de baja, para recuperarlos.
 * Con ?deben=1 solo los que tienen saldo: es la lista de cobranza.
 */
/**
 * LAS TRES PESTAÑAS son un filtro, no tres listas.
 *
 * `?compra=agua` deja los que compran agua. El que compra las tres cosas
 * sale en las tres, que es lo que tiene que pasar: cuando se prepare el
 * agua hay que verlo, y cuando se preparen las bolsas también.
 */
const COLUMNA_COMPRA = {
  marqueta: 'compra_marqueta', bolsa: 'compra_bolsa', agua: 'compra_agua'
};

router.get('/', verClientes, (req, res) => {
  let clientes = clientesConEstado({ incluirBajas: req.query.incluirBajas === '1' });
  if (req.query.deben === '1') clientes = clientes.filter((c) => c.estado.saldo > 0);

  const columna = COLUMNA_COMPRA[String(req.query.compra || '')];
  if (columna) clientes = clientes.filter((c) => c[columna] === 1);

  const busca = String(req.query.busca || '').trim().toLowerCase();
  if (busca) {
    clientes = clientes.filter((c) =>
      `${c.nombre} ${c.negocio || ''} ${c.telefono || ''}`.toLowerCase().includes(busca));
  }

  // Las listas de mayoreo van con la lista de clientes: la pantalla las
  // necesita para el selector de cada ficha, y son cinco renglones.
  // Cuántos hay en cada pestaña, SIN el filtro puesto: la pestaña tiene que
  // poder decir "Agua (14)" aunque ahorita se esté mirando la de bolsas.
  const todos = clientesConEstado({ incluirBajas: req.query.incluirBajas === '1' });
  const porLinea = {
    marqueta: todos.filter((c) => c.compra_marqueta === 1).length,
    bolsa: todos.filter((c) => c.compra_bolsa === 1).length,
    agua: todos.filter((c) => c.compra_agua === 1).length,
    todos: todos.length
  };

  return ok(res, {
    clientes,
    porLinea,
    cartera: resumenCartera(),
    listas: listasDeMayoreo().map((l) => ({ id: l.id, nombre: l.nombre })),
    mayoreoPorOmision: listaPorOmision()?.nombre || null
  });
});

/** Un cliente con su cuenta corriente: es la ficha completa. */
/**
 * SEGUIR UN ENLACE DE GOOGLE MAPS  (v5.7.1)
 *
 * El enlace corto del celular no trae las coordenadas: hay que seguirlo
 * hasta el largo, y eso solo lo puede hacer el servidor. Va ANTES de las
 * rutas con /:id para que "ubicacion" no se lea como el id de alguien.
 */
router.post('/ubicacion', verClientes, async (req, res) => {
  const enlace = String(req.body?.enlace || '').trim().slice(0, 2000);
  if (!enlace) return error(res, 'Pega el enlace.');
  const punto = await resolverEnlace(enlace);
  if (!punto) {
    return error(res, 'De ese enlace no salieron coordenadas. Prueba con «Tocar en el mapa».', 404);
  }
  return ok(res, punto);
});

router.get('/:id', verClientes, (req, res) => {
  const c = clientePorId(req.params.id);
  if (!c) return error(res, 'Ese cliente no existe.', 404);
  return ok(res, { cliente: conEstado(c), cuenta: cuentaCorriente(c.id) });
});

/**
 * LA FOTO O EL LOGO  (v3.8)
 *
 * Sube la que sea y reemplaza la anterior: `fotos.guardar` borra la vieja
 * antes de escribir la nueva, y el nombre lleva la hora para que el
 * navegador no siga enseñando la de antes desde su caché.
 */
router.post('/:id/foto', administrar, (req, res) => {
  const c = clientePorId(req.params.id);
  if (!c) return error(res, 'Ese cliente no existe.', 404);

  const r = fotos.guardar(c.id, req.body?.archivo);
  if (r.error) return error(res, r.error);

  bd.prepare('UPDATE clientes SET foto = ? WHERE id = ?').run(r.archivo, c.id);
  bitacora.registrar({
    accion: 'cliente.foto', entidad: 'cliente', entidadId: c.id,
    ejecutorId: req.usuario.id, detalle: { nombre: c.nombre }
  });
  return ok(res, { cliente: conEstado(clientePorId(c.id)) });
});

router.delete('/:id/foto', administrar, (req, res) => {
  const c = clientePorId(req.params.id);
  if (!c) return error(res, 'Ese cliente no existe.', 404);

  fotos.quitar(c.id);
  bd.prepare('UPDATE clientes SET foto = NULL WHERE id = ?').run(c.id);
  bitacora.registrar({
    accion: 'cliente.foto_quitada', entidad: 'cliente', entidadId: c.id,
    ejecutorId: req.usuario.id, detalle: { nombre: c.nombre }
  });
  return ok(res, { cliente: conEstado(clientePorId(c.id)) });
});

// ============================================================
// ALTA Y EDICIÓN
// ============================================================

/**
 * Qué le compra, leído del cuerpo.
 *
 * Con `porOmision` —solo en el alta— un cliente al que no se le marcó nada
 * queda como de marquetas. Sin eso quedaría fuera de las tres pestañas y no
 * habría forma de encontrarlo más que buscándolo por nombre.
 */
function leerCompra(cuerpo, { porOmision = false } = {}) {
  const c = {
    marqueta: cuerpo?.compra_marqueta ? 1 : 0,
    bolsa: cuerpo?.compra_bolsa ? 1 : 0,
    agua: cuerpo?.compra_agua ? 1 : 0
  };
  if (porOmision && !c.marqueta && !c.bolsa && !c.agua) c.marqueta = 1;
  return c;
}

/** Una coordenada creíble, o null. La misma regla que en las neveras. */
function coordenada(v, tope) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= tope ? n : null;
}

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

  // QUÉ LE COMPRA. Si no se dice nada se marca marquetas, que es a lo que
  // se dedica la fábrica: un cliente sin ninguna marca no saldría en
  // ninguna pestaña y sería invisible.
  const compra = leerCompra(req.body, { porOmision: true });

  const id = nuevoId();

  // EL NÚMERO DEL CLIENTE. Es para teclearlo en la caja: "7" y enter, en vez
  // de escribir "Pescadería Chuc" con gente esperando. Se toma DENTRO de la
  // transacción, igual que el folio de un ticket, y no se reusa nunca: el
  // número es del cliente aunque se dé de baja (regla 3.3).
  const alta = bd.transaction(() => {
    const numero = bd.prepare('SELECT COALESCE(MAX(numero), 0) n FROM clientes').get().n + 1;
    bd.prepare(`
      INSERT INTO clientes (id, numero, nombre, negocio, telefono, direccion, notas,
                            limite_centavos, dias_plazo, fecha_alta, creado_por,
                            compra_marqueta, compra_bolsa, compra_agua,
                            horario_entrega, referencias, latitud, longitud)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, numero, nombre.slice(0, 80),
           (req.body?.negocio || '').trim().slice(0, 80) || null,
           (req.body?.telefono || '').trim().slice(0, 30) || null,
           (req.body?.direccion || '').trim().slice(0, 200) || null,
           (req.body?.notas || '').trim().slice(0, 500) || null,
           limiteCentavos,
           plazo.omitido ? null : plazo.valor,
           ahora(), req.usuario.id,
           compra.marqueta, compra.bolsa, compra.agua,
           (req.body?.horarioEntrega || '').trim().slice(0, 120) || null,
           (req.body?.referencias || '').trim().slice(0, 300) || null,
           coordenada(req.body?.latitud, 90), coordenada(req.body?.longitud, 180));
    return numero;
  });
  alta();

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
    ['direccion', 'direccion', 200], ['notas', 'notas', 500],
    ['horarioEntrega', 'horario_entrega', 120], ['referencias', 'referencias', 300]
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

  // QUÉ LE COMPRA. Cada marca llega sola: prender "agua" no apaga las otras.
  for (const [clave, columna] of Object.entries(COLUMNA_COMPRA)) {
    if (req.body?.[`compra_${clave}`] !== undefined) {
      campos[columna] = req.body[`compra_${clave}`] ? 1 : 0;
    }
  }

  // La ubicación, para el mapa y para el QR de la nota de entrega.
  for (const [clave, columna, tope] of [
    ['latitud', 'latitud', 90], ['longitud', 'longitud', 180]
  ]) {
    if (req.body?.[clave] !== undefined) campos[columna] = coordenada(req.body[clave], tope);
  }

  // A qué precio le toca. Vacío = precio de público, que es casi todo el
  // mundo. Solo listas de MAYOREO: asignarle la de público a un cliente
  // sería una forma silenciosa de dejarlo fuera cuando se cambie la activa.
  if (req.body?.listaId !== undefined) {
    const id = String(req.body.listaId || '').trim();
    if (!id) {
      campos.lista_id = null;
    } else {
      const l = bd.prepare(
        "SELECT * FROM listas_precios WHERE id = ? AND activo = 1 AND tipo = 'mayoreo'"
      ).get(id);
      if (!l) return error(res, 'Esa lista de mayoreo no existe.');
      campos.lista_id = l.id;
    }
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

  const turno = sesionAbierta();
  const ejecutorId = req.body?.ejecutorId || req.usuario.id;

  // Cómo se escribe un abono vive en `abonos.js`, porque desde la v5.3 hay
  // dos sitios que lo hacen: esta cobranza y el mostrador.
  const { id, movimientoId } = bd.transaction(() => apuntarAbono({
    cliente: c, centavos, formaPago, turno,
    ejecutorId, capturistaId: req.usuario.id,
    notas: (req.body?.notas || '').trim() || null
  }))();

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

/**
 * BORRAR UN CLIENTE DE VERDAD.
 *
 * Solo al que nunca tuvo movimientos: el que se dio de alta dos veces, el
 * que se escribió mal. En cuanto alguien se llevó algo fiado o dejó un
 * abono, su nombre está en tickets ya cobrados y en cuentas del día, y
 * borrarlo dejaría el histórico mintiendo. A ese se le da de baja.
 *
 * Pide la CONTRASEÑA del administrador, no un PIN.
 */
router.delete('/:id', administrar, (req, res) => {
  const c = clientePorId(req.params.id);
  if (!c) return error(res, 'Ese cliente no existe.', 404);

  const tickets = bd.prepare('SELECT COUNT(*) n FROM ventas WHERE cliente_id = ?').get(c.id).n;
  const abonos = bd.prepare('SELECT COUNT(*) n FROM abonos WHERE cliente_id = ?').get(c.id).n;
  if (tickets || abonos) {
    return error(res,
      `${c.nombre} ya tiene movimientos: ${tickets} ticket${tickets === 1 ? '' : 's'} ` +
      `y ${abonos} abono${abonos === 1 ? '' : 's'}. Eso no se borra, porque su nombre ` +
      'está en tickets ya cobrados. Dale de baja.',
      409, { tickets, abonos, sugerencia: 'baja' });
  }

  const auth = comprobarAdmin(req.body?.autorizacion);
  if (auth.error) {
    return error(res, auth.error, 403, {
      requiereContrasena: true, administradores: administradores()
    });
  }

  bd.prepare('DELETE FROM clientes WHERE id = ?').run(c.id);
  bitacora.registrar({
    accion: 'cliente.eliminado', entidad: 'cliente', entidadId: c.id,
    ejecutorId: auth.usuario.id, capturistaId: req.usuario.id,
    detalle: { nombre: c.nombre }
  });

  return ok(res, { eliminado: c.nombre });
});

module.exports = router;
