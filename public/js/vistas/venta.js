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
import { esc, avisar, soloHora, fecha as formatoFecha, ETIQUETAS_ROL } from '../util.js';
import { pedirTexto, pedirImporte, pedirCantidad, confirmar,
         pedirAutorizacion } from '../dialogo.js';
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
  espera:    { enter: 'nada',                     esc: 'volver a vender' },
  avisos:    { enter: 'nada',                     esc: 'volver a vender' },
  movimientos: { enter: 'nada',                   esc: 'volver a vender' },
  clientes:  { enter: 'nada',                     esc: 'volver al cobro' },
  cobrada:   { enter: 'imprime el ticket',        esc: 'siguiente venta' }
};

export async function vistaVenta(pantalla, estadoApp) {
  const tiene = (p) => estadoApp.permisos.includes('*') || estadoApp.permisos.includes(p);
  const puedeOperarCaja = tiene('caja.operar');
  const puedeVerCaja = tiene('caja.ver');
  const puedeContarHielo = tiene('existencia.ver');
  const puedeFiar = tiene('venta.credito');
  const puedeRepartirNumeros = tiene('produccion.autorizar');

  const marca = await cargarMarca();
  let ctx = await api.obtener('/ventas/contexto');

  // Precios del hielo por fracción, para cotizar sin ir al servidor.
  let tarifa = new Map(ctx.precios.map((p) => [p.dieciseisavos, p.centavos]));

  /**
   * LO QUE SE ESTÁ ACABANDO.
   *
   * Llega con el contexto y se vuelve a pedir después de cada venta, que es
   * justo cuando cambia. Sirve para dos cosas distintas:
   *
   *  · la bolita roja de arriba, para que el cajero lo sepa sin buscarlo
   *  · negarse en el acto cuando alguien captura algo que ya no hay
   *
   * El hielo va aparte y con su propio símbolo, porque su número no es lo
   * que hay sino lo que se ha reportado. Avisa, nunca bloquea.
   */
  let alertas = ctx.avisos || { productos: [], bajos: 0, agotados: 0, existencias: {}, hielo: null };

  // ---- Lo que lleva el cliente ----
  let hielo = 0;                 // dieciseisavos, TODO en una sola línea
  let articulos = [];            // { producto, cantidad }
  let categoriaAbierta = null;   // null = se ven las categorías

  /**
   * VENTAS EN ESPERA.
   *
   * Llega un cliente, pide 1/8 y se queda pensando. Detrás llega uno de
   * siempre que ya sabe lo que quiere. Con «Nueva venta» el ticket a medias
   * se guarda, se atiende al de atrás, y al terminar el que quedó pendiente
   * vuelve solo.
   *
   * Viven en el navegador nada más: son minutos, no días. Pero se guardan
   * también en el aparato, para que un refresco de la pantalla no borre lo
   * que un cliente ya había pedido.
   */
  let enEspera = leerEnEspera();

  // ---- Cambio de ticket: lo que el cliente trae a favor ----
  let cambiando = null;          // { venta, aFavor }

  /**
   * A QUIÉN SE LE ESTÁ FIANDO ESTE TICKET.
   *
   * null es lo normal: el público paga y se va. Solo se fía a clientes
   * registrados, así que esto siempre sale de la lista, nunca de un nombre
   * escrito a mano con el cliente enfrente.
   */
  let fiadoA = null;

  // ---- La fase del teclado ----
  let fase = 'venta';
  let pago = 0;                  // centavos tecleados en el cobro
  let ventaCobrada = null;
  let ultimoCambio = null;       // el resultado del último cambio de ticket
  let fiadoCobrado = null;       // a quién se le acaba de fiar, para decírselo

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
  const relojito = setInterval(pintarHora, 10000);
  pantalla.addEventListener('vista-desmontada', () => {
    document.removeEventListener('keydown', alTeclado);
    clearInterval(relojito);
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
        <div class="pos-acciones-arriba">
          <button class="pos-accion" id="nueva-venta">
            <span>＋ Nueva venta</span><small>F2</small>
          </button>
          <button class="pos-accion pos-accion-cambio" id="cambio">
            <span>⇄ Cambio</span><small>F4</small>
          </button>
          <button class="pos-accion" id="historial">
            <span>🧾 Tickets</span><small>F3</small>
          </button>
          <div class="pos-derecha">
          <div class="pos-avisos" id="pos-avisos"></div>

          <div class="pos-rapidos">
            ${puedeContarHielo ? `
              <button class="pos-chico" id="ir-existencia"
                      title="Existencia del cuarto frío">📋</button>` : ''}
            ${puedeRepartirNumeros ? `
              <button class="pos-chico pos-chico-texto" id="ir-numeros"
                      title="Los números que siguen en los tanques">№</button>` : ''}
            ${puedeVerCaja ? `
              <button class="pos-chico" id="ver-movimientos"
                      title="Gastos y dinero metido">💵</button>` : ''}
            ${puedeOperarCaja ? `
              <button class="pos-chico" id="terminar-turno"
                      title="Terminar turno y contar">🔒</button>` : ''}
          </div>

          <div class="pos-quien">
            <span class="pos-quien-nombre">
              <strong>${esc(estadoApp.usuario?.nombre || '')}</strong>
              <small>${esc(ETIQUETAS_ROL[estadoApp.usuario?.rol] || '')}</small>
            </span>
            <button class="pos-chico" id="pos-menu" title="Menú">☰</button>
          </div>
          </div>
        </div>

        <section class="pos-ticket">
          <div class="pos-ticket-cabeza">
            <span class="etiqueta-folio" id="etiqueta-folio">ticket #${ctx.siguienteFolio}</span>
            ${ctx.caja
              ? `<span class="etiqueta-turno">turno #${ctx.caja.folio}</span>`
              : '<span class="etiqueta-mal">sin turno</span>'}
            <span class="etiqueta-espera" id="etiqueta-espera" hidden></span>
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
          </div>
          <div class="pos-migas" id="pos-migas"></div>
          <div class="pos-rejilla" id="pos-rejilla"></div>
          <div class="pos-pista" id="pos-pista"></div>
        </section>
      </div>

      <div class="pos-cobro" id="pos-cobro" hidden></div>`;
  }

  // ==========================================================
  // VENTAS EN ESPERA
  // ==========================================================
  const LLAVE_ESPERA = 'lolha.ventas-en-espera';

  function leerEnEspera() {
    try { return JSON.parse(localStorage.getItem(LLAVE_ESPERA)) || []; }
    catch { return []; }
  }

  function guardarEnEspera() {
    try { localStorage.setItem(LLAVE_ESPERA, JSON.stringify(enEspera)); }
    catch { /* sin espacio o en privado: no es grave, son minutos */ }
  }

  /** Guarda el ticket de ahora y deja la pantalla lista para otro cliente. */
  function apartarVenta() {
    if (!hayAlgo()) {
      avisar('El ticket ya está vacío', '');
      enfocar();
      return;
    }
    if (cambiando) {
      avisar('Termina el cambio antes de empezar otra venta', 'error');
      enfocar();
      return;
    }

    enEspera.push({
      hielo,
      articulos: articulos.map((a) => ({ productoId: a.producto.id, cantidad: a.cantidad })),
      hora: new Date().toISOString()
    });
    guardarEnEspera();

    hielo = 0;
    articulos = [];
    pintarTodo();
    avisar('Venta apartada. Sigue el siguiente cliente.', 'bien');
    enfocar();
  }

  /** Devuelve a la pantalla una venta apartada. */
  function retomarVenta(indice) {
    const v = enEspera[indice];
    if (!v) return;

    // Si lo que hay en pantalla es algo, se aparta antes de traer la otra:
    // nunca se pierde un ticket por retomar otro.
    if (hayAlgo()) apartarVenta();

    enEspera.splice(indice, 1);
    guardarEnEspera();

    hielo = v.hielo || 0;
    articulos = (v.articulos || [])
      .map((a) => ({
        producto: ctx.productos.find((p) => p.id === a.productoId),
        cantidad: a.cantidad
      }))
      // Un producto dado de baja mientras esperaba ya no se puede cobrar.
      .filter((a) => a.producto);

    fase = 'venta';
    refs.cobro.hidden = true;
    pintarTodo();
    pintarPista();
    enfocar();
  }

  /** Al terminar una venta, si quedó alguien esperando, vuelve solo. */
  function retomarSiHay() {
    if (!enEspera.length) return false;
    retomarVenta(enEspera.length - 1);
    avisar('Vuelves a la venta que quedó pendiente', '');
    return true;
  }

  function verEnEspera() {
    if (!enEspera.length) { apartarVenta(); return; }

    fase = 'espera';
    refs.cobro.hidden = false;
    refs.cobro.innerHTML = `
      <div class="pos-cobro-caja">
        <h3 style="margin:0 0 4px">Ventas en espera</h3>
        <p class="ayuda" style="margin:0 0 12px">
          Tickets que quedaron a medias. Toca uno para seguir con él.
        </p>
        <div class="lista-tickets">
          ${enEspera.map((v, i) => {
            const arts = (v.articulos || []).reduce((n, a) => n + a.cantidad, 0);
            return `
              <div class="ticket-fila">
                <div class="crece">
                  <strong>${v.hielo ? esc(aTexto(v.hielo)) + ' de hielo' : ''}${
                    v.hielo && arts ? ' · ' : ''}${arts ? arts + ' artículo' + (arts === 1 ? '' : 's') : ''}</strong>
                  <small>apartada a las ${esc(soloHora(v.hora))}</small>
                </div>
                <button class="secundario chico" data-retomar="${i}">Seguir</button>
                <button class="tachita" data-tirar="${i}" aria-label="Tirar">×</button>
              </div>`;
          }).join('')}
        </div>
        <div class="fila-botones" style="margin-top:12px">
          <button class="secundario crece" id="apartar-esta">Apartar la de ahora</button>
          <button class="secundario crece" id="cerrar-espera">Esc · volver</button>
        </div>
      </div>`;

    refs.cobro.querySelectorAll('[data-retomar]').forEach((b) => {
      b.onclick = () => { refs.cobro.hidden = true; retomarVenta(Number(b.dataset.retomar)); };
    });
    refs.cobro.querySelectorAll('[data-tirar]').forEach((b) => {
      b.onclick = async () => {
        if (!await confirmar({
          titulo: '¿Tirar esta venta apartada?',
          texto: 'No se registra nada. Solo se borra lo que se había capturado.',
          ok: 'Tirar', peligro: true
        })) return;
        enEspera.splice(Number(b.dataset.tirar), 1);
        guardarEnEspera();
        verEnEspera();
      };
    });
    refs.cobro.querySelector('#apartar-esta').onclick = () => {
      refs.cobro.hidden = true; fase = 'venta'; apartarVenta(); pintarPista();
    };
    refs.cobro.querySelector('#cerrar-espera').onclick = cerrarEspera;
    pintarPista();
  }

  function cerrarEspera() {
    fase = 'venta';
    refs.cobro.hidden = true;
    pintarPista();
    enfocar();
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
  /**
   * Cuántas piezas quedan de algo. Infinito para lo que no lleva cuenta:
   * el hielo y lo que se vende sin inventario nunca se acaban aquí.
   */
  function quedanDe(p) {
    if (!p || !p.lleva_inventario) return Infinity;
    const n = alertas.existencias?.[p.id];
    return Number.isFinite(n) ? n : Infinity;
  }

  function seAcabo(p) { return quedanDe(p) <= 0; }

  function agregarProducto(p, cuantos = 1) {
    if (fase !== 'venta') return;

    if (p.tipo === 'hielo') {
      hielo += p.dieciseisavos * cuantos;  // se SUMA, no se agrega otro renglón
      pintarTodo();
      return;
    }

    // No se vende lo que no hay. El servidor también lo revisa al cobrar,
    // pero decirlo al capturar evita armar un ticket que se va a caer.
    const quedan = quedanDe(p);
    const ya = articulos.find((a) => a.producto.id === p.id);
    const lleva = ya ? ya.cantidad : 0;

    if (quedan <= 0) {
      avisar(`Ya no hay ${p.nombre}. Se acabó.`, 'error');
      return;
    }
    if (lleva + cuantos > quedan) {
      avisar(quedan === 1
        ? `Solo queda 1 de ${p.nombre}`
        : `Solo quedan ${quedan} de ${p.nombre}`, 'error');
      return;
    }

    if (ya) ya.cantidad += cuantos;
    else articulos.push({ producto: p, cantidad: cuantos });
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
    pintarAvisos();
    pintarPista();
  }

  // ==========================================================
  // LOS AVISOS DE ARRIBA
  //
  // Dos símbolos, y solo aparecen cuando hay algo que decir. Una pantalla
  // llena de avisos permanentes se vuelve parte del fondo y deja de verse.
  // ==========================================================
  function pintarAvisos() {
    const caja = pantalla.querySelector('#pos-avisos');
    if (!caja) return;

    const partes = [];

    if (alertas.bajos > 0) {
      const hayAgotados = alertas.agotados > 0;
      partes.push(`
        <button class="pos-aviso ${hayAgotados ? 'agotado' : ''}" id="aviso-inventario"
                title="${hayAgotados
                  ? `${alertas.agotados} producto${alertas.agotados === 1 ? '' : 's'} sin existencia`
                  : 'Hay que pedir más'}">
          <span class="pos-aviso-icono">⚠</span>
          <span class="pos-burbuja">${alertas.bajos}</span>
        </button>`);
    }

    if (alertas.hielo?.bajo) {
      partes.push(`
        <button class="pos-aviso pos-aviso-hielo" id="aviso-hielo"
                title="Queda poco hielo de lo que se ha capturado">
          <span class="pos-aviso-icono">🧊</span>
        </button>`);
    }

    caja.innerHTML = partes.join('');
    const bajos = caja.querySelector('#aviso-inventario');
    if (bajos) bajos.onclick = verAvisosInventario;
    const hie = caja.querySelector('#aviso-hielo');
    if (hie) hie.onclick = verAvisoHielo;
  }

  /** La lista completa de lo que se está acabando. */
  function verAvisosInventario() {
    fase = 'avisos';
    refs.cobro.hidden = false;
    refs.cobro.innerHTML = `
      <div class="pos-cobro-caja pos-lista-avisos">
        <h3 style="margin:0 0 4px">Se está acabando</h3>
        <p class="ayuda" style="margin:0 0 12px">
          ${alertas.agotados
            ? `${alertas.agotados} ya no se puede${alertas.agotados === 1 ? '' : 'n'} vender.`
            : 'Todavía hay de todo, pero conviene pedir.'}
        </p>
        <div class="lista-tickets">
          ${alertas.productos.map((p) => `
            <div class="ticket-fila fila-agota ${p.agotado ? 'sin-nada' : ''}">
              <div class="crece">
                <strong>${esc(p.nombre)}</strong>
                <small>${p.codigo ? 'código ' + esc(p.codigo) + ' · ' : ''}${
                  p.minimo ? 'avisa en ' + p.minimo : 'sin mínimo'}</small>
              </div>
              <span class="aviso-quedan ${p.agotado ? 'agotado' : 'bajo'}">
                ${p.agotado ? 'se acabó' : `quedan ${p.quedan}`}
              </span>
            </div>`).join('')
            || '<p class="vacio" style="padding:20px 0">No falta nada.</p>'}
        </div>
        <button class="secundario" id="cerrar-avisos" style="margin-top:12px;width:100%">
          Esc · volver a vender
        </button>
      </div>`;
    refs.cobro.querySelector('#cerrar-avisos').onclick = cerrarAvisos;
    pintarPista();
  }

  /**
   * El aviso del hielo dice de dónde salió el número, porque el número
   * miente a media mañana: los obreros sacan hielo desde temprano y no
   * reportan hasta como las 3. Por eso avisa y no impide vender.
   */
  function verAvisoHielo() {
    const h = alertas.hielo;
    if (!h) return;
    fase = 'avisos';
    refs.cobro.hidden = false;
    refs.cobro.innerHTML = `
      <div class="pos-cobro-caja pos-aviso-caja">
        <div class="pos-aviso-grande">🧊</div>
        <h3 style="margin:0 0 4px">Queda poco hielo</h3>
        <div class="pos-cobro-total">
          <span>Capturado en ${esc(h.almacen)}</span>
          <strong>${h.dieciseisavos > 0
            ? esc(h.texto) + (h.dieciseisavos === 16 ? ' marqueta'
                            : h.dieciseisavos > 16 ? ' marquetas' : '')
            : 'nada'}</strong>
        </div>
        <p class="ayuda" style="margin:12px 0 0">
          El aviso salta con ${h.minimoMarquetas} marqueta${h.minimoMarquetas === 1 ? '' : 's'}
          o menos. Ese número es <strong>lo que se ha capturado</strong>, no
          lo que hay en el cuarto frío: mientras los obreros no reporten lo
          que sacaron, va a marcar de menos. Sigue vendiendo normal.
        </p>
        <p class="ayuda" style="margin:8px 0 0">
          ${h.ultimaProduccion
            ? `Última producción capturada: ${esc(formatoFecha(h.ultimaProduccion))}.`
            : 'Todavía nadie ha capturado producción. Por eso marca en cero.'}
        </p>
        <button class="secundario" id="cerrar-avisos" style="margin-top:14px;width:100%">
          Esc · volver a vender
        </button>
      </div>`;
    refs.cobro.querySelector('#cerrar-avisos').onclick = cerrarAvisos;
    pintarPista();
  }

  function cerrarAvisos() {
    fase = 'venta';
    refs.cobro.hidden = true;
    pintarPista();
    enfocar();
  }

  // ==========================================================
  // EL HISTORIAL DEL CAJÓN
  //
  // "¿Y la gasolina de la mañana?" La pantalla de Caja solo enseña el turno
  // de ahora, y a media tarde el turno de la mañana ya se cerró. Aquí se ven
  // los últimos movimientos aunque sean de otro turno, con una raya que dice
  // dónde empieza cada uno.
  //
  // Los gastos van primero y en grande porque son los que se buscan. Meter
  // dinero se ve más discreto: nadie pide cuentas de lo que se dejó.
  // ==========================================================
  async function verMovimientos() {
    fase = 'movimientos';
    refs.cobro.hidden = false;
    refs.cobro.innerHTML = `
      <div class="pos-cobro-caja pos-movimientos">
        <h3 style="margin:0 0 4px">Gastos y dinero del cajón</h3>
        <p class="ayuda" style="margin:0 0 12px">Buscando…</p>
      </div>`;
    pintarPista();

    let movs = [];
    try {
      movs = (await api.obtener('/caja/movimientos?limite=40')).movimientos || [];
    } catch (e) {
      refs.cobro.querySelector('.ayuda').textContent = e.message;
      return;
    }

    // La raya se dibuja cuando cambia el turno. Como la lista viene de lo
    // más nuevo a lo más viejo, la raya se pone ANTES del primer movimiento
    // de cada turno: "de aquí para abajo es del turno de Fulano".
    const filas = [];
    let turnoAnterior = null;
    for (const m of movs) {
      if (m.caja_folio !== turnoAnterior) {
        turnoAnterior = m.caja_folio;
        filas.push(`
          <div class="raya-turno">
            <span>de aquí para abajo, turno #${m.caja_folio ?? '—'}${
              m.caja_cajero ? ' de ' + esc(m.caja_cajero.split(' ')[0]) : ''}${
              m.caja_cerrada_en ? ' (cerrado)' : ''}</span>
          </div>`);
      }
      const esSalida = m.tipo === 'salida';
      filas.push(`
        <div class="ticket-fila mov-fila ${esSalida ? 'mov-salida' : 'mov-entrada'}">
          <div class="crece">
            <strong>${esc(m.concepto)}</strong>
            <small>${esc(formatoFecha(m.fecha))} · ${esc(m.ejecutor_nombre || '—')}</small>
          </div>
          <span class="mov-importe">${esSalida ? '−' : '+'}${pesos(m.centavos)}</span>
          ${esSalida ? `<button class="secundario chico" data-comprobante="${esc(m.id)}">Copia</button>` : ''}
        </div>`);
    }

    const gastos = movs.filter((m) => m.tipo === 'salida')
                       .reduce((t, m) => t + m.centavos, 0);

    refs.cobro.innerHTML = `
      <div class="pos-cobro-caja pos-movimientos">
        <h3 style="margin:0 0 4px">Gastos y dinero del cajón</h3>
        <p class="ayuda" style="margin:0 0 12px">
          Los últimos ${movs.length}, cruzando turnos.
          ${gastos ? `Salieron ${pesos(gastos)} en total.` : ''}
        </p>
        <div class="lista-tickets">
          ${filas.join('') || '<p class="vacio" style="padding:20px 0">Todavía no hay movimientos.</p>'}
        </div>
        <button class="secundario" id="cerrar-avisos" style="margin-top:12px;width:100%">
          Esc · volver a vender
        </button>
      </div>`;

    refs.cobro.querySelector('#cerrar-avisos').onclick = cerrarAvisos;
    // Una salida lleva papel firmado; si se traspapeló, aquí se saca otro.
    refs.cobro.querySelectorAll('[data-comprobante]').forEach((b) => {
      b.onclick = async () => {
        b.disabled = true;
        try { await api.enviar(`/impresion/movimiento/${b.dataset.comprobante}`, {}); avisar('Comprobante impreso', 'bien'); }
        catch (e) { avisar(e.message, 'error'); }
        b.disabled = false;
      };
    });
  }

  /** Después de cada venta cambia lo que queda. Si falla, no pasa nada. */
  async function refrescarAvisos() {
    try {
      alertas = await api.obtener('/inventario/avisos');
      pintarAvisos();
      pintarRejilla();
    } catch { /* el cajero no siempre puede ver inventario; sin aviso y ya */ }
  }

  function pintarLineas() {
    const filas = [];

    if (cambiando) {
      filas.push(`
        <div class="pos-linea pos-linea-credito">
          <div class="pos-cant">⇄</div>
          <div class="pos-desc">
            Devuelve el ticket #${cambiando.venta.folio}
            <small>a favor del cliente</small>
          </div>
          <div class="pos-importe">−${pesos(cambiando.aFavor)}</div>
          <button class="tachita" data-cancelar-cambio aria-label="Cancelar el cambio">×</button>
        </div>`);
    }

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
    // En un cambio, lo que importa es la diferencia: lo que se cobra o lo
    // que se devuelve. El total del ticket ya lo pagó antes.
    const dif = cambiando ? t - cambiando.aFavor : t;
    refs.total.innerHTML = cambiando
      ? `<div class="pos-total ${dif < 0 ? 'devolver' : ''}">
           <span>${dif < 0 ? 'A devolver' : dif > 0 ? 'A cobrar' : 'Queda a mano'}</span>
           <strong>${pesos(Math.abs(dif))}</strong>
         </div>`
      : `<div class="pos-total ${hayAlgo() ? '' : 'apagado'}">
           <span>Total</span>
           <strong>${pesos(t)}</strong>
         </div>`;

    pantalla.querySelector('#cobrar').disabled = !hayAlgo();
    pantalla.querySelector('#cobrar').querySelector('span').textContent =
      cambiando ? 'Hacer el cambio' : 'Cobrar';

    const etiqueta = pantalla.querySelector('#etiqueta-espera');
    etiqueta.hidden = enEspera.length === 0;
    etiqueta.textContent = `${enEspera.length} en espera`;

    const quitarCambio = refs.lineas.querySelector('[data-cancelar-cambio]');
    if (quitarCambio) quitarCambio.onclick = () => { cambiando = null; pintarTodo(); enfocar(); };

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

      refs.rejilla.innerHTML = suyos.map((p) => {
        const quedan = quedanDe(p);
        const vacio = quedan <= 0;
        // Lo que ya no hay se ve muerto y no responde: es más claro que
        // dejar tocarlo y contestar con un aviso cada vez.
        const poco = !vacio && Number.isFinite(quedan) && p.minimo && quedan <= p.minimo;
        return `
        <button class="pos-boton ${vacio ? 'pos-boton-vacio' : ''}" data-producto="${esc(p.id)}"
                ${vacio ? 'disabled' : ''}
                style="${p.color || p.categoria_color
                  ? `--tono:${esc(p.color || p.categoria_color)}` : ''}">
          ${p.codigo ? `<span class="pos-boton-codigo">${esc(p.codigo)}</span>` : ''}
          <span class="pos-boton-nombre">${esc(p.nombre)}</span>
          <span class="pos-boton-precio">${p.tipo === 'hielo'
            ? pesos(precioHielo(p.dieciseisavos))
            : pesos(p.precio_centavos)}</span>
          ${vacio ? '<span class="pos-boton-marca">se acabó</span>'
            : poco ? `<span class="pos-boton-marca poco">quedan ${quedan}</span>` : ''}
        </button>`;
      }).join('')
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

  /**
   * El renglón de abajo: reloj y nombre del negocio a la izquierda, y a la
   * derecha el cartel que dice qué hace enter ahora mismo.
   *
   * El reloj vivía en la franja azul de arriba. Aquí abajo ocupa un hueco
   * que de todos modos estaba vacío, y esa franja entera —cien píxeles de
   * alto— se le devuelve a los botones.
   */
  function pintarPista() {
    // Fiando, enter no cobra: fía. El cartel de abajo es lo que hace que el
    // teclado se aprenda sin manual, así que tiene que decir la verdad.
    const f = fase === 'cambio' && fiadoA
      ? { enter: 'fía y registra', esc: 'mejor cobrarle' }
      : FASES[fase];
    refs.pista.innerHTML = `
      <span class="pos-reloj">
        <strong id="pos-hora">—</strong>
        <small id="pos-fecha"></small>
      </span>
      ${marca.nombreNegocio
        ? `<span class="pos-marca">${esc(marca.nombreNegocio)}</span>` : ''}
      <span class="pos-teclas">
        <span><kbd>Enter</kbd> ${esc(f.enter)}</span>
        <span><kbd>Esc</kbd> ${esc(f.esc)}</span>
        ${fase === 'venta' ? `
          <span><kbd>F10</kbd> cobrar</span>
          <span><kbd>F2</kbd> nueva venta</span>
          <span><kbd>F3</kbd> tickets</span>
          <span><kbd>F4</kbd> cambio</span>` : ''}
      </span>`;
    pintarHora();
  }

  function pintarHora() {
    const ahora = new Date();
    const hora = pantalla.querySelector('#pos-hora');
    const dia = pantalla.querySelector('#pos-fecha');
    if (!hora) return;
    hora.textContent = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    if (dia) {
      dia.textContent = ahora.toLocaleDateString('es-MX',
        { weekday: 'short', day: 'numeric', month: 'short' });
    }
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

    // F2 aparta el ticket de ahora y deja la pantalla lista para otro
    // cliente. Con una venta ya apartada, muestra la lista.
    if (ev.key === 'F2') {
      ev.preventDefault();
      if (fase === 'venta') verEnEspera();
      else if (fase === 'espera') cerrarEspera();
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

    // F4 es el cambio de ticket.
    if (ev.key === 'F4') {
      ev.preventDefault();
      if (fase === 'venta') iniciarCambio();
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
    if (fase === 'espera') return;
    if (fase === 'avisos') return;
    if (fase === 'movimientos') return;
    if (fase === 'clientes') return;
    if (fase === 'venta')   return agregarPorCodigo();
    if (fase === 'cobro')   return calcularCambio();
    if (fase === 'cambio')  return registrar();
    if (fase === 'cobrada') return imprimir();
  }

  function retroceder() {
    if (fase === 'historial') { cerrarHistorial(); return; }
    if (fase === 'espera') { cerrarEspera(); return; }
    if (fase === 'avisos') { cerrarAvisos(); return; }
    if (fase === 'movimientos') { cerrarAvisos(); return; }
    if (fase === 'clientes') { fase = 'cobro'; pintarCobro(); pintarPista(); return; }
    if (fase === 'venta') {
      if (refs.codigo.value) { refs.codigo.value = ''; return; }
      if (cambiando) { cambiando = null; pintarTodo(); return; }
      if (hayAlgo()) vaciar();
      return;
    }
    if (fase === 'cobro')   { cerrarCobro(); return; }
    if (fase === 'cambio')  {
      if (fiadoA) { fiadoA = null; }
      fase = 'cobro'; pintarCobro(); pintarPista(); return;
    }
    if (fase === 'cobrada') { nuevaVenta(); }
  }

  function agregarPorCodigo() {
    const codigo = refs.codigo.value.trim();
    if (!codigo) return;

    const p = porCodigo(codigo);
    if (!p) { avisar(`No hay ningún producto con el código ${codigo}`, 'error'); return; }

    // Se limpia siempre, aunque no se pueda agregar: si el código se queda
    // en el campo, el siguiente que teclee sale pegado al anterior.
    refs.codigo.value = '';
    agregarProducto(p);
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
    fiadoA = null;
    refs.cobro.hidden = true;
    pintarPista();
    enfocar();
  }

  function pintarCobro() {
    // Fiando no hay nada que cobrar ahora: el panel es otro.
    if (fiadoA) return pintarFiado();

    // En un cambio, el cliente ya pagó el ticket que trae: lo único que
    // se mueve es la diferencia. Puede ser a cobrar o a devolver.
    const aPagar = cambiando ? Math.max(total() - cambiando.aFavor, 0) : total();
    const aDevolver = cambiando ? Math.max(cambiando.aFavor - total(), 0) : 0;
    const vuelto = pago - aPagar;

    // Si no hay nada que cobrar (se lleva menos, o queda a mano) no se pide
    // pago: sería preguntarle con cuánto paga cuando no paga nada.
    const soloDevolver = aPagar === 0;
    const enConfirmacion = fase === 'cambio';

    refs.cobro.hidden = false;
    refs.cobro.innerHTML = `
      <div class="pos-cobro-caja">
        ${cambiando ? `
          <div class="pos-cobro-cambio-aviso">
            Cambio del ticket #${cambiando.venta.folio} ·
            a favor ${pesos(cambiando.aFavor)}
          </div>` : ''}

        <div class="pos-cobro-total ${aDevolver ? 'devolver' : ''}">
          <span>${aDevolver ? 'A devolver al cliente'
                 : aPagar === 0 ? 'Queda a mano' : 'Total a cobrar'}</span>
          <strong>${pesos(aDevolver || aPagar)}</strong>
        </div>

        ${soloDevolver ? `
          <button class="pos-confirmar" id="confirmar">
            <span>${aDevolver ? `Devolver ${pesos(aDevolver)}` : 'Hacer el cambio'}</span>
            <small>Enter</small>
          </button>` : `
          <label class="etiqueta-chica" for="pos-pago">¿Con cuánto paga?</label>
          <input id="pos-pago" class="pos-pago" inputmode="decimal" autocomplete="off"
                 placeholder="${(aPagar / 100).toFixed(2)}"
                 ${enConfirmacion ? 'disabled' : ''}
                 value="${pago ? (pago / 100).toFixed(2) : ''}">

          <div class="pos-billetes">
            ${BILLETES.filter((b) => b * 100 >= aPagar).slice(0, 4)
              .map((b) => `<button class="secundario chico" data-billete="${b}">$${b}</button>`).join('')}
            <button class="secundario chico" data-billete="justo">Justo</button>
          </div>

          ${puedeFiar && !cambiando ? `
            <button class="secundario pos-fiar" id="fiar">
              🧾 Fiar a un cliente
            </button>` : ''}

          ${enConfirmacion ? `
            <div class="pos-cambio ${vuelto === 0 ? 'sin-cambio' : ''}">
              <span>${vuelto === 0 ? 'Pagó justo' : 'Cambio'}</span>
              <strong>${pesos(vuelto)}</strong>
            </div>
            <button class="pos-confirmar" id="confirmar">
              <span>${cambiando ? 'Hacer el cambio' : `Cobrar ${pesos(aPagar)}`}</span>
              <small>Enter</small>
            </button>` : `
            <button class="pos-confirmar" id="calcular">
              <span>Calcular el cambio</span><small>Enter</small>
            </button>`}`}

        <button class="secundario" id="salir-cobro" style="margin-top:10px;width:100%">
          Esc · volver al ticket
        </button>
      </div>`;

    const campo = refs.cobro.querySelector('#pos-pago');
    if (campo) {
      if (fase === 'cobro') setTimeout(() => campo.focus(), 0);
      campo.oninput = () => {
        pago = Math.round((Number(campo.value.replace(/[^0-9.]/g, '')) || 0) * 100);
      };
    } else {
      // Sin campo de pago, el foco tiene que salir de la caja de códigos:
      // si se queda ahí, lo que se teclee se iría al ticket de atrás.
      setTimeout(() => refs.cobro.querySelector('#confirmar')?.focus(), 0);
    }

    refs.cobro.querySelectorAll('[data-billete]').forEach((b) => {
      b.onclick = () => {
        pago = b.dataset.billete === 'justo' ? aPagar : Number(b.dataset.billete) * 100;
        if (campo) campo.value = (pago / 100).toFixed(2);
        calcularCambio();
      };
    });

    const botonFiar = refs.cobro.querySelector('#fiar');
    if (botonFiar) botonFiar.onclick = () => verClientes();

    const calcular = refs.cobro.querySelector('#calcular');
    if (calcular) calcular.onclick = calcularCambio;
    const btnConfirmar = refs.cobro.querySelector('#confirmar');
    if (btnConfirmar) btnConfirmar.onclick = registrar;
    refs.cobro.querySelector('#salir-cobro').onclick = cerrarCobro;
  }

  /**
   * EL PANEL DE FIAR.
   *
   * Enseña lo que va a deber DESPUÉS de este ticket, no lo que debe ahora:
   * ese es el número por el que el cajero decide si le fía o llama al
   * gerente, y hacerlo de cabeza con gente esperando es como se cometen los
   * errores caros.
   */
  function pintarFiado() {
    const t = total();
    const saldoDespues = fiadoA.saldo + t;
    const disponible = fiadoA.disponible;
    const seExcede = disponible !== null && t > disponible;

    fase = 'cambio';
    refs.cobro.hidden = false;
    refs.cobro.innerHTML = `
      <div class="pos-cobro-caja">
        <div class="pos-cobro-total">
          <span>Se le fía a</span>
          <strong class="pos-fiado-nombre">${esc(fiadoA.nombre)}</strong>
        </div>
        ${fiadoA.negocio ? `<p class="ayuda" style="margin:-12px 0 14px;text-align:center">
          ${esc(fiadoA.negocio)}</p>` : ''}

        <div class="cuadre">
          <div class="cuadre-linea"><span>Debía</span><strong>${pesos(fiadoA.saldo)}</strong></div>
          <div class="cuadre-linea suma"><span>+ Este ticket</span><strong>${pesos(t)}</strong></div>
          <div class="cuadre-linea total">
            <span>= Va a deber</span>
            <strong class="${seExcede ? 'malo' : ''}">${pesos(saldoDespues)}</strong>
          </div>
          ${disponible !== null ? `
            <div class="cuadre-linea">
              <span>Su límite</span><strong>${pesos(fiadoA.limite)}</strong>
            </div>` : ''}
        </div>

        ${seExcede ? `
          <div class="aviso-sin-caja" style="margin-top:12px">
            <strong>Se pasa de su límite.</strong>
            Se puede fiar igual, pero lo tiene que autorizar un gerente con su PIN.
          </div>` : ''}
        ${fiadoA.vencido ? `
          <div class="aviso-sin-caja" style="margin-top:12px">
            <strong>Ya se le venció el plazo</strong> de lo que debe de antes.
          </div>` : ''}

        <button class="pos-confirmar" id="confirmar" style="margin-top:14px">
          <span>Fiar ${pesos(t)}</span><small>Enter</small>
        </button>
        <button class="secundario" id="quitar-fiado" style="margin-top:10px;width:100%">
          Mejor cobrarle
        </button>
        <button class="secundario" id="salir-cobro" style="margin-top:10px;width:100%">
          Esc · volver al ticket
        </button>
      </div>`;

    setTimeout(() => refs.cobro.querySelector('#confirmar')?.focus(), 0);
    refs.cobro.querySelector('#confirmar').onclick = registrar;
    refs.cobro.querySelector('#quitar-fiado').onclick = () => {
      fiadoA = null; fase = 'cobro'; pago = 0; pintarCobro(); pintarPista();
    };
    refs.cobro.querySelector('#salir-cobro').onclick = cerrarCobro;
    pintarPista();
  }

  /**
   * A QUIÉN SE LE FÍA.
   *
   * Solo los que están dados de alta: es la regla del negocio, y por eso la
   * lista no tiene "cliente nuevo". Dar de alta a alguien se hace en su
   * pantalla, con calma, no en medio del cobro con gente esperando.
   */
  function verClientes(busca = '') {
    fase = 'clientes';
    refs.cobro.hidden = false;

    const filtro = busca.trim().toLowerCase();
    const lista = (ctx.clientes || []).filter((c) =>
      !filtro || `${c.nombre} ${c.negocio || ''}`.toLowerCase().includes(filtro));

    refs.cobro.innerHTML = `
      <div class="pos-cobro-caja pos-historial">
        <h3 style="margin:0 0 4px">¿A quién se le fía?</h3>
        <p class="ayuda" style="margin:0 0 12px">
          Solo a clientes dados de alta. Al público en general no se le fía.
        </p>
        <input id="busca-cliente" class="buscador" autocomplete="off"
               placeholder="Nombre o negocio" value="${esc(busca)}" style="margin:0">
        <div class="lista-tickets">
          ${lista.slice(0, 40).map((c) => `
            <div class="ticket-fila">
              <div class="crece">
                <strong>${esc(c.nombre)}</strong>
                <small>${c.negocio ? esc(c.negocio) + ' · ' : ''}${
                  c.saldo > 0 ? 'debe ' + pesos(c.saldo) : 'no debe nada'}${
                  c.limite !== null ? ' · límite ' + pesos(c.limite) : ''}</small>
              </div>
              ${c.vencido ? '<span class="aviso-quedan agotado">vencido</span>' : ''}
              <button class="secundario chico" data-cliente="${esc(c.id)}">Fiarle</button>
            </div>`).join('')
            || `<p class="vacio" style="padding:20px 0">${
                 (ctx.clientes || []).length
                   ? 'Ningún cliente con ese nombre.'
                   : 'Todavía no hay clientes dados de alta.'}</p>`}
        </div>
        <button class="secundario" id="cerrar-clientes" style="margin-top:12px;width:100%">
          Esc · volver al cobro
        </button>
      </div>`;

    const campo = refs.cobro.querySelector('#busca-cliente');
    setTimeout(() => campo.focus(), 60);
    campo.oninput = () => {
      const donde = campo.selectionStart;
      verClientes(campo.value);
      const nuevo = refs.cobro.querySelector('#busca-cliente');
      nuevo.focus();
      nuevo.setSelectionRange(donde, donde);
    };
    campo.onkeydown = (ev) => { if (ev.key === 'Enter') ev.stopPropagation(); };

    refs.cobro.querySelectorAll('[data-cliente]').forEach((b) => {
      b.onclick = () => {
        fiadoA = (ctx.clientes || []).find((c) => c.id === b.dataset.cliente) || null;
        if (fiadoA) pintarFiado();
      };
    });
    refs.cobro.querySelector('#cerrar-clientes').onclick = () => {
      fase = 'cobro'; pintarCobro(); pintarPista();
    };
    pintarPista();
  }

  function calcularCambio() {
    const aPagar = cambiando ? Math.max(total() - cambiando.aFavor, 0) : total();

    // Si no hay nada que cobrar —se lleva menos, o queda a mano— no hay
    // cambio que calcular. El botón dice "Devolver $99", así que enter tiene
    // que hacer eso y no dejar la misma pantalla pidiendo otro enter.
    if (aPagar === 0) { pago = 0; fase = 'cambio'; registrar(); return; }

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

  async function registrar(autorizacion = null) {
    if (fase !== 'cambio' && fase !== 'guardando') return;
    fase = 'guardando';
    pintarPista();

    const lineas = [];
    if (hielo > 0) lineas.push({ dieciseisavos: hielo });
    for (const a of articulos) lineas.push({ productoId: a.producto.id, cantidad: a.cantidad });

    try {
      const respuesta = cambiando
        ? await api.enviar(`/ventas/${cambiando.venta.id}/cambiar`, {
            almacenId: ctx.almacenes[0]?.id,
            lineas,
            // En un cambio el cliente solo entrega la diferencia.
            pago: pago ? (pago / 100).toFixed(2) : undefined,
            motivo: 'Cambio del ticket que trajo el cliente'
          })
        : await api.enviar('/ventas', {
            almacenId: ctx.almacenes[0]?.id,
            lineas,
            // Fiado no lleva pago: el cliente no pagó nada.
            ...(fiadoA
              ? { formaPago: 'credito', clienteId: fiadoA.id,
                  ...(autorizacion
                    // El porqué se guarda con el ticket: al mes, "lo
                    // autorizó Lupe" sin el motivo no explica nada.
                    ? { autorizacion, notas: `Sobre su límite: ${autorizacion.motivo}` }
                    : {}) }
              : { pago: (pago / 100).toFixed(2) })
          });

      const venta = respuesta.venta;
      ultimoCambio = cambiando ? respuesta : null;
      cambiando = null;
      ventaCobrada = venta;
      // Lo que quedó debiendo, para poder decírselo al cliente en la cara.
      fiadoCobrado = respuesta.cliente || null;
      ctx.siguienteFolio = venta.folio + 1;
      if (fiadoA && respuesta.cliente) refrescarCliente(respuesta.cliente);
      fiadoA = null;
      fase = 'cobrada';
      pintarCobrada();
      pintarPista();
      // Lo que quedaba cambió con esta venta. Se vuelve a preguntar en
      // segundo plano: nadie espera por la bolita.
      refrescarAvisos();
      // NO se imprime solo: no todos los tickets se entregan, y cada uno
      // que sale sin que nadie lo pida es papel tirado. Enter imprime.
    } catch (e) {
      // Se pasó de su límite: no se rechaza a secas, se pide el PIN de un
      // responsable. Al de la ferretería que lleva veinte años comprando no
      // se le para la venta por un número que alguien escribió hace meses.
      if (e.requiereAutorizacion && fiadoA && !autorizacion) {
        const auth = await pedirAutorizacion({
          titulo: `${fiadoA.nombre} se pasa de su límite`,
          texto: e.message,
          responsables: e.responsables || [],
          motivoSugerido: 'Cliente de siempre, siempre paga'
        });
        if (auth) return registrar(auth);
      }
      fase = 'cambio';
      pintarCobro();
      pintarPista();
      avisar(e.message, 'error');
    }
  }

  /** Deja la lista del contexto con el saldo nuevo, sin ir al servidor. */
  function refrescarCliente(actualizado) {
    const i = (ctx.clientes || []).findIndex((c) => c.id === actualizado.id);
    if (i < 0) return;
    ctx.clientes[i] = {
      ...ctx.clientes[i],
      saldo: actualizado.estado.saldo,
      disponible: actualizado.estado.disponible,
      vencido: actualizado.estado.vencido
    };
  }

  function pintarCobrada() {
    const v = ventaCobrada;
    const c = ultimoCambio;

    // En un cambio, lo que el cajero necesita ver es lo que entrega o
    // recibe de más, no el "cambio" de un billete.
    const aDevolver = c ? c.porDevolver : 0;
    const vuelto = c ? 0 : (v.cambio_centavos || 0);

    // Fiado: lo que hay que decirle al cliente no es el cambio, es cuánto
    // debe ahora. Es el momento en que lo va a oír, y el único en que puede
    // decir "no, yo ya te pagué".
    const fiado = v.forma_pago === 'credito';

    refs.cobro.innerHTML = `
      <div class="pos-cobro-caja pos-cobrada">
        <div class="pos-cobrada-folio">
          Ticket #${v.folio}${c ? ` · cambio del #${c.anterior.folio}` : ''}
        </div>

        ${fiado ? `
          <div class="pos-cambio grande pos-fiado">
            <span>${esc(v.cliente_nombre || 'Fiado')} ahora debe</span>
            <strong>${pesos(fiadoCobrado?.estado?.saldo ?? v.total_centavos)}</strong>
          </div>
          ${v.credito_autorizado_nombre ? `
            <p class="ayuda" style="margin:0 0 10px;text-align:center">
              Autorizó ${esc(v.credito_autorizado_nombre)}
            </p>` : ''}
          <p class="ayuda" style="margin:0 0 10px;text-align:center">
            El ticket sale marcado <strong>FIADO</strong>, con línea para firmar.
          </p>` : `
          <div class="pos-cambio grande ${(aDevolver || vuelto) ? '' : 'sin-cambio'}">
            <span>${aDevolver ? 'Devuélvele' : vuelto ? 'Cambio' : 'Pagó justo'}</span>
            <strong>${pesos(aDevolver || vuelto)}</strong>
          </div>`}

        <button class="pos-confirmar" id="otro-ticket">
          <span>🖨️ Imprimir ticket</span><small>Enter</small>
        </button>
        <button class="secundario" id="siguiente" style="margin-top:10px;width:100%">
          Esc · ${enEspera.length ? 'volver a la venta pendiente' : 'siguiente venta'}
        </button>
      </div>`;

    refs.cobro.querySelector('#otro-ticket').onclick = () => imprimir();
    refs.cobro.querySelector('#siguiente').onclick = nuevaVenta;
  }

  function nuevaVenta() {
    hielo = 0; articulos = []; pago = 0; ventaCobrada = null;
    ultimoCambio = null; cambiando = null; fiadoA = null;
    fase = 'venta';
    refs.cobro.hidden = true;
    limpiarImpresion();
    pantalla.querySelector('#etiqueta-folio').textContent = `ticket #${ctx.siguienteFolio}`;

    // Si quedó alguien esperando, su ticket vuelve solo: es a lo que se
    // regresa después de atender al que se coló.
    if (retomarSiHay()) return;

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

        ${v.forma_pago === 'credito' ? `
          <div class="tk-copia">FIADO</div>
          ${v.cliente_nombre ? `<div class="tk-pie"><b>${esc(v.cliente_nombre)}</b></div>` : ''}
          <div class="tk-firma">_____________________<br>Firma de recibido</div>` : ''}

        ${v.pago_centavos && v.cambio_centavos ? `
          <div class="tk-pago">
            Pagó ${pesos(v.pago_centavos)} · cambio ${pesos(v.cambio_centavos)}
          </div>` : ''}

        ${marca.nombreNegocio ? `<div class="tk-pie">${esc(marca.nombreNegocio)}</div>` : ''}
      </div>`;
  }

  // ==========================================================
  // CAMBIO DE TICKET
  //
  // "Pedí 1/2 pero no sabía que era tanto, quería 1/8." Pasa seguido.
  // Se pide el número del ticket, se ve qué traía, y a partir de ahí se
  // arma el ticket nuevo normal: lo que traía queda como saldo a favor y
  // abajo se ve si hay que cobrar la diferencia o devolverla.
  // ==========================================================
  async function iniciarCambio() {
    if (cambiando) { avisar('Ya estás haciendo un cambio', ''); enfocar(); return; }
    if (hayAlgo()) {
      avisar('Termina o aparta el ticket de ahora antes de hacer un cambio', 'error');
      enfocar();
      return;
    }

    const folio = await pedirTexto({
      titulo: 'Cambio de ticket',
      texto: 'Número del ticket que trae el cliente. Viene impreso arriba.',
      marcador: '124', ok: 'Buscar', largo: 12, unaLinea: true
    });
    if (!folio) { enfocar(); return; }

    try {
      const { ventas } = await api.obtener(
        `/ventas?limite=5&busca=${encodeURIComponent(folio.trim())}`);
      const v = ventas.find((x) => String(x.folio) === folio.trim());

      if (!v) { avisar(`No hay ningún ticket #${folio.trim()}`, 'error'); enfocar(); return; }
      if (v.cancelada_en) {
        avisar(`El ticket #${v.folio} está cancelado y no se puede cambiar`, 'error');
        enfocar();
        return;
      }

      const { venta } = await api.obtener(`/ventas/${v.id}`);
      const detalle = venta.lineas
        .map((l) => `${l.dieciseisavos ? l.texto + ' de ' : ''}${l.concepto.toLowerCase()}`)
        .join(', ');

      if (!await confirmar({
        titulo: `Ticket #${venta.folio} · ${pesos(venta.total_centavos)}`,
        texto: `Traía: ${detalle}. Se le abona a favor y eliges por qué lo cambia.`,
        ok: 'Hacer el cambio'
      })) { enfocar(); return; }

      cambiando = { venta, aFavor: venta.total_centavos };
      pintarTodo();
      enfocar();
    } catch (e) { avisar(e.message, 'error'); enfocar(); }
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

      // «Ver» abre lo que traía el ticket sin salir de la lista. Es la
      // pregunta de verdad —"¿qué se llevó?"— y antes había que imprimir
      // una copia para contestarla, o sea gastar papel para leer.
      caja.innerHTML = ventas.length ? ventas.map((v) => `
        <div class="ticket-fila ${v.cancelada_en ? 'anulada' : ''}">
          <div class="crece">
            <strong>#${v.folio}</strong>
            <small>${esc(formatoFecha(v.fecha))} · ${esc(v.cajero_nombre || '—')}${
              v.cliente_nombre ? ' · fiado a ' + esc(v.cliente_nombre) : ''}</small>
          </div>
          <span class="ticket-fila-total ${v.forma_pago === 'credito' ? 'fiado' : ''}">
            ${pesos(v.total_centavos)}</span>
          <button class="secundario chico" data-ver="${esc(v.id)}">Ver</button>
          <button class="secundario chico" data-reimprimir="${esc(v.id)}">Copia</button>
        </div>
        <div class="ticket-detalle" data-detalle="${esc(v.id)}" hidden></div>`).join('')
        : '<p class="vacio" style="padding:20px 0">No hay tickets que coincidan.</p>';

      caja.querySelectorAll('[data-ver]').forEach((b) => {
        b.onclick = () => verQueTraia(b);
      });

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

  /** Lo que traía un ticket, desplegado bajo su renglón. */
  async function verQueTraia(boton) {
    const id = boton.dataset.ver;
    const caja = refs.cobro.querySelector(`[data-detalle="${CSS.escape(id)}"]`);
    if (!caja) return;

    if (!caja.hidden) { caja.hidden = true; boton.textContent = 'Ver'; return; }

    caja.hidden = false;
    boton.textContent = 'Cerrar';
    caja.innerHTML = '<p class="ayuda" style="margin:0">Buscando…</p>';

    try {
      const { venta } = await api.obtener(`/ventas/${id}`);
      caja.innerHTML = `
        <table class="venta-lineas">
          ${venta.lineas.map((l) => `
            <tr>
              <td class="detalle">
                ${l.dieciseisavos
                  ? `<strong>${esc(l.texto)}</strong> de ${esc(l.concepto.toLowerCase())}`
                  : `${l.cantidad > 1 ? `<strong>${l.cantidad}</strong> × ` : ''}${esc(l.concepto)}`}
              </td>
              <td class="importe">${pesos(l.precio_centavos)}</td>
            </tr>`).join('')}
          <tr class="total">
            <td class="detalle"><strong>Total</strong></td>
            <td class="importe"><strong>${pesos(venta.total_centavos)}</strong></td>
          </tr>
        </table>
        ${venta.pago_centavos ? `
          <p class="ayuda" style="margin:6px 0 0">
            Pagó ${pesos(venta.pago_centavos)}${venta.cambio_centavos
              ? ` · cambio ${pesos(venta.cambio_centavos)}` : ' justo'}
          </p>` : ''}
        ${venta.forma_pago === 'credito' ? `
          <p class="ayuda" style="margin:6px 0 0">
            <strong>Fiado</strong> a ${esc(venta.cliente_nombre || '—')}${
              venta.credito_autorizado_nombre
                ? ` · autorizó ${esc(venta.credito_autorizado_nombre)}` : ''}
          </p>` : ''}
        ${venta.cancelada_en ? `
          <p class="ayuda" style="margin:6px 0 0">
            <strong>Cancelado</strong>${venta.motivo_cancelacion
              ? ': ' + esc(venta.motivo_cancelacion) : ''}
          </p>` : ''}`;
    } catch (e) {
      caja.innerHTML = `<p class="ayuda" style="margin:0">${esc(e.message)}</p>`;
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

  // ==========================================================
  // LOS BOTONES RÁPIDOS DE LA DERECHA
  //
  // El cajero pasa el día en esta pantalla. Ir al menú, buscar Existencia
  // y volver son cuatro toques que se hacen veinte veces al día; desde
  // aquí es uno. Antes de salir, lo que esté capturado se aparta solo:
  // nunca se pierde un ticket a medias por tocar un botón de al lado.
  // ==========================================================
  function salirA(destino) {
    if (hayAlgo() && !cambiando) apartarVenta();
    if (cambiando) {
      avisar('Termina el cambio antes de salir de la pantalla', 'error');
      enfocar();
      return;
    }
    location.hash = destino;
  }

  const irExistencia = pantalla.querySelector('#ir-existencia');
  if (irExistencia) irExistencia.onclick = () => salirA('#/existencia');
  const irNumeros = pantalla.querySelector('#ir-numeros');
  if (irNumeros) irNumeros.onclick = () => salirA('#/tanques');
  const irTurno = pantalla.querySelector('#terminar-turno');
  if (irTurno) irTurno.onclick = () => salirA('#/caja');
  const verMovs = pantalla.querySelector('#ver-movimientos');
  if (verMovs) verMovs.onclick = () => verMovimientos();

  // El menú es el de siempre; aquí solo se le presta un botón.
  pantalla.querySelector('#pos-menu').onclick =
    () => document.getElementById('btn-menu')?.click();

  pantalla.querySelector('#cobrar').onclick = irACobro;
  pantalla.querySelector('#historial').onclick = () => verHistorial();
  pantalla.querySelector('#nueva-venta').onclick = () => verEnEspera();
  pantalla.querySelector('#cambio').onclick = () => iniciarCambio();
  // El campo del código se queda con el enter SOLO mientras se está
  // capturando. En el cobro no hay nada que agregar, y si se lo tragara,
  // el enter que confirma no llegaría a ningún lado.
  refs.codigo.onkeydown = (ev) => {
    if (ev.key === 'Enter' && fase === 'venta') ev.stopPropagation();
  };
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
