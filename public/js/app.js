/**
 * APP — arranque de la interfaz y navegacion.
 *
 * No usa ninguna libreria. La navegacion es por "hash" (#/inicio, #/usuarios...),
 * asi funciona igual abierta desde la PC o desde el celular.
 */
import { api } from './api.js';
import { avisar, esc } from './util.js';
import { vistaEntrar } from './vistas/entrar.js';
import { vistaInicio } from './vistas/inicio.js';
import { vistaUsuarios } from './vistas/usuarios.js';
import { vistaNovedades, hayVersionNueva } from './vistas/novedades.js';
import { vistaSistema } from './vistas/sistema.js';

const pantalla = document.getElementById('pantalla');
const barra = document.getElementById('barra');
const menu = document.getElementById('menu');

const estado = { usuario: null, permisos: [] };

const RUTAS = {
  '#/inicio':    { titulo: 'Inicio',            vista: vistaInicio },
  '#/usuarios':  { titulo: 'Usuarios',          vista: vistaUsuarios,  permiso: 'usuarios.administrar' },
  '#/sistema':   { titulo: 'Sistema',           vista: vistaSistema,   permiso: 'sistema.ver' },
  '#/novedades': { titulo: 'Qué hay de nuevo',  vista: vistaNovedades }
};

function puede(permiso) {
  return !permiso || estado.permisos.includes('*') || estado.permisos.includes(permiso);
}

async function dibujar() {
  // Sin sesion: siempre la pantalla de entrada.
  if (!estado.usuario) {
    barra.hidden = true;
    return vistaEntrar(pantalla, {
      alEntrar: (datos) => {
        Object.assign(estado, datos);
        location.hash = '#/inicio';
        iniciar();
      }
    });
  }

  barra.hidden = false;
  const ruta = RUTAS[location.hash] || RUTAS['#/inicio'];

  if (!puede(ruta.permiso)) {
    pantalla.innerHTML = '<p class="vacio">Tu rol no tiene acceso a esta pantalla.</p>';
    return;
  }

  document.getElementById('titulo').textContent = ruta.titulo;
  document.getElementById('btn-atras').hidden = location.hash === '#/inicio' || !location.hash;
  pantalla.innerHTML = '<div class="cargando">Cargando…</div>';

  try {
    await ruta.vista(pantalla, estado);
  } catch (e) {
    if (e.codigo === 401) { estado.usuario = null; return dibujar(); }
    pantalla.innerHTML = `<p class="vacio">${esc(e.message)}</p>`;
  }

  actualizarPuntoNovedades();
}

function abrirMenu(abierto) {
  menu.hidden = !abierto;
  if (!abierto) return;
  document.getElementById('menu-nombre').textContent = estado.usuario?.nombre || '—';
  document.getElementById('menu-rol').textContent = estado.usuario?.rol || '';
  menu.querySelectorAll('[data-permiso]').forEach((a) => { a.hidden = !puede(a.dataset.permiso); });
}

async function actualizarPuntoNovedades() {
  const punto = document.getElementById('punto-novedades');
  punto.hidden = !(await hayVersionNueva());
}

async function iniciar() {
  try {
    const datos = await api.obtener('/auth/yo');
    Object.assign(estado, datos);
  } catch { /* sin sesion */ }

  const { version } = await api.obtener('/sistema/salud');
  document.querySelectorAll('.version').forEach((e) => { e.textContent = 'v' + version; });

  await dibujar();
}

// --- Eventos de la barra y el menu ---
document.getElementById('btn-menu').onclick = () => abrirMenu(true);
menu.querySelector('.menu-fondo').onclick = () => abrirMenu(false);
menu.querySelectorAll('a').forEach((a) => { a.onclick = () => abrirMenu(false); });
document.getElementById('btn-atras').onclick = () => { location.hash = '#/inicio'; };

document.getElementById('btn-salir').onclick = async () => {
  try { await api.enviar('/auth/salir', {}); } catch { /* ya no habia sesion */ }
  estado.usuario = null;
  estado.permisos = [];
  abrirMenu(false);
  avisar('Sesión cerrada');
  dibujar();
};

window.addEventListener('hashchange', dibujar);

iniciar();
