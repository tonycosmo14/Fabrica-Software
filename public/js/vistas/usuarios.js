/**
 * Pantalla de usuarios (solo admin).
 * Recuerda: aqui nadie se borra, se da de baja (regla de oro 3.4).
 */
import { api } from '../api.js';
import { esc, avisar, fecha, ETIQUETAS_ROL } from '../util.js';

export async function vistaUsuarios(pantalla) {
  let verInactivos = false;

  async function pintar() {
    const { usuarios } = await api.obtener(`/usuarios?incluirInactivos=${verInactivos ? 1 : 0}`);

    pantalla.innerHTML = `
      <h2>Usuarios</h2>
      <p class="ayuda">Cada empleado entra con su propio PIN. Nadie se borra: se da de baja
      y su historial se conserva completo.</p>

      <button id="nuevo">＋ Nuevo usuario</button>

      <label style="display:flex;align-items:center;gap:10px;margin:18px 0 10px">
        <input type="checkbox" id="ver-inactivos" style="width:auto" ${verInactivos ? 'checked' : ''}>
        <span style="font-weight:500">Mostrar dados de baja</span>
      </label>

      ${usuarios.map((u) => `
        <div class="item ${u.activo ? '' : 'inactivo'}">
          <span class="inicial">${esc(u.nombre.trim().charAt(0).toUpperCase())}</span>
          <div class="crece">
            <strong>${esc(u.nombre)}</strong>
            <small>
              <span class="etiqueta ${esc(u.rol)}">${esc(ETIQUETAS_ROL[u.rol] || u.rol)}</span>
              ${u.usuario ? ` · ${esc(u.usuario)}` : ''}
              ${u.activo ? '' : ' · <span class="etiqueta baja">de baja</span>'}
            </small>
          </div>
          <button class="chico secundario" data-editar="${esc(u.id)}">Editar</button>
        </div>`).join('') || '<p class="vacio">No hay usuarios.</p>'}`;

    pantalla.querySelector('#ver-inactivos').onchange = (e) => { verInactivos = e.target.checked; pintar(); };
    pantalla.querySelector('#nuevo').onclick = () => formulario(null);
    pantalla.querySelectorAll('[data-editar]').forEach((b) => {
      b.onclick = () => formulario(usuarios.find((u) => u.id === b.dataset.editar));
    });
  }

  function formulario(usuario) {
    const esNuevo = !usuario;

    pantalla.innerHTML = `
      <h2>${esNuevo ? 'Nuevo usuario' : esc(usuario.nombre)}</h2>
      <div class="tarjeta">
        <form id="f">
          <label for="nombre">Nombre completo</label>
          <input id="nombre" required value="${esNuevo ? '' : esc(usuario.nombre)}">

          <label for="rol">Rol</label>
          <select id="rol">
            ${Object.entries(ETIQUETAS_ROL).map(([v, t]) =>
              `<option value="${v}" ${!esNuevo && usuario.rol === v ? 'selected' : ''}>${t}</option>`).join('')}
          </select>

          ${esNuevo ? `
            <label for="pin">PIN (4 a 6 dígitos)</label>
            <input id="pin" inputmode="numeric" pattern="[0-9]{4,6}" maxlength="6" required>

            <label for="usuario">Usuario para contraseña <small style="font-weight:400">(opcional, solo admin)</small></label>
            <input id="usuario" autocapitalize="none">

            <label for="contrasena">Contraseña <small style="font-weight:400">(mínimo 8 caracteres)</small></label>
            <input id="contrasena" type="password">
          ` : ''}

          <button type="submit" style="margin-top:20px">Guardar</button>
          <button type="button" class="secundario" id="cancelar" style="margin-top:10px">Cancelar</button>
        </form>
      </div>

      ${esNuevo ? '' : `
        <h3>Acciones</h3>
        <div class="tarjeta">
          <button class="secundario" id="cambiar-pin">Cambiar PIN</button>
          ${usuario.usuario ? `<button class="secundario" id="cambiar-contrasena" style="margin-top:10px">Cambiar contraseña</button>` : ''}
          <button class="${usuario.activo ? 'peligro' : 'secundario'}" id="baja" style="margin-top:10px">
            ${usuario.activo ? 'Dar de baja' : 'Reactivar'}
          </button>
          <p class="ayuda" style="margin:14px 0 0">
            Dado de baja: desaparece de las pantallas pero sus registros se conservan.
          </p>
        </div>
        <div class="tarjeta plana">
          <table class="tabla">
            <tr><th>Alta</th><td>${esc(fecha(usuario.fecha_alta))}</td></tr>
            ${usuario.fecha_baja ? `<tr><th>Baja</th><td>${esc(fecha(usuario.fecha_baja))}</td></tr>` : ''}
            <tr><th>ID interno</th><td style="font-size:12px;word-break:break-all">${esc(usuario.id)}</td></tr>
          </table>
        </div>`}`;

    pantalla.querySelector('#cancelar').onclick = pintar;

    pantalla.querySelector('#f').onsubmit = async (ev) => {
      ev.preventDefault();
      const cuerpo = {
        nombre: pantalla.querySelector('#nombre').value,
        rol: pantalla.querySelector('#rol').value
      };
      try {
        if (esNuevo) {
          cuerpo.pin = pantalla.querySelector('#pin').value;
          cuerpo.usuario = pantalla.querySelector('#usuario').value.trim() || undefined;
          cuerpo.contrasena = pantalla.querySelector('#contrasena').value || undefined;
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

    pantalla.querySelector('#cambiar-pin').onclick = async () => {
      const pin = prompt('Nuevo PIN (4 a 6 dígitos):');
      if (!pin) return;
      try { await api.enviar(`/usuarios/${usuario.id}/pin`, { pin }); avisar('PIN cambiado', 'bien'); }
      catch (e) { avisar(e.message, 'error'); }
    };

    const btnContrasena = pantalla.querySelector('#cambiar-contrasena');
    if (btnContrasena) btnContrasena.onclick = async () => {
      const contrasena = prompt('Nueva contraseña (mínimo 8 caracteres):');
      if (!contrasena) return;
      try { await api.enviar(`/usuarios/${usuario.id}/contrasena`, { contrasena }); avisar('Contraseña cambiada', 'bien'); }
      catch (e) { avisar(e.message, 'error'); }
    };

    pantalla.querySelector('#baja').onclick = async () => {
      const accion = usuario.activo ? 'baja' : 'alta';
      if (usuario.activo && !confirm(`¿Dar de baja a ${usuario.nombre}?`)) return;
      try {
        await api.enviar(`/usuarios/${usuario.id}/${accion}`, {});
        avisar(usuario.activo ? 'Usuario dado de baja' : 'Usuario reactivado', 'bien');
        pintar();
      } catch (e) { avisar(e.message, 'error'); }
    };
  }

  await pintar();
}
