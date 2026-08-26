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
import { sonidoEncendido, cambiarSonido, tono } from '../sonido.js';

const MAX_MB = 3;

export async function vistaPersonalizar(pantalla) {
  await pintar();

  async function pintar() {
    const m = await cargarMarca({ recargar: true });
    const v = encodeURIComponent(m.version);
    const r = m.rejilla || { columnas: 5, filas: 3 };
    const t = r.topes || { columnas: { minimo: 2, maximo: 10 }, filas: { minimo: 1, maximo: 8 } };

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
      </div>

      <h3>Los cuadros de Vender</h3>
      <div class="tarjeta">
        <p class="ayuda" style="margin:0 0 14px">
          Cuántos cuadros de productos se ven de una vez en la caja. Menos
          cuadros = cuadros más grandes, que se tocan mejor con el dedo y se
          leen de lejos. Más cuadros = menos entrar y salir de categorías.
          Si sobran productos, la rejilla se desliza.
        </p>

        <form id="f-rejilla">
          <div class="rejilla-campos">
            <div>
              <label for="columnas">Columnas (de ${t.columnas.minimo} a ${t.columnas.maximo})</label>
              <input id="columnas" type="number" inputmode="numeric"
                     min="${t.columnas.minimo}" max="${t.columnas.maximo}"
                     value="${r.columnas}" required>
            </div>
            <div>
              <label for="filas">Filas (de ${t.filas.minimo} a ${t.filas.maximo})</label>
              <input id="filas" type="number" inputmode="numeric"
                     min="${t.filas.minimo}" max="${t.filas.maximo}"
                     value="${r.filas}" required>
            </div>
          </div>

          <div class="rejilla-previa" id="previa"></div>
          <p class="ayuda" style="margin:10px 0 0;font-size:13.5px" id="previa-texto"></p>

          <button type="submit" style="margin-top:18px">Guardar el tamaño</button>
        </form>

        <p class="ayuda" style="margin:14px 0 0;font-size:13.5px">
          En el celular no se aplica: ahí entran los que quepan, porque
          ${t.columnas.maximo} columnas en una pantalla de mano no se leen.
        </p>
      </div>

      <h3>Sonido</h3>
      <div class="tarjeta">
        <label class="interruptor">
          <input type="checkbox" id="sonido" ${sonidoEncendido() ? 'checked' : ''}>
          <span>
            <strong>Un ruidito cuando algo se acepta o falla</strong>
            <small>
              En el mostrador el cajero no está mirando la pantalla cuando
              aprieta enter: está viendo al cliente. El oído le dice si el
              ticket entró.
            </small>
          </span>
        </label>
        <p class="ayuda" style="margin:12px 0 0">
          Se guarda <b>en este aparato</b>, no en el negocio: la computadora
          de la caja tiene bocinas y el celular del reparto no tiene por qué
          ponerse a pitar en la calle.
        </p>
        <button class="secundario chico" id="probar-sonido" style="margin-top:12px">
          Oírlo
        </button>
      </div>`;

    enlazarSubida('#archivo-claro', 'claro');
    enlazarSubida('#archivo-oscuro', 'oscuro');
    enlazarQuitar('#quitar-claro', 'claro');
    enlazarQuitar('#quitar-oscuro', 'oscuro');

    pantalla.querySelector('#sonido').onchange = (ev) => {
      cambiarSonido(ev.target.checked);
      avisar(ev.target.checked ? 'Sonido encendido' : 'Sonido apagado', '');
    };
    pantalla.querySelector('#probar-sonido').onclick = () => {
      tono('cobrado');
      avisar('Así suena una venta cobrada', 'bien');
    };

    // LA PREVIA. Un número no dice nada; el dibujito sí. Se repinta
    // mientras se teclea, antes de guardar nada.
    const campoColumnas = pantalla.querySelector('#columnas');
    const campoFilas = pantalla.querySelector('#filas');
    const previa = pantalla.querySelector('#previa');
    const previaTexto = pantalla.querySelector('#previa-texto');

    function entre(campo, topes) {
      const n = Math.round(Number(campo.value));
      if (!Number.isFinite(n)) return topes.minimo;
      return Math.min(Math.max(n, topes.minimo), topes.maximo);
    }

    function pintarPrevia() {
      const columnas = entre(campoColumnas, t.columnas);
      const filas = entre(campoFilas, t.filas);
      previa.style.gridTemplateColumns = `repeat(${columnas}, 1fr)`;
      previa.innerHTML = '<span></span>'.repeat(columnas * filas);
      previaTexto.textContent =
        `${columnas * filas} cuadros a la vista: ${columnas} de ancho por ${filas} de alto.`;
    }
    campoColumnas.oninput = pintarPrevia;
    campoFilas.oninput = pintarPrevia;
    pintarPrevia();

    pantalla.querySelector('#f-rejilla').onsubmit = async (ev) => {
      ev.preventDefault();
      try {
        await api.actualizar('/personalizacion', {
          posColumnas: entre(campoColumnas, t.columnas),
          posFilas: entre(campoFilas, t.filas)
        });
        avisar('Guardado. Se ve al entrar a Vender.', 'bien');
        await cargarMarca({ recargar: true });
      } catch (e) { avisar(e.message, 'error'); }
    };

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
