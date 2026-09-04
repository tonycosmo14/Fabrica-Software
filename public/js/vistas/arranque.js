/**
 * LA PUESTA EN MARCHA  (v5.2.1)
 *
 * La fábrica ya trabaja; el sistema apenas llega. Esta pantalla es el día
 * del arranque: decirle al sistema cómo está el mundo real a esa hora.
 *
 * ============================================================
 * POR QUÉ ES UN FORMULARIO Y NO UNA LISTA DE ENLACES
 * ============================================================
 *
 * Antes esto era un checklist que mandaba a otras pantallas: "ve a contar
 * el cuarto frío", "ve a productos". Y al usarlo de verdad se cayó por
 * donde se tenía que caer — el enlace del hielo llevaba a una pantalla
 * donde NO se podía contar, porque contar solo existía dentro del cierre
 * de turno. El paso mandaba a un sitio donde el paso no se podía hacer.
 *
 * Ahora lo que se puede capturar aquí, se captura aquí. Un enlace es una
 * promesa de que del otro lado hay algo; si no lo hay, es peor que nada.
 *
 * Y el dinero ya no se pregunta: la caja empieza en cero.
 */
import { api } from '../api.js';
import { esc, avisar, fecha as formatoFecha } from '../util.js';
import { pedirTexto, confirmar, menu, pedirContrasena } from '../dialogo.js';
import { crearTeclado, aTexto as textoFraccion, deTexto } from '../fracciones.js';

export async function vistaArranque(pantalla) {
  let d;
  await pintar();

  async function pintar() {
    pantalla.innerHTML = '<div class="cargando">Revisando cómo está todo…</div>';

    try { d = await api.obtener('/arranque/estado'); }
    catch (e) { pantalla.innerHTML = `<p class="vacio">${esc(e.message)}</p>`; return; }

    const lista = d.terminada;

    pantalla.innerHTML = `
      <div class="ancho-completo">
        <h2>${lista ? 'Cuadrar con la realidad' : 'Puesta en marcha'}</h2>
        ${lista ? `
          <p class="ayuda">
            La puesta en marcha se dio por hecha el
            <b>${esc(formatoFecha(lista.terminada_en))}</b>. Esta pantalla
            queda para el día que la realidad y el sistema se separen: un
            apagón, una semana sin capturar. Cada cuadre pide su motivo y
            queda firmado en la bitácora.
            ${d.cuadres ? `<br>Se ha usado <b>${d.cuadres}</b>
              ${d.cuadres === 1 ? 'vez' : 'veces'} desde entonces.` : ''}
          </p>` : `
          <p class="ayuda">
            La fábrica ya trabaja; el sistema apenas llega. Aquí se le dice
            cómo está el mundo <b>real</b> hoy, de arriba abajo y una sola vez.
            Todo antes del primer movimiento de verdad.
          </p>`}

        ${lista ? '' : pasoTanques()}
        ${lista ? '' : pasoBorrar()}
        ${d.tanques.map((t) => tarjetaTanque(t, lista)).join('')}
        ${lista ? '' : pasoHielo()}
        ${lista ? '' : pasoProductos()}
        ${lista ? '' : pasoTerminar()}
      </div>`;

    enganchar();
  }

  function paso(n, titulo, cuerpo, extra = '') {
    return `
      <div class="tarjeta arr-paso"${extra}>
        <strong>${n} · ${titulo}</strong>
        <div class="ayuda" style="margin:6px 0 0">${cuerpo}</div>
      </div>`;
  }

  // ==========================================================
  // 1 · LOS TANQUES
  // ==========================================================
  function pasoTanques() {
    return paso(1, 'Los tanques, como son', `
      Tanques, paños, canastas y moldes, con sus horas de congelación.
      ${d.tanques.length
        ? `<b class="bueno">✔ Hay ${d.tanques.length}
           ${d.tanques.length === 1 ? 'tanque configurado' : 'tanques configurados'}.</b>`
        : '<b class="malo">Todavía no hay ninguno.</b>'}
      <br><a href="#/config-tanques">Ir a configurar tanques ›</a>`);
  }

  // ==========================================================
  // 2 · DEJARLO LIMPIO
  // ==========================================================

  /**
   * LO QUE SE VA A BORRAR SE ENSEÑA ANTES, CON SUS CUENTAS.
   *
   * Antes decía "ventas, sacadas y turnos" y borraba trece tablas de las
   * veintiocho que hay — se quedaban dentro los cortes, los gastos, los
   * recibos de la luz. Ahora la lista viene del servidor, contada, y es la
   * misma que se ejecuta: no hay forma de que el texto prometa una cosa y
   * el botón haga otra.
   */
  function pasoBorrar() {
    const hay = d.porBorrar.reduce((a, g) => a + g.cuantos, 0);

    return paso(2, 'Dejarlo completamente limpio', `
      Todo lo capturado hasta hoy fue ensayo. Este botón lo borra
      <b>para que los números del negocio empiecen de cero</b>.
      ${hay ? `
        <div class="arr-limpieza">
          <div class="arr-columna">
            <span class="etiqueta-chica malo">Se borra</span>
            <ul class="arr-lista">
              ${d.porBorrar.map((g) => `
                <li><b>${g.cuantos}</b> · ${esc(g.grupo.replace(/^(Los|Las|El|La) /, ''))}</li>
              `).join('')}
            </ul>
          </div>
          <div class="arr-columna">
            <span class="etiqueta-chica bueno">Se queda</span>
            <p class="arr-queda">${d.seQueda.map(esc).join(' · ')}</p>
          </div>
        </div>`
        : '<br><b class="bueno">✔ No hay nada de prueba que borrar.</b>'}
      <br><button class="peligro chico" id="cerrar-pruebas" style="margin-top:10px">
        Borrar los ${hay} registros de prueba</button>
      <small class="ayuda" style="display:block;margin-top:6px">
        Antes de borrar se hace un respaldo solo. Es de una sola vez:
        desaparece al dar por hecha la puesta en marcha.
      </small>`);
  }

  // ==========================================================
  // 3 y 4 · LOS PAÑOS Y LA ROTACIÓN
  // ==========================================================
  function tarjetaTanque(t, modoCuadre) {
    const opcionesHora = `
      <option value="0">ahorita</option>
      <option value="2">hace 2 horas</option>
      <option value="6">hace 6 horas</option>
      <option value="12" selected>hace 12 horas</option>
      <option value="18">hace 18 horas</option>
      <option value="24">hace un día</option>
      <option value="36">hace día y medio</option>
      <option value="48">hace dos días</option>`;

    return `
      <div class="tarjeta arr-paso" data-tanque="${esc(t.id)}">
        <strong>${modoCuadre ? '' : '3 · '}${esc(t.nombre)}: los paños y la rotación</strong>
        <p class="ayuda" style="margin:6px 0 10px">
          Marca cómo está cada paño <b>en el tanque, ahorita</b>. "Sin tocar"
          no escribe nada. Congela ${t.horasCongelacion} h.
        </p>

        <div class="hist-envoltura">
          <table class="tabla arr-tabla">
            <tr>
              <th>Paño</th><th>Hoy el sistema cree</th><th>La realidad</th>
              <th>Desde cuándo</th><th>Agua</th>
            </tr>
            ${t.panos.map((p) => `
              <tr data-pano="${esc(p.id)}">
                <td><strong>${p.numero}</strong>
                  <small style="display:block">${p.canastas} canastas</small></td>
                <td>
                  ${p.sinRegistro ? '<span class="hist-que">sin registro</span>'
                    : `<span class="hist-que ${p.estado === 'fuera' ? 'que-cancelada' : 'que-entrada'}">
                        ${esc(p.estado)}${p.horas != null ? ` · ${Math.floor(p.horas)} h` : ''}
                       </span>`}
                  ${!modoCuadre && !p.sembrable
                    ? '<small style="display:block">ya tiene historia real</small>' : ''}
                </td>
                <td>
                  <select class="arr-situacion" ${!modoCuadre && !p.sembrable ? 'disabled' : ''}>
                    <option value="">— sin tocar —</option>
                    <option value="congelando">congelando</option>
                    <option value="fuera">fuera del tanque</option>
                  </select>
                </td>
                <td>
                  <select class="arr-desde" disabled>${opcionesHora}</select>
                </td>
                <td>
                  <select class="arr-agua" disabled>
                    <option value="purificada">purificada</option>
                    <option value="potable">potable</option>
                  </select>
                </td>
              </tr>`).join('')}
          </table>
        </div>

        <div class="fila-botones" style="margin-top:10px">
          <button class="chico" data-guardar-panos="${esc(t.id)}">
            Guardar los paños marcados
          </button>
          <button class="secundario chico" data-rotacion="${esc(t.id)}">
            Rotación: el último sacado fue el
            ${t.ultimoPanoSacado ?? '— (ninguno)'}${t.siguiente ? ` · toca el ${t.siguiente}` : ''}
          </button>
        </div>
      </div>`;
  }

  // ==========================================================
  // 4 · EL HIELO QUE HAY AHORITA
  // ==========================================================

  /**
   * SE CAPTURA AQUÍ, NO EN OTRA PANTALLA.
   *
   * Es el primer conteo del cuarto frío: no cuadra contra nada, porque no
   * hay un antes contra el que cuadrar. Fija el punto de partida y desde
   * ahí todo lo demás sale solo.
   *
   * Lleva el mismo teclado de fracciones del cierre de turno, para que sea
   * el mismo gesto que se hace todos los días: no tiene sentido aprender
   * dos formas de escribir "catorce y media".
   */
  function pasoHielo() {
    const u = d.ultimoConteo;
    return paso(4, '¿Cuánto hielo hay ahorita en el cuarto frío?', `
      El primer conteo fija el punto de partida; no cuadra contra nada.
      Cuenta lo que hay <b>físicamente</b>, con sus pedazos.
      ${u ? `<br><b class="bueno">✔ Ya se anotó:
              ${esc(textoFraccion(u.contado))} marquetas</b>
             <small>(${esc(formatoFecha(u.fecha))}). Anotar otra vez lo
             corrige: manda el conteo bueno.</small>` : ''}

      <div class="arr-hielo">
        <div id="teclado-hielo"></div>
        <div class="arr-hielo-lado">
          <label class="etiqueta-chica" for="hielo-escrito">O escríbelo</label>
          <input id="hielo-escrito" class="dialogo-campo-linea"
                 placeholder="14 y 1/2" autocomplete="off">
          <small class="ayuda" id="hielo-malo" hidden>
            No se entiende. Se escribe "14", "14 1/2" o "14 y 3/4": medios,
            cuartos, octavos o dieciseisavos.
          </small>
          ${d.almacenes.length > 1 ? `
            <label class="etiqueta-chica" for="hielo-almacen"
                   style="margin-top:10px">¿Cuál cuarto frío?</label>
            <select id="hielo-almacen">
              ${d.almacenes.map((a) => `<option value="${esc(a.id)}">${esc(a.nombre)}</option>`).join('')}
            </select>` : ''}
          <button class="chico" id="guardar-hielo" style="margin-top:12px">
            Guardar el hielo que hay
          </button>
        </div>
      </div>`);
  }

  // ==========================================================
  // 5 · LOS PRODUCTOS   ·   6 · TERMINAR
  // ==========================================================
  function pasoProductos() {
    return paso(5, 'Los productos', `
      Refrescos y demás, con su primer conteo cada uno.
      ${d.productosSinConteo === 0
        ? '<b class="bueno">✔ Todos los productos tienen su conteo.</b>'
        : `<b class="malo">Faltan ${d.productosSinConteo} por contar.</b>`}
      <br><a href="#/productos">Ir a productos ›</a>
      <small class="ayuda" style="display:block;margin-top:8px">
        <b>El dinero no se pregunta:</b> la caja empieza en cero. El primer
        cajero entra con su PIN —eso abre su turno— y desde ahí el arqueo
        cuadra solo.
      </small>`);
  }

  function pasoTerminar() {
    return `
      <div class="tarjeta" style="margin-top:14px">
        <strong>6 · Dar por puesta en marcha</strong>
        <p class="ayuda" style="margin:6px 0 10px">
          Cuando lo de arriba esté como es en la realidad. El checklist
          se convierte en constancia y el botón de borrar pruebas
          desaparece para siempre.
        </p>
        <button id="terminar">Dar por puesta en marcha</button>
      </div>`;
  }

  // ==========================================================
  // LOS ENGANCHES
  // ==========================================================
  function enganchar() {
    pantalla.querySelectorAll('.arr-situacion').forEach((sel) => {
      sel.onchange = () => {
        const fila = sel.closest('tr');
        const hay = Boolean(sel.value);
        fila.querySelector('.arr-desde').disabled = !hay;
        fila.querySelector('.arr-agua').disabled = sel.value !== 'congelando';
      };
    });

    pantalla.querySelectorAll('[data-guardar-panos]').forEach((b) => {
      b.onclick = () => guardarPanos(b.dataset.guardarPanos, Boolean(d.terminada));
    });
    pantalla.querySelectorAll('[data-rotacion]').forEach((b) => {
      b.onclick = () => fijarRotacion(d.tanques.find((t) => t.id === b.dataset.rotacion));
    });

    const cerrar = pantalla.querySelector('#cerrar-pruebas');
    if (cerrar) cerrar.onclick = cerrarPruebas;
    const terminar = pantalla.querySelector('#terminar');
    if (terminar) terminar.onclick = darPorHecha;

    engancharHielo();
  }

  function engancharHielo() {
    const caja = pantalla.querySelector('#teclado-hielo');
    if (!caja) return;

    const escrito = pantalla.querySelector('#hielo-escrito');
    const malo = pantalla.querySelector('#hielo-malo');

    const teclado = crearTeclado(caja, {
      valor: d.ultimoConteo?.contado || 0,
      alCambiar: (n) => {
        if (document.activeElement !== escrito) escrito.value = n ? textoFraccion(n) : '';
        malo.hidden = true;
      }
    });
    if (d.ultimoConteo?.contado) escrito.value = textoFraccion(d.ultimoConteo.contado);

    escrito.oninput = () => {
      const n = deTexto(escrito.value);
      malo.hidden = escrito.value.trim() === '' || n !== null;
      if (n !== null) teclado.poner(n);
    };

    pantalla.querySelector('#guardar-hielo').onclick = async () => {
      // Escrito a mano y no se entiende: no se guarda nada. Un conteo mal
      // leído es peor que uno que no se hizo.
      if (escrito.value.trim() && deTexto(escrito.value) === null) {
        malo.hidden = false;
        escrito.focus();
        return;
      }
      const dieciseisavos = teclado.valor();
      const almacen = pantalla.querySelector('#hielo-almacen');

      try {
        await api.enviar('/existencia/conteos', {
          dieciseisavos,
          ...(almacen ? { almacenId: almacen.value } : {}),
          notas: 'PUESTA EN MARCHA'
        });
        avisar(`Hielo anotado: ${textoFraccion(dieciseisavos)} marquetas`, 'bien');
        await pintar();
      } catch (e) { avisar(e.message, 'error'); }
    };
  }

  async function guardarPanos(tanqueId, modoCuadre) {
    const filas = [...pantalla.querySelectorAll(
      `[data-tanque="${CSS.escape(tanqueId)}"] tr[data-pano]`)];

    const panos = filas
      .filter((f) => f.querySelector('.arr-situacion').value)
      .map((f) => {
        const horas = Number(f.querySelector('.arr-desde').value);
        return {
          panoId: f.dataset.pano,
          situacion: f.querySelector('.arr-situacion').value,
          desde: new Date(Date.now() - horas * 3600 * 1000).toISOString(),
          tipoAgua: f.querySelector('.arr-agua').value
        };
      });

    if (!panos.length) return avisar('No marcaste ningún paño', '');

    try {
      if (modoCuadre) {
        const motivo = await pedirTexto({
          titulo: '¿Por qué se cuadra a mano?',
          texto: 'Queda firmado en la bitácora, con el antes y el después.',
          marcador: 'Se fue la luz el martes y nadie capturó', ok: 'Cuadrar',
          largo: 200, unaLinea: true
        });
        if (!motivo) return;
        await api.enviar('/arranque/cuadre-panos', { panos, motivo });
      } else {
        await api.enviar('/arranque/panos', { panos });
      }
      avisar(`${panos.length} ${panos.length === 1 ? 'paño fijado' : 'paños fijados'}`, 'bien');
      await pintar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function fijarRotacion(t) {
    if (!t) return;
    const cual = await menu({
      titulo: `${t.nombre}: ¿cuál fue el ÚLTIMO paño que se sacó?`,
      texto: 'Con eso el sistema sabe cuál toca. El orden va intercalado: ' +
             t.ordenRotacion.join(' → ') + '.',
      opciones: [
        { valor: 'ninguno', texto: 'Ninguno todavía', detalle: `Empezaría por el ${t.ordenRotacion[0]}` },
        ...t.ordenRotacion.map((n) => ({ valor: String(n), texto: `El paño ${n}` }))
      ]
    });
    if (!cual) return;

    try {
      const r = await api.enviar('/arranque/rotacion', {
        tanqueId: t.id,
        ultimoPanoSacado: cual === 'ninguno' ? null : Number(cual)
      });
      avisar(`Listo: entonces toca el paño ${r.entoncesToca}`, 'bien');
      await pintar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function cerrarPruebas() {
    const cuantos = d.porBorrar.reduce((a, g) => a + g.cuantos, 0);
    const frase = await pedirTexto({
      titulo: `Borrar los ${cuantos} registros de prueba`,
      texto: 'Se borra todo lo que PASÓ —ventas, cortes, sacadas, gastos, ' +
             'lecturas— y se queda todo lo que ES: tanques, productos, ' +
             'precios, gente, clientes, neveras y equipos. Antes se hace un ' +
             'respaldo solo. Para seguir, escribe: BORRAR PRUEBAS',
      marcador: 'BORRAR PRUEBAS', ok: 'Seguir', largo: 20, unaLinea: true
    });
    if (frase === null) return;
    if (frase.trim().toUpperCase() !== 'BORRAR PRUEBAS') {
      return avisar('No coincidió. No se borró nada.', '');
    }

    try {
      await api.enviar('/arranque/cerrar-pruebas', {});
    } catch (e) {
      if (!e.requiereContrasena) return avisar(e.message, 'error');
      const autorizacion = await pedirContrasena({
        titulo: 'La contraseña del administrador',
        texto: 'Borrar no se deshace; por eso pide la contraseña, no el PIN.',
        administradores: e.administradores || [], ok: 'Borrar las pruebas'
      });
      if (!autorizacion) return;
      try {
        const r = await api.enviar('/arranque/cerrar-pruebas', { autorizacion });
        const n = Object.values(r.borradas).reduce((a, x) => a + (x || 0), 0);
        avisar(`Listo: ${n} registros de ensayo borrados. El respaldo quedó guardado.`, 'bien');
        await pintar();
      } catch (e2) { avisar(e2.message, 'error'); }
    }
  }

  async function darPorHecha() {
    if (!await confirmar({
      titulo: '¿Dar por puesta en marcha?',
      texto: 'El checklist se vuelve constancia y el botón de borrar ' +
             'pruebas desaparece para siempre. El cuadre de paños se queda, ' +
             'con motivo obligatorio.',
      ok: 'Sí, ya está andando'
    })) return;
    try {
      await api.enviar('/arranque/terminar', {});
      avisar('La fábrica quedó puesta en marcha 🎉', 'bien');
      await pintar();
    } catch (e) { avisar(e.message, 'error'); }
  }
}
