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
import { pedirTexto, pedirImporte, pedirCantidad, pedirEntero, confirmar,
         pedirAutorizacion, menu, verTicket } from '../dialogo.js';
import { aTexto, descomponer, desglose, pesos, paraEditar } from '../fracciones.js';
import { cargarMarca } from '../marca.js';
import { imprimirTicket, limpiarImpresion, htmlDeEspejo } from '../imprimir.js';
import { tono } from '../sonido.js';
import { hacerVale } from '../vale.js';

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
  // Ver clientes basta para ponerle nombre al ticket: el precio de mayoreo
  // no es fiar, es cobrarle lo suyo a quien lo tiene.
  const puedeVerClientes = tiene('clientes.ver');
  const puedeRepartirNumeros = tiene('produccion.numeros');
  // Devolver saca dinero del cajón por algo que ya se cobró: eso lo revisa
  // un gerente, no se hace solo desde el mostrador.
  const puedeDevolver = tiene('venta.cancelar');

  const marca = await cargarMarca();
  let ctx = await api.obtener('/ventas/contexto');

  // Precios del hielo por fracción, para cotizar sin ir al servidor.
  const preciosPublico = new Map(ctx.precios.map((p) => [p.dieciseisavos, p.centavos]));

  /**
   * EL MAYOREO  (v2.0)
   *
   * El mayoreo se teclea: "1m" y enter, y el renglón entra ya con precio de
   * mayoreo. Las listas llegan enteras con el contexto —con todos sus
   * precios— para que al decir de quién es el ticket el precio cambie EN LA
   * PANTALLA, en el acto. Pedírselo al servidor sería medio segundo de
   * espera con el cliente enfrente.
   *
   * El servidor vuelve a decidir el precio al cobrar, desde cero. Esto es
   * nada más lo que se ve.
   */
  const listasMayoreo = new Map((ctx.mayoreo?.listas || []).map((l) => [l.id, {
    id: l.id,
    nombre: l.nombre,
    precios: new Map(l.precios.map((p) => [p.dieciseisavos, p.centavos]))
  }]));
  // La que se cobra mientras no se sabe quién es el cliente.
  const MAYOREO_POR_OMISION = ctx.mayoreo?.porOmision || null;

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

  /** Lo último que entró al ticket, para que enter en vacío lo repita. */
  let ultimoAgregado = null;

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
   * DE QUIÉN ES ESTE TICKET.
   *
   * null es lo normal: el público paga y se va. Ponerle nombre a un ticket
   * sirve para dos cosas distintas, y por eso son dos variables:
   *
   *  · `cliente` es QUIÉN ES. Si tiene lista de mayoreo y lleva suficiente
   *    hielo, el precio de la pantalla cambia solo. Pagando en efectivo
   *    también: el de la nevería paga y se va, pero paga su precio.
   *  · `fiar` es SI SE LO LLEVA FIADO. Eso ya es otra cosa, se necesita
   *    permiso, y el panel del cobro es distinto.
   *
   * Siempre salen de la lista de clientes dados de alta, nunca de un nombre
   * escrito a mano con la gente esperando.
   */
  let cliente = null;
  let fiar = false;
  let volverDeClientes = 'cobro';   // a dónde regresa Esc en la lista de clientes
  let cobrarAlElegir = false;       // se abrió camino al cobro: al elegir, se sigue

  // ---- La fase del teclado ----
  let fase = 'venta';
  let pago = 0;                  // centavos tecleados en el cobro
  let ventaCobrada = null;
  let mayoreoCobrado = null;     // con qué lista salió el último ticket
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
  // La temperatura cambia despacio: cada diez minutos sobra, y el servidor
  // además no le pregunta a internet más de una vez cada cuarto de hora.
  const termometro = setInterval(pintarClima, 10 * 60 * 1000);

  // El alto de cada cuadro depende de lo que mida la rejilla, y eso cambia
  // al agrandar la ventana o al girar la tablet. Se vuelve a medir sola.
  const vigilante = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => ajustarRejilla())
    : null;
  if (vigilante) vigilante.observe(refs.rejilla);

  pantalla.addEventListener('vista-desmontada', () => {
    document.removeEventListener('keydown', alTeclado);
    clearInterval(relojito);
    clearInterval(termometro);
    if (vigilante) vigilante.disconnect();
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
          ${puedeVerClientes ? `
            <button class="pos-accion pos-accion-cliente" id="quien-es">
              <span>👤 Cliente</span><small>F6</small>
            </button>` : ''}
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
            <span class="etiqueta-folio" id="etiqueta-folio">ticket ${esc(ctx.siguienteNumero)}</span>
            ${ctx.caja
              ? `<span class="etiqueta-turno ${ctx.caja.sinDueno ? 'esperando' : ''}">
                   turno #${ctx.caja.folio}
                 </span>`
              : '<span class="etiqueta-mal">sin turno</span>'}
            <span class="etiqueta-espera" id="etiqueta-espera" hidden></span>
          </div>

          ${ctx.caja?.sinDueno ? `
            <div class="pos-sin-dueno" id="pos-sin-dueno">
              <div class="crece">
                <strong>Este turno no tiene dueño</strong>
                <small>
                  Lo que se cobra se está apartando para el cajero que entra.
                </small>
              </div>
              <button class="chico" id="tomar-turno">Tomar el turno</button>
            </div>` : ''}

          <div class="pos-lineas" id="pos-lineas"></div>

          <div id="pos-total"></div>

          ${puedeOperarCaja ? `
            <div class="pos-dinero">
              <button class="pos-btn-entrada" id="meter">＋ Meter dinero</button>
              <button class="pos-btn-salida" id="gasto">− Gasto</button>
              <!-- EL VALE, AQUÍ TAMBIÉN (v4.4). Quien llega a llevarse el
                   efectivo llega al mostrador, no a la pantalla de Caja.
                   Ni verde ni rojo: el dinero sale, pero no se gastó. -->
              <button class="pos-btn-vale" id="vale"
                      title="Alguien se llevó efectivo del cajón: sale su papel firmado">
                📤 Vale
              </button>
            </div>` : ''}

          <button class="pos-cobrar" id="cobrar">
            <span>Cobrar</span><small>F10</small>
          </button>

          <button class="secundario chico pos-cotizar" id="cotizar"
                  title="Imprime el precio SIN vender: no hay folio, no se abre el cajón y no entra al corte.">
            📋 Solo cotización
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
      // El cliente se va con su ticket: al retomarlo tiene que volver a
      // salir su precio, no el de público.
      clienteId: cliente?.id || null,
      hora: new Date().toISOString()
    });
    guardarEnEspera();

    hielo = 0;
    articulos = [];
    cliente = null; fiar = false;
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
    cliente = v.clienteId
      ? (ctx.clientes || []).find((c) => c.id === v.clienteId) || null : null;
    fiar = false;

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
          <button class="secundario crece" id="cerrar-espera"><span class="tecla-dice">Esc · </span>volver</button>
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
  /**
   * CON QUÉ LISTA DE MAYOREO SE ESTÁ COBRANDO.
   *
   * La del cliente si tiene una propia; si no, la de siempre. Un cliente sin
   * lista propia no es un cliente sin mayoreo: es uno al que se le cobra el
   * mayoreo normal. Igualito que en el servidor.
   */
  function listaMayoreo() {
    if (cliente?.listaId && listasMayoreo.has(cliente.listaId)) {
      return listasMayoreo.get(cliente.listaId);
    }
    return listasMayoreo.get(MAYOREO_POR_OMISION)
        || [...listasMayoreo.values()][0]
        || null;
  }

  /** ¿Este ticket lleva algo de mayoreo? Entonces necesita nombre. */
  function llevaMayoreo() {
    return articulos.some((a) => a.producto.mayoreo);
  }

  function precioHielo(dieciseisavos) {
    return conLista(dieciseisavos, preciosPublico);
  }

  /** Lo que cuesta un producto de mayoreo, con la lista que toque. */
  function precioMayoreo(dieciseisavos) {
    const lista = listaMayoreo();
    return lista ? conLista(dieciseisavos, lista.precios) : 0;
  }

  /** El mismo reparto que hace el servidor: 3/8 → 1/4 + 1/8. */
  function conLista(dieciseisavos, precios) {
    let centavos = 0;
    for (const parte of descomponer(dieciseisavos)) centavos += precios.get(parte) ?? 0;
    return centavos;
  }

  /** Lo que cuesta un renglón de artículos, sea de mayoreo o no. */
  function precioArticulo(a) {
    return a.producto.mayoreo
      ? precioMayoreo(a.producto.dieciseisavos * a.cantidad)
      : a.producto.precio_centavos * a.cantidad;
  }

  function total() {
    return precioHielo(hielo) + articulos.reduce((t, a) => t + precioArticulo(a), 0);
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

    // El hielo de público se acumula en un solo renglón: quien pide "5
    // marquetas" pide una cosa, no cinco. El de MAYOREO no, porque se cobra
    // con otra lista: mezclarlo con el de público sería cobrar mal.
    if (p.tipo === 'hielo' && !p.mayoreo) {
      hielo += p.dieciseisavos * cuantos;
      ultimoAgregado = p;
      pintarTodo();
      tono('bien');
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
    ultimoAgregado = p;
    pintarTodo();

    // UN RUIDITO POR CADA COSA QUE ENTRA.
    //
    // El cajero no está mirando la pantalla mientras captura: está viendo
    // al cliente y agarrando el hielo. El oído es lo que le dice que el
    // renglón entró, y sin sonido no hay forma de saberlo sin voltear.
    tono('bien');
  }

  /**
   * CAMBIAR LA CANTIDAD DE UN RENGLÓN TOCÁNDOLA.
   *
   * "Me das 50 marquetas." Tocar el botón cincuenta veces no es una forma
   * de trabajar. Se toca el número, se teclea 50 y ya. Poner 0 quita el
   * renglón, que es lo que la mano hace sola.
   */
  async function cambiarCantidad(indice) {
    if (fase !== 'venta') return;
    const a = articulos[indice];
    if (!a) return;

    const quedan = quedanDe(a.producto);
    const n = await pedirEntero({
      titulo: a.producto.nombre,
      texto: Number.isFinite(quedan)
        ? `¿Cuántas? Quedan ${quedan}. Pon 0 para quitarlo del ticket.`
        : '¿Cuántas? Pon 0 para quitarlo del ticket.',
      valor: String(a.cantidad), ok: 'Cambiar'
    });
    if (n === null) { enfocar(); return; }

    if (n === 0) { articulos.splice(indice, 1); pintarTodo(); enfocar(); return; }
    if (Number.isFinite(quedan) && n > quedan) {
      avisar(quedan === 1
        ? `Solo queda 1 de ${a.producto.nombre}`
        : `Solo quedan ${quedan} de ${a.producto.nombre}`, 'error');
      enfocar();
      return;
    }

    a.cantidad = n;
    pintarTodo();
    enfocar();
  }

  /** Tocar la fracción del hielo abre la calculadora, ya cargada. */
  async function ponerOtroHielo() {
    if (fase !== 'venta') return;
    const n = await pedirCantidad({
      titulo: 'Cuánto hielo se lleva',
      texto: 'Reemplaza lo que ya está en el ticket. En cero, se quita.',
      valor: hielo, ok: 'Poner esta cantidad'
    });
    if (n === null || n === undefined) { enfocar(); return; }
    hielo = n;
    pintarTodo();
    enfocar();
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
          <span class="tecla-dice">Esc · </span>volver a vender
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
          <span class="tecla-dice">Esc · </span>volver a vender
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
  async function verMovimientos({ todo = false } = {}) {
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
      movs = (await api.obtener(
        `/caja/movimientos?limite=${todo ? 60 : 40}${todo ? '&todo=1' : ''}`)).movimientos || [];
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
      // Un renglón, una línea, y las columnas siempre en el mismo sitio:
      // concepto, cuándo, quién, importe. Lo que ENTRA va en verde, que es
      // como se lee de reojo sin tener que buscar el signo.
      const esSalida = m.tipo === 'salida';
      filas.push(`
        <div class="ticket-fila mov-fila ${esSalida ? 'mov-salida' : 'mov-entrada'}">
          <span class="mov-concepto" title="${esc(m.concepto)}${m.notas ? ' · ' + esc(m.notas) : ''}">${esc(m.concepto)}</span>
          <span class="mov-cuando" title="${esc(cuandoCorto(m.fecha))}">${esc(cuandoCorto(m.fecha))}</span>
          <span class="mov-quien" title="${esc(m.ejecutor_nombre || '—')}">${esc((m.ejecutor_nombre || '—').split(' ')[0])}</span>
          <span class="mov-importe">${esSalida ? '−' : '+'}${pesos(m.centavos)}</span>
          <span class="mov-accion">${esSalida
            ? `<button class="secundario chico" data-comprobante="${esc(m.id)}">Copia</button>` : ''}</span>
        </div>`);
    }

    const gastos = movs.filter((m) => m.tipo === 'salida')
                       .reduce((t, m) => t + m.centavos, 0);

    refs.cobro.innerHTML = `
      <div class="pos-cobro-caja pos-movimientos">
        <h3 style="margin:0 0 4px">Gastos y dinero del cajón</h3>
        <p class="ayuda" style="margin:0 0 12px">
          ${todo
            ? `Los últimos ${movs.length}, cruzando días y turnos.`
            : `<b>Los de hoy</b>${movs.length ? '' : ' — todavía ninguno'}.`}
          ${gastos ? `Salieron ${pesos(gastos)} en total.` : ''}
        </p>
        <div class="lista-tickets">
          ${filas.join('') || '<p class="vacio" style="padding:20px 0">Todavía no hay movimientos.</p>'}
        </div>
        ${todo ? '' : `
          <button class="secundario chico" id="ver-todo" style="margin-top:12px;width:100%">
            Ver también los de días anteriores
          </button>`}
        <button class="secundario" id="cerrar-avisos" style="margin-top:12px;width:100%">
          <span class="tecla-dice">Esc · </span>volver a vender
        </button>
      </div>`;

    refs.cobro.querySelector('#cerrar-avisos').onclick = cerrarAvisos;
    const verTodo = refs.cobro.querySelector('#ver-todo');
    if (verTodo) verTodo.onclick = () => verMovimientos({ todo: true });
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

      // Y el hielo del cuarto frío, que baja con cada venta. Sale de la
      // MISMA cuenta que los avisos —no hay dos números del mismo dato— y
      // solo se pinta si el servidor lo mandó al abrir, que es lo que
      // decide si esta persona puede verlo.
      if (ctx.cuartoFrio && alertas.hielo) {
        ctx.cuartoFrio = { ...ctx.cuartoFrio, texto: alertas.hielo.texto };
        pintarPista();
      }
    } catch { /* el cajero no siempre puede ver inventario; sin aviso y ya */ }
  }

  function pintarLineas() {
    const filas = [];

    if (cambiando) {
      filas.push(`
        <div class="pos-linea pos-linea-credito">
          <div class="pos-cant">⇄</div>
          <div class="pos-desc">
            Devuelve el ticket ${esc(cambiando.venta.numero || cambiando.venta.folio)}
            <small>a favor del cliente</small>
          </div>
          <div class="pos-importe">−${pesos(cambiando.aFavor)}</div>
          <button class="tachita" data-cancelar-cambio aria-label="Cancelar el cambio">×</button>
        </div>`);
    }

    // DE QUIÉN ES EL TICKET. Va arriba de todo porque puede cambiar los
    // precios de abajo: verlo después de los importes sería verlo tarde.
    const conMayoreo = llevaMayoreo();
    if (cliente) {
      const lista = conMayoreo ? listaMayoreo() : null;
      filas.push(`
        <div class="pos-linea pos-linea-cliente ${lista ? 'con-mayoreo' : ''}">
          <div class="pos-cant">${lista ? '🏷️' : '👤'}</div>
          <div class="pos-desc">
            <span class="cliente-num">#${cliente.numero ?? '—'}</span> ${esc(cliente.nombre)}
            <small>${lista ? `precio de ${esc(lista.nombre)}`
                    : fiar ? 'se le fía a él' : 'cliente'}</small>
          </div>
          <button class="tachita" data-quita-cliente aria-label="Quitar el cliente">×</button>
        </div>`);
    } else if (conMayoreo) {
      // El ticket lleva mayoreo y todavía no se sabe de quién es. No se
      // puede cobrar así, y más vale decirlo mientras se captura que
      // descubrirlo al apretar F10.
      filas.push(`
        <div class="pos-linea pos-linea-cliente falta-cliente">
          <div class="pos-cant">👤</div>
          <div class="pos-desc">
            ¿De quién es?
            <small>al cobrar hay que decirlo · F6</small>
          </div>
        </div>`);
    }

    if (hielo > 0) {
      filas.push(`
        <div class="pos-linea pos-linea-hielo">
          <button class="pos-cant pos-cant-tocable" data-cambia-hielo
                  title="Tocar para poner otra cantidad">${esc(aTexto(hielo))}</button>
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
          <button class="pos-cant pos-cant-tocable" data-cantidad="${i}"
                  title="Tocar para cambiar la cantidad">${a.cantidad}</button>
          <div class="pos-desc">
            ${esc(a.producto.nombre)}
            ${a.producto.mayoreo
              ? `<small>${esc(listaMayoreo()?.nombre || 'sin lista de mayoreo')}</small>` : ''}
          </div>
          <div class="pos-importe">${pesos(precioArticulo(a))}</div>
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
    const btnCotizar = pantalla.querySelector('#cotizar');
    if (btnCotizar) btnCotizar.disabled = !hayAlgo() || Boolean(cambiando);
    pantalla.querySelector('#cobrar').querySelector('span').textContent =
      cambiando ? 'Hacer el cambio' : 'Cobrar';

    const etiqueta = pantalla.querySelector('#etiqueta-espera');
    etiqueta.hidden = enEspera.length === 0;
    etiqueta.textContent = `${enEspera.length} en espera`;

    const quitarCambio = refs.lineas.querySelector('[data-cancelar-cambio]');
    if (quitarCambio) quitarCambio.onclick = () => { cambiando = null; pintarTodo(); enfocar(); };

    const quitaHielo = refs.lineas.querySelector('[data-quita-hielo]');
    if (quitaHielo) quitaHielo.onclick = () => { hielo = 0; pintarTodo(); enfocar(); };

    // Quitar al cliente devuelve los precios de público en el acto: se
    // confundió de persona, y el ticket no se puede quedar con su precio.
    const quitaCliente = refs.lineas.querySelector('[data-quita-cliente]');
    if (quitaCliente) quitaCliente.onclick = () => {
      cliente = null; fiar = false; pintarTodo(); enfocar();
    };

    refs.lineas.querySelectorAll('[data-quita]').forEach((b) => {
      b.onclick = () => {
        articulos.splice(Number(b.dataset.quita), 1);
        pintarTodo(); enfocar();
      };
    });

    // TOCAR LA CANTIDAD Y ESCRIBIRLA.
    // Si piden 50 marquetas, tocar el botón cincuenta veces es absurdo: se
    // toca el número y se teclea 50.
    refs.lineas.querySelectorAll('[data-cantidad]').forEach((b) => {
      b.onclick = () => cambiarCantidad(Number(b.dataset.cantidad));
    });
    const otroHielo = refs.lineas.querySelector('[data-cambia-hielo]');
    if (otroHielo) otroHielo.onclick = () => ponerOtroHielo();
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
        <button class="pos-boton ${vacio ? 'pos-boton-vacio' : ''}
                       ${p.mayoreo ? 'pos-boton-mayoreo' : ''}" data-producto="${esc(p.id)}"
                ${vacio ? 'disabled' : ''}
                style="${p.color || p.categoria_color
                  ? `--tono:${esc(p.color || p.categoria_color)}` : ''}">
          ${p.codigo ? `<span class="pos-boton-codigo">${esc(p.codigo)}</span>` : ''}
          <span class="pos-boton-nombre">${esc(p.nombre)}</span>
          <span class="pos-boton-precio">${p.tipo === 'hielo'
            ? pesos(p.mayoreo ? precioMayoreo(p.dieciseisavos) : precioHielo(p.dieciseisavos))
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

    ajustarRejilla();
  }

  /**
   * CUÁNTOS CUADROS SE VEN DE UNA VEZ.
   *
   * El dueño elige en Personalizar cuántas columnas y cuántas filas quiere.
   * Las columnas las reparte el CSS solo; el alto no puede, porque depende
   * de lo que mida la rejilla en esta pantalla y eso no se sabe hasta que
   * está dibujada. Así que se mide aquí y se deja escrito en --pos-alto.
   *
   * Si de todos modos hay más productos que huecos, la rejilla se desliza:
   * "filas" es cuántas se ven sin desplazar, no cuántas caben en total.
   */
  function ajustarRejilla() {
    const r = ctx.rejilla;
    if (!r || !refs.rejilla) return;

    // En el celular manda el ancho de la pantalla, no el gusto del dueño:
    // cinco columnas en una mano son cinco cuadros ilegibles.
    const enPc = window.matchMedia('(min-width: 860px)').matches;
    refs.rejilla.classList.toggle('pos-a-medida', enPc);
    if (!enPc) {
      refs.rejilla.classList.remove('pos-apretada', 'pos-holgada');
      return;
    }

    const HUECO = 8;                                   // el gap del CSS
    const alto = refs.rejilla.clientHeight;
    const cada = Math.max(56,
      Math.floor((alto - HUECO * (r.filas - 1)) / r.filas));

    refs.rejilla.style.setProperty('--pos-columnas', r.columnas);
    refs.rejilla.style.setProperty('--pos-alto', `${cada}px`);

    // La letra se encoge o crece con el cuadro. Un nombre de 16px dentro de
    // un cuadro de 60 se sale; dentro de uno de 180 se ve perdido.
    const ancho = refs.rejilla.clientWidth / r.columnas;
    refs.rejilla.classList.toggle('pos-apretada', cada < 84 || ancho < 108);
    refs.rejilla.classList.toggle('pos-holgada', cada >= 140 && ancho >= 170);
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
    const f = fase === 'clientes'
      ? { enter: 'elige al cliente', esc: volverDeClientes === 'venta' ? 'volver al ticket' : 'volver al cobro' }
      : fase === 'cambio' && fiar
      ? { enter: 'fía y registra', esc: 'mejor cobrarle' }
      : FASES[fase];
    refs.pista.innerHTML = `
      <span class="pos-reloj">
        <strong id="pos-hora">—</strong>
        <small id="pos-fecha"></small>
      </span>
      <span class="pos-clima" id="pos-clima" hidden></span>
      ${hieloDelCuarto()}
      ${marca.nombreNegocio
        ? `<span class="pos-marca">${esc(marca.nombreNegocio)}</span>` : ''}
      <span class="pos-teclas">
        <span><kbd>Enter</kbd> ${esc(f.enter)}</span>
        <span><kbd>Esc</kbd> ${esc(f.esc)}</span>
        ${fase === 'venta' ? `
          <span><kbd>F10</kbd> cobrar</span>
          <span><kbd>F2</kbd> nueva venta</span>
          <span><kbd>F3</kbd> tickets</span>
          <span><kbd>F4</kbd> cambio</span>
          ${puedeVerClientes ? '<span><kbd>F6</kbd> cliente</span>' : ''}` : ''}
      </span>`;
    pintarHora();
    pintarClima();
  }

  /**
   * CUÁNTO HIELO QUEDA, junto al reloj  (v4.1)
   *
   * SOLO PARA EL ADMINISTRADOR. Lo decide el servidor —la caja no sabe de
   * permisos, y no es cosa suya saberlo—: si el contexto no lo trae, no se
   * pinta. No es un secreto; es que en el mostrador, con gente esperando,
   * un número más que leer es un número más que estorba, y el cajero ya
   * tiene el suyo al terminar el turno.
   *
   * No se refresca solo: cambia con cada venta, y la pista se vuelve a
   * pintar en cada venta.
   */
  function hieloDelCuarto() {
    const h = ctx?.cuartoFrio;
    if (!h) return '';
    return `
      <span class="pos-hielo" title="Lo que debería quedar en ${esc(h.almacen)}">
        🧊 ${esc(h.texto)}
      </span>`;
  }

  /**
   * LA TEMPERATURA DE AFUERA, junto al reloj.
   *
   * En una fábrica de hielo el clima es materia prima: en mayo, cuando
   * calientan los tanques, el hielo no se forma por más días que pase en
   * el molde. Tenerla a la vista mientras se cobra es la manera de que
   * quede ligada a los días buenos y a los malos sin que nadie apunte nada.
   *
   * SI NO SE PUDO TOMAR, NO SE ENSEÑA NADA. Ni un error, ni un hueco: la
   * venta no depende de esto. Y si el dato es viejo se dice, para que nadie
   * confunda la de hoy con la del martes.
   */
  let climaAhora = null;

  async function pintarClima() {
    const caja = pantalla.querySelector('#pos-clima');
    if (!caja) return;
    try {
      const { clima } = await api.obtener('/clima');
      climaAhora = clima;
    } catch { climaAhora = null; }

    if (!climaAhora || climaAhora.temperatura == null) { caja.hidden = true; return; }

    const viejo = climaAhora.minutos != null && climaAhora.minutos > 120;
    caja.hidden = false;
    caja.className = `pos-clima ${viejo ? 'vieja' : ''}`;
    caja.innerHTML =
      `<span class="pos-grados">${climaAhora.temperatura}°</span>` +
      (climaAhora.sensacion != null && Math.abs(climaAhora.sensacion - climaAhora.temperatura) >= 2
        ? `<small>se sienten ${climaAhora.sensacion}°</small>` : '') +
      (viejo ? '<small class="pos-clima-vieja">dato viejo</small>' : '');
    caja.title = climaAhora.hayInternet === false
      ? `Sin internet. Es la última que se pudo tomar${
          climaAhora.cuando ? `, de hace ${climaAhora.minutos} minutos` : ''}.`
      : `Temperatura de afuera${climaAhora.humedad != null
          ? ` · ${climaAhora.humedad}% de humedad` : ''}`;
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

    // F6 le pone nombre al ticket. Es la tecla del mayoreo: se captura lo
    // que pidieron, se dice quién es, y el precio cambia solo.
    if (ev.key === 'F6') {
      ev.preventDefault();
      if (!puedeVerClientes) return;
      if (fase === 'venta') verClientes('', { volverA: 'venta' });
      else if (fase === 'clientes') cerrarClientes();
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
    // En la lista de clientes, enter elige al primero de la lista. El campo
    // de búsqueda se lo queda cuando tiene el foco; esto es para cuando no.
    if (fase === 'clientes') {
      const primero = refs.cobro.querySelector('[data-cliente]');
      if (primero) elegirCliente(primero.dataset.cliente);
      return;
    }
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
    if (fase === 'clientes') { cerrarClientes(); return; }
    if (fase === 'venta') {
      if (refs.codigo.value) { refs.codigo.value = ''; return; }
      if (cambiando) { cambiando = null; pintarTodo(); return; }
      if (hayAlgo()) vaciar();
      return;
    }
    if (fase === 'cobro')   { cerrarCobro(); return; }
    if (fase === 'cambio')  {
      // Se arrepintió de fiarle, pero sigue siendo él: se le cobra, y a
      // su precio. Quitarle el nombre aquí le subiría el precio sin avisar.
      if (fiar) { fiar = false; pintarTodo(); }
      fase = 'cobro'; pintarCobro(); pintarPista(); return;
    }
    if (fase === 'cobrada') { nuevaVenta(); }
  }

  function agregarPorCodigo() {
    const codigo = refs.codigo.value.trim();

    // ENTER CON EL CAMPO VACÍO REPITE LO ÚLTIMO.
    // "Dame otro igual" es media venta del mostrador: dos refrescos, tres
    // bolsas. Repetir es una tecla en vez de buscar el botón otra vez.
    if (!codigo) { repetirUltimo(); return; }

    const p = porCodigo(codigo);
    if (!p) { avisar(`No hay ningún producto con el código ${codigo}`, 'error'); return; }

    // Se limpia siempre, aunque no se pueda agregar: si el código se queda
    // en el campo, el siguiente que teclee sale pegado al anterior.
    refs.codigo.value = '';
    agregarProducto(p);
  }

  function repetirUltimo() {
    if (!ultimoAgregado) return;
    // El hielo de público se suma al montón. El de MAYOREO no: tiene su
    // propio renglón y su propia lista, y echarlo al montón le cambiaba el
    // precio al de público sin avisar. Repetir "1m" tiene que repetir 1m.
    if (ultimoAgregado.tipo === 'hielo' && !ultimoAgregado.mayoreo) {
      hielo += ultimoAgregado.dieciseisavos;
      pintarTodo();
      tono('bien');
      return;
    }
    agregarProducto(ultimoAgregado);
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

    // UN TICKET CON MAYOREO NO SE COBRA SIN NOMBRE. En vez de dejar que el
    // servidor lo rechace al final, la caja lo pide aquí, que es el momento
    // en que el cajero ya está mirando al cliente. El servidor lo revisa
    // igual: esto es comodidad, no seguridad.
    if (llevaMayoreo() && !cliente) {
      verClientes('', { volverA: 'venta', paraCobrar: true });
      return;
    }

    fase = 'cobro';
    pago = 0;
    pintarCobro();
    pintarPista();
  }

  function cerrarCobro() {
    fase = 'venta';
    // SALIRSE DEL COBRO SUELTA AL CLIENTE. Lo pidió Tony así: "si se sale
    // antes de cobrar, el mayoreo se quita y se tiene que volver a
    // seleccionar". Un cliente pegado al ticket es la forma de cobrarle a
    // uno el precio del anterior.
    cliente = null;
    fiar = false;
    refs.cobro.hidden = true;
    // Se repinta el ticket: al soltar al cliente cambian los precios de
    // mayoreo, y un renglón que dice $220 cuando ya vale $240 es peor que
    // no decir nada.
    pintarTodo();
    pintarPista();
    enfocar();
  }

  function pintarCobro() {
    // Fiando no hay nada que cobrar ahora: el panel es otro.
    if (fiar && cliente) return pintarFiado();

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
            Cambio del ticket ${esc(cambiando.venta.numero || cambiando.venta.folio)} ·
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
                 placeholder="${paraEditar(aPagar)}"
                 ${enConfirmacion ? 'disabled' : ''}
                 value="${pago ? paraEditar(pago) : ''}">

          <div class="pos-billetes">
            ${BILLETES.filter((b) => b * 100 >= aPagar).slice(0, 4)
              .map((b) => `<button class="secundario chico" data-billete="${b}">$${b}</button>`).join('')}
            <button class="secundario chico" data-billete="justo">Justo</button>
          </div>

          ${puedeVerClientes && !cambiando ? `
            <button class="secundario pos-fiar" id="quien-es-cobro">
              👤 ${cliente ? `#${cliente.numero ?? '—'} ${esc(cliente.nombre)}` : '¿Quién es el cliente?'}
            </button>` : ''}
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
          <span class="tecla-dice">Esc · </span>volver al ticket
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
        if (campo) campo.value = paraEditar(pago);
        calcularCambio();
      };
    });

    const botonFiar = refs.cobro.querySelector('#fiar');
    if (botonFiar) botonFiar.onclick = () => verClientes('', { volverA: 'cobro' });
    const botonQuien = refs.cobro.querySelector('#quien-es-cobro');
    if (botonQuien) botonQuien.onclick = () => verClientes('', { volverA: 'cobro' });

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
    const saldoDespues = cliente.saldo + t;
    const disponible = cliente.disponible;
    const seExcede = disponible !== null && t > disponible;

    fase = 'cambio';
    refs.cobro.hidden = false;
    refs.cobro.innerHTML = `
      <div class="pos-cobro-caja">
        <div class="pos-cobro-total">
          <span>Se le fía a</span>
          <strong class="pos-fiado-nombre">${esc(cliente.nombre)}</strong>
        </div>
        ${cliente.negocio ? `<p class="ayuda" style="margin:-12px 0 14px;text-align:center">
          ${esc(cliente.negocio)}</p>` : ''}

        <div class="cuadre">
          <div class="cuadre-linea"><span>Debía</span><strong>${pesos(cliente.saldo)}</strong></div>
          <div class="cuadre-linea suma"><span>+ Este ticket</span><strong>${pesos(t)}</strong></div>
          <div class="cuadre-linea total">
            <span>= Va a deber</span>
            <strong class="${seExcede ? 'malo' : ''}">${pesos(saldoDespues)}</strong>
          </div>
          ${disponible !== null ? `
            <div class="cuadre-linea">
              <span>Su límite</span><strong>${pesos(cliente.limite)}</strong>
            </div>` : ''}
        </div>

        ${seExcede ? `
          <div class="aviso-sin-caja" style="margin-top:12px">
            <strong>Se pasa de su límite.</strong>
            Se puede fiar igual, pero lo tiene que autorizar un gerente con su PIN.
          </div>` : ''}
        ${cliente.vencido ? `
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
          <span class="tecla-dice">Esc · </span>volver al ticket
        </button>
      </div>`;

    setTimeout(() => refs.cobro.querySelector('#confirmar')?.focus(), 0);
    refs.cobro.querySelector('#confirmar').onclick = registrar;
    refs.cobro.querySelector('#quitar-fiado').onclick = () => {
      fiar = false; fase = 'cobro'; pago = 0; pintarTodo(); pintarCobro(); pintarPista();
    };
    refs.cobro.querySelector('#salir-cobro').onclick = cerrarCobro;
    pintarPista();
  }

  /**
   * QUIÉN ES EL CLIENTE.
   *
   * El cajero teclea el NÚMERO del cliente —"7" y enter— o las primeras
   * letras de su nombre. Escribir "Pescadería Chuc" con gente esperando es
   * lo que hacía lento el mayoreo en el software anterior.
   *
   * Con un solo candidato, enter lo elige. Y todo está a la vista en botones
   * para quien prefiera el dedo: la caja no puede obligar a nadie a teclear.
   *
   * La misma lista sirve para las dos cosas que se hacen con un nombre:
   * decir de quién es el ticket —para que le salga SU precio— y fiárselo.
   * Son botones distintos porque son decisiones distintas: la mayoría de
   * los mayoristas pagan en el momento.
   */
  function verClientes(busca = '', opciones = {}) {
    if (cambiando) {
      avisar('Termina el cambio antes de ponerle cliente al ticket', '');
      enfocar();
      return;
    }
    // Se puede llegar aquí desde el ticket (F6) o camino al cobro. Esc y la
    // elección tienen que regresar a donde se estaba.
    if (opciones.volverA) volverDeClientes = opciones.volverA;
    if (opciones.paraCobrar !== undefined) cobrarAlElegir = opciones.paraCobrar;

    fase = 'clientes';
    refs.cobro.hidden = false;

    const lista = filtrarClientes(busca);

    refs.cobro.innerHTML = `
      <div class="pos-cobro-caja pos-historial">
        <h3 style="margin:0 0 4px">${cobrarAlElegir ? '¿De quién es el ticket?' : '¿Quién es el cliente?'}</h3>
        <p class="ayuda" style="margin:0 0 12px">
          ${cobrarAlElegir
            ? 'Lleva mayoreo: hay que decir a quién se le cobró ese precio.'
            : 'Al ponerle nombre al ticket, si tiene precio de mayoreo se le aplica solo.'}
          Teclea su <b>número</b> o su nombre y enter.
        </p>
        <input id="busca-cliente" class="buscador" autocomplete="off"
               placeholder="Número o nombre" value="${esc(busca)}" style="margin:0">
        <div class="lista-tickets lista-clientes">
          ${lista.slice(0, 40).map((c) => {
            const suya = c.listaId ? listasMayoreo.get(c.listaId) : null;
            return `
            <div class="ticket-fila fila-cliente" data-cliente="${esc(c.id)}" tabindex="0">
              <span class="cliente-num">#${c.numero ?? '—'}</span>
              <span class="crece">
                <strong>${esc(c.nombre)}</strong>
                <small>${c.negocio ? esc(c.negocio) + ' · ' : ''}${
                  c.saldo > 0 ? 'debe ' + pesos(c.saldo) : 'no debe nada'}</small>
              </span>
              ${suya ? `<span class="etiqueta-mayoreo">🏷️ ${esc(suya.nombre)}</span>` : ''}
              ${c.vencido ? '<span class="aviso-quedan agotado">vencido</span>' : ''}
              <button class="secundario chico" data-elegir="${esc(c.id)}">Es él</button>
              ${puedeFiar && !cobrarAlElegir
                ? `<button class="secundario chico" data-fiar="${esc(c.id)}">Fiarle</button>` : ''}
            </div>`; }).join('')
            || `<p class="vacio" style="padding:20px 0">${
                 (ctx.clientes || []).length
                   ? 'Nadie con ese número ni ese nombre.'
                   : 'Todavía no hay clientes dados de alta.'}</p>`}
        </div>
        <button class="secundario" id="cerrar-clientes" style="margin-top:12px;width:100%">
          <span class="tecla-dice">Esc · </span>volver ${volverDeClientes === 'venta' ? 'al ticket' : 'al cobro'}
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

    // ENTER ELIGE. Con un solo candidato no hay ambigüedad; con varios se
    // toma el primero, que es el de número más chico y el que se ve arriba.
    campo.onkeydown = (ev) => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      ev.stopPropagation();
      const candidatos = filtrarClientes(campo.value);
      if (!candidatos.length) { avisar('Nadie con ese número ni ese nombre', 'error'); return; }
      elegirCliente(candidatos[0].id);
    };

    // El renglón entero elige, y además hay un botón que lo dice. Tener
    // solo el renglón clicable era un secreto: al lado de "Fiarle" parecía
    // que fiar era lo único que se podía hacer con un cliente.
    refs.cobro.querySelectorAll('[data-cliente]').forEach((b) => {
      b.onclick = (ev) => {
        // Los botones viven dentro del renglón: si no se para aquí, un
        // toque en "Fiarle" haría las dos cosas.
        if (ev.target.closest('[data-fiar]')) return;
        elegirCliente(b.dataset.cliente);
      };
    });

    refs.cobro.querySelectorAll('[data-fiar]').forEach((b) => {
      b.onclick = () => {
        const elegido = (ctx.clientes || []).find((c) => c.id === b.dataset.fiar);
        if (!elegido) return;
        cliente = elegido; fiar = true;
        pintarTodo();
        pintarFiado();
      };
    });

    refs.cobro.querySelector('#cerrar-clientes').onclick = cerrarClientes;
    pintarPista();
  }

  /**
   * Por número o por nombre, lo que se teclee.
   *
   * El número es exacto a propósito: "7" tiene que ser el cliente 7 y no
   * los diecisiete que llevan un 7 en el número.
   */
  function filtrarClientes(busca) {
    const t = String(busca || '').trim().toLowerCase();
    const todos = ctx.clientes || [];
    if (!t) return todos;

    if (/^\d+$/.test(t)) {
      const n = Number(t);
      const exacto = todos.filter((c) => c.numero === n);
      if (exacto.length) return exacto;
    }
    return todos.filter((c) => `${c.nombre} ${c.negocio || ''}`.toLowerCase().includes(t));
  }

  /** El ticket ya es suyo: el precio cambia a la vista. */
  function elegirCliente(id) {
    const elegido = (ctx.clientes || []).find((c) => c.id === id);
    if (!elegido) return;

    cliente = elegido;
    fiar = false;
    pintarTodo();

    const lista = llevaMayoreo() ? listaMayoreo() : null;
    if (lista) avisar(`Precio de ${lista.nombre} para ${elegido.nombre}`, 'bien');

    // Si se vino aquí camino al cobro, se sigue de largo: el cajero apretó
    // F10 para cobrar, no para elegir a alguien.
    if (cobrarAlElegir) { cobrarAlElegir = false; irACobro(); return; }
    cerrarClientes();
  }

  function cerrarClientes() {
    cobrarAlElegir = false;
    if (volverDeClientes === 'venta') {
      fase = 'venta';
      refs.cobro.hidden = true;
      pintarPista();
      enfocar();
      return;
    }
    fase = 'cobro'; pintarCobro(); pintarPista();
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

  /**
   * SOLO COTIZACIÓN  (v2.8)
   *
   * "¿A cómo me saldrían veinte?" — se arma el ticket normal y en vez de
   * cobrar se toca este botón: sale el papel con los precios de HOY y la
   * leyenda de que pueden cambiar sin aviso. NO es una venta: no hay folio,
   * no se abre el cajón, no se toca la existencia y no entra al corte. El
   * ticket se queda armado por si el cliente dice "sí, dámelo".
   */
  async function darCotizacion() {
    if (!hayAlgo() || cambiando) return;

    const lineas = [];
    if (hielo > 0) lineas.push({ dieciseisavos: hielo });
    for (const a of articulos) lineas.push({ productoId: a.producto.id, cantidad: a.cantidad });

    try {
      const r = await api.enviar('/impresion/cotizacion', {
        lineas, ...(cliente ? { clienteId: cliente.id } : {})
      });
      if (r.impreso) {
        avisar(`Cotización impresa: ${pesos(r.total)}. No es venta.`, 'bien');
      } else {
        // SIN IMPRESORA TÉRMICA, LO SACA EL NAVEGADOR  (v4.4). Antes solo
        // se enseñaba en pantalla y ahí moría: el cliente venía por un
        // papel con el precio y no había manera de dárselo. Es lo mismo
        // que ya hacía el ticket de una venta.
        const que = await verTicket({
          titulo: 'Cotización', renglones: r.renglones, ancho: r.ancho,
          notas: ['No hay impresora térmica configurada.'],
          acciones: [{ valor: 'imprimir', texto: '🖨️ Imprimir' }]
        });
        if (que === 'imprimir') imprimirTicket(htmlDeEspejo(r.renglones, r.ancho));
      }
    } catch (e) {
      if (e.faltaCliente) {
        avisar('Lleva mayoreo: primero dile de quién es el ticket', 'error');
      } else avisar(e.message, 'error');
    }
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
            ...(fiar && cliente
              ? { formaPago: 'credito', clienteId: cliente.id,
                  ...(autorizacion
                    // El porqué se guarda con el ticket: al mes, "lo
                    // autorizó Lupe" sin el motivo no explica nada.
                    ? { autorizacion, notas: `Sobre su límite: ${autorizacion.motivo}` }
                    : {}) }
              // Pagando en efectivo el cliente también va: es lo que hace
              // que el servidor le cobre SU precio, y queda de quién fue el
              // ticket aunque lo haya pagado en el momento.
              : { pago: (pago / 100).toFixed(2),
                  ...(cliente ? { clienteId: cliente.id } : {}) })
          });

      const venta = respuesta.venta;
      mayoreoCobrado = respuesta.mayoreo || null;
      ultimoCambio = cambiando ? respuesta : null;
      cambiando = null;
      ventaCobrada = venta;
      // El sonido de que la venta entró. Es distinto del "listo" de siempre
      // porque es el que el cajero espera oír cien veces al día.
      tono('cobrado');
      // Lo que quedó debiendo, para poder decírselo al cliente en la cara.
      fiadoCobrado = respuesta.cliente || null;
      // El número del que sigue: se le pide al servidor al recargar, pero
      // mientras tanto se adelanta el de la serie para que la etiqueta no
      // se quede en el que ya se cobró.
      ctx.siguienteNumero = `${venta.serie}-${(venta.folio_anual || 0) + 1}`;
      // EL CAJÓN YA NO SE ABRE AQUÍ. Ahora el pulso viaja pegado a los
      // bytes del ticket: si sale papel se abre, y si la impresora está
      // apagada no se abre ni se finge que sí. Lo hace el servidor en
      // /impresion/venta, que es el único sitio que sabe si de verdad
      // imprimió.
      if (cliente && respuesta.cliente) refrescarCliente(respuesta.cliente);
      cliente = null; fiar = false;
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
      if (e.requiereAutorizacion && fiar && cliente && !autorizacion) {
        const auth = await pedirAutorizacion({
          titulo: `${cliente.nombre} se pasa de su límite`,
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
          Ticket ${esc(v.numero || v.folio)}${
            c ? ` · cambio del ${esc(c.anterior.numero || c.anterior.folio)}` : ''}
        </div>

        ${mayoreoCobrado ? `
          <p class="ayuda" style="margin:-6px 0 10px;text-align:center">
            🏷️ Salió a precio de <strong>${esc(mayoreoCobrado.lista)}</strong>
          </p>` : ''}

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
          <span class="tecla-dice">Esc · </span>${enEspera.length ? 'volver a la venta pendiente' : 'siguiente venta'}
        </button>
      </div>`;

    refs.cobro.querySelector('#otro-ticket').onclick = () => imprimir();
    refs.cobro.querySelector('#siguiente').onclick = nuevaVenta;
  }

  function nuevaVenta() {
    hielo = 0; articulos = []; pago = 0; ventaCobrada = null;
    ultimoCambio = null; cambiando = null; cliente = null; fiar = false;
    mayoreoCobrado = null;
    fase = 'venta';
    refs.cobro.hidden = true;
    limpiarImpresion();
    pantalla.querySelector('#etiqueta-folio').textContent = `ticket ${ctx.siguienteNumero}`;

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
          <span>${esc(v.numero || v.folio)}</span>
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
      const buscado = folio.trim().replace(/^#/, '');
      const v = ventas.find((x) =>
        String(x.numero) === buscado || String(x.folio_anual) === buscado);

      if (!v) { avisar(`No hay ningún ticket #${folio.trim()}`, 'error'); enfocar(); return; }
      if (v.cancelada_en) {
        avisar(`El ticket ${v.numero} está cancelado y no se puede cambiar`, 'error');
        enfocar();
        return;
      }

      const { venta } = await api.obtener(`/ventas/${v.id}`);
      const detalle = venta.lineas
        .map((l) => `${l.dieciseisavos ? l.texto + ' de ' : ''}${l.concepto.toLowerCase()}`)
        .join(', ');

      if (!await confirmar({
        titulo: `Ticket ${venta.numero} · ${pesos(venta.total_centavos)}`,
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
          Los de <strong>hoy</strong>, por número, importe u hora.
        </p>
        <input id="busca-ticket" class="buscador" autocomplete="off"
               placeholder="Número, monto u hora" value="${esc(busca)}" style="margin:0">
        <div id="lista-tickets" class="lista-tickets"><p class="ayuda">Buscando…</p></div>
        <button class="secundario" id="cerrar-historial" style="margin-top:12px;width:100%">
          <span class="tecla-dice">Esc · </span>volver a vender
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

  /** "25 ago · 07:33 a.m." Cabe en su columna sin recortarse. */
  function cuandoCorto(iso) {
    const d = new Date(iso);
    return `${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} · ` +
           `${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
  }

  /**
   * QUÉ CLASE DE TICKET ES ESTE.
   *
   * La misma escalera que usa el historial (queEs, en historial/calculo.js):
   * de lo más específico a lo más general, gana el primero que acierte. Se
   * repite aquí porque la caja pide las ventas por otra ruta, y lo que no
   * puede pasar es que las dos pantallas le pongan nombres distintos al
   * mismo ticket.
   */
  function queEs(v) {
    if (v.cancelada_en && String(v.motivo_cancelacion || '').startsWith('Devolución')) {
      return { clave: 'devolucion', texto: 'Devolución', emoji: '↩️' };
    }
    if (v.cambio_de)    return { clave: 'cambio',    texto: 'Cambio',    emoji: '⇄' };
    if (v.cambiado_por) return { clave: 'cambiado',  texto: 'Cambiado',  emoji: '⇄' };
    if (v.cancelada_en) return { clave: 'cancelada', texto: 'Cancelado', emoji: '✕' };
    if (v.forma_pago === 'credito') return { clave: 'fiado', texto: 'Fiado', emoji: '🤝' };
    if (v.lista_tipo === 'mayoreo') return { clave: 'mayoreo', texto: 'Mayoreo', emoji: '🏷️' };
    return { clave: 'venta', texto: 'Venta', emoji: '🧾' };
  }

  /** Lo que traía el ticket, en corto y con lo que explica el precio. */
  function detalleDe(v) {
    // "CANCELADO", "cambio del #30" y "fiado" ya los dice la etiqueta de al
    // lado. Aquí solo va lo que la etiqueta NO puede decir: de qué ticket
    // viene el cambio, de quién es, y qué se llevó.
    const partes = [];
    if (v.cambiado_por) partes.push(`→ ${v.cambiadoPorNumero}`);
    else if (v.cambio_de) partes.push(`← ${v.cambioDeNumero}`);
    if (v.cliente_nombre) partes.push(v.cliente_nombre);
    if (v.detalle) partes.push(v.detalle);
    return partes.join(' · ') || '—';
  }

  async function cargarTickets(busca) {
    const caja = refs.cobro.querySelector('#lista-tickets');
    if (!caja) return;
    try {
      // Solo los de HOY: en la caja se busca el ticket que el cliente
      // acaba de perder. El histórico completo vive en su propio módulo.
      const { ventas } = await api.obtener(
        `/ventas?limite=50&hoy=1&busca=${encodeURIComponent(busca || '')}`);

      // UN TICKET, UN RENGLÓN, TODO EN LÍNEA. Lo que más se busca va
      // primero y en grande —el número—, y lo que se llevó va en texto
      // normal, recortado si no cabe. Antes había un botón "Ver" que abría
      // el detalle: con el detalle a la vista ese botón sobraba.
      caja.innerHTML = ventas.length ? ventas.map((v) => {
        const q = queEs(v);
        const detalle = detalleDe(v);
        return `
        <div class="ticket-fila fila-ticket ${v.cancelada_en ? 'anulada' : ''}">
          <span class="tkl-folio" title="Ticket ${esc(v.numero || v.folio)}">${esc(v.numero || v.folio)}</span>
          <span class="hist-que que-${esc(q.clave)}" title="${esc(q.texto)}">${q.emoji} ${esc(q.texto)}</span>
          <span class="tkl-cuando" title="${esc(cuandoCorto(v.fecha))}">${esc(cuandoCorto(v.fecha))}</span>
          <span class="tkl-quien" title="${esc(v.cajero_nombre || '—')}">${esc((v.cajero_nombre || '—').split(' ')[0])}</span>
          <span class="tkl-detalle" title="${esc(detalle)}">${esc(detalle)}</span>
          <span class="tkl-total ${v.forma_pago === 'credito' ? 'fiado' : ''}"
                title="${esc(pesos(v.total_centavos))}">
            ${pesos(v.total_centavos)}</span>
          <button class="secundario chico" data-reimprimir="${esc(v.id)}"
                  title="Volver a imprimirlo marcado como copia">Copia</button>
          ${puedeDevolver && !v.cancelada_en && !v.cambiada_por_venta_id
            ? `<button class="secundario chico" data-devolver="${esc(v.id)}"
                       title="Devolverle su dinero al cliente">↩</button>` : ''}
        </div>`; }).join('')
        : '<p class="vacio" style="padding:20px 0">No hay tickets que coincidan.</p>';

      caja.querySelectorAll('[data-devolver]').forEach((b) => {
        b.onclick = () => devolverTicket(b.dataset.devolver);
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

  /**
   * DEVOLVERLE EL DINERO AL CLIENTE.
   *
   * "Se cansó de esperar la fila", "el hielo no estaba bien congelado".
   * Pasa todos los días, y hasta hoy había que cancelar el ticket a mano y
   * acordarse de sacar el dinero.
   *
   * El motivo sale de una lista corta a propósito: veinte "se cansó de
   * esperar" en un mes son un problema de la fila, y eso no se ve si cada
   * quien lo escribe distinto.
   */
  async function devolverTicket(id) {
    let motivos = [];
    try { motivos = (await api.obtener('/ventas/motivos-devolucion')).motivos; }
    catch (e) { return avisar(e.message, 'error'); }

    const cual = await menu({
      titulo: 'Devolverle el dinero',
      texto: '¿Por qué regresa el cliente?',
      opciones: motivos.map((m) => ({ valor: m.id, texto: m.texto }))
    });
    if (!cual) return;

    let nota = '';
    if (cual === 'otro') {
      nota = await pedirTexto({
        titulo: '¿Qué pasó?', texto: 'Una línea basta.',
        marcador: 'Se le rompió la bolsa aquí mismo',
        ok: 'Devolver', largo: 200, unaLinea: true
      });
      if (!nota) return;
    }

    try {
      const r = await api.enviar(`/ventas/${id}/devolver`, { motivo: cual, nota });
      avisar(r.enEfectivo
        ? `Sácale ${pesos(r.centavos)} del cajón al ticket ${r.numero}`
        : `El ticket ${r.numero} dejó de deberse`, 'bien');
      // El cajón se abre solo: hay que meter la mano de todas formas.
      if (r.enEfectivo) abrirCajon({ callado: true });
      cargarTickets('');
      refrescarAvisos();
    } catch (e) { avisar(e.message, 'error'); }
  }

  /**
   * ABRE EL CAJÓN.
   *
   * El cajón cuelga de la impresora, así que abrirlo es mandarle cinco
   * bytes. Se hace solo al cobrar en efectivo y al devolver, y hay botón
   * para las veces que hay que dar cambio de algo que no fue una venta.
   */
  async function abrirCajon({ callado = false } = {}) {
    try {
      const r = await api.enviar('/impresion/cajon', {});
      if (!callado && !r.abierto) avisar('No hay impresora configurada', '');
    } catch (e) {
      if (!callado) avisar(e.message, 'error');
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
    if (n) { hielo += n; pintarTodo(); tono('bien'); }
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

  /**
   * TOMAR EL TURNO QUE ESPERA DUEÑO.
   *
   * Es el relevo de las 2:30: el que se fue ya entregó su dinero y lo que
   * se cobró desde entonces está apartado para el que entra. Con esto el
   * que llega lo toma sin salir de la pantalla ni buscar el menú.
   *
   * Se hace ENTRANDO con su PIN, no marcando una casilla: el turno tiene
   * que quedar a nombre de quien de verdad está en la caja, y a partir de
   * ahí cada venta se registra con su nombre.
   */
  const btnTomar = pantalla.querySelector('#tomar-turno');
  if (btnTomar) btnTomar.onclick = tomarTurno;

  async function tomarTurno() {
    let usuarios = [];
    try {
      usuarios = (await api.obtener('/auth/usuarios-disponibles')).usuarios || [];
    } catch (e) { avisar(e.message, 'error'); return; }

    const quienes = usuarios.filter((u) => u.rol === 'cajero' || u.rol === 'gerente' || u.rol === 'admin');
    if (!quienes.length) { avisar('No hay nadie con PIN que pueda tomar la caja', 'error'); return; }

    const quien = await pedirAutorizacion({
      titulo: 'Tomar el turno',
      texto: 'Quien entra pone su PIN. El turno y el dinero apartado quedan a su nombre.',
      responsables: quienes.map((u) => ({
        id: u.id, nombre: u.nombre, rolEtiqueta: ETIQUETAS_ROL[u.rol] || ''
      })),
      motivoSugerido: 'Relevo de turno'
    });
    if (!quien) { enfocar(); return; }

    // Lo que esté capturado se aparta: cambiar de cajero a media venta
    // dejaría un ticket a nombre de quien ya no está.
    if (hayAlgo() && !cambiando) apartarVenta();

    try {
      await api.enviar('/auth/entrar-pin', { usuarioId: quien.usuarioId, pin: quien.pin });
    } catch (e) { avisar(e.message, 'error'); return; }

    // Se vuelve a cargar entera: cambió quién está dentro, y eso lo tocan
    // el encabezado, los permisos y el turno. Lo apartado vive en el
    // aparato, así que no se pierde nada.
    location.reload();
  }

  // El menú es el de siempre; aquí solo se le presta un botón.
  pantalla.querySelector('#pos-menu').onclick =
    () => document.getElementById('btn-menu')?.click();

  pantalla.querySelector('#cobrar').onclick = irACobro;
  pantalla.querySelector('#cotizar').onclick = darCotizacion;
  pantalla.querySelector('#historial').onclick = () => verHistorial();
  pantalla.querySelector('#nueva-venta').onclick = () => verEnEspera();
  pantalla.querySelector('#cambio').onclick = () => iniciarCambio();
  const btnQuienEs = pantalla.querySelector('#quien-es');
  if (btnQuienEs) btnQuienEs.onclick = () => verClientes('', { volverA: 'venta' });
  /**
   * EL ENTER DEL CAMPO DE CÓDIGOS.
   *
   * Va en el KEYDOWN, y eso importa. Antes iba en el keyup, y ahí había un
   * agujero feo: al vaciar el ticket con Esc, el diálogo se cierra con el
   * keydown del Enter y el foco vuelve al campo ANTES de que el dedo suelte
   * la tecla. Ese keyup caía aquí y repetía lo último agregado, así que
   * vaciar el ticket lo vaciaba y lo volvía a llenar en el mismo golpe.
   *
   * Con el keydown no puede pasar: mientras el diálogo está abierto, el
   * campo no tiene el foco y no ve nada.
   *
   * El campo se queda con el enter SOLO mientras se captura. En el cobro no
   * hay nada que agregar, y si se lo tragara, el enter que confirma el cobro
   * no llegaría a ningún lado.
   */
  refs.codigo.onkeydown = (ev) => {
    if (ev.key !== 'Enter' || fase !== 'venta') return;
    ev.preventDefault();
    ev.stopPropagation();
    agregarPorCodigo();
  };

  // ==========================================================
  // DINERO QUE ENTRA O SALE DEL CAJÓN
  // ==========================================================
  if (puedeOperarCaja) {
    pantalla.querySelector('#meter').onclick = () => movimiento('entrada');
    pantalla.querySelector('#gasto').onclick = () => movimiento('salida');
    pantalla.querySelector('#vale').onclick = async () => {
      await hacerVale();
      // El vale cambió lo que hay en el cajón; los avisos de la pista lo
      // leen de ahí. Y el foco vuelve al código, que es donde vive la mano
      // del cajero.
      refrescarAvisos();
      enfocar();
    };
  }

  /**
   * ANOTAR UN GASTO O UNA ENTRADA.
   *
   * Primero se ELIGE de los que se repiten, no se escribe. El desayuno de
   * los muchachos es todos los días y nunca es igual: escrito a mano, al
   * final del mes hay "Desayuno", "desayunos" y "DESAYUNO", que son tres
   * conceptos y ninguna estadística. Tocándolo es siempre el mismo.
   *
   * "Otro" sigue ahí para el gasto raro que no se va a repetir: obligar a
   * dar de alta un concepto para pagarle una vez a un plomero sería peor
   * que el problema.
   */
  async function movimiento(tipo) {
    const esSalida = tipo === 'salida';

    let conceptos = [];
    try {
      conceptos = ((await api.obtener('/caja/conceptos')).conceptos || [])
        .filter((c) => c.tipo === tipo);
    } catch { /* sin catálogo se escribe a mano, que es como era antes */ }

    let conceptoId = null;
    let concepto = '';

    if (conceptos.length) {
      const elegido = await menu({
        titulo: esSalida ? 'Gasto o retiro' : 'Meter dinero al cajón',
        texto: esSalida
          ? '¿En qué se usó? Toca el de siempre, o escribe uno.'
          : '¿De dónde viene? Toca el de siempre, o escribe uno.',
        opciones: [
          ...conceptos.map((c) => ({
            valor: c.id,
            texto: c.nombre,
            detalle: c.ayuda || ''
          })),
          { valor: '__otro', texto: '✎ Otro — escribirlo',
            detalle: 'Para el gasto que no se repite' }
        ]
      });
      if (!elegido) { enfocar(); return; }

      if (elegido !== '__otro') {
        conceptoId = elegido;
        concepto = conceptos.find((c) => c.id === elegido)?.nombre || '';
      }
    }

    if (!conceptoId) {
      concepto = await pedirTexto({
        titulo: esSalida ? 'Gasto o retiro' : 'Meter dinero al cajón',
        texto: esSalida
          ? '¿En qué se usó? La gasolina, un refresco, el retiro a la caja fuerte…'
          : '¿De dónde viene? El fondo con el que arranca el cajón, cambio del banco…',
        marcador: esSalida ? 'Gasolina' : 'Fondo para cambio',
        ok: 'Siguiente', largo: 60
      });
      if (!concepto) { enfocar(); return; }
    }

    const monto = await pedirImporte({
      titulo: concepto, texto: '¿De cuánto es?',
      marcador: '200', ok: esSalida ? 'Anotar la salida' : 'Anotar la entrada'
    });
    if (!monto) { enfocar(); return; }

    try {
      const r = await api.enviar('/caja/movimientos',
        conceptoId ? { tipo, conceptoId, monto } : { tipo, concepto, monto });
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
