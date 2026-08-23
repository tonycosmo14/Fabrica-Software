/**
 * PRODUCTOS, PRECIOS E INVENTARIO  (v0.13)
 *
 * Se usa casi siempre en la PC, así que aprovecha el ancho y NO SE
 * DESPLAZA: a la izquierda las categorías, en medio los productos, a la
 * derecha lo que se está editando. Solo la lista de productos se mueve.
 *
 * EL HIELO VA APARTE, arriba del todo. No es un producto más: es el 80% del
 * negocio, sus precios se forman de otra manera y su inventario es la
 * Existencia del cuarto frío, que se cuenta dos veces al día. Meterlo en la
 * misma lista que los refrescos lo escondería.
 */
import { api } from '../api.js';
import { esc, avisar, fecha as formatoFecha } from '../util.js';
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
  let catalogo, listas, impresion, inventario;
  let categoriaAbierta = null;
  let seleccionado = null;       // el producto que se está viendo a la derecha
  let panel = 'nada';            // nada | producto | hielo | impresora

  await cargar();

  async function cargar({ conservarPanel = true } = {}) {
    [catalogo, listas, impresion, inventario] = await Promise.all([
      api.obtener('/catalogo'),
      api.obtener('/ventas/precios/listas'),
      api.obtener('/impresion/config').then((r) => r.impresion).catch(() => null),
      api.obtener('/inventario').catch(() => ({ inventario: [], bajos: 0 }))
    ]);

    // El hielo tiene su propio panel arriba, así que no cuenta como una
    // categoría más de la lista: la columna del centro arranca en la
    // primera que NO sea el hielo.
    const normales = catalogo.categorias.filter((c) => c.id !== 'cat-hielo');
    if (!categoriaAbierta || !normales.some((c) => c.id === categoriaAbierta)) {
      categoriaAbierta = normales[0]?.id || null;
    }
    if (seleccionado) {
      seleccionado = catalogo.productos.find((p) => p.id === seleccionado.id) || null;
      if (!seleccionado && conservarPanel) panel = 'nada';
    }
    pintar();
  }

  // ==========================================================
  // PRECIOS DEL HIELO
  // ==========================================================
  function listaActiva() {
    return listas.listas.find((l) => l.activa) || listas.listas[0];
  }

  function precioDeHielo(dieciseisavos) {
    const t = new Map((listaActiva()?.precios || []).map((p) => [p.dieciseisavos, p.centavos]));
    let queda = dieciseisavos, centavos = 0;
    for (const paso of [16, 8, 4, 2, 1]) {
      while (queda >= paso) { centavos += t.get(paso) ?? 0; queda -= paso; }
    }
    return centavos;
  }

  function estadoDe(productoId) {
    return inventario.inventario.find((i) => i.producto.id === productoId) || null;
  }

  // ==========================================================
  // LA PANTALLA
  // ==========================================================
  function pintar() {
    const cat = catalogo.categorias.find((c) => c.id === categoriaAbierta);
    const suyos = catalogo.productos.filter((p) => p.categoria_id === categoriaAbierta);

    pantalla.innerHTML = `
      <div class="cfg">
        <div class="cfg-cabeza">
          <h2>Productos y precios</h2>
          <div class="cfg-cabeza-acciones">
            ${inventario.bajos
              ? `<span class="etiqueta-mal">${inventario.bajos} por pedir</span>` : ''}
            <button class="secundario chico" id="hoja-inventario">🖨️ Hoja para contar</button>
            <button class="secundario chico" id="ver-impresora">Impresora</button>
          </div>
        </div>

        <div class="cfg-tablero">
          <aside class="cfg-columna">
            <button class="cfg-hielo ${panel === 'hielo' ? 'activo' : ''}" id="ver-hielo">
              <strong>🧊 Hielo</strong>
              <small>precios por fracción</small>
            </button>

            <p class="cfg-titulo">Categorías</p>
            <div class="cfg-lista">
              ${catalogo.categorias.filter((c) => c.id !== 'cat-hielo').map((c) => `
                <button class="cfg-item ${c.id === categoriaAbierta ? 'activo' : ''}"
                        data-categoria="${esc(c.id)}">
                  <span class="punto-color" style="background:${esc(c.color || '#8aa')}"></span>
                  <span class="crece">${esc(c.nombre)}</span>
                  <small>${catalogo.productos.filter((p) => p.categoria_id === c.id).length}</small>
                </button>`).join('')}
            </div>
            <button class="secundario chico" id="nueva-cat">＋ Categoría</button>
          </aside>

          <section class="cfg-columna">
            <p class="cfg-titulo">
              ${esc(cat?.nombre || 'Productos')}
              ${cat && cat.id !== 'cat-hielo'
                ? `<button class="enlace" data-editar-cat="${esc(cat.id)}">editar</button>` : ''}
            </p>
            <div class="cfg-lista cfg-productos">
              ${suyos.map((p) => fila(p)).join('')
                || '<p class="vacio" style="padding:24px 0">Sin productos aquí.</p>'}
            </div>
            ${cat ? `<button class="secundario chico" id="nuevo-prod">＋ Producto</button>` : ''}
          </section>

          <section class="cfg-columna cfg-detalle">
            ${panel === 'hielo' ? panelHielo()
              : panel === 'impresora' ? panelImpresora()
              : panel === 'producto' && seleccionado ? panelProducto(seleccionado)
              : `<p class="vacio" style="padding:40px 0">
                   Toca un producto para verlo aquí.
                 </p>`}
          </section>
        </div>
      </div>`;

    enganchar();
  }

  function fila(p) {
    const inv = estadoDe(p.id);
    return `
      <button class="cfg-item cfg-producto ${seleccionado?.id === p.id ? 'activo' : ''}"
              data-prod="${esc(p.id)}">
        ${p.foto
          ? `<img class="cfg-foto" src="/fotos/${esc(p.foto)}" alt="">`
          : '<span class="cfg-foto cfg-foto-vacia">📦</span>'}
        <span class="crece">
          <strong>${esc(p.nombre)}</strong>
          <small>
            ${p.codigo ? `<b>${esc(p.codigo)}</b> · ` : ''}
            ${p.tipo === 'hielo'
              ? esc(p.dieciseisavos === 16 ? 'una marqueta' : aTexto(p.dieciseisavos))
              : pesos(p.precio_centavos)}
          </small>
        </span>
        ${inv ? `<small class="cfg-stock ${inv.bajo ? 'bajo' : ''}">${inv.esperado}</small>` : ''}
      </button>`;
  }

  // ==========================================================
  // PANEL: UN PRODUCTO
  // ==========================================================
  function panelProducto(p) {
    const inv = estadoDe(p.id);
    const ganancia = p.costo_centavos != null && p.precio_centavos != null
      ? p.precio_centavos - p.costo_centavos : null;

    return `
      <div class="cfg-detalle-cabeza">
        <div class="cfg-foto-grande">
          ${p.foto
            ? `<img src="/fotos/${esc(p.foto)}" alt="">
               <button class="tachita" id="quitar-foto" aria-label="Quitar la foto">×</button>`
            : '<span class="cfg-foto-vacia grande">📦</span>'}
        </div>
        <div class="crece">
          <h3 style="margin:0">${esc(p.nombre)}</h3>
          <p class="ayuda" style="margin:4px 0 0">
            ${p.codigo ? `Código <b>${esc(p.codigo)}</b>` : 'Sin código'}
          </p>
          <label class="subir chico" style="margin-top:10px">
            ${p.foto ? 'Cambiar foto' : '＋ Poner foto'}
            <input type="file" id="foto" accept="image/png,image/jpeg,image/webp" hidden>
          </label>
        </div>
      </div>

      <div class="cuadre">
        <div class="cuadre-linea">
          <span>Se vende en</span>
          <strong>${p.tipo === 'hielo'
            ? esc(p.dieciseisavos === 16 ? 'una marqueta' : aTexto(p.dieciseisavos) + ' de marqueta')
            : pesos(p.precio_centavos)}</strong>
        </div>
        ${p.tipo === 'hielo' ? `
          <div class="cuadre-linea">
            <span>Cuesta hoy</span><strong>${pesos(precioDeHielo(p.dieciseisavos))}</strong>
          </div>` : `
          <div class="cuadre-linea">
            <span>Costó</span>
            <strong>${p.costo_centavos != null ? pesos(p.costo_centavos) : '—'}</strong>
          </div>
          ${ganancia != null ? `
            <div class="cuadre-linea total">
              <span>Ganancia por pieza</span>
              <strong class="${ganancia < 0 ? 'malo' : ''}">${pesos(ganancia)}</strong>
            </div>` : ''}`}
      </div>

      <div class="fila-botones" style="margin-top:14px;flex-wrap:wrap">
        <button class="secundario chico" id="editar-prod">Editar</button>
        <button class="secundario chico peligro" id="baja-prod">Dar de baja</button>
      </div>

      ${p.tipo === 'hielo' ? `
        <p class="ayuda" style="margin-top:16px">
          El hielo no lleva inventario de piezas: se mide en marquetas y su
          control es la <strong>Existencia</strong> del cuarto frío, que se
          cuenta dos veces al día.
        </p>` : panelInventario(p, inv)}`;
  }

  function panelInventario(p, inv) {
    if (!p.lleva_inventario) {
      return `
        <h4 class="cfg-subtitulo">Inventario</h4>
        <p class="ayuda">
          Este producto no lleva cuenta de piezas. Actívalo si quieres que el
          sistema te avise cuando haya que pedir más.
        </p>
        <button class="secundario chico" id="activar-inv">Llevar inventario</button>`;
    }

    return `
      <h4 class="cfg-subtitulo">Inventario</h4>
      <div class="cuadre">
        <div class="cuadre-linea">
          <span>Había en el último conteo</span><strong>${inv?.anterior ?? 0}</strong>
        </div>
        <div class="cuadre-linea suma">
          <span>+ Entró</span><strong>${inv?.entradas ?? 0}</strong>
        </div>
        <div class="cuadre-linea vendido">
          <span>− Se vendió</span><strong>${inv?.vendido ?? 0}</strong>
        </div>
        ${inv?.salidas ? `
          <div class="cuadre-linea vendido">
            <span>− Otras salidas</span><strong>${inv.salidas}</strong>
          </div>` : ''}
        <div class="cuadre-linea total">
          <span>= Debería haber</span>
          <strong class="${inv?.bajo ? 'malo' : ''}">${inv?.esperado ?? 0}</strong>
        </div>
        ${p.minimo != null ? `
          <div class="cuadre-linea">
            <span>Avisar cuando baje de</span><strong>${p.minimo}</strong>
          </div>` : ''}
      </div>

      ${inv?.bajo ? `
        <div class="aviso-sin-caja" style="margin-top:12px">
          <strong>Ya hay que pedir más.</strong>
          Quedan ${inv.esperado} y el aviso está en ${p.minimo}.
        </div>` : ''}

      <div class="fila-botones" style="margin-top:14px;flex-wrap:wrap">
        <button class="pos-btn-entrada chico" id="inv-entrada">＋ Llegó mercancía</button>
        <button class="pos-btn-salida chico" id="inv-salida">− Salida</button>
        <button class="chico" id="inv-conteo">📋 Contar</button>
      </div>

      ${inv?.ultimoConteo ? `
        <p class="ayuda" style="margin-top:12px">
          Último conteo: ${esc(formatoFecha(inv.ultimoConteo.fecha))}
          · ${esc(inv.ultimoConteo.concepto || '')}
        </p>` : ''}`;
  }

  // ==========================================================
  // PANEL: EL HIELO
  // ==========================================================
  function panelHielo() {
    const l = listaActiva();
    if (!l) return '<p class="vacio">No hay lista de precios.</p>';

    return `
      <h3 style="margin:0 0 4px">🧊 Precios del hielo</h3>
      <p class="ayuda">
        Cada fracción tiene su propio precio; no se saca dividiendo el de la
        marqueta, porque cortar da trabajo.
      </p>

      <div class="precios-rejilla" data-lista-precios="${esc(l.id)}">
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
        <button class="secundario" id="sugerir">Sugerir proporcional</button>
        <button id="guardar-precios">Guardar precios</button>
      </div>

      <pre class="ayuda-formula" style="margin-top:16px">3/8  →  1/4 + 1/8  →  ${
        pesos(precioDeHielo(4))} + ${pesos(precioDeHielo(2))}  =  ${pesos(precioDeHielo(6))}</pre>

      <p class="ayuda">
        Como el sistema parte igual siempre, da lo mismo cómo se teclee.
        <strong>Los tickets ya cobrados no cambian</strong> si subes un precio.
      </p>

      <h4 class="cfg-subtitulo">Botones de hielo en la caja</h4>
      <div class="cfg-lista">
        ${catalogo.productos.filter((p) => p.tipo === 'hielo').map((p) => fila(p)).join('')}
      </div>`;
  }

  // ==========================================================
  // PANEL: LA IMPRESORA
  // ==========================================================
  function panelImpresora() {
    const i = impresion;
    if (!i) return '<p class="vacio">No se pudo leer la configuración.</p>';

    return `
      <h3 style="margin:0 0 4px">Impresora de tickets</h3>
      <p class="ayuda">
        Con el nombre puesto, el ticket sale <strong>al instante</strong>, sin
        que se asome la ventana de impresión.
      </p>

      <label class="etiqueta-chica" for="imp-destino">Nombre compartido de la impresora</label>
      <input id="imp-destino" autocomplete="off" placeholder="\\\\localhost\\TICKET"
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
            <li>Nombre <b>corto y sin espacios</b>, por ejemplo <code>TICKET</code>.</li>
            <li>Aquí escribe <code>\\\\localhost\\TICKET</code> y dale a probar.</li>
          </ol>
        </div>
      </details>`;
  }

  // ==========================================================
  // ENGANCHAR TODO
  // ==========================================================
  function enganchar() {
    const q = (sel) => pantalla.querySelector(sel);

    q('#ver-hielo').onclick = () => { panel = 'hielo'; seleccionado = null; pintar(); };
    q('#ver-impresora').onclick = () => { panel = 'impresora'; seleccionado = null; pintar(); };
    q('#hoja-inventario').onclick = hojaParaContar;
    q('#nueva-cat').onclick = nuevaCategoria;

    const nuevo = q('#nuevo-prod');
    if (nuevo) nuevo.onclick = () => editarProducto(null, categoriaAbierta);

    pantalla.querySelectorAll('[data-categoria]').forEach((b) => {
      b.onclick = () => { categoriaAbierta = b.dataset.categoria; pintar(); };
    });
    pantalla.querySelectorAll('[data-editar-cat]').forEach((b) => {
      b.onclick = () => menuCategoria(
        catalogo.categorias.find((c) => c.id === b.dataset.editarCat));
    });
    pantalla.querySelectorAll('[data-prod]').forEach((b) => {
      b.onclick = () => {
        seleccionado = catalogo.productos.find((p) => p.id === b.dataset.prod);
        panel = 'producto';
        pintar();
      };
    });

    // --- panel del producto ---
    const foto = q('#foto');
    if (foto) foto.onchange = () => subirFoto(foto);
    const quitarFoto = q('#quitar-foto');
    if (quitarFoto) quitarFoto.onclick = () => borrarFoto();
    const editar = q('#editar-prod');
    if (editar) editar.onclick = () => editarProducto(seleccionado);
    const baja = q('#baja-prod');
    if (baja) baja.onclick = () => darDeBaja(seleccionado);
    const activar = q('#activar-inv');
    if (activar) activar.onclick = () => activarInventario(seleccionado);
    const entrada = q('#inv-entrada');
    if (entrada) entrada.onclick = () => movimientoInventario(seleccionado, 'entrada');
    const salida = q('#inv-salida');
    if (salida) salida.onclick = () => movimientoInventario(seleccionado, 'salida');
    const contar = q('#inv-conteo');
    if (contar) contar.onclick = () => contarProducto(seleccionado);

    // --- panel del hielo ---
    const guardar = q('#guardar-precios');
    if (guardar) guardar.onclick = guardarPrecios;
    const sugerirBtn = q('#sugerir');
    if (sugerirBtn) sugerirBtn.onclick = sugerir;

    // --- panel de la impresora ---
    const guardarImp = q('#guardar-impresora');
    if (guardarImp) guardarImp.onclick = guardarImpresora;
    const probar = q('#probar-impresora');
    if (probar) probar.onclick = probarImpresora;
  }

  // ==========================================================
  // FOTOS
  // ==========================================================
  function subirFoto(campo) {
    const archivo = campo.files?.[0];
    if (!archivo) return;

    const lector = new FileReader();
    lector.onload = async () => {
      try {
        await api.enviar(`/catalogo/productos/${seleccionado.id}/foto`,
                         { archivo: lector.result });
        avisar('Foto puesta', 'bien');
        cargar();
      } catch (e) { avisar(e.message, 'error'); }
    };
    lector.readAsDataURL(archivo);
  }

  async function borrarFoto() {
    if (!await confirmar({
      titulo: '¿Quitar la foto?',
      texto: 'El producto se queda sin imagen en la caja.',
      ok: 'Quitar', peligro: true
    })) return;
    try {
      await api.enviar(`/catalogo/productos/${seleccionado.id}/foto/quitar`, {});
      avisar('Foto eliminada', 'bien');
      cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  // ==========================================================
  // CATEGORÍAS
  // ==========================================================
  async function nuevaCategoria() {
    const nombre = await pedirTexto({
      titulo: 'Nueva categoría',
      texto: 'Como una carpeta: Refrescos, Agua, Botanas…',
      marcador: 'Refrescos', ok: 'Crear', largo: 40, unaLinea: true
    });
    if (!nombre) return;
    try {
      const r = await api.enviar('/catalogo/categorias', { nombre });
      categoriaAbierta = r.categoria.id;
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
        titulo: 'Nombre de la categoría', valor: c.nombre, ok: 'Guardar',
        largo: 40, unaLinea: true
      });
      if (!nombre) return;
      return guardarCategoria(c, { nombre });
    }

    if (que === 'color') {
      const color = await pedirTexto({
        titulo: 'Color del botón',
        texto: 'En formato #rrggbb. Por ejemplo #29abe2 para el azul de la marca.',
        valor: c.color || '#29abe2', ok: 'Guardar', largo: 7, unaLinea: true
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
        ? `Se dan de baja también sus ${suyos} producto${suyos === 1 ? '' : 's'}. Los tickets viejos siguen igual.`
        : 'Los tickets viejos siguen igual.',
      ok: 'Dar de baja', peligro: true
    })) return;

    try {
      await api.enviar(`/catalogo/categorias/${c.id}/baja`, {});
      categoriaAbierta = null;
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
  async function darDeBaja(p) {
    if (!await confirmar({
      titulo: `¿Dar de baja ${p.nombre}?`,
      texto: 'Deja de aparecer en la caja. Los tickets viejos no cambian.',
      ok: 'Dar de baja', peligro: true
    })) return;
    try {
      await api.enviar(`/catalogo/productos/${p.id}/baja`, {});
      seleccionado = null; panel = 'nada';
      avisar('Producto dado de baja', 'bien');
      cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function editarProducto(p, categoriaId) {
    const esNuevo = !p;

    const tipo = esNuevo
      ? await menu({
          titulo: 'Nuevo producto',
          texto: '¿Qué clase de producto es?',
          opciones: [
            { valor: 'simple', texto: 'Normal',
              detalle: 'Un refresco, un garrafón, una bolsa. Tiene su propio precio.' },
            { valor: 'hielo', texto: 'Hielo',
              detalle: 'Entrega una fracción de marqueta y toma su precio de la lista.' }
          ]
        })
      : p.tipo;
    if (!tipo) return;

    const nombre = await pedirTexto({
      titulo: esNuevo ? 'Nombre del producto' : `Editar ${p.nombre}`,
      texto: 'Como se va a leer en el botón y en el ticket.',
      valor: p?.nombre || '', marcador: tipo === 'hielo' ? '1/4' : 'Coca Cola 600 ml',
      ok: 'Siguiente', largo: 40, unaLinea: true
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
        titulo: `Precio de ${nombre}`, texto: '¿En cuánto se vende?',
        valor: p?.precio_centavos != null ? (p.precio_centavos / 100).toFixed(2) : '',
        marcador: '25.00', ok: 'Siguiente'
      });
      if (precio === null) return;
      cuerpo.precio = precio;

      const costo = await pedirImporte({
        titulo: `¿Cuánto te cuesta?`,
        texto: 'A cómo lo compras. Sirve para saber la ganancia; puedes dejarlo en cero.',
        valor: p?.costo_centavos != null ? (p.costo_centavos / 100).toFixed(2) : '',
        marcador: '18.00', ok: 'Siguiente'
      });
      if (costo !== null) cuerpo.costo = costo;
    }

    const codigo = await pedirTexto({
      titulo: 'Código para teclear',
      texto: 'Lo que el cajero teclea para agregarlo sin buscar el botón. Puede quedar vacío.',
      valor: p?.codigo || '', marcador: tipo === 'hielo' ? '14' : 'COCA',
      ok: esNuevo ? 'Crear el producto' : 'Guardar', largo: 12, unaLinea: true
    });
    cuerpo.codigo = codigo === null ? (p?.codigo || '') : codigo;

    try {
      const r = esNuevo
        ? await api.enviar('/catalogo/productos', cuerpo)
        : await api.actualizar(`/catalogo/productos/${p.id}`, cuerpo);
      seleccionado = r.producto;
      panel = 'producto';
      avisar(esNuevo ? 'Producto creado' : 'Guardado', 'bien');
      cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  // ==========================================================
  // INVENTARIO
  // ==========================================================
  async function activarInventario(p) {
    const minimo = await pedirTexto({
      titulo: `Inventario de ${p.nombre}`,
      texto: '¿Con cuántas piezas quieres que te avise que hay que pedir? Déjalo vacío si no quieres aviso.',
      marcador: '6', ok: 'Activar', largo: 8, unaLinea: true
    });
    if (minimo === null) return;

    try {
      await api.actualizar(`/catalogo/productos/${p.id}`, {
        llevaInventario: true, minimo
      });
      avisar('Inventario activado. Ahora registra lo que hay.', 'bien');
      cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function movimientoInventario(p, tipo) {
    const esEntrada = tipo === 'entrada';

    const cantidad = await pedirTexto({
      titulo: esEntrada ? `Llegó mercancía de ${p.nombre}` : `Salida de ${p.nombre}`,
      texto: '¿Cuántas piezas?',
      marcador: '24', ok: 'Siguiente', largo: 8, unaLinea: true
    });
    if (!cantidad) return;

    const cuerpo = { tipo, cantidad };

    if (esEntrada) {
      const costo = await pedirImporte({
        titulo: '¿A cómo te salió cada una?',
        texto: 'El costo de esta compra. Queda guardado tal cual: si mañana sube el proveedor, esta compra no cambia.',
        valor: p.costo_centavos != null ? (p.costo_centavos / 100).toFixed(2) : '',
        marcador: '18.00', ok: 'Registrar la entrada'
      });
      if (costo !== null) cuerpo.costo = costo;
    } else {
      const concepto = await pedirTexto({
        titulo: '¿Por qué sale?',
        texto: 'Se rompió, se lo llevaron, caducó…',
        marcador: 'Se rompieron', ok: 'Registrar la salida', largo: 60, unaLinea: true
      });
      if (!concepto) return;
      cuerpo.concepto = concepto;
    }

    try {
      await api.enviar(`/inventario/${p.id}/movimientos`, cuerpo);
      avisar(esEntrada ? 'Entrada registrada' : 'Salida registrada', 'bien');
      cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function contarProducto(p) {
    const inv = estadoDe(p.id);
    const contado = await pedirTexto({
      titulo: `Contar ${p.nombre}`,
      texto: `¿Cuántas piezas hay físicamente? Deberían ser ${inv?.esperado ?? 0}.`,
      valor: String(inv?.esperado ?? 0), ok: 'Registrar el conteo', largo: 8, unaLinea: true
    });
    if (contado === null) return;

    try {
      const r = await api.enviar(`/inventario/${p.id}/conteo`, { contado });
      const falta = r.resumen.falta;
      avisar(
        falta === 0 ? 'Cuadró exacto'
        : falta > 0 ? `Faltan ${falta} piezas`
        : `Sobran ${-falta} piezas`,
        falta === 0 ? 'bien' : 'error');
      cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  /** La hoja de papel con la que se va a contar, con su renglón en blanco. */
  async function hojaParaContar() {
    const { inventario: lista } = await api.obtener('/inventario');
    if (!lista.length) {
      avisar('Todavía no hay productos que lleven inventario', '');
      return;
    }

    const ventana = window.open('', '_blank');
    if (!ventana) { avisar('El navegador bloqueó la ventana de impresión', 'error'); return; }

    ventana.document.write(`
      <!doctype html><html lang="es"><head><meta charset="utf-8">
      <title>Hoja para contar</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 18mm 14mm; color: #000; }
        h1 { font-size: 18pt; margin: 0 0 2mm; }
        p { margin: 0 0 6mm; color: #444; font-size: 10pt; }
        table { width: 100%; border-collapse: collapse; font-size: 11pt; }
        th, td { border: 1px solid #999; padding: 3mm 2mm; text-align: left; }
        th { background: #eee; font-size: 9pt; text-transform: uppercase; }
        td.num { text-align: right; width: 22mm; }
        td.contar { width: 30mm; }
        tr.cat td { background: #f4f4f4; font-weight: 700; }
      </style></head><body>
      <h1>Hoja para contar</h1>
      <p>${new Date().toLocaleString('es-MX')} · Contó: ______________________</p>
      <table>
        <tr><th>Producto</th><th>Código</th><th class="num">Debería haber</th><th>Contado</th></tr>
        ${lista.map((i) => `
          <tr>
            <td>${esc(i.producto.nombre)}</td>
            <td>${esc(i.producto.codigo || '')}</td>
            <td class="num">${i.esperado}</td>
            <td class="contar"></td>
          </tr>`).join('')}
      </table>
      </body></html>`);
    ventana.document.close();
    setTimeout(() => ventana.print(), 300);
  }

  // ==========================================================
  // PRECIOS DEL HIELO
  // ==========================================================
  async function guardarPrecios() {
    const tarjeta = pantalla.querySelector('[data-lista-precios]');
    const precios = [...tarjeta.querySelectorAll('[data-precio]')].map((c) => ({
      dieciseisavos: Number(c.dataset.precio),
      pesos: Number(c.value.replace(/[^0-9.]/g, '')) || 0
    }));
    try {
      await api.actualizar(`/ventas/precios/${tarjeta.dataset.listaPrecios}`, { precios });
      avisar('Precios guardados', 'bien');
      cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function sugerir() {
    const tarjeta = pantalla.querySelector('[data-lista-precios]');
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

  // ==========================================================
  // IMPRESORA
  // ==========================================================
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
      // Se guarda primero: probar con lo que está escrito, no con lo viejo.
      const r = await api.actualizar('/impresion/config', datosImpresora());
      impresion = r.impresion;
      await api.enviar('/impresion/prueba', {});
      avisar('Salió la prueba. Revisa el papel.', 'bien');
    } catch (e) { avisar(e.message, 'error'); }
  }
}
