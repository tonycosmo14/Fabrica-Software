/**
 * LOS NÚMEROS DEL NEGOCIO  (v2.9)
 *
 * No es un tablero de control: es una HOJA que se lee de arriba abajo y se
 * puede imprimir tal cual. Por eso el orden es el de las preguntas que se
 * hace un dueño, no el de las tablas de la base:
 *
 *   1. ¿Cómo nos fue este mes?            (los cuatro números grandes)
 *   2. ¿Qué días se vendió?               (día por día)
 *   3. ¿Cuánto me cuesta una marqueta?    (el número que junta todo)
 *   4. ¿En qué se me fue el dinero?
 *   5. ¿Cuánto hielo se hizo y quién?
 *   6. ¿Vamos mejor o peor que antes?     (la tendencia)
 *
 * CADA NÚMERO LLEVA SU EXPLICACIÓN, en el renglón de abajo y en castellano
 * de todos los días. Un número que hay que preguntarle a alguien qué
 * significa no sirve para decidir nada.
 */
import { api } from '../api.js';
import { esc, avisar } from '../util.js';
import { confirmar } from '../dialogo.js';
import { pesos } from '../fracciones.js';
import { barras, barrasAcostadas, linea } from '../graficas.js';
import { imprimirHoja } from '../imprimir.js';

export async function vistaEstadisticas(pantalla) {
  let mes = null;
  let meses = null;          // la tendencia: se pide aparte y solo una vez

  // EN LA VENTANA DE LOS TICKETS NO SE PUEDE SACAR UNA HOJA.
  //
  // El programa se abre con impresión directa para que los tickets salgan
  // sin preguntar nada: ahí Ctrl+P no enseña el cuadro de imprimir, manda
  // el papel a la impresora de siempre —la térmica— y no deja elegir
  // "Guardar como PDF". Un reporte en hoja carta necesita justo ese cuadro,
  // así que en esa ventana el botón hace otra cosa: abre el sistema en el
  // navegador normal, donde sí pregunta.
  let ventanaDirecta = false;
  try { ventanaDirecta = (await api.obtener('/impresion/config')).ventanaDirecta; }
  catch { ventanaDirecta = false; }

  await pintar();

  async function pintar(clave = null) {
    pantalla.innerHTML = '<div class="cargando">Sacando cuentas…</div>';

    let d;
    try {
      d = await api.obtener(`/estadisticas${clave ? `?periodo=${encodeURIComponent(clave)}` : ''}`);
      mes = d.periodo;
      if (!meses) meses = (await api.obtener('/estadisticas/meses?cuantos=12')).meses;
    } catch (e) { pantalla.innerHTML = `<p class="vacio">${esc(e.message)}</p>`; return; }

    pantalla.innerHTML = `
      <div class="ancho-completo hoja">
        ${cabeza(d)}
        ${resumen(d)}
        ${diaPorDia(d)}
        ${elCosto(d)}
        ${enQueSeFue(d)}
        ${elHielo(d)}
        ${laTendencia()}
        ${pieDeHoja(d)}
      </div>`;

    enganchar(d);
  }


  // ==========================================================
  // 1 · CÓMO NOS FUE
  // ==========================================================

  function cabeza(d) {
    return `
      <div class="est-cabeza no-imprimir">
        <label>
          <span class="etiqueta-chica">El mes<small>${esc(mes.fechas || 'del 1 al último')}</small></span>
          <select id="mes">
            ${d.periodos.map((p) => `
              <option value="${esc(p.clave)}" ${p.clave === mes.clave ? 'selected' : ''}>
                ${esc(p.nombre)}${p.fechas ? ` · ${esc(p.fechas)}` : ''}
              </option>`).join('')}
          </select>
        </label>
        <button class="secundario" id="imprimir">
          ${ventanaDirecta ? '🖨 Sacar esta hoja / PDF' : '🖨 Imprimir esta hoja'}
        </button>
      </div>

      <div class="hoja-titulo">
        <h2>Los números de ${esc(mes.nombre)}</h2>
        <p class="ayuda">
          ${esc(mes.fechas ? `Del ${mes.fechas.replace(' — ', ' al ')}.` : 'Mes de calendario completo.')}
          Todo lo de esta hoja se saca de los renglones capturados; no hay
          ningún total guardado que se pueda desincronizar.
        </p>
      </div>`;
  }

  function resumen(d) {
    const dif = (hoy, antes) => {
      if (!antes) return { texto: 'no hay con qué comparar', clase: '' };
      const p = Math.round(((hoy - antes) / antes) * 100);
      return {
        texto: `${p > 0 ? '+' : ''}${p}% contra ${esc(d.anterior.nombre)}`,
        clase: p > 0 ? 'bueno' : p < 0 ? 'malo' : ''
      };
    };

    const dv = dif(d.ventas.centavos, d.ventasAntes.centavos);
    const dp = dif(d.produccion.buenas, d.produccionAntes.buenas);
    // En el costo por marqueta, subir es MALO: se invierten los colores.
    const dc = d.costoAntes.centavos && d.costo.centavos
      ? (() => {
          const p = Math.round(((d.costo.centavos - d.costoAntes.centavos) / d.costoAntes.centavos) * 100);
          return { texto: `${p > 0 ? '+' : ''}${p}% contra ${esc(d.anterior.nombre)}`,
                   clase: p > 0 ? 'malo' : p < 0 ? 'bueno' : '' };
        })()
      : { texto: 'no hay con qué comparar', clase: '' };

    return `
      <div class="hist-resumen est-grandes evitar-corte">
        <div class="hist-dato">
          <small>Se vendió</small>
          <strong class="bueno">${pesos(d.ventas.centavos)}</strong>
          <small class="${dv.clase}">${dv.texto}</small>
        </div>
        <div class="hist-dato">
          <small>Se produjo</small>
          <strong>${d.produccion.buenas.toLocaleString('es-MX')}</strong>
          <small class="${dp.clase}">marquetas · ${dp.texto}</small>
        </div>
        <div class="hist-dato">
          <small>Costó cada marqueta</small>
          <strong class="${d.costo.completo ? '' : 'incompleto'}">
            ${d.costo.centavos != null ? pesos(d.costo.centavos) : '—'}
          </strong>
          <small class="${dc.clase}">${dc.texto}</small>
        </div>
        <div class="hist-dato">
          <small>Salió de la caja</small>
          <strong class="malo">${pesos(d.costo.delMes.total)}</strong>
          <small>cajón + compras grandes + luz</small>
        </div>
      </div>

      <p class="est-nota">
        <b>Se vendió</b> es el precio de todo lo que salió, esté cobrado o
        fiado${d.ventas.fiado ? ` — de eso, <b>${pesos(d.ventas.fiado)}</b> se fio` : ''}.
        Los tickets cancelados y las devoluciones no cuentan${
          d.ventas.canceladas.cuantas
            ? `: hubo ${d.ventas.canceladas.cuantas} por ${pesos(d.ventas.canceladas.centavos)}`
            : ''}.
        Fueron <b>${d.ventas.tickets}</b> ${d.ventas.tickets === 1 ? 'ticket' : 'tickets'},
        de <b>${pesos(d.ventas.porTicket)}</b> cada uno en promedio.
        ${d.abonos.cuantos ? `<br>Aparte entraron <b>${pesos(d.abonos.centavos)}</b>
          en ${d.abonos.cuantos} ${d.abonos.cuantos === 1 ? 'abono' : 'abonos'}:
          eso es dinero de ventas fiadas de <b>otros meses</b>, así que no
          suma aquí — pero sí entró al cajón.` : ''}
      </p>`;
  }


  // ==========================================================
  // 2 · DÍA POR DÍA
  // ==========================================================

  function diaPorDia(d) {
    const conVentas = d.porDia.filter((x) => x.centavos > 0);
    const mejor = conVentas.length
      ? conVentas.reduce((a, b) => (b.centavos > a.centavos ? b : a)) : null;

    return `
      <div class="tarjeta est-bloque evitar-corte">
        <h3>Día por día</h3>
        <div class="est-grafica">
          ${barras(d.porDia.map((x) => ({
            etiqueta: x.numero,
            valor: x.centavos,
            resaltar: x.diaSemana === 0,
            titulo: `${x.numero}: ${pesos(x.centavos)} · ${x.tickets} ` +
                    `${x.tickets === 1 ? 'ticket' : 'tickets'} · ${x.marquetas} marquetas`
          })), { formato: pesos, cadaCuantas: d.porDia.length > 20 ? 3 : 1 })}
        </div>
        <p class="est-nota">
          Cada barra es un día y su alto es lo que se vendió; los
          <b>domingos van marcados</b>. Los días sin barra son días sin
          ventas capturadas — que puede ser que no se abrió, o que no se
          cobró nada.
          ${mejor ? ` El día más fuerte fue el <b>${mejor.numero}</b>,
            con ${pesos(mejor.centavos)}.` : ''}
          Al dejar el ratón encima de una barra sale el detalle del día.
        </p>
      </div>`;
  }


  // ==========================================================
  // 3 · EL NÚMERO QUE JUNTA TODO
  // ==========================================================

  function elCosto(d) {
    const c = d.costo;
    if (c.centavos == null) {
      return `
        <div class="tarjeta est-bloque evitar-corte">
          <h3>Cuánto cuesta una marqueta</h3>
          <p class="est-nota">
            En ${esc(mes.nombre)} no se registró producción, así que este
            número no se puede sacar. No se inventa: repartir los gastos
            entre cero marquetas no significa nada.
          </p>
        </div>`;
    }

    const partes = [
      { etiqueta: 'La luz', valor: c.porMarqueta.luz },
      { etiqueta: 'Compras grandes (amoniaco, sal, aceite…)', valor: c.porMarqueta.grandes },
      { etiqueta: 'Gastos del cajón', valor: c.porMarqueta.cajon }
    ].filter((x) => x.valor > 0).sort((a, b) => b.valor - a.valor);

    // Cuando algo se repartió, los dos números difieren y hay que explicar
    // por qué; cuando no, decirlo sería marear con una distinción que este
    // mes no existe.
    const repartidos = (c.grandesPorConcepto || []).filter((g) => g.repartido);

    return `
      <div class="tarjeta est-bloque evitar-corte">
        <h3>Cuánto cuesta una marqueta</h3>

        <div class="est-costo">
          <div class="est-costo-numero">
            <strong>${pesos(c.centavos)}</strong>
            <small>por marqueta, en un mes normal</small>
            ${c.hayReparto && c.delMes.centavos != null ? `
              <span class="est-costo-otro">
                este mes de verdad se pagaron <b>${pesos(c.delMes.centavos)}</b>
              </span>` : ''}
          </div>
          <div class="est-costo-cuenta">
            ${barrasAcostadas(partes, { formato: pesos })}
          </div>
        </div>

        <p class="est-nota">
          Se toma lo que cuesta un mes de trabajo —${pesos(c.total)}— y se
          reparte entre las <b>${c.marquetas.toLocaleString('es-MX')}</b>
          marquetas que se produjeron. Es el número que hay que vigilar: si
          sube sin que suba la tarifa de la luz ni el precio del amoniaco,
          algo está trabajando de más.
        </p>

        ${repartidos.length ? `
          <p class="est-nota">
            <b>Por qué hay dos números.</b> Las cosas que se compran de tanto
            en tanto no se gastan el día que se pagan: un cilindro de
            amoniaco cuesta mucho una vez y enfría durante tres meses. Si se
            le cargara entero al mes que tocó comprarlo, ese mes se vería
            carísimo y los dos siguientes baratísimos, sin que en la fábrica
            hubiera pasado nada. Por eso cada compra se estira sobre los días
            que dura —los que dice su ficha en las cuentas de la empresa— y a
            este mes le toca solo su parte:
            ${repartidos.map((g) => `<b>${esc(g.nombre)}</b>`).join(', ')}.
            El de arriba sirve para <b>comparar meses</b>; el de al lado dice
            <b>cuánto dinero salió de verdad</b>.
          </p>` : ''}

        <p class="est-nota est-aviso">
          <b>Ojo: aquí no está la raya.</b> Los sueldos no se llevan en el
          sistema, así que lo que de verdad cuesta una marqueta es más que
          esto. Estos números sirven para <b>comparar y vigilar</b> — no para
          sacar el precio de venta.
          ${c.completo ? '' : `<br><b>Y este mes va incompleto:</b> faltan
            ${c.faltanDiasDeLuz} días de recibo de luz, así que el costo
            real va a ser más alto que el que dice arriba.`}
        </p>
      </div>`;
  }


  // ==========================================================
  // 4 · EN QUÉ SE FUE EL DINERO
  // ==========================================================

  function enQueSeFue(d) {
    // DE DÓNDE SALIÓ CADA PESO, dicho en la etiqueta. "Mantenimiento"
    // existe en las dos bolsas —el cajero puede pagarle al plomero del
    // cajón y el administrador capturar la factura del mismo trabajo—, y
    // dos barras con el mismo nombre no se entienden. Diciendo de dónde
    // viene cada una, si un trabajo se apuntó dos veces se ve solo.
    const nombresDeCaja = new Set(d.gastos.porConcepto.map((g) => g.nombre.toLowerCase()));
    const marca = (nombre, donde) =>
      (nombresDeCaja.has(nombre.toLowerCase()) ? `${nombre} (${donde})` : nombre);

    const todo = [
      ...(d.luz.centavos ? [{ etiqueta: 'Luz (CFE)', valor: d.luz.centavos }] : []),
      ...d.grandes.map((g) => ({ etiqueta: marca(g.nombre, 'con factura'), valor: g.centavos })),
      ...d.gastos.porConcepto.map((g) => ({
        etiqueta: d.grandes.some((x) => x.nombre.toLowerCase() === g.nombre.toLowerCase())
          ? `${g.nombre} (del cajón)` : g.nombre,
        valor: g.centavos
      }))
    ].sort((a, b) => b.valor - a.valor);

    return `
      <div class="tarjeta est-bloque evitar-corte">
        <h3>En qué se fue el dinero</h3>
        ${barrasAcostadas(todo, { formato: pesos })}
        <p class="est-nota">
          Todo junto: la luz, las compras grandes de la empresa y los gastos
          chicos del cajón, del más caro al más barato. Estas barras suman
          exactamente <b>${pesos(d.costo.delMes.total)}</b>, que es lo que
          dice arriba <b>«salió de la caja»</b>: es el dinero que de verdad
          se pagó este mes.
          ${d.costo.hayReparto ? ` Ojo, no es lo mismo que el costo por
            marqueta de arriba: ese reparte las compras que duran meses a su
            ritmo, y por eso da ${pesos(d.costo.total)}.` : ''}
          ${d.gastos.traspasado ? `
            <b>No incluye ${pesos(d.gastos.traspasado)} de traspasos</b>
            —el dinero que solo cambió de sitio, como un retiro a la caja
            fuerte—: la fábrica no lo gastó, y sumarlo lo contaría dos
            veces cuando se pague algo con ese efectivo.` : ''}
        </p>
      </div>`;
  }


  // ==========================================================
  // 5 · EL HIELO
  // ==========================================================

  function elHielo(d) {
    const p = d.produccion;
    const perdidas = p.rotas + p.huecos;

    return `
      <div class="tarjeta est-bloque evitar-corte">
        <h3>El hielo</h3>

        <div class="hist-resumen">
          <div class="hist-dato">
            <small>Salieron buenas</small>
            <strong>${p.buenas.toLocaleString('es-MX')}</strong>
            <small>${p.porCientoBuenas != null
              ? `${p.porCientoBuenas}% de los moldes` : 'sin producción'}</small>
          </div>
          <div class="hist-dato">
            <small>Se echaron a perder</small>
            <strong class="${perdidas ? 'malo' : ''}">${perdidas.toLocaleString('es-MX')}</strong>
            <small>${p.rotas} rotas · ${p.huecos} huecas</small>
          </div>
          <div class="hist-dato">
            <small>Se vendió</small>
            <strong>${d.hielo.marquetas.toLocaleString('es-MX')}</strong>
            <small>marquetas, contando los pedazos</small>
          </div>
        </div>

        ${d.porObrero.length ? `
          <div class="hist-envoltura" style="margin-top:14px">
            <table class="tabla hist-tabla">
              <tr><th>Quién lo sacó</th><th class="der">Paños</th><th class="der">Marquetas</th></tr>
              ${d.porObrero.map((o) => `
                <tr>
                  <td>${esc(o.nombre)}</td>
                  <td class="der">${o.panos}</td>
                  <td class="der">${o.marquetas.toLocaleString('es-MX')}</td>
                </tr>`).join('')}
            </table>
          </div>` : ''}

        <p class="est-nota">
          <b>Salieron buenas</b> se cuenta molde por molde, que es donde
          está la verdad: un molde que salió bien es una marqueta. Si el
          porcentaje empieza a bajar, hay moldes o una máquina fallando.
          Lo producido y lo vendido <b>no tienen por qué cuadrar</b>: entre
          los dos está lo que quedó en el cuarto frío y lo que se derritió.
        </p>
      </div>`;
  }


  // ==========================================================
  // 6 · LA TENDENCIA
  // ==========================================================

  function laTendencia() {
    if (!meses?.length) return '';
    const conCosto = meses.filter((m) => m.costoPorMarqueta != null);

    return `
      <div class="tarjeta est-bloque evitar-corte salto-hoja">
        <h3>Los últimos doce meses</h3>

        <h4 class="est-subtitulo">Lo que se vendió cada mes</h4>
        <div class="est-grafica">
          ${barras(meses.map((m) => ({
            etiqueta: m.corto, valor: m.vendido,
            resaltar: m.clave === mes.clave,
            titulo: `${m.nombre}: ${pesos(m.vendido)} · ${m.tickets} tickets`
          })), { formato: pesos, alto: 90 })}
        </div>

        <h4 class="est-subtitulo">Lo que costó cada marqueta</h4>
        <div class="est-grafica">
          ${linea(meses.map((m) => ({
            etiqueta: m.corto, valor: m.costoPorMarqueta
          })), { formato: pesos, color: 'var(--malo, #c0392b)' })}
        </div>
        <p class="est-nota">
          Esta línea <b>no empieza en cero</b>, a propósito: de $32 a $36 hay
          un cambio que importa, y con el eje desde cero se vería una raya
          plana. Lo que se lee aquí es la <b>inclinación</b>, no la altura.
          ${conCosto.some((m) => !m.completo)
            ? ' Los meses a los que les falta recibo de luz salen más baratos de lo que fueron.'
            : ''}
        </p>
      </div>`;
  }

  function pieDeHoja(d) {
    const cuando = new Date().toLocaleString('es-MX', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    return `
      <p class="hoja-pie">
        Hielo LOLHA · ${esc(mes.nombre)} · hoja sacada el ${esc(cuando)}
      </p>`;
  }

  /**
   * Sacar la hoja: en papel o en PDF, que en el navegador son la misma
   * cosa —se elige en el cuadro de imprimir—. Lo único que cambia es de
   * qué ventana se hace.
   */
  async function sacarLaHoja() {
    if (!ventanaDirecta) {
      avisar('Para guardarla en PDF, elige "Guardar como PDF" en vez de la impresora', '');
      return imprimirHoja();
    }

    // En la ventana de los tickets, imprimir aquí mandaría la hoja a la
    // térmica sin preguntar. Se abre el sistema en el navegador normal.
    const seguir = await confirmar({
      titulo: 'Sacar la hoja en papel o en PDF',
      texto: 'Esta ventana está puesta para que los tickets salgan solos, sin ' +
             'preguntar, y por eso no puede elegir impresora ni guardar un PDF. ' +
             'Se va a abrir el sistema en tu navegador de siempre, ya en esta ' +
             'misma pantalla: ahí le das al mismo botón y te deja elegir.',
      ok: 'Abrir el navegador'
    });
    if (!seguir) return;

    try {
      const r = await api.enviar('/impresion/abrir-en-navegador',
                                 { donde: `#/estadisticas` });
      avisar(r.abrio
        ? 'Se abrió el navegador. Ahí dale a "Imprimir esta hoja".'
        : 'No se pudo abrir el navegador solo; ábrelo a mano en localhost.', r.abrio ? 'bien' : '');
    } catch (e) { avisar(e.message, 'error'); }
  }

  function enganchar() {
    const sel = pantalla.querySelector('#mes');
    if (sel) sel.onchange = () => pintar(sel.value);

    const btn = pantalla.querySelector('#imprimir');
    if (btn) btn.onclick = sacarLaHoja;
  }
}
