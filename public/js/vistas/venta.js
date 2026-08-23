/**
 * PUNTO DE VENTA  (v0.10 — rediseño)
 *
 * La pantalla que más se usa en toda la fábrica, así que manda ella:
 *
 *  · TODO CABE DE UNA VEZ. No se desplaza. Solo la rejilla de productos.
 *  · IZQUIERDA lo que lleva el cliente, DERECHA los botones para agregarlo,
 *    organizados en categorías como carpetas.
 *  · SIN TOCAR EL RATÓN. El cajero con práctica teclea 18, da enter y el
 *    octavo ya está en el ticket. F10 cobra. Enter avanza. Esc regresa.
 *
 * EL HIELO ES UNA SOLA LÍNEA, y esto es importante: los pedazos se van
 * SUMANDO en ella. Tocar 1/8 tres veces no son tres renglones de $36; son
 * 3/8, que cuestan $106 (1/4 + 1/8). Si fueran tres renglones el ticket
 * cobraría $108 y diría "3/8", y el cliente que sepa sumar tendría razón al
 * reclamar. Una sola línea es la única forma de que el papel y la lista de
 * precios digan lo mismo.
 *
 * El precio que se ve lo calcula el navegador para que responda al instante,
 * pero EL QUE MANDA ES EL DEL SERVIDOR: al cobrar vuelve a cotizar todo
 * desde cero con sus propios precios.
 */
import { api } from '../api.js';
import { esc, avisar, soloHora, fecha as formatoFecha } from '../util.js';
import { pedirTexto, pedirImporte, pedirCantidad, confirmar } from '../dialogo.js';
import { aTexto, descomponer, desglose, pesos } from '../fracciones.js';
import { cargarMarca } from '../marca.js';
import { imprimirTicket, limpiarImpresion } from '../imprimir.js';

/** Billetes con los que de verdad paga la gente. */
const BILLETES = [50, 100, 200, 500, 1000];

/**
 * Las fases por las que pasa el teclado. En cada una, ENTER hace una sola
 * cosa, y la pantalla dice cuál. Ese cartel es lo que hace que se pueda
 * aprender sin manual.
 */
const FASES = {
  venta:     { enter: 'agrega lo que tecleaste',  esc: 'borra' },
  cobro:     { enter: 'calcula el cambio',        esc: 'volver al ticket' },
  cambio:    { enter: 'cobra y registra',         esc: 'corregir el pago' },
  // Mientras el servidor guarda, enter y esc no hacen nada: que dos toques
  // seguidos no puedan cobrar dos veces.
  guardando: { enter: 'guardando…',               esc: 'espera' },
  historial: { enter: 'busca',                    esc: 'volver a vender' },
  cobrada:   { enter: 'imprime el ticket',        esc: 'siguiente venta' }
};

export async function vistaVenta(pantalla, estadoApp) {
  const puedeOperarCaja = estadoApp.permisos.includes('*') ||
                          estadoApp.permisos.includes('caja.operar');

  const marca = await cargarMarca();
  let ctx = await api.obtener('/ventas/contexto');

  // Precios del hielo por fracción, para cotizar sin ir al servidor.
  let tarifa = new Map(ctx.precios.map((p) => [p.dieciseisavos, p.centavos]));

  // ---- Lo que lleva el cliente ----
  let hielo = 0;                 // dieciseisavos, TODO en una sola línea
  let articulos = [];            // { producto, cantidad }
  let categoriaAbierta = null;   // null = se ven las categorías

  // ---- La fase del teclado ----
  let fase = 'venta';
  let pago = 0;                  // centavos tecleados en el cobro
  let ventaCobrada = null;

  pantalla.innerHTML = armazon();
  const refs = {
    lineas:  pantalla.querySelector('#pos-lineas'),
    total:   pantalla.querySelector('#pos-total'),
    rejilla: pantalla.querySelector('#pos-rejilla'),
    migas:   pantalla.querySelector('#pos-migas'),
    codigo:  pantalla.querySelector('#pos-codigo'),
    cobro:   pantalla.querySelector('#pos-cobro'),
    pista:   pantalla.querySelector('#pos-pista')
  };

  document.addEventListener('keydown', alTeclado);
  pantalla.addEventListener('vista-desmontada', () => {
    document.removeEventListener('keydown', alTeclado);
    limpiarImpresion();
  }, { once: true });

  pintarTodo();
  enfocar();

  // ==========================================================
  // EL ARMAZÓN: izquierda el ticket, derecha los botones
  // ==========================================================
  function armazon() {
    return `
      <div class="pos">
        <section class="pos-ticket">
          <div class="pos-ticket-cabeza">
            <span class="etiqueta-folio">ticket #${ctx.siguienteFolio}</span>
            ${ctx.caja
              ? `<span class="etiqueta-turno">turno #${ctx.caja.folio}</span>`
              : '<span class="etiqueta-mal">sin turno</span>'}
          </div>

          <div class="pos-lineas" id="pos-lineas"></div>

          <div id="pos-total"></div>

          ${puedeOperarCaja ? `
            <div class="pos-dinero">
              <button class="pos-btn-entrada" id="meter">＋ Meter dinero</button>
              <button class="pos-btn-salida" id="gasto">− Gasto</button>
            </div>` : ''}

          <button class="pos-cobrar" id="cobrar">
            <span>Cobrar</span><small>F10</small>
          </button>
        </section>

        <section class="pos-catalogo">
          <div class="pos-barra">
            <input id="pos-codigo" class="pos-codigo" autocomplete="off"
                   inputmode="numeric" placeholder="Teclea el código y enter…">
            <button class="pos-calc" id="calculadora" title="Otra cantidad de hielo">
              🧮
            </button>
            <button class="pos-calc" id="historial" title="Tickets de hoy (F3)">
              🧾
            </button>
          </div>
          <div class="pos-migas" id="pos-migas"></div>
          <div class="pos-rejilla" id="pos-rejilla"></div>
          <div class="pos-pista" id="pos-pista"></div>
        </section>
      </div>

      <div class="pos-cobro" id="pos-cobro" hidden></div>`;
  }

  // ==========================================================
  // COTIZAR (el mismo reparto que hace el servidor)
  // ==========================================================
  function precioHielo(dieciseisavos) {
    let centavos = 0;
    for (const parte of descomponer(dieciseisavos)) centavos += tarifa.get(parte) ?? 0;
    return centavos;
  }

  function total() {
    return precioHielo(hielo) +
      articulos.reduce((t, a) => t + a.producto.precio_centavos * a.cantidad, 0);
  }

  function hayAlgo() { return hielo > 0 || articulos.length > 0; }

  // ==========================================================
  // AGREGAR Y QUITAR
  // ==========================================================
  function agregarProducto(p) {
    if (fase !== 'venta') return;

    if (p.tipo === 'hielo') {
      hielo += p.dieciseisavos;          // se SUMA, no se agrega otro renglón
    } else {
      const ya = articulos.find((a) => a.producto.id === p.id);
      if (ya) ya.cantidad++;
      else articulos.push({ producto: p, cantidad: 1 });
    }
    pintarTodo();
  }

  function porCodigo(codigo) {
    const limpio = String(codigo).trim().toUpperCase();
    return ctx.productos.find((p) => (p.codigo || '').toUpperCase() === limpio) || null;
  }

  // ==========================================================
  // PINTAR
  // ==========================================================
  function pintarTodo() {
    pintarLineas();
    pintarRejilla();
    pintarPista();
  }

  function pintarLineas() {
    const filas = [];

    if (hielo > 0) {
      filas.push(`
        <div class="pos-linea pos-linea-hielo">
          <div class="pos-cant">${esc(aTexto(hielo))}</div>
          <div class="pos-desc">
            Hielo
            ${desglose(hielo) !== aTexto(hielo)
              ? `<small>${esc(desglose(hielo))}</small>` : ''}
          </div>
          <div class="pos-importe">${pesos(precioHielo(hielo))}</div>
          <button class="tachita" data-quita-hielo aria-label="Quitar el hielo">×</button>
        </div>`);
    }

    for (const [i, a] of articulos.entries()) {
      filas.push(`
        <div class="pos-linea">
          <div class="pos-cant">${a.cantidad}</div>
          <div class="pos-desc">${esc(a.producto.nombre)}</div>
          <div class="pos-importe">${pesos(a.producto.precio_centavos * a.cantidad)}</div>
          <button class="tachita" data-quita="${i}" aria-label="Quitar">×</button>
        </div>`);
    }

    refs.lineas.innerHTML = filas.length
      ? filas.join('')
      : `<div class="pos-vacio">
           <span>El ticket está vacío</span>
           <small>Toca un producto o teclea su código</small>
         </div>`;

    const t = total();
    refs.total.innerHTML = `
      <div class="pos-total ${hayAlgo() ? '' : 'apagado'}">
        <span>Total</span>
        <strong>${pesos(t)}</strong>
      </div>`;

    pantalla.querySelector('#cobrar').disabled = !hayAlgo();

    const quitaHielo = refs.lineas.querySelector('[data-quita-hielo]');
    if (quitaHielo) quitaHielo.onclick = () => { hielo = 0; pintarTodo(); enfocar(); };

    refs.lineas.querySelectorAll('[data-quita]').forEach((b) => {
      b.onclick = () => {
        articulos.splice(Number(b.dataset.quita), 1);
        pintarTodo(); enfocar();
      };
    });
  }

  function pintarRejilla() {
    if (!categoriaAbierta) {
      refs.migas.innerHTML = '<span class="miga-actual">Categorías</span>';
      refs.rejilla.innerHTML = ctx.categorias.map((c) => `
        <button class="pos-boton pos-categoria" data-categoria="${esc(c.id)}"
                style="${c.color ? `--tono:${esc(c.color)}` : ''}">
          <span class="pos-boton-nombre">${esc(c.nombre)}</span>
        </button>`).join('')
        || '<p class="vacio">No hay productos dados de alta todavía.</p>';
    } else {
      const cat = ctx.categorias.find((c) => c.id === categoriaAbierta);
      const suyos = ctx.productos.filter((p) => p.categoria_id === categoriaAbierta);

      refs.migas.innerHTML = `
        <button class="miga" data-volver>‹ Categorías</button>
        <span class="miga-actual">${esc(cat?.nombre || '')}</span>`;

      refs.rejilla.innerHTML = suyos.map((p) => `
        <button class="pos-boton" data-producto="${esc(p.id)}"
                style="${p.color || p.categoria_color
                  ? `--tono:${esc(p.color || p.categoria_color)}` : ''}">
          ${p.codigo ? `<span class="pos-boton-codigo">${esc(p.codigo)}</span>` : ''}
          <span class="pos-boton-nombre">${esc(p.nombre)}</span>
          <span class="pos-boton-precio">${p.tipo === 'hielo'
            ? pesos(precioHielo(p.dieciseisavos))
            : pesos(p.precio_centavos)}</span>
        </button>`).join('')
        || '<p class="vacio">Esta categoría no tiene productos.</p>';
    }

    refs.rejilla.querySelectorAll('[data-categoria]').forEach((b) => {
      b.onclick = () => { categoriaAbierta = b.dataset.categoria; pintarRejilla(); enfocar(); };
    });
    refs.rejilla.querySelectorAll('[data-producto]').forEach((b) => {
      b.onclick = () => {
        agregarProducto(ctx.productos.find((p) => p.id === b.dataset.producto));
        enfocar();
      };
    });
    const volver = refs.migas.querySelector('[data-volver]');
    if (volver) volver.onclick = () => { categoriaAbierta = null; pintarRejilla(); enfocar(); };
  }

  /** El cartel que dice qué hace enter ahora mismo. */
  function pintarPista() {
    const f = FASES[fase];
    refs.pista.innerHTML = `
      <span><kbd>Enter</kbd> ${esc(f.enter)}</span>
      <span><kbd>Esc</kbd> ${esc(f.esc)}</span>
      ${fase === 'venta'
        ? '<span><kbd>F10</kbd> cobrar</span><span><kbd>F3</kbd> tickets</span>' : ''}`;
  }

  function enfocar() {
    if (fase === 'venta') setTimeout(() => refs.codigo.focus(), 0);
  }

  // ==========================================================
  // EL TECLADO
  // ==========================================================
  function alTeclado(ev) {
    // Mientras haya un diálogo abierto, él manda.
    if (document.querySelector('.dialogo')) return;

    if (ev.key === 'F10') {
      ev.preventDefault();
      if (fase === 'venta') irACobro();
      return;
    }

    // F3 abre los tickets de hoy. Se usa cuando el cliente vuelve por una
    // copia, o cuando alguien se salió de la pantalla sin querer.
    if (ev.key === 'F3') {
      ev.preventDefault();
      if (fase === 'venta') verHistorial();
      else if (fase === 'historial') cerrarHistorial();
      return;
    }

    if (ev.key === 'Escape') {
      ev.preventDefault();
      retroceder();
      return;
    }

    if (ev.key === 'Enter') {
      ev.preventDefault();
      avanzar();
      return;
    }

    // Backspace con el campo ya vacío también regresa: es lo que hace la
    // mano sola cuando se equivocó de pantalla.
    if (ev.key === 'Backspace' && fase !== 'venta') {
      const campo = refs.cobro.querySelector('#pos-pago');
      if (campo && campo.value === '') { ev.preventDefault(); retroceder(); }
      return;
    }

    // Cualquier tecla suelta en la fase de venta va al campo del código.
    if (fase === 'venta' && document.activeElement !== refs.codigo &&
        ev.key.length === 1 && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
      refs.codigo.focus();
    }
  }

  function avanzar() {
    if (fase === 'historial') return;      // el buscador se encarga solo
    if (fase === 'venta')   return agregarPorCodigo();
    if (fase === 'cobro')   return calcularCambio();
    if (fase === 'cambio')  return registrar();
    if (fase === 'cobrada') return imprimir();
  }

  function retroceder() {
    if (fase === 'historial') { cerrarHistorial(); return; }
    if (fase === 'venta') {
      if (refs.codigo.value) { refs.codigo.value = ''; return; }
      if (hayAlgo()) vaciar();
      return;
    }
    if (fase === 'cobro')   { cerrarCobro(); return; }
    if (fase === 'cambio')  { fase = 'cobro'; pintarCobro(); return; }
    if (fase === 'cobrada') { nuevaVenta(); }
  }

  function agregarPorCodigo() {
    const codigo = refs.codigo.value.trim();
    if (!codigo) return;

    const p = porCodigo(codigo);
    if (!p) { avisar(`No hay ningún producto con el código ${codigo}`, 'error'); return; }

    agregarProducto(p);
    refs.codigo.value = '';
  }

  async function vaciar() {
    if (!await confirmar({
      titulo: '¿Vaciar el ticket?',
      texto: 'Se quita todo lo capturado. No se registra nada.',
      ok: 'Vaciar', peligro: true
    })) { enfocar(); return; }
    hielo = 0; articulos = [];
    pintarTodo(); enfocar();
  }

  // ==========================================================
  // COBRAR
  // ==========================================================
  function irACobro() {
    if (!hayAlgo()) return;
    fase = 'cobro';
    pago = 0;
    pintarCobro();
    pintarPista();
  }

  function cerrarCobro() {
    fase = 'venta';
    refs.cobro.hidden = true;
    pintarPista();
    enfocar();
  }

  function pintarCobro() {
    const aPagar = total();
    const cambio = pago - aPagar;

    refs.cobro.hidden = false;
    refs.cobro.innerHTML = `
      <div class="pos-cobro-caja">
        <div class="pos-cobro-total">
          <span>Total a cobrar</span>
          <strong>${pesos(aPagar)}</strong>
        </div>

        <label class="etiqueta-chica" for="pos-pago">¿Con cuánto paga?</label>
        <input id="pos-pago" class="pos-pago" inputmode="decimal" autocomplete="off"
               placeholder="${(aPagar / 100).toFixed(2)}"
               ${fase === 'cambio' ? 'disabled' : ''}
               value="${pago ? (pago / 100).toFixed(2) : ''}">

        <div class="pos-billetes">
          ${BILLETES.filter((b) => b * 100 >= aPagar).slice(0, 4)
            .map((b) => `<button class="secundario chico" data-billete="${b}">$${b}</button>`).join('')}
          <button class="secundario chico" data-billete="justo">Justo</button>
        </div>

        ${fase === 'cambio' ? `
          <div class="pos-cambio ${cambio === 0 ? 'sin-cambio' : ''}">
            <span>${cambio === 0 ? 'Pagó justo' : 'Cambio'}</span>
            <strong>${pesos(cambio)}</strong>
          </div>
          <button class="pos-confirmar" id="confirmar">
            <span>Cobrar ${pesos(aPagar)}</span><small>Enter</small>
          </button>` : `
          <button class="pos-confirmar" id="calcular">
            <span>Calcular el cambio</span><small>Enter</small>
          </button>`}

        <button class="secundario" id="salir-cobro" style="margin-top:10px;width:100%">
          Esc · volver al ticket
        </button>
      </div>`;

    const campo = refs.cobro.querySelector('#pos-pago');
    if (fase === 'cobro') setTimeout(() => campo.focus(), 0);

    campo.oninput = () => {
      pago = Math.round((Number(campo.value.replace(/[^0-9.]/g, '')) || 0) * 100);
    };

    refs.cobro.querySelectorAll('[data-billete]').forEach((b) => {
      b.onclick = () => {
        pago = b.dataset.billete === 'justo' ? aPagar : Number(b.dataset.billete) * 100;
        campo.value = (pago / 100).toFixed(2);
        calcularCambio();
      };
    });

    const calcular = refs.cobro.querySelector('#calcular');
    if (calcular) calcular.onclick = calcularCambio;
    const confirmar2 = refs.cobro.querySelector('#confirmar');
    if (confirmar2) confirmar2.onclick = registrar;
    refs.cobro.querySelector('#salir-cobro').onclick = cerrarCobro;
  }

  function calcularCambio() {
    const aPagar = total();
    // Enter con el campo vacío = pagó justo. Es el caso más común y así se
    // cobra con dos teclas.
    if (!pago) pago = aPagar;
    if (pago < aPagar) {
      avisar('El pago es menor que el total', 'error');
      return;
    }
    fase = 'cambio';
    pintarCobro();
    pintarPista();
  }

  async function registrar() {
    if (fase !== 'cambio') return;
    fase = 'guardando';
    pintarPista();

    const lineas = [];
    if (hielo > 0) lineas.push({ dieciseisavos: hielo });
    for (const a of articulos) lineas.push({ productoId: a.producto.id, cantidad: a.cantidad });

    try {
      const { venta } = await api.enviar('/ventas', {
        almacenId: ctx.almacenes[0]?.id,
        lineas,
        pago: (pago / 100).toFixed(2)
      });
      ventaCobrada = venta;
      ctx.siguienteFolio = venta.folio + 1;
      fase = 'cobrada';
      pintarCobrada();
      pintarPista();
      // NO se imprime solo: no todos los tickets se entregan, y cada uno
      // que sale sin que nadie lo pida es papel tirado. Enter imprime.
    } catch (e) {
      fase = 'cambio';
      pintarCobro();
      pintarPista();
      avisar(e.message, 'error');
    }
  }

  function pintarCobrada() {
    const v = ventaCobrada;
    refs.cobro.innerHTML = `
      <div class="pos-cobro-caja pos-cobrada">
        <div class="pos-cobrada-folio">Ticket #${v.folio}</div>

        <div class="pos-cambio grande ${v.cambio_centavos ? '' : 'sin-cambio'}">
          <span>${v.cambio_centavos ? 'Cambio' : 'Pagó justo'}</span>
          <strong>${pesos(v.cambio_centavos || 0)}</strong>
        </div>

        <button class="pos-confirmar" id="otro-ticket">
          <span>🖨️ Imprimir ticket</span><small>Enter</small>
        </button>
        <button class="secundario" id="siguiente" style="margin-top:10px;width:100%">
          Esc · siguiente venta
        </button>
      </div>`;

    refs.cobro.querySelector('#otro-ticket').onclick = () => imprimir();
    refs.cobro.querySelector('#siguiente').onclick = nuevaVenta;
  }

  function nuevaVenta() {
    hielo = 0; articulos = []; pago = 0; ventaCobrada = null;
    fase = 'venta';
    refs.cobro.hidden = true;
    limpiarImpresion();
    pantalla.querySelector('.pos-ticket-cabeza .etiqueta-folio').textContent =
      `ticket #${ctx.siguienteFolio}`;
    pintarTodo();
    enfocar();
  }

  // ==========================================================
  // EL TICKET
  // ==========================================================
  /**
   * Imprimir el ticket.
   *
   * Primero se le pide al SERVIDOR, que le manda los bytes directo a la
   * impresora térmica: sale al instante, sin que se asome la ventana de
   * impresión del navegador.
   *
   * Si no hay impresora configurada, se cae al camino de antes: armar el
   * ticket en HTML y pedirle al navegador que lo imprima. Funciona igual,
   * solo que aparece el cuadro de imprimir.
   */
  async function imprimir(venta = ventaCobrada, { copia = false } = {}) {
    if (!venta) return;
    try {
      const r = await api.enviar(`/impresion/venta/${venta.id}`, { copia });
      if (r.impreso) { avisar(copia ? 'Copia impresa' : 'Ticket impreso', 'bien'); return; }
    } catch (e) {
      avisar(e.message, 'error');
      return;
    }
    // Sin impresora configurada: lo resuelve el navegador.
    imprimirTicket(ticketHTML(venta, { copia }));
  }

  /**
   * El ticket de hielo se imprime a cientos al día: cada renglón de más son
   * metros de papel al mes. Así que va lo mínimo, y lo que importa —cuánto
   * hielo se llevó— en grande y centrado.
   */
  function ticketHTML(v, { copia = false } = {}) {
    const lineasHielo = v.lineas.filter((l) => l.dieciseisavos > 0);
    const otras = v.lineas.filter((l) => l.dieciseisavos === 0);
    const totalHielo = lineasHielo.reduce((t, l) => t + l.dieciseisavos, 0);
    const f = new Date(v.fecha);

    return `
      <div class="tk">
        <div class="tk-alto">
          <span>#${v.folio}</span>
          <span>${f.toLocaleDateString('es-MX')} ${esc(soloHora(v.fecha))}</span>
          <span>${esc((v.cajero_nombre || '').split(' ')[0])}</span>
        </div>

        ${copia ? '<div class="tk-copia">*** COPIA ***</div>' : ''}
        ${v.cancelada_en ? '<div class="tk-copia">CANCELADO</div>' : ''}

        ${totalHielo ? `
          <div class="tk-hielo">${esc(aTexto(totalHielo))}</div>
          ${desglose(totalHielo) !== aTexto(totalHielo)
            ? `<div class="tk-desglose">${esc(desglose(totalHielo))}</div>` : ''}` : ''}

        ${otras.length ? `
          <table class="tk-otras">
            ${otras.map((l) => `
              <tr><td>${esc(l.concepto)}</td><td>${pesos(l.precio_centavos)}</td></tr>`).join('')}
          </table>` : ''}

        <div class="tk-total">${pesos(v.total_centavos)}</div>

        ${v.pago_centavos && v.cambio_centavos ? `
          <div class="tk-pago">
            Pagó ${pesos(v.pago_centavos)} · cambio ${pesos(v.cambio_centavos)}
          </div>` : ''}

        ${marca.nombreNegocio ? `<div class="tk-pie">${esc(marca.nombreNegocio)}</div>` : ''}
      </div>`;
  }

  // ==========================================================
  // HISTORIAL: buscar un ticket y reimprimirlo
  //
  // Pasa seguido: el cliente vuelve porque perdió su ticket, o se salió sin
  // querer de la pantalla. Se busca por número, por importe o por hora, y
  // se vuelve a imprimir marcado como COPIA para que no se confunda con el
  // original.
  // ==========================================================
  async function verHistorial(busca = '') {
    fase = 'historial';
    refs.cobro.hidden = false;
    refs.cobro.innerHTML = `
      <div class="pos-cobro-caja pos-historial">
        <h3 style="margin:0 0 4px">Tickets</h3>
        <p class="ayuda" style="margin:0 0 12px">
          Por número, por el importe o por la hora.
        </p>
        <input id="busca-ticket" class="buscador" autocomplete="off"
               placeholder="Número, monto u hora" value="${esc(busca)}" style="margin:0">
        <div id="lista-tickets" class="lista-tickets"><p class="ayuda">Buscando…</p></div>
        <button class="secundario" id="cerrar-historial" style="margin-top:12px;width:100%">
          Esc · volver a vender
        </button>
      </div>`;

    refs.cobro.querySelector('#cerrar-historial').onclick = cerrarHistorial;

    const campo = refs.cobro.querySelector('#busca-ticket');
    setTimeout(() => campo.focus(), 60);
    let espera;
    campo.oninput = () => {
      clearTimeout(espera);
      espera = setTimeout(() => cargarTickets(campo.value.trim()), 300);
    };
    campo.onkeydown = (ev) => { if (ev.key === 'Enter') ev.stopPropagation(); };

    cargarTickets(busca);
    pintarPista();
  }

  async function cargarTickets(busca) {
    const caja = refs.cobro.querySelector('#lista-tickets');
    if (!caja) return;
    try {
      const { ventas } = await api.obtener(
        `/ventas?limite=25&busca=${encodeURIComponent(busca || '')}`);

      caja.innerHTML = ventas.length ? ventas.map((v) => `
        <div class="ticket-fila ${v.cancelada_en ? 'anulada' : ''}">
          <div class="crece">
            <strong>#${v.folio}</strong>
            <small>${esc(formatoFecha(v.fecha))} · ${esc(v.cajero_nombre || '—')}</small>
          </div>
          <span class="ticket-fila-total">${pesos(v.total_centavos)}</span>
          <button class="secundario chico" data-reimprimir="${esc(v.id)}">Copia</button>
        </div>`).join('')
        : '<p class="vacio" style="padding:20px 0">No hay tickets que coincidan.</p>';

      caja.querySelectorAll('[data-reimprimir]').forEach((b) => {
        b.onclick = async () => {
          b.disabled = true;
          const { venta } = await api.obtener(`/ventas/${b.dataset.reimprimir}`);
          await imprimir(venta, { copia: true });
          b.disabled = false;
        };
      });
    } catch (e) {
      caja.innerHTML = `<p class="vacio">${esc(e.message)}</p>`;
    }
  }

  function cerrarHistorial() {
    fase = 'venta';
    refs.cobro.hidden = true;
    pintarPista();
    enfocar();
  }

  // ==========================================================
  // LA CALCULADORA DE FRACCIONES
  // ==========================================================
  pantalla.querySelector('#calculadora').onclick = async () => {
    const n = await pedirCantidad({
      titulo: 'Otra cantidad de hielo',
      texto: 'Para las cantidades que no tienen botón. Se suma a lo que ya lleva el ticket.',
      valor: 0, ok: 'Agregar al ticket'
    });
    if (n) { hielo += n; pintarTodo(); }
    enfocar();
  };

  pantalla.querySelector('#cobrar').onclick = irACobro;
  pantalla.querySelector('#historial').onclick = () => verHistorial();
  refs.codigo.onkeydown = (ev) => { if (ev.key === 'Enter') ev.stopPropagation(); };
  refs.codigo.addEventListener('keyup', (ev) => {
    if (ev.key === 'Enter') agregarPorCodigo();
  });

  // ==========================================================
  // DINERO QUE ENTRA O SALE DEL CAJÓN
  // ==========================================================
  if (puedeOperarCaja) {
    pantalla.querySelector('#meter').onclick = () => movimiento('entrada');
    pantalla.querySelector('#gasto').onclick = () => movimiento('salida');
  }

  async function movimiento(tipo) {
    const esSalida = tipo === 'salida';

    const concepto = await pedirTexto({
      titulo: esSalida ? 'Gasto o retiro' : 'Meter dinero al cajón',
      texto: esSalida
        ? '¿En qué se usó? La gasolina, un refresco, el retiro a la caja fuerte…'
        : '¿De dónde viene? El fondo con el que arranca el cajón, cambio del banco…',
      marcador: esSalida ? 'Gasolina' : 'Fondo para cambio',
      ok: 'Siguiente', largo: 60
    });
    if (!concepto) { enfocar(); return; }

    const monto = await pedirImporte({
      titulo: concepto, texto: '¿De cuánto es?',
      marcador: '200', ok: esSalida ? 'Anotar la salida' : 'Anotar la entrada'
    });
    if (!monto) { enfocar(); return; }

    try {
      const r = await api.enviar('/caja/movimientos', { tipo, concepto, monto });
      avisar(esSalida ? 'Salida anotada' : 'Dinero anotado', 'bien');

      // Una salida SÍ lleva papel: alguien se llevó dinero del cajón y
      // tiene que quedar constancia firmada. Meter dinero no: nadie firma
      // por dejar dinero.
      if (esSalida && r.movimientoId) {
        try { await api.enviar(`/impresion/movimiento/${r.movimientoId}`, {}); }
        catch { avisar('Se anotó, pero no se pudo imprimir el comprobante', 'error'); }
      }
    } catch (e) { avisar(e.message, 'error'); }
    enfocar();
  }
}
