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
