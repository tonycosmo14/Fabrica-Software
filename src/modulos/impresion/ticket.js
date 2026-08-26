/**
 * EL TICKET, EN BYTES  (v2.3)
 *
 * CÓMO SE CONSTRUYE UN TICKET, SIEMPRE
 *
 * Todos los papeles del negocio —venta, gasto, corte, conteo— se arman con
 * la misma receta, para que quien los junta en una caja de zapatos los
 * reconozca sin leerlos:
 *
 *      #2026-152125          Atendio: Tony Castilla
 *                                26/Ago/2026 5:45pm
 *      Cliente: Mario Cauich
 *      ------------------------------------------------
 *      2 3/8                                            ← grande
 *      (2 + 1/4 + 1/8) ......................... $610.00
 *      2 Coca 600 ............................... $50.00
 *      ------------------------------------------------
 *                                       TOTAL:   $660.00
 *                                       PAGO:    $700.00
 *                                       CAMBIO:   $40.00
 *      HIELO LOLHA
 *
 * Arriba a la izquierda QUÉ es este papel: el número del ticket, o la
 * palabra "Gasto". Arriba a la derecha QUIÉN estaba en la caja y CUÁNDO.
 * En medio el contenido, entre dos rayas. Abajo el negocio.
 *
 * Se imprimen cientos al día: cada renglón de más son metros de papel al
 * mes. Va lo mínimo, y lo que importa —cuánto hielo se llevó— en grande.
 */
const { Ticket } = require('./escpos');
const { configuracion } = require('./impresora');
const { aTexto, desglose } = require('../../lib/fracciones');
const { formato } = require('../../lib/dinero');
const { numeroDeTicket } = require('../ventas/folio');

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul',
               'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** 23/08/26 05:23 p.m. — la de siempre, para donde ya se usaba. */
function fechaCorta(iso) {
  const d = new Date(iso);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = String(d.getFullYear()).slice(2);
  const hora = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  return `${dia}/${mes}/${anio} ${hora}`;
}

/**
 * 26/Ago/2026 5:45pm — la fecha de la esquina del ticket.
 *
 * Con el mes en letras a propósito: en un papel que alguien va a leer
 * dentro de seis meses, "26/08" y "08/26" se confunden, y "26/Ago" no.
 */
function fechaTicket(iso) {
  const d = new Date(iso);
  const h = d.getHours();
  const minutos = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()}/${MESES[d.getMonth()]}/${d.getFullYear()} ` +
         `${h % 12 || 12}:${minutos}${h < 12 ? 'am' : 'pm'}`;
}

/**
 * LA ESQUINA DE ARRIBA, igual en todos los papeles.
 *
 * A la izquierda y en grande, qué es esto. A la derecha, chiquito, quién
 * estaba en la caja y a qué hora. Van en renglones distintos porque una
 * impresora térmica no sabe cambiar de tamaño a media línea.
 */
function encabezado(t, { titulo, atendio, fecha }) {
  t.izquierda().negrita().tamano(2, 2).linea(titulo).normal();
  t.derecha();
  if (atendio) t.linea(`Atendio: ${atendio}`);
  if (fecha) t.linea(fecha);
  return t.izquierda();
}

/**
 * LA MARCA DE COPIA.
 *
 * Va hasta arriba de todo y con asteriscos de lado a lado. Es lo único que
 * separa un comprobante de su reimpresión, y de eso depende que nadie cobre
 * dos veces el mismo ticket: si hay que entrecerrar los ojos para verlo, no
 * sirve.
 */
function marcaCopia(t) {
  t.centro().negrita();
  t.linea('*'.repeat(t.ancho));
  t.tamano(2, 2).linea('** COPIA **').tamano(1, 1);
  t.linea('*'.repeat(t.ancho));
  return t.normal().izquierda();
}

/** El pie: el nombre del negocio abajo a la izquierda, como en la foto. */
function pie(t, negocio) {
  const cfg = configuracion();
  const nombre = String(negocio || '').trim();
  if (!nombre && !cfg.pie) return t;
  t.izquierda();
  if (nombre) t.negrita().linea(nombre.toUpperCase()).negrita(false);
  if (cfg.pie) t.linea(cfg.pie);
  return t;
}

/** El ticket de una venta. `copia` marca las reimpresiones. */
function ticketVenta(venta, { copia = false, negocio = '' } = {}) {
  const cfg = configuracion();
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina);

  const lineasHielo = venta.lineas.filter((l) => l.dieciseisavos > 0);
  const otras = venta.lineas.filter((l) => l.dieciseisavos === 0);
  const hielo = lineasHielo.reduce((n, l) => n + l.dieciseisavos, 0);
  const importeHielo = lineasHielo.reduce((n, l) => n + l.precio_centavos, 0);

  // Lo primero de todo, antes que el número: si es copia, que se vea desde
  // el otro lado del mostrador.
  if (copia) marcaCopia(t);
  if (venta.cancelada_en) {
    t.centro().negrita().tamano(2, 2).linea('CANCELADO').normal().izquierda();
  }

  encabezado(t, {
    titulo: `#${numeroDeTicket(venta)}`,
    atendio: venta.cajero_nombre,
    fecha: fechaTicket(venta.fecha)
  });
  if (venta.cliente_nombre) t.linea(`Cliente: ${venta.cliente_nombre}`);
  t.separador();

  // EL HIELO, EN GRANDE. Es lo único que el cliente comprueba de un
  // vistazo: que dice lo que se llevó. Debajo, en chico, de qué piezas
  // salió esa cuenta y cuánto costó.
  if (hielo) {
    t.izquierda().negrita().tamano(3, 3).linea(aTexto(hielo)).normal();
    const partes = desglose(hielo);
    t.punteado(partes !== aTexto(hielo) ? `(${partes})` : 'Hielo', formato(importeHielo));
  }

  for (const l of otras) {
    const cuantas = Number(l.cantidad) > 1 ? `${l.cantidad} ` : '';
    t.punteado(`${cuantas}${l.concepto}`, formato(l.precio_centavos));
  }

  t.separador();

  // EL CUADRE DE UN CAMBIO NO ES EL DE UNA VENTA.
  //
  // En un cambio el cliente no paga con billetes: paga con un ticket que ya
  // tenía a favor. Por dentro la venta nueva se guarda como pagada completa
  // —para que el arqueo del cajón cuadre—, y con eso el papel salía
  // diciendo "TOTAL $132 · PAGO $132 · CAMBIO $0", que es verdad para la
  // caja y mentira para el cliente: él trajo un vale de $314 y tiene que
  // llevarse $182. Eso es lo que hay que imprimir.
  const enCambio = venta.cambioDeNumero && venta.cambioDeTotal != null;
  if (enCambio) {
    const diferencia = venta.total_centavos - venta.cambioDeTotal;
    t.bloqueDerecha([
      ['TOTAL:', formato(venta.total_centavos)],
      [`VALE #${venta.cambioDeNumero}:`, formato(venta.cambioDeTotal)],
      diferencia < 0 ? ['SE LE DEVUELVE:', formato(-diferencia)]
      : diferencia > 0 ? ['PAGO ADEMAS:', formato(diferencia)]
      : ['QUEDA A MANO:', formato(0)]
    ]);
  } else {
    t.bloqueDerecha([
      ['TOTAL:', formato(venta.total_centavos)],
      venta.pago_centavos != null ? ['PAGO:', formato(venta.pago_centavos)] : null,
      venta.pago_centavos != null ? ['CAMBIO:', formato(venta.cambio_centavos || 0)] : null
    ]);
  }

  // FIADO. Va en grande y con el nombre porque este papel es el vale: el
  // cliente se lleva su copia y con eso los dos saben lo mismo. Y lleva la
  // línea para firmar, que es lo que hace que sirva de algo al reclamar.
  if (venta.forma_pago === 'credito') {
    t.separador();
    t.centro().negrita().tamano(2, 2).linea('FIADO').normal();
    if (venta.cliente_negocio) t.centro().linea(venta.cliente_negocio);
    t.izquierda().firma('FIRMA DE RECIBIDO');
  } else if (venta.forma_pago === 'transferencia') {
    t.centro().linea('Pagado por transferencia').izquierda();
  }

  // MAYOREO. En un ticket pagado de contado, la lista es lo que explica por
  // qué la marqueta salió a $240 y no a $264. Un renglón, y solo cuando de
  // verdad hubo mayoreo.
  if (venta.forma_pago !== 'credito' && venta.lista_tipo === 'mayoreo') {
    t.izquierda().linea(`Precio de ${venta.lista_nombre || 'mayoreo'}`);
  }

  pie(t, negocio);

  // DE QUÉ TICKET VIENE ESTE. Un cambio se ve igual que una venta, y sin
  // este renglón nadie sabría que el hielo de este papel ya se había pagado
  // en otro: el corte cuadraría y la existencia no.
  if (venta.cambioDeNumero) {
    t.negrita().linea(`CAMBIO DEL #${venta.cambioDeNumero}`).negrita(false);
  }

  t.izquierda().cortar();
  return t.bytes();
}

/**
 * EL COMPROBANTE DE UN GASTO O RETIRO DEL CAJÓN.
 *
 *      Gasto                     Atendio: Tony Castilla
 *                                    26/Ago/2026 5:45pm
 *      ------------------------------------------------
 *      $62.50
 *      GASOLINA PARA LIMPIAR PIEZAS DE LA MAQUINA NUEVA
 *      EN REPARACION
 *      ------------------------------------------------
 *                       ______________
 *                            FIRMA
 *
 * "Atendio" es quien tiene el turno de caja: de ese cajón salió el dinero y
 * es su corte el que va a salir corto. Antes decía además "lo tomó" y "lo
 * anotó", que en la práctica son casi siempre la misma persona y llenaban
 * el papel de nombres. Los dos siguen guardados en la bitácora (regla 3.6),
 * que es donde se buscan cuando de verdad hacen falta.
 */
function ticketMovimiento(mov, { negocio = '' } = {}) {
  const cfg = configuracion();
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina);
  const salida = mov.tipo === 'salida';

  encabezado(t, {
    titulo: salida ? 'Gasto' : 'Entrada',
    atendio: mov.cajero_nombre || mov.ejecutor_nombre,
    fecha: fechaTicket(mov.fecha)
  });
  t.separador();

  t.izquierda().negrita().tamano(2, 2).linea(formato(mov.centavos)).normal();
  t.parrafo(String(mov.concepto || '').toUpperCase());
  if (mov.notas) t.parrafo(mov.notas);

  if (mov.anulado_en) {
    t.centro().negrita().tamano(2, 2).linea('ANULADO').normal().izquierda();
  }

  t.separador();

  // El gasto se firma; meter dinero al cajón no. Nadie firma por dejar.
  if (salida) t.firma();

  pie(t, negocio);
  t.izquierda().cortar();
  return t.bytes();
}

/**
 * LOS NÚMEROS A SACAR, para el obrero.
 *
 * Este papel se lo lleva en la mano al cuarto de tanques, y vuelve escrito
 * con lo que sacó de verdad. Salía por la ventana de imprimir del navegador
 * —hoja tamaño carta, elegir impresora, vista previa— y en un cuarto de
 * máquinas eso no lo hace nadie: sale por la térmica como todo lo demás.
 *
 * Los números van GRANDES a propósito. El obrero lo lee con guantes, con la
 * mano mojada y con poca luz.
 */
function ticketProduccion(datos, { negocio = '' } = {}) {
  const cfg = configuracion();
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina);

  encabezado(t, {
    titulo: 'A sacar',
    atendio: datos.entregadoPor,
    fecha: fechaTicket(datos.fecha)
  });
  t.separador();

  for (const grupo of datos.lista || []) {
    t.izquierda().negrita().linea(String(grupo.tanque || '').toUpperCase()).negrita(false);

    if (!grupo.siguientes?.length) {
      t.linea('  sin paños');
    } else {
      // El primero es el que toca AHORA; los demás son la fila para el
      // resto de la jornada. Por eso el primero va más grande.
      const [primero, ...luego] = grupo.siguientes;
      t.negrita().tamano(3, 2).linea(`  ${primero}`).normal();
      if (luego.length) t.linea(`  luego: ${luego.join(', ')}`);
    }

    if (grupo.enProceso?.length) {
      t.linea(`  a medias: ${grupo.enProceso.join(', ')} - terminar primero`);
    }
    t.saltos(1);
  }

  t.separador();
  t.linea('Saco de verdad:');
  t.firma('FIRMA DEL OBRERO');

  pie(t, negocio);
  t.izquierda().cortar();
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
  ticketCorte, ticketConteo, ticketProduccion, pulsoCajon, fechaCorta, fechaTicket
};
