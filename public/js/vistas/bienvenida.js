/**
 * PRIMER ARRANQUE — crear la cuenta del administrador.
 *
 * El sistema no trae ningún usuario de fábrica. La primera persona que abre
 * el programa crea aquí su cuenta, y esa cuenta es la dueña del sistema.
 */
import { api } from '../api.js';
import { esc, avisar } from '../util.js';

export function vistaBienvenida(pantalla, { alEntrar }) {
  pantalla.innerHTML = `
    <div class="entrada">
      <div class="logo">
        <div class="marca">
          <span class="marca-hielo">Hielo</span>
          <span class="marca-lolha">LOLHA</span>
        </div>
      </div>

      <h2 style="text-align:center;margin-bottom:6px">Bienvenido</h2>
      <p class="ayuda" style="text-align:center">
        Es la primera vez que abres el sistema.
        Crea tu cuenta de administrador para empezar.
      </p>

      <form id="f">
        <label for="nombre">Tu nombre</label>
        <input id="nombre" required autocomplete="name" placeholder="Antonio Castilla">

        <label for="usuario">Usuario <small style="font-weight:400">(para entrar desde la PC)</small></label>
        <input id="usuario" required autocapitalize="none" autocomplete="username"
               placeholder="tony" pattern="[a-zA-Z0-9._\\-]{3,20}">

        <label for="contrasena">Contraseña <small style="font-weight:400">(mínimo 8 caracteres)</small></label>
        <input id="contrasena" type="password" required minlength="8" autocomplete="new-password">

        <label for="pin">PIN <small style="font-weight:400">(4 a 6 dígitos, para entrar desde el celular)</small></label>
        <input id="pin" inputmode="numeric" pattern="[0-9]{4,6}" maxlength="6" required
               autocomplete="off" placeholder="••••">

        <label for="pin2">Repite el PIN</label>
        <input id="pin2" inputmode="numeric" pattern="[0-9]{4,6}" maxlength="6" required
               autocomplete="off" placeholder="••••">

        <button type="submit" style="margin-top:22px">Crear mi cuenta y entrar</button>
      </form>

      <p class="ayuda" style="margin-top:20px;font-size:14px">
        Apúntalos donde no se pierdan. No hay forma de recuperarlos desde afuera:
        ni el PIN ni la contraseña se guardan tal cual, solo su huella cifrada.
      </p>
    </div>`;

  pantalla.querySelector('#f').onsubmit = async (ev) => {
    ev.preventDefault();

    const pin = pantalla.querySelector('#pin').value;
    if (pin !== pantalla.querySelector('#pin2').value) {
      return avisar('Los dos PIN no son iguales.', 'error');
    }

    const boton = pantalla.querySelector('button[type=submit]');
    boton.disabled = true;

    try {
      const datos = await api.enviar('/auth/configuracion-inicial', {
        nombre: pantalla.querySelector('#nombre').value,
        usuario: pantalla.querySelector('#usuario').value,
        contrasena: pantalla.querySelector('#contrasena').value,
        pin
      });
      avisar(`Listo, ${esc(datos.usuario.nombre.split(' ')[0])}. Bienvenido.`, 'bien');
      alEntrar(datos);
    } catch (e) {
      avisar(e.message, 'error');
      boton.disabled = false;
    }
  };
}
