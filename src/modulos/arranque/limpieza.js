/**
 * QUÉ SE BORRA AL CERRAR LAS PRUEBAS  (v5.2.1)
 *
 * ============================================================
 * POR QUÉ ESTO ES UN ARCHIVO Y NO UNA LISTA SUELTA
 * ============================================================
 *
 * La lista original se escribió en la v2.8 con las trece tablas que había
 * entonces, y se quedó ahí. Desde entonces entraron los cortes de hielo,
 * las encomiendas, los gastos de la empresa, los recibos de la CFE, los
 * vales, la raya, las neveras y la planta de agua — y ninguna se borraba.
 *
 * El resultado era el peor posible: el botón decía «te dejo limpio» y
 * dejaba dentro los cortes de prueba, que después salían mezclados con los
 * meses buenos del negocio y ya no había forma de separarlos.
 *
 * Aquí cada tabla está clasificada a mano, y hay una prueba que revienta
 * cuando aparece una tabla nueva sin clasificar. Es a propósito: obliga a
 * decidir, en el momento de crearla, si lo que guarda es historia del
 * negocio o es cómo está armada la fábrica. Olvidarse ya no es una opción
 * silenciosa.
 *
 * ============================================================
 * LA LÍNEA QUE SEPARA LAS DOS
 * ============================================================
 *
 * SE BORRA lo que PASÓ: una venta, una sacada, un corte, un gasto, una
 * lectura. Son hechos con fecha, y los de las pruebas son hechos que no
 * pasaron.
 *
 * SE QUEDA lo que ES: los tanques, los productos, los precios, la gente,
 * los clientes, las neveras y los equipos de la planta. Eso costó trabajo
 * capturar y sigue siendo verdad al día siguiente.
 *
 * Los dos casos que parecen movimiento pero no lo son:
 *
 *   · UN COMODATO es dónde está una nevera hoy. Si se borrara, cincuenta
 *     neveras quedarían sin dueño y habría que volver a capturar dónde
 *     está cada una.
 *   · UNA PIEZA PUESTA es qué membrana trae el equipo hoy. Borrarla haría
 *     que la planta entera saliera «sin capturar» al día siguiente.
 *
 * Y la BITÁCORA nunca se toca: es el único sitio donde queda que las
 * pruebas existieron y que alguien las borró.
 */

/**
 * Las tablas de movimientos, en orden de borrado: primero los hijos, para
 * no dejar una línea de venta apuntando a una venta que ya no está.
 *
 * El `grupo` es lo que se le enseña a la persona antes de borrar, con su
 * cuenta. Ver "3 cortes de caja" antes de apretar es lo que evita el
 * arrepentimiento.
 */
const MOVIMIENTOS = [
  // --- La caja y las ventas ---
  { tabla: 'iva_devoluciones', grupo: 'Las ventas' },
  { tabla: 'venta_lineas', grupo: 'Las ventas' },
  { tabla: 'ventas', grupo: 'Las ventas', cuenta: true },
  { tabla: 'abonos', grupo: 'La caja' },
  { tabla: 'movimientos_caja', grupo: 'La caja' },
  { tabla: 'cajas', grupo: 'Los cortes de caja', cuenta: true },

  // --- La producción ---
  { tabla: 'sacadas_moldes', grupo: 'La producción' },
  // El rastro de lo que se corrigió de una sacada (v6.6): se va con ella.
  { tabla: 'correcciones_moldes', grupo: 'La producción' },
  { tabla: 'sacadas', grupo: 'La producción', cuenta: true },
  { tabla: 'rellenados', grupo: 'La producción' },
  { tabla: 'sacadas_pano', grupo: 'La producción' },
  { tabla: 'turnos_produccion', grupo: 'La producción' },
  { tabla: 'temperaturas_salmuera', grupo: 'La producción' },

  // --- El cuarto frío ---
  { tabla: 'conteos', grupo: 'Los conteos del cuarto frío', cuenta: true },
  { tabla: 'mermas_hielo', grupo: 'El cuarto frío' },
  // LOS CORTES DE HIELO. Éstos son los que faltaban y los que se notaban:
  // cada uno saca marquetas del cuarto frío y mete bolsas al inventario.
  { tabla: 'cortes_hielo', grupo: 'Los cortes de hielo', cuenta: true },
  { tabla: 'encomiendas', grupo: 'Las encomiendas' },

  // --- Los pedidos (v5.6) ---
  //
  // Un pedido es una PROMESA de la fábrica de mentira: al arrancar de
  // verdad no se le debe nada a nadie. Y si se quedaran, el primer día
  // real aparecerían en la hoja de preparación pedidos que nunca existieron
  // y saldría hielo del cuarto frío a llevárselo a nadie.
  { tabla: 'pedido_lineas', grupo: 'Los pedidos' },
  { tabla: 'pedidos', grupo: 'Los pedidos', cuenta: true },

  // --- El reparto (v5.7) ---
  //
  // Un viaje es un movimiento como una venta: pasó una vez y ya pasó. Si
  // quedaran, el primer día real habría camionetas en la calle que nunca
  // salieron, y con dinero que nadie va a entregar.
  //
  // EL ORDEN DE ESTA LISTA NO ES EL DE LAS LLAVES FORÁNEAS, y aquí no
  // puede serlo: una venta apunta a su salida y una salida apunta a la
  // venta de lo que vendió suelto. Es un círculo, y ningún orden lo
  // resuelve. Da igual porque esta base no obliga las llaves foráneas
  // —nunca lo ha hecho— y el borrado va entero dentro de una transacción.
  // El día que se enciendan, esto necesita `defer_foreign_keys`.
  { tabla: 'salida_carga', grupo: 'Las salidas de reparto' },
  { tabla: 'salida_pedidos', grupo: 'Las salidas de reparto' },
  { tabla: 'salidas', grupo: 'Las salidas de reparto', cuenta: true },

  // --- El inventario ---
  { tabla: 'movimientos_inventario', grupo: 'El inventario' },
  { tabla: 'avisos_inventario', grupo: 'El inventario' },

  // --- El dinero de la empresa ---
  { tabla: 'recibos_cfe', grupo: 'Los recibos de la luz', cuenta: true },
  { tabla: 'gastos_empresa', grupo: 'Los gastos de la empresa', cuenta: true },

  // --- La gente ---
  { tabla: 'adelantos', grupo: 'Los vales de sueldo' },
  { tabla: 'rayas', grupo: 'Las semanas pagadas' },

  // --- Las neveras (lo que pasó, no dónde están) ---
  { tabla: 'nevera_servicios', grupo: 'Las neveras' },
  { tabla: 'nevera_cortesias', grupo: 'Las neveras' },

  // --- La planta de agua (las vueltas, no el equipo) ---
  { tabla: 'agua_lecturas', grupo: 'La planta de agua', cuenta: true },
  { tabla: 'agua_servicios', grupo: 'La planta de agua' },

  // --- Lo de fuera ---
  { tabla: 'correos', grupo: 'Los correos en cola' },
  { tabla: 'clima_registros', grupo: 'El clima' }
];

/**
 * Lo que NO se borra, y por qué. No sirve para nada en el código: sirve
 * para que la prueba pueda decir «esta tabla nueva no está clasificada» y
 * para que quien lea esto entienda la decisión sin tener que adivinarla.
 */
const SE_QUEDA = {
  // Cómo está armada la fábrica
  tanques: 'los tanques, tal como son',
  panos: 'sus paños',
  canastas: 'sus canastas',
  moldes: 'sus moldes',
  almacenes: 'los cuartos fríos',

  // El catálogo y el dinero de fuera
  productos: 'los productos',
  categorias: 'sus categorías',
  listas_precios: 'las listas de precios',
  precios: 'los precios',
  conceptos_gasto: 'los conceptos de gasto del cajón',
  conceptos_empresa: 'los conceptos de gasto de la empresa',
  proveedores: 'los proveedores',
  clientes: 'los clientes, con su crédito',

  // La gente
  usuarios: 'la gente, con sus PIN',
  sueldos: 'cuánto gana cada quien',
  horarios_empleado: 'qué días viene cada quien',
  sesiones_dispositivo: 'los dispositivos reconocidos',

  // Los fierros. Son el mundo real, no movimientos.
  neveras: 'las neveras',
  comodatos: 'dónde está cada nevera y con quién',
  agua_equipos: 'los equipos de la planta de agua',
  agua_piezas: 'qué pieza trae puesta cada equipo',
  // Una camioneta es un fierro, igual que una nevera: existe el día antes
  // y el día después de arrancar. Lo que se borra son sus viajes.
  vehiculos: 'los vehículos del reparto',

  // Y lo que nunca se toca
  configuracion: 'todos los ajustes',
  bitacora: 'la bitácora entera, incluido el borrado de hoy',
  migraciones: 'el control de versiones de la base'
};

/** Todas las tablas de la base, sin las internas de SQLite. */
function tablasDeLaBase(bd) {
  return bd.prepare(`
    SELECT name FROM sqlite_master
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
     ORDER BY name
  `).all().map((r) => r.name);
}

/**
 * Las que no están en ninguna de las dos listas.
 *
 * Si esto devuelve algo, alguien creó una tabla y no dijo si lo que guarda
 * es historia o es la fábrica. La prueba lo caza antes de que llegue a la
 * fábrica de verdad.
 */
function sinClasificar(bd) {
  const conocidas = new Set([...MOVIMIENTOS.map((m) => m.tabla), ...Object.keys(SE_QUEDA)]);
  return tablasDeLaBase(bd).filter((t) => !conocidas.has(t));
}

/**
 * Cuánto hay en cada grupo, para enseñarlo ANTES de borrar.
 *
 * Se agrupa como lo diría una persona —"3 cortes de caja"— y no tabla por
 * tabla: nadie sabe qué es `venta_lineas`, y sí sabe qué es una venta.
 */
function loQueSeVaABorrar(bd) {
  const porGrupo = new Map();
  for (const m of MOVIMIENTOS) {
    let n = 0;
    try { n = bd.prepare(`SELECT COUNT(*) n FROM "${m.tabla}"`).get().n; }
    catch { continue; }                       // la tabla todavía no existe
    const antes = porGrupo.get(m.grupo) || { grupo: m.grupo, cuantos: 0 };
    // Solo cuentan las tablas marcadas con `cuenta`, o el grupo entero si
    // ninguna lo está: contar las líneas Y las ventas daría el doble.
    if (m.cuenta || !MOVIMIENTOS.some((x) => x.grupo === m.grupo && x.cuenta)) {
      antes.cuantos += n;
    }
    porGrupo.set(m.grupo, antes);
  }
  return [...porGrupo.values()].filter((g) => g.cuantos > 0)
    .sort((a, b) => b.cuantos - a.cuantos);
}

module.exports = {
  MOVIMIENTOS, SE_QUEDA,
  tablasDeLaBase, sinClasificar, loQueSeVaABorrar
};
