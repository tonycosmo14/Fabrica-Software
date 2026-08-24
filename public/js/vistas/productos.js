/**
 * PRODUCTOS, PRECIOS E INVENTARIO  (v1.4)
 *
 * Tres columnas a lo ancho, sin desplazar la página: categorías, productos
 * y el detalle de lo que se está viendo.
 *
 * SE EDITA EN EL SITIO. Nada de "Editar" que abra un formulario de cinco
 * pasos: se toca el nombre, el precio o el costo y se escribe encima. Sale
 * del campo y ya está guardado. Un formulario por paso está bien para dar
 * de alta algo nuevo; para corregir un precio es un estorbo.
 *
 * EL CAJERO ENTRA CON VISTA LIMITADA: ve cuántas piezas hay y puede
 * imprimir la hoja para contar. Ni los costos ni los botones de editar
 * existen para él, y tampoco los manda el servidor.
 */
import { api } from '../api.js';
import { esc, avisar, fecha as formatoFecha } from '../util.js';
import { pedirTexto, pedirImporte, confirmar, menu,
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
  let minimoMayoreo = 8;        // desde cuánto hielo aplica el precio de mayoreo
  let categoriaAbierta = ID_HIELO;
  let seleccionado = null;
  let verBajas = false;

  await cargar();

  async function cargar() {
    [catalogo, listas, inventario, existencia, alertas] = await Promise.all([
      api.obtener(`/catalogo${verBajas ? '?incluirBajas=1' : ''}`),
      api.obtener('/ventas/precios/listas').catch(() => ({ listas: [] })),
      api.obtener('/inventario').catch(() => ({ inventario: [], bajos: 0 })),
      api.obtener('/existencia').catch(() => ({ almacenes: [] })),
      api.obtener('/inventario/avisos').catch(() => ({ hielo: null }))
    ]);

    if (Number.isInteger(listas.minimoMayoreo)) minimoMayoreo = listas.minimoMayoreo;

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
    // Ojo con el respaldo: desde v1.9 hay listas de mayoreo en el mismo
    // arreglo, y la primera del orden podría ser una de ellas. La de público
    // es la que manda en esta pantalla.
    return listas.listas.find((l) => l.activa)
        || listas.listas.find((l) => l.tipo === 'publico')
        || listas.listas[0];
  }

  function precioDeHielo(dieciseisavos) {
    const t = new Map((listaActiva()?.precios || []).map((p) => [p.dieciseisavos, p.centavos]));
    let queda = dieciseisavos, centavos = 0;
    for (const paso of [16, 8, 4, 2, 1]) {
      while (queda >= paso) { centavos += t.get(paso) ?? 0; queda -= paso; }
    }
    return centavos;
  }

  function estadoDe(id) {
    return inventario.inventario.find((i) => i.producto.id === id) || null;
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
          <h2>${administra ? 'Productos y precios' : 'Inventario'}</h2>
          <div class="cfg-cabeza-acciones">
            ${inventario.bajos
              ? `<span class="etiqueta-mal">${inventario.bajos} por pedir</span>` : ''}
            <button class="secundario chico" id="hoja-inventario">🖨️ Hoja para contar</button>
            ${administra ? `
              <button class="secundario chico ${verBajas ? 'activo' : ''}" id="ver-bajas">
                ${verBajas ? 'Ocultar dados de baja' : 'Ver dados de baja'}
              </button>
              ` : ''}
          </div>
        </div>

        <div class="cfg-tablero">
          <aside class="cfg-columna">
            <p class="cfg-titulo">Categorías</p>
            <div class="cfg-lista">
              ${catalogo.categorias.map((c) => filaCategoria(c)).join('')}
            </div>
            ${administra ? '<button class="secundario chico" id="nueva-cat">＋ Categoría</button>' : ''}
          </aside>

          <section class="cfg-columna">
            <p class="cfg-titulo">${esc(cat?.nombre || 'Productos')}</p>
            <div class="cfg-lista cfg-productos">
              ${suyos.map((p) => filaProducto(p)).join('')
                || '<p class="vacio" style="padding:24px 0">Sin productos aquí.</p>'}
            </div>
            ${administra && cat && cat.activo
              ? '<button class="secundario chico" id="nuevo-prod">＋ Producto</button>' : ''}
          </section>

          <section class="cfg-columna cfg-detalle" id="detalle">
            ${panelDerecho()}
          </section>
        </div>
      </div>`;

    enganchar();
  }

  function filaCategoria(c) {
    const especial = c.id === ID_HIELO;
    return `
      <div class="cfg-fila-cat ${c.id === categoriaAbierta ? 'activo' : ''}
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
              ? pesos(precioDeHielo(p.dieciseisavos))
              : pesos(p.precio_centavos)}
            ${p.activo ? '' : ' · dado de baja'}
          </small>
        </span>
        ${inv ? `<small class="cfg-stock ${inv.bajo ? 'bajo' : ''}">${inv.esperado}</small>` : ''}
      </button>`;
  }

  function panelDerecho() {
    if (seleccionado) return panelProducto(seleccionado);
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

  // ==========================================================
  // PANEL: UN PRODUCTO
  // ==========================================================
  function panelProducto(p) {
    const inv = estadoDe(p.id);
    const esDeHielo = p.tipo === 'hielo';
    const precio = esDeHielo ? precioDeHielo(p.dieciseisavos) : p.precio_centavos;

    return `
      <div class="cfg-detalle-cabeza">
        <div class="cfg-foto-grande">
          ${p.foto
            ? `<img src="/fotos/${esc(p.foto)}" alt="">
               ${administra ? '<button class="tachita" id="quitar-foto" aria-label="Quitar la foto">×</button>' : ''}`
            : '<span class="cfg-foto-vacia grande">📦</span>'}
        </div>
        <div class="crece">
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

      <div class="cuadre">
        ${campo('Nombre', 'nombre', p.nombre)}
        ${campo('Código para teclear', 'codigo', p.codigo || '',
                { ayuda: 'lo que se teclea en la caja' })}
        ${esDeHielo ? `
          <div class="cuadre-linea">
            <span>Entrega</span>
            <strong>${esc(p.dieciseisavos === 16 ? 'una marqueta'
                     : aTexto(p.dieciseisavos) + ' de marqueta')}</strong>
          </div>
          <div class="cuadre-linea total">
            <span>Cuesta hoy</span><strong>${pesos(precio)}</strong>
          </div>`
        : `
          ${campo('Precio de venta', 'precio', paraEditar(p.precio_centavos), { tipo: 'dinero' })}
          ${veCostos
            ? campo('Te cuesta', 'costo',
                    paraEditar(p.costo_centavos),
                    { tipo: 'dinero' })
            : ''}`}
      </div>

      ${administra ? `
        <div class="fila-botones" style="margin-top:14px;flex-wrap:wrap">
          ${p.activo
            ? '<button class="secundario chico peligro" id="baja-prod">Dar de baja</button>'
            : '<button class="chico" id="alta-prod">Volver a dar de alta</button>'}
          ${esAdmin
            ? '<button class="secundario chico peligro" id="borrar-prod">Eliminar</button>' : ''}
        </div>` : ''}

      ${esDeHielo ? panelExistenciaHielo() : panelInventario(p, inv)}`;
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

  /** Para el hielo, el inventario ES la existencia del cuarto frío. */
  function panelExistenciaHielo() {
    const a = existencia.almacenes?.[0];
    if (!a) return '';
    return `
      <h4 class="cfg-subtitulo">Existencia del cuarto frío</h4>
      <p class="ayuda">
        El hielo no se cuenta por piezas: se mide en marquetas y se cuenta
        dos veces al día. Esto es lo mismo que ves en <b>Existencia</b>.
      </p>
      <div class="cuadre">
        <div class="cuadre-linea"><span>Había</span><strong>${esc(a.textos.anterior)}</strong></div>
        <div class="cuadre-linea suma"><span>+ Se produjo</span><strong>${esc(a.textos.producido)}</strong></div>
        <div class="cuadre-linea vendido"><span>− Se vendió</span><strong>${esc(a.textos.vendido)}</strong></div>
        <div class="cuadre-linea total"><span>= Debería haber</span><strong>${esc(a.textos.esperado)}</strong></div>
      </div>
      <a class="boton secundario chico" href="#/existencia" style="margin-top:12px">Ir a Existencia</a>`;
  }

  function panelInventario(p, inv) {
    if (!p.lleva_inventario) {
      if (!administra) return '';
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
        A cada cliente se le apunta su lista en su ficha, en Clientes. En la
        caja el precio cambia solo en cuanto el cajero dice quién es.
      </p>

      <div class="cuadre" style="margin-bottom:14px">
        <div class="cuadre-linea campo-vivo">
          <span>Desde cuánto hielo aplica<small>en dieciseisavos: 8 es media marqueta</small></span>
          <input inputmode="numeric" id="mayoreo-minimo" value="${esc(String(minimoMayoreo))}">
        </div>
      </div>

      ${deMayoreo.map((l) => `
        <div class="tarjeta-mayoreo">
          <div class="fila-botones" style="justify-content:space-between;align-items:center">
            <strong>${esc(l.nombre)}</strong>
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
   * es lo que se ha capturado. Los obreros sacan hielo toda la mañana y
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
        el número va atrasado hasta que los obreros reportan lo que sacaron.
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

    todos('[data-categoria]').forEach((b) => {
      b.onclick = () => { categoriaAbierta = b.dataset.categoria; seleccionado = null; pintar(); };
    });
    todos('[data-cat-menu]').forEach((b) => {
      b.onclick = (ev) => {
        ev.stopPropagation();
        menuCategoria(catalogo.categorias.find((c) => c.id === b.dataset.catMenu));
      };
    });
    todos('[data-prod]').forEach((b) => {
      b.onclick = () => {
        seleccionado = catalogo.productos.find((p) => p.id === b.dataset.prod);
        pintar();
      };
    });

    engancharDetalle();
  }

  function engancharDetalle() {
    const q = (sel) => pantalla.querySelector(sel);

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
    const activar = q('#activar-inv');
    if (activar) activar.onclick = () => activarInventario(seleccionado);
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
    const minMay = q('#mayoreo-minimo');
    if (minMay) {
      minMay.onblur = () => guardarMinimoMayoreo(minMay);
      minMay.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); minMay.blur(); } };
    }
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

  /** Guarda un campo del producto en cuanto se sale de él. */
  async function guardarCampo(campoEl) {
    const clave = campoEl.dataset.campo;
    const valor = campoEl.value.trim();

    try {
      const r = await api.actualizar(`/catalogo/productos/${seleccionado.id}`,
                                     { [clave]: valor });
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
      refrescarListas();
      refrescarMargen();
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

  /** Repinta solo las dos listas de la izquierda. */
  function refrescarListas() {
    const izq = pantalla.querySelectorAll('.cfg-lista');
    if (izq[0]) {
      izq[0].innerHTML = catalogo.categorias.map((c) => filaCategoria(c)).join('');
    }
    if (izq[1]) {
      izq[1].innerHTML = catalogo.productos
        .filter((p) => p.categoria_id === categoriaAbierta)
        .map((p) => filaProducto(p)).join('');
    }
    pantalla.querySelectorAll('[data-categoria]').forEach((b) => {
      b.onclick = () => { categoriaAbierta = b.dataset.categoria; seleccionado = null; pintar(); };
    });
    pantalla.querySelectorAll('[data-cat-menu]').forEach((b) => {
      b.onclick = (ev) => {
        ev.stopPropagation();
        menuCategoria(catalogo.categorias.find((c) => c.id === b.dataset.catMenu));
      };
    });
    pantalla.querySelectorAll('[data-prod]').forEach((b) => {
      b.onclick = () => {
        seleccionado = catalogo.productos.find((p) => p.id === b.dataset.prod);
        pintar();
      };
    });
  }

  /** El margen cambia al tocar el precio o el costo: se repinta solo él. */
  function refrescarMargen() {
    const caja = pantalla.querySelector('.margen');
    if (caja && seleccionado) caja.outerHTML = margen(seleccionado) || '';
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

  async function guardarMinimoMayoreo(campoEl) {
    const crudo = campoEl.value.trim();
    try {
      const r = await api.actualizar('/ventas/precios/mayoreo-minimo', { dieciseisavos: crudo });
      minimoMayoreo = r.minimo;
      campoEl.classList.add('guardado');
      setTimeout(() => campoEl.classList.remove('guardado'), 900);
      avisar(`El mayoreo aplica desde ${aTexto(r.minimo)} de hielo`, 'bien');
    } catch (e) {
      avisar(e.message, 'error');
      campoEl.value = String(minimoMayoreo);
    }
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
