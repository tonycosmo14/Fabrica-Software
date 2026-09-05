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
import { vistaRaya } from './vistas/raya.js';
import { vistaCorreo } from './vistas/correo.js';
import { vistaNeveras } from './vistas/neveras.js';
import { vistaAgua } from './vistas/agua.js';
import { vistaPedidos } from './vistas/pedidos.js';
import { vistaReparto } from './vistas/reparto.js';
import { vistaNovedades, hayVersionNueva } from './vistas/novedades.js';
import { vistaAyuda } from './vistas/ayuda.js';
import { vistaPersonalizar } from './vistas/personalizar.js';
import { vistaEmpresa } from './vistas/empresa.js';
import { vistaArranque } from './vistas/arranque.js';
import { vistaEstadisticas } from './vistas/estadisticas.js';
import { vistaProductos } from './vistas/productos.js';
import { vistaClientes } from './vistas/clientes.js';
import { vistaHistorial } from './vistas/historial.js';
import { vistaSistema } from './vistas/sistema.js';

const pantalla = document.getElementById('pantalla');
const barra = document.getElementById('barra');
const menu = document.getElementById('menu');

const estado = { usuario: null, permisos: [], configurado: true };

const RUTAS = {
  '#/inicio':    { titulo: 'Inicio',            vista: vistaInicio },
  // PRODUCCIÓN NO SE DESPLAZA  (v7.2). Como el punto de venta: los tanques
  // arriba y el paño que toca siempre a la vista. "Los tanques muy largos
  // que tienen muchos paños, hasta dieciocho, al desplazar de repente me
  // perdía y no sabía en qué tanque estaba." Lo único que rueda es la lista
  // de paños, dentro de su propia caja.
  '#/tanques':   { titulo: 'Producción de hielo', vista: vistaProduccion, permiso: 'produccion.ver',
                   fija: true },
  // El punto de venta se queda con TODA la pantalla: arma su propio
  // encabezado adentro para no pagar dos veces por la misma franja.
  '#/venta':     { titulo: 'Punto de venta',    vista: vistaVenta,     permiso: 'venta.registrar',
                   fija: true, sinBarra: true },
  '#/caja':      { titulo: 'Caja',              vista: vistaCaja,      permiso: 'caja.ver' },
  // El cuarto frío ya no está en el inicio ni en el menú: contarlo se hace
  // al terminar el turno (v4.1). La ruta sigue viva porque se entra desde
  // Producción de hielo, para mirar lo que hay y anotar lo derretido.
  '#/existencia': { titulo: 'El cuarto frío',   vista: vistaExistencia, permiso: 'existencia.ver' },
  '#/config-tanques': { titulo: 'Configurar tanques', vista: vistaTanques, permiso: 'tanques.configurar' },
  '#/usuarios':  { titulo: 'Usuarios',          vista: vistaUsuarios,  permiso: 'usuarios.administrar' },
  // SUELDOS (v4.8, renombrado en la v5.2.1): cuánto gana cada quien, qué
  // días viene y qué se le debe. Solo el administrador — los sueldos no
  // son dato de operación. El permiso y las tablas siguen diciendo `raya`
  // a propósito: renombrarlos sería mover media base de datos para que la
  // pantalla se llame distinto.
  '#/raya':      { titulo: 'Sueldos',           vista: vistaRaya,      permiso: 'raya.ver' },
  '#/correo':    { titulo: 'Avisos por correo',  vista: vistaCorreo,    permiso: 'correo.configurar' },
  '#/neveras':   { titulo: 'Las neveras',        vista: vistaNeveras,   permiso: 'neveras.ver' },
  // LA PLANTA DE AGUA (v5.2): el operario la ve y anota la vuelta;
  // cambiar equipos y mover los límites es del administrador.
  '#/agua':      { titulo: 'La planta de agua',  vista: vistaAgua,      permiso: 'agua.ver' },
  // LOS PEDIDOS (v5.6): lo que hay que preparar y lo que hay que entregar.
  // Se TOMAN en Vender —ahí están los precios y el teclado de fracciones—
  // y aquí se preparan, se imprimen y se marcan entregados.
  '#/pedidos':   { titulo: 'Los pedidos',        vista: vistaPedidos,   permiso: 'pedidos.ver' },
  // EL REPARTO (v5.7): lo que sale, lo que anda en la calle y lo que hay
  // que cuadrar. El DINERO se recibe en Vender, que es donde está quien lo
  // cuenta.
  '#/reparto':   { titulo: 'El reparto',         vista: vistaReparto,   permiso: 'reparto.ver' },
  // El cajero entra con vista limitada: ve cuántas hay e imprime la hoja.
  // Sin `fija`: la pantalla lleva los cuatro números del catálogo debajo
  // del tablero (v7.1) y con alto fijo se quedaban fuera de la vista.
  '#/productos': { titulo: 'Productos y precios', vista: vistaProductos, permiso: 'inventario.ver' },
  // Clientes YA NO es de alto fijo (v6.9): la cartera es una página que se
  // desplaza —cuatro números, las pestañas, la tabla y la ficha— y con el
  // alto clavado la mitad quedaba fuera sin forma de llegar a ella.
  '#/clientes':  { titulo: 'Clientes',           vista: vistaClientes,  permiso: 'clientes.ver' },
  '#/historial': { titulo: 'Historial',          vista: vistaHistorial, permiso: 'historial.ver' },
  // Es una página larga que se rueda con la rueda del ratón, como el
  // historial: NO lleva 'fija', porque esa deja la pantalla sin rodar y los
  // últimos renglones de la tabla no se podrían alcanzar.
  '#/empresa':   { titulo: 'Cuentas de la empresa', vista: vistaEmpresa, permiso: 'empresa.ver' },
  '#/estadisticas': { titulo: 'Los números',     vista: vistaEstadisticas, permiso: 'estadisticas.ver' },
  '#/personalizar': { titulo: 'Personalizar',   vista: vistaPersonalizar, permiso: 'sistema.configurar' },
  '#/sistema':   { titulo: 'Sistema',           vista: vistaSistema,   permiso: 'sistema.ver' },
  // La puesta en marcha: el permiso no lo lista ningún rol, así que solo lo
  // alcanza el comodín del administrador.
  '#/arranque':  { titulo: 'Puesta en marcha',  vista: vistaArranque,  permiso: 'sistema.puesta_en_marcha' },
  '#/ayuda':     { titulo: 'Ayuda',              vista: vistaAyuda },
  '#/novedades': { titulo: 'Qué hay de nuevo',  vista: vistaNovedades }
};

/**
 * ESC ES «VOLVER» EN TODAS LAS PANTALLAS  (v5.7.1)
 *
 * "El botón de Esc no en todo me regresa atrás o me cierra ventanas."
 *
 * Los diálogos ya lo cerraban, y la caja tiene su propio Esc. Lo que no lo
 * tenía eran las fichas —la de un tanque, una salida, un cliente— que
 * tienen su botón de «‹ Volver» pero no escuchaban la tecla. Aquí se
 * escucha una sola vez por todos: si no hay un diálogo abierto y la
 * pantalla tiene un botón de volver a la vista, Esc lo aprieta.
 */
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  // Un diálogo abierto se cierra solo; la caja tiene su propia tecla.
  if (document.querySelector('.dialogo')) return;
  if (location.hash === '#/venta') return;
  const volver = pantalla.querySelector('#volver');
  if (volver && !volver.disabled && volver.offsetParent !== null) {
    ev.preventDefault();
    volver.click();
  }
});

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

  // EL HASH PUEDE TRAER PARÁMETROS  (v6.9.1)
  //
  // "#/neveras?nevera=abc" es la pantalla de neveras con una abierta. Sin
  // partirlo, `RUTAS[location.hash]` no encuentra nada y se cae al inicio
  // —que es lo que pasaba con el botón de levantar un pedido desde la
  // ficha de un cliente—. La vista los recibe en `opciones.parametros` y
  // los usa si sabe qué hacer con ellos.
  const [camino, consulta = ''] = location.hash.split('?');
  const parametros = new URLSearchParams(consulta);
  const ruta = RUTAS[camino] || RUTAS['#/inicio'];
  // En el punto de venta la franja de arriba la pinta la vista, con el
  // reloj y el menú metidos entre sus propios botones: son 100 px de alto
  // que se ganan justo donde más falta hacen.
  barra.hidden = Boolean(ruta.sinBarra);

  if (!puede(ruta.permiso)) {
    pantalla.innerHTML = '<p class="vacio">Tu rol no tiene acceso a esta pantalla.</p>';
    return;
  }

  // El nombre de la pantalla ya sale como título dentro de cada vista,
  // así que en la barra solo se usa para la pestaña del navegador.
  document.title = `${ruta.titulo} · Hielo LOLHA`;
  pintarBarra();
  medirBarra();
  document.getElementById('btn-atras').hidden =
    camino === pantallaDeArranque() || camino === '#/inicio' || !camino;
  // Avisar a la vista que se va, para que suelte lo que haya enganchado
  // (el punto de venta escucha el teclado de toda la página).
  pantalla.dispatchEvent(new CustomEvent('vista-desmontada'));

  // Las pantallas "fijas" ocupan el alto exacto y no se desplazan.
  document.body.classList.toggle('pantalla-fija', Boolean(ruta.fija));

  pantalla.innerHTML = '<div class="cargando">Cargando…</div>';

  try {
    await ruta.vista(pantalla, estado, {
      parametros,
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
/**
 * CUÁNTO MIDE LA BARRA DE ARRIBA  (v6.5.1)
 *
 * La barra es pegajosa —se queda arriba al desplazar— y hay pantallas que
 * necesitan pegar algo justo DEBAJO de ella: en Producción, el nombre del
 * tanque y sus pestañas, para que con dieciocho paños no se pierda uno al
 * bajar. Su alto cambia con el logo y con el ancho de la pantalla, así que
 * se mide y se deja escrito; adivinarlo en el CSS es lo que hace que un
 * día la pestaña quede tapada.
 */
function medirBarra() {
  const barra = document.getElementById('barra');
  const alto = barra && !barra.hidden ? barra.offsetHeight : 0;
  document.documentElement.style.setProperty('--alto-barra', `${alto}px`);
}
window.addEventListener('resize', medirBarra);

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

/**
 * ESC CIERRA EL MENÚ.
 *
 * Todo lo demás que se abre encima en este programa se cierra con Esc —los
 * diálogos, el cobro, la lista de tickets—, así que la mano ya va sola a
 * esa tecla. Que el menú fuera lo único que no obedecía era una trampa.
 *
 * Va en captura y detiene el evento: si no, el Esc que cierra el menú
 * también le llega a la pantalla de abajo y vacía el ticket que había a
 * medias detrás.
 */
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape' || menu.hidden) return;
  ev.preventDefault();
  ev.stopPropagation();
  abrirMenu(false);
}, true);
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

/**
 * F1 = A VENDER, desde donde sea.
 *
 * El cajero acaba de mirar la existencia, o el corte, o los precios, y
 * llega un cliente. Sin esto tiene que buscar el menú, abrirlo y encontrar
 * el renglón; con esto es una tecla, y siempre la misma.
 *
 * Se escucha aquí arriba, en toda la aplicación, para que funcione
 * también en las pantallas que no saben nada del teclado.
 */
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'F1') return;
  // Con un diálogo abierto manda el diálogo: F1 encima de una pregunta a
  // medias dejaría el registro a la mitad.
  if (document.querySelector('.dialogo')) return;
  ev.preventDefault();
  if (!estado.usuario || !puede('venta.registrar')) return;
  abrirMenu(false);
  if (location.hash === '#/venta') return;
  location.hash = '#/venta';
});

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
