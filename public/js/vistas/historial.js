/**
 * HISTORIAL  (v1.8)
 *
 * "¿Qué hizo Mari el jueves entre las 3 y las 8?"
 *
 * Esa es la pregunta, y la pantalla está armada para contestarla en cuatro
 * toques: los filtros arriba, el resumen debajo, y la lista completa abajo.
 *
 * NO ES LA BITÁCORA. La bitácora dice "venta.registrada" con un id, y es
 * para quien programa. Esto dice "Mari cobró el ticket #412 por $264 a las
 * 3:15", y es para Tony.
 *
 * Un cajero solo puede hacer cuatro cosas con el dinero —cobrar, sacar,
 * meter y recibir abonos—, así que eso es exactamente lo que se lista.
 */
import { api } from '../api.js';
import { esc, avisar, fecha as formatoFecha, soloHora } from '../util.js';
import { pedirTexto, confirmar, pedirContrasena, menu } from '../dialogo.js';
import { pesos } from '../fracciones.js';

const TIPOS = [
  { id: 'venta',   texto: 'Ventas',   emoji: '🧾' },
  { id: 'gasto',   texto: 'Gastos',   emoji: '📤' },
  { id: 'entrada', texto: 'Entradas', emoji: '📥' },
  { id: 'abono',   texto: 'Abonos',   emoji: '💰' }
];

export async function vistaHistorial(pantalla, estadoApp) {
  // Cancelar y eliminar son del administrador. A los demás ni les sale la
  // opción: un botón que siempre dice que no es peor que no tenerlo.
  const esAdmin = (estadoApp?.permisos || []).includes('*');

  let quienes = [];
  let datos = { movimientos: [], resumen: null };

  const filtro = {
    folio: '',
    desde: '', hasta: '', horaDesde: '', horaHasta: '',
    usuarioId: '', tipos: new Set(TIPOS.map((t) => t.id))
  };

  try {
    quienes = (await api.obtener('/historial/quienes')).quienes;
  } catch (e) { avisar(e.message, 'error'); }

  await cargar();

  async function cargar() {
    const q = new URLSearchParams();
    if (filtro.folio) q.set('folio', filtro.folio);
    if (filtro.desde) q.set('desde', filtro.desde);
    if (filtro.hasta) q.set('hasta', filtro.hasta);
    if (filtro.horaDesde) q.set('horaDesde', filtro.horaDesde);
    if (filtro.horaHasta) q.set('horaHasta', filtro.horaHasta);
    if (filtro.usuarioId) q.set('usuarioId', filtro.usuarioId);
    if (filtro.tipos.size !== TIPOS.length) q.set('tipos', [...filtro.tipos].join(','));
    q.set('limite', '300');

    try {
      datos = await api.obtener(`/historial?${q}`);
    } catch (e) {
      avisar(e.message, 'error');
      datos = { movimientos: [], resumen: null };
    }
    pintar();
  }

  // ==========================================================
  // LA PANTALLA
  //
  // Un renglón por movimiento, TODO en una sola línea y centrado. Lo que
  // más se busca va primero y en grande —el número de ticket—, y lo que se
  // lleva el cliente va en texto normal, recortado con puntos suspensivos
  // si no cabe: una tabla en la que cada renglón mide distinto no se puede
  // recorrer con la vista.
  // ==========================================================
  function pintar() {
    const r = datos.resumen;

    pantalla.innerHTML = `
      <div class="ancho-completo">
      <h2>Historial</h2>
      <p class="ayuda">
        Todo lo que ha pasado en la caja, de quien sea y de cuando sea.
        Se lee de lo más nuevo a lo más viejo.
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

        <div class="hist-tipos">
          ${TIPOS.map((t) => `
            <button class="secundario chico ${filtro.tipos.has(t.id) ? 'activo' : ''}"
                    data-tipo="${t.id}">${t.emoji} ${t.texto}</button>`).join('')}
          <button class="secundario chico" id="hoy">Hoy</button>
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
        ${datos.movimientos.length ? `
          <div class="hist-envoltura">
          <table class="tabla hist-tabla">
            <tr>
              <th class="hist-c-num">Ticket</th>
              <th class="hist-c-que">Qué</th>
              <th class="hist-c-cuando">Cuándo</th>
              <th class="hist-c-quien">Quién</th>
              <th class="hist-c-detalle">Se llevó</th>
              <th class="hist-c-importe der">Importe</th>
              <th class="hist-c-acciones"></th>
            </tr>
            ${datos.movimientos.map(renglon).join('')}
          </table>
          </div>
          ${datos.movimientos.length >= 300 ? `
            <p class="ayuda" style="margin-top:12px">
              Se enseñan los 300 más nuevos. Los totales de arriba sí son de
              todo lo que cae en el filtro. Aprieta las fechas para ver el resto.
            </p>` : ''}`
        : '<p class="vacio" style="padding:30px 0">Nada que coincida con eso.</p>'}
      </div>
      </div>`;

    enganchar();
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
    const t = TIPOS.find((x) => x.id === m.tipo) || { emoji: '·', texto: m.tipo };
    const cancelado = Boolean(m.cancelada_en);
    const esCambio = Boolean(m.cambio_de || m.cambiado_por);
    const esVenta = m.tipo === 'venta';

    return `
      <tr class="${cancelado ? 'anulada' : ''} ${esCambio ? 'es-cambio' : ''}" data-fila="${esc(m.id)}">
        <td class="hist-c-num">
          ${m.numero ? `<span class="hist-folio">${esc(m.numero)}</span>`
                     : '<span class="hist-folio vacio-folio">—</span>'}
        </td>
        <td class="hist-c-que">
          <span class="hist-tipo ${m.tipo}">${t.emoji} ${esc(t.texto)}</span>
          ${esCambio ? `
            <span class="hist-tipo cambio"
                  title="${m.cambiado_por
                    ? `Este ticket se cambió por el ${m.cambiadoPorNumero}`
                    : `Este ticket viene del cambio del ${m.cambioDeNumero}`}">
              ⇄ ${m.cambiado_por ? `${m.numero}→${m.cambiadoPorNumero}`
                                 : `${m.cambioDeNumero}→${m.numero}`}
            </span>` : ''}
          ${m.lista_tipo === 'mayoreo'
            ? `<span class="etiqueta-mayoreo">🏷️ ${esc(m.lista_nombre || 'mayoreo')}</span>` : ''}
          ${m.forma_pago && m.forma_pago !== 'efectivo'
            ? `<span class="hist-tipo pago">${m.forma_pago === 'credito' ? 'fiado' : esc(m.forma_pago)}</span>` : ''}
          ${cancelado
            ? `<span class="hist-tipo malo">${m.tipo === 'venta' ? 'cancelado' : 'anulado'}</span>` : ''}
        </td>
        <td class="hist-c-cuando">${esc(cuando(m.fecha))}</td>
        <td class="hist-c-quien">
          ${esc(m.quien || '—')}${m.turno ? ` <small>· turno #${m.turno}</small>` : ''}
        </td>
        <td class="hist-c-detalle" title="${esc(detalleLargo(m))}">${esc(detalleLargo(m))}</td>
        <td class="hist-c-importe der ${m.tipo === 'gasto' ? 'malo' : m.tipo === 'entrada' ? 'bueno' : ''}">
          ${m.tipo === 'gasto' ? '−' : m.tipo === 'entrada' ? '+' : ''}${pesos(m.centavos)}
        </td>
        <td class="hist-c-acciones">
          ${esVenta ? `
            <button class="secundario chico" data-copia="${esc(m.id)}">Copia</button>
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

    q('#desde').onchange = () => { filtro.desde = q('#desde').value; cargar(); };
    q('#hasta').onchange = () => { filtro.hasta = q('#hasta').value; cargar(); };
    q('#hora-desde').onchange = () => { filtro.horaDesde = q('#hora-desde').value; cargar(); };
    q('#hora-hasta').onchange = () => { filtro.horaHasta = q('#hora-hasta').value; cargar(); };
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

    q('#hoy').onclick = () => {
      const hoy = new Date();
      const dia = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${
        String(hoy.getDate()).padStart(2, '0')}`;
      filtro.desde = dia; filtro.hasta = dia;
      cargar();
    };

    pantalla.querySelectorAll('[data-copia]').forEach((b) => {
      b.onclick = () => sacarCopia(b.dataset.copia);
    });
    pantalla.querySelectorAll('[data-mas]').forEach((b) => {
      b.onclick = () => masOpciones(b.dataset.mas, folioDe(b));
    });

    q('#limpiar').onclick = () => {
      filtro.folio = '';
      filtro.desde = ''; filtro.hasta = '';
      filtro.horaDesde = ''; filtro.horaHasta = '';
      filtro.usuarioId = '';
      TIPOS.forEach((t) => filtro.tipos.add(t.id));
      cargar();
    };
  }

  /** El número del ticket del renglón donde vive un botón. */
  function folioDe(boton) {
    return boton.closest('tr')?.querySelector('.hist-folio')?.textContent.trim() || '';
  }
}
