/**
 * PUNTO DE VENTA  (v0.8)
 *
 * Reglas que manda el plan:
 *
 *  3.1  El hielo se cobra en dieciseisavos enteros.
 *  3.5  El precio se COPIA dentro de la venta. Si mañana suben los precios,
 *       los tickets de ayer no cambian.
 *  7.2  Cada fracción tiene su precio; no se divide el de la marqueta.
 *  7.3  Folio consecutivo histórico. Nunca se reinicia ni se reutiliza.
 *  7.4  Una venta cobrada NO SE EDITA. Si algo salió mal se cancela, y la
 *       cancelación es un registro aparte con su motivo y su responsable.
 */
const express = require('express');
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');
const { ok, error } = require('../../lib/respuestas');
const { aTexto, validar } = require('../../lib/fracciones');
// Cuánto hielo queda, para enseñárselo al dueño en el mostrador.
const { hieloQueQueda } = require('../existencia/calculo');
const { aCentavos, formato } = require('../../lib/dinero');
const bitacora = require('../../lib/bitacora');
const { exigirPermiso } = require('../../middleware/sesion');
const { puede } = require('../../lib/roles');
const { listaActiva, preciosDe, precioDe, sugerencia } = require('./precios');
const { sesionAbierta, recalcularCorte } = require('../caja/calculo');
const { conteoDelTurno } = require('../caja/hielo');
const { corregirConteosQueAbarcan } = require('../existencia/correccion');
const { apuntarAbono } = require('../clientes/abonos');
const { marcarLoQueCompra } = require('../clientes/etiquetas');
const { productoPorId, productoPorCodigo, cotizar,
        categoriasActivas, productosActivos } = require('../catalogo/catalogo');
const { alcanza, avisos } = require('../catalogo/avisos');
const { configuracion: configuracionImpresion } = require('../impresion/impresora');
const { cabeElCredito, estadoCliente, clientesConEstado } = require('../clientes/calculo');
const { listaDeMayoreo, listaPorOmision, listasDeMayoreo,
        llevaMayoreo } = require('./mayoreo');
const { serieDeHoy, siguienteEnLaSerie, numeroDeTicket, leerNumero } = require('./folio');
const { rejillaDeLaCaja } = require('../personalizacion/rejilla');
const { comprobar: comprobarAutorizacion, comprobarAdmin,
        responsables, administradores } = require('../../lib/autorizacion');

const router = express.Router();

/**
 * POR QUÉ SE DEVUELVE EL DINERO.
 *
 * Una lista corta y cerrada, no texto libre. "Se cansó de esperar" veinte
 * veces en un mes es un problema de la fila, y eso no se ve si cada quien
 * lo escribe distinto.
 */
const MOTIVOS_DEVOLUCION = {
  espera:     'El cliente se cansó de esperar',
  prisa:      'El cliente llevaba prisa y se fue',
  calidad:    'El hielo no estaba bien congelado',
  equivocado: 'Se capturó algo que no era',
  otro:       'Otro motivo'
};

const verVentas = exigirPermiso('caja.ver');
const vender = exigirPermiso('venta.registrar');
const configurarPrecios = exigirPermiso('precios.configurar');

const MAX_DIECISEISAVOS = 16 * 500;      // 500 marquetas de tope por venta

// Lista cerrada a propósito: el arqueo del cajón solo cuenta 'efectivo', y
// una forma de pago inventada dejaría dinero fuera del corte sin aviso.
const FORMAS_DE_PAGO = ['efectivo', 'transferencia', 'credito'];

// ============================================================
// LO QUE NECESITA LA PANTALLA DE VENTA
// ============================================================

router.get('/contexto', vender, (req, res) => {
  const lista = listaActiva();
  if (!lista) return error(res, 'No hay ninguna lista de precios activa.', 409);

  const precios = [...preciosDe(lista.id).entries()]
    .map(([dieciseisavos, centavos]) => ({ dieciseisavos, centavos, etiqueta: aTexto(dieciseisavos) }))
    .sort((a, b) => b.dieciseisavos - a.dieciseisavos);

  const almacenes = bd.prepare(
    'SELECT id, nombre FROM almacenes WHERE activo = 1 AND recibe_produccion = 1 ORDER BY orden'
  ).all();

  // El número que va a llevar el siguiente ticket, ya con su serie.
  const serieHoy = serieDeHoy(bd);
  const siguienteNumero = `${serieHoy}-${siguienteEnLaSerie(bd, serieHoy)}`;

  // Se puede cobrar sin turno de caja abierto: la fábrica no se para porque
  // alguien olvidó abrirla. Pero ese dinero no entra en ningún corte, así
  // que la pantalla tiene que decirlo bien claro.
  const caja = sesionAbierta();

  return ok(res, {
    lista, precios, almacenes,
    siguienteNumero,
    // Si el cajón está configurado, la caja lo abre sola al cobrar en
    // efectivo. Sin esto tendría que preguntar por la configuración de
    // impresión en cada venta.
    abrirCajon: configuracionImpresion().abrirCajon,
    // Cuántos cuadros de producto quiere ver de una vez el dueño. Se
    // configura en Personalizar y viaja con el contexto para que la caja no
    // tenga que preguntar por su cuenta cada vez que se repinta.
    rejilla: rejillaDeLaCaja(),
    // sinDueno: el turno del relevo de las 2:30, que sigue cobrando
    // mientras el cajero que entra no llega. La caja tiene que decirlo.
    caja: caja
      ? { folio: caja.folio, cajero: caja.cajero_nombre, sinDueno: !caja.cajero_id }
      : null,
    categorias: categoriasActivas(),
    productos: productosActivos(),
    avisos: avisos(),
    // CUÁNTO HIELO QUEDA, SOLO PARA EL ADMINISTRADOR  (v4.1)
    //
    // Ningún rol lista este permiso, así que solo lo alcanza el comodín del
    // dueño. No es secreto: es que en el mostrador, con gente esperando, un
    // número más que leer es un número más que estorba — y el cajero ya
    // tiene el suyo en el cuadre del turno.
    cuartoFrio: puede(req.usuario.rol, 'existencia.ver_en_caja')
      ? (() => { const h = hieloQueQueda();
                 return h ? { ...h, texto: aTexto(h.dieciseisavos) } : null; })()
      : null,
    // Las listas de mayoreo, con sus precios. La caja las necesita enteras
    // para poder repintar el ticket en el acto cuando el cajero dice de
    // quién es. El servidor vuelve a decidir al cobrar; esto es la pantalla.
    mayoreo: {
      // La que se cobra mientras no se sabe quién es el cliente.
      porOmision: listaPorOmision()?.id || null,
      listas: listasDeMayoreo().map((l) => ({
        id: l.id, nombre: l.nombre,
        precios: [...preciosDe(l.id).entries()]
          .map(([dieciseisavos, centavos]) => ({ dieciseisavos, centavos }))
      }))
    },
    // A quién se le puede fiar. Va con el contexto para que el cajero no
    // espere a que cargue una lista con el cliente enfrente.
    puedeFiar: puede(req.usuario.rol, 'venta.credito'),
    // La lista de clientes la usan DOS cosas: fiar y el precio de mayoreo.
    // Por eso basta con poder verlos, no con poder fiarles.
    clientes: puede(req.usuario.rol, 'clientes.ver')
      ? clientesConEstado().map((c) => ({
          id: c.id, nombre: c.nombre, negocio: c.negocio,
          saldo: c.estado.saldo, limite: c.estado.limite,
          disponible: c.estado.disponible, vencido: c.estado.vencido,
          listaId: c.lista_id || null,
          // Para teclear "7" y enter en vez de escribir el nombre.
          numero: c.numero || null
        }))
      : []
  });
});

/** Cuánto costaría una cantidad, sin registrar nada. */
router.get('/precio', vender, (req, res) => {
  const lista = listaActiva();
  if (!lista) return error(res, 'No hay ninguna lista de precios activa.', 409);

  const cantidad = Number(req.query.dieciseisavos);
  if (!Number.isInteger(cantidad) || cantidad <= 0) return error(res, 'Cantidad inválida.');

  return ok(res, { ...precioDe(cantidad, lista.id), cantidad, texto: aTexto(cantidad) });
});

// ============================================================
// COBRAR
// ============================================================

router.post('/', vender, (req, res) => {
  const lineas = req.body?.lineas;
  if (!Array.isArray(lineas) || !lineas.length) return error(res, 'La venta está vacía.');
  if (lineas.length > 50) return error(res, 'Demasiadas líneas en una sola venta.');

  if (!listaActiva()) return error(res, 'No hay ninguna lista de precios activa.', 409);

  // Ojo: a SQLite hay que darle null, nunca undefined. Si la pantalla no
  // manda almacén, se cobra contra el cuarto frío que recibe la producción.
  const almacen = bd.prepare(
    'SELECT * FROM almacenes WHERE id = ? AND activo = 1'
  ).get(req.body?.almacenId ?? null) || bd.prepare(
    'SELECT * FROM almacenes WHERE activo = 1 AND recibe_produccion = 1 ORDER BY orden LIMIT 1'
  ).get();

  // ---- QUIÉN ES, Y CON QUÉ LISTA SE LE COBRA ----
  //
  // Esto va ANTES de cotizar, porque las líneas de mayoreo se cobran con la
  // lista del cliente. Y se decide AQUÍ desde cero aunque la pantalla ya lo
  // haya calculado: si no, bastaría con mandar otro clienteId para llevarse
  // el precio de alguien más.
  const clienteDelTicket = req.body?.clienteId
    ? bd.prepare('SELECT * FROM clientes WHERE id = ?').get(req.body.clienteId)
    : null;

  const lista = listaActiva();

  // UN TICKET CON MAYOREO NO SE COBRA SIN NOMBRE. El precio especial es de
  // alguien; sin saber de quién, al mes nadie puede explicar por qué esa
  // marqueta salió a $240. La pantalla pide el cliente antes de cobrar,
  // pero la regla vive aquí, que es donde no se puede saltar.
  const conMayoreo = llevaMayoreo(lineas, { porId: productoPorId, porCodigo: productoPorCodigo });
  if (conMayoreo && !clienteDelTicket) {
    return error(res, 'Este ticket lleva mayoreo: falta decir de quién es.', 409,
                 { faltaCliente: true });
  }

  const listaMayoreo = conMayoreo ? listaDeMayoreo(clienteDelTicket) : null;

  const preparadas = prepararLineas(lineas, lista, listaMayoreo);
  if (preparadas.error) return error(res, preparadas.error, preparadas.codigo || 400);

  // --- Forma de pago ---
  // Se valida contra una lista cerrada: el arqueo del cajón solo cuenta lo
  // que dice 'efectivo', así que una forma de pago inventada sacaría dinero
  // del corte sin que nadie lo notara.
  const formaPago = req.body?.formaPago || 'efectivo';
  if (!FORMAS_DE_PAGO.includes(formaPago)) {
    return error(res, 'Esa forma de pago no existe.');
  }

  // ============================================================
  // PAGA UNA PARTE Y DEBE LA OTRA  (v5.3)
  // ============================================================
  //
  // "El cliente se lleva dos marquetas de $480 pero solo paga $300 y queda
  //  debiendo $180."
  //
  // Pasa todos los días y antes había que hacerlo en dos viajes: cerrar la
  // venta a crédito por el total, salirse a Clientes y apuntarle un abono.
  //
  // POR QUÉ SE GUARDA COMO VENTA COMPLETA + ABONO, y no como una venta que
  // dice "pagó $300":
  //
  //   · La cuenta del cliente queda contando lo que de verdad pasó: se
  //     llevó $480 y entregó $300. En su estado de cuenta salen los dos
  //     renglones, con su fecha, como cualquier otro cargo y abono.
  //   · El cajón recibe el abono por el mismo camino que la cobranza de
  //     siempre, así que el corte cuadra sin tocar nada.
  //   · Y `pago_centavos` sigue queriendo decir una sola cosa: lo que se
  //     pagó de contado. Un ticket a crédito que dijera "pagó $300"
  //     mientras la cuenta dice "debe $480" sería dos verdades sobre el
  //     mismo dinero.
  let abono = null;
  if (req.body?.abono !== undefined && req.body.abono !== null && req.body.abono !== '') {
    if (formaPago !== 'credito') {
      return error(res, 'El abono de mostrador solo va con las ventas a crédito.');
    }
    try { abono = aCentavos(req.body.abono); }
    catch { return error(res, 'Lo que abona no es un importe válido.'); }

    if (abono <= 0) abono = null;
    else if (abono > preparadas.total) {
      // Pagar de más aquí casi siempre es un dedazo, y si de verdad quiere
      // adelantar de lo viejo, eso es cobranza y tiene su pantalla — donde
      // además se ve contra qué se está aplicando.
      return error(res,
        `No puede abonar más de lo que se lleva (${formato(preparadas.total)}). ` +
        'Para abonar a lo que debía de antes, hazlo desde su ficha en Clientes.');
    } else if (abono === preparadas.total) {
      return error(res,
        'Si lo paga todo no es a crédito: cóbraselo normal y no le queda deuda.');
    }
  }

  // --- A crédito ---
  //
  // El límite se revisa contra lo que DE VERDAD se le va a quedar a deber.
  // A un cliente pegado a su límite que paga casi todo el ticket no tiene
  // sentido pararle la venta y pedir la autorización de un gerente por
  // ciento ochenta pesos.
  const aCredito = preparadas.total - (abono || 0);
  const credito = formaPago === 'credito'
    ? revisarCredito(req, aCredito, clienteDelTicket)
    : { ok: true };
  if (!credito.ok) return error(res, credito.mensaje, credito.codigo, credito.extra || {});

  // ============================================================
  // LA VENTA QUE FALTÓ EN UN CORTE YA CERRADO  (v6.1)
  // ============================================================
  //
  // "Cerré el corte y faltaba una venta: una marqueta de mayoreo y veinte
  //  bolsas. El sistema no me dejaba corregirlo."
  //
  // Se cobra igual que cualquiera, pero amarrada a ESE turno y con la
  // fecha de ese turno —justo antes de que se contara el hielo, si se
  // contó, porque ese hielo salió antes del conteo—. Solo el administrador
  // (caja.corregir_corte), con su porqué, y el corte se vuelve a sacar
  // solo: lo contado no se toca, lo que debía haber sí.
  let corteCerrado = null;
  let motivoCorreccion = null;
  let fechaForzada = null;
  if (req.body?.cajaId) {
    if (!puede(req.usuario.rol, 'caja.corregir_corte')) {
      return error(res, 'Agregar una venta a un corte cerrado es solo del administrador.', 403);
    }
    corteCerrado = bd.prepare('SELECT * FROM cajas WHERE id = ?').get(req.body.cajaId);
    if (!corteCerrado) return error(res, 'Ese corte no existe.', 404);
    if (!corteCerrado.cerrada_en) {
      return error(res, 'Ese turno sigue abierto: cóbrala normal y entra sola.', 409);
    }
    motivoCorreccion = String(req.body?.motivoCorreccion || '').trim();
    if (!motivoCorreccion) return error(res, 'Escribe por qué faltó esta venta en el corte.');

    const conteo = conteoDelTurno(corteCerrado.id);
    const tope = conteo && conteo.fecha < corteCerrado.cerrada_en ? conteo.fecha : corteCerrado.cerrada_en;
    fechaForzada = new Date(new Date(tope).getTime() - 1000).toISOString();
    if (fechaForzada < corteCerrado.abierta_en) fechaForzada = corteCerrado.abierta_en;
  }

  // --- Pago ---
  let pago = null;
  if (req.body?.pago !== undefined && req.body.pago !== null && req.body.pago !== '') {
    try { pago = aCentavos(req.body.pago); } catch { return error(res, 'El pago no es un importe válido.'); }
    if (pago < preparadas.total) return error(res, 'El pago es menor que el total.');
  }
  // Fiado quiere decir que no pagó. Guardar un pago aquí haría que el
  // ticket dijera "pagó" y la cuenta del cliente dijera "debe".
  if (formaPago === 'credito') pago = null;

  const venta = crearVenta({
    lineas: preparadas.lineas,
    total: preparadas.total,
    pago,
    // Lo que deja en el momento. Va DENTRO de la misma transacción que la
    // venta: si una se guarda y la otra no, o el cajón sobra o el cliente
    // debe algo que ya pagó.
    abono,
    abonoFormaPago: req.body?.abonoFormaPago === 'transferencia'
      ? 'transferencia' : 'efectivo',
    cliente: clienteDelTicket,
    // Se guarda la lista que EXPLICA el precio: si hubo mayoreo, esa. Los
    // precios ya van copiados renglón por renglón (regla 3.5); esto es para
    // que el ticket y el historial puedan decir "salió a precio de Mayoreo 1".
    lista: listaMayoreo || lista,
    almacenId: almacen?.id || null,
    cajeroId: req.body?.cajeroId || req.usuario.id,
    capturistaId: req.usuario.id,
    formaPago,
    notas: req.body?.notas || null,
    // El cliente se guarda aunque haya pagado en efectivo: es lo que
    // explica por qué ese ticket salió a precio de mayoreo.
    clienteId: clienteDelTicket?.id || null,
    autorizadoPor: credito.autorizadoPor || null,
    // Al corte cerrado, con su fecha (v6.1).
    cajaForzada: corteCerrado, fechaForzada, motivoCorreccion
  });

  // EL CORTE SE VUELVE A SACAR SOLO, y el cuadre de hielo de ese turno
  // también si la venta llevaba hielo.
  let correccion = null;
  if (corteCerrado) {
    const r = recalcularCorte(corteCerrado.id, {
      usuarioId: req.usuario.id,
      motivo: `Faltaba el ticket ${venta.numero}: ${motivoCorreccion}`
    });
    const conteos = preparadas.lineas.some((l) => l.dieciseisavos > 0)
      ? corregirConteosQueAbarcan(fechaForzada, {
          usuarioId: req.usuario.id, almacenId: almacen?.id || null,
          motivo: `Faltaba el ticket ${venta.numero}: ${motivoCorreccion}`
        })
      : [];
    correccion = {
      corte: {
        id: corteCerrado.id, folio: corteCerrado.folio,
        diferenciaAntes: r?.antes?.diferencia_centavos ?? null,
        diferenciaAhora: r?.ahora?.diferencia_centavos ?? null
      },
      conteos: conteos.map((c) => ({
        id: c.id, faltanteAntes: c.antes.faltante, faltanteAhora: c.ahora.faltante
      }))
    };
  }

  bitacora.registrar({
    accion: credito.cliente ? 'venta.credito' : 'venta.registrada',
    entidad: 'venta', entidadId: venta.id,
    ejecutorId: req.body?.cajeroId || req.usuario.id, capturistaId: req.usuario.id,
    detalle: { folio: venta.folio, total: preparadas.total,
               lineas: preparadas.lineas.length, cajaFolio: venta.cajaFolio,
               cliente: clienteDelTicket?.nombre,
               mayoreo: listaMayoreo?.nombre || null,
               ...(abono ? { abono, quedaADeber: aCredito } : {}),
               autorizo: credito.autorizadoPorNombre,
               ...(corteCerrado ? { trasCorte: corteCerrado.folio, motivoCorreccion } : {}) }
  });

  return ok(res, {
    venta: detalleVenta(venta.id),
    correccion,
    cliente: clienteDelTicket
      ? { ...clienteDelTicket, estado: estadoCliente(clienteDelTicket) }
      : null,
    // Para que la caja pueda decir "salió a precio de Mayoreo 1".
    mayoreo: listaMayoreo ? { lista: listaMayoreo.nombre, id: listaMayoreo.id } : null,
    // Lo que dejó y lo que se le queda a deber de ESTE ticket, ya restado,
    // para que la pantalla no tenga que volver a hacer la cuenta.
    abono: abono ? { centavos: abono, quedaADeber: aCredito,
                     sinTurno: venta.abonoSinTurno } : null
  }, 201);
});

/**
 * FIARLE A ALGUIEN.
 *
 * Regla del negocio: se le fía SOLO a clientes registrados, nunca al
 * público en general. Y pasarse del límite no se rechaza a secas: se pide
 * el PIN de un responsable. Al de la ferretería que lleva veinte años
 * comprando no se le para la venta por un número que alguien escribió hace
 * meses; lo que sí queda es escrito quién dijo que sí.
 */
function revisarCredito(req, total, cliente) {
  if (!puede(req.usuario.rol, 'venta.credito')) {
    return { ok: false, codigo: 403, mensaje: 'Tu usuario no puede dar crédito.' };
  }

  if (!cliente) {
    return { ok: false, codigo: 400,
             mensaje: 'A crédito solo se le vende a un cliente registrado.' };
  }
  if (!cliente.activo) {
    return { ok: false, codigo: 409, mensaje: `${cliente.nombre} está dado de baja.` };
  }

  const cabe = cabeElCredito(cliente, total);
  if (cabe.alcanza) return { ok: true, cliente };

  if (!cabe.autorizable) {
    return { ok: false, codigo: 409, mensaje: cabe.motivo };
  }

  // Se pasa del límite: hace falta que un responsable lo autorice ahí mismo.
  if (!req.body?.autorizacion) {
    return {
      ok: false, codigo: 403,
      mensaje: `${cabe.motivo} Debe ${formato(cabe.estado.saldo)} de ` +
               `${formato(cabe.estado.limite)} y este ticket es de ${formato(total)}. ` +
               'Hace falta que lo autorice un responsable.',
      extra: { requiereAutorizacion: true, permiso: 'credito.autorizar',
               saldo: cabe.estado.saldo, limite: cabe.estado.limite,
               responsables: responsables() }
    };
  }

  const comprobado = comprobarAutorizacion(req.body.autorizacion, 'credito.autorizar');
  if (comprobado.error) {
    return { ok: false, codigo: 403, mensaje: comprobado.error,
             extra: { requiereAutorizacion: true, permiso: 'credito.autorizar',
                      responsables: responsables() } };
  }

  return { ok: true, cliente,
           autorizadoPor: comprobado.usuario.id,
           autorizadoPorNombre: comprobado.usuario.nombre };
}

/**
 * Cotiza todas las líneas de una venta.
 *
 * EL PRECIO SE CALCULA AQUÍ, en el servidor, no se cree lo que mande la
 * pantalla. Devuelve { lineas, total } o { error } — nunca a medias.
 */
function prepararLineas(lineas, lista, listaMayoreo = null) {
  const preparadas = [];
  let total = 0;

  for (const l of lineas) {
    // Una línea puede venir de un botón del catálogo (productoId o código)
    // o de la calculadora de fracciones (solo dieciseisavos).
    const producto = l.productoId ? productoPorId(l.productoId)
                   : l.codigo     ? productoPorCodigo(l.codigo)
                   : null;

    if ((l.productoId || l.codigo) && !producto) {
      return { error: 'Ese producto ya no existe o se dio de baja.', codigo: 409 };
    }

    const cantidad = Number(l.cantidad ?? 1);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 500) {
      return { error: 'La cantidad de una línea no es válida.' };
    }

    let sueltos = 0;
    if (!producto) {
      sueltos = Number(l.dieciseisavos);
      try { validar(sueltos); } catch { return { error: 'Cantidad inválida en una línea.' }; }
      if (sueltos <= 0) return { error: 'Cantidad fuera de rango.' };
    }

    // No se vende lo que no hay. Solo aplica a lo que lleva cuenta de
    // piezas: el hielo pasa siempre, porque su número depende de que los
    // operarios hayan reportado, y eso no llega hasta la tarde.
    const falta = alcanza(producto, cantidad);
    if (falta) return { error: falta, codigo: 409 };

    // CADA LÍNEA CON SU LISTA. Un ticket puede llevar una marqueta de
    // mayoreo y un cuarto de público en el mismo renglón de la vida real:
    // "dame una a mayoreo y un cuarto para la casa". Cobrarlo todo con una
    // sola lista sería regalar o cobrar de más.
    const suLista = producto?.mayoreo ? listaMayoreo : lista;
    if (!suLista) {
      return { error: 'Todavía no hay ninguna lista de precios de mayoreo.', codigo: 409 };
    }

    const c = cotizar({ producto, dieciseisavos: sueltos, listaId: suLista.id, cantidad });

    if (c.dieciseisavos > MAX_DIECISEISAVOS) return { error: 'Cantidad fuera de rango.' };
    if (c.faltan.length) {
      return {
        error: `Falta poner precio a ${c.faltan.map(aTexto).join(', ')} en la lista ${suLista.nombre}.`,
        codigo: 409
      };
    }

    preparadas.push({
      productoId: producto?.id || null,
      esMayoreo: Boolean(producto?.mayoreo),
      concepto: String(c.concepto).slice(0, 40),
      dieciseisavos: c.dieciseisavos,
      // Cuántas piezas: el inventario descuenta por esto, no por renglones.
      cantidad,
      centavos: c.centavos,
      desglose: c.desglose
    });
    total += c.centavos;
  }

  return { lineas: preparadas, total };
}

/**
 * Guarda la venta y sus líneas. El folio se toma DENTRO de la transacción
 * para que dos cajas cobrando al mismo tiempo no saquen el mismo número.
 */
function crearVenta({ lineas, total, pago, lista, almacenId, cajeroId, capturistaId,
                      formaPago = 'efectivo', notas = null, cambioDe = null,
                      clienteId = null, autorizadoPor = null,
                      abono = null, abonoFormaPago = 'efectivo', cliente = null,
                      cajaForzada = null, fechaForzada = null, motivoCorreccion = null }) {
  const id = nuevoId();
  const fecha = fechaForzada || ahora();
  const cambio = pago === null || pago === undefined ? null : pago - total;

  // La venta queda amarrada al turno de caja abierto en este momento. Si no
  // hay turno abierto se cobra igual, pero queda fuera de todo corte. La
  // excepción es la venta que faltó en un corte cerrado (v6.1): esa va al
  // turno que se le diga.
  const turno = cajaForzada || sesionAbierta();

  // Se declara ARRIBA de la transacción aunque se llene dentro: leerla
  // debajo obliga a comprobar el orden de ejecución para saber si está
  // definida, y en este archivo ya ha pasado.
  let abonoHecho = null;

  const guardar = bd.transaction(() => {
    const folio = bd.prepare('SELECT COALESCE(MAX(folio), 0) n FROM ventas').get().n + 1;

    // Y su número de la serie del año, que es el que se enseña. Los dos se
    // toman aquí dentro, por lo mismo: dos cajas cobrando al mismo tiempo
    // no pueden sacar el mismo.
    const serie = serieDeHoy(bd);
    const folioAnual = siguienteEnLaSerie(bd, serie);

    bd.prepare(`
      INSERT INTO ventas (id, folio, serie, folio_anual, fecha, cajero_id, capturista_id,
                          almacen_id, lista_id, lista_nombre, total_centavos, pago_centavos,
                          cambio_centavos, forma_pago, notas, caja_id, cambio_de_venta_id,
                          cliente_id, credito_autorizado_por, tras_corte, motivo_correccion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, folio, serie, folioAnual, fecha, cajeroId, capturistaId,
           almacenId, lista.id, lista.nombre, total, pago ?? null, cambio,
           formaPago, notas, turno?.id || null, cambioDe,
           clienteId, autorizadoPor, cajaForzada ? 1 : 0, motivoCorreccion);

    const insertar = bd.prepare(`
      INSERT INTO venta_lineas
        (id, venta_id, concepto, dieciseisavos, precio_centavos, desglose,
         producto_id, cantidad)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const l of lineas) {
      insertar.run(nuevoId(), id, l.concepto, l.dieciseisavos, l.centavos,
                   l.desglose, l.productoId, l.cantidad ?? 1);
    }

    // LO QUE DEJÓ EN EL MOSTRADOR, aquí dentro (v5.3). Si el abono se
    // guardara después, en su propia transacción, un tropiezo entre las
    // dos dejaría al cliente debiendo dinero que ya entregó — y el papel
    // en su mano diciendo que lo pagó.
    if (abono && cliente) {
      abonoHecho = apuntarAbono({
        cliente, centavos: abono, formaPago: abonoFormaPago, turno,
        ejecutorId: cajeroId, capturistaId,
        concepto: `Abono de ${cliente.nombre} (ticket ${folio})`,
        notas: `Dejó una parte al llevárselo a crédito`,
        ventaId: id
      });
    }
    return folio;
  });

  const folio = guardar();
  // Con esto el cliente aparece solo en la pestaña de lo que compra
  // (v5.7.1): nadie tiene que marcarlo a mano.
  marcarLoQueCompra(clienteId, lineas);
  const fila = bd.prepare('SELECT serie, folio_anual FROM ventas WHERE id = ?').get(id);
  return {
    id, folio, serie: fila.serie, folioAnual: fila.folio_anual,
    numero: numeroDeTicket({ ...fila, folio }),
    cajaId: turno?.id || null, cajaFolio: turno?.folio || null,
    abonoId: abonoHecho?.id || null,
    // Sin turno abierto el abono se guardó igual —la deuda sí bajó— pero
    // ese dinero no está en ningún corte, y eso hay que decirlo.
    abonoSinTurno: Boolean(abono && abonoFormaPago === 'efectivo' && !turno)
  };
}

function detalleVenta(id) {
  const venta = bd.prepare(`
    SELECT v.*, u.nombre AS cajero_nombre, a.nombre AS almacen_nombre,
           c.nombre AS cancelada_por_nombre,
           cl.nombre AS cliente_nombre, cl.negocio AS cliente_negocio,
           au.nombre AS credito_autorizado_nombre,
           lp.tipo AS lista_tipo
      FROM ventas v
      LEFT JOIN usuarios u  ON u.id = v.cajero_id
      LEFT JOIN almacenes a ON a.id = v.almacen_id
      LEFT JOIN usuarios c  ON c.id = v.cancelada_por
      LEFT JOIN clientes cl ON cl.id = v.cliente_id
      LEFT JOIN usuarios au ON au.id = v.credito_autorizado_por
      LEFT JOIN listas_precios lp ON lp.id = v.lista_id
     WHERE v.id = ?
  `).get(id);
  if (!venta) return null;

  venta.lineas = bd.prepare('SELECT * FROM venta_lineas WHERE venta_id = ?').all(id)
    .map((l) => ({ ...l, texto: aTexto(l.dieciseisavos) }));

  // LO QUE DEJÓ EN EL MOSTRADOR  (v5.3). Se saca de los abonos amarrados a
  // este ticket, no de una columna guardada: si mañana se anula ese abono
  // —porque el billete era falso—, la reimpresión deja de decir que pagó,
  // que es lo que tiene que pasar (regla 3.2).
  venta.abonoCentavos = bd.prepare(`
    SELECT COALESCE(SUM(centavos), 0) n FROM abonos
     WHERE venta_id = ? AND anulado_en IS NULL
  `).get(id).n;
  // El número ya escrito, para que ninguna pantalla tenga que armarlo y
  // ninguna se olvide de la serie.
  venta.numero = numeroDeTicket(venta);
  return venta;
}

// ============================================================
// CONSULTA Y CANCELACIÓN
// ============================================================

/** Buscador rápido: por folio, monto u hora. Abre con las últimas 20 (7.3). */
/**
 * Buscador de tickets: por folio, monto u hora.
 *
 * Con ?hoy=1 solo los de hoy. Es lo que pide la caja: ahí se busca el
 * ticket que el cliente acaba de perder, no el de hace tres semanas.
 * Para el histórico completo está el módulo de Historial.
 */
router.get('/', verVentas, (req, res) => {
  const limite = Math.min(Number(req.query.limite) || 20, 200);
  const busca = String(req.query.busca || '').trim();
  const soloHoy = req.query.hoy === '1';

  const filtros = [];
  const valores = [];

  if (busca) {
    // Se busca como lo diga la gente: "2026-412", "412", el importe o la
    // hora. El número de la serie va primero porque es el que trae escrito
    // el papel que el cliente tiene en la mano.
    const num = leerNumero(busca);
    const comoNumero = Number(busca.replace(/[^0-9.]/g, ''));
    filtros.push(`(
      (v.serie = ? AND v.folio_anual = ?) OR v.folio_anual = ? OR v.folio = ?
      OR v.total_centavos = ? OR v.fecha LIKE ?
    )`);
    valores.push(num?.serie ?? -1, num?.folioAnual ?? -1,
                 num?.serie ? -1 : (num?.folioAnual ?? -1),
                 num?.folio ?? -1,
                 Math.round(comoNumero * 100) || -1,
                 `%${busca}%`);
  }
  if (soloHoy) {
    // LOS DOS LADOS EN HORA LOCAL, y esto no es un detalle.
    //
    // Las fechas se guardan en UTC (regla de siempre: un instante, no una
    // hora de pared). En Yucatán eso son seis horas de diferencia, así que
    // un ticket de las 6:29 de la tarde se guarda como las 00:29 del día
    // SIGUIENTE. Comparando date(v.fecha) —que da el día en UTC— contra el
    // día del reloj de la fábrica, a partir de las 6 de la tarde los
    // tickets de hoy desaparecían de la lista. Pasó de verdad.
    //
    // El modificador 'localtime' convierte el instante guardado al reloj de
    // esta computadora, que es el de la fábrica.
    filtros.push("date(v.fecha, 'localtime') = date('now', 'localtime')");
  }

  const filas = bd.prepare(`
    SELECT v.*, u.nombre AS cajero_nombre, cl.nombre AS cliente_nombre,
           viejo.serie AS cambio_de_serie, viejo.folio_anual AS cambio_de_anual,
           nuevo.serie AS cambiado_por_serie, nuevo.folio_anual AS cambiado_por_anual,
           viejo.folio AS cambio_de, nuevo.folio AS cambiado_por,
           -- De qué lista salió el precio: es lo que deja marcar un ticket
           -- como "Mayoreo" en la lista de la caja sin abrirlo.
           lp.tipo AS lista_tipo,
           -- Qué se llevó, en corto. Va en la lista para no tener que abrir
           -- el ticket —ni imprimirlo— para contestar "¿qué se llevó?".
           (SELECT group_concat(
                     CASE WHEN vl.cantidad > 1 THEN vl.cantidad || ' × ' || vl.concepto
                          ELSE vl.concepto END, ', ')
              FROM venta_lineas vl WHERE vl.venta_id = v.id) AS detalle
      FROM ventas v
      LEFT JOIN usuarios u  ON u.id = v.cajero_id
      LEFT JOIN clientes cl ON cl.id = v.cliente_id
      LEFT JOIN ventas viejo ON viejo.id = v.cambio_de_venta_id
      LEFT JOIN ventas nuevo ON nuevo.id = v.cambiada_por_venta_id
      LEFT JOIN listas_precios lp ON lp.id = v.lista_id
     ${filtros.length ? 'WHERE ' + filtros.join(' AND ') : ''}
     ORDER BY v.fecha DESC LIMIT ?
  `).all(...valores, limite);

  return ok(res, {
    ventas: filas.map((v) => ({
      ...v,
      numero: numeroDeTicket(v),
      cambioDeNumero: v.cambio_de
        ? numeroDeTicket({ serie: v.cambio_de_serie, folio_anual: v.cambio_de_anual,
                           folio: v.cambio_de }) : null,
      cambiadoPorNumero: v.cambiado_por
        ? numeroDeTicket({ serie: v.cambiado_por_serie, folio_anual: v.cambiado_por_anual,
                           folio: v.cambiado_por }) : null
    }))
  });
});

/**
 * Los motivos de devolución, para que la pantalla arme la lista.
 *
 * OJO CON EL ORDEN: esto va antes de /:id. Si se pone después, Express lee
 * "motivos-devolucion" como el id de una venta y contesta que no existe.
 */
router.get('/motivos-devolucion', verVentas, (req, res) => {
  return ok(res, {
    motivos: Object.entries(MOTIVOS_DEVOLUCION).map(([id, texto]) => ({ id, texto }))
  });
});

router.get('/:id', verVentas, (req, res) => {
  const venta = detalleVenta(req.params.id);
  if (!venta) return error(res, 'Esa venta no existe.', 404);
  return ok(res, { venta });
});

/**
 * Cancelar una venta. NUNCA se edita ni se borra (7.4): se marca cancelada
 * con su motivo y su responsable, y el ticket original sigue existiendo.
 */
router.post('/:id/cancelar', exigirPermiso('venta.cancelar'), (req, res) => {
  const v = bd.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.id);
  if (!v) return error(res, 'Esa venta no existe.', 404);
  if (v.cancelada_en) return error(res, 'Esa venta ya está cancelada.');

  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) return error(res, 'Escribe por qué se cancela.');

  bd.prepare('UPDATE ventas SET cancelada_en = ?, cancelada_por = ?, motivo_cancelacion = ? WHERE id = ?')
    .run(ahora(), req.usuario.id, motivo, v.id);

  bitacora.registrar({
    accion: 'venta.cancelada', entidad: 'venta', entidadId: v.id,
    ejecutorId: req.usuario.id, detalle: { folio: v.folio, total: v.total_centavos, motivo }
  });

  return ok(res, { cancelada: true });
});

/**
 * BORRAR UN TICKET DE VERDAD.
 *
 * Cancelar y borrar no son lo mismo, y la diferencia es el papel firmado:
 *
 *  · CANCELAR deja el renglón tachado con su motivo. El hielo vuelve al
 *    cuarto frío, la caja se ajusta sola y el corte sigue cuadrando. Es lo
 *    que se hace el 99% de las veces, y funciona con tickets de cualquier
 *    día.
 *
 *  · BORRAR lo quita como si nunca hubiera existido. Eso solo se puede
 *    mientras el turno sigue ABIERTO —o sea, antes de que alguien firme un
 *    papel con ese número—. Después, borrarlo dejaría el corte firmado
 *    diciendo una cosa y el sistema otra, y ese papel es el que se usa para
 *    reclamarle a alguien.
 *
 * Y solo el administrador, con su CONTRASEÑA, no con el PIN: el PIN se
 * teclea veinte veces al día delante de quien sea, y esto no se deshace.
 */
router.delete('/:id', exigirPermiso('venta.cancelar'), (req, res) => {
  const v = bd.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.id);
  if (!v) return error(res, 'Ese ticket no existe.', 404);

  const quien = comprobarAdmin(req.body?.autorizacion);
  if (quien.error) {
    return error(res, quien.error, 403, {
      requiereContrasena: true, administradores: administradores()
    });
  }

  // ¿Su turno sigue abierto? Un ticket sin turno (se cobró sin caja abierta)
  // no entró en ningún corte, así que tampoco hay papel que contradecir.
  if (v.caja_id) {
    const caja = bd.prepare('SELECT * FROM cajas WHERE id = ?').get(v.caja_id);
    if (caja?.cerrada_en) {
      return error(res,
        `El turno #${caja.folio} ya se cortó y ese papel lleva este ticket. ` +
        'Cancélalo en vez de borrarlo: queda tachado con su motivo y las cuentas siguen cuadrando.',
        409, { sugerencia: 'cancelar' });
    }
  }

  // Un ticket amarrado a un cambio no se borra solo: dejaría al otro
  // apuntando a un número que ya no existe.
  if (v.cambio_de_venta_id || v.cambiada_por_venta_id) {
    return error(res,
      'Este ticket es parte de un cambio. Borrarlo dejaría al otro colgando; cancélalo.',
      409, { sugerencia: 'cancelar' });
  }

  const borrar = bd.transaction(() => {
    bd.prepare('DELETE FROM venta_lineas WHERE venta_id = ?').run(v.id);
    bd.prepare('DELETE FROM ventas WHERE id = ?').run(v.id);
  });
  borrar();

  // Lo único que no se borra nunca es la constancia de que alguien borró.
  bitacora.registrar({
    accion: 'venta.borrada', entidad: 'venta', entidadId: v.id,
    ejecutorId: quien.usuario.id,
    detalle: { folio: v.folio, total: v.total_centavos, fecha: v.fecha,
               autorizo: quien.usuario.nombre }
  });

  return ok(res, { borrada: true, folio: v.folio, numero: numeroDeTicket(v) });
});

/**
 * DEVOLVER EL DINERO COMPLETO.
 *
 * Pasa todos los días y por razones que no son culpa de nadie: el cliente
 * se cansó de esperar la fila, tenía prisa, o el hielo no estaba bien
 * congelado. Llega a la caja, entrega su ticket y se le regresa su dinero.
 *
 * NO ES UN TIPO DE VENTA NUEVO. Una devolución completa es exactamente
 * cancelar el ticket: el hielo vuelve al cuarto frío solo y la caja se
 * ajusta sola, porque lo cobrado deja de contar. Inventarle una tabla
 * aparte sería inventar una cuenta más que se puede desincronizar.
 *
 * Lo que SÍ hace falta es lo que la cancelación a secas no dice:
 *
 *  · EL MOTIVO, de una lista corta. "Se cansó de esperar" veinte veces en
 *    un mes es un problema de la fila, y eso no se ve si el motivo es texto
 *    libre que cada quien escribe distinto.
 *
 *  · EL DINERO DE UN TICKET VIEJO. Si el ticket es de un turno ya cerrado,
 *    ese dinero entró otro día: cancelarlo hoy no le quita nada a la caja
 *    de hoy, pero del cajón de hoy SÍ salen los billetes. Se anota como
 *    salida para que el arqueo no salga corto, igual que en un cambio.
 */
router.post('/:id/devolver', exigirPermiso('venta.cancelar'), (req, res) => {
  const v = bd.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.id);
  if (!v) return error(res, 'Ese ticket no existe.', 404);
  // El del cambio va PRIMERO: un ticket cambiado ya está cancelado, y
  // contestar "ya está cancelado" a quien trae ese papel en la mano no le
  // dice qué hacer. Decirle "devuelve el nuevo" sí.
  if (v.cambiada_por_venta_id) {
    const nueva = bd.prepare('SELECT folio, serie, folio_anual FROM ventas WHERE id = ?')
      .get(v.cambiada_por_venta_id);
    return error(res,
      `Ese ticket se cambió por el ${numeroDeTicket(nueva)}. Devuelve el nuevo.`, 409);
  }
  if (v.cancelada_en) return error(res, 'Ese ticket ya está cancelado.');

  const clave = String(req.body?.motivo || '').trim();
  if (!MOTIVOS_DEVOLUCION[clave]) return error(res, 'Escoge por qué se devuelve.');

  const nota = String(req.body?.nota || '').trim().slice(0, 200);
  if (clave === 'otro' && !nota) return error(res, 'Si es otro motivo, escribe cuál.');
  const motivo = nota ? `${MOTIVOS_DEVOLUCION[clave]}: ${nota}` : MOTIVOS_DEVOLUCION[clave];

  // Fiado no se devuelve en efectivo: no entró dinero. Se cancela el cargo
  // y con eso el cliente deja de deberlo, que es la devolución de verdad.
  const fueEfectivo = v.forma_pago === 'efectivo';
  const turno = sesionAbierta();
  const fecha = ahora();

  const hacer = bd.transaction(() => {
    bd.prepare(`
      UPDATE ventas SET cancelada_en = ?, cancelada_por = ?, motivo_cancelacion = ?
       WHERE id = ?
    `).run(fecha, req.usuario.id, `Devolución · ${motivo}`, v.id);

    // Del turno de hoy salen los billetes aunque el ticket sea de ayer.
    if (fueEfectivo && turno && v.caja_id !== turno.id) {
      bd.prepare(`
        INSERT INTO movimientos_caja
          (id, caja_id, fecha, tipo, concepto, centavos, ejecutor_id, capturista_id, notas)
        VALUES (?, ?, ?, 'salida', ?, ?, ?, ?, ?)
      `).run(nuevoId(), turno.id, fecha,
             `Devolución del ticket #${v.folio}`, v.total_centavos,
             req.usuario.id, req.usuario.id,
             'El ticket era de otro turno: el dinero sale del cajón de hoy');
    }
  });
  hacer();

  bitacora.registrar({
    accion: 'venta.devuelta', entidad: 'venta', entidadId: v.id,
    ejecutorId: req.usuario.id,
    detalle: { folio: v.folio, total: v.total_centavos, motivo: clave, nota,
               formaPago: v.forma_pago }
  });

  return ok(res, {
    devuelta: true,
    folio: v.folio,
    numero: numeroDeTicket(v),
    // Cuánto hay que sacar del cajón. En un fiado, nada: no entró dinero.
    centavos: fueEfectivo ? v.total_centavos : 0,
    enEfectivo: fueEfectivo,
    deOtroTurno: Boolean(turno && v.caja_id !== turno.id),
    motivo
  });
});

// ============================================================
// CAMBIOS DE TICKET
// ============================================================

/**
 * CAMBIAR UN TICKET.
 *
 * El caso clásico del mostrador: "pedí 1/2 pero no sabía que era tanto,
 * quería 1/8". El cliente devuelve el ticket y se le hace el cambio.
 *
 * Cómo se registra: el ticket viejo se CANCELA y se hace uno nuevo, y los
 * dos quedan amarrados. No se inventa un tipo de venta aparte, y no es por
 * pereza: un cambio son dos hechos que el sistema ya sabía registrar, y al
 * hacerlo así el hielo vuelve solo al cuarto frío y la caja cuadra sola,
 * sin ninguna cuenta especial que se pueda desincronizar.
 *
 * LA CAJA. Si el ticket viejo es de ESTE turno, la cuenta sale sola:
 * cancelarlo le quita su importe a lo cobrado y la venta nueva le suma el
 * suyo, así que lo esperado en el cajón cambia exactamente en la
 * diferencia, que es lo que se cobró o se devolvió de verdad.
 *
 * Si el ticket viejo es de un turno YA CERRADO, ese dinero entró otro día y
 * cancelarlo hoy no le quita nada a la caja de hoy. Pero hoy sí sale (o
 * entra) la diferencia. Para que el arqueo no salga corto, se anota un
 * movimiento por el importe del ticket viejo: es lo que el cliente "pagó"
 * con papel en vez de con billetes.
 */
router.post('/:id/cambiar', vender, (req, res) => {
  const vieja = bd.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.id);
  if (!vieja) return error(res, 'Ese ticket no existe.', 404);
  // El que ya se cambió también está cancelado, así que este aviso va
  // primero: dice más que "está cancelado".
  if (vieja.cambiada_por_venta_id) {
    const reemplazo = bd.prepare('SELECT folio FROM ventas WHERE id = ?')
      .get(vieja.cambiada_por_venta_id);
    return error(res,
      `El ticket #${vieja.folio} ya se cambió por el #${reemplazo?.folio ?? '?'}.`, 409);
  }
  if (vieja.cancelada_en) return error(res, `El ticket #${vieja.folio} ya está cancelado.`, 409);

  const lineas = req.body?.lineas;
  if (!Array.isArray(lineas) || !lineas.length) {
    return error(res, 'Elige por qué se cambia.');
  }
  if (lineas.length > 50) return error(res, 'Demasiadas líneas en un solo ticket.');

  const lista = listaActiva();
  if (!lista) return error(res, 'No hay ninguna lista de precios activa.', 409);

  const preparadas = prepararLineas(lineas, lista);
  if (preparadas.error) return error(res, preparadas.error, preparadas.codigo || 400);

  const aFavor = vieja.total_centavos;
  const diferencia = preparadas.total - aFavor;   // + cobra, − devuelve

  // Si se lleva más, tiene que pagar la diferencia.
  let pago = null;
  if (diferencia > 0 && req.body?.pago !== undefined && req.body.pago !== null
      && req.body.pago !== '') {
    try { pago = aCentavos(req.body.pago); }
    catch { return error(res, 'El pago no es un importe válido.'); }
    if (pago < diferencia) {
      return error(res, `Faltan ${formato(diferencia - pago)} para completar el cambio.`);
    }
  }

  const turno = sesionAbierta();
  const mismoTurno = Boolean(turno && vieja.caja_id === turno.id);
  const fecha = ahora();

  let nueva;
  const hacer = bd.transaction(() => {
    bd.prepare(`
      UPDATE ventas SET cancelada_en = ?, cancelada_por = ?, motivo_cancelacion = ?
       WHERE id = ?
    `).run(fecha, req.usuario.id,
           String(req.body?.motivo || 'Cambio de ticket').slice(0, 200), vieja.id);

    // La venta nueva se cobra COMPLETA: lo que el cliente entrega en
    // billetes es solo la diferencia, pero el ticket vale lo que vale.
    nueva = crearVenta({
      lineas: preparadas.lineas,
      total: preparadas.total,
      // El pago se guarda en total para que el ticket cuadre solo; el
      // cambio a devolver se calcula sobre el total, no sobre la diferencia.
      pago: preparadas.total,
      lista,
      almacenId: vieja.almacen_id,
      cajeroId: req.usuario.id,
      capturistaId: req.usuario.id,
      notas: `Cambio del ticket #${vieja.folio}`,
      cambioDe: vieja.id
    });

    bd.prepare('UPDATE ventas SET cambiada_por_venta_id = ? WHERE id = ?')
      .run(nueva.id, vieja.id);

    // Turno cerrado: el dinero del ticket viejo no está en este cajón, así
    // que se anota para que el arqueo de hoy no salga corto.
    if (!mismoTurno && turno) {
      bd.prepare(`
        INSERT INTO movimientos_caja
          (id, caja_id, fecha, tipo, concepto, centavos, ejecutor_id, capturista_id, notas)
        VALUES (?, ?, ?, 'salida', ?, ?, ?, ?, ?)
      `).run(nuevoId(), turno.id, fecha,
             `Cambio del ticket #${vieja.folio}`, aFavor,
             req.usuario.id, req.usuario.id,
             'El cliente pago con un ticket de otro turno, no con efectivo');
    }
  });
  hacer();

  bitacora.registrar({
    accion: 'venta.cambiada', entidad: 'venta', entidadId: vieja.id,
    ejecutorId: req.usuario.id,
    detalle: {
      folioViejo: vieja.folio, folioNuevo: nueva.folio,
      aFavor, nuevoTotal: preparadas.total, diferencia, mismoTurno
    }
  });

  return ok(res, {
    venta: detalleVenta(nueva.id),
    anterior: detalleVenta(vieja.id),
    aFavor,
    diferencia,
    // Positivo: el cliente paga. Negativo: se le devuelve.
    porCobrar: diferencia > 0 ? diferencia : 0,
    porDevolver: diferencia < 0 ? -diferencia : 0
  }, 201);
});

// ============================================================
// LISTAS DE PRECIOS — solo admin
// ============================================================

router.get('/precios/listas', verVentas, (req, res) => {
  const listas = bd.prepare('SELECT * FROM listas_precios WHERE activo = 1 ORDER BY tipo, nombre').all()
    .map((l) => ({
      ...l,
      // Cuántos clientes cobran con esta lista: es lo que dice si bajarle
      // un precio le toca a uno o a veinte.
      clientes: bd.prepare('SELECT COUNT(*) n FROM clientes WHERE lista_id = ? AND activo = 1')
                  .get(l.id).n,
      precios: [...preciosDe(l.id).entries()]
        .map(([dieciseisavos, centavos]) => ({ dieciseisavos, centavos, etiqueta: aTexto(dieciseisavos) }))
        .sort((a, b) => b.dieciseisavos - a.dieciseisavos)
    }));
  return ok(res, { listas, mayoreoPorOmision: listaPorOmision()?.id || null });
});

/**
 * UNA LISTA DE MAYOREO NUEVA.
 *
 * Nace con los precios de la lista de público: así el administrador solo
 * baja los que quiera en vez de capturar cinco desde cero, y mientras tanto
 * nadie paga de más por una lista a medio llenar.
 */
router.post('/precios/listas', configurarPrecios, (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  if (!nombre) return error(res, 'Ponle nombre a la lista. Por ejemplo, "Mayoreo 1".');

  const repetida = bd.prepare(
    "SELECT 1 FROM listas_precios WHERE activo = 1 AND lower(nombre) = lower(?)"
  ).get(nombre);
  if (repetida) return error(res, `Ya hay una lista que se llama ${nombre}.`);

  const publico = listaActiva();
  const id = nuevoId();

  const crear = bd.transaction(() => {
    bd.prepare(`
      INSERT INTO listas_precios (id, nombre, tipo, activa, fecha_alta, creado_por)
      VALUES (?, ?, 'mayoreo', 0, ?, ?)
    `).run(id, nombre.slice(0, 60), ahora(), req.usuario.id);

    if (publico) {
      const insertar = bd.prepare(`
        INSERT INTO precios (id, lista_id, dieciseisavos, centavos, actualizado_en, actualizado_por)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const [dieciseisavos, centavos] of preciosDe(publico.id)) {
        insertar.run(nuevoId(), id, dieciseisavos, centavos, ahora(), req.usuario.id);
      }
    }
  });
  crear();

  bitacora.registrar({
    accion: 'precios.lista-nueva', entidad: 'lista_precios', entidadId: id,
    ejecutorId: req.usuario.id, detalle: { nombre, tipo: 'mayoreo' }
  });

  const lista = bd.prepare('SELECT * FROM listas_precios WHERE id = ?').get(id);
  return ok(res, { lista }, 201);
});

/**
 * CUÁL ES "EL PRECIO DE MAYOREO NORMAL".
 *
 * Es la lista que se cobra cuando el cliente no tiene una propia, y la que
 * la caja enseña mientras todavía no se sabe quién es. Solo puede haber
 * una: dos listas "normales" sería no tener ninguna.
 */
router.put('/precios/listas/:id/predeterminada', configurarPrecios, (req, res) => {
  const lista = bd.prepare(
    "SELECT * FROM listas_precios WHERE id = ? AND activo = 1 AND tipo = 'mayoreo'"
  ).get(req.params.id);
  if (!lista) return error(res, 'Esa lista de mayoreo no existe.', 404);

  const marcar = bd.transaction(() => {
    bd.prepare("UPDATE listas_precios SET activa = 0 WHERE tipo = 'mayoreo'").run();
    bd.prepare('UPDATE listas_precios SET activa = 1 WHERE id = ?').run(lista.id);
  });
  marcar();

  bitacora.registrar({
    accion: 'precios.mayoreo-predeterminada', entidad: 'lista_precios', entidadId: lista.id,
    ejecutorId: req.usuario.id, detalle: { nombre: lista.nombre }
  });
  return ok(res, { lista: listaPorOmision() });
});

/**
 * DAR DE BAJA UNA LISTA DE MAYOREO.
 *
 * Se crean listas para probar precios de temporada y luego estorban en la
 * caja, donde cada lista de más es un botón más que leer con gente
 * esperando. Faltaba poder quitarlas.
 *
 * NO SE BORRA NADA (regla 3.4): la lista se marca de baja y su historia
 * queda entera. Las ventas viejas que se cobraron con ella no cambian una
 * coma, porque el precio se COPIÓ al ticket cuando se hizo (regla 3.5):
 * lo que se cobró es lo que dice el papel, no lo que diga hoy una tabla.
 *
 * Los clientes que la tenían asignada pasan a la lista de mayoreo normal.
 * Dejarlos apuntando a una lista dada de baja los dejaría sin precio, y en
 * el mostrador eso es un cliente parado sin saber qué cobrarle.
 *
 * La de PÚBLICO no se puede dar de baja: es la que se cobra cuando no hay
 * cliente, y sin ella no se podría vender.
 */
router.post('/precios/listas/:id/baja', configurarPrecios, (req, res) => {
  const lista = bd.prepare('SELECT * FROM listas_precios WHERE id = ? AND activo = 1')
    .get(req.params.id);
  if (!lista) return error(res, 'Esa lista no existe o ya está dada de baja.', 404);
  if (lista.tipo !== 'mayoreo') {
    return error(res, 'La lista de público no se puede dar de baja: es la que se ' +
                      'cobra cuando no hay cliente.');
  }

  const otras = bd.prepare(
    "SELECT * FROM listas_precios WHERE activo = 1 AND tipo = 'mayoreo' AND id <> ? ORDER BY nombre"
  ).all(lista.id);
  if (!otras.length) {
    return error(res, 'Es la única lista de mayoreo que queda. Crea otra antes de ' +
                      'dar esta de baja, o el mayoreo se quedaría sin precios.');
  }

  const clientes = bd.prepare(
    'SELECT COUNT(*) n FROM clientes WHERE lista_id = ?').get(lista.id).n;

  const dar = bd.transaction(() => {
    bd.prepare('UPDATE listas_precios SET activo = 0, activa = 0, fecha_baja = ? WHERE id = ?')
      .run(ahora(), lista.id);
    // Los clientes que la tenían vuelven al mayoreo normal.
    bd.prepare('UPDATE clientes SET lista_id = NULL WHERE lista_id = ?').run(lista.id);

    // Si era la normal, alguien tiene que serlo: sin predeterminada, la
    // caja no sabría qué cobrar a un mayorista sin lista propia.
    if (lista.activa) {
      bd.prepare('UPDATE listas_precios SET activa = 1 WHERE id = ?').run(otras[0].id);
    }
  });
  dar();

  bitacora.registrar({
    accion: 'precios.lista-baja', entidad: 'lista_precios', entidadId: lista.id,
    ejecutorId: req.usuario.id,
    detalle: { nombre: lista.nombre, clientesMovidos: clientes,
               nuevaPorOmision: lista.activa ? otras[0].nombre : null }
  });

  return ok(res, {
    baja: true, clientesMovidos: clientes,
    nuevaPorOmision: lista.activa ? otras[0] : null
  });
});

router.put('/precios/:listaId', configurarPrecios, (req, res) => {
  const lista = bd.prepare('SELECT * FROM listas_precios WHERE id = ?').get(req.params.listaId);
  if (!lista) return error(res, 'Esa lista no existe.', 404);

  const cambios = req.body?.precios;
  if (!Array.isArray(cambios) || !cambios.length) return error(res, 'No mandaste ningún precio.');

  const validos = [16, 8, 4, 2, 1];
  for (const c of cambios) {
    if (!validos.includes(Number(c.dieciseisavos))) {
      return error(res, `Fracción desconocida: ${c.dieciseisavos}.`);
    }
    const n = Number(c.pesos);
    if (!Number.isFinite(n) || n < 0 || n > 100000) {
      return error(res, `Precio inválido para ${aTexto(c.dieciseisavos)}.`);
    }
  }

  const guardar = bd.transaction(() => {
    const sql = bd.prepare(`
      INSERT INTO precios (id, lista_id, dieciseisavos, centavos, actualizado_en, actualizado_por)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(lista_id, dieciseisavos) DO UPDATE SET
        centavos = excluded.centavos,
        actualizado_en = excluded.actualizado_en,
        actualizado_por = excluded.actualizado_por
    `);
    for (const c of cambios) {
      sql.run(nuevoId(), lista.id, Number(c.dieciseisavos), aCentavos(c.pesos), ahora(), req.usuario.id);
    }
  });
  guardar();

  bitacora.registrar({
    accion: 'precios.cambio', entidad: 'lista_precios', entidadId: lista.id,
    ejecutorId: req.usuario.id, detalle: { lista: lista.nombre, cambios }
  });

  return ok(res, { lista: lista.nombre, precios: [...preciosDe(lista.id).entries()] });
});

/** El precio proporcional que sugiere el sistema, para comparar (7.2). */
router.get('/precios/sugerencia', configurarPrecios, (req, res) => {
  const marqueta = Number(req.query.marqueta);
  if (!Number.isFinite(marqueta) || marqueta <= 0) return error(res, 'Precio de marqueta inválido.');

  const centavosMarqueta = aCentavos(marqueta);
  return ok(res, {
    sugerencias: [8, 4, 2, 1].map((d) => ({
      dieciseisavos: d,
      etiqueta: aTexto(d),
      centavos: sugerencia(centavosMarqueta, d)
    }))
  });
});

module.exports = router;
// La cotización imprime con LOS MISMOS precios y las mismas reglas que una
// venta —incluida la lista de mayoreo del cliente—, así que reutiliza esta
// función en vez de copiarla: si un día cambia cómo se cobra, la cotización
// cambia sola.
module.exports.prepararLineas = prepararLineas;
module.exports.llevaMayoreoEnLineas = (lineas) =>
  llevaMayoreo(lineas, { porId: productoPorId, porCodigo: productoPorCodigo });

// LOS PEDIDOS TAMBIÉN CREAN VENTAS  (v5.6). Cuando un pedido se entrega
// nace su venta, con los precios que ya llevaba escritos el papel que el
// repartidor tenía en la mano — no con los de hoy. Por eso se llama a esto
// con las líneas ya cotizadas, en vez de volver a pasarlas por el
// cotizador: el precio de un pedido se prometió el día que se tomó.
module.exports.crearVenta = crearVenta;
module.exports.detalleVenta = detalleVenta;
// Y LA REVISIÓN DEL CRÉDITO  (v5.8). Un pedido que se cobra en la caja es
// una venta de mostrador con el precio ya escrito: la mercancía sigue de
// este lado, y pasarse del límite se frena y se pide autorización igual
// que en cualquier ticket. Es la misma función para que sea la misma
// regla.
module.exports.revisarCredito = revisarCredito;
