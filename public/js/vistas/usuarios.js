/**
 * LA GENTE DE LA FÁBRICA  (v3.8)
 *
 * Aquí nadie se borra: se da de baja (regla 3.4) y su historial se
 * conserva completo.
 *
 * La pantalla está partida POR ROL y no en una lista sola. No es adorno:
 * los roles de una fábrica no son cinco categorías equivalentes, son
 * cinco trabajos distintos, y quien abre esta pantalla casi siempre viene
 * a buscar a alguien de UNO de ellos —"¿quiénes son mis cajeros?"—. Con
 * una lista alfabética esa pregunta se contesta leyéndola entera.
 *
 * Y cada ficha dice lo que se ha hecho en los últimos treinta días: la
 * última vez que entró, lo que vendió, los paños que sacó. Un nombre y un
 * rol no contestan ninguna de las preguntas que uno se hace mirando esta
 * lista.
 */
import { api } from '../api.js';
import { esc, avisar, fecha, fechaCorta, colorDe, ETIQUETAS_ROL } from '../util.js';
import { confirmar, pedirClaveNueva } from '../dialogo.js';
import { pesos } from '../fracciones.js';

/** El orden en que se enseñan los grupos: como se cuenta la fábrica. */
const ORDEN_ROLES = ['operario', 'cajero', 'repartidor', 'gerente', 'admin'];

/**
 * El plural de cada rol, escrito y no fabricado con una "s".
 * "Repartidors" y "Administradors" no son palabras.
 */
const PLURAL_ROL = {
  operario: 'Operarios', cajero: 'Encargados de caja', repartidor: 'Repartidores',
  gerente: 'Gerentes de turno', admin: 'Administradores'
};

const ICONO_ROL = {
  operario: '🧊', cajero: '💵', repartidor: '🚚', gerente: '📋', admin: '🔑'
};

/** Qué hace cada quien, en un renglón, para quien no lo tenga claro. */
const QUE_HACE = {
  operario: 'Saca el hielo de los tanques',
  cajero: 'Cobra en el mostrador y cuadra su turno',
  repartidor: 'Lleva el hielo a los clientes',
  gerente: 'Autoriza, corrige y ve las cuentas',
  admin: 'Todo, incluido dar de alta a la gente'
};

export async function vistaUsuarios(pantalla) {
  let verInactivos = false;

  /**
   * "Hace 3 días", "hace un mes", "hoy". El dato que se busca aquí no es
   * la fecha exacta —nadie recuerda si el 14 fue lunes— sino cuánto hace.
   */
  function haceCuanto(iso) {
    if (!iso) return null;
    const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (dias <= 0) return 'hoy';
    if (dias === 1) return 'ayer';
    if (dias < 30) return `hace ${dias} días`;
    if (dias < 60) return 'hace un mes';
    if (dias < 365) return `hace ${Math.round(dias / 30)} meses`;
    const anios = Math.floor(dias / 365);
    return anios === 1 ? 'hace un año' : `hace ${anios} años`;
  }

  /**
   * Desde cuándo está en la fábrica. Va con "en la fábrica" delante a
   * propósito: junto al renglón de "entró hace tres días" —que habla de
   * entrar al SISTEMA— un "lleva dos años" suelto se lee al revés.
   */
  function desdeCuando(iso) {
    if (!iso) return null;
    const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (dias === 0) return 'en la fábrica desde hoy';
    if (dias < 30) return `en la fábrica desde hace ${dias} días`;
    if (dias < 365) return `en la fábrica desde hace ${Math.round(dias / 30)} meses`;
    const anios = Math.floor(dias / 365);
    return `en la fábrica desde hace ${anios === 1 ? 'un año' : `${anios} años`}`;
  }

  /**
   * LOS DATOS QUE SE ENSEÑAN DE CADA QUIEN, según su trabajo.
   *
   * A un operario no le sirve saber cuánto vendió (no vende) ni a un
   * repartidor cuántos paños sacó. Enseñar las mismas cinco casillas a
   * todos, con tres en cero, es peor que no enseñar ninguna: los ceros se
   * leen como si algo estuviera mal.
   */
  function datosDe(u) {
    const a = u.actividad || {};
    const datos = [];

    if (a.panos) datos.push({ que: 'Paños', valor: a.panos, nota: haceCuanto(a.ultimoPano) });
    if (a.ventas) {
      datos.push({ que: 'Vendió', valor: pesos(a.vendidoCentavos || 0),
                   nota: `${a.ventas} ${a.ventas === 1 ? 'ticket' : 'tickets'}` });
    }
    if (a.turnos) datos.push({ que: 'Turnos', valor: a.turnos, nota: 'de caja' });

    return datos;
  }

  /** Cómo entra al sistema: con PIN, o también desde la PC. */
  function comoEntra(u) {
    if (u.tiene_contrasena && u.tiene_pin) return 'PIN y contraseña';
    if (u.tiene_contrasena) return 'contraseña';
    if (u.tiene_pin) return 'PIN';
    return 'no puede entrar';
  }

  function ficha(u) {
    const datos = datosDe(u);
    const entro = haceCuanto(u.actividad?.ultimaEntrada);

    return `
      <div class="usr-ficha ${u.activo ? '' : 'inactivo'}">
        <span class="inicial" style="background:${colorDe(u.nombre)}"
        >${esc(u.nombre.trim().charAt(0).toUpperCase())}</span>

        <div class="usr-quien">
          <strong>${esc(u.nombre)}</strong>
          <small>
            ${u.usuario ? `${esc(u.usuario)} · ` : ''}${esc(comoEntra(u))}
            ${u.activo ? '' : ' · <span class="etiqueta baja">de baja</span>'}
          </small>
          ${u.valesPendientes?.centavos ? `
            <!-- El día de pago, la pregunta que se hace mirando esta
                 pantalla es "¿a quién le tengo que descontar?". Se contesta
                 de un vistazo o no se contesta. -->
            <small class="usr-vales" title="Se llevó parte de su sueldo por adelantado">
              📤 debe ${esc(pesos(u.valesPendientes.centavos))} de vales
              <span>(${u.valesPendientes.cuantos})</span>
            </small>` : ''}
        </div>

        <div class="usr-datos">
          ${datos.map((d) => `
            <div class="usr-dato">
              <small>${esc(d.que)}</small>
              <b>${esc(String(d.valor))}</b>
              ${d.nota ? `<small>${esc(d.nota)}</small>` : ''}
            </div>`).join('')}
        </div>

        <div class="usr-cuando">
          <small>${entro ? `Entró al sistema ${esc(entro)}` : 'Nunca ha entrado al sistema'}</small>
          <small>${esc(desdeCuando(u.fecha_alta) || '')}</small>
        </div>

        <button class="chico secundario" data-editar="${esc(u.id)}">Editar</button>
      </div>`;
  }

  async function pintar() {
    const datos = await api.obtener(
      `/usuarios?actividad=1&incluirInactivos=${verInactivos ? 1 : 0}`);
    const usuarios = datos.usuarios;

    // Los grupos salen en el orden de ORDEN_ROLES, y solo los que tienen
    // gente: un apartado vacío de "Repartidores" en una fábrica que todavía
    // no reparte es un hueco que hay que saltarse cada vez.
    const porRol = new Map();
    for (const u of usuarios) {
      if (!porRol.has(u.rol)) porRol.set(u.rol, []);
      porRol.get(u.rol).push(u);
    }
    const grupos = ORDEN_ROLES.filter((r) => porRol.has(r))
      .concat([...porRol.keys()].filter((r) => !ORDEN_ROLES.includes(r)));

    pantalla.innerHTML = `
      <div class="ancho-completo">
        <div class="emp-cabecera">
          <div class="emp-titulo">
            <h2>La gente de la fábrica</h2>
            <p class="ayuda">
              Cada quien entra con su propio PIN. <b>Nadie se borra</b>: se da
              de baja y su historial se conserva completo. Lo que dice cada
              ficha es de los <b>últimos ${datos.desdeCuando || 30} días</b>.
            </p>
          </div>
          <div class="usr-acciones">
            <button id="nuevo">＋ Nuevo usuario</button>
            <label class="usr-interruptor">
              <input type="checkbox" id="ver-inactivos" ${verInactivos ? 'checked' : ''}>
              <span>Mostrar dados de baja</span>
            </label>
          </div>
        </div>

        ${grupos.map((rol) => {
          const gente = porRol.get(rol);
          return `
            <section class="usr-grupo">
              <h3 class="usr-titulo-grupo">
                <span class="usr-icono">${ICONO_ROL[rol] || '👤'}</span>
                ${esc(gente.length === 1
                  ? (ETIQUETAS_ROL[rol] || rol)
                  : (PLURAL_ROL[rol] || `${ETIQUETAS_ROL[rol] || rol}s`))}
                <span class="usr-cuantos">${gente.length}</span>
                <small>${esc(QUE_HACE[rol] || '')}</small>
              </h3>
              ${gente.map(ficha).join('')}
            </section>`;
        }).join('') || '<p class="vacio">No hay usuarios.</p>'}
      </div>`;

    pantalla.querySelector('#ver-inactivos').onchange = (e) => { verInactivos = e.target.checked; pintar(); };
    pantalla.querySelector('#nuevo').onclick = () => formulario(null);
    pantalla.querySelectorAll('[data-editar]').forEach((b) => {
      b.onclick = () => formulario(usuarios.find((u) => u.id === b.dataset.editar));
    });
  }

  /**
   * LOS VALES DE RAYA DE UNA PERSONA  (v4.3)
   *
   * "Los empleados pueden pedir vales, que son partes de su sueldo de la
   *  semana de manera adelantada."
   *
   * Esto NO es contabilidad. El gasto ya se contó el día que el dinero
   * salió del cajón —el sueldo es gasto de la fábrica, y se cuenta una
   * sola vez—. Esta lista es el RECORDATORIO de que el día de pago se
   * le paga de menos, y nada más. Por eso el único botón que tiene dice
   * "ya se le descontó" y no mueve un peso.
   *
   * Se pinta después de la ficha y no con ella: la ficha tiene que salir
   * al instante, y esto es un dato de más que casi siempre viene en cero.
   */
  async function pintarVales(usuario) {
    const caja = pantalla.querySelector('#vales-caja');
    if (!caja) return;

    let datos;
    try {
      datos = await api.obtener(`/usuarios/${usuario.id}/adelantos`);
    } catch {
      caja.innerHTML = `
        <h3 class="emp-sub" style="margin-top:0">Vales de sueldo</h3>
        <p class="ayuda" style="margin:0">No se pudieron cargar.</p>`;
      return;
    }
    // La pantalla pudo cambiar mientras se cargaba.
    if (!caja.isConnected) return;

    const debe = datos.pendiente?.centavos || 0;
    const cuantos = datos.pendiente?.cuantos || 0;
    const lista = datos.adelantos || [];

    caja.innerHTML = `
      <h3 class="emp-sub" style="margin-top:0">Vales de sueldo</h3>

      ${debe ? `
        <div class="salidas" style="margin-bottom:14px">
          <span>El día que se le pague, descontarle</span>
          <strong>${esc(pesos(debe))}</strong>
          <small>${cuantos} ${cuantos === 1 ? 'vale' : 'vales'} sin descontar</small>
        </div>
        <button id="descontar">✓ Ya se le descontó</button>
        <p class="ayuda" style="margin:10px 0 0">
          Esto <b>no mueve dinero</b>: el dinero salió del cajón el día del
          vale. Aquí solo se apaga el recordatorio, cuando ya se le pagó su
          sueldo de menos.
        </p>
      ` : `
        <p class="ayuda" style="margin:0">
          ${lista.length
            ? 'No debe nada: todos sus vales ya se le descontaron.'
            : 'Nunca ha pedido un adelanto de su sueldo.'}
        </p>`}

      ${lista.length ? `
        <div class="hist-envoltura" style="margin-top:14px">
          <table class="tabla hist-tabla">
            <tr><th>Cuándo</th><th class="der">Cuánto</th><th>Cómo va</th></tr>
            ${lista.map((a) => `
              <tr class="${a.anulado_en ? 'anulada' : ''}">
                <td>${esc(fechaCorta(a.fecha))}
                    ${a.caja_folio ? `<small>turno #${a.caja_folio}</small>` : ''}</td>
                <td class="der">${esc(pesos(a.centavos))}</td>
                <td>
                  ${a.anulado_en
                    ? `<span class="hist-que que-cancelada">anulado</span>
                       ${a.motivo_anulacion ? `<small>${esc(a.motivo_anulacion)}</small>` : ''}`
                    : a.descontado_en
                      ? `<span class="hist-que que-entrada">ya se le descontó</span>
                         <small>${esc(fechaCorta(a.descontado_en))}${
                           a.descontado_por_nombre ? ` · ${esc(a.descontado_por_nombre)}` : ''}</small>
                         <button class="secundario chico" data-deshacer="${esc(a.id)}"
                                 title="No se le descontó: volver a dejarlo pendiente">↩</button>`
                      : '<span class="hist-que que-gasto">pendiente</span>'}
                </td>
              </tr>`).join('')}
          </table>
        </div>` : ''}`;

    const btn = caja.querySelector('#descontar');
    if (btn) {
      btn.onclick = async () => {
        const ok = await confirmar({
          titulo: '¿Ya se le descontó?',
          texto: `Se le pagó su sueldo con ${pesos(debe)} de menos. ` +
                 'Sus vales dejan de aparecer como pendientes.',
          ok: 'Sí, ya se le descontó'
        });
        if (!ok) return;
        try {
          await api.enviar(`/usuarios/${usuario.id}/adelantos/descontar`, {});
          avisar('Listo. Ya no tiene vales pendientes.', 'bien');
          pintarVales(usuario);
        } catch (e) { avisar(e.message, 'error'); }
      };
    }

    caja.querySelectorAll('[data-deshacer]').forEach((b) => {
      b.onclick = async () => {
        try {
          await api.enviar(
            `/usuarios/${usuario.id}/adelantos/${b.dataset.deshacer}/deshacer`, {});
          avisar('Ese vale vuelve a estar pendiente.', 'bien');
          pintarVales(usuario);
        } catch (e) { avisar(e.message, 'error'); }
      };
    });
  }

  function formulario(usuario) {
    const esNuevo = !usuario;

    pantalla.innerHTML = `
      <div>
        <button class="secundario chico" id="cancelar">‹ La gente</button>
        <h2 style="margin-top:14px">${esNuevo ? 'Nuevo usuario' : esc(usuario.nombre)}</h2>

        <div class="tarjeta">
          <form id="f">
            <div class="emp-campos">
              <label>
                <span class="etiqueta-chica">Nombre completo</span>
                <input id="nombre" required value="${esNuevo ? '' : esc(usuario.nombre)}">
              </label>
              <label>
                <span class="etiqueta-chica">Qué hace<small id="que-hace"></small></span>
                <select id="rol">
                  ${Object.entries(ETIQUETAS_ROL).map(([v, t]) =>
                    `<option value="${v}" ${!esNuevo && usuario.rol === v ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
              </label>
              ${esNuevo ? `
                <label>
                  <span class="etiqueta-chica">PIN<small>4 a 6 dígitos, para el celular</small></span>
                  <input id="pin" inputmode="numeric" pattern="[0-9]{4,6}" maxlength="6" required>
                </label>` : ''}
            </div>

            ${esNuevo ? `
              <!-- Solo los que entran desde la PC necesitan contraseña.
                   A un operario pedírsela es estorbo puro. -->
              <div id="bloque-contrasena" hidden>
                <div class="emp-campos" style="margin-top:14px">
                  <label>
                    <span class="etiqueta-chica">Usuario<small>para entrar desde la PC</small></span>
                    <input id="usuario" autocapitalize="none" placeholder="lupita">
                  </label>
                  <label>
                    <span class="etiqueta-chica">Contraseña<small>mínimo 8 caracteres</small></span>
                    <input id="contrasena" type="password">
                  </label>
                </div>
                <p class="ayuda" style="margin:8px 0 0;font-size:13.5px">
                  Los administradores y gerentes también entran desde la PC con
                  usuario y contraseña.
                </p>
              </div>` : ''}

            <button type="submit" style="margin-top:20px">Guardar</button>
          </form>
        </div>

        ${esNuevo ? '' : `
          <div class="tarjeta">
            <h3 class="emp-sub" style="margin-top:0">Lo que se le puede hacer</h3>
            <div class="usr-botones">
              <button class="secundario" id="cambiar-pin">Cambiar PIN</button>
              ${usuario.usuario ? '<button class="secundario" id="cambiar-contrasena">Cambiar contraseña</button>' : ''}
              <button class="${usuario.activo ? 'peligro' : 'secundario'}" id="baja">
                ${usuario.activo ? 'Dar de baja' : 'Reactivar'}
              </button>
            </div>
            <p class="ayuda" style="margin:14px 0 0">
              Dado de baja: desaparece de las pantallas, pero <b>sus registros se
              conservan</b> — las ventas que hizo siguen siendo suyas y los paños
              que sacó siguen diciendo su nombre.
            </p>
          </div>

          <div class="tarjeta" id="vales-caja">
            <h3 class="emp-sub" style="margin-top:0">Vales de sueldo</h3>
            <p class="ayuda" style="margin:0">Cargando…</p>
          </div>

          <div class="tarjeta plana">
            <table class="tabla">
              <tr><th>Entró a la fábrica</th><td>${esc(fecha(usuario.fecha_alta))}</td></tr>
              ${usuario.fecha_baja ? `<tr><th>Se dio de baja</th><td>${esc(fecha(usuario.fecha_baja))}</td></tr>` : ''}
              ${usuario.actividad?.ultimaEntrada
                ? `<tr><th>Última vez que entró</th><td>${esc(fechaCorta(usuario.actividad.ultimaEntrada))}</td></tr>`
                : '<tr><th>Última vez que entró</th><td>Nunca</td></tr>'}
              <tr><th>Cómo entra</th><td>${esc(comoEntra(usuario))}</td></tr>
              <tr><th>ID interno</th><td style="font-size:12px;word-break:break-all">${esc(usuario.id)}</td></tr>
            </table>
          </div>`}
      </div>`;

    pantalla.querySelector('#cancelar').onclick = pintar;

    // Debajo del rol se dice qué hace ese rol, mientras se elige. "Gerente
    // de turno" no le dice a nadie qué va a poder tocar esa persona.
    const selectorRol = pantalla.querySelector('#rol');
    const bloque = pantalla.querySelector('#bloque-contrasena');
    const ajustar = () => {
      pantalla.querySelector('#que-hace').textContent = QUE_HACE[selectorRol.value] || '';
      // El bloque de contraseña aparece y desaparece según el rol elegido.
      if (bloque) bloque.hidden = !['admin', 'gerente'].includes(selectorRol.value);
    };
    selectorRol.onchange = ajustar;
    ajustar();

    pantalla.querySelector('#f').onsubmit = async (ev) => {
      ev.preventDefault();
      const cuerpo = {
        nombre: pantalla.querySelector('#nombre').value,
        rol: pantalla.querySelector('#rol').value
      };
      try {
        if (esNuevo) {
          cuerpo.pin = pantalla.querySelector('#pin').value;
          const conContrasena = ['admin', 'gerente'].includes(cuerpo.rol);
          cuerpo.usuario = conContrasena
            ? (pantalla.querySelector('#usuario').value.trim() || undefined) : undefined;
          cuerpo.contrasena = conContrasena
            ? (pantalla.querySelector('#contrasena').value || undefined) : undefined;
          await api.enviar('/usuarios', cuerpo);
          avisar('Usuario creado', 'bien');
        } else {
          await api.actualizar(`/usuarios/${usuario.id}`, cuerpo);
          avisar('Cambios guardados', 'bien');
        }
        pintar();
      } catch (e) { avisar(e.message, 'error'); }
    };

    if (esNuevo) return;

    pintarVales(usuario);

    pantalla.querySelector('#cambiar-pin').onclick = async () => {
      const pin = await pedirClaveNueva({
        titulo: `PIN nuevo para ${usuario.nombre}`, tipo: 'pin', ok: 'Cambiar el PIN'
      });
      if (!pin) return;
      try { await api.enviar(`/usuarios/${usuario.id}/pin`, { pin }); avisar('PIN cambiado', 'bien'); }
      catch (e) { avisar(e.message, 'error'); }
    };

    const btnContrasena = pantalla.querySelector('#cambiar-contrasena');
    if (btnContrasena) btnContrasena.onclick = async () => {
      const contrasena = await pedirClaveNueva({
        titulo: `Contraseña nueva para ${usuario.nombre}`,
        texto: 'Es la que se usa para entrar desde la PC y para lo que no se puede deshacer.',
        ok: 'Cambiar la contraseña'
      });
      if (!contrasena) return;
      try { await api.enviar(`/usuarios/${usuario.id}/contrasena`, { contrasena }); avisar('Contraseña cambiada', 'bien'); }
      catch (e) { avisar(e.message, 'error'); }
    };

    pantalla.querySelector('#baja').onclick = async () => {
      const accion = usuario.activo ? 'baja' : 'alta';
      if (usuario.activo && !await confirmar({
        titulo: `¿Dar de baja a ${usuario.nombre}?`,
        texto: 'Deja de aparecer para entrar. Nada se borra: se puede volver a dar de alta.',
        ok: 'Dar de baja', peligro: true
      })) return;
      try {
        await api.enviar(`/usuarios/${usuario.id}/${accion}`, {});
        avisar(usuario.activo ? 'Usuario dado de baja' : 'Usuario reactivado', 'bien');
        pintar();
      } catch (e) { avisar(e.message, 'error'); }
    };
  }

  await pintar();
}
