/**
 * GRÁFICAS  (v2.9)
 *
 * SVG escrito a mano. El proyecto no tiene dependencias ni paso de
 * compilación —se actualiza copiando archivos, como un plugin— y meter una
 * librería de gráficas por tres dibujos costaría medio megabyte y una cosa
 * más que puede romperse en una actualización.
 *
 * SVG además resuelve solo las tres cosas que importan aquí:
 *   · se estira al ancho que haya (viewBox), así que sirve igual en la
 *     laptop, en el monitor ancho y en el celular;
 *   · se imprime nítido en la hoja carta, porque no es una imagen de
 *     píxeles sino un dibujo;
 *   · toma los colores del tema con currentColor y las variables del CSS,
 *     así que el modo oscuro no necesita otro dibujo.
 *
 * NINGUNA GRÁFICA LLEVA ANIMACIÓN NI EFECTOS AL PASAR EL RATÓN. Esto se
 * imprime y se mira de reojo; lo que no se ve en papel, no se pone.
 */

/** Escapa texto que va dentro del SVG. */
function esc(t) {
  return String(t ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Redondea a 2 decimales: un SVG lleno de 17.333333333 pesa el doble. */
const r2 = (n) => Math.round(n * 100) / 100;

/**
 * BARRAS DE PIE, una por día del mes.
 *
 * @param datos  [{ etiqueta, valor, resaltar?, titulo? }]
 * @param alto   alto del dibujo en unidades del viewBox
 * @param formato  cómo se escribe el valor en el título emergente
 */
export function barras(datos = [], { alto = 120, formato = (n) => n,
                                     cadaCuantas = 1, color = 'var(--acento)' } = {}) {
  if (!datos.length) return '<p class="vacio">No hay nada que dibujar todavía.</p>';

  const tope = Math.max(...datos.map((d) => d.valor), 0);
  const ancho = 100;                       // el viewBox siempre mide 100 de ancho
  const paso = ancho / datos.length;
  const hueco = Math.min(paso * 0.22, 0.9);
  const anchoBarra = Math.max(paso - hueco, 0.6);
  const altoUtil = alto;                   // las etiquetas van fuera del dibujo

  // Sin ningún valor, se dibuja la línea de piso y ya: una gráfica vacía
  // que dice "no hubo nada" es más honesta que no dibujar nada.
  const barra = (d, i) => {
    const h = tope > 0 ? (d.valor / tope) * altoUtil : 0;
    const x = i * paso + hueco / 2;
    return `<rect x="${r2(x)}" y="${r2(altoUtil - h)}" width="${r2(anchoBarra)}"
                  height="${r2(Math.max(h, d.valor > 0 ? 0.4 : 0))}" rx="0.3"
                  class="g-barra ${d.resaltar ? 'g-resaltada' : ''}"
            ><title>${esc(d.titulo || `${d.etiqueta}: ${formato(d.valor)}`)}</title></rect>`;
  };

  // LAS ETIQUETAS VAN EN HTML, NO DENTRO DEL SVG.
  //
  // El dibujo se estira al ancho que haya (preserveAspectRatio="none"), y
  // eso es justo lo que hace que las barras llenen la pantalla… pero
  // estira también las letras: en un monitor ancho los números salían
  // aplastados y en el celular apretujados. Fuera del SVG cada número se
  // dibuja con la letra del sistema, del tamaño que le toca, siempre.
  //
  // Se saltan de tantas en tantas porque treinta y un números pegados no
  // se leen ni en pantalla ni en papel.
  const etiquetas = datos.map((d, i) => `
    <span class="g-marca" style="flex:${r2(paso)}">${
      i % cadaCuantas ? '' : esc(d.etiqueta)}</span>`).join('');

  return `
    <svg class="grafica" viewBox="0 0 ${ancho} ${alto}" preserveAspectRatio="none"
         role="img" style="--g-color:${color}">
      <line x1="0" y1="${altoUtil}" x2="${ancho}" y2="${altoUtil}" class="g-piso"/>
      ${datos.map(barra).join('')}
    </svg>
    <div class="g-marcas" aria-hidden="true">${etiquetas}</div>`;
}

/**
 * BARRAS ACOSTADAS, para "en qué se fue el dinero".
 *
 * Acostadas y no un pastel: en un pastel de ocho rebanadas nadie sabe si
 * la de 11% es más grande que la de 13%, y aquí la pregunta es
 * exactamente esa. Acostadas se comparan de un vistazo y además cabe el
 * nombre completo del concepto, que en un pastel no cabe nunca.
 */
export function barrasAcostadas(datos = [], { formato = (n) => n } = {}) {
  if (!datos.length) return '<p class="vacio">No hubo gastos en este mes.</p>';

  const tope = Math.max(...datos.map((d) => d.valor), 1);
  const total = datos.reduce((n, d) => n + d.valor, 0);

  return `
    <div class="g-acostadas">
      ${datos.map((d) => `
        <div class="g-fila">
          <span class="g-nombre" title="${esc(d.etiqueta)}">${esc(d.etiqueta)}</span>
          <span class="g-riel">
            <span class="g-relleno" style="width:${r2((d.valor / tope) * 100)}%"></span>
          </span>
          <span class="g-valor">${esc(formato(d.valor))}</span>
          <span class="g-porciento">${total ? Math.round((d.valor / total) * 100) : 0}%</span>
        </div>`).join('')}
    </div>`;
}

/**
 * UNA LÍNEA EN EL TIEMPO, para la tendencia de los meses.
 *
 * Línea y no barras porque aquí la pregunta no es "¿cuánto en agosto?"
 * sino "¿va subiendo?": lo que se lee es la inclinación, y eso lo dice una
 * línea. Cada mes lleva su marca porque son meses contados, no una
 * medición continua, y el último va más alto: es el que se está viviendo.
 *
 * Las marcas son rayitas y no puntos redondos por una razón boba pero
 * real: el dibujo se estira al ancho de la pantalla, y un círculo estirado
 * sale ovalado. Una rayita vertical con el grosor fijado por el navegador
 * (vector-effect) se ve igual de bien en el celular que en el monitor
 * ancho.
 */
export function linea(datos = [], { alto = 110, formato = (n) => n,
                                    color = 'var(--acento)' } = {}) {
  const validos = datos.filter((d) => d.valor != null);
  if (validos.length < 2) {
    return '<p class="vacio">Hacen falta al menos dos meses para ver una tendencia.</p>';
  }

  const ancho = 100;
  const tope = Math.max(...validos.map((d) => d.valor));
  const piso = Math.min(...validos.map((d) => d.valor));
  // El eje NO empieza en cero a propósito, y por eso la pantalla lo dice
  // debajo: con valores de 3,300 a 3,500 un eje desde cero dibujaría una
  // raya plana y escondería justo el cambio que hay que ver.
  const rango = tope - piso || 1;
  const altoUtil = alto - 4;
  const paso = datos.length > 1 ? ancho / (datos.length - 1) : ancho;

  const y = (v) => r2(altoUtil - ((v - piso) / rango) * (altoUtil - 6) - 3);
  const puntos = datos.map((d, i) => (d.valor == null ? null
    : { x: r2(i * paso), y: y(d.valor), d, i })).filter(Boolean);

  const camino = puntos.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');

  return `
    <svg class="grafica grafica-linea" viewBox="0 0 ${ancho} ${alto}"
         preserveAspectRatio="none" role="img" style="--g-color:${color}">
      <path d="${camino}" class="g-linea" vector-effect="non-scaling-stroke"/>
      ${puntos.map((p, i) => {
        const largo = i === puntos.length - 1 ? 5 : 2.5;
        return `<line x1="${p.x}" y1="${r2(p.y - largo / 2)}"
                      x2="${p.x}" y2="${r2(p.y + largo / 2)}"
                      class="g-punto ${i === puntos.length - 1 ? 'g-ultimo' : ''}"
                      vector-effect="non-scaling-stroke"
                ><title>${esc(p.d.etiqueta)}: ${esc(formato(p.d.valor))}</title></line>`;
      }).join('')}
    </svg>
    <div class="g-marcas" aria-hidden="true">${
      datos.map((d) => `<span class="g-marca">${esc(d.etiqueta)}</span>`).join('')}</div>`;
}
