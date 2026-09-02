/**
 * CONFIGURAR TANQUES  (v0.2)
 *
 * Aquí se define la estructura física de la fábrica:
 *   Tanque → Paño (fila) → Canasta → Molde (= 1 marqueta)
 *
 * Esta pantalla es de CONFIGURACIÓN. La pantalla de trabajo diario
 * (sacar y rellenar canastas, con el reloj de congelación) es Producción,
 * y llega en la v0.3.
 *
 * La canasta es el bloque táctil, no el molde (sección 6.2 del plan):
 * así los 18 paños de un tanque caben en la pantalla de un celular.
 */
import { api } from '../api.js';
import { esc, avisar } from '../util.js';
import { confirmar, pedirNumero, menu } from '../dialogo.js';

/**
 * Explicación visual de la jerarquía. Va plegada para no robar espacio,
 * pero está siempre a mano y sirve de base para el manual de ayuda.
 */
function bloqueQueEsQue() {
  return `
    <details class="ayuda-bloque">
      <summary>¿Qué es un paño, una canasta y un molde?</summary>
      <div class="ayuda-cuerpo">
        <div class="esquema">
          <div class="esquema-tanque">
            <span class="esquema-etiqueta tanque">TANQUE</span>
            ${[1, 2, 3].map((n) => `
              <div class="esquema-pano">
                <span class="esquema-num">${n}</span>
                ${[3, 3, 3, 4].map((moldes, i) => `
                  <span class="esquema-canasta ${n === 1 && i === 0 ? 'senalada' : ''}">
                    ${Array.from({ length: moldes }, () => '<i></i>').join('')}
                  </span>`).join('')}
              </div>`).join('')}
          </div>
          <div class="esquema-notas">
            <p><span class="esquema-punto tanque"></span>
               <strong>Tanque</strong> — el depósito con salmuera. Tú tienes 2N, T y N.</p>
            <p><span class="esquema-punto pano"></span>
               <strong>Paño</strong> — cada fila del tanque. Es la unidad de trabajo:
               se saca completo.</p>
            <p><span class="esquema-punto canasta"></span>
               <strong>Canasta</strong> — lo que la grúa levanta de un jalón.
               Un paño lleva varias.</p>
            <p><span class="esquema-punto molde"></span>
               <strong>Molde</strong> — cada hueco de la canasta.
               <strong>Un molde = una marqueta.</strong></p>
          </div>
        </div>
      </div>
    </details>`;
}

/** Instrucciones de uso del configurador. */
function bloqueComoSeUsa() {
  return `
    <details class="ayuda-bloque">
      <summary>Cómo agregar o quitar paños y canastas</summary>
      <div class="ayuda-cuerpo">
        <ul class="instrucciones">
          <li><b>Agregar paños</b> — botón <em>＋ Agregar paños</em>. Te pregunta cuántos
              y los crea copiados del último paño.</li>
          <li><b>Quitar paños</b> — botón <em>− Quitar últimos</em> si te pasaste al crear
              el tanque, o el botón <em>⋯</em> del paño para quitar uno concreto.</li>
          <li><b>Agregar una canasta a un paño</b> — el botón <em>＋</em> al final de la
              fila, o <em>⋯ → Agregar una canasta</em>.</li>
          <li><b>Cambiar los moldes de una canasta</b> — toca la canasta y usa
              los botones <em>−</em> y <em>＋</em>.</li>
          <li><b>Recuperar algo quitado</b> — botón <em>Ver bajas</em>: lo quitado aparece
              en gris y se puede volver a activar.</li>
        </ul>
        <p class="ayuda" style="margin:12px 0 0;font-size:14px">
          Nada se borra nunca. Lo que quitas deja de contar, pero su historial
          se conserva completo para los reportes.
        </p>
      </div>
    </details>`;
}

export async function vistaTanques(pantalla, estado) {
  const puedeConfigurar = estado.permisos.includes('*') ||
                          estado.permisos.includes('tanques.configurar');

  await lista();

  // ==========================================================
  // 1. LISTA DE TANQUES
  // ==========================================================
  async function lista() {
    const { tanques, totalMoldes } = await api.obtener('/tanques');

    pantalla.innerHTML = `
      <div class="cfg-tanques">
        <div class="cfg-cabeza">
          <a class="secundario chico boton volver-produccion" href="#/tanques">
            ‹ Producción de hielo</a>
        </div>

        <h2>Configurar tanques</h2>
        <p class="ayuda">
          La estructura física de la fábrica. Aquí se da de alta lo que existe;
          el trabajo diario va en Producción de hielo.
        </p>

        ${bloqueQueEsQue()}

        ${tanques.length ? `
          <div class="resumen-fabrica">
            <div><strong>${tanques.length}</strong><small>${tanques.length === 1 ? 'tanque' : 'tanques'}</small></div>
            <div><strong>${tanques.reduce((n, t) => n + t.total_panos, 0)}</strong><small>paños</small></div>
            <div><strong>${totalMoldes}</strong><small>moldes</small></div>
          </div>` : ''}

        <div class="lista-tanques">
          ${tanques.map((t) => `
            <div class="tanque-fila">
              <button class="tanque-tarjeta" data-id="${esc(t.id)}">
                <span class="tanque-nombre">${esc(t.nombre)}</span>
                <span class="tanque-datos">
                  <span><strong>${t.total_panos}</strong> paños · <strong>${t.total_canastas}</strong> canastas</span>
                  <span class="tanque-moldes"><strong>${t.total_moldes}</strong> moldes</span>
                </span>
                <span class="tanque-flecha">›</span>
              </button>
              ${puedeConfigurar
                ? `<button class="tanque-acciones" data-acciones="${esc(t.id)}"
                           title="Más cosas que hacer con ${esc(t.nombre)}"
                           aria-label="Más cosas que hacer con ${esc(t.nombre)}">⋯</button>`
                : ''}
            </div>`).join('') || `
            <div class="tarjeta plana" style="text-align:center;padding:34px 20px">
              <div style="font-size:44px">🧊</div>
              <p class="ayuda" style="margin:10px 0 0">
                Todavía no hay tanques.<br>Crea el primero para empezar.
              </p>
            </div>`}
        </div>

        ${puedeConfigurar ? '<button id="nuevo" class="nuevo-tanque">＋ Nuevo tanque</button>' : ''}
      </div>`;

    if (puedeConfigurar) pantalla.querySelector('#nuevo').onclick = formularioTanque;
    pantalla.querySelectorAll('.tanque-tarjeta').forEach((b) => {
      b.onclick = () => detalle(b.dataset.id);
    });
    pantalla.querySelectorAll('[data-acciones]').forEach((b) => {
      b.onclick = () => accionesRapidas(tanques.find((t) => t.id === b.dataset.acciones));
    });
  }

  /**
   * Acciones rápidas desde la lista, sin tener que entrar al tanque.
   * Lo más común es agregar paños, y para eso no hace falta abrir nada.
   */
  async function accionesRapidas(t) {
    const opcion = await menu({
      titulo: `Tanque ${t.nombre}`,
      texto: `${t.total_panos} paños · ${t.total_moldes} moldes`,
      opciones: [
        { valor: 'abrir', texto: 'Ver y configurar', detalle: 'Paños, canastas y moldes' },
        { valor: 'agregar', texto: 'Agregar paños', detalle: 'Uno o varios de golpe' },
        { valor: 'quitar', texto: 'Quitar los últimos paños', detalle: 'Si te pasaste al crearlo' },
        { valor: 'baja', texto: 'Dar de baja el tanque', detalle: 'Sale de producción', peligro: true }
      ]
    });

    if (opcion === 'abrir') return detalle(t.id);
    if (opcion === 'agregar') {
      const { tanque } = await api.obtener(`/tanques/${t.id}`);
      return agregarPanos(tanque, lista);
    }
    if (opcion === 'quitar') {
      const { tanque } = await api.obtener(`/tanques/${t.id}`);
      return quitarUltimosPanos(tanque, lista);
    }
    if (opcion === 'baja') {
      const sigue = await confirmar({
        titulo: `¿Dar de baja el tanque ${t.nombre}?`,
        texto: 'Sale de las pantallas de producción. Su historial se conserva completo.',
        ok: 'Dar de baja', peligro: true
      });
      if (!sigue) return;
      try {
        await api.enviar(`/tanques/${t.id}/baja`, {});
        avisar('Tanque fuera de servicio', 'bien');
        lista();
      } catch (e) { avisar(e.message, 'error'); }
    }
  }

  // ==========================================================
  // 2. ALTA DE TANQUE — se crea entero de un golpe
  // ==========================================================
  function formularioTanque() {
    // Plantilla = cuántos moldes lleva cada canasta de un paño.
    // El 2N de la fábrica es [3, 3, 3, 4]: tres canastas de 3 y una de 4.
    let plantilla = [3, 3, 3, 4];

    pantalla.innerHTML = `
      <h2>Nuevo tanque</h2>
      <p class="ayuda">
        Se crea completo de un golpe: sus paños, las canastas de cada paño
        y los moldes de cada canasta.
      </p>

      <div class="tarjeta">
        <label for="nombre">Nombre del tanque</label>
        <input id="nombre" placeholder="2N" required autocomplete="off">

        <label for="panos">¿Cuántos paños (filas) tiene?</label>
        <input id="panos" type="number" inputmode="numeric" min="1" max="100" value="14">

        <label for="horas">Horas de congelación</label>
        <input id="horas" type="number" inputmode="decimal" min="1" max="240" step="0.5" value="24">
        <p class="ayuda" style="margin:8px 0 0;font-size:14px">
          Es el punto de partida. Con el uso, el sistema aprende el tiempo real de este tanque.
        </p>
      </div>

      <h3>¿Cómo es un paño por dentro?</h3>
      <p class="ayuda">Toca una canasta para cambiarle los moldes.</p>

      <div class="tarjeta">
        <div class="canastas-fila" id="plantilla"></div>
        <div class="fila-botones" style="margin-top:16px">
          <button class="secundario chico" id="quitar">− Canasta</button>
          <button class="secundario chico" id="agregar">＋ Canasta</button>
        </div>
      </div>

      <div class="total-vivo" id="total"></div>

      <button id="guardar" style="margin-top:16px">Crear tanque</button>
      <button class="secundario" id="cancelar" style="margin-top:10px">Cancelar</button>`;

    const $ = (s) => pantalla.querySelector(s);

    function pintar() {
      $('#plantilla').innerHTML = plantilla.map((moldes, i) => `
        <button class="canasta" data-i="${i}">
          <span class="canasta-num">C${i + 1}</span>
          <span class="canasta-moldes">${moldes}</span>
          <span class="canasta-etiqueta">moldes</span>
        </button>`).join('');

      $('#plantilla').querySelectorAll('.canasta').forEach((b) => {
        b.onclick = async () => {
          const i = Number(b.dataset.i);
          const n = await pedirNumero({
            titulo: `Canasta ${i + 1}`,
            texto: '¿Cuántos moldes lleva esta canasta?',
            valor: plantilla[i], min: 1, max: 20
          });
          if (n === null) return;
          plantilla[i] = n;
          pintar();
        };
      });

      const porPano = plantilla.reduce((a, b) => a + b, 0);
      const panos = Number($('#panos').value) || 0;
      $('#total').innerHTML = `
        <span>${porPano} moldes por paño × ${panos} ${panos === 1 ? 'paño' : 'paños'}</span>
        <strong>${porPano * panos}</strong>
        <small>moldes en total</small>`;
    }

    pintar();
    $('#panos').oninput = pintar;

    $('#agregar').onclick = () => {
      if (plantilla.length >= 20) return avisar('Máximo 20 canastas por paño.', 'error');
      plantilla.push(3);
      pintar();
    };
    $('#quitar').onclick = () => {
      if (plantilla.length <= 1) return avisar('El paño necesita al menos una canasta.', 'error');
      plantilla.pop();
      pintar();
    };
    $('#cancelar').onclick = lista;

    $('#guardar').onclick = async () => {
      const boton = $('#guardar');
      boton.disabled = true;
      try {
        const { tanque } = await api.enviar('/tanques', {
          nombre: $('#nombre').value,
          panos: Number($('#panos').value),
          horasCongelacion: Number($('#horas').value),
          plantilla
        });
        avisar(`Tanque ${tanque.nombre}: ${tanque.total_moldes} moldes`, 'bien');
        detalle(tanque.id);
      } catch (e) {
        avisar(e.message, 'error');
        boton.disabled = false;
      }
    };
  }

  // ==========================================================
  // 3. DETALLE DEL TANQUE
  // ==========================================================
  async function detalle(id, { verBajas = false } = {}) {
    const { tanque } = await api.obtener(`/tanques/${id}${verBajas ? '?incluirInactivos=1' : ''}`);

    pantalla.innerHTML = `
      <button class="secundario chico" id="volver">‹ Todos los tanques</button>

      <div class="tanque-cabeza">
        <span class="tanque-nombre grande">${esc(tanque.nombre)}</span>
        <div>
          <div class="tanque-cifras">
            <span><strong>${tanque.total_panos}</strong> paños</span>
            <span><strong>${tanque.total_canastas}</strong> canastas</span>
            <span><strong>${tanque.total_moldes}</strong> moldes</span>
          </div>
          <small class="tanque-horas">${esc(tanque.horas_congelacion)} h de congelación</small>
        </div>
      </div>

      ${puedeConfigurar ? `
        <div class="fila-botones" style="margin:14px 0 16px">
          <button class="secundario chico" id="editar">Editar tanque</button>
          <button class="secundario chico" id="ver-bajas">
            ${verBajas ? 'Ocultar bajas' : 'Ver bajas'}
          </button>
        </div>` : ''}

      ${bloqueComoSeUsa()}

      <div class="panos">
        ${tanque.panos.map((p) => filaPano(p)).join('') ||
          '<p class="vacio">Este tanque no tiene paños.</p>'}
      </div>

      ${puedeConfigurar ? `
        <div class="fila-botones" style="margin-top:14px">
          <button id="agregar-pano">＋ Agregar paños</button>
          <button class="secundario" id="quitar-panos">− Quitar últimos</button>
        </div>` : ''}

      <p class="ayuda" style="margin-top:18px;font-size:14px">
        El número de la derecha es cuántas marquetas da ese paño.
        ${puedeConfigurar ? 'Toca una canasta o el botón ⋯ para cambiar algo.' : ''}
      </p>`;

    pantalla.querySelector('#volver').onclick = lista;
    if (!puedeConfigurar) return;

    pantalla.querySelector('#editar').onclick = () => editarTanque(tanque);
    pantalla.querySelector('#ver-bajas').onclick = () => detalle(id, { verBajas: !verBajas });
    pantalla.querySelector('#agregar-pano').onclick = () => agregarPanos(tanque);
    pantalla.querySelector('#quitar-panos').onclick = () => quitarUltimosPanos(tanque);

    pantalla.querySelectorAll('[data-canasta]').forEach((b) => {
      b.onclick = () => menuCanasta(tanque, b.dataset.canasta, verBajas);
    });
    pantalla.querySelectorAll('[data-pano]').forEach((b) => {
      b.onclick = () => menuPano(tanque, b.dataset.pano, verBajas);
    });

    // La fichita "＋" del final de cada fila: agrega una canasta sin menús.
    pantalla.querySelectorAll('[data-nueva-canasta]').forEach((b) => {
      b.onclick = async () => {
        const moldes = await pedirNumero({
          titulo: 'Canasta nueva',
          texto: 'Se agrega al final del paño. ¿Cuántos moldes lleva?',
          valor: 3, min: 1, max: 20, ok: 'Agregar'
        });
        if (moldes === null) return;
        try {
          await api.enviar(`/tanques/panos/${b.dataset.nuevaCanasta}/canastas`, { moldes });
          avisar('Canasta agregada', 'bien');
          detalle(id, { verBajas });
        } catch (e) { avisar(e.message, 'error'); }
      };
    });

    function filaPano(p) {
      return `
        <div class="pano ${p.activo ? '' : 'de-baja'}">
          <div class="pano-num">${p.numero}</div>
          <div class="canastas-fila">
            ${p.canastas.map((c) => `
              <button class="canasta ${c.activo ? '' : 'de-baja'}"
                      data-canasta="${esc(c.id)}" ${puedeConfigurar ? '' : 'disabled'}>
                <span class="canasta-num">C${c.numero}</span>
                <span class="canasta-moldes">${c.total_moldes}</span>
              </button>`).join('')}
            ${puedeConfigurar
              ? `<button class="canasta agregar" data-nueva-canasta="${esc(p.id)}"
                         title="Agregar una canasta a este paño">＋</button>`
              : ''}
          </div>
          <div class="pano-total">${p.total_moldes}</div>
          ${puedeConfigurar
            ? `<button class="pano-menu" data-pano="${esc(p.id)}" title="Opciones del paño">⋯</button>`
            : ''}
        </div>`;
    }
  }

  // ==========================================================
  // 4. ACCIONES
  // ==========================================================

  /**
   * Agregar paños. Se pueden pedir varios de un golpe: si borraste cinco por
   * error, volver a ponerlos uno por uno es una tortura.
   * Los nuevos se copian del último paño, que es lo normal al expandir.
   */
  async function agregarPanos(tanque, alTerminar) {
    const ultimo = tanque.panos.filter((p) => p.activo).at(-1);
    const plantilla = ultimo ? ultimo.canastas.filter((c) => c.activo).map((c) => c.total_moldes)
                             : [3, 3, 3, 4];
    const porPano = plantilla.reduce((a, b) => a + b, 0);

    const cantidad = await pedirNumero({
      titulo: 'Agregar paños',
      texto: `Cada uno se creará igual que el último: ${plantilla.length} canastas ` +
             `(${plantilla.join(' + ')}) = ${porPano} marquetas.`,
      valor: 1, min: 1, max: 100, ok: 'Agregar'
    });
    if (cantidad === null) return;

    try {
      const r = await api.enviar(`/tanques/${tanque.id}/panos`, { plantilla, cantidad });
      avisar(`${cantidad} ${cantidad === 1 ? 'paño agregado' : 'paños agregados'} · ` +
             `${r.tanque.total_moldes} moldes`, 'bien');
      (alTerminar || (() => detalle(tanque.id)))();
    } catch (e) { avisar(e.message, 'error'); }
  }

  /** Quitar de golpe los últimos paños: el arreglo de "me pasé al crear el tanque". */
  async function quitarUltimosPanos(tanque, alTerminar) {
    const activos = tanque.panos.filter((p) => p.activo).length;
    if (activos <= 1) return avisar('El tanque solo tiene un paño.', 'error');

    const cantidad = await pedirNumero({
      titulo: 'Quitar los últimos paños',
      texto: `El tanque tiene ${activos} paños. Se quitarán empezando por el último. ` +
             'No se borran: puedes recuperarlos desde "Ver bajas".',
      valor: 1, min: 1, max: activos - 1, ok: 'Quitar'
    });
    if (cantidad === null) return;

    try {
      const r = await api.enviar(`/tanques/${tanque.id}/panos/quitar-ultimos`, { cantidad });
      avisar(`${cantidad} ${cantidad === 1 ? 'paño quitado' : 'paños quitados'} · ` +
             `quedan ${r.tanque.total_panos}`, 'bien');
      (alTerminar || (() => detalle(tanque.id)))();
    } catch (e) { avisar(e.message, 'error'); }
  }

  /** Menú de un paño: agregar canasta, o quitar el paño completo. */
  async function menuPano(tanque, panoId, verBajas) {
    const pano = tanque.panos.find((p) => p.id === panoId);

    if (!pano.activo) {
      const sigue = await confirmar({
        titulo: `Recuperar el paño ${pano.numero}`,
        texto: 'Volverá a contar en los totales del tanque.',
        ok: 'Recuperar'
      });
      if (!sigue) return;
      try {
        await api.enviar(`/tanques/panos/${panoId}/alta`, {});
        avisar('Paño recuperado', 'bien');
        detalle(tanque.id, { verBajas });
      } catch (e) { avisar(e.message, 'error'); }
      return;
    }

    const opcion = await menu({
      titulo: `Paño ${pano.numero}`,
      texto: `${pano.canastas.filter((c) => c.activo).length} canastas · ${pano.total_moldes} marquetas`,
      opciones: [
        { valor: 'canasta', texto: 'Agregar una canasta', detalle: 'Se suma al final del paño' },
        { valor: 'quitar', texto: `Quitar el paño ${pano.numero}`,
          detalle: 'Deja de contar. Su historial se conserva', peligro: true }
      ]
    });

    if (opcion === 'canasta') {
      const moldes = await pedirNumero({
        titulo: 'Canasta nueva',
        texto: `¿Cuántos moldes lleva? Se agregará al paño ${pano.numero}.`,
        valor: 3, min: 1, max: 20, ok: 'Agregar'
      });
      if (moldes === null) return;
      try {
        await api.enviar(`/tanques/panos/${panoId}/canastas`, { moldes });
        avisar('Canasta agregada', 'bien');
        detalle(tanque.id, { verBajas });
      } catch (e) { avisar(e.message, 'error'); }
    }

    if (opcion === 'quitar') {
      const sigue = await confirmar({
        titulo: `¿Quitar el paño ${pano.numero}?`,
        texto: `Se dejarán de contar sus ${pano.total_moldes} marquetas. ` +
               'No se borra nada: puedes recuperarlo desde "Ver bajas".',
        ok: 'Quitar el paño', peligro: true
      });
      if (!sigue) return;
      try {
        await api.enviar(`/tanques/panos/${panoId}/baja`, {});
        avisar(`Paño ${pano.numero} quitado`, 'bien');
        detalle(tanque.id, { verBajas });
      } catch (e) { avisar(e.message, 'error'); }
    }
  }

  /** Menú de una canasta: cambiar moldes o quitarla. */
  async function menuCanasta(tanque, canastaId, verBajas) {
    const pano = tanque.panos.find((p) => p.canastas.some((c) => c.id === canastaId));
    const canasta = pano.canastas.find((c) => c.id === canastaId);

    if (!canasta.activo) return avisar('Esa canasta está dada de baja.');

    const opcion = await menu({
      titulo: `Paño ${pano.numero} · canasta ${canasta.numero}`,
      texto: `Ahora tiene ${canasta.total_moldes} moldes.`,
      opciones: [
        { valor: 'moldes', texto: 'Cambiar los moldes', detalle: 'Cuántas marquetas caben' },
        { valor: 'quitar', texto: 'Quitar la canasta',
          detalle: 'Deja de contar. Su historial se conserva', peligro: true }
      ]
    });

    if (opcion === 'moldes') {
      const moldes = await pedirNumero({
        titulo: `Canasta ${canasta.numero}`,
        texto: 'Los moldes que sobren se dan de baja, nunca se borran.',
        valor: canasta.total_moldes, min: 1, max: 20
      });
      if (moldes === null) return;
      try {
        await api.actualizar(`/tanques/canastas/${canastaId}/moldes`, { moldes });
        avisar('Canasta actualizada', 'bien');
        detalle(tanque.id, { verBajas });
      } catch (e) { avisar(e.message, 'error'); }
    }

    if (opcion === 'quitar') {
      const sigue = await confirmar({
        titulo: `¿Quitar la canasta ${canasta.numero}?`,
        texto: `Del paño ${pano.numero}. Deja de contar, pero su historial se conserva.`,
        ok: 'Quitar', peligro: true
      });
      if (!sigue) return;
      try {
        await api.enviar(`/tanques/canastas/${canastaId}/baja`, {});
        avisar('Canasta quitada', 'bien');
        detalle(tanque.id, { verBajas });
      } catch (e) { avisar(e.message, 'error'); }
    }
  }

  // ==========================================================
  // 5. EDITAR EL TANQUE
  // ==========================================================
  function editarTanque(tanque) {
    pantalla.innerHTML = `
      <h2>Editar ${esc(tanque.nombre)}</h2>
      <div class="tarjeta">
        <form id="f">
          <label for="nombre">Nombre</label>
          <input id="nombre" value="${esc(tanque.nombre)}" required autocomplete="off">

          <label for="horas">Horas de congelación</label>
          <input id="horas" type="number" min="1" max="240" step="0.5" value="${esc(tanque.horas_congelacion)}">

          <label for="notas">Notas</label>
          <input id="notas" value="${esc(tanque.notas || '')}" placeholder="Opcional" autocomplete="off">

          <button type="submit" style="margin-top:20px">Guardar</button>
          <button type="button" class="secundario" id="cancelar" style="margin-top:10px">Cancelar</button>
        </form>
      </div>

      <h3>Fuera de servicio</h3>
      <div class="tarjeta">
        <button class="peligro" id="baja">Dar de baja el tanque</button>
        <p class="ayuda" style="margin:14px 0 0">
          Desaparece de las pantallas de producción, pero su historial se conserva completo.
        </p>
      </div>`;

    pantalla.querySelector('#cancelar').onclick = () => detalle(tanque.id);

    pantalla.querySelector('#f').onsubmit = async (ev) => {
      ev.preventDefault();
      try {
        await api.actualizar(`/tanques/${tanque.id}`, {
          nombre: pantalla.querySelector('#nombre').value,
          horasCongelacion: Number(pantalla.querySelector('#horas').value),
          notas: pantalla.querySelector('#notas').value
        });
        avisar('Cambios guardados', 'bien');
        detalle(tanque.id);
      } catch (e) { avisar(e.message, 'error'); }
    };

    pantalla.querySelector('#baja').onclick = async () => {
      const sigue = await confirmar({
        titulo: `¿Dar de baja el tanque ${tanque.nombre}?`,
        texto: 'Sale de las pantallas de producción. Su historial se conserva completo.',
        ok: 'Dar de baja', peligro: true
      });
      if (!sigue) return;
      try {
        await api.enviar(`/tanques/${tanque.id}/baja`, {});
        avisar('Tanque fuera de servicio', 'bien');
        lista();
      } catch (e) { avisar(e.message, 'error'); }
    };
  }
}
