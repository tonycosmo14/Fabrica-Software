/**
 * PRODUCCIÓN  (v0.5 — el orden real de trabajo)
 *
 * Lo primero que se ve es lo que más se usa:
 *
 *   1. REGISTRAR LO QUE SE SACÓ — el flujo de las 3 de la tarde. El obrero
 *      llega con su papel, dice los números y se capturan todos de golpe.
 *   2. NÚMEROS A SACAR — imprime qué paños tocan en cada tanque, con fecha y
 *      hora. Ese papel es el que se le entrega al obrero. Solo gerente o
 *      administrador: son ellos quienes reparten el trabajo.
 *   3. LOS TANQUES — la vista del estado. Se entra a un paño para ver o
 *      corregir canasta por canasta y molde por molde.
 *
 * Colores: azul congelando, gris lista, naranja fuera del tanque, ámbar a
 * medias. El agua potable se ve distinta de la purificada.
 */
import { api } from '../api.js';
import { esc, avisar, fecha as formatoFecha } from '../util.js';
import { confirmar, menu, pedirTexto, pedirAutorizacion } from '../dialogo.js';

/** Siguiente número en una rotación intercalada ya calculada por el servidor. */
function siguienteEnOrden(orden, ultimo) {
  if (!orden.length) return null;
  if (ultimo == null) return orden[0];
  const i = orden.indexOf(ultimo);
  return i === -1 ? orden[0] : orden[(i + 1) % orden.length];
}

export async function vistaProduccion(pantalla, estado) {
  const puedeRegistrar = estado.permisos.includes('*') ||
                         estado.permisos.includes('produccion.registrar');
  const puedeAutorizar = estado.permisos.includes('*') ||
                         estado.permisos.includes('produccion.autorizar');
  // Los números que siguen los imprime también el cajero: el obrero
  // pregunta en el mostrador y ahí no siempre hay un gerente.
  const puedeVerNumeros = estado.permisos.includes('*') ||
                          estado.permisos.includes('produccion.numeros');
  const puedeCorregir = estado.permisos.includes('*') ||
                        estado.permisos.includes('produccion.corregir');

  let agua = localStorage.getItem('tipo_agua') || 'purificada';
  let tanqueActivo = localStorage.getItem('tanque_activo') || null;
  let datos = null;

  await pintar();

  // ==========================================================
  // PANTALLA PRINCIPAL
  // ==========================================================
  async function pintar() {
    datos = await api.obtener(
      `/produccion/estado${tanqueActivo ? `?tanque=${encodeURIComponent(tanqueActivo)}` : ''}`);

    if (!datos.tanques.length) return sinTanques();

    const { tanques, tanque, fuera } = datos;
    tanqueActivo = tanque.id;
    localStorage.setItem('tanque_activo', tanqueActivo);
    const toca = tanque.siguiente;

    pantalla.innerHTML = `
      ${puedeRegistrar ? `
        <button id="registrar" class="accion-principal">
          <span class="accion-icono">📋</span>
          <span class="accion-texto">
            <strong>Registrar lo que se sacó</strong>
            <small>Marca los paños que te dijeron</small>
          </span>
        </button>` : ''}

      ${puedeVerNumeros ? `
        <button id="siguientes" class="secundario accion-secundaria">
          🖨️ Números a sacar
        </button>` : ''}

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

      <div class="panos-produccion">
        ${tanque.panos.map((p) => filaPano(p, toca)).join('') ||
          '<p class="vacio">Este tanque no tiene paños.</p>'}
      </div>

      <div class="leyenda">
        <span><i class="punto-estado congelando"></i> congelando</span>
        <span><i class="punto-estado potable"></i> con potable</span>
        <span><i class="punto-estado lista"></i> lista</span>
        <span><i class="punto-estado fuera"></i> fuera del tanque</span>
        <span><i class="punto-estado proceso"></i> a medias</span>
        <span><i class="punto-estado merma"></i> falló</span>
      </div>

      <div class="fila-botones" style="margin-top:16px">
        <button class="secundario chico" id="ver-hoy">Lo de hoy</button>
      </div>`;

    pantalla.querySelectorAll('[data-tanque]').forEach((b) => {
      b.onclick = () => { tanqueActivo = b.dataset.tanque; pintar(); };
    });
    pantalla.querySelector('#ver-hoy').onclick = verHoy;

    if (puedeVerNumeros) pantalla.querySelector('#siguientes').onclick = numerosASacar;
    if (!puedeRegistrar) return;

    pantalla.querySelector('#registrar').onclick = capturaEnLote;

    pantalla.querySelector('#agua').onclick = () => {
      agua = agua === 'purificada' ? 'potable' : 'purificada';
      localStorage.setItem('tipo_agua', agua);
      pintar();
    };

    // Tocar un paño entra a su detalle. Si NO es el que toca, primero se
    // pide la autorización: así se ve el aviso al instante y no después de
    // haber marcado todo.
    pantalla.querySelectorAll('[data-pano]').forEach((b) => {
      b.onclick = () => abrirPano(b.dataset.pano);
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

  /** Una fila = un paño. */
  function filaPano(p, toca) {
    const esElQueToca = toca && toca.id === p.id;
    const derecha = p.enProceso ? 'a medias'
                  : p.estado === 'fuera' ? 'fuera'
                  : p.estado === 'lista' ? 'listo'
                  : `${Math.floor(p.horas)} h`;

    return `
      <div class="pano-prod ${esElQueToca ? 'toca-este' : ''} ${p.enProceso ? 'en-proceso' : ''}">
        <button class="pano-prod-cuerpo" data-pano="${esc(p.id)}">
          <span class="pano-prod-num">${p.numero}</span>
          <span class="canastas-prod">
            ${p.canastas.map((c) => `
              <span class="canasta-prod ${c.estado} ${c.tipoAgua === 'potable' ? 'potable' : ''}">
                ${c.moldes.map((m) => `
                  <i class="molde ${m.ultimoResultado && m.ultimoResultado !== 'ok' ? 'fallo' : ''}"
                     ${m.rachaFallos > 1 ? 'data-racha="' + m.rachaFallos + '"' : ''}></i>
                `).join('')}
              </span>`).join('')}
          </span>
          <span class="pano-prod-horas ${p.enProceso ? 'proceso' : p.estado}">${derecha}</span>
        </button>
      </div>`;
  }

  /**
   * Puerta de entrada al paño. Si no es el que toca, pide permiso antes de
   * enseñar nada: el aviso sale al primer toque, no al final.
   */
  async function abrirPano(panoId) {
    const toca = datos.tanque.siguiente;
    if (!toca || toca.id === panoId) return detallePano(panoId);

    const pano = datos.tanque.panos.find((p) => p.id === panoId);

    const auth = await pedirAutorizacion({
      titulo: `El paño ${pano.numero} no es el que sigue`,
      texto: `Toca el ${toca.numero}. Un gerente o el administrador tiene que ` +
             'autorizar con su PIN para ver qué se puede hacer con este paño.',
      responsables: datos.responsables
    });
    if (!auth) return;

    try {
      const r = await api.enviar('/produccion/autorizar', { panoId, ...auth });
      avisar(`Autorizado por ${r.autorizadaPor}`, 'bien');
      detallePano(panoId, r.vale);
    } catch (e) { avisar(e.message, 'error'); }
  }

  // ==========================================================
  // DETALLE DEL PAÑO — aquí se hace todo
  // ==========================================================
  async function detallePano(panoId, vale) {
    const pano = datos.tanque.panos.find((p) => p.id === panoId);
    const marcas = new Map();          // moldeId -> merma | hueco
    const fuera = pano.canastas.filter((c) => c.estado === 'fuera');
    const dentro = pano.canastas.filter((c) => c.estado !== 'fuera');

    // Quién lo sacó: por omisión el que tiene la sesión, pero casi siempre
    // es otra persona la que estuvo en la grúa.
    const { obreros } = await api.obtener('/produccion/obreros');
    let quienId = obreros.find((o) => o.id === estado.usuario.id)?.id || obreros[0]?.id || null;

    const dibujar = () => {
      const buenas = dentro.reduce((n, c) => n + c.moldes.length, 0) - marcas.size;

      pantalla.innerHTML = `
        <button class="secundario chico" id="volver">‹ ${esc(datos.tanque.nombre)}</button>

        <div class="cabeza-pano">
          <h2>Paño ${pano.numero}</h2>
          <p class="ayuda" style="margin:0">
            ${pano.canastas.length} canastas ·
            ${pano.horas != null ? `${Math.floor(pano.horas)} h congelando` :
              pano.estado === 'fuera' ? 'fuera del tanque' : 'listo'}
            ${pano.enProceso ? ` · empezado por ${esc(pano.empezadoPor || '—')}` : ''}
            ${vale ? ' · <strong class="autorizado">autorizado</strong>' : ''}
          </p>
        </div>

        <div class="tarjeta fila-quien">
          <div class="campo-quien">
            <label for="quien">¿Quién lo sacó?</label>
            <select id="quien">
              ${obreros.map((o) => `
                <option value="${esc(o.id)}" ${o.id === quienId ? 'selected' : ''}>
                  ${esc(o.nombre)}
                </option>`).join('')}
            </select>
          </div>
          <div class="campo-agua">
            <label>Agua</label>
            <button class="agua-boton ${agua}" id="agua-pano">
              <span class="agua-icono">💧</span>
              <span>${agua === 'purificada' ? 'Purificada' : 'Potable'}</span>
            </button>
          </div>
        </div>

        ${fuera.length ? `
          <div class="alerta-fuera">
            ⚠️ ${fuera.length} ${fuera.length === 1 ? 'canasta está' : 'canastas están'} fuera del tanque
          </div>
          <button id="rellenar" style="margin-bottom:14px">
            💧 Rellenar con agua ${agua}
          </button>` : ''}

        ${dentro.length ? `
          <p class="ayuda">
            Toca un molde si salió mal. Los que no toques cuentan como buenos.
            Al sacar, el paño se rellena con agua ${agua} en el mismo movimiento.
          </p>

          <div class="canastas-merma">
            ${dentro.map((c) => `
              <div class="tarjeta">
                <div class="canasta-cabeza">
                  <strong>Canasta ${c.numero}</strong>
                  <small>${c.tipoAgua ? `agua ${esc(c.tipoAgua)}` : 'sin registro'}</small>
                </div>
                <div class="moldes-detalle">
                  ${c.moldes.map((m) => {
                    const r = marcas.get(m.id) || 'ok';
                    return `<button class="molde-boton ${r}" data-molde="${esc(m.id)}">
                              <span class="molde-num">${m.numero}</span>
                              <span class="molde-estado">${etiqueta(r)}</span>
                              ${m.rachaFallos ? `<span class="molde-aviso"
                                 title="Ha fallado ${m.rachaFallos} ${m.rachaFallos === 1 ? 'vez' : 'veces'} seguidas"
                                 >${m.rachaFallos}</span>` : ''}
                            </button>`;
                  }).join('')}
                </div>
              </div>`).join('')}
          </div>

          <div class="total-vivo">
            <span>de ${dentro.reduce((n, c) => n + c.moldes.length, 0)} moldes</span>
            <strong>${buenas}</strong>
            <small>marquetas buenas</small>
          </div>

          <div class="acciones-centradas">
            <button id="sacar">Sacar el paño ${pano.numero}</button>
            <button class="secundario" id="sacar-fuera">Sacar y dejarlo fuera</button>
          </div>` : ''}

        ${puedeCorregir ? `
          <h3>Corregir</h3>
          <div class="tarjeta" style="text-align:center">
            <button class="peligro" id="anular">Anular la última sacada de este paño</button>
            <p class="ayuda" style="margin:14px 0 0">
              Para cuando se equivocaron de paño. No se borra nada: el registro
              queda marcado como anulado, con su motivo y quién lo hizo.
            </p>
          </div>` : ''}

        <p class="firma">Los números en rojo son las veces seguidas que ha fallado ese molde.</p>`;

      pantalla.querySelector('#volver').onclick = pintar;
      pantalla.querySelector('#quien').onchange = (e) => { quienId = e.target.value; };

      // El agua se cambia aquí mismo y se queda para las siguientes veces.
      pantalla.querySelector('#agua-pano').onclick = () => {
        agua = agua === 'purificada' ? 'potable' : 'purificada';
        localStorage.setItem('tipo_agua', agua);
        dibujar();
      };

      pantalla.querySelectorAll('[data-molde]').forEach((b) => {
        b.onclick = () => {
          const id = b.dataset.molde;
          const actual = marcas.get(id) || 'ok';
          const siguiente = actual === 'ok' ? 'merma' : actual === 'merma' ? 'hueco' : null;
          if (siguiente) marcas.set(id, siguiente); else marcas.delete(id);
          dibujar();
        };
      });

      const btnRellenar = pantalla.querySelector('#rellenar');
      if (btnRellenar) btnRellenar.onclick = async () => {
        try {
          const r = await api.enviar(`/produccion/panos/${pano.id}/rellenar`,
            { tipoAgua: agua, ejecutorId: quienId });
          avisar(`${r.rellenadas} canastas rellenadas con agua ${agua}`, 'bien');
          pintar();
        } catch (e) { avisar(e.message, 'error'); }
      };

      const btnSacar = pantalla.querySelector('#sacar');
      if (btnSacar) btnSacar.onclick = () => sacar({ rellenar: true });

      const btnFuera = pantalla.querySelector('#sacar-fuera');
      if (btnFuera) btnFuera.onclick = async () => {
        const sigue = await confirmar({
          titulo: `¿Dejar el paño ${pano.numero} fuera?`,
          texto: 'Se saca el hielo pero los moldes NO se rellenan. Quedará en la alerta ' +
                 'hasta que alguien los llene.',
          ok: 'Dejarlo fuera'
        });
        if (sigue) sacar({ rellenar: false });
      };

      const btnAnular = pantalla.querySelector('#anular');
      if (btnAnular) btnAnular.onclick = anular;
    };

    async function sacar(opciones, autorizacion) {
      const resultados = [...marcas.entries()].map(([moldeId, resultado]) => ({ moldeId, resultado }));

      try {
        const r = await api.enviar(`/produccion/panos/${pano.id}/sacar`, {
          tipoAgua: agua, resultados, ejecutorId: quienId, vale, ...opciones, autorizacion
        });
        avisar(
          `Paño ${pano.numero}: ${r.marquetas} marquetas` +
          (r.merma ? ` · ${r.merma} de merma` : '') +
          (r.terminado ? '' : ' · queda a medias'), 'bien');
        await pintar();
      } catch (e) {
        if (e.requiereAutorizacion || /autoriza|PIN/i.test(e.message)) {
          const auth = await pedirAutorizacion({
            titulo: `No toca el paño ${pano.numero}`,
            texto: e.message + ' Un gerente o el administrador tiene que autorizarlo con su PIN.',
            responsables: datos.responsables
          });
          if (!auth) return;
          return sacar(opciones, auth);
        }
        avisar(e.message, 'error');
      }
    }

    async function anular() {
      const motivo = await pedirTexto({
        titulo: `Anular la última sacada del paño ${pano.numero}`,
        texto: 'El registro queda marcado como anulado y el paño vuelve como estaba.',
        marcador: 'Se equivocaron de paño, se registró dos veces...',
        ok: 'Anular'
      });
      if (!motivo) return;

      try {
        await api.enviar(`/produccion/panos/${pano.id}/anular-ultima`, { motivo });
        avisar('Registro anulado', 'bien');
        pintar();
      } catch (e) { avisar(e.message, 'error'); }
    }

    dibujar();
  }

  const etiqueta = (r) => (r === 'ok' ? 'bien' : r === 'merma' ? 'merma' : 'hueco');

  // ==========================================================
  // NÚMEROS A SACAR — el papel que se le entrega al obrero
  // ==========================================================
  async function numerosASacar() {
    const r = await api.obtener('/produccion/siguientes');

    pantalla.innerHTML = `
      <button class="secundario chico no-imprimir" id="volver">‹ Producción</button>

      <div class="ticket" id="ticket">
        <div class="ticket-cabeza">
          <strong>NÚMEROS A SACAR</strong>
          <span>${esc(formatoFecha(r.fecha))}</span>
        </div>

        ${r.lista.map((t) => `
          <div class="ticket-tanque">
            <div class="ticket-nombre">TANQUE ${esc(t.tanque)}</div>
            <div class="ticket-numeros">
              ${t.siguientes.length
                ? t.siguientes.map((n, i) => `<span class="${i === 0 ? 'primero' : ''}">${n}</span>`).join('')
                : '<em>sin paños</em>'}
            </div>
            ${t.enProceso.length
              ? `<div class="ticket-nota">A medias: ${t.enProceso.join(', ')} — terminar primero</div>`
              : ''}
          </div>`).join('')}

        <div class="ticket-pie">
          <div>Entregó: ${esc(r.entregadoPor)}</div>
          <div class="ticket-firma">Recibió: ______________________</div>
          <div class="ticket-firma">Sacó de verdad: ______________</div>
        </div>
      </div>

      <p class="ayuda no-imprimir" style="margin-top:18px">
        Imprime este papel y dáselo al obrero. Cuando regrese te dice qué sacó
        de verdad y lo capturas con <strong>Registrar lo que se sacó</strong>.
      </p>

      <button id="imprimir" class="no-imprimir">🖨️ Imprimir</button>`;

    pantalla.querySelector('#volver').onclick = pintar;
    pantalla.querySelector('#imprimir').onclick = () => window.print();
  }

  // ==========================================================
  // REGISTRAR LO QUE SE SACÓ
  // ==========================================================
  async function capturaEnLote() {
    const { obreros } = await api.obtener('/produccion/obreros');
    const todos = await api.obtener('/produccion/estado');
    let quienId = obreros[0]?.id || null;
    const elegidos = new Set();
    const valesPorPano = {};           // paños marcados fuera de orden

    const porTanque = [];
    for (const t of todos.tanques) {
      const d = await api.obtener(`/produccion/estado?tanque=${encodeURIComponent(t.id)}`);
      porTanque.push(d.tanque);
    }

    /**
     * La rotación avanza conforme se marca. Si el obrero sacó el 1, el 3 y
     * el 5 en ese orden, los tres son correctos: al marcar el 1, el que
     * sigue pasa a ser el 3, y así. Solo se pide autorización cuando de
     * verdad se rompió el orden.
     */
    function siguienteDe(t) {
      let ultimo = t.ultimoPanoSacado;
      const marcadosAqui = t.panos.filter((p) => elegidos.has(p.id)).map((p) => p.numero);

      // Se avanza tantas veces como paños ya marcados haya en este tanque,
      // saltando los que ya están marcados.
      for (let i = 0; i < marcadosAqui.length; i++) {
        ultimo = siguienteEnOrden(t.ordenRotacion, ultimo);
      }
      return siguienteEnOrden(t.ordenRotacion, ultimo);
    }

    /** El primero sin marcar de la rotación: ese es el que se resalta. */
    function tocaEn(t) {
      let ultimo = t.ultimoPanoSacado;
      for (let i = 0; i < t.ordenRotacion.length; i++) {
        const n = siguienteEnOrden(t.ordenRotacion, ultimo);
        const pano = t.panos.find((p) => p.numero === n);
        if (!pano) return null;
        if (!elegidos.has(pano.id)) return pano;
        ultimo = n;
      }
      return null;
    }

    const dibujar = () => {
      pantalla.innerHTML = `
        <button class="secundario chico" id="volver">‹ Producción</button>
        <h2 style="margin-top:14px">Registrar lo que se sacó</h2>
        <p class="ayuda">
          Marca los paños que te dijeron. Se registran todos de golpe, a nombre
          de quien los sacó, con la hora de ahora.
        </p>

        <div class="tarjeta">
          <label for="quien">¿Quién los sacó?</label>
          <select id="quien">
            ${obreros.map((o) => `
              <option value="${esc(o.id)}" ${o.id === quienId ? 'selected' : ''}>
                ${esc(o.nombre)}
              </option>`).join('')}
          </select>

          <label style="margin-top:16px">Agua con la que se rellenó</label>
          <div class="fila-botones">
            <button class="${agua === 'purificada' ? '' : 'secundario'}" data-agua="purificada">Purificada</button>
            <button class="${agua === 'potable' ? 'agua-potable-activa' : 'secundario'}" data-agua="potable">Potable</button>
          </div>
        </div>

        ${porTanque.map((t) => {
          const toca = tocaEn(t);
          return `
          <h3>${esc(t.nombre)}</h3>
          <div class="rejilla-panos">
            ${t.panos.map((p) => `
              <button class="ficha-pano ${elegidos.has(p.id) ? 'elegido' : ''}
                              ${toca && toca.id === p.id ? 'toca' : ''}
                              ${valesPorPano[p.id] ? 'autorizado' : ''}"
                      data-elegir="${esc(p.id)}" data-tanque-ficha="${esc(t.id)}"
                      >${p.numero}</button>`).join('')}
          </div>`; }).join('')}

        <div class="total-vivo" style="margin-top:18px">
          <span>paños marcados</span>
          <strong>${elegidos.size}</strong>
          <small>${calcular()} marquetas</small>
        </div>

        <button id="guardar" style="margin-top:14px" ${elegidos.size ? '' : 'disabled'}>
          Registrar ${elegidos.size} ${elegidos.size === 1 ? 'paño' : 'paños'}
        </button>`;

      pantalla.querySelector('#volver').onclick = pintar;
      pantalla.querySelector('#quien').onchange = (e) => { quienId = e.target.value; };

      pantalla.querySelectorAll('[data-agua]').forEach((b) => {
        b.onclick = () => { agua = b.dataset.agua; localStorage.setItem('tipo_agua', agua); dibujar(); };
      });
      pantalla.querySelectorAll('[data-elegir]').forEach((b) => {
        b.onclick = () => marcar(b.dataset.elegir, b.dataset.tanqueFicha);
      });

      pantalla.querySelector('#guardar').onclick = async () => {
        try {
          const r = await api.enviar('/produccion/lote', {
            ejecutorId: quienId, panos: [...elegidos], tipoAgua: agua, vales: valesPorPano
          });
          avisar(`${r.panos.length} paños · ${r.marquetas} marquetas`, 'bien');
          pintar();
        } catch (e) { avisar(e.message, 'error'); }
      };
    };

    /** Marca o desmarca un paño, pidiendo permiso si rompe la rotación. */
    async function marcar(panoId, tanqueId) {
      if (elegidos.has(panoId)) {
        elegidos.delete(panoId);
        delete valesPorPano[panoId];
        return dibujar();
      }

      const t = porTanque.find((x) => x.id === tanqueId);
      const esperado = siguienteDe(t);
      const pano = t.panos.find((p) => p.id === panoId);

      if (pano.numero === esperado) {
        elegidos.add(panoId);
        return dibujar();
      }

      const auth = await pedirAutorizacion({
        titulo: `El paño ${pano.numero} no es el que sigue`,
        texto: `En el tanque ${t.nombre} tocaba el ${esperado}. ` +
               'Un gerente o el administrador tiene que autorizarlo con su PIN.',
        responsables: todos.responsables
      });
      if (!auth) return;

      try {
        const r = await api.enviar('/produccion/autorizar', { panoId, ...auth });
        valesPorPano[panoId] = r.vale;
        elegidos.add(panoId);
        avisar(`Autorizado por ${r.autorizadaPor}`, 'bien');
        dibujar();
      } catch (e) { avisar(e.message, 'error'); }
    }

    function calcular() {
      let n = 0;
      for (const t of porTanque) for (const p of t.panos) if (elegidos.has(p.id)) n += p.total_moldes;
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
        <h3>Quién sacó qué</h3>
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
                  ${p.motivo_orden ? '<small class="marca-orden">autorizado</small>' : ''}
                  ${!p.terminada_en ? '<small class="marca-orden">a medias</small>' : ''}</td>
              <td>${esc(p.quien || '—')}</td>
              <td><strong>${p.marquetas}</strong></td>
            </tr>`).join('') || '<tr><td colspan="4">Todavía no hay nada registrado hoy.</td></tr>'}
        </table>
      </div>`;

    pantalla.querySelector('#volver').onclick = pintar;
  }
}
