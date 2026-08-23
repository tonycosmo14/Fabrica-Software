/**
 * PRODUCTOS Y PRECIOS  (v0.10)
 *
 * Lo que se ve en los botones de la caja se da de alta aquí, sin tocar el
 * programa. Solo el administrador.
 *
 * Dos clases de producto, y la diferencia importa:
 *
 *   HIELO   El botón entrega una fracción de marqueta. NO tiene precio
 *           propio: lo saca de la lista de precios de abajo. Si tuviera
 *           precio propio, un día los dos números dirían cosas distintas y
 *           nadie sabría cuál es el bueno.
 *
 *   NORMAL  Un refresco, un garrafón, una bolsa. Tiene su precio y no
 *           descuenta hielo del cuarto frío.
 */
import { api } from '../api.js';
import { esc, avisar } from '../util.js';
import { pedirTexto, pedirImporte, confirmar, menu } from '../dialogo.js';
import { aTexto, pesos } from '../fracciones.js';

const FRACCIONES = [
  { d: 16, etiqueta: 'Una marqueta' },
  { d: 8,  etiqueta: '1/2' },
  { d: 4,  etiqueta: '1/4' },
  { d: 2,  etiqueta: '1/8' },
  { d: 1,  etiqueta: '1/16' }
];

export async function vistaProductos(pantalla) {
  let catalogo, listas, impresion;

  await cargar();

  async function cargar() {
    [catalogo, listas, impresion] = await Promise.all([
      api.obtener('/catalogo'),
      api.obtener('/ventas/precios/listas'),
      api.obtener('/impresion/config').then((r) => r.impresion).catch(() => null)
    ]);
    pintar();
  }

  function tarifa() {
    const lista = listas.listas.find((l) => l.activa) || listas.listas[0];
    return new Map((lista?.precios || []).map((p) => [p.dieciseisavos, p.centavos]));
  }

  function precioDeHielo(dieciseisavos) {
    const t = tarifa();
    let queda = dieciseisavos, centavos = 0;
    for (const paso of [16, 8, 4, 2, 1]) {
      while (queda >= paso) { centavos += t.get(paso) ?? 0; queda -= paso; }
    }
    return centavos;
  }

  function pintar() {
    pantalla.innerHTML = `
      <h2>Productos y precios</h2>
      <p class="ayuda">
        Lo que aparece en los botones de la caja. Los productos de
        <strong>hielo</strong> toman su precio de la lista de abajo; los demás
        tienen el suyo.
      </p>

      <div class="cols-anchas">
        <section>
          <h3>Categorías y productos</h3>
          ${catalogo.categorias.map((c) => tarjetaCategoria(c)).join('')
            || '<p class="vacio">No hay categorías todavía.</p>'}
          <button id="nueva-cat" style="margin-top:12px">＋ Nueva categoría</button>
        </section>

        <section>
          <h3>Precio de cada fracción</h3>
          ${listas.listas.map((l) => tarjetaLista(l)).join('')}

          ${impresion ? tarjetaImpresora() : ''}

          <details class="ayuda-bloque" style="margin-top:14px">
            <summary>¿Por qué no se divide el precio de la marqueta?</summary>
            <div class="ayuda-cuerpo">
              <p>Porque cortar da trabajo. Si la marqueta vale $264, el 1/16
              proporcional serían $16.50, pero se cobra $18.</p>
              <p>Para cobrar una cantidad, el sistema la parte en los pedazos
              más grandes y suma:</p>
              <pre class="ayuda-formula">3/8  →  1/4 + 1/8  →  $70 + $36  =  $106.00</pre>
              <p>Como siempre parte igual, da lo mismo cómo se teclee.
              <b>Los tickets ya cobrados no cambian</b> si subes un precio.</p>
            </div>
          </details>
        </section>
      </div>`;

    pantalla.querySelector('#nueva-cat').onclick = nuevaCategoria;

    pantalla.querySelectorAll('[data-cat-menu]').forEach((b) => {
      b.onclick = () => menuCategoria(
        catalogo.categorias.find((c) => c.id === b.dataset.catMenu));
    });
    pantalla.querySelectorAll('[data-nuevo-prod]').forEach((b) => {
      b.onclick = () => editarProducto(null, b.dataset.nuevoProd);
    });
    pantalla.querySelectorAll('[data-prod]').forEach((b) => {
      b.onclick = () => editarProducto(
        catalogo.productos.find((p) => p.id === b.dataset.prod));
    });
    pantalla.querySelectorAll('[data-guardar-precios]').forEach((b) => {
      b.onclick = () => guardarPrecios(b.dataset.guardarPrecios);
    });
    pantalla.querySelectorAll('[data-sugerir]').forEach((b) => {
      b.onclick = () => sugerir(b.dataset.sugerir);
    });

    if (impresion) {
      pantalla.querySelector('#guardar-impresora').onclick = guardarImpresora;
      pantalla.querySelector('#probar-impresora').onclick = probarImpresora;
    }
  }

  // ==========================================================
  // LA IMPRESORA
  // ==========================================================
  function tarjetaImpresora() {
    const i = impresion;
    return `
      <h3>Impresora de tickets</h3>
      <div class="tarjeta" id="tarjeta-impresora">
        <p class="ayuda" style="margin:0 0 14px">
          Con el nombre puesto, el ticket sale <strong>al instante</strong>,
          sin que se asome la ventana de impresión. Sin nombre, imprime el
          navegador y aparece el cuadro de siempre.
        </p>

        <label class="etiqueta-chica" for="imp-destino">Nombre compartido de la impresora</label>
        <input id="imp-destino" autocomplete="off" placeholder="\\localhost\TICKET"
               value="${esc(i.destino)}">

        <div class="rejilla-config">
          <label>
            <span class="etiqueta-chica">Ancho del papel</span>
            <select id="imp-ancho">
              <option value="80" ${i.anchoMm === 80 ? 'selected' : ''}>80 mm</option>
              <option value="58" ${i.anchoMm === 58 ? 'selected' : ''}>58 mm</option>
            </select>
          </label>
          <label>
            <span class="etiqueta-chica">Copias por venta</span>
            <input id="imp-copias" inputmode="numeric" value="${i.copias}">
          </label>
        </div>

        <label class="etiqueta-chica" for="imp-pie">Renglón al pie (opcional)</label>
        <input id="imp-pie" autocomplete="off" placeholder="Tel. 999 000 0000"
               value="${esc(i.pie)}">

        <div class="fila-botones" style="margin-top:14px">
          <button class="secundario" id="probar-impresora">Imprimir una prueba</button>
          <button id="guardar-impresora">Guardar</button>
        </div>

        <details class="ayuda-bloque" style="margin-top:14px">
          <summary>¿De dónde saco ese nombre?</summary>
          <div class="ayuda-cuerpo">
            <p>Hay que <b>compartir la impresora</b> una vez en Windows. No es
            para que la usen otras computadoras: es para que Windows le dé un
            nombre al que se le puede escribir directo, saltándose el motor de
            impresión que es el que hace aparecer la ventana.</p>
            <ol class="instrucciones">
              <li>Panel de control → <b>Dispositivos e impresoras</b>.</li>
              <li>Clic derecho en la térmica → <b>Propiedades de impresora</b>.</li>
              <li>Pestaña <b>Compartir</b> → marcar <em>Compartir esta impresora</em>.</li>
              <li>Ponle un nombre <b>corto y sin espacios</b>, por ejemplo <code>TICKET</code>.</li>
              <li>Aquí escribe <code>\\localhost\TICKET</code> y dale a probar.</li>
            </ol>
            <p class="ayuda-tip">Si sale con cuadritos en vez de acentos, la
            impresora usa otra tabla de caracteres. Avísame y la cambio: es un
            número.</p>
          </div>
        </details>
      </div>`;
  }

  function datosImpresora() {
    return {
      destino: pantalla.querySelector('#imp-destino').value.trim(),
      anchoMm: Number(pantalla.querySelector('#imp-ancho').value),
      copias: Number(pantalla.querySelector('#imp-copias').value.replace(/[^0-9]/g, '')) || 1,
      pie: pantalla.querySelector('#imp-pie').value.trim()
    };
  }

  async function guardarImpresora() {
    try {
      const r = await api.actualizar('/impresion/config', datosImpresora());
      impresion = r.impresion;
      avisar('Impresora guardada', 'bien');
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function probarImpresora() {
    try {
      // Se guarda primero: probar con lo que está escrito en pantalla, no
      // con lo que había antes.
      const r = await api.actualizar('/impresion/config', datosImpresora());
      impresion = r.impresion;
      await api.enviar('/impresion/prueba', {});
      avisar('Salió la prueba. Revisa el papel.', 'bien');
    } catch (e) { avisar(e.message, 'error'); }
  }

  function tarjetaCategoria(c) {
    const suyos = catalogo.productos.filter((p) => p.categoria_id === c.id);
    return `
      <div class="tarjeta" data-lista="${esc(c.id)}">
        <div class="existencia-cabeza">
          <div>
            <strong>
              <span class="punto-color" style="background:${esc(c.color || '#8aa')}"></span>
              ${esc(c.nombre)}
            </strong>
            <small>${suyos.length} producto${suyos.length === 1 ? '' : 's'}</small>
          </div>
          <button class="chico secundario" data-cat-menu="${esc(c.id)}">Editar</button>
        </div>

        ${suyos.map((p) => `
          <div class="item" data-prod="${esc(p.id)}" style="cursor:pointer">
            <div class="crece">
              <strong>${esc(p.nombre)}</strong>
              <small>
                ${p.codigo ? `código <b>${esc(p.codigo)}</b> · ` : ''}
                ${p.tipo === 'hielo'
                  ? `${p.dieciseisavos === 16 ? 'una marqueta' : esc(aTexto(p.dieciseisavos)) + ' de marqueta'} · ${pesos(precioDeHielo(p.dieciseisavos))}`
                  : pesos(p.precio_centavos)}
              </small>
            </div>
          </div>`).join('')}

        <button class="secundario chico" data-nuevo-prod="${esc(c.id)}" style="margin-top:10px">
          ＋ Producto en ${esc(c.nombre)}
        </button>
      </div>`;
  }

  function tarjetaLista(l) {
    return `
      <div class="tarjeta" data-lista-precios="${esc(l.id)}">
        <div class="existencia-cabeza">
          <div>
            <strong>${esc(l.nombre)}</strong>
            <small>${l.activa ? 'Es la que se está cobrando' : 'Guardada, sin usar'}</small>
          </div>
        </div>

        <div class="precios-rejilla">
          ${FRACCIONES.map((f) => {
            const p = l.precios.find((x) => x.dieciseisavos === f.d);
            return `
              <label class="precio-celda">
                <span>${esc(f.d === 16 ? '1' : aTexto(f.d))}</span>
                <input inputmode="decimal" data-precio="${f.d}"
                       value="${((p?.centavos ?? 0) / 100).toFixed(2)}">
              </label>`;
          }).join('')}
        </div>

        <div class="fila-botones" style="margin-top:14px">
          <button class="secundario" data-sugerir="${esc(l.id)}">Sugerir proporcional</button>
          <button data-guardar-precios="${esc(l.id)}">Guardar precios</button>
        </div>
      </div>`;
  }

  // ==========================================================
  // CATEGORÍAS
  // ==========================================================
  async function nuevaCategoria() {
    const nombre = await pedirTexto({
      titulo: 'Nueva categoría',
      texto: 'Como una carpeta: Hielo, Refrescos, Agua…',
      marcador: 'Refrescos', ok: 'Crear', largo: 40
    });
    if (!nombre) return;
    try {
      await api.enviar('/catalogo/categorias', { nombre });
      avisar('Categoría creada', 'bien');
      cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function menuCategoria(c) {
    const que = await menu({
      titulo: c.nombre,
      opciones: [
        { valor: 'nombre', texto: 'Cambiar el nombre' },
        { valor: 'color', texto: 'Cambiar el color', detalle: 'El color del botón en la caja' },
        { valor: 'baja', texto: 'Dar de baja', detalle: 'Se lleva sus productos', peligro: true }
      ]
    });
    if (!que) return;

    if (que === 'nombre') {
      const nombre = await pedirTexto({
        titulo: 'Nombre de la categoría', valor: c.nombre, ok: 'Guardar', largo: 40
      });
      if (!nombre) return;
      return guardarCategoria(c, { nombre });
    }

    if (que === 'color') {
      const color = await pedirTexto({
        titulo: 'Color del botón',
        texto: 'Escribe el color en formato #rrggbb. Por ejemplo #29abe2 para el azul de la marca.',
        valor: c.color || '#29abe2', ok: 'Guardar', largo: 7
      });
      if (!color) return;
      if (!/^#[0-9a-fA-F]{6}$/.test(color.trim())) {
        avisar('El color se escribe así: #29abe2', 'error');
        return;
      }
      return guardarCategoria(c, { color: color.trim() });
    }

    const suyos = catalogo.productos.filter((p) => p.categoria_id === c.id).length;
    if (!await confirmar({
      titulo: `¿Dar de baja ${c.nombre}?`,
      texto: suyos
        ? `Se dan de baja también sus ${suyos} producto${suyos === 1 ? '' : 's'}. No se borra nada: los tickets viejos siguen igual.`
        : 'No se borra nada: los tickets viejos siguen igual.',
      ok: 'Dar de baja', peligro: true
    })) return;

    try {
      await api.enviar(`/catalogo/categorias/${c.id}/baja`, {});
      avisar('Categoría dada de baja', 'bien');
      cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function guardarCategoria(c, cambios) {
    try {
      await api.actualizar(`/catalogo/categorias/${c.id}`, cambios);
      avisar('Guardado', 'bien');
      cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  // ==========================================================
  // PRODUCTOS
  // ==========================================================
  async function editarProducto(p, categoriaId) {
    const esNuevo = !p;

    if (!esNuevo) {
      const que = await menu({
        titulo: p.nombre,
        opciones: [
          { valor: 'editar', texto: 'Editar' },
          { valor: 'baja', texto: 'Dar de baja', peligro: true }
        ]
      });
      if (!que) return;
      if (que === 'baja') {
        if (!await confirmar({
          titulo: `¿Dar de baja ${p.nombre}?`,
          texto: 'Deja de aparecer en la caja. Los tickets viejos no cambian.',
          ok: 'Dar de baja', peligro: true
        })) return;
        try {
          await api.enviar(`/catalogo/productos/${p.id}/baja`, {});
          avisar('Producto dado de baja', 'bien');
          cargar();
        } catch (e) { avisar(e.message, 'error'); }
        return;
      }
    }

    const tipo = esNuevo
      ? await menu({
          titulo: 'Nuevo producto',
          texto: '¿Qué clase de producto es?',
          opciones: [
            { valor: 'simple', texto: 'Normal', detalle: 'Un refresco, un garrafón, una bolsa. Tiene su propio precio.' },
            { valor: 'hielo', texto: 'Hielo', detalle: 'Entrega una fracción de marqueta y toma su precio de la lista.' }
          ]
        })
      : p.tipo;
    if (!tipo) return;

    const nombre = await pedirTexto({
      titulo: esNuevo ? 'Nombre del producto' : `Editar ${p.nombre}`,
      texto: 'Como se va a leer en el botón y en el ticket.',
      valor: p?.nombre || '', marcador: tipo === 'hielo' ? '1/4' : 'Coca Cola 600 ml',
      ok: 'Siguiente', largo: 40
    });
    if (!nombre) return;

    const cuerpo = { nombre, tipo, categoriaId: categoriaId || p.categoria_id };

    if (tipo === 'hielo') {
      const d = await menu({
        titulo: '¿Cuánto hielo entrega?',
        texto: 'El botón suma esta cantidad al ticket.',
        opciones: FRACCIONES.map((f) => ({ valor: String(f.d), texto: f.etiqueta }))
      });
      if (!d) return;
      cuerpo.dieciseisavos = Number(d);
    } else {
      const precio = await pedirImporte({
        titulo: `Precio de ${nombre}`, texto: '¿Cuánto cuesta?',
        valor: p?.precio_centavos != null ? (p.precio_centavos / 100).toFixed(2) : '',
        marcador: '25.00', ok: 'Siguiente'
      });
      if (!precio) return;
      cuerpo.precio = precio;
    }

    const codigo = await pedirTexto({
      titulo: 'Código para teclear',
      texto: 'Lo que el cajero teclea para agregarlo sin buscar el botón. Puede quedar vacío.',
      valor: p?.codigo || '', marcador: tipo === 'hielo' ? '14' : 'COCA',
      ok: esNuevo ? 'Crear el producto' : 'Guardar', largo: 12
    });
    // Aquí el vacío es una respuesta válida: "este producto no lleva código".
    cuerpo.codigo = codigo === null ? (p?.codigo || '') : codigo;

    try {
      if (esNuevo) await api.enviar('/catalogo/productos', cuerpo);
      else await api.actualizar(`/catalogo/productos/${p.id}`, cuerpo);
      avisar(esNuevo ? 'Producto creado' : 'Guardado', 'bien');
      cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  // ==========================================================
  // PRECIOS
  // ==========================================================
  async function guardarPrecios(listaId) {
    const tarjeta = pantalla.querySelector(`[data-lista-precios="${listaId}"]`);
    const precios = [...tarjeta.querySelectorAll('[data-precio]')].map((c) => ({
      dieciseisavos: Number(c.dataset.precio),
      pesos: Number(c.value.replace(/[^0-9.]/g, '')) || 0
    }));
    try {
      await api.actualizar(`/ventas/precios/${listaId}`, { precios });
      avisar('Precios guardados', 'bien');
      cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function sugerir(listaId) {
    const tarjeta = pantalla.querySelector(`[data-lista-precios="${listaId}"]`);
    const marqueta = Number(tarjeta.querySelector('[data-precio="16"]').value.replace(/[^0-9.]/g, ''));
    if (!marqueta) { avisar('Pon primero el precio de la marqueta', 'error'); return; }

    try {
      const { sugerencias } = await api.obtener(`/ventas/precios/sugerencia?marqueta=${marqueta}`);
      for (const s of sugerencias) {
        const campo = tarjeta.querySelector(`[data-precio="${s.dieciseisavos}"]`);
        if (campo) campo.value = (s.centavos / 100).toFixed(2);
      }
      avisar('Es solo la parte proporcional. Súbelos si el corte da trabajo.', '');
    } catch (e) { avisar(e.message, 'error'); }
  }
}
