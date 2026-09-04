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
 * A la izquierda qué es esto, a la derecha quién lo hizo, y debajo la
 * fecha — los tres en el mismo renglón de siempre, como en el papel que
 * mandaste.  (Rediseñado en la v5.0.)
 *
 * DOS COSAS QUE UNA TÉRMICA NO PUEDE HACER, y conviene saberlas antes de
 * mirar el papel esperando otra cosa:
 *
 *   · NO CAMBIA DE ESTILO A MEDIA LÍNEA. En el diseño, "Hielo a sacar" va
 *     en negritas y "Tony Castilla" no. En un renglón impreso los dos son
 *     lo mismo: o los dos en negritas o ninguno. Va el renglón entero en
 *     negritas, que es lo que hace que se lea como encabezado.
 *   · NO SABE DE CURSIVAS. Casi ninguna térmica las tiene. Donde el diseño
 *     lleva cursiva, aquí va subrayado, que sí existe y hace el mismo
 *     trabajo: decir "esto es el resultado".
 */
function encabezado(t, {
  titulo, atendio, fecha, subtitulo = '',
  tituloGrande = false, fechaAlinear = 'derecha', raya = true
}) {
  const quien = String(atendio || '').trim();
  const que = String(titulo || '').trim();
  const sub = String(subtitulo || '').trim();

  // EL TÍTULO EN GRANDE Y AL CENTRO, para los papeles que son de una sola
  // cosa —un gasto, un vale—: ahí el título ES el papel.
  if (tituloGrande && que) {
    t.centro().negrita().tamano(2, 1).linea(que).normal().izquierda();
  }

  // EL RENGLÓN DE ARRIBA: qué es esto a la izquierda, quién lo hizo a la
  // derecha. Un solo renglón para los dos datos que se miran primero.
  const izquierdaArriba = tituloGrande ? quien : que;
  const derechaArriba = tituloGrande ? '' : quien;

  if (izquierdaArriba || derechaArriba) {
    if (!tituloGrande) t.negrita();
    t.izquierda();
    if (izquierdaArriba && derechaArriba) {
      if (izquierdaArriba.length + derechaArriba.length + 2 <= t.ancho) {
        t.columnas2(izquierdaArriba, derechaArriba);
      } else {
        // No caben juntos. Antes de recortarle el nombre a nadie se gasta
        // un renglón: el nombre de quien firma un papel va entero.
        t.linea(izquierdaArriba.slice(0, t.ancho));
        t.derecha().linea(derechaArriba.slice(0, t.ancho)).izquierda();
      }
    } else if (tituloGrande && quien && fecha) {
      // En el papel de una sola cosa, el nombre y la fecha comparten
      // renglón: uno a cada orilla.
      t.columnas2(quien, fecha);
    } else {
      t.linea((izquierdaArriba || derechaArriba).slice(0, t.ancho));
    }
    t.negrita(false);
  }

  // EL SEGUNDO RENGLÓN. Lleva la fecha, y a su izquierda lo que el papel
  // quiera poner ahí —el cliente de una venta— para no gastar otro.
  const faltaFecha = fecha && !(tituloGrande && quien);
  if (sub && fecha && sub.length + String(fecha).length + 2 <= t.ancho && faltaFecha) {
    t.izquierda().columnas2(sub, fecha);
  } else {
    if (sub) t.izquierda().parrafo(sub);
    if (faltaFecha) t[fechaAlinear === 'centro' ? 'centro' : 'derecha']().linea(fecha).izquierda();
  }

  t.izquierda();
  return raya ? t.separador() : t;
}

/**
 * EL RENGLÓN GRANDE: lo que este papel viene a decir.
 *
 *     $6250        (un gasto)
 *     2 · 3/8      (el hielo de una venta)
 *
 * Va al doble de ancho porque en una térmica el ancho es gratis y el alto
 * es lo que gasta papel: tamano(2,1) se ve igual de grande de lejos que
 * tamano(2,2) y cuesta la mitad de renglón.
 */
function renglonGrande(t, texto, { alinear = 'centro', ancho = 2 } = {}) {
  t[alinear === 'centro' ? 'centro' : 'izquierda']();
  t.negrita().tamano(ancho, 1).linea(String(texto)).normal();
  return t.izquierda();
}

/**
 * EL RESULTADO DE UNA CUENTA, subrayado y en grande.
 *
 *                        FALTA $55
 *
 * En el diseño va en negritas, cursiva y subrayado. La cursiva no existe
 * en una térmica; las otras dos sí, y son las que hacen el trabajo.
 */
function renglonResultado(t, texto) {
  t.centro().negrita().subrayado().tamano(2, 1);
  t.linea(String(texto));
  return t.normal().izquierda();
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
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina, cfg.tamanoLetra);

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

  // El cliente comparte renglón con la fecha, como en el diseño; si el
  // nombre es largo —"Abarrotes y Cremeria La Guadalupana del Centro"— el
  // encabezado se lo lleva a su propio renglón y lo parte POR PALABRAS.
  encabezado(t, {
    titulo: `#${numeroDeTicket(venta)}`,
    atendio: venta.cajero_nombre,
    subtitulo: venta.cliente_nombre ? `Cliente: ${venta.cliente_nombre}` : '',
    fecha: fechaTicket(venta.fecha)
  });

  // EL HIELO, EN GRANDE Y CON SU PRECIO EN EL MISMO RENGLÓN  (v5.0):
  //
  //     2 . 3/8  ...........................  $627
  //
  // Como en el diseño. Antes eran dos renglones —el hielo en grande y
  // debajo, en chico, su importe— y es el renglón que el cliente
  // comprueba: cuánto se llevó y cuánto costó, juntos.
  //
  // Al doble de ancho caben la mitad de columnas, así que el renglón se
  // arma con la cuenta hecha a mano sobre esa mitad.
  if (hielo) {
    // "2 · 1/2" y no "2 1/2": el punto separa la marqueta entera del
    // pedazo, que sin él se leían como un solo número raro.
    const cuanto = aTexto(hielo).replace(' ', ' \u00b7 ');
    const precio = formato(importeHielo);
    const mitad = Math.floor(t.ancho / 2);

    // EL PRECIO POR MARQUETA, EN EL MISMO RENGLÓN  (v5.2.2)
    //
    //     2 · 1/2   x  $240 ............... $600
    //
    // Es lo que explica por qué la marqueta salió a $240 y no a $264, y
    // va donde se busca: pegado a lo que se llevó. Antes iba en un
    // renglón suelto debajo del total —"Precio de mayoreo"— y ahí no lo
    // leía nadie.
    //
    // Solo sale cuando la división es EXACTA. En mayoreo el precio es por
    // marqueta y siempre lo es; en el mostrador un medio no cuesta la
    // mitad —cada fracción tiene su precio propio— y ahí un "por
    // marqueta" sería un número inventado.
    const marquetas = hielo / 16;
    const unitario = importeHielo / marquetas;
    const conUnitario = venta.lista_tipo === 'mayoreo'
      && Number.isInteger(unitario) && unitario > 0;
    const porUno = conUnitario ? `x ${formato(unitario)}` : '';

    const izquierda = porUno ? `${cuanto}   ${porUno}` : cuanto;

    if (izquierda.length + precio.length + 4 <= mitad) {
      const puntos = Math.max(mitad - izquierda.length - precio.length - 2, 1);
      t.izquierda().negrita().tamano(2, 1)
       .linea(`${izquierda} ${'.'.repeat(puntos)} ${precio}`).normal();
    } else if (cuanto.length + precio.length + 4 <= mitad) {
      // No cabe con el precio por marqueta, pero sí sin él: manda lo que
      // se llevó, que es lo que el cliente comprueba.
      const puntos = Math.max(mitad - cuanto.length - precio.length - 2, 1);
      t.izquierda().negrita().tamano(2, 1)
       .linea(`${cuanto} ${'.'.repeat(puntos)} ${precio}`).normal();
      if (porUno) t.linea(`  ${porUno} cada marqueta`);
    } else {
      // Con "3 marquetas y 7/8" y un importe de cinco cifras no caben
      // juntos en grande: el hielo se queda en grande —que es lo que se
      // comprueba— y el importe baja a su renglón.
      t.izquierda().negrita().tamano(2, 1).linea(cuanto).normal();
      t.punteado('Hielo', precio);
    }
  }

  if (otras.length) {
    t.separador();
    for (const l of otras) {
      const cuantas = Number(l.cantidad) > 1 ? `${l.cantidad}   ` : '';
      t.punteado(`${cuantas}${l.concepto}`, formato(l.precio_centavos));
    }
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
    // TOTAL, PAGO Y CAMBIO EN UN SOLO RENGLÓN, repartidos a lo ancho:
    //
    //     TOTAL: $912      PAGO: $1000      CAMBIO: $88
    //
    // Y solo con lo que dice algo. Cuando el cliente paga justo —que es la
    // mitad de los tickets del mostrador— pago y cambio serían el total
    // otra vez y un cero: ahí va el total solo, a la derecha.
    const pago = venta.pago_centavos;
    const hubo = pago != null && pago !== venta.total_centavos;
    const total = `TOTAL: ${formato(venta.total_centavos)}`;

    if (hubo) {
      const tres = [total, `PAGO: ${formato(pago)}`,
                    `CAMBIO: ${formato(venta.cambio_centavos || 0)}`];
      if (tres.join('   ').length <= t.ancho) t.negrita().columnas3(...tres).negrita(false);
      else {
        t.negrita().linea(total).negrita(false);
        t.columnas2(tres[1], tres[2]);
      }
    } else {
      t.derecha().negrita().linea(total).negrita(false).izquierda();
    }
  }

  // A CRÉDITO. Va en grande y con el nombre porque este papel es el vale:
  // el cliente se lleva su copia y con eso los dos saben lo mismo. Y lleva
  // la línea para firmar, que es lo que hace que sirva de algo al reclamar.
  if (venta.forma_pago === 'credito') {
    t.separador();
    t.centro().negrita().tamano(2, 1).linea('A CREDITO').normal();
    if (venta.cliente_negocio) t.centro().linea(venta.cliente_negocio);
    t.izquierda();

    // SI DEJÓ UNA PARTE, EL PAPEL LO DICE  (v5.3).
    //
    // Es la mitad del sentido de este ticket: el cliente se lo lleva y con
    // eso los dos saben lo mismo. Si entregó $300 de $480 y el papel solo
    // dijera "A CRÉDITO $480", el día que reclame no habría nada que
    // enseñarle — y quien tendría que acordarse sería el cajero.
    if (venta.abonoCentavos > 0) {
      const queda = venta.total_centavos - venta.abonoCentavos;
      t.bloqueDerecha([
        ['PAGO AHORA:', formato(venta.abonoCentavos)],
        ['QUEDA A DEBER:', formato(queda)]
      ]);
    }

    t.firma('FIRMA DE RECIBIDO');
  } else if (venta.forma_pago === 'transferencia') {
    t.centro().linea('Pagado por transferencia').izquierda();
  }

  // EL NOMBRE DEL NEGOCIO NO VA EN EL TICKET DE VENTA  (v5.2.2).
  //
  // El papel sale de la fábrica; nadie necesita que le recuerden de dónde
  // salió el hielo que acaba de comprar. Los demás papeles —el corte, el
  // vale, la cotización, el comodato— sí lo llevan: ésos viajan solos y
  // hay que saber de quién son.
  //
  // Si hay un renglón de pie configurado ("Gracias por su compra"), ése sí
  // se imprime: es un texto que alguien puso a propósito.
  pie(t, '');

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
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina, cfg.tamanoLetra);

  t.centro().negrita().tamano(2, 2).linea('COTIZACION').normal().izquierda();

  encabezado(t, {
    titulo: 'Cotizacion',
    atendio: cot.atendio,
    subtitulo: cot.cliente ? `Para: ${cot.cliente}` : '',
    fecha: fechaTicket(cot.fecha)
  });

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
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina, cfg.tamanoLetra);
  const salida = mov.tipo === 'salida';

  // Igual que en la venta: una reimpresión se marca. Un comprobante de
  // gasto sin marcar puede pasar dos veces por la misma carpeta y contarse
  // dos veces al cuadrar el mes.
  if (copia) marcaCopia(t);

  // LA FORMA DEL PAPEL DE UN GASTO  (v5.0), tal como la mandaste:
  //
  //                     Gasto
  //     Tony Castilla        26/Ago/2026 5:45pm
  //     - - - - - - - - - - - - - - - - - - - -
  //                    $6250
  //     GASOLINA PARA LIMPIAR PIEZAS DE LA MAQUINA
  //     NUEVA EN REPARACION
  //
  //                   ________
  //                     FIRMA
  encabezado(t, {
    titulo: salida ? 'Gasto' : 'Entrada',
    tituloGrande: true,
    atendio: mov.cajero_nombre || mov.ejecutor_nombre,
    fecha: fechaTicket(mov.fecha)
  });

  renglonGrande(t, formato(mov.centavos));

  // El concepto va justificado, de orilla a orilla, como en el diseño.
  t.parrafo(String(mov.concepto || '').toUpperCase(), { justificado: true });
  if (mov.notas) t.parrafo(mov.notas, { justificado: true });

  if (mov.anulado_en) {
    t.centro().negrita().tamano(2, 1).linea('ANULADO').normal().izquierda();
  }

  // El gasto se firma; meter dinero al cajón no. Nadie firma por dejar.
  if (salida) t.firma();

  pie(t, negocio);
  t.izquierda().cortar(cfg.avanceCorte);
  return t.bytes();
}

/**
 * EL PAPEL DE UN VALE  (v4.3)
 *
 * "Él deja su papelito que se llama vale y la cantidad que se llevó, y
 *  cuando se hacen las cuentas se cuadra."
 *
 * El papelito ya existía; lo escribían a mano. Este es el mismo, pero
 * escrito por la máquina: con la fecha, el turno, el nombre de quien se
 * llevó el dinero y el de quien se lo entregó.
 *
 * SALE POR DUPLICADO, y no es un lujo: uno se lo lleva quien se llevó el
 * dinero y el otro se queda en el cajón. Con un solo papel, el día que
 * alguien pregunte "¿y esos dos mil?" solo hay una versión, y es la del que
 * la tiene en la mano. Los dos son iguales salvo el renglón que dice de
 * quién es cada uno, y los dos llevan raya para firmar.
 *
 * `esRaya` cambia UNA sola cosa, pero es la que importa: si el vale es un
 * adelanto de sueldo, el papel lo dice, porque el día de la raya se le
 * tiene que pagar de menos y quien lo recibe tiene derecho a leerlo.
 */
function ticketVale(vale, { negocio = '', copia = false, duplicado = false } = {}) {
  const cfg = configuracion();
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina, cfg.tamanoLetra);
  const esRaya = Boolean(vale.esRaya);

  const unaCopia = (paraQuien) => {
    if (copia) marcaCopia(t);

    // ES EL MISMO PAPEL QUE EL DEL GASTO  (v5.0). "El de gastos igual es el
    // de vales, solo se cambia su texto: en vez de Gastos dice Vale de
    // (nombre del trabajador)."
    //
    // Y con eso el nombre sube al título, que es donde tiene que estar: es
    // el único dato que separa un vale de un faltante, y antes iba a media
    // altura del papel.
    encabezado(t, {
      titulo: `Vale de ${String(vale.ejecutor_nombre || '?').split(' ')[0]}`,
      tituloGrande: true,
      atendio: vale.capturista_nombre,
      fecha: fechaTicket(vale.fecha)
    });

    renglonGrande(t, formato(vale.centavos));

    // El nombre COMPLETO, debajo del importe: en el título cabe el de pila
    // y aquí va entero, que es el que vale para reclamar.
    t.centro().negrita().linea(String(vale.ejecutor_nombre || '?').slice(0, t.ancho))
     .negrita(false).izquierda();

    t.parrafo(String(vale.concepto || 'VALE').toUpperCase(), { justificado: true });
    if (vale.notas) t.parrafo(vale.notas, { justificado: true });

    if (esRaya) {
      t.parrafo('A cuenta de su sueldo de la semana. El dia de la raya se le paga esto de menos.',
                { justificado: true });
    }

    if (vale.folio) t.linea(`Turno #${vale.folio}`);

    if (vale.anulado_en) {
      t.centro().negrita().tamano(2, 1).linea('ANULADO').normal().izquierda();
    }

    t.firma('FIRMA DE QUIEN LO RECIBE');
    if (paraQuien) t.izquierda().linea(paraQuien);
    pie(t, negocio);
    t.izquierda().cortar(cfg.avanceCorte);
  };

  // POR DUPLICADO SOLO SI SE PIDE  (v4.7). "No quiero nada en duplicado, o
  // en su caso que yo lo decida en configuraciones." La idea de los dos
  // papeles era buena y la decisión no era mía: sale UNO, y quien quiera
  // los dos lo enciende en la configuración de la impresora.
  if (duplicado) {
    unaCopia('-- Se lo lleva quien recibio el dinero --');
    unaCopia('-- Se queda en el cajon --');
  } else {
    unaCopia('');
  }
  return t.bytes();
}

/**
 * EL PAPELITO DE LO ENCOMENDADO  (v4.5)
 *
 * "Normalmente le hago un papelito que dice el nombre del cliente, la
 *  fecha y la hora, y le pongo encomendado."
 *
 * Eso, tal cual, pero escrito por la máquina. Lo importante va grande —
 * CUÁNTO y DE QUIÉN— porque es lo que hay que leer al buscarlo entre los
 * papelitos de una semana, y lleva la palabra que use esta fábrica.
 *
 * NO ES UN TICKET DE VENTA y lo dice: el hielo ya se pagó, y un papel que
 * pareciera un ticket podría acabar cobrándose dos veces.
 */
function ticketEncomienda(e, { negocio = '', nombre = 'Encomendado', copia = false } = {}) {
  const cfg = configuracion();
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina, cfg.tamanoLetra);

  if (copia) marcaCopia(t);

  encabezado(t, {
    titulo: String(nombre).toUpperCase().slice(0, 20),
    atendio: e.capturista_nombre,
    fecha: fechaTicket(e.fecha)
  });

  // CUÁNTO, en grande. Es lo que se comprueba de un vistazo cuando el
  // cliente vuelve con el papel en la mano.
  t.izquierda().negrita().tamano(3, 2).linea(aTexto(e.dieciseisavos)).normal();
  const partes = desglose(e.dieciseisavos);
  if (partes !== aTexto(e.dieciseisavos)) t.linea(`(${partes})`);

  t.saltos(1).linea('De:');
  t.negrita().tamano(2, 1).parrafo(String(e.cliente_nombre || '?').slice(0, 40));
  t.normal();
  if (e.cliente_negocio) t.parrafo(e.cliente_negocio);
  if (e.notas) t.parrafo(e.notas);

  t.separador();
  // Que quede escrito que no hay nada que cobrar: el papel se parece a un
  // ticket y sin esta línea alguien podría cobrarlo otra vez.
  t.centro().linea('YA ESTA PAGADO').linea('Se guarda en el cuarto frio').izquierda();

  if (e.entregado_en) {
    t.separador();
    t.centro().negrita().tamano(2, 1).linea('ENTREGADO').normal();
    t.linea(fechaTicket(e.entregado_en)).izquierda();
  } else {
    t.firma('ENTREGADO A');
  }

  pie(t, negocio);
  t.izquierda().cortar(cfg.avanceCorte);
  return t.bytes();
}

/**
 * EL PAPEL DE LA RAYA  (v4.8)
 *
 * "Imprimir su balance para darle su sueldo."
 *
 * Es el papel que se le entrega con el dinero y que firma. Lleva la cuenta
 * entera y en el orden en que se explica de viva voz —lo que ganó, lo que
 * se llevó adelantado, lo que queda— porque quien lo recibe la va a hacer
 * de cabeza mientras lo lee, y si los números no salen en ese orden no le
 * va a cuadrar aunque el total esté bien.
 *
 * Y dice DE DÓNDE salió el dinero. En una fábrica donde a veces se paga del
 * cajón y a veces del dinero ya retirado, ese renglón es el que evita que
 * el mismo pago se busque dos veces.
 */
function ticketRaya(raya, { negocio = '', copia = false, previa = false } = {}) {
  const cfg = configuracion();
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina, cfg.tamanoLetra);

  if (copia) marcaCopia(t);

  encabezado(t, {
    titulo: previa ? 'Sueldo (previa)' : 'Sueldo',
    atendio: raya.pagada_por_nombre,
    fecha: fechaTicket(raya.pagada_en || new Date().toISOString())
  });

  // DE QUIÉN ES, en grande: es lo primero que mira quien lo recibe.
  t.izquierda().negrita().tamano(2, 1)
   .linea(String(raya.usuario_nombre || '?').slice(0, 22)).normal();
  t.linea(`Del ${fechaDia(raya.desde)} al ${fechaDia(raya.hasta)}`);
  t.separador('.');

  // LA CUENTA, en el orden en que se canta.
  t.bloqueDerecha([
    [raya.dias_trabajados != null
      ? `Sueldo (${raya.dias_trabajados} ${raya.dias_trabajados === 1 ? 'dia' : 'dias'})`
      : 'Sueldo',
     formato(raya.sueldo_centavos)],
    raya.extras_centavos ? ['Extras', '+' + formato(raya.extras_centavos)] : null,
    raya.vales_centavos ? ['Vales que se llevo', '-' + formato(raya.vales_centavos)] : null,
    raya.descuentos_centavos
      ? ['Otros descuentos', '-' + formato(raya.descuentos_centavos)] : null
  ]);

  if (raya.extras_notas) t.parrafo(`Extras: ${raya.extras_notas}`);
  if (raya.descuentos_notas) t.parrafo(`Descuentos: ${raya.descuentos_notas}`);

  // LOS VALES, UNO POR UNO. Es lo que más se pregunta al recibir menos de
  // lo esperado, y "vales -$400" a secas no lo contesta.
  if (raya.vales?.length) {
    t.negrita().separadorConTitulo('SUS VALES').negrita(false);
    for (const v of raya.vales) {
      t.columnas2(`  ${fechaDia(v.fecha)}`, formato(v.centavos));
    }
  }

  // LO QUE SE LLEVA, en grande. Es el número del papel.
  t.separador();
  t.centro().linea('SE LE PAGA');
  t.negrita().tamano(2, 2).linea(formato(raya.pagado_centavos)).normal().izquierda();

  t.separador('.');
  if (previa) {
    t.centro().negrita().linea('*** TODAVIA NO SE HA PAGADO ***').negrita(false);
    t.linea('Esto es solo la cuenta').izquierda();
  } else {
    t.linea(raya.de_donde === 'cajon' ? 'Salio del cajon' : 'No salio del cajon');
  }
  if (raya.notas) t.parrafo(raya.notas);

  if (raya.anulada_en) {
    t.centro().negrita().tamano(2, 1).linea('ANULADA').normal().izquierda();
    if (raya.motivo_anulacion) t.parrafo(raya.motivo_anulacion);
  }

  t.separador();
  if (!previa) t.firma('RECIBI CONFORME');
  pie(t, negocio);
  t.izquierda().cortar(cfg.avanceCorte);
  return t.bytes();
}

/**
 * "26/Ago" — un día de calendario, corto, para los renglones apretados.
 *
 * Aguanta que le llegue con hora ("2026-08-26T14:03:00"): los vales guardan
 * el momento exacto, y pegarle un "T12:00:00" a eso daba NaN/undefined.
 */
function fechaDia(dia) {
  if (!dia) return '?';
  const d = new Date(`${String(dia).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '?';
  return `${d.getDate()}/${MESES[d.getMonth()]}`;
}

/**
 * LOS NÚMEROS A SACAR, para el operario.
 *
 * Este papel se lo lleva en la mano al cuarto de tanques, y vuelve escrito
 * con lo que sacó de verdad. Salía por la ventana de imprimir del navegador
 * —hoja tamaño carta, elegir impresora, vista previa— y en un cuarto de
 * máquinas eso no lo hace nadie: sale por la térmica como todo lo demás.
 *
 * Los números van GRANDES a propósito. El operario lo lee con guantes, con la
 * mano mojada y con poca luz.
 */
function ticketProduccion(datos, { negocio = '' } = {}) {
  const cfg = configuracion();
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina, cfg.tamanoLetra);

  encabezado(t, {
    titulo: 'Hielo a sacar',
    atendio: datos.entregadoPor,
    fecha: fechaTicket(datos.fecha)
  });

  // LA FORMA QUE PEDISTE  (v5.0): un renglón por tanque, con la letra del
  // tanque a la izquierda y sus números en grande, separados por puntos.
  //
  //     N     11 · 13 · 15 · 17
  //     ______________________________________________
  //     T     11 · 13 · 15 · 17
  //
  // Antes eran DOS renglones por tanque —el nombre y debajo el número que
  // toca— y solo el primer paño salía grande. Los cuatro números en grande
  // y en un renglón se leen de un vistazo desde el otro lado del cuarto,
  // que es donde se lee este papel.
  const grupos = datos.lista || [];
  grupos.forEach((grupo, i) => {
    const tanque = String(grupo.tanque || '').toUpperCase();
    const siguientes = grupo.siguientes || [];

    // El nombre del tanque ocupa una columna fija a la izquierda, para que
    // todos los números arranquen a la misma altura y la tira se lea como
    // una tabla y no como un párrafo.
    const CAJON = 6;
    const etiqueta = tanque.slice(0, CAJON).padEnd(CAJON);
    const numeros = siguientes.length ? siguientes.join(' . ') : 'sin panos';

    // El renglón entero al doble de ancho: cabe la mitad de las columnas,
    // así que se comprueba antes de mandarlo.
    if ((etiqueta + numeros).length * 2 <= t.ancho) {
      t.izquierda().negrita().tamano(2, 1).linea(etiqueta + numeros).normal();
    } else {
      // Con muchos paños en fila no cabe en grande: el tanque y el que
      // toca AHORA van grandes, y los que siguen debajo en normal.
      const [primero, ...luego] = siguientes;
      t.izquierda().negrita().tamano(2, 1)
       .linea(etiqueta + (primero ?? 'sin panos')).normal();
      if (luego.length) t.linea(`${' '.repeat(CAJON)}luego: ${luego.join(', ')}`);
    }

    // LO QUE QUEDÓ A MEDIAS, en letra normal debajo de sus números — como
    // el "paño 11 incompleto, terminar de sacar" del diseño. Va con
    // detalle y no con un número suelto: este papel se le entrega al turno
    // que llega, y "a medias: 3" lo obliga a ir a contar canastas.
    for (const m of grupo.aMedias || []) {
      t.parrafo(`pano ${m.pano} incompleto: faltan ${m.faltan} de ${m.total} ` +
                `canastas. terminar de sacar${m.empezadoPor ? ` (lo empezo ${m.empezadoPor})` : ''}`,
                { sangria: 0 });
    }
    if (!grupo.aMedias?.length && grupo.enProceso?.length) {
      t.parrafo(`pano ${grupo.enProceso.join(', ')} incompleto. terminar de sacar`);
    }

    // Una raya fina entre tanque y tanque, como en el diseño. Después del
    // último no: ahí ya viene la raya del pie.
    if (i < grupos.length - 1) t.raya();
  });

  t.separador();
  t.linea('Saco de verdad:');
  t.firma('FIRMA DEL OPERARIO');

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
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina, cfg.tamanoLetra);

  encabezado(t, {
    titulo: 'El dia',
    atendio: datos.quien,
    fecha: fechaTicket(datos.fecha)
  });

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
      // QUIÉN LO SACÓ, en su propio renglón (v4.7). Estaba en el papel del
      // hielo, que ahora es solo del cuarto frío; el dato tenía que
      // mudarse con los paños, no perderse.
      if (uno.quien) t.linea(`  ${uno.quien}`);
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
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina, cfg.tamanoLetra);

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
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina, cfg.tamanoLetra);
  const c = corte.caja;
  const dif = c.diferencia_centavos;

  // LA FORMA QUE PEDISTE  (v5.0):
  //
  //     Corte #11                        Tony Castilla
  //          31/ago/26 9:15am - 31/ago/26 2:47pm
  //     - - - - - - - - - - - - - - - - - - - - - - -
  //     750 tickets      15 gastos           3 vales
  //     - - - - - - - - - - - - - - - - - - - - - - -
  //              Cobrado ............... +$5,785
  //     Gastos y retiros ...............   -$785
  //                                     _________
  //        Deberia haber ...............    $455
  //            Entregado ...............   -$450
  //     - - - - - - - - - - - - - - - - - - - - - - -
  //                     FALTA $55
  //
  // La hora de abrir se subió al encabezado, junto a la de cerrar: son el
  // mismo dato —de cuándo a cuándo fue este turno— y juntas se leen de una
  // vez en lugar de tener que buscar una arriba y otra en medio.
  encabezado(t, {
    titulo: `Corte #${c.folio}`,
    atendio: c.cajero_nombre,
    fecha: `${fechaTicket(c.abierta_en)} - ${cuandoCorto(c.cerrada_en, c.abierta_en)}`,
    fechaAlinear: 'centro'
  });

  const cancelados = corte.ventas.canceladas;

  // EL PRIMER PAPEL ES EL DEL DINERO, y nada más  (v4.1)
  //
  // Los gastos van SOLO como total: el desglose se imprime aparte, en el
  // segundo papel. Este es el que se firma y el que se entrega con el
  // cajón, y con quince renglones de gastos en medio deja de leerse de un
  // vistazo justo cuando hay que leerlo rápido.
  const cuantosGastos = corte.movimientos.filter(
    (m) => m.tipo === 'salida' && !m.anulado_en).length;

  // GASTOS Y VALES, EN DOS RENGLONES  (v4.3)
  //
  // La gasolina de la camioneta y los $2,000 que se llevó el patrón salían
  // sumados en el mismo renglón, y así un corte con mucha salida no dice
  // cuál de las dos fue: si la fábrica gastó o si nada más movieron el
  // dinero. Se parten SOLO si los dos montones suman exactamente lo que
  // dice el corte congelado; si no cuadran —un corte viejo, uno corregido—
  // manda el número del papel y se imprime como siempre.
  const partido = corte.salidas || null;
  const seParten = Boolean(partido) && partido.valesCentavos > 0
    && partido.gastosCentavos + partido.valesCentavos === c.salidas_centavos;
  const conCuantos = (nombre, n) => (n ? `${nombre} (${n})` : nombre);

  // LOS TRES NÚMEROS DE UN VISTAZO, uno en cada tercio del renglón. Es lo
  // que se mira antes de leer la cuenta: cuánto se movió el turno.
  const cuantosVales = partido?.vales?.length || 0;
  t.columnas3(
    `${corte.ventas.cobradas} ticket${corte.ventas.cobradas === 1 ? '' : 's'}`,
    cancelados ? `${cancelados} cancelado${cancelados === 1 ? '' : 's'}`
               : `${cuantosGastos} gasto${cuantosGastos === 1 ? '' : 's'}`,
    cuantosVales ? `${cuantosVales} vale${cuantosVales === 1 ? '' : 's'}`
                 : (cancelados ? `${cuantosGastos} gastos` : `fondo ${formato(c.fondo_centavos)}`)
  );
  t.separador();

  t.bloquePunteado([
    ['Fondo', formato(c.fondo_centavos)],
    ['Cobrado', '+' + formato(c.vendido_centavos)],
    c.entradas_centavos ? ['Entradas', '+' + formato(c.entradas_centavos)] : null,
    ...(seParten
      ? [
          partido.gastos.length
            ? { etiqueta: conCuantos('Gastos', partido.gastos.length),
                valor: '-' + formato(partido.gastosCentavos) }
            : null,
          { etiqueta: conCuantos('Vales', partido.vales.length),
            valor: '-' + formato(partido.valesCentavos) }
        ]
      : [{ etiqueta: conCuantos('Gastos y retiros', cuantosGastos),
           valor: '-' + formato(c.salidas_centavos) }]),
    // La raya de la suma va justo encima del resultado, como en una cuenta
    // de papel: lo de arriba son los sumandos, lo de abajo el resultado.
    { etiqueta: 'DEBERIA HABER', valor: formato(c.esperado_centavos),
      raya: true, negrita: true },
    // Desde la v4.1 el turno se cierra SIN contar: el cajero entrega el
    // cajón y sigue vendiendo. Lo que se contó se anota después, cuando el
    // dueño o el gerente reciben el dinero. Si todavía no se ha recibido,
    // este papel no puede decir cuánto había — solo cuánto debía haber.
    c.entregado_centavos != null
      ? { etiqueta: 'ENTREGADO', valor: formato(c.entregado_centavos), negrita: true }
      : c.contado_centavos != null
      ? { etiqueta: 'CONTADO', valor: formato(c.contado_centavos), negrita: true }
      : null
  ]);
  t.separador();

  if (dif === null || dif === undefined) {
    // Ni "cuadró" ni "falta": todavía no se ha contado, y decir cualquiera
    // de las dos cosas sería inventarse el dato que este papel viene a
    // pedir. La raya de abajo es donde se escribe a mano lo que se entrega.
    t.centro().negrita().tamano(2, 1).linea('SIN CONTAR').normal();
    t.centro().linea('Se anota al recibir el dinero').izquierda();
    t.firma('Entregado $');
  } else {
    // EL RESULTADO, subrayado. En tu diseño va además en cursiva, pero una
    // impresora térmica no tiene cursivas: el subrayado hace el mismo
    // trabajo —decir "esto es el resultado de la cuenta"— y sí existe.
    renglonResultado(t,
      dif === 0 ? 'CUADRO' : dif > 0 ? `SOBRA ${formato(dif)}` : `FALTA ${formato(-dif)}`);
  }

  // LO QUE LE LLEGÓ AL DUEÑO DE ESTE TURNO  (v4.3)
  //
  // Un retiro a media mañana es dinero de este turno que ya está en manos
  // del dueño: al final del día entregan menos porque ya se llevaron una
  // parte, no porque falte. Este renglón lo dice de una vez, para que no
  // haya que sumarlo de cabeza con el papel del vale al lado.
  //
  // Solo cuenta lo que se llevaron y NO era gasto —el retiro a la caja
  // fuerte—: un vale de raya es sueldo pagado, no dinero que volvió.
  const alDueno = corte.salidas?.traspasadoCentavos || 0;
  const recibido = c.entregado_centavos ?? c.contado_centavos ?? null;
  if (alDueno > 0 && recibido !== null) {
    t.izquierda().linea(
      `De este turno: ${formato(alDueno)} en vales`);
    t.linea(`  + ${formato(recibido)} entregado = ${formato(alDueno + recibido)}`);
  }

  // QUIÉN METIÓ QUÉ. Solo cuando de verdad hubo relevo: con una sola
  // persona esto repetiría el bloque de arriba con otro nombre.
  if (corte.porPersona?.length > 1) {
    t.negrita().separadorConTitulo('CADA QUIEN').negrita(false);
    for (const p of corte.porPersona) {
      t.columnas2(p.nombre, formato(p.efectivo));
      const extras = [
        `${p.cobradas} ticket${p.cobradas === 1 ? '' : 's'}`,
        p.fiado ? `a credito ${formato(p.fiado)}` : null,
        p.salidas ? `gastos ${formato(p.salidas)}` : null
      ].filter(Boolean);
      t.linea(`  ${extras.join(' - ')}`);
    }
  }

  // Quién cerró y la raya para firmar, en el mismo renglón: es su firma la
  // que va ahí, así que el nombre delante de la raya dice las dos cosas.
  t.separador();
  // Sin nombre de quien cerró, el letrero era "Cerro -: ______", que se lee
  // como un error. Se dice lo que se sabe y ya.
  t.firma(c.cerrada_por_nombre
    ? `Cerro ${String(c.cerrada_por_nombre).slice(0, 24)}`
    : 'FIRMA DE QUIEN CIERRA');
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
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina, cfg.tamanoLetra);
  const c = corte.caja;

  encabezado(t, {
    titulo: `Detalle #${c.folio}`,
    atendio: c.cajero_nombre,
    fecha: fechaTicket(c.cerrada_en)
  });

  // Los vales van en su propio apartado y CON NOMBRE (v4.3). En la lista
  // de gastos, "Retiro a la caja fuerte $2,000" no dice lo único que hay
  // que saber de un retiro, que es quién se lo llevó.
  const esVale = new Set((corte.salidas?.vales || []).map((m) => m.id));
  const salidas = vivos.filter((m) => m.tipo === 'salida');
  const gastos = salidas.filter((m) => !esVale.has(m.id));
  const vales = salidas.filter((m) => esVale.has(m.id));
  const entradas = vivos.filter((m) => m.tipo !== 'salida');

  if (gastos.length) columnaDeMovimientos(t, 'GASTOS', gastos, '-');
  if (vales.length) columnaDeMovimientos(t, 'VALES', vales, '-', { conQuien: true });
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
 * EL PAPEL DEL HIELO  (v4.2)
 *
 * El tercer papel del cierre, y el que faltaba. El corte enseñaba el dinero
 * con todo detalle y del hielo no decía nada — cuando el hielo es el
 * producto. Aquí va el cuadre entero, desde el conteo anterior hasta este:
 *
 *     lo que había + lo que se produjo = lo que TENÍA que haber
 *     menos lo vendido, lo derretido y lo cortado
 *     contra lo que se CONTÓ           = lo que FALTÓ o SOBRÓ
 *
 * Y debajo, de dónde salió cada número: qué paños se sacaron y quién,
 * cuántos de cada pedazo se vendieron, cuánto se fue a mayoreo, y en qué
 * se derritió lo que se derritió.
 *
 * Devuelve null si ese turno no contó hielo: un papel con todo en cero
 * haría creer que se contó y salió cero.
 */
function ticketHielo(corte, { negocio = '' } = {}) {
  const h = corte.hielo;
  if (!h) return null;

  const cfg = configuracion();
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina, cfg.tamanoLetra);
  const c = corte.caja;
  const q = h.cuadre;

  encabezado(t, {
    titulo: `Hielo #${c.folio}`,
    atendio: h.conteo.ejecutor_nombre || c.cajero_nombre,
    fecha: fechaTicket(h.hasta)
  });

  t.columnas2(h.almacen || 'Cuarto frio',
              h.primerConteo ? 'primer conteo' : `desde ${cuandoCorto(h.desde, h.hasta)}`);

  // ---- EL CUADRE ----
  t.bloqueDerecha([
    ['Habia', aTexto(q.anterior)],
    ['Se produjo', '+' + aTexto(q.producido)],
    ['TENIA QUE HABER', aTexto(q.teorico)],
    ['Se vendio', '-' + aTexto(q.vendido)],
    q.guardado ? ['Se quedo guardado', '+' + aTexto(q.guardado)] : null,
    q.recogido ? ['Pasaron por lo guardado', '-' + aTexto(q.recogido)] : null,
    q.merma ? ['Derretido o roto', '-' + aTexto(q.merma)] : null,
    q.cortado ? ['Se corto', '-' + aTexto(q.cortado)] : null,
    ['DEBERIA QUEDAR', aTexto(q.esperado)],
    ['CONTADO', aTexto(q.contado)]
  ]);

  // El número que se viene a ver. Grande, como el del dinero.
  t.centro().negrita().tamano(2, 1)
   .linea(q.faltante === 0 ? 'CUADRO'
     : q.faltante > 0 ? `FALTA ${aTexto(q.faltante)}` : `SOBRA ${aTexto(-q.faltante)}`)
   .normal().izquierda();
  if (q.faltante !== 0) {
    t.centro().linea(q.faltante > 0 ? 'hielo que nadie explico' : 'mas hielo del que debia').izquierda();
  }

  // LOS PAÑOS NO VAN AQUÍ  (v4.7)
  //
  // "Solo deja paños sacados para lo del día, y déjame toda la info de
  //  cuarto frío, se vendió, con eso."
  //
  // Y tiene razón: los paños son producción del DÍA, no del turno de caja,
  // y ya salen en el papel del día con quién los sacó. Repetirlos aquí era
  // el mismo dato dos veces en dos papeles que se imprimen juntos. Lo que
  // sí es de este papel es el cuarto frío: qué había, qué debía haber, qué
  // se contó y qué faltó.

  // ---- CUÁNTO SE VENDIÓ, Y A QUÉ PRECIO ----
  //
  // Dos números y ya: al público y a mayoreo. Es la pregunta que se hace
  // mirando esto —"¿cuánto se fue barato?"— y se contesta de un vistazo.
  t.negrita().separadorConTitulo('SE VENDIO').negrita(false);
  if (!h.listas.length) {
    t.linea('  nada');
  } else {
    for (const l of h.listas) {
      t.columnas2(`  ${l.tipo === 'mayoreo' ? 'Mayoreo' : 'Publico'}`,
                  `${aTexto(l.dieciseisavos)} · ${l.tickets} tk`);
    }
    t.separador('.');
    t.bloqueDerecha([['TOTAL', aTexto(q.vendido)]]);
  }

  t.separador();
  t.firma(`Conto ${(h.conteo.ejecutor_nombre || '-').slice(0, 24)}`);
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
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina, cfg.tamanoLetra);
  const c = corte.caja;

  // "Su parte del turno" cabe en el título: es lo que ES este papel.
  encabezado(t, {
    titulo: `Su parte del #${c.folio}`,
    atendio: persona.nombre,
    fecha: fechaTicket(c.cerrada_en)
  });

  // De cuándo a cuándo y cuántos tickets, en un renglón. Eran tres.
  const desde = persona.primera ? soloHora(persona.primera) : '';
  const hasta = persona.ultima ? soloHora(persona.ultima) : '';
  t.columnas2(desde && hasta ? `De ${desde} a ${hasta}` : 'Su parte del turno',
              `${persona.cobradas} tickets`
              + (persona.canceladas
                 ? ` (${persona.canceladas} cancelado${persona.canceladas === 1 ? '' : 's'})` : ''));

  t.bloqueDerecha([
    ['Cobrado en efectivo', formato(persona.efectivo)],
    persona.fiado ? ['A credito', formato(persona.fiado)] : null,
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
function columnaDeMovimientos(t, titulo, lista, signo, { conQuien = false } = {}) {
  // El título va DENTRO de la raya en vez de en su propio renglón: la raya
  // ya estaba y el título ya estaba, y juntos hacen el mismo trabajo.
  t.negrita().separadorConTitulo(`${titulo} (${lista.length})`).negrita(false);
  for (const m of lista) {
    t.columnas2(m.anulado_en ? `(anulado) ${m.concepto}` : m.concepto,
                m.anulado_en ? '-' : signo + formato(m.centavos));
    // En los vales, quién se lo llevó va debajo y con sangría: es el dato
    // por el que se mira esta lista, y en el renglón de arriba no cabe
    // sin recortarle el nombre a alguien.
    if (conQuien && m.ejecutor_nombre) t.linea(`  ${m.ejecutor_nombre.slice(0, 40)}`);
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
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina, cfg.tamanoLetra);
  const r = conteo.resumen;

  // Se arma como todos los demás papeles: qué es arriba a la izquierda,
  // quién y cuándo arriba a la derecha, el negocio abajo. Este era el único
  // que se había quedado con la cabecera vieja, centrada y de cinco
  // renglones. Ahora son tres, y además se reconoce como los otros.
  encabezado(t, {
    titulo: 'Conteo',
    atendio: conteo.ejecutor,
    fecha: fechaTicket(conteo.fecha),
    subtitulo: String(conteo.almacen || '').toUpperCase()
  });

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
  const t = new Ticket(cfg.anchoMm, cfg.codigoPagina, cfg.tamanoLetra);
  t.abrirCajon(salida);
  return t.bytes();
}

module.exports = {
  ticketVenta, ticketMovimiento, ticketVale, ticketEncomienda, ticketRaya,
  ticketCotizacion, ticketPrueba,
  ticketCorte, ticketCorteMovimientos, ticketHielo, ticketCortePersona, ticketConteo, ticketProduccion, ticketResumenDia, pulsoCajon, fechaCorta, fechaTicket
};
