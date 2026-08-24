/**
 * LA CAJA  (v0.9)
 *
 * El espejo en dinero del cuadre del cuarto frío. La misma cuenta, con
 * billetes en vez de marquetas:
 *
 *     fondo + cobrado + entradas − salidas = debería haber
 *     debería haber − contado = DIFERENCIA
 *
 * A propósito se parece a la pantalla de Existencia: quien ya entendió una,
 * entiende la otra sin que nadie se lo explique.
 */
import { api } from '../api.js';
import { esc, avisar, fecha as formatoFecha, soloHora, rango } from '../util.js';
import { pedirTexto, pedirImporte, confirmar, menu } from '../dialogo.js';
import { pesos, paraEditar } from '../fracciones.js';
import { cargarMarca } from '../marca.js';

export async function vistaCaja(pantalla, estadoApp, opciones = {}) {
  // Al cerrar el turno se sale del sistema: así el siguiente cajero tiene
  // que poner su PIN, y el turno queda a nombre de quien de verdad está.
  const alTerminar = opciones.alSalir;
  const puedeOperar = estadoApp.permisos.includes('*') ||
                      estadoApp.permisos.includes('caja.operar');
  const puedeCorregir = estadoApp.permisos.includes('*') ||
                        estadoApp.permisos.includes('venta.cancelar');

  const marca = await cargarMarca();

  await pintar();

  async function pintar() {
    const datos = await api.obtener('/caja');
    if (!datos.abierta) return sinTurno(datos.ultimoCorte);
    turnoAbierto(datos.abierta, datos.movimientos, datos.sinDueno);
  }

  // ==========================================================
  // NO HAY TURNO ABIERTO
  // ==========================================================
  function sinTurno(ultimo) {
    pantalla.innerHTML = `
      <h2>Caja</h2>
      <p class="ayuda">
        El turno de caja es el rato en que un cajero se hace responsable del
        dinero: se abre con un fondo, se le pegan las ventas solas y se
        cierra contando los billetes.
      </p>

      <div class="tarjeta caja-cerrada">
        <div class="caja-cerrada-icono">🔒</div>
        <strong>No hay ningún turno abierto</strong>
        <p class="ayuda" style="margin:8px 0 0">
          Mientras no haya turno, las ventas se cobran igual, pero
          <strong>no entran en ningún corte</strong>.
        </p>
        ${puedeOperar
          ? '<button id="abrir" class="grande" style="margin-top:18px">Abrir turno de caja</button>'
          : ''}
      </div>

      ${ultimo ? `
        <h3>Último corte</h3>
        <div class="item" data-corte="${esc(ultimo.id)}" style="cursor:pointer">
          <div class="crece">
            <strong>Turno #${ultimo.folio} · ${esc(ultimo.cajero_nombre || '—')}</strong>
            <small>${esc(formatoFecha(ultimo.cerrada_en))}</small>
          </div>
          <span class="${ultimo.diferencia_centavos === 0 ? 'etiqueta-bien' : 'etiqueta-mal'}">
            ${ultimo.diferencia_centavos === 0
              ? 'cuadró'
              : (ultimo.diferencia_centavos > 0 ? 'sobró ' : 'faltó ')
                + pesos(Math.abs(ultimo.diferencia_centavos))}
          </span>
        </div>` : ''}

      <button class="secundario chico" id="historial" style="margin-top:16px">
        Historial de cortes
      </button>`;

    if (puedeOperar) pantalla.querySelector('#abrir').onclick = abrirTurno;
    pantalla.querySelector('#historial').onclick = () => verHistorial();

    const fila = pantalla.querySelector('[data-corte]');
    if (fila) fila.onclick = () => verCorte(fila.dataset.corte);
  }

  async function abrirTurno() {
    const fondo = await pedirTexto({
      titulo: 'Abrir turno de caja',
      texto: '¿Con cuánto dinero arranca el cajón? Es el fondo para dar cambio. Si arranca vacío, escribe 0.',
      valor: '0', marcador: '500', ok: 'Abrir el turno', largo: 12
    });
    if (fondo === null) return;

    try {
      await api.enviar('/caja/abrir', { fondo });
      avisar('Turno abierto', 'bien');
      pintar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  // ==========================================================
  // TURNO ABIERTO
  // ==========================================================
  function turnoAbierto(e, movs, sinDueno) {
    const c = e.caja;

    pantalla.innerHTML = `
      <div class="venta-cabeza">
        <h2>Caja</h2>
        <div class="venta-cabeza-datos">
          <span class="etiqueta-folio">turno #${c.folio}</span>
          <button class="secundario chico" id="historial">Cortes</button>
        </div>
      </div>

      <p class="ayuda">
        Abierto desde las ${esc(soloHora(c.abierta_en))}
        · ${sinDueno
          ? '<strong>esperando al cajero que entra</strong>'
          : esc(c.cajero_nombre || '—')}
      </p>

      ${sinDueno ? `
        <div class="aviso-sin-caja" style="margin-top:0;margin-bottom:14px">
          <strong>Este turno todavía no tiene dueño.</strong>
          El dinero que entre se está apartando para el cajero que llega.
          En cuanto ponga su PIN, el turno queda a su nombre.
        </div>` : ''}

      <div class="venta-tablero">
        <section class="tarjeta">
          <div class="cuadre">
            <div class="cuadre-linea">
              <span>Fondo con el que abrió</span><strong>${pesos(e.fondo)}</strong>
            </div>
            <div class="cuadre-linea suma">
              <span>+ Cobrado en efectivo${e.ventas.cobradas
                ? ` (${e.ventas.cobradas} ticket${e.ventas.cobradas === 1 ? '' : 's'})` : ''}</span>
              <strong>${pesos(e.vendido)}</strong>
            </div>
            ${e.entradas ? `
              <div class="cuadre-linea suma">
                <span>+ Entradas de dinero</span><strong>${pesos(e.entradas)}</strong>
              </div>` : ''}
            <div class="cuadre-linea vendido">
              <span>− Gastos y retiros</span><strong>${pesos(e.salidas)}</strong>
            </div>
            <div class="cuadre-linea total">
              <span>= Debería haber en el cajón</span><strong>${pesos(e.esperado)}</strong>
            </div>
          </div>

          ${e.vendidoFiado ? `
            <p class="ayuda" style="margin:12px 0 0">
              Salieron <strong>${pesos(e.vendidoFiado)} fiados</strong> en este turno.
              Ese dinero está en la calle: no pasó por el cajón y no se cuenta aquí.
            </p>` : ''}
          ${e.vendidoTransferencia ? `
            <p class="ayuda" style="margin:8px 0 0">
              Además se cobraron ${pesos(e.vendidoTransferencia)} por transferencia.
              Tampoco pasaron por el cajón.
            </p>` : ''}
          ${e.ventas.canceladas ? `
            <p class="ayuda" style="margin:8px 0 0">
              ${e.ventas.canceladas} ticket${e.ventas.canceladas === 1 ? '' : 's'}
              cancelado${e.ventas.canceladas === 1 ? '' : 's'} por
              ${pesos(e.ventas.canceladas_centavos)}. No cuentan.
            </p>` : ''}

          ${puedeOperar ? `
            <div class="caja-acciones">
              <button class="secundario" id="salida">− Gasto o retiro</button>
              <button class="secundario" id="entrada">＋ Meter dinero</button>
            </div>
            <button class="grande" id="cerrar" style="margin-top:10px;width:100%">
              Terminar turno y contar
            </button>` : ''}
        </section>

        <section class="tarjeta">
          <h3 style="margin:0 0 4px">Movimientos del turno</h3>
          <p class="ayuda" style="margin:0 0 12px">
            Todo el dinero que entró o salió del cajón sin ser una venta.
          </p>
          ${movs.length ? `
            <table class="venta-lineas">
              ${movs.map((m) => `
                <tr>
                  <td class="detalle">
                    ${esc(m.concepto)}
                    <small>${esc(soloHora(m.fecha))} · ${esc(m.ejecutor_nombre || '—')}</small>
                  </td>
                  <td class="importe ${m.tipo === 'salida' ? 'malo' : 'bueno'}">
                    ${m.tipo === 'salida' ? '−' : '+'}${pesos(m.centavos)}
                  </td>
                  ${puedeCorregir ? `
                    <td class="quitar">
                      <button class="tachita" data-anular="${esc(m.id)}"
                              aria-label="Anular este movimiento">×</button>
                    </td>` : ''}
                </tr>`).join('')}
            </table>`
          : '<p class="vacio" style="margin:0;padding:22px 0">Todavía no hay movimientos.</p>'}
        </section>
      </div>`;

    pantalla.querySelector('#historial').onclick = () => verHistorial();

    if (puedeOperar) {
      pantalla.querySelector('#salida').onclick = () => nuevoMovimiento('salida');
      pantalla.querySelector('#entrada').onclick = () => nuevoMovimiento('entrada');
      pantalla.querySelector('#cerrar').onclick = () => terminarTurno(e, sinDueno);
    }

    pantalla.querySelectorAll('[data-anular]').forEach((b) => {
      b.onclick = async () => {
        const motivo = await pedirTexto({
          titulo: 'Anular este movimiento',
          texto: 'No se borra: queda marcado como anulado, con tu nombre y el motivo.',
          marcador: 'Se anotó dos veces, se puso mal el monto...',
          ok: 'Anular'
        });
        if (!motivo) return;
        try {
          await api.enviar(`/caja/movimientos/${b.dataset.anular}/anular`, { motivo });
          avisar('Movimiento anulado', 'bien');
          pintar();
        } catch (err) { avisar(err.message, 'error'); }
      };
    });
  }

  async function nuevoMovimiento(tipo) {
    const esSalida = tipo === 'salida';

    const concepto = await pedirTexto({
      titulo: esSalida ? 'Gasto o retiro' : 'Meter dinero al cajón',
      texto: esSalida
        ? '¿En qué se usó el dinero? La gasolina, un refresco, el retiro a la caja fuerte...'
        : '¿De dónde viene el dinero? Cambio del banco, dinero que se repuso...',
      marcador: esSalida ? 'Gasolina de la camioneta' : 'Cambio del banco',
      ok: 'Siguiente'
    });
    if (!concepto) return;

    const monto = await pedirTexto({
      titulo: concepto,
      texto: '¿De cuánto es?',
      marcador: '200', ok: esSalida ? 'Anotar la salida' : 'Anotar la entrada', largo: 12
    });
    if (!monto) return;

    try {
      await api.enviar('/caja/movimientos', { tipo, concepto, monto });
      avisar(esSalida ? 'Salida anotada' : 'Entrada anotada', 'bien');
      pintar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  // ==========================================================
  // CERRAR: CONTAR EL DINERO
  // ==========================================================
  /**
   * TERMINAR EL TURNO.
   *
   * Hay dos formas, y la diferencia es si el que sigue ya llegó:
   *
   *  · Ya llegó (o se cierra la fábrica) → se cuenta, se hace el corte y se
   *    SALE DEL SISTEMA. El siguiente pone su PIN y ese PIN abre su turno.
   *    Así el nombre del turno siempre es el de quien de verdad está.
   *
   *  · Todavía no llega (el relevo de las 2:30) → se cuenta el dinero del
   *    que se va, y queda abierto un turno SIN DUEÑO. La venta no se para:
   *    lo que entre se aparta para el que llega, y en cuanto ponga su PIN
   *    el turno se le asigna.
   */
  async function terminarTurno(e, sinDueno) {
    const como = sinDueno
      ? 'cerrar'
      : await menu({
          titulo: 'Terminar el turno',
          texto: '¿Ya llegó quien sigue en la caja?',
          opciones: [
            { valor: 'cerrar', texto: 'Sí, ya llegó',
              detalle: 'Se hace el corte y se cierra la sesión. Quien entra pone su PIN.' },
            { valor: 'entregar', texto: 'Todavía no llega',
              detalle: 'Se cuenta tu dinero y la venta sigue. Lo que entre se aparta para quien llegue.' }
          ]
        });
    if (!como) return;

    const contado = await pedirImporte({
      titulo: como === 'entregar' ? 'Entregar el turno' : 'Cerrar el turno',
      texto: `Cuenta todo el dinero del cajón, incluido el fondo. Deberían ser ${pesos(e.esperado)}.`,
      marcador: paraEditar(e.esperado),
      ok: 'Contar y ver el corte'
    });
    if (contado === null) return;

    try {
      const r = await api.enviar(`/caja/${como === 'entregar' ? 'entregar' : 'cerrar'}`,
                                 { contado });
      verCorte(r.corte.caja.id, r.corte, { cerroSesion: como === 'cerrar' });
    } catch (err) { avisar(err.message, 'error'); }
  }

  // ==========================================================
  // EL CORTE, CON SU TICKET
  // ==========================================================
  async function verCorte(id, yaCargado, { cerroSesion = false } = {}) {
    const { corte } = yaCargado ? { corte: yaCargado } : await api.obtener(`/caja/cortes/${id}`);
    const c = corte.caja;

    const dif = c.diferencia_centavos;
    const cuadra = dif === 0;
    const sobra = dif > 0;

    pantalla.innerHTML = `
      <button class="secundario chico no-imprimir" id="volver">‹ Caja</button>

      <div class="tarjeta ${cuadra ? 'cuadre-exacto' : 'cuadre-diferencia'}"
           style="margin-top:14px">
        <h2 style="margin:0 0 6px">Corte del turno #${c.folio}</h2>
        <p class="ayuda" style="margin:0 0 14px">
          ${esc(c.cajero_nombre || '—')} · ${esc(rango(c.abierta_en, c.cerrada_en))}
        </p>

        <div class="cuadre">
          <div class="cuadre-linea"><span>Fondo</span><strong>${pesos(c.fondo_centavos)}</strong></div>
          <div class="cuadre-linea suma"><span>+ Cobrado en efectivo</span><strong>${pesos(c.vendido_centavos)}</strong></div>
          ${c.entradas_centavos ? `
            <div class="cuadre-linea suma"><span>+ Entradas</span><strong>${pesos(c.entradas_centavos)}</strong></div>` : ''}
          <div class="cuadre-linea vendido"><span>− Gastos y retiros</span><strong>${pesos(c.salidas_centavos)}</strong></div>
          <div class="cuadre-linea total"><span>= Debería haber</span><strong>${pesos(c.esperado_centavos)}</strong></div>
          <div class="cuadre-linea contado"><span>− Contaste</span><strong>${pesos(c.contado_centavos)}</strong></div>
        </div>

        <div class="salidas ${cuadra ? 'exacto' : sobra ? 'sobra' : ''}">
          <span>${cuadra ? 'Cuadró exacto' : sobra ? 'Sobra' : 'Falta'}</span>
          <strong>${cuadra ? '✓' : pesos(Math.abs(dif))}</strong>
          <small>${cuadra ? 'ni un peso de diferencia' : 'en el cajón'}</small>
        </div>

        <p class="ayuda" style="margin:14px 0 0">
          ${cuadra
            ? 'Todo el dinero que debía estar, está.'
            : sobra
              ? 'Hay más dinero del que debería. Casi siempre es un cambio que no se dio, o una venta cobrada sin registrar.'
              : 'Falta dinero. Puede ser un cambio dado de más, un gasto que no se anotó, o dinero que se sacó del cajón.'}
        </p>
      </div>

      <div class="ticket" id="ticket">
        <div class="ticket-cabeza">
          <strong>${esc((marca.nombreNegocio || 'Hielo LOLHA').toUpperCase())}</strong>
          <span>${esc(formatoFecha(c.cerrada_en))}</span>
        </div>
        <div class="ticket-folio">CORTE DE CAJA #${c.folio}</div>

        <table class="ticket-tabla">
          <tr><td>Cajero</td><td>${esc(c.cajero_nombre || '—')}</td></tr>
          <tr><td>Tickets</td><td>${corte.ventas.cobradas}</td></tr>
          ${corte.ventas.canceladas
            ? `<tr><td>Cancelados</td><td>${corte.ventas.canceladas}</td></tr>` : ''}
        </table>

        <table class="ticket-tabla" style="margin-top:8px">
          <tr><td>Fondo</td><td>${pesos(c.fondo_centavos)}</td></tr>
          <tr><td>Cobrado</td><td>+${pesos(c.vendido_centavos)}</td></tr>
          ${c.entradas_centavos ? `<tr><td>Entradas</td><td>+${pesos(c.entradas_centavos)}</td></tr>` : ''}
          <tr><td>Gastos y retiros</td><td>−${pesos(c.salidas_centavos)}</td></tr>
          <tr class="fuerte"><td>Debería haber</td><td>${pesos(c.esperado_centavos)}</td></tr>
          <tr class="fuerte"><td>Contado</td><td>${pesos(c.contado_centavos)}</td></tr>
          <tr class="fuerte"><td>${sobra ? 'Sobra' : cuadra ? 'Diferencia' : 'Falta'}</td>
              <td>${pesos(Math.abs(dif))}</td></tr>
        </table>

        ${corte.movimientos.length ? `
          <div class="ticket-tanque" style="margin-top:10px">
            <div class="ticket-nombre">MOVIMIENTOS</div>
            <table class="ticket-tabla">
              ${corte.movimientos.map((m) => `
                <tr>
                  <td>${m.anulado_en ? '(anulado) ' : ''}${esc(m.concepto)}</td>
                  <td>${m.tipo === 'salida' ? '−' : '+'}${pesos(m.centavos)}</td>
                </tr>`).join('')}
            </table>
          </div>` : ''}

        <div class="ticket-pie">
          <div>Cerró: ${esc(c.cerrada_por_nombre || '—')}</div>
          <div class="ticket-firma">Firma: ______________________</div>
        </div>
      </div>

      <div class="fila-botones no-imprimir" style="margin-top:14px;flex-wrap:wrap">
        <button id="imprimir">🖨️ Imprimir el corte</button>
        ${cerroSesion
          ? '<button class="grande crece" id="siguiente-cajero">Listo · pasa el siguiente</button>'
          : ''}
      </div>

      ${cerroSesion ? `
        <p class="ayuda no-imprimir" style="margin-top:12px">
          Al terminar aquí se cierra la sesión. El cajero que entra pone su
          PIN y con eso arranca su turno.
        </p>` : ''}`;

    pantalla.querySelector('#volver').onclick = pintar;
    pantalla.querySelector('#imprimir').onclick = () => window.print();

    const siguiente = pantalla.querySelector('#siguiente-cajero');
    if (siguiente) siguiente.onclick = () => alTerminar?.();
  }

  // ==========================================================
  // HISTORIAL
  // ==========================================================
  async function verHistorial() {
    const { cortes } = await api.obtener('/caja/cortes?limite=40');

    pantalla.innerHTML = `
      <button class="secundario chico" id="volver">‹ Caja</button>
      <h2 style="margin-top:14px">Cortes de caja</h2>
      <p class="ayuda">
        Un renglón por turno. La columna de diferencia es lo que sobró o
        faltó al contar el dinero.
      </p>

      <div class="tarjeta plana">
        <table class="tabla">
          <tr><th>#</th><th>Cuándo</th><th>Cajero</th><th>Cobrado</th><th>Diferencia</th></tr>
          ${cortes.map((c) => `
            <tr data-corte="${esc(c.id)}" style="cursor:pointer">
              <td><strong>${c.folio}</strong></td>
              <td>${esc(formatoFecha(c.cerrada_en))}</td>
              <td>${esc(c.cajero_nombre || '—')}</td>
              <td>${pesos(c.vendido_centavos)}</td>
              <td class="${c.diferencia_centavos === 0 ? '' : 'malo'}">
                ${c.diferencia_centavos === 0 ? '✓' : pesos(c.diferencia_centavos)}
              </td>
            </tr>`).join('') || '<tr><td colspan="5">Todavía no hay cortes.</td></tr>'}
        </table>
      </div>`;

    pantalla.querySelector('#volver').onclick = pintar;
    pantalla.querySelectorAll('[data-corte]').forEach((f) => {
      f.onclick = () => verCorte(f.dataset.corte);
    });
  }
}
