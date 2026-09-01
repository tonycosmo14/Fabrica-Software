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
        : seccion === 'proveedores'
          ? { proveedores: (await api.obtener('/empresa/proveedores?todos=1')).proveedores }
          : await api.obtener(`/empresa/resumen?periodo=${encodeURIComponent(mes.clave)}`);
    } catch (e) { pantalla.innerHTML = `<p class="vacio">${esc(e.message)}</p>`; return; }

    pantalla.innerHTML = `
      <div class="ancho-completo">
        <h2>Las cuentas de la empresa</h2>
        <p class="ayuda">
          El dinero que <b>no pasa por el cajón</b>: el amoniaco, la sal, los
          barriles de aceite, una compostura, y la luz. Se captura cuando
          llega la factura, no cuando se compra.
        </p>

        <div class="emp-pestanas">
          <button class="secundario ${seccion === 'gastos' ? 'activo' : ''}" data-seccion="gastos">
            📦 Gastos grandes
          </button>
          <button class="secundario ${seccion === 'luz' ? 'activo' : ''}" data-seccion="luz">
            ⚡ Recibos de luz
          </button>
          <button class="secundario ${seccion === 'proveedores' ? 'activo' : ''}" data-seccion="proveedores">
            📒 Proveedores
          </button>
        </div>

        ${seccion === 'luz' ? panelLuz(datos.recibos)
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

    const cadaDias = await pedirTexto({
      titulo: nombre,
      texto: 'Cada cuántos días se suele comprar, para avisar cuando toque. ' +
             'Si no tiene ritmo, se deja vacío y el sistema lo aprende solo.',
      marcador: '90', ok: 'Crear', largo: 4, unaLinea: true, opcional: true
    });
    if (cadaDias === null) return;

    try {
      await api.enviar('/empresa/conceptos', { nombre, unidad, cadaDias });
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
        { valor: 'ritmo', texto: '📅 Cada cuánto se compra',
          detalle: c.cadaDias ? `Ahora: cada ${c.cadaDias} días` : 'Para saber cuándo toca' },
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
      } else if (que === 'ritmo') {
        const dias = await pedirTexto({
          titulo: c.nombre,
          texto: 'Cada cuántos días se suele comprar. Sirve para avisar que toca. ' +
                 'Déjalo vacío si no tiene ritmo.',
          valor: c.cadaDias ? String(c.cadaDias) : '', marcador: '90',
          ok: 'Guardar', largo: 4, unaLinea: true
        });
        if (dias === null) return;
        await api.actualizar(`/empresa/conceptos/${c.id}`, { cadaDias: dias });
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
            </div>

            <label>
              <span class="etiqueta-chica">Notas</span>
              <input id="notas" maxlength="300" placeholder="Lo que haga falta recordar"
                     value="${esc(corregir?.notas || '')}">
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
            ${pr.que_hace ? `<p class="prov-que">${esc(pr.que_hace)}</p>` : ''}
            <div class="prov-datos">
              ${pr.telefono ? `<span>📞 <a href="tel:${esc(pr.telefono.replace(/[^+0-9]/g, ''))}">${esc(pr.telefono)}</a></span>` : ''}
              ${pr.horarios ? `<span>🕐 ${esc(pr.horarios)}</span>` : ''}
              ${pr.direccion ? `<span>📍 ${esc(pr.direccion)}</span>` : ''}
              ${pr.ubicacion ? (/^https?:\/\//i.test(pr.ubicacion)
                ? `<span>🗺 <a href="${esc(pr.ubicacion)}" target="_blank" rel="noopener">Cómo llegar</a></span>`
                : `<span>🗺 ${esc(pr.ubicacion)}</span>`) : ''}
            </div>
            ${pr.notas ? `<p class="prov-notas">${esc(pr.notas)}</p>` : ''}
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

            <label>
              <span class="etiqueta-chica">Qué hace<small>y para qué le sirve a la fábrica</small></span>
              <textarea id="p-que" maxlength="600" rows="3"
                        placeholder="Surte el amoniaco de los compresores. Se le pide con una semana; trae el cilindro y se lleva el vacío.">${esc(pr?.que_hace || '')}</textarea>
            </label>
            <label>
              <span class="etiqueta-chica">Notas</span>
              <textarea id="p-notas" maxlength="600" rows="2"
                        placeholder="Solo acepta transferencia. En diciembre cierra dos semanas.">${esc(pr?.notas || '')}</textarea>
            </label>

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
                <span class="etiqueta-chica">Número de servicio o recibo</span>
                <input id="numero" maxlength="40" placeholder="Para buscarlo con la CFE"
                       value="${esc(corregir?.numero || '')}">
              </label>
            </div>

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
