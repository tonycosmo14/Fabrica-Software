/**
 * Pantalla de entrada.
 * Paso 1: tocas tu nombre.  Paso 2: escribes tu PIN.
 * El admin tambien puede entrar con usuario y contraseña.
 */
import { api } from '../api.js';
import { esc, avisar, ETIQUETAS_ROL } from '../util.js';

export async function vistaEntrar(pantalla, { alEntrar }) {
  const { usuarios } = await api.obtener('/auth/usuarios-disponibles');

  // En la PC se escribe el PIN con el teclado fisico. Este es el "apagador"
  // del escucha de teclas: se llama al salir de la pantalla para no dejarlo colgado.
  let soltarTeclado = null;
  function limpiarTeclado() {
    if (soltarTeclado) { document.removeEventListener('keydown', soltarTeclado); soltarTeclado = null; }
  }

  listaDeUsuarios();

  function listaDeUsuarios() {
    limpiarTeclado();
    pantalla.innerHTML = `
      <div class="entrada">
        <div class="logo">
          <div class="emoji">🧊</div>
          <h2>Fábrica de Hielo</h2>
          <small>Toca tu nombre para entrar</small>
        </div>
        <div class="lista-usuarios">
          ${usuarios.map((u) => `
            <button class="usuario-boton" data-id="${esc(u.id)}">
              <span class="inicial">${esc(u.nombre.trim().charAt(0).toUpperCase())}</span>
              <span class="datos">
                <strong>${esc(u.nombre)}</strong>
                <small>${esc(ETIQUETAS_ROL[u.rol] || u.rol)}</small>
              </span>
            </button>`).join('') || '<p class="vacio">No hay usuarios con PIN todavía.</p>'}
        </div>
        <button class="secundario" id="btn-contrasena" style="margin-top:18px">
          Entrar con usuario y contraseña
        </button>
      </div>`;

    pantalla.querySelectorAll('.usuario-boton').forEach((b) => {
      b.onclick = () => pantallaPin(usuarios.find((u) => u.id === b.dataset.id));
    });
    pantalla.querySelector('#btn-contrasena').onclick = pantallaContrasena;
  }

  function pantallaPin(usuario) {
    limpiarTeclado();
    let pin = '';

    pantalla.innerHTML = `
      <div class="entrada">
        <div class="logo">
          <div class="inicial" style="margin:0 auto 10px;width:60px;height:60px;font-size:26px">
            ${esc(usuario.nombre.trim().charAt(0).toUpperCase())}
          </div>
          <h2>${esc(usuario.nombre)}</h2>
          <small>Escribe tu PIN</small>
        </div>
        <div class="puntos-pin" id="puntos"></div>
        <div class="teclado">
          ${[1,2,3,4,5,6,7,8,9].map((n) => `<button data-t="${n}">${n}</button>`).join('')}
          <button class="accion" data-t="volver">Volver</button>
          <button data-t="0">0</button>
          <button class="accion" data-t="borrar">Borrar</button>
        </div>
      </div>`;

    const puntos = pantalla.querySelector('#puntos');
    const pintar = () => {
      puntos.innerHTML = Array.from({ length: Math.max(pin.length, 4) },
        (_, i) => `<i class="${i < pin.length ? 'lleno' : ''}"></i>`).join('');
    };
    pintar();

    // Una sola funcion para el dedo y para el teclado de la PC.
    async function tocar(t) {
      if (t === 'volver') return listaDeUsuarios();
      if (t === 'borrar') { pin = pin.slice(0, -1); return pintar(); }
      if (pin.length >= 6) return;

      pin += t;
      pintar();

      // Con 4 digitos ya se intenta entrar. Si falla, se puede seguir escribiendo.
      if (pin.length >= 4) {
        try {
          const datos = await api.enviar('/auth/entrar-pin', { usuarioId: usuario.id, pin });
          limpiarTeclado();
          alEntrar(datos);
        } catch (e) {
          if (pin.length === 6) {
            avisar(e.message, 'error');
            pin = '';
            pintar();
          }
        }
      }
    }

    pantalla.querySelectorAll('.teclado button').forEach((b) => {
      b.onclick = () => tocar(b.dataset.t);
    });

    soltarTeclado = (ev) => {
      if (ev.key >= '0' && ev.key <= '9') { ev.preventDefault(); tocar(ev.key); }
      else if (ev.key === 'Backspace') { ev.preventDefault(); tocar('borrar'); }
      else if (ev.key === 'Escape') { ev.preventDefault(); tocar('volver'); }
    };
    document.addEventListener('keydown', soltarTeclado);
  }

  function pantallaContrasena() {
    limpiarTeclado();
    pantalla.innerHTML = `
      <div class="entrada">
        <div class="logo"><div class="emoji">🔐</div><h2>Administrador</h2></div>
        <form id="f">
          <label for="u">Usuario</label>
          <input id="u" autocapitalize="none" autocomplete="username" required>
          <label for="c">Contraseña</label>
          <input id="c" type="password" autocomplete="current-password" required>
          <button type="submit" style="margin-top:20px">Entrar</button>
          <button type="button" class="secundario" id="volver" style="margin-top:10px">Volver</button>
        </form>
      </div>`;

    pantalla.querySelector('#volver').onclick = listaDeUsuarios;
    pantalla.querySelector('#f').onsubmit = async (ev) => {
      ev.preventDefault();
      try {
        const datos = await api.enviar('/auth/entrar-contrasena', {
          usuario: pantalla.querySelector('#u').value,
          contrasena: pantalla.querySelector('#c').value
        });
        limpiarTeclado();
        alEntrar(datos);
      } catch (e) { avisar(e.message, 'error'); }
    };
  }
}
