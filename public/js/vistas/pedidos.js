/**
 * CONTROL Y DESPACHO DE PEDIDOS  (v5.6 · rediseñada en la v7.0)
 *
 * "Te comparto igual cómo se va a ver la parte de pedidos."
 *
 * Una pantalla, tres piezas:
 *
 *   LAS SEIS ETAPAS, arriba, con cuántos hay en cada una. Se tocan y
 *   filtran la lista: es el filtro más usado y por eso no está escondido
 *   en un desplegable.
 *   LA TABLA, con guía, cliente y giro, monto y cómo cobra, y en qué
 *   camioneta va. Es lo que se recorre buscando "¿este ya salió?".
 *   LA INSPECCIÓN, al lado: a dónde va, qué se hace al llegar, qué lleva
 *   línea por línea, y los botones de lo que se hace con él.
 *
 * ============================================================
 * LAS ETAPAS NO SON ESTADOS DE LA BASE
 * ============================================================
 *
 * En la base hay tres —pendiente, entregado, cancelado— y así se queda:
 * son los tres que cambian el dinero. «En preparación» y «en ruta» se
 * DEDUCEN de en qué salida va el pedido y de cómo va esa salida.
 * Guardarlas sería tener dos verdades sobre lo mismo.
 *
 * ============================================================
 * DÓNDE SE TOMAN
 * ============================================================
 *
 * En VENDER, no aquí. Un pedido se arma igual que un ticket —los mismos
 * botones, los mismos precios, el mismo teclado de fracciones— y lo único
 * distinto es que en vez de cobrarlo se aparta. Copiar esa pantalla aquí
 * sería mantener dos puntos de venta que tienen que dar el mismo precio, y
 * el día que se separen nadie sabrá cuál miente. El botón de arriba lleva
 * allá.
 *
 * ============================================================
 * Y LA HOJA DE PREPARACIÓN SIGUE AQUÍ
 * ============================================================
 *
 * "Necesito saber cuántos botellones voy a llenar y cuántas bolsas voy a
 *  subir." Eso es todo sumado por producto y partido por área, y se lee en
 * la planta con las manos mojadas. No es una vista más de la lista: es un
 * papel, y por eso vive en un botón de imprimir y no en una pestaña.
 */
import { api } from '../api.js';
import { esc, avisar, soloHora } from '../util.js';
import { confirmar, pedirTexto, menu, verTicket } from '../dialogo.js';
import { pesos } from '../fracciones.js';
import { imprimirTicket, htmlDeEspejo } from '../imprimir.js';
import { armarSalida } from '../armar-salida.js';

const FORMAS = {
  efectivo: { texto: 'Efectivo', emoji: '💵' },
  transferencia: { texto: 'Transferencia', emoji: '📲' },
  credito: { texto: 'A crédito', emoji: '📗' }
};

const hoy = () => new Date().toISOString().slice(0, 10);

/** "hoy", "mañana", "el sábado" o la fecha, como se diría en voz alta. */
function cuando(dia) {
  if (!dia) return '';
  const d = hoy();
  if (dia === d) return 'hoy';
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  if (dia === manana.toISOString().slice(0, 10)) return 'mañana';
  if (dia < d) return `atrasado (${dia.slice(8)}/${dia.slice(5, 7)})`;
  return `${dia.slice(8)}/${dia.slice(5, 7)}`;
}

/**
 * LOS RANGOS DE FECHA que se piden de verdad.
 *
 * «Hoy» incluye lo atrasado a propósito: un pedido de ayer que no salió
 * sigue debiéndose, y esconderlo porque cambió el día es la forma más
 * fácil de perder un cliente.
 */
const RANGOS = [
  { clave: 'hoy', nombre: 'Hoy y lo atrasado' },
  { clave: 'manana', nombre: 'Hasta mañana' },
  { clave: 'semana', nombre: 'Los próximos 7 días' },
  { clave: 'todo', nombre: 'Todo, sin límite de fecha' }
];

function rangoDe(clave) {
  const d = new Date();
  if (clave === 'manana') { d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }
  if (clave === 'semana') { d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); }
  if (clave === 'todo') return null;
  return hoy();
}

/** "#GL-0047" — el número de guía, como se dice y como se busca. */
const guia = (folio) => `#GL-${String(folio ?? 0).padStart(4, '0')}`;

export async function vistaPedidos(pantalla, estado) {
  const puede = (p) => estado.permisos.includes('*') || estado.permisos.includes(p);
  const opera = puede('reparto.operar');

  let rango = 'hoy';
  let etapa = 'todos';
  let busca = '';
  let producto = '';
  let datos = null;
  let prep = null;
  let abierto = null;      // el pedido que se está inspeccionando

  await pintar();

  async function cargar() {
    const hasta = rangoDe(rango);
    const q = new URLSearchParams({ estado: 'todos' });
    if (hasta) q.set('hasta', hasta);
    if (etapa && etapa !== 'todos') q.set('etapa', etapa);
    if (busca) q.set('busca', busca);
    if (producto) q.set('producto', producto);

    const [lista, preparacion] = await Promise.all([
      api.obtener(`/pedidos?${q}`),
      api.obtener(`/pedidos/preparacion?hasta=${hasta || '2999-12-31'}`)
    ]);
    datos = lista;
    prep = preparacion.preparacion;

    // El que estaba abierto puede haberse ido con el filtro, o haber
    // cambiado de etapa: se refresca de la lista o se cierra.
    if (abierto) {
      abierto = datos.pedidos.find((p) => p.id === abierto.id) || null;
    }
  }

  async function pintar() {
    pantalla.innerHTML = '<div class="cargando">Buscando los pedidos…</div>';
    try { await cargar(); } catch (e) {
      pantalla.innerHTML = `<p class="vacio">${esc(e.message)}</p>`;
      return;
    }

    pantalla.innerHTML = `
      <div class="ped-pantalla ancho-completo">
        <div class="ped-cabecera">
          <div>
            <p class="ped-kicker">Flujo de despacho y cadena de frío</p>
            <h2>Control y despacho de pedidos</h2>
          </div>
          <div class="ped-cabecera-acciones">
            <button class="secundario" id="exportar">⬇ Exportar a Excel</button>
            <button class="secundario" id="imprimir-prep">🖨️ Hoja de preparación</button>
            ${puede('pedidos.tomar')
              ? '<button id="nuevo-pedido">＋ Tomar un pedido</button>' : ''}
          </div>
        </div>

        ${tarjetasEtapa()}

        <div class="ped-filtros">
          <input id="busca" class="buscador" autocomplete="off"
                 placeholder="Buscar por guía (#GL-), cliente, giro o dirección…"
                 value="${esc(busca)}">
          <label class="ped-filtro">
            <span>Para cuándo</span>
            <select id="rango">
              ${RANGOS.map((r) => `
                <option value="${r.clave}" ${rango === r.clave ? 'selected' : ''}>
                  ${esc(r.nombre)}
                </option>`).join('')}
            </select>
          </label>
          <label class="ped-filtro">
            <span>Producto</span>
            <select id="producto">
              <option value="">Todos los productos</option>
              ${(datos.productos || []).map((p) => `
                <option value="${esc(p.id)}" ${producto === p.id ? 'selected' : ''}>
                  ${esc(p.nombre)}
                </option>`).join('')}
            </select>
          </label>
          ${busca || producto || etapa !== 'todos' ? `
            <button class="secundario chico" id="limpiar">Quitar los filtros</button>` : ''}
        </div>

        <div class="ped-tablero">
          <section class="ped-lista">
            <div class="ped-lista-cabeza">
              <h3>Pedidos
                <small>${datos.pedidos.length} de ${datos.resumen.todos} en el rango</small>
              </h3>
              <div class="ped-lista-acciones">
                ${opera && sinCamioneta().length ? `
                  <button class="secundario chico" id="armar-salida">
                    🚚 Armar salida con ${sinCamioneta().length}
                  </button>` : ''}
                <button class="secundario chico" id="imprimir-todas">🖨️ Todas las notas</button>
              </div>
            </div>

            ${datos.pedidos.length ? `
              <div class="ped-tabla-marco">
                <table class="ped-tabla">
                  <thead>
                    <tr>
                      <th>Guía / ingreso</th>
                      <th>Cliente y giro</th>
                      <th class="der">Monto y cobro</th>
                      <th>Unidad asignada</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>${datos.pedidos.map(renglon).join('')}</tbody>
                </table>
              </div>` : `
              <p class="vacio" style="padding:32px 0">${
                busca ? 'Ningún pedido con eso.'
                : etapa !== 'todos'
                  ? `Nada en «${esc(nombreEtapa(etapa))}» ${esc(textoRango())}.`
                  : `No hay pedidos ${esc(textoRango())}. Se toman desde Vender.`}</p>`}
          </section>

          <aside class="ped-inspeccion" id="inspeccion">
            ${panelInspeccion()}
          </aside>
        </div>
      </div>`;

    conectar();
  }

  const nombreEtapa = (clave) =>
    (datos.etapas || []).find((e) => e.clave === clave)?.nombre || clave;

  const textoRango = () =>
    RANGOS.find((r) => r.clave === rango)?.nombre.toLowerCase() || '';

  /**
   * LAS SEIS ETAPAS, con cuántos hay en cada una.
   *
   * Se tocan y filtran: es el filtro que se usa noventa veces de cada
   * cien —"¿qué falta por salir?"— y esconderlo en un desplegable sería
   * cobrar dos toques por la pregunta más común.
   *
   * Los números se cuentan sobre el rango de fechas pero SIN el resto de
   * filtros: si al tocar «En ruta» los seis se recalcularan sobre lo
   * filtrado, cinco se pondrían en cero y no habría forma de volver.
   */
  function tarjetasEtapa() {
    const r = datos.resumen;
    const pies = {
      todos: r.porCobrar ? `${pesos(r.porCobrar)} por cobrar` : 'nada pendiente',
      pendiente: 'sin camioneta',
      preparacion: 'cargando',
      ruta: r.unidades
        ? `${r.unidades} unidad${r.unidades === 1 ? '' : 'es'}` : 'ninguna unidad',
      entregado: 'ya son ventas',
      cancelado: `${r.porcentajeCancelados}% del flujo`
    };

    return `
      <div class="ped-etapas">
        ${(datos.etapas || []).map((e) => `
          <button class="ped-etapa ${etapa === e.clave ? 'activa' : ''} etapa-${e.clave}"
                  data-etapa="${e.clave}">
            <span class="ped-etapa-cabeza">
              <span class="ped-etapa-nombre">${esc(e.nombre)}</span>
              <span class="ped-etapa-icono">${e.emoji}</span>
            </span>
            <strong>${r[e.clave] ?? 0}</strong>
            <span class="ped-etapa-pie">${esc(pies[e.clave] || e.pie)}</span>
          </button>`).join('')}
      </div>`;
  }

  /**
   * CÓMO SE COBRA ESTE PEDIDO, en dos palabras.
   *
   * Es lo que el repartidor necesita saber antes de salir: si va a cobrar
   * o no, y de qué forma. Sale de la forma de pago que se dijo al tomarlo
   * y, cuando es a crédito, del plazo del propio cliente.
   */
  function comoCobra(p) {
    if (p.estado === 'entregado') return { texto: 'Cobrado', tono: 'ok' };
    if (p.forma_pago === 'credito') {
      return {
        texto: p.cliente_dias_plazo ? `Crédito ${p.cliente_dias_plazo} d` : 'A crédito',
        tono: 'credito'
      };
    }
    if (p.forma_pago === 'transferencia') return { texto: 'Transferencia', tono: 'ok' };
    return { texto: 'Contra entrega', tono: 'contado' };
  }

  function renglon(p) {
    const cobro = comoCobra(p);
    const atrasado = p.estado === 'pendiente' && p.para_cuando < hoy();
    const s = p.salida;

    return `
      <tr class="ped-fila ${abierto?.id === p.id ? 'activa' : ''} ${atrasado ? 'atrasada' : ''}"
          data-abrir="${esc(p.id)}">
        <td class="ped-guia">
          ${esc(guia(p.folio))}
          <small>${esc(soloHora(p.fecha))} · ${esc(cuando(p.para_cuando))}</small>
        </td>

        <td>
          <strong>${esc(p.cliente_negocio || p.cliente_nombre)}</strong>
          <small>${esc(p.cliente_giro || p.cliente_zona || p.cliente_nombre || '—')}</small>
        </td>

        <td class="der ped-monto">
          <strong>${pesos(p.total)}</strong>
          <small class="ped-cobro ${cobro.tono}">● ${esc(cobro.texto)}</small>
        </td>

        <td>
          ${s ? `
            <span class="ped-unidad">
              <span class="ped-unidad-num">${String(s.folio ?? 0).padStart(2, '0')}</span>
              <span>
                <strong>${esc(s.repartidor_nombre || 'sin chofer')}</strong>
                <small>${esc(s.vehiculo_nombre || 'sin camioneta')}${
                  s.orden ? ` · parada ${s.orden}` : ''}</small>
              </span>
            </span>`
          : p.tipo === 'recoger'
            ? '<small class="ped-sin">🏪 Lo pasan a buscar</small>'
            : '<small class="ped-sin">Sin asignar</small>'}
        </td>

        <td class="ped-acciones-celda">
          <button class="ped-accion" data-ver="${esc(p.id)}" title="Ver su nota">👁</button>
          <button class="ped-accion" data-nota="${esc(p.id)}" title="Imprimir su nota">🖨</button>
          ${opera && !s && p.estado === 'pendiente' && p.tipo !== 'recoger' ? `
            <button class="ped-accion" data-subir="${esc(p.id)}"
                    title="Subirlo a una camioneta">⇄</button>` : ''}
        </td>
      </tr>`;
  }

  /** La inspección del pedido abierto: a dónde va y qué lleva. */
  function panelInspeccion() {
    if (!abierto) {
      return `
        <div class="ped-inspeccion-vacia">
          <span>📦</span>
          <p>Toca un pedido para ver a dónde va, qué lleva y qué se hace al llegar.</p>
        </div>`;
    }

    const p = abierto;
    const cobro = comoCobra(p);
    const s = p.salida;
    const tel = String(s?.repartidor_telefono || '').replace(/[^\d+]/g, '');

    return `
      <div class="ped-insp-cabeza">
        <div>
          <h3>Inspección del pedido</h3>
          <p class="ped-insp-estado ${p.etapa}">
            ${p.etapaTexto?.emoji || ''} ${esc(p.etapaTexto?.uno || p.etapa)}
          </p>
        </div>
        <span class="ped-insp-guia">${esc(guia(p.folio))}</span>
        <button class="ped-accion" id="cerrar-insp" title="Cerrar">✕</button>
      </div>

      <div class="ped-insp-cliente">
        <span class="etiqueta-chica">Cliente y giro</span>
        <strong>${esc(p.cliente_negocio || p.cliente_nombre)}</strong>
        <small>${esc(p.cliente_giro || 'sin giro')}${
          p.cliente_numero ? ` · Cód. CLT-${String(p.cliente_numero).padStart(3, '0')}` : ''}</small>
        ${p.direccion ? `<p class="ped-insp-dir">📍 ${esc(p.direccion)}</p>` : ''}
        ${p.horario ? `<p class="ped-insp-dir">🕒 ${esc(p.horario)}</p>` : ''}
        ${p.referencias ? `<p class="ped-insp-dir">🔎 ${esc(p.referencias)}</p>` : ''}
      </div>

      ${p.instrucciones ? `
        <div class="ped-instrucciones">
          <span class="etiqueta-chica">Instrucciones de descarga</span>
          <p>${esc(p.instrucciones)}</p>
        </div>` : ''}

      ${p.notas ? `
        <div class="ped-instrucciones nota">
          <span class="etiqueta-chica">Nota de este pedido</span>
          <p>${esc(p.notas)}</p>
        </div>` : ''}

      <span class="etiqueta-chica" style="display:block;margin-top:14px">Qué lleva</span>
      <table class="tabla ped-desglose">
        <tr><th>Producto</th><th class="der">Cant.</th>
            <th class="der">P. unit.</th><th class="der">Subtotal</th></tr>
        ${p.lineas.map((l) => `
          <tr>
            <!-- El desglose solo cuando dice algo que no está ya en la
                 columna de al lado: "1/4 + 1/8" sí, "10 × Garrafón" no. -->
            <td>${esc(l.concepto)}${l.dieciseisavos > 0 && l.desglose
              ? `<small>${esc(l.desglose)}</small>` : ''}</td>
            <td class="der">${esc(l.texto)}</td>
            <td class="der">${l.cantidad > 1
              ? pesos(Math.round(l.precio_centavos / l.cantidad)) : pesos(l.precio_centavos)}</td>
            <td class="der"><strong>${pesos(l.precio_centavos)}</strong></td>
          </tr>`).join('')}
      </table>

      <div class="ped-insp-total">
        <span>Total del pedido<small class="ped-cobro ${cobro.tono}">● ${esc(cobro.texto)}</small></span>
        <strong>${pesos(p.total)}<small> MXN</small></strong>
      </div>

      ${s ? `
        <div class="ped-insp-unidad">
          <span class="etiqueta-chica">Va en la salida ${String(s.folio ?? 0).padStart(2, '0')}</span>
          <strong>${esc(s.repartidor_nombre || 'sin chofer')}</strong>
          <small>${esc(s.vehiculo_nombre || 'sin camioneta')}${
            s.vehiculo_placas ? ` · ${esc(s.vehiculo_placas)}` : ''}${
            s.orden ? ` · parada ${s.orden}` : ''}</small>
        </div>` : ''}

      <div class="ped-insp-botones">
        <button class="secundario" data-nota="${esc(p.id)}">🖨️ Remisión</button>
        ${tel ? `
          <a class="boton-enlace" href="https://wa.me/${esc(tel.replace(/^\+/, ''))}"
             target="_blank" rel="noopener">📲 Contactar al chofer</a>` : ''}
        ${p.estado === 'pendiente' ? `
          ${opera && !s && p.tipo !== 'recoger' ? `
            <button class="secundario" data-subir="${esc(p.id)}">🚚 Subir a una camioneta</button>` : ''}
          ${puede('pedidos.entregar') ? `
            <button data-entregar="${esc(p.id)}">✅ Entregado — cobrar</button>` : ''}
          ${puede('pedidos.tomar') ? `
            <button class="secundario chico peligro" data-cancelar="${esc(p.id)}">
              Cancelar el pedido
            </button>` : ''}` : ''}
      </div>

      ${p.estado === 'cancelado' ? `
        <p class="ayuda malo" style="margin-top:12px">
          Cancelado${p.motivo_cancelacion ? `: «${esc(p.motivo_cancelacion)}»` : ''}.
        </p>` : ''}
      ${p.estado === 'entregado' ? `
        <p class="ayuda" style="margin-top:12px">
          Entregado y cobrado${p.venta_folio ? ` · ticket ${esc(String(p.venta_folio))}` : ''}.
        </p>` : ''}`;
  }

  // ==========================================================
  // ENGANCHAR
  // ==========================================================
  function conectar() {
    const q = (sel) => pantalla.querySelector(sel);

    const buscador = q('#busca');
    let espera;
    buscador.oninput = () => {
      clearTimeout(espera);
      espera = setTimeout(() => { busca = buscador.value.trim(); pintar(); }, 300);
    };
    buscador.onkeydown = (ev) => { if (ev.key === 'Enter') ev.preventDefault(); };

    q('#rango').onchange = (ev) => { rango = ev.target.value; pintar(); };
    q('#producto').onchange = (ev) => { producto = ev.target.value; pintar(); };
    const limpiar = q('#limpiar');
    if (limpiar) limpiar.onclick = () => {
      busca = ''; producto = ''; etapa = 'todos'; pintar();
    };

    pantalla.querySelectorAll('[data-etapa]').forEach((b) => {
      // Volver a tocar la etapa activa la quita: es como se sale de un
      // filtro sin ir a buscar el botón de quitarlo.
      b.onclick = () => {
        etapa = etapa === b.dataset.etapa ? 'todos' : b.dataset.etapa;
        pintar();
      };
    });

    pantalla.querySelectorAll('[data-abrir]').forEach((f) => {
      f.onclick = () => {
        abierto = datos.pedidos.find((p) => p.id === f.dataset.abrir) || null;
        pintar();
      };
    });
    const cerrar = q('#cerrar-insp');
    if (cerrar) cerrar.onclick = () => { abierto = null; pintar(); };

    q('#exportar').onclick = exportar;
    q('#imprimir-prep').onclick = imprimirPreparacion;
    const nuevo = q('#nuevo-pedido');
    if (nuevo) nuevo.onclick = () => { location.hash = '#/venta'; };

    const todas = q('#imprimir-todas');
    if (todas) todas.onclick = imprimirTodas;
    const armar = q('#armar-salida');
    if (armar) armar.onclick = () => armarDesdeAqui();

    // Los botones de cada renglón no deben abrir la ficha además de hacer
    // lo suyo: el clic se para aquí.
    const suelto = (sel, hacer) => pantalla.querySelectorAll(sel).forEach((b) => {
      b.onclick = (ev) => { ev.stopPropagation(); hacer(b.dataset); };
    });
    suelto('[data-ver]', (d) => verNota(d.ver));
    suelto('[data-nota]', (d) => imprimirNota(d.nota));
    suelto('[data-subir]', (d) => armarDesdeAqui([d.subir]));
    suelto('[data-entregar]', (d) => entregar(d.entregar));
    suelto('[data-cancelar]', (d) => cancelar(d.cancelar));
  }

  /** Los de domicilio pendientes que todavía no van en ninguna salida. */
  function sinCamioneta() {
    return (datos?.pedidos || [])
      .filter((p) => p.estado === 'pendiente' && p.tipo !== 'recoger' && !p.salida);
  }

  // ==========================================================
  // LO QUE SE HACE CON ELLOS
  // ==========================================================

  /**
   * BAJARSE LA LISTA PARA ABRIRLA EN EXCEL.
   *
   * Se pide con los MISMOS filtros que se están viendo: quien exporta
   * quiere lo que tiene delante, no la base entera. El servidor la manda
   * como CSV y el navegador la guarda.
   */
  function exportar() {
    const hasta = rangoDe(rango);
    const q = new URLSearchParams({ estado: 'todos' });
    if (hasta) q.set('hasta', hasta);
    if (etapa && etapa !== 'todos') q.set('etapa', etapa);
    if (busca) q.set('busca', busca);
    if (producto) q.set('producto', producto);
    // Una navegación normal: el servidor manda el archivo con su nombre y
    // el navegador lo baja sin salirse de la pantalla.
    window.location.href = `/api/pedidos/exportar?${q}`;
    avisar('Bajando la lista…', '');
  }

  async function armarDesdeAqui(soloIds = null) {
    const salida = await armarSalida({ hasta: rangoDe(rango) || hoy(), marcados: soloIds });
    if (!salida) return;
    await pintar();
  }

  async function imprimirPreparacion() {
    const hasta = rangoDe(rango) || '2999-12-31';
    try {
      const r = await api.enviar('/impresion/preparacion', { hasta });
      if (r.impreso) return avisar('Hoja de preparación impresa', 'bien');
      const previa = await api.obtener(`/impresion/preparacion/previa?hasta=${hasta}`);
      const que = await verTicket({
        titulo: 'Para preparar', renglones: previa.renglones, ancho: previa.ancho,
        notas: [`${prep.pedidos} pedidos · ${prep.clientes} clientes`,
                'No hay impresora térmica configurada.'],
        acciones: [{ valor: 'imprimir', texto: '🖨️ Imprimir' }]
      });
      if (que === 'imprimir') imprimirTicket(htmlDeEspejo(previa.renglones, previa.ancho));
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function verNota(id) {
    try {
      const previa = await api.obtener(`/impresion/pedido/${id}/previa`);
      const p = (datos?.pedidos || []).find((x) => String(x.id) === String(id));
      const que = await verTicket({
        titulo: p?.tipo === 'recoger' ? 'Apartado' : 'Nota de entrega',
        renglones: previa.renglones, ancho: previa.ancho,
        acciones: [{ valor: 'imprimir', texto: '🖨️ Imprimir' }]
      });
      if (que === 'imprimir') imprimirTicket(htmlDeEspejo(previa.renglones, previa.ancho));
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function imprimirNota(id) {
    try {
      const r = await api.enviar(`/impresion/pedido/${id}`, {});
      if (r.impreso) return avisar('Impreso', 'bien');
      await verNota(id);
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function imprimirTodas() {
    try {
      const r = await api.enviar('/impresion/pedidos/notas', { hasta: rangoDe(rango) || hoy() });
      if (!r.impreso) {
        return avisar('No hay impresora térmica: imprime una por una con el ojito.', 'error');
      }
      // SI ALGUNA NO SALIÓ, SE DICE CUÁL. Con siete notas en la mano y una
      // que faltó, saber de quién es ahorra el viaje de vuelta.
      if (r.fallaron?.length) {
        avisar(`Salieron ${r.impresas}. No salió: ${r.fallaron.join(', ')}`, 'error');
      } else {
        avisar(`${r.impresas} nota${r.impresas === 1 ? '' : 's'} impresa${r.impresas === 1 ? '' : 's'}`, 'bien');
      }
    } catch (e) { avisar(e.message, 'error'); }
  }

  /**
   * ENTREGADO — y aquí nace la venta.
   *
   * Se pregunta cómo pagó, porque en la puerta el cliente cambia de
   * opinión: iba a ser efectivo y pidió que se lo cargaran, o al revés. Lo
   * que decide es lo que pasó en la calle, no lo que se apuntó al tomarlo.
   */
  async function entregar(id) {
    const p = datos.pedidos.find((x) => x.id === id);
    if (!p) return;

    const forma = await menu({
      titulo: `${guia(p.folio)} · ${pesos(p.total)}`,
      texto: `${p.cliente_negocio || p.cliente_nombre}. ¿Cómo pagó?`,
      opciones: [
        { valor: 'efectivo', texto: '💵 Pagó en efectivo',
          detalle: 'Entra al corte del turno abierto' },
        { valor: 'transferencia', texto: '📲 Por transferencia',
          detalle: 'No pasa por el cajón' },
        { valor: 'credito', texto: '📗 A su cuenta',
          detalle: 'Se le carga al crédito del cliente' }
      ]
    });
    if (!forma) return;

    try {
      const r = await api.enviar(`/pedidos/${id}/entregar`, { formaPago: forma });
      avisar(`Entregado. Ticket ${r.venta.numero || r.venta.folio}.`, 'bien');
      // SE PASÓ DE SU LÍMITE. No se frena —la mercancía ya se entregó y
      // negarse a apuntarlo solo dejaría la deuda sin escribir— pero quien
      // está en la caja tiene que enterarse en el momento.
      if (r.avisoCredito) avisar(r.avisoCredito, 'error');
      // El ticket de la venta sale solo, como cualquier otra: es el papel
      // que demuestra el cobro, y el de la nota no lo demuestra.
      try { await api.enviar(`/impresion/venta/${r.venta.id}`, {}); } catch { /* sin térmica */ }
      pintar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function cancelar(id) {
    const p = datos.pedidos.find((x) => x.id === id);
    if (!p) return;
    const seguro = await confirmar({
      titulo: `¿Cancelar el pedido ${guia(p.folio)}?`,
      texto: `${p.cliente_negocio || p.cliente_nombre} · ${pesos(p.total)}. `
           + 'No se borra: queda guardado con su motivo.',
      ok: 'Sí, cancelarlo', peligro: true
    });
    if (!seguro) return;

    const motivo = await pedirTexto({
      titulo: '¿Por qué se cancela?',
      marcador: 'Ya no lo quiso, no había quien lo llevara…', largo: 200
    });
    if (!motivo) return;

    try {
      await api.enviar(`/pedidos/${id}/cancelar`, { motivo });
      avisar('Pedido cancelado', 'bien');
      pintar();
    } catch (e) { avisar(e.message, 'error'); }
  }
}
