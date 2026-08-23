/**
 * PRODUCCIÓN  (v0.3)
 *
 * La pantalla del trabajo diario. Pestañas por tanque, un paño por renglón,
 * y cada canasta pintada del color de su estado.
 *
 * EL FLUJO NORMAL ES UN TAP (sección 6.6 y 12 del plan):
 *   canasta lista  -> tap = sacarla, todos los moldes bien
 *   canasta fuera  -> tap = rellenarla
 * Las excepciones (marcar merma molde por molde, cambiar el agua, sacar sin
 * rellenar) están en el menú ⋯ de la canasta.
 */
import { api } from '../api.js';
import { esc, avisar, fecha as formatoFecha } from '../util.js';
import { confirmar, menu } from '../dialogo.js';

const COLOR_ESTADO = { congelando: 'congelando', lista: 'lista', fuera: 'fuera' };

export async function vistaProduccion(pantalla, estado) {
  const puedeRegistrar = estado.permisos.includes('*') ||
                         estado.permisos.includes('produccion.registrar');

  // El agua elegida se recuerda durante la sesión: preguntarla en cada
  // canasta rompería el flujo de un tap.
  let aguaActual = localStorage.getItem('tipo_agua') || 'purificada';
  let tanqueActivo = localStorage.getItem('tanque_activo') || null;

  await pintar();

  async function pintar() {
    const datos = await api.obtener(
      `/produccion/estado${tanqueActivo ? `?tanque=${encodeURIComponent(tanqueActivo)}` : ''}`);

    if (!datos.tanques.length) {
      pantalla.innerHTML = `
        <h2>Producción</h2>
        <div class="tarjeta plana" style="text-align:center;padding:34px 20px">
          <div style="font-size:44px">🧊</div>
          <p class="ayuda" style="margin:12px 0 0">
            Todavía no hay tanques dados de alta.<br>
            Primero configúralos en <strong>Configurar tanques</strong>.
          </p>
          <a class="boton" href="#/config-tanques" style="margin-top:16px">Ir a configurar</a>
        </div>`;
      return;
    }

    const { tanques, tanque, sugerido, turno, fuera } = datos;
    tanqueActivo = tanque.id;
    localStorage.setItem('tanque_activo', tanqueActivo);

    pantalla.innerHTML = `
      <div class="pestanas">
        ${tanques.map((t) => `
          <button class="pestana ${t.id === tanque.id ? 'activa' : ''}"
                  data-tanque="${esc(t.id)}">${esc(t.nombre)}</button>`).join('')}
      </div>

      ${turno ? `
        <div class="turno-barra">
          <span class="turno-info">
            🕐 ${esc(turno.nombre || 'Turno')} · ${esc(turno.abierto_por_nombre || '')}
          </span>
          ${sugerido ? `<span class="sugerencia">sigue paño ${sugerido.numero}</span>` : ''}
        </div>` : `
        <div class="turno-barra sin-turno">
          <span class="turno-info">No hay turno abierto</span>
          ${puedeRegistrar ? '<button class="chico" id="abrir-turno">Abrir turno</button>' : ''}
        </div>`}

      ${fuera ? `
        <div class="alerta-fuera">
          ⚠️ ${fuera} ${fuera === 1 ? 'canasta sacada sin rellenar' : 'canastas sacadas sin rellenar'}
        </div>` : ''}

      <div class="panos-produccion">
        ${tanque.panos.map((p) => filaPano(p, sugerido)).join('') ||
          '<p class="vacio">Este tanque no tiene paños.</p>'}
      </div>

      <div class="leyenda">
        <span><i class="punto-estado congelando"></i> congelando</span>
        <span><i class="punto-estado lista"></i> lista</span>
        <span><i class="punto-estado fuera"></i> sin rellenar</span>
      </div>

      ${turno && puedeRegistrar ? `
        <div class="fila-botones" style="margin-top:18px">
          <button class="secundario chico" id="ver-turno">Resumen del turno</button>
          <button class="secundario chico" id="cerrar-turno">Cerrar turno</button>
        </div>` : ''}`;

    // --- eventos ---
    pantalla.querySelectorAll('[data-tanque]').forEach((b) => {
      b.onclick = () => { tanqueActivo = b.dataset.tanque; pintar(); };
    });

    const btnAbrir = pantalla.querySelector('#abrir-turno');
    if (btnAbrir) btnAbrir.onclick = abrirTurno;

    const btnCerrar = pantalla.querySelector('#cerrar-turno');
    if (btnCerrar) btnCerrar.onclick = cerrarTurno;

    const btnResumen = pantalla.querySelector('#ver-turno');
    if (btnResumen) btnResumen.onclick = verResumen;

    if (puedeRegistrar && turno) {
      pantalla.querySelectorAll('[data-canasta]').forEach((b) => {
        b.onclick = () => unTap(b.dataset.canasta, tanque);
      });
      pantalla.querySelectorAll('[data-mas]').forEach((b) => {
        b.onclick = (ev) => { ev.stopPropagation(); menuCanasta(b.dataset.mas, tanque); };
      });
    }
  }

  /** Un paño: su número, sus canastas con los moldes, y las horas a la derecha. */
  function filaPano(p, sugerido) {
    const esSugerido = sugerido && sugerido.id === p.id;
    const derecha = p.estado === 'fuera' ? 'fuera'
                  : p.estado === 'lista' ? 'listo'
                  : `${Math.floor(p.horas)} h`;

    return `
      <div class="pano-prod ${esSugerido ? 'sugerido' : ''}">
        <div class="pano-prod-num">${p.numero}</div>
        <div class="canastas-prod">
          ${p.canastas.map((c) => `
            <button class="canasta-prod ${COLOR_ESTADO[c.estado]} ${c.sinRegistro ? 'sin-registro' : ''}"
                    data-canasta="${esc(c.id)}"
                    title="Canasta ${c.numero} · ${c.estado}">
              ${c.moldes.map(() => '<i class="molde"></i>').join('')}
            </button>`).join('')}
        </div>
        <div class="pano-prod-horas ${p.estado}">${derecha}</div>
        <button class="mas-canasta" data-mas="${esc(p.id)}" title="Opciones del paño">⋯</button>
      </div>`;
  }

  // ==========================================================
  // UN TAP
  // ==========================================================
  async function unTap(canastaId, tanque) {
    const { pano, canasta } = ubicar(tanque, canastaId);

    if (canasta.estado === 'fuera') {
      return rellenar(canasta, pano);
    }

    if (canasta.estado === 'congelando') {
      const sigue = await confirmar({
        titulo: `Le faltan ${Math.ceil(canasta.listaEn)} h`,
        texto: `La canasta ${canasta.numero} del paño ${pano.numero} lleva ` +
               `${Math.floor(canasta.horas)} h congelando. ¿Sacarla de todos modos?`,
        ok: 'Sacar igual'
      });
      if (!sigue) return;
    }

    await sacar(canasta, pano);
  }

  async function sacar(canasta, pano, resultados) {
    try {
      const r = await api.enviar('/produccion/sacar', {
        canastaId: canasta.id,
        resultados: resultados || undefined
      });
      const merma = (r.sacada.resumen.merma || 0) + (r.sacada.resumen.hueco || 0);
      avisar(`Paño ${pano.numero} · ${r.marquetas} marquetas` +
             (merma ? ` · ${merma} de merma` : ''), 'bien');
      await pintar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function rellenar(canasta, pano) {
    try {
      await api.enviar('/produccion/rellenar', { canastaId: canasta.id, tipoAgua: aguaActual });
      avisar(`Paño ${pano.numero} rellenado con agua ${aguaActual}`, 'bien');
      await pintar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  // ==========================================================
  // MENÚ DEL PAÑO — las excepciones
  // ==========================================================
  async function menuCanasta(panoId, tanque) {
    const pano = tanque.panos.find((p) => p.id === panoId);

    const opcion = await menu({
      titulo: `Paño ${pano.numero}`,
      texto: `${pano.canastas.length} canastas · ${pano.total_moldes} marquetas`,
      opciones: [
        { valor: 'sacar-todo', texto: 'Sacar el paño completo', detalle: 'Todas sus canastas, todo bien' },
        { valor: 'rellenar-todo', texto: 'Rellenar el paño completo', detalle: `Con agua ${aguaActual}` },
        { valor: 'merma', texto: 'Sacar marcando merma', detalle: 'Molde por molde' },
        { valor: 'agua', texto: `Cambiar el agua (ahora: ${aguaActual})`, detalle: 'Purificada o potable' }
      ]
    });

    if (opcion === 'sacar-todo') {
      for (const c of pano.canastas.filter((x) => x.estado !== 'fuera')) {
        try { await api.enviar('/produccion/sacar', { canastaId: c.id }); } catch { /* sigue */ }
      }
      avisar(`Paño ${pano.numero} sacado`, 'bien');
      return pintar();
    }

    if (opcion === 'rellenar-todo') {
      for (const c of pano.canastas) {
        try { await api.enviar('/produccion/rellenar', { canastaId: c.id, tipoAgua: aguaActual }); }
        catch { /* sigue */ }
      }
      avisar(`Paño ${pano.numero} rellenado`, 'bien');
      return pintar();
    }

    if (opcion === 'agua') {
      const elegida = await menu({
        titulo: 'Tipo de agua',
        texto: 'Queda registrado en cada rellenado.',
        opciones: [
          { valor: 'purificada', texto: 'Purificada' },
          { valor: 'potable', texto: 'Potable' }
        ]
      });
      if (!elegida) return;
      aguaActual = elegida;
      localStorage.setItem('tipo_agua', elegida);
      avisar(`Ahora se rellena con agua ${elegida}`, 'bien');
      return pintar();
    }

    if (opcion === 'merma') return pantallaMerma(pano, tanque);
  }

  /** Marcar el resultado molde por molde. Es la excepción, no el flujo normal. */
  async function pantallaMerma(pano, tanque) {
    const sacables = pano.canastas.filter((c) => c.estado !== 'fuera');
    if (!sacables.length) return avisar('Ese paño ya está fuera del tanque.', 'error');

    const marcas = new Map();   // moldeId -> resultado

    const dibujar = () => {
      pantalla.innerHTML = `
        <button class="secundario chico" id="volver">‹ Producción</button>
        <h2 style="margin-top:14px">Paño ${pano.numero} · merma</h2>
        <p class="ayuda">
          Toca un molde para cambiar cómo salió. Los que no toques cuentan como buenos.
        </p>

        ${sacables.map((c) => `
          <div class="tarjeta">
            <strong style="display:block;margin-bottom:10px">Canasta ${c.numero}</strong>
            <div class="moldes-detalle">
              ${c.moldes.map((m) => {
                const r = marcas.get(m.id) || 'ok';
                return `<button class="molde-boton ${r}" data-molde="${esc(m.id)}">
                          <span class="molde-num">${m.numero}</span>
                          <span class="molde-estado">${etiquetaResultado(r)}</span>
                        </button>`;
              }).join('')}
            </div>
          </div>`).join('')}

        <div class="total-vivo">
          <span>de ${totalMoldes()} moldes</span>
          <strong>${totalMoldes() - marcas.size}</strong>
          <small>marquetas buenas</small>
        </div>

        <button id="guardar" style="margin-top:14px">Registrar la sacada</button>`;

      pantalla.querySelector('#volver').onclick = pintar;

      pantalla.querySelectorAll('[data-molde]').forEach((b) => {
        b.onclick = () => {
          const id = b.dataset.molde;
          const actual = marcas.get(id) || 'ok';
          const siguiente = actual === 'ok' ? 'merma' : actual === 'merma' ? 'hueco' : null;
          if (siguiente) marcas.set(id, siguiente); else marcas.delete(id);
          dibujar();
        };
      });

      pantalla.querySelector('#guardar').onclick = async () => {
        for (const c of sacables) {
          const resultados = c.moldes
            .filter((m) => marcas.has(m.id))
            .map((m) => ({ moldeId: m.id, resultado: marcas.get(m.id) }));
          try { await api.enviar('/produccion/sacar', { canastaId: c.id, resultados }); }
          catch (e) { avisar(e.message, 'error'); return; }
        }
        avisar(`Paño ${pano.numero} registrado`, 'bien');
        pintar();
      };
    };

    const totalMoldes = () => sacables.reduce((n, c) => n + c.moldes.length, 0);
    dibujar();
  }

  function etiquetaResultado(r) {
    return r === 'ok' ? 'bien' : r === 'merma' ? 'merma' : 'hueco';
  }

  function ubicar(tanque, canastaId) {
    const pano = tanque.panos.find((p) => p.canastas.some((c) => c.id === canastaId));
    return { pano, canasta: pano.canastas.find((c) => c.id === canastaId) };
  }

  // ==========================================================
  // TURNO
  // ==========================================================
  async function abrirTurno() {
    const nombre = await menu({
      titulo: 'Abrir turno de producción',
      texto: 'Todo lo que se saque y se rellene quedará dentro de este turno.',
      opciones: [
        { valor: 'Matutino', texto: 'Matutino' },
        { valor: 'Vespertino', texto: 'Vespertino' },
        { valor: 'Noche', texto: 'Noche' },
        { valor: '', texto: 'Sin nombre', detalle: 'Solo la hora de apertura' }
      ]
    });
    if (nombre === null) return;

    try {
      await api.enviar('/produccion/turno/abrir', { nombre });
      avisar('Turno abierto', 'bien');
      pintar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function cerrarTurno() {
    try {
      await api.enviar('/produccion/turno/cerrar', {});
      avisar('Turno cerrado', 'bien');
      return pintar();
    } catch (e) {
      // Quedaron canastas fuera del tanque: se avisa antes de cerrar (6.3).
      if (e.codigo !== 409) return avisar(e.message, 'error');

      const sigue = await confirmar({
        titulo: 'Quedan canastas sin rellenar',
        texto: `${e.message} Si cierras el turno así, queda constancia de cuántas quedaron.`,
        ok: 'Cerrar de todos modos', peligro: true
      });
      if (!sigue) return;

      try {
        await api.enviar('/produccion/turno/cerrar', { forzar: true });
        avisar('Turno cerrado', 'bien');
        pintar();
      } catch (e2) { avisar(e2.message, 'error'); }
    }
  }

  async function verResumen() {
    const r = await api.obtener('/produccion/resumen-turno');
    const { movimientos } = await api.obtener('/produccion/movimientos?limite=20');

    pantalla.innerHTML = `
      <button class="secundario chico" id="volver">‹ Producción</button>
      <h2 style="margin-top:14px">Turno ${esc(r.turno?.nombre || '')}</h2>
      <p class="ayuda">Abierto ${esc(formatoFecha(r.turno?.abierto_en))}</p>

      <div class="resumen-fabrica">
        <div><strong>${r.marquetas}</strong><small>marquetas</small></div>
        <div><strong>${r.merma}</strong><small>merma</small></div>
        <div><strong>${r.fuera}</strong><small>sin rellenar</small></div>
      </div>

      <h3>Movimientos</h3>
      <div class="tarjeta plana">
        <table class="tabla">
          <tr><th>Hora</th><th>Qué</th><th>Dónde</th><th>Quién</th></tr>
          ${movimientos.map((m) => `
            <tr>
              <td>${esc(new Date(m.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }))}</td>
              <td>${m.tipo === 'sacada'
                    ? `sacó <strong>${m.marquetas}</strong>`
                    : `rellenó <small>${esc(m.tipo_agua)}</small>`}</td>
              <td>${esc(m.tanque)} · paño ${m.pano} · C${m.canasta}</td>
              <td>${esc(m.quien || '—')}</td>
            </tr>`).join('') || '<tr><td colspan="4">Todavía no hay movimientos.</td></tr>'}
        </table>
      </div>`;

    pantalla.querySelector('#volver').onclick = pintar;
  }
}
