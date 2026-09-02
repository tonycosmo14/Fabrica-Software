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
import { pedirTexto, pedirImporte, confirmar, menu, pedirContrasena } from '../dialogo.js';
import { pesos, paraEditar } from '../fracciones.js';
import { cargarMarca } from '../marca.js';
import { compartirCorte } from '../corte-imagen.js';

export async function vistaCaja(pantalla, estadoApp, opciones = {}) {
  // Al cerrar el turno se sale del sistema: así el siguiente cajero tiene
  // que poner su PIN, y el turno queda a nombre de quien de verdad está.
  const alTerminar = opciones.alSalir;
  const puedeOperar = estadoApp.permisos.includes('*') ||
                      estadoApp.permisos.includes('caja.operar');
  const puedeCorregir = estadoApp.permisos.includes('*') ||
                        estadoApp.permisos.includes('venta.cancelar');
  // Anular deja el renglón tachado; borrar lo quita. Lo segundo es del
  // administrador y con su contraseña.
  const esAdmin = estadoApp.permisos.includes('*');

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
          ${esAdmin
            ? '<button class="secundario chico" id="conceptos">Gastos que se repiten</button>'
            : ''}
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
                      ${esAdmin ? `
                        <button class="tachita borrar" data-borrar="${esc(m.id)}"
                                title="Borrarlo de verdad"
                                aria-label="Borrar este movimiento">🗑</button>` : ''}
                    </td>` : ''}
                </tr>`).join('')}
            </table>`
          : '<p class="vacio" style="margin:0;padding:22px 0">Todavía no hay movimientos.</p>'}
        </section>
      </div>`;

    pantalla.querySelector('#historial').onclick = () => verHistorial();

    const btnConceptos = pantalla.querySelector('#conceptos');
    if (btnConceptos) btnConceptos.onclick = verConceptos;

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

    pantalla.querySelectorAll('[data-borrar]').forEach((b) => {
      b.onclick = () => borrarMovimiento(b.dataset.borrar);
    });
  }

  /**
   * BORRARLO DE VERDAD.
   *
   * Anular deja el renglón tachado con su motivo, y para el día a día es lo
   * correcto: se ve qué pasó. Pero un gasto capturado tres veces por un
   * dedazo deja tres renglones tachados en una lista que ya es larga.
   */
  async function borrarMovimiento(id) {
    if (!await confirmar({
      titulo: '¿Borrar este movimiento?',
      texto: 'Desaparece de la lista y del cajón. Si lo que quieres es que se vea ' +
             'qué pasó, mejor anúlalo: queda tachado con su motivo.',
      ok: 'Sí, borrar', peligro: true
    })) return;

    try {
      await api.borrar(`/caja/movimientos/${id}`, {});
    } catch (e) {
      if (!e.requiereContrasena) { avisar(e.message, 'error'); return; }

      const clave = await pedirContrasena({
        titulo: 'Borrar el movimiento',
        texto: 'Borrar no se deshace, así que va con la contraseña del administrador.',
        administradores: e.administradores || [],
        aviso: e.turnoCerrado
          ? `<strong>Es de un turno ya cortado (#${e.folio}).</strong> Los totales de ` +
            'ese corte están congelados y no cambian, pero si lo vuelves a imprimir ' +
            'la lista de movimientos ya no va a coincidir con el papel que se firmó.'
          : '',
        ok: 'Borrar'
      });
      if (!clave) return;

      try {
        await api.borrar(`/caja/movimientos/${id}`, { autorizacion: clave });
      } catch (err) { avisar(err.message, 'error'); return; }
    }

    avisar('Movimiento borrado', 'bien');
    pintar();
  }

  /**
   * Igual que en el punto de venta: primero se ELIGE de los que se repiten
   * y solo si no está se escribe. Es lo que hace que los cien desayunos del
   * mes se llamen todos igual y se puedan sumar.
   */
  async function nuevoMovimiento(tipo) {
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
        texto: 'Toca el de siempre, o escribe uno.',
        opciones: [
          ...conceptos.map((c) => ({ valor: c.id, texto: c.nombre, detalle: c.ayuda || '' })),
          { valor: '__otro', texto: '✎ Otro — escribirlo',
            detalle: 'Para el que no se repite' }
        ]
      });
      if (!elegido) return;
      if (elegido !== '__otro') {
        conceptoId = elegido;
        concepto = conceptos.find((c) => c.id === elegido)?.nombre || '';
      }
    }

    if (!conceptoId) {
      concepto = await pedirTexto({
        titulo: esSalida ? 'Gasto o retiro' : 'Meter dinero al cajón',
        texto: esSalida
          ? '¿En qué se usó el dinero? La gasolina, un refresco, el retiro a la caja fuerte...'
          : '¿De dónde viene el dinero? Cambio del banco, dinero que se repuso...',
        marcador: esSalida ? 'Gasolina de la camioneta' : 'Cambio del banco',
        ok: 'Siguiente'
      });
      if (!concepto) return;
    }

    const monto = await pedirTexto({
      titulo: concepto,
      texto: '¿De cuánto es?',
      marcador: '200', ok: esSalida ? 'Anotar la salida' : 'Anotar la entrada', largo: 12
    });
    if (!monto) return;

    try {
      await api.enviar('/caja/movimientos',
        conceptoId ? { tipo, conceptoId, monto } : { tipo, concepto, monto });
      avisar(esSalida ? 'Salida anotada' : 'Entrada anotada', 'bien');
      pintar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  // ==========================================================
  // LOS GASTOS QUE SE REPITEN
  //
  // "Creo el gasto recurrente que se llama desayuno, es todos los días,
  //  nunca es igual, y al final del mes quiero ver cuánto gasté."
  //
  // Aquí se dan de alta. Lo que se gana no es escribir menos: es que los
  // cien desayunos del mes se llamen IGUAL y se puedan sumar.
  // ==========================================================
  async function verConceptos() {
    const [{ conceptos }, resumen] = await Promise.all([
      api.obtener('/caja/conceptos?todos=1'),
      api.obtener(`/caja/conceptos/resumen?desde=${primerDiaDelMes()}`).catch(() => ({ porConcepto: [] }))
    ]);
    const gastado = new Map((resumen.porConcepto || []).map((r) => [r.id, r]));

    pantalla.innerHTML = `
      <button class="secundario chico" id="volver">‹ Caja</button>
      <h2 style="margin-top:14px">Gastos que se repiten</h2>
      <p class="ayuda">
        El desayuno de los muchachos es todos los días y nunca es igual. Dado
        de alta aquí, el cajero lo toca en vez de escribirlo, y a fin de mes
        se puede sumar cuánto se fue en desayunos. Escrito a mano no se
        puede: nadie escribe igual dos veces.
      </p>

      <div class="ancho-completo">
        <div class="tarjeta plana">
          <div class="hist-envoltura">
            <table class="tabla hist-tabla concepto-tabla">
              <tr>
                <th class="cp-c-nombre">Concepto</th>
                <th class="cp-c-tipo">Qué es</th>
                <th class="cp-c-mes der">Este mes</th>
                <th class="cp-c-usos der">Veces</th>
                <th class="cp-c-acciones"></th>
              </tr>
              ${conceptos.map((c) => {
                const g = gastado.get(c.id);
                return `
                <tr class="${c.activo ? '' : 'anulada'}">
                  <td class="cp-c-nombre">
                    <strong>${esc(c.nombre)}</strong>
                    ${c.ayuda ? `<small>${esc(c.ayuda)}</small>` : ''}
                  </td>
                  <td class="cp-c-tipo">
                    <span class="hist-que ${c.tipo === 'salida' ? 'que-gasto' : 'que-entrada'}">
                      ${c.tipo === 'salida' ? '📤 Sale' : '📥 Entra'}
                    </span>
                    ${c.es_traspaso
                      ? `<span class="hist-que que-cambio"
                               title="El dinero no se gastó: cambió de sitio. No cuenta como gasto de la fábrica.">⇄ Traspaso</span>`
                      : ''}
                    ${c.activo ? '' : '<span class="hist-que que-cancelada">de baja</span>'}
                  </td>
                  <td class="cp-c-mes der">${g ? pesos(g.centavos) : '—'}</td>
                  <td class="cp-c-usos der">${g ? g.veces : 0}</td>
                  <td class="cp-c-acciones">
                    <button class="secundario chico" data-editar="${esc(c.id)}">Editar</button>
                    <button class="secundario chico" data-baja="${esc(c.id)}"
                            title="${c.activo ? 'Dejar de usarlo' : 'Volver a usarlo'}">
                      ${c.activo ? '🗑' : '↩'}
                    </button>
                    ${c.activo ? '' : `
                      <button class="secundario chico" data-eliminar="${esc(c.id)}"
                              title="Borrarlo de esta lista para siempre. Sus gastos no se tocan.">✕</button>`}
                  </td>
                </tr>`; }).join('')
                || '<tr><td colspan="5">Todavía no hay ninguno.</td></tr>'}
            </table>
          </div>
        </div>
      </div>

      <button id="nuevo" style="margin-top:14px">＋ Nuevo concepto</button>

      <p class="ayuda" style="margin-top:14px">
        Dar de baja uno <b>no borra nada</b>: deja de salir en la caja y los
        gastos que ya se anotaron con él siguen sumando. Un gasto de marzo no
        desaparece porque en agosto se deje de usar.
      </p>`;

    pantalla.querySelector('#volver').onclick = pintar;
    pantalla.querySelector('#nuevo').onclick = () => nuevoConcepto();
    pantalla.querySelectorAll('[data-editar]').forEach((b) => {
      b.onclick = () => editarConcepto(conceptos.find((c) => c.id === b.dataset.editar));
    });
    pantalla.querySelectorAll('[data-baja]').forEach((b) => {
      b.onclick = () => cambiarBaja(conceptos.find((c) => c.id === b.dataset.baja));
    });
    pantalla.querySelectorAll('[data-eliminar]').forEach((b) => {
      b.onclick = () => eliminarConcepto(conceptos.find((c) => c.id === b.dataset.eliminar));
    });
  }

  /**
   * Borrarlo de la lista, ahora sí para siempre. NO borra registros: los
   * gastos anotados con él siguen en el historial y en las estadísticas.
   * Solo desaparece el renglón del catálogo, que era lo que estorbaba.
   */
  async function eliminarConcepto(c) {
    if (!c) return;
    if (!await confirmar({
      titulo: `¿Borrar "${c.nombre}" de esta lista?`,
      texto: 'Desaparece de aquí para siempre; ya no se puede recuperar con ↩. ' +
             'Lo que se anotó con él NO se borra: sigue en el historial y sigue ' +
             'sumando en las cuentas.',
      ok: 'Borrarlo de la lista', peligro: true
    })) return;
    try {
      await api.enviar(`/caja/conceptos/${c.id}/eliminar`, {});
      avisar(`"${c.nombre}" ya no sale en la lista`, 'bien');
      verConceptos();
    } catch (e) { avisar(e.message, 'error'); }
  }

  /** El día 1 del mes en curso, en hora local. */
  function primerDiaDelMes() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }

  async function nuevoConcepto() {
    const nombre = await pedirTexto({
      titulo: 'Nuevo gasto que se repite',
      texto: 'Cómo se va a llamar. Corto, que es lo que va a tocar el cajero.',
      marcador: 'Desayuno', ok: 'Siguiente', largo: 40, unaLinea: true
    });
    if (!nombre) return;

    const tipo = await menu({
      titulo: nombre,
      texto: '¿El dinero sale del cajón o entra?',
      opciones: [
        { valor: 'salida',  texto: '📤 Sale del cajón', detalle: 'Un gasto: gasolina, desayuno…' },
        { valor: 'entrada', texto: '📥 Entra al cajón', detalle: 'Cambio del banco, dinero repuesto…' }
      ]
    });
    if (!tipo) return;

    // EL DINERO QUE SOLO SE MUEVE. Un retiro a la caja fuerte sale del
    // cajón pero no sale de la empresa. Si no se distingue, cuando se
    // capture el gasto que se pagó con ese efectivo el mismo peso quedaría
    // contado dos veces.
    const que = await menu({
      titulo: nombre,
      texto: '¿El dinero se GASTA, o solo cambia de sitio?',
      opciones: [
        { valor: 'gasto', texto: '💸 Se gasta',
          detalle: 'Sale de la empresa: gasolina, desayuno, una refacción' },
        { valor: 'traspaso', texto: '⇄ Solo cambia de sitio',
          detalle: 'Un retiro a la caja fuerte, dinero que se pasa a otro lado' }
      ]
    });
    if (!que) return;

    const ayuda = await pedirTexto({
      titulo: nombre, texto: 'Una nota para el cajero (opcional).',
      marcador: 'El de los muchachos, no el del patrón',
      ok: 'Crear', largo: 120, unaLinea: true
    });
    if (ayuda === null) return;

    try {
      await api.enviar('/caja/conceptos', {
        nombre, tipo, ayuda, esTraspaso: que === 'traspaso' });
      avisar(`"${nombre}" ya se puede tocar en la caja`, 'bien');
      verConceptos();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function editarConcepto(c) {
    if (!c) return;
    const nombre = await pedirTexto({
      titulo: `Editar ${c.nombre}`,
      texto: 'Cambiarle el nombre no parte la estadística: los gastos viejos ' +
             'siguen contando aquí, y sus comprobantes siguen diciendo lo que decían.',
      valor: c.nombre, ok: 'Siguiente', largo: 40, unaLinea: true
    });
    if (nombre === null) return;

    const ayuda = await pedirTexto({
      titulo: nombre || c.nombre, texto: 'La nota para el cajero.',
      valor: c.ayuda || '', ok: 'Guardar', largo: 120, unaLinea: true
    });
    if (ayuda === null) return;

    try {
      await api.actualizar(`/caja/conceptos/${c.id}`, { nombre: nombre || c.nombre, ayuda });
      avisar('Guardado', 'bien');
      verConceptos();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function cambiarBaja(c) {
    if (!c) return;
    if (c.activo && !await confirmar({
      titulo: `¿Dejar de usar "${c.nombre}"?`,
      texto: 'Deja de salir en la caja. Lo que ya se anotó con él no se toca ' +
             'y sigue sumando en las cuentas del mes.',
      ok: 'Dar de baja', peligro: true
    })) return;

    try {
      await api.actualizar(`/caja/conceptos/${c.id}`, { activo: !c.activo });
      avisar(c.activo ? 'Dado de baja' : 'Vuelve a estar disponible', 'bien');
      verConceptos();
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

        ${corte.porPersona?.length > 1 ? `
          <div class="ticket-folio" style="margin-top:10px">CADA QUIEN</div>
          <table class="ticket-tabla">
            ${corte.porPersona.map((p) => `
              <tr><td>${esc(p.nombre)}<br><small>${p.cobradas} ticket${p.cobradas === 1 ? '' : 's'}${
                p.salidas ? ` · gastos ${pesos(p.salidas)}` : ''}</small></td>
                  <td>${pesos(p.efectivo)}</td></tr>`).join('')}
          </table>` : ''}

        ${movimientosEnDosColumnas(corte.movimientos)}

        <div class="ticket-pie">
          <div>Cerró: ${esc(c.cerrada_por_nombre || '—')}</div>
          <div class="ticket-firma">Firma: ______________________</div>
        </div>
      </div>

      ${corte.porPersona?.length > 1 ? `
        <p class="ayuda no-imprimir" style="margin-top:14px">
          En este turno estuvo más de una persona en la caja. Al imprimir sale
          <b>un papel por cada una</b> con lo suyo, además del corte del turno:
          el dinero del cajón es uno solo, pero cada quien firma lo que metió.
        </p>` : ''}

      <div class="fila-botones no-imprimir" style="margin-top:14px;flex-wrap:wrap">
        <button id="imprimir">🖨️ Imprimir el corte y el día</button>
        <button class="secundario" id="compartir">📲 Mandar por WhatsApp</button>
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

    /**
     * IMPRIMIR EL CORTE.
     *
     * Primero por la impresora de tickets, que sale al instante y sin
     * ventana de por medio. Solo si no hay impresora configurada se cae al
     * navegador, que es el que abre el cuadro de "elegir impresora".
     */
    pantalla.querySelector('#imprimir').onclick = async (ev) => {
      const boton = ev.currentTarget;
      boton.disabled = true;
      try {
        const r = await api.enviar(`/impresion/corte/${corte.caja.id}`, {});
        if (r.impreso) avisar(`Impreso · ${r.papeles} papel${r.papeles === 1 ? '' : 'es'}`, 'bien');
        else window.print();               // sin impresora puesta, el navegador
      } catch (e) {
        avisar(e.message, 'error');
      }
      boton.disabled = false;
    };

    // AL CERRAR EL TURNO EL CORTE SALE SOLO. Nadie tiene que acordarse de
    // apretar un botón para el papel que se firma todos los días: si hay
    // impresora puesta, se imprime en cuanto se cuenta el dinero. Solo la
    // primera vez que se ve el corte —al cerrar—, no cada vez que alguien
    // lo consulta desde el historial de cortes.
    if (cerroSesion) {
      api.enviar(`/impresion/corte/${corte.caja.id}`, {})
        .then((r) => {
          if (r.impreso) avisar(`Corte impreso · ${r.papeles} papeles`, 'bien');
        })
        .catch(() => avisar('El corte quedó guardado, pero no se pudo imprimir', 'error'));
    }

    // La imagen del corte se arma en el momento, en el aparato: no se sube
    // a ningún lado ni pasa por el servidor.
    pantalla.querySelector('#compartir').onclick = async (ev) => {
      const boton = ev.currentTarget;
      boton.disabled = true;
      try {
        const como = await compartirCorte({
          negocio: marca.nombreNegocio, corte,
          pesos, fecha: formatoFecha, rango
        });
        if (como === 'descargado') {
          avisar('Se bajó la imagen del corte. Arrástrala al chat de WhatsApp.', '');
        } else if (como === 'compartido') {
          avisar('Corte compartido', 'bien');
        }
      } catch (e) {
        avisar('No se pudo armar la imagen del corte: ' + e.message, 'error');
      }
      boton.disabled = false;
    };

    const siguiente = pantalla.querySelector('#siguiente-cajero');
    if (siguiente) siguiente.onclick = () => alTerminar?.();
  }

  /**
   * LOS MOVIMIENTOS DEL CORTE, EN DOS COLUMNAS  (v1.9)
   *
   * Un día de gastos son quince renglones —gasolina, refacción, la comida—
   * y las entradas son dos. En una sola columna eso es un palmo de papel
   * por cada corte, todos los días. Partido en dos, cabe en la mitad.
   *
   * Si un lado va vacío no se parte: media hoja en blanco al lado de tres
   * renglones no ahorra nada y se lee peor.
   */
  function movimientosEnDosColumnas(movimientos) {
    if (!movimientos.length) return '';

    const gastos = movimientos.filter((m) => m.tipo === 'salida');
    const entradas = movimientos.filter((m) => m.tipo !== 'salida');
    const suma = (lista) => lista.filter((m) => !m.anulado_en)
                                 .reduce((t, m) => t + m.centavos, 0);

    const columna = (titulo, lista, signo) => !lista.length ? '' : `
      <div class="ticket-columna">
        <div class="ticket-nombre">${titulo} (${lista.length})</div>
        <table class="ticket-tabla">
          ${lista.map((m) => `
            <tr class="${m.anulado_en ? 'anulada' : ''}">
              <td>${m.anulado_en ? '(anulado) ' : ''}${esc(m.concepto)}</td>
              <td>${m.anulado_en ? '—' : signo + pesos(m.centavos)}</td>
            </tr>`).join('')}
          <tr class="fuerte"><td>Suman</td><td>${signo}${pesos(suma(lista))}</td></tr>
        </table>
      </div>`;

    const dos = gastos.length && entradas.length;
    return `
      <div class="ticket-movimientos ${dos ? 'dos-columnas' : ''}" style="margin-top:10px">
        ${columna('GASTOS', gastos, '−')}
        ${columna('ENTRADAS', entradas, '+')}
      </div>`;
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
