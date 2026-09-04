/**
 * ARMAR UNA SALIDA  (v6.3)
 *
 * "Asignar cada cliente o pedido a un repartidor o vehículo. El que asigna
 *  debe considerar si cabe en el vehículo y qué repartidores hay
 *  disponibles: en ruta, no vino."
 *
 * Un solo diálogo, con todo lo que hace falta para decidir a la vista:
 *
 *   · LOS PEDIDOS que esperan camioneta, con casilla, en el ORDEN SUGERIDO
 *     de visita (del más cercano en adelante, saliendo de la fábrica), y
 *     con ▲▼ para moverlos. Los sin ubicación van al final.
 *   · QUIÉN: cada repartidor dice si está libre o en qué salida anda. Lo de
 *     "no vino" no lo sabe el sistema: se ve a la gente y se decide.
 *   · EN QUÉ: cada vehículo con lo que le cabe y si ya lo tiene otra salida.
 *   · LA CUENTA, en vivo: cuánto hielo sube contra lo que cabe, y cuánto vale.
 *
 * Se usa desde Los pedidos y desde El reparto. Devuelve la salida creada,
 * o null si se canceló.
 */
import { api } from './api.js';
import { esc, avisar } from './util.js';
import { armarDialogo, confirmar } from './dialogo.js';
import { pesos, aTexto } from './fracciones.js';

export async function armarSalida({ hasta = null, marcados = null } = {}) {
  let d;
  try {
    d = await api.obtener(`/reparto/para-armar${hasta ? `?hasta=${hasta}` : ''}`);
  } catch (e) { avisar(e.message, 'error'); return null; }

  if (!d.pedidos.length) { avisar('No hay pedidos esperando camioneta', ''); return null; }
  if (!d.repartidores.length) {
    avisar('Nadie puede llevarse la camioneta: da de alta un repartidor primero', 'error');
    return null;
  }

  // El orden se lleva aquí, en un arreglo que se mueve con ▲▼.
  let orden = d.pedidos.map((p) => p.id);
  const porId = new Map(d.pedidos.map((p) => [p.id, p]));
  const marcado = new Set(marcados ? marcados.map(String) : orden);

  const dlg = armarDialogo(`
    <h3 class="dialogo-titulo">🚚 Armar una salida</h3>
    <p class="dialogo-texto">
      Marca los que suben, en el orden en que se van a visitar. El orden es
      el sugerido por cercanía desde la fábrica; se mueve con ▲▼.
    </p>
    <div class="rep-elegir" id="lista"></div>

    <div class="armar-quien">
      <label>
        <span class="etiqueta-chica">¿Quién se la lleva?</span>
        <select id="quien">
          ${d.repartidores.map((r) => `
            <option value="${esc(r.id)}" ${r.libre ? '' : 'disabled'}>
              ${esc(r.nombre)}${r.rol !== 'repartidor' ? ` (${esc(r.rol)})` : ''} ·
              ${r.libre ? 'libre' : `en la salida #${r.salida.folio}, ${esc(r.salida.texto.toLowerCase())}`}
            </option>`).join('')}
        </select>
      </label>
      <label>
        <span class="etiqueta-chica">¿En qué?</span>
        <select id="vehiculo">
          <option value="">Sin vehículo · a pie, o en lo que haya</option>
          ${d.vehiculos.map((v) => `
            <option value="${esc(v.id)}" data-cabe="${v.capacidad_marquetas || ''}" ${v.libre ? '' : 'disabled'}>
              ${esc(v.nombre)}${v.capacidad_marquetas ? ` · le caben ${v.capacidad_marquetas}` : ''}
              ${v.libre ? '' : ` · la tiene la salida #${v.salida.folio}`}
            </option>`).join('')}
        </select>
      </label>
    </div>
    <p class="ayuda" style="margin:6px 0 0">
      Quien anda en la calle o tiene una salida por cuadrar sale apagado. Si
      alguien no vino hoy, el sistema no lo sabe: se elige a quien sí está.
    </p>

    <div class="armar-cuenta" id="cuenta"></div>

    <div class="dialogo-botones">
      <button class="secundario" data-no>Cancelar</button>
      <button data-si>Armar la salida</button>
    </div>`);

  const caja = dlg.caja;
  const lista = caja.querySelector('#lista');
  const selQuien = caja.querySelector('#quien');
  const selVeh = caja.querySelector('#vehiculo');
  const cuenta = caja.querySelector('#cuenta');

  // El primer vehículo libre, si lo hay: casi siempre es el que se usa.
  const libre = d.vehiculos.find((v) => v.libre);
  if (libre) selVeh.value = libre.id;
  const primero = d.repartidores.find((r) => r.libre);
  if (primero) selQuien.value = primero.id;

  function pintarLista() {
    lista.innerHTML = orden.map((id, i) => {
      const p = porId.get(id);
      const lineas = p.lineas.map((l) => `${esc(l.texto)} ${esc(l.concepto)}`).join(' · ');
      return `
        <div class="rep-elegir-fila armar-fila ${marcado.has(id) ? '' : 'apagada'}">
          <input type="checkbox" value="${esc(id)}" ${marcado.has(id) ? 'checked' : ''}>
          <span class="armar-num">${i + 1}</span>
          <span class="crece">
            <strong>#${p.folio} ${esc(p.cliente_nombre || p.cliente_negocio || '—')}</strong>
            <small>${lineas}${p.horario ? ` · 🕗 ${esc(p.horario)}` : ''}${
              p.latitud == null ? ' · <i>sin ubicación</i>'
              : p.metrosDesdeAnterior != null ? ` · ${distancia(p.metrosDesdeAnterior)}` : ''}</small>
          </span>
          <span class="rep-precio">${pesos(p.total)}</span>
          <span class="armar-mover">
            <button type="button" class="secundario chico" data-sube="${i}" ${i === 0 ? 'disabled' : ''}>▲</button>
            <button type="button" class="secundario chico" data-baja="${i}" ${i === orden.length - 1 ? 'disabled' : ''}>▼</button>
          </span>
        </div>`;
    }).join('');

    lista.querySelectorAll('input[type=checkbox]').forEach((c) => {
      c.onchange = () => { if (c.checked) marcado.add(c.value); else marcado.delete(c.value); pintarLista(); };
    });
    lista.querySelectorAll('[data-sube]').forEach((b) => {
      b.onclick = () => { const i = Number(b.dataset.sube); [orden[i - 1], orden[i]] = [orden[i], orden[i - 1]]; pintarLista(); };
    });
    lista.querySelectorAll('[data-baja]').forEach((b) => {
      b.onclick = () => { const i = Number(b.dataset.baja); [orden[i + 1], orden[i]] = [orden[i], orden[i + 1]]; pintarLista(); };
    });
    pintarCuenta();
  }

  function elegidos() { return orden.filter((id) => marcado.has(id)).map((id) => porId.get(id)); }

  function pintarCuenta() {
    const e = elegidos();
    const hielo = e.reduce((n, p) => n + p.dieciseisavos, 0);
    const total = e.reduce((n, p) => n + p.total, 0);
    const cabenMarquetas = Number(selVeh.selectedOptions[0]?.dataset.cabe || 0);
    const cabe = !cabenMarquetas || hielo <= cabenMarquetas * 16;
    cuenta.className = `armar-cuenta ${cabe ? '' : 'no-cabe'}`;
    cuenta.innerHTML = `
      <div><small>Pedidos</small><strong>${e.length}</strong></div>
      <div><small>Hielo que sube</small><strong>${esc(aTexto(hielo))}</strong>
        ${cabenMarquetas ? `<small>le caben ${cabenMarquetas}</small>` : ''}</div>
      <div><small>Vale</small><strong>${pesos(total)}</strong></div>
      ${cabe ? '' : `<p class="rep-mal">No le cabe: se pasa por ${esc(aTexto(hielo - cabenMarquetas * 16))}.
        Quita pedidos, cambia de vehículo, o se fuerza y son dos viajes.</p>`}`;
  }

  selVeh.onchange = pintarCuenta;
  pintarLista();

  caja.querySelector('[data-no]').onclick = () => dlg.salir(null);
  caja.querySelector('[data-si]').onclick = async () => {
    const e = elegidos();
    if (!e.length) return avisar('Marca al menos un pedido', 'error');
    if (!selQuien.value) return avisar('Elige quién se la lleva', 'error');
    const cuerpo = {
      repartidorId: selQuien.value, vehiculoId: selVeh.value || null,
      pedidoIds: e.map((p) => p.id)
    };
    try {
      const r = await api.enviar('/reparto/armar', cuerpo);
      avisar(`Salida #${r.salida.folio} armada con ${e.length} pedido${e.length === 1 ? '' : 's'}`, 'bien');
      dlg.salir(r.salida);
    } catch (err) {
      if (err.noCabe) {
        const si = await confirmar({
          titulo: 'No le cabe',
          texto: `${err.message} ¿Se arma de todos modos?`,
          ok: 'Sí, son dos viajes', peligro: true
        });
        if (!si) return;
        try {
          const r = await api.enviar('/reparto/armar', { ...cuerpo, forzar: true });
          avisar(`Salida #${r.salida.folio} armada (forzada: no cabe de un viaje)`, 'bien');
          dlg.salir(r.salida);
        } catch (e2) { avisar(e2.message, 'error'); }
        return;
      }
      avisar(err.message, 'error');
    }
  };

  return dlg.hecho;
}

function distancia(m) {
  if (m == null) return '';
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}
