/**
 * LA RAYA  (v4.8 · rehecha en la v6.8)
 *
 * "Necesito una forma más visual donde anotar cuánto gana, qué días viene,
 *  a qué hora llega, a qué hora se va, cuántos vales, e imprimir su balance
 *  para darle su sueldo."
 *
 * Y lo que faltaba, que es lo que de verdad se paga aquí:
 *
 * "Los sueldos pueden ser muy variados. Hay trabajadores que se les paga
 *  por día, pero depende del día el sueldo es diferente: a veces los
 *  domingos, los sábados, los días feriados o especiales entre la semana.
 *  Hay trabajadores que se les paga la quincena, otros a la semana, otros
 *  diario, otros por horas."
 *
 * Tres pantallas:
 *
 *   LA LISTA   — un renglón por persona con lo único que hace falta para
 *                decidir a quién se le paga hoy: cuánto gana, qué debe de
 *                vales y cuándo se le pagó por última vez.
 *   SU FICHA   — su sueldo con sus tarifas, LA SEMANA DÍA POR DÍA para
 *                apuntar lo que trabajó, sus vales, sus rayas anteriores y
 *                el botón de pagarle.
 *   LOS DÍAS ESPECIALES — el calendario que marca el dueño, porque no hay
 *                lista fija.
 *
 * DOS SEMANAS DISTINTAS, Y NO SON LO MISMO:
 *   · el HORARIO DE COSTUMBRE dice qué días VIENE y a qué hora. Se pone
 *     una vez y casi no se toca.
 *   · las JORNADAS dicen qué días VINO. Se apuntan cada semana, y de ahí
 *     sale la raya del que cobra por día o por hora.
 * Para no teclear siete veces lo mismo, un botón rellena la semana con el
 * horario de costumbre y solo se corrigen las excepciones.
 */
import { api } from '../api.js';
import { esc, avisar, fechaCorta, soloDia, ETIQUETAS_ROL } from '../util.js';
import { pedirTexto, pedirImporte, confirmar, menu, verTicket } from '../dialogo.js';
import { pesos } from '../fracciones.js';
import { imprimirTicket, htmlDeEspejo } from '../imprimir.js';

const DIAS_CORTOS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

/** Suma días a una fecha de calendario, sin líos de zona horaria. */
function masDias(dia, n) {
  const d = new Date(`${dia}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Hoy, como día de calendario. */
const hoy = () => new Date().toISOString().slice(0, 10);

/** '6.5' → '6 h 30 min', que es como se dice en voz alta. */
function enHoras(h) {
  if (h == null) return '—';
  const enteras = Math.floor(h);
  const min = Math.round((h - enteras) * 60);
  if (!min) return `${enteras} h`;
  return `${enteras} h ${min} min`;
}

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
            <h2>Sueldos</h2>
            <p class="ayuda">
              Lo que gana cada quien, qué días viene y qué se le debe.
              Se paga cada <b>${esc(d.dias[d.diaDePago])}</b>.
              <button class="secundario chico" id="dia-pago">Cambiar el día</button>
            </p>
          </div>
          <div class="emp-acciones">
            <button class="secundario" id="especiales">
              📅 Días especiales${d.diasEspeciales.length ? ` (${d.diasEspeciales.length})` : ''}
            </button>
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
    pantalla.querySelector('#especiales').onclick = () => pantallaEspeciales();
    pantalla.querySelectorAll('[data-ficha]').forEach((b) => {
      b.onclick = () => ficha(b.dataset.ficha);
    });
  }

  /** «por día», «a la semana»… tal como lo llama el servidor. */
  function comoSePaga(s, d) {
    if (!s) return 'sin sueldo';
    const t = (d.tiposSueldo || []).find((x) => x.clave === s.tipo);
    return t ? `por ${t.unidad}` : s.tipo;
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
          <small>${esc(comoSePaga(s, d))}</small>
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
  /**
   * SU FICHA.
   *
   * `rango` es la semana que se está mirando. Nulo quiere decir «la que
   * toca pagar», que es lo que se quiere ver el 99% de las veces; se puede
   * caminar hacia atrás para apuntar una semana que se quedó sin capturar.
   */
  async function ficha(id, rango = null) {
    pantalla.innerHTML = '<div class="cargando">Sacando cuentas…</div>';

    let d;
    try {
      d = await api.obtener(`/raya/${id}`);
      if (rango) {
        d.balance = (await api.obtener(
          `/raya/${id}/balance?desde=${rango.desde}&hasta=${rango.hasta}`)).balance;
      }
    } catch (e) { pantalla.innerHTML = `<p class="vacio">${esc(e.message)}</p>`; return; }

    const b = d.balance;
    const s = d.sueldo;
    const semana = { desde: b.desde, hasta: b.hasta };

    pantalla.innerHTML = `
      <div class="ancho-completo">
        <button class="secundario chico" id="volver">‹ Sueldos</button>
        <h2 style="margin-top:14px">${esc(d.usuario.nombre)}</h2>
        <p class="ayuda">${esc(ETIQUETAS_ROL[d.usuario.rol] || d.usuario.rol)}</p>

        <div class="corte-tablero">
          <div class="corte-columna">

            <div class="tarjeta">
              <h3 style="margin:0 0 4px">Cuánto gana</h3>
              ${s ? `
                <div class="raya-sueldo">
                  <strong>${pesos(s.centavos)}</strong>
                  <small>por ${esc(unidadDe(s.tipo, d))}</small>
                  <small>desde el ${esc(soloDia(s.desde, { conAnio: true }))}</small>
                </div>
                ${tarifasDe(s, d)}` : `
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
                      <td>por ${esc(unidadDe(x.tipo, d))}</td>
                    </tr>`).join('')}
                </table>` : ''}
            </div>

            <div class="tarjeta">
              <h3 style="margin:0 0 4px">Su horario de costumbre</h3>
              <p class="ayuda" style="margin:0 0 12px">
                Qué días <b>viene</b> y de qué hora a qué hora. No es lo que
                trabajó —eso se apunta en «Lo que trabajó»— sino de dónde sale
                lo que se propone al rellenar la semana.
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
            ${tarjetaSemana(b, d)}
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

    pantalla.querySelector('#semana-antes').onclick =
      () => ficha(id, { desde: masDias(semana.desde, -7), hasta: masDias(semana.hasta, -7) });
    pantalla.querySelector('#semana-despues').onclick =
      () => ficha(id, { desde: masDias(semana.desde, 7), hasta: masDias(semana.hasta, 7) });
    const btnCostumbre = pantalla.querySelector('#de-costumbre');
    if (btnCostumbre) btnCostumbre.onclick = () => rellenarDeCostumbre(d, semana);
    pantalla.querySelectorAll('[data-dia]').forEach((x) => {
      x.onclick = () => tocarDia(d, semana, b.dias.find((y) => y.dia === x.dataset.dia));
    });

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

  /** «día», «semana», «quincena», «hora» — como lo llama el servidor. */
  function unidadDe(tipo, d) {
    return (d.tiposSueldo || []).find((t) => t.clave === tipo)?.unidad || tipo;
  }

  /**
   * LAS TARIFAS DE LOS DÍAS QUE SE PAGAN DISTINTO.
   *
   * Solo se enseñan las que están puestas. Un renglón que dijera
   * "sábado: lo mismo" para cuatro personas de cinco sería ruido: lo
   * normal es cobrar igual todos los días, y eso ya lo dice el número
   * grande de arriba.
   */
  function tarifasDe(s, d) {
    const puestas = [
      ['sabado', 'Sábado', s.sabado_centavos],
      ['domingo', 'Domingo', s.domingo_centavos],
      ['especial', 'Día especial', s.especial_centavos]
    ].filter(([, , c]) => c != null);
    if (!puestas.length) return '';

    return `
      <table class="tabla" style="margin-top:12px">
        <tr><th>Y esos días</th><th class="der">Gana</th></tr>
        ${puestas.map(([clave, nombre, c]) => `
          <tr><td><span class="dia-chip dia-${clave}">${nombre}</span></td>
              <td class="der">${pesos(c)} <small>por ${esc(unidadDe(s.tipo, d))}</small></td></tr>`).join('')}
      </table>`;
  }

  /**
   * LA SEMANA DÍA POR DÍA: lo que trabajó de verdad.
   *
   * Un renglón por día del rango, incluidos los que no se han apuntado:
   * un hueco es lo que hay que ir a llenar, y esconderlo sería esconder
   * el trabajo que falta pagar. Se toca un renglón y se apunta.
   *
   * A quien cobra la semana o la quincena también se le enseña —saber
   * quién vino es la mitad de para qué sirve esto— pero se dice claro
   * que no le cambia el número.
   */
  function tarjetaSemana(b, d) {
    const faltan = b.dias.filter((x) => !x.apuntado && x.dia <= hoy()).length;

    return `
      <div class="tarjeta">
        <div class="raya-semana-barra">
          <button class="secundario chico" id="semana-antes" title="La semana de antes">‹</button>
          <div class="raya-semana-cual">
            <h3 style="margin:0">Lo que trabajó</h3>
            <small>${esc(soloDia(b.desde))} — ${esc(soloDia(b.hasta, { conAnio: true }))}</small>
          </div>
          <button class="secundario chico" id="semana-despues" title="La semana de después">›</button>
        </div>

        <p class="ayuda" style="margin:10px 0 12px">
          ${b.cuentaDias
            ? 'De aquí sale su raya. Toca un día para apuntarlo o corregirlo.'
            : `Cobra ${esc(unidadDe(b.tipo, d))} completa, así que esto no le cambia
               el número: es para saber quién vino.`}
        </p>

        ${faltan ? `
          <div class="aviso-sin-caja" style="margin-bottom:12px">
            <strong>Faltan ${faltan} ${faltan === 1 ? 'día' : 'días'} por apuntar.</strong>
            ${b.diasQueViene
              ? 'Rellénalos con su horario de costumbre y corrige nada más lo que salió distinto.'
              : 'Ponle horario y se rellenan solos.'}
          </div>` : ''}

        <div class="jornadas">
          ${b.dias.map((x) => renglonDia(x, b)).join('')}
        </div>

        ${b.diasQueViene ? `
          <button class="secundario" id="de-costumbre" style="margin-top:12px;width:100%">
            ✎ Rellenar con su horario de costumbre
          </button>` : ''}

        <div class="jornadas-suma">
          ${b.tipo === 'por_hora'
            ? `<span>${enHoras(b.horasContadas)} en ${b.diasContados ?? 0}
                 ${b.diasContados === 1 ? 'día' : 'días'}</span>`
            : `<span>${b.dias.filter((x) => x.vino).length} días trabajados</span>`}
          ${b.cuentaDias ? `<strong>${pesos(b.sueldoCentavos)}</strong>` : ''}
        </div>

        ${b.porCostumbre && b.cuentaDias ? `
          <p class="ayuda" style="margin:10px 0 0">
            <b>Ojo:</b> no hay ni un día apuntado, así que este número salió
            de su horario de costumbre. Es una suposición, no lo que trabajó.
          </p>` : ''}
      </div>`;
  }

  /**
   * Un día de la semana, tal como quedó apuntado.
   *
   * Solo el día ESPECIAL lleva etiqueta. El sábado y el domingo ya están
   * escritos con todas sus letras en el renglón: una etiqueta que dijera
   * «Sábado» al lado de «Sábado» no informa de nada. Que se paguen
   * distinto se ve en los pesos de la derecha.
   */
  function renglonDia(x, b) {
    const futuro = x.dia > hoy();
    const clase = !x.apuntado ? 'sin-apuntar' : x.vino ? 'vino' : 'no-vino';

    return `
      <button class="jornada ${clase}" data-dia="${esc(x.dia)}" ${futuro ? 'disabled' : ''}>
        <span class="jornada-dia">
          <b>${esc(x.nombreDia)}</b>
          <small>${esc(soloDia(x.dia))}</small>
        </span>

        <span class="jornada-clase">
          ${x.tipoDia === 'especial'
            ? `<span class="dia-chip dia-especial">${esc(x.tipoDiaTexto)}</span>` : ''}
        </span>

        <span class="jornada-que">
          ${futuro ? '<small>todavía no llega</small>'
            : !x.apuntado ? '<small>sin apuntar</small>'
            : !x.vino ? `<small>no vino${x.notas ? ` · ${esc(x.notas)}` : ''}</small>`
            : `${x.entrada ? `<b>${esc(x.entrada)} a ${esc(x.salida)}</b>` : ''}
               <small>${enHoras(x.horas)}${x.notas ? ` · ${esc(x.notas)}` : ''}</small>`}
        </span>

        <span class="jornada-vale">
          ${b.cuentaDias && x.vino ? pesos(x.centavos) : ''}
        </span>
      </button>`;
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
              ? ` <small>${b.tipo === 'por_hora'
                    ? enHoras(b.horasContadas)
                    : `${b.diasContados} ${b.diasContados === 1 ? 'día' : 'días'}`}</small>`
              : ` <small>${esc(b.tipoTexto.toLowerCase())}</small>`}</span>
            <strong>${pesos(b.sueldoCentavos)}</strong>
          </div>
          ${(b.porTipoDia || []).filter((t) => t.clave !== 'entre_semana').map((t) => `
            <div class="cuadre-linea detalle-dia">
              <span>· de eso, ${t.dias} ${t.dias === 1 ? 'día' : 'días'}
                <span class="dia-chip dia-${esc(t.clave)}">${esc(t.corto)}</span></span>
              <strong>${pesos(t.centavos)}</strong>
            </div>`).join('')}
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

        ${b.diasSinApuntar && b.cuentaDias && !b.porCostumbre ? `
          <p class="ayuda" style="margin:14px 0 0">
            Quedan <b>${b.diasSinApuntar}</b> ${b.diasSinApuntar === 1 ? 'día' : 'días'}
            de esta semana sin apuntar. Se puede pagar así, pero esos días
            no le entran.
          </p>` : ''}

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

  /**
   * PONERLE SUELDO.
   *
   * Las cuatro formas de pago que hay en la fábrica, y —cuando la forma
   * cuenta días— las tarifas del sábado, del domingo y de los días
   * especiales. Esas tres se preguntan de una en una y se pueden dejar
   * vacías: vacío quiere decir «lo mismo que un día normal», que es lo
   * que pasa con casi todos y ahorra teclear tres veces el mismo número.
   */
  async function ponerSueldo(d) {
    const tipos = d.tiposSueldo || [];
    const tipo = await menu({
      titulo: `El sueldo de ${d.usuario.nombre}`,
      texto: '¿Cómo se le paga?',
      opciones: tipos.map((t) => ({
        valor: t.clave, texto: t.nombre, detalle: t.ayuda
      }))
    });
    if (!tipo) return;

    const elegido = tipos.find((t) => t.clave === tipo);
    const monto = await pedirImporte({
      titulo: d.usuario.nombre,
      texto: `¿Cuánto gana por ${elegido?.unidad || tipo}?`,
      valor: d.sueldo?.tipo === tipo ? String(d.sueldo.centavos / 100) : '',
      ok: elegido?.porDia ? 'Siguiente' : 'Guardar'
    });
    if (!monto) return;

    const tarifas = {};
    if (elegido?.porDia) {
      const viejas = d.sueldo?.tipo === tipo ? d.sueldo : null;
      for (const [clave, comoSeLlama, columna] of [
        ['sabado', 'los sábados', 'sabado_centavos'],
        ['domingo', 'los domingos', 'domingo_centavos'],
        ['especial', 'los días especiales', 'especial_centavos']
      ]) {
        const v = await pedirImporte({
          titulo: `¿Y ${comoSeLlama}?`,
          texto: `Cuánto gana por ${elegido.unidad} ${comoSeLlama}.`,
          valor: viejas?.[columna] != null ? String(viejas[columna] / 100) : '',
          marcador: String(monto), ok: 'Siguiente',
          ayuda: `Déjalo vacío si ${comoSeLlama} gana lo mismo: ${pesos(Math.round(Number(monto) * 100))}.`
        });
        if (v === null) return;
        if (v) tarifas[clave] = v;
      }
    }

    try {
      await api.enviar(`/raya/${d.usuario.id}/sueldo`, { tipo, monto, ...tarifas });
      avisar('Sueldo guardado', 'bien');
      ficha(d.usuario.id);
    } catch (e) { avisar(e.message, 'error'); }
  }

  // ==========================================================
  // LO QUE TRABAJÓ CADA DÍA  (v6.8)
  // ==========================================================

  /**
   * APUNTAR UN DÍA.
   *
   * Las dos formas conviven porque las dos se usan: unos días se sabe la
   * hora de entrada y la de salida, y otros nada más "hizo seis horas".
   * Lo que se propone primero es lo que dice su horario de costumbre, que
   * es lo que pasó de verdad casi todos los días.
   */
  async function tocarDia(d, semana, x) {
    if (!x) return;
    const cost = x.deCostumbre;
    const nombre = x.nombreDia[0].toUpperCase() + x.nombreDia.slice(1);

    const que = await menu({
      titulo: `${nombre} ${soloDia(x.dia)}`,
      texto: x.tipoDia === 'entre_semana'
        ? `¿Qué pasó ese día con ${d.usuario.nombre}?`
        : `Ese día es ${x.tipoDiaTexto}. ¿Qué pasó con ${d.usuario.nombre}?`,
      opciones: [
        { valor: 'horas', texto: '🕗 Vino — de tal hora a tal hora',
          detalle: cost.viene ? `De costumbre ${cost.entra} a ${cost.sale}`
                              : 'Las horas salen de la resta' },
        { valor: 'nada-mas-horas', texto: '⏱ Vino — nada más las horas',
          detalle: 'Para el que dice "hice seis" y ya' },
        { valor: 'no', texto: '✕ No vino' },
        ...(x.apuntado
          ? [{ valor: 'borrar', texto: '🗑 Borrar lo apuntado',
               detalle: 'El día vuelve a quedar sin apuntar' }]
          : [])
      ]
    });
    if (!que) return;

    const mandar = (cuerpo) => guardarJornada(d, semana, { dia: x.dia, ...cuerpo });

    if (que === 'no') {
      const notas = await pedirTexto({
        titulo: `${nombre} no vino`,
        texto: '¿Por qué? Se puede dejar vacío.',
        valor: x.notas || '', marcador: 'Se reportó enfermo',
        ok: 'Guardar', largo: 200, unaLinea: true, opcional: true
      });
      if (notas === null) return;
      return mandar({ vino: false, notas });
    }

    if (que === 'borrar') {
      try {
        await api.enviar(`/raya/jornadas/${x.jornadaId}/anular`, {});
        avisar('Ese día quedó sin apuntar', 'bien');
        ficha(d.usuario.id, semana);
      } catch (e) { avisar(e.message, 'error'); }
      return;
    }

    if (que === 'nada-mas-horas') {
      const horas = await pedirTexto({
        titulo: `${nombre} ${soloDia(x.dia)}`,
        texto: '¿Cuántas horas trabajó? Media hora se escribe 6.5',
        valor: x.horas != null ? String(x.horas) : (cost.viene ? String(cost.horas) : ''),
        marcador: '8', ok: 'Guardar', largo: 6, unaLinea: true
      });
      if (!horas) return;
      return mandar({ horas });
    }

    const cuando = await pedirTexto({
      titulo: `${nombre} ${soloDia(x.dia)}`,
      texto: 'De qué hora a qué hora, en 24 horas. Por ejemplo: 07:00 a 15:00',
      valor: x.entrada ? `${x.entrada} a ${x.salida}`
           : cost.viene ? `${cost.entra} a ${cost.sale}` : '',
      marcador: '07:00 a 15:00', ok: 'Guardar', largo: 20, unaLinea: true
    });
    if (!cuando) return;

    const partes = String(cuando).split(/\s*(?:a|-|—)\s*/i).filter(Boolean);
    if (partes.length !== 2) {
      return avisar('No se entendió. Se escribe "07:00 a 15:00".', 'error');
    }
    return mandar({ entrada: partes[0].trim(), salida: partes[1].trim() });
  }

  async function guardarJornada(d, semana, cuerpo) {
    try {
      await api.actualizar(`/raya/${d.usuario.id}/jornadas`, { ...cuerpo, ...semana });
      ficha(d.usuario.id, semana);
    } catch (e) { avisar(e.message, 'error'); }
  }

  /**
   * RELLENAR LA SEMANA DE UN GOLPE.
   *
   * Apuntar siete días a mano, por cinco personas, cada semana, es lo que
   * hace que nadie apunte nada. Esto deja puesto lo normal y solo se
   * corrigen las excepciones. Lo que ya se había corregido a mano NO se
   * pisa: el servidor se encarga.
   */
  async function rellenarDeCostumbre(d, semana) {
    let r;
    try {
      r = await api.enviar(`/raya/${d.usuario.id}/jornadas/de-costumbre`, semana);
    } catch (e) { return avisar(e.message, 'error'); }

    avisar(r.puestos
      ? `Quedaron apuntados ${r.puestos} ${r.puestos === 1 ? 'día' : 'días'}`
      : 'Ya estaban todos apuntados', r.puestos ? 'bien' : '');
    ficha(d.usuario.id, semana);
  }

  // ==========================================================
  // LOS DÍAS ESPECIALES
  // ==========================================================
  //
  // "Los días especiales no hay lista fija, los marco yo." Así que esto
  // es un calendario en blanco, no una lista de días de guardar: la feria
  // del pueblo cuenta igual que el 16 de septiembre si él lo dice.

  async function pantallaEspeciales() {
    pantalla.innerHTML = '<div class="cargando">Viendo el calendario…</div>';

    let dias;
    try { dias = (await api.obtener('/raya/dias-especiales')).dias; }
    catch (e) { pantalla.innerHTML = `<p class="vacio">${esc(e.message)}</p>`; return; }

    pantalla.innerHTML = `
      <div class="ancho-completo">
        <button class="secundario chico" id="volver">‹ Sueldos</button>
        <h2 style="margin-top:14px">Días especiales</h2>
        <p class="ayuda">
          Los días que se pagan distinto y no son sábado ni domingo: un
          feriado, la feria del pueblo, el día que se trabajó de más. No hay
          lista fija — se marcan aquí y ya. Un día marcado manda sobre el
          sábado y el domingo.
        </p>

        <div class="tarjeta" style="margin-top:14px;max-width:640px">
          <h3 style="margin:0 0 12px">Marcar un día</h3>
          <div class="esp-alta">
            <label>
              <span>¿Qué día?</span>
              <input type="date" id="esp-dia" value="${esc(hoy())}">
            </label>
            <label>
              <span>¿Qué es?</span>
              <input type="text" id="esp-nombre" maxlength="80"
                     placeholder="16 de septiembre, la feria, el inventario…">
            </label>
            <button id="esp-guardar">Marcar</button>
          </div>
        </div>

        <div class="tarjeta" style="margin-top:14px;max-width:640px">
          <h3 style="margin:0 0 12px">Los que están marcados</h3>
          ${dias.length ? `
            <table class="tabla">
              <tr><th>Día</th><th>Qué es</th><th></th></tr>
              ${dias.map((x) => `
                <tr>
                  <td>${esc(soloDia(x.dia, { conAnio: true }))}</td>
                  <td>${esc(x.nombre)}
                      ${x.capturista_nombre
                        ? `<small>lo marcó ${esc(x.capturista_nombre)}</small>` : ''}</td>
                  <td class="der">
                    <button class="raya-accion peligro" data-quitar="${esc(x.id)}"
                            title="Desmarcar este día">×</button>
                  </td>
                </tr>`).join('')}
            </table>
            <p class="ayuda" style="margin:12px 0 0">
              Desmarcar un día NO cambia lo que ya se pagó ni lo que ya se
              apuntó: cada día trabajado se guardó con la clase que tenía.
            </p>` : `
            <p class="vacio">Ningún día marcado todavía.</p>`}
        </div>
      </div>`;

    pantalla.querySelector('#volver').onclick = lista;
    pantalla.querySelector('#esp-guardar').onclick = async () => {
      const dia = pantalla.querySelector('#esp-dia').value;
      const nombre = pantalla.querySelector('#esp-nombre').value.trim();
      if (!dia) return avisar('Escoge qué día.', 'error');
      if (!nombre) return avisar('Ponle nombre: "16 de septiembre", "la feria".', 'error');
      try {
        await api.enviar('/raya/dias-especiales', { dia, nombre });
        avisar('Día marcado', 'bien');
        pantallaEspeciales();
      } catch (e) { avisar(e.message, 'error'); }
    };
    pantalla.querySelectorAll('[data-quitar]').forEach((x) => {
      x.onclick = async () => {
        const cual = dias.find((y) => y.id === x.dataset.quitar);
        if (!await confirmar({
          titulo: `¿Desmarcar «${cual.nombre}»?`,
          texto: 'Ese día vuelve a pagarse como lo que sea en el calendario. ' +
                 'Lo ya apuntado y lo ya pagado no se mueven.',
          ok: 'Desmarcar', peligro: true
        })) return;
        try {
          await api.borrar(`/raya/dias-especiales/${x.dataset.quitar}`);
          avisar('Día desmarcado', 'bien');
          pantallaEspeciales();
        } catch (e) { avisar(e.message, 'error'); }
      };
    });
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
