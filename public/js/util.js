/** Utilidades cortas que usan todas las pantallas. */

/** Escapa texto antes de meterlo en HTML (evita romper la pagina o inyectar codigo). */
export function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

import { tono } from './sonido.js';

/** Mensaje flotante abajo de la pantalla. */
let temporizador;
/**
 * El cartelito de abajo, con su ruidito.
 *
 * El sonido va aquí y no en cada pantalla a propósito: todo lo que sale
 * bien o mal en este programa pasa por este aviso, así que enchufándolo una
 * vez suena en todos lados y no hay forma de que a una pantalla nueva se le
 * olvide. Se apaga desde Personalizar.
 */
export function avisar(mensaje, tipo = '') {
  const caja = document.getElementById('aviso');
  caja.textContent = mensaje;
  caja.className = tipo;
  caja.hidden = false;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => { caja.hidden = true; }, 3200);

  tono(tipo === 'error' ? 'error' : tipo === 'bien' ? 'bien' : 'aviso');
}

export function fecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

/** Solo la hora: "02:23 p.m." */
export function soloHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Un rato: "23 ago 2026, de 02:23 a 08:10 p.m."
 * Si el turno cruzó la medianoche se escriben las dos fechas completas.
 */
export function rango(desde, hasta) {
  if (!desde || !hasta) return '—';
  const a = new Date(desde);
  const b = new Date(hasta);
  const mismoDia = a.toDateString() === b.toDateString();
  return mismoDia
    ? `${soloFecha(desde)}, de ${soloHora(desde)} a ${soloHora(hasta)}`
    : `de ${fecha(desde)} a ${fecha(hasta)}`;
}

export function soloFecha(iso) {
  if (!iso) return '—';
  return new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

export const ETIQUETAS_ROL = {
  operario: 'Operario',
  cajero: 'Cajero',
  repartidor: 'Repartidor',
  gerente: 'Gerente de turno',
  admin: 'Administrador'
};
