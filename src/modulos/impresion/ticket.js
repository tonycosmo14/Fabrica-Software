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

module.exports = { ticketVenta, ticketMovimiento, ticketPrueba, fechaCorta };
