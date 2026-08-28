/**
 * EL TICKET DIBUJADO  (v2.6)
 *
 * POR QUÉ ESTO EXISTE
 *
 * Una impresora térmica en modo texto tiene UN SOLO TAMAÑO DE LETRA POR
 * RENGLÓN. Por eso el número del ticket en grande y el "Atendio" chiquito
 * no podían ir en la misma línea, y el papel salía con el salto que a Tony
 * no le gustó: la foto que él dibujó no se puede imprimir así.
 *
 * La salida es dibujar el ticket como una IMAGEN y mandar esa. Entonces la
 * impresora ya no acomoda nada: solo pinta puntos donde le decimos. Y ahí
 * cabe todo lo que se quiera —cualquier letra, cualquier tamaño, dos
 * tamaños en el mismo renglón, rayas, posiciones exactas—, que es lo que
 * hace falta para que el papel salga como la foto.
 *
 * SE DIBUJA EN EL NAVEGADOR, no en el servidor. Es donde hay letras de
 * verdad (las de Windows) sin instalar nada, y donde ya se dibuja el corte
 * para WhatsApp. El servidor recibe el mapa de puntos ya hecho y solo lo
 * envuelve en la orden de ESC/POS que la impresora entiende.
 *
 * LO QUE CUESTA: unas décimas de segundo más por ticket. No gasta más
 * papel: el papel depende de lo alto que salga, y esto sale más corto que
 * el de texto porque aprovecha los renglones.
 *
 * TODO LO QUE SE PUEDE MOVER ESTÁ EN `ESTILO`. Es a propósito: de ahí sale
 * el editor de tickets, y mientras no exista, ahí se toca.
 */

/** 576 puntos = 72 mm de ancho de impresión en un papel de 80 mm a 203 ppp. */
export const ANCHO = 576;

/**
 * EL ESTILO DEL TICKET.
 *
 * Cada cosa con su tamaño, su grosor y su sitio. Los tamaños están en
 * puntos de la impresora: 24 es más o menos la letra normal de un ticket,
 * 64 es la que se lee desde el otro lado del mostrador.
 */
export const ESTILO = {
  fuente: '"Segoe UI", Roboto, Arial, Helvetica, sans-serif',
  // Para lo que tiene que quedar en columna: los importes. Una letra de
  // ancho fijo es la única que alinea números sin trampas.
  fuenteNumeros: 'Consolas, "DejaVu Sans Mono", "Courier New", monospace',

  margen: 12,
  interlinea: 1.25,

  numero:    { tam: 46, peso: 800 },
  atendio:   { tam: 21, peso: 400 },
  cliente:   { tam: 23, peso: 600 },
  titulo:    { tam: 46, peso: 800 },   // "Gasto", "Corte #4"

  hielo:     { tam: 72, peso: 800 },
  desglose:  { tam: 21, peso: 400 },
  articulo:  { tam: 24, peso: 400 },
  importe:   { tam: 26, peso: 700 },

  etiqueta:  { tam: 24, peso: 600 },
  total:     { tam: 30, peso: 800 },
  granTotal: { tam: 38, peso: 800 },

  aviso:     { tam: 34, peso: 800 },   // COPIA, CANCELADO
  negocio:   { tam: 26, peso: 800 },
  nota:      { tam: 21, peso: 400 },

  // La raya de separación: guiones dibujados, no escritos. Escritos con
  // texto salen de distinto largo según la letra que haya.
  raya: { grosor: 2, hueco: 6, trazo: 6 },
  // Los puntitos que llevan el ojo del concepto a su precio.
  puntos: { grosor: 2, hueco: 7, trazo: 2 }
};


// ============================================================
// EL PINTOR
//
// Lleva la cuenta de a qué altura va, para no andar sumando píxeles a mano
// en cada línea. Es el mismo truco del corte para WhatsApp.
// ============================================================

function pintor(ctx, estilo = ESTILO) {
  const e = estilo;
  const izq = e.margen;
  const der = ANCHO - e.margen;
  let y = e.margen;

  function poner(cual) {
    const f = typeof cual === 'string' ? { tam: 24, peso: 400 } : cual;
    const familia = f.mono ? e.fuenteNumeros : e.fuente;
    ctx.font = `${f.peso} ${f.tam}px ${familia}`;
    return f;
  }

  return {
    get y() { return y; },
    set y(v) { y = v; },
    espacio(px) { y += px; },

    /** Un renglón. `donde` puede ser 'izq', 'der' o 'centro'. */
    linea(texto, cual, donde = 'izq', { subir = 0 } = {}) {
      const f = poner(cual);
      const alto = f.tam * e.interlinea;
      const base = y + alto - f.tam * 0.28 - subir;
      ctx.textAlign = donde === 'der' ? 'right' : donde === 'centro' ? 'center' : 'left';
      ctx.fillText(texto, donde === 'der' ? der : donde === 'centro' ? ANCHO / 2 : izq, base);
      y += alto;
      return alto;
    },

    /**
     * DOS TAMAÑOS EN EL MISMO RENGLÓN. Esto es lo único que no se puede
     * hacer en modo texto, y es justo el renglón que Tony pidió: el número
     * grande a la izquierda y quién atendió, chiquito, a la derecha.
     *
     * La altura del renglón la manda el más grande de los dos, y el chico
     * se pega arriba para que las dos primeras líneas se lean como una.
     */
    aLosLados(izquierda, cualIzq, derechas, cualDer, { centrar = false } = {}) {
      const fi = typeof cualIzq === 'string' ? { tam: 24, peso: 400 } : cualIzq;
      const fd = typeof cualDer === 'string' ? { tam: 21, peso: 400 } : cualDer;
      const altoIzq = fi.tam * e.interlinea;
      const altoDer = fd.tam * e.interlinea;
      const lineas = [].concat(derechas).filter(Boolean);
      const alto = Math.max(altoIzq, altoDer * lineas.length);

      poner(fi);
      ctx.textAlign = 'left';
      ctx.fillText(izquierda, izq, y + altoIzq - fi.tam * 0.28);

      // `centrar` es para el importe del hielo: al lado de un número de
      // 72 puntos, pegado arriba se ve suelto; a media altura se lee como
      // el precio DE ese número, que es lo que es.
      const sobra = alto - altoDer * lineas.length;
      const desde = y + (centrar ? sobra / 2 : 0);

      poner(fd);
      ctx.textAlign = 'right';
      lineas.forEach((t, i) => {
        ctx.fillText(t, der, desde + altoDer * (i + 1) - fd.tam * 0.28);
      });

      y += alto;
      return alto;
    },

    /** La raya de guiones de lado a lado. */
    raya(margenArriba = 8, margenAbajo = 8) {
      y += margenArriba;
      ctx.save();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = e.raya.grosor;
      ctx.setLineDash([e.raya.trazo, e.raya.hueco]);
      ctx.beginPath();
      ctx.moveTo(izq, y + e.raya.grosor / 2);
      ctx.lineTo(der, y + e.raya.grosor / 2);
      ctx.stroke();
      ctx.restore();
      y += e.raya.grosor + margenAbajo;
    },

    /**
     * Concepto a la izquierda, importe a la derecha, y puntitos en medio.
     * Los puntos no son adorno: son los que llevan el ojo del nombre a su
     * precio sin saltar de renglón. En una cuenta de ocho conceptos se nota.
     */
    conPuntos(texto, monto, cualTexto = e.articulo, cualMonto = e.importe) {
      const ft = poner(cualTexto);
      const anchoTexto = ctx.measureText(texto).width;
      const fm = poner(cualMonto);
      const anchoMonto = ctx.measureText(monto).width;
      const alto = Math.max(ft.tam, fm.tam) * e.interlinea;
      const base = y + alto - Math.max(ft.tam, fm.tam) * 0.28;

      poner(ft);
      ctx.textAlign = 'left';
      ctx.fillText(texto, izq, base);

      poner(fm);
      ctx.textAlign = 'right';
      ctx.fillText(monto, der, base);

      const desde = izq + anchoTexto + 10;
      const hasta = der - anchoMonto - 10;
      if (hasta > desde) {
        ctx.save();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = e.puntos.grosor;
        ctx.setLineDash([e.puntos.trazo, e.puntos.hueco]);
        ctx.beginPath();
        ctx.moveTo(desde, base - ft.tam * 0.12);
        ctx.lineTo(hasta, base - ft.tam * 0.12);
        ctx.stroke();
        ctx.restore();
      }

      y += alto;
    },

    /**
     * EL BLOQUE DE TOTALES, pegado a la derecha y en columna.
     *
     * Las etiquetas se alinean entre sí y los importes también, porque el
     * ancho se calcula mirando TODOS los renglones. Uno por uno, cada quien
     * se alinearía por su cuenta y el bloque saldría escalonado.
     */
    totales(filas) {
      const buenas = filas.filter(Boolean);
      if (!buenas.length) return;

      // Se mide con la MISMA letra con la que se va a dibujar. Aquí había
      // un encimado: se medía con la letra normal y se dibujaba con la de
      // ancho fijo, que es más ancha, así que "TOTAL:" se montaba sobre el
      // importe.
      let anchoMonto = 0;
      for (const [, monto, grande] of buenas) {
        poner({ ...(grande ? e.granTotal : e.total), mono: true });
        anchoMonto = Math.max(anchoMonto, ctx.measureText(monto).width);
      }

      for (const [etiqueta, monto, grande] of buenas) {
        const fe = poner(e.etiqueta);
        const fm = grande ? e.granTotal : e.total;
        const alto = Math.max(fe.tam, fm.tam) * e.interlinea;
        const base = y + alto - Math.max(fe.tam, fm.tam) * 0.28;

        poner(e.etiqueta);
        ctx.textAlign = 'right';
        ctx.fillText(etiqueta, der - anchoMonto - 16, base);

        poner({ ...fm, mono: true });
        ctx.textAlign = 'right';
        ctx.fillText(monto, der, base);

        y += alto;
      }
    },

    /** La raya para firmar, centrada, con su letrero debajo. */
    firma(etiqueta = 'FIRMA') {
      y += 46;
      ctx.save();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ANCHO * 0.22, y);
      ctx.lineTo(ANCHO * 0.78, y);
      ctx.stroke();
      ctx.restore();
      y += 6;
      this.linea(etiqueta, e.nota, 'centro');
    },

    /** El aviso de arriba: COPIA, CANCELADO. Con su marco de asteriscos. */
    cartel(texto) {
      const f = poner(e.aviso);
      const alto = f.tam * 1.5;
      ctx.save();
      ctx.fillStyle = '#000';
      ctx.fillRect(izq, y, der - izq, alto);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(texto, ANCHO / 2, y + alto - f.tam * 0.42);
      ctx.restore();
      y += alto + 10;
    }
  };
}


// ============================================================
// LOS TICKETS
// ============================================================

/**
 * EL TICKET DE UNA VENTA, con la forma de la foto:
 *
 *   #2026-152125            Atendio: Tony Castilla
 *                               26/Ago/2026 5:45pm
 *   Cliente: Mario Cauich
 *   ------------------------------------------------
 *   2 3/8                                    $610.00
 *   (2 + 1/4 + 1/8)
 *   2 Coca 600 ................................ $50.00
 *   ------------------------------------------------
 *                              TOTAL:      $660.00
 *                              PAGO:       $700.00
 *                              CAMBIO:      $40.00
 *   HIELO LOL-HA
 */
export function dibujarVenta(ctx, v, estilo = ESTILO) {
  const p = pintor(ctx, estilo);

  if (v.copia) p.cartel('* * *  C O P I A  * * *');
  if (v.cancelado) p.cartel('C A N C E L A D O');

  // La esquina de arriba: el número grande a la izquierda, quién y cuándo
  // chiquito a la derecha. ESTE es el renglón que no se podía imprimir.
  p.aLosLados(`#${v.numero}`, estilo.numero,
              [`Atendio: ${v.atendio}`, v.fecha], estilo.atendio);
  if (v.cliente) p.linea(`Cliente: ${v.cliente}`, estilo.cliente);
  p.raya();

  // El hielo, en grande, con su importe a la derecha del mismo renglón.
  if (v.hielo) {
    p.aLosLados(v.hielo, estilo.hielo, [v.hieloImporte], estilo.importe,
                { centrar: true });
    if (v.desglose) p.linea(v.desglose, estilo.desglose);
  }

  for (const a of v.articulos || []) p.conPuntos(a.texto, a.importe);

  p.raya();
  p.totales([
    ['TOTAL:', v.total, true],
    v.vale ? [`VALE #${v.valeNumero}:`, v.vale] : null,
    v.devolver ? ['SE LE DEVUELVE:', v.devolver] : null,
    v.pago ? ['PAGO:', v.pago] : null,
    v.cambio ? ['CAMBIO:', v.cambio] : null
  ]);

  if (v.fiado) {
    p.raya();
    p.linea('FIADO', estilo.aviso, 'centro');
    p.firma('FIRMA DE RECIBIDO');
  }

  p.espacio(10);
  p.linea((v.negocio || '').toUpperCase(), estilo.negocio);
  if (v.cambioDe) p.linea(`CAMBIO DEL #${v.cambioDe}`, estilo.cliente);
  if (v.pie) p.linea(v.pie, estilo.nota);

  return p.y + estilo.margen;
}

/**
 * EL COMPROBANTE DE UN GASTO:
 *
 *   Gasto                   Atendio: Tony Castilla
 *                               26/Ago/2026 5:45pm
 *   ------------------------------------------------
 *   $6,250      GASOLINA PARA LIMPIAR PIEZAS DE LA
 *               MAQUINA NUEVA EN REPARACION
 *   ------------------------------------------------
 *                     ______________
 *                          FIRMA
 */
export function dibujarGasto(ctx, g, estilo = ESTILO) {
  const p = pintor(ctx, estilo);

  p.aLosLados(g.titulo || 'Gasto', estilo.titulo,
              [`Atendio: ${g.atendio}`, g.fecha], estilo.atendio);
  p.raya();

  // El importe grande a la izquierda y el concepto a la derecha, repartido
  // en varios renglones: tal cual la foto.
  const f = { ...estilo.hielo, tam: 54 };
  const desdeY = p.y;
  p.aLosLados(g.importe, f, partir(ctx, g.concepto.toUpperCase(), estilo, 300),
              { ...estilo.desglose, tam: 22 }, { centrar: true });
  if (p.y < desdeY + 60) p.y = desdeY + 60;

  if (g.notas) p.linea(g.notas, estilo.nota);

  p.raya();
  if (g.firma !== false) p.firma();

  p.espacio(6);
  p.linea((g.negocio || '').toUpperCase(), estilo.negocio);
  return p.y + estilo.margen;
}

/** Parte un texto en renglones que quepan en `ancho` píxeles. */
function partir(ctx, texto, estilo, ancho) {
  ctx.font = `${estilo.desglose.peso} 22px ${estilo.fuente}`;
  const salida = [];
  let linea = '';
  for (const palabra of String(texto).split(/\s+/).filter(Boolean)) {
    const prueba = linea ? `${linea} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width <= ancho || !linea) linea = prueba;
    else { salida.push(linea); linea = palabra; }
  }
  if (linea) salida.push(linea);
  return salida;
}


// ============================================================
// DE DIBUJO A PUNTOS
// ============================================================

/**
 * Convierte el dibujo en el mapa de puntos que entiende la impresora.
 *
 * La térmica no tiene grises: cada punto está quemado o no lo está. Así que
 * todo lo que sea más oscuro que la mitad se vuelve punto negro y lo demás
 * se va en blanco. Un bit por punto, ocho por byte, de izquierda a derecha.
 */
export function aMapaDePuntos(canvas) {
  const ancho = canvas.width;
  const alto = canvas.height;
  const px = canvas.getContext('2d').getImageData(0, 0, ancho, alto).data;
  const porRenglon = Math.ceil(ancho / 8);
  const bytes = new Uint8Array(porRenglon * alto);

  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * 4;
      // Fondo blanco: lo que no se pintó viene transparente y cuenta como
      // blanco. Y el gris de una antialias a media asta se decide por su
      // luminancia, que es como lo ve el ojo.
      const alfa = px[i + 3] / 255;
      const luz = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) * alfa
                  + 255 * (1 - alfa);
      if (luz < 128) bytes[y * porRenglon + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }

  return { ancho, alto, bytes };
}

/** El mapa de puntos listo para viajar por la red. */
export function paraMandar(canvas) {
  const { ancho, alto, bytes } = aMapaDePuntos(canvas);
  let cadena = '';
  for (const b of bytes) cadena += String.fromCharCode(b);
  return { ancho, alto, datos: btoa(cadena) };
}

/**
 * Dibuja lo que sea en un canvas del ancho del papel y lo recorta a lo que
 * de verdad ocupó. Se dibuja en uno alto de sobra porque el alto no se sabe
 * hasta que está pintado, y el papel que sobra sería papel gastado.
 */
export function enCanvas(dibujar, estilo = ESTILO) {
  const grande = document.createElement('canvas');
  grande.width = ANCHO;
  grande.height = 4000;
  const ctx = grande.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, grande.width, grande.height);
  ctx.fillStyle = '#000';

  const alto = Math.ceil(dibujar(ctx, estilo));

  const justo = document.createElement('canvas');
  justo.width = ANCHO;
  // Alto múltiplo de 8: algunas impresoras redondean hacia arriba y meten
  // una franja de basura si no cuadra.
  justo.height = Math.ceil(alto / 8) * 8;
  const c2 = justo.getContext('2d');
  c2.fillStyle = '#fff';
  c2.fillRect(0, 0, justo.width, justo.height);
  c2.drawImage(grande, 0, 0, ANCHO, justo.height, 0, 0, ANCHO, justo.height);
  return justo;
}
