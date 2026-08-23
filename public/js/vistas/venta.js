/**
 * PUNTO DE VENTA  (v0.8)
 *
 * La pantalla que más se usa en toda la fábrica. Todo el diseño está hecho
 * para una cosa: cobrar rápido, con las manos mojadas y sin equivocarse.
 *
 * Reglas del plan que se ven aquí:
 *
 *  3.1  Todo se teclea en fracciones de marqueta, nunca en decimales.
 *  3.5  El precio se COPIA dentro del ticket. Subir precios mañana no
 *       cambia los tickets de hoy.
 *  7.2  Cada fracción tiene su propio precio. Tocar seis veces 1/16 cuesta
 *       exactamente lo mismo que tocar 1/4 y 1/8, porque el sistema parte
 *       la cantidad siempre igual.
 *  7.3  Folio consecutivo. Nunca se reinicia.
 *  7.4  Una venta cobrada no se edita: se cancela, con motivo y responsable.
 *
 * El precio que se ve en pantalla lo calcula el navegador para que responda
 * al instante, pero EL QUE MANDA ES EL DEL SERVIDOR: al cobrar, el servidor
 * vuelve a calcularlo desde cero con sus propios precios. Si alguien tocara
 * el navegador para cambiar el total, no le serviría de nada.
 */
import { api } from '../api.js';
import { esc, avisar, fecha as formatoFecha } from '../util.js';
import { pedirTexto, confirmar } from '../dialogo.js';
import { crearTeclado, aTexto, descomponer, desglose, pesos, POR_MARQUETA } from '../fracciones.js';
import { cargarMarca } from '../marca.js';

/** Billetes con los que de verdad paga la gente. */
const BILLETES = [50, 100, 200, 500, 1000];

export async function vistaVenta(pantalla, estadoApp) {
  const puedeCancelar = estadoApp.permisos.includes('*') ||
                        estadoApp.permisos.includes('venta.cancelar');
  const puedePrecios = estadoApp.permisos.includes('*');

  const contexto = await api.obtener('/ventas/contexto');
  const marca = await cargarMarca();

  // Mapa fracción -> centavos, para calcular el precio sin ir al servidor.
  const tarifa = new Map(contexto.precios.map((p) => [p.dieciseisavos, p.centavos]));

  /** El mismo cálculo que hace el servidor: se parte y se suman los pedazos. */
  function cotizar(dieciseisavos) {
    let centavos = 0;
    for (const parte of descomponer(dieciseisavos)) centavos += tarifa.get(parte) ?? 0;
    return centavos;
  }

  let lineas = [];        // lo que lleva el ticket en curso
  let teclado = null;

  cobrar();

  // ==========================================================
  // LA PANTALLA DE COBRO
  // ==========================================================
  function cobrar() {
    pantalla.innerHTML = `
      <div class="venta-cabeza">
        <h2>Punto de venta</h2>
        <div class="venta-cabeza-datos">
          <span class="etiqueta-folio">ticket #${contexto.siguienteFolio}</span>
          ${contexto.caja ? `<span class="etiqueta-turno">turno #${contexto.caja.folio}</span>` : ''}
          <button class="secundario chico" id="buscar">Buscar tickets</button>
          ${puedePrecios ? '<button class="secundario chico" id="precios">Precios</button>' : ''}
        </div>
      </div>

      ${contexto.caja
        ? ''
        : `<div class="aviso-sin-caja no-imprimir">
             <strong>No hay turno de caja abierto.</strong>
             Puedes cobrar igual, pero estas ventas no entrarán en ningún corte.
             <a href="#/caja">Abrir la caja</a>
           </div>`}

      <div class="venta-tablero">
        <section class="venta-teclado tarjeta">
          <div id="teclado"></div>
          <button id="agregar" class="grande" disabled>Agregar al ticket</button>
          <p class="ayuda" style="margin:10px 0 0">
            Los botones se van sumando: 1/2 y luego 1/8 son 5/8. Cuando los
            pedazos completan una marqueta, sube solo.
          </p>
        </section>

        <section class="venta-ticket tarjeta">
          <div id="lista"></div>
          <div id="pago"></div>
        </section>
      </div>`;

    teclado = crearTeclado(pantalla.querySelector('#teclado'), {
      valor: 0,
      alCambiar: (n) => {
        teclado.decir(n
          ? `${esc(desglose(n))} = <strong>${pesos(cotizar(n))}</strong>`
          : 'toca una fracción para empezar');
        pantalla.querySelector('#agregar').disabled = n <= 0;
      }
    });
    teclado.decir('toca una fracción para empezar');

    pantalla.querySelector('#agregar').onclick = agregarLinea;
    // Ojo: sin la flecha, el navegador le pasaría el evento del clic como
    // texto de búsqueda y la lista saldría siempre vacía.
    pantalla.querySelector('#buscar').onclick = () => buscarTickets();
    if (puedePrecios) pantalla.querySelector('#precios').onclick = verPrecios;

    pintarLista();
  }

  function agregarLinea() {
    const n = teclado.valor();
    if (n <= 0) return;
    lineas.push({ concepto: 'Hielo', dieciseisavos: n, centavos: cotizar(n) });
    teclado.poner(0);
    pintarLista();
  }

  function total() {
    return lineas.reduce((t, l) => t + l.centavos, 0);
  }

  function totalHielo() {
    return lineas.reduce((t, l) => t + l.dieciseisavos, 0);
  }

  // ==========================================================
  // EL TICKET EN CURSO
  // ==========================================================
  function pintarLista() {
    const lista = pantalla.querySelector('#lista');

    if (!lineas.length) {
      lista.innerHTML = `
        <p class="vacio" style="margin:0;padding:26px 0">
          El ticket está vacío.<br>
          <small>Marca la cantidad y toca «Agregar al ticket».</small>
        </p>`;
      pantalla.querySelector('#pago').innerHTML = '';
      return;
    }

    lista.innerHTML = `
      <table class="venta-lineas">
        ${lineas.map((l, i) => `
          <tr>
            <td class="cantidad">${esc(aTexto(l.dieciseisavos))}</td>
            <td class="detalle">
              ${esc(l.concepto)}
              <small>${esc(desglose(l.dieciseisavos))}</small>
            </td>
            <td class="importe">${pesos(l.centavos)}</td>
            <td class="quitar">
              <button class="tachita" data-quitar="${i}" aria-label="Quitar esta línea">×</button>
            </td>
          </tr>`).join('')}
      </table>

      <div class="venta-total">
        <div>
          <span>Total</span>
          <small>${esc(aTexto(totalHielo()))} ${totalHielo() === POR_MARQUETA ? 'marqueta' : 'marquetas'}</small>
        </div>
        <strong>${pesos(total())}</strong>
      </div>`;

    lista.querySelectorAll('[data-quitar]').forEach((b) => {
      b.onclick = () => { lineas.splice(Number(b.dataset.quitar), 1); pintarLista(); };
    });

    pintarPago();
  }

  // ==========================================================
  // EL PAGO Y EL CAMBIO
  // ==========================================================
  function pintarPago() {
    const caja = pantalla.querySelector('#pago');
    const aPagar = total();

    caja.innerHTML = `
      <label class="etiqueta-chica" for="pago-campo">¿Con cuánto paga?</label>
      <div class="venta-billetes">
        <button class="secundario chico" data-billete="exacto">Justo</button>
        ${BILLETES.filter((b) => b * 100 >= aPagar)
          .slice(0, 4)
          .map((b) => `<button class="secundario chico" data-billete="${b}">$${b}</button>`).join('')}
      </div>
      <input id="pago-campo" class="venta-pago" inputmode="decimal"
             placeholder="0.00" autocomplete="off">

      <div class="venta-cambio" id="cambio" hidden>
        <span>Cambio</span>
        <strong id="cambio-monto">$0.00</strong>
      </div>

      <div class="fila-botones" style="margin-top:14px">
        <button class="secundario" id="vaciar">Vaciar</button>
        <button class="grande crece" id="cobrar">Cobrar ${pesos(aPagar)}</button>
      </div>`;

    const campo = caja.querySelector('#pago-campo');
    const cambio = caja.querySelector('#cambio');
    const monto = caja.querySelector('#cambio-monto');

    function recalcular() {
      const centavos = Math.round((Number(campo.value.replace(/[^0-9.]/g, '')) || 0) * 100);
      // El cambio solo se enseña cuando el pago alcanza: enseñar un número
      // negativo en rojo no ayuda a nadie a las tres de la tarde.
      if (centavos >= aPagar && campo.value.trim() !== '') {
        monto.textContent = pesos(centavos - aPagar);
        cambio.hidden = false;
      } else {
        cambio.hidden = true;
      }
    }

    campo.oninput = recalcular;
    campo.onkeydown = (ev) => { if (ev.key === 'Enter') registrar(campo.value); };

    caja.querySelectorAll('[data-billete]').forEach((b) => {
      b.onclick = () => {
        campo.value = b.dataset.billete === 'exacto'
          ? (aPagar / 100).toFixed(2)
          : b.dataset.billete;
        recalcular();
      };
    });

    caja.querySelector('#vaciar').onclick = async () => {
      if (!await confirmar({
        titulo: '¿Vaciar el ticket?',
        texto: 'Se quita todo lo que llevas capturado. No se registra nada.',
        ok: 'Vaciar', peligro: true
      })) return;
      lineas = [];
      pintarLista();
    };

    caja.querySelector('#cobrar').onclick = () => registrar(campo.value);
  }

  async function registrar(pagoTexto) {
    if (!lineas.length) return;

    const boton = pantalla.querySelector('#cobrar');
    if (boton) { boton.disabled = true; boton.textContent = 'Cobrando…'; }

    try {
      const { venta } = await api.enviar('/ventas', {
        almacenId: contexto.almacenes[0]?.id,
        lineas: lineas.map((l) => ({ concepto: l.concepto, dieciseisavos: l.dieciseisavos })),
        pago: pagoTexto?.trim() ? pagoTexto.replace(/[^0-9.]/g, '') : undefined
      });
      lineas = [];
      contexto.siguienteFolio = venta.folio + 1;
      verTicket(venta, { reciencobrada: true });
    } catch (e) {
      avisar(e.message, 'error');
      if (boton) { boton.disabled = false; boton.textContent = `Cobrar ${pesos(total())}`; }
    }
  }

  // ==========================================================
  // EL TICKET IMPRESO
  // ==========================================================
  function verTicket(venta, { reciencobrada = false } = {}) {
    pantalla.innerHTML = `
      <button class="secundario chico no-imprimir" id="volver">‹ Punto de venta</button>

      ${reciencobrada && venta.cambio_centavos !== null ? `
        <div class="venta-cambio grande-cambio no-imprimir">
          <span>Cambio</span>
          <strong>${pesos(venta.cambio_centavos)}</strong>
        </div>` : ''}

      <div class="ticket ticket-venta" id="ticket">
        <div class="ticket-cabeza">
          <strong>${esc((marca.nombreNegocio || 'Hielo LOLHA').toUpperCase())}</strong>
          <span>${esc(formatoFecha(venta.fecha))}</span>
        </div>

        <div class="ticket-folio">TICKET #${venta.folio}</div>
        ${venta.cancelada_en ? '<div class="ticket-cancelado">CANCELADO</div>' : ''}

        <table class="ticket-tabla">
          ${venta.lineas.map((l) => `
            <tr>
              <td>${esc(l.texto)} ${esc(l.concepto.toLowerCase())}
                  <small>${esc(l.desglose || '')}</small></td>
              <td>${pesos(l.precio_centavos)}</td>
            </tr>`).join('')}
          <tr class="fuerte"><td>TOTAL</td><td>${pesos(venta.total_centavos)}</td></tr>
          ${venta.pago_centavos !== null ? `
            <tr><td>Pagó</td><td>${pesos(venta.pago_centavos)}</td></tr>
            <tr><td>Cambio</td><td>${pesos(venta.cambio_centavos)}</td></tr>` : ''}
        </table>

        <div class="ticket-pie">
          <div>Atendió: ${esc(venta.cajero_nombre || '—')}</div>
          <div>Lista: ${esc(venta.lista_nombre || '—')}</div>
          <div class="ticket-gracias">¡Gracias por su compra!</div>
        </div>
      </div>

      <div class="fila-botones no-imprimir" style="margin-top:14px;flex-wrap:wrap">
        <button id="imprimir">🖨️ Imprimir</button>
        <button class="secundario" id="nueva">Nueva venta</button>
        ${puedeCancelar && !venta.cancelada_en
          ? '<button class="secundario peligro" id="cancelar">Cancelar esta venta</button>' : ''}
      </div>

      ${venta.cancelada_en ? `
        <div class="tarjeta aviso-cancelada no-imprimir" style="margin-top:14px">
          <strong>Venta cancelada</strong>
          <p class="ayuda" style="margin:6px 0 0">
            ${esc(formatoFecha(venta.cancelada_en))} ·
            ${esc(venta.cancelada_por_nombre || '—')}<br>
            Motivo: ${esc(venta.motivo_cancelacion || '—')}
          </p>
        </div>` : ''}`;

    pantalla.querySelector('#volver').onclick = cobrar;
    pantalla.querySelector('#nueva').onclick = cobrar;
    pantalla.querySelector('#imprimir').onclick = () => window.print();

    const btnCancelar = pantalla.querySelector('#cancelar');
    if (btnCancelar) btnCancelar.onclick = () => cancelarVenta(venta);
  }

  /**
   * Cancelar NO borra ni corrige el ticket (regla 7.4): lo marca, guarda
   * quién lo canceló y por qué, y el original sigue ahí para siempre.
   */
  async function cancelarVenta(venta) {
    const motivo = await pedirTexto({
      titulo: `Cancelar el ticket #${venta.folio}`,
      texto: 'El ticket no se borra: queda marcado como cancelado, con tu nombre y el motivo. El hielo vuelve a contar como que no salió.',
      marcador: 'Se cobró de más, el cliente devolvió el hielo...',
      ok: 'Cancelar la venta'
    });
    if (!motivo) return;

    try {
      await api.enviar(`/ventas/${venta.id}/cancelar`, { motivo });
      avisar('Venta cancelada', 'bien');
      const r = await api.obtener(`/ventas/${venta.id}`);
      verTicket(r.venta);
    } catch (e) { avisar(e.message, 'error'); }
  }

  // ==========================================================
  // BUSCAR TICKETS
  // ==========================================================
  async function buscarTickets(busca = '') {
    const { ventas } = await api.obtener(`/ventas?limite=30&busca=${encodeURIComponent(busca)}`);

    pantalla.innerHTML = `
      <button class="secundario chico" id="volver">‹ Punto de venta</button>
      <h2 style="margin-top:14px">Tickets</h2>
      <p class="ayuda">
        Se busca por número de ticket, por el importe o por la hora.
        Los últimos 30 salen solos.
      </p>

      <input id="busca" class="buscador" placeholder="Número, monto u hora"
             value="${esc(busca)}" autocomplete="off">

      <div class="tarjeta plana" style="margin-top:14px">
        <table class="tabla">
          <tr><th>#</th><th>Cuándo</th><th>Total</th><th>Cajero</th></tr>
          ${ventas.map((v) => `
            <tr data-abrir="${esc(v.id)}" style="cursor:pointer"
                class="${v.cancelada_en ? 'anulada' : ''}">
              <td><strong>${v.folio}</strong></td>
              <td>${esc(formatoFecha(v.fecha))}</td>
              <td>${pesos(v.total_centavos)}</td>
              <td>${esc(v.cajero_nombre || '—')}</td>
            </tr>`).join('') || '<tr><td colspan="4">No hay tickets que coincidan.</td></tr>'}
        </table>
      </div>`;

    pantalla.querySelector('#volver').onclick = cobrar;

    const campo = pantalla.querySelector('#busca');
    let espera;
    campo.oninput = () => {
      clearTimeout(espera);
      espera = setTimeout(() => buscarTickets(campo.value.trim()), 350);
    };

    pantalla.querySelectorAll('[data-abrir]').forEach((fila) => {
      fila.onclick = async () => {
        const r = await api.obtener(`/ventas/${fila.dataset.abrir}`);
        verTicket(r.venta);
      };
    });
  }

  // ==========================================================
  // PRECIOS — solo el administrador
  // ==========================================================
  async function verPrecios() {
    const { listas } = await api.obtener('/ventas/precios/listas');

    pantalla.innerHTML = `
      <button class="secundario chico" id="volver">‹ Punto de venta</button>
      <h2 style="margin-top:14px">Precios</h2>
      <p class="ayuda">
        Cada fracción tiene su propio precio; no se saca dividiendo el de la
        marqueta. El 1/16 se cobra más caro de lo proporcional porque da más
        trabajo cortarlo. Los tickets ya cobrados <strong>no cambian</strong>
        cuando cambias un precio aquí.
      </p>

      ${listas.map((l) => `
        <div class="tarjeta" data-lista="${esc(l.id)}">
          <div class="existencia-cabeza">
            <div>
              <strong>${esc(l.nombre)}</strong>
              <small>${l.activa ? 'Es la que se está cobrando' : 'Guardada, sin usar'}</small>
            </div>
          </div>

          <div class="precios-rejilla">
            ${l.precios.map((p) => `
              <label class="precio-celda">
                <span>${esc(p.etiqueta)}</span>
                <input inputmode="decimal" data-precio="${p.dieciseisavos}"
                       value="${(p.centavos / 100).toFixed(2)}">
              </label>`).join('')}
          </div>

          <div class="fila-botones" style="margin-top:14px">
            <button class="secundario" data-sugerir="${esc(l.id)}">Sugerir proporcional</button>
            <button data-guardar="${esc(l.id)}">Guardar precios</button>
          </div>
        </div>`).join('')}`;

    pantalla.querySelector('#volver').onclick = cobrar;

    pantalla.querySelectorAll('[data-guardar]').forEach((b) => {
      b.onclick = async () => {
        const tarjeta = b.closest('[data-lista]');
        const precios = [...tarjeta.querySelectorAll('[data-precio]')].map((c) => ({
          dieciseisavos: Number(c.dataset.precio),
          pesos: Number(c.value.replace(/[^0-9.]/g, '')) || 0
        }));
        try {
          await api.actualizar(`/ventas/precios/${b.dataset.guardar}`, { precios });
          avisar('Precios guardados', 'bien');
          // La pantalla de cobro trae los precios en memoria: hay que releerlos.
          const nuevo = await api.obtener('/ventas/contexto');
          contexto.precios = nuevo.precios;
          tarifa.clear();
          for (const p of nuevo.precios) tarifa.set(p.dieciseisavos, p.centavos);
        } catch (e) { avisar(e.message, 'error'); }
      };
    });

    pantalla.querySelectorAll('[data-sugerir]').forEach((b) => {
      b.onclick = async () => {
        const tarjeta = b.closest('[data-lista]');
        const marqueta = Number(
          tarjeta.querySelector('[data-precio="16"]').value.replace(/[^0-9.]/g, '')
        );
        if (!marqueta) { avisar('Pon primero el precio de la marqueta', 'error'); return; }

        const { sugerencias } = await api.obtener(`/ventas/precios/sugerencia?marqueta=${marqueta}`);
        for (const s of sugerencias) {
          const campo = tarjeta.querySelector(`[data-precio="${s.dieciseisavos}"]`);
          if (campo) campo.value = (s.centavos / 100).toFixed(2);
        }
        avisar('Es solo la parte proporcional. Súbelos si el corte da trabajo.', '');
      };
    });
  }
}
