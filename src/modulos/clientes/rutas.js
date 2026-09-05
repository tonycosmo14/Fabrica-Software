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
const { puede } = require('../../lib/roles');
const { resolverEnlace } = require('../../lib/enlaces-mapa');
const { comprobarAdmin, administradores } = require('../../lib/autorizacion');
const { sesionAbierta } = require('../caja/calculo');
const { apuntarAbono } = require('./abonos');
const { listasDeMayoreo, listaPorOmision } = require('../ventas/mayoreo');
const {
  estadoCliente, cuentaCorriente, clientesConEstado, resumenCartera,
  garrafonesDe, garrafonesHistorial, preciosDe, precioDeMostrador, neverasDe
} = require('./calculo');
// Las mismas fotos que las de los productos: misma carpeta, mismas
// comprobaciones y el mismo sitio para servirlas. Un logo de tienda no
// tiene nada de secreto —está pintado en la fachada— así que no hace
// falta el trato de los papeles de la empresa.
const fotos = require('../catalogo/fotos');

const router = express.Router();

/**
 * CADA CUÁNTO SE LE SURTE, dicho por él  (v6.9)
 *
 * Es el ACUERDO, no lo que pasó: lo que pasó sale de los tickets y vive en
 * `estado.ritmo`. Los dos hacen falta y dicen cosas distintas — el que
 * quedó en diario y lleva cuatro días sin pedir es una llamada que hacer.
 */
const FRECUENCIAS = [
  { clave: 'diario', nombre: 'Diario (lunes a domingo)', corto: 'Diario' },
  { clave: 'lun_sab', nombre: 'Diario (lunes a sábado)', corto: 'Lun a Sáb' },
  { clave: '3x_semana', nombre: 'Tres veces por semana', corto: '3x Semana' },
  { clave: 'semanal', nombre: 'Una vez por semana', corto: 'Semanal' },
  { clave: 'quincenal', nombre: 'Cada quince días', corto: 'Quincenal' },
  { clave: 'fines', nombre: 'Fines de semana', corto: 'Fines de sem.' },
  { clave: 'eventual', nombre: 'Cuando llama', corto: 'Eventual' }
];

/** Cómo se acordó que paga. */
const METODOS_PAGO = [
  { clave: 'contado', nombre: 'De contado, al entregar' },
  { clave: 'credito', nombre: 'Línea de crédito' },
  { clave: 'transferencia', nombre: 'Transferencia' }
];

/**
 * Los regímenes del SAT que se ven aquí. No es la lista completa —son
 * cincuenta y tantos— sino los que le tocan a una fábrica de hielo y a sus
 * clientes: restaurantes, tienditas y personas físicas.
 */
const REGIMENES = [
  { clave: '601', nombre: '601 - General de Ley Personas Morales' },
  { clave: '603', nombre: '603 - Personas Morales con Fines no Lucrativos' },
  { clave: '605', nombre: '605 - Sueldos y Salarios' },
  { clave: '612', nombre: '612 - Actividades Empresariales y Profesionales' },
  { clave: '616', nombre: '616 - Sin obligaciones fiscales' },
  { clave: '621', nombre: '621 - Incorporación Fiscal' },
  { clave: '626', nombre: '626 - Régimen Simplificado de Confianza (RESICO)' }
];

const CATALOGOS = { frecuencias: FRECUENCIAS, metodosPago: METODOS_PAGO, regimenes: REGIMENES };

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

  // LOS DE SIEMPRE Y LOS DE UNA VEZ  (v6.4): sale de los tickets.
  const ritmo = String(req.query.ritmo || '');
  if (ritmo === 'frecuente') clientes = clientes.filter((c) => c.estado.ritmo.frecuente);
  else if (ritmo === 'ocasional') clientes = clientes.filter((c) => !c.estado.ritmo.frecuente);

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
    frecuentes: todos.filter((c) => c.estado.ritmo.frecuente).length,
    ocasionales: todos.filter((c) => !c.estado.ritmo.frecuente).length,
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
    mayoreoPorOmision: listaPorOmision()?.nombre || null,
    ...CATALOGOS
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
  return ok(res, {
    cliente: conEstado(c),
    cuenta: cuentaCorriente(c.id),
    precios: preciosDe(c.id),
    garrafones: { ...garrafonesDe(c.id, c), historial: garrafonesHistorial(c.id) },
    neveras: neverasDe(c.id),
    ...CATALOGOS
  });
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

/**
 * LOS CAMPOS DE TEXTO QUE SE GUARDAN TAL CUAL  (v6.9)
 *
 * Uno por renglón, con su largo, para que agregar el siguiente sea agregar
 * un renglón y no tocar tres sitios. El largo no es capricho: un RFC son
 * 13 caracteres y un campo de 200 solo sirve para que alguien pegue ahí un
 * párrafo entero.
 */
const CAMPOS_TEXTO = [
  ['negocio', 'negocio', 80], ['telefono', 'telefono', 30],
  ['direccion', 'direccion', 200], ['notas', 'notas', 500],
  ['horarioEntrega', 'horario_entrega', 120], ['referencias', 'referencias', 300],
  ['razonSocial', 'razon_social', 160], ['rfc', 'rfc', 13],
  ['correo', 'correo', 120], ['zona', 'zona', 60],
  ['giro', 'giro', 60], ['instrucciones', 'instrucciones', 500]
];

/** Una hora 'HH:MM' normalizada, o null si no se entiende. */
function leerHora(v) {
  const t = String(v ?? '').trim();
  if (!t) return null;
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(t);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : undefined;   // undefined = mal escrita
}

/** Uno de una lista cerrada, vacío, o `undefined` si no está en la lista. */
function leerDeCatalogo(v, catalogo) {
  const t = String(v ?? '').trim();
  if (!t) return null;
  return catalogo.some((x) => x.clave === t) ? t : undefined;
}

/**
 * Los campos del alta y de la edición que van a columnas, resueltos una
 * sola vez para los dos sitios. Devuelve { campos } o { error }.
 */
function leerCamposNuevos(cuerpo, { soloLosQueVienen = true } = {}) {
  const campos = {};
  const puesto = (k) => !soloLosQueVienen || cuerpo?.[k] !== undefined;

  for (const [clave, columna, largo] of CAMPOS_TEXTO) {
    if (!puesto(clave)) continue;
    campos[columna] = String(cuerpo?.[clave] ?? '').trim().slice(0, largo) || null;
  }
  // El RFC se guarda en mayúsculas siempre: es como viene en la constancia
  // y como se busca, y así dos capturas del mismo RFC no se ven distintas.
  if (campos.rfc) campos.rfc = campos.rfc.toUpperCase();

  for (const [clave, columna, catalogo, queEs] of [
    ['frecuencia', 'frecuencia', FRECUENCIAS, 'La frecuencia'],
    ['metodoPago', 'metodo_pago', METODOS_PAGO, 'El método de pago'],
    ['regimenFiscal', 'regimen_fiscal', REGIMENES, 'El régimen fiscal']
  ]) {
    if (!puesto(clave)) continue;
    const v = leerDeCatalogo(cuerpo?.[clave], catalogo);
    if (v === undefined) return { error: `${queEs} no es de las que conozco.` };
    campos[columna] = v;
  }

  for (const [clave, columna] of [['horaDesde', 'hora_desde'], ['horaHasta', 'hora_hasta']]) {
    if (!puesto(clave)) continue;
    const h = leerHora(cuerpo?.[clave]);
    if (h === undefined) return { error: 'La hora se escribe así: 06:30' };
    campos[columna] = h;
  }

  // LOS GARRAFONES: cuántos como máximo y cuánto dejó por cada uno. Los que
  // trae AHORA no se ponen aquí: eso son movimientos, y tienen su ruta.
  if (puesto('garrafonesLimite')) {
    const n = leerEnteroOpcional(cuerpo?.garrafonesLimite, 9999);
    if (n.error) return { error: 'El límite de garrafones se escribe con números.' };
    // `omitido` solo pasa en el alta, donde se leen todos los campos vengan
    // o no: sin límite escrito, no hay límite.
    campos.garrafones_limite = n.omitido ? null : n.valor;
  }
  if (puesto('garrafonDeposito')) {
    const crudo = String(cuerpo?.garrafonDeposito ?? '').trim();
    if (crudo === '') campos.garrafon_deposito_centavos = null;
    else {
      const centavos = leerPesos(crudo, { permitirCero: true });
      if (centavos === null) return { error: 'La garantía del garrafón no es un importe válido.' };
      campos.garrafon_deposito_centavos = centavos;
    }
  }

  return { campos };
}

/** Una coordenada creíble, o null. La misma regla que en las neveras. */
function coordenada(v, tope) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= tope ? n : null;
}

/**
 * DAR DE ALTA DESDE LA CAJA, AL TOMAR UN PEDIDO  (v5.8)
 *
 * "Me debe pedir para quién es: datos para guardar qué cliente lo va a
 *  venir a buscar, número de teléfono, ubicación."
 *
 * La cajera puede tomar pedidos pero no administra clientes —no decide a
 * quién se le fía ni cuánto—. Así que puede dar de alta a alguien con lo
 * básico (nombre, teléfono, dirección, dónde está), y NO puede ponerle
 * límite de crédito ni lista de mayoreo: eso sigue siendo del gerente.
 */
function puedeDarDeAlta(req, res, next) {
  const rol = req.usuario?.rol;
  if (!req.usuario) return error(res, 'Necesitas iniciar sesión.', 401);
  if (puede(rol, 'clientes.administrar')) return next();
  if (!puede(rol, 'pedidos.tomar')) return error(res, 'Tu rol no tiene acceso a esta operación.', 403);
  const delGerente = ['limite', 'listaId', 'diasPlazo'].filter((k) => req.body?.[k] !== undefined && req.body[k] !== '');
  if (delGerente.length) {
    return error(res, 'El límite de crédito y la lista de mayoreo los pone el gerente.', 403);
  }
  return next();
}

router.post('/', puedeDarDeAlta, (req, res) => {
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
  // Los campos de la ficha larga (v6.9). En el alta se leen TODOS, vengan
  // o no: lo que no venga queda vacío, que es lo correcto en un renglón
  // recién creado.
  const nuevos = leerCamposNuevos(req.body, { soloLosQueVienen: false });
  if (nuevos.error) return error(res, nuevos.error);
  const extra = nuevos.campos;
  const columnasExtra = Object.keys(extra);

  const alta = bd.transaction(() => {
    const numero = bd.prepare('SELECT COALESCE(MAX(numero), 0) n FROM clientes').get().n + 1;
    bd.prepare(`
      INSERT INTO clientes (id, numero, nombre,
                            limite_centavos, dias_plazo, fecha_alta, creado_por,
                            compra_marqueta, compra_bolsa, compra_agua,
                            latitud, longitud${columnasExtra.map((k) => `, ${k}`).join('')})
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${columnasExtra.map(() => ', ?').join('')})
    `).run(id, numero, nombre.slice(0, 80),
           limiteCentavos,
           plazo.omitido ? null : plazo.valor,
           ahora(), req.usuario.id,
           compra.marqueta, compra.bolsa, compra.agua,
           coordenada(req.body?.latitud, 90), coordenada(req.body?.longitud, 180),
           ...columnasExtra.map((k) => extra[k]));
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
  const nuevos = leerCamposNuevos(req.body);
  if (nuevos.error) return error(res, nuevos.error);
  Object.assign(campos, nuevos.campos);

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

// ============================================================
// LOS PRECIOS ACORDADOS, PRODUCTO POR PRODUCTO  (v6.9)
// ============================================================
//
// "Personalice los precios directos acordados para este cliente. Estos
//  valores reemplazarán automáticamente la tarifa de mostrador."
//
// Es lo más particular que hay, y por eso gana a todo lo demás. El orden
// completo, de lo más particular a lo más general:
//
//   1. el precio propio de este cliente en este producto   ← esto
//   2. la lista de mayoreo que trae asignada
//   3. el precio de mostrador
//
// Solo el gerente y el administrador: bajarle el precio a alguien es
// decidir cuánto gana la fábrica con él.

/** Los productos a los que se les puede poner precio propio. */
router.get('/:id/precios', administrar, (req, res) => {
  const c = clientePorId(req.params.id);
  if (!c) return error(res, 'Ese cliente no existe.', 404);

  return ok(res, {
    precios: preciosDe(c.id),
    // El catálogo entero, para poder agregar uno que todavía no tiene
    // precio propio. Sin esto la pantalla tendría que pedirlo aparte.
    productos: bd.prepare(`
      SELECT p.id, p.nombre, p.codigo, p.tipo, p.dieciseisavos,
             p.precio_centavos, c.nombre AS categoria
        FROM productos p
        LEFT JOIN categorias c ON c.id = p.categoria_id
       WHERE p.activo = 1
       ORDER BY c.orden, p.orden, p.nombre
    `).all().map((p) => ({ ...p, lista_centavos: precioDeMostrador(p) }))
  });
});

/**
 * Ponerle o cambiarle el precio de un producto.
 *
 * Se manda el producto y el precio; volver a mandarlo lo corrige. Un
 * precio en blanco lo QUITA, y entonces ese producto vuelve a cobrarse por
 * su lista o por el mostrador — que es lo que se quiere al terminar un
 * trato, y no dejarlo en cero.
 */
router.put('/:id/precios', administrar, (req, res) => {
  const c = clientePorId(req.params.id);
  if (!c) return error(res, 'Ese cliente no existe.', 404);

  const producto = bd.prepare('SELECT * FROM productos WHERE id = ? AND activo = 1')
    .get(String(req.body?.productoId || ''));
  if (!producto) return error(res, 'Ese producto no existe.', 404);

  const crudo = String(req.body?.precio ?? '').trim();
  const volumen = String(req.body?.volumen || '').trim().slice(0, 60) || null;

  if (crudo === '') {
    bd.prepare('DELETE FROM cliente_precios WHERE cliente_id = ? AND producto_id = ?')
      .run(c.id, producto.id);
    bitacora.registrar({
      accion: 'cliente.precio_quitado', entidad: 'cliente', entidadId: c.id,
      ejecutorId: req.usuario.id,
      detalle: { cliente: c.nombre, producto: producto.nombre }
    });
    return ok(res, { precios: preciosDe(c.id) });
  }

  // Cero sí se permite: hay clientes a los que se les regala el garrafón
  // de cortesía, y eso es un acuerdo, no un error de dedo.
  const centavos = leerPesos(crudo, { permitirCero: true });
  if (centavos === null) return error(res, 'Ese precio no se entiende.');

  bd.prepare(`
    INSERT INTO cliente_precios (id, cliente_id, producto_id, centavos, volumen,
                                 actualizado_en, actualizado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cliente_id, producto_id) DO UPDATE SET
      centavos = excluded.centavos, volumen = excluded.volumen,
      actualizado_en = excluded.actualizado_en, actualizado_por = excluded.actualizado_por
  `).run(nuevoId(), c.id, producto.id, centavos, volumen, ahora(), req.usuario.id);

  bitacora.registrar({
    accion: 'cliente.precio', entidad: 'cliente', entidadId: c.id,
    ejecutorId: req.usuario.id,
    detalle: {
      cliente: c.nombre, producto: producto.nombre,
      centavos, lista: producto.precio_centavos, volumen
    }
  });

  return ok(res, { precios: preciosDe(c.id) });
});

// ============================================================
// LOS GARRAFONES EN RESGUARDO  (v6.9)
// ============================================================
//
// El garrafón de policarbonato no se vende: se presta y se cambia lleno
// por vacío. Lo que importa es cuántos trae el cliente, porque el día que
// cierre el negocio se va con ellos.
//
// No hay contador: se apuntan los movimientos y el número se saca de
// sumarlos (regla 3.2).

router.get('/:id/garrafones', verClientes, (req, res) => {
  const c = clientePorId(req.params.id);
  if (!c) return error(res, 'Ese cliente no existe.', 404);
  return ok(res, {
    ...garrafonesDe(c.id, c),
    historial: garrafonesHistorial(c.id)
  });
});

/**
 * Apuntar garrafones entregados o devueltos.
 *
 * `cuantos` en positivo son los que se le dejaron; en negativo, los que
 * trajo de vuelta. Se manda con signo y no con un "tipo" aparte porque es
 * una sola cuenta que sube y baja, y dos campos para un signo es la forma
 * más fácil de apuntar una devolución como una entrega.
 */
router.post('/:id/garrafones', cobrar, (req, res) => {
  const c = clientePorId(req.params.id);
  if (!c) return error(res, 'Ese cliente no existe.', 404);

  const n = Number(req.body?.cuantos);
  if (!Number.isInteger(n) || n === 0) {
    return error(res, 'Escribe cuántos garrafones, en positivo si se le dejaron ' +
                      'y en negativo si los trajo.');
  }
  if (Math.abs(n) > 999) return error(res, 'Eso son demasiados garrafones de un jalón.');

  const antes = garrafonesDe(c.id, c);
  if (antes.retenidos + n < 0) {
    return error(res,
      `${c.nombre} solo tiene ${antes.retenidos} garrafón${antes.retenidos === 1 ? '' : 'es'} ` +
      'en resguardo: no puede devolver más de los que trae.', 409);
  }

  const id = nuevoId();
  bd.prepare(`
    INSERT INTO garrafones_movimientos
      (id, cliente_id, fecha, cuantos, motivo, ejecutor_id, capturista_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, c.id, ahora(), n,
         String(req.body?.motivo || '').trim().slice(0, 200) || null,
         String(req.body?.ejecutorId || '').trim() || req.usuario.id,
         req.usuario.id);

  const despues = garrafonesDe(c.id, c);
  bitacora.registrar({
    accion: n > 0 ? 'cliente.garrafones_entregados' : 'cliente.garrafones_devueltos',
    entidad: 'cliente', entidadId: c.id, ejecutorId: req.usuario.id,
    detalle: { cliente: c.nombre, cuantos: n, quedan: despues.retenidos }
  });

  // Pasarse del límite NO se rechaza: el garrafón ya se lo llevó y
  // esconderlo no lo trae de vuelta. Se avisa y queda apuntado.
  return ok(res, {
    ...despues,
    historial: garrafonesHistorial(c.id),
    aviso: despues.pasado
      ? `${c.nombre} trae ${despues.retenidos} y se le habían autorizado ${despues.limite}.`
      : null
  }, 201);
});

/** Un movimiento mal capturado se anula; la cuenta se rehace sola. */
router.post('/garrafones/:id/anular', cobrar, (req, res) => {
  const m = bd.prepare('SELECT * FROM garrafones_movimientos WHERE id = ?').get(req.params.id);
  if (!m) return error(res, 'Ese movimiento no existe.', 404);
  if (m.anulado_en) return error(res, 'Ese movimiento ya está anulado.');

  const motivo = String(req.body?.motivo || '').trim().slice(0, 200);
  if (!motivo) return error(res, 'Escribe por qué se anula.');

  bd.prepare(`
    UPDATE garrafones_movimientos
       SET anulado_en = ?, anulado_por = ?, motivo_anulacion = ?
     WHERE id = ?
  `).run(ahora(), req.usuario.id, motivo, m.id);

  bitacora.registrar({
    accion: 'cliente.garrafones_anulado', entidad: 'cliente', entidadId: m.cliente_id,
    ejecutorId: req.usuario.id, detalle: { cuantos: m.cuantos, motivo }
  });

  return ok(res, {
    ...garrafonesDe(m.cliente_id),
    historial: garrafonesHistorial(m.cliente_id)
  });
});

module.exports = router;
