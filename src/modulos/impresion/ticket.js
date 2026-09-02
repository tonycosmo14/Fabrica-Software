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
const { CALIDADES } = require('../produccion/calidad');
const { configuracion } = require('./impresora');
const { aTexto, desglose } = require('../../lib/fracciones');
const { formato } = require('../../lib/dinero');
const { numeroDeTicket } = require('../ventas/folio');

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul',
               'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/**
 * "8:00am" si es del mismo día, "25/Ago 10:00pm" si el turno cruzó la
 * medianoche. La fecha larga no cabe cuando el renglón lleva dos datos, y
 * cortada a la mitad —"26/08/26 08:00 a"— no dice nada.
 */
function cuandoCorto(iso, respectoA) {
  const d = new Date(iso);
  const otro = new Date(respectoA);
  if (d.toDateString() === otro.toDateString()) return soloHora(iso);
  return `${d.getDate()}/${MESES[d.getMonth()]} ${soloHora(iso)}`;
}

/** 5:45pm — solo la hora, para los renglones donde caben dos datos. */
function soloHora(iso) {
  const d = new Date(iso);
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`;
}

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
  // DOBLE DE ANCHO, ALTO NORMAL. En una térmica el alto es lo que cuesta:
  // tamano(2,2) ocupa DOS renglones de papel y tamano(2,1) uno solo. Se ve
  // igual de grande de ancho —que es lo que hace que el número resalte— y
  // vale la mitad.
  // Sin título (la cotización trae el suyo propio) no se gasta el renglón.
  if (titulo) t.izquierda().negrita().tamano(2, 1).linea(titulo).normal();

  // Quién y cuándo, en UN renglón si caben. Eran dos, y son el mismo dato:
  // quién estaba en la caja a qué hora.
  const quien = atendio ? `Atendio: ${atendio}` : '';
  const juntos = [quien, fecha].filter(Boolean).join('  ');

  t.derecha();
  if (juntos.length <= t.ancho) {
    if (juntos) t.linea(juntos);
  } else {
    // Con un nombre largo no caben: antes de recortar el nombre de nadie,
    // se gasta el renglón. Y si ni siquiera el nombre solo cabe, se parte
    // por palabras AQUÍ y no en la impresora: ella corta por donde le toca
    // la columna 48, a media palabra.
    if (quien) t.parrafo(quien);
    if (fecha) t.linea(fecha);
  }
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
    t.centro().negrita().tamano(2, 1).linea('CANCELADO').normal().izquierda();
  }

  encabezado(t, {
    titulo: `#${numeroDeTicket(venta)}`,
    atendio: venta.cajero_nombre,
    fecha: fechaTicket(venta.fecha)
  });
  // Por palabras y no por la columna 48: "Abarrotes y Cremeria La
  // Guadalupana del Centro" no cabe en un renglón, y cortado por la
  // impresora se parte a media palabra.
  if (venta.cliente_nombre) t.parrafo(`Cliente: ${venta.cliente_nombre}`);
  t.separador();

  // EL HIELO, EN GRANDE. Es lo único que el cliente comprueba de un
  // vistazo: que dice lo que se llevó. Debajo, en chico, de qué piezas
  // salió esa cuenta y cuánto costó.
  if (hielo) {
    t.izquierda().negrita().tamano(3, 2).linea(aTexto(hielo)).normal();
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
    t.bloqueDerecha([['TOTAL:', formato(venta.total_centavos)]]);

    // PAGO Y CAMBIO, EN UN RENGLÓN Y SOLO CUANDO DICEN ALGO.
    //
    // Eran dos renglones y salían siempre. Pero cuando el cliente paga
    // justo —que es la mitad de los tickets del mostrador— decían "PAGO
    // $17 · CAMBIO $0": el mismo número del total otra vez, y un cero. Dos
    // renglones para no decir nada, en el papel que más se imprime.
    //
    // Cuando SÍ hubo cambio, los dos números importan y van juntos: es la
    // cuenta que el cliente comprueba, y se lee mejor de corrido que en
    // dos renglones separados.
    const pago = venta.pago_centavos;
    if (pago != null && pago !== venta.total_centavos) {
      t.derecha()
       .linea(`PAGO: ${formato(pago)}   CAMBIO: ${formato(venta.cambio_centavos || 0)}`)
       .izquierda();
    }
  }

  // FIADO. Va en grande y con el nombre porque este papel es el vale: el
  // cliente se lleva su copia y con eso los dos saben lo mismo. Y lleva la
  // línea para firmar, que es lo que hace que sirva de algo al reclamar.
  if (venta.forma_pago === 'credito') {
    t.separador();
    t.centro().negrita().tamano(2, 1).linea('FIADO').normal();
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

  t.izquierda().cortar(cfg.avanceCorte);
  return t.bytes();
}

/**
 * LA COTIZACIÓN  (v2.8)
 *
 * "¿A cómo me saldrían veinte marquetas?" — a veces solo piden el papel
 * con el precio, para llevarlo o compararlo. Es un ticket que NO es venta:
 * no hay folio (no se vendió nada), no se abre el cajón, no se toca la
 * existencia y no entra al corte. Lo único que promete es el precio de HOY,
 * y por eso lleva impreso que puede cambiar sin previo aviso.
 */
function ticketCotizacion(cot, { negocio = '' } = {}) {
  const cfg = configuracion();
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina);

  t.centro().negrita().tamano(2, 2).linea('COTIZACION').normal().izquierda();

  encabezado(t, {
    titulo: '',
    atendio: cot.atendio,
    fecha: fechaTicket(cot.fecha)
  });
  if (cot.cliente) t.parrafo(`Para: ${cot.cliente}`);
  t.separador();

  const lineasHielo = cot.lineas.filter((l) => l.dieciseisavos > 0);
  const otras = cot.lineas.filter((l) => !l.dieciseisavos);
  const hielo = lineasHielo.reduce((n, l) => n + l.dieciseisavos, 0);
  const importeHielo = lineasHielo.reduce((n, l) => n + l.centavos, 0);

  if (hielo) {
    t.izquierda().negrita().tamano(3, 2).linea(aTexto(hielo)).normal();
    const partes = desglose(hielo);
    t.punteado(partes !== aTexto(hielo) ? `(${partes})` : 'Hielo', formato(importeHielo));
  }
  for (const l of otras) {
    const cuantas = Number(l.cantidad) > 1 ? `${l.cantidad} ` : '';
    t.punteado(`${cuantas}${l.concepto}`, formato(l.centavos));
  }

  t.separador();
  t.bloqueDerecha([['TOTAL:', formato(cot.total)]]);
  t.saltos(1);

  // La letra chica que aquí es la letra grande: esto no es una venta.
  t.centro().negrita().linea('PRECIOS SUJETOS A CAMBIO').linea('SIN PREVIO AVISO').normal();
  t.centro().linea(`Precios del ${soloDia(cot.fecha)}`);
  t.izquierda();

  pie(t, negocio);
  t.izquierda().cortar(cfg.avanceCorte);
  return t.bytes();
}

/** "1/Sep/2026", para decir de qué día son los precios. */
function soloDia(iso) {
  const d = new Date(iso);
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${d.getDate()}/${meses[d.getMonth()]}/${d.getFullYear()}`;
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
function ticketMovimiento(mov, { copia = false, negocio = '' } = {}) {
  const cfg = configuracion();
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina);
  const salida = mov.tipo === 'salida';

  // Igual que en la venta: una reimpresión se marca. Un comprobante de
  // gasto sin marcar puede pasar dos veces por la misma carpeta y contarse
  // dos veces al cuadrar el mes.
  if (copia) marcaCopia(t);

  encabezado(t, {
    titulo: salida ? 'Gasto' : 'Entrada',
    atendio: mov.cajero_nombre || mov.ejecutor_nombre,
    fecha: fechaTicket(mov.fecha)
  });
  t.separador();

  t.izquierda().negrita().tamano(2, 1).linea(formato(mov.centavos)).normal();
  t.parrafo(String(mov.concepto || '').toUpperCase());
  if (mov.notas) t.parrafo(mov.notas);

  if (mov.anulado_en) {
    t.centro().negrita().tamano(2, 1).linea('ANULADO').normal().izquierda();
  }

  t.separador();

  // El gasto se firma; meter dinero al cajón no. Nadie firma por dejar.
  if (salida) t.firma();

  pie(t, negocio);
  t.izquierda().cortar(cfg.avanceCorte);
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

    // LO QUE QUEDÓ A MEDIAS VA CON DETALLE, no con un número suelto.
    // Este papel se le entrega al turno que llega: "a medias: 3" obliga a
    // ir a contar canastas al tanque. Diciendo cuántas faltan y quién
    // empezó, el que llega sabe qué hacer sin preguntarle a nadie.
    for (const m of grupo.aMedias || []) {
      t.linea(`  PANO ${m.pano} A MEDIAS: faltan ${m.faltan} de ${m.total} canastas`);
      if (m.empezadoPor) t.linea(`    lo empezo ${m.empezadoPor} - terminarlo primero`);
      else t.linea('    terminarlo primero');
    }
    if (!grupo.aMedias?.length && grupo.enProceso?.length) {
      t.linea(`  a medias: ${grupo.enProceso.join(', ')} - terminar primero`);
    }
    // Sin renglón en blanco entre tanques: el nombre del tanque va en
    // negritas y mayúsculas, y eso ya separa. Un renglón por tanque, en un
    // papel que sale todos los días, son metros al año.
  }

  t.separador();
  t.linea('Saco de verdad:');
  t.firma('FIRMA DEL OBRERO');

  pie(t, negocio);
  t.izquierda().cortar(cfg.avanceCorte);
  return t.bytes();
}

/**
 * EL RESUMEN DEL DÍA, que sale pegado al corte.
 *
 * "Cuando hago el corte de turno me tiene que salir impreso: el ticket del
 *  corte, cuánto hielo queda, y qué paños se sacaron en el día."
 *
 * Son los tres números que hay que mirar juntos: si el cajón cuadra pero
 * falta hielo, el problema no está en la caja. Y al revés. En papeles
 * separados nadie los junta.
 */
function ticketResumenDia(datos, { negocio = '' } = {}) {
  const cfg = configuracion();
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina);

  encabezado(t, {
    titulo: 'El dia',
    atendio: datos.quien,
    fecha: fechaTicket(datos.fecha)
  });
  t.separador();

  // ---- EL HIELO QUE QUEDA ----
  t.negrita().linea('HIELO EN EL CUARTO FRIO').negrita(false);
  for (const a of datos.almacenes || []) {
    t.columnas2(a.nombre, aTexto(a.esperado));
    if (a.ultimoConteo) {
      t.linea(`  contado ${fechaCorta(a.ultimoConteo)}: ${aTexto(a.contado)}`);
    } else {
      t.linea('  nunca se ha contado');
    }
  }
  if (!datos.almacenes?.length) t.linea('  sin cuartos frios dados de alta');

  // ---- LOS PAÑOS DEL DÍA ----
  t.separador();
  const p = datos.produccion || { panos: [], cuantos: 0, alAlmacen: 0, rotas: 0 };
  t.negrita().linea('PANOS SACADOS HOY').negrita(false);

  if (!p.cuantos) {
    t.linea('  ninguno');
  } else {
    for (const uno of p.panos) {
      // Un renglón por paño: tanque, número, y lo que dio. Apretado a
      // propósito, que de estos salen varios al día.
      const roto = uno.rotas ? ` -${uno.rotas}` : '';
      t.columnas2(`${uno.tanque} #${uno.pano}${uno.enProceso ? ' (a medias)' : ''}`,
                  `${uno.alAlmacen}${roto}`);
    }
    t.separador('.');
    t.bloqueDerecha([
      ['Panos', String(p.cuantos)],
      ['Al cuarto frio', String(p.alAlmacen)],
      p.rotas ? ['Rotas', String(p.rotas)] : null
    ]);

    // ---- CÓMO SALIÓ EL HIELO ----
    //
    // Va en el corte y no solo en la pantalla porque este papel es el que
    // se guarda y el que se compara de una semana a otra. Dos días con las
    // mismas marquetas pueden ser un buen día y uno malo; lo que los
    // separa es este reparto. Solo se imprimen los estados que salieron:
    // renglones con cero gastan papel y no dicen nada.
    const salieron = CALIDADES.filter((c) => p[c.clave] > 0);
    if (salieron.length) {
      t.separador('.');
      t.negrita().linea('COMO SALIO').negrita(false);
      for (const c of salieron) t.columnas2(`  ${c.corto}`, String(p[c.clave]));
      const fuera = p.fueraDelAlmacen || 0;
      if (fuera > 0) t.linea(`  (${fuera} no entraron al cuarto frío)`);
    }
  }

  pie(t, negocio);
  t.izquierda().cortar(cfg.avanceCorte);
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
  t.izquierda().cortar(cfg.avanceCorte);
  return t.bytes();
}

/**
 * EL CORTE DEL TURNO.
 *
 * Sale al cerrar y se firma. Va apretado a propósito: se imprimen varios al
 * día y cada renglón de más son metros de papel al mes.
 */
function ticketCorte(corte, { negocio = '' } = {}) {
  const cfg = configuracion();
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina);
  const c = corte.caja;
  const dif = c.diferencia_centavos;

  encabezado(t, {
    titulo: `Corte #${c.folio}`,
    atendio: c.cajero_nombre,
    fecha: fechaTicket(c.cerrada_en)
  });
  t.separador();

  // "Cerrado" salía dos veces: la hora de cierre ya va en el encabezado,
  // que es la fecha de este papel. Y "Abierto" y "Tickets" caben juntos.
  const cancelados = corte.ventas.canceladas;
  t.columnas2(`Abrio ${cuandoCorto(c.abierta_en, c.cerrada_en)}`,
              `${corte.ventas.cobradas} tickets`
              + (cancelados ? ` (${cancelados} cancelado${cancelados === 1 ? '' : 's'})` : ''));

  // EL PRIMER PAPEL ES EL DEL DINERO, y nada más  (v4.1)
  //
  // Los gastos van SOLO como total: el desglose se imprime aparte, en el
  // segundo papel. Este es el que se firma y el que se entrega con el
  // cajón, y con quince renglones de gastos en medio deja de leerse de un
  // vistazo justo cuando hay que leerlo rápido.
  const cuantosGastos = corte.movimientos.filter(
    (m) => m.tipo === 'salida' && !m.anulado_en).length;

  t.bloqueDerecha([
    ['Fondo', formato(c.fondo_centavos)],
    ['Cobrado', '+' + formato(c.vendido_centavos)],
    c.entradas_centavos ? ['Entradas', '+' + formato(c.entradas_centavos)] : null,
    [`Gastos y retiros${cuantosGastos ? ` (${cuantosGastos})` : ''}`,
     '-' + formato(c.salidas_centavos)],
    ['DEBERIA HABER', formato(c.esperado_centavos)],
    // Desde la v4.1 el turno se cierra SIN contar: el cajero entrega el
    // cajón y sigue vendiendo. Lo que se contó se anota después, cuando el
    // dueño o el gerente reciben el dinero. Si todavía no se ha recibido,
    // este papel no puede decir cuánto había — solo cuánto debía haber.
    c.entregado_centavos != null ? ['ENTREGADO', formato(c.entregado_centavos)]
      : c.contado_centavos != null ? ['CONTADO', formato(c.contado_centavos)]
      : null
  ]);

  t.centro().negrita().tamano(2, 1);
  if (dif === null || dif === undefined) {
    // Ni "cuadró" ni "falta": todavía no se ha contado, y decir cualquiera
    // de las dos cosas sería inventarse el dato que este papel viene a
    // pedir. La raya de abajo es donde se escribe a mano lo que se entrega.
    t.linea('SIN CONTAR').tamano(1, 1).normal();
    t.linea('Se anota al recibir el dinero').izquierda();
    t.firma('Entregado $');
  } else {
    t.linea(dif === 0 ? 'CUADRO' : dif > 0 ? `SOBRA ${formato(dif)}` : `FALTA ${formato(-dif)}`)
     .normal().izquierda();
  }

  // QUIÉN METIÓ QUÉ. Solo cuando de verdad hubo relevo: con una sola
  // persona esto repetiría el bloque de arriba con otro nombre.
  if (corte.porPersona?.length > 1) {
    t.negrita().separadorConTitulo('CADA QUIEN').negrita(false);
    for (const p of corte.porPersona) {
      t.columnas2(p.nombre, formato(p.efectivo));
      const extras = [
        `${p.cobradas} ticket${p.cobradas === 1 ? '' : 's'}`,
        p.fiado ? `fiado ${formato(p.fiado)}` : null,
        p.salidas ? `gastos ${formato(p.salidas)}` : null
      ].filter(Boolean);
      t.linea(`  ${extras.join(' - ')}`);
    }
  }

  // Quién cerró y la raya para firmar, en el mismo renglón: es su firma la
  // que va ahí, así que el nombre delante de la raya dice las dos cosas.
  t.separador();
  t.firma(`Cerro ${(c.cerrada_por_nombre || '-').slice(0, 24)}`);
  pie(t, negocio);
  t.izquierda().cortar(cfg.avanceCorte);
  return t.bytes();
}

/**
 * EL SEGUNDO PAPEL DEL CORTE: EL DESGLOSE  (v4.1)
 *
 * "Que se imprima como si fueran dos notas: una como la que existe pero
 * solo con el total de los gastos, corta el papel, y otra con los gastos,
 * entradas y movimientos importantes ya desglosaditos."
 *
 * Y tiene sentido más allá del gusto: el primero se firma y se entrega con
 * el cajón; este se queda en la carpeta, o se le da a quien tenga que
 * revisar en qué se fue el dinero. Son dos papeles porque son de dos
 * personas distintas.
 *
 * Devuelve null cuando no hay nada que desglosar: media hoja en blanco que
 * dice "GASTOS" y nada debajo es papel tirado todos los días.
 */
function ticketCorteMovimientos(corte, { negocio = '' } = {}) {
  const vivos = corte.movimientos.filter((m) => !m.anulado_en);
  const anulados = corte.movimientos.filter((m) => m.anulado_en);
  if (!corte.movimientos.length) return null;

  const cfg = configuracion();
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina);
  const c = corte.caja;

  encabezado(t, {
    titulo: `Detalle #${c.folio}`,
    atendio: c.cajero_nombre,
    fecha: fechaTicket(c.cerrada_en)
  });
  t.separador();

  const gastos = vivos.filter((m) => m.tipo === 'salida');
  const entradas = vivos.filter((m) => m.tipo !== 'salida');
  if (gastos.length) columnaDeMovimientos(t, 'GASTOS', gastos, '-');
  if (entradas.length) columnaDeMovimientos(t, 'ENTRADAS', entradas, '+');

  // Lo anulado va al final y aparte. No suma, pero que un gasto se haya
  // anulado a media tarde es justo lo que se viene a mirar aquí.
  if (anulados.length) {
    t.negrita().separadorConTitulo('ANULADOS').negrita(false);
    for (const m of anulados) {
      t.columnas2(m.concepto.slice(0, 26), formato(m.centavos));
      if (m.motivo_anulacion) t.linea(`  ${m.motivo_anulacion.slice(0, 40)}`);
    }
  }

  t.separador();
  t.columnas2('Del turno de', c.cajero_nombre || '-');
  pie(t, negocio);
  t.izquierda().cortar(cfg.avanceCorte);
  return t.bytes();
}

/**
 * EL CORTE DE UNA SOLA PERSONA, cuando el turno se relevó.
 *
 * No es un arqueo: el dinero del cajón es uno solo y ya lo cuadra el corte
 * del turno. Esto es la constancia de cuánto metió cada quien, para que el
 * que llegó a las siete de la mañana no aparezca por ningún lado en un
 * papel que dice el nombre del que se fue a las diez de la noche.
 */
function ticketCortePersona(corte, persona, { negocio = '' } = {}) {
  const cfg = configuracion();
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina);
  const c = corte.caja;

  // "Su parte del turno" cabe en el título: es lo que ES este papel.
  encabezado(t, {
    titulo: `Su parte del #${c.folio}`,
    atendio: persona.nombre,
    fecha: fechaTicket(c.cerrada_en)
  });
  t.separador();

  // De cuándo a cuándo y cuántos tickets, en un renglón. Eran tres.
  const desde = persona.primera ? soloHora(persona.primera) : '';
  const hasta = persona.ultima ? soloHora(persona.ultima) : '';
  t.columnas2(desde && hasta ? `De ${desde} a ${hasta}` : 'Su parte del turno',
              `${persona.cobradas} tickets`
              + (persona.canceladas
                 ? ` (${persona.canceladas} cancelado${persona.canceladas === 1 ? '' : 's'})` : ''));

  t.bloqueDerecha([
    ['Cobrado en efectivo', formato(persona.efectivo)],
    persona.fiado ? ['Fiado', formato(persona.fiado)] : null,
    persona.transferencia ? ['Transferencia', formato(persona.transferencia)] : null,
    persona.entradas ? ['Metio al cajon', '+' + formato(persona.entradas)] : null,
    persona.salidas ? ['Saco del cajon', '-' + formato(persona.salidas)] : null,
    ['PUSO EN EL CAJON', formato(persona.aportado)]
  ]);

  // La aclaración baja al letrero de la firma, que se imprime de todas
  // formas: el que firma lo lee justo cuando le importa.
  t.separador();
  t.firma('Firma - el arqueo va en el corte');
  pie(t, negocio);
  t.izquierda().cortar(cfg.avanceCorte);
  return t.bytes();
}


/** Un bloque de movimientos con su suma, para el corte. */
function columnaDeMovimientos(t, titulo, lista, signo) {
  // El título va DENTRO de la raya en vez de en su propio renglón: la raya
  // ya estaba y el título ya estaba, y juntos hacen el mismo trabajo.
  t.negrita().separadorConTitulo(`${titulo} (${lista.length})`).negrita(false);
  for (const m of lista) {
    t.columnas2(m.anulado_en ? `(anulado) ${m.concepto}` : m.concepto,
                m.anulado_en ? '-' : signo + formato(m.centavos));
  }
  // Sin renglón de "Suman": es exactamente el mismo número que
  // "Gastos y retiros" (o "Entradas") del arqueo de arriba, que es el que
  // manda. Dos veces el mismo total es un renglón regalado.
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

  // Se arma como todos los demás papeles: qué es arriba a la izquierda,
  // quién y cuándo arriba a la derecha, el negocio abajo. Este era el único
  // que se había quedado con la cabecera vieja, centrada y de cinco
  // renglones. Ahora son tres, y además se reconoce como los otros.
  encabezado(t, {
    titulo: 'Conteo',
    atendio: conteo.ejecutor,
    fecha: fechaTicket(conteo.fecha)
  });
  t.negrita().linea((conteo.almacen || '').toUpperCase()).negrita(false);
  t.separador();

  if (r.primerConteo) {
    t.separador();
    t.centro().negrita().tamano(2, 1).linea(aTexto(r.contado)).normal().izquierda();
    t.centro().linea('primer conteo').izquierda();
  } else {
    t.columnas2('Habia', aTexto(r.anterior));
    t.columnas2('+ Se produjo', aTexto(r.producido));
    t.columnas2('- Se vendio', aTexto(r.vendido));
    if (r.merma) t.columnas2('- Merma', aTexto(r.merma));
    // El hielo que se cortó para gourmet sale del cuarto frío sin pasar por
    // la caja. Sin este renglón, el papel salta de "vendido" a "deberia
    // quedar" con un hueco que nadie sabe explicar.
    if (r.cortado) t.columnas2('- Se corto (gourmet)', aTexto(r.cortado));
    t.separador();
    t.negrita().columnas2('Deberia quedar', aTexto(r.esperado));
    t.columnas2('Contado', aTexto(r.contado)).negrita(false);
    t.centro().negrita().tamano(2, 1)
     .linea(r.faltante === 0 ? 'CUADRO'
            : r.faltante < 0 ? `SOBRA ${aTexto(-r.faltante)}` : `FALTA ${aTexto(r.faltante)}`)
     .normal().izquierda();
  }

  t.firma('Firma');
  pie(t, negocio);
  t.izquierda().cortar(cfg.avanceCorte);
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
  ticketVenta, ticketMovimiento, ticketCotizacion, ticketPrueba,
  ticketCorte, ticketCorteMovimientos, ticketCortePersona, ticketConteo, ticketProduccion, ticketResumenDia, pulsoCajon, fechaCorta, fechaTicket
};
