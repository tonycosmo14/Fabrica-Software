/**
 * LOS PEDIDOS  (v5.6)
 *
 * ============================================================
 * LA MISMA LISTA, MIRADA DESDE DOS SITIOS DEL TRABAJO
 * ============================================================
 *
 * "Los pedidos necesito verlos de dos formas: una, al momento de
 *  prepararlos, o sea saber cuántos botellones voy a llenar y cuántas
 *  bolsas voy a subir. Y otra, imprimir las notas de cada uno para que el
 *  repartidor sepa cuánto le toca a cada quien y cuánto le va a cobrar."
 *
 * Así que la pantalla tiene dos pestañas y no una lista con filtros:
 *
 *   PARA PREPARAR — todo sumado por producto, partido por área. Se lee en
 *   la planta y a nadie le importa ahí de quién es cada cosa.
 *
 *   LOS PEDIDOS   — uno por uno, con su cliente, su dirección y su nota.
 *   Es lo que va en la mano del repartidor.
 *
 * ============================================================
 * DÓNDE SE TOMAN
 * ============================================================
 *
 * En VENDER, no aquí. Un pedido se arma igual que un ticket —los mismos
 * botones, los mismos precios, el mismo teclado de fracciones— y lo único
 * distinto es que en vez de cobrarlo se aparta. Copiar esa pantalla aquí
 * sería mantener dos puntos de venta que tienen que dar el mismo precio, y
 * el día que se separen nadie sabrá cuál miente.
 */
import { api } from '../api.js';
import { esc, avisar } from '../util.js';
import { confirmar, pedirTexto, menu, verTicket } from '../dialogo.js';
import { pesos } from '../fracciones.js';
import { imprimirTicket, htmlDeEspejo } from '../imprimir.js';

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

export async function vistaPedidos(pantalla, estado) {
  const puede = (p) => estado.permisos.includes('*') || estado.permisos.includes(p);
  let pestana = 'preparar';
  let hasta = hoy();
  let datos = null;
  let prep = null;

  await pintar();

  async function cargar() {
    const [lista, preparacion] = await Promise.all([
      api.obtener(`/pedidos?estado=pendiente&hasta=${hasta}`),
      api.obtener(`/pedidos/preparacion?hasta=${hasta}`)
    ]);
    datos = lista;
    prep = preparacion.preparacion;
  }

  async function pintar() {
    pantalla.innerHTML = '<div class="cargando">Buscando los pedidos…</div>';
    try { await cargar(); } catch (e) {
      pantalla.innerHTML = `<p class="vacio">${esc(e.message)}</p>`;
      return;
    }

    pantalla.innerHTML = `
      <div class="cabecera-pantalla">
        <h2>Los pedidos</h2>
        <p class="ayuda">
          Lo que hay que preparar y lo que hay que entregar.
          Se toman desde <b>Vender</b>: arma el ticket, elige al cliente y toca
          «Pedido».
        </p>
      </div>

      <div class="ped-pestanas">
        <button class="ped-pestana ${pestana === 'preparar' ? 'activa' : ''}" data-p="preparar">
          <span class="emoji">🧾</span>
          <strong>Para preparar</strong>
          <small>${prep.pedidos} pedido${prep.pedidos === 1 ? '' : 's'}</small>
        </button>
        <button class="ped-pestana ${pestana === 'lista' ? 'activa' : ''}" data-p="lista">
          <span class="emoji">🚚</span>
          <strong>Las notas de entrega</strong>
          <small>${prep.clientes} cliente${prep.clientes === 1 ? '' : 's'}</small>
        </button>
      </div>

      <div class="ped-dia">
        <label>Hasta el día
          <input type="date" id="hasta" value="${hasta}">
        </label>
        <span class="ayuda">
          Se incluye lo atrasado: un pedido de ayer que no salió sigue debiéndose.
        </span>
      </div>

      ${pestana === 'preparar' ? vistaPreparar() : vistaLista()}`;

    pantalla.querySelectorAll('[data-p]').forEach((b) => {
      b.onclick = () => { pestana = b.dataset.p; pintar(); };
    });
    pantalla.querySelector('#hasta').onchange = (ev) => {
      hasta = ev.target.value || hoy();
      pintar();
    };
    conectar();
  }

  // ==========================================================
  // PARA PREPARAR
  // ==========================================================
  function vistaPreparar() {
    if (!prep.areas.length) {
      return `<p class="vacio">
        No hay nada pendiente para ${esc(cuando(hasta))}. Cuando se tome un
        pedido en Vender, aparece aquí.</p>`;
    }

    return `
      <div class="ped-acciones">
        <button id="imprimir-prep">🖨️ Imprimir la hoja</button>
        <span class="ayuda">Para llevarla a la planta.</span>
      </div>

      <div class="ped-areas">
        ${prep.areas.map((a) => `
          <section class="tarjeta ped-area">
            <h3>${a.emoji} ${esc(a.nombre)}</h3>
            <table class="tabla">
              <tbody>
                ${a.productos.map((p) => `
                  <tr>
                    <td class="ped-cuanto">${esc(p.texto)}</td>
                    <td>${esc(p.concepto)}</td>
                    <td class="derecha">${pesos(p.centavos)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </section>`).join('')}
      </div>

      <p class="ayuda ped-total">
        ${prep.pedidos} pedido${prep.pedidos === 1 ? '' : 's'} ·
        ${prep.clientes} cliente${prep.clientes === 1 ? '' : 's'} ·
        vale <b>${pesos(prep.total)}</b>
      </p>`;
  }

  // ==========================================================
  // LAS NOTAS
  // ==========================================================
  function vistaLista() {
    if (!datos.pedidos.length) {
      return `<p class="vacio">No hay pedidos pendientes para ${esc(cuando(hasta))}.</p>`;
    }

    return `
      <div class="ped-acciones">
        <button id="imprimir-todas">🖨️ Imprimir todas las notas</button>
        <span class="ayuda">Una por cliente, con su QR de ubicación.</span>
      </div>

      <div class="ped-tarjetas">
        ${datos.pedidos.map(tarjeta).join('')}
      </div>`;
  }

  function tarjeta(p) {
    const forma = FORMAS[p.forma_pago] || FORMAS.efectivo;
    const atrasado = p.para_cuando < hoy();
    return `
      <section class="tarjeta ped-tarjeta ${atrasado ? 'atrasada' : ''}" data-id="${p.id}">
        <div class="ped-cabeza">
          <div class="crece">
            <!-- El nombre del CLIENTE arriba y el negocio debajo, igual que
                 en su nota impresa: en la puerta se pregunta por la
                 persona. -->
            <strong>${esc(p.cliente_nombre || p.cliente_negocio || '—')}</strong>
            ${p.cliente_negocio ? `<small>${esc(p.cliente_negocio)}</small>` : ''}
          </div>
          <span class="ped-folio">#${p.folio}</span>
        </div>

        <div class="ped-datos">
          <span class="etiqueta ${atrasado ? 'etiqueta-mal' : ''}">${esc(cuando(p.para_cuando))}</span>
          <span class="etiqueta">${forma.emoji} ${forma.texto}</span>
          ${p.horario ? `<span class="etiqueta">🕗 ${esc(p.horario)}</span>` : ''}
          ${p.latitud != null && p.longitud != null
            ? '<span class="etiqueta">📍 con ubicación</span>'
            : '<span class="etiqueta etiqueta-flojo">sin ubicación</span>'}
        </div>

        ${p.direccion ? `<p class="ped-direccion">${esc(p.direccion)}</p>` : ''}

        <ul class="ped-lineas">
          ${p.lineas.map((l) => `
            <li>
              <span class="ped-cuanto">${esc(l.texto)}</span>
              ${esc(l.concepto)}
              <span class="ped-precio">${pesos(l.precio_centavos)}</span>
            </li>`).join('')}
        </ul>

        <div class="ped-pie">
          <strong>${pesos(p.total)}</strong>
          <div class="ped-botones">
            <button class="secundario chico" data-ver="${p.id}">👁️ Nota</button>
            <button class="secundario chico" data-nota="${p.id}">🖨️</button>
            ${puede('pedidos.entregar')
              ? `<button class="chico" data-entregar="${p.id}">✅ Entregado</button>` : ''}
            ${puede('pedidos.tomar')
              ? `<button class="secundario chico" data-cancelar="${p.id}">✖️</button>` : ''}
          </div>
        </div>
      </section>`;
  }

  // ==========================================================
  // LO QUE HACEN LOS BOTONES
  // ==========================================================
  function conectar() {
    const prepBtn = pantalla.querySelector('#imprimir-prep');
    if (prepBtn) prepBtn.onclick = imprimirPreparacion;

    const todas = pantalla.querySelector('#imprimir-todas');
    if (todas) todas.onclick = imprimirTodas;

    pantalla.querySelectorAll('[data-ver]').forEach((b) => {
      b.onclick = () => verNota(b.dataset.ver);
    });
    pantalla.querySelectorAll('[data-nota]').forEach((b) => {
      b.onclick = () => imprimirNota(b.dataset.nota);
    });
    pantalla.querySelectorAll('[data-entregar]').forEach((b) => {
      b.onclick = () => entregar(b.dataset.entregar);
    });
    pantalla.querySelectorAll('[data-cancelar]').forEach((b) => {
      b.onclick = () => cancelar(b.dataset.cancelar);
    });
  }

  async function imprimirPreparacion() {
    try {
      const r = await api.enviar('/impresion/preparacion', { hasta });
      if (r.impreso) return avisar('Hoja de preparación impresa', 'bien');
      const previa = await api.obtener(`/impresion/preparacion/previa?hasta=${hasta}`);
      const que = await verTicket({
        titulo: 'Para preparar', renglones: previa.renglones, ancho: previa.ancho,
        notas: ['No hay impresora térmica configurada.'],
        acciones: [{ valor: 'imprimir', texto: '🖨️ Imprimir' }]
      });
      if (que === 'imprimir') imprimirTicket(htmlDeEspejo(previa.renglones, previa.ancho));
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function verNota(id) {
    try {
      const previa = await api.obtener(`/impresion/pedido/${id}/previa`);
      const que = await verTicket({
        titulo: 'Nota de entrega', renglones: previa.renglones, ancho: previa.ancho,
        acciones: [{ valor: 'imprimir', texto: '🖨️ Imprimir' }]
      });
      if (que === 'imprimir') imprimirTicket(htmlDeEspejo(previa.renglones, previa.ancho));
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function imprimirNota(id) {
    try {
      const r = await api.enviar(`/impresion/pedido/${id}`, {});
      if (r.impreso) return avisar('Nota impresa', 'bien');
      await verNota(id);
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function imprimirTodas() {
    try {
      const r = await api.enviar('/impresion/pedidos/notas', { hasta });
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
      titulo: `Pedido #${p.folio} · ${pesos(p.total)}`,
      texto: `${p.cliente_nombre || p.cliente_negocio}. ¿Cómo pagó?`,
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
      titulo: `¿Cancelar el pedido #${p.folio}?`,
      texto: `${p.cliente_nombre || p.cliente_negocio} · ${pesos(p.total)}. `
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
