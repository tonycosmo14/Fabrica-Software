/**
 * PRODUCCIÓN  (v0.4 — el flujo real de la fábrica)
 *
 * Dos formas de trabajar, las dos válidas y sobre los mismos datos:
 *
 *  1. EN VIVO — una pantalla táctil junto a los tanques. El obrero toca el
 *     paño que le toca y queda registrado con su hora.
 *
 *  2. AL FINAL DE LA JORNADA — el obrero llega a caja y dice "saqué el 1, el
 *     3 y el 5". El cajero marca esos paños y los captura de golpe.
 *     Es como funciona hoy, y por eso es el botón grande de arriba.
 *
 * La rotación intercalada (1, 3, 5... luego 2, 4, 6...) es regla: el paño que
 * toca aparece resaltado y sacar otro pide autorización de gerente o admin.
 */
import { api } from '../api.js';
import { esc, avisar } from '../util.js';
import { confirmar, menu, pedirNumero } from '../dialogo.js';

export async function vistaProduccion(pantalla, estado) {
  const puedeRegistrar = estado.permisos.includes('*') ||
                         estado.permisos.includes('produccion.registrar');

  let agua = localStorage.getItem('tipo_agua') || 'purificada';
  let tanqueActivo = localStorage.getItem('tanque_activo') || null;
  let datos = null;

  await pintar();

  async function pintar() {
    datos = await api.obtener(
      `/produccion/estado${tanqueActivo ? `?tanque=${encodeURIComponent(tanqueActivo)}` : ''}`);

    if (!datos.tanques.length) return sinTanques();

    const { tanques, tanque, fuera } = datos;
    tanqueActivo = tanque.id;
    localStorage.setItem('tanque_activo', tanqueActivo);

    const toca = tanque.siguiente;

    pantalla.innerHTML = `
      <div class="pestanas">
        ${tanques.map((t) => `
          <button class="pestana ${t.id === tanque.id ? 'activa' : ''}"
                  data-tanque="${esc(t.id)}">${esc(t.nombre)}</button>`).join('')}
      </div>

      <div class="barra-produccion">
        ${toca ? `
          <div class="toca">
            <span class="toca-etiqueta">toca</span>
            <strong>paño ${toca.numero}</strong>
            <small>${esc(toca.porque)}</small>
          </div>` : '<div class="toca"><small>Este tanque no tiene paños.</small></div>'}

        ${puedeRegistrar ? `
          <button class="agua-boton ${agua}" id="agua" title="Cambiar el agua">
            <span class="agua-icono">💧</span>
            <span>${agua === 'purificada' ? 'Purificada' : 'Potable'}</span>
          </button>` : ''}
      </div>

      ${fuera ? `
        <div class="alerta-fuera">
          ⚠️ ${fuera} ${fuera === 1 ? 'canasta quedó fuera del tanque' : 'canastas quedaron fuera del tanque'}
        </div>` : ''}

      ${puedeRegistrar ? `
        <button id="lote" class="boton-lote">
          📋 Registrar lo que sacó un obrero
        </button>` : ''}

      <div class="panos-produccion">
        ${tanque.panos.map((p) => filaPano(p, toca)).join('') ||
          '<p class="vacio">Este tanque no tiene paños.</p>'}
      </div>

      <div class="leyenda">
        <span><i class="punto-estado congelando"></i> congelando</span>
        <span><i class="punto-estado lista"></i> lista</span>
        <span><i class="punto-estado fuera"></i> fuera del tanque</span>
        <span><i class="punto-estado proceso"></i> a medias</span>
        <span><i class="punto-estado merma"></i> falló la última vez</span>
      </div>

      <div class="fila-botones" style="margin-top:16px">
        <button class="secundario chico" id="ver-hoy">Lo de hoy</button>
      </div>`;

    pantalla.querySelectorAll('[data-tanque]').forEach((b) => {
      b.onclick = () => { tanqueActivo = b.dataset.tanque; pintar(); };
    });
    pantalla.querySelector('#ver-hoy').onclick = verHoy;

    if (!puedeRegistrar) return;

    // Un solo toque para cambiar el agua: sin entrar a ningún menú.
    pantalla.querySelector('#agua').onclick = () => {
      agua = agua === 'purificada' ? 'potable' : 'purificada';
      localStorage.setItem('tipo_agua', agua);
      pintar();
    };

    pantalla.querySelector('#lote').onclick = capturaEnLote;

    pantalla.querySelectorAll('[data-pano]').forEach((b) => {
      b.onclick = () => sacarPano(b.dataset.pano);
    });
    pantalla.querySelectorAll('[data-mas]').forEach((b) => {
      b.onclick = (ev) => { ev.stopPropagation(); masOpciones(b.dataset.mas); };
    });
  }

  function sinTanques() {
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
  }

  /** Una fila = un paño. El botón grande saca el paño completo. */
  function filaPano(p, toca) {
    const esElQueToca = toca && toca.id === p.id;
    const derecha = p.enProceso ? 'a medias'
                  : p.estado === 'fuera' ? 'fuera'
                  : p.estado === 'lista' ? 'listo'
                  : `${Math.floor(p.horas)} h`;

    return `
      <div class="pano-prod ${esElQueToca ? 'toca-este' : ''} ${p.enProceso ? 'en-proceso' : ''}">
        <button class="pano-prod-cuerpo" data-pano="${esc(p.id)}"
                ${puedeRegistrar ? '' : 'disabled'}>
          <span class="pano-prod-num">${p.numero}</span>
          <span class="canastas-prod">
            ${p.canastas.map((c) => `
              <span class="canasta-prod ${c.estado}">
                ${c.moldes.map((m) => `
                  <i class="molde ${m.ultimoResultado && m.ultimoResultado !== 'ok' ? 'fallo' : ''}"></i>
                `).join('')}
              </span>`).join('')}
          </span>
          <span class="pano-prod-horas ${p.enProceso ? 'proceso' : p.estado}">${derecha}</span>
        </button>
        <button class="mas-canasta" data-mas="${esc(p.id)}" title="Más opciones">⋯</button>
      </div>`;
  }

  // ==========================================================
  // SACAR UN PAÑO — un toque
  // ==========================================================
  async function sacarPano(panoId, extra = {}) {
    const pano = datos.tanque.panos.find((p) => p.id === panoId);

    try {
      const r = await api.enviar(`/produccion/panos/${panoId}/sacar`, {
        tipoAgua: agua, rellenar: true, ...extra
      });
      avisar(
        `Paño ${pano.numero}: ${r.marquetas} marquetas` +
        (r.merma ? ` · ${r.merma} de merma` : '') +
        (r.terminado ? '' : ' · queda a medias'), 'bien');
      await pintar();
    } catch (e) {
      // Se salió de la rotación: o no puede, o hay que escribir el motivo.
      if (e.codigo === 403) return avisar(e.message, 'error');

      if (e.codigo === 400 && /motivo/.test(e.message)) {
        const motivo = await menu({
          titulo: `No toca el paño ${pano.numero}`,
          texto: e.message,
          opciones: [
            { valor: 'El agua de ese paño no estaba lista', texto: 'El agua no estaba lista' },
            { valor: 'El paño que tocaba está en mantenimiento', texto: 'Ese paño está en mantenimiento' },
            { valor: 'Demanda: se necesitaba hielo ya', texto: 'Se necesitaba hielo ya' },
            { valor: 'Corrección de un error de captura', texto: 'Corrijo un error de captura' }
          ]
        });
        if (!motivo) return;
        return sacarPano(panoId, { motivo });
      }
      avisar(e.message, 'error');
    }
  }

  // ==========================================================
  // MÁS OPCIONES DEL PAÑO
  // ==========================================================
  async function masOpciones(panoId) {
    const pano = datos.tanque.panos.find((p) => p.id === panoId);
    const puedeCorregir = estado.permisos.includes('*') ||
                          estado.permisos.includes('produccion.corregir');

    const opciones = [
      { valor: 'sacar', texto: 'Sacar y rellenar el paño', detalle: `Con agua ${agua}` },
      { valor: 'merma', texto: 'Sacar marcando merma', detalle: 'Molde por molde' },
      { valor: 'fuera', texto: 'Sacar y dejarlo fuera',
        detalle: 'Limpieza, mantenimiento o se acabó el agua' }
    ];
    if (pano.enProceso && puedeCorregir) {
      opciones.push({ valor: 'anular', texto: 'Anular este registro',
                      detalle: 'Se equivocaron de paño', peligro: true });
    }

    const opcion = await menu({
      titulo: `Paño ${pano.numero}`,
      texto: pano.enProceso
        ? `Empezado por ${esc(pano.empezadoPor || '—')} y sin terminar.`
        : `${pano.canastas.length} canastas · ${pano.total_moldes} marquetas`,
      opciones
    });

    if (opcion === 'sacar') return sacarPano(panoId);
    if (opcion === 'merma') return pantallaMerma(pano);
    if (opcion === 'fuera') {
      const sigue = await confirmar({
        titulo: `¿Dejar el paño ${pano.numero} fuera?`,
        texto: 'Se saca el hielo pero los moldes NO se rellenan. Quedará en la alerta ' +
               'hasta que alguien los llene.',
        ok: 'Dejarlo fuera'
      });
      if (!sigue) return;
      return sacarPano(panoId, { rellenar: false });
    }
    if (opcion === 'anular') return anular(pano);
  }

  async function anular(pano) {
    const motivo = await menu({
      titulo: `Anular el paño ${pano.numero}`,
      texto: 'El registro se anula y el paño vuelve como estaba. Queda constancia.',
      opciones: [
        { valor: 'Se equivocaron de paño', texto: 'Se equivocaron de paño' },
        { valor: 'Error de captura', texto: 'Error de captura' },
        { valor: 'Se registró dos veces', texto: 'Se registró dos veces' }
      ]
    });
    if (!motivo) return;

    try {
      await api.enviar(`/produccion/sacadas-pano/${pano.sacadaPanoId}/anular`, { motivo });
      avisar('Registro anulado', 'bien');
      pintar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  // ==========================================================
  // MERMA MOLDE POR MOLDE
  // ==========================================================
  async function pantallaMerma(pano) {
    const marcas = new Map();
    const canastas = pano.canastas.filter((c) => c.estado !== 'fuera');
    const total = canastas.reduce((n, c) => n + c.moldes.length, 0);

    const dibujar = () => {
      pantalla.innerHTML = `
        <button class="secundario chico" id="volver">‹ Producción</button>
        <h2 style="margin-top:14px">Paño ${pano.numero}</h2>
        <p class="ayuda">
          Toca un molde para marcar cómo salió. Los que no toques cuentan como
          buenos. Al guardar, el paño se saca y se rellena con agua ${agua}.
        </p>

        <div class="canastas-merma">
          ${canastas.map((c) => `
            <div class="tarjeta">
              <strong style="display:block;margin-bottom:10px">Canasta ${c.numero}</strong>
              <div class="moldes-detalle">
                ${c.moldes.map((m) => {
                  const r = marcas.get(m.id) || 'ok';
                  const aviso = m.ultimoResultado && m.ultimoResultado !== 'ok';
                  return `<button class="molde-boton ${r}" data-molde="${esc(m.id)}">
                            <span class="molde-num">${m.numero}</span>
                            <span class="molde-estado">${etiqueta(r)}</span>
                            ${aviso ? '<span class="molde-aviso" title="Falló la última vez">!</span>' : ''}
                          </button>`;
                }).join('')}
              </div>
            </div>`).join('')}
        </div>

        <div class="total-vivo">
          <span>de ${total} moldes</span>
          <strong>${total - marcas.size}</strong>
          <small>marquetas buenas</small>
        </div>

        <button id="guardar" style="margin-top:14px">Sacar el paño</button>`;

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
        const resultados = [...marcas.entries()].map(([moldeId, resultado]) => ({ moldeId, resultado }));
        await sacarPano(pano.id, { resultados });
      };
    };

    dibujar();
  }

  const etiqueta = (r) => (r === 'ok' ? 'bien' : r === 'merma' ? 'merma' : 'hueco');

  // ==========================================================
  // CAPTURA EN LOTE — el flujo de las 3 de la tarde
  // ==========================================================
  async function capturaEnLote() {
    const { obreros } = await api.obtener('/produccion/obreros');
    const todos = await api.obtener('/produccion/estado');
    let obreroId = obreros[0]?.id || null;
    const elegidos = new Set();

    // Se cargan los paños de todos los tanques, no solo el que está en pantalla.
    const porTanque = [];
    for (const t of todos.tanques) {
      const d = await api.obtener(`/produccion/estado?tanque=${encodeURIComponent(t.id)}`);
      porTanque.push(d.tanque);
    }

    const dibujar = () => {
      pantalla.innerHTML = `
        <button class="secundario chico" id="volver">‹ Producción</button>
        <h2 style="margin-top:14px">Registrar lo que se sacó</h2>
        <p class="ayuda">
          El obrero te dice los números de los paños que sacó durante su jornada.
          Márcalos aquí y se registran todos de golpe, a su nombre.
        </p>

        <div class="tarjeta">
          <label for="obrero">¿Quién los sacó?</label>
          <select id="obrero">
            ${obreros.map((o) => `
              <option value="${esc(o.id)}" ${o.id === obreroId ? 'selected' : ''}>
                ${esc(o.nombre)}
              </option>`).join('')}
          </select>

          <label style="margin-top:16px">Agua con la que se rellenó</label>
          <div class="fila-botones">
            <button class="${agua === 'purificada' ? '' : 'secundario'}" data-agua="purificada">Purificada</button>
            <button class="${agua === 'potable' ? '' : 'secundario'}" data-agua="potable">Potable</button>
          </div>
        </div>

        ${porTanque.map((t) => `
          <h3>${esc(t.nombre)}</h3>
          <div class="rejilla-panos">
            ${t.panos.map((p) => `
              <button class="ficha-pano ${elegidos.has(p.id) ? 'elegido' : ''}"
                      data-elegir="${esc(p.id)}">${p.numero}</button>`).join('')}
          </div>`).join('')}

        <div class="total-vivo" style="margin-top:18px">
          <span>paños marcados</span>
          <strong>${elegidos.size}</strong>
          <small>${calcularMarquetas()} marquetas</small>
        </div>

        <button id="guardar" style="margin-top:14px" ${elegidos.size ? '' : 'disabled'}>
          Registrar ${elegidos.size} ${elegidos.size === 1 ? 'paño' : 'paños'}
        </button>`;

      pantalla.querySelector('#volver').onclick = pintar;
      pantalla.querySelector('#obrero').onchange = (e) => { obreroId = e.target.value; };

      pantalla.querySelectorAll('[data-agua]').forEach((b) => {
        b.onclick = () => { agua = b.dataset.agua; localStorage.setItem('tipo_agua', agua); dibujar(); };
      });

      pantalla.querySelectorAll('[data-elegir]').forEach((b) => {
        b.onclick = () => {
          const id = b.dataset.elegir;
          if (elegidos.has(id)) elegidos.delete(id); else elegidos.add(id);
          dibujar();
        };
      });

      pantalla.querySelector('#guardar').onclick = async () => {
        try {
          const r = await api.enviar('/produccion/lote', {
            ejecutorId: obreroId, panos: [...elegidos], tipoAgua: agua
          });
          avisar(`${r.panos.length} paños · ${r.marquetas} marquetas`, 'bien');
          pintar();
        } catch (e) { avisar(e.message, 'error'); }
      };
    };

    function calcularMarquetas() {
      let n = 0;
      for (const t of porTanque) {
        for (const p of t.panos) if (elegidos.has(p.id)) n += p.total_moldes;
      }
      return n;
    }

    dibujar();
  }

  // ==========================================================
  // LO DE HOY
  // ==========================================================
  async function verHoy() {
    const r = await api.obtener('/produccion/hoy');

    pantalla.innerHTML = `
      <button class="secundario chico" id="volver">‹ Producción</button>
      <h2 style="margin-top:14px">Lo de hoy</h2>

      <div class="resumen-fabrica">
        <div><strong>${r.marquetas}</strong><small>marquetas</small></div>
        <div><strong>${r.merma}</strong><small>merma</small></div>
        <div><strong>${r.fuera}</strong><small>fuera</small></div>
      </div>

      ${r.porObrero.length ? `
        <h3>Por obrero</h3>
        <div class="tarjeta plana">
          <table class="tabla">
            <tr><th>Quién</th><th>Paños</th><th>Marquetas</th></tr>
            ${r.porObrero.map((o) => `
              <tr><td>${esc(o.nombre)}</td><td>${o.panos}</td>
                  <td><strong>${o.marquetas}</strong></td></tr>`).join('')}
          </table>
        </div>` : ''}

      <h3>Paños sacados</h3>
      <div class="tarjeta plana">
        <table class="tabla">
          <tr><th>Hora</th><th>Dónde</th><th>Quién</th><th>Marq.</th></tr>
          ${r.panos.map((p) => `
            <tr class="${p.notas && p.notas.startsWith('ANULADA') ? 'anulada' : ''}">
              <td>${esc(new Date(p.iniciada_en).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }))}</td>
              <td>${esc(p.tanque)} · paño ${p.pano}
                  ${p.motivo_orden ? '<small class="marca-orden">fuera de orden</small>' : ''}
                  ${!p.terminada_en ? '<small class="marca-orden">a medias</small>' : ''}</td>
              <td>${esc(p.quien || '—')}</td>
              <td><strong>${p.marquetas}</strong></td>
            </tr>`).join('') || '<tr><td colspan="4">Todavía no hay nada registrado hoy.</td></tr>'}
        </table>
      </div>`;

    pantalla.querySelector('#volver').onclick = pintar;
  }
}
