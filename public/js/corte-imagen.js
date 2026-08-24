/**
 * EL CORTE COMO IMAGEN  (v1.9)
 *
 * "El corte me gustaría que cuando lo vea en celular lo pueda compartir por
 * WhatsApp de manera rápida, o sea la imagen del ticket."
 *
 * Se dibuja el ticket a mano en un canvas, renglón por renglón. Suena más
 * trabajoso de lo que es, y a cambio:
 *
 *  · NO HACE FALTA NINGUNA LIBRERÍA. El programa corre en la fábrica, sin
 *    internet y sin que nadie instale nada. Bajarse media librería para
 *    convertir HTML en foto sería regalar esa ventaja.
 *  · SALE IGUAL EN TODOS LADOS. Una foto de la pantalla saldría distinta en
 *    cada celular; esto sale idéntico, con letra grande y fondo blanco,
 *    que es lo que se lee en un WhatsApp.
 *
 * Se comparte con `navigator.share`, que en el celular abre el mismo menú de
 * siempre —WhatsApp arriba— sin que el programa sepa nada de WhatsApp. En la
 * PC ese menú no existe, así que ahí se baja la imagen y se abre WhatsApp Web
 * con el resumen escrito: se arrastra la imagen y listo.
 */

const ANCHO = 760;
const MARGEN = 40;
const MONO = 'ui-monospace, "Courier New", monospace';

/**
 * Un pintor de renglones: lleva la cuenta de a qué altura va, para no andar
 * sumando píxeles a mano en cada línea.
 */
function pintor(ctx, ancho) {
  let y = 0;
  const dentro = ancho - MARGEN * 2;

  return {
    get y() { return y; },
    set y(v) { y = v; },
    espacio(px) { y += px; },

    centro(texto, { tam = 20, negrita = false } = {}) {
      ctx.font = `${negrita ? '700 ' : ''}${tam}px ${MONO}`;
      ctx.textAlign = 'center';
      y += tam;                       // y es el tope del renglón; aquí baja a la base
      ctx.fillText(texto, ancho / 2, y);
      y += 8;
    },

    /** Izquierda y derecha en el mismo renglón: concepto e importe. */
    fila(izq, der, { tam = 19, negrita = false, x = MARGEN, w = dentro, tachado = false } = {}) {
      ctx.font = `${negrita ? '700 ' : ''}${tam}px ${MONO}`;
      ctx.textAlign = 'left';
      const recorte = recortar(ctx, izq, w - ctx.measureText(der || '').width - 12);
      y += tam;
      ctx.fillText(recorte, x, y);
      if (der) {
        ctx.textAlign = 'right';
        ctx.fillText(der, x + w, y);
      }
      if (tachado) {
        const alto = tam * 0.35;
        ctx.fillRect(x, y - alto, w, 1);
      }
      y += 7;
    },

    raya({ x = MARGEN, w = dentro, punteada = true } = {}) {
      y += 8;
      ctx.save();
      if (punteada) ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.stroke();
      ctx.restore();
      y += 8;
    }
  };
}

/** Corta el texto con puntos suspensivos si no cabe en su columna. */
function recortar(ctx, texto, ancho) {
  const t = String(texto ?? '');
  if (ancho <= 0 || ctx.measureText(t).width <= ancho) return t;
  let corto = t;
  while (corto.length > 1 && ctx.measureText(corto + '…').width > ancho) {
    corto = corto.slice(0, -1);
  }
  return corto + '…';
}

/**
 * Dibuja el corte y devuelve el canvas.
 *
 * `datos` es lo mismo que enseña la pantalla, ya con formato de pesos hecho
 * afuera: aquí no se decide qué dice el corte, solo cómo se ve.
 */
export function dibujarCorte(datos) {
  // SE DIBUJA DOS VECES. La primera en un canvas de mentiras, solo para
  // saber dónde terminó; la segunda de verdad, ya con el alto exacto.
  // Calcular el alto sumando renglones a mano es lo que hace que un día
  // sobre una franja en blanco y otro se corte la firma.
  const medir = document.createElement('canvas').getContext('2d');
  const alto = pintarCorte(medir, datos) + MARGEN;

  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d');

  // Fondo blanco SIEMPRE, aunque el programa esté en modo oscuro: esto se va
  // a ver en un WhatsApp, no en la pantalla de la caja.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ANCHO, alto);
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.textBaseline = 'alphabetic';

  pintarCorte(ctx, datos);
  return lienzo;
}

/** Dibuja el corte y devuelve a qué altura terminó. */
function pintarCorte(ctx, { negocio, corte, pesos: fmt, fecha, rango }) {
  const c = corte.caja;
  const gastos = corte.movimientos.filter((m) => m.tipo === 'salida');
  const entradas = corte.movimientos.filter((m) => m.tipo !== 'salida');
  const dosColumnas = gastos.length > 0 && entradas.length > 0;

  const p = pintor(ctx, ANCHO);
  p.y = MARGEN;

  p.centro((negocio || 'Hielo LOLHA').toUpperCase(), { tam: 26, negrita: true });
  p.centro(`CORTE DE CAJA #${c.folio}`, { tam: 22, negrita: true });
  p.centro(fecha(c.cerrada_en), { tam: 16 });
  p.raya();

  p.fila('Cajero', c.cajero_nombre || '—');
  p.fila('Turno', rango(c.abierta_en, c.cerrada_en), { tam: 16 });
  p.fila('Tickets', String(corte.ventas.cobradas));
  if (corte.ventas.canceladas) p.fila('Cancelados', String(corte.ventas.canceladas));
  p.raya();

  p.fila('Fondo', fmt(c.fondo_centavos));
  p.fila('Cobrado en efectivo', '+' + fmt(c.vendido_centavos));
  if (c.entradas_centavos) p.fila('Entradas', '+' + fmt(c.entradas_centavos));
  p.fila('Gastos y retiros', '−' + fmt(c.salidas_centavos));
  p.raya({ punteada: false });
  p.fila('Debería haber', fmt(c.esperado_centavos), { negrita: true, tam: 21 });
  p.fila('Contado', fmt(c.contado_centavos), { negrita: true, tam: 21 });

  const dif = c.diferencia_centavos;
  p.fila(dif === 0 ? 'CUADRÓ EXACTO' : dif > 0 ? 'SOBRA' : 'FALTA',
         dif === 0 ? '✓' : fmt(Math.abs(dif)), { negrita: true, tam: 23 });

  if (corte.movimientos.length) {
    p.raya();
    const ancho = ANCHO - MARGEN * 2;
    const media = (ancho - 24) / 2;
    const arranque = p.y;
    let masAbajo = p.y;

    const columna = (titulo, lista, signo, x, w) => {
      p.y = arranque;
      p.fila(`${titulo} (${lista.length})`, '', { negrita: true, tam: 18, x, w });
      let suma = 0;
      for (const m of lista) {
        if (!m.anulado_en) suma += m.centavos;
        p.fila(m.concepto, m.anulado_en ? '—' : signo + fmt(m.centavos),
               { tam: 16, x, w, tachado: Boolean(m.anulado_en) });
      }
      p.fila('Suman', signo + fmt(suma), { negrita: true, tam: 17, x, w });
      masAbajo = Math.max(masAbajo, p.y);
    };

    if (dosColumnas) {
      columna('GASTOS', gastos, '−', MARGEN, media);
      columna('ENTRADAS', entradas, '+', MARGEN + media + 24, media);
    } else if (gastos.length) {
      columna('GASTOS', gastos, '−', MARGEN, ancho);
    } else {
      columna('ENTRADAS', entradas, '+', MARGEN, ancho);
    }
    p.y = masAbajo;
  }

  p.raya();
  p.fila('Cerró', c.cerrada_por_nombre || '—', { tam: 16 });

  return Math.round(p.y);
}

/** El canvas como archivo PNG, que es lo que se comparte. */
function aArchivo(lienzo, nombre) {
  return new Promise((resolver) => {
    lienzo.toBlob((blob) => {
      resolver(blob ? new File([blob], nombre, { type: 'image/png' }) : null);
    }, 'image/png');
  });
}

/**
 * COMPARTIR EL CORTE.
 *
 * Devuelve cómo se compartió, para poder decírselo al usuario:
 *   'compartido'  el menú del celular hizo lo suyo
 *   'cancelado'   lo abrió y se arrepintió
 *   'descargado'  no había menú: se bajó la imagen y se abrió WhatsApp Web
 */
export async function compartirCorte(datos) {
  const lienzo = dibujarCorte(datos);
  const nombre = `corte-${datos.corte.caja.folio}.png`;
  const archivo = await aArchivo(lienzo, nombre);

  const texto = resumenEnTexto(datos);

  if (archivo && navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], text: texto });
      return 'compartido';
    } catch (e) {
      // Cancelar no es un error: es que se arrepintió.
      if (e?.name === 'AbortError') return 'cancelado';
    }
  }

  // Sin menú de compartir —casi siempre la PC— se baja la imagen y se abre
  // WhatsApp Web con el resumen escrito. La imagen se arrastra al chat.
  const url = lienzo.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
  return 'descargado';
}

/** El corte en cuatro renglones, para el mensaje que acompaña a la imagen. */
function resumenEnTexto({ negocio, corte, pesos: fmt }) {
  const c = corte.caja;
  const dif = c.diferencia_centavos;
  return [
    `${negocio || 'Hielo LOLHA'} · Corte #${c.folio}`,
    `Cajero: ${c.cajero_nombre || '—'}`,
    `Cobrado en efectivo: ${fmt(c.vendido_centavos)}`,
    `Debería haber: ${fmt(c.esperado_centavos)} · Contado: ${fmt(c.contado_centavos)}`,
    dif === 0 ? 'Cuadró exacto.' : dif > 0
      ? `Sobran ${fmt(Math.abs(dif))}.`
      : `Faltan ${fmt(Math.abs(dif))}.`
  ].join('\n');
}
