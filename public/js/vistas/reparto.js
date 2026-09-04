/**
 * EL REPARTO  (v5.7)
 *
 * ============================================================
 * TRES MOMENTOS, TRES CARAS DE LA MISMA PANTALLA
 * ============================================================
 *
 *   ARMARLA   se elige quién y en qué, se le cuelgan los pedidos del día
 *             y se le sube lo suelto. Sale su hoja de carga.
 *   EN LA CALLE  no hay nada que hacer más que esperar.
 *   CUADRARLA  volvió: qué llegó, qué se vendió, qué volvió. La merma
 *             sale sola y el dinero también.
 *
 * La pantalla enseña la salida en el momento en el que está, y no un
 * formulario con todo a la vez: en el patio, con el camión abierto, lo que
 * estorba es lo que no toca ahora.
 *
 * ============================================================
 * LO QUE NO ESTÁ AQUÍ
 * ============================================================
 *
 * RECIBIR EL DINERO. Eso vive en Vender, porque cuando el repartidor
 * vuelve, a quien se lo entrega es a quien esté en la caja — y quien está
 * en la caja no se va a salir de su pantalla con gente enfrente.
 */
import { api } from '../api.js';
import { esc, avisar, fechaCorta } from '../util.js';
import { confirmar, pedirTexto, pedirEntero, menu, verTicket, armarDialogo } from '../dialogo.js';
import { pesos, aTexto, crearTeclado } from '../fracciones.js';
import { imprimirTicket, htmlDeEspejo } from '../imprimir.js';

const FORMAS = {
  efectivo: { texto: 'Efectivo', emoji: '💵' },
  transferencia: { texto: 'Transferencia', emoji: '📲' },
  credito: { texto: 'A crédito', emoji: '📗' }
};

export async function vistaReparto(pantalla, estado) {
  const puede = (p) => estado.permisos.includes('*') || estado.permisos.includes(p);
  const opera = puede('reparto.operar');
  const cuadra = puede('reparto.cuadrar');
  const administraVehiculos = puede('vehiculos.administrar');

  let d = null;
  let abierta = null;        // la salida que se está mirando por dentro
  let verTodas = false;

  await pintar();

  async function cargar() {
    d = await api.obtener(`/reparto?estado=${verTodas ? 'todas' : 'abiertas'}`);
    if (abierta) {
      abierta = (await api.obtener(`/reparto/${abierta.id}`)).salida;
    }
  }

  async function pintar() {
    pantalla.innerHTML = '<div class="cargando">Mirando el reparto…</div>';
    try { await cargar(); } catch (e) {
      pantalla.innerHTML = `<p class="vacio">${esc(e.message)}</p>`;
      return;
    }
    if (abierta) return pintarFicha();

    pantalla.innerHTML = `
      <div class="cabecera-pantalla">
        <h2>El reparto</h2>
        <p class="ayuda">
          Lo que sale, lo que anda en la calle y lo que hay que cuadrar.
          ${opera ? '<button class="secundario chico" id="nueva">+ Salida</button>' : ''}
          ${administraVehiculos
            ? '<button class="secundario chico" id="vehiculos">🚚 Vehículos</button>' : ''}
        </p>
      </div>

      <div class="ped-acciones">
        <label class="rep-todas">
          <input type="checkbox" id="todas" ${verTodas ? 'checked' : ''}>
          Ver también las ya liquidadas
        </label>
      </div>

      ${d.salidas.length
        ? `<div class="rep-tarjetas">${d.salidas.map(tarjeta).join('')}</div>`
        : `<p class="vacio">
             ${verTodas ? 'Todavía no ha salido ninguna camioneta.'
                        : 'No hay ninguna salida abierta.'}
           </p>`}`;

    const nueva = pantalla.querySelector('#nueva');
    if (nueva) nueva.onclick = nuevaSalida;
    const veh = pantalla.querySelector('#vehiculos');
    if (veh) veh.onclick = verVehiculos;
    pantalla.querySelector('#todas').onchange = (ev) => {
      verTodas = ev.target.checked; pintar();
    };
    pantalla.querySelectorAll('[data-abrir]').forEach((b) => {
      b.onclick = async () => {
        abierta = (await api.obtener(`/reparto/${b.dataset.abrir}`)).salida;
        pintarFicha();
      };
    });
  }

  function tarjeta(s) {
    const e = s.estadoTexto;
    return `
      <button class="tarjeta rep-tarjeta rep-${s.estado}" data-abrir="${s.id}">
        <div class="rep-cabeza">
          <span class="rep-folio">#${s.folio}</span>
          <span class="crece">
            <strong>${esc(s.repartidor_nombre || '—')}</strong>
            ${s.vehiculo_nombre ? `<small>${esc(s.vehiculo_nombre)}</small>` : ''}
          </span>
          <span class="etiqueta rep-estado">${e.emoji} ${esc(e.texto)}</span>
        </div>
        <div class="rep-numeros">
          <span><b>${s.pedidos.length}</b> pedido${s.pedidos.length === 1 ? '' : 's'}</span>
          ${s.hielo.subio ? `<span><b>${esc(s.hielo.textos.subio)}</b> de hielo</span>` : ''}
          <span><b>${pesos(s.total)}</b></span>
          ${s.dinero.diferencia !== null && s.dinero.diferencia !== 0
            ? `<span class="rep-mal">${s.dinero.diferencia < 0 ? 'falta' : 'sobra'}
                 ${pesos(Math.abs(s.dinero.diferencia))}</span>`
            : ''}
        </div>
        <small class="rep-fecha">${esc(fechaCorta(s.fecha))}</small>
      </button>`;
  }

  // ==========================================================
  // LA FICHA DE UNA SALIDA
  // ==========================================================
  function pintarFicha() {
    const s = abierta;
    const e = s.estadoTexto;

    pantalla.innerHTML = `
      <div class="cabecera-pantalla">
        <button class="secundario chico" id="volver">← Todas las salidas</button>
        <h2>Salida #${s.folio} · ${esc(s.repartidor_nombre || '—')}</h2>
        <p class="ayuda">
          ${e.emoji} <b>${esc(e.texto)}</b> — ${esc(e.ayuda)}.
          ${s.vehiculo_nombre ? ` En ${esc(s.vehiculo_nombre)}.` : ''}
        </p>
      </div>

      ${s.estado === 'cargando' ? panelCargando(s) : ''}
      ${s.estado === 'en_ruta' ? panelEnRuta(s) : ''}
      ${s.estado === 'regreso' || s.estado === 'liquidada' ? panelCuadre(s) : ''}
      ${s.estado === 'cancelada'
        ? `<p class="vacio">Se canceló: ${esc(s.motivo_cancelacion || '')}</p>` : ''}`;

    pantalla.querySelector('#volver').onclick = () => { abierta = null; pintar(); };
    conectarFicha(s);
  }

  // ---- ARMÁNDOLA ----
  function panelCargando(s) {
    return `
      <section class="tarjeta">
        <h3>Los pedidos que lleva</h3>
        ${s.pedidos.length
          ? `<ul class="rep-lista">
              ${s.pedidos.map((p) => `
                <li>
                  <span class="crece">
                    <strong>#${p.folio} ${esc(p.cliente_nombre || '—')}</strong>
                    <small>${p.lineas.map((l) => `${esc(l.texto)} ${esc(l.concepto)}`).join(' · ')}</small>
                  </span>
                  <span class="rep-precio">${pesos(p.total)}</span>
                  ${opera ? `<button class="secundario chico" data-quita-pedido="${p.id}">✖️</button>` : ''}
                </li>`).join('')}
             </ul>`
          : '<p class="ayuda">Todavía no lleva ninguno.</p>'}
        ${opera ? '<button class="secundario chico" id="colgar">+ Colgarle pedidos</button>' : ''}
      </section>

      <section class="tarjeta">
        <h3>Lo suelto <small class="ayuda">para vender en la calle</small></h3>
        ${s.carga.length
          ? `<ul class="rep-lista">
              ${s.carga.map((l) => `
                <li>
                  <span class="ped-cuanto">${esc(l.texto)}</span>
                  <span class="crece">${esc(l.concepto)}</span>
                  <span class="rep-precio">${pesos(l.precio_centavos)}</span>
                  ${opera ? `<button class="secundario chico" data-quita-carga="${l.id}">✖️</button>` : ''}
                </li>`).join('')}
             </ul>`
          : '<p class="ayuda">Nada suelto. Se puede salir así: son los pedidos y ya.</p>'}
        ${opera ? `
          <div class="fila-botones">
            <button class="secundario chico" id="subir-hielo">🧊 Subir hielo</button>
            <button class="secundario chico" id="subir-producto">📦 Subir producto</button>
          </div>` : ''}
      </section>

      ${resumenCarga(s)}

      ${opera ? `
        <div class="rep-acciones">
          <button id="salir">🚚 Que salga</button>
          <button class="secundario" id="imprimir-carga">🖨️ Hoja de carga</button>
          <button class="secundario chico peligro" id="cancelar">Cancelar la salida</button>
        </div>` : ''}`;
  }

  function resumenCarga(s) {
    if (!s.hielo.subio && !s.carga.length) return '';
    return `
      <section class="tarjeta rep-resumen ${s.cabe ? '' : 'no-cabe'}">
        <div>
          <small>Hielo que sube</small>
          <strong>${esc(s.hielo.textos.subio)}</strong>
          ${s.capacidad_marquetas
            ? `<small>le caben ${s.capacidad_marquetas}</small>` : ''}
        </div>
        <div>
          <small>Vale</small>
          <strong>${pesos(s.total)}</strong>
        </div>
        ${!s.cabe
          ? `<p class="rep-mal">
               No le cabe: sobrecargar la camioneta es que el hielo llegue derretido.
             </p>` : ''}
      </section>`;
  }

  // ---- EN LA CALLE ----
  function panelEnRuta(s) {
    return `
      ${resumenCarga(s)}
      <section class="tarjeta">
        <h3>Va cargada con</h3>
        <ul class="rep-lista">
          ${s.pedidos.map((p) => `
            <li><span class="crece">#${p.folio} ${esc(p.cliente_nombre || '—')}</span>
                <span class="rep-precio">${pesos(p.total)}</span></li>`).join('')}
          ${s.carga.map((l) => `
            <li><span class="ped-cuanto">${esc(l.texto)}</span>
                <span class="crece">${esc(l.concepto)} <small>(suelto)</small></span></li>`).join('')}
        </ul>
      </section>
      ${opera ? `
        <div class="rep-acciones">
          <button id="regreso">🏠 Ya regresó</button>
          <button class="secundario" id="imprimir-carga">🖨️ Hoja de carga</button>
        </div>` : ''}`;
  }

  // ---- CUADRÁNDOLA ----
  function panelCuadre(s) {
    const cerrada = s.estado === 'liquidada';
    const editable = opera && !cerrada && !s.recibido_en;

    return `
      <section class="tarjeta">
        <h3>Qué pasó con cada pedido</h3>
        ${s.pedidos.length ? `
          <ul class="rep-lista rep-cuadre">
            ${s.pedidos.map((p) => `
              <li class="${p.estado === 'entregado' ? 'ok' : p.noEntregadoMotivo ? 'no' : 'falta'}">
                <span class="crece">
                  <strong>#${p.folio} ${esc(p.cliente_nombre || '—')}</strong>
                  <small>
                    ${p.estado === 'entregado'
                      ? `✅ entregado · ${esc((FORMAS[p.forma_pago] || {}).texto || p.forma_pago)}`
                      : p.noEntregadoMotivo
                        ? `↩️ volvió · ${esc(p.noEntregadoMotivo)}`
                        : '⏳ falta decir qué pasó'}
                  </small>
                </span>
                <span class="rep-precio">${pesos(p.total)}</span>
                ${editable && p.estado !== 'entregado' ? `
                  <span class="rep-botones">
                    <button class="chico" data-entrego="${p.id}">✅</button>
                    <button class="secundario chico" data-no-entrego="${p.id}">↩️</button>
                  </span>` : ''}
              </li>`).join('')}
          </ul>` : '<p class="ayuda">No llevaba pedidos.</p>'}
      </section>

      ${s.carga.length ? `
        <section class="tarjeta">
          <h3>Lo suelto: cuánto volvió</h3>
          <p class="ayuda">
            Se cuenta lo que se puede contar. La merma sale sola de la resta —
            nadie la teclea.
          </p>
          <ul class="rep-lista rep-cuadre">
            ${s.carga.map((l) => `
              <li class="${l.capturado ? 'ok' : 'falta'}">
                <span class="crece">
                  <strong>${esc(l.texto)} ${esc(l.concepto)}</strong>
                  <small>
                    ${l.capturado
                      ? `vendió ${esc(l.dieciseisavos > 0 ? aTexto(l.vendidoDieciseisavos) : String(l.vendidoCantidad))}`
                        + ` · volvió ${esc(l.dieciseisavos > 0 ? aTexto(l.regresoDieciseisavos) : String(l.regresoCantidad))}`
                        + (l.mermaDieciseisavos || l.mermaCantidad
                            ? ` · <b class="rep-mal">merma ${esc(l.dieciseisavos > 0 ? aTexto(l.mermaDieciseisavos) : String(l.mermaCantidad))}</b>`
                            : '')
                      : 'falta contarlo'}
                  </small>
                </span>
                ${editable
                  ? `<button class="secundario chico" data-contar="${l.id}">Contar</button>` : ''}
              </li>`).join('')}
          </ul>
        </section>` : ''}

      ${s.hielo.suelto > 0 ? `
        <section class="tarjeta rep-resumen ${s.hielo.mermaAlta ? 'no-cabe' : ''}">
          <div><small>Subió suelto</small><strong>${esc(s.hielo.textos.suelto)}</strong></div>
          <div><small>Se derritió</small><strong>${esc(s.hielo.textos.merma)}</strong></div>
          <div><small>Que es</small><strong>${s.hielo.porcientoMerma}%</strong>
            <small>lo normal es ${s.hielo.mermaNormal}%</small></div>
        </section>` : ''}

      <section class="tarjeta rep-dinero">
        <h3>El dinero</h3>
        <div class="cuadre">
          ${s.dinero.pedidosEfectivo ? `
            <div class="cuadre-linea suma">
              <span>Pedidos de contado</span><strong>${pesos(s.dinero.pedidosEfectivo)}</strong>
            </div>` : ''}
          ${s.dinero.suelto ? `
            <div class="cuadre-linea suma">
              <span>Vendido suelto</span><strong>${pesos(s.dinero.suelto)}</strong>
            </div>` : ''}
          <div class="cuadre-linea total">
            <span>Debe traer en efectivo</span>
            <strong>${pesos(s.dinero.esperadoAlRecibir ?? s.dinero.esperado)}</strong>
          </div>
          ${s.dinero.recibido !== null ? `
            <div class="cuadre-linea vendido">
              <span>Entregó</span><strong>${pesos(s.dinero.recibido)}</strong>
            </div>
            <div class="cuadre-linea total">
              <span>${s.dinero.diferencia === 0 ? 'Cuadró'
                       : s.dinero.diferencia < 0 ? 'Falta' : 'Sobra'}</span>
              <strong class="${s.dinero.diferencia === 0 ? '' : 'malo'}">
                ${s.dinero.diferencia === 0 ? '$0' : pesos(Math.abs(s.dinero.diferencia))}
              </strong>
            </div>` : ''}
        </div>

        ${s.dinero.credito || s.dinero.transferencia ? `
          <p class="ayuda">
            No viene en su bolsa:
            ${s.dinero.credito ? `${pesos(s.dinero.credito)} a crédito` : ''}
            ${s.dinero.credito && s.dinero.transferencia ? ' · ' : ''}
            ${s.dinero.transferencia ? `${pesos(s.dinero.transferencia)} por transferencia` : ''}.
          </p>` : ''}

        ${!s.recibido_en ? `
          <p class="ayuda rep-donde">
            💵 <b>El dinero se recibe en Vender</b>, que es donde está quien lo
            va a contar. Ahí sale sola esta salida.
          </p>` : `
          <p class="ayuda">
            Recibió ${esc(s.recibido_por_nombre || '—')} · ${esc(fechaCorta(s.recibido_en))}
          </p>`}

        ${s.motivo_diferencia
          ? `<p class="ayuda">Se cerró diciendo: «${esc(s.motivo_diferencia)}»</p>` : ''}
      </section>

      <div class="rep-acciones">
        <button class="secundario" id="ver-liquidacion">👁️ La liquidación</button>
        <button class="secundario" id="imprimir-liquidacion">🖨️ Imprimir</button>
        ${cuadra && !cerrada && s.recibido_en
          ? `<button id="cerrar">✅ Cerrar la salida</button>` : ''}
      </div>`;
  }

  // ==========================================================
  // LO QUE HACEN LOS BOTONES
  // ==========================================================
  function conectarFicha(s) {
    const q = (sel) => pantalla.querySelector(sel);
    const cada = (sel, fn) => pantalla.querySelectorAll(sel).forEach(fn);

    q('#colgar') && (q('#colgar').onclick = () => colgarPedidos(s));
    q('#subir-hielo') && (q('#subir-hielo').onclick = () => subirHielo(s));
    q('#subir-producto') && (q('#subir-producto').onclick = () => subirProducto(s));
    q('#salir') && (q('#salir').onclick = () => queSalga(s));
    q('#regreso') && (q('#regreso').onclick = () => yaRegreso(s));
    q('#cancelar') && (q('#cancelar').onclick = () => cancelar(s));
    q('#cerrar') && (q('#cerrar').onclick = () => cerrar(s));

    q('#imprimir-carga') && (q('#imprimir-carga').onclick =
      () => imprimir(`/impresion/carga/${s.id}`, 'Hoja de carga'));
    q('#imprimir-liquidacion') && (q('#imprimir-liquidacion').onclick =
      () => imprimir(`/impresion/liquidacion/${s.id}`, 'Liquidación'));
    q('#ver-liquidacion') && (q('#ver-liquidacion').onclick =
      () => verPapel(`/impresion/liquidacion/${s.id}/previa`, 'Liquidación'));

    cada('[data-quita-pedido]', (b) => {
      b.onclick = async () => {
        await api.borrar(`/reparto/${s.id}/pedidos/${b.dataset.quitaPedido}`);
        recargar();
      };
    });
    cada('[data-quita-carga]', (b) => {
      b.onclick = async () => {
        await api.borrar(`/reparto/${s.id}/carga/${b.dataset.quitaCarga}`);
        recargar();
      };
    });
    cada('[data-entrego]', (b) => { b.onclick = () => entregado(s, b.dataset.entrego); });
    cada('[data-no-entrego]', (b) => { b.onclick = () => noEntregado(s, b.dataset.noEntrego); });
    cada('[data-contar]', (b) => { b.onclick = () => contar(s, b.dataset.contar); });
  }

  async function recargar() {
    abierta = (await api.obtener(`/reparto/${abierta.id}`)).salida;
    pintarFicha();
  }

  async function nuevaSalida() {
    if (!d.repartidores.length) {
      return avisar('Nadie puede llevarse la camioneta: da de alta un repartidor primero', 'error');
    }
    const quien = await menu({
      titulo: '¿Quién se la lleva?',
      opciones: d.repartidores.map((r) => ({ valor: r.id, texto: r.nombre, detalle: r.rol }))
    });
    if (!quien) return;

    let vehiculoId = null;
    if (d.vehiculos.length) {
      const cual = await menu({
        titulo: '¿En qué se la lleva?',
        opciones: [
          ...d.vehiculos.map((v) => ({
            valor: v.id, texto: v.nombre,
            detalle: v.capacidad_marquetas ? `le caben ${v.capacidad_marquetas} marquetas` : ''
          })),
          { valor: 'ninguno', texto: 'Sin vehículo', detalle: 'A pie, o en lo que haya' }
        ]
      });
      if (!cual) return;
      if (cual !== 'ninguno') vehiculoId = cual;
    }

    try {
      const r = await api.enviar('/reparto', { repartidorId: quien, vehiculoId });
      abierta = r.salida;
      avisar(`Salida #${r.salida.folio} abierta. Cuélgale sus pedidos.`, 'bien');
      pintarFicha();
    } catch (e) { avisar(e.message, 'error'); }
  }

  /**
   * Los pendientes que todavía no van en ninguna camioneta. Se eligen de
   * una lista con casillas y se cuelgan todos de un botón: colgarlos de
   * uno en uno con ocho pedidos es ocho veces el mismo diálogo.
   */
  async function colgarPedidos(s) {
    let pendientes;
    try {
      pendientes = (await api.obtener('/pedidos?estado=pendiente')).pedidos;
    } catch (e) { return avisar(e.message, 'error'); }

    const yaVan = new Set(s.pedidos.map((p) => p.id));
    const libres = pendientes.filter((p) => !yaVan.has(p.id));
    if (!libres.length) {
      return avisar('No hay pedidos pendientes que colgarle', '');
    }

    const elegidos = await elegirPedidos(libres);
    if (!elegidos?.length) return;

    let fallaron = 0;
    for (const id of elegidos) {
      try { await api.enviar(`/reparto/${s.id}/pedidos`, { pedidoId: id }); }
      catch { fallaron++; }
    }
    if (fallaron) avisar(`${fallaron} no se pudieron colgar (¿ya van en otra salida?)`, 'error');
    recargar();
  }

  /** Una lista con casillas: se marcan los que suben y se cuelgan de un golpe. */
  function elegirPedidos(lista) {
    // Con `armarDialogo` (v5.7.1): Esc y el fondo lo cierran solos.
    const d = armarDialogo(`
          <h3 class="dialogo-titulo">¿Cuáles suben?</h3>
          <div class="rep-elegir">
            ${lista.map((p) => `
              <label class="rep-elegir-fila">
                <input type="checkbox" value="${p.id}" checked>
                <span class="crece">
                  <strong>#${p.folio} ${esc(p.cliente_nombre || '—')}</strong>
                  <small>${p.lineas.map((l) => `${esc(l.texto)} ${esc(l.concepto)}`).join(' · ')}</small>
                </span>
                <span class="rep-precio">${pesos(p.total)}</span>
              </label>`).join('')}
          </div>
          <div class="dialogo-botones">
            <button class="secundario" data-no>Cancelar</button>
            <button data-si>Colgarlos</button>
          </div>`);
    d.caja.querySelector('[data-no]').onclick = () => d.salir(null);
    d.caja.querySelector('[data-si]').onclick = () => d.salir(
      [...d.caja.querySelectorAll('input:checked')].map((i) => i.value));
    return d.hecho;
  }

  async function subirHielo(s) {
    const cuanto = await pedirHielo('¿Cuánto hielo suelto sube?');
    if (!cuanto) return;
    try {
      await api.enviar(`/reparto/${s.id}/carga`, { dieciseisavos: cuanto });
      recargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  /** El teclado de fracciones de siempre, en un diálogo. */
  function pedirHielo(titulo, max = null) {
    const d = armarDialogo(`
          <h3 class="dialogo-titulo">${esc(titulo)}</h3>
          <div id="teclado"></div>
          <div class="dialogo-botones">
            <button class="secundario" data-no>Cancelar</button>
            <button data-si>Subirlo</button>
          </div>`);
    // Con tope cuando lo hay: no se puede vender ni devolver más de lo
    // que subió, y frenarlo aquí es mejor que un error después.
    const teclado = crearTeclado(d.caja.querySelector('#teclado'), max ? { max } : {});
    d.caja.querySelector('[data-no]').onclick = () => d.salir(null);
    // CERO ES UNA RESPUESTA, no un "no contestó": «no vendí nada» y «no
    // volvió nada» son las dos cosas que más se contestan al cuadrar.
    // `null` es solo cancelar.
    d.caja.querySelector('[data-si]').onclick = () => d.salir(teclado.valor());
    return d.hecho;
  }

  async function subirProducto(s) {
    let catalogo;
    try { catalogo = await api.obtener('/catalogo'); }
    catch (e) { return avisar(e.message, 'error'); }

    // Sin el mayoreo: eso va como pedido, con su cliente. Y sin el hielo de
    // botón, que ya tiene su propio camino con el teclado de fracciones.
    const vendibles = catalogo.productos.filter(
      (p) => p.activo && !p.mayoreo && p.tipo !== 'hielo');
    if (!vendibles.length) return avisar('No hay productos que subir', '');

    const cual = await menu({
      titulo: '¿Qué sube?',
      opciones: vendibles.slice(0, 30).map((p) => ({
        valor: p.id, texto: p.nombre, detalle: pesos(p.precio_centavos)
      }))
    });
    if (!cual) return;

    const cuantos = await pedirEntero({
      titulo: '¿Cuántos?', marcador: '10', ok: 'Subirlos', maximo: 500
    });
    if (!cuantos) return;

    try {
      await api.enviar(`/reparto/${s.id}/carga`, { productoId: cual, cantidad: Number(cuantos) });
      recargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function queSalga(s) {
    if (!s.cabe && !await confirmar({
      titulo: 'No le cabe',
      texto: `Van ${aTexto(s.hielo.subio)} y a ${s.vehiculo_nombre} le caben `
           + `${s.capacidad_marquetas}. Sobrecargarla es que el hielo llegue derretido.`,
      ok: 'Sacarla igual', peligro: true
    })) return;

    try {
      await api.enviar(`/reparto/${s.id}/salir`, {});
      avisar('Salió. Al volver se cuadra desde aquí.', 'bien');
      // La hoja de carga sale sola: es el papel que se le da a quien sube
      // la mercancía, y pedirla en otro toque es que un día no salga.
      try { await api.enviar(`/impresion/carga/${s.id}`, {}); } catch { /* sin térmica */ }
      recargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function yaRegreso(s) {
    try {
      await api.enviar(`/reparto/${s.id}/regreso`, {});
      recargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function entregado(s, pedidoId) {
    const p = s.pedidos.find((x) => x.id === pedidoId);
    const forma = await menu({
      titulo: `#${p.folio} · ${pesos(p.total)}`,
      texto: `${p.cliente_nombre}. ¿Cómo pagó?`,
      opciones: Object.entries(FORMAS).map(([valor, f]) => ({
        valor, texto: `${f.emoji} ${f.texto}`
      }))
    });
    if (!forma) return;

    try {
      const r = await api.enviar(`/reparto/${s.id}/pedidos/${pedidoId}/entregado`,
                                 { formaPago: forma });
      if (r.avisoCredito) avisar(r.avisoCredito, 'error');
      recargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function noEntregado(s, pedidoId) {
    const motivo = await pedirTexto({
      titulo: '¿Por qué no se entregó?',
      texto: 'Es lo que se le dice al cliente cuando llame a preguntar.',
      marcador: 'Estaba cerrado, no tenían el dinero…', largo: 200
    });
    if (!motivo) return;
    try {
      await api.enviar(`/reparto/${s.id}/pedidos/${pedidoId}/no-entregado`, { motivo });
      recargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function contar(s, lineaId) {
    const l = s.carga.find((x) => x.id === lineaId);
    if (!l) return;

    if (l.dieciseisavos > 0) {
      const vendido = await pedirHielo(
        `De ${aTexto(l.dieciseisavos)}, ¿cuánto vendió?`, l.dieciseisavos);
      if (vendido === null) return;
      const volvio = await pedirHielo('¿Y cuánto volvió?', l.dieciseisavos - (vendido || 0));
      if (volvio === null) return;
      try {
        await api.enviar(`/reparto/${s.id}/carga/${lineaId}/regreso`, {
          vendidoDieciseisavos: vendido || 0, regresoDieciseisavos: volvio || 0
        });
        recargar();
      } catch (e) { avisar(e.message, 'error'); }
      return;
    }

    const vendido = await pedirEntero({
      titulo: `De ${l.cantidad} ${l.concepto}, ¿cuántos vendió?`,
      marcador: '0', ok: 'Siguiente', maximo: l.cantidad, opcional: true
    });
    if (vendido === null) return;
    const volvio = await pedirEntero({
      titulo: '¿Y cuántos volvieron?', marcador: '0', ok: 'Guardar',
      maximo: l.cantidad, opcional: true
    });
    if (volvio === null) return;

    try {
      await api.enviar(`/reparto/${s.id}/carga/${lineaId}/regreso`, {
        vendidoCantidad: Number(vendido) || 0, regresoCantidad: Number(volvio) || 0
      });
      recargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function cerrar(s) {
    const dif = s.dinero.diferencia;
    let motivo = null;
    if (dif !== 0) {
      motivo = await pedirTexto({
        titulo: `${dif < 0 ? 'Faltan' : 'Sobran'} ${pesos(Math.abs(dif))}`,
        texto: 'Escribe qué pasó. Queda guardado con la salida y sale en su papel.',
        marcador: 'Se le descuenta de su raya, se le cayó un billete…', largo: 300
      });
      if (!motivo) return;
    } else if (!await confirmar({
      titulo: `¿Cerrar la salida #${s.folio}?`,
      texto: 'Cuadró. Se carga la merma al cuarto frío y ya no se toca.',
      ok: 'Cerrarla'
    })) return;

    try {
      await api.enviar(`/reparto/${s.id}/cerrar`, { motivo });
      avisar('Salida liquidada', 'bien');
      recargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function cancelar(s) {
    const motivo = await pedirTexto({
      titulo: `¿Cancelar la salida #${s.folio}?`,
      texto: 'Sus pedidos vuelven a la lista de pendientes.',
      marcador: 'Se descompuso la camioneta…', largo: 200
    });
    if (!motivo) return;
    try {
      await api.enviar(`/reparto/${s.id}/cancelar`, { motivo });
      abierta = null;
      avisar('Salida cancelada', 'bien');
      pintar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  // ==========================================================
  // LOS PAPELES
  // ==========================================================
  async function imprimir(ruta, titulo) {
    try {
      const r = await api.enviar(ruta, {});
      if (r.impreso) return avisar(`${titulo} impresa`, 'bien');
      await verPapel(`${ruta}/previa`, titulo);
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function verPapel(ruta, titulo) {
    try {
      const previa = await api.obtener(ruta);
      const que = await verTicket({
        titulo, renglones: previa.renglones, ancho: previa.ancho,
        acciones: [{ valor: 'imprimir', texto: '🖨️ Imprimir' }]
      });
      if (que === 'imprimir') imprimirTicket(htmlDeEspejo(previa.renglones, previa.ancho));
    } catch (e) { avisar(e.message, 'error'); }
  }

  // ==========================================================
  // LOS VEHÍCULOS
  // ==========================================================
  async function verVehiculos() {
    const { vehiculos } = await api.obtener('/reparto/vehiculos?baja=1');
    const que = await menu({
      titulo: 'Los vehículos',
      texto: 'Se dan de alta una vez y se usan años.',
      opciones: [
        ...vehiculos.map((v) => ({
          valor: v.id,
          texto: `${v.activo ? '' : '(de baja) '}${v.nombre}`,
          detalle: [v.placas, v.capacidad_marquetas ? `${v.capacidad_marquetas} marquetas` : '',
                    `${v.viajes} viaje${v.viajes === 1 ? '' : 's'}`].filter(Boolean).join(' · ')
        })),
        { valor: 'nuevo', texto: '+ Vehículo nuevo' }
      ]
    });
    if (!que) return;
    if (que === 'nuevo') return nuevoVehiculo();

    const v = vehiculos.find((x) => x.id === que);
    const accion = await menu({
      titulo: v.nombre,
      opciones: [
        { valor: 'capacidad', texto: 'Cambiar cuántas marquetas le caben' },
        v.activo
          ? { valor: 'baja', texto: 'Dar de baja', detalle: 'Sus viajes se quedan', peligro: true }
          : { valor: 'alta', texto: 'Volver a darlo de alta' }
      ]
    });
    if (!accion) return;

    try {
      if (accion === 'capacidad') {
        const cap = await pedirEntero({
          titulo: '¿Cuántas marquetas le caben?',
          texto: 'Sirve para avisar cuando la carga se pasa.',
          valor: v.capacidad_marquetas ?? '', marcador: '40', maximo: 5000, opcional: true
        });
        if (cap === null) return;
        await api.actualizar(`/reparto/vehiculos/${v.id}`, { capacidad: cap });
      } else {
        await api.actualizar(`/reparto/vehiculos/${v.id}`, { activo: accion === 'alta' });
      }
      avisar('Guardado', 'bien');
      pintar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function nuevoVehiculo() {
    const nombre = await pedirTexto({
      titulo: 'Vehículo nuevo',
      texto: 'Como se le dice: «La camioneta blanca».',
      marcador: 'La camioneta blanca', largo: 60, unaLinea: true
    });
    if (!nombre) return;

    const tipo = await menu({
      titulo: '¿Qué es?',
      opciones: [
        { valor: 'camioneta', texto: '🚚 Camioneta' },
        { valor: 'moto', texto: '🏍️ Moto' },
        { valor: 'triciclo', texto: '🚲 Triciclo' },
        { valor: 'otro', texto: 'Otra cosa' }
      ]
    });
    if (!tipo) return;

    const cap = await pedirEntero({
      titulo: '¿Cuántas marquetas le caben?',
      texto: 'Se puede dejar vacío. Sirve para avisar cuando la carga se pasa.',
      marcador: '40', ok: 'Darlo de alta', maximo: 5000, opcional: true
    });
    if (cap === null) return;

    try {
      await api.enviar('/reparto/vehiculos', { nombre, tipo, capacidad: cap });
      avisar('Vehículo dado de alta', 'bien');
      pintar();
    } catch (e) { avisar(e.message, 'error'); }
  }
}
