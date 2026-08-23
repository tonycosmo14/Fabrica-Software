/**
 * TANQUES — configurador (v0.2)
 *
 * Dos pantallas:
 *   1. Lista de tanques con sus totales
 *   2. Detalle: los paños del tanque, cada uno con sus canastas
 *
 * La canasta es el bloque visual, no el molde (sección 6.2 del plan):
 * así los 18 paños de un tanque caben en la pantalla de un celular.
 * Los moldes se ven al entrar a una canasta.
 */
import { api } from '../api.js';
import { esc, avisar } from '../util.js';

export async function vistaTanques(pantalla, estado) {
  const puedeConfigurar = estado.permisos.includes('*') ||
                          estado.permisos.includes('tanques.configurar');

  await lista();

  // ----------------------------------------------------------
  // 1. LISTA DE TANQUES
  // ----------------------------------------------------------
  async function lista() {
    const { tanques, totalMoldes } = await api.obtener('/tanques');

    pantalla.innerHTML = `
      <h2>Tanques</h2>
      <p class="ayuda">
        La estructura física de la fábrica: cada tanque tiene paños, cada paño
        canastas, y cada canasta moldes. Un molde es una marqueta.
      </p>

      ${tanques.length ? `
        <div class="resumen-fabrica">
          <div><strong>${tanques.length}</strong><small>tanques</small></div>
          <div><strong>${tanques.reduce((n, t) => n + t.total_panos, 0)}</strong><small>paños</small></div>
          <div><strong>${totalMoldes}</strong><small>moldes</small></div>
        </div>` : ''}

      ${puedeConfigurar ? '<button id="nuevo">＋ Nuevo tanque</button>' : ''}

      <div style="margin-top:16px">
        ${tanques.map((t) => `
          <button class="tanque-tarjeta" data-id="${esc(t.id)}">
            <span class="tanque-nombre">${esc(t.nombre)}</span>
            <span class="tanque-datos">
              <span><strong>${t.total_panos}</strong> paños</span>
              <span><strong>${t.total_canastas}</strong> canastas</span>
              <span><strong>${t.total_moldes}</strong> moldes</span>
            </span>
            <span class="tanque-horas">${esc(t.horas_congelacion)} h</span>
          </button>`).join('') ||
          '<p class="vacio">Todavía no hay tanques.<br>Crea el primero para empezar.</p>'}
      </div>`;

    if (puedeConfigurar) pantalla.querySelector('#nuevo').onclick = formularioTanque;
    pantalla.querySelectorAll('.tanque-tarjeta').forEach((b) => {
      b.onclick = () => detalle(b.dataset.id);
    });
  }

  // ----------------------------------------------------------
  // 2. ALTA DE TANQUE — se crea entero de un golpe
  // ----------------------------------------------------------
  function formularioTanque() {
    // Plantilla = cuántos moldes lleva cada canasta de un paño.
    // El 2N de la fábrica es [3, 3, 3, 4]: tres canastas de 3 y una de 4.
    let plantilla = [3, 3, 3, 4];

    pantalla.innerHTML = `
      <h2>Nuevo tanque</h2>
      <p class="ayuda">Se crea completo: sus paños, las canastas de cada paño y los moldes de cada canasta.</p>

      <div class="tarjeta">
        <label for="nombre">Nombre del tanque</label>
        <input id="nombre" placeholder="2N" required>

        <label for="panos">¿Cuántos paños (filas) tiene?</label>
        <input id="panos" type="number" inputmode="numeric" min="1" max="100" value="14">

        <label for="horas">Horas de congelación</label>
        <input id="horas" type="number" inputmode="decimal" min="1" max="240" step="0.5" value="24">
        <p class="ayuda" style="margin:6px 0 0;font-size:14px">
          Es solo el punto de partida. Con el uso, el sistema aprende el tiempo real de este tanque.
        </p>
      </div>

      <h3>Canastas de cada paño</h3>
      <p class="ayuda">Toca una canasta para cambiarle los moldes.</p>
      <div class="tarjeta">
        <div class="canastas-fila" id="plantilla"></div>
        <div class="fila-botones" style="margin-top:14px">
          <button class="secundario chico" id="quitar">− Quitar canasta</button>
          <button class="secundario chico" id="agregar">＋ Agregar canasta</button>
        </div>
        <p class="total-vivo" id="total"></p>
      </div>

      <button id="guardar" style="margin-top:8px">Crear tanque</button>
      <button class="secundario" id="cancelar" style="margin-top:10px">Cancelar</button>`;

    const $ = (s) => pantalla.querySelector(s);

    function pintarPlantilla() {
      $('#plantilla').innerHTML = plantilla.map((moldes, i) => `
        <button class="canasta" data-i="${i}">
          <span class="canasta-num">C${i + 1}</span>
          <span class="canasta-moldes">${moldes}</span>
          <span class="canasta-etiqueta">moldes</span>
        </button>`).join('');

      $('#plantilla').querySelectorAll('.canasta').forEach((b) => {
        b.onclick = () => {
          const i = Number(b.dataset.i);
          const valor = prompt(`¿Cuántos moldes tiene la canasta ${i + 1}?`, plantilla[i]);
          const n = Number(valor);
          if (!Number.isInteger(n) || n < 1 || n > 20) {
            if (valor !== null) avisar('Debe ser un número entre 1 y 20.', 'error');
            return;
          }
          plantilla[i] = n;
          pintarPlantilla();
        };
      });

      const porPano = plantilla.reduce((a, b) => a + b, 0);
      const panos = Number($('#panos').value) || 0;
      $('#total').innerHTML =
        `<strong>${porPano}</strong> moldes por paño × <strong>${panos}</strong> paños =
         <strong class="grande">${porPano * panos}</strong> moldes en total`;
    }

    pintarPlantilla();
    $('#panos').oninput = pintarPlantilla;

    $('#agregar').onclick = () => {
      if (plantilla.length >= 20) return avisar('Máximo 20 canastas por paño.', 'error');
      plantilla.push(3);
      pintarPlantilla();
    };
    $('#quitar').onclick = () => {
      if (plantilla.length <= 1) return avisar('El paño necesita al menos una canasta.', 'error');
      plantilla.pop();
      pintarPlantilla();
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
        avisar(`Tanque ${tanque.nombre} creado con ${tanque.total_moldes} moldes`, 'bien');
        detalle(tanque.id);
      } catch (e) {
        avisar(e.message, 'error');
        boton.disabled = false;
      }
    };
  }

  // ----------------------------------------------------------
  // 3. DETALLE DEL TANQUE
  // ----------------------------------------------------------
  async function detalle(id) {
    const { tanque } = await api.obtener(`/tanques/${id}`);

    pantalla.innerHTML = `
      <div class="cabeza-tanque">
        <button class="secundario chico" id="volver">‹ Tanques</button>
        <h2 style="margin:10px 0 4px">${esc(tanque.nombre)}</h2>
        <p class="ayuda" style="margin:0">
          ${tanque.total_panos} paños · ${tanque.total_canastas} canastas ·
          <strong>${tanque.total_moldes} moldes</strong> · ${esc(tanque.horas_congelacion)} h de congelación
        </p>
      </div>

      ${puedeConfigurar ? `
        <div class="fila-botones" style="margin:16px 0">
          <button class="secundario chico" id="editar">Editar tanque</button>
          <button class="secundario chico" id="agregar-pano">＋ Paño</button>
        </div>` : ''}

      <div class="panos">
        ${tanque.panos.map((p) => `
          <div class="pano">
            <div class="pano-num">${p.numero}</div>
            <div class="canastas-fila">
              ${p.canastas.map((c) => `
                <button class="canasta" data-canasta="${esc(c.id)}" ${puedeConfigurar ? '' : 'disabled'}>
                  <span class="canasta-num">C${c.numero}</span>
                  <span class="canasta-moldes">${c.total_moldes}</span>
                </button>`).join('')}
              ${puedeConfigurar ? `<button class="canasta agregar" data-pano="${esc(p.id)}">＋</button>` : ''}
            </div>
            <div class="pano-total">${p.total_moldes}</div>
          </div>`).join('') || '<p class="vacio">Este tanque no tiene paños.</p>'}
      </div>

      <p class="ayuda" style="margin-top:18px;font-size:14px">
        El número gris de la derecha es cuántas marquetas da ese paño.
      </p>`;

    pantalla.querySelector('#volver').onclick = lista;

    if (!puedeConfigurar) return;

    pantalla.querySelector('#editar').onclick = () => editarTanque(tanque);

    pantalla.querySelector('#agregar-pano').onclick = async () => {
      // El paño nuevo se copia del último, que es lo normal al expandir.
      const ultimo = tanque.panos[tanque.panos.length - 1];
      const plantilla = ultimo ? ultimo.canastas.map((c) => c.total_moldes) : [3, 3, 3, 4];
      if (!confirm(`Se agregará el paño ${tanque.panos.length + 1} con ${plantilla.length} canastas (${plantilla.join(', ')} moldes). ¿Continuar?`)) return;
      try {
        await api.enviar(`/tanques/${tanque.id}/panos`, { plantilla });
        avisar('Paño agregado', 'bien');
        detalle(tanque.id);
      } catch (e) { avisar(e.message, 'error'); }
    };

    pantalla.querySelectorAll('[data-canasta]').forEach((b) => {
      b.onclick = () => menuCanasta(tanque, b.dataset.canasta);
    });

    pantalla.querySelectorAll('[data-pano]').forEach((b) => {
      b.onclick = async () => {
        const valor = prompt('¿Cuántos moldes tiene la canasta nueva?', '3');
        if (valor === null) return;
        try {
          await api.enviar(`/tanques/panos/${b.dataset.pano}/canastas`, { moldes: Number(valor) });
          avisar('Canasta agregada', 'bien');
          detalle(tanque.id);
        } catch (e) { avisar(e.message, 'error'); }
      };
    });
  }

  // ----------------------------------------------------------
  // 4. ACCIONES SOBRE UNA CANASTA
  // ----------------------------------------------------------
  async function menuCanasta(tanque, canastaId) {
    const pano = tanque.panos.find((p) => p.canastas.some((c) => c.id === canastaId));
    const canasta = pano.canastas.find((c) => c.id === canastaId);

    const opcion = prompt(
      `Paño ${pano.numero}, canasta ${canasta.numero} — ${canasta.total_moldes} moldes\n\n` +
      '1 = cambiar cuántos moldes tiene\n' +
      '2 = dar de baja la canasta\n\n' +
      'Escribe 1 o 2:', '1');

    if (opcion === '1') {
      const valor = prompt('¿Cuántos moldes debe tener?', canasta.total_moldes);
      if (valor === null) return;
      try {
        await api.actualizar(`/tanques/canastas/${canastaId}/moldes`, { moldes: Number(valor) });
        avisar('Canasta actualizada', 'bien');
        detalle(tanque.id);
      } catch (e) { avisar(e.message, 'error'); }
    } else if (opcion === '2') {
      if (!confirm(`¿Dar de baja la canasta ${canasta.numero} del paño ${pano.numero}?\n\nNo se borra: deja de contar, pero su historial se conserva.`)) return;
      try {
        await api.enviar(`/tanques/canastas/${canastaId}/baja`, {});
        avisar('Canasta dada de baja', 'bien');
        detalle(tanque.id);
      } catch (e) { avisar(e.message, 'error'); }
    }
  }

  // ----------------------------------------------------------
  // 5. EDITAR DATOS DEL TANQUE
  // ----------------------------------------------------------
  function editarTanque(tanque) {
    pantalla.innerHTML = `
      <h2>Editar ${esc(tanque.nombre)}</h2>
      <div class="tarjeta">
        <form id="f">
          <label for="nombre">Nombre</label>
          <input id="nombre" value="${esc(tanque.nombre)}" required>

          <label for="horas">Horas de congelación</label>
          <input id="horas" type="number" min="1" max="240" step="0.5" value="${esc(tanque.horas_congelacion)}">

          <label for="notas">Notas</label>
          <input id="notas" value="${esc(tanque.notas || '')}" placeholder="Opcional">

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
      if (!confirm(`¿Dar de baja el tanque ${tanque.nombre}?`)) return;
      try {
        await api.enviar(`/tanques/${tanque.id}/baja`, {});
        avisar('Tanque fuera de servicio', 'bien');
        lista();
      } catch (e) { avisar(e.message, 'error'); }
    };
  }
}
