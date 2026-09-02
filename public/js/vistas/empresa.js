/**
 * LAS CUENTAS DE LA EMPRESA  (v2.7)
 *
 * Los gastos grandes —amoniaco, sal, aceite, maquinaria— y los recibos de
 * la luz. Es la otra mitad del dinero de la fábrica: la que nunca pasa por
 * el cajón y que hasta ahora vivía en una carpeta de papeles.
 *
 * Tres cosas, en el orden en que se preguntan:
 *   1. En qué se fue el dinero este mes, y cuándo fue la última vez de cada
 *      cosa —"¿hace cuánto que no compro sal?"—
 *   2. Los gastos capturados, con su factura
 *   3. La luz, que en una fábrica de hielo suele ser el gasto más grande, y
 *      lo que de verdad importa de ella: cuánto cuesta cada marqueta
 */
import { api } from '../api.js';
import { esc, avisar, fecha as formatoFecha } from '../util.js';
import { pedirTexto, confirmar, menu } from '../dialogo.js';
import { pesos } from '../fracciones.js';

export async function vistaEmpresa(pantalla, estadoApp) {
  const puedeCapturar = (estadoApp?.permisos || []).includes('*')
    || (estadoApp?.permisos || []).includes('empresa.administrar');

  let mes = null;           // el periodo que se está mirando
  let periodos = [];
  let ajusteMes = { diaCorte: 1, minimo: 1, maximo: 28 };
  let seccion = 'gastos';   // 'gastos' | 'luz'

  await cargar();

  async function cargar(clave = null) {
    try {
      const p = await api.obtener(`/empresa/periodos?cuantos=25`);
      ajusteMes = p;
      periodos = p.periodos;
      mes = clave ? periodos.find((x) => x.clave === clave) || p.actual : (mes || p.actual);
    } catch (e) { avisar(e.message, 'error'); return; }
    await pintar();
  }

  async function pintar() {
    pantalla.innerHTML = '<div class="cargando">Sacando cuentas…</div>';

    let datos;
    try {
      datos = seccion === 'luz'
        ? { recibos: (await api.obtener('/empresa/cfe')).recibos }
        : seccion === 'iva'
          ? await api.obtener('/empresa/iva')
          : seccion === 'proveedores'
            ? { proveedores: (await api.obtener('/empresa/proveedores?todos=1')).proveedores }
            : await api.obtener(`/empresa/resumen?periodo=${encodeURIComponent(mes.clave)}`);
    } catch (e) { pantalla.innerHTML = `<p class="vacio">${esc(e.message)}</p>`; return; }

    pantalla.innerHTML = `
      <div class="ancho-completo">
        <div class="emp-cabecera">
          <div class="emp-titulo">
            <h2>Las cuentas de la empresa</h2>
            <p class="ayuda">
              El dinero que <b>no pasa por el cajón</b>: el amoniaco, la sal, los
              barriles de aceite, una compostura, y la luz. Se captura cuando
              llega la factura, no cuando se compra.
            </p>
          </div>

          <div class="emp-pestanas">
            <button class="secundario ${seccion === 'gastos' ? 'activo' : ''}" data-seccion="gastos">
              📦 Gastos grandes
            </button>
            <button class="secundario ${seccion === 'luz' ? 'activo' : ''}" data-seccion="luz">
              ⚡ Recibos de luz
            </button>
            <button class="secundario ${seccion === 'iva' ? 'activo' : ''}" data-seccion="iva">
              🧾 IVA
            </button>
            <button class="secundario ${seccion === 'proveedores' ? 'activo' : ''}" data-seccion="proveedores">
              📒 Proveedores
            </button>
          </div>
        </div>

        ${seccion === 'luz' ? panelLuz(datos.recibos)
          : seccion === 'iva' ? panelIva(datos)
          : seccion === 'proveedores' ? panelProveedores(datos.proveedores)
          : panelGastos(datos)}
      </div>`;

    enganchar(datos);
  }


  // ==========================================================
  // EN QUÉ SE FUE EL DINERO
  // ==========================================================
  function panelGastos(d) {
    const dif = d.total.centavos - d.anterior.centavos;
    // La luz no es un renglón de compras, pero es el gasto más caro de la
    // fábrica: si no sale aquí, "lo grande del mes" miente por lo bajo.
    const luz = d.luz || { centavos: 0, completo: false, dias: 0, diasDelPeriodo: 0 };
    const conLuz = d.conLuz || { centavos: d.total.centavos, completo: false };

    return `
      <div class="emp-cabeza">
        <label>
          <span class="etiqueta-chica">El mes<small>${esc(mesDescrito())}</small></span>
          <select id="mes">
            ${periodos.map((p) => `
              <option value="${esc(p.clave)}" ${p.clave === mes.clave ? 'selected' : ''}>
                ${esc(p.nombre)}${p.fechas ? ` · ${esc(p.fechas)}` : ''}
              </option>`).join('')}
          </select>
        </label>
        ${puedeCapturar ? `
          <button class="secundario chico" id="cambiar-mes">Cambiar dónde empieza el mes</button>
          <button id="nuevo-gasto">＋ Anotar un gasto</button>` : ''}
      </div>

      <div class="hist-resumen">
        <div class="hist-dato">
          <small>Gastado en ${esc(mes.nombre)}</small>
          <strong class="malo">${pesos(d.total.centavos)}</strong>
          <small>${d.total.cuantos} ${d.total.cuantos === 1 ? 'compra' : 'compras'}</small>
        </div>
        <div class="hist-dato">
          <small>El mes pasado</small>
          <strong>${pesos(d.anterior.centavos)}</strong>
          <small>${d.anterior.cuantos} ${d.anterior.cuantos === 1 ? 'compra' : 'compras'}</small>
        </div>
        <div class="hist-dato">
          <small>Luz de ${esc(mes.nombre)}</small>
          <strong class="malo">${pesos(luz.centavos)}</strong>
          <small>${luz.centavos === 0
            ? 'todavía sin recibo'
            : luz.completo
              ? 'recibos completos'
              : `faltan ${luz.diasDelPeriodo - luz.dias} días por recibo`}</small>
        </div>
        <div class="hist-dato">
          <small>Todo junto${luz.completo ? '' : ' (va a subir)'}</small>
          <strong class="malo">${pesos(conLuz.centavos)}</strong>
          <small>compras grandes + luz</small>
        </div>
        <div class="hist-dato">
          <small>Contra el mes pasado</small>
          <strong class="${dif > 0 ? 'malo' : dif < 0 ? 'bueno' : ''}">
            ${dif === 0 ? '=' : (dif > 0 ? '+' : '−') + pesos(Math.abs(dif)).replace('$', '$')}
          </strong>
          <small>${d.anterior.centavos
            ? Math.abs(Math.round((dif / d.anterior.centavos) * 100)) + '% ' + (dif > 0 ? 'más' : dif < 0 ? 'menos' : '')
            : 'no hay con qué comparar'}</small>
        </div>
      </div>

      <div class="tarjeta plana">
        <div class="hist-envoltura">
          <table class="tabla hist-tabla emp-tabla">
            <tr>
              <th class="emp-c-que">En qué</th>
              <th class="emp-c-mes der">Este mes</th>
              <th class="emp-c-cuanto der">Cuánto</th>
              <th class="emp-c-unidad der">Por unidad</th>
              <th class="emp-c-ultima">Última vez</th>
              <th class="emp-c-acciones"></th>
            </tr>
            ${d.conceptos.map(renglonConcepto).join('')
              || '<tr><td colspan="6">Todavía no hay conceptos.</td></tr>'}
          </table>
        </div>
      </div>

      ${puedeCapturar
        ? '<button class="secundario" id="nuevo-concepto-emp" style="margin-top:12px">＋ Nuevo concepto</button>'
        : ''}

      <p class="ayuda" style="margin-top:12px">
        <b>Por unidad</b> es lo que costó cada barril, cada saco o cada
        cilindro este mes. Es el número que dice si el proveedor te está
        subiendo el precio: $12,000 puede ser una ganga o un robo según
        cuántos barriles vinieran.
      </p>
      <p class="ayuda">
        <b>Suele ser cada tantos días</b> no se escribe a mano: sale de las
        compras que ya están anotadas, y se corrige solo con cada una nueva.
        Con eso el sistema reparte lo que dura meses —el amoniaco de julio
        es el que está enfriando en agosto— en vez de cargárselo todo al mes
        que se pagó. Toca el <b>👁</b> para ver las fechas de cada compra.
      </p>

      <div id="zona-gastos"></div>`;
  }

  function renglonConcepto(c) {
    const nunca = c.diasDesdeLaUltima === null;
    return `
      <tr class="${c.activo ? '' : 'anulada'} ${c.tocaPronto ? 'emp-toca' : ''}">
        <td class="emp-c-que">
          <strong>${esc(c.nombre)}</strong>
          ${c.unidad ? `<small>por ${esc(c.unidad)}</small>` : ''}
        </td>
        <td class="emp-c-mes der">${c.centavos ? pesos(c.centavos) : '—'}</td>
        <td class="emp-c-cuanto der">
          ${c.cantidad ? `${redondo(c.cantidad)}${c.unidad ? ' ' + esc(plural(c.unidad, c.cantidad)) : ''}` : '—'}
        </td>
        <td class="emp-c-unidad der">${c.porUnidad ? pesos(c.porUnidad) : '—'}</td>
        <td class="emp-c-ultima" title="${nunca ? 'Nunca se ha comprado' : esc(c.ultima)}">
          ${nunca ? '<small>nunca</small>' : `
            ${esc(dia(c.ultima))}
            <small>${c.diasDesdeLaUltima === 0 ? 'hoy'
              : `hace ${c.diasDesdeLaUltima} día${c.diasDesdeLaUltima === 1 ? '' : 's'}`}${
              c.ritmoReal ? ` · suele ser cada ${c.ritmoReal}` : ''}${
              c.tocaPronto ? ' · toca pronto' : ''}</small>`}
        </td>
        <td class="emp-c-acciones">
          <div>
            <button class="secundario chico" data-ver-gastos="${esc(c.id)}"
                    title="Ver las compras de ${esc(c.nombre)}">👁</button>
            ${puedeCapturar
              ? `<button class="secundario chico" data-editar-concepto="${esc(c.id)}">Editar</button>` : ''}
          </div>
        </td>
      </tr>`;
  }

  /** 3 en vez de 3.0, pero 2.5 sigue siendo 2.5. */
  function redondo(n) {
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
  }

  /**
   * "12 sacos", no "12 saco". Las unidades del catálogo se escriben en
   * singular porque así se leen debajo del nombre ("por saco"), y aquí se
   * les pone la s cuando son más de una. Las que ya terminan en s —"kWh",
   * "litros"— se quedan como están.
   */
  function plural(unidad, cuantos) {
    const u = String(unidad || '');
    if (!u || cuantos === 1 || /s$/i.test(u)) return u;
    return /[aeiouáéíóú]$/i.test(u) ? `${u}s` : `${u}es`;
  }

  /** "2026-08-14" se lee "14 ago 2026". Los números pelones no se leen. */
  function dia(iso) {
    if (!iso) return '—';
    return new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX',
      { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function mesDescrito() {
    return ajusteMes.diaCorte === 1
      ? 'del 1 al último, el normal'
      : `empieza el día ${ajusteMes.diaCorte}`;
  }


  // ==========================================================
  // LA LUZ
  //
  // El número que importa en una fábrica de hielo no son los pesos del
  // recibo: es cuánta luz cuesta cada marqueta. Ese sube antes de que una
  // máquina se pare, y es lo único que avisa con tiempo.
  // ==========================================================
  function panelLuz(recibos) {
    const ultimo = recibos.find((r) => !r.anulado_en);

    return `
      <div class="emp-cabeza">
        <div class="crece">
          <p class="ayuda" style="margin:0">
            Cada recibo con <b>sus propias fechas</b>, las que vienen impresas.
            No se acomodan al mes del negocio: el papel dice de cuándo a
            cuándo midieron, y con esas se hacen las cuentas.
          </p>
        </div>
        ${puedeCapturar ? '<button id="nuevo-recibo">＋ Capturar un recibo</button>' : ''}
      </div>

      ${ultimo ? `
        <div class="hist-resumen">
          <div class="hist-dato">
            <small>Último recibo</small>
            <strong class="malo">${pesos(ultimo.centavos)}</strong>
            <small>${esc(dia(ultimo.desde))} — ${esc(dia(ultimo.hasta))}</small>
          </div>
          <div class="hist-dato">
            <small>Consumo</small>
            <strong>${ultimo.kwh.toLocaleString('es-MX')} kWh</strong>
            <small>${ultimo.kwhPorDia.toLocaleString('es-MX')} al día</small>
          </div>
          <div class="hist-dato">
            <small>El kilowatt</small>
            <strong>${pesos(ultimo.centavosPorKwh)}</strong>
            <small>lo que cobró la CFE</small>
          </div>
          <div class="hist-dato">
            <small>Luz por marqueta</small>
            <strong class="${ultimo.centavosPorMarqueta ? '' : 'vacio-folio'}">
              ${ultimo.centavosPorMarqueta ? pesos(ultimo.centavosPorMarqueta) : '—'}
            </strong>
            <small>${ultimo.marquetas
              ? `${ultimo.marquetas.toLocaleString('es-MX')} marquetas`
              : 'sin producción capturada'}</small>
          </div>
        </div>` : ''}

      <div class="tarjeta plana">
        <div class="hist-envoltura">
          <table class="tabla hist-tabla emp-tabla-luz">
            <tr>
              <th class="luz-c-periodo">Periodo del recibo</th>
              <th class="luz-c-kwh der">kWh</th>
              <th class="luz-c-pesos der">Cobrado</th>
              <th class="luz-c-kwh der">$ / kWh</th>
              <th class="luz-c-marq der">Marquetas</th>
              <th class="luz-c-marq der">Luz / marqueta</th>
              <th class="luz-c-dif der">vs. antes</th>
              <th class="luz-c-acciones"></th>
            </tr>
            ${recibos.map(renglonRecibo).join('')
              || '<tr><td colspan="8">Todavía no hay ningún recibo capturado.</td></tr>'}
          </table>
        </div>
      </div>

      <p class="ayuda" style="margin-top:12px">
        <b>Luz por marqueta</b> es el número que hay que vigilar: son los
        pesos de luz que costó producir cada marqueta en ese periodo. Si sube
        sin que suba la tarifa, algo está trabajando de más — un compresor
        que se está echando a perder avisa por aquí mucho antes de pararse.
      </p>`;
  }

  /**
   * EL RENGLÓN DE ABAJO: el medidor, las franjas y el IVA.
   *
   * Va escondido y no en columnas nuevas a propósito. La tabla contesta la
   * pregunta de todos los días —¿cuánto costó la luz de cada marqueta?— y
   * meterle ocho columnas más la volvería ilegible justo donde más se usa.
   * Esto se abre cuando hace falta mirar un recibo de cerca.
   */
  function detalleRecibo(r) {
    if (!r.franjas?.length && r.avanceMedidor == null && r.iva_centavos == null) {
      return `<td colspan="8" class="luz-detalle-vacio">
        De este recibo solo se capturó el total. Con ✎ se le pueden agregar
        las lecturas del medidor y las franjas horarias.
      </td>`;
    }

    const franjas = { base: 'Base', intermedia: 'Intermedia', punta: 'Punta' };
    return `<td colspan="8"><div class="luz-detalle">
      ${r.avanceMedidor != null ? `
        <div class="luz-bloque">
          <h5>El medidor</h5>
          <p>
            De <b>${r.lectura_anterior.toLocaleString('es-MX')}</b> a
            <b>${r.lectura_actual.toLocaleString('es-MX')}</b>
            ${r.multiplicador ? ` × ${r.multiplicador}` : ''}
            = <b>${r.kwhDelMedidor.toLocaleString('es-MX')} kWh</b>
          </p>
          <p class="${r.medidorCuadra ? 'bueno' : 'malo'}">
            ${r.medidorCuadra
              ? '✓ Cuadra con lo que cobraron.'
              : `El recibo cobra ${r.kwh.toLocaleString('es-MX')} kWh: hay `
                + `${Math.abs(r.kwhDelMedidor - r.kwh).toLocaleString('es-MX')} de diferencia.`}
          </p>
        </div>` : ''}

      ${r.franjas?.length ? `
        <div class="luz-bloque crece">
          <h5>Las franjas horarias</h5>
          <table class="luz-franjas">
            ${r.franjas.map((f) => `
              <tr>
                <td>${franjas[f.franja]}</td>
                <td class="der">${f.kwh != null ? `${f.kwh.toLocaleString('es-MX')} kWh` : '—'}</td>
                <td class="der">${f.porCiento != null ? `${f.porCiento}%` : ''}</td>
                <td class="der">${f.centavos != null ? pesos(f.centavos) : ''}</td>
                <td class="der">${f.centavosPorKwh != null ? `${pesos(f.centavosPorKwh)}/kWh` : ''}</td>
              </tr>`).join('')}
          </table>
          ${r.franjasCuadran === false ? `
            <p class="malo">Las franjas suman ${r.kwhFranjas.toLocaleString('es-MX')} kWh
               y el recibo dice ${r.kwh.toLocaleString('es-MX')}.</p>` : ''}
          ${r.franjas.find((f) => f.franja === 'punta')?.porCiento != null ? `
            <p class="ayuda">
              El <b>${r.franjas.find((f) => f.franja === 'punta').porCiento}%</b> del
              consumo cayó en punta, que es la franja cara. Bajarlo moviendo
              producción a la madrugada es la manera más directa de bajar el recibo.
            </p>` : ''}
        </div>` : ''}

      <div class="luz-bloque">
        <h5>Lo demás</h5>
        ${r.iva_centavos != null
          ? `<p>IVA: <b>${pesos(r.iva_centavos)}</b> <small>(se recupera)</small></p>`
          : '<p class="vacio-folio">Sin IVA capturado</p>'}
        ${r.demanda_kw != null ? `<p>Demanda: <b>${r.demanda_kw} kW</b></p>` : ''}
        ${r.factor_potencia != null ? `<p>Factor de potencia: <b>${r.factor_potencia}%</b></p>` : ''}
      </div>
    </div></td>`;
  }

  function renglonRecibo(r) {
    const d = r.contraElAnterior;
    return `
      <tr class="${r.anulado_en ? 'anulada' : ''}">
        <td class="luz-c-periodo">
          <strong>${esc(dia(r.desde))}</strong>
          <small>al ${esc(dia(r.hasta))} · ${r.dias} días</small>
        </td>
        <td class="luz-c-kwh der">${r.kwh.toLocaleString('es-MX')}</td>
        <td class="luz-c-pesos der"><strong>${pesos(r.centavos)}</strong></td>
        <td class="luz-c-kwh der">${r.centavosPorKwh ? pesos(r.centavosPorKwh) : '—'}</td>
        <td class="luz-c-marq der">${r.marquetas ? r.marquetas.toLocaleString('es-MX') : '—'}</td>
        <td class="luz-c-marq der">
          ${r.centavosPorMarqueta ? `<strong>${pesos(r.centavosPorMarqueta)}</strong>` : '—'}
          ${r.kwhPorMarqueta ? `<small>${r.kwhPorMarqueta} kWh</small>` : ''}
        </td>
        <td class="luz-c-dif der ${d && d.centavos > 0 ? 'malo' : d && d.centavos < 0 ? 'bueno' : ''}">
          ${d ? `${d.centavos > 0 ? '+' : ''}${d.porCiento ?? 0}%` : '—'}
        </td>
        <td class="luz-c-acciones"><div>
          <button class="secundario chico" data-ver-detalle="${esc(r.id)}"
                  title="El medidor, las franjas y el IVA">⌄</button>
          ${r.archivo
            ? `<a class="secundario chico boton-enlace" target="_blank"
                  href="/api/empresa/cfe/${esc(r.id)}/archivo">📄 Ver</a>`
            : '<small class="vacio-folio">sin PDF</small>'}
          ${puedeCapturar && !r.anulado_en
            ? `<button class="secundario chico" data-corregir-recibo="${esc(r.id)}"
                       title="Corregir este recibo">✎</button>
               <button class="secundario chico" data-anular-recibo="${esc(r.id)}"
                       title="Anular este recibo">🗑</button>` : ''}
        </div></td>
      </tr>
      <tr class="luz-fila-detalle" data-detalle-de="${esc(r.id)}" hidden>
        ${detalleRecibo(r)}
      </tr>`;
  }


  // ==========================================================
  // LO QUE SE PUEDE TOCAR
  // ==========================================================
  function enganchar(datos) {
    const q = (sel) => pantalla.querySelector(sel);

    pantalla.querySelectorAll('[data-seccion]').forEach((b) => {
      b.onclick = () => { seccion = b.dataset.seccion; pintar(); };
    });

    const selMes = q('#mes');
    if (selMes) selMes.onchange = () => cargar(selMes.value);

    const cambiar = q('#cambiar-mes');
    if (cambiar) cambiar.onclick = cambiarElMes;

    const nuevoGasto = q('#nuevo-gasto');
    if (nuevoGasto) nuevoGasto.onclick = () => formularioGasto();

    const nuevoConc = q('#nuevo-concepto-emp');
    if (nuevoConc) nuevoConc.onclick = () => nuevoConcepto();

    const nuevoRecibo = q('#nuevo-recibo');
    if (nuevoRecibo) nuevoRecibo.onclick = () => formularioRecibo();

    const nuevaDev = q('#nueva-devolucion');
    if (nuevaDev) nuevaDev.onclick = () => formularioDevolucion();
    pantalla.querySelectorAll('[data-anular-iva]').forEach((b) => {
      b.onclick = () => anularDevolucion(b.dataset.anularIva);
    });

    const nuevoProv = q('#nuevo-proveedor');
    if (nuevoProv) nuevoProv.onclick = () => formularioProveedor();
    pantalla.querySelectorAll('[data-editar-proveedor]').forEach((b) => {
      b.onclick = () => formularioProveedor(
        datos.proveedores?.find((x) => x.id === b.dataset.editarProveedor));
    });
    pantalla.querySelectorAll('[data-eliminar-proveedor]').forEach((b) => {
      b.onclick = () => eliminarProveedor(
        datos.proveedores?.find((x) => x.id === b.dataset.eliminarProveedor));
    });

    pantalla.querySelectorAll('[data-ver-gastos]').forEach((b) => {
      b.onclick = () => verGastos(b.dataset.verGastos,
        datos.conceptos?.find((c) => c.id === b.dataset.verGastos));
    });
    pantalla.querySelectorAll('[data-editar-concepto]').forEach((b) => {
      b.onclick = () => editarConcepto(datos.conceptos.find((c) => c.id === b.dataset.editarConcepto));
    });
    pantalla.querySelectorAll('[data-corregir-recibo]').forEach((b) => {
      b.onclick = () => formularioRecibo(
        datos.recibos?.find((r) => r.id === b.dataset.corregirRecibo));
    });
    pantalla.querySelectorAll('[data-anular-recibo]').forEach((b) => {
      b.onclick = () => anularRecibo(b.dataset.anularRecibo);
    });
    pantalla.querySelectorAll('[data-ver-detalle]').forEach((b) => {
      b.onclick = () => {
        const fila = pantalla.querySelector(`[data-detalle-de="${b.dataset.verDetalle}"]`);
        if (!fila) return;
        fila.hidden = !fila.hidden;
        b.textContent = fila.hidden ? '⌄' : '⌃';
      };
    });
  }

  /**
   * DÓNDE EMPIEZA EL MES.
   *
   * "El recibo de luz no es del 1 al 30, es del 12 al 12." Comparar un
   * recibo del 12 al 12 contra las ventas del 1 al 31 es comparar dos cosas
   * distintas.
   */
  async function cambiarElMes() {
    const dia = await pedirTexto({
      titulo: '¿Qué día empieza el mes?',
      texto: `Del ${ajusteMes.minimo} al ${ajusteMes.maximo}. Si tu recibo de luz ` +
             'va del 12 al 12, pon 12 y todo el sistema contará los meses así. ' +
             'Del 29 en adelante no vale: febrero no tiene esos días.<br><br>' +
             'OJO: este día es UNO para todo el sistema, no uno por mes. Si lo ' +
             'cambias, los meses que ya pasaste también se vuelven a partir con ' +
             'la regla nueva, y los totales de esos meses cambian. No se pierde ' +
             'nada —cada gasto guarda su propia fecha— pero un mes que decía ' +
             '$40,000 puede decir otra cosa.',
      valor: String(ajusteMes.diaCorte), ok: 'Guardar', largo: 2, unaLinea: true
    });
    if (dia === null) return;

    try {
      await api.actualizar('/empresa/periodos', { diaCorte: Number(dia) });
      avisar('Guardado. Así se cuentan los meses ahora.', 'bien');
      mes = null;
      await cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  /** Las compras de un concepto, para ver cómo se ha movido el precio. */
  async function verGastos(id, concepto) {
    let gastos = [];
    try {
      gastos = (await api.obtener(`/empresa/gastos?concepto=${encodeURIComponent(id)}&limite=60`)).gastos;
    } catch (e) { return avisar(e.message, 'error'); }

    pantalla.innerHTML = `
      <div class="ancho-completo">
        <button class="secundario chico" id="volver">‹ Las cuentas</button>
        <h2 style="margin-top:14px">${esc(concepto?.nombre || 'Compras')}</h2>
        <p class="ayuda">
          Todas las compras, de la más nueva a la más vieja.
          ${concepto?.unidad ? `Se compra por <b>${esc(concepto.unidad)}</b>.` : ''}
        </p>

        <div class="tarjeta plana">
          <div class="hist-envoltura">
            <table class="tabla hist-tabla emp-tabla">
              <tr>
                <th class="emp-c-ultima">Cuándo</th>
                <th class="emp-c-que">Proveedor</th>
                <th class="emp-c-cuanto der">Cuánto</th>
                <th class="emp-c-mes der">Pagado</th>
                <th class="emp-c-unidad der">Por unidad</th>
                <th class="emp-c-acciones"></th>
              </tr>
              ${gastos.map((g) => `
                <tr class="${g.anulado_en ? 'anulada' : ''}">
                  <td class="emp-c-ultima">${esc(dia(g.fecha))}
                    ${g.factura ? `<small>factura ${esc(g.factura)}</small>` : ''}</td>
                  <td class="emp-c-que">${esc(g.proveedor || '—')}
                    ${g.notas ? `<small>${esc(g.notas)}</small>` : ''}</td>
                  <td class="emp-c-cuanto der">${g.cantidad
                    ? `${redondo(g.cantidad)}${g.unidad ? ' ' + esc(plural(g.unidad, g.cantidad)) : ''}` : '—'}</td>
                  <td class="emp-c-mes der"><strong>${pesos(g.centavos)}</strong></td>
                  <td class="emp-c-unidad der">${g.porUnidad ? pesos(g.porUnidad) : '—'}</td>
                  <td class="emp-c-acciones"><div>
                    ${g.archivo
                      ? `<a class="secundario chico boton-enlace" target="_blank"
                            href="/api/empresa/gastos/${esc(g.id)}/archivo">📄</a>` : ''}
                    ${puedeCapturar && !g.anulado_en
                      ? `<button class="secundario chico" data-anular-gasto="${esc(g.id)}">🗑</button>` : ''}
                  </div></td>
                </tr>`).join('')
                || '<tr><td colspan="6">Todavía no se ha comprado nada de esto.</td></tr>'}
            </table>
          </div>
        </div>
      </div>`;

    pantalla.querySelector('#volver').onclick = pintar;
    pantalla.querySelectorAll('[data-anular-gasto]').forEach((b) => {
      b.onclick = async () => {
        const motivo = await pedirTexto({
          titulo: 'Anular esta compra',
          texto: 'No se borra: queda tachada con tu nombre y el motivo.',
          marcador: 'Se capturó dos veces, el monto estaba mal…', ok: 'Anular'
        });
        if (!motivo) return;
        try {
          await api.enviar(`/empresa/gastos/${b.dataset.anularGasto}/anular`, { motivo });
          avisar('Compra anulada', 'bien');
          verGastos(id, concepto);
        } catch (e) { avisar(e.message, 'error'); }
      };
    });
  }

  /** Dar de alta un concepto nuevo: nombre, en qué se compra y su ritmo. */
  async function nuevoConcepto() {
    const nombre = await pedirTexto({
      titulo: 'Nuevo gasto grande',
      texto: 'Cómo se llama lo que se compra: Amoniaco, Sal, Llantas…',
      marcador: 'Amoniaco', ok: 'Siguiente', largo: 40, unaLinea: true
    });
    if (!nombre) return;

    const unidad = await pedirTexto({
      titulo: nombre,
      texto: '¿En qué se compra? Barril, saco, cilindro, kilo, pieza, servicio… ' +
             'Con esto el sistema saca el precio POR UNIDAD. Se puede dejar vacío.',
      marcador: 'barril', ok: 'Siguiente', largo: 20, unaLinea: true, opcional: true
    });
    if (unidad === null) return;

    // NO SE PREGUNTA CADA CUÁNTO SE COMPRA. Entre un cilindro de amoniaco y
    // el siguiente pueden pasar quince días o dos años: preguntarlo era
    // pedir una adivinanza y después creérsela para repartir el costo. El
    // sistema lo MIDE de las compras que se van anotando, y se corrige solo.
    try {
      await api.enviar('/empresa/conceptos', { nombre, unidad });
      avisar(`"${nombre}" ya se puede capturar`, 'bien');
      await pintar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function editarConcepto(c) {
    if (!c) return;
    const que = await menu({
      titulo: c.nombre,
      texto: '¿Qué le hacemos?',
      opciones: [
        { valor: 'nombre', texto: '✎ Cambiarle el nombre',
          detalle: 'Las compras viejas siguen contando aquí' },
        { valor: 'unidad', texto: '📏 En qué se compra',
          detalle: c.unidad ? `Ahora: ${c.unidad}` : 'Barril, saco, cilindro…' },
        { valor: 'baja', texto: c.activo ? '🗑 Dejar de usarlo' : '↩ Volver a usarlo',
          detalle: 'No borra nada de lo ya comprado' },
        { valor: 'eliminar', texto: '✕ Borrarlo de esta lista',
          detalle: 'Para siempre. Lo ya comprado sigue contando', peligro: true }
      ]
    });
    if (!que) return;

    try {
      if (que === 'nombre') {
        const nombre = await pedirTexto({
          titulo: `Editar ${c.nombre}`, texto: 'El nombre nuevo.',
          valor: c.nombre, ok: 'Guardar', largo: 40, unaLinea: true
        });
        if (!nombre) return;
        await api.actualizar(`/empresa/conceptos/${c.id}`, { nombre });
      } else if (que === 'unidad') {
        const unidad = await pedirTexto({
          titulo: c.nombre, texto: '¿En qué se compra? Barril, saco, cilindro, kilo, servicio…',
          valor: c.unidad || '', marcador: 'barril', ok: 'Guardar', largo: 20, unaLinea: true
        });
        if (unidad === null) return;
        await api.actualizar(`/empresa/conceptos/${c.id}`, { unidad });
      } else if (que === 'baja') {
        if (c.activo && !await confirmar({
          titulo: `¿Dejar de usar "${c.nombre}"?`,
          texto: 'Deja de salir al capturar. Lo que ya se compró con él sigue contando.',
          ok: 'Dar de baja', peligro: true
        })) return;
        await api.actualizar(`/empresa/conceptos/${c.id}`, { activo: !c.activo });
      } else if (que === 'eliminar') {
        if (!await confirmar({
          titulo: `¿Borrar "${c.nombre}" de esta lista?`,
          texto: 'Desaparece de aquí para siempre. Lo que ya se compró con él NO ' +
                 'se borra: sigue en la lista de gastos y sigue sumando en el mes.',
          ok: 'Borrarlo de la lista', peligro: true
        })) return;
        await api.enviar(`/empresa/conceptos/${c.id}/eliminar`, {});
      }
      avisar('Guardado', 'bien');
      await pintar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function anularRecibo(id) {
    const motivo = await pedirTexto({
      titulo: 'Anular este recibo',
      texto: 'No se borra: queda tachado con tu nombre y el motivo. ' +
             'Deja de contar en las cuentas del año.',
      marcador: 'Se capturó dos veces, los kilowatts estaban mal…', ok: 'Anular'
    });
    if (!motivo) return;
    try {
      await api.enviar(`/empresa/cfe/${id}/anular`, { motivo });
      avisar('Recibo anulado', 'bien');
      await pintar();
    } catch (e) { avisar(e.message, 'error'); }
  }


  // ==========================================================
  // CAPTURAR
  //
  // Formularios de verdad y no una fila de diálogos encadenados: son seis
  // datos y con diálogos habría que contestar seis veces sin poder
  // corregir el primero.
  // ==========================================================
  async function formularioGasto() {
    // El directorio de proveedores sugiere el nombre para que se escriba
    // igual todas las veces; el que quede se COPIA al renglón (regla 3.5).
    let sugerencias = [];
    try { sugerencias = (await api.obtener('/empresa/proveedores')).proveedores; }
    catch { sugerencias = []; }
    let conceptos = [];
    try { conceptos = (await api.obtener('/empresa/conceptos')).conceptos; }
    catch (e) { return avisar(e.message, 'error'); }

    pantalla.innerHTML = `
      <div class="ancho-completo">
        <button class="secundario chico" id="volver">‹ Las cuentas</button>
        <h2 style="margin-top:14px">Anotar un gasto de la empresa</h2>
        <p class="ayuda">
          Lo que se pagó por fuera del cajón. El día es el de <b>la compra</b>,
          no el de hoy: una factura de marzo que llega en mayo es un gasto de
          marzo.
        </p>

        <div class="tarjeta">
          <form id="f">
            <div class="emp-campos">
              <label>
                <span class="etiqueta-chica">En qué</span>
                <select id="concepto" required>
                  ${conceptos.map((c) => `
                    <option value="${esc(c.id)}" data-unidad="${esc(c.unidad || '')}">
                      ${esc(c.nombre)}${c.unidad ? ` (por ${esc(c.unidad)})` : ''}
                    </option>`).join('')}
                  <option value="">✎ Otro — escribirlo</option>
                </select>
              </label>
              <label id="campo-otro" hidden>
                <span class="etiqueta-chica">¿En qué se gastó?</span>
                <input id="otro" maxlength="60" placeholder="Lo que fue">
              </label>
              <label>
                <span class="etiqueta-chica">Día de la compra</span>
                <input id="fecha" type="date" required value="${hoy()}">
              </label>
              <label>
                <span class="etiqueta-chica">Cuánto se pagó<small>en total</small></span>
                <input id="monto" inputmode="decimal" required placeholder="12000">
              </label>
              <label>
                <span class="etiqueta-chica">Cantidad<small>opcional, para el precio por unidad</small></span>
                <input id="cantidad" inputmode="decimal" placeholder="3">
              </label>
              <label>
                <span class="etiqueta-chica">Unidad</span>
                <input id="unidad" maxlength="20" placeholder="barril">
              </label>
              <label>
                <span class="etiqueta-chica">Proveedor</span>
                <input id="proveedor" maxlength="60" placeholder="Quién lo vendió"
                       list="lista-proveedores">
                <datalist id="lista-proveedores">
                  ${sugerencias.map((x) => `<option value="${esc(x.nombre)}">`).join('')}
                </datalist>
              </label>
              <label>
                <span class="etiqueta-chica">Cómo se pagó</span>
                <select id="forma">
                  <option value="transferencia">Transferencia</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="cheque">Cheque</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="credito">A crédito</option>
                </select>
              </label>
              <label>
                <span class="etiqueta-chica">Número de factura</span>
                <input id="factura" maxlength="40" placeholder="A-1234">
              </label>
              <label>
                <span class="etiqueta-chica">IVA de la factura<small>opcional, se recupera</small></span>
                <input id="iva" inputmode="decimal" placeholder="1920">
              </label>
            </div>

            <p class="ayuda" style="margin:10px 0 0;font-size:13.5px">
              El <b>IVA</b> se escribe tal como lo dice la factura, no calculado:
              hay compras con partidas exentas donde no es el 16 %. Lo que se
              anote aquí suma en la pantalla del IVA, junto con el de la luz.
            </p>

            <label>
              <span class="etiqueta-chica">Notas</span>
              <input id="notas" maxlength="300" placeholder="Lo que haga falta recordar">
            </label>

            <label class="subir" for="archivo" style="margin-top:14px">
              📄 Adjuntar la factura <small id="nombre-archivo"></small>
              <input type="file" id="archivo" accept="application/pdf,image/*" hidden>
            </label>
            <p class="ayuda" style="margin:8px 0 0;font-size:13.5px">
              PDF o foto, hasta 8 MB. Se guarda en la carpeta <b>datos</b>, así
              que no se pierde al actualizar el sistema.
            </p>

            <button type="submit" style="margin-top:20px">Anotar el gasto</button>
          </form>
        </div>
      </div>`;

    const q = (s) => pantalla.querySelector(s);
    q('#volver').onclick = pintar;

    // Al elegir el concepto se rellena su unidad: casi nunca cambia.
    const sel = q('#concepto');
    const ponerUnidad = () => {
      const op = sel.selectedOptions[0];
      q('#campo-otro').hidden = Boolean(sel.value);
      if (sel.value && op.dataset.unidad) q('#unidad').value = op.dataset.unidad;
    };
    sel.onchange = ponerUnidad;
    ponerUnidad();

    let archivo = null;
    q('#archivo').onchange = async (ev) => {
      const f = ev.target.files?.[0];
      if (!f) return;
      if (f.size > 8 * 1024 * 1024) {
        ev.target.value = '';
        return avisar(`Ese archivo pesa ${Math.round(f.size / 1024 / 1024)} MB y el máximo son 8 MB.`, 'error');
      }
      archivo = await comoTexto(f);
      q('#nombre-archivo').textContent = `· ${f.name}`;
    };

    q('#f').onsubmit = async (ev) => {
      ev.preventDefault();
      const cuerpo = {
        fecha: q('#fecha').value,
        monto: q('#monto').value,
        cantidad: q('#cantidad').value,
        unidad: q('#unidad').value,
        proveedor: q('#proveedor').value,
        formaPago: q('#forma').value,
        factura: q('#factura').value,
        iva: q('#iva').value,
        notas: q('#notas').value,
        ...(archivo ? { archivo } : {})
      };
      if (sel.value) cuerpo.conceptoId = sel.value;
      else cuerpo.concepto = q('#otro').value;

      try {
        await api.enviar('/empresa/gastos', cuerpo);
        avisar('Gasto anotado', 'bien');
        await pintar();
      } catch (e) { avisar(e.message, 'error'); }
    };
  }

  // ==========================================================
  // EL IVA — lo que nos deben
  //
  // "A veces ya no se sabe qué IVA nos deben." Toda esta pantalla existe
  // para que ese número deje de estar en la cabeza de alguien. Se suma lo
  // que se pagó de IVA —el de la luz y el de las compras grandes—, se
  // resta lo que Hacienda ha devuelto, y lo que queda es lo que falta por
  // recuperar. La cuenta no se guarda en ningún lado: se hace al vuelo, así
  // que corregir un recibo la corrige sola (regla 3.2).
  // ==========================================================
  function panelIva(d) {
    const b = d.balance;
    const faltan = b.faltanRecibos + b.faltanGastos;

    const TIPOS = {
      devolucion: 'Devolución',
      acreditamiento: 'Acreditado',
      otro: 'Otro'
    };

    return `
      <div class="emp-cabeza">
        <div class="crece">
          <p class="ayuda" style="margin:0">
            El IVA que la fábrica <b>paga</b> en la luz y en las compras grandes
            no es suyo: se recupera. Aquí se anota lo que Hacienda devuelve, y
            la resta dice <b>cuánto falta por recuperar</b>.
          </p>
        </div>
        ${puedeCapturar ? '<button id="nueva-devolucion">＋ Anotar una devolución</button>' : ''}
      </div>

      <div class="hist-resumen">
        <div class="hist-dato">
          <small>IVA pagado</small>
          <strong>${pesos(b.pagado)}</strong>
          <small>de todo lo capturado</small>
        </div>
        <div class="hist-dato">
          <small>De la luz</small>
          <strong>${pesos(b.luz)}</strong>
          <small>el más caro de todos</small>
        </div>
        <div class="hist-dato">
          <small>Devuelto</small>
          <strong class="bueno">${pesos(b.devuelto)}</strong>
          <small>${(() => { const n = b.anios.reduce((t, a) => t + a.devoluciones, 0);
            return `${n} ${n === 1 ? 'devolución' : 'devoluciones'}`; })()}</small>
        </div>
        <div class="hist-dato destacado">
          <small>Falta por recuperar</small>
          <strong class="${b.pendiente > 0 ? 'malo' : 'bueno'}">${pesos(b.pendiente)}</strong>
          <small>${b.completo ? 'con todo capturado' : 'cuando menos'}</small>
        </div>
      </div>

      ${faltan ? `
        <p class="aviso-suave">
          Hay ${faltan} ${faltan === 1 ? 'papel' : 'papeles'} sin el IVA anotado
          ${b.faltanRecibos ? `(${b.faltanRecibos} de luz` : ''}${b.faltanRecibos && b.faltanGastos ? ', ' : ''}${b.faltanGastos ? `${b.faltanRecibos ? '' : '('}${b.faltanGastos} de compras` : ''}${b.faltanRecibos || b.faltanGastos ? ')' : ''}.
          Mientras falten, <b>lo que falta por recuperar es cuando menos eso</b>,
          no exactamente eso. Se agrega con ✎ en cada recibo o anotando el gasto
          con su IVA.
        </p>` : ''}

      <div class="tarjeta plana">
        <h3 class="emp-sub">Año por año</h3>
        <div class="hist-envoltura">
          <table class="tabla hist-tabla emp-tabla">
            <tr>
              <th>Año</th>
              <th class="der">IVA de la luz</th>
              <th class="der">IVA de compras</th>
              <th class="der">Pagado</th>
              <th class="der">Devuelto</th>
              <th class="der">Diferencia</th>
            </tr>
            ${b.anios.map((a) => `
              <tr>
                <td><strong>${esc(a.anio)}</strong>
                    <small>${a.recibos} ${a.recibos === 1 ? 'recibo' : 'recibos'}
                           · ${a.gastos} ${a.gastos === 1 ? 'compra' : 'compras'}</small></td>
                <td class="der">${pesos(a.luz)}</td>
                <td class="der">${pesos(a.compras)}</td>
                <td class="der"><strong>${pesos(a.pagado)}</strong></td>
                <td class="der bueno">${a.devuelto ? pesos(a.devuelto) : '—'}</td>
                <td class="der ${a.pendiente > 0 ? 'malo' : 'bueno'}">${pesos(a.pendiente)}</td>
              </tr>`).join('')
              || '<tr><td colspan="6">Todavía no hay ningún IVA capturado.</td></tr>'}
          </table>
        </div>
        <p class="ayuda" style="margin:12px 0 0">
          La <b>diferencia</b> de cada año se lee con cuidado: las devoluciones
          de Hacienda llegan tarde y casi siempre caen en el año siguiente al
          del gasto. El número que vale es el de arriba, el acumulado.
        </p>
      </div>

      <div class="tarjeta plana" style="margin-top:16px">
        <h3 class="emp-sub">Lo que han devuelto</h3>
        <div class="hist-envoltura">
          <table class="tabla hist-tabla emp-tabla">
            <tr>
              <th>Cuándo</th>
              <th>Qué fue</th>
              <th>Periodo</th>
              <th>Folio</th>
              <th class="der">Cuánto</th>
              <th></th>
            </tr>
            ${(d.devoluciones || []).map((x) => `
              <tr class="${x.anulado_en ? 'anulada' : ''}">
                <td><strong>${esc(dia(x.fecha))}</strong>
                    <small>anotó ${esc(x.capturista_nombre || '—')}</small></td>
                <td>${esc(TIPOS[x.tipo] || x.tipo)}
                    ${x.notas ? `<small>${esc(x.notas)}</small>` : ''}</td>
                <td>${esc(x.periodo || '—')}</td>
                <td>${x.folio ? esc(x.folio) : '<small class="vacio-folio">—</small>'}</td>
                <td class="der"><strong class="bueno">${pesos(x.centavos)}</strong></td>
                <td><div>
                  ${x.archivo
                    ? `<a class="secundario chico boton-enlace" target="_blank"
                          href="/api/empresa/iva/${esc(x.id)}/archivo">📄</a>` : ''}
                  ${puedeCapturar && !x.anulado_en
                    ? `<button class="secundario chico" data-anular-iva="${esc(x.id)}"
                               title="Anular">🗑</button>` : ''}
                </div></td>
              </tr>`).join('')
              || '<tr><td colspan="6">Todavía no se ha anotado ninguna devolución.</td></tr>'}
          </table>
        </div>
      </div>`;
  }

  async function formularioDevolucion() {
    pantalla.innerHTML = `
      <div class="ancho-completo">
        <button class="secundario chico" id="volver">‹ Las cuentas</button>
        <h2 style="margin-top:14px">Anotar una devolución de IVA</h2>
        <p class="ayuda">
          Lo que Hacienda regresó, tal como llegó. El día es el que <b>entró el
          dinero</b> o se acreditó, no el del trámite. Con esto la pantalla del
          IVA sabe qué sigue faltando.
        </p>

        <div class="tarjeta">
          <form id="f">
            <div class="emp-campos">
              <label>
                <span class="etiqueta-chica">Día<small>cuando entró</small></span>
                <input id="fecha" type="date" required value="${hoy()}">
              </label>
              <label>
                <span class="etiqueta-chica">Cuánto devolvieron</span>
                <input id="monto" inputmode="decimal" required placeholder="24500">
              </label>
              <label>
                <span class="etiqueta-chica">Qué fue</span>
                <select id="tipo">
                  <option value="devolucion">Devolución — llegó el dinero</option>
                  <option value="acreditamiento">Acreditamiento — contra otro impuesto</option>
                  <option value="otro">Otro</option>
                </select>
              </label>
              <label>
                <span class="etiqueta-chica">De qué periodo<small>como lo diga el papel</small></span>
                <input id="periodo" maxlength="40" placeholder="Marzo 2026">
              </label>
              <label>
                <span class="etiqueta-chica">Folio del trámite</span>
                <input id="folio" maxlength="60" placeholder="Para poder buscarlo">
              </label>
            </div>

            <label>
              <span class="etiqueta-chica">Notas</span>
              <input id="notas" maxlength="300" placeholder="Lo que haga falta recordar">
            </label>

            <label class="subir" for="archivo" style="margin-top:14px">
              📄 Adjuntar el papel <small id="nombre-archivo"></small>
              <input type="file" id="archivo" accept="application/pdf,image/*" hidden>
            </label>

            <button type="submit" style="margin-top:20px">Anotar la devolución</button>
          </form>
        </div>
      </div>`;

    const q = (sel) => pantalla.querySelector(sel);
    q('#volver').onclick = pintar;

    let archivo = null;
    q('#archivo').onchange = async (ev) => {
      const f = ev.target.files?.[0];
      if (!f) return;
      if (f.size > 8 * 1024 * 1024) {
        ev.target.value = '';
        return avisar(`Ese archivo pesa ${Math.round(f.size / 1024 / 1024)} MB y el máximo son 8 MB.`, 'error');
      }
      archivo = await comoTexto(f);
      q('#nombre-archivo').textContent = `· ${f.name}`;
    };

    q('#f').onsubmit = async (ev) => {
      ev.preventDefault();
      try {
        await api.enviar('/empresa/iva', {
          fecha: q('#fecha').value, monto: q('#monto').value,
          tipo: q('#tipo').value, periodo: q('#periodo').value,
          folio: q('#folio').value, notas: q('#notas').value,
          ...(archivo ? { archivo } : {})
        });
        avisar('Devolución anotada', 'bien');
        seccion = 'iva';
        await pintar();
      } catch (e) { avisar(e.message, 'error'); }
    };
  }

  async function anularDevolucion(id) {
    const motivo = await pedirTexto({
      titulo: 'Anular esta devolución',
      texto: 'No se borra: queda tachada con tu nombre y el motivo. ' +
             'Vuelve a subir lo que falta por recuperar.',
      marcador: 'Se anotó dos veces, la cantidad estaba mal…', ok: 'Anular'
    });
    if (!motivo) return;
    try {
      await api.enviar(`/empresa/iva/${id}/anular`, { motivo });
      avisar('Devolución anulada', 'bien');
      await pintar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  // ==========================================================
  // LOS PROVEEDORES — el manual de la fábrica
  //
  // La intención la dijo el dueño: que si un día él no está, sus hijos
  // abran esta pantalla y sepan a quién hablarle para que la fábrica siga
  // andando. Por eso el campo que manda es "qué hace", no el teléfono.
  // ==========================================================
  function panelProveedores(proveedores = []) {
    return `
      <div class="emp-cabeza">
        <div class="crece">
          <p class="ayuda" style="margin:0">
            El directorio de la fábrica: quién es cada proveedor, <b>qué le
            vende a la fábrica</b>, a qué teléfono se le habla y qué hay que
            saber al tratar con él. Es parte del manual del negocio: escrito
            aquí, no se lo lleva nadie en la cabeza.
          </p>
        </div>
        ${puedeCapturar ? '<button id="nuevo-proveedor">＋ Nuevo proveedor</button>' : ''}
      </div>

      <div class="prov-lista">
        ${proveedores.map((pr) => `
          <div class="tarjeta prov-tarjeta ${pr.activo ? '' : 'anulada'}">
            <div class="prov-cabeza">
              <strong>${esc(pr.nombre)}</strong>
              ${pr.activo ? '' : '<span class="hist-que que-cancelada">de baja</span>'}
              ${puedeCapturar ? `
                <span class="prov-acciones">
                  <button class="secundario chico" data-editar-proveedor="${esc(pr.id)}">Editar</button>
                  <button class="secundario chico" data-eliminar-proveedor="${esc(pr.id)}"
                          title="Borrarlo del directorio">🗑</button>
                </span>` : ''}
            </div>
            ${pr.que_hace ? `
              <div class="prov-bloque">
                <span class="prov-etiqueta">Qué hace</span>
                <p class="prov-que">${esc(pr.que_hace)}</p>
              </div>` : ''}
            <div class="prov-datos">
              ${pr.telefono ? `<span>📞 <a href="tel:${esc(pr.telefono.replace(/[^+0-9]/g, ''))}">${esc(pr.telefono)}</a></span>` : ''}
              ${pr.horarios ? `<span>🕐 ${esc(pr.horarios)}</span>` : ''}
              ${pr.direccion ? `<span>📍 ${esc(pr.direccion)}</span>` : ''}
              ${pr.ubicacion ? (/^https?:\/\//i.test(pr.ubicacion)
                ? `<span>🗺 <a href="${esc(pr.ubicacion)}" target="_blank" rel="noopener">Cómo llegar</a></span>`
                : `<span>🗺 ${esc(pr.ubicacion)}</span>`) : ''}
            </div>
            ${pr.notas ? `
              <div class="prov-bloque prov-bloque-notas">
                <span class="prov-etiqueta">Sus mañas</span>
                <p class="prov-notas">${esc(pr.notas)}</p>
              </div>` : ''}
          </div>`).join('')
          || `<p class="vacio">Todavía no hay proveedores. Con ＋ se anota el
              primero: el del amoniaco, el de la sal, el mecánico…</p>`}
      </div>`;
  }

  /** Alta y edición comparten el mismo formulario. */
  async function formularioProveedor(pr = null) {
    pantalla.innerHTML = `
      <div class="ancho-completo">
        <button class="secundario chico" id="volver">‹ Las cuentas</button>
        <h2 style="margin-top:14px">${pr ? `Editar a ${esc(pr.nombre)}` : 'Nuevo proveedor'}</h2>
        <p class="ayuda">
          Lo más valioso es <b>qué hace</b>: escrito como se lo contarías a
          alguien que nunca ha tratado con él.
        </p>

        <div class="tarjeta">
          <form id="f">
            <div class="emp-campos">
              <label>
                <span class="etiqueta-chica">Cómo se llama</span>
                <input id="p-nombre" maxlength="160" required
                       value="${esc(pr?.nombre || '')}" placeholder="Amoniaco del Sureste">
              </label>
              <label>
                <span class="etiqueta-chica">Teléfono</span>
                <input id="p-telefono" maxlength="160"
                       value="${esc(pr?.telefono || '')}" placeholder="999 123 4567 · preguntar por don Raúl">
              </label>
              <label>
                <span class="etiqueta-chica">Horarios</span>
                <input id="p-horarios" maxlength="160"
                       value="${esc(pr?.horarios || '')}" placeholder="L-V 8 a 6, sábado hasta la 1">
              </label>
              <label>
                <span class="etiqueta-chica">Dirección</span>
                <input id="p-direccion" maxlength="160"
                       value="${esc(pr?.direccion || '')}" placeholder="Calle 50 #123, Mérida">
              </label>
              <label>
                <span class="etiqueta-chica">Ubicación<small>enlace de mapa, o señas</small></span>
                <input id="p-ubicacion" maxlength="160"
                       value="${esc(pr?.ubicacion || '')}" placeholder="https://maps.app.goo.gl/…">
              </label>
            </div>

            <!-- Los dos textos largos, grandes y lado a lado. Son la parte
                 que de verdad vale de este directorio —lo que se le queda a
                 uno en la cabeza y nadie más sabe— y estaban metidos en dos
                 cuadritos de tres renglones mientras sobraba media pantalla. -->
            <div class="prov-textos">
              <label>
                <span class="etiqueta-chica">Qué hace<small>y para qué le sirve a la fábrica</small></span>
                <textarea id="p-que" maxlength="600" rows="7"
                          placeholder="Surte el amoniaco de los compresores. Se le pide con una semana; trae el cilindro y se lleva el vacío.">${esc(pr?.que_hace || '')}</textarea>
              </label>
              <label>
                <span class="etiqueta-chica">Sus mañas<small>lo que hay que saber al tratar con él</small></span>
                <textarea id="p-notas" maxlength="600" rows="7"
                          placeholder="Solo acepta transferencia. En diciembre cierra dos semanas. Si contesta la señora, es más fácil.">${esc(pr?.notas || '')}</textarea>
              </label>
            </div>

            <button type="submit" style="margin-top:20px">${pr ? 'Guardar' : 'Anotarlo'}</button>
          </form>
        </div>
      </div>`;

    const q = (sel) => pantalla.querySelector(sel);
    q('#volver').onclick = pintar;
    q('#f').onsubmit = async (ev) => {
      ev.preventDefault();
      const cuerpo = {
        nombre: q('#p-nombre').value, telefono: q('#p-telefono').value,
        horarios: q('#p-horarios').value, direccion: q('#p-direccion').value,
        ubicacion: q('#p-ubicacion').value, queHace: q('#p-que').value,
        notas: q('#p-notas').value
      };
      try {
        if (pr) await api.actualizar(`/empresa/proveedores/${pr.id}`, cuerpo);
        else await api.enviar('/empresa/proveedores', cuerpo);
        avisar('Guardado', 'bien');
        seccion = 'proveedores';
        await pintar();
      } catch (e) { avisar(e.message, 'error'); }
    };
  }

  async function eliminarProveedor(pr) {
    if (!pr) return;
    if (!await confirmar({
      titulo: `¿Borrar a "${pr.nombre}" del directorio?`,
      texto: 'Aquí sí se borra de verdad: el directorio es una libreta, no ' +
             'un registro. Los gastos donde aparece su nombre no se tocan.',
      ok: 'Borrarlo', peligro: true
    })) return;
    try {
      await api.enviar(`/empresa/proveedores/${pr.id}/eliminar`, {});
      avisar('Borrado del directorio', 'bien');
      await pintar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function formularioRecibo(corregir = null) {
    pantalla.innerHTML = `
      <div class="ancho-completo">
        <button class="secundario chico" id="volver">‹ Las cuentas</button>
        <h2 style="margin-top:14px">${corregir ? 'Corregir el recibo' : 'Capturar un recibo de luz'}</h2>
        ${corregir ? `
          <p class="ayuda">
            El renglón viejo no se retoca: queda <b>anulado</b> con la nota
            "corregido" y se guarda el bueno. Así siempre se puede ver qué
            decía antes. El papel adjunto se queda, salvo que subas otro.
          </p>` : ''}
        <p class="ayuda">
          Las fechas son las que vienen <b>impresas en el recibo</b>, no las
          del mes del negocio. Con esas se hacen las cuentas, porque son las
          que la CFE de verdad midió.
        </p>

        <div class="tarjeta">
          <form id="f">
            <div class="emp-campos">
              <label>
                <span class="etiqueta-chica">Del día<small>lo dice el recibo</small></span>
                <input id="desde" type="date" required value="${esc(corregir?.desde || '')}">
              </label>
              <label>
                <span class="etiqueta-chica">Al día</span>
                <input id="hasta" type="date" required value="${esc(corregir?.hasta || '')}">
              </label>
              <label>
                <span class="etiqueta-chica">Kilowatts (kWh)</span>
                <input id="kwh" inputmode="numeric" required placeholder="8450"
                       value="${corregir ? corregir.kwh : ''}">
              </label>
              <label>
                <span class="etiqueta-chica">Cuánto cobraron</span>
                <input id="monto" inputmode="decimal" required placeholder="42350"
                       value="${corregir ? (corregir.centavos / 100) : ''}">
              </label>
              <label>
                <span class="etiqueta-chica">IVA del recibo<small>se recupera</small></span>
                <input id="iva" inputmode="decimal" placeholder="6776"
                       value="${corregir?.iva_centavos != null ? (corregir.iva_centavos / 100) : ''}">
              </label>
              <label>
                <span class="etiqueta-chica">Número de servicio o recibo</span>
                <input id="numero" maxlength="40" placeholder="Para buscarlo con la CFE"
                       value="${esc(corregir?.numero || '')}">
              </label>
            </div>

            <details class="emp-mas" ${corregir && tieneDetalle(corregir) ? 'open' : ''}>
              <summary>El medidor y las franjas horarias <small>de la tarifa GDMTH</small></summary>

              <p class="ayuda" style="margin:10px 0">
                Todo esto es <b>opcional</b>: un recibo capturado a medias vale
                más que uno no capturado. Pero con las franjas llenas el
                sistema puede contestar si conviene mover producción de
                horario, y con las lecturas puede comprobar el recibo contra
                el aparato de la pared.
              </p>

              <h4 class="emp-sub">El medidor</h4>
              <div class="emp-campos">
                <label>
                  <span class="etiqueta-chica">Lectura anterior</span>
                  <input id="lecturaAnterior" inputmode="decimal" placeholder="14 820"
                         value="${valor(corregir?.lectura_anterior)}">
                </label>
                <label>
                  <span class="etiqueta-chica">Lectura actual</span>
                  <input id="lecturaActual" inputmode="decimal" placeholder="15 240"
                         value="${valor(corregir?.lectura_actual)}">
                </label>
                <label>
                  <span class="etiqueta-chica">Multiplicador<small>viene impreso</small></span>
                  <input id="multiplicador" inputmode="decimal" placeholder="80"
                         value="${valor(corregir?.multiplicador)}">
                </label>
              </div>

              <h4 class="emp-sub">Los kilowatts de cada franja</h4>
              <div class="emp-campos">
                <label>
                  <span class="etiqueta-chica">Base (kWh)<small>la madrugada, la barata</small></span>
                  <input id="kwhBase" inputmode="numeric" placeholder="18000"
                         value="${valor(corregir?.kwh_base)}">
                </label>
                <label>
                  <span class="etiqueta-chica">Intermedia (kWh)<small>casi todo el día</small></span>
                  <input id="kwhIntermedia" inputmode="numeric" placeholder="19500"
                         value="${valor(corregir?.kwh_intermedia)}">
                </label>
                <label>
                  <span class="etiqueta-chica">Punta (kWh)<small>la tarde, la cara</small></span>
                  <input id="kwhPunta" inputmode="numeric" placeholder="2500"
                         value="${valor(corregir?.kwh_punta)}">
                </label>
              </div>

              <h4 class="emp-sub">
                Y lo que costó cada franja
                <small>solo si el recibo lo desglosa en pesos</small>
              </h4>
              <div class="emp-campos">
                <label>
                  <span class="etiqueta-chica">Base ($)</span>
                  <input id="montoBase" inputmode="decimal" placeholder="—"
                         value="${centavos(corregir?.centavos_base)}">
                </label>
                <label>
                  <span class="etiqueta-chica">Intermedia ($)</span>
                  <input id="montoIntermedia" inputmode="decimal" placeholder="—"
                         value="${centavos(corregir?.centavos_intermedia)}">
                </label>
                <label>
                  <span class="etiqueta-chica">Punta ($)</span>
                  <input id="montoPunta" inputmode="decimal" placeholder="—"
                         value="${centavos(corregir?.centavos_punta)}">
                </label>
              </div>

              <h4 class="emp-sub">La demanda</h4>
              <div class="emp-campos">
                <label>
                  <span class="etiqueta-chica">Demanda facturable (kW)</span>
                  <input id="demandaKw" inputmode="decimal" placeholder="180"
                         value="${valor(corregir?.demanda_kw)}">
                </label>
                <label>
                  <span class="etiqueta-chica">Factor de potencia (%)</span>
                  <input id="factorPotencia" inputmode="decimal" placeholder="94"
                         value="${valor(corregir?.factor_potencia)}">
                </label>
              </div>

              <p id="aviso-franjas" class="ayuda" style="margin:10px 0 0"></p>
            </details>

            <label>
              <span class="etiqueta-chica">Notas</span>
              <input id="notas" maxlength="300" placeholder="Lo que haga falta recordar">
            </label>

            <label class="subir" for="archivo" style="margin-top:14px">
              📄 Adjuntar el recibo <small id="nombre-archivo"></small>
              <input type="file" id="archivo" accept="application/pdf,image/*" hidden>
            </label>
            <p class="ayuda" style="margin:8px 0 0;font-size:13.5px">
              El PDF que manda la CFE, o una foto. Se guarda en la carpeta
              <b>datos</b> y no se pierde al actualizar.
            </p>

            <button type="submit" style="margin-top:20px">
              ${corregir ? 'Guardar la corrección' : 'Guardar el recibo'}
            </button>
          </form>
        </div>
      </div>`;

    const q = (s) => pantalla.querySelector(s);
    q('#volver').onclick = pintar;

    // AVISAR MIENTRAS SE ESCRIBE, no al guardar. Las tres franjas tienen
    // que sumar los kilowatts del recibo; si no suman, casi siempre es un
    // dedazo o una franja que se quedó sin capturar, y decirlo con el papel
    // todavía en la mano cuesta cero.
    const revisarFranjas = () => {
      const aviso = q('#aviso-franjas');
      const n = (id) => Number(String(q(`#${id}`).value).replace(/[,\s]/g, '')) || 0;
      const suma = n('kwhBase') + n('kwhIntermedia') + n('kwhPunta');
      const total = n('kwh');
      if (!suma || !total) { aviso.textContent = ''; aviso.className = 'ayuda'; return; }
      const dif = suma - total;
      if (Math.abs(dif) <= Math.max(10, total * 0.02)) {
        aviso.className = 'ayuda bueno';
        aviso.textContent = `✓ Las tres franjas suman ${suma.toLocaleString('es-MX')} kWh, `
          + 'lo mismo que el recibo.';
      } else {
        aviso.className = 'ayuda malo';
        aviso.textContent = `Las franjas suman ${suma.toLocaleString('es-MX')} kWh y el recibo `
          + `dice ${total.toLocaleString('es-MX')}: ${dif > 0 ? 'sobran' : 'faltan'} `
          + `${Math.abs(dif).toLocaleString('es-MX')}. Se puede guardar así, pero revísalo.`;
      }
    };
    ['kwh', 'kwhBase', 'kwhIntermedia', 'kwhPunta']
      .forEach((id) => { q(`#${id}`).oninput = revisarFranjas; });
    revisarFranjas();

    let archivo = null;
    q('#archivo').onchange = async (ev) => {
      const f = ev.target.files?.[0];
      if (!f) return;
      if (f.size > 8 * 1024 * 1024) {
        ev.target.value = '';
        return avisar(`Ese archivo pesa ${Math.round(f.size / 1024 / 1024)} MB y el máximo son 8 MB.`, 'error');
      }
      archivo = await comoTexto(f);
      q('#nombre-archivo').textContent = `· ${f.name}`;
    };

    q('#f').onsubmit = async (ev) => {
      ev.preventDefault();
      const cuerpo = {
        desde: q('#desde').value, hasta: q('#hasta').value,
        kwh: q('#kwh').value, monto: q('#monto').value,
        numero: q('#numero').value, notas: q('#notas').value,
        ...Object.fromEntries(CAMPOS_FINOS.map((c) => [c, q(`#${c}`).value])),
        ...(archivo ? { archivo } : {})
      };
      try {
        if (corregir) await api.actualizar(`/empresa/cfe/${corregir.id}`, cuerpo);
        else await api.enviar('/empresa/cfe', cuerpo);
        avisar(corregir ? 'Recibo corregido' : 'Recibo guardado', 'bien');
        seccion = 'luz';
        await pintar();
      } catch (e) { avisar(e.message, 'error'); }
    };
  }

  /**
   * LOS DATOS FINOS DEL RECIBO, los que van sueltos y opcionales.
   *
   * La lista está en un solo lugar porque el `id` de cada casilla es
   * también el nombre que espera el servidor: así se mandan todas de una
   * pasada y añadir una mañana es tocar un renglón.
   */
  const CAMPOS_FINOS = [
    'iva', 'lecturaAnterior', 'lecturaActual', 'multiplicador',
    'kwhBase', 'kwhIntermedia', 'kwhPunta',
    'montoBase', 'montoIntermedia', 'montoPunta',
    'demandaKw', 'factorPotencia'
  ];

  /** Un número guardado, listo para meterlo en una casilla vacía si no hay. */
  function valor(n) {
    return n === null || n === undefined ? '' : String(n);
  }

  /** Lo mismo, pero de centavos a pesos. */
  function centavos(c) {
    return c === null || c === undefined ? '' : String(c / 100);
  }

  /** ¿Este recibo trae algo del detalle capturado? Para abrir la sección. */
  function tieneDetalle(r) {
    return ['lectura_anterior', 'lectura_actual', 'multiplicador',
            'kwh_base', 'kwh_intermedia', 'kwh_punta',
            'centavos_base', 'centavos_intermedia', 'centavos_punta',
            'demanda_kw', 'factor_potencia'].some((c) => r[c] != null);
  }

  function hoy() {
    const d = new Date();
    const dd = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;
  }

  /** El archivo elegido, como texto, para poder mandarlo al servidor. */
  function comoTexto(archivo) {
    return new Promise((resolver, rechazar) => {
      const lector = new FileReader();
      lector.onload = () => resolver(lector.result);
      lector.onerror = () => rechazar(new Error('No se pudo leer el archivo.'));
      lector.readAsDataURL(archivo);
    });
  }
}
