/**
 * Roles y permisos (seccion 4 del plan).
 * Un permiso es una etiqueta corta. Las rutas piden permisos, no roles,
 * asi agregar un rol nuevo despues no obliga a tocar todas las rutas.
 */

const ROLES = ['operario', 'cajero', 'repartidor', 'gerente', 'admin'];

const PERMISOS_POR_ROL = {
  // EL OPERARIO DA LA VUELTA DE LA PLANTA DE AGUA  (v5.2). Medir el TDS,
  // el cloro y anotar los medidores es trabajo de turno, y lo hace quien
  // está ahí. Cambiar una membrana o capturar lo que costó, no.
  operario: ['produccion.ver', 'produccion.registrar', 'agua.ver', 'agua.anotar'],
  cajero: [
    'produccion.ver',
    'produccion.registrar',
    // Imprimir los números que siguen: el operario pregunta en el mostrador.
    'produccion.numeros',
    'caja.ver',
    'caja.operar',
    'venta.registrar',
    'venta.ver',
    'existencia.ver',
    'existencia.contar',
    // Del inventario solo ve cuántas hay, para poder ir a contar con la
    // hoja impresa. Ni los costos ni los movimientos son cosa suya.
    'inventario.ver',
    // El cajero fía y cobra: es quien está en el mostrador cuando el
    // cliente llega a pagar. Dar de alta clientes y ponerles límite no,
    // eso es decidir a quién se le fía y cuánto.
    'clientes.ver',
    'venta.credito',
    'credito.cobrar',
    // LAS NEVERAS  (v5.1). El cajero las VE y puede reportar una falla:
    // el cliente la reporta en el mostrador y hay que poder anotarla en
    // el momento. Prestarlas, moverlas y darlas de baja es otra cosa.
    'neveras.ver',
    // LA PLANTA DE AGUA  (v5.2). La ve y puede anotar la vuelta: en un
    // turno flojo el del mostrador es quien tiene tiempo de darla.
    'agua.ver',
    'agua.anotar'
  ],
  repartidor: ['reparto.ver', 'reparto.operar'],

  // El gerente de turno: todo lo del cajero, más autorizar lo que se sale
  // de la regla (sacar un paño fuera de orden) y corregir errores.
  gerente: [
    'produccion.ver',
    'produccion.registrar',
    'produccion.numeros',
    'produccion.autorizar',
    'produccion.corregir',
    'caja.ver',
    'caja.operar',
    'venta.registrar',
    'venta.ver',
    'venta.cancelar',
    // LAS NEVERAS  (v5.1). El gerente y el cajero las VEN y pueden
    // reportar una falla —el cliente la reporta en el mostrador y hay que
    // poder anotarla en el momento—; moverlas, prestarlas y darlas de
    // baja es del administrador, que es de quien son.
    'neveras.ver',
    // LA PLANTA DE AGUA  (v5.2). Igual que las neveras: la ve, anota la
    // vuelta y reporta una falla. Poner y quitar equipos, capturar lo que
    // costó una membrana y mover los límites del TDS es del dueño.
    'agua.ver',
    'agua.anotar',
    'existencia.ver',
    'existencia.contar',
    'existencia.corregir',
    // RECIBIR EL DINERO DE UN TURNO. El cajero entrega el cajón y se va;
    // quien cuenta lo que le entregaron es el gerente o el dueño. Que lo
    // hiciera el cajero sería firmarse a sí mismo la entrega.
    'caja.recibir',
    'inventario.ver',
    'inventario.mover',
    // Ver a cómo se compra cada cosa y cuánto se le gana.
    'costos.ver',
    // Dar de alta y de baja productos y categorías.
    'productos.administrar',
    // Decide a quién se le fía, cuánto y con qué plazo, y autoriza que
    // alguien se pase de su límite.
    'clientes.ver',
    'clientes.administrar',
    'venta.credito',
    'credito.cobrar',
    'credito.autorizar',
    'reparto.ver',
    // LOS GASTOS GRANDES DE LA EMPRESA: el amoniaco, la sal, la maquinaria,
    // el recibo de la luz. El gerente los VE —hace falta para saber si un
    // paro de máquina ya se pagó o no— pero solo el administrador los
    // captura: es dinero que no pasa por ningún cajón y no lo cuadra nadie
    // al final del turno.
    'empresa.ver',
    // Los números del negocio. El gerente es quien puede hacer algo con
    // ellos: si el hielo se está echando a perder o una máquina empezó a
    // gastar de más, él lo ve en su turno y lo atiende el mismo día.
    'estadisticas.ver'
  ],
  admin: ['*'] // el comodin abre todo
  // LOS SUELDOS SON SOLO DEL ADMINISTRADOR  (v4.8)
  //
  // `raya.ver` y `raya.pagar` no los lista ningún rol a propósito: cuánto
  // gana cada quien no es un dato de operación, y de los pocos que ni el
  // gerente de turno debe ver. Como admin tiene el comodín, quedan suyos.
  // El día que haga falta un contador, se le da `raya.ver` a un rol nuevo
  // sin tocar ninguna ruta.
  //
  // Y CON `neveras.administrar`  (v5.1). Prestar una nevera es firmar un
  // contrato y comprometer un fierro de veinte mil pesos; darla de baja
  // es darla por perdida. Verlas y reportar una falla sí es de turno —el
  // cliente la reporta en el mostrador—, pero moverlas no.
  //
  // Y CON `agua.administrar`  (v5.2). Una membrana cuesta lo que cuesta y
  // el límite de TDS es el que decide si el agua se embotella o no: los
  // dos son decisiones del dueño, no del turno. Medir y reportar sí es de
  // turno, y por eso `agua.ver` y `agua.anotar` sí los tienen todos.
  //
  // LO MISMO CON `correo.configurar`  (v4.9). Ahí vive la contraseña de la
  // cuenta de correo de la fábrica, y la lista de a quién le llegan los
  // avisos de lo que pasa dentro. Ninguna de las dos cosas es de un turno.
};

const ETIQUETAS_ROL = {
  operario: 'Operario',
  cajero: 'Encargado de caja',
  repartidor: 'Repartidor',
  gerente: 'Gerente de turno',
  admin: 'Administrador'
};

function permisosDe(rol) {
  return PERMISOS_POR_ROL[rol] || [];
}

function puede(rol, permiso) {
  const permisos = permisosDe(rol);
  return permisos.includes('*') || permisos.includes(permiso);
}

module.exports = { ROLES, ETIQUETAS_ROL, PERMISOS_POR_ROL, permisosDe, puede };
