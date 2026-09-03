/**
 * IMPRIMIR  (v0.10)
 *
 * En la caja se imprimen cientos de tickets al día. Dos cosas importan:
 *
 *  1. Que salga SOLO el ticket, no la pantalla entera. Por eso el contenido
 *     se mete en #area-impresion, que vive fuera de la pantalla, y al
 *     imprimir se esconde todo lo demás.
 *
 *  2. Que no aparezca el cuadro de "elegir impresora" cada vez. Eso no lo
 *     puede quitar una página web por su cuenta: lo quita el navegador si se
 *     abre con la opción de impresión directa. INICIAR.bat ya lo hace, y en
 *     Sistema hay instrucciones por si se abre a mano.
 */

/** Mete el ticket en el área de impresión y manda imprimir. */
export function imprimirTicket(html) {
  const area = document.getElementById('area-impresion');
  if (!area) return;
  area.innerHTML = html;
  window.print();
}

/**
 * EL MISMO PAPEL, PERO PARA EL NAVEGADOR  (v4.4)
 *
 * El servidor devuelve el "espejo" de cada ticket: los mismos renglones que
 * salen por la térmica, con su alineación y su tamaño de letra. Cuando no
 * hay impresora térmica configurada, esto los convierte en HTML para que el
 * navegador saque el papel — que es lo que ya hacía el ticket de una venta
 * y a la cotización se le había olvidado.
 *
 * Se respeta el ancho en caracteres del papel: así el ticket de pantalla y
 * el de la térmica se parten igual y dicen lo mismo.
 */
export function htmlDeEspejo(renglones = [], ancho = 48) {
  const escapar = (t) => String(t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const cuerpo = renglones.map((r) => {
    const alineado = r.alin === 'centro' ? 'center' : r.alin === 'derecha' ? 'right' : 'left';
    const grande = (r.anchoLetra || 1) > 1 || (r.altoLetra || 1) > 1;
    const estilo = [
      `text-align:${alineado}`,
      grande ? 'font-size:1.7em;font-weight:700;line-height:1.15' : '',
      r.negrita && !grande ? 'font-weight:700' : '',
      // El subrayado del papel también se ve aquí (v5.0): es lo que marca
      // el resultado de una cuenta, y sin él la copia en pantalla dice
      // menos que el papel.
      r.subrayado ? 'text-decoration:underline' : ''
    ].filter(Boolean).join(';');
    return `<div style="${estilo}">${escapar(r.t) || '&nbsp;'}</div>`;
  }).join('');

  return `
    <div style="font-family:ui-monospace,'Courier New',monospace;font-size:12px;
                line-height:1.35;white-space:pre-wrap;width:${ancho}ch;max-width:100%">
      ${cuerpo}
    </div>`;
}

/** Deja el área limpia: un ticket viejo no debe salir por accidente. */
export function limpiarImpresion() {
  const area = document.getElementById('area-impresion');
  if (area) area.innerHTML = '';
}

/**
 * IMPRIMIR LA PANTALLA EN HOJA CARTA  (v2.9)
 *
 * Lo de arriba es para la térmica: esconde la pantalla y saca el ticket.
 * Esto es al revés — un reporte se imprime en la impresora de hojas y lo
 * que hay que sacar es la pantalla—, así que se marca el <body> para que
 * el CSS cambie de modo, se imprime, y se desmarca al terminar.
 *
 * `window.print()` es bloqueante en los navegadores de escritorio, pero
 * `afterprint` es lo único que garantiza que la clase se quita también si
 * el usuario cancela el cuadro de impresión.
 */
export function imprimirHoja() {
  document.body.classList.add('imprimir-hoja');
  const limpiar = () => {
    document.body.classList.remove('imprimir-hoja');
    window.removeEventListener('afterprint', limpiar);
  };
  window.addEventListener('afterprint', limpiar);
  window.print();
  // Red de seguridad: si el navegador no manda afterprint (pasa en algunos
  // móviles), la clase se quita sola al poco rato.
  setTimeout(limpiar, 1500);
}
