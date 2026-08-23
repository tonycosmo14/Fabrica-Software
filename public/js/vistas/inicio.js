/**
 * Pantalla de inicio: los accesos grandes.
 * Los modulos que todavia no existen aparecen en gris con su version prevista,
 * asi se ve el avance del proyecto.
 */
import { esc } from '../util.js';

const ACCESOS = [
  { emoji: '🏭', titulo: 'Producción',   ruta: '#/tanques',   permiso: 'produccion.ver',       desde: null   },
  { emoji: '🧊', titulo: 'Configurar tanques', ruta: '#/config-tanques', permiso: 'tanques.configurar', desde: null },
  { emoji: '📦', titulo: 'Existencia',   ruta: '#/existencia', permiso: 'existencia.ver',      desde: null   },
  { emoji: '🛒', titulo: 'Vender',       ruta: '#/venta',     permiso: 'venta.registrar',      desde: null   },
  { emoji: '💵', titulo: 'Caja',         ruta: '#/caja',      permiso: 'caja.ver',             desde: null   },
  { emoji: '👥', titulo: 'Usuarios',     ruta: '#/usuarios',  permiso: 'usuarios.administrar', desde: null   },
  { emoji: '🏷️', titulo: 'Productos y precios', ruta: '#/productos', permiso: 'sistema.configurar', desde: null },
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
