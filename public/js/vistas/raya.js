/**
 * LA RAYA  (v4.8)
 *
 * "Necesito una forma más visual donde anotar cuánto gana, qué días viene,
 *  a qué hora llega, a qué hora se va, cuántos vales, e imprimir su balance
 *  para darle su sueldo."
 *
 * Dos pantallas y ya:
 *
 *   LA LISTA   — un renglón por persona con lo único que hace falta para
 *                decidir a quién se le paga hoy: cuánto gana, qué debe de
 *                vales y cuándo se le pagó por última vez.
 *   SU FICHA   — su sueldo, su semana dibujada día por día, sus vales, sus
 *                rayas anteriores, y el botón de pagarle.
 *
 * La semana se dibuja como una semana —siete casillas de domingo a sábado—
 * y no como una tabla de horas: así se ve de un vistazo quién abre el
 * martes, que es la pregunta que se hace mirando esto.
 */
import { api } from '../api.js';
import { esc, avisar, fechaCorta, soloDia, ETIQUETAS_ROL } from '../util.js';
import { pedirTexto, pedirImporte, pedirEntero, confirmar, menu, verTicket } from '../dialogo.js';
import { pesos } from '../fracciones.js';
import { imprimirTicket, htmlDeEspejo } from '../imprimir.js';

const DIAS_CORTOS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export async function vistaRaya(pantalla) {
  await lista();

  // ==========================================================
  // LA LISTA
  // ==========================================================
  async function lista() {
    pantalla.innerHTML = '<div class="cargando">Sacando cuentas…</div>';

    let d;
    try { d = await api.obtener('/raya'); }
    catch (e) { pantalla.innerHTML = `<p class="vacio">${esc(e.message)}</p>`; return; }

    const sinSueldo = d.gente.filter((u) => !u.sueldo).length;
    const conVales = d.gente.filter((u) => u.vales.centavos > 0);

    pantalla.innerHTML = `
      <div class="ancho-completo">
        <div class="emp-cabecera">
          <div class="emp-titulo">
            <h2>La raya</h2>
            <p class="ayuda">
              Lo que gana cada quien, qué días viene y qué se le debe.
              Se paga cada <b>${esc(d.dias[d.diaDePago])}</b>.
              <button class="secundario chico" id="dia-pago">Cambiar el día</button>
            </p>
          </div>
        </div>

        ${conVales.length ? `
          <div class="aviso-sin-caja" style="margin-bottom:14px">
            <strong>${conVales.length} ${conVales.length === 1 ? 'persona tiene' : 'personas tienen'} vales sin descontar.</strong>
            Se descuentan solos al pagarle: ${esc(conVales.map((u) => u.nombre).join(', '))}.
          </div>` : ''}

        ${sinSueldo ? `
          <p class="ayuda" style="margin-bottom:14px">
            A <b>${sinSueldo}</b> ${sinSueldo === 1 ? 'persona' : 'personas'} no se les ha
            puesto sueldo todavía. Sin eso no se les puede pagar desde aquí.
          </p>` : ''}

        <div class="raya-lista">
          ${d.gente.map((u) => tarjetaPersona(u, d)).join('')}
        </div>
      </div>`;

    pantalla.querySelector('#dia-pago').onclick = () => cambiarDiaDePago(d);
    pantalla.querySelectorAll('[data-ficha]').forEach((b) => {
      b.onclick = () => ficha(b.dataset.ficha);
    });
  }

  function tarjetaPersona(u, d) {
    const s = u.sueldo;
    return `
      <button class="raya-tarjeta" data-ficha="${esc(u.id)}">
        <span class="raya-quien">
          <strong>${esc(u.nombre)}</strong>
          <small>${esc(ETIQUETAS_ROL[u.rol] || u.rol)}</small>
        </span>

        <span class="raya-dato">
          <small>Gana</small>
          <b>${s ? pesos(s.centavos) : '—'}</b>
          <small>${s ? (s.tipo === 'por_dia' ? 'por día' : 'a la semana') : 'sin sueldo'}</small>
        </span>

        <span class="raya-dato">
          <small>Viene</small>
          <b>${u.diasQueViene || '—'}</b>
          <small>${u.diasQueViene ? `días · ${u.horasSemana} h` : 'sin horario'}</small>
        </span>

        <span class="raya-dato ${u.vales.centavos ? 'debe' : ''}">
          <small>Vales</small>
          <b>${u.vales.centavos ? pesos(u.vales.centavos) : '—'}</b>
          <small>${u.vales.cuantos ? `${u.vales.cuantos} sin descontar` : 'nada pendiente'}</small>
        </span>

        <span class="raya-cuando">
          <small>${u.ultimaRaya
            ? `se le pagó ${esc(fechaCorta(u.ultimaRaya.pagada_en))}`
            : 'nunca se le ha pagado desde aquí'}</small>
        </span>
        <span class="tanque-flecha">›</span>
      </button>`;
  }

  async function cambiarDiaDePago(d) {
    const cual = await menu({
      titulo: '¿Qué día se paga?',
      texto: 'Sirve para proponer solo la semana que toca. Se puede cambiar al pagar.',
      opciones: d.dias.map((n, i) => ({
        valor: String(i), texto: n[0].toUpperCase() + n.slice(1),
        detalle: i === d.diaDePago ? 'el de ahora' : ''
      }))
    });
    if (cual === null || cual === undefined) return;
    try {
      await api.actualizar('/raya/dia-pago', { dia: Number(cual) });
      lista();
    } catch (e) { avisar(e.message, 'error'); }
  }

  // ==========================================================
  // SU FICHA
  // ==========================================================
  async function ficha(id) {
    pantalla.innerHTML = '<div class="cargando">Sacando cuentas…</div>';

    let d;
    try { d = await api.obtener(`/raya/${id}`); }
    catch (e) { pantalla.innerHTML = `<p class="vacio">${esc(e.message)}</p>`; return; }

    const b = d.balance;
    const s = d.sueldo;

    pantalla.innerHTML = `
      <div class="ancho-completo">
        <button class="secundario chico" id="volver">‹ La raya</button>
        <h2 style="margin-top:14px">${esc(d.usuario.nombre)}</h2>
        <p class="ayuda">${esc(ETIQUETAS_ROL[d.usuario.rol] || d.usuario.rol)}</p>

        <div class="corte-tablero">
          <div class="corte-columna">

            <div class="tarjeta">
              <h3 style="margin:0 0 4px">Cuánto gana</h3>
              ${s ? `
                <div class="raya-sueldo">
                  <strong>${pesos(s.centavos)}</strong>
                  <small>${s.tipo === 'por_dia' ? 'por cada día que viene' : 'a la semana'}</small>
                  <small>desde el ${esc(soloDia(s.desde, { conAnio: true }))}</small>
                </div>` : `
                <p class="ayuda" style="margin:0">
                  Todavía no se le ha puesto sueldo. Sin eso no se le puede
                  pagar desde aquí.
                </p>`}
              <button class="secundario" id="poner-sueldo" style="margin-top:12px">
                ${s ? 'Cambiarle el sueldo' : 'Ponerle sueldo'}
              </button>

              ${d.sueldos.length > 1 ? `
                <h4 class="emp-sub">Lo que ha ganado antes</h4>
                <table class="tabla">
                  <tr><th>Desde</th><th class="der">Cuánto</th><th>Cómo</th></tr>
                  ${d.sueldos.map((x) => `
                    <tr class="${x.id === s?.id ? 'fuerte' : ''}">
                      <td>${esc(soloDia(x.desde, { conAnio: true }))}</td>
                      <td class="der">${pesos(x.centavos)}</td>
                      <td>${x.tipo === 'por_dia' ? 'por día' : 'a la semana'}</td>
                    </tr>`).join('')}
                </table>` : ''}
            </div>

            <div class="tarjeta">
              <h3 style="margin:0 0 4px">Sus días y sus horas</h3>
              <p class="ayuda" style="margin:0 0 12px">
                Qué días viene y de qué hora a qué hora.
                ${b.diasQueViene
                  ? `<b>${b.diasQueViene} ${b.diasQueViene === 1 ? 'día' : 'días'}</b> ·
                     <b>${b.horasSemana} horas</b> a la semana.`
                  : 'Todavía no se le ha puesto horario.'}
              </p>
              <div class="raya-semana">
                ${d.horario.map((h) => `
                  <div class="raya-dia ${h.viene ? 'viene' : ''}">
                    <span class="raya-dia-letra">${DIAS_CORTOS[h.dia]}</span>
                    <span class="raya-dia-nombre">${esc(h.nombre)}</span>
                    ${h.viene
                      ? `<span class="raya-dia-horas">${esc(h.entra)}<br>${esc(h.sale)}</span>
                         <span class="raya-dia-total">${h.horas} h</span>`
                      : '<span class="raya-dia-libre">no viene</span>'}
                  </div>`).join('')}
              </div>
              <button class="secundario" id="poner-horario" style="margin-top:12px">
                Cambiarle el horario
              </button>
            </div>
          </div>

          <div class="corte-columna">
            ${tarjetaBalance(b, d)}

            ${d.rayas.length ? `
              <div class="tarjeta">
                <h3 style="margin:0 0 12px">Lo que ya se le pagó</h3>
                <table class="tabla raya-tabla">
                  <tr><th>Semana</th><th class="der">Se le pagó</th>
                      <th>De dónde</th><th></th></tr>
                  ${d.rayas.map((r) => `
                    <tr class="${r.anulada_en ? 'anulada' : ''}">
                      <td>
                        <span class="raya-semana-rango">${esc(soloDia(r.desde))} —
                          ${esc(soloDia(r.hasta, { conAnio: true }))}</span>
                        <small>${r.pagada_por_nombre
                          ? `se la pagó ${esc(r.pagada_por_nombre)}` : ''}
                          · ${esc(soloDia(r.pagada_en))}</small>
                      </td>
                      <td class="der"><strong>${pesos(r.pagado_centavos)}</strong>
                          ${r.vales_centavos
                            ? `<small>−${pesos(r.vales_centavos)} de vales</small>` : ''}</td>
                      <td class="${r.anulada_en ? 'anul-celda' : ''}">
                        ${r.anulada_en ? `
                          <span class="hist-que que-cancelada">anulada</span>
                          <small class="anul-detalle">
                            ${r.anulada_por_nombre ? `por ${esc(r.anulada_por_nombre)}` : ''}
                            ${r.motivo_anulacion ? `«${esc(r.motivo_anulacion)}»` : ''}
                          </small>`
                          : r.de_donde === 'cajon' ? 'del cajón' : 'de fuera'}
                      </td>
                      <td>
                        <div class="raya-acciones">
                          <button class="raya-accion" data-papel="${esc(r.id)}"
                                  title="Volver a imprimir su papel">🖨️</button>
                          ${r.anulada_en ? '' : `
                            <button class="raya-accion peligro" data-anular="${esc(r.id)}"
                                    title="Anular esta raya">×</button>`}
                        </div>
                      </td>
                    </tr>`).join('')}
                </table>
              </div>` : ''}
          </div>
        </div>
      </div>`;

    pantalla.querySelector('#volver').onclick = lista;
    pantalla.querySelector('#poner-sueldo').onclick = () => ponerSueldo(d);
    pantalla.querySelector('#poner-horario').onclick = () => ponerHorario(d);

    const btnPagar = pantalla.querySelector('#pagar');
    if (btnPagar) btnPagar.onclick = () => pagar(d);

    const btnPapel = pantalla.querySelector('#ver-papel');
    if (btnPapel) btnPapel.onclick = () => verPapelAntes(d);

    pantalla.querySelectorAll('[data-papel]').forEach((x) => {
      x.onclick = () => imprimirRaya(x.dataset.papel);
    });
    pantalla.querySelectorAll('[data-anular]').forEach((x) => {
      x.onclick = () => anularRaya(x.dataset.anular, d);
    });
  }

  /**
   * EL BALANCE DE LA SEMANA: lo que se viene a ver.
   *
   * En el orden en que se explica de viva voz —lo que ganó, lo que se llevó
   * adelantado, lo que queda— porque quien lo recibe hace la cuenta de
   * cabeza mientras lo lee.
   */
  function tarjetaBalance(b, d) {
    return `
      <div class="tarjeta ${b.enNegativo ? 'cuadre-diferencia' : 'cuadre-exacto'}">
        <h3 style="margin:0 0 4px">Lo que se le paga</h3>
        <p class="ayuda" style="margin:0 0 14px">
          Del <b>${esc(soloDia(b.desde))}</b> al <b>${esc(soloDia(b.hasta))}</b>.
          ${d.rayas.length ? 'Desde donde quedó la última raya.' : 'La semana que termina el día de pago.'}
        </p>

        <div class="cuadre">
          <div class="cuadre-linea">
            <span>Sueldo${b.diasContados != null
              ? ` <small>${b.diasContados} ${b.diasContados === 1 ? 'día' : 'días'}</small>` : ''}</span>
            <strong>${pesos(b.sueldoCentavos)}</strong>
          </div>
          ${b.valesCentavos ? `
            <div class="cuadre-linea vendido">
              <span>− Vales que se llevó (${b.valesCuantos})</span>
              <strong>${pesos(b.valesCentavos)}</strong>
            </div>` : ''}
          <div class="cuadre-linea total">
            <span>= Se le paga</span><strong>${pesos(b.pagadoCentavos)}</strong>
          </div>
        </div>

        ${b.vales.length ? `
          <table class="tabla" style="margin-top:12px">
            <tr><th>Sus vales</th><th class="der">Cuánto</th></tr>
            ${b.vales.map((v) => `
              <tr><td>${esc(fechaCorta(v.fecha))}
                      ${v.notas ? `<small>${esc(v.notas)}</small>` : ''}</td>
                  <td class="der">${pesos(v.centavos)}</td></tr>`).join('')}
          </table>` : ''}

        ${b.sinSueldo ? `
          <p class="ayuda" style="margin:14px 0 0">
            Ponle sueldo primero. Sin eso no hay de dónde sacar el número.
          </p>`
        : b.enNegativo ? `
          <p class="ayuda" style="margin:14px 0 0">
            <b>Debe más de vales que lo que gana esta semana.</b> Eso se
            arregla hablando, no con un papel en rojo: quítale vales o
            espera a la semana que viene.
          </p>`
        : `
          <button id="pagar" style="margin-top:16px;width:100%">
            💵 Pagarle ${pesos(b.pagadoCentavos)}
          </button>
          <button id="ver-papel" class="secundario" style="margin-top:8px;width:100%">
            👁 Ver el papel antes de pagarle
          </button>
          <p class="ayuda" style="margin:10px 0 0;font-size:13px">
            Sale su papel para firmar, y sus vales quedan descontados.
          </p>`}
      </div>`;
  }

  // ==========================================================
  // LO QUE SE PUEDE HACER
  // ==========================================================

  async function ponerSueldo(d) {
    const tipo = await menu({
      titulo: `El sueldo de ${d.usuario.nombre}`,
      texto: '¿Cómo se le paga?',
      opciones: [
        { valor: 'semanal', texto: 'Una cantidad a la semana',
          detalle: 'Lo mismo venga los días que venga' },
        { valor: 'por_dia', texto: 'Tanto por cada día que viene',
          detalle: 'Se multiplica por los días de su horario' }
      ]
    });
    if (!tipo) return;

    const monto = await pedirImporte({
      titulo: d.usuario.nombre,
      texto: tipo === 'por_dia' ? '¿Cuánto gana por día?' : '¿Cuánto gana a la semana?',
      valor: d.sueldo ? String(d.sueldo.centavos / 100) : '',
      ok: 'Guardar'
    });
    if (!monto) return;

    try {
      await api.enviar(`/raya/${d.usuario.id}/sueldo`, { tipo, monto });
      avisar('Sueldo guardado', 'bien');
      ficha(d.usuario.id);
    } catch (e) { avisar(e.message, 'error'); }
  }

  /**
   * EL HORARIO, día por día.
   *
   * Se pregunta día a día y no en un formulario de catorce casillas: con
   * catorce casillas en blanco nadie lo llena, y así cada pregunta tiene
   * una sola respuesta. Los días que no viene se saltan con "no viene".
   */
  async function ponerHorario(d) {
    const dias = [];
    for (const h of d.horario) {
      const que = await menu({
        titulo: h.nombre[0].toUpperCase() + h.nombre.slice(1),
        texto: `¿${d.usuario.nombre} viene los ${h.nombre}?`,
        opciones: [
          { valor: 'si', texto: h.viene ? `Sí — ahora ${h.entra} a ${h.sale}` : 'Sí, viene',
            detalle: 'Se pregunta la hora enseguida' },
          { valor: 'no', texto: 'No viene' }
        ]
      });
      if (!que) return;                       // cancelar deja el horario como estaba
      if (que === 'no') continue;

      const horas = await pedirTexto({
        titulo: `Los ${h.nombre}`,
        texto: 'De qué hora a qué hora, en 24 horas. Por ejemplo: 07:00 a 15:00',
        valor: h.viene ? `${h.entra} a ${h.sale}` : '',
        marcador: '07:00 a 15:00', ok: 'Siguiente día', largo: 20, unaLinea: true
      });
      if (!horas) return;

      const partes = String(horas).split(/\s*(?:a|-|—)\s*/i).filter(Boolean);
      if (partes.length !== 2) {
        avisar(`Los ${h.nombre} no se entendieron. Se escribe "07:00 a 15:00".`, 'error');
        return;
      }
      dias.push({ dia: h.dia, entra: partes[0].trim(), sale: partes[1].trim() });
    }

    try {
      await api.actualizar(`/raya/${d.usuario.id}/horario`, { dias });
      avisar('Horario guardado', 'bien');
      ficha(d.usuario.id);
    } catch (e) { avisar(e.message, 'error'); }
  }

  /**
   * PAGARLE.
   *
   * La pregunta que decide todo es DE DÓNDE SALE EL DINERO: del cajón —y
   * entonces el corte de ese turno lo resta— o de fuera, y entonces el
   * cajón no se entera porque ese dinero ya salió de ahí como retiro.
   */
  async function pagar(d) {
    const b = d.balance;

    const extrasTexto = await pedirImporte({
      titulo: `${d.usuario.nombre} · ${pesos(b.pagadoCentavos)}`,
      texto: '¿Lleva algo extra esta semana? Horas de más, un bono, lo que sea.',
      marcador: '0', ok: 'Siguiente',
      ayuda: 'Déjalo vacío si no lleva nada extra.'
    });
    if (extrasTexto === null) return;
    const extras = extrasTexto || '0';

    const deDonde = await menu({
      titulo: '¿De dónde sale el dinero?',
      texto: 'Es lo único que decide si el cajón se entera o no.',
      opciones: [
        { valor: 'cajon', texto: '💵 Del cajón',
          detalle: 'Sale como gasto del turno y el corte lo resta' },
        { valor: 'fuera', texto: '🏦 De fuera del cajón',
          detalle: 'De la caja fuerte, del dinero ya retirado, o transferencia' }
      ]
    });
    if (!deDonde) return;

    let hecho;
    try {
      hecho = await api.enviar(`/raya/${d.usuario.id}/pagar`, {
        desde: b.desde, hasta: b.hasta, extras, deDonde
      });
    } catch (e) { return avisar(e.message, 'error'); }

    avisar(`Pagado a ${d.usuario.nombre}`, 'bien');
    await imprimirRaya(hecho.raya.id);
    ficha(d.usuario.id);
  }

  /**
   * EL PAPEL ANTES DE PAGARLE.
   *
   * La misma cuenta, con el mismo formato, marcada TODAVIA NO SE HA PAGADO
   * y sin la raya para firmar. Es para enseñárselo y que las dudas salgan
   * antes de darle el dinero, no después.
   */
  async function verPapelAntes(d) {
    try {
      const { renglones, ancho } = await api.obtener(
        `/impresion/raya-previa/${d.usuario.id}` +
        `?desde=${d.balance.desde}&hasta=${d.balance.hasta}`);
      const que = await verTicket({
        titulo: 'Así va a quedar su papel', renglones, ancho,
        notas: ['Todavía no se le ha pagado nada.'],
        acciones: [{ valor: 'imprimir', texto: '🖨️ Imprimir' }]
      });
      if (que === 'imprimir') imprimirTicket(htmlDeEspejo(renglones, ancho));
    } catch (e) { avisar(e.message, 'error'); }
  }

  /** El papel que se le entrega con el dinero, para que lo firme. */
  async function imprimirRaya(id) {
    try {
      const r = await api.enviar(`/impresion/raya/${id}`, {});
      if (r.impreso) return avisar('Su papel salió. Que lo firme.', 'bien');
    } catch (e) { return avisar(e.message, 'error'); }

    try {
      const { renglones, ancho } = await api.obtener(`/impresion/raya/${id}/previa`);
      const que = await verTicket({
        titulo: 'Su sueldo', renglones, ancho,
        notas: ['No hay impresora térmica configurada.'],
        acciones: [{ valor: 'imprimir', texto: '🖨️ Imprimir' }]
      });
      if (que === 'imprimir') imprimirTicket(htmlDeEspejo(renglones, ancho));
    } catch { avisar('No hay impresora configurada', ''); }
  }

  async function anularRaya(id, d) {
    const motivo = await pedirTexto({
      titulo: '¿Por qué se anula?',
      texto: 'El dinero vuelve al cajón (o el gasto se anula), y sus vales ' +
             'vuelven a estar pendientes.',
      marcador: 'Se pagó dos veces', ok: 'Anular', largo: 200, unaLinea: true
    });
    if (!motivo) return;
    try {
      await api.enviar(`/raya/rayas/${id}/anular`, { motivo });
      avisar('Raya anulada', 'bien');
      ficha(d.usuario.id);
    } catch (e) { avisar(e.message, 'error'); }
  }
}
