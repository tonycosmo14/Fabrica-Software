/**
 * "Qué hay de nuevo": historial de versiones.
 * Lee /api/versiones, que a su vez lee src/version.js.
 */
import { api } from '../api.js';
import { esc, soloFecha } from '../util.js';

const NOMBRES_TIPO = {
  nuevo: 'nuevo', mejora: 'mejora', arreglo: 'arreglo', importante: 'clave'
};

export async function vistaNovedades(pantalla) {
  const { versionActual, versiones } = await api.obtener('/versiones');

  // Al visitar esta pantalla se marca como leida la version actual.
  localStorage.setItem('ultima_version_vista', versionActual);

  pantalla.innerHTML = `
    <h2>Qué hay de nuevo</h2>
    <p class="ayuda">
      Cada versión es un pedazo del sistema terminado y probado.
      Aquí queda el registro de todo lo que se ha ido agregando.
    </p>
    ${versiones.map((v) => `
      <div class="version-bloque">
        <div class="version-cabeza">
          <span class="version-num">v${esc(v.numero)}</span>
          <h3>${esc(v.nombre)}</h3>
          <time>${esc(soloFecha(v.fecha))}</time>
        </div>
        ${v.resumen ? `<p class="ayuda" style="margin:10px 0 0">${esc(v.resumen)}</p>` : ''}
        <ul class="cambios">
          ${v.cambios.map((c) => `
            <li>
              <span class="tipo ${esc(c.tipo)}">${esc(NOMBRES_TIPO[c.tipo] || c.tipo)}</span>
              <span>${esc(c.texto)}</span>
            </li>`).join('')}
        </ul>
        ${v.siguiente ? `<div class="siguiente">▶ Lo que sigue: ${esc(v.siguiente)}</div>` : ''}
      </div>`).join('')}`;
}

/** Devuelve true si hay una version que el usuario no ha visto en este dispositivo. */
export async function hayVersionNueva() {
  try {
    const { versionActual } = await api.obtener('/versiones');
    return localStorage.getItem('ultima_version_vista') !== versionActual;
  } catch { return false; }
}
