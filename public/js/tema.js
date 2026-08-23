/**
 * Modo claro / oscuro.
 *
 * Tres opciones:
 *   claro  -> siempre claro
 *   oscuro -> siempre oscuro
 *   auto   -> lo que tenga configurado el celular o la PC (por defecto)
 *
 * La eleccion se guarda en el dispositivo, asi que cada quien pone el suyo:
 * la tablet de la caja puede ir en claro y el celular del velador en oscuro.
 */
const CLAVE = 'tema';

export function temaGuardado() {
  return localStorage.getItem(CLAVE) || 'auto';
}

export function aplicarTema(tema) {
  if (tema === 'auto') {
    document.documentElement.removeAttribute('data-tema');
  } else {
    document.documentElement.setAttribute('data-tema', tema);
  }
  localStorage.setItem(CLAVE, tema);
  marcarBotones(tema);
}

function marcarBotones(tema) {
  document.querySelectorAll('#tema-opciones button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.tema === tema));
  });
}

/** Se llama una vez al abrir la aplicación. */
export function iniciarTema() {
  aplicarTema(temaGuardado());
  document.querySelectorAll('#tema-opciones button').forEach((b) => {
    b.onclick = () => aplicarTema(b.dataset.tema);
  });
}
