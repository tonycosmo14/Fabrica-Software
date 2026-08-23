/**
 * DIÁLOGOS DEL SISTEMA
 *
 * Sustituyen a los prompt() y confirm() del navegador, que son feos, no
 * respetan los colores de la marca y en el celular salen como una alerta
 * del sistema.
 *
 * En celular aparecen desde abajo (hoja); en PC, centrados.
 * Todos devuelven una promesa: se usan con await.
 */
import { crearTeclado, aTexto, deTexto } from './fracciones.js';

function cerrar(caja) {
  caja.classList.remove('abierto');
  setTimeout(() => caja.remove(), 160);
}

/**
 * Monta el diálogo y devuelve { caja, salir }.
 *
 * salir(valor) cierra y resuelve la promesa UNA sola vez: si el usuario
 * elige una opción y además se dispara el cierre del fondo, la primera
 * llamada manda y las demás se ignoran.
 */
function montar(contenido, resolver, valorAlCancelar = null) {
  const caja = document.createElement('div');
  caja.className = 'dialogo';
  caja.innerHTML = `<div class="dialogo-fondo"></div><div class="dialogo-hoja">${contenido}</div>`;
  document.body.appendChild(caja);

  // Un cuadro de animación para que la transición de entrada se vea.
  requestAnimationFrame(() => caja.classList.add('abierto'));

  let resuelto = false;
  const escape = (ev) => { if (ev.key === 'Escape') salir(valorAlCancelar); };

  function salir(valor) {
    if (resuelto) return;
    resuelto = true;
    document.removeEventListener('keydown', escape);
    cerrar(caja);
    resolver(valor);
  }

  caja.querySelector('.dialogo-fondo').onclick = () => salir(valorAlCancelar);
  document.addEventListener('keydown', escape);

  return { caja, salir };
}

/** Confirmación de sí o no. Devuelve true o false. */
export function confirmar({ titulo, texto = '', ok = 'Aceptar', peligro = false }) {
  return new Promise((resolver) => {
    const { caja, salir } = montar(`
      <h3 class="dialogo-titulo">${titulo}</h3>
      ${texto ? `<p class="dialogo-texto">${texto}</p>` : ''}
      <div class="dialogo-botones">
        <button class="secundario" data-no>Cancelar</button>
        <button class="${peligro ? 'peligro' : ''}" data-si>${ok}</button>
      </div>`, resolver, false);

    caja.querySelector('[data-no]').onclick = () => salir(false);
    caja.querySelector('[data-si]').onclick = () => salir(true);
  });
}

/**
 * Pide un número con botones − y +, además del teclado.
 * Con las manos mojadas es mucho más fácil tocar + que escribir.
 */
export function pedirNumero({ titulo, texto = '', valor = 1, min = 1, max = 99, ok = 'Guardar' }) {
  return new Promise((resolver) => {
    let n = Math.min(Math.max(Number(valor) || min, min), max);

    const { caja, salir } = montar(`
      <h3 class="dialogo-titulo">${titulo}</h3>
      ${texto ? `<p class="dialogo-texto">${texto}</p>` : ''}
      <div class="contador">
        <button class="contador-boton" data-menos>−</button>
        <input class="contador-valor" id="valor" inputmode="numeric" value="${n}">
        <button class="contador-boton" data-mas>＋</button>
      </div>
      <div class="dialogo-botones">
        <button class="secundario" data-no>Cancelar</button>
        <button data-si>${ok}</button>
      </div>`, resolver);

    const campo = caja.querySelector('#valor');
    const pintar = () => { campo.value = n; };

    caja.querySelector('[data-menos]').onclick = () => { n = Math.max(min, n - 1); pintar(); };
    caja.querySelector('[data-mas]').onclick   = () => { n = Math.min(max, n + 1); pintar(); };
    campo.oninput = () => {
      const v = Number(campo.value);
      if (Number.isInteger(v)) n = Math.min(Math.max(v, min), max);
    };

    caja.querySelector('[data-no]').onclick = () => salir(null);
    caja.querySelector('[data-si]').onclick = () => salir(n);
  });
}

/**
 * PIDE UNA CANTIDAD DE HIELO, CON FRACCIONES.
 *
 * En la fábrica el conteo se dicta así: "quedan 14 marquetas y 5/8". Este
 * diálogo deja capturarlo de las dos formas en que la gente lo hace:
 *
 *   · tocando los botones 1, 1/2, 1/4, 1/8, 1/16 (que se van sumando)
 *   · o escribiéndolo tal cual: 14 5/8
 *
 * Devuelve DIECISEISAVOS enteros, o null si se canceló.
 */
export function pedirCantidad({ titulo, texto = '', valor = 0, ok = 'Guardar', ayuda = '' }) {
  return new Promise((resolver) => {
    const { caja, salir } = montar(`
      <h3 class="dialogo-titulo">${titulo}</h3>
      ${texto ? `<p class="dialogo-texto">${texto}</p>` : ''}
      <div id="teclado"></div>
      <label for="escrito" class="etiqueta-chica">o escríbelo tal cual</label>
      <input id="escrito" class="frac-escrito" inputmode="text"
             placeholder="14 y 5/8" autocomplete="off">
      <p class="dialogo-error" id="malo" hidden>
        No se entiende. Escríbelo como <strong>14 5/8</strong>, y en octavos o
        dieciseisavos: la marqueta no se parte en tercios.
      </p>
      ${ayuda ? `<p class="ayuda" style="margin:10px 0 0">${ayuda}</p>` : ''}
      <div class="dialogo-botones">
        <button class="secundario" data-no>Cancelar</button>
        <button data-si>${ok}</button>
      </div>`, resolver);

    const escrito = caja.querySelector('#escrito');
    const malo = caja.querySelector('#malo');

    const teclado = crearTeclado(caja.querySelector('#teclado'), {
      valor,
      alCambiar: (n) => {
        // Si tocan los botones, el campo escrito se pone al día solo.
        if (document.activeElement !== escrito) escrito.value = n ? aTexto(n) : '';
        malo.hidden = true;
      }
    });
    escrito.value = valor ? aTexto(valor) : '';

    escrito.oninput = () => {
      const n = deTexto(escrito.value);
      malo.hidden = escrito.value.trim() === '' || n !== null;
      if (n !== null) teclado.poner(n);
    };

    const enviar = () => {
      // Si escribieron algo a mano y no se entiende, no se guarda nada.
      if (escrito.value.trim() && deTexto(escrito.value) === null) {
        malo.hidden = false;
        escrito.focus();
        return;
      }
      salir(teclado.valor());
    };

    escrito.onkeydown = (ev) => { if (ev.key === 'Enter') enviar(); };
    caja.querySelector('[data-no]').onclick = () => salir(null);
    caja.querySelector('[data-si]').onclick = enviar;
  });
}

/**
 * Pide un texto libre. Para motivos, notas y todo lo que no cabe en una
 * lista de opciones cerrada.
 */
export function pedirTexto({ titulo, texto = '', valor = '', marcador = '', ok = 'Guardar', largo = 200 }) {
  return new Promise((resolver) => {
    const { caja, salir } = montar(`
      <h3 class="dialogo-titulo">${titulo}</h3>
      ${texto ? `<p class="dialogo-texto">${texto}</p>` : ''}
      <textarea id="texto" class="dialogo-texto-campo" rows="3"
                maxlength="${largo}" placeholder="${marcador}">${valor}</textarea>
      <div class="dialogo-botones">
        <button class="secundario" data-no>Cancelar</button>
        <button data-si>${ok}</button>
      </div>`, resolver);

    const campo = caja.querySelector('#texto');
    setTimeout(() => campo.focus(), 220);

    caja.querySelector('[data-no]').onclick = () => salir(null);
    caja.querySelector('[data-si]').onclick = () => {
      const v = campo.value.trim();
      if (!v) { campo.focus(); return; }
      salir(v);
    };
  });
}

/**
 * AUTORIZACIÓN DE UN RESPONSABLE.
 *
 * Se usa cuando alguien quiere hacer algo que se sale de la regla: escribe
 * el motivo, elige quién autoriza y ese responsable teclea SU PIN.
 * El PIN se comprueba en el servidor, nunca aquí.
 */
export function pedirAutorizacion({ titulo, texto = '', responsables, motivoSugerido = '' }) {
  return new Promise((resolver) => {
    const { caja, salir } = montar(`
      <h3 class="dialogo-titulo">${titulo}</h3>
      ${texto ? `<p class="dialogo-texto">${texto}</p>` : ''}

      <label for="motivo">¿Por qué?</label>
      <textarea id="motivo" class="dialogo-texto-campo" rows="2" maxlength="200"
                placeholder="Escribe qué pasó">${motivoSugerido}</textarea>

      <label for="quien">¿Quién autoriza?</label>
      <select id="quien">
        ${responsables.map((r) => `
          <option value="${r.id}">${r.nombre} · ${r.rolEtiqueta}</option>`).join('')}
      </select>

      <label for="pin">Su PIN</label>
      <input id="pin" type="password" inputmode="numeric" maxlength="6"
             autocomplete="off" placeholder="••••">

      <div class="dialogo-botones">
        <button class="secundario" data-no>Cancelar</button>
        <button data-si>Autorizar</button>
      </div>`, resolver);

    const motivo = caja.querySelector('#motivo');
    const pin = caja.querySelector('#pin');
    setTimeout(() => motivo.focus(), 220);

    const enviar = () => {
      const m = motivo.value.trim();
      if (!m) { motivo.focus(); return; }
      if (!/^[0-9]{4,6}$/.test(pin.value)) { pin.focus(); return; }
      salir({ motivo: m, usuarioId: caja.querySelector('#quien').value, pin: pin.value });
    };

    pin.onkeydown = (ev) => { if (ev.key === 'Enter') enviar(); };
    caja.querySelector('[data-no]').onclick = () => salir(null);
    caja.querySelector('[data-si]').onclick = enviar;
  });
}

/**
 * Menú de opciones. Cada opción es { valor, texto, detalle, peligro }.
 * Devuelve el valor elegido, o null si se cerró.
 */
export function menu({ titulo, texto = '', opciones }) {
  return new Promise((resolver) => {
    const { caja, salir } = montar(`
      <h3 class="dialogo-titulo">${titulo}</h3>
      ${texto ? `<p class="dialogo-texto">${texto}</p>` : ''}
      <div class="dialogo-opciones">
        ${opciones.map((o) => `
          <button class="dialogo-opcion ${o.peligro ? 'peligrosa' : ''}" data-valor="${o.valor}">
            <strong>${o.texto}</strong>
            ${o.detalle ? `<small>${o.detalle}</small>` : ''}
          </button>`).join('')}
      </div>
      <div class="dialogo-botones">
        <button class="secundario" data-no>Cancelar</button>
      </div>`, resolver);

    caja.querySelectorAll('[data-valor]').forEach((b) => {
      b.onclick = () => salir(b.dataset.valor);
    });
    caja.querySelector('[data-no]').onclick = () => salir(null);
  });
}
