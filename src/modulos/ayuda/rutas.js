/**
 * EL MANUAL DE AYUDA  (v0.9.1)
 *
 * El manual vive DENTRO del sistema, no en un PDF aparte que nadie abre.
 * El texto está en la pantalla; de aquí sale lo único que no se puede
 * escribir a mano sin que se pudra: la tabla de quién puede hacer qué.
 *
 * Esa tabla se arma leyendo los permisos de verdad (src/lib/roles.js). El
 * día que se agregue un rol o se le quite un permiso a alguien, el manual
 * se corrige solo. Un manual que miente es peor que no tener manual.
 */
const express = require('express');
const { ok } = require('../../lib/respuestas');
const { ROLES, ETIQUETAS_ROL, PERMISOS_POR_ROL, puede } = require('../../lib/roles');
const { exigirSesion } = require('../../middleware/sesion');

const router = express.Router();

/**
 * Las cosas que se pueden hacer en el sistema, dichas como las diría una
 * persona. La clave es el permiso real; el texto es para el manual.
 *
 * Si algún día se agrega un permiso y no se pone aquí, no pasa nada malo:
 * simplemente no sale en la tabla. Pero mejor ponerlo.
 */
const ACCIONES = [
  { grupo: 'Producción', permiso: 'produccion.ver',       texto: 'Ver los tanques y cómo van' },
  { grupo: 'Producción', permiso: 'produccion.registrar', texto: 'Registrar lo que se sacó y rellenar' },
  { grupo: 'Producción', permiso: 'produccion.autorizar', texto: 'Autorizar sacar un paño fuera de orden' },
  { grupo: 'Producción', permiso: 'produccion.corregir',  texto: 'Anular un registro mal capturado, o corregir cómo salió' },

  { grupo: 'Existencia', permiso: 'existencia.ver',       texto: 'Ver lo que hay en el cuarto frío' },
  { grupo: 'Existencia', permiso: 'existencia.contar',    texto: 'Hacer el conteo' },
  { grupo: 'Existencia', permiso: 'existencia.corregir',  texto: 'Anular un conteo mal capturado' },

  { grupo: 'Venta',      permiso: 'venta.registrar',      texto: 'Cobrar' },
  { grupo: 'Venta',      permiso: 'venta.ver',            texto: 'Buscar y ver tickets' },
  { grupo: 'Venta',      permiso: 'venta.cancelar',       texto: 'Cancelar una venta' },

  { grupo: 'Caja',       permiso: 'caja.ver',             texto: 'Ver la caja y los cortes' },
  { grupo: 'Caja',       permiso: 'caja.operar',          texto: 'Abrir el turno, anotar gastos y cerrar' },

  { grupo: 'Clientes',   permiso: 'clientes.ver',         texto: 'Ver los clientes y ponerle nombre al ticket (precio de mayoreo)' },
  { grupo: 'Clientes',   permiso: 'clientes.administrar', texto: 'Dar de alta clientes, su límite y su lista de mayoreo' },
  { grupo: 'Clientes',   permiso: 'venta.credito',        texto: 'Dar crédito' },
  { grupo: 'Clientes',   permiso: 'credito.cobrar',       texto: 'Recibir abonos' },
  { grupo: 'Clientes',   permiso: 'credito.autorizar',    texto: 'Autorizar crédito por encima del límite' },

  { grupo: 'Pedidos',    permiso: 'pedidos.ver',          texto: 'Ver lo que hay que preparar y las notas de entrega' },
  { grupo: 'Pedidos',    permiso: 'pedidos.tomar',        texto: 'Apartar un pedido y cancelarlo' },
  { grupo: 'Pedidos',    permiso: 'pedidos.entregar',     texto: 'Marcar un pedido entregado (ahí nace su venta)' },

  { grupo: 'Reparto',    permiso: 'reparto.ver',          texto: 'Ver las salidas y lo que llevan' },
  { grupo: 'Reparto',    permiso: 'reparto.operar',       texto: 'Armar la carga, sacarla, capturar el regreso y recibir el dinero' },
  { grupo: 'Reparto',    permiso: 'reparto.cuadrar',      texto: 'Cerrar una salida que no cuadró, con su motivo' },
  { grupo: 'Reparto',    permiso: 'vehiculos.administrar', texto: 'Dar de alta y de baja vehículos' },

  { grupo: 'Inventario', permiso: 'inventario.ver',       texto: 'Ver lo que queda de cada producto' },
  { grupo: 'Inventario', permiso: 'inventario.mover',     texto: 'Registrar entradas, salidas y conteos' },
  { grupo: 'Inventario', permiso: 'productos.administrar', texto: 'Dar de alta productos y categorías' },

  { grupo: 'Empresa',    permiso: 'empresa.ver',          texto: 'Ver los gastos grandes de la empresa y los recibos de luz' },
  { grupo: 'Empresa',    permiso: 'empresa.administrar',   texto: 'Capturar gastos grandes, recibos de luz y el mes del negocio' },

  { grupo: 'Empresa',    permiso: 'estadisticas.ver',     texto: 'Ver los números del negocio y sus gráficas' },

  { grupo: 'Sistema',    permiso: 'usuarios.administrar', texto: 'Dar de alta y de baja usuarios' },
  { grupo: 'Sistema',    permiso: 'sistema.configurar',   texto: 'Configurar tanques, cuartos fríos, logo y respaldos' },
  { grupo: 'Sistema',    permiso: 'precios.configurar',   texto: 'Cambiar los precios' },
  { grupo: 'Sistema',    permiso: 'sistema.ver',          texto: 'Ver la bitácora y el estado del sistema' },
  { grupo: 'Sistema',    permiso: 'historial.ver',        texto: 'Ver el historial de todo lo que se ha hecho' }
];

/**
 * La tabla de permisos, armada de los permisos reales.
 * No se escribe a mano en ningún lado: se calcula.
 */
router.get('/permisos', exigirSesion, (req, res) => {
  const roles = ROLES.map((rol) => ({
    rol,
    etiqueta: ETIQUETAS_ROL[rol],
    // El administrador tiene comodín; se dice así en vez de listar todo.
    comodin: (PERMISOS_POR_ROL[rol] || []).includes('*')
  }));

  const acciones = ACCIONES.map((a) => ({
    ...a,
    quienes: ROLES.filter((rol) => puede(rol, a.permiso))
  }));

  return ok(res, { roles, acciones });
});

module.exports = router;
