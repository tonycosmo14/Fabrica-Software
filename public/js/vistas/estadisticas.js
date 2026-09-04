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

  // ==========================================================
  // EL ORDEN DE LA HOJA  (v4.6)
  //
  // "En los reportes, que pueda subir o bajar las gráficas o datos que
  //  quiera ver primero."
  //
  // Cada apartado tiene su id, su título y si necesita el ancho entero.
  // El orden se guarda EN LA FÁBRICA y no en este navegador: así sigue
  // igual desde la PC y desde la pantalla táctil.
  //
  // Se sube y se baja con flechas, no arrastrando: en una pantalla táctil,
  // arrastrar una tarjeta de media pantalla no lo hace nadie dos veces.
  //
  // Va aquí arriba y no abajo a propósito: `const` no se adelanta como las
  // funciones, y el primer `pintar()` corre antes de llegar al final del
  // archivo. Declararlo abajo reventaría con "no se puede acceder antes de
  // inicializar", que ya nos pasó una vez.
  // ==========================================================
  const APARTADOS = [
    { id: 'resumen',   titulo: 'Cómo nos fue',               pinta: (d) => resumen(d),        ancho: true },
    { id: 'dia',       titulo: 'Día por día',                pinta: (d) => diaPorDia(d),      ancho: true },
    { id: 'costo',     titulo: 'Cuánto cuesta una marqueta', pinta: (d) => elCosto(d) },
    { id: 'luz',       titulo: 'La luz',                     pinta: (d) => laLuz(d) },
    { id: 'gastos',    titulo: 'En qué se fue el dinero',    pinta: (d) => enQueSeFue(d) },
    { id: 'hielo',     titulo: 'El hielo que se hizo',       pinta: (d) => elHielo(d) },
    { id: 'clientes',  titulo: 'Quién compra más',           pinta: (d) => quienCompraMas(d) },
    { id: 'tendencia', titulo: 'Los últimos doce meses',     pinta: () => laTendencia(),      ancho: true }
  ];

  let orden = APARTADOS.map((a) => a.id);
  // El orden guardado se lee UNA sola vez, al entrar. Leerlo en cada
  // repintado deshacía el movimiento recién hecho: se movía la tarjeta, se
  // repintaba, y el servidor —que todavía no se había enterado— devolvía el
  // orden viejo y la tarjeta volvía a su sitio.
  let ordenLeido = false;

  /**
   * Los apartados como los quiere ver quien mira, y sin perder ninguno.
   *
   * Los que no estén en el orden guardado van al final: así un apartado
   * NUEVO aparece solo en las fábricas que ya tenían su orden puesto, en
   * vez de desaparecer para siempre.
   */
  function enOrden(d) {
    const puestos = orden.filter((id) => APARTADOS.some((a) => a.id === id));
    const faltan = APARTADOS.map((a) => a.id).filter((id) => !puestos.includes(id));
    orden = [...puestos, ...faltan];

    return orden.map((id, i) => {
      const a = APARTADOS.find((x) => x.id === id);
      const cuerpo = a.pinta(d);
      if (!cuerpo) return '';
      return `
        <div class="hoja-apartado ${a.ancho ? 'ancho' : ''}" data-apartado="${esc(id)}">
          <div class="hoja-mover no-imprimir">
            <button class="tachita papel" data-subir="${esc(id)}"
                    title="Subir «${esc(a.titulo)}»" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="tachita papel" data-bajar="${esc(id)}"
                    title="Bajar «${esc(a.titulo)}»" ${i === orden.length - 1 ? 'disabled' : ''}>↓</button>
          </div>
          ${cuerpo}
        </div>`;
    }).join('');
  }

  /** Mover uno de sitio. Se repinta enseguida y se guarda después. */
  async function mover(id, cuanto) {
    const i = orden.indexOf(id);
    const j = i + cuanto;
    if (i < 0 || j < 0 || j >= orden.length) return;
    const lista = [...orden];
    [lista[i], lista[j]] = [lista[j], lista[i]];
    orden = lista;

    await pintar(mes?.clave || null);
    try {
      await api.actualizar('/estadisticas/orden', { orden });
    } catch (e) { avisar(e.message, 'error'); }
  }

  await pintar();

  async function pintar(clave = null) {
    pantalla.innerHTML = '<div class="cargando">Sacando cuentas…</div>';

    let d;
    try {
      d = await api.obtener(`/estadisticas${clave ? `?periodo=${encodeURIComponent(clave)}` : ''}`);
      mes = d.periodo;
      if (!ordenLeido && Array.isArray(d.orden) && d.orden.length) orden = d.orden;
      ordenLeido = true;
      if (!meses) meses = (await api.obtener('/estadisticas/meses?cuantos=12')).meses;
    } catch (e) { pantalla.innerHTML = `<p class="vacio">${esc(e.message)}</p>`; return; }

    pantalla.innerHTML = `
      <div class="ancho-completo hoja">
        ${cabeza(d)}
        <div class="hoja-rejilla">
          ${enOrden(d)}
        </div>
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
    const dp = dif(d.produccion.producidas, d.produccionAntes.producidas);
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
          <strong>${d.produccion.producidas.toLocaleString('es-MX')}</strong>
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
        <b>Se vendió</b> es el precio de todo lo que salió, cobrado o a
        crédito${d.ventas.fiado ? ` — de eso, <b>${pesos(d.ventas.fiado)}</b> se fue a crédito` : ''}.
        Los tickets cancelados y las devoluciones no cuentan${
          d.ventas.canceladas.cuantas
            ? `: hubo ${d.ventas.canceladas.cuantas} por ${pesos(d.ventas.canceladas.centavos)}`
            : ''}.
        Fueron <b>${d.ventas.tickets}</b> ${d.ventas.tickets === 1 ? 'ticket' : 'tickets'},
        de <b>${pesos(d.ventas.porTicket)}</b> cada uno en promedio.
        ${d.abonos.cuantos ? `<br>Aparte entraron <b>${pesos(d.abonos.centavos)}</b>
          en ${d.abonos.cuantos} ${d.abonos.cuantos === 1 ? 'abono' : 'abonos'}:
          eso es dinero de ventas a crédito de <b>otros meses</b>, así que no
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

        <p class="est-nota ${c.rayaCentavos ? '' : 'est-aviso'}">
          ${c.rayaCentavos ? `
            <b>Y aquí ya está la raya:</b> ${pesos(c.rayaCentavos)} de sueldos
            este mes, salgan del cajón o de fuera. Hasta la versión pasada no
            estaban y este número se quedaba corto.`
          : `<b>Ojo: este mes no hay ningún sueldo capturado.</b> Los sueldos
            se pagan en <b>Sueldos</b>, y desde ahí entran solos a esta cuenta.
            Mientras no se paguen desde el sistema, lo que de verdad cuesta
            una marqueta es más que esto.`}
          Estos números sirven para <b>comparar y vigilar</b> — no para sacar
          el precio de venta.
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
    const cal = d.calidades || [];
    const conAlgo = cal.filter((c) => p[c.clave] > 0);
    const fuera = p.fueraDelAlmacen || 0;
    const total = p.salieron || 0;
    const porCiento = (n) => (total ? Math.round((n / total) * 100) : 0);

    return `
      <div class="tarjeta est-bloque evitar-corte">
        <h3>El hielo</h3>

        <div class="hist-resumen">
          <div class="hist-dato">
            <small>Salieron del molde</small>
            <strong>${p.producidas.toLocaleString('es-MX')}</strong>
            <small>${p.rotas ? `${p.rotas} moldes no dieron nada` : 'ningún molde falló'}</small>
          </div>
          <div class="hist-dato">
            <small>Sin una sola queja</small>
            <strong class="${p.porCientoSinQueja != null && p.porCientoSinQueja < 70 ? 'malo' : ''}">
              ${p.porCientoSinQueja != null ? `${p.porCientoSinQueja}%` : '—'}
            </strong>
            <small>${p.sinQueja.toLocaleString('es-MX')} selladas o normales</small>
          </div>
          <div class="hist-dato">
            <small>Se vendió</small>
            <strong>${d.hielo.marquetas.toLocaleString('es-MX')}</strong>
            <small>marquetas, contando los pedazos</small>
          </div>
        </div>

        ${conAlgo.length || p.rotas ? `
          <div class="mezcla-barra" style="margin-top:16px">
            ${conAlgo.map((c) => `
              <span class="mezcla-tramo ${esc(c.clave)}" style="flex:${p[c.clave]}"
                    title="${esc(c.plural)}: ${p[c.clave].toLocaleString('es-MX')}"
                >${porCiento(p[c.clave]) >= 8 ? porCiento(p[c.clave]) + '%' : ''}</span>`).join('')}
            ${p.rotas ? `<span class="mezcla-tramo merma" style="flex:${p.rotas}"
                               title="Rotas: ${p.rotas}"></span>` : ''}
          </div>
          <div class="mezcla-lista">
            ${conAlgo.map((c) => `
              <span class="mezcla-parte ${esc(c.clave)}"
                >${p[c.clave].toLocaleString('es-MX')} ${esc(c.corto)}</span>`).join('')}
            ${p.rotas ? `<span class="mezcla-parte merma">${p.rotas} rotas</span>` : ''}
          </div>` : ''}

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
          <b>Cómo salió el hielo</b> es la barra de arriba, y es lo
          primero que hay que mirar: una marqueta hueca se cobra igual que
          una sellada, así que en el dinero NO se nota — se nota en las
          quejas del mostrador. Cuando la barra se corre hacia la derecha
          varios días seguidos, algo está pasando (el amoniaco, un
          compresor, el calor de mayo) y se ve <b>antes</b> de que una
          máquina se pare.
          ${fuera > 0 ? `<br><br>${fuera.toLocaleString('es-MX')} marquetas
            ${fuera === 1 ? 'salió del molde pero no entró' : 'salieron del molde pero no entraron'}
            al cuarto frío: cáscaras, contaminadas o lo que se anotó aparte, que
            ${fuera === 1 ? 'se fue' : 'se fueron'} a los condensadores o
            ${fuera === 1 ? 'se botó' : 'se botaron'}. Siguen contando para el costo por
            marqueta —gastaron la misma agua, la misma luz y el mismo molde— pero no son
            hielo que se pueda vender.` : ''}
          <br><br>
          Lo producido y lo vendido <b>no tienen por qué cuadrar</b>: entre
          los dos está lo que quedó en el cuarto frío y lo que se derritió.
        </p>
      </div>`;
  }


  // ==========================================================
  // LA LUZ  (v4.6)
  //
  // "Un dato que sí es importante para mí es el del consumo de luz: cuánto
  //  se consumió en kW y cuánto en dinero. Necesito poder observar de
  //  manera clara si estamos consumiendo más luz y produciendo menos, o es
  //  lo mismo y el precio de la luz está aumentando."
  //
  // Son TRES preguntas distintas dentro de un solo recibo más caro, y
  // juntas no se contestan. Por separado, cada una tiene su número:
  //
  //     ¿consumimos más?   kWh del mes
  //     ¿está más cara?    $ por kWh        ← eso lo pone la CFE
  //     ¿rinde menos?      kWh por marqueta ← eso lo pone la fábrica
  //
  // El tercero es el que no se puede leer en el papel del recibo, y es el
  // que avisa de una máquina trabajando peor aunque el recibo venga igual.
  // ==========================================================
  function laLuz(d) {
    const l = d.luzPorMarqueta;
    const antes = d.luzPorMarquetaAntes;
    if (!l || !l.kwh) {
      return `
        <div class="tarjeta est-bloque evitar-corte">
          <h3>La luz</h3>
          <p class="est-nota">
            No hay recibos de la CFE capturados para ${esc(mes.nombre)}. Se
            capturan en <b>La empresa › Recibos de luz</b>, con sus kilowatts
            y su importe: sin eso no se puede saber si la luz subió o si la
            máquina está gastando de más.
          </p>
        </div>`;
    }

    // El cambio contra el mes pasado, en por ciento. Cada uno con su
    // lectura: más kWh por marqueta es MALO, aunque el recibo baje.
    const cambio = (hoy, ayer, subirEsMalo = true) => {
      if (hoy == null || !ayer) return null;
      const p = Math.round(((hoy - ayer) / ayer) * 100);
      if (p === 0) return { texto: 'igual que el mes pasado', clase: '' };
      return {
        texto: `${p > 0 ? '+' : ''}${p}% contra ${esc(d.anterior.nombre)}`,
        clase: (p > 0) === subirEsMalo ? 'malo' : 'bueno'
      };
    };

    const filas = [
      {
        que: 'Se consumió', valor: `${l.kwh.toLocaleString('es-MX')} kWh`,
        nota: 'kilowatts que marcó el medidor',
        cambio: cambio(l.kwh, antes?.kwh)
      },
      {
        que: 'Se pagó', valor: pesos(l.centavos),
        nota: 'lo que cobró la CFE',
        cambio: cambio(l.centavos, antes?.centavos)
      },
      {
        que: 'A cómo salió el kilowatt',
        valor: l.centavosPorKwh != null ? pesos(l.centavosPorKwh) : '—',
        nota: 'esto lo pone la CFE, no la fábrica',
        cambio: cambio(l.centavosPorKwh, antes?.centavosPorKwh)
      },
      {
        que: 'Luz por marqueta',
        valor: l.kwhPorMarqueta != null ? `${l.kwhPorMarqueta} kWh` : '—',
        nota: 'esto sí lo pone la fábrica: cuánta luz cuesta hacer una',
        cambio: cambio(l.kwhPorMarqueta, antes?.kwhPorMarqueta),
        fuerte: true
      },
      {
        que: 'Y en dinero por marqueta',
        valor: l.centavosPorMarqueta != null ? pesos(l.centavosPorMarqueta) : '—',
        nota: 'los dos efectos juntos, que es lo que se paga',
        cambio: cambio(l.centavosPorMarqueta, antes?.centavosPorMarqueta)
      }
    ];

    return `
      <div class="tarjeta est-bloque evitar-corte">
        <h3>La luz</h3>
        <p class="est-subtitulo">
          ${l.marquetas.toLocaleString('es-MX')} marquetas producidas
          en ${esc(mes.nombre)}
        </p>

        <table class="tabla est-luz">
          ${filas.map((f) => `
            <tr class="${f.fuerte ? 'fuerte' : ''}">
              <th>${esc(f.que)}<small>${esc(f.nota)}</small></th>
              <td class="der"><strong>${esc(f.valor)}</strong></td>
              <td class="der">${f.cambio
                ? `<span class="est-dif ${f.cambio.clase}">${f.cambio.texto}</span>`
                : '<span class="est-dif">sin comparación</span>'}</td>
            </tr>`).join('')}
        </table>

        <p class="est-nota">
          <b>Cómo se lee.</b> Si sube <b>a cómo salió el kilowatt</b>, la luz
          está más cara y no hay nada que arreglar en la fábrica. Si sube
          <b>luz por marqueta</b>, es al revés: se está gastando más luz para
          hacer lo mismo, y eso es una máquina que hay que revisar. Pueden
          subir los dos a la vez, y por eso van separados.
        </p>

        ${l.completo ? '' : `
          <p class="est-nota est-aviso">
            Faltan <b>${l.faltanDias} ${l.faltanDias === 1 ? 'día' : 'días'}</b>
            de ${esc(mes.nombre)} sin recibo capturado, así que estos números
            van cortos.
          </p>`}
      </div>`;
  }

  // ==========================================================
  // QUIÉN COMPRA MÁS  (v4.6)
  //
  // Solo salen las ventas CON CLIENTE. El mostrador de a cuarto es la mitad
  // del negocio y no tiene nombre: meterlo aquí como "sin cliente" sería un
  // renglón que tapa a todos los demás y no dice nada de nadie.
  // ==========================================================
  function quienCompraMas(d) {
    const lista = d.porCliente || [];
    if (!lista.length) {
      return `
        <div class="tarjeta est-bloque evitar-corte">
          <h3>Quién compra más</h3>
          <p class="est-nota">
            En ${esc(mes.nombre)} ninguna venta salió a nombre de un cliente.
            Aquí solo entra lo que se cobró con nombre: el mostrador de a
            cuarto no tiene dueño y no se puede repartir.
          </p>
        </div>`;
    }

    const cuando = (iso) => new Date(iso).toLocaleDateString('es-MX',
      { day: 'numeric', month: 'short' });

    return `
      <div class="tarjeta est-bloque evitar-corte">
        <h3>Quién compra más</h3>
        <p class="est-subtitulo">
          Los ${lista.length} que más se llevaron en ${esc(mes.nombre)}
        </p>

        ${barrasAcostadas(
          lista.slice(0, 8).map((c) => ({ etiqueta: c.nombre, valor: c.centavos })),
          { formato: pesos })}

        <div class="hist-envoltura" style="margin-top:12px">
          <table class="tabla hist-tabla">
            <tr>
              <th>Cliente</th><th class="der">Se llevó</th>
              <th class="der">Marquetas</th><th class="der">Veces</th>
              <th>Última</th>
            </tr>
            ${lista.map((c) => `
              <tr>
                <td>${esc(c.nombre)}
                    ${c.negocio ? `<small>${esc(c.negocio)}</small>` : ''}</td>
                <td class="der"><strong>${pesos(c.centavos)}</strong></td>
                <td class="der">${c.marquetas ? esc(c.marquetas.toFixed(2).replace(/\.00$/, '')) : '—'}</td>
                <td class="der">${c.tickets}${c.fiados
                  ? ` <small>(${c.fiados} a crédito)</small>` : ''}</td>
                <td>${esc(cuando(c.ultima))}</td>
              </tr>`).join('')}
          </table>
        </div>
      </div>`;
  }

  // ==========================================================
  // 6 · LA TENDENCIA
  // ==========================================================

  function laTendencia() {
    if (!meses?.length) return '';
    const conCosto = meses.filter((m) => m.costoPorMarqueta != null);
    const conLuz = meses.filter((m) => m.luzCentavosPorKwh != null);

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

        ${conLuz.length >= 2 ? `
          <!-- LAS DOS LÍNEAS DE LA LUZ, SEPARADAS (v4.6). Una sola línea de
               "lo que se pagó de luz" sube igual si subió el precio que si
               la máquina empezó a gastar de más, y son dos problemas
               distintos con dos soluciones distintas. -->
          <h4 class="est-subtitulo">A cómo salió el kilowatt</h4>
          <div class="est-grafica">
            ${linea(meses.map((m) => ({
              etiqueta: m.corto, valor: m.luzCentavosPorKwh
            })), { formato: pesos, color: 'var(--ambar)' })}
          </div>
          <p class="est-nota">
            Si esta sube, <b>la luz está más cara</b> y no hay nada que
            arreglar en la fábrica.
          </p>

          <h4 class="est-subtitulo">Kilowatts para hacer una marqueta</h4>
          <div class="est-grafica">
            ${linea(meses.map((m) => ({
              etiqueta: m.corto, valor: m.luzKwhPorMarqueta
            })), { formato: (n) => `${n} kWh`, color: 'var(--rojo)' })}
          </div>
          <p class="est-nota">
            Si esta sube, es al revés: se está gastando <b>más luz para hacer
            lo mismo</b>, y eso es una máquina que hay que revisar. Pueden
            subir las dos a la vez, y por eso van en gráficas separadas.
            ${meses.some((m) => m.luzKwh && !m.luzCompleto)
              ? ' A los meses con recibos incompletos les falta consumo.' : ''}
          </p>` : ''}
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

    pantalla.querySelectorAll('[data-subir]').forEach((b) => {
      b.onclick = () => mover(b.dataset.subir, -1);
    });
    pantalla.querySelectorAll('[data-bajar]').forEach((b) => {
      b.onclick = () => mover(b.dataset.bajar, +1);
    });
  }
}
