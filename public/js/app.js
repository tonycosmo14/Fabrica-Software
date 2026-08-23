/**
 * APP — arranque de la interfaz y navegacion.
 *
 * No usa ninguna libreria. La navegacion es por "hash" (#/inicio, #/usuarios...),
 * asi funciona igual abierta desde la PC o desde el celular.
 */
import { api } from './api.js';
import { avisar, esc, ETIQUETAS_ROL } from './util.js';
import { iniciarTema } from './tema.js';
import { cargarMarca, marcaBarraHTML } from './marca.js';
import { vistaBienvenida } from './vistas/bienvenida.js';
import { vistaEntrar } from './vistas/entrar.js';
import { vistaInicio } from './vistas/inicio.js';
import { vistaExistencia } from './vistas/existencia.js';
import { vistaVenta } from './vistas/venta.js';
import { vistaCaja } from './vistas/caja.js';
import { vistaProduccion } from './vistas/produccion.js';
import { vistaTanques } from './vistas/tanques.js';
import { vistaUsuarios } from './vistas/usuarios.js';
import { vistaNovedades, hayVersionNueva } from './vistas/novedades.js';
import { vistaAyuda } from './vistas/ayuda.js';
import { vistaPersonalizar } from './vistas/personalizar.js';
import { vistaProductos } from './vistas/productos.js';
import { vistaSistema } from './vistas/sistema.js';

const pantalla = document.getElementById('pantalla');
const barra = document.getElementById('barra');
const menu = document.getElementById('menu');

const estado = { usuario: null, permisos: [], configurado: true };

const RUTAS = {
  '#/inicio':    { titulo: 'Inicio',            vista: vistaInicio },
  '#/tanques':   { titulo: 'Producción',        vista: vistaProduccion, permiso: 'produccion.ver' },
  '#/venta':     { titulo: 'Punto de venta',    vista: vistaVenta,     permiso: 'venta.registrar', fija: true },
  '#/caja':      { titulo: 'Caja',              vista: vistaCaja,      permiso: 'caja.ver' },
  '#/existencia': { titulo: 'Existencia',       vista: vistaExistencia, permiso: 'existencia.ver' },
  '#/config-tanques': { titulo: 'Configurar tanques', vista: vistaTanques, permiso: 'tanques.configurar' },
  '#/usuarios':  { titulo: 'Usuarios',          vista: vistaUsuarios,  permiso: 'usuarios.administrar' },
  // El cajero entra con vista limitada: ve cuántas hay e imprime la hoja.
  '#/productos': { titulo: 'Productos y precios', vista: vistaProductos, permiso: 'inventario.ver', fija: true },
  '#/personalizar': { titulo: 'Personalizar',   vista: vistaPersonalizar, permiso: 'sistema.configurar' },
  '#/sistema':   { titulo: 'Sistema',           vista: vistaSistema,   permiso: 'sistema.ver' },
  '#/ayuda':     { titulo: 'Ayuda',              vista: vistaAyuda },
  '#/novedades': { titulo: 'Qué hay de nuevo',  vista: vistaNovedades }
};

function puede(permiso) {
  return !permiso || estado.permisos.includes('*') || estado.permisos.includes(permiso);
}

/**
 * A dónde cae cada quien al entrar.
 *
 * El cajero pasa el 90% del día cobrando, así que su pantalla de inicio es
 * la caja, no un menú de iconos. A quien no cobra se le abre el inicio de
 * siempre.
 */
function pantallaDeArranque() {
  return puede('venta.registrar') ? '#/venta' : '#/inicio';
}

function entrar(datos) {
  Object.assign(estado, datos);
  estado.configurado = true;
  location.hash = pantallaDeArranque();
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

  // El nombre de la pantalla ya sale como título dentro de cada vista,
  // así que en la barra solo se usa para la pestaña del navegador.
  document.title = `${ruta.titulo} · Hielo LOLHA`;
  pintarBarra();
  document.getElementById('btn-atras').hidden =
    location.hash === pantallaDeArranque() || location.hash === '#/inicio' || !location.hash;
  // Avisar a la vista que se va, para que suelte lo que haya enganchado
  // (el punto de venta escucha el teclado de toda la página).
  pantalla.dispatchEvent(new CustomEvent('vista-desmontada'));

  // Las pantallas "fijas" ocupan el alto exacto y no se desplazan.
  document.body.classList.toggle('pantalla-fija', Boolean(ruta.fija));

  pantalla.innerHTML = '<div class="cargando">Cargando…</div>';

  try {
    await ruta.vista(pantalla, estado, {
      // Al terminar un turno se sale del sistema, para que el cajero que
      // entra tenga que poner su PIN. Ese PIN es lo que abre su turno.
      alSalir: () => cerrarSesion({ aviso: 'Turno cerrado. Pasa el siguiente cajero.' })
    });
  } catch (e) {
    if (e.codigo === 401) { estado.usuario = null; return dibujar(); }
    pantalla.innerHTML = `<p class="vacio">${esc(e.message)}</p>`;
  }

  actualizarPuntoNovedades();
}

/**
 * Pinta el encabezado: logo en medio y quién está dentro a la derecha.
 * El logo puede cambiar (Personalizar) y el tema también, así que se
 * vuelve a pintar en cada pantalla.
 */
function pintarBarra() {
  document.getElementById('barra-marca').innerHTML = marcaBarraHTML();
  // En el celular no cabe el nombre completo: se deja el de pila.
  const nombre = estado.usuario?.nombre || '';
  document.getElementById('barra-nombre').textContent =
    window.innerWidth < 460 ? nombre.split(' ')[0] : nombre;
  document.getElementById('barra-rol').textContent = ETIQUETAS_ROL[estado.usuario?.rol] || '';
}

/**
 * Reloj del encabezado. Solo para verlo: en la fábrica no siempre hay
 * un reloj a la vista y la hora importa (turnos, congelación, cortes).
 */
function iniciarReloj() {
  const cajaFecha = document.getElementById('reloj-fecha');
  const cajaHora = document.getElementById('reloj-hora');
  let ultimo = '';

  const pintar = () => {
    const ahora = new Date();
    const hora = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    if (hora === ultimo) return;
    ultimo = hora;

    // La fecha se esconde sola en pantallas angostas (lo hace el CSS);
    // aquí solo se escriben las dos partes.
    cajaFecha.textContent = ahora.toLocaleDateString('es-MX',
      { weekday: 'short', day: 'numeric', month: 'short' });
    cajaHora.textContent = hora;
  };

  pintar();
  setInterval(pintar, 10000);
}

function abrirMenu(abierto) {
  const boton = document.getElementById('btn-menu');
  boton.classList.toggle('abierto', abierto);

  if (!abierto) {
    // Se quita la clase primero para que la animación de salida se vea,
    // y solo después se esconde de verdad.
    menu.classList.remove('abierto');
    setTimeout(() => { menu.hidden = true; }, 200);
    return;
  }

  menu.hidden = false;
  requestAnimationFrame(() => menu.classList.add('abierto'));
  document.getElementById('menu-nombre').textContent = estado.usuario?.nombre || '—';
  document.getElementById('menu-rol').textContent = ETIQUETAS_ROL[estado.usuario?.rol] || '';
  menu.querySelectorAll('[data-permiso]').forEach((a) => { a.hidden = !puede(a.dataset.permiso); });
}

async function actualizarPuntoNovedades() {
  const punto = document.getElementById('punto-novedades');
  punto.hidden = !(await hayVersionNueva());
}

async function iniciar() {
  await cargarMarca();

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
iniciarReloj();

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

/** Cerrar sesión y volver a la pantalla del PIN. */
async function cerrarSesion({ aviso = 'Sesión cerrada' } = {}) {
  try { await api.enviar('/auth/salir', {}); } catch { /* ya no habia sesion */ }
  estado.usuario = null;
  estado.permisos = [];
  abrirMenu(false);
  if (aviso) avisar(aviso);
  dibujar();
}

document.getElementById('btn-salir').onclick = () => cerrarSesion();

window.addEventListener('hashchange', dibujar);

iniciar();
