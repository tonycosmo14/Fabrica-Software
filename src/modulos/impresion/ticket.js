/**
 * EL TICKET, EN BYTES  (v0.11)
 *
 * Mismo diseño que el de la pantalla, pero armado para la impresora:
 *
 *      #12        23/08/26 05:23 p.m.        Tony
 *      ------------------------------------------
 *
 *                        3/4                       ← grande y centrado
 *                     1/2 + 1/4
 *
 *      Coca 600                            $25.00
 *      ------------------------------------------
 *                      $230.00
 *          Pago $500.00 - cambio $270.00
 *
 * Se imprimen cientos al día: cada renglón de más son metros de papel al
 * mes. Va lo mínimo, y lo que importa —cuánto hielo se llevó— en grande.
 */
const { Ticket } = require('./escpos');
const { configuracion } = require('./impresora');
const { aTexto, desglose } = require('../../lib/fracciones');
const { formato } = require('../../lib/dinero');

/** 23/08/26 05:23 p.m. */
function fechaCorta(iso) {
  const d = new Date(iso);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = String(d.getFullYear()).slice(2);
  const hora = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  return `${dia}/${mes}/${anio} ${hora}`;
}

/** El ticket de una venta. `copia` marca las reimpresiones. */
function ticketVenta(venta, { copia = false, negocio = '' } = {}) {
  const cfg = configuracion();
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina);

  const hielo = venta.lineas
    .filter((l) => l.dieciseisavos > 0)
    .reduce((n, l) => n + l.dieciseisavos, 0);
  const otras = venta.lineas.filter((l) => l.dieciseisavos === 0);

  t.izquierda().normal();
  t.columnas3(`#${venta.folio}`, fechaCorta(venta.fecha),
              (venta.cajero_nombre || '').split(' ')[0]);
  t.separador();

  if (copia) {
    t.centro().negrita().linea('*** COPIA ***').negrita(false).izquierda();
  }
  if (venta.cancelada_en) {
    t.centro().negrita().tamano(2, 2).linea('CANCELADO').normal().izquierda();
  }

  if (hielo) {
    t.centro().negrita().tamano(3, 3).linea(aTexto(hielo)).normal();
    const partes = desglose(hielo);
    if (partes !== aTexto(hielo)) t.centro().linea(partes);
    t.izquierda();
  }

  if (otras.length) {
    if (hielo) t.saltos(1);
    for (const l of otras) t.columnas2(l.concepto, formato(l.precio_centavos));
  }

  t.separador();
  t.centro().negrita().tamano(2, 2).linea(formato(venta.total_centavos)).normal();

  if (venta.pago_centavos && venta.cambio_centavos) {
    t.centro().linea(
      `Pago ${formato(venta.pago_centavos)} - cambio ${formato(venta.cambio_centavos)}`);
  }

  // FIADO. Va en grande y con el nombre porque este papel es el vale: el
  // cliente se lleva su copia y con eso los dos saben lo mismo. Y lleva la
  // línea para firmar, que es lo que hace que sirva de algo al reclamar.
  if (venta.forma_pago === 'credito') {
    t.separador();
    t.centro().negrita().tamano(2, 2).linea('FIADO').normal();
    if (venta.cliente_nombre) t.centro().negrita().linea(venta.cliente_nombre).negrita(false);
    if (venta.cliente_negocio) t.centro().linea(venta.cliente_negocio);
    t.izquierda().saltos(2);
    t.centro().linea('_____________________');
    t.linea('Firma de recibido');
    t.izquierda();
  } else if (venta.forma_pago === 'transferencia') {
    t.centro().linea('Pagado por transferencia');
  }

  // MAYOREO. En un ticket pagado de contado el nombre del cliente no
  // sobraría por gusto: es lo que explica por qué la marqueta salió a $240
  // y no a $264. Un renglón, y solo cuando de verdad hubo mayoreo.
  if (venta.forma_pago !== 'credito' && venta.lista_tipo === 'mayoreo') {
    t.centro().linea(`${venta.cliente_nombre || 'Mayoreo'} - ${venta.lista_nombre}`);
    t.izquierda();
  }

  if (negocio || cfg.pie) {
    t.separador();
    t.centro();
    if (negocio) t.linea(negocio);
    if (cfg.pie) t.linea(cfg.pie);
  }

  t.izquierda().cortar();
  return t.bytes();
}

/** El comprobante de un gasto o retiro del cajón. */
function ticketMovimiento(mov, { negocio = '' } = {}) {
  const cfg = configuracion();
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina);

  t.centro().negrita().linea(mov.tipo === 'salida' ? 'SALIDA DE CAJA' : 'ENTRADA A CAJA');
  t.negrita(false).linea(fechaCorta(mov.fecha)).izquierda();
  t.separador();

  t.centro().linea(mov.concepto);
  t.negrita().tamano(2, 2).linea(formato(mov.centavos)).normal();
  t.separador();

  t.izquierda();
  t.linea(`Lo tomo: ${mov.ejecutor_nombre || '—'}`);
  t.linea(`Lo anoto: ${mov.capturista_nombre || '—'}`);
  t.saltos(2);
  t.linea('Firma: ____________________');

  if (negocio) { t.separador().centro().linea(negocio).izquierda(); }
  t.cortar();
  return t.bytes();
}

/** Un ticket de prueba, para ver si la impresora quedó bien configurada. */
function ticketPrueba({ negocio = 'Hielo LOLHA' } = {}) {
  const cfg = configuracion();
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina);

  t.centro().negrita().linea('PRUEBA DE IMPRESION').negrita(false);
  t.linea(fechaCorta(new Date().toISOString())).izquierda();
  t.separador();

  t.linea(`Papel: ${cfg.anchoMm} mm (${new Ticket(cfg.anchoMm).ancho} letras)`);
  t.linea(`Destino: ${cfg.destino || '(sin configurar)'}`);
  t.saltos(1);

  // Con acentos a propósito: si salen cuadritos, hay que cambiar la tabla.
  t.linea('Acentos: año, cañón, ñ á é í ó ú Ñ').izquierda();
  t.centro().negrita().tamano(3, 3).linea('3/4').normal().izquierda();
  t.columnas2('Renglon de prueba', formato(26400));
  t.separador();

  t.centro().linea('Si se lee todo bien, esta listo.');
  if (negocio) t.linea(negocio);
  t.izquierda().cortar();
  return t.bytes();
}

/**
 * EL CORTE DE CAJA, EN PAPEL TÉRMICO.
 *
 * Hasta la v2.0 el corte lo imprimía el navegador, con su ventana de
 * "elegir impresora" cada vez. Es el papel que se firma al cerrar el turno:
 * sale dos o tres veces al día y siempre en la misma impresora, así que esa
 * ventana era puro estorbo.
 *
 * Los movimientos van en dos columnas —gastos de un lado, entradas del
 * otro— por lo mismo que en la pantalla: un día de gastos son quince
 * renglones, y eso todos los días.
 */
function ticketCorte(corte, { negocio = '' } = {}) {
  const cfg = configuracion();
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina);
  const c = corte.caja;
  const dif = c.diferencia_centavos;

  t.centro().negrita().linea((negocio || 'Hielo LOLHA').toUpperCase()).negrita(false);
  t.linea(fechaCorta(c.cerrada_en));
  t.izquierda().separador();
  t.centro().negrita().tamano(2, 2).linea(`CORTE #${c.folio}`).normal().izquierda();
  t.separador();

  t.columnas2('Cajero', c.cajero_nombre || '-');
  t.columnas2('Abierto', fechaCorta(c.abierta_en));
  t.columnas2('Cerrado', fechaCorta(c.cerrada_en));
  t.columnas2('Tickets', String(corte.ventas.cobradas));
  if (corte.ventas.canceladas) t.columnas2('Cancelados', String(corte.ventas.canceladas));
  t.separador();

  t.columnas2('Fondo', formato(c.fondo_centavos));
  t.columnas2('Cobrado', '+' + formato(c.vendido_centavos));
  if (c.entradas_centavos) t.columnas2('Entradas', '+' + formato(c.entradas_centavos));
  t.columnas2('Gastos y retiros', '-' + formato(c.salidas_centavos));
  t.separador();
  t.negrita().columnas2('Deberia haber', formato(c.esperado_centavos));
  t.columnas2('Contado', formato(c.contado_centavos)).negrita(false);

  t.centro().negrita().tamano(2, 2)
   .linea(dif === 0 ? 'CUADRO' : dif > 0 ? `SOBRA ${formato(dif)}` : `FALTA ${formato(-dif)}`)
   .normal().izquierda();

  // Los movimientos, en dos columnas para ahorrar papel.
  if (corte.movimientos.length) {
    const gastos = corte.movimientos.filter((m) => m.tipo === 'salida');
    const entradas = corte.movimientos.filter((m) => m.tipo !== 'salida');
    t.separador();
    if (gastos.length) columnaDeMovimientos(t, 'GASTOS', gastos, '-');
    if (entradas.length) columnaDeMovimientos(t, 'ENTRADAS', entradas, '+');
  }

  t.separador();
  t.linea(`Cerro: ${c.cerrada_por_nombre || '-'}`);
  t.saltos(2).linea('Firma: _____________________');
  t.izquierda().cortar();
  return t.bytes();
}

/** Un bloque de movimientos con su suma, para el corte. */
function columnaDeMovimientos(t, titulo, lista, signo) {
  t.negrita().linea(`${titulo} (${lista.length})`).negrita(false);
  let suma = 0;
  for (const m of lista) {
    if (!m.anulado_en) suma += m.centavos;
    t.columnas2(m.anulado_en ? `(anulado) ${m.concepto}` : m.concepto,
                m.anulado_en ? '-' : signo + formato(m.centavos));
  }
  t.negrita().columnas2('Suman', signo + formato(suma)).negrita(false);
}

/**
 * EL CUADRE DEL CUARTO FRÍO, en papel térmico.
 *
 * Se cuenta dos veces al día y el papel se guarda. La misma cuenta que en
 * la pantalla, en el orden en que se explica de viva voz.
 */
function ticketConteo(conteo, { negocio = '' } = {}) {
  const cfg = configuracion();
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina);
  const r = conteo.resumen;

  t.centro().negrita().linea((negocio || 'Hielo LOLHA').toUpperCase()).negrita(false);
  t.linea(fechaCorta(conteo.fecha));
  t.izquierda().separador();
  t.centro().negrita().linea(`CONTEO - ${(conteo.almacen || '').toUpperCase()}`)
   .negrita(false).izquierda();
  t.separador();

  t.columnas2('Conto', conteo.ejecutor || '-');
  if (r.primerConteo) {
    t.separador();
    t.centro().negrita().tamano(2, 2).linea(aTexto(r.contado)).normal().izquierda();
    t.centro().linea('primer conteo').izquierda();
  } else {
    t.columnas2('Habia', aTexto(r.anterior));
    t.columnas2('+ Se produjo', aTexto(r.producido));
    t.columnas2('- Se vendio', aTexto(r.vendido));
    if (r.merma) t.columnas2('- Merma', aTexto(r.merma));
    t.separador();
    t.negrita().columnas2('Deberia quedar', aTexto(r.esperado));
    t.columnas2('Contado', aTexto(r.contado)).negrita(false);
    t.centro().negrita().tamano(2, 2)
     .linea(r.faltante === 0 ? 'CUADRO'
            : r.faltante < 0 ? `SOBRA ${aTexto(-r.faltante)}` : `FALTA ${aTexto(r.faltante)}`)
     .normal().izquierda();
  }

  t.separador();
  t.saltos(2).linea('Firma: _____________________');
  t.izquierda().cortar();
  return t.bytes();
}

/**
 * SOLO EL PULSO DEL CAJÓN, sin papel de por medio.
 *
 * Va aparte del ticket a propósito. El ticket solo sale si el cajero lo
 * pide —no todos se entregan, y cada uno que sale sin que nadie lo pida es
 * papel tirado—, pero el cajón tiene que abrirse SIEMPRE que entre dinero.
 * Colgado del ticket, el día que nadie imprime el cajón no abre.
 */
function pulsoCajon(salida = 2) {
  const cfg = configuracion();
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina);
  t.abrirCajon(salida);
  return t.bytes();
}

module.exports = {
  ticketVenta, ticketMovimiento, ticketPrueba,
  ticketCorte, ticketConteo, pulsoCajon, fechaCorta
};
