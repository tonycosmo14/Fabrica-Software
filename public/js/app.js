/**
 * APP — arranque de la interfaz y navegacion.
 *
 * No usa ninguna libreria. La navegacion es por "hash" (#/inicio, #/usuarios...),
 * asi funciona igual abierta desde la PC o desde el celular.
 */
import { api } from './api.js';
import { avisar, esc, ETIQUETAS_ROL } from './util.js';
import { iniciarTema } from './tema.js';
import { vistaBienvenida } from './vistas/bienvenida.js';
import { vistaEntrar } from './vistas/entrar.js';
import { vistaInicio } from './vistas/inicio.js';
import { vistaTanques } from './vistas/tanques.js';
import { vistaUsuarios } from './vistas/usuarios.js';
import { vistaNovedades, hayVersionNueva } from './vistas/novedades.js';
import { vistaSistema } from './vistas/sistema.js';

const pantalla = document.getElementById('pantalla');
const barra = document.getElementById('barra');
const menu = document.getElementById('menu');

const estado = { usuario: null, permisos: [], configurado: true };

const RUTAS = {
  '#/inicio':    { titulo: 'Inicio',            vista: vistaInicio },
  '#/tanques':   { titulo: 'Tanques',           vista: vistaTanques,   permiso: 'produccion.ver' },
  '#/usuarios':  { titulo: 'Usuarios',          vista: vistaUsuarios,  permiso: 'usuarios.administrar' },
  '#/sistema':   { titulo: 'Sistema',           vista: vistaSistema,   permiso: 'sistema.ver' },
  '#/novedades': { titulo: 'Qué hay de nuevo',  vista: vistaNovedades }
};

function puede(permiso) {
  return !permiso || estado.permisos.includes('*') || estado.permisos.includes(permiso);
}

function entrar(datos) {
  Object.assign(estado, datos);
  estado.configurado = true;
  location.hash = '#/inicio';
  iniciar();
}

async function dibujar() {
  // Sistema recien instalado: primero se crea la cuenta del administrador.
  if (!estado.configurado) {
    barra.hidden = true;
    return vistaBienvenida(pantalla, { alEntrar: entrar });
  }

  // Sin sesion: pantalla de entrada.
  if (!estado.usuario) {
    barra.hidden = true;
    return vistaEntrar(pantalla, { alEntrar: entrar });
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
  document.getElementById('menu-rol').textContent = ETIQUETAS_ROL[estado.usuario?.rol] || '';
  menu.querySelectorAll('[data-permiso]').forEach((a) => { a.hidden = !puede(a.dataset.permiso); });
}

async function actualizarPuntoNovedades() {
  const punto = document.getElementById('punto-novedades');
  punto.hidden = !(await hayVersionNueva());
}

async function iniciar() {
  try {
    const inicial = await api.obtener('/auth/estado-inicial');
    estado.configurado = inicial.configurado;
  } catch { estado.configurado = true; }

  if (estado.configurado) {
    try {
      const datos = await api.obtener('/auth/yo');
      Object.assign(estado, datos);
    } catch { /* sin sesion */ }
  }

  const { version } = await api.obtener('/sistema/salud');
  document.querySelectorAll('.version').forEach((e) => { e.textContent = 'v' + version; });

  await dibujar();
}

iniciarTema();

// --- Eventos de la barra y el menu ---
document.getElementById('btn-menu').onclick = () => abrirMenu(true);
menu.querySelector('.menu-fondo').onclick = () => abrirMenu(false);
menu.querySelectorAll('a').forEach((a) => {
  a.onclick = () => {
    abrirMenu(false);
    // Si ya estamos en esa ruta el navegador no avisa del cambio, asi que
    // se vuelve a dibujar a mano. Si no, tocar "Tanques" estando dentro de
    // un tanque no haria nada.
    if (location.hash === a.getAttribute('href')) dibujar();
  };
});
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
