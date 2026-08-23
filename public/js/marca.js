/**
 * LOGOTIPO DE HIELO LOLHA
 *
 * El logo se sube desde la pantalla Personalizar y se guarda en la carpeta
 * "datos", así que sobrevive a las actualizaciones del sistema.
 *
 * Si no hay logo puesto, se dibuja el nombre con letras como respaldo.
 */
import { api } from './api.js';

let cache = null;

/** Lee una sola vez qué logo hay puesto. */
export async function cargarMarca({ recargar = false } = {}) {
  if (!cache || recargar) {
    try { cache = await api.obtener('/personalizacion'); }
    catch { cache = { nombreNegocio: 'Hielo LOLHA', logoClaro: null, logoOscuro: null, version: '0' }; }
  }
  return cache;
}

/** ¿El dispositivo está mostrando el modo oscuro ahora mismo? */
function enOscuro() {
  const elegido = document.documentElement.getAttribute('data-tema');
  if (elegido) return elegido === 'oscuro';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Devuelve el HTML del logotipo.
 * Hay que llamar antes a cargarMarca(); si no, sale el respaldo en letras.
 */
export function marcaHTML() {
  const m = cache;
  if (!m) return respaldo();

  const oscuro = enOscuro();
  // Si hay logo para modo oscuro y estamos en oscuro, ese; si no, el normal.
  const usarOscuro = oscuro && m.logoOscuro;
  const hayLogo = usarOscuro || m.logoClaro;
  if (!hayLogo) return respaldo();

  const url = `${usarOscuro ? '/marca/logo-oscuro' : '/marca/logo'}?v=${encodeURIComponent(m.version)}`;
  // Sin logo específico para oscuro, el normal se monta sobre placa blanca
  // para que un logo de letras negras no desaparezca.
  const placa = oscuro && !m.logoOscuro ? ' con-placa' : '';

  return `<div class="marca">
      <img class="marca-logo${placa}" src="${url}" alt="${escapar(m.nombreNegocio)}">
    </div>`;
}

/** Versión pequeña para el encabezado: el logo, o el nombre en letras. */
export function marcaBarraHTML() {
  const m = cache;
  const oscuro = enOscuro();
  const usarOscuro = oscuro && m?.logoOscuro;
  const hayLogo = usarOscuro || m?.logoClaro;

  if (!hayLogo) {
    return '<span class="barra-marca-texto">Hielo <b>LOLHA</b></span>';
  }
  const url = `${usarOscuro ? '/marca/logo-oscuro' : '/marca/logo'}?v=${encodeURIComponent(m.version)}`;
  return `<img src="${url}" alt="${escapar(m.nombreNegocio)}">`;
}

function respaldo() {
  return `<div class="marca sin-logo">
      <span class="marca-hielo">Hielo</span>
      <span class="marca-lolha">LOLHA</span>
    </div>`;
}

function escapar(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
