/**
 * IMPRESIÓN  (v0.11)
 *
 * El ticket lo manda el SERVIDOR a la impresora, no el navegador. Así sale
 * al instante, sin la ventana de impresión que se asoma un momento.
 *
 * Si no hay impresora configurada, estas rutas contestan que no se imprimió
 * y la pantalla lo resuelve con el navegador. La venta nunca se cae por un
 * problema de impresora: el dinero ya se cobró.
 */
const express = require('express');
const { bd } = require('../../db/conexion');
const { ok, error } = require('../../lib/respuestas');
const bitacora = require('../../lib/bitacora');
const { exigirPermiso } = require('../../middleware/sesion');
const { prepararLineas, llevaMayoreoEnLineas } = require('../ventas/rutas');
const { listaActiva } = require('../ventas/precios');
const { listaDeMayoreo } = require('../ventas/mayoreo');
const { configuracion, guardarAjuste, imprimirCrudo,
        tipoDeDestino, impresorasDeWindows, APARTADOS } = require('./impresora');
const { ticketCotizacion, ticketVenta, ticketMovimiento, ticketPrueba, pulsoCajon, ticketProduccion,
        ticketCorte, ticketCorteMovimientos, ticketHielo, ticketCortePersona, ticketConteo,
        ticketResumenDia } = require('./ticket');

const { aTexto } = require('../../lib/fracciones');
const { numeroDeTicket } = require('../ventas/folio');
const { numerosASacar } = require('../produccion/siguientes');
const { resumenDelDia } = require('../produccion/dia');
const { cuadreDeHielo } = require('../caja/hielo');
const { estadoAlmacen } = require('../existencia/calculo');
const { desglosePorPersona } = require('../caja/calculo');

const router = express.Router();

const puedeImprimir = exigirPermiso('venta.registrar');
const configurar = exigirPermiso('sistema.configurar');

function nombreNegocio() {
  return bd.prepare("SELECT valor FROM configuracion WHERE clave = 'nombre_negocio'")
    .get()?.valor || 'Hielo LOLHA';
}

/**
 * Arma la venta completa, como la necesita el ticket.
 *
 * El cliente se trae aunque casi nunca haya: en un ticket fiado su nombre
 * es lo que convierte el papel en un vale. Sin él salía "FIADO" a secas.
 */
function ventaCompleta(id) {
  const venta = bd.prepare(`
    SELECT v.*, u.nombre AS cajero_nombre,
           cl.nombre AS cliente_nombre, cl.negocio AS cliente_negocio,
           lp.tipo AS lista_tipo, lp.nombre AS lista_nombre,
           viejo.serie  AS cambio_de_serie,
           viejo.folio_anual AS cambio_de_anual,
           viejo.folio  AS cambio_de_folio,
           -- Cuánto valía el ticket que trajo el cliente. Sin esto el
           -- papel del cambio no puede decir cuánto se le devolvió.
           viejo.total_centavos AS cambio_de_total
      FROM ventas v
      LEFT JOIN usuarios u  ON u.id = v.cajero_id
      LEFT JOIN clientes cl ON cl.id = v.cliente_id
      LEFT JOIN listas_precios lp ON lp.id = v.lista_id
      LEFT JOIN ventas viejo ON viejo.id = v.cambio_de_venta_id
     WHERE v.id = ?
  `).get(id);
  if (!venta) return null;
  venta.lineas = bd.prepare('SELECT * FROM venta_lineas WHERE venta_id = ?').all(id);
  // De qué ticket sale este, ya escrito como se dice: "2026-152124".
  venta.cambioDeNumero = venta.cambio_de_folio
    ? numeroDeTicket({ serie: venta.cambio_de_serie, folio_anual: venta.cambio_de_anual,
                       folio: venta.cambio_de_folio })
    : null;
  venta.cambioDeTotal = venta.cambio_de_folio ? venta.cambio_de_total : null;
  return venta;
}

// ============================================================
// CONFIGURACIÓN
// ============================================================

router.get('/config', puedeImprimir, (req, res) => {
  return ok(res, {
    impresion: configuracion(),
    // La pantalla necesita saber si está corriendo dentro de la ventana de
    // impresión directa: ahí Ctrl+P no pregunta nada y manda el papel a la
    // impresora de siempre, así que un reporte en hoja carta necesita el
    // otro camino. Se pide en caliente para no cargar el servidor arriba.
    ventanaDirecta: require('../../servidor').esVentanaDirecta()
  });
});

/**
 * ABRIR EL SISTEMA EN EL NAVEGADOR DE SIEMPRE.
 *
 * El programa se abre en una ventana con impresión directa, que es lo que
 * hace que los tickets salgan sin preguntar nada. Pero esa misma ventana no
 * puede sacar una hoja carta ni guardar un PDF: no enseña el cuadro de
 * imprimir donde se elige la impresora o "Guardar como PDF".
 *
 * Esto abre la misma dirección en el navegador normal, donde Ctrl+P sí
 * pregunta. No se abre nada de fuera: solo una ruta de este mismo sistema.
 */
router.post('/abrir-en-navegador', puedeImprimir, (req, res) => {
  const donde = String(req.body?.donde || '');
  // Solo rutas internas: nada de direcciones que vengan de fuera.
  if (donde && !/^#\/[a-z0-9\-/?=&.]*$/i.test(donde)) {
    return error(res, 'Esa dirección no se entiende.');
  }
  const { abrirEnNavegadorNormal } = require('../../servidor');
  const puerto = require('../../config').PUERTO;
  const abrio = abrirEnNavegadorNormal(`http://localhost:${puerto}/${donde}`);
  return ok(res, { abrio });
});

/**
 * LAS IMPRESORAS QUE VE WINDOWS.
 *
 * Para no tener que adivinar la IP ni el nombre compartido. De cada una
 * viene ya masticado lo que habría que escribir en el destino, y con un
 * toque se llena el campo.
 */
router.get('/impresoras', configurar, async (req, res) => {
  return ok(res, { impresoras: await impresorasDeWindows(), sistema: process.platform });
});

/**
 * QUÉ ENTIENDE EL SISTEMA DE LO QUE SE ESTÁ ESCRIBIENDO.
 *
 * Se contesta sin guardar nada: sirve para que la pantalla vaya diciendo
 * "voy a mandarlo por red a 192.168.1.65:9100" mientras se teclea. La mitad
 * de arreglar una impresora que no imprime es ver qué entendió el programa.
 */
router.get('/entender', configurar, (req, res) => {
  return ok(res, { como: tipoDeDestino(req.query.destino) });
});

router.put('/config', configurar, (req, res) => {
  const c = req.body || {};

  if (c.destino !== undefined) {
    const d = String(c.destino).trim();
    if (d.length > 200) return error(res, 'Ese destino es demasiado largo.');
    guardarAjuste('impresora_destino', d, req.usuario.id);
  }

  if (c.anchoMm !== undefined) {
    const n = Number(c.anchoMm);
    if (![58, 80].includes(n)) return error(res, 'El papel es de 58 o de 80 milímetros.');
    guardarAjuste('ticket_ancho_mm', n, req.usuario.id);
  }

  if (c.copias !== undefined) {
    const n = Number(c.copias);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      return error(res, 'Se imprimen entre 1 y 5 copias.');
    }
    guardarAjuste('ticket_copias', n, req.usuario.id);
  }

  if (c.pie !== undefined) {
    guardarAjuste('ticket_pie', String(c.pie).slice(0, 80), req.usuario.id);
  }

  if (c.codigoPagina !== undefined) {
    const n = Number(c.codigoPagina);
    if (!Number.isInteger(n) || n < 0 || n > 255) return error(res, 'Tabla de acentos inválida.');
    guardarAjuste('ticket_codepage', n, req.usuario.id);
  }

  if (c.abrirCajon !== undefined) {
    guardarAjuste('ticket_abrir_cajon', c.abrirCajon ? '1' : '0', req.usuario.id);
  }

  if (c.avanceCorte !== undefined) {
    const n = Number(c.avanceCorte);
    if (!Number.isInteger(n) || n < 0 || n > 8) {
      return error(res, 'El avance antes de cortar va de 0 a 8 renglones.');
    }
    guardarAjuste('ticket_avance_corte', n, req.usuario.id);
  }

  // La impresora de cada apartado. Vacío = la de tickets, que es lo que
  // casi siempre se quiere.
  if (c.apartados && typeof c.apartados === 'object') {
    for (const a of APARTADOS) {
      if (c.apartados[a.id] === undefined) continue;
      guardarAjuste(`impresora_destino_${a.id}`,
                    String(c.apartados[a.id]).trim().slice(0, 200), req.usuario.id);
    }
  }

  if (c.salidaCajon !== undefined) {
    const n = Number(c.salidaCajon);
    if (![2, 5].includes(n)) return error(res, 'El cajón va por la salida 2 o la 5.');
    guardarAjuste('ticket_cajon_salida', n, req.usuario.id);
  }

  bitacora.registrar({
    accion: 'impresion.config', entidad: 'configuracion',
    ejecutorId: req.usuario.id, detalle: configuracion()
  });

  return ok(res, { impresion: configuracion() });
});

router.post('/prueba', configurar, async (req, res) => {
  const r = await imprimirCrudo(ticketPrueba({ negocio: nombreNegocio() }));
  if (!r.impreso && r.motivo === 'sin-destino') {
    return error(res, 'Todavía no has puesto el nombre de la impresora.', 409);
  }
  if (!r.impreso) return error(res, `No se pudo imprimir: ${r.motivo}`, 502);
  return ok(res, { impreso: true });
});

// ============================================================
// IMPRIMIR DE VERDAD
// ============================================================

/**
 * El ticket de una venta. Se puede pedir las veces que haga falta: una
 * reimpresión sale marcada como COPIA para que no se confunda con el
 * original.
 */
/**
 * EL TICKET EN PANTALLA, sin gastar papel.
 *
 * Devuelve los renglones del ticket tal como saldrían por la térmica —el
 * espejo que arma el propio constructor de ESC/POS—, y la pantalla los
 * pinta con forma de ticket. No es una imagen: carga al instante, y si un
 * día cambia el diseño del papel, esta vista cambia sola.
 */
router.get('/venta/:id/previa', exigirPermiso('venta.ver'), (req, res) => {
  const venta = ventaCompleta(req.params.id);
  if (!venta) return error(res, 'Esa venta no existe.', 404);

  const papel = ticketVenta(venta, { negocio: nombreNegocio() });
  return ok(res, { renglones: recortarEspejo(papel.espejo), ancho: papel.anchoTicket });
});

router.get('/movimiento/:id/previa', exigirPermiso('caja.ver'), (req, res) => {
  const mov = bd.prepare(`
    SELECT m.*, u.nombre AS ejecutor_nombre, c.nombre AS capturista_nombre,
           k.nombre AS cajero_nombre
      FROM movimientos_caja m
      LEFT JOIN usuarios u ON u.id = m.ejecutor_id
      LEFT JOIN usuarios c ON c.id = m.capturista_id
      LEFT JOIN cajas   j ON j.id = m.caja_id
      LEFT JOIN usuarios k ON k.id = j.cajero_id
     WHERE m.id = ?
  `).get(req.params.id);
  if (!mov) return error(res, 'Ese movimiento no existe.', 404);

  const papel = ticketMovimiento(mov, { negocio: nombreNegocio() });
  return ok(res, { renglones: recortarEspejo(papel.espejo), ancho: papel.anchoTicket });
});

/** Los saltos del final —el avance para el corte— en pantalla solo estorban. */
function recortarEspejo(renglones = []) {
  const r = [...renglones];
  while (r.length && !r[r.length - 1].t.trim()) r.pop();
  return r;
}

/**
 * LA COTIZACIÓN  (v2.8)
 *
 * Imprime el papel del precio SIN vender: no hay folio, no se toca la
 * existencia, no entra al corte y el cajón NO se abre (no entró dinero).
 * Los precios los calcula el servidor con las mismas reglas que una venta
 * —lista activa, y la de mayoreo del cliente si va con nombre—, porque una
 * cotización con precios inventados por la pantalla no promete nada.
 * En la bitácora queda constancia de que se dio, con su total.
 */
router.post('/cotizacion', puedeImprimir, async (req, res) => {
  const lineas = req.body?.lineas;
  if (!Array.isArray(lineas) || !lineas.length) {
    return error(res, 'No hay nada que cotizar.');
  }

  const lista = listaActiva();
  if (!lista) return error(res, 'No hay ninguna lista de precios activa.', 409);

  const cliente = req.body?.clienteId
    ? bd.prepare('SELECT * FROM clientes WHERE id = ?').get(req.body.clienteId)
    : null;
  const conMayoreo = llevaMayoreoEnLineas(lineas);
  if (conMayoreo && !cliente) {
    return error(res, 'Esta cotización lleva mayoreo: falta decir de quién es.', 409,
                 { faltaCliente: true });
  }

  const preparadas = prepararLineas(lineas, lista, conMayoreo ? listaDeMayoreo(cliente) : null);
  if (preparadas.error) return error(res, preparadas.error, preparadas.codigo || 400);

  const cot = {
    fecha: new Date().toISOString(),
    atendio: req.usuario.nombre,
    cliente: cliente?.nombre || null,
    lineas: preparadas.lineas,
    total: preparadas.total
  };

  const papel = ticketCotizacion(cot, { negocio: nombreNegocio() });

  bitacora.registrar({
    accion: 'venta.cotizacion', entidad: 'usuario', entidadId: req.usuario.id,
    ejecutorId: req.usuario.id,
    detalle: { total: preparadas.total, renglones: preparadas.lineas.length,
               cliente: cliente?.nombre || null }
  });

  const cfg = configuracion();
  // SIN pulso de cajón: no entró dinero, no hay billetes que guardar.
  const r = cfg.directa
    ? await imprimirCrudo(papel, { seccion: 'venta' })
    : { impreso: false, motivo: 'sin-destino' };

  // Con o sin impresora, el espejo viaja: si no salió papel, la pantalla
  // lo enseña como ticket simulado y el precio no se queda sin darse.
  return ok(res, {
    impreso: r.impreso,
    motivo: r.impreso ? undefined : r.motivo,
    total: preparadas.total,
    renglones: recortarEspejo(papel.espejo),
    ancho: papel.anchoTicket
  });
});

router.post('/venta/:id', puedeImprimir, async (req, res) => {
  const venta = ventaCompleta(req.params.id);
  if (!venta) return error(res, 'Esa venta no existe.', 404);

  const cfg = configuracion();
  if (!cfg.directa) return ok(res, { impreso: false, motivo: 'sin-destino' });

  const copia = req.body?.copia === true;
  const cuantas = copia ? 1 : cfg.copias;

  // EL CAJÓN VA PEGADO AL TICKET, no aparte.
  //
  // Antes el pulso se mandaba al cobrar. Eso tenía dos problemas de los que
  // se notan en el mostrador: si la impresora estaba apagada el cajón no se
  // abría igual —el pulso se lo manda ELLA— y nadie entendía por qué; y si
  // el cajero volvía a imprimir, el cajón ya no se abría.
  //
  // Ahora el pulso viaja con los bytes del primer ticket, en el mismo
  // viaje: si sale papel, se abre; si no sale papel, no se abre. Y sale
  // cada vez que se imprime, no solo la primera. Va solo en el primero
  // porque tres copias del mismo ticket son un cobro, no tres.
  const pulso = cfg.abrirCajon ? pulsoCajon(cfg.salidaCajon) : null;

  let ultimo = { impreso: false, motivo: 'nada' };
  for (let i = 0; i < cuantas; i++) {
    const papel = ticketVenta(venta, { copia, negocio: nombreNegocio() });
    const bytes = i === 0 && pulso ? Buffer.concat([pulso, papel]) : papel;
    ultimo = await imprimirCrudo(bytes, { seccion: 'venta' });
    if (!ultimo.impreso) break;
  }

  if (!ultimo.impreso) return error(res, `No se pudo imprimir: ${ultimo.motivo}`, 502);

  if (copia) {
    bitacora.registrar({
      accion: 'venta.reimpresa', entidad: 'venta', entidadId: venta.id,
      ejecutorId: req.usuario.id,
      detalle: { folio: venta.folio, total: venta.total_centavos }
    });
  }

  return ok(res, { impreso: true, cajon: Boolean(pulso) });
});

/**
 * EL CORTE DE CAJA, en papel térmico y sin ventana de por medio.
 *
 * Sale dos o tres veces al día y siempre en la misma impresora: la ventana
 * de "elegir impresora" del navegador ahí solo estorbaba.
 */
router.post('/corte/:id', exigirPermiso('caja.ver'), async (req, res) => {
  const caja = bd.prepare(`
    SELECT c.*, u.nombre AS cajero_nombre, v.nombre AS cerrada_por_nombre,
           r.nombre AS recibido_por_nombre
      FROM cajas c
      LEFT JOIN usuarios u ON u.id = c.cajero_id
      LEFT JOIN usuarios v ON v.id = c.cerrada_por
      LEFT JOIN usuarios r ON r.id = c.recibido_por
     WHERE c.id = ?
  `).get(req.params.id);
  if (!caja) return error(res, 'Ese corte no existe.', 404);
  if (!caja.cerrada_en) return error(res, 'Ese turno todavía no se ha cerrado.');

  const corte = {
    caja,
    movimientos: bd.prepare(
      'SELECT * FROM movimientos_caja WHERE caja_id = ? ORDER BY fecha').all(caja.id),
    ventas: bd.prepare(`
      SELECT COUNT(*) FILTER (WHERE cancelada_en IS NULL) AS cobradas,
             COUNT(*) FILTER (WHERE cancelada_en IS NOT NULL) AS canceladas
        FROM ventas WHERE caja_id = ?`).get(caja.id),
    porPersona: desglosePorPersona(caja.id),
    hielo: cuadreDeHielo(caja.id)
  };

  const cfg = configuracion();
  if (!cfg.directa) return ok(res, { impreso: false, motivo: 'sin-destino' });

  const negocio = nombreNegocio();

  // LOS PAPELES DEL CIERRE, en un solo tirón:
  //
  //   1. el corte del turno, con el dinero y SOLO EL TOTAL de gastos:
  //      es el que se firma y se entrega con el cajón
  //   2. el detalle: los gastos y las entradas, uno por uno (v4.1)
  //   3. EL CUADRE DEL HIELO: cuánto había, cuánto se produjo, cuánto se
  //      contó, cuánto faltó, y de dónde salió cada número (v4.2)
  //   4. uno por cajero, si el turno se relevó a media noche
  //   5. el resumen del día: cuánto hielo queda ahora mismo en cada cuarto
  //
  // Van juntos porque juntos es como se leen: si el cajón cuadra pero
  // falta hielo, el problema no está en la caja. En papeles separados
  // nadie los junta. Pero cada uno sale con su corte de papel: el primero
  // se entrega y el segundo se queda en la carpeta.
  const papeles = [ticketCorte(corte, { negocio })];

  const detalle = ticketCorteMovimientos(corte, { negocio });
  if (detalle) papeles.push(detalle);

  // EL PAPEL DEL HIELO. Solo si ese turno contó: un cuadre con todo en
  // cero haría creer que se contó y salió cero.
  const hielo = ticketHielo(corte, { negocio });
  if (hielo) papeles.push(hielo);

  if (corte.porPersona.length > 1) {
    for (const p of corte.porPersona) {
      papeles.push(ticketCortePersona(corte, p, { negocio }));
    }
  }

  papeles.push(ticketResumenDia({
    fecha: caja.cerrada_en,
    quien: caja.cerrada_por_nombre || caja.cajero_nombre,
    almacenes: existenciaParaElCorte(),
    produccion: resumenDelDia()
  }, { negocio }));

  let ultimo = { impreso: false, motivo: 'nada' };
  for (const papel of papeles) {
    ultimo = await imprimirCrudo(papel, { seccion: 'corte' });
    if (!ultimo.impreso) break;
  }

  if (!ultimo.impreso) return error(res, `No se pudo imprimir: ${ultimo.motivo}`, 502);
  return ok(res, { impreso: true, papeles: papeles.length });
});

/**
 * Cuánto hielo debería haber en cada cuarto frío, para el papel del cierre.
 *
 * Es el mismo cálculo de la pantalla de Existencia —no hay un número
 * guardado que se pueda desincronizar (regla 3.2)— y por eso dice también
 * cuándo fue el último conteo: "deberían quedar 18" vale muy poco si el
 * último conteo fue hace tres días.
 */
function existenciaParaElCorte() {
  const almacenes = bd.prepare(
    'SELECT * FROM almacenes WHERE activo = 1 ORDER BY orden, nombre'
  ).all();

  return almacenes.map((a) => {
    const e = estadoAlmacen(a);
    return {
      nombre: a.nombre,
      esperado: e.esperado,
      contado: e.existenciaAnterior,
      ultimoConteo: e.ultimoConteo?.fecha || null
    };
  });
}

/** El cuadre de un conteo del cuarto frío. */
router.post('/conteo/:id', exigirPermiso('existencia.ver'), async (req, res) => {
  const c = bd.prepare(`
    SELECT c.*, a.nombre AS almacen_nombre, u.nombre AS ejecutor_nombre
      FROM conteos c
      LEFT JOIN almacenes a ON a.id = c.almacen_id
      LEFT JOIN usuarios u  ON u.id = c.ejecutor_id
     WHERE c.id = ?
  `).get(req.params.id);
  if (!c) return error(res, 'Ese conteo no existe.', 404);

  const cfg = configuracion();
  if (!cfg.directa) return ok(res, { impreso: false, motivo: 'sin-destino' });

  // El conteo guarda sus números congelados en el momento (regla 3.2), así
  // que el papel de hoy dice lo mismo que el de aquel día aunque después se
  // haya cancelado una venta.
  const esperado = c.existencia_anterior + c.producido - c.vendido;
  const conteo = {
    fecha: c.fecha,
    almacen: c.almacen_nombre,
    ejecutor: c.ejecutor_nombre,
    resumen: {
      primerConteo: !c.desde,
      anterior: c.existencia_anterior, producido: c.producido,
      vendido: c.vendido, merma: 0,
      esperado, contado: c.contado,
      faltante: esperado - c.contado
    }
  };

  const r = await imprimirCrudo(ticketConteo(conteo, { negocio: nombreNegocio() }),
                                { seccion: 'conteo' });
  if (!r.impreso) return error(res, `No se pudo imprimir: ${r.motivo}`, 502);
  return ok(res, { impreso: true });
});

/**
 * LOS NÚMEROS A SACAR, por la térmica.
 *
 * Los datos se vuelven a pedir aquí y no llegan del navegador: un papel que
 * dice qué paño le toca al obrero no puede salir de lo que alguien mande en
 * el cuerpo de la petición.
 */
router.post('/produccion', exigirPermiso('produccion.numeros'), async (req, res) => {
  const cfg = configuracion();
  if (!cfg.directa) return ok(res, { impreso: false, motivo: 'sin-destino' });

  const datos = numerosASacar(req.usuario.nombre);
  const r = await imprimirCrudo(ticketProduccion(datos, { negocio: nombreNegocio() }),
                                { seccion: 'produccion' });
  if (!r.impreso) return error(res, `No se pudo imprimir: ${r.motivo}`, 502);
  return ok(res, { impreso: true });
});

/**
 * ABRIR EL CAJÓN DEL DINERO.
 *
 * El cajón cuelga de la impresora por un cable: quien le manda el pulso es
 * ella. Por eso abrirlo es "imprimir" cinco bytes sin papel.
 *
 * Va aparte del ticket y no colgado de él: el ticket solo sale si alguien
 * lo pide, y el cajón tiene que abrirse siempre que entre dinero. También
 * lo usa el botón de la caja, para cuando hay que dar cambio de algo que no
 * fue una venta.
 */
router.post('/cajon', puedeImprimir, async (req, res) => {
  const cfg = configuracion();
  if (!cfg.directa) return ok(res, { abierto: false, motivo: 'sin-destino' });

  const r = await imprimirCrudo(pulsoCajon(cfg.salidaCajon), { seccion: 'venta' });
  if (!r.impreso) return error(res, `No se pudo abrir el cajón: ${r.motivo}`, 502);

  return ok(res, { abierto: true });
});

/**
 * El comprobante de un gasto. Los gastos SÍ llevan papel: alguien se llevó
 * dinero del cajón y tiene que quedar constancia firmada. Meter dinero no
 * lleva ticket: nadie firma por dejar dinero.
 */
router.post('/movimiento/:id', puedeImprimir, async (req, res) => {
  const mov = bd.prepare(`
    SELECT m.*, u.nombre AS ejecutor_nombre, c.nombre AS capturista_nombre,
           k.nombre AS cajero_nombre
      FROM movimientos_caja m
      LEFT JOIN usuarios u ON u.id = m.ejecutor_id
      LEFT JOIN usuarios c ON c.id = m.capturista_id
      LEFT JOIN cajas   j ON j.id = m.caja_id
      LEFT JOIN usuarios k ON k.id = j.cajero_id
     WHERE m.id = ?
  `).get(req.params.id);
  if (!mov) return error(res, 'Ese movimiento no existe.', 404);

  const cfg = configuracion();
  if (!cfg.directa) return ok(res, { impreso: false, motivo: 'sin-destino' });

  // UNA COPIA NO ABRE EL CAJÓN. El dinero ya se movió cuando se anotó el
  // gasto; volver a abrirlo por un papel de más es abrirlo por nada, y el
  // cajón abierto sin motivo es justo lo que no se quiere en el mostrador.
  const copia = req.body?.copia === true;
  const pulso = cfg.abrirCajon && !copia ? pulsoCajon(cfg.salidaCajon) : null;
  const papel = ticketMovimiento(mov, { copia, negocio: nombreNegocio() });

  const r = await imprimirCrudo(pulso ? Buffer.concat([pulso, papel]) : papel,
                                { seccion: 'gasto' });
  if (!r.impreso) return error(res, `No se pudo imprimir: ${r.motivo}`, 502);
  return ok(res, { impreso: true, copia, cajon: Boolean(pulso) });
});

module.exports = router;
