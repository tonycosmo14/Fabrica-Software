/** Utilidades cortas que usan todas las pantallas. */

/** Escapa texto antes de meterlo en HTML (evita romper la pagina o inyectar codigo). */
export function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Mensaje flotante abajo de la pantalla. */
let temporizador;
export function avisar(mensaje, tipo = '') {
  const caja = document.getElementById('aviso');
  caja.textContent = mensaje;
  caja.className = tipo;
  caja.hidden = false;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => { caja.hidden = true; }, 3200);
}

export function fecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
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
  admin: 'Administrador'
};
