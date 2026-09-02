/**
 * HISTORIAL  (v2.4)
 *
 * "¿Qué hizo Mari el jueves entre las 3 y las 8?"
 *
 * NO ES LA BITÁCORA. La bitácora dice "venta.registrada" con un id, y es
 * para quien programa. Esto dice "Mari cobró el ticket #2026-412 por $264 a
 * las 3:15", y es para Tony.
 *
 * ── SE ABRE CON LO DE HOY, NO CON TODO ──
 *
 * Dentro de tres años aquí va a haber cientos de miles de renglones.
 * Abrir el historial no puede querer decir "tráemelos todos": se abre con
 * el día de hoy —que es lo que se viene a ver casi siempre— y lo de más
 * atrás se pide a propósito, con el botón de abajo o poniendo fechas.
 *
 * Y por eso ORDENAR ES COSA DE ESTA PANTALLA, no del servidor: ordena lo
 * que YA está cargado. Si ordenara el servidor, poner "de lo más viejo a
 * lo más nuevo" traería la primera venta de hace diez años en vez de la de
 * las siete de la mañana de hoy, que es lo que se estaba buscando.
 */
import { api } from '../api.js';
import { esc, avisar, fecha as formatoFecha } from '../util.js';
import { pedirTexto, confirmar, pedirContrasena, menu, verTicket } from '../dialogo.js';
import { pesos } from '../fracciones.js';

const TIPOS = [
  { id: 'venta',   texto: 'Ventas',   emoji: '🧾' },
  { id: 'gasto',   texto: 'Gastos',   emoji: '📤' },
  { id: 'entrada', texto: 'Entradas', emoji: '📥' },
  { id: 'abono',   texto: 'Abonos',   emoji: '💰' }
];

/** Cuántos renglones trae cada tirón. */
const POR_TIRON = 100;

/**
 * Las columnas por las que se puede ordenar, y de dónde sale el valor.
 *
 * Se ordena por el DATO, no por el texto que se ve: el importe por sus
 * centavos y no por "$1,234" —que alfabéticamente va antes que "$9"— y la
 * fecha por el instante guardado y no por "26 ago".
 */
const ORDENABLES = {
  numero:  { texto: 'Ticket',  valor: (m) => m.folio ?? -1 },
  que:     { texto: 'Qué',     valor: (m) => m.que?.texto || m.tipo },
  fecha:   { texto: 'Cuándo',  valor: (m) => m.fecha },
  quien:   { texto: 'Quién',   valor: (m) => (m.quien || '').toLowerCase() },
  centavos:{ texto: 'Importe', valor: (m) => m.centavos ?? 0 }
};

export async function vistaHistorial(pantalla, estadoApp) {
  // Cancelar y eliminar son del administrador. A los demás ni les sale la
  // opción: un botón que siempre dice que no es peor que no tenerlo.
  const esAdmin = (estadoApp?.permisos || []).includes('*');

  let quienes = [];
  let movimientos = [];              // lo cargado hasta ahora, acumulado
  let resumen = null;
  let hayMas = false;
  let cursor = null;
  let ventana = 'hoy';
  let cargando = false;

  const orden = { columna: 'fecha', descendente: true };

  const filtro = {
    folio: '',
    desde: '', hasta: '', horaDesde: '', horaHasta: '',
    // Las últimas tantas horas, cuando se pidió con un atajo. Va aparte de
    // `desde` porque no es un día de calendario: es un instante.
    ultimasHoras: null,
    usuarioId: '', tipos: new Set(TIPOS.map((t) => t.id))
  };

  /**
   * LOS ATAJOS DE TIEMPO  (v3.9)
   *
   * "Hoy" y "las últimas 24 horas" NO son lo mismo, y por eso están los
   * dos: a las diez de la mañana, "hoy" son diez horas y "las últimas 24"
   * llegan hasta ayer a las diez — que es donde estuvo el turno de la
   * tarde. Cuando algo no cuadró, casi siempre es lo segundo.
   *
   * Los de días sí van por calendario, porque así se dicen: "los últimos
   * siete días" es esta semana contando hoy, no ciento sesenta y ocho
   * horas exactas.
   */
  const ATAJOS = [
    { id: 'hoy',   texto: 'Hoy',              dias: 1 },
    { id: '24h',   texto: 'Últimas 24 horas', horas: 24 },
    { id: '7d',    texto: 'Últimos 7 días',   dias: 7 },
    { id: '30d',   texto: 'Últimos 30 días',  dias: 30 }
  ];

  /** Cuál atajo está puesto ahora mismo, para pintarlo encendido. */
  let atajo = 'hoy';

  /** Un día del calendario, en el reloj de la fábrica. */
  function diaLocal(hace = 0) {
    const d = new Date();
    d.setDate(d.getDate() - hace);
    const dd = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;
  }

  function ponerAtajo(id) {
    const a = ATAJOS.find((x) => x.id === id);
    if (!a) return;
    atajo = id;
    filtro.folio = '';
    filtro.horaDesde = ''; filtro.horaHasta = '';
    if (a.horas) {
      filtro.ultimasHoras = a.horas;
      filtro.desde = ''; filtro.hasta = '';
    } else {
      filtro.ultimasHoras = null;
      filtro.desde = diaLocal(a.dias - 1);
      filtro.hasta = diaLocal(0);
    }
    cargar();
  }

  try {
    quienes = (await api.obtener('/historial/quienes')).quienes;
  } catch (e) { avisar(e.message, 'error'); }

  await cargar();

  /** Los filtros de la pantalla, como los espera el servidor. */
  function consulta({ antesDe = null } = {}) {
    const q = new URLSearchParams();
    if (filtro.folio) q.set('folio', filtro.folio);
    if (filtro.desde) q.set('desde', filtro.desde);
    if (filtro.hasta) q.set('hasta', filtro.hasta);
    if (filtro.horaDesde) q.set('horaDesde', filtro.horaDesde);
    if (filtro.horaHasta) q.set('horaHasta', filtro.horaHasta);
    if (filtro.ultimasHoras) q.set('ultimasHoras', String(filtro.ultimasHoras));
    if (filtro.usuarioId) q.set('usuarioId', filtro.usuarioId);
    if (filtro.tipos.size !== TIPOS.length) q.set('tipos', [...filtro.tipos].join(','));
    if (antesDe) q.set('antesDe', antesDe);
    q.set('limite', String(POR_TIRON));
    return q;
  }

  /** Cambió un filtro: se empieza de cero. */
  async function cargar() {
    cargando = true;
    try {
      const d = await api.obtener(`/historial?${consulta()}`);
      movimientos = d.movimientos;
      resumen = d.resumen;
      hayMas = d.hayMas;
      cursor = d.cursor;
      ventana = d.ventana;
    } catch (e) {
      avisar(e.message, 'error');
      movimientos = []; resumen = null; hayMas = false; cursor = null;
    }
    cargando = false;
    pintar();
  }

  /**
   * CARGAR MÁS: se anexa, no se reemplaza.
   *
   * Se pide "lo anterior a este instante" y no "la página 2": entre un
   * tirón y otro puede entrar una venta nueva, y con páginas numeradas eso
   * hace que un renglón se vea dos veces o no se vea nunca.
   */
  async function cargarMas() {
    if (!cursor || cargando) return;
    cargando = true;
    pintarBotonMas();
    try {
      const d = await api.obtener(`/historial?${consulta({ antesDe: cursor })}`);
      // Por si acaso: dos tirones no pueden repetir un renglón.
      const yaEstan = new Set(movimientos.map((m) => m.id));
      movimientos = movimientos.concat(d.movimientos.filter((m) => !yaEstan.has(m.id)));
      hayMas = d.hayMas;
      cursor = d.cursor;
      ventana = 'filtro';
    } catch (e) { avisar(e.message, 'error'); }
    cargando = false;
    pintar();
  }

  /** Lo cargado, puesto en el orden que pidió la columna. */
  function enOrden() {
    const como = ORDENABLES[orden.columna] || ORDENABLES.fecha;
    const signo = orden.descendente ? -1 : 1;
    return [...movimientos].sort((a, b) => {
      const x = como.valor(a);
      const y = como.valor(b);
      if (x === y) return a.fecha < b.fecha ? 1 : -1;   // desempate: lo más nuevo primero
      return (x < y ? -1 : 1) * signo;
    });
  }

  // ==========================================================
  // LA PANTALLA
  //
  // Un renglón por movimiento, TODO en una sola línea y centrado a media
  // altura. Lo que hay que ver sí o sí va primero y sin recortar: el
  // NÚMERO de ticket, QUÉ fue, CUÁNDO y CUÁNTO. Lo que se llevó el cliente
  // va al final, en texto normal y recortado si no cabe: es lo que menos
  // se lee y lo que más ocupa, y con el ojito se ve entero.
  // ==========================================================
  function pintar() {
    const r = resumen;
    const lista = enOrden();

    pantalla.innerHTML = `
      <div class="ancho-completo">
      <h2>Historial</h2>
      <p class="ayuda">
        Todo lo que ha pasado en la caja, de quien sea y de cuando sea.
        Se abre con <b>lo de hoy</b>; para ver más atrás, el botón de abajo
        o las fechas.
      </p>

      <div class="tarjeta hist-filtros">
        <div class="hist-fila">
          <label>
            <span class="etiqueta-chica">Ticket número</span>
            <input type="search" id="folio" placeholder="2026-412"
                   value="${esc(filtro.folio)}">
          </label>
          <label>
            <span class="etiqueta-chica">Desde el día</span>
            <input type="date" id="desde" value="${esc(filtro.desde)}">
          </label>
          <label>
            <span class="etiqueta-chica">Hasta el día</span>
            <input type="date" id="hasta" value="${esc(filtro.hasta)}">
          </label>
          <label>
            <span class="etiqueta-chica">Desde la hora</span>
            <input type="time" id="hora-desde" value="${esc(filtro.horaDesde)}">
          </label>
          <label>
            <span class="etiqueta-chica">Hasta la hora</span>
            <input type="time" id="hora-hasta" value="${esc(filtro.horaHasta)}">
          </label>
          <label>
            <span class="etiqueta-chica">Quién</span>
            <select id="quien">
              <option value="">Todos</option>
              ${quienes.map((u) => `
                <option value="${esc(u.id)}" ${filtro.usuarioId === u.id ? 'selected' : ''}>
                  ${esc(u.nombre)}
                </option>`).join('')}
            </select>
          </label>
        </div>

        <div class="hist-atajos">
          <span class="etiqueta-chica">De cuándo</span>
          ${ATAJOS.map((a) => `
            <button class="secundario chico ${atajo === a.id ? 'activo' : ''}"
                    data-atajo="${a.id}">${esc(a.texto)}</button>`).join('')}
          <button class="secundario chico hist-suelto ${orden.columna === 'quien' ? 'activo' : ''}"
                  id="por-quien" title="Junta los renglones de cada persona">
            👤 Ordenar por quién
          </button>
        </div>

        <div class="hist-tipos">
          <span class="etiqueta-chica">Qué</span>
          ${TIPOS.map((t) => `
            <button class="secundario chico ${filtro.tipos.has(t.id) ? 'activo' : ''}"
                    data-tipo="${t.id}">${t.emoji} ${t.texto}</button>`).join('')}
          <button class="secundario chico" id="limpiar">Quitar filtros</button>
        </div>
        ${filtro.folio ? `
          <p class="ayuda" style="margin:10px 0 0">
            Buscando el ticket <b>${esc(filtro.folio)}</b>. Los demás filtros
            no aplican mientras busques por número.
          </p>` : ''}
      </div>

      ${r ? `
        <div class="hist-resumen">
          <div class="hist-dato">
            <small>Cobrado</small><strong class="bueno">${pesos(r.cobrado)}</strong>
            <small>${r.ventas} ticket${r.ventas === 1 ? '' : 's'}${
              r.canceladas ? ` · ${r.canceladas} cancelado${r.canceladas === 1 ? '' : 's'}` : ''}</small>
          </div>
          <div class="hist-dato">
            <small>Gastos</small><strong class="malo">${pesos(r.gastos)}</strong>
          </div>
          <div class="hist-dato">
            <small>Entradas</small><strong class="bueno">${pesos(r.entradas)}</strong>
          </div>
          <div class="hist-dato">
            <small>Abonos</small><strong>${pesos(r.abonos)}</strong>
            <small>${r.abonosCuantos} recibido${r.abonosCuantos === 1 ? '' : 's'}</small>
          </div>
        </div>` : ''}

      <div class="tarjeta plana">
        <div class="hist-cuantos">
          <span>
            ${lista.length} ${lista.length === 1 ? 'renglón' : 'renglones'}
            ${ventana === 'hoy' ? '<b>de hoy</b>' : 'cargados'}
          </span>
          <span class="ayuda">Los totales de arriba son de todo lo que cae en el filtro.</span>
        </div>

        ${lista.length ? `
          <div class="hist-envoltura">
          <table class="tabla hist-tabla">
            <tr>
              ${cabecera('numero', 'hist-c-num')}
              ${cabecera('que', 'hist-c-que')}
              ${cabecera('fecha', 'hist-c-cuando')}
              ${cabecera('quien', 'hist-c-quien')}
              ${cabecera('centavos', 'hist-c-importe der')}
              <th class="hist-c-detalle">Se llevó</th>
              <th class="hist-c-acciones"></th>
            </tr>
            ${lista.map(renglon).join('')}
          </table>
          </div>`
        : '<p class="vacio" style="padding:30px 0">Nada que coincida con eso.</p>'}

        <div id="zona-mas">${botonMas()}</div>
      </div>
      </div>`;

    enganchar();
  }

  /**
   * Una cabecera que ordena al tocarla.
   *
   * La flechita solo sale en la columna por la que se está ordenando: tres
   * flechas grises en una fila de cinco no dicen nada, y una sola dice
   * exactamente por dónde va el orden.
   */
  function cabecera(clave, clases) {
    const c = ORDENABLES[clave];
    const activa = orden.columna === clave;
    return `
      <th class="${clases} ordenable ${activa ? 'ordenando' : ''}"
          data-ordenar="${clave}"
          title="Ordenar por ${c.texto.toLowerCase()}">
        ${esc(c.texto)}<span class="flecha">${activa ? (orden.descendente ? '▼' : '▲') : ''}</span>
      </th>`;
  }

  function botonMas() {
    if (cargando) return '<p class="ayuda hist-mas">Buscando…</p>';
    if (!hayMas) {
      return movimientos.length
        ? '<p class="ayuda hist-mas">Ya no hay nada más atrás con este filtro.</p>'
        : '';
    }
    return `
      <button class="secundario hist-mas-boton" id="cargar-mas">
        Cargar ${POR_TIRON} más ${ventana === 'hoy' ? '(hacia atrás de hoy)' : 'hacia atrás'}
      </button>`;
  }

  function pintarBotonMas() {
    const zona = pantalla.querySelector('#zona-mas');
    if (zona) zona.innerHTML = botonMas();
  }

  /**
   * Un renglón.
   *
   * LOS CAMBIOS SE VEN DE LOS DOS LADOS. Cuando un ticket se cambió por
   * otro, los dos renglones lo dicen y cada uno nombra a su pareja: el
   * viejo dice "cambiado por #8" y el nuevo "cambio del #5". Así, cayendo
   * en cualquiera de los dos, se sabe la historia completa sin buscar.
   */
  function renglon(m) {
    const q = m.que || { clave: m.tipo, texto: m.tipo, emoji: '·' };
    const cancelado = Boolean(m.cancelada_en);
    const esCambio = Boolean(m.cambio_de || m.cambiado_por);
    const esVenta = m.tipo === 'venta';
    const detalle = detalleLargo(m);

    return `
      <tr class="${cancelado ? 'anulada' : ''} ${esCambio ? 'es-cambio' : ''}" data-fila="${esc(m.id)}">
        <td class="hist-c-num">
          ${m.numero ? `<span class="hist-folio">${esc(m.numero)}</span>`
                     : '<span class="hist-folio vacio-folio">—</span>'}
        </td>
        <td class="hist-c-que"><span class="hist-que-caja"><span
              class="hist-que que-${esc(q.clave)}">${q.emoji} ${esc(q.texto)}</span>${esCambio ? `<span
              class="hist-que que-par"
              title="${m.cambiado_por
                ? `Este ticket se cambió por el ${m.cambiadoPorNumero}`
                : `Este ticket viene del cambio del ${m.cambioDeNumero}`}"
              >${m.cambiado_por ? `→ ${esc(m.cambiadoPorNumero)}`
                                : `← ${esc(m.cambioDeNumero)}`}</span>` : ''}</span></td>
        <td class="hist-c-cuando" title="${esc(formatoFecha(m.fecha))}">${esc(cuando(m.fecha))}</td>
        <td class="hist-c-quien"
            title="${esc(m.quien || '—')}${m.turno ? ` · turno #${m.turno}` : ''}">
          ${esc(m.quien || '—')}
        </td>
        <td class="hist-c-importe der ${m.tipo === 'gasto' ? 'malo' : m.tipo === 'entrada' ? 'bueno' : ''}">
          ${m.tipo === 'gasto' ? '−' : m.tipo === 'entrada' ? '+' : ''}${pesos(m.centavos)}
        </td>
        <td class="hist-c-detalle" title="${esc(detalle)}">${esc(detalle)}</td>
        <td class="hist-c-acciones">
          <button class="secundario chico" data-ver="${esc(m.id)}"
                  title="Ver este movimiento completo">👁</button>
          ${esVenta ? `
            <button class="secundario chico" data-copia="${esc(m.id)}"
                    title="Volver a imprimirlo marcado como copia">Copia</button>
            ${esAdmin && !cancelado
              ? `<button class="secundario chico" data-mas="${esc(m.id)}"
                         title="Cancelar o eliminar">⋯</button>` : ''}` : ''}
        </td>
      </tr>`;
  }

  /** "25 ago · 07:32 p.m." Cabe en su columna y se lee de un vistazo. */
  function cuando(iso) {
    const d = new Date(iso);
    const dia = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    const hora = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    return `${dia} · ${hora}`;
  }

  /** Lo que se llevó, y a nombre de quién si lo hay. */
  function detalleLargo(m) {
    const partes = [];
    if (m.cliente) partes.push(m.cliente);
    if (m.detalle && m.detalle !== m.cliente) partes.push(m.detalle);
    if (m.cancelada_en && m.motivo_cancelacion) partes.push(`(${m.motivo_cancelacion})`);
    return partes.join(' · ') || '—';
  }

  // ==========================================================
  // VER UN MOVIMIENTO COMPLETO
  //
  // La columna de "se llevó" está recortada a propósito —es la que más
  // ocupa y la que menos se lee—, así que tiene que haber una forma de
  // verlo entero sin salir de la lista. Eso es el ojito.
  // ==========================================================
  async function verMovimiento(id) {
    const m = movimientos.find((x) => x.id === id);
    if (!m) return;

    // EL TICKET CON FORMA DE TICKET. El servidor manda los mismos renglones
    // que irían a la impresora y aquí se pintan sobre papel simulado: tiene
    // más información que un resumen y ya se sabe leer. No es una imagen:
    // son datos, y carga al instante.
    const q = m.que || {};
    try {
      const ruta = m.tipo === 'venta'
        ? `/impresion/venta/${m.id}/previa`
        : `/impresion/movimiento/${m.id}/previa`;
      const { renglones, ancho } = await api.obtener(ruta);

      const notas = [
        m.quien ? `Lo anotó ${m.quien}` : '',
        m.cancelada_en ? `✕ Cancelado: ${m.motivo_cancelacion || 'sin motivo'}` : ''
      ].filter(Boolean);

      const accion = await verTicket({
        titulo: m.numero ? `Ticket ${m.numero}` : q.texto || 'Movimiento',
        renglones, ancho, notas,
        acciones: m.tipo === 'venta' ? [{ valor: 'copia', texto: '🖨 Copia' }] : []
      });
      if (accion === 'copia') sacarCopia(m.id);
      return;
    } catch {
      // Si no hay ticket que enseñar (un abono, un registro muy viejo), se
      // cae al resumen de texto de siempre.
    }

    await menu({
      titulo: m.numero ? `Ticket ${m.numero}` : q.texto || 'Movimiento',
      texto: [
        `${q.emoji || ''} ${q.texto || ''}`.trim(),
        formatoFecha(m.fecha),
        m.quien ? `Lo hizo ${m.quien}` : '',
        m.turno ? `Turno #${m.turno}` : '',
        m.cliente ? `Cliente: ${m.cliente}` : '',
        m.detalle || '',
        `Importe: ${pesos(m.centavos)}`,
        m.cancelada_en ? `Cancelado: ${m.motivo_cancelacion || 'sin motivo'}` : ''
      ].filter(Boolean).join('\n'),
      opciones: [{ valor: 'cerrar', texto: 'Cerrar' }]
    });
  }

  // ==========================================================
  // LO QUE SE PUEDE HACER CON UN TICKET
  // ==========================================================
  async function sacarCopia(id) {
    try {
      const r = await api.enviar(`/impresion/venta/${id}`, { copia: true });
      avisar(r.impreso ? 'Copia impresa' : 'No hay impresora configurada', r.impreso ? 'bien' : '');
    } catch (e) { avisar(e.message, 'error'); }
  }

  /**
   * Cancelar y eliminar viven detrás de un "⋯" a propósito: son las dos
   * cosas peligrosas de esta pantalla, y un botón rojo en cada renglón es
   * un botón rojo que un día se toca sin querer.
   */
  async function masOpciones(id, folio) {
    const que = await menu({
      titulo: `Ticket ${folio}`,
      texto: '¿Qué le hacemos?',
      opciones: [
        { valor: 'cancelar', texto: '✕ Cancelar el ticket',
          detalle: 'Queda tachado con su motivo. El hielo vuelve y la caja se ajusta.' },
        { valor: 'borrar', texto: '🗑 Eliminar', peligro: true,
          detalle: 'Desaparece. Solo se puede si su turno sigue abierto.' }
      ]
    });
    if (que === 'cancelar') return cancelarVenta(id, folio);
    if (que === 'borrar') return borrarVenta(id, folio);
  }

  async function cancelarVenta(id, folio) {
    const motivo = await pedirTexto({
      titulo: `Cancelar el ticket ${folio}`,
      texto: 'Queda tachado con su motivo, el hielo vuelve al cuarto frío y la caja se ajusta sola.',
      marcador: 'Se equivocó de producto', ok: 'Cancelar el ticket', largo: 120, unaLinea: true
    });
    if (!motivo) return;
    try {
      await api.enviar(`/ventas/${id}/cancelar`, { motivo });
      avisar(`Ticket ${folio} cancelado`, 'bien');
      await cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  /**
   * Borrar de verdad. Solo el administrador y solo con su contraseña, y
   * solo mientras el turno sigue abierto: después hay un papel firmado con
   * ese número, y el papel manda.
   */
  async function borrarVenta(id, folio) {
    if (!await confirmar({
      titulo: `¿Eliminar el ticket ${folio}?`,
      texto: 'Desaparece como si nunca hubiera existido. Si ya se cortó el turno ' +
             'no se va a poder: para eso está cancelar.',
      ok: 'Eliminar', peligro: true
    })) return;

    const clave = await pedirContrasena({
      titulo: 'Tu contraseña de administrador',
      texto: `Se va a eliminar el ticket ${folio}. Esto no se deshace.`
    });
    if (!clave) return;

    try {
      await api.borrar(`/ventas/${id}`, { autorizacion: clave });
      avisar(`Ticket ${folio} eliminado`, 'bien');
      await cargar();
    } catch (e) {
      avisar(e.message, 'error');
    }
  }

  // ==========================================================
  // LOS FILTROS
  // ==========================================================
  function enganchar() {
    const q = (sel) => pantalla.querySelector(sel);

    // El número de ticket se busca mientras se teclea, sin enter: es la
    // pregunta más común y no merece dos pasos.
    const folio = q('#folio');
    let espera;
    folio.oninput = () => {
      clearTimeout(espera);
      espera = setTimeout(() => { filtro.folio = folio.value.trim(); cargar(); }, 250);
    };
    folio.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); folio.blur(); } };

    // Al tocar una fecha a mano el atajo deja de estar puesto: seguir
    // enseñándolo encendido diría que la pantalla muestra algo que ya no
    // muestra.
    const aMano = () => { atajo = null; filtro.ultimasHoras = null; };
    q('#desde').onchange = () => { aMano(); filtro.desde = q('#desde').value; cargar(); };
    q('#hasta').onchange = () => { aMano(); filtro.hasta = q('#hasta').value; cargar(); };
    q('#hora-desde').onchange = () => { aMano(); filtro.horaDesde = q('#hora-desde').value; cargar(); };
    q('#hora-hasta').onchange = () => { aMano(); filtro.horaHasta = q('#hora-hasta').value; cargar(); };
    q('#quien').onchange = () => { filtro.usuarioId = q('#quien').value; cargar(); };

    pantalla.querySelectorAll('[data-tipo]').forEach((b) => {
      b.onclick = () => {
        const t = b.dataset.tipo;
        // Quitar el último tipo dejaría una lista vacía sin explicación:
        // si se apaga el que queda, se vuelven a encender todos.
        if (filtro.tipos.has(t)) filtro.tipos.delete(t);
        else filtro.tipos.add(t);
        if (!filtro.tipos.size) TIPOS.forEach((x) => filtro.tipos.add(x.id));
        cargar();
      };
    });

    pantalla.querySelectorAll('[data-atajo]').forEach((b) => {
      b.onclick = () => ponerAtajo(b.dataset.atajo);
    });

    // ORDENAR POR QUIÉN: junta los renglones de cada persona sin esconder
    // a nadie. Es distinto de escoger a alguien en "Quién", que sí esconde
    // a los demás — y a veces lo que se quiere es comparar los dos turnos.
    q('#por-quien').onclick = () => {
      if (orden.columna === 'quien') { orden.columna = 'fecha'; orden.descendente = true; }
      else { orden.columna = 'quien'; orden.descendente = false; }
      pintar();
    };

    pantalla.querySelectorAll('[data-copia]').forEach((b) => {
      b.onclick = () => sacarCopia(b.dataset.copia);
    });
    pantalla.querySelectorAll('[data-mas]').forEach((b) => {
      b.onclick = () => masOpciones(b.dataset.mas, folioDe(b));
    });
    pantalla.querySelectorAll('[data-ver]').forEach((b) => {
      b.onclick = () => verMovimiento(b.dataset.ver);
    });

    // ORDENAR. Tocar la misma columna otra vez le da la vuelta al orden;
    // tocar otra empieza por lo más alto, que es lo que uno espera al
    // preguntar "¿cuál fue el ticket más grande?".
    pantalla.querySelectorAll('[data-ordenar]').forEach((th) => {
      th.onclick = () => {
        const clave = th.dataset.ordenar;
        if (orden.columna === clave) orden.descendente = !orden.descendente;
        else { orden.columna = clave; orden.descendente = true; }
        pintar();
      };
    });

    const mas = q('#cargar-mas');
    if (mas) mas.onclick = cargarMas;

    q('#limpiar').onclick = () => {
      filtro.folio = '';
      filtro.desde = ''; filtro.hasta = '';
      filtro.horaDesde = ''; filtro.horaHasta = '';
      filtro.ultimasHoras = null;
      filtro.usuarioId = '';
      TIPOS.forEach((t) => filtro.tipos.add(t.id));
      atajo = 'hoy';
      orden.columna = 'fecha'; orden.descendente = true;
      cargar();
    };
  }

  /** El número del ticket del renglón donde vive un botón. */
  function folioDe(boton) {
    return boton.closest('tr')?.querySelector('.hist-folio')?.textContent.trim() || '';
  }
}
