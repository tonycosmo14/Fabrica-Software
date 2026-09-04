/**
 * Pantalla de inicio: los accesos grandes.
 * Los modulos que todavia no existen aparecen en gris con su version prevista,
 * asi se ve el avance del proyecto.
 */
import { esc } from '../util.js';

const ACCESOS = [
  // CONFIGURAR TANQUES NO ESTÁ AQUÍ, y es a propósito. Los tanques se dan
  // de alta una vez y no se vuelven a tocar: en más de treinta años no ha
  // habido un tanque nuevo. Un acceso permanente en el inicio para algo
  // que se usa una vez en la vida ocupa el sitio de lo que sí se usa todos
  // los días. Vive donde hace falta: en la tuerca de Producción de hielo.
  // Y la EXISTENCIA salió del inicio en la v4.1 por la misma razón, pero
  // más fuerte: contar el cuarto frío y hacer el corte de caja eran la
  // misma cosa hecha dos veces. Ahora se cuenta al terminar el turno, y lo
  // que queda del cuarto frío —lo derretido, los conteos viejos— vive
  // dentro de Producción de hielo, que es donde está el hielo.
  { emoji: '🏭', titulo: 'Producción de hielo', ruta: '#/tanques', permiso: 'produccion.ver', desde: null },
  { emoji: '🛒', titulo: 'Vender',       ruta: '#/venta',     permiso: 'venta.registrar',      desde: null   },
  { emoji: '💵', titulo: 'Caja',         ruta: '#/caja',      permiso: 'caja.ver',             desde: null   },
  { emoji: '👥', titulo: 'Usuarios',     ruta: '#/usuarios',  permiso: 'usuarios.administrar', desde: null   },
  // SUELDOS, no "La raya"  (v5.2.1). Era el mismo billete que Caja, y dos
  // apartados con el mismo icono se confunden desde el otro lado del
  // mostrador. Y "raya" es como se le dice aquí a la lista de la semana,
  // pero quien entra por primera vez no sabe qué va a encontrar.
  { emoji: '💰', titulo: 'Sueldos',      ruta: '#/raya',      permiso: 'raya.ver',             desde: null   },
  { emoji: '🧊', titulo: 'Las neveras', ruta: '#/neveras',   permiso: 'neveras.ver',          desde: null   },
  { emoji: '💧', titulo: 'La planta de agua', ruta: '#/agua', permiso: 'agua.ver',            desde: null   },
  { emoji: '✉️', titulo: 'Avisos',       ruta: '#/correo',    permiso: 'correo.configurar',    desde: null   },
  { emoji: '🏷️', titulo: 'Productos y precios', ruta: '#/productos', permiso: 'inventario.ver', desde: null },
  { emoji: '🧾', titulo: 'Clientes',      ruta: '#/clientes',  permiso: 'clientes.ver',         desde: null   },
  { emoji: '📋', titulo: 'Historial',     ruta: '#/historial', permiso: 'historial.ver',        desde: null   },
  { emoji: '🏦', titulo: 'Cuentas de la empresa', ruta: '#/empresa', permiso: 'empresa.ver',    desde: null   },
  { emoji: '📊', titulo: 'Los números',   ruta: '#/estadisticas', permiso: 'estadisticas.ver', desde: null },
  { emoji: '🎨', titulo: 'Personalizar', ruta: '#/personalizar', permiso: 'sistema.configurar', desde: null },
  { emoji: '⚙️', titulo: 'Sistema',      ruta: '#/sistema',   permiso: 'sistema.ver',          desde: null   },
  { emoji: '❓', titulo: 'Ayuda',        ruta: '#/ayuda',     permiso: null,                   desde: null   },
  { emoji: '✨', titulo: 'Qué hay de nuevo', ruta: '#/novedades', permiso: null,               desde: null   }
];

export function vistaInicio(pantalla, estado) {
  const puede = (p) => !p || estado.permisos.includes('*') || estado.permisos.includes(p);
  const visibles = ACCESOS.filter((a) => puede(a.permiso));

  pantalla.innerHTML = `
    <h2>Hola, ${esc(estado.usuario.nombre.split(' ')[0])}</h2>
    <p class="ayuda">Esto es lo que puedes hacer hoy.</p>
    <div class="rejilla">
      ${visibles.map((a) => `
        <a class="acceso ${a.desde ? 'proximo' : ''}" href="${a.desde ? '#/inicio' : a.ruta}">
          <span class="emoji">${a.emoji}</span>
          <strong>${esc(a.titulo)}</strong>
          ${a.desde ? `<small>llega en ${a.desde}</small>` : ''}
        </a>`).join('')}
    </div>`;
}
