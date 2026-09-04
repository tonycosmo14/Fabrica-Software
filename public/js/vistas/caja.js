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
import { pesos, crearTeclado, aTexto as textoFraccion, deTexto } from '../fracciones.js';
import { cargarMarca } from '../marca.js';
import { compartirCorte } from '../corte-imagen.js';
import { hacerVale } from '../vale.js';

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
  // Recibir el dinero de un turno es del gerente o del dueño: que lo
  // hiciera el propio cajero sería firmarse a sí mismo la entrega.
  const puedeRecibir = esAdmin || estadoApp.permisos.includes('caja.recibir');

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
            ${(() => {
              // GASTOS Y VALES, EN DOS RENGLONES  (v4.3). La gasolina y los
              // $2,000 que se llevó el patrón salían sumados, y así un turno
              // con mucha salida no dice si la fábrica gastó o si nada más
              // movieron el dinero. Los dos ya están restados del esperado:
              // esto no cambia ninguna cuenta, parte la explicación.
              const v = e.porVales;
              if (!v || !v.valesCentavos) {
                return `<div class="cuadre-linea vendido">
                  <span>− Gastos y retiros</span><strong>${pesos(e.salidas)}</strong>
                </div>`;
              }
              return `
                ${v.gastosCentavos ? `
                  <div class="cuadre-linea vendido">
                    <span>− Gastos</span><strong>${pesos(v.gastosCentavos)}</strong>
                  </div>` : ''}
                <div class="cuadre-linea vendido">
                  <span>− Vales (${v.vales.length})</span>
                  <strong>${pesos(v.valesCentavos)}</strong>
                </div>`;
            })()}
            <div class="cuadre-linea total">
              <span>= Debería haber en el cajón</span><strong>${pesos(e.esperado)}</strong>
            </div>
          </div>

          ${e.vendidoFiado ? `
            <p class="ayuda" style="margin:12px 0 0">
              Salieron <strong>${pesos(e.vendidoFiado)} a crédito</strong> en este turno.
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
              <button class="secundario" id="salida">− Gasto</button>
              <button class="secundario" id="entrada">＋ Meter dinero</button>
              <button class="secundario ancho-completo-boton" id="vale"
                      title="Alguien se llevó efectivo del cajón">📤 Vale</button>
            </div>
            <!-- Ya no dice "y contar": desde la v4.1 el corte no cuenta el
                 dinero. Cuenta el HIELO, hace el corte y lo imprime. -->
            <button class="grande" id="cerrar" style="margin-top:10px;width:100%">
              Terminar el turno
            </button>
            <p class="ayuda" style="margin:8px 0 0;font-size:13px">
              Se anotan los paños y el hielo del cuarto frío, y sale el corte
              con lo que <b>debería haber</b> en el cajón. Contar el dinero es
              después, cuando se entrega.
            </p>` : ''}
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
                  <td class="quitar">
                    <div class="fila-tachitas">
                      <button class="tachita papel" data-copia="${esc(m.id)}"
                              title="Sacarle otra copia al comprobante"
                              aria-label="Imprimir otra copia">🖨️</button>
                      ${puedeCorregir ? `
                        <button class="tachita" data-anular="${esc(m.id)}"
                                title="Anularlo"
                                aria-label="Anular este movimiento">×</button>
                        ${esAdmin ? `
                          <button class="tachita borrar" data-borrar="${esc(m.id)}"
                                  title="Borrarlo de verdad"
                                  aria-label="Borrar este movimiento">🗑</button>` : ''}` : ''}
                    </div>
                  </td>
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
      pantalla.querySelector('#vale').onclick = async () => {
        if (await hacerVale()) pintar();
      };
      pantalla.querySelector('#cerrar').onclick = () => terminarTurno(e, sinDueno);
    }

    // OTRA COPIA DEL COMPROBANTE  (v4.0)
    //
    // El comprobante de un gasto sale solo al anotarlo, pero se pierde, se
    // moja o hace falta uno para el que se llevó el dinero y otro para la
    // carpeta. Sacarlo otra vez no cambia nada: es el mismo papel.
    pantalla.querySelectorAll('[data-copia]').forEach((b) => {
      b.onclick = async () => {
        b.disabled = true;
        try {
          const r = await api.enviar(`/impresion/movimiento/${b.dataset.copia}`, { copia: true });
          avisar(r.impreso ? 'Copia impresa' : 'No hay impresora configurada',
                 r.impreso ? 'bien' : '');
        } catch (e) { avisar(e.message, 'error'); }
        b.disabled = false;
      };
    });

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
                    ${c.es_vale
                      ? `<span class="hist-que que-vale"
                               title="Se usa desde el botón 📤 Vale de la caja. No se puede dar de baja.">📤 Vale</span>`
                      : ''}
                    ${c.activo ? '' : '<span class="hist-que que-cancelada">de baja</span>'}
                  </td>
                  <td class="cp-c-mes der">${g ? pesos(g.centavos) : '—'}</td>
                  <td class="cp-c-usos der">${g ? g.veces : 0}</td>
                  <td class="cp-c-acciones">
                    <button class="secundario chico" data-editar="${esc(c.id)}">Editar</button>
                    <!-- LOS DOS CONCEPTOS DE VALE NO SE DAN DE BAJA (v4.4).
                         No son gastos que alguien dio de alta: son lo que
                         hace funcionar el botón de vales. Dándolos de baja
                         desde aquí, el botón dejaba de servir sin que nada
                         lo dijera. Renombrarlos sí se puede. -->
                    ${c.es_vale ? '' : `
                      <button class="secundario chico" data-baja="${esc(c.id)}"
                              title="${c.activo ? 'Dejar de usarlo' : 'Volver a usarlo'}">
                        ${c.activo ? '🗑' : '↩'}
                      </button>
                      ${c.activo ? '' : `
                        <button class="secundario chico" data-eliminar="${esc(c.id)}"
                                title="Borrarlo de esta lista para siempre. Sus gastos no se tocan.">✕</button>`}`}
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
      </p>
      <p class="ayuda" style="margin-top:8px">
        Los marcados <b>📤 Vale</b> no se pueden dar de baja: no son gastos
        que se dieron de alta aquí, son los que hacen funcionar el botón
        <b>📤 Vale</b> de la caja. Cambiarles el nombre sí se puede.
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
  /**
   * TERMINAR EL TURNO  (rehecho en la v4.1)
   *
   * Anotar la existencia y hacer el corte de caja eran la misma cosa hecha
   * dos veces: se hacen al mismo tiempo, con la misma persona enfrente y
   * con los mismos números en la boca. Ahora es un solo momento, y adentro
   * van los cuatro pasos en el orden en que se cantan de verdad:
   *
   *   1. qué paños se sacaron        (la pantalla de Producción, entera)
   *   2. cuánto hielo queda en el cuarto frío
   *   3. si se cortó hielo para bolsas, y cuánto
   *   4. cuántas bolsas salieron de ese hielo
   *
   * Y EL DINERO NO SE CUENTA. "Como los cortes son rápidos y se tiene que
   * seguir atendiendo": sale el papel con lo que debía haber, el cajero
   * entrega el cajón y sigue vendiendo. Quien cuenta es el dueño o el
   * gerente cuando llegan (⋯ en el historial de cortes).
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
              detalle: 'Se hace tu corte y la venta sigue. Lo que entre se aparta para quien llegue.' }
          ]
        });
    if (!como) return;

    // Lo que se va anotando por el camino. Nada se guarda hasta el final:
    // un corte a medias —con el hielo contado y el turno abierto— dejaría
    // la fábrica en un estado que nadie sabría cómo terminar.
    const cierre = { como, marquetas: null, cortadas: null, bolsas: null, almacenId: null };

    pasoPanos(cierre);
  }

  /** PASO 1 · Los paños, en la pantalla de Producción de siempre. */
  async function pasoPanos(cierre) {
    const { vistaProduccion } = await import('./produccion.js');
    return vistaProduccion(pantalla, estadoApp, {
      enCorte: true,
      alSeguir: () => pasoCuartoFrio(cierre)
    });
  }

  /**
   * PASO 2 · Cuánto hielo queda.
   *
   * NO se enseña lo que debería haber. Con ese número delante, contar se
   * vuelve confirmar —se aprieta aceptar y el cuadre da cero siempre— y el
   * conteo deja de servir para lo único que sirve, que es descubrir lo que
   * no cuadra. El número sale enseguida, en el resultado.
   */
  async function pasoCuartoFrio(cierre) {
    let almacenes = [];
    try { almacenes = (await api.obtener('/existencia')).almacenes; }
    catch (err) { return avisar(err.message, 'error'); }

    const almacen = almacenes.find((a) => a.almacen.recibe_produccion) || almacenes[0];
    if (!almacen) return cerrarDeVerdad(cierre);
    cierre.almacenId = almacen.almacen.id;

    pantalla.innerHTML = `
      <div class="corte-paso">
        <div class="crece">
          <span class="corte-paso-num">Paso 2 de 4</span>
          <strong>¿Cuánto hielo queda en ${esc(almacen.almacen.nombre)}?</strong>
          <small>Cuéntalo y escríbelo. Puede llevar fracción: 14 y 5/8.</small>
        </div>
      </div>

      <div class="tarjeta">
        <form id="f">
          <!-- EL TECLADO DE FRACCIONES, el mismo de siempre: suma. Se toca
               1/8 y luego 1/16 y quedan 3/16. Una lista de fracciones
               sueltas no da 3/16 ni 11/16, y así es como se dictan. -->
          <div id="teclado"></div>
          <label for="escrito" class="etiqueta-chica" style="margin-top:12px">
            o escríbelo tal cual
          </label>
          <input id="escrito" class="frac-escrito" inputmode="text"
                 placeholder="14 y 5/8" autocomplete="off">
          <p class="dialogo-error" id="malo" hidden>
            No se entiende. Escríbelo como <strong>14 5/8</strong>, y en
            octavos o dieciseisavos: la marqueta no se parte en tercios.
          </p>
          <button type="submit" style="margin-top:18px">Siguiente →</button>
        </form>
      </div>

      <button class="secundario chico" id="atras" style="margin-top:12px">‹ Volver a los paños</button>`;

    const q = (sel) => pantalla.querySelector(sel);
    const escrito = q('#escrito');
    const malo = q('#malo');

    const teclado = crearTeclado(q('#teclado'), {
      valor: cierre.marquetas || 0,
      alCambiar: (n) => {
        if (document.activeElement !== escrito) escrito.value = n ? textoFraccion(n) : '';
        malo.hidden = true;
      }
    });
    if (cierre.marquetas) escrito.value = textoFraccion(cierre.marquetas);

    escrito.oninput = () => {
      const n = deTexto(escrito.value);
      malo.hidden = escrito.value.trim() === '' || n !== null;
      if (n !== null) teclado.poner(n);
    };

    q('#atras').onclick = () => pasoPanos(cierre);
    q('#f').onsubmit = (ev) => {
      ev.preventDefault();
      // Escrito a mano y no se entiende: no se guarda nada. Un conteo mal
      // leído es peor que uno que no se hizo.
      if (escrito.value.trim() && deTexto(escrito.value) === null) {
        malo.hidden = false;
        escrito.focus();
        return;
      }
      cierre.marquetas = teclado.valor();
      pasoCortado(cierre);
    };
  }

  /** PASO 3 · ¿Se cortó hielo para bolsas? */
  function pasoCortado(cierre) {
    pantalla.innerHTML = `
      <div class="corte-paso">
        <div class="crece">
          <span class="corte-paso-num">Paso 3 de 4</span>
          <strong>¿Se cortó hielo para bolsas?</strong>
          <small>
            Las marquetas que se agarraron del cuarto frío para hacer hielo
            gourmet. No se perdieron: se transformaron, y por eso van aparte
            de lo que se derrite.
          </small>
        </div>
      </div>

      <div class="tarjeta">
        <div class="fila-botones">
          <button class="secundario grande crece" id="no">No se cortó nada</button>
          <button class="grande crece" id="si">Sí, se cortó</button>
        </div>

        <form id="f" hidden style="margin-top:18px">
          <label>
            <span class="etiqueta-chica">Cuántas marquetas se cortaron</span>
            <input id="cortadas" class="campo-importe" inputmode="numeric"
                   autocomplete="off" placeholder="3">
          </label>
          <button type="submit" style="margin-top:18px">Siguiente →</button>
        </form>
      </div>

      <button class="secundario chico" id="atras" style="margin-top:12px">‹ Volver al conteo</button>`;

    const q = (sel) => pantalla.querySelector(sel);
    q('#atras').onclick = () => pasoCuartoFrio(cierre);
    q('#no').onclick = () => { cierre.cortadas = null; cierre.bolsas = null; cerrarDeVerdad(cierre); };
    q('#si').onclick = () => {
      q('#f').hidden = false;
      q('#cortadas').focus();
    };
    q('#f').onsubmit = (ev) => {
      ev.preventDefault();
      const n = Number(q('#cortadas').value);
      if (!Number.isInteger(n) || n <= 0) {
        return avisar('Escribe cuántas marquetas se cortaron.', 'error');
      }
      cierre.cortadas = n * 16;
      pasoBolsas(cierre);
    };
  }

  /** PASO 4 · Cuántas bolsas salieron de ese hielo. */
  function pasoBolsas(cierre) {
    pantalla.innerHTML = `
      <div class="corte-paso">
        <div class="crece">
          <span class="corte-paso-num">Paso 4 de 4</span>
          <strong>¿Cuántas bolsas salieron?</strong>
          <small>
            De las ${cierre.cortadas / 16} marquetas que se cortaron. Se le
            suman a la <b>bolsa de hielo gourmet</b>, y desde ahí se venden
            como cualquier otra cosa.
          </small>
        </div>
      </div>

      <div class="tarjeta">
        <form id="f">
          <label>
            <span class="etiqueta-chica">Bolsas<small>déjalo vacío si nadie las contó</small></span>
            <input id="bolsas" class="campo-importe" inputmode="numeric"
                   autocomplete="off" placeholder="42">
          </label>
          <p class="ayuda" style="margin:10px 0 0">
            Si nadie las contó, se deja vacío. Un cero mañana parecería un
            dato, y no lo es.
          </p>
          <button type="submit" style="margin-top:18px">Terminar el turno</button>
        </form>
      </div>

      <button class="secundario chico" id="atras" style="margin-top:12px">‹ Volver</button>`;

    const q = (sel) => pantalla.querySelector(sel);
    setTimeout(() => q('#bolsas').focus(), 150);
    q('#atras').onclick = () => pasoCortado(cierre);
    q('#f').onsubmit = (ev) => {
      ev.preventDefault();
      const t = q('#bolsas').value.trim();
      if (t !== '') {
        const n = Number(t);
        if (!Number.isInteger(n) || n < 0) {
          return avisar('Las bolsas se escriben en números enteros.', 'error');
        }
        cierre.bolsas = n;
      }
      cerrarDeVerdad(cierre);
    };
  }

  /**
   * Y AHORA SÍ, TODO JUNTO.
   *
   * EL ORDEN DE GUARDADO NO ES EL ORDEN DE PREGUNTAR. Se pregunta como se
   * canta —primero cuánto queda, luego si se cortó— pero se guarda como
   * manda la aritmética: el hielo cortado PRIMERO, porque el conteo se
   * congela con la foto de lo que se había explicado hasta ese momento, y
   * si el corte de hielo entrara después, esas marquetas aparecerían como
   * faltante.
   */
  async function cerrarDeVerdad(cierre) {
    pantalla.innerHTML = '<div class="cargando">Cerrando el turno…</div>';

    try {
      const caja = (await api.obtener('/caja')).abierta;
      const cajaId = caja?.caja?.id || null;

      if (cierre.cortadas) {
        await api.enviar('/existencia/cortes', {
          almacenId: cierre.almacenId,
          dieciseisavos: cierre.cortadas,
          ...(cierre.bolsas === null ? {} : { bolsas: cierre.bolsas }),
          cajaId
        });
      }

      if (cierre.marquetas !== null && cierre.almacenId) {
        await api.enviar('/existencia/conteos', {
          almacenId: cierre.almacenId, dieciseisavos: cierre.marquetas, cajaId
        });
      }

      const r = await api.enviar(`/caja/${cierre.como === 'entregar' ? 'entregar' : 'cerrar'}`, {});
      verCorte(r.corte.caja.id, r.corte, { cerroSesion: cierre.como === 'cerrar' });
    } catch (err) {
      avisar(err.message, 'error');
      pintar();
    }
  }

  // ==========================================================
  // EL CORTE, CON SU TICKET
  // ==========================================================
  async function verCorte(id, yaCargado, { cerroSesion = false } = {}) {
    const { corte } = yaCargado ? { corte: yaCargado } : await api.obtener(`/caja/cortes/${id}`);
    const c = corte.caja;

    // SIN CONTAR TODAVÍA. Desde la v4.1 el turno se cierra sin contar el
    // dinero: la diferencia llega vacía hasta que alguien recibe la
    // entrega. Ni "cuadró" ni "falta" — no se sabe, y eso es un dato.
    const dif = c.diferencia_centavos;
    const sinContar = dif === null || dif === undefined;
    const cuadra = dif === 0;
    const sobra = dif > 0;
    const recibida = c.entregado_centavos != null;

    pantalla.innerHTML = `
      <button class="secundario chico no-imprimir" id="volver">‹ Caja</button>

      <!-- DOS COLUMNAS: EL DINERO Y EL HIELO  (v4.4)
           Son las dos cuentas del turno y se miran juntas — "cuadró el
           dinero pero faltó hielo" es una sola pregunta, no dos. Puestas
           una debajo de otra había que rodar la pantalla para compararlas.
           En pantalla angosta se apilan solas. -->
      <div class="corte-tablero">
       <div class="corte-columna">

      <div class="tarjeta ${sinContar ? '' : cuadra ? 'cuadre-exacto'
                              : sobra ? 'cuadre-sobra' : 'cuadre-diferencia'}"
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
          ${(() => {
            const v = corte.salidas;
            const cuadran = v && v.valesCentavos > 0
              && v.gastosCentavos + v.valesCentavos === c.salidas_centavos;
            if (!cuadran) {
              return `<div class="cuadre-linea vendido"><span>− Gastos y retiros</span><strong>${pesos(c.salidas_centavos)}</strong></div>`;
            }
            return `
              ${v.gastosCentavos ? `
                <div class="cuadre-linea vendido"><span>− Gastos</span><strong>${pesos(v.gastosCentavos)}</strong></div>` : ''}
              <div class="cuadre-linea vendido">
                <span>− Vales (${v.vales.length})</span>
                <strong>${pesos(v.valesCentavos)}</strong>
              </div>`;
          })()}
          <div class="cuadre-linea total"><span>= Debería haber</span><strong>${pesos(c.esperado_centavos)}</strong></div>
          ${recibida
            ? `<div class="cuadre-linea contado"><span>− Te entregaron</span><strong>${pesos(c.entregado_centavos)}</strong></div>`
            : c.contado_centavos != null
              ? `<div class="cuadre-linea contado"><span>− Contaste</span><strong>${pesos(c.contado_centavos)}</strong></div>`
              : ''}
        </div>

        ${sinContar ? `
          <div class="salidas sin-contar">
            <span>Todavía sin contar</span>
            <strong>${pesos(c.esperado_centavos)}</strong>
            <small>es lo que debería haber en el cajón</small>
          </div>

          <p class="ayuda" style="margin:14px 0 0">
            El turno se cierra <b>sin contar</b> para no parar la venta. Quien
            reciba el dinero anota aquí cuánto le entregaron, y de ahí sale la
            diferencia.
          </p>

          ${puedeRecibir ? `
            <button class="no-imprimir" id="anotar-entrega" style="margin-top:14px">
              💵 Anotar lo que me entregaron
            </button>` : ''}
        ` : `
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

          ${recibida ? `
            <p class="ayuda" style="margin:8px 0 0">
              Lo recibió <b>${esc(c.recibido_por_nombre || '—')}</b>
              · ${esc(formatoFecha(c.recibido_en))}
              ${c.notas_entrega ? `<br>«${esc(c.notas_entrega)}»` : ''}
            </p>
            ${puedeRecibir ? `
              <button class="secundario chico no-imprimir" id="anotar-entrega"
                      style="margin-top:10px">Corregir lo que entregaron</button>` : ''}
          ` : ''}
        `}

        ${c.corregido_en ? avisoCorregido(c) : ''}
      </div>

      ${valesDelTurno(corte)}

       </div>
       <div class="corte-columna">

      ${corte.hielo ? cuadreDelHielo(corte.hielo) : `
        <div class="aviso-sin-caja" style="margin-top:14px">
          <strong>Este turno no contó el hielo.</strong>
          Sin conteo no hay cuadre: no se puede decir si faltó o sobró
          hielo, porque nadie lo contó. Se cuenta al terminar el turno.
        </div>`}

       </div>
      </div>

      <!-- Y los dos papeles, tal como salen de la impresora, también lado
           a lado: son las dos hojas de un mismo corte. -->
      <div class="corte-papeles">
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
          ${corte.salidas && corte.salidas.valesCentavos > 0
              && corte.salidas.gastosCentavos + corte.salidas.valesCentavos === c.salidas_centavos
            ? `${corte.salidas.gastosCentavos
                  ? `<tr><td>Gastos</td><td>−${pesos(corte.salidas.gastosCentavos)}</td></tr>` : ''}
               <tr><td>Vales (${corte.salidas.vales.length})</td><td>−${pesos(corte.salidas.valesCentavos)}</td></tr>`
            : `<tr><td>Gastos y retiros</td><td>−${pesos(c.salidas_centavos)}</td></tr>`}
          <tr class="fuerte"><td>Debería haber</td><td>${pesos(c.esperado_centavos)}</td></tr>
          ${recibida
            ? `<tr class="fuerte"><td>Entregado</td><td>${pesos(c.entregado_centavos)}</td></tr>`
            : c.contado_centavos != null
              ? `<tr class="fuerte"><td>Contado</td><td>${pesos(c.contado_centavos)}</td></tr>`
              : ''}
          ${sinContar
            ? '<tr class="fuerte"><td>Sin contar</td><td>—</td></tr>'
            : `<tr class="fuerte"><td>${sobra ? 'Sobra' : cuadra ? 'Diferencia' : 'Falta'}</td>
                   <td>${pesos(Math.abs(dif))}</td></tr>`}
        </table>

        ${sinContar ? `
          <div class="ticket-firma" style="margin-top:10px">Entregado $ _______________</div>` : ''}

        ${corte.porPersona?.length > 1 ? `
          <div class="ticket-folio" style="margin-top:10px">CADA QUIEN</div>
          <table class="ticket-tabla">
            ${corte.porPersona.map((p) => `
              <tr><td>${esc(p.nombre)}<br><small>${p.cobradas} ticket${p.cobradas === 1 ? '' : 's'}${
                p.salidas ? ` · gastos ${pesos(p.salidas)}` : ''}</small></td>
                  <td>${pesos(p.efectivo)}</td></tr>`).join('')}
          </table>` : ''}

        <div class="ticket-pie">
          <div>Cerró: ${esc(c.cerrada_por_nombre || '—')}</div>
          <div class="ticket-firma">Firma: ______________________</div>
        </div>
      </div>

      <!-- EL SEGUNDO PAPEL, igual que sale de la impresora: el primero se
           firma y se entrega con el cajón, este se queda en la carpeta. -->
      ${corte.movimientos.length ? `
        <div class="ticket" id="ticket-detalle">
          <div class="ticket-cabeza">
            <strong>${esc((marca.nombreNegocio || 'Hielo LOLHA').toUpperCase())}</strong>
            <span>${esc(formatoFecha(c.cerrada_en))}</span>
          </div>
          <div class="ticket-folio">DETALLE DEL CORTE #${c.folio}</div>
          ${movimientosEnDosColumnas(corte.movimientos, corte.salidas)}
          <div class="ticket-pie">
            <div>Del turno de ${esc(c.cajero_nombre || '—')}</div>
          </div>
        </div>` : ''}
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
        ${esAdmin && c.cerrada_en
          ? '<button class="secundario" id="corregir-corte">⋯ Corregir este corte</button>' : ''}
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

    const arreglar = pantalla.querySelector('#corregir-corte');
    if (arreglar) arreglar.onclick = () => pantallaCorregir(corte);

    const entrega = pantalla.querySelector('#anotar-entrega');
    if (entrega) entrega.onclick = () => anotarEntrega(c);

    const siguiente = pantalla.querySelector('#siguiente-cajero');
    if (siguiente) siguiente.onclick = () => alTerminar?.();
  }

  /**
   * EL CUADRE DEL HIELO  (v4.2)
   *
   * "Me modifica la existencia y no me dice si faltó o no faltó hielo."
   * Esta es la otra mitad del corte: el dinero salía con todo detalle y el
   * hielo —que es el producto— no decía nada.
   *
   * Va comparado desde el conteo anterior, no desde que abrió el turno: es
   * la ventana del conteo, y es lo que se pidió — "todo comparado desde la
   * última vez que se cortó".
   */
  function cuadreDelHielo(h) {
    const q = h.cuadre;
    const falta = q.faltante > 0;
    const cuadra = q.faltante === 0;
    const frac = (n) => esc(textoFraccion(n));

    return `
      <div class="tarjeta ${cuadra ? 'cuadre-exacto' : falta ? 'cuadre-diferencia' : 'cuadre-sobra'}"
           style="margin-top:14px">
        <h3 style="margin:0 0 4px">El hielo · ${esc(h.almacen || 'cuarto frío')}</h3>
        <p class="ayuda" style="margin:0 0 14px">
          ${h.primerConteo
            ? 'Primer conteo: no hay con qué compararlo todavía.'
            : `Desde el conteo anterior · ${esc(formatoFecha(h.desde))}`}
        </p>

        <div class="cuadre">
          <div class="cuadre-linea"><span>Había</span><strong>${frac(q.anterior)}</strong></div>
          <div class="cuadre-linea suma"><span>+ Se produjo</span><strong>${frac(q.producido)}</strong></div>
          <div class="cuadre-linea total"><span>= Tenía que haber</span><strong>${frac(q.teorico)}</strong></div>
          <div class="cuadre-linea vendido"><span>− Se vendió</span><strong>${frac(q.vendido)}</strong></div>
          <!-- Lo encomendado: vendido pero todavía en el cuarto (suma), y
               recogido ahora de una venta vieja (resta). Sin esto, cada
               encomienda salía como "SOBRA" hasta que el cliente pasaba. -->
          ${q.guardado ? `
            <div class="cuadre-linea suma"><span>+ Se quedó guardado</span><strong>${frac(q.guardado)}</strong></div>` : ''}
          ${q.recogido ? `
            <div class="cuadre-linea vendido"><span>− Pasaron por lo guardado</span><strong>${frac(q.recogido)}</strong></div>` : ''}
          ${q.merma ? `
            <div class="cuadre-linea vendido"><span>− Derretido o roto</span><strong>${frac(q.merma)}</strong></div>` : ''}
          ${q.cortado ? `
            <div class="cuadre-linea vendido"><span>− Se cortó para bolsas</span><strong>${frac(q.cortado)}</strong></div>` : ''}
          <div class="cuadre-linea total"><span>= Debería quedar</span><strong>${frac(q.esperado)}</strong></div>
          <div class="cuadre-linea contado"><span>− Se contó</span><strong>${frac(q.contado)}</strong></div>
        </div>

        <div class="salidas ${cuadra ? 'exacto' : falta ? '' : 'sobra'}">
          <span>${cuadra ? 'Cuadró exacto' : falta ? 'Falta' : 'Sobra'}</span>
          <strong>${cuadra ? '✓' : frac(Math.abs(q.faltante))}</strong>
          <small>${cuadra ? 'todo el hielo que salió tiene su explicación'
            : falta ? 'hielo que nadie explicó' : 'más hielo del que debería'}</small>
        </div>

        ${cuadra ? '' : `
          <p class="ayuda" style="margin:14px 0 0">
            ${falta
              ? 'Ese hielo salió del cuarto frío sin ticket, sin anotarse como derretido y sin cortarse. Es el número que hay que vigilar.'
              : 'Hay más hielo del que debería. Casi siempre falta capturar un paño, o el conteo anterior se quedó corto.'}
          </p>`}
      </div>

      ${papelDelHielo(h)}`;
  }

  /**
   * EL PAPEL DEL HIELO, COMO PAPEL  (v4.4)
   *
   * "Quiero que me muestre más simple: qué paños salieron y quién los sacó,
   *  y que sea como un ticket. Y simplemente cuántas marquetas en total se
   *  vendieron a precio normal y cuántas a mayoreo. Es todo, no necesito
   *  más."
   *
   * Antes iban además los pedazos uno por uno —15 x 1/8, 3 x 1/4…—, las
   * mermas por motivo y lo cortado para bolsas. Los tres SIGUEN contando:
   * están restados arriba, en el cuadre. Lo que se quitó es el desglose,
   * que hacía una tarjeta larguísima que nadie leía de pie.
   */
  function papelDelHielo(h) {
    const frac = (n) => esc(textoFraccion(n));

    return `
      <div class="ticket" id="ticket-hielo">
        <div class="ticket-cabeza">
          <strong>${esc((marca.nombreNegocio || 'Hielo LOLHA').toUpperCase())}</strong>
          <span>${esc(formatoFecha(h.hasta))}</span>
        </div>
        <div class="ticket-folio">PAÑOS SACADOS</div>

        ${h.panos.length ? `
          <table class="ticket-tabla">
            ${h.panos.map((p) => `
              <tr>
                <td>${esc(p.tanque)} #${p.pano}${p.enProceso ? ' <small>a medias</small>' : ''}
                    ${p.quien ? `<small class="vale-quien">${esc(p.quien)}</small>` : ''}</td>
                <td>${p.alAlmacen}</td>
              </tr>`).join('')}
            <tr class="fuerte">
              <td>${h.produccion.cuantos} ${h.produccion.cuantos === 1 ? 'paño' : 'paños'}</td>
              <td>${h.produccion.alAlmacen}</td>
            </tr>
          </table>`
        : '<p class="ticket-vacio">Ninguno</p>'}

        <div class="ticket-folio" style="margin-top:12px">SE VENDIÓ</div>
        ${h.listas.length ? `
          <table class="ticket-tabla">
            ${h.listas.map((l) => `
              <tr>
                <td>${l.tipo === 'mayoreo' ? 'Mayoreo' : 'Público'}
                    <small class="vale-quien">${l.tickets} ${
                      l.tickets === 1 ? 'ticket' : 'tickets'}</small></td>
                <td>${frac(l.dieciseisavos)}</td>
              </tr>`).join('')}
            <tr class="fuerte"><td>Total</td><td>${frac(h.cuadre.vendido)}</td></tr>
          </table>`
        : '<p class="ticket-vacio">Nada</p>'}

        <div class="ticket-pie">
          <div>Contó: ${esc(h.conteo?.ejecutor_nombre || '—')}</div>
        </div>
      </div>`;
  }

  /**
   * ANOTAR EL DINERO QUE ENTREGARON  (v4.1)
   *
   * La otra mitad del corte. El cajero entregó el cajón y se fue; aquí es
   * donde el dueño o el gerente cuentan lo que les dieron, y recién
   * entonces existe la diferencia.
   *
   * NO se enseña lo que debería haber antes de escribirlo, por la misma
   * razón que en el conteo del hielo: con el número delante, contar se
   * vuelve confirmar. Sale enseguida, cuando ya no puede influir.
   */
  async function anotarEntrega(c) {
    const yaHabia = c.entregado_centavos != null;
    const monto = await pedirImporte({
      titulo: yaHabia ? 'Corregir lo que entregaron' : `Turno #${c.folio}`,
      texto: yaHabia
        ? `Estaba anotado ${pesos(c.entregado_centavos)}. Escribe lo correcto.`
        : `Cuenta el dinero que te entregó ${c.cajero_nombre || 'el cajero'} y escríbelo.`,
      ok: 'Anotarlo'
    });
    if (monto === null) return;

    const notas = await pedirTexto({
      titulo: 'Alguna nota',
      texto: 'Opcional. Por ejemplo: "me lo dio al día siguiente".',
      marcador: 'Lo que haga falta recordar', ok: 'Guardar',
      largo: 200, unaLinea: true, opcional: true
    });
    if (notas === null) return;

    try {
      const r = await api.enviar(`/caja/cortes/${c.id}/entregado`,
                                 { monto, notas, corregir: yaHabia });
      const d = r.corte.caja.diferencia_centavos;
      avisar(d === 0 ? 'Cuadró exacto'
        : d > 0 ? `Sobran ${pesos(d)}` : `Faltan ${pesos(-d)}`,
        d === 0 ? 'bien' : 'error');
      verCorte(c.id, r.corte);
    } catch (e) { avisar(e.message, 'error'); }
  }

  /**
   * EL AVISO DE QUE UN CORTE SE CORRIGIÓ.
   *
   * Un corte corregido tiene que poder enseñar las DOS cifras: la que
   * decía el papel que se firmó y la que dice ahora. Sin eso, alguien que
   * guardó su copia impresa vería dos números distintos y no habría manera
   * de saber cuál vale.
   */
  function avisoCorregido(c) {
    const antes = c.diferencia_original_centavos ?? 0;
    const ahora = c.diferencia_centavos ?? 0;

    // Dos tiempos verbales, porque son dos momentos: lo que el papel DECÍA
    // y lo que el corte DICE. Con el mismo verbo para los dos, la frase se
    // lee como si las dos cifras siguieran vivas.
    const decia = (n) => n === 0 ? 'cuadraba exacto'
      : n > 0 ? `sobraban ${pesos(n)}` : `faltaban ${pesos(Math.abs(n))}`;
    const dice = (n) => n === 0 ? 'cuadra exacto'
      : n > 0 ? `sobran ${pesos(n)}` : `faltan ${pesos(Math.abs(n))}`;

    return `
      <div class="corte-corregido">
        <strong>Este corte se corrigió${c.correcciones > 1 ? ` ${c.correcciones} veces` : ''}.</strong>
        <p>
          El papel que se firmó decía que <b>${esc(decia(antes))}</b>;
          ya corregido, <b>${esc(dice(ahora))}</b>.
        </p>
        <p class="ayuda">
          ${esc(c.corregido_por_nombre || '—')} · ${esc(formatoFecha(c.corregido_en))}
          ${c.motivo_correccion ? `<br>«${esc(c.motivo_correccion)}»` : ''}
        </p>
      </div>`;
  }

  /**
   * CORREGIR UN CORTE YA FIRMADO  (v3.9)
   *
   * "A la cajera se le olvidó poner algo y tiene las pruebas para
   * demostrarlo." El caso completo: cerró su turno, el cajón salió corto y
   * quedó escrito un faltante que no existió. Al día siguiente aparece el
   * ticket de la gasolina.
   *
   * Aquí se le agrega ese gasto, o se le quita uno que no era, y el corte
   * se vuelve a sacar solo. Es del administrador y pide motivo: un corte
   * firmado no se cambia sin dejar dicho por qué.
   */
  async function pantallaCorregir(corte) {
    const c = corte.caja;
    let conceptos = [];
    try { conceptos = (await api.obtener('/caja/conceptos')).conceptos; }
    catch { conceptos = []; }

    const vivos = corte.movimientos.filter((m) => !m.anulado_en);

    pantalla.innerHTML = `
      <button class="secundario chico" id="volver">‹ El corte #${c.folio}</button>
      <h2 style="margin-top:14px">Corregir el corte #${c.folio}</h2>
      <p class="ayuda">
        De <b>${esc(c.cajero_nombre || '—')}</b>, ${esc(rango(c.abierta_en, c.cerrada_en))}
        · ahora mismo ${c.diferencia_centavos === 0 ? 'cuadra exacto'
          : c.diferencia_centavos > 0 ? `sobran ${pesos(c.diferencia_centavos)}`
          : `faltan ${pesos(Math.abs(c.diferencia_centavos))}`}.
      </p>

      <div class="aviso-sin-caja" style="margin:12px 0">
        <strong>Esto cambia un papel que ya se firmó.</strong>
        Lo que se contó en el cajón no se toca —eso fue lo que había—, pero
        sí lo que <b>debía</b> haber, y con ello la diferencia. Lo que decía
        antes se guarda y sigue saliendo en el corte, con tu nombre y el
        motivo.
      </div>

      <div class="tarjeta">
        <h3 class="emp-sub" style="margin-top:0">Agregarle algo que se olvidó</h3>
        <form id="f">
          <div class="emp-campos">
            <label>
              <span class="etiqueta-chica">Qué fue</span>
              <select id="tipo">
                <option value="salida">Un gasto o un retiro</option>
                <option value="entrada">Una entrada de dinero</option>
              </select>
            </label>
            <label>
              <span class="etiqueta-chica">En qué</span>
              <select id="concepto">
                <option value="">✎ Escribirlo</option>
                ${conceptos.map((x) => `
                  <option value="${esc(x.id)}" data-tipo="${esc(x.tipo)}">
                    ${esc(x.nombre)}
                  </option>`).join('')}
              </select>
            </label>
            <label id="campo-otro">
              <span class="etiqueta-chica">Escríbelo</span>
              <input id="otro" maxlength="80" placeholder="Gasolina de la camioneta">
            </label>
            <label>
              <span class="etiqueta-chica">Cuánto</span>
              <input id="monto" inputmode="decimal" placeholder="200">
            </label>
          </div>

          <label>
            <span class="etiqueta-chica">Notas<small>opcional</small></span>
            <input id="notas" maxlength="300" placeholder="Trajo el ticket de la gasolinera">
          </label>

          <label>
            <span class="etiqueta-chica">Por qué se corrige<small>queda escrito en el corte</small></span>
            <input id="motivo" maxlength="200" required
                   placeholder="Se le olvidó anotarlo y trajo el ticket">
          </label>

          <button type="submit" style="margin-top:18px">Agregarlo y volver a sacar el corte</button>
        </form>
      </div>

      <div class="tarjeta plana">
        <h3 class="emp-sub" style="margin-top:0">Quitarle algo que no era</h3>
        ${vivos.length ? `
          <table class="tabla">
            <tr><th>Qué</th><th>Tipo</th><th class="der">Cuánto</th><th></th></tr>
            ${vivos.map((m) => `
              <tr>
                <td>${esc(m.concepto)}
                    ${m.tras_corte ? '<small>agregado después del corte</small>' : ''}</td>
                <td>${m.tipo === 'salida' ? 'Gasto' : 'Entrada'}</td>
                <td class="der">${pesos(m.centavos)}</td>
                <td><button class="secundario chico peligro"
                            data-quitar="${esc(m.id)}">Quitar</button></td>
              </tr>`).join('')}
          </table>
          <p class="ayuda" style="margin:12px 0 0">
            No se borra: queda <b>tachado con su motivo</b> y deja de contar.
            Así después se puede entender qué pasó con este corte.
          </p>`
          : '<p class="vacio">Este turno no tuvo gastos ni entradas.</p>'}
      </div>`;

    const q = (sel) => pantalla.querySelector(sel);
    q('#volver').onclick = () => verCorte(c.id);

    // El catálogo de conceptos está partido en gastos y entradas: al
    // cambiar el tipo, los que no son de ese tipo estorban.
    const selTipo = q('#tipo');
    const selConcepto = q('#concepto');
    const acomodar = () => {
      for (const op of selConcepto.options) {
        if (!op.value) continue;
        const suyo = op.dataset.tipo === selTipo.value;
        op.hidden = !suyo;
        if (!suyo && selConcepto.value === op.value) selConcepto.value = '';
      }
      q('#campo-otro').hidden = Boolean(selConcepto.value);
    };
    selTipo.onchange = acomodar;
    selConcepto.onchange = acomodar;
    acomodar();

    q('#f').onsubmit = async (ev) => {
      ev.preventDefault();
      const cuerpo = {
        tipo: selTipo.value,
        monto: q('#monto').value,
        notas: q('#notas').value,
        motivo: q('#motivo').value
      };
      if (selConcepto.value) cuerpo.conceptoId = selConcepto.value;
      else cuerpo.concepto = q('#otro').value;

      try {
        const r = await api.enviar(`/caja/cortes/${c.id}/movimientos`, cuerpo);
        avisar('Corte corregido', 'bien');
        verCorte(c.id, r.corte);
      } catch (e) { avisar(e.message, 'error'); }
    };

    pantalla.querySelectorAll('[data-quitar]').forEach((b) => {
      b.onclick = async () => {
        const m = vivos.find((x) => x.id === b.dataset.quitar);
        const motivo = await pedirTexto({
          titulo: `Quitar "${m.concepto}"`,
          texto: 'Deja de contar en el corte y el corte se vuelve a sacar. '
               + 'No se borra: queda tachado con lo que escribas aquí.',
          marcador: 'Se anotó dos veces, no era de este turno…',
          ok: 'Quitarlo', largo: 200, unaLinea: true
        });
        if (!motivo) return;
        try {
          const r = await api.enviar(
            `/caja/cortes/${c.id}/movimientos/${m.id}/quitar`, { motivo });
          avisar('Quitado · corte corregido', 'bien');
          verCorte(c.id, r.corte);
        } catch (e) { avisar(e.message, 'error'); }
      };
    });
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
  /**
   * LOS VALES DE ESTE TURNO  (v4.3)
   *
   * Un vale no es un gasto y no se lee como un gasto: lo que hay que ver es
   * QUIÉN se llevó el dinero. Y hay dos clases que se cuentan distinto:
   *
   *   · El RETIRO es dinero del turno que YA está en manos del dueño. Al
   *     final entregan menos porque ya se llevaron una parte, no porque
   *     falte — y esa suma se hace aquí para que nadie tenga que hacerla
   *     de cabeza con el papelito al lado.
   *   · El de RAYA es sueldo pagado antes de tiempo. Ese no vuelve: se
   *     descuenta el día de la raya, y por eso lleva su recordatorio.
   */
  function valesDelTurno(corte) {
    const v = corte.salidas;
    if (!v?.vales?.length) return '';

    const c = corte.caja;
    const conDeuda = new Set((corte.adelantos || []).map((a) => a.movimiento_id));
    const alDueno = v.traspasadoCentavos || 0;
    const recibido = c.entregado_centavos ?? c.contado_centavos ?? null;

    return `
      <div class="tarjeta" style="margin-top:16px">
        <h3 style="margin:0 0 4px">Vales del turno</h3>
        <p class="ayuda" style="margin:0 0 12px">
          Dinero que salió del cajón con nombre y firma.
        </p>

        <table class="venta-lineas">
          ${v.vales.map((m) => `
            <tr>
              <td class="detalle">
                ${esc(m.ejecutor_nombre || '—')}
                <small>${esc(m.concepto)} · ${esc(soloHora(m.fecha))}${
                  conDeuda.has(m.id) ? ' · se le descuenta de su raya' : ''}</small>
              </td>
              <td class="importe malo">−${pesos(m.centavos)}</td>
            </tr>`).join('')}
        </table>

        ${alDueno > 0 && recibido !== null ? `
          <div class="cuadre" style="margin-top:14px">
            <div class="cuadre-linea"><span>Se llevaron en vales</span><strong>${pesos(alDueno)}</strong></div>
            <div class="cuadre-linea suma"><span>+ Te entregaron al final</span><strong>${pesos(recibido)}</strong></div>
            <div class="cuadre-linea total"><span>= De este turno recibiste</span><strong>${pesos(alDueno + recibido)}</strong></div>
          </div>
          <p class="ayuda" style="margin:10px 0 0">
            Los vales de retiro son dinero de este mismo turno que ya está
            guardado. Los adelantos de sueldo no cuentan aquí: ese dinero se
            gastó, no volvió.
          </p>` : ''}
      </div>`;
  }

  function movimientosEnDosColumnas(movimientos, partido = null) {
    if (!movimientos.length) return '';

    // LOS VALES, EN SU PROPIA COLUMNA  (v4.3). "Retiro a la caja fuerte
    // $2,000" en medio de la gasolina y los desayunos no dice lo único que
    // hay que saber de un retiro, que es quién se lo llevó.
    const esVale = new Set((partido?.vales || []).map((m) => m.id));
    const salidas = movimientos.filter((m) => m.tipo === 'salida');
    const gastos = salidas.filter((m) => !esVale.has(m.id));
    const vales = salidas.filter((m) => esVale.has(m.id));
    const entradas = movimientos.filter((m) => m.tipo !== 'salida');
    const suma = (lista) => lista.filter((m) => !m.anulado_en)
                                 .reduce((t, m) => t + m.centavos, 0);

    const columna = (titulo, lista, signo, conQuien = false) => !lista.length ? '' : `
      <div class="ticket-columna">
        <div class="ticket-nombre">${titulo} (${lista.length})</div>
        <table class="ticket-tabla">
          ${lista.map((m) => `
            <tr class="${m.anulado_en ? 'anulada' : ''}">
              <td>${m.anulado_en ? '(anulado) ' : ''}${esc(m.concepto)}
                  ${conQuien && m.ejecutor_nombre
                    ? `<small class="vale-quien">${esc(m.ejecutor_nombre)}</small>` : ''}</td>
              <td>${m.anulado_en ? '—' : signo + pesos(m.centavos)}</td>
            </tr>`).join('')}
          <tr class="fuerte"><td>Suman</td><td>${signo}${pesos(suma(lista))}</td></tr>
        </table>
      </div>`;

    // LOS VALES NO CABEN EN MEDIA COLUMNA. Este bloque imita el papel
    // térmico, o sea que media columna son unos ciento treinta píxeles: le
    // basta a "Gasolina" y a "Desayuno", pero "Retiro a la caja fuerte" se
    // parte en cuatro renglones y encima lleva el nombre debajo. Cuando hay
    // vales se apila todo, que además es como sale de la impresora.
    const dos = !vales.length && gastos.length && entradas.length;
    return `
      <div class="ticket-movimientos ${dos ? 'dos-columnas' : ''}"
           style="margin-top:10px">
        ${columna('GASTOS', gastos, '−')}
        ${columna('VALES', vales, '−', true)}
        ${columna('ENTRADAS', entradas, '+')}
      </div>`;
  }

  // ==========================================================
  // HISTORIAL
  // ==========================================================
  async function verHistorial() {
    const { cortes } = await api.obtener('/caja/cortes?limite=40');
    // Los que se cerraron y nadie ha contado todavía. Son los que hay que
    // atender: un corte sin entrega anotada es dinero sin cuadrar.
    const sinContar = cortes.filter((c) => c.diferencia_centavos == null);

    pantalla.innerHTML = `
      <button class="secundario chico" id="volver">‹ Caja</button>
      <h2 style="margin-top:14px">Cortes de caja</h2>
      <p class="ayuda">
        Un renglón por turno. Los turnos se cierran <b>sin contar el
        dinero</b>: la diferencia aparece cuando alguien anota lo que le
        entregaron.
      </p>
      ${sinContar.length ? `
        <div class="aviso-sin-caja" style="margin-bottom:12px">
          <strong>${sinContar.length} ${sinContar.length === 1
            ? 'turno está esperando' : 'turnos están esperando'} que se anote el dinero.</strong>
          ${puedeRecibir
            ? 'Tócalos y anota cuánto te entregaron.'
            : 'Lo anota el gerente o el administrador.'}
        </div>` : ''}

      <div class="tarjeta plana">
        <table class="tabla">
          <tr>
            <th>#</th><th>Cuándo</th><th>Cajero</th><th>Cobrado</th><th>Diferencia</th>
            ${esAdmin ? '<th></th>' : ''}
          </tr>
          ${cortes.map((c) => `
            <tr data-corte="${esc(c.id)}" style="cursor:pointer">
              <td><strong>${c.folio}</strong></td>
              <td>${esc(formatoFecha(c.cerrada_en))}</td>
              <td>${esc(c.cajero_nombre || '—')}</td>
              <td>${pesos(c.vendido_centavos)}</td>
              <td class="${c.diferencia_centavos == null ? 'vacio-folio'
                            : c.diferencia_centavos === 0 ? '' : 'malo'}">
                ${c.diferencia_centavos == null
                  ? 'sin contar'
                  : c.diferencia_centavos === 0 ? '✓' : pesos(c.diferencia_centavos)}
                ${c.corregido_en ? '<small>corregido</small>' : ''}
                ${c.recibido_por_nombre
                  ? `<small>lo recibió ${esc(c.recibido_por_nombre)}</small>` : ''}
              </td>
              ${esAdmin ? `
                <td class="der">
                  <button class="secundario chico" data-arreglar="${esc(c.id)}"
                          title="Agregarle o quitarle un gasto">⋯</button>
                </td>` : ''}
            </tr>`).join('')
            || `<tr><td colspan="${esAdmin ? 6 : 5}">Todavía no hay cortes.</td></tr>`}
        </table>
      </div>
      ${esAdmin ? `
        <p class="ayuda" style="margin-top:12px">
          Con los <b>⋯</b> se le puede agregar a un corte un gasto que se
          olvidó, o quitarle uno que no era. El corte se vuelve a sacar solo
          y queda dicho quién lo corrigió y por qué.
        </p>` : ''}`;

    pantalla.querySelector('#volver').onclick = pintar;
    pantalla.querySelectorAll('[data-corte]').forEach((f) => {
      f.onclick = () => verCorte(f.dataset.corte);
    });
    pantalla.querySelectorAll('[data-arreglar]').forEach((b) => {
      b.onclick = async (ev) => {
        ev.stopPropagation();          // si no, también abre el corte
        try {
          const { corte } = await api.obtener(`/caja/cortes/${b.dataset.arreglar}`);
          pantallaCorregir(corte);
        } catch (e) { avisar(e.message, 'error'); }
      };
    });
  }
}
