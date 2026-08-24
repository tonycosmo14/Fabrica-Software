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
import { pesos } from '../fracciones.js';

const TIPOS = [
  { id: 'venta',   texto: 'Ventas',   emoji: '🧾' },
  { id: 'gasto',   texto: 'Gastos',   emoji: '📤' },
  { id: 'entrada', texto: 'Entradas', emoji: '📥' },
  { id: 'abono',   texto: 'Abonos',   emoji: '💰' }
];

export async function vistaHistorial(pantalla) {
  let quienes = [];
  let datos = { movimientos: [], resumen: null };

  const filtro = {
    desde: '', hasta: '', horaDesde: '', horaHasta: '',
    usuarioId: '', tipos: new Set(TIPOS.map((t) => t.id))
  };

  try {
    quienes = (await api.obtener('/historial/quienes')).quienes;
  } catch (e) { avisar(e.message, 'error'); }

  await cargar();

  async function cargar() {
    const q = new URLSearchParams();
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
            <small>Entradas</small><strong>${pesos(r.entradas)}</strong>
          </div>
          <div class="hist-dato">
            <small>Abonos</small><strong>${pesos(r.abonos)}</strong>
            <small>${r.abonosCuantos} recibido${r.abonosCuantos === 1 ? '' : 's'}</small>
          </div>
        </div>` : ''}

      <div class="tarjeta">
        ${datos.movimientos.length ? `
          <table class="tabla hist-tabla">
            <tr>
              <th>Cuándo</th><th>Qué</th><th>Quién</th>
              <th>Detalle</th><th class="der">Importe</th>
            </tr>
            ${datos.movimientos.map(renglon).join('')}
          </table>
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

  function renglon(m) {
    const t = TIPOS.find((x) => x.id === m.tipo) || { emoji: '·', texto: m.tipo };
    const cancelado = Boolean(m.cancelada_en);

    return `
      <tr class="${cancelado ? 'anulada' : ''}">
        <td class="hist-cuando">
          ${esc(formatoFecha(m.fecha))}
        </td>
        <td>
          <span class="hist-tipo ${m.tipo}">${t.emoji} ${esc(t.texto)}</span>
          ${m.folio ? `<small>#${m.folio}</small>` : ''}
        </td>
        <td>
          ${esc(m.quien || '—')}
          ${m.turno ? `<small>turno #${m.turno}</small>` : ''}
        </td>
        <td class="hist-detalle">
          ${esc(m.cliente || '—')}
          ${m.forma_pago && m.forma_pago !== 'efectivo'
            ? `<small>${m.forma_pago === 'credito' ? 'fiado' : esc(m.forma_pago)}</small>` : ''}
          ${cancelado
            ? `<small class="malo">${m.tipo === 'venta' ? 'cancelado' : 'anulado'}${
                m.motivo_cancelacion ? ': ' + esc(m.motivo_cancelacion) : ''}</small>`
            : ''}
        </td>
        <td class="der hist-importe ${m.tipo === 'gasto' ? 'malo' : ''}">
          ${m.tipo === 'gasto' ? '−' : ''}${pesos(m.centavos)}
        </td>
      </tr>`;
  }

  // ==========================================================
  // LOS FILTROS
  // ==========================================================
  function enganchar() {
    const q = (sel) => pantalla.querySelector(sel);

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

    q('#limpiar').onclick = () => {
      filtro.desde = ''; filtro.hasta = '';
      filtro.horaDesde = ''; filtro.horaHasta = '';
      filtro.usuarioId = '';
      TIPOS.forEach((t) => filtro.tipos.add(t.id));
      cargar();
    };
  }
}
