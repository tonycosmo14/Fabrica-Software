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
