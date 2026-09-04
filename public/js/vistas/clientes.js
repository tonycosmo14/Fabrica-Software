/**
 * CLIENTES Y CRÉDITO  (v1.6, rediseñada en la v3.8)
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
 *
 * QUÉ CAMBIÓ EN LA v3.8. La pantalla decía todo lo que hace falta, pero lo
 * decía en veinte renglones iguales de texto: para encontrar a alguien
 * había que ir deletreando nombres.
 *
 *  · CADA CLIENTE TIENE CARA. Su logo si lo tiene —un mayorista es una
 *    tienda con rótulo—, y si no, la inicial de su nombre en un círculo de
 *    color sacado del propio nombre, que siempre es el mismo para el mismo
 *    cliente. Es la misma razón por la que los productos llevan foto: se
 *    reconoce sin leer.
 *  · LA FICHA ARRANCA CON QUIÉN ES Y CUÁNTO DEBE, juntos y grandes, con
 *    su teléfono para marcarlo de un toque desde la tablet.
 *  · SUS DATOS EN REJILLA, no en una columna de renglones sueltos, y el
 *    crédito —límite, plazo, su lista de precios— aparte de los datos de
 *    contacto: son dos cosas distintas y se tocan en momentos distintos.
 */
import { api } from '../api.js';
import { esc, avisar, fecha as formatoFecha, colorDe } from '../util.js';
import { pedirTexto, pedirImporte, confirmar, menu, pedirContrasena } from '../dialogo.js';
import { pesos, paraEditar } from '../fracciones.js';
import { enlaceMaps } from '../mapa.js';
import { ubicacionDe, elegirEnMapa } from '../ubicacion.js';

/**
 * LAS TRES LÍNEAS DEL NEGOCIO  (v5.4)
 *
 * "Hay clientes para el mayoreo de marquetas, hay clientes para el reparto
 *  de agua y hay clientes para las bolsas."
 *
 * Son un FILTRO sobre la misma lista, no tres listas. El cliente sigue
 * siendo uno solo con su deuda y su límite; lo que se guarda es qué le
 * compra. El que compra las tres cosas sale en las tres pestañas, que es
 * justo lo que hace falta cuando se prepara cada reparto.
 *
 * VA AQUÍ FUERA, Y NO DENTRO DE LA VISTA, A PROPÓSITO.
 *
 * La vista arranca con un `await cargar()` que pinta, y pintar usa esta
 * lista. Un `const` declarado más abajo dentro de la función todavía no se
 * ha ejecutado en ese momento, y la pantalla sale en blanco con "Cannot
 * access LINEAS before initialization" — que no dice nada a nadie. Es la
 * tercera vez que pasa en este proyecto; una constante que no depende de
 * nada vive fuera y el problema no existe.
 */
const LINEAS = [
  { clave: '', nombre: 'Todos', emoji: '👥', cuenta: 'todos' },
  // LOS DE SIEMPRE Y LOS DE UNA VEZ  (v6.4): por el ritmo con que compran,
  // que sale de los tickets. Un filtro más, no otra lista.
  { clave: 'frecuente', nombre: 'De siempre', emoji: '⭐', cuenta: 'frecuentes', tipo: 'ritmo' },
  { clave: 'ocasional', nombre: 'De una vez', emoji: '🕓', cuenta: 'ocasionales', tipo: 'ritmo' },
  { clave: 'marqueta', nombre: 'Marquetas', emoji: '🧊', cuenta: 'marqueta' },
  { clave: 'bolsa', nombre: 'Bolsas', emoji: '🧊', cuenta: 'bolsa' },
  { clave: 'agua', nombre: 'Agua', emoji: '💧', cuenta: 'agua' }
];

export async function vistaClientes(pantalla, estadoApp) {
  const puede = (p) => estadoApp.permisos.includes('*') || estadoApp.permisos.includes(p);
  const administra = puede('clientes.administrar');
  const cobra = puede('credito.cobrar');
  const corrige = puede('venta.cancelar');
  // Borrar de verdad es solo del administrador.
  const esAdmin = estadoApp.permisos.includes('*');

  let datos = { clientes: [], cartera: null, listas: [] };
  let listas = [];              // las listas de mayoreo que se pueden asignar
  let laNormal = null;          // cómo se llama la lista de mayoreo de siempre
  let ficha = null;             // { cliente, cuenta }
  let seleccionado = null;      // id
  let soloDeben = false;
  let verBajas = false;
  let busca = '';
  // La pestaña: '' son todos, y si no, qué le compra (v5.4).
  let linea = '';

  await cargar();

  async function cargar() {
    const query = new URLSearchParams();
    if (verBajas) query.set('incluirBajas', '1');
    if (soloDeben) query.set('deben', '1');
    if (busca) query.set('busca', busca);
    if (linea) {
      const l = LINEAS.find((x) => x.clave === linea);
      query.set(l?.tipo === 'ritmo' ? 'ritmo' : 'compra', linea);
    }

    datos = await api.obtener(`/clientes?${query}`);
    listas = datos.listas || [];
    laNormal = datos.mayoreoPorOmision || null;

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

  function pestanas() {
    const n = datos.porLinea || {};
    return `
      <div class="cli-pestanas">
        ${LINEAS.map((l) => `
          <button class="cli-pestana ${linea === l.clave ? 'activa' : ''}"
                  data-linea="${l.clave}" title="${l.nombre}">
            <span>${l.emoji} ${l.nombre}</span>
            <small>${n[l.cuenta] ?? 0}</small>
          </button>`).join('')}
      </div>`;
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
            ${pestanas()}
            <input id="busca" class="buscador" autocomplete="off"
                   placeholder="Nombre, negocio o teléfono" value="${esc(busca)}">
            <div class="cfg-lista">
              ${datos.clientes.map(fila).join('')
                || `<p class="vacio" style="padding:24px 0">${
                     busca ? 'Nadie con ese nombre.'
                     : linea ? `Nadie de ${LINEAS.find((l) => l.clave === linea).nombre.toLowerCase()} todavía.
                                Se marca en la ficha de cada cliente, en «Qué le compra».`
                     : 'Todavía no hay clientes.'}</p>`}
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

  /**
   * LA CARA DEL CLIENTE.
   *
   * Su logo si lo subió; si no, la inicial en un círculo de color. El
   * color NO es al azar: sale de las letras del propio nombre, así que
   * "Abarrotes Doña Mary" es siempre del mismo color y eso es justo lo
   * que la hace útil para reconocerla de reojo. El cálculo vive en util
   * porque la pantalla de la gente hace lo mismo con sus iniciales.
   */
  function avatar(c, clase = '') {
    if (c.foto) {
      return `<img class="cli-cara ${clase}" src="/fotos/${esc(c.foto)}"
                   alt="${esc(c.nombre)}">`;
    }
    const inicial = (c.negocio || c.nombre || '?').trim().charAt(0).toUpperCase();
    return `<span class="cli-cara cli-inicial ${clase}"
                  style="background:${colorDe(c.negocio || c.nombre)}">${esc(inicial)}</span>`;
  }

  /** "3 tickets en 30 días · último hace 2 d", como se diría. */
  function textoRitmo(r) {
    if (!r) return '';
    const cuantos = r.tickets30 === 0 ? 'nada en 30 días'
      : `${r.tickets30} ticket${r.tickets30 === 1 ? '' : 's'} en 30 días`;
    const ultimo = r.diasSinComprar == null ? 'nunca ha comprado'
      : r.diasSinComprar === 0 ? 'compró hoy'
      : `último hace ${r.diasSinComprar} d`;
    return `${cuantos} · ${ultimo}`;
  }

  function fila(c) {
    const e = c.estado;
    return `
      <button class="cfg-item cfg-cliente ${seleccionado === c.id ? 'activo' : ''}
                     ${c.activo ? '' : 'de-baja'}"
              data-cliente="${esc(c.id)}">
        ${avatar(c)}
        <span class="crece">
          <strong>${esc(c.negocio || c.nombre)}</strong>
          <small>
            ${c.negocio ? esc(c.nombre) : c.telefono ? esc(c.telefono) : 'sin negocio'}
            ${c.activo ? '' : ' · dado de baja'}
            ${e.ritmo ? ` · ${textoRitmo(e.ritmo)}` : ''}
          </small>
        </span>
        ${e.ritmo?.frecuente ? '<span class="etiqueta-mayoreo" title="De siempre: le compra seguido">⭐</span>' : ''}
        ${c.lista_id ? '<span class="etiqueta-mayoreo" title="Tiene su propio precio">🏷️</span>' : ''}
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

    // El teléfono, listo para marcarlo de un toque desde la tablet: es lo
    // primero que uno busca en esta pantalla cuando alguien debe.
    const tel = String(c.telefono || '').replace(/[^\d+]/g, '');

    return `
      <div class="cli-cabeza">
        <div class="cli-retrato">
          ${avatar(c, 'grande')}
          ${administra ? `
            <label class="cli-cambiar-foto" for="foto-cliente"
                   title="${c.foto ? 'Cambiar el logo' : 'Ponerle su logo o su foto'}">
              📷
              <input type="file" id="foto-cliente" accept="image/*" hidden>
            </label>
            ${c.foto ? '<button class="cli-quitar-foto" id="quitar-foto" title="Quitar el logo">×</button>' : ''}
          ` : ''}
        </div>

        <div class="cli-quien">
          <h3>${esc(c.negocio || c.nombre)}</h3>
          <p class="cli-segundo">
            <span class="cliente-num">#${c.numero ?? '—'}</span>
            ${c.negocio ? esc(c.nombre) : ''}
          </p>
          <div class="cli-etiquetas">
            ${c.activo ? '' : '<span class="etiqueta baja">Dado de baja</span>'}
            ${c.lista
              ? `<span class="etiqueta mayoreo">🏷️ ${esc(c.lista.nombre)}</span>` : ''}
            ${e.vencido ? '<span class="etiqueta-mal">Se le pasó el plazo</span>' : ''}
          </div>
          ${tel ? `
            <a class="cli-telefono" href="tel:${esc(tel)}">📞 ${esc(c.telefono)}</a>` : ''}
          ${c.direccion ? `<p class="cli-direccion">📍 ${esc(c.direccion)}</p>` : ''}
        </div>

        <div class="saldo-grande ${e.vencido ? 'vencido' : e.saldo > 0 ? 'debe' : 'al-corriente'}">
          <span>${e.saldo > 0 ? 'Debe' : e.saldo < 0 ? 'Tiene a favor' : 'No debe nada'}</span>
          <strong>${pesos(Math.abs(e.saldo))}</strong>
          ${e.saldo > 0 && e.diasDebiendo
            ? `<small>desde hace ${e.diasDebiendo} día${e.diasDebiendo === 1 ? '' : 's'}</small>`
            : ''}
        </div>
      </div>

      ${e.vencido ? `
        <div class="aviso-sin-caja" style="margin-bottom:12px">
          <strong>Se le pasó el plazo.</strong>
          Su plazo son ${c.dias_plazo} días y lleva ${e.diasDebiendo}.
        </div>` : ''}

      <div class="cuadre">
        <div class="cuadre-linea"><span>Se ha llevado a crédito</span><strong>${pesos(e.cargado)}</strong></div>
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

      <!-- QUÉ LE COMPRA, SIN BOTONES  (v5.7.1). Se marca solo con lo que va
           comprando —cada venta y cada pedido lo apuntan— y lo único que
           hace es decidir en qué pestaña de arriba sale. Se enseña para
           que se entienda por qué está donde está, y ya. -->
      <p class="ayuda cli-compra">
        ${[c.compra_marqueta && '🧊 marquetas', c.compra_bolsa && '🧊 bolsas', c.compra_agua && '💧 agua']
          .filter(Boolean).join(' · ') || 'Todavía no le ha comprado nada'}
        <small>· se marca solo con lo que compra, y es lo que decide en qué pestaña sale</small>
      </p>
      ${cuenta?.ritmo || c.estado?.ritmo ? `
        <p class="ayuda cli-compra">
          ${(cuenta?.ritmo || c.estado.ritmo).frecuente ? '⭐ <b>De siempre</b>' : '🕓 <b>De una vez</b>'}
          · ${textoRitmo(cuenta?.ritmo || c.estado.ritmo)}
          <small>· es «de siempre» con ${(cuenta?.ritmo || c.estado.ritmo).tope} tickets o más en 30 días; sale solo de las ventas</small>
        </p>` : ''}

      <h4 class="cfg-subtitulo">Quién es y dónde está</h4>
      <div class="cuadre cfg-cliente-datos cli-rejilla">
        ${campo('Nombre', 'nombre', c.nombre)}
        ${campo('Negocio', 'negocio', c.negocio, { marcador: 'Abarrotes Doña Mary' })}
        ${campo('Teléfono', 'telefono', c.telefono, { marcador: '999 123 4567' })}
        ${campo('Dirección', 'direccion', c.direccion)}
        ${campo('Referencias', 'referencias', c.referencias,
                { marcador: 'La de la puerta azul, junto a la tortillería',
                  ayuda: 'lo que hace que se encuentre la puerta' })}
        ${campo('Horario de entrega', 'horarioEntrega', c.horario_entrega,
                { marcador: 'de 8 a 2 y de 5 a 8',
                  ayuda: 'a qué hora se le puede llegar' })}
      </div>
      ${administra ? `
        <div class="fila-botones" style="margin-top:10px;flex-wrap:wrap">
          <button class="secundario chico" id="ubicacion">
            📍 ${c.latitud != null ? 'Cambiar la ubicación' : 'Poner la ubicación'}
          </button>
          ${c.latitud != null ? `
            <a class="boton-enlace chico" target="_blank" rel="noopener"
               href="${enlaceMaps(c.latitud, c.longitud, c.nombre)}">Ver en el mapa</a>` : ''}
        </div>
        <p class="ayuda" style="margin:6px 0 0">
          Se pega el enlace que da Google Maps al compartir. Es lo que va a
          llevar el QR de su nota de entrega.
        </p>` : ''}

      <h4 class="cfg-subtitulo">Su crédito y su precio</h4>
      <div class="cuadre cfg-cliente-datos cli-rejilla">
        ${campo('Límite de crédito', 'limite',
                paraEditar(c.limite_centavos),
                { ayuda: 'vacío = sin límite', marcador: 'sin límite' })}
        ${campo('Días de plazo', 'diasPlazo', c.dias_plazo ?? '',
                { ayuda: 'solo para avisar de lo vencido', marcador: 'sin plazo' })}
        ${selectorDeLista(c)}
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
        </table>` : '<p class="ayuda">Todavía no se ha llevado nada a crédito.</p>'}

      ${administra && c.activo ? `
        <div class="fila-botones" style="margin-top:18px">
          <button class="secundario chico peligro" id="baja">Dar de baja</button>
          ${esAdmin ? '<button class="secundario chico peligro" id="borrar">Eliminar</button>' : ''}
        </div>` : ''}
      ${administra && !c.activo ? `
        <div class="fila-botones" style="margin-top:18px">
          <button class="secundario chico" id="alta">Volver a dar de alta</button>
        </div>` : ''}`;
  }

  /**
   * SU PRECIO  (v1.9)
   *
   * A quien tiene lista de mayoreo se le cobra esa lista sola, en la caja,
   * en cuanto el cajero dice quién es. No es un descuento que se teclea:
   * es su precio, y por eso vive aquí, en su ficha, y no en el ticket.
   *
   * Solo desde media marqueta —o desde donde esté puesto el mínimo—, que es
   * el trato de verdad: al que lleva un cuarto no se le hace precio.
   */
  function selectorDeLista(c) {
    const suya = c.lista_id;
    if (!administra) {
      return `
        <div class="cuadre-linea">
          <span>Precio de mayoreo</span>
          <strong>${c.lista ? esc(c.lista.nombre) : (laNormal || 'el de siempre')}</strong>
        </div>`;
    }
    return `
      <div class="cuadre-linea campo-vivo">
        <span>Precio de mayoreo<small>cuál lista se le cobra al teclear 1m</small></span>
        <select data-lista>
          <option value="">${laNormal ? `El normal (${esc(laNormal)})` : 'El de siempre'}</option>
          ${listas.map((l) => `
            <option value="${esc(l.id)}" ${suya === l.id ? 'selected' : ''}>
              ${esc(l.nombre)}
            </option>`).join('')}
        </select>
        ${c.lista && !c.lista.activo
          ? '<small class="malo">esa lista se dio de baja: se le cobra público</small>' : ''}
      </div>`;
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
    pantalla.querySelectorAll('[data-linea]').forEach((b) => {
      b.onclick = () => { linea = b.dataset.linea; cargar(); };
    });
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

    const selLista = pantalla.querySelector('[data-lista]');
    if (selLista) selLista.onchange = async () => {
      try {
        const r = await api.actualizar(`/clientes/${ficha.cliente.id}`,
                                       { listaId: selLista.value });
        ficha.cliente = r.cliente;
        avisar(r.cliente.lista
          ? `${r.cliente.nombre} paga precio de ${r.cliente.lista.nombre}`
          : `${r.cliente.nombre} paga el precio de mayoreo normal`, 'bien');
        await cargar();
      } catch (e) { avisar(e.message, 'error'); await abrir(ficha.cliente.id); }
    };

    const subirFoto = q('#foto-cliente');
    if (subirFoto) subirFoto.onchange = (ev) => ponerFoto(ev.target);
    const quitarFoto = q('#quitar-foto');
    if (quitarFoto) quitarFoto.onclick = borrarFoto;

    const abonar = q('#abonar');
    if (abonar) abonar.onclick = () => recibirAbono('efectivo');
    const transf = q('#abonar-transf');
    if (transf) transf.onclick = () => recibirAbono('transferencia');

    const baja = q('#baja');
    if (baja) baja.onclick = darDeBaja;
    const borrar = q('#borrar');
    if (borrar) borrar.onclick = eliminarCliente;
    const alta = q('#alta');
    if (alta) alta.onclick = darDeAlta;

    pantalla.querySelectorAll('[data-anular]').forEach((b) => {
      b.onclick = () => anularAbono(b.dataset.anular);
    });

    // Qué le compra: cada marca se prende y se apaga sola.
    const ubic = q('#ubicacion');
    if (ubic) ubic.onclick = ponerUbicacion;
  }

  /** Prender o apagar una línea. No apaga las otras: puede comprar las tres. */
  /**
   * LA UBICACIÓN, PEGANDO EL ENLACE DE GOOGLE MAPS.
   *
   * Lo mismo que en las neveras y por la misma razón: nadie va a teclear
   * una latitud a mano, pero el botón de compartir de Google Maps lo tiene
   * cualquiera en el celular.
   */
  async function ponerUbicacion() {
    const c = ficha.cliente;
    const tiene = c.latitud != null && c.longitud != null;

    // DOS CAMINOS Y LOS DOS LLEGAN  (v5.7.1). Antes solo se podía pegar, y
    // el enlace corto del celular se rechazaba. Ahora ese enlace lo sigue
    // el servidor, y además está el mapa para tocar.
    const como = await menu({
      titulo: `La ubicación de ${c.nombre}`,
      texto: tiene ? `Ahora: ${Number(c.latitud).toFixed(5)}, ${Number(c.longitud).toFixed(5)}` : '',
      opciones: [
        { valor: 'mapa', texto: '🗺️ Tocar en el mapa', detalle: 'Se busca la puerta y se toca' },
        { valor: 'enlace', texto: '🔗 Pegar el enlace de Google Maps',
          detalle: 'El que da «Compartir» en el celular, corto o largo' },
        ...(tiene ? [{ valor: 'quitar', texto: 'Quitar la ubicación', peligro: true }] : [])
      ]
    });
    if (!como) return;

    let punto = null;
    if (como === 'quitar') {
      punto = { lat: '', lon: '' };
    } else if (como === 'mapa') {
      punto = await elegirEnMapa({ titulo: `¿Dónde está ${c.nombre}?`,
                                   lat: c.latitud, lon: c.longitud });
      if (!punto) return;
    } else {
      const texto = await pedirTexto({
        titulo: 'El enlace de Google Maps',
        texto: 'Pega el que da «Compartir» en el celular. Sirve el corto (maps.app.goo.gl) ' +
               'y el largo. También las coordenadas tal cual: 21.0167, -89.8744',
        marcador: 'https://maps.app.goo.gl/…', unaLinea: true, largo: 600
      });
      if (!texto) return;
      avisar('Leyendo el enlace…', '');
      punto = await ubicacionDe(texto);
      if (!punto) {
        return avisar('De ahí no salieron coordenadas. Prueba con «Tocar en el mapa».', 'error');
      }
    }

    try {
      await api.actualizar(`/clientes/${c.id}`, { latitud: punto.lat, longitud: punto.lon });
      avisar(como === 'quitar' ? 'Ubicación quitada' : 'Ubicación guardada', 'bien');
      await abrir(c.id);
    } catch (e) { avisar(e.message, 'error'); }
  }

  // ==========================================================
  // ACCIONES
  // ==========================================================
  async function nuevoCliente() {
    const nombre = await pedirTexto({
      titulo: 'Nuevo cliente',
      texto: 'Solo a los clientes dados de alta se les puede dar crédito.',
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

  /**
   * PONERLE SU LOGO.
   *
   * El tope se comprueba aquí antes de mandarla: una foto de celular de
   * hoy pesa cinco megas, y esperar a que suba para que el servidor la
   * rechace es esperar por nada.
   */
  async function ponerFoto(entrada) {
    const f = entrada.files?.[0];
    if (!f || !ficha) return;
    if (f.size > 2 * 1024 * 1024) {
      entrada.value = '';
      return avisar(`Esa imagen pesa ${Math.round(f.size / 1024)} KB y el máximo son 2 MB. `
        + 'Con una foto más chica basta: se ve en un círculo.', 'error');
    }
    try {
      const archivo = await new Promise((resolver, rechazar) => {
        const lector = new FileReader();
        lector.onload = () => resolver(lector.result);
        lector.onerror = () => rechazar(new Error('No se pudo leer la imagen.'));
        lector.readAsDataURL(f);
      });
      await api.enviar(`/clientes/${ficha.cliente.id}/foto`, { archivo });
      avisar('Logo guardado', 'bien');
      await abrir(ficha.cliente.id);
      await cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function borrarFoto() {
    if (!ficha) return;
    if (!await confirmar({
      titulo: 'Quitar el logo',
      texto: `${ficha.cliente.negocio || ficha.cliente.nombre} se queda con la `
             + 'inicial de su nombre. Se le puede volver a poner cuando sea.',
      ok: 'Quitar'
    })) return;
    try {
      await api.borrar(`/clientes/${ficha.cliente.id}/foto`);
      await abrir(ficha.cliente.id);
      await cargar();
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
      marcador: c.estado.saldo > 0 ? paraEditar(c.estado.saldo) : '100',
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
      texto: 'Deja de salir en la caja y ya no se le puede dar crédito. Sus tickets viejos ' +
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

  /**
   * ELIMINAR UN CLIENTE.
   *
   * Solo al que nunca tuvo movimientos: el que se dio de alta dos veces, el
   * que se escribió mal. En cuanto alguien se llevó algo fiado, su nombre
   * está en tickets ya cobrados y eso no se borra.
   */
  async function eliminarCliente() {
    const c = ficha.cliente;
    if (!await confirmar({
      titulo: `¿Eliminar a ${c.nombre}?`,
      texto: 'Se borra de verdad, no se puede recuperar. Solo se puede si nunca ' +
             'se llevó nada a crédito ni dejó un abono.',
      ok: 'Sí, eliminar', peligro: true
    })) return;

    try {
      await api.borrar(`/clientes/${c.id}`, {});
    } catch (e) {
      if (!e.requiereContrasena) { avisar(e.message, 'error'); return; }
      const clave = await pedirContrasena({
        titulo: `Eliminar a ${c.nombre}`,
        texto: 'Borrar no se deshace, así que va con la contraseña del administrador.',
        administradores: e.administradores || [], ok: 'Eliminar'
      });
      if (!clave) return;
      try {
        await api.borrar(`/clientes/${c.id}`, { autorizacion: clave });
      } catch (err) { avisar(err.message, 'error'); return; }
    }

    avisar(`${c.nombre} eliminado`, 'bien');
    seleccionado = null; ficha = null;
    await cargar();
  }

  async function darDeAlta() {
    try {
      await api.enviar(`/clientes/${ficha.cliente.id}/alta`, {});
      avisar('Cliente activo otra vez', 'bien');
      await cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }
}
