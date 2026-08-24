/**
 * CLIENTES Y CRÉDITO  (v1.6)
 *
 * Dos columnas a lo ancho de la pantalla, como Productos: la lista a la
 * izquierda y la ficha completa a la derecha. No se desplaza la página.
 *
 * Arriba, lo único que de verdad se pregunta todos los días: cuánto hay en
 * la calle y a quién ya se le venció. Todo lo demás es detalle.
 *
 * La cuenta se lee de arriba abajo como se la explicaría uno al cliente:
 *
 *     se llevó  −  ha pagado  =  DEBE
 */
import { api } from '../api.js';
import { esc, avisar, fecha as formatoFecha } from '../util.js';
import { pedirTexto, pedirImporte, confirmar, menu } from '../dialogo.js';
import { pesos } from '../fracciones.js';

export async function vistaClientes(pantalla, estadoApp) {
  const puede = (p) => estadoApp.permisos.includes('*') || estadoApp.permisos.includes(p);
  const administra = puede('clientes.administrar');
  const cobra = puede('credito.cobrar');
  const corrige = puede('venta.cancelar');

  let datos = { clientes: [], cartera: null };
  let ficha = null;             // { cliente, cuenta }
  let seleccionado = null;      // id
  let soloDeben = false;
  let verBajas = false;
  let busca = '';

  await cargar();

  async function cargar() {
    const query = new URLSearchParams();
    if (verBajas) query.set('incluirBajas', '1');
    if (soloDeben) query.set('deben', '1');
    if (busca) query.set('busca', busca);

    datos = await api.obtener(`/clientes?${query}`);

    if (seleccionado && !datos.clientes.some((c) => c.id === seleccionado)) {
      // Sigue existiendo, solo que el filtro lo escondió: se deselecciona
      // para no dejar una ficha abierta sin su renglón en la lista.
      seleccionado = null;
      ficha = null;
    }
    if (seleccionado) ficha = await api.obtener(`/clientes/${seleccionado}`);
    pintar();
  }

  async function abrir(id) {
    seleccionado = id;
    ficha = await api.obtener(`/clientes/${id}`);
    pintar();
  }

  // ==========================================================
  // LA PANTALLA
  // ==========================================================
  function pintar() {
    const c = datos.cartera;
    pantalla.innerHTML = `
      <div class="cfg">
        <div class="cfg-cabeza">
          <h2>Clientes</h2>
          <div class="cfg-cabeza-acciones">
            ${c ? `
              <span class="cartera-dato">
                <small>En la calle</small><strong>${pesos(c.enLaCalle)}</strong>
              </span>
              <span class="cartera-dato">
                <small>Deben</small><strong>${c.deudores}</strong>
              </span>
              ${c.vencidos ? `
                <span class="etiqueta-mal">${c.vencidos} vencido${c.vencidos === 1 ? '' : 's'}
                  · ${pesos(c.vencidoCentavos)}</span>` : ''}` : ''}
            <button class="secundario chico ${soloDeben ? 'activo' : ''}" id="solo-deben">
              ${soloDeben ? 'Ver todos' : 'Solo los que deben'}
            </button>
            ${administra ? `
              <button class="secundario chico ${verBajas ? 'activo' : ''}" id="ver-bajas">
                ${verBajas ? 'Ocultar dados de baja' : 'Ver dados de baja'}
              </button>` : ''}
          </div>
        </div>

        <div class="cfg-tablero cfg-tablero-2">
          <aside class="cfg-columna">
            <input id="busca" class="buscador" autocomplete="off"
                   placeholder="Nombre, negocio o teléfono" value="${esc(busca)}">
            <div class="cfg-lista">
              ${datos.clientes.map(fila).join('')
                || `<p class="vacio" style="padding:24px 0">${
                     busca ? 'Nadie con ese nombre.' : 'Todavía no hay clientes.'}</p>`}
            </div>
            ${administra ? '<button class="secundario chico" id="nuevo">＋ Cliente</button>' : ''}
          </aside>

          <section class="cfg-columna cfg-detalle" id="detalle">
            ${panelDerecho()}
          </section>
        </div>
      </div>`;

    enganchar();
  }

  function fila(c) {
    const e = c.estado;
    return `
      <button class="cfg-item cfg-cliente ${seleccionado === c.id ? 'activo' : ''}
                     ${c.activo ? '' : 'de-baja'}"
              data-cliente="${esc(c.id)}">
        <span class="crece">
          <strong>${esc(c.nombre)}</strong>
          <small>
            ${c.negocio ? esc(c.negocio) : c.telefono ? esc(c.telefono) : 'sin negocio'}
            ${c.activo ? '' : ' · dado de baja'}
          </small>
        </span>
        <span class="cliente-saldo ${e.vencido ? 'vencido' : e.saldo > 0 ? 'debe' : ''}">
          ${e.saldo > 0 ? pesos(e.saldo) : e.saldo < 0 ? 'a favor' : '—'}
        </span>
      </button>`;
  }

  function panelDerecho() {
    if (!ficha) {
      return `
        <p class="vacio" style="padding:40px 0">
          Toca un cliente para ver su cuenta.
        </p>`;
    }
    return panelCliente(ficha.cliente, ficha.cuenta);
  }

  // ==========================================================
  // CAMPOS QUE SE EDITAN EN EL SITIO
  //
  // Igual que en Productos: se toca, se escribe encima y al salir queda
  // guardado. Un formulario de cinco pasos para corregir un teléfono es un
  // estorbo, y corregir teléfonos es lo que se hace todos los días.
  // ==========================================================
  function campo(etiqueta, clave, valor, { ayuda = '', marcador = '' } = {}) {
    if (!administra) {
      return `
        <div class="cuadre-linea">
          <span>${esc(etiqueta)}</span>
          <strong>${esc(valor === '' || valor === null || valor === undefined
            ? '—' : String(valor))}</strong>
        </div>`;
    }
    return `
      <div class="cuadre-linea campo-vivo">
        <span>${esc(etiqueta)}${ayuda ? `<small>${esc(ayuda)}</small>` : ''}</span>
        <input data-campo="${esc(clave)}" value="${esc(valor ?? '')}"
               placeholder="${esc(marcador)}" autocomplete="off">
      </div>`;
  }

  // ==========================================================
  // LA FICHA
  // ==========================================================
  function panelCliente(c, cuenta) {
    const e = c.estado;

    return `
      <div class="cfg-detalle-cabeza">
        <div class="crece">
          <h3 style="margin:0">${esc(c.nombre)}</h3>
          ${c.negocio ? `<p class="ayuda" style="margin:2px 0 0">${esc(c.negocio)}</p>` : ''}
          ${c.activo ? '' : '<span class="etiqueta baja">Dado de baja</span>'}
        </div>
      </div>

      <div class="saldo-grande ${e.vencido ? 'vencido' : e.saldo > 0 ? 'debe' : 'al-corriente'}">
        <span>${e.saldo > 0 ? 'Debe' : e.saldo < 0 ? 'Tiene a favor' : 'No debe nada'}</span>
        <strong>${pesos(Math.abs(e.saldo))}</strong>
        ${e.saldo > 0 && e.diasDebiendo
          ? `<small>desde hace ${e.diasDebiendo} día${e.diasDebiendo === 1 ? '' : 's'}</small>`
          : ''}
      </div>

      ${e.vencido ? `
        <div class="aviso-sin-caja" style="margin-bottom:12px">
          <strong>Se le pasó el plazo.</strong>
          Su plazo son ${c.dias_plazo} días y lleva ${e.diasDebiendo}.
        </div>` : ''}

      <div class="cuadre">
        <div class="cuadre-linea"><span>Se ha llevado fiado</span><strong>${pesos(e.cargado)}</strong></div>
        <div class="cuadre-linea vendido"><span>− Ha pagado</span><strong>${pesos(e.abonado)}</strong></div>
        <div class="cuadre-linea total">
          <span>= Debe</span>
          <strong class="${e.saldo > 0 ? 'malo' : ''}">${pesos(e.saldo)}</strong>
        </div>
        ${e.limite !== null ? `
          <div class="cuadre-linea">
            <span>Le queda de su límite</span>
            <strong class="${e.disponible <= 0 ? 'malo' : ''}">${pesos(e.disponible)}</strong>
          </div>` : ''}
      </div>

      ${cobra && c.activo ? `
        <div class="fila-botones" style="margin-top:14px;flex-wrap:wrap">
          <button class="pos-btn-entrada chico" id="abonar">＋ Recibir abono</button>
          <button class="secundario chico" id="abonar-transf">Abono por transferencia</button>
        </div>` : ''}

      <h4 class="cfg-subtitulo">Sus datos</h4>
      <div class="cuadre cfg-cliente-datos">
        ${campo('Nombre', 'nombre', c.nombre)}
        ${campo('Negocio', 'negocio', c.negocio, { marcador: 'Abarrotes Doña Mary' })}
        ${campo('Teléfono', 'telefono', c.telefono, { marcador: '999 123 4567' })}
        ${campo('Dirección', 'direccion', c.direccion)}
        ${campo('Límite de crédito', 'limite',
                c.limite_centavos === null ? '' : (c.limite_centavos / 100).toFixed(2),
                { ayuda: 'vacío = sin límite', marcador: 'sin límite' })}
        ${campo('Días de plazo', 'diasPlazo', c.dias_plazo ?? '',
                { ayuda: 'solo para avisar de lo vencido', marcador: 'sin plazo' })}
      </div>
      ${administra ? `
        <p class="ayuda" style="margin-top:8px">
          Pasarse del límite <strong>no impide la venta</strong>: pide el PIN de un
          gerente y queda escrito quién lo autorizó.
        </p>` : ''}

      ${c.notas || administra ? `
        <h4 class="cfg-subtitulo">Notas</h4>
        <div class="cuadre">${campo('Notas', 'notas', c.notas)}</div>` : ''}

      <h4 class="cfg-subtitulo">Su cuenta</h4>
      ${cuenta.length ? `
        <table class="venta-lineas cuenta-corriente">
          ${cuenta.map(renglonCuenta).join('')}
        </table>` : '<p class="ayuda">Todavía no se ha llevado nada fiado.</p>'}

      ${administra && c.activo ? `
        <div class="fila-botones" style="margin-top:18px">
          <button class="secundario chico peligro" id="baja">Dar de baja</button>
        </div>` : ''}
      ${administra && !c.activo ? `
        <div class="fila-botones" style="margin-top:18px">
          <button class="secundario chico" id="alta">Volver a dar de alta</button>
        </div>` : ''}`;
  }

  function renglonCuenta(m) {
    const esCargo = m.tipo === 'cargo';
    return `
      <tr class="${m.cancelado ? 'anulada' : ''}">
        <td class="detalle">
          ${esCargo
            ? `Se llevó <b>#${m.folio}</b>`
            : `Pagó${m.formaPago === 'transferencia' ? ' por transferencia' : ''}`}
          <small>
            ${esc(formatoFecha(m.fecha))}
            ${m.recibio ? ' · recibió ' + esc(m.recibio) : ''}
            ${m.cancelado ? ' · ' + (esCargo ? 'cancelado' : 'anulado') : ''}
            ${m.cancelado && m.motivo ? ': ' + esc(m.motivo) : ''}
          </small>
        </td>
        <td class="importe ${esCargo ? 'malo' : 'bueno'}">
          ${m.cancelado ? '—' : (esCargo ? '+' : '−') + pesos(m.centavos)}
        </td>
        ${corrige && !esCargo && !m.cancelado ? `
          <td class="quitar">
            <button class="tachita" data-anular="${esc(m.id)}"
                    aria-label="Anular este abono">×</button>
          </td>` : '<td></td>'}
      </tr>`;
  }

  // ==========================================================
  // ENGANCHAR
  // ==========================================================
  function enganchar() {
    const q = (sel) => pantalla.querySelector(sel);

    const buscador = q('#busca');
    let espera;
    buscador.oninput = () => {
      clearTimeout(espera);
      espera = setTimeout(() => { busca = buscador.value.trim(); cargar(); }, 300);
    };
    buscador.onkeydown = (ev) => { if (ev.key === 'Enter') ev.preventDefault(); };

    q('#solo-deben').onclick = () => { soloDeben = !soloDeben; cargar(); };
    const bajas = q('#ver-bajas');
    if (bajas) bajas.onclick = () => { verBajas = !verBajas; cargar(); };
    const nuevo = q('#nuevo');
    if (nuevo) nuevo.onclick = nuevoCliente;

    pantalla.querySelectorAll('[data-cliente]').forEach((b) => {
      b.onclick = () => abrir(b.dataset.cliente);
    });

    // Los campos se guardan al salir de ellos, igual que en Productos.
    pantalla.querySelectorAll('[data-campo]').forEach((el) => {
      el.onblur = () => guardarCampo(el);
      el.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); } };
    });

    const abonar = q('#abonar');
    if (abonar) abonar.onclick = () => recibirAbono('efectivo');
    const transf = q('#abonar-transf');
    if (transf) transf.onclick = () => recibirAbono('transferencia');

    const baja = q('#baja');
    if (baja) baja.onclick = darDeBaja;
    const alta = q('#alta');
    if (alta) alta.onclick = darDeAlta;

    pantalla.querySelectorAll('[data-anular]').forEach((b) => {
      b.onclick = () => anularAbono(b.dataset.anular);
    });
  }

  // ==========================================================
  // ACCIONES
  // ==========================================================
  async function nuevoCliente() {
    const nombre = await pedirTexto({
      titulo: 'Nuevo cliente',
      texto: 'Solo a los clientes dados de alta se les puede fiar.',
      marcador: 'María Canul', ok: 'Dar de alta', largo: 80, unaLinea: true
    });
    if (!nombre) return;

    try {
      const r = await api.enviar('/clientes', { nombre });
      avisar('Cliente dado de alta', 'bien');
      seleccionado = r.cliente.id;
      await cargar();
      // El resto de sus datos se llenan tocándolos en la ficha: pedirlos
      // todos por adelantado sería un formulario, y casi nunca se saben.
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function guardarCampo(el) {
    if (!ficha) return;
    const clave = el.dataset.campo;
    try {
      const r = await api.actualizar(`/clientes/${ficha.cliente.id}`, { [clave]: el.value.trim() });
      ficha.cliente = r.cliente;
      el.classList.add('guardado');
      setTimeout(() => el.classList.remove('guardado'), 900);
      // La lista de la izquierda enseña el nombre y el saldo: si cambió el
      // nombre, ahí también tiene que cambiar.
      await cargar();
    } catch (e) {
      avisar(e.message, 'error');
      await abrir(ficha.cliente.id);
    }
  }

  async function recibirAbono(formaPago) {
    const c = ficha.cliente;
    const monto = await pedirImporte({
      titulo: `Abono de ${c.nombre}`,
      texto: c.estado.saldo > 0
        ? `Debe ${pesos(c.estado.saldo)}. ¿Cuánto está dejando?`
        : 'No debe nada. Lo que deje queda a su favor.',
      marcador: c.estado.saldo > 0 ? (c.estado.saldo / 100).toFixed(2) : '100',
      ok: formaPago === 'efectivo' ? 'Recibir el dinero' : 'Anotar la transferencia'
    });
    if (!monto) return;

    try {
      const r = await api.enviar(`/clientes/${c.id}/abonos`, { monto, formaPago });
      if (r.deMas > 0) {
        avisar(`Pagó ${pesos(r.deMas)} de más. Le queda a favor.`, '');
      } else {
        avisar(r.saldo > 0 ? `Le quedan ${pesos(r.saldo)}` : 'Queda al corriente', 'bien');
      }
      if (r.sinTurno) {
        avisar('No hay turno de caja abierto: ese dinero no entra en ningún corte', 'error');
      }
      await cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function anularAbono(id) {
    const motivo = await pedirTexto({
      titulo: 'Anular este abono',
      texto: 'No se borra: queda marcado como anulado, con tu nombre y el motivo. ' +
             'Si fue en efectivo, también se quita del cajón.',
      marcador: 'Se anotó dos veces', ok: 'Anular', largo: 200, unaLinea: true
    });
    if (!motivo) return;

    try {
      await api.enviar(`/clientes/abonos/${id}/anular`, { motivo });
      avisar('Abono anulado', 'bien');
      await cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function darDeBaja() {
    const c = ficha.cliente;
    if (!await confirmar({
      titulo: `¿Dar de baja a ${c.nombre}?`,
      texto: 'Deja de salir en la caja y ya no se le puede fiar. Sus tickets viejos ' +
             'no cambian, y se puede recuperar cuando sea.',
      ok: 'Dar de baja', peligro: true
    })) return;

    try {
      await api.enviar(`/clientes/${c.id}/baja`, {});
      avisar('Cliente dado de baja', 'bien');
      seleccionado = null; ficha = null;
      await cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function darDeAlta() {
    try {
      await api.enviar(`/clientes/${ficha.cliente.id}/alta`, {});
      avisar('Cliente activo otra vez', 'bien');
      await cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }
}
