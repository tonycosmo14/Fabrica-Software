/**
 * LA PUESTA EN MARCHA  (v2.8)
 *
 * La fábrica ya trabaja; el sistema apenas llega. Esta pantalla es el día
 * del arranque: decirle al sistema cómo está el mundo real a esa hora.
 *
 * Casi todo son enlaces a herramientas que ya existen —el conteo fija el
 * hielo, el turno fija el dinero—. Lo único que se captura aquí es lo que
 * no se podía capturar en ningún lado: el estado de los paños y cuál fue
 * el último que se sacó.
 *
 * Cuando la puesta en marcha se da por hecha, el checklist se convierte en
 * una constancia, y lo único que queda vivo es el CUADRE: la misma captura
 * de paños, para el apagón o la semana que nadie anotó, siempre con motivo
 * y firmando cada uso en la bitácora.
 */
import { api } from '../api.js';
import { esc, avisar, fecha as formatoFecha } from '../util.js';
import { pedirTexto, confirmar, menu, pedirContrasena } from '../dialogo.js';

export async function vistaArranque(pantalla) {
  await pintar();

  async function pintar() {
    pantalla.innerHTML = '<div class="cargando">Revisando cómo está todo…</div>';

    let d;
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
            cómo está el mundo <b>real</b> hoy, en orden y una sola vez.
            Todo antes del primer movimiento de verdad.
          </p>`}

        ${lista ? '' : paso(1, 'Los tanques, como son', `
          Tanques, paños, canastas y moldes, con sus horas de congelación.
          ${d.tanques.length
            ? `<b class="bueno">✔ Hay ${d.tanques.length}
               ${d.tanques.length === 1 ? 'tanque configurado' : 'tanques configurados'}.</b>`
            : '<b class="malo">Todavía no hay ninguno.</b>'}
          <br><a href="#/config-tanques">Ir a configurar tanques ›</a>`)}

        ${lista ? '' : paso(2, 'Cerrar las pruebas', `
          Todo lo capturado hasta hoy fue ensayo: ${d.movimientos.ventas}
          ${d.movimientos.ventas === 1 ? 'venta' : 'ventas'},
          ${d.movimientos.sacadas} sacadas y ${d.movimientos.turnos}
          ${d.movimientos.turnos === 1 ? 'turno' : 'turnos'}. Este botón lo
          borra <b>para que los números del negocio empiecen limpios</b>,
          dejando usuarios, tanques, productos, precios, clientes y toda la
          bitácora. Antes de borrar se hace un respaldo solo.
          <br><button class="peligro chico" id="cerrar-pruebas"
                      style="margin-top:8px">Borrar los datos de prueba</button>
          <small class="ayuda" style="display:block;margin-top:6px">
            Es de una sola vez: desaparece al dar por hecha la puesta en
            marcha. Si prefieres conservar el ensayo, sáltatelo: el primer
            conteo lo absorbe, pero los meses del negocio quedan revueltos
            con las pruebas para siempre.
          </small>`)}

        ${d.tanques.map((t) => tarjetaTanque(t, lista)).join('')}

        ${lista ? '' : paso(5, 'El hielo del cuarto frío', `
          El primer conteo fija cuánto hay; no cuadra contra nada.
          ${d.hieloContado
            ? '<b class="bueno">✔ Ya se hizo el primer conteo.</b>'
            : '<b class="malo">Todavía no se cuenta.</b>'}
          <br><a href="#/existencia">Ir a contar el cuarto frío ›</a>`)}

        ${lista ? '' : paso(6, 'Los productos', `
          Refrescos y demás, con su primer conteo cada uno.
          ${d.productosSinConteo === 0
            ? '<b class="bueno">✔ Todos los productos tienen su conteo.</b>'
            : `<b class="malo">Faltan ${d.productosSinConteo} por contar.</b>`}
          <br><a href="#/productos">Ir a productos ›</a>`)}

        ${lista ? '' : paso(7, 'El dinero del cajón', `
          No lleva botón: el cajero entra con su PIN —eso abre su turno— y
          registra una <b>entrada</b> "Fondo inicial" con lo que haya
          físicamente en el cajón. Desde ahí, el arqueo cuadra solo.`)}

        ${lista ? '' : `
          <div class="tarjeta" style="margin-top:14px">
            <strong>8 · Dar por puesta en marcha</strong>
            <p class="ayuda" style="margin:6px 0 10px">
              Cuando lo de arriba esté como es en la realidad. El checklist
              se convierte en constancia y el botón de borrar pruebas
              desaparece para siempre.
            </p>
            <button id="terminar">Dar por puesta en marcha</button>
          </div>`}
      </div>`;

    enganchar(d);
  }

  function paso(n, titulo, cuerpo) {
    return `
      <div class="tarjeta arr-paso">
        <strong>${n} · ${titulo}</strong>
        <p class="ayuda" style="margin:6px 0 0">${cuerpo}</p>
      </div>`;
  }

  /**
   * Un tanque: sus paños con su estado real, y su rotación. En modo cuadre
   * (ya puesta en marcha) es lo mismo, pero cada guardado pide motivo.
   */
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
        <strong>${modoCuadre ? '' : '3 y 4 · '}${esc(t.nombre)}: los paños y la rotación</strong>
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

  function enganchar(d) {
    // Los selects de cada renglón: situación habilita fecha y agua.
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
    const frase = await pedirTexto({
      titulo: 'Borrar TODOS los movimientos de prueba',
      texto: 'Ventas, sacadas, conteos y turnos de ensayo. Se queda lo ' +
             'configurado y la bitácora, y antes se hace un respaldo solo. ' +
             'Para seguir, escribe: BORRAR PRUEBAS',
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
