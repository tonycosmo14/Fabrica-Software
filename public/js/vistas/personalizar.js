/**
 * PERSONALIZAR — logo y datos del negocio.
 * Solo el administrador entra aquí.
 *
 * El logo se guarda en la carpeta "datos", nunca dentro del programa,
 * así que no se pierde al actualizar el sistema.
 */
import { api } from '../api.js';
import { esc, avisar } from '../util.js';
import { cargarMarca } from '../marca.js';
import { confirmar } from '../dialogo.js';

const MAX_MB = 3;

export async function vistaPersonalizar(pantalla) {
  await pintar();

  async function pintar() {
    const m = await cargarMarca({ recargar: true });
    const v = encodeURIComponent(m.version);

    pantalla.innerHTML = `
      <h2>Personalizar</h2>
      <p class="ayuda">
        El logo y el nombre que ve todo el mundo al entrar. Se guardan aparte
        del programa, así que no se pierden cuando el sistema se actualiza.
      </p>

      <h3>Logo</h3>
      <div class="tarjeta">
        <div class="logo-previa">
          ${m.logoClaro
            ? `<img src="/marca/logo?v=${v}" alt="Logo actual">
               <button class="tachita" id="quitar-claro" title="Quitar el logo"
                       aria-label="Quitar el logo">✕</button>`
            : '<span class="logo-vacio">Sin logo — se muestra el nombre en letras</span>'}
        </div>
        <label class="subir" for="archivo-claro">
          ${m.logoClaro ? 'Cambiar el logo' : 'Subir logo'}
          <input type="file" id="archivo-claro" accept="image/png,image/svg+xml,image/jpeg,image/webp" hidden>
        </label>
        <p class="ayuda" style="margin:14px 0 0;font-size:14px">
          PNG, SVG, JPG o WEBP, hasta ${MAX_MB} MB. Lo mejor es un PNG con fondo
          transparente, ancho y no muy alto.
        </p>
      </div>

      <h3>Logo para modo oscuro <small style="font-weight:400;color:var(--suave)">(opcional)</small></h3>
      <div class="tarjeta">
        <div class="logo-previa oscura">
          ${m.logoOscuro
            ? `<img src="/marca/logo-oscuro?v=${v}" alt="Logo para modo oscuro">
               <button class="tachita" id="quitar-oscuro" title="Quitar el logo oscuro"
                       aria-label="Quitar el logo oscuro">✕</button>`
            : '<span class="logo-vacio">Sin logo oscuro — se usa el normal sobre una placa blanca</span>'}
        </div>
        <label class="subir" for="archivo-oscuro">
          ${m.logoOscuro ? 'Cambiar el logo oscuro' : 'Subir logo para modo oscuro'}
          <input type="file" id="archivo-oscuro" accept="image/png,image/svg+xml,image/jpeg,image/webp" hidden>
        </label>
        <p class="ayuda" style="margin:14px 0 0;font-size:14px">
          Si tu logo es de letras negras, aquí puedes subir la versión en blanco
          para que se vea bien en modo oscuro.
        </p>
      </div>

      <h3>Datos del negocio</h3>
      <div class="tarjeta">
        <form id="f">
          <label for="nombre">Nombre del negocio</label>
          <input id="nombre" value="${esc(m.nombreNegocio)}" maxlength="60" required autocomplete="off">

          <label for="ciudad">Ciudad</label>
          <input id="ciudad" value="${esc(m.ciudad || '')}" maxlength="60" autocomplete="off">

          <button type="submit" style="margin-top:20px">Guardar</button>
        </form>
      </div>`;

    enlazarSubida('#archivo-claro', 'claro');
    enlazarSubida('#archivo-oscuro', 'oscuro');
    enlazarQuitar('#quitar-claro', 'claro');
    enlazarQuitar('#quitar-oscuro', 'oscuro');

    pantalla.querySelector('#f').onsubmit = async (ev) => {
      ev.preventDefault();
      try {
        await api.actualizar('/personalizacion', {
          nombreNegocio: pantalla.querySelector('#nombre').value,
          ciudad: pantalla.querySelector('#ciudad').value
        });
        avisar('Datos guardados', 'bien');
        await cargarMarca({ recargar: true });
      } catch (e) { avisar(e.message, 'error'); }
    };
  }

  function enlazarSubida(selector, variante) {
    const campo = pantalla.querySelector(selector);
    if (!campo) return;

    campo.onchange = async () => {
      const archivo = campo.files?.[0];
      if (!archivo) return;

      if (archivo.size > MAX_MB * 1024 * 1024) {
        return avisar(`El archivo pesa ${Math.round(archivo.size / 1024 / 1024)} MB y el máximo son ${MAX_MB} MB.`, 'error');
      }

      avisar('Subiendo el logo…');
      try {
        const datos = await leerComoTexto(archivo);
        await api.enviar('/personalizacion/logo', { variante, archivo: datos });
        avisar('Logo actualizado', 'bien');
        await pintar();
      } catch (e) {
        avisar(e.message, 'error');
      } finally {
        campo.value = '';
      }
    };
  }

  function enlazarQuitar(selector, variante) {
    const boton = pantalla.querySelector(selector);
    if (!boton) return;

    boton.onclick = async () => {
      const sigue = await confirmar({
        titulo: '¿Eliminar la imagen?',
        texto: 'Se volverá a mostrar el nombre en letras. Puedes subirla otra vez cuando quieras.',
        ok: 'Eliminar', peligro: true
      });
      if (!sigue) return;
      try {
        await api.enviar('/personalizacion/logo/quitar', { variante });
        avisar('Imagen eliminada', 'bien');
        await pintar();
      } catch (e) { avisar(e.message, 'error'); }
    };
  }
}

/** Convierte el archivo elegido a texto para poder mandarlo al servidor. */
function leerComoTexto(archivo) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(lector.result);
    lector.onerror = () => rechazar(new Error('No se pudo leer el archivo.'));
    lector.readAsDataURL(archivo);
  });
}
