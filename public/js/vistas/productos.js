/**
 * PRODUCTOS Y PRECIOS  (v1.4 · rediseñada en la v7.1 con el diseño del dueño)
 *
 * "Es muy similar, solo mejor estibado y ordenado."
 *
 * La pantalla entera, no una columna: el catálogo a la izquierda, el
 * padrón de productos en medio con su buscador, la ficha del que se toque
 * a la derecha en tres bloques numerados, y abajo los cuatro números que
 * resumen el catálogo.
 *
 * SE EDITA EN EL SITIO. Nada de "Editar" que abra un formulario de cinco
 * pasos: se toca el nombre, el precio o el costo y se escribe encima. Sale
 * del campo y ya está guardado. Un formulario por paso está bien para dar
 * de alta algo nuevo; para corregir un precio es un estorbo.
 *
 * ============================================================
 * LOS TRES PRECIOS DE UN PRODUCTO  (v7.1)
 * ============================================================
 *
 * "Hay mayoreo en algunos productos por cantidad —yo lo activo y decido
 *  cuál es esa cantidad— y precios especiales por clientes: cada cliente
 *  puede llegar a tener un precio diferente."
 *
 * Son dos cosas distintas y por eso se ven en dos renglones distintos del
 * bloque de tarifas:
 *
 *   EL PRECIO DE MOSTRADOR es lo que vale de una en una. Lo paga quien no
 *   tiene nada especial, que es casi todo el mundo.
 *
 *   EL PRECIO POR VOLUMEN es del PRODUCTO. "De cincuenta bolsas para
 *   arriba, a $16.50." Le toca a QUIEN SEA que se lleve cincuenta: no es
 *   un trato con nadie, es cuánto vale comprar mucho. Se enciende y se
 *   apaga aquí mismo, poniendo o borrando los dos números.
 *
 *   EL CONVENIO es del CLIENTE. "A Mariscos El Faro la bolsa se la dejo en
 *   $15, lleve una o lleve cien." Se pone en la ficha del cliente, no
 *   aquí; aquí solo se ve A CUÁNTOS se les dejó un precio propio, porque
 *   eso hay que saberlo ANTES de mover el de mostrador.
 *
 * Al cobrar gana el más particular: su convenio, si no el precio por
 * volumen, si no su lista de mayoreo (el hielo por fracción), si no el
 * mostrador. Y el precio siempre se COPIA al ticket (regla 3.5): subirlo
 * mañana no toca una venta de ayer.
 *
 * EL CAJERO ENTRA CON VISTA LIMITADA: ve cuántas piezas hay y puede
 * imprimir la hoja para contar. Ni los costos ni los botones de editar
 * existen para él, y tampoco los manda el servidor.
 */
import { api } from '../api.js';
import { esc, avisar, fecha as formatoFecha } from '../util.js';
import { pedirTexto, pedirImporte, confirmar, menu, armarDialogo,
         pedirAutorizacion, pedirContrasena } from '../dialogo.js';
import { aTexto, pesos, paraEditar } from '../fracciones.js';

const FRACCIONES = [
  { d: 16, etiqueta: 'Una marqueta' },
  { d: 8,  etiqueta: '1/2' },
  { d: 4,  etiqueta: '1/4' },
  { d: 2,  etiqueta: '1/8' },
  { d: 1,  etiqueta: '1/16' }
];

const ID_HIELO = 'cat-hielo';

/**
 * LOS TRES FILTROS DE LA LISTA.
 *
 * No dicen "en stock / bajo stock" porque en esta fábrica no todo lleva
 * cuenta de piezas: el hielo se mide en marquetas y hay productos a los
 * que nunca se les encendió el inventario. Decirle "sin stock" a algo que
 * simplemente no se cuenta sería mentir en la pantalla.
 */
const FILTROS = [
  { clave: '',        nombre: 'Todos' },
  { clave: 'existe',  nombre: 'Con existencia' },
  { clave: 'pedir',   nombre: 'Por pedir' }
];

export async function vistaProductos(pantalla, estadoApp) {
  const puede = (p) => estadoApp.permisos.includes('*') || estadoApp.permisos.includes(p);
  const administra = puede('productos.administrar');
  const veCostos = puede('costos.ver');
  const mueve = puede('inventario.mover');
  const precios = puede('*');           // la lista de precios es del administrador
  // Borrar de verdad es solo del administrador. Dar de baja se recupera;
  // borrar no.
  const esAdmin = estadoApp.permisos.includes('*');

  let catalogo, listas, inventario, existencia, alertas;
  let mayoreoPorOmision = null;  // la lista de mayoreo que se cobra por omisión
  let categoriaAbierta = ID_HIELO;
  let seleccionado = null;
  let verBajas = false;
  let busca = '';
  let filtro = '';

  await cargar();

  async function cargar() {
    [catalogo, listas, inventario, existencia, alertas] = await Promise.all([
      api.obtener(`/catalogo${verBajas ? '?incluirBajas=1' : ''}`),
      api.obtener('/ventas/precios/listas').catch(() => ({ listas: [] })),
      api.obtener('/inventario').catch(() => ({ inventario: [], bajos: 0 })),
      api.obtener('/existencia').catch(() => ({ almacenes: [] })),
      api.obtener('/inventario/avisos').catch(() => ({ hielo: null }))
    ]);

    mayoreoPorOmision = listas.mayoreoPorOmision || null;

    if (!catalogo.categorias.some((c) => c.id === categoriaAbierta)) {
      categoriaAbierta = catalogo.categorias[0]?.id || null;
    }
    if (seleccionado) {
      seleccionado = catalogo.productos.find((p) => p.id === seleccionado.id) || null;
    }
    pintar();
  }

  // Declaraciones de función a propósito: cargar() corre antes de que la
  // pantalla termine de montarse, y una const todavía no existiría.
  function esHielo() { return categoriaAbierta === ID_HIELO; }

  function listaActiva() {
    // OJO: en este arreglo vienen también las listas de mayoreo, y una de
    // ellas está marcada `activa` (es "el precio de mayoreo normal"). Sin
    // pedir el tipo, la pantalla de público acabaría enseñando —y
    // guardando— los precios de mayoreo.
    return listas.listas.find((l) => l.activa && l.tipo === 'publico')
        || listas.listas.find((l) => l.tipo === 'publico')
        || null;
  }

  /** La lista de mayoreo que se cobra cuando el cliente no tiene una propia. */
  function listaMayoreoNormal() {
    return listas.listas.find((l) => l.id === mayoreoPorOmision)
        || listas.listas.find((l) => l.tipo === 'mayoreo')
        || null;
  }

  /**
   * Cuánto cuesta esa cantidad de hielo, con la lista que le toque.
   *
   * Un producto de mayoreo se cotiza con la lista de mayoreo, no con la de
   * público: si no, la lista de la izquierda diría que "1m" vale $264.
   */
  function precioDeHielo(dieciseisavos, deMayoreo = false) {
    const lista = deMayoreo ? listaMayoreoNormal() : listaActiva();
    const t = new Map((lista?.precios || []).map((p) => [p.dieciseisavos, p.centavos]));
    let queda = dieciseisavos, centavos = 0;
    for (const paso of [16, 8, 4, 2, 1]) {
      while (queda >= paso) { centavos += t.get(paso) ?? 0; queda -= paso; }
    }
    return centavos;
  }

  function estadoDe(id) {
    return inventario.inventario.find((i) => i.producto.id === id) || null;
  }

  /**
   * QUÉ PRODUCTOS SE VEN EN LA COLUMNA DE EN MEDIO.
   *
   * Con el buscador vacío, los de la categoría abierta. Con algo escrito,
   * TODO EL CATÁLOGO: quien busca "garrafón" no sabe —ni tiene por qué
   * saber— en qué carpeta quedó guardado, y hacerle abrir carpeta por
   * carpeta es justo lo que un buscador viene a evitar.
   */
  function productosALaVista() {
    const texto = busca.trim().toLowerCase();
    let lista = texto
      ? catalogo.productos.filter((p) =>
          (p.nombre || '').toLowerCase().includes(texto)
          || (p.codigo || '').toLowerCase().includes(texto))
      : catalogo.productos.filter((p) => p.categoria_id === categoriaAbierta);

    if (filtro === 'existe') {
      lista = lista.filter((p) => (estadoDe(p.id)?.esperado ?? 0) > 0);
    } else if (filtro === 'pedir') {
      lista = lista.filter((p) => estadoDe(p.id)?.bajo);
    }
    return lista;
  }

  // ==========================================================
  // LA PANTALLA
  // ==========================================================
  function pintar() {
    const cat = catalogo.categorias.find((c) => c.id === categoriaAbierta);
    const suyos = productosALaVista();
    const bajas = catalogo.productos.filter((p) => !p.activo).length;

    pantalla.innerHTML = `
      <div class="prod-pantalla ancho-completo">
        <div class="prod-cabecera">
          <div>
            <p class="prod-kicker">Catálogo maestro, tarifas y control de existencias</p>
            <h2>${administra ? 'Productos y precios' : 'Inventario'}</h2>
          </div>
          <div class="prod-cabecera-acciones">
            ${inventario.bajos
              ? `<span class="etiqueta-mal">${inventario.bajos} por pedir</span>` : ''}
            <button class="secundario chico" id="hoja-inventario">🖨️ Hoja para contar</button>
            ${administra ? `
              <button class="secundario chico ${verBajas ? 'activo' : ''}" id="ver-bajas">
                ${verBajas ? 'Ocultar dados de baja'
                  : `Ver dados de baja${bajas ? ` (${bajas})` : ''}`}
              </button>
              ` : ''}
          </div>
        </div>

        <div class="prod-tablero">
          <aside class="prod-columna prod-categorias">
            <p class="cfg-titulo">Categorías</p>
            <div class="cfg-lista">
              ${catalogo.categorias.map((c) => filaCategoria(c)).join('')}
            </div>
            ${administra ? '<button class="secundario chico" id="nueva-cat">＋ Categoría</button>' : ''}
          </aside>

          <section class="prod-columna prod-listado">
            <div class="prod-listado-cabeza">
              <p class="cfg-titulo">
                ${busca ? 'Buscando en todo el catálogo' : esc(cat?.nombre || 'Productos')}
                <small>${suyos.length}</small>
              </p>
            </div>
            <input id="busca" class="buscador" autocomplete="off"
                   placeholder="Buscar por nombre o código…" value="${esc(busca)}">
            <div class="prod-chips">
              ${FILTROS.map((f) => `
                <button class="prod-chip ${filtro === f.clave ? 'activa' : ''}"
                        data-filtro="${f.clave}">${esc(f.nombre)}</button>`).join('')}
            </div>
            <div class="cfg-lista cfg-productos" id="listado">
              ${suyos.map((p) => filaProducto(p)).join('') || vacioListado()}
            </div>
            ${administra && cat && cat.activo && !busca
              ? '<button class="secundario chico" id="nuevo-prod">＋ Producto</button>' : ''}
          </section>

          <section class="prod-columna prod-ficha" id="detalle">
            ${panelDerecho()}
          </section>
        </div>

        ${administra ? tarjetasCatalogo() : ''}
      </div>`;

    enganchar();
  }

  function vacioListado() {
    if (busca) return `<p class="vacio" style="padding:24px 0">Nada con «${esc(busca)}».</p>`;
    if (filtro === 'pedir') return '<p class="vacio" style="padding:24px 0">Nada por pedir aquí.</p>';
    if (filtro === 'existe') return '<p class="vacio" style="padding:24px 0">Nada con existencia aquí.</p>';
    return '<p class="vacio" style="padding:24px 0">Sin productos aquí.</p>';
  }

  /**
   * LOS CUATRO NÚMEROS DE ABAJO.
   *
   * Cada uno con su renglón chico: un número solo no dice nada. "38% de
   * margen" no significa lo mismo si sale de tres productos con costo
   * capturado que si sale de cuarenta, y quien va a decidir si sube un
   * precio necesita el de abajo tanto como el de arriba.
   *
   * VAN ABAJO Y NO ARRIBA, al revés que en Clientes: aquí lo que se viene
   * a hacer es tocar un producto, no leer el resumen. Arriba estorbarían
   * el trabajo de todos los días.
   */
  function tarjetasCatalogo() {
    const r = catalogo.resumen;
    if (!r) return '';
    const convenios = catalogo.productos.reduce((n, p) => n + (p.convenios || 0), 0);

    const tarjetas = [
      { icono: '📦', titulo: 'Catálogo activo', valor: String(r.productos),
        pie: r.deBaja ? `${r.deBaja} dado${r.deBaja === 1 ? '' : 's'} de baja` : 'Ninguno de baja',
        nota: 'Lo que se puede vender hoy' },
      { icono: '🏷️', titulo: 'Con precio especial',
        valor: `${r.conMayoreo}<small> por volumen</small>`,
        pie: convenios
          ? `${convenios} convenio${convenios === 1 ? '' : 's'} con clientes`
          : 'Sin convenios con clientes',
        nota: 'Mayoreo por cantidad y tratos particulares' },
      { icono: '💰', titulo: 'Valor en mostrador',
        valor: `${pesos(r.valorMostrador)}<small> MXN</small>`,
        pie: r.margen === null ? 'Sin costos capturados'
          : `${r.margen}% de margen promedio`,
        nota: r.sinCosto
          ? `${r.sinCosto} sin costo capturado`
          : 'Solo lo que lleva cuenta de piezas' },
      { icono: '🚚', titulo: 'Por pedir', valor: String(r.porPedir),
        pie: r.porPedir ? 'Ya bajaron de su mínimo' : 'Nada bajo mínimo',
        nota: 'Aviso de reposición',
        mal: r.porPedir > 0 }
    ];

    return `
      <div class="prod-kpis">
        ${tarjetas.map((t) => `
          <div class="cli-kpi ${t.mal ? 'kpi-mal' : ''}">
            <div class="cli-kpi-cabeza">
              <span class="cli-kpi-titulo">${esc(t.titulo)}</span>
              <span class="cli-kpi-icono">${t.icono}</span>
            </div>
            <strong class="cli-kpi-valor">${t.valor}</strong>
            <span class="cli-kpi-pie">${esc(t.pie)}</span>
            <span class="cli-kpi-nota">${esc(t.nota)}</span>
          </div>`).join('')}
      </div>`;
  }

  function filaCategoria(c) {
    const especial = c.id === ID_HIELO;
    return `
      <div class="cfg-fila-cat ${c.id === categoriaAbierta && !busca ? 'activo' : ''}
                  ${c.activo ? '' : 'de-baja'} ${especial ? 'especial' : ''}">
        <button class="cfg-item" data-categoria="${esc(c.id)}">
          ${c.foto
            ? `<img class="cfg-foto" src="/fotos/${esc(c.foto)}" alt="">`
            : `<span class="punto-color" style="background:${esc(c.color || '#8aa')}"></span>`}
          <span class="crece">
            ${esc(c.nombre)}
            ${especial ? '<small>precios por fracción</small>' : ''}
            ${c.activo ? '' : '<small>dada de baja</small>'}
          </span>
          <small>${catalogo.productos.filter((p) => p.categoria_id === c.id && p.activo).length}</small>
        </button>
        ${administra && !especial
          ? `<button class="cfg-puntos" data-cat-menu="${esc(c.id)}" aria-label="Opciones">⋯</button>`
          : ''}
      </div>`;
  }

  function filaProducto(p) {
    const inv = estadoDe(p.id);
    const conVolumen = p.mayoreo_desde && p.mayoreo_centavos != null;
    return `
      <button class="cfg-item cfg-producto ${seleccionado?.id === p.id ? 'activo' : ''}
                     ${p.activo ? '' : 'de-baja'}"
              data-prod="${esc(p.id)}">
        ${p.foto
          ? `<img class="cfg-foto" src="/fotos/${esc(p.foto)}" alt="">`
          : '<span class="cfg-foto cfg-foto-vacia">📦</span>'}
        <span class="crece">
          <strong>${esc(p.nombre)}</strong>
          <small>
            ${p.codigo ? `<b>${esc(p.codigo)}</b> · ` : ''}
            ${p.tipo === 'hielo'
              ? pesos(precioDeHielo(p.dieciseisavos, p.mayoreo)) +
                (p.mayoreo ? ' · mayoreo' : '')
              : pesos(p.precio_centavos)}
            ${conVolumen ? ` · ${pesos(p.mayoreo_centavos)} de ${p.mayoreo_desde}+` : ''}
            ${p.activo ? '' : ' · dado de baja'}
          </small>
        </span>
        <span class="prod-fila-marcas">
          ${conVolumen ? '<span class="prod-punto volumen" title="Tiene precio por volumen">▣</span>' : ''}
          ${p.convenios ? `<span class="prod-punto convenio" title="${p.convenios} cliente${p.convenios === 1 ? ' tiene' : 's tienen'} precio propio">◆</span>` : ''}
          ${inv ? `<small class="cfg-stock ${inv.bajo ? 'bajo' : ''}">${inv.esperado}</small>` : ''}
        </span>
      </button>`;
  }

  function panelDerecho() {
    if (seleccionado) return panelProducto(seleccionado);
    if (busca) return '<p class="vacio" style="padding:40px 0">Toca un producto de la lista para verlo aquí.</p>';
    if (esHielo()) return panelHielo();
    const cat = catalogo.categorias.find((c) => c.id === categoriaAbierta);
    if (cat) return panelCategoria(cat);
    return '<p class="vacio" style="padding:40px 0">Toca un producto para verlo aquí.</p>';
  }

  // ==========================================================
  // CAMPOS QUE SE EDITAN EN EL SITIO
  // ==========================================================

  /**
   * Un dato que se ve como texto y se edita al tocarlo. Sale del campo y
   * queda guardado; no hay botón de guardar porque no hace falta.
   */
  function campo(etiqueta, clave, valor, { tipo = 'texto', sufijo = '', ayuda = '' } = {}) {
    if (!administra) {
      return `
        <div class="cuadre-linea">
          <span>${esc(etiqueta)}</span>
          <strong>${esc(valor === '' || valor === null ? '—' : String(valor))}${sufijo}</strong>
        </div>`;
    }
    return `
      <div class="cuadre-linea campo-vivo">
        <span>${esc(etiqueta)}${ayuda ? `<small>${esc(ayuda)}</small>` : ''}</span>
        <input data-campo="${esc(clave)}" data-tipo="${tipo}"
               inputmode="${tipo === 'texto' ? 'text' : 'decimal'}"
               value="${esc(valor ?? '')}" autocomplete="off">
      </div>`;
  }

  /** El encabezado de cada bloque de la ficha: "01 · Identificación". */
  function bloque(numero, titulo, cuerpo, extra = '') {
    return `
      <section class="prod-bloque">
        <div class="prod-bloque-cabeza">
          <span class="prod-bloque-num">${numero}</span>
          <h4>${esc(titulo)}</h4>
          ${extra}
        </div>
        ${cuerpo}
      </section>`;
  }

  // ==========================================================
  // PANEL: UN PRODUCTO
  // ==========================================================
  function panelProducto(p) {
    const inv = estadoDe(p.id);
    const esDeHielo = p.tipo === 'hielo';
    const cat = catalogo.categorias.find((c) => c.id === p.categoria_id);

    return `
      <div class="cfg-detalle-cabeza">
        <div class="cfg-foto-grande">
          ${p.foto
            ? `<img src="/fotos/${esc(p.foto)}" alt="">
               ${administra ? '<button class="tachita" id="quitar-foto" aria-label="Quitar la foto">×</button>' : ''}`
            : '<span class="cfg-foto-vacia grande">📦</span>'}
        </div>
        <div class="crece">
          <p class="prod-kicker">${esc(cat?.nombre || 'Sin categoría')}</p>
          <h3 style="margin:0">${esc(p.nombre)}</h3>
          ${p.activo ? '' : '<p class="etiqueta-mal" style="display:inline-block;margin:6px 0 0">Dado de baja</p>'}
          ${administra ? `
            <label class="subir chico" style="margin-top:10px">
              ${p.foto ? 'Cambiar foto' : '＋ Poner foto'}
              <input type="file" id="foto" accept="image/png,image/jpeg,image/webp" hidden>
            </label>` : ''}
        </div>
        ${!esDeHielo && veCostos ? margen(p) : ''}
      </div>

      ${bloque('01', 'Identificación', `
        <div class="cuadre">
          ${campo('Nombre', 'nombre', p.nombre)}
          ${campo('Código para teclear', 'codigo', p.codigo || '',
                  { ayuda: 'lo que se teclea en la caja' })}
          ${esDeHielo ? `
            <div class="cuadre-linea">
              <span>Entrega</span>
              <strong>${esc(p.dieciseisavos === 16 ? 'una marqueta'
                       : aTexto(p.dieciseisavos) + ' de marqueta')}</strong>
            </div>` : ''}
        </div>`)}

      ${bloque('02', 'Estructura tarifaria y márgenes', tarifas(p))}

      ${bloque('03', esDeHielo ? 'Existencia del cuarto frío' : 'Inventario y existencias',
               esDeHielo ? panelExistenciaHielo() : panelInventario(p, inv))}

      ${administra ? `
        <div class="prod-pie">
          <button class="secundario chico" id="duplicar-prod">⧉ Duplicar producto</button>
          <button class="secundario chico" id="historial-prod">🕘 Historial de precios</button>
          ${p.activo
            ? '<button class="secundario chico peligro" id="baja-prod">Dar de baja</button>'
            : '<button class="chico" id="alta-prod">Volver a dar de alta</button>'}
          ${esAdmin
            ? '<button class="secundario chico peligro" id="borrar-prod">Eliminar</button>' : ''}
        </div>` : ''}`;
  }

  /**
   * LOS PRECIOS DE ESTE PRODUCTO, EN UN SOLO BLOQUE  (v7.1)
   *
   * De lo general a lo particular y en este orden, porque así se decide:
   * primero cuánto vale de una en una, luego a partir de cuántas se abarata
   * —y cuánto se sigue ganando ahí, que es lo que evita regalar el
   * producto—, y al final a cuántos clientes se les dejó un precio propio,
   * que es lo que hay que mirar ANTES de mover el de mostrador.
   */
  function tarifas(p) {
    if (p.tipo === 'hielo') {
      return `
        <div class="cuadre">
          <div class="cuadre-linea total">
            <span>Cuesta hoy<small>de la lista de público, por fracción</small></span>
            <strong>${pesos(precioDeHielo(p.dieciseisavos))}</strong>
          </div>
          ${listaMayoreoNormal() ? `
            <div class="cuadre-linea">
              <span>Mayoreo normal<small>${esc(listaMayoreoNormal().nombre)}</small></span>
              <strong>${pesos(precioDeHielo(p.dieciseisavos, true))}</strong>
            </div>` : ''}
        </div>
        <p class="ayuda">
          El precio del hielo NO vive en el producto: sale de la lista por
          fracción, y se cambia tocando <b>${esc(catalogo.categorias.find((c) => c.id === ID_HIELO)?.nombre || 'El hielo')}</b>
          en la columna de la izquierda. Si viviera en los dos lados, un día
          los dos números dirían cosas distintas.
        </p>`;
    }

    const tieneVolumen = !!(p.mayoreo_desde && p.mayoreo_centavos != null);
    const descuento = tieneVolumen && p.precio_centavos
      ? Math.round(((p.precio_centavos - p.mayoreo_centavos) / p.precio_centavos) * 100)
      : null;
    const margenVolumen = tieneVolumen && p.costo_centavos != null && p.mayoreo_centavos
      ? Math.round(((p.mayoreo_centavos - p.costo_centavos) / p.mayoreo_centavos) * 100)
      : null;
    const bajoCosto = tieneVolumen && p.costo_centavos != null
      && p.mayoreo_centavos < p.costo_centavos;

    return `
      <div class="cuadre">
        ${campo('Precio de mostrador', 'precio', paraEditar(p.precio_centavos),
                { tipo: 'dinero', ayuda: 'lo que paga quien lleva una' })}
        ${veCostos
          ? campo('Te cuesta', 'costo', paraEditar(p.costo_centavos), { tipo: 'dinero' })
          : ''}
      </div>

      ${administra ? `
        <div class="prod-volumen ${tieneVolumen ? 'encendido' : ''}">
          <div class="prod-volumen-cabeza">
            <strong>Precio por volumen</strong>
            ${tieneVolumen
              ? `<span class="prod-etiqueta">−${descuento}% desde ${p.mayoreo_desde} pzas</span>`
              : '<span class="prod-etiqueta apagada">apagado</span>'}
          </div>
          <div class="prod-volumen-campos">
            <label>
              <span>A partir de</span>
              <input data-campo="mayoreoDesde" data-tipo="entero" inputmode="numeric"
                     placeholder="—" value="${esc(p.mayoreo_desde ?? '')}" autocomplete="off">
              <small>piezas</small>
            </label>
            <label>
              <span>La pieza a</span>
              <input data-campo="mayoreoPrecio" data-tipo="dinero" inputmode="decimal"
                     placeholder="—" value="${p.mayoreo_centavos != null ? paraEditar(p.mayoreo_centavos) : ''}"
                     autocomplete="off">
              <small>pesos</small>
            </label>
          </div>
          <p class="ayuda">
            Le toca a <b>quien sea</b> que se lleve esa cantidad, tenga trato
            o no. Hacen falta los dos datos: se apaga borrando los dos.
            ${margenVolumen !== null && !bajoCosto
              ? `<br>A ese precio todavía ganas <b>${margenVolumen}%</b>
                 (${pesos(p.mayoreo_centavos - p.costo_centavos)} por pieza).` : ''}
          </p>
          ${bajoCosto ? `
            <div class="aviso-sin-caja">
              <strong>Ese precio está por debajo de lo que te cuesta.</strong>
              Cada pieza que se lleve de ${p.mayoreo_desde} para arriba pierde
              ${pesos(p.costo_centavos - p.mayoreo_centavos)}.
            </div>` : ''}
        </div>` : tieneVolumen ? `
        <div class="cuadre">
          <div class="cuadre-linea">
            <span>De ${p.mayoreo_desde} piezas en adelante</span>
            <strong>${pesos(p.mayoreo_centavos)}</strong>
          </div>
        </div>` : ''}

      <div class="prod-convenios">
        <div>
          <strong>${p.convenios || 0} convenio${p.convenios === 1 ? '' : 's'} con clientes</strong>
          <small>${p.convenios
            ? 'Le gana al de mostrador y al de volumen: es su precio, lleve una o lleve cien.'
            : 'A nadie se le ha dejado un precio propio de este producto.'}</small>
        </div>
        <a class="boton secundario chico" href="#/clientes">Ver en clientes</a>
      </div>`;
  }

  /**
   * Cuánto se le gana. Lo importante no es el peso suelto sino el
   * porcentaje: un producto barato con buen margen es el que conviene
   * empujar, y eso no se ve mirando solo la diferencia.
   */
  function margen(p) {
    if (p.costo_centavos == null || !p.precio_centavos) return '';
    const ganancia = p.precio_centavos - p.costo_centavos;

    if (p.costo_centavos === 0) {
      return `
        <div class="margen">
          <strong>${pesos(ganancia)}</strong>
          <span>de ganancia · no te cuesta nada</span>
        </div>`;
    }

    const sobreCosto = Math.round((ganancia / p.costo_centavos) * 100);
    const sobreVenta = Math.round((ganancia / p.precio_centavos) * 100);
    const nivel = ganancia < 0 ? 'perdida' : sobreCosto >= 50 ? 'bueno'
                : sobreCosto >= 20 ? 'normal' : 'flojo';

    const lectura = {
      perdida: 'Lo estás vendiendo por debajo de lo que te cuesta.',
      bueno: 'Buen margen. De estos conviene vender más.',
      normal: 'Margen normal.',
      flojo: 'Margen apretado: se gana poco por pieza.'
    }[nivel];

    return `
      <div class="margen ${nivel}" title="${esc(lectura)} ${sobreVenta}% de lo que cobras.">
        <strong>${ganancia < 0 ? '−' : ''}${sobreCosto < 0 ? -sobreCosto : sobreCosto}%</strong>
        <span>${pesos(Math.abs(ganancia))} por pieza</span>
      </div>`;
  }

  /*
   * LO QUE SE FUE EN LA v6.9: «¿de cuál de los dos negocios es?»
   *
   * "Toda la fábrica es una misma, no hay dos partes. Un cliente puede
   *  pedir en la caja agua, hielo, refrescos, lo que quiera, y creo que es
   *  obvio con lo que compre."
   *
   * La marca sigue existiendo —de ella salen la pestaña de «clientes de
   * agua» y el bloque del agua en la hoja de preparación— pero ya no se
   * pregunta: el servidor la deduce del nombre al dar de alta o al
   * renombrar. Una pregunta que no cambia nada de lo que se vende no vale
   * el renglón que ocupa en la ficha.
   */

  /**
   * LA EXISTENCIA, EN CORTO.
   *
   * Aquí se le ponen precios al hielo, no se cuenta el cuarto frío. El
   * cuadre completo vivía también en esta pantalla y la dejaba saturada:
   * ahora queda un solo dato —cuánto debería haber y de cuándo es— y un
   * botón para ir al lugar donde eso sí se trabaja.
   */
  function panelExistenciaHielo() {
    const a = existencia.almacenes?.[0];
    if (!a) return '';
    return `
      <div class="hielo-resumen">
        <div>
          <small>Debería haber en el cuarto frío</small>
          <strong>${esc(a.textos.esperado)}</strong>
          <small>${a.ultimoConteo
            ? `último conteo: ${esc(formatoFecha(a.ultimoConteo.fecha))}`
            : 'todavía no se ha contado'}</small>
        </div>
        <a class="boton secundario chico" href="#/existencia">Ir a existencia del hielo</a>
      </div>`;
  }

  function panelInventario(p, inv) {
    if (!p.lleva_inventario) {
      if (!administra) return '';
      return `
        <p class="ayuda">
          Este producto no lleva cuenta de piezas. Actívalo si quieres que el
          sistema te avise cuando haya que pedir más.
        </p>
        <button class="secundario chico" id="activar-inv">Llevar inventario</button>`;
    }

    return `
      <div class="cuadre">
        <div class="cuadre-linea">
          <span>Había en el último conteo</span><strong>${inv?.anterior ?? 0}</strong>
        </div>
        <div class="cuadre-linea suma"><span>+ Entró</span><strong>${inv?.entradas ?? 0}</strong></div>
        <div class="cuadre-linea vendido"><span>− Se vendió</span><strong>${inv?.vendido ?? 0}</strong></div>
        ${inv?.salidas ? `
          <div class="cuadre-linea vendido"><span>− Otras salidas</span><strong>${inv.salidas}</strong></div>` : ''}
        <div class="cuadre-linea total">
          <span>= Debería haber</span>
          <strong class="${inv?.bajo ? 'malo' : ''}">${inv?.esperado ?? 0}</strong>
        </div>
        ${campo('Avisar cuando baje de', 'minimo', p.minimo ?? '', { tipo: 'entero' })}
      </div>

      ${inv?.bajo ? `
        <div class="aviso-sin-caja" style="margin-top:12px">
          <strong>Ya hay que pedir más.</strong>
          Quedan ${inv.esperado} y el aviso está en ${p.minimo}.
        </div>` : ''}

      ${mueve ? `
        <div class="fila-botones" style="margin-top:14px;flex-wrap:wrap">
          <button class="pos-btn-entrada chico" id="inv-entrada">＋ Llegó mercancía</button>
          <button class="pos-btn-salida chico" id="inv-salida">− Salida</button>
          <button class="chico" id="inv-conteo">📋 Contar</button>
        </div>` : ''}

      ${inv?.ultimoConteo ? `
        <p class="ayuda" style="margin-top:12px">
          Último conteo: ${esc(formatoFecha(inv.ultimoConteo.fecha))}
          · ${esc(inv.ultimoConteo.concepto || '')}
        </p>` : ''}

      ${administra ? `
        <p class="ayuda" style="margin-top:14px">
          <button class="enlace" id="apagar-inv">Dejar de llevar inventario de esto</button>
        </p>` : ''}`;
  }

  // ==========================================================
  // PANEL: UNA CATEGORÍA
  // ==========================================================
  function panelCategoria(c) {
    const suyos = catalogo.productos.filter((p) => p.categoria_id === c.id);
    return `
      <div class="cfg-detalle-cabeza">
        <div class="cfg-foto-grande">
          ${c.foto
            ? `<img src="/fotos/${esc(c.foto)}" alt="">
               ${administra ? '<button class="tachita" id="quitar-foto-cat" aria-label="Quitar la imagen">×</button>' : ''}`
            : `<span class="cfg-foto-vacia grande" style="color:${esc(c.color || '#8aa')}">🏷️</span>`}
        </div>
        <div class="crece">
          <h3 style="margin:0">${esc(c.nombre)}</h3>
          <p class="ayuda" style="margin:4px 0 0">
            ${suyos.length} producto${suyos.length === 1 ? '' : 's'}
          </p>
          ${administra ? `
            <label class="subir chico" style="margin-top:10px">
              ${c.foto ? 'Cambiar imagen' : '＋ Poner imagen'}
              <input type="file" id="foto-cat" accept="image/png,image/jpeg,image/webp" hidden>
            </label>` : ''}
        </div>
      </div>

      ${administra ? `
        <div class="cuadre">
          <div class="cuadre-linea campo-vivo">
            <span>Nombre</span>
            <input data-campo-cat="nombre" value="${esc(c.nombre)}" autocomplete="off">
          </div>
          <div class="cuadre-linea campo-vivo">
            <span>Color del botón<small>se ve así en la caja</small></span>
            <input type="color" data-campo-cat="color" value="${esc(c.color || '#29abe2')}">
          </div>
        </div>` : ''}

      <p class="ayuda" style="margin-top:16px">
        Toca un producto de la lista de en medio para verlo y editarlo.
      </p>`;
  }

  // ==========================================================
  // PANEL: EL HIELO
  // ==========================================================
  function panelHielo() {
    const l = listaActiva();
    return `
      <h3 style="margin:0 0 4px">🧊 El hielo</h3>
      <p class="ayuda">
        Cada fracción tiene su propio precio; no se saca dividiendo el de la
        marqueta, porque cortar da trabajo.
      </p>

      ${l ? `
        <div class="precios-rejilla" data-lista-precios="${esc(l.id)}">
          ${FRACCIONES.map((f) => {
            const p = l.precios.find((x) => x.dieciseisavos === f.d);
            return `
              <label class="precio-celda">
                <span>${esc(f.d === 16 ? '1' : aTexto(f.d))}</span>
                <input inputmode="decimal" data-precio="${f.d}" ${precios ? '' : 'disabled'}
                       value="${paraEditar(p?.centavos ?? 0)}">
              </label>`;
          }).join('')}
        </div>

        ${precios ? `
          <div class="fila-botones" style="margin-top:14px">
            <button class="secundario" id="sugerir">Sugerir proporcional</button>
            <button id="guardar-precios">Guardar precios</button>
          </div>

          <pre class="ayuda-formula" style="margin-top:16px">3/8  →  1/4 + 1/8  →  ${
            pesos(precioDeHielo(4))} + ${pesos(precioDeHielo(2))}  =  ${pesos(precioDeHielo(6))}</pre>
          <p class="ayuda">
            Como el sistema parte igual siempre, da lo mismo cómo se teclee.
            <strong>Los tickets ya cobrados no cambian</strong> si subes un precio.
          </p>` : ''}` : ''}

      ${panelMayoreo()}
      ${panelExistenciaHielo()}
      ${panelAvisoHielo()}`;
  }

  /**
   * LOS PRECIOS DE MAYOREO  (v1.9)
   *
   * El mayoreo es una LISTA, no un descuento: "Mayoreo 1" es la lista donde
   * la marqueta vale $240, y a ella se apuntan los clientes que la tienen.
   * Subirle el precio a la lista se lo sube a todos de una vez, que es como
   * se maneja de verdad.
   *
   * Cada fracción lleva su propio precio, igual que en la de público: el
   * cuarto no sale de dividir la marqueta entre cuatro ni aquí ni allá.
   */
  function panelMayoreo() {
    if (!precios) return '';
    const deMayoreo = listas.listas.filter((l) => l.tipo === 'mayoreo' && l.activo !== 0);

    return `
      <h4 class="cfg-subtitulo">🏷️ Precios de mayoreo</h4>
      <p class="ayuda">
        En la caja el mayoreo se teclea: <b>1m</b> es la marqueta y
        <b>12m</b> la media. Al cobrar se pide de quién es el ticket, y si
        ese cliente tiene su propia lista, se le cobra la suya.
      </p>
      <p class="ayuda">
        La lista marcada como <b>normal</b> es la que se cobra a quien no
        tiene una propia. A cada cliente se le apunta la suya en su ficha,
        en <b>Clientes</b>.
      </p>

      ${deMayoreo.map((l) => `
        <div class="tarjeta-mayoreo ${l.id === mayoreoPorOmision ? 'es-la-normal' : ''}">
          <div class="fila-botones" style="justify-content:space-between;align-items:center">
            <strong>${esc(l.nombre)}</strong>
            ${l.id === mayoreoPorOmision
              ? '<span class="etiqueta-mayoreo">el precio de mayoreo normal</span>'
              : `<button class="secundario chico" data-normal="${esc(l.id)}">Hacerla la normal</button>`}
            <small class="ayuda" style="margin:0">${
              l.clientes ? `${l.clientes} cliente${l.clientes === 1 ? '' : 's'}` : 'sin clientes todavía'}</small>
          </div>
          <div class="precios-rejilla" data-lista-precios="${esc(l.id)}">
            ${FRACCIONES.map((f) => {
              const p = l.precios.find((x) => x.dieciseisavos === f.d);
              return `
                <label class="precio-celda">
                  <span>${esc(f.d === 16 ? '1' : aTexto(f.d))}</span>
                  <input inputmode="decimal" data-precio="${f.d}"
                         value="${paraEditar(p?.centavos ?? 0)}">
                </label>`;
            }).join('')}
          </div>
          <div class="fila-botones" style="margin-top:10px">
            <button class="secundario chico" data-guardar-lista="${esc(l.id)}">
              Guardar ${esc(l.nombre)}
            </button>
            ${administra && deMayoreo.length > 1
              ? `<button class="secundario chico peligro-suave" data-baja-lista="${esc(l.id)}">
                   Dar de baja
                 </button>` : ''}
          </div>
        </div>`).join('')
        || '<p class="ayuda">Todavía no hay ninguna lista de mayoreo.</p>'}

      <div class="fila-botones" style="margin-top:12px">
        <button class="secundario chico" id="nueva-lista">＋ Nueva lista de mayoreo</button>
      </div>
      <p class="ayuda">
        Una lista nueva nace con los precios de público copiados, para que
        nunca quede a medio llenar: se bajan los que toque y ya.
      </p>`;
  }

  /**
   * CUÁNDO AVISAR DE QUE QUEDA POCO HIELO.
   *
   * Este aviso es distinto a todos los demás y hay que decirlo en la
   * pantalla: el número del que sale no es lo que hay en el cuarto frío,
   * es lo que se ha capturado. Los operarios sacan hielo toda la mañana y
   * reportan hasta como las 3 de la tarde, así que a media mañana el
   * sistema siempre va a creer que hay menos.
   *
   * Por eso el aviso solo pone un símbolo en la caja. Nunca impide vender.
   */
  function panelAvisoHielo() {
    const h = alertas?.hielo;
    if (!h) return '';

    return `
      <h4 class="cfg-subtitulo">Aviso de poco hielo</h4>
      <p class="ayuda">
        Cuando lo capturado baje de aquí, en la caja aparece un 🧊. Es solo
        un aviso: <strong>el hielo nunca se deja de vender</strong>, porque
        el número va atrasado hasta que los operarios reportan lo que sacaron.
      </p>
      <div class="cuadre">
        <div class="cuadre-linea ${administra ? 'campo-vivo' : ''}">
          <span>Avisar con esto o menos<small>en marquetas</small></span>
          ${administra
            ? `<input id="hielo-minimo" inputmode="numeric" autocomplete="off"
                      value="${esc(String(h.minimoMarquetas))}">`
            : `<strong>${esc(String(h.minimoMarquetas))}</strong>`}
        </div>
        <div class="cuadre-linea total">
          <span>= Capturado ahora</span>
          <strong class="${h.bajo ? 'malo' : ''}">${esc(h.texto)}</strong>
        </div>
      </div>
      ${h.bajo ? `
        <div class="aviso-sin-caja" style="margin-top:12px">
          <strong>La caja ya está mostrando el aviso.</strong>
          Si en el cuarto frío hay más, es que falta capturar producción.
        </div>` : ''}`;
  }


  // ==========================================================
  // ENGANCHAR
  // ==========================================================
  function enganchar() {
    const q = (sel) => pantalla.querySelector(sel);
    const todos = (sel) => pantalla.querySelectorAll(sel);

    q('#hoja-inventario').onclick = hojaParaContar;

    const bajas = q('#ver-bajas');
    if (bajas) bajas.onclick = () => { verBajas = !verBajas; cargar(); };
    const nuevaCat = q('#nueva-cat');
    if (nuevaCat) nuevaCat.onclick = nuevaCategoria;
    const nuevoProd = q('#nuevo-prod');
    if (nuevoProd) nuevoProd.onclick = nuevoProducto;

    // EL BUSCADOR NO REPINTA LA PANTALLA ENTERA, solo la lista de en
    // medio: repintarla le arrancaría el foco al que está escribiendo y
    // la segunda letra se iría a ninguna parte.
    const buscador = q('#busca');
    if (buscador) {
      let espera;
      buscador.oninput = () => {
        clearTimeout(espera);
        espera = setTimeout(() => { busca = buscador.value.trim(); refrescarProductos(); }, 200);
      };
      buscador.onkeydown = (ev) => { if (ev.key === 'Enter') ev.preventDefault(); };
    }

    todos('[data-filtro]').forEach((b) => {
      b.onclick = () => { filtro = b.dataset.filtro; pintar(); };
    });

    todos('[data-categoria]').forEach((b) => {
      b.onclick = () => {
        categoriaAbierta = b.dataset.categoria;
        // Al abrir una carpeta se sale de la búsqueda: quedarse dentro de
        // ella enseñaría la categoría en el título y los resultados de
        // otra cosa en la lista.
        busca = '';
        seleccionado = null;
        pintar();
      };
    });
    todos('[data-cat-menu]').forEach((b) => {
      b.onclick = (ev) => {
        ev.stopPropagation();
        menuCategoria(catalogo.categorias.find((c) => c.id === b.dataset.catMenu));
      };
    });
    engancharFilas();

    engancharDetalle();
  }

  /** Los renglones de la lista de en medio, que se repintan solos. */
  function engancharFilas() {
    pantalla.querySelectorAll('[data-prod]').forEach((b) => {
      b.onclick = () => {
        seleccionado = catalogo.productos.find((p) => p.id === b.dataset.prod);
        pintarDetalle();
        pantalla.querySelectorAll('[data-prod]').forEach((otro) => {
          otro.classList.toggle('activo', otro.dataset.prod === seleccionado?.id);
        });
      };
    });
  }

  /** Repinta solo la columna de en medio, sin tocar el foco del buscador. */
  function refrescarProductos() {
    const cuerpo = pantalla.querySelector('#listado');
    if (!cuerpo) { pintar(); return; }
    const suyos = productosALaVista();
    cuerpo.innerHTML = suyos.map((p) => filaProducto(p)).join('') || vacioListado();
    const titulo = pantalla.querySelector('.prod-listado-cabeza .cfg-titulo');
    if (titulo) {
      const cat = catalogo.categorias.find((c) => c.id === categoriaAbierta);
      titulo.innerHTML = `${busca ? 'Buscando en todo el catálogo' : esc(cat?.nombre || 'Productos')}
                          <small>${suyos.length}</small>`;
    }
    engancharFilas();
  }

  /** Repinta solo la ficha de la derecha. */
  function pintarDetalle() {
    const caja = pantalla.querySelector('#detalle');
    if (!caja) { pintar(); return; }
    caja.innerHTML = panelDerecho();
    engancharDetalle();
  }

  function engancharDetalle() {
    const q = (sel) => pantalla.querySelector('#detalle ' + sel) || pantalla.querySelector(sel);

    // --- los campos que se editan en el sitio ---
    pantalla.querySelectorAll('[data-campo]').forEach((campoEl) => {
      campoEl.onkeydown = (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); campoEl.blur(); }
        if (ev.key === 'Escape') { campoEl.value = campoEl.defaultValue; campoEl.blur(); }
      };
      campoEl.onchange = () => guardarCampo(campoEl);
    });

    pantalla.querySelectorAll('[data-campo-cat]').forEach((campoEl) => {
      campoEl.onkeydown = (ev) => { if (ev.key === 'Enter') campoEl.blur(); };
      campoEl.onchange = () => guardarCampoCategoria(campoEl);
    });

    const foto = q('#foto');
    if (foto) foto.onchange = () => subirFoto(foto, 'producto');
    const fotoCat = q('#foto-cat');
    if (fotoCat) fotoCat.onchange = () => subirFoto(fotoCat, 'categoria');
    const quitar = q('#quitar-foto');
    if (quitar) quitar.onclick = () => borrarFoto('producto');
    const quitarCat = q('#quitar-foto-cat');
    if (quitarCat) quitarCat.onclick = () => borrarFoto('categoria');

    const baja = q('#baja-prod');
    if (baja) baja.onclick = () => darDeBaja(seleccionado);
    const borrar = q('#borrar-prod');
    if (borrar) borrar.onclick = () => eliminarProducto(seleccionado);
    const alta = q('#alta-prod');
    if (alta) alta.onclick = () => darDeAlta(seleccionado);
    const duplicar = q('#duplicar-prod');
    if (duplicar) duplicar.onclick = () => duplicarProducto(seleccionado);
    const historial = q('#historial-prod');
    if (historial) historial.onclick = () => verHistorial(seleccionado);
    const activar = q('#activar-inv');
    if (activar) activar.onclick = () => activarInventario(seleccionado);
    const apagar = q('#apagar-inv');
    if (apagar) apagar.onclick = () => apagarInventario(seleccionado);

    const entrada = q('#inv-entrada');
    if (entrada) entrada.onclick = () => movimientoInventario(seleccionado, 'entrada');
    const salida = q('#inv-salida');
    if (salida) salida.onclick = () => movimientoInventario(seleccionado, 'salida');
    const contar = q('#inv-conteo');
    if (contar) contar.onclick = () => contarProducto(seleccionado);

    const guardar = q('#guardar-precios');
    if (guardar) guardar.onclick = () => guardarPrecios();

    pantalla.querySelectorAll('[data-guardar-lista]').forEach((b) => {
      b.onclick = () => guardarPrecios(b.dataset.guardarLista);
    });
    const nuevaLista = q('#nueva-lista');
    if (nuevaLista) nuevaLista.onclick = crearListaMayoreo;
    pantalla.querySelectorAll('[data-normal]').forEach((b) => {
      b.onclick = () => hacerlaNormal(b.dataset.normal);
    });
    pantalla.querySelectorAll('[data-baja-lista]').forEach((b) => {
      b.onclick = () => darDeBajaLista(b.dataset.bajaLista);
    });
    const sug = q('#sugerir');
    if (sug) sug.onclick = sugerir;

    // El mínimo del hielo se guarda al salir del campo, como todo lo demás
    // en esta pantalla: no hay botón de guardar que se pueda olvidar.
    const min = q('#hielo-minimo');
    if (min) {
      min.onblur = () => guardarMinimoHielo(min);
      min.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); min.blur(); } };
    }
  }

  /**
   * DUPLICAR.
   *
   * Dar de alta la bolsa de 10 kg cuando ya existe la de 5 es copiar ocho
   * campos y cambiar dos. La copia nace sin código —es único y se teclea—
   * y con "(copia)" en el nombre, para no confundirla con la original
   * mientras se termina de ajustar.
   */
  async function duplicarProducto(p) {
    if (!p) return;
    if (!await confirmar({
      titulo: `¿Duplicar ${p.nombre}?`,
      texto: 'Se crea otro producto con el mismo precio, costo y ajustes. ' +
             'Nace sin código y con «(copia)» en el nombre, para que lo ' +
             'cambies y no se confunda con éste.',
      ok: 'Duplicar'
    })) return;

    try {
      const r = await api.enviar(`/catalogo/productos/${p.id}/duplicar`, {});
      seleccionado = r.producto;
      categoriaAbierta = r.producto.categoria_id;
      busca = '';
      avisar('Copia creada. Cámbiale el nombre y el precio aquí mismo.', 'bien');
      await cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  /**
   * EL HISTORIAL DE PRECIOS.
   *
   * No sale de una tabla de historial: sale de la BITÁCORA, que es donde
   * ya quedó escrito cada cambio con lo que decía antes y lo que dice
   * después. Una tabla aparte sería una segunda copia de la misma verdad,
   * y el día que se desincronizara nadie sabría cuál creer.
   */
  async function verHistorial(p) {
    if (!p) return;
    let datos;
    try {
      datos = await api.obtener(`/catalogo/productos/${p.id}/historial`);
    } catch (e) { avisar(e.message, 'error'); return; }

    const renglon = (c) => {
      const mostrador = c.despues !== null && c.antes !== c.despues
        ? `<strong>${c.antes === null ? '—' : pesos(c.antes)} → ${pesos(c.despues)}</strong>`
        : '';
      const volumen = c.mayoreoAntes !== c.mayoreoDespues
        ? `<small>por volumen: ${c.mayoreoAntes === null ? 'apagado' : pesos(c.mayoreoAntes)}
           → ${c.mayoreoDespues === null ? 'apagado'
               : `${pesos(c.mayoreoDespues)} desde ${c.desde ?? '?'} pzas`}</small>`
        : '';
      return `
        <tr>
          <td>${esc(formatoFecha(c.fecha))}<small>${esc(c.quien || 'sin nombre')}</small></td>
          <td class="der">${mostrador}${volumen}</td>
        </tr>`;
    };

    const d = armarDialogo(`
      <h3 class="dialogo-titulo">Historial de precios</h3>
      <p class="dialogo-texto">${esc(p.nombre)}</p>
      ${datos.cambios.length ? `
        <div class="prod-historial">
          <table class="cli-tabla" style="min-width:0">
            <tbody>${datos.cambios.map(renglon).join('')}</tbody>
          </table>
        </div>
        <p class="dialogo-texto">
          Los tickets ya cobrados NO cambian: el precio quedó copiado en
          cada uno el día que se vendió.
        </p>`
      : '<p class="dialogo-texto">Todavía no se le ha movido el precio a este producto.</p>'}
      <div class="dialogo-botones"><button data-cerrar>Cerrar</button></div>`);
    d.caja.querySelector('[data-cerrar]').onclick = () => d.salir(null);
    await d.hecho;
  }

  async function guardarMinimoHielo(campoEl) {
    const marquetas = campoEl.value.replace(/[^0-9]/g, '');
    if (marquetas === '' || Number(marquetas) === alertas?.hielo?.minimoMarquetas) {
      campoEl.value = String(alertas?.hielo?.minimoMarquetas ?? '');
      return;
    }
    try {
      await api.actualizar('/inventario/hielo-minimo', { marquetas });
      alertas = await api.obtener('/inventario/avisos');
      avisar(`Avisará con ${marquetas} marqueta${marquetas === '1' ? '' : 's'} o menos`, 'bien');
      pintar();
    } catch (e) {
      avisar(e.message, 'error');
      campoEl.value = String(alertas?.hielo?.minimoMarquetas ?? '');
    }
  }

  /** Lo que hay escrito ahora mismo en un campo de la ficha. */
  function leerCampo(clave) {
    return pantalla.querySelector(`[data-campo="${clave}"]`)?.value.trim() ?? '';
  }

  /** Guarda un campo del producto en cuanto se sale de él. */
  async function guardarCampo(campoEl) {
    const clave = campoEl.dataset.campo;
    const valor = campoEl.value.trim();
    const esVolumen = clave === 'mayoreoDesde' || clave === 'mayoreoPrecio';

    // ============================================================
    // LOS DOS CAMPOS DEL VOLUMEN VIAJAN JUNTOS, Y A MEDIAS NO SE GUARDAN
    // ============================================================
    //
    // Un "a partir de 50" sin precio no dice nada, y el servidor apaga la
    // regla entera si le falta cualquiera de los dos. Si cada campo se
    // guardara solo al salir de él, encender el precio por volumen sería
    // imposible: se escribe el 50, se sale, y como todavía no hay precio
    // se borra el 50; se escribe el precio, se sale, y como ya no hay 50
    // se borra el precio. Una pantalla en la que el dato desaparece al
    // capturarlo se siente rota aunque el servidor esté haciendo justo lo
    // que se le pidió.
    //
    // Así que se manda lo que hay escrito en los DOS, y mientras solo haya
    // uno no se manda nada: se avisa y ya. Vaciar los dos sí se guarda —es
    // como se apaga.
    let cuerpo = { [clave]: valor };
    if (esVolumen) {
      const desde = leerCampo('mayoreoDesde');
      const precio = leerCampo('mayoreoPrecio');
      if (!desde !== !precio) {          // uno lleno y el otro vacío
        avisar('El precio por volumen necesita las dos cosas: a partir de '
             + 'cuántas piezas y a cuánto queda la pieza.', '');
        return;
      }
      cuerpo = { mayoreoDesde: desde, mayoreoPrecio: precio };
    }

    try {
      const r = await api.actualizar(`/catalogo/productos/${seleccionado.id}`, cuerpo);
      seleccionado = r.producto;

      // Se devuelve el valor ya normalizado: quien escribió "30" ve "30.00",
      // que es lo que de verdad quedó guardado.
      if (clave === 'precio') campoEl.value = paraEditar(r.producto.precio_centavos);
      if (clave === 'costo') {
        campoEl.value = r.producto.costo_centavos != null
          ? paraEditar(r.producto.costo_centavos) : '';
      }
      if (clave === 'codigo') campoEl.value = r.producto.codigo || '';
      campoEl.defaultValue = campoEl.value;

      campoEl.classList.add('guardado');
      setTimeout(() => campoEl.classList.remove('guardado'), 900);
      // Se recarga sin repintar el detalle completo, para no arrancarle el
      // foco a quien va saltando de campo en campo.
      catalogo = await api.obtener(`/catalogo${verBajas ? '?incluirBajas=1' : ''}`);
      inventario = await api.obtener('/inventario').catch(() => inventario);
      seleccionado = catalogo.productos.find((p) => p.id === seleccionado.id) || seleccionado;
      refrescarListas();
      refrescarMargen();
      // LOS DOS CAMPOS DEL VOLUMEN VAN JUNTOS: al poner uno se apaga o se
      // enciende la regla entera, y con ella la etiqueta del descuento, el
      // margen a ese precio y el aviso de estar vendiendo bajo costo. Eso
      // no se puede arreglar cambiando un número suelto en la pantalla:
      // hay que repintar el bloque.
      if (clave === 'mayoreoDesde' || clave === 'mayoreoPrecio') refrescarTarifas();
    } catch (e) {
      avisar(e.message, 'error');
      campoEl.value = campoEl.defaultValue;
    }
  }

  async function guardarCampoCategoria(campoEl) {
    const clave = campoEl.dataset.campoCat;
    try {
      await api.actualizar(`/catalogo/categorias/${categoriaAbierta}`,
                           { [clave]: campoEl.value });
      campoEl.classList.add('guardado');
      setTimeout(() => campoEl.classList.remove('guardado'), 900);
      catalogo = await api.obtener(`/catalogo${verBajas ? '?incluirBajas=1' : ''}`);
      refrescarListas();
    } catch (e) { avisar(e.message, 'error'); }
  }

  /** Repinta las dos listas de la izquierda sin tocar la ficha. */
  function refrescarListas() {
    const cats = pantalla.querySelector('.prod-categorias .cfg-lista');
    if (cats) {
      cats.innerHTML = catalogo.categorias.map((c) => filaCategoria(c)).join('');
      pantalla.querySelectorAll('[data-categoria]').forEach((b) => {
        b.onclick = () => {
          categoriaAbierta = b.dataset.categoria; busca = ''; seleccionado = null; pintar();
        };
      });
      pantalla.querySelectorAll('[data-cat-menu]').forEach((b) => {
        b.onclick = (ev) => {
          ev.stopPropagation();
          menuCategoria(catalogo.categorias.find((c) => c.id === b.dataset.catMenu));
        };
      });
    }
    refrescarProductos();
    refrescarTarjetas();
  }

  /** Los cuatro números de abajo, que cambian al mover un precio o un costo. */
  function refrescarTarjetas() {
    const caja = pantalla.querySelector('.prod-kpis');
    if (!caja) return;
    const nuevo = document.createElement('div');
    nuevo.innerHTML = tarjetasCatalogo();
    const reemplazo = nuevo.querySelector('.prod-kpis');
    if (reemplazo) caja.replaceWith(reemplazo);
  }

  /** El margen cambia al tocar el precio o el costo: se repinta solo él. */
  function refrescarMargen() {
    const caja = pantalla.querySelector('.margen');
    if (caja && seleccionado) caja.outerHTML = margen(seleccionado) || '';
  }

  /** El bloque 02 entero, cuando se enciende o se apaga el precio por volumen. */
  function refrescarTarifas() {
    const caja = pantalla.querySelector('.prod-volumen');
    if (!caja || !seleccionado) return;
    const nuevo = document.createElement('div');
    nuevo.innerHTML = tarifas(seleccionado);
    const reemplazo = nuevo.querySelector('.prod-volumen');
    if (reemplazo) caja.replaceWith(reemplazo);
    engancharDetalle();
  }

  // ==========================================================
  // FOTOS
  // ==========================================================
  function subirFoto(campoEl, que) {
    const archivo = campoEl.files?.[0];
    if (!archivo) return;

    const destino = que === 'categoria'
      ? `/catalogo/categorias/${categoriaAbierta}/foto`
      : `/catalogo/productos/${seleccionado.id}/foto`;

    const lector = new FileReader();
    lector.onload = async () => {
      try {
        await api.enviar(destino, { archivo: lector.result });
        avisar('Imagen puesta', 'bien');
        cargar();
      } catch (e) { avisar(e.message, 'error'); }
    };
    lector.readAsDataURL(archivo);
  }

  async function borrarFoto(que) {
    if (!await confirmar({
      titulo: '¿Quitar la imagen?',
      texto: 'Se queda sin imagen en la caja.',
      ok: 'Quitar', peligro: true
    })) return;

    const destino = que === 'categoria'
      ? `/catalogo/categorias/${categoriaAbierta}/foto/quitar`
      : `/catalogo/productos/${seleccionado.id}/foto/quitar`;
    try {
      await api.enviar(destino, {});
      avisar('Imagen eliminada', 'bien');
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
      seleccionado = null;
      avisar('Categoría creada', 'bien');
      cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function menuCategoria(c) {
    const que = await menu({
      titulo: c.nombre,
      opciones: [
        ...(c.activo
          ? [
              { valor: 'abrir', texto: 'Ver y editar', detalle: 'Nombre, color e imagen' },
              { valor: 'baja', texto: 'Dar de baja', detalle: 'Se lleva sus productos', peligro: true }
            ]
          : [{ valor: 'alta', texto: 'Volver a dar de alta' }]),
        ...(esAdmin
          ? [{ valor: 'borrar', texto: 'Eliminar',
               detalle: 'Se borra de verdad. Solo si está vacía', peligro: true }]
          : [])
      ]
    });
    if (!que) return;

    if (que === 'abrir') {
      categoriaAbierta = c.id; seleccionado = null; pintar();
      return;
    }

    if (que === 'alta') {
      try {
        await api.enviar(`/catalogo/categorias/${c.id}/alta`, {});
        avisar('Categoría recuperada', 'bien');
        cargar();
      } catch (e) { avisar(e.message, 'error'); }
      return;
    }

    if (que === 'borrar') { await eliminarCategoria(c); return; }

    const suyos = catalogo.productos.filter((p) => p.categoria_id === c.id && p.activo).length;
    if (!await confirmar({
      titulo: `¿Dar de baja ${c.nombre}?`,
      texto: suyos
        ? `Se dan de baja también sus ${suyos} producto${suyos === 1 ? '' : 's'}. Nada se borra: se pueden recuperar después.`
        : 'Nada se borra: se puede recuperar después.',
      ok: 'Dar de baja', peligro: true
    })) return;

    try {
      await api.enviar(`/catalogo/categorias/${c.id}/baja`, {});
      if (categoriaAbierta === c.id) { categoriaAbierta = ID_HIELO; seleccionado = null; }
      avisar('Categoría dada de baja', 'bien');
      cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  // ==========================================================
  // PRODUCTOS
  // ==========================================================

  /**
   * Alta de un producto. NO se pregunta si es hielo: lo dice la categoría
   * en la que se está. Preguntarlo sería pedirle al usuario que repita algo
   * que el sistema ya sabe.
   */
  async function nuevoProducto() {
    const tipo = esHielo() ? 'hielo' : 'simple';

    const nombre = await pedirTexto({
      titulo: esHielo() ? 'Nuevo botón de hielo' : 'Nuevo producto',
      texto: 'Como se va a leer en el botón y en el ticket.',
      marcador: esHielo() ? '1/4' : 'Coca Cola 600 ml',
      ok: 'Siguiente', largo: 40, unaLinea: true
    });
    if (!nombre) return;

    const cuerpo = { nombre, tipo, categoriaId: categoriaAbierta };

    if (esHielo()) {
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
        marcador: '25.00', ok: 'Crear el producto'
      });
      if (precio === null) return;
      cuerpo.precio = precio;
    }

    try {
      const r = await api.enviar('/catalogo/productos', cuerpo);
      seleccionado = r.producto;
      avisar('Producto creado. Puedes editar lo demás aquí mismo.', 'bien');
      cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  /**
   * Dar de baja. Si todavía queda mercancía, el servidor lo frena y pide el
   * PIN de un responsable: son piezas físicas que nadie va a volver a
   * contar, y eso es dinero que se pierde de vista.
   */
  async function darDeBaja(p) {
    if (!await confirmar({
      titulo: `¿Dar de baja ${p.nombre}?`,
      texto: 'Deja de aparecer en la caja. Los tickets viejos no cambian, y se puede recuperar después.',
      ok: 'Dar de baja', peligro: true
    })) return;

    try {
      await api.enviar(`/catalogo/productos/${p.id}/baja`, {});
      seleccionado = null;
      avisar('Producto dado de baja', 'bien');
      cargar();
      return;
    } catch (e) {
      if (!e.requiereAutorizacion) { avisar(e.message, 'error'); return; }

      const auth = await pedirAutorizacion({
        titulo: `Todavía quedan ${e.quedan} piezas`,
        texto: `${p.nombre} tiene mercancía en el almacén. Si se da de baja, esas piezas dejan de contarse. Un responsable tiene que autorizarlo.`,
        responsables: e.responsables,
        motivoSugerido: 'Ya no se va a vender'
      });
      if (!auth) return;

      try {
        await api.enviar(`/catalogo/productos/${p.id}/baja`, { autorizacion: auth });
        seleccionado = null;
        avisar('Producto dado de baja', 'bien');
        cargar();
      } catch (err) { avisar(err.message, 'error'); }
    }
  }

  /**
   * ELIMINAR DE VERDAD.
   *
   * Dar de baja es para lo de temporada: vuelve. Esto es para lo que nunca
   * debió estar —el producto de prueba, el que se dio de alta dos veces—.
   * El servidor solo lo permite si NUNCA se vendió: en cuanto algo salió en
   * un ticket, su nombre vive ahí y borrarlo dejaría el histórico mintiendo.
   */
  async function eliminarCategoria(c) {
    if (!await confirmar({
      titulo: `¿Eliminar ${c.nombre}?`,
      texto: 'Se borra de verdad. Solo se puede si ya no tiene productos dentro.',
      ok: 'Sí, eliminar', peligro: true
    })) return;

    try {
      await api.borrar(`/catalogo/categorias/${c.id}`, {});
    } catch (e) {
      if (!e.requiereContrasena) { avisar(e.message, 'error'); return; }
      const clave = await pedirContrasena({
        titulo: `Eliminar ${c.nombre}`,
        texto: 'Borrar no se deshace, así que va con la contraseña del administrador.',
        administradores: e.administradores || [], ok: 'Eliminar'
      });
      if (!clave) return;
      try {
        await api.borrar(`/catalogo/categorias/${c.id}`, { autorizacion: clave });
      } catch (err) { avisar(err.message, 'error'); return; }
    }

    avisar(`${c.nombre} eliminada`, 'bien');
    if (categoriaAbierta === c.id) categoriaAbierta = null;
    seleccionado = null;
    cargar();
  }

  async function eliminarProducto(p) {
    if (!p) return;
    if (!await confirmar({
      titulo: `¿Eliminar ${p.nombre}?`,
      texto: 'Se borra de verdad, no se puede recuperar. Si algún día hace falta, ' +
             'se vuelve a dar de alta en dos segundos. Para lo de temporada, mejor ' +
             'dale de baja.',
      ok: 'Sí, eliminar', peligro: true
    })) return;

    try {
      await api.borrar(`/catalogo/productos/${p.id}`, {});
    } catch (e) {
      if (!e.requiereContrasena) { avisar(e.message, 'error'); return; }

      const clave = await pedirContrasena({
        titulo: `Eliminar ${p.nombre}`,
        texto: 'Borrar no se deshace, así que va con la contraseña del administrador.',
        administradores: e.administradores || [],
        ok: 'Eliminar'
      });
      if (!clave) return;

      try {
        await api.borrar(`/catalogo/productos/${p.id}`, { autorizacion: clave });
      } catch (err) { avisar(err.message, 'error'); return; }
    }

    avisar(`${p.nombre} eliminado`, 'bien');
    seleccionado = null;
    cargar();
  }

  async function darDeAlta(p) {
    try {
      const r = await api.enviar(`/catalogo/productos/${p.id}/alta`, {});
      avisar(r.codigoPerdido
        ? `Recuperado. El código ${r.codigoPerdido} ya lo usa otro, así que quedó sin código.`
        : 'Producto recuperado', 'bien');
      seleccionado = r.producto;
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
      await api.actualizar(`/catalogo/productos/${p.id}`, { llevaInventario: true, minimo });
      avisar('Inventario activado. Ahora registra lo que hay.', 'bien');
      cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  /**
   * APAGARLO.
   *
   * Se podía encender y no se podía apagar, y eso dejaba un producto
   * pidiendo conteos para siempre por haberle dado una vez. No se borra
   * nada: las entradas, las salidas y los conteos se quedan donde están,
   * y el día que se vuelva a encender la cuenta sigue desde ahí. Lo único
   * que se apaga es el aviso de "ya hay que pedir más".
   */
  async function apagarInventario(p) {
    const sigue = await confirmar({
      titulo: `¿Dejar de llevar inventario de ${p.nombre}?`,
      texto: 'Deja de contarse y de avisar cuando baje. Lo ya registrado ' +
             '—entradas, salidas y conteos— NO se borra: si mañana lo ' +
             'vuelves a encender, la cuenta sigue desde donde iba.',
      ok: 'Dejar de llevarlo'
    });
    if (!sigue) return;

    try {
      await api.actualizar(`/catalogo/productos/${p.id}`, { llevaInventario: false });
      avisar(`${p.nombre} ya no lleva inventario`, 'bien');
      cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function movimientoInventario(p, tipo) {
    const esEntrada = tipo === 'entrada';

    const cantidad = await pedirTexto({
      titulo: esEntrada ? `Llegó mercancía de ${p.nombre}` : `Salida de ${p.nombre}`,
      texto: '¿Cuántas piezas?', marcador: '24',
      ok: 'Siguiente', largo: 8, unaLinea: true
    });
    if (!cantidad) return;

    const cuerpo = { tipo, cantidad };

    if (esEntrada) {
      const costo = await pedirImporte({
        titulo: '¿A cómo te salió cada una?',
        texto: 'Queda guardado tal cual: si mañana sube el proveedor, esta compra no cambia.',
        valor: paraEditar(p.costo_centavos),
        marcador: '18.00', ok: 'Registrar la entrada'
      });
      if (costo !== null) cuerpo.costo = costo;
    } else {
      const concepto = await pedirTexto({
        titulo: '¿Por qué sale?', texto: 'Se rompió, se lo llevaron, caducó…',
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
  async function guardarPrecios(listaId = null) {
    const tarjeta = listaId
      ? pantalla.querySelector(`[data-lista-precios="${listaId}"]`)
      : pantalla.querySelector('[data-lista-precios]');
    const lista = [...tarjeta.querySelectorAll('[data-precio]')].map((c) => ({
      dieciseisavos: Number(c.dataset.precio),
      pesos: Number(c.value.replace(/[^0-9.]/g, '')) || 0
    }));
    try {
      await api.actualizar(`/ventas/precios/${tarjeta.dataset.listaPrecios}`, { precios: lista });
      avisar('Precios guardados', 'bien');
      cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function crearListaMayoreo() {
    const nombre = await pedirTexto({
      titulo: 'Nueva lista de mayoreo',
      texto: 'Nace copiando los precios de público. Después le bajas los que toque.',
      marcador: 'Mayoreo 1', ok: 'Crearla', largo: 60, unaLinea: true
    });
    if (!nombre) return;
    try {
      await api.enviar('/ventas/precios/listas', { nombre });
      avisar(`Lista ${nombre} creada`, 'bien');
      await cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function hacerlaNormal(listaId) {
    try {
      const r = await api.actualizar(`/ventas/precios/listas/${listaId}/predeterminada`, {});
      avisar(`${r.lista.nombre} es ahora el precio de mayoreo normal`, 'bien');
      await cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  /**
   * DAR DE BAJA UNA LISTA DE MAYOREO.
   *
   * Se crean listas para probar precios de temporada y luego estorban en la
   * caja, donde cada lista de más es un botón más que leer con gente
   * esperando.
   *
   * Antes de confirmar se dice a cuántos clientes afecta: dar de baja una
   * lista que usan seis clientes no es lo mismo que dar de baja una que
   * nadie usa, y eso hay que saberlo ANTES de apretar.
   */
  async function darDeBajaLista(listaId) {
    const lista = (listas?.listas || []).find((l) => l.id === listaId);
    if (!lista) return;

    const cuantos = lista.clientes || 0;
    const sigue = await confirmar({
      titulo: `¿Dar de baja ${lista.nombre}?`,
      texto: (cuantos
        ? `${cuantos} ${cuantos === 1 ? 'cliente la tiene' : 'clientes la tienen'} ` +
          'asignada; ' + (cuantos === 1 ? 'pasa' : 'pasan') +
          ' al precio de mayoreo normal. '
        : '') +
        'Las ventas viejas no cambian: el precio quedó copiado en cada ticket. ' +
        'La lista deja de salir en la caja, pero su historia se conserva.',
      ok: 'Dar de baja', peligro: true
    });
    if (!sigue) return;

    try {
      const r = await api.enviar(`/ventas/precios/listas/${listaId}/baja`, {});
      avisar(`${lista.nombre} dada de baja` +
             (r.clientesMovidos ? ` · ${r.clientesMovidos} clientes al mayoreo normal` : '') +
             (r.nuevaPorOmision ? ` · ahora la normal es ${r.nuevaPorOmision.nombre}` : ''), 'bien');
      await cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function sugerir() {
    const tarjeta = pantalla.querySelector('[data-lista-precios]');
    const marqueta = Number(tarjeta.querySelector('[data-precio="16"]').value.replace(/[^0-9.]/g, ''));
    if (!marqueta) { avisar('Pon primero el precio de la marqueta', 'error'); return; }

    try {
      const { sugerencias } = await api.obtener(`/ventas/precios/sugerencia?marqueta=${marqueta}`);
      for (const s of sugerencias) {
        const campoEl = tarjeta.querySelector(`[data-precio="${s.dieciseisavos}"]`);
        if (campoEl) campoEl.value = paraEditar(s.centavos);
      }
      avisar('Es solo la parte proporcional. Súbelos si el corte da trabajo.', '');
    } catch (e) { avisar(e.message, 'error'); }
  }
}
