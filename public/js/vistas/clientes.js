/**
 * CLIENTES Y CRÉDITO  (v1.6 · rediseñada en la v6.9 con el diseño del dueño)
 *
 * "Por fin terminé el diseño que quiero para clientes."
 *
 * Tres pantallas, y las tres viven en este archivo porque son la misma
 * cosa vista de tres distancias:
 *
 *   LA CARTERA   Los cuatro números de arriba —padrón, crédito, saldo por
 *                cobrar, altas del mes—, las pestañas por línea, la TABLA
 *                de clientes y, al lado, la ficha del que se toque.
 *   SU FICHA     Quién es, sus tarifas acordadas, sus garrafones, lo que
 *                debe, y los botones de lo que se hace con él.
 *   EL ALTA      Una pantalla entera, no un cuadrito: dar de alta a un
 *                cliente de mayoreo es capturar sus datos fiscales, su
 *                ventana de recepción, sus tarifas y sus envases, y eso no
 *                cabe en un diálogo de una línea.
 *
 * POR QUÉ UNA TABLA Y NO LA LISTA DE ANTES.
 *
 * La lista de antes era un renglón por cliente con su nombre y su saldo, y
 * para eso servía. Pero las preguntas de todos los días son «¿a quién le
 * toca hoy?», «¿cuánto se lleva?» y «¿quién me debe más?», y ésas se
 * contestan comparando columnas — no leyendo veinte renglones seguidos.
 *
 * LO QUE NO CAMBIÓ, y no cambia: el cliente es UNO. Una deuda, un límite,
 * una historia. Las pestañas son un filtro sobre la misma lista y no tres
 * carteras distintas (v5.4).
 */
import { api } from '../api.js';
import { esc, avisar, fecha as formatoFecha, soloDia, colorDe } from '../util.js';
import { pedirTexto, pedirImporte, confirmar, menu, pedirContrasena } from '../dialogo.js';
import { pesos, paraEditar } from '../fracciones.js';
import { enlaceMaps } from '../mapa.js';
import { ubicacionDe, elegirEnMapa } from '../ubicacion.js';

/**
 * LAS PESTAÑAS  (v5.4, con los nombres del dueño en la v6.9)
 *
 * Son un FILTRO sobre la misma lista, no listas distintas. El que compra
 * las tres cosas sale en las tres, que es lo que hace falta cuando se
 * prepara cada reparto.
 *
 * VA AQUÍ FUERA, Y NO DENTRO DE LA VISTA, A PROPÓSITO: la vista arranca
 * con un `await cargar()` que pinta, y pintar usa esta lista. Declarada
 * más abajo dentro de la función, la pantalla sale en blanco con "Cannot
 * access LINEAS before initialization", que no le dice nada a nadie.
 */
const LINEAS = [
  { clave: '', nombre: 'Todos', emoji: '👥', cuenta: 'todos' },
  { clave: 'marqueta', nombre: 'Mayoristas de marquetas', emoji: '🧊', cuenta: 'marqueta' },
  { clave: 'bolsa', nombre: 'Reparto de bolsas', emoji: '🧊', cuenta: 'bolsa' },
  { clave: 'agua', nombre: 'Clientes de agua', emoji: '💧', cuenta: 'agua' },
  // LOS DE SIEMPRE Y LOS DE UNA VEZ  (v6.4): sale de los tickets, no de
  // una marca. Un filtro más, no otra lista.
  { clave: 'frecuente', nombre: 'De siempre', emoji: '⭐', cuenta: 'frecuentes', tipo: 'ritmo' },
  { clave: 'ocasional', nombre: 'Clientes eventuales', emoji: '🕓', cuenta: 'ocasionales', tipo: 'ritmo' }
];

/** Cómo se ordena la tabla. El saldo primero: es la pregunta del día de cobrar. */
const ORDENES = [
  { clave: 'saldo', nombre: 'Saldo mayor' },
  { clave: 'consumo', nombre: 'Más consumo' },
  { clave: 'nombre', nombre: 'Por nombre' },
  { clave: 'reciente', nombre: 'Compró hace poco' }
];

export async function vistaClientes(pantalla, estadoApp) {
  const puede = (p) => estadoApp.permisos.includes('*') || estadoApp.permisos.includes(p);
  const administra = puede('clientes.administrar');
  const cobra = puede('credito.cobrar');
  const corrige = puede('venta.cancelar');
  const tomaPedidos = puede('pedidos.tomar');
  // Prestar una nevera es firmar un contrato y comprometer un fierro de
  // veinte mil pesos: se pide el mismo permiso que en «Las neveras».
  const prestaNeveras = puede('neveras.administrar');
  // Borrar de verdad es solo del administrador.
  const esAdmin = estadoApp.permisos.includes('*');

  let datos = { clientes: [], cartera: null, listas: [] };
  let listas = [];              // las listas de mayoreo que se pueden asignar
  let laNormal = null;          // cómo se llama la lista de mayoreo de siempre
  let catalogos = { frecuencias: [], metodosPago: [], regimenes: [] };
  let ficha = null;             // { cliente, cuenta, precios, garrafones }
  let seleccionado = null;      // id
  let soloDeben = false;
  let verBajas = false;
  let busca = '';
  let linea = '';               // la pestaña: '' son todos
  let orden = 'saldo';
  let pestanaFicha = 'cuenta';  // dentro de la ficha: cuenta · datos · tarifas
  // Cuando esto tiene algo, se está viendo la pantalla de alta y no la
  // cartera. Guarda lo que se lleva capturado, para que cambiar de sección
  // no lo borre.
  let alta = null;

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
    catalogos = {
      frecuencias: datos.frecuencias || [],
      metodosPago: datos.metodosPago || [],
      regimenes: datos.regimenes || []
    };

    if (seleccionado && !datos.clientes.some((c) => c.id === seleccionado)) {
      // Sigue existiendo, solo que el filtro lo escondió: se deselecciona
      // para no dejar una ficha abierta sin su renglón en la tabla.
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
    if (alta) return pintarAlta();

    pantalla.innerHTML = `
      <div class="cli-pantalla ancho-completo">
        ${tarjetasCartera()}

        <div class="cli-titulo">
          <div>
            <h2>Cartera de Clientes y Cuentas</h2>
            <p class="ayuda">
              Lo que gana cada quien de precio, lo que trae en envases y lo
              que debe. Un cliente, una cuenta.
            </p>
          </div>
          <div class="cli-titulo-acciones">
            <input id="busca" class="buscador" autocomplete="off"
                   placeholder="Razón social, nombre comercial, teléfono…"
                   value="${esc(busca)}">
            ${administra ? `
              <button id="nuevo">＋ Registrar nuevo cliente</button>` : ''}
          </div>
        </div>

        ${pestanas()}

        <div class="cli-tablero">
          <section class="cli-padron">
            <div class="cli-padron-cabeza">
              <h3>Padrón de entregas y crédito
                <small>${datos.clientes.length} de ${datos.porLinea?.todos ?? 0} listados</small>
              </h3>
              <div class="cli-padron-filtros">
                <button class="secundario chico ${soloDeben ? 'activo' : ''}" id="solo-deben">
                  ${soloDeben ? 'Ver todos' : 'Solo los que deben'}
                </button>
                ${administra ? `
                  <button class="secundario chico ${verBajas ? 'activo' : ''}" id="ver-bajas">
                    ${verBajas ? 'Ocultar bajas' : 'Ver bajas'}
                  </button>` : ''}
                <label class="cli-orden">
                  <span>Ordenar</span>
                  <select id="orden">
                    ${ORDENES.map((o) => `
                      <option value="${o.clave}" ${orden === o.clave ? 'selected' : ''}>
                        ${esc(o.nombre)}
                      </option>`).join('')}
                  </select>
                </label>
              </div>
            </div>

            ${datos.clientes.length ? `
              <div class="cli-tabla-marco">
                <table class="cli-tabla">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Cliente / razón social</th>
                      <th>Contacto y zona</th>
                      <th>Frecuencia</th>
                      <th class="der">Consumo 30 d</th>
                      <th class="der">Saldo</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${ordenados().map(renglon).join('')}
                  </tbody>
                </table>
              </div>` : `
              <p class="vacio" style="padding:32px 0">${
                busca ? 'Nadie con eso.'
                : linea ? `Nadie en «${esc(LINEAS.find((l) => l.clave === linea).nombre)}» todavía.`
                : 'Todavía no hay clientes.'}</p>`}
          </section>

          <aside class="cli-ficha" id="detalle">
            ${panelDerecho()}
          </aside>
        </div>
      </div>`;

    enganchar();
  }

  /**
   * LOS CUATRO NÚMEROS DE ARRIBA.
   *
   * Cada uno con su renglón chico debajo: un número solo no dice nada.
   * "84 cuentas con crédito" no significa lo mismo si son 84 de 100 que si
   * son 84 de 342, y el que va a decidir si abre otra línea necesita el de
   * abajo tanto como el de arriba.
   */
  function tarjetasCartera() {
    const c = datos.cartera;
    if (!c) return '';

    const variacion = c.variacionNuevos;
    const tarjetas = [
      { icono: '👥', titulo: 'Padrón comercial', valor: String(c.clientes),
        pie: `${c.operativos}% de cuentas operativas`,
        nota: 'Cartera total en planta y rutas' },
      { icono: '💳', titulo: 'Cuentas con crédito',
        valor: `${c.conCredito}<small> / ${c.clientes}</small>`,
        pie: c.conCredito ? 'Con límite o plazo puesto' : 'Ninguna todavía',
        nota: 'Líneas de crédito autorizadas' },
      { icono: '💰', titulo: 'Saldo por cobrar',
        valor: `${pesos(c.enLaCalle)}<small> MXN</small>`,
        pie: `${c.alCorriente}% dentro del plazo`,
        nota: c.vencidos
          ? `${c.vencidos} vencido${c.vencidos === 1 ? '' : 's'} · ${pesos(c.vencidoCentavos)}`
          : 'Nada vencido',
        mal: c.vencidos > 0 },
      { icono: '📈', titulo: 'Nuevos clientes (30 d)', valor: `+${c.nuevosMes}`,
        pie: variacion === null ? 'Sin mes anterior con que comparar'
          : `${variacion >= 0 ? '↗' : '↘'} ${Math.abs(variacion)}% contra el mes previo`,
        nota: 'Altas del padrón' }
    ];

    return `
      <div class="cli-kpis">
        ${tarjetas.map((t) => `
          <div class="cli-kpi ${t.mal ? 'kpi-mal' : ''}">
            <div class="cli-kpi-cabeza">
              <span class="cli-kpi-titulo">${esc(t.titulo)}</span>
              <span class="cli-kpi-icono">${t.icono}</span>
            </div>
            <strong class="cli-kpi-valor">${t.valor}</strong>
            <span class="cli-kpi-pie">${esc(t.pie)}</span>
            <span class="cli-kpi-nota">${esc(t.nota)}</span>
          </div>`).join('')}
      </div>`;
  }

  function pestanas() {
    const n = datos.porLinea || {};
    return `
      <div class="cli-pestanas">
        ${LINEAS.map((l) => `
          <button class="cli-pestana ${linea === l.clave ? 'activa' : ''}"
                  data-linea="${l.clave}" title="${esc(l.nombre)}">
            <span>${l.emoji} ${esc(l.nombre)}</span>
            <small>${n[l.cuenta] ?? 0}</small>
          </button>`).join('')}
      </div>`;
  }

  /** La tabla ordenada por lo que se haya pedido arriba. */
  function ordenados() {
    const lista = [...datos.clientes];
    if (orden === 'saldo') lista.sort((a, b) => b.estado.saldo - a.estado.saldo);
    else if (orden === 'consumo') {
      lista.sort((a, b) => b.estado.consumo.kilos - a.estado.consumo.kilos);
    } else if (orden === 'reciente') {
      lista.sort((a, b) => (a.estado.ritmo.diasSinComprar ?? 9999)
                         - (b.estado.ritmo.diasSinComprar ?? 9999));
    } else lista.sort((a, b) => (a.negocio || a.nombre).localeCompare(b.negocio || b.nombre));
    return lista;
  }

  /**
   * LA CARA DEL CLIENTE.
   *
   * Su logo si lo subió; si no, la inicial en un círculo de color. El
   * color NO es al azar: sale de las letras del propio nombre, así que
   * "Abarrotes Doña Mary" es siempre del mismo color y eso es justo lo que
   * la hace útil para reconocerla de reojo.
   */
  function avatar(c, clase = '') {
    if (c.foto) {
      return `<img class="cli-cara ${clase}" src="/fotos/${esc(c.foto)}"
                   alt="${esc(c.nombre)}">`;
    }
    const texto = (c.negocio || c.nombre || '?').trim();
    return `<span class="cli-cara cli-inicial ${clase}"
                  style="background:${colorDe(texto)}">${esc(inicialesDe(texto))}</span>`;
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

  /** Cómo se llama la frecuencia acordada, cortita para la tabla. */
  function frecuenciaCorta(clave) {
    return catalogos.frecuencias.find((f) => f.clave === clave)?.corto || null;
  }

  /** "2,850 kg · +15 garraf." — lo que se lleva al mes. */
  function textoConsumo(k) {
    const partes = [];
    if (k.kilos) partes.push(`${k.kilos.toLocaleString('es-MX')} kg`);
    if (k.garrafones) partes.push(`+${k.garrafones} garraf.`);
    return partes.length ? partes : ['—'];
  }

  function renglon(c) {
    const e = c.estado;
    const frec = frecuenciaCorta(c.frecuencia);
    const consumo = textoConsumo(e.consumo);

    return `
      <tr class="cli-fila ${seleccionado === c.id ? 'activa' : ''} ${c.activo ? '' : 'de-baja'}"
          data-cliente="${esc(c.id)}">
        <td class="cli-codigo">#CLI-${String(c.numero ?? 0).padStart(3, '0')}</td>

        <td>
          <div class="cli-quien-celda">
            ${avatar(c)}
            <span>
              <strong>${esc(c.negocio || c.nombre)}</strong>
              <small>${esc(c.giro || c.razon_social || (c.negocio ? c.nombre : '')
                || 'sin razón social')}${c.rfc ? ` · RFC: ${esc(c.rfc)}` : ''}</small>
            </span>
          </div>
        </td>

        <td>
          ${esc(c.nombre)}
          <small>${esc(c.zona || c.direccion || 'sin zona')}</small>
        </td>

        <td>
          ${frec
            ? `<span class="cli-chip">${esc(frec)}</span>`
            : `<span class="cli-chip suave">${e.ritmo.frecuente ? 'De siempre' : 'Eventual'}</span>`}
        </td>

        <td class="der cli-consumo">
          <strong>${esc(consumo[0])}</strong>
          ${consumo[1] ? `<small>${esc(consumo[1])}</small>` : ''}
        </td>

        <td class="der cli-saldo-celda ${e.vencido ? 'vencido' : e.saldo > 0 ? 'debe' : ''}">
          ${e.saldo > 0 ? `<strong>${pesos(e.saldo)}</strong>` : ''}
          ${e.saldo > 0
            ? `<small>${e.vencido ? 'vencido' : 'en plazo'}</small>`
            : e.saldo < 0 ? '<strong>a favor</strong>' : '<span class="cli-ok">Al corriente</span>'}
        </td>

        <td>
          <span class="cli-estado ${c.activo ? 'si' : 'no'}">
            ${c.activo ? '● Activo' : '● De baja'}
          </span>
        </td>

        <td class="cli-acciones-celda">
          ${tomaPedidos && c.activo ? `
            <button class="cli-accion" data-pedido="${esc(c.id)}"
                    title="Levantar un pedido para este cliente">🚚</button>` : ''}
          <button class="cli-accion" data-cliente-ver="${esc(c.id)}" title="Ver su ficha">›</button>
        </td>
      </tr>`;
  }

  function panelDerecho() {
    if (!ficha) {
      return `
        <div class="cli-ficha-vacia">
          <span>👤</span>
          <p>Toca un cliente para ver su cuenta, sus tarifas y sus envases.</p>
        </div>`;
    }
    return panelCliente(ficha.cliente, ficha.cuenta);
  }

  // ==========================================================
  // CAMPOS QUE SE EDITAN EN EL SITIO
  //
  // La etiqueta va ARRIBA y el campo debajo, en rejilla, y nada se guarda
  // hasta que se toca Guardar: así se rellena la ficha de corrido —como se
  // rellena un papel— y la pantalla no se repinta a cada campo, que era el
  // parpadeo. `data-inicial` es lo que decía al abrirla: con eso se sabe
  // qué cambió y qué mandar.
  // ==========================================================
  function campo(etiqueta, clave, valor, { ayuda = '', marcador = '', ancho = false,
                                           largo = false, tipo = 'text',
                                           opciones = null, editable = administra } = {}) {
    const v = valor === null || valor === undefined ? '' : String(valor);

    if (!editable) {
      const texto = opciones
        ? (opciones.find((o) => o.clave === v)?.nombre || v)
        : v;
      return `
        <div class="cli-campo ${ancho ? 'ancho' : ''}">
          <span class="etiqueta-chica">${esc(etiqueta)}</span>
          <strong>${esc(texto === '' ? '—' : texto)}</strong>
        </div>`;
    }

    const cuerpo = opciones
      ? `<select data-campo="${esc(clave)}" data-inicial="${esc(v)}">
           <option value="">${esc(marcador || 'Sin definir')}</option>
           ${opciones.map((o) => `
             <option value="${esc(o.clave)}" ${o.clave === v ? 'selected' : ''}>
               ${esc(o.nombre)}
             </option>`).join('')}
         </select>`
      : largo
        ? `<textarea data-campo="${esc(clave)}" data-inicial="${esc(v)}" rows="2"
                     placeholder="${esc(marcador)}">${esc(v)}</textarea>`
        : `<input type="${tipo}" data-campo="${esc(clave)}" data-inicial="${esc(v)}"
                  value="${esc(v)}" placeholder="${esc(marcador)}" autocomplete="off">`;

    return `
      <label class="cli-campo ${ancho ? 'ancho' : ''}">
        <span class="etiqueta-chica">${esc(etiqueta)}${
          ayuda ? `<small>${esc(ayuda)}</small>` : ''}</span>
        ${cuerpo}
      </label>`;
  }

  // ==========================================================
  // LA FICHA
  // ==========================================================
  function panelCliente(c, cuenta) {
    const e = c.estado;
    // El teléfono, listo para marcarlo de un toque desde la tablet: es lo
    // primero que uno busca aquí cuando alguien debe.
    const tel = String(c.telefono || '').replace(/[^\d+]/g, '');
    const g = ficha.garrafones || { retenidos: 0 };

    return `
      <div class="cli-ficha-cabeza">
        <div class="cli-retrato">
          ${avatar(c, 'grande')}
          ${administra ? `
            <label class="cli-cambiar-foto" for="foto-cliente"
                   title="${c.foto ? 'Cambiar el logo' : 'Ponerle su logo'}">
              📷
              <input type="file" id="foto-cliente" accept="image/*" hidden>
            </label>
            ${c.foto ? '<button class="cli-quitar-foto" id="quitar-foto" title="Quitar el logo">×</button>' : ''}
          ` : ''}
        </div>

        <div class="cli-quien">
          <p class="cli-codigo-ficha">
            #CLI-${String(c.numero ?? 0).padStart(3, '0')}
            ${c.zona ? `<span class="cli-chip suave">${esc(c.zona)}</span>` : ''}
          </p>
          <h3>${esc(c.negocio || c.nombre)}</h3>
          <div class="cli-etiquetas">
            ${c.activo ? '' : '<span class="etiqueta baja">Dado de baja</span>'}
            ${e.ritmo?.frecuente ? '<span class="etiqueta mayoreo">⭐ De siempre</span>' : ''}
            ${c.lista ? `<span class="etiqueta mayoreo">🏷️ ${esc(c.lista.nombre)}</span>` : ''}
            ${e.vencido ? '<span class="etiqueta-mal">Se le pasó el plazo</span>' : ''}
            ${g.pasado ? '<span class="etiqueta-mal">Trae garrafones de más</span>' : ''}
          </div>
        </div>
      </div>

      <div class="cli-datos-clave">
        ${[
          ['Giro', c.giro || '—'],
          ['Razón social', c.razon_social || '—'],
          ['RFC', c.rfc || '—'],
          ['Contacto clave', c.nombre],
          ['Teléfono directo', tel
            ? `<a href="tel:${esc(tel)}">${esc(c.telefono)}</a>` : '—'],
          ['Dirección de entrega', c.direccion || '—']
        ].map(([k, v]) => `
          <div class="cli-dato-clave">
            <span>${esc(k)}</span><strong>${k === 'Teléfono directo' ? v : esc(v)}</strong>
          </div>`).join('')}
      </div>

      ${c.zona || c.hora_desde || c.horario_entrega ? `
        <p class="cli-ventana">
          📍 ${esc(c.zona || 'Sin zona')}
          ${c.hora_desde && c.hora_hasta
            ? ` · Ventana: ${esc(c.hora_desde)} a ${esc(c.hora_hasta)} hrs` : ''}
          ${c.horario_entrega ? `<small>${esc(c.horario_entrega)}</small>` : ''}
        </p>` : ''}

      <div class="cli-pestanas cli-pestanas-ficha">
        ${[['cuenta', '💳 Cuenta'], ['tarifas', '🏷️ Tarifas'], ['datos', '✏️ Datos']]
          .map(([clave, texto]) => `
            <button class="cli-pestana ${pestanaFicha === clave ? 'activa' : ''}"
                    data-ficha-p="${clave}"><span>${texto}</span></button>`).join('')}
      </div>

      ${pestanaFicha === 'cuenta' ? panelSuCuenta(c, cuenta)
        : pestanaFicha === 'tarifas' ? panelTarifas(c)
        : panelSusDatos(c)}`;
  }

  /** Lo que debe, lo que ha pagado y qué se ha llevado. */
  function panelSuCuenta(c, cuenta) {
    const e = c.estado;
    const r = e.ritmo;

    return `
      <div class="cli-saldo-panel ${e.vencido ? 'vencido' : e.saldo > 0 ? 'debe' : 'al-corriente'}">
        <div>
          <span>${e.saldo > 0 ? 'Saldo pendiente de cobro'
                : e.saldo < 0 ? 'Tiene a favor' : 'No debe nada'}</span>
          <strong>${pesos(Math.abs(e.saldo))}<small> MXN</small></strong>
          ${e.saldo > 0 && e.diasDebiendo
            ? `<small>debiendo desde hace ${e.diasDebiendo} día${e.diasDebiendo === 1 ? '' : 's'}${
                c.dias_plazo ? ` · su plazo son ${c.dias_plazo}` : ''}</small>` : ''}
        </div>
      </div>

      ${e.vencido ? `
        <div class="aviso-sin-caja" style="margin:12px 0">
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

      <div class="cli-botonera">
        ${tomaPedidos && c.activo ? `
          <button id="levantar-pedido">⚡ Levantar pedido</button>` : ''}
        ${cobra && c.activo ? `
          <button class="pos-btn-entrada chico" id="abonar">＋ Recibir abono</button>
          <button class="secundario chico" id="abonar-transf">Abono por transferencia</button>` : ''}
      </div>

      <!-- QUÉ LE COMPRA Y CADA CUÁNTO. Las dos se marcan solas con lo que
           va comprando, y lo único que hacen es decidir en qué pestaña de
           arriba sale. -->
      <div class="cli-solo">
        <p class="ayuda cli-compra">
          ${[c.compra_marqueta && '🧊 marquetas', c.compra_bolsa && '🧊 bolsas', c.compra_agua && '💧 agua']
            .filter(Boolean).join(' · ') || 'Todavía no le ha comprado nada'}
          <small>· se marca solo con lo que compra</small>
        </p>
        ${r ? `
          <p class="ayuda cli-compra">
            ${r.frecuente ? '⭐ <b>De siempre</b>' : '🕓 <b>Eventual</b>'} · ${textoRitmo(r)}
            ${c.frecuencia ? ` · quedó en <b>${esc(frecuenciaCorta(c.frecuencia))}</b>` : ''}
            <small>· es «de siempre» con ${r.tope} tickets o más en 30 días</small>
          </p>` : ''}
        <p class="ayuda cli-compra">
          📦 Se lleva <b>${textoConsumo(e.consumo).join(' · ')}</b> en 30 días
          <small>· ${e.consumo.tickets} ticket${e.consumo.tickets === 1 ? '' : 's'}</small>
        </p>
      </div>

      <h4 class="cfg-subtitulo">Lo que se ha llevado y lo que ha pagado</h4>
      ${cuenta.length ? `
        <table class="venta-lineas cuenta-corriente">
          ${cuenta.map(renglonCuenta).join('')}
        </table>` : '<p class="ayuda">Todavía no se ha llevado nada a crédito.</p>'}`;
  }

  /**
   * SUS TARIFAS Y SUS ENVASES  (v6.9)
   *
   * "Personalice los precios directos acordados para este cliente."
   *
   * El precio propio gana a la lista de mayoreo y al mostrador: es el
   * trato más particular que hay. Al lado va el de lista, porque un precio
   * acordado sin el de lista al lado no dice si es un buen trato o un
   * regalo — y sobre todo no dice cuándo se quedó regalado.
   */
  function panelTarifas(c) {
    const precios = ficha.precios || [];
    const g = ficha.garrafones || { retenidos: 0 };

    return `
      <div class="cli-seccion-cabeza">
        <h4 class="cfg-subtitulo">Tarifas preferenciales acordadas</h4>
        ${administra ? '<button class="enlace" id="editar-precios">Editar precios</button>' : ''}
      </div>

      ${precios.length ? `
        <table class="tabla cli-tarifas">
          <tr><th>Producto</th><th class="der">Lista</th>
              <th class="der">Acordada</th><th class="der">Dif.</th></tr>
          ${precios.map((p) => `
            <tr class="${p.producto_activo ? '' : 'anulada'}">
              <td>
                <strong>${esc(p.producto_nombre)}</strong>
                <small>${esc(p.codigo || '—')}${p.volumen ? ` · ${esc(p.volumen)}` : ''}</small>
              </td>
              <td class="der cli-tachado">${p.lista_centavos ? pesos(p.lista_centavos) : '—'}</td>
              <td class="der"><strong>${pesos(p.centavos)}</strong></td>
              <td class="der ${p.diferencia < 0 ? 'bueno' : p.diferencia > 0 ? 'malo' : ''}">
                ${p.diferencia === null ? '—' : `${p.diferencia > 0 ? '+' : ''}${p.diferencia}%`}
              </td>
            </tr>`).join('')}
        </table>
        <p class="ayuda" style="margin-top:8px">
          Estos precios <b>reemplazan</b> al de mostrador y al de su lista de
          mayoreo en cuanto se dice de quién es el ticket.
        </p>`
      : `<p class="ayuda">
           Sin precios propios: se le cobra
           ${c.lista ? `su lista «${esc(c.lista.nombre)}»` : 'el precio de mostrador'}.
           ${administra ? 'Con «Editar precios» se le pone el suyo, producto por producto.' : ''}
         </p>`}

      <h4 class="cfg-subtitulo">Comodato de garrafones</h4>
      <div class="cli-garrafones ${g.pasado ? 'pasado' : ''}">
        <div class="cli-garrafones-cuenta">
          <strong>${g.retenidos}</strong>
          <span>en préstamo${g.limite !== null ? ` · límite acordado ${g.limite}` : ''}</span>
        </div>
        ${g.limite ? `
          <div class="barra-simple">
            <span style="width:${Math.min(100, Math.round((g.retenidos / g.limite) * 100))}%"></span>
          </div>` : ''}
        ${g.depositoCentavos !== null ? `
          <p class="ayuda">
            Garantía en depósito: <b>${pesos(g.depositoCentavos)}</b>
            <small>${g.retenidos} × ${pesos(g.depositoUnitario)} c/u · va aparte del saldo:
            una garantía no es una deuda</small>
          </p>` : ''}
        ${g.pasado ? `
          <p class="ayuda malo">Trae ${g.retenidos} y se le habían autorizado ${g.limite}.</p>` : ''}
        ${cobra && c.activo ? `
          <div class="fila-botones">
            <button class="secundario chico" id="garrafones-mas">＋ Se le dejaron</button>
            <button class="secundario chico" id="garrafones-menos">− Los trajo</button>
          </div>` : ''}
      </div>

      ${g.historial?.length ? `
        <table class="tabla" style="margin-top:12px">
          <tr><th>Movimiento</th><th class="der">Cuántos</th><th></th></tr>
          ${g.historial.slice(0, 10).map((m) => `
            <tr class="${m.anulado_en ? 'anulada' : ''}">
              <td>${esc(formatoFecha(m.fecha))}
                <small>${esc(m.motivo || (m.cuantos > 0 ? 'se le dejaron' : 'los trajo'))}${
                  m.ejecutor_nombre ? ` · ${esc(m.ejecutor_nombre)}` : ''}</small></td>
              <td class="der ${m.cuantos > 0 ? 'malo' : 'bueno'}">
                ${m.cuantos > 0 ? '+' : ''}${m.cuantos}
              </td>
              <td>${cobra && !m.anulado_en ? `
                <button class="cli-accion peligro" data-anular-garrafon="${esc(m.id)}"
                        aria-label="Anular este movimiento">×</button>` : ''}</td>
            </tr>`).join('')}
        </table>` : ''}

      ${panelNeveras(c)}`;
  }

  /**
   * LAS NEVERAS QUE TIENE PRESTADAS  (v6.9.1)
   *
   * "Falta poder asignarles igual una nevera de bolsas de hielo."
   *
   * La nevera se presta desde aquí, pero el comodato sigue viviendo en
   * «Las neveras»: es un fierro con número de serie, su contrato, su
   * historia de servicios y sus cortesías. Lo que se hace aquí es el
   * atajo que faltaba —estás en la ficha del cliente, se la entregas— y
   * los datos del préstamo salen de la propia ficha: su dirección, su
   * contacto y su ubicación, que ya están capturados.
   *
   * Recogerla y todo lo demás se sigue haciendo allá, con las reglas que
   * saben que una nevera prestada no se presta dos veces.
   */
  function panelNeveras(c) {
    const suyas = ficha.neveras || [];

    return `
      <div class="cli-seccion-cabeza">
        <h4 class="cfg-subtitulo">Neveras en comodato</h4>
        ${prestaNeveras && c.activo
          ? '<button class="enlace" id="prestar-nevera">Entregarle una</button>' : ''}
      </div>

      ${suyas.length ? `
        <div class="cli-neveras">
          ${suyas.map((n) => `
            <div class="cli-nevera">
              <span class="cli-nevera-icono">❄️</span>
              <span class="crece">
                <strong>Nevera ${esc(n.numero)}</strong>
                <small>${esc([n.marca, n.modelo].filter(Boolean).join(' ')
                  || 'sin marca')}${n.bolsas ? ` · ${n.bolsas} bolsas` : ''}${
                  n.serie ? ` · serie ${esc(n.serie)}` : ''}</small>
                <small>Desde ${esc(soloDia(n.desde, { conAnio: true }))}${
                  n.hasta_previsto ? ` · se recoge el ${esc(soloDia(n.hasta_previsto))}` : ''}</small>
              </span>
              <a class="cli-accion" href="#/neveras?nevera=${esc(n.nevera_id)}"
                 title="Abrirla en Las neveras">›</a>
            </div>`).join('')}
        </div>
        <p class="ayuda" style="margin-top:8px">
          Para recogerla, cambiarle los datos o sacar su contrato, se abre en
          <b>Las neveras</b>: ahí está su historia completa.
        </p>`
      : `<p class="ayuda">
           No tiene ninguna nevera de la fábrica.
           ${prestaNeveras && c.activo ? 'Con «Entregarle una» se le presta.' : ''}
         </p>`}`;
  }

  /**
   * SUS DATOS, en rejilla y con un solo Guardar abajo.
   *
   * Nada se manda hasta que se toca el botón: así se rellena la ficha
   * entera de corrido y la pantalla no se repinta a cada campo.
   */
  function panelSusDatos(c) {
    return `
      <form id="cli-form" class="cli-form" autocomplete="off">
        <h4 class="cfg-subtitulo">Información comercial y fiscal</h4>
        <div class="cli-campos">
          ${campo('Nombre comercial o rótulo', 'negocio', c.negocio,
                  { marcador: 'Mariscos El Faro' })}
          ${campo('Giro', 'giro', c.giro,
                  { marcador: 'Horeca / Cadena Puerto',
                    ayuda: 'a qué se dedica; sale en la lista de pedidos' })}
          ${campo('Razón social fiscal', 'razonSocial', c.razon_social,
                  { marcador: 'OPERADORA GASTRONÓMICA S.A. DE C.V.' })}
          ${campo('RFC', 'rfc', c.rfc, { marcador: 'OGL180422K98' })}
          ${campo('Régimen fiscal', 'regimenFiscal', c.regimen_fiscal,
                  { opciones: catalogos.regimenes, marcador: 'Sin régimen' })}
          ${campo('Encargado de compras', 'nombre', c.nombre,
                  { ayuda: 'con quién se trata', marcador: 'Cap. Mateo Villanueva' })}
          ${campo('Teléfono (WhatsApp del chofer)', 'telefono', c.telefono,
                  { marcador: '999 123 4567' })}
          ${campo('Correo de facturación', 'correo', c.correo,
                  { ancho: true, tipo: 'email', marcador: 'facturas@sunegocio.com.mx',
                    ayuda: 'el sistema no factura: es para pasárselo a quien factura' })}
        </div>

        <h4 class="cfg-subtitulo">Reparto y descarga</h4>
        <div class="cli-campos">
          ${campo('Dirección de entrega', 'direccion', c.direccion, { ancho: true })}
          ${campo('Zona o sector', 'zona', c.zona, { marcador: 'Zona Costa (Muelle 4)' })}
          ${campo('Frecuencia acordada', 'frecuencia', c.frecuencia,
                  { opciones: catalogos.frecuencias, marcador: 'Sin acordar' })}
          ${campo('Recibe desde', 'horaDesde', c.hora_desde, { tipo: 'time' })}
          ${campo('Recibe hasta', 'horaHasta', c.hora_hasta, { tipo: 'time' })}
          ${campo('Horario, con sus rarezas', 'horarioEntrega', c.horario_entrega,
                  { ancho: true, marcador: 'de 8 a 2 y de 5 a 8, los domingos no abre',
                    ayuda: 'lo que no cabe en dos horas de reloj' })}
          ${campo('Referencias', 'referencias', c.referencias,
                  { ancho: true, marcador: 'La de la puerta azul, junto a la tortillería',
                    ayuda: 'lo que hace que se encuentre la puerta' })}
          ${campo('Instrucciones de descarga', 'instrucciones', c.instrucciones,
                  { ancho: true, largo: true,
                    marcador: 'Entrar por la rampa trasera. Llenar el congelador del muelle. ' +
                              'Pedir firma a Don Arturo.',
                    ayuda: 'qué se hace al llegar; sale en su nota de entrega' })}
        </div>

        <div class="cli-ubicacion">
          <span class="ayuda">
            📍 ${c.latitud != null
              ? `Con ubicación puesta: ${Number(c.latitud).toFixed(5)}, ${Number(c.longitud).toFixed(5)}`
              : 'Sin ubicación. Es la que lleva el QR de su nota de entrega.'}
          </span>
          ${administra ? `
            <span class="fila-botones">
              <button type="button" class="secundario chico" id="ubicacion">
                ${c.latitud != null ? 'Cambiar' : 'Ponerla'}
              </button>
              ${c.latitud != null ? `
                <a class="boton-enlace chico" target="_blank" rel="noopener"
                   href="${enlaceMaps(c.latitud, c.longitud, c.nombre)}">Ver en el mapa</a>` : ''}
            </span>` : ''}
        </div>

        <h4 class="cfg-subtitulo">Esquema de pago y plazo</h4>
        <div class="cli-campos">
          ${campo('Método autorizado', 'metodoPago', c.metodo_pago,
                  { opciones: catalogos.metodosPago, marcador: 'Sin definir' })}
          ${campo('Días de plazo', 'diasPlazo', c.dias_plazo ?? '',
                  { ayuda: 'solo para avisar de lo vencido', marcador: 'sin plazo' })}
          ${campo('Límite de crédito', 'limite', paraEditar(c.limite_centavos),
                  { ayuda: 'vacío = sin límite', marcador: 'sin límite' })}
          ${selectorDeLista(c)}
        </div>
        ${administra ? `
          <p class="ayuda" style="margin:8px 0 0">
            Pasarse del límite <strong>no impide la venta</strong>: pide el PIN de un
            gerente y queda escrito quién lo autorizó.
          </p>` : ''}

        <h4 class="cfg-subtitulo">Envases en comodato</h4>
        <div class="cli-campos">
          ${campo('Garrafones autorizados', 'garrafonesLimite', c.garrafones_limite ?? '',
                  { ayuda: 'cuántos como máximo', marcador: 'sin límite' })}
          ${campo('Garantía por garrafón', 'garrafonDeposito',
                  paraEditar(c.garrafon_deposito_centavos),
                  { ayuda: 'lo que dejó por cada uno', marcador: '120.00' })}
        </div>

        <h4 class="cfg-subtitulo">Notas</h4>
        <div class="cli-campos">
          ${campo('Notas', 'notas', c.notas, { ancho: true, largo: true,
                  marcador: 'Lo que haga falta recordar de este cliente' })}
        </div>

        ${administra && c.activo ? `
          <div class="fila-botones" style="margin-top:18px">
            <button type="button" class="secundario chico peligro" id="baja">Dar de baja</button>
            ${esAdmin ? '<button type="button" class="secundario chico peligro" id="borrar">Eliminar</button>' : ''}
          </div>` : ''}
        ${administra && !c.activo ? `
          <div class="fila-botones" style="margin-top:18px">
            <button type="button" class="secundario chico" id="alta">Volver a dar de alta</button>
          </div>` : ''}
      </form>

      ${administra ? `
        <!-- EL BOTÓN DE GUARDAR, SIEMPRE A LA VISTA. Se queda pegado abajo
             por más que la ficha sea larga: rellenar diez campos y tener
             que buscar el botón es como se pierden datos. -->
        <div class="cli-guardar" id="cli-guardar">
          <span class="ayuda" id="cli-aviso">Nada que guardar</span>
          <button type="button" class="secundario chico" id="deshacer" disabled>Deshacer</button>
          <button type="button" id="guardar-cliente" disabled>Guardar los cambios</button>
        </div>` : ''}`;
  }

  /**
   * SU LISTA DE MAYOREO  (v1.9)
   *
   * A quien tiene lista se le cobra esa lista sola, en la caja, en cuanto
   * el cajero dice quién es. Desde la v6.9 no es lo último que manda: sus
   * precios propios producto por producto ganan a la lista.
   */
  function selectorDeLista(c) {
    const suya = c.lista_id;
    if (!administra) {
      return `
        <div class="cli-campo ancho">
          <span class="etiqueta-chica">Lista de mayoreo</span>
          <strong>${c.lista ? esc(c.lista.nombre) : (laNormal || 'el de siempre')}</strong>
        </div>`;
    }
    return `
      <label class="cli-campo ancho">
        <span class="etiqueta-chica">Lista de mayoreo<small>la base, antes de sus precios propios</small></span>
        <select data-lista data-inicial="${esc(suya || '')}">
          <option value="">${laNormal ? `El normal (${esc(laNormal)})` : 'El de siempre'}</option>
          ${listas.map((l) => `
            <option value="${esc(l.id)}" ${suya === l.id ? 'selected' : ''}>
              ${esc(l.nombre)}
            </option>`).join('')}
        </select>
        ${c.lista && !c.lista.activo
          ? '<small class="malo">esa lista se dio de baja: se le cobra público</small>' : ''}
      </label>`;
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
            <button class="cli-accion peligro" data-anular="${esc(m.id)}"
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
    if (buscador) {
      let espera;
      buscador.oninput = () => {
        clearTimeout(espera);
        espera = setTimeout(() => { busca = buscador.value.trim(); cargar(); }, 300);
      };
      buscador.onkeydown = (ev) => { if (ev.key === 'Enter') ev.preventDefault(); };
    }

    q('#solo-deben').onclick = () => { soloDeben = !soloDeben; cargar(); };
    q('#orden').onchange = (ev) => { orden = ev.target.value; pintar(); };
    pantalla.querySelectorAll('[data-linea]').forEach((b) => {
      b.onclick = () => { linea = b.dataset.linea; cargar(); };
    });
    const bajas = q('#ver-bajas');
    if (bajas) bajas.onclick = () => { verBajas = !verBajas; cargar(); };
    const nuevo = q('#nuevo');
    if (nuevo) nuevo.onclick = abrirAlta;

    pantalla.querySelectorAll('[data-cliente]').forEach((f) => {
      f.onclick = () => abrir(f.dataset.cliente);
    });
    pantalla.querySelectorAll('[data-cliente-ver]').forEach((b) => {
      b.onclick = (ev) => { ev.stopPropagation(); abrir(b.dataset.clienteVer); };
    });
    pantalla.querySelectorAll('[data-pedido]').forEach((b) => {
      b.onclick = (ev) => { ev.stopPropagation(); irAPedido(b.dataset.pedido); };
    });

    pantalla.querySelectorAll('[data-ficha-p]').forEach((b) => {
      b.onclick = () => { pestanaFicha = b.dataset.fichaP; pintar(); };
    });

    // NADA SE GUARDA SOLO. Los campos se rellenan de corrido y el botón de
    // abajo se enciende en cuanto algo cambia.
    const cambiables = [...pantalla.querySelectorAll('[data-campo], [data-lista]')];
    const revisar = () => {
      const hay = cambiables.some((el) => el.value !== (el.dataset.inicial ?? ''));
      const guardar = q('#guardar-cliente');
      const deshacer = q('#deshacer');
      const aviso = q('#cli-aviso');
      if (guardar) guardar.disabled = !hay;
      if (deshacer) deshacer.disabled = !hay;
      if (aviso) aviso.textContent = hay ? 'Hay cambios sin guardar' : 'Nada que guardar';
      q('#cli-guardar')?.classList.toggle('con-cambios', hay);
    };
    cambiables.forEach((el) => {
      el.oninput = revisar;
      el.onchange = revisar;
      // Enter guarda, como en cualquier formulario; en las notas no, que
      // ahí el Enter es un renglón nuevo.
      if (el.tagName === 'INPUT') {
        el.onkeydown = (ev) => {
          if (ev.key === 'Enter') { ev.preventDefault(); guardarFicha(); }
        };
      }
    });
    revisar();

    const guardar = q('#guardar-cliente');
    if (guardar) guardar.onclick = guardarFicha;
    const deshacer = q('#deshacer');
    if (deshacer) deshacer.onclick = () => {
      cambiables.forEach((el) => { el.value = el.dataset.inicial ?? ''; });
      revisar();
    };

    const subirFoto = q('#foto-cliente');
    if (subirFoto) subirFoto.onchange = (ev) => ponerFoto(ev.target);
    const quitarFoto = q('#quitar-foto');
    if (quitarFoto) quitarFoto.onclick = borrarFoto;

    const abonar = q('#abonar');
    if (abonar) abonar.onclick = () => recibirAbono('efectivo');
    const transf = q('#abonar-transf');
    if (transf) transf.onclick = () => recibirAbono('transferencia');
    const pedido = q('#levantar-pedido');
    if (pedido) pedido.onclick = () => irAPedido(ficha.cliente.id);

    const editarPrecios = q('#editar-precios');
    if (editarPrecios) editarPrecios.onclick = editarTarifas;
    const prestar = q('#prestar-nevera');
    if (prestar) prestar.onclick = prestarNevera;
    const gMas = q('#garrafones-mas');
    if (gMas) gMas.onclick = () => moverGarrafones(1);
    const gMenos = q('#garrafones-menos');
    if (gMenos) gMenos.onclick = () => moverGarrafones(-1);
    pantalla.querySelectorAll('[data-anular-garrafon]').forEach((b) => {
      b.onclick = () => anularGarrafon(b.dataset.anularGarrafon);
    });

    const baja = q('#baja');
    if (baja) baja.onclick = darDeBaja;
    const borrar = q('#borrar');
    if (borrar) borrar.onclick = eliminarCliente;
    const altaBtn = q('#alta');
    if (altaBtn) altaBtn.onclick = darDeAlta;

    pantalla.querySelectorAll('[data-anular]').forEach((b) => {
      b.onclick = () => anularAbono(b.dataset.anular);
    });

    const ubic = q('#ubicacion');
    if (ubic) ubic.onclick = ponerUbicacion;
  }

  // ==========================================================
  // EL ALTA: UNA PANTALLA ENTERA  (v6.9)
  // ==========================================================
  //
  // Antes el alta era una sola pregunta —el nombre— y el resto se llenaba
  // tocando la ficha. Para el cliente de mostrador eso está bien, pero
  // dar de alta a un mayorista es capturar sus datos fiscales, su ventana
  // de recepción, su esquema de pago y sus envases, y hacerlo campo por
  // campo desde la ficha es la forma más segura de que la mitad se quede
  // sin llenar.
  //
  // Lo que se captura aquí se ve ARMÁNDOSE a la derecha, en el resumen:
  // quien captura no tiene que imaginarse cómo va a quedar.

  function abrirAlta() {
    alta = {
      negocio: '', giro: '', razonSocial: '', rfc: '', regimenFiscal: '',
      nombre: '', telefono: '', correo: '',
      direccion: '', zona: '', referencias: '', instrucciones: '',
      horaDesde: '', horaHasta: '', horarioEntrega: '', frecuencia: '',
      metodoPago: '', diasPlazo: '', limite: '',
      garrafonesLimite: '', garrafonDeposito: '',
      compra_marqueta: 1, compra_bolsa: 0, compra_agua: 0
    };
    pintar();
  }

  function pintarAlta() {
    const a = alta;
    const campoA = (etiqueta, clave, opciones = {}) =>
      campo(etiqueta, clave, a[clave], { ...opciones, editable: true });

    pantalla.innerHTML = `
      <div class="cli-alta ancho-completo">
        <div class="cli-alta-cabeza">
          <div>
            <p class="cli-miga">Clientes / Cartera / Nuevo registro</p>
            <h2>Alta de nuevo cliente</h2>
            <p class="ayuda">
              Datos fiscales, ventana de recepción, esquema de pago y envases
              en comodato. Solo el nombre comercial es obligatorio: lo demás
              se puede completar después desde su ficha.
            </p>
          </div>
          <div class="fila-botones">
            <button class="secundario" id="alta-volver">‹ Volver a clientes</button>
            <button id="alta-guardar">✓ Dar de alta</button>
          </div>
        </div>

        <div class="cli-alta-cuerpo">
          <form id="alta-form" class="cli-alta-form" autocomplete="off">
            <section class="tarjeta">
              <div class="cli-seccion-cabeza">
                <h3>🏪 Información comercial y fiscal</h3>
                <span class="cli-chip suave">Obligatorio el rótulo</span>
              </div>
              <div class="cli-campos">
                ${campoA('Nombre comercial o rótulo', 'negocio',
                         { marcador: 'Mariscos El Faro Muelle Azul' })}
                ${campoA('Giro', 'giro',
                         { marcador: 'Horeca / Cadena Puerto',
                           ayuda: 'a qué se dedica' })}
                ${campoA('Razón social fiscal', 'razonSocial',
                         { marcador: 'OPERADORA GASTRONÓMICA S.A. DE C.V.' })}
                ${campoA('RFC', 'rfc', { marcador: 'OGL180422K98' })}
                ${campoA('Régimen fiscal', 'regimenFiscal',
                         { opciones: catalogos.regimenes, marcador: 'Sin régimen' })}
                ${campoA('Encargado de compras / recibidor', 'nombre',
                         { marcador: 'Cap. Mateo Villanueva',
                           ayuda: 'con quién se trata; si se deja vacío se usa el rótulo' })}
                ${campoA('Teléfono (WhatsApp del chofer)', 'telefono',
                         { marcador: '999 123 4567' })}
                ${campoA('Correo de facturación', 'correo',
                         { ancho: true, tipo: 'email', marcador: 'facturas@sunegocio.com.mx',
                           ayuda: 'el sistema no factura: se guarda y se imprime' })}
              </div>
            </section>

            <section class="tarjeta">
              <div class="cli-seccion-cabeza">
                <h3>🚚 Reparto y descarga</h3>
                <span class="cli-chip suave">Cadena de frío</span>
              </div>
              <div class="cli-campos">
                ${campoA('Dirección de entrega', 'direccion', { ancho: true })}
                ${campoA('Zona o sector', 'zona', { marcador: 'Zona Costa (Muelle 4)' })}
                ${campoA('Frecuencia de abastecimiento', 'frecuencia',
                         { opciones: catalogos.frecuencias, marcador: 'Sin acordar' })}
                ${campoA('Recibe desde', 'horaDesde', { tipo: 'time' })}
                ${campoA('Recibe hasta', 'horaHasta', { tipo: 'time' })}
                ${campoA('Horario, con sus rarezas', 'horarioEntrega',
                         { ancho: true, marcador: 'de 8 a 2 y de 5 a 8, los domingos no abre' })}
                ${campoA('Referencias', 'referencias',
                         { ancho: true, marcador: 'La de la puerta azul, junto a la tortillería' })}
                ${campoA('Instrucciones de descarga', 'instrucciones',
                         { ancho: true, largo: true,
                           marcador: 'Entrar por la rampa trasera. Pedir firma a Don Arturo.',
                           ayuda: 'qué se hace al llegar; sale en su nota de entrega' })}
              </div>
            </section>

            <section class="tarjeta">
              <div class="cli-seccion-cabeza">
                <h3>💵 Esquema de pago y plazo</h3>
              </div>
              <div class="cli-campos">
                ${campoA('Método autorizado', 'metodoPago',
                         { opciones: catalogos.metodosPago, marcador: 'De contado' })}
                ${campoA('Días de plazo', 'diasPlazo',
                         { marcador: 'sin plazo', ayuda: '7, 15 o 30, lo que se acuerde' })}
                ${campoA('Límite de crédito', 'limite',
                         { marcador: 'sin límite', ayuda: 'vacío = sin límite' })}
              </div>
              <p class="ayuda" style="margin:10px 0 0">
                Los precios acordados producto por producto se ponen desde su
                ficha, en «Tarifas y envases», en cuanto quede dado de alta.
              </p>
            </section>

            <section class="tarjeta">
              <div class="cli-seccion-cabeza">
                <h3>🧊 Envases en comodato</h3>
              </div>
              <div class="cli-campos">
                ${campoA('Garrafones autorizados', 'garrafonesLimite',
                         { marcador: 'sin límite', ayuda: 'cuántos como máximo' })}
                ${campoA('Garantía por garrafón', 'garrafonDeposito',
                         { marcador: '120.00', ayuda: 'lo que deja por cada uno' })}
              </div>
              <p class="ayuda" style="margin:10px 0 0">
                Cuántos trae AHORA se apunta al entregárselos, desde su ficha:
                aquí solo se acuerda el máximo y la garantía.
              </p>
            </section>
          </form>

          <aside class="cli-alta-resumen">
            <div class="tarjeta">
              <p class="etiqueta-chica">Resumen de la nueva cuenta</p>
              <div class="cli-alta-quien">
                <span class="cli-cara cli-inicial grande" id="res-cara"
                      style="background:${colorDe(a.negocio || 'nuevo')}">
                  ${esc(inicialesDe(a.negocio))}
                </span>
                <span>
                  <strong id="res-negocio">${esc(a.negocio || 'Sin nombre todavía')}</strong>
                  <small id="res-razon">${esc(a.razonSocial || 'sin razón social')}</small>
                </span>
              </div>

              <div class="cli-alta-lineas" id="res-lineas">
                ${resumenAlta(a)}
              </div>

              <button id="alta-guardar-2" style="width:100%;margin-top:14px">
                ＋ Registrar cliente y abrir su ficha
              </button>
              <p class="ayuda" style="margin:10px 0 0">
                Lo que quede vacío se puede llenar después. Nada de esto
                impide venderle: el crédito sí, que necesita límite o plazo.
              </p>
            </div>
          </aside>
        </div>
      </div>`;

    engancharAlta();
  }

  /** "Mariscos El Faro" → "MF". Dos letras: con una, media cartera es "M". */
  function inicialesDe(texto) {
    const t = String(texto || '').trim();
    if (!t) return '?';
    return t.split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase() || '?';
  }

  /** Los renglones del resumen, que se rehacen a cada tecla. */
  function resumenAlta(a) {
    const nombreDe = (lista, clave) => lista.find((x) => x.clave === clave)?.nombre;
    const renglones = [
      ['Giro', a.giro || '—'],
      ['Contacto', a.nombre || '—'],
      ['Teléfono', a.telefono || '—'],
      ['Zona', a.zona || '—'],
      ['Ventana', a.horaDesde && a.horaHasta ? `${a.horaDesde} a ${a.horaHasta} hrs` : '—'],
      ['Frecuencia', nombreDe(catalogos.frecuencias, a.frecuencia) || '—'],
      ['Pago', nombreDe(catalogos.metodosPago, a.metodoPago) || 'De contado'],
      ['Crédito', a.limite || a.diasPlazo
        ? `${a.limite ? `$${a.limite}` : 'sin límite'}${a.diasPlazo ? ` · ${a.diasPlazo} días` : ''}`
        : 'sin crédito'],
      ['Garrafones', a.garrafonesLimite
        ? `hasta ${a.garrafonesLimite}${a.garrafonDeposito ? ` · $${a.garrafonDeposito} c/u` : ''}`
        : '—']
    ];
    return renglones.map(([k, v]) => `
      <div class="cli-alta-linea"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('');
  }

  function engancharAlta() {
    const q = (sel) => pantalla.querySelector(sel);

    // El resumen se rehace solo, y SOLO el resumen: repintar la pantalla
    // entera a cada tecla haría perder el foco a media palabra.
    pantalla.querySelectorAll('[data-campo]').forEach((el) => {
      const refrescar = () => {
        alta[el.dataset.campo] = el.value;
        q('#res-negocio').textContent = alta.negocio || 'Sin nombre todavía';
        q('#res-razon').textContent = alta.razonSocial || 'sin razón social';
        q('#res-lineas').innerHTML = resumenAlta(alta);
        // La cara también: es lo que hace que quien captura vea que está
        // dando de alta a alguien y no rellenando un formulario en blanco.
        const cara = q('#res-cara');
        cara.textContent = inicialesDe(alta.negocio);
        cara.style.background = colorDe(alta.negocio || 'nuevo');
      };
      el.oninput = refrescar;
      el.onchange = refrescar;
      if (el.tagName === 'INPUT') {
        el.onkeydown = (ev) => { if (ev.key === 'Enter') ev.preventDefault(); };
      }
    });

    q('#alta-volver').onclick = () => { alta = null; pintar(); };
    q('#alta-guardar').onclick = guardarAlta;
    q('#alta-guardar-2').onclick = guardarAlta;
  }

  async function guardarAlta() {
    const a = alta;
    // El rótulo es lo único obligatorio, y si no hay se usa el del
    // contacto: un cliente sin ningún nombre no se puede buscar.
    const negocio = (a.negocio || '').trim();
    const nombre = (a.nombre || '').trim() || negocio;
    if (!nombre) {
      avisar('Escribe al menos el nombre comercial.', 'error');
      pantalla.querySelector('[data-campo="negocio"]')?.focus();
      return;
    }

    try {
      const r = await api.enviar('/clientes', { ...a, nombre, negocio });
      avisar(`${r.cliente.negocio || r.cliente.nombre} dado de alta`, 'bien');
      alta = null;
      seleccionado = r.cliente.id;
      pestanaFicha = 'tarifas';    // lo siguiente es ponerle sus precios
      await cargar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  // ==========================================================
  // ACCIONES
  // ==========================================================

  /**
   * LEVANTAR UN PEDIDO CON ESTE CLIENTE YA PUESTO.
   *
   * Se va a la caja, que es donde se toman los pedidos y las ventas: la
   * pantalla de Pedidos es para prepararlos y entregarlos, no para
   * capturarlos. El cliente viaja en el enlace y llega puesto en el
   * ticket, así que lo único que queda es marcar lo que se lleva.
   */
  function irAPedido(id) {
    location.hash = `#/venta?cliente=${encodeURIComponent(id)}`;
  }

  /**
   * SUS PRECIOS, PRODUCTO POR PRODUCTO  (v6.9)
   *
   * Se elige el producto de una lista y se escribe el precio. Dejarlo
   * vacío lo QUITA, y entonces ese producto vuelve a cobrarse por su lista
   * o por el mostrador — que es lo que se quiere al terminar un trato, y
   * no dejarlo en cero.
   */
  async function editarTarifas() {
    const c = ficha.cliente;
    let d;
    try { d = await api.obtener(`/clientes/${c.id}/precios`); }
    catch (e) { return avisar(e.message, 'error'); }

    const puestos = new Map(d.precios.map((p) => [p.producto_id, p]));
    const cual = await menu({
      titulo: `Precios de ${c.negocio || c.nombre}`,
      texto: 'Su precio gana a la lista de mayoreo y al mostrador. Elige el producto.',
      opciones: d.productos.map((p) => {
        const suyo = puestos.get(p.id);
        return {
          valor: p.id,
          texto: `${suyo ? '🏷️ ' : ''}${p.nombre}`,
          detalle: suyo
            ? `Le cobras ${pesos(suyo.centavos)} · lista ${pesos(p.lista_centavos || 0)}`
            : `Sin precio propio · lista ${pesos(p.lista_centavos || 0)}`
        };
      })
    });
    if (!cual) return;

    const producto = d.productos.find((p) => p.id === cual);
    const suyo = puestos.get(cual);

    const precio = await pedirTexto({
      titulo: producto.nombre,
      texto: `De mostrador cuesta ${pesos(producto.lista_centavos || 0)}. ` +
             '¿A cuánto se lo dejas? Déjalo vacío para quitarle el precio propio.',
      valor: suyo ? paraEditar(suyo.centavos) : '',
      marcador: paraEditar(producto.lista_centavos || 0),
      ok: 'Guardar', largo: 12, unaLinea: true, opcional: true
    });
    if (precio === null) return;

    let volumen = suyo?.volumen || '';
    if (precio !== '') {
      const v = await pedirTexto({
        titulo: `${producto.nombre} · cuánto se lleva`,
        texto: 'Lo acordado, como se dijo. Sirve para preparar su carga y para ' +
               'notar si dejó de pedir. Se puede dejar vacío.',
        valor: volumen, marcador: '25 pzas por entrega',
        ok: 'Guardar', largo: 60, unaLinea: true, opcional: true
      });
      if (v === null) return;
      volumen = v;
    }

    try {
      await api.actualizar(`/clientes/${c.id}/precios`,
        { productoId: cual, precio, volumen });
      avisar(precio === '' ? 'Precio propio quitado' : 'Precio guardado', 'bien');
      await abrir(c.id);
    } catch (e) { avisar(e.message, 'error'); }
  }

  /**
   * ENTREGARLE UNA NEVERA.
   *
   * Solo salen las que están LIBRES: una nevera prestada no se puede
   * prestar dos veces, y enseñarla en la lista para que el servidor la
   * rechace después es hacer perder el viaje.
   *
   * Los datos del préstamo salen de la propia ficha —dirección, contacto,
   * teléfono, ubicación—: ya están capturados y volver a pedirlos es la
   * forma más fácil de que el comodato quede con una dirección distinta a
   * la del cliente.
   */
  async function prestarNevera() {
    const c = ficha.cliente;

    let d;
    try { d = await api.obtener('/neveras'); }
    catch (e) { return avisar(e.message, 'error'); }

    const libres = (d.neveras || []).filter((n) => !n.comodato && n.estado === 'bodega');
    if (!libres.length) {
      return avisar('No hay ninguna nevera en bodega. Todas están prestadas, ' +
                    'en reparación o dadas de baja.', 'error');
    }

    const cual = await menu({
      titulo: `Entregarle una nevera a ${c.negocio || c.nombre}`,
      texto: `${libres.length} en bodega. Se le entrega con su dirección y su ` +
             'contacto, los de esta ficha.',
      opciones: libres.map((n) => ({
        valor: n.id,
        texto: `❄️ Nevera ${n.numero}`,
        detalle: [
          [n.marca, n.modelo].filter(Boolean).join(' '),
          n.bolsas ? `${n.bolsas} bolsas` : null,
          n.serie ? `serie ${n.serie}` : null
        ].filter(Boolean).join(' · ') || 'sin datos'
      }))
    });
    if (!cual) return;

    try {
      await api.enviar(`/neveras/${cual}/entregar`, {
        tipo: 'cliente',
        clienteId: c.id,
        direccion: c.direccion || '',
        referencias: c.referencias || '',
        latitud: c.latitud ?? '',
        longitud: c.longitud ?? '',
        responsable: c.nombre || '',
        telefono: c.telefono || ''
      });
      avisar('Nevera entregada. Su contrato se saca desde «Las neveras».', 'bien');
      await abrir(c.id);
    } catch (e) { avisar(e.message, 'error'); }
  }

  /** Apuntar garrafones entregados (+1) o devueltos (−1). */
  async function moverGarrafones(signo) {
    const c = ficha.cliente;
    const g = ficha.garrafones;
    const dio = signo > 0;

    const cuantos = await pedirTexto({
      titulo: dio ? `Garrafones para ${c.negocio || c.nombre}` : 'Garrafones que trajo',
      texto: dio
        ? `Trae ${g.retenidos} en resguardo. ¿Cuántos se le dejan ahora?`
        : `Trae ${g.retenidos} en resguardo. ¿Cuántos devolvió?`,
      marcador: '5', ok: 'Apuntar', largo: 5, unaLinea: true
    });
    if (!cuantos) return;

    const n = Number(cuantos);
    if (!Number.isInteger(n) || n <= 0) return avisar('Escribe cuántos, con números.', 'error');

    try {
      const r = await api.enviar(`/clientes/${c.id}/garrafones`,
        { cuantos: signo * n, motivo: dio ? 'Se le dejaron' : 'Los trajo' });
      avisar(`Ahora trae ${r.retenidos}`, 'bien');
      if (r.aviso) avisar(r.aviso, 'error');
      await abrir(c.id);
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function anularGarrafon(id) {
    const motivo = await pedirTexto({
      titulo: 'Anular este movimiento',
      texto: 'No se borra: queda marcado como anulado, con tu nombre y el motivo.',
      marcador: 'Se apuntó dos veces', ok: 'Anular', largo: 200, unaLinea: true
    });
    if (!motivo) return;
    try {
      await api.enviar(`/clientes/garrafones/${id}/anular`, { motivo });
      avisar('Movimiento anulado', 'bien');
      await abrir(ficha.cliente.id);
    } catch (e) { avisar(e.message, 'error'); }
  }

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

  /**
   * GUARDA TODO LO QUE CAMBIÓ, de un viaje.
   *
   * Se manda solo lo que de verdad se tocó: mandar la ficha entera haría
   * que abrir un cliente y cerrarlo le pusiera fecha de modificación a
   * todo, y que dos personas editando a la vez se pisaran campos que
   * ninguna tocó.
   */
  async function guardarFicha() {
    if (!ficha) return;
    const cambiables = [...pantalla.querySelectorAll('[data-campo], [data-lista]')];
    const cuerpo = {};
    for (const el of cambiables) {
      const antes = el.dataset.inicial ?? '';
      if (el.value === antes) continue;
      const clave = el.dataset.campo || 'listaId';
      cuerpo[clave] = typeof el.value === 'string' ? el.value.trim() : el.value;
    }
    if (!Object.keys(cuerpo).length) return;

    try {
      const r = await api.actualizar(`/clientes/${ficha.cliente.id}`, cuerpo);
      ficha.cliente = r.cliente;
      avisar('Guardado', 'bien');
      // Una sola repintada, y a propósito: el nombre y el saldo salen
      // también en la tabla de la izquierda.
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
