/**
 * VERSIONES DEL SISTEMA
 * ---------------------
 * Este archivo es la unica fuente de verdad de "que hay de nuevo".
 * La pantalla de Novedades lo lee tal cual, no hay que tocar nada mas.
 *
 * Cada vez que terminemos un pedazo nuevo:
 *   1. Se agrega un objeto arriba del arreglo (el mas nuevo primero)
 *   2. Se actualiza VERSION_ACTUAL
 *   3. Se actualiza "version" en package.json
 *
 * tipo: 'nuevo' | 'mejora' | 'arreglo' | 'importante'
 */

const VERSION_ACTUAL = '0.9';

const VERSIONES = [
  {
    numero: '0.9',
    nombre: 'La Caja',
    fecha: '2026-08-23',
    resumen:
      'El espejo en dinero del cuadre del cuarto frío. Se abre el turno con ' +
      'un fondo, las ventas se pegan solas, y al cerrar se cuentan los ' +
      'billetes: el sistema dice si sobra o falta.',
    cambios: [
      { tipo: 'importante', texto: 'Turno de caja: se abre con el fondo para dar cambio y se cierra contando el dinero. La cuenta es la misma que la del hielo: fondo + cobrado + entradas − gastos = lo que debería haber.' },
      { tipo: 'importante', texto: 'Las ventas se pegan solas al turno abierto. No hay que capturar nada dos veces.' },
      { tipo: 'nuevo', texto: 'Gastos y retiros: la gasolina, los refrescos, el retiro a la caja fuerte. Con quién se lo llevó y quién lo anotó.' },
      { tipo: 'nuevo', texto: 'Entradas de dinero, para cuando se trae cambio del banco a media tarde.' },
      { tipo: 'importante', texto: 'Corte de caja imprimible, con firma. Dice cuánto sobró o faltó y por qué suele pasar.' },
      { tipo: 'importante', texto: 'Un corte cerrado se congela: cancelar mañana una venta de hoy ya no lo cambia. Un papel firmado no se mueve solo.' },
      { tipo: 'nuevo', texto: 'Cancelar una venta baja sola lo que debería haber en el cajón, mientras el turno siga abierto.' },
      { tipo: 'nuevo', texto: 'Historial de cortes: un renglón por turno, con lo que sobró o faltó en cada uno.' },
      { tipo: 'importante', texto: 'Solo puede haber UN turno abierto a la vez. Con dos, ninguna venta sabría a cuál pertenece.' },
      { tipo: 'importante', texto: 'Si nadie abrió la caja, se puede cobrar igual: la fábrica no se para por eso. Pero la pantalla de venta lo avisa en amarillo, porque ese dinero no entra en ningún corte.' },
      { tipo: 'nuevo', texto: 'Solo el efectivo entra al arqueo. Lo cobrado por otros medios se informa aparte: ese dinero nunca pasó por el cajón.' },
      { tipo: 'nuevo', texto: 'El cajero abre, mueve dinero y cierra. Anular un movimiento es del gerente y del administrador.' }
    ],
    siguiente: 'v0.10 — Clientes, mayoreo y crédito.'
  },
  {
    numero: '0.8',
    nombre: 'Punto de venta',
    fecha: '2026-08-23',
    resumen:
      'Ya se puede cobrar. Y como ahora la caja dice qué se vendió, el ' +
      'cuadre del cuarto frío por fin separa lo vendido de lo que falta.',
    cambios: [
      { tipo: 'importante', texto: 'Punto de venta: se marca la cantidad con los botones 1, 1/2, 1/4, 1/8 y 1/16, y el precio sale solo.' },
      { tipo: 'importante', texto: 'Cada fracción tiene su propio precio. Tocar seis veces 1/16 cuesta exactamente lo mismo que tocar 1/4 y 1/8: no hay forma de cobrar de más ni de menos según quién atienda.' },
      { tipo: 'importante', texto: 'El total lo calcula el servidor, no la pantalla. Aunque alguien le mueva al navegador, el precio es el que es.' },
      { tipo: 'nuevo', texto: 'Ticket con folio consecutivo, listo para la impresora térmica de 80 mm.' },
      { tipo: 'nuevo', texto: 'Botones de billete ($50, $100, $200...) y el cambio en grande, para no equivocarse de vuelto.' },
      { tipo: 'importante', texto: 'Un ticket cobrado NO se edita: se cancela, con motivo y con nombre de quien lo canceló. El original nunca se borra.' },
      { tipo: 'nuevo', texto: 'Buscador de tickets por número, por importe o por hora.' },
      { tipo: 'nuevo', texto: 'Pantalla de precios (solo el administrador), con el proporcional como sugerencia. Cambiar un precio no toca los tickets de ayer.' },
      { tipo: 'importante', texto: 'EL CONTEO YA ACEPTA FRACCIONES: se captura "14 marquetas y 5/8" tal cual, escrito o con los botones.' },
      { tipo: 'importante', texto: 'El cuadre del cuarto frío ahora dice VENDIDO y FALTANTE por separado. El faltante es lo que se derritió, se cayó o se fue sin pagar: ese es el número que hay que vigilar.' },
      { tipo: 'nuevo', texto: 'Una venta cancelada deja de descontar hielo del cuarto frío, automáticamente.' },
      { tipo: 'nuevo', texto: 'El cajero vende; cancelar es del gerente y del administrador; los precios, solo del administrador.' },
      { tipo: 'arreglo', texto: 'Mover la carpeta de datos ahora se lleva también la base de datos, no solo los respaldos.' }
    ],
  },
  {
    numero: '0.7',
    nombre: 'La Existencia',
    fecha: '2026-08-23',
    resumen:
      'El control que hoy llevas en la libreta, hecho sistema: cuentas las ' +
      'marquetas del cuarto frío y el sistema te dice cuánto salió.',
    cambios: [
      { tipo: 'importante', texto: 'Pantalla de Existencia con el cuadre: lo que había, más lo que se produjo, menos lo que contaste, igual a lo que salió.' },
      { tipo: 'nuevo', texto: 'El conteo se hace con los botones − y ＋, partiendo del número que debería haber.' },
      { tipo: 'nuevo', texto: 'Ticket imprimible de cada conteo, con firma. Tu respaldo en papel.' },
      { tipo: 'nuevo', texto: 'Horarios de conteo configurables: a las 3 y a las 8 el sistema avisa que toca contar.' },
      { tipo: 'nuevo', texto: 'Cuartos fríos configurables. Hoy hay uno; si mañana hay más, cada uno se cuenta por separado.' },
      { tipo: 'nuevo', texto: 'Historial de conteos, y anular uno mal capturado sin borrar nada.' },
      { tipo: 'importante', texto: 'Cada conteo guarda congelados sus números: corregir una sacada vieja no cambia un corte que ya se hizo.' },
      { tipo: 'nuevo', texto: 'El cajero puede contar; anular y configurar es del gerente y del administrador.' }
    ],
  },
  {
    numero: '0.6',
    nombre: 'Respaldos automáticos',
    fecha: '2026-08-23',
    resumen:
      'Los datos de la fábrica se copian solos cada pocas horas, y también ' +
      'fuera de la PC. Si el disco muere, no se pierde el negocio.',
    cambios: [
      { tipo: 'importante', texto: 'El sistema se respalda solo cada 4 horas, y también al encenderse. No hay que acordarse de nada.' },
      { tipo: 'importante', texto: 'Segunda copia fuera de la PC: en una USB pegada atrás o en una carpeta de Drive u OneDrive. Esa es la que salva si el disco muere.' },
      { tipo: 'nuevo', texto: 'En Sistema se ve de un vistazo si los respaldos están sanos, cuándo fue el último y cuántas copias hay.' },
      { tipo: 'nuevo', texto: 'Botón para respaldar ahora mismo, y para cambiar cada cuánto se hace.' },
      { tipo: 'nuevo', texto: 'La carpeta de fuera se prueba antes de aceptarla: si no se puede escribir, te lo dice en ese momento.' },
      { tipo: 'nuevo', texto: 'Si la USB se desconecta, la copia local sigue haciéndose y la pantalla avisa que la de fuera está fallando.' },
      { tipo: 'nuevo', texto: 'Se conservan las últimas 30 copias y las viejas se borran solas.' },
      { tipo: 'mejora', texto: 'Las instrucciones para restaurar están en la propia pantalla de Sistema.' }
    ]
  },
  {
    numero: '0.5.1',
    nombre: 'Autoriza primero, decide después',
    fecha: '2026-08-23',
    resumen:
      'El aviso de "este paño no es el que sigue" ahora sale al primer toque, ' +
      'no al final. Se autoriza con PIN y enseguida se ven las opciones.',
    cambios: [
      { tipo: 'importante', texto: 'Al tocar un paño que no sigue, el aviso sale al instante. Se autoriza con el PIN del gerente y enseguida aparecen las opciones.' },
      { tipo: 'nuevo', texto: 'En Registrar lo que se sacó la rotación avanza conforme marcas: si sacó el 1, el 3 y el 5, los tres son correctos y no pide nada.' },
      { tipo: 'nuevo', texto: 'En el detalle del paño ahora se indica quién lo sacó y se cambia el agua ahí mismo.' },
      { tipo: 'arreglo', texto: 'Al dar de alta un operario ya no se pide contraseña: solo los administradores y gerentes entran desde la PC.' },
      { tipo: 'mejora', texto: 'Botones de acción centrados en el detalle del paño.' }
    ]
  },
  {
    numero: '0.5',
    nombre: 'Los números a sacar',
    fecha: '2026-08-23',
    resumen:
      'Producción se reordenó: primero registrar lo que se sacó, luego el ' +
      'papel con los números que siguen. Y se arreglaron los paños que se ' +
      'quedaban trabados.',
    cambios: [
      { tipo: 'arreglo', texto: 'Un paño que quedaba fuera del tanque ya no se traba: ahora se puede rellenar.' },
      { tipo: 'arreglo', texto: 'Anular un registro ya funciona, aunque el paño esté terminado.' },
      { tipo: 'nuevo', texto: 'Números a sacar: un papel con los paños que siguen en cada tanque, con fecha y hora, para imprimirlo y dárselo al obrero.' },
      { tipo: 'nuevo', texto: 'Registrar lo que se sacó es ahora lo primero que se ve al entrar.' },
      { tipo: 'nuevo', texto: 'Al entrar a un paño se marca molde por molde qué pasó, y ahí mismo se saca, se rellena o se corrige.' },
      { tipo: 'importante', texto: 'Saltarse la rotación pide motivo escrito y el PIN de un gerente o del administrador. Ya no basta con estar dentro del sistema.' },
      { tipo: 'nuevo', texto: 'Cada molde cuenta las veces SEGUIDAS que ha fallado. Si sale bien una vez, la cuenta se borra: así se distingue el molde malo del mal día.' },
      { tipo: 'nuevo', texto: 'El agua potable se ve en morado y la purificada en azul, en las canastas y en el botón.' },
      { tipo: 'nuevo', texto: 'Los números a sacar solo los ven el gerente y el administrador.' }
    ]
  },
  {
    numero: '0.4',
    nombre: 'Producción como trabaja la fábrica',
    fecha: '2026-08-23',
    resumen:
      'Producción se rehizo con el flujo real: el paño como unidad, la ' +
      'rotación intercalada como regla, y la captura de la jornada completa ' +
      'al final del día, que es como se hace hoy.',
    cambios: [
      { tipo: 'importante', texto: 'La rotación 1, 3, 5... y luego 2, 4, 6... ahora es regla: el sistema marca cuál toca y no deja sacar otro.' },
      { tipo: 'importante', texto: 'Sacar un paño que no toca requiere autorización de gerente o administrador, con motivo, y queda registrado.' },
      { tipo: 'importante', texto: 'Sacar y rellenar son un solo toque, porque los moldes siempre se vuelven a llenar. Dejar un paño fuera es la excepción y se marca aparte.' },
      { tipo: 'nuevo', texto: 'Registrar lo que sacó un obrero: marcas los paños que te dice y se capturan todos de golpe, a su nombre.' },
      { tipo: 'nuevo', texto: 'Un paño empezado y sin terminar queda "a medias" y es el siguiente que toca; otro obrero lo termina y quedan los dos registrados.' },
      { tipo: 'nuevo', texto: 'El agua se cambia con un botón al lado, sin entrar a ningún menú.' },
      { tipo: 'nuevo', texto: 'Rol Gerente de turno: autoriza saltarse la rotación y corrige errores. El cajero no puede.' },
      { tipo: 'nuevo', texto: 'Anular un registro equivocado: no se borra nada, queda marcado como anulado con su motivo.' },
      { tipo: 'nuevo', texto: 'Un molde que falló la última vez queda marcado en rojo. Si siempre aparece marcado, ese molde tiene un problema físico.' },
      { tipo: 'nuevo', texto: 'Lo de hoy: marquetas y merma del día, repartidas por obrero.' },
      { tipo: 'mejora', texto: 'Se quitaron los turnos de abrir y cerrar. Cada movimiento guarda su hora y quién lo hizo.' },
      { tipo: 'mejora', texto: 'Encabezado en un solo renglón: reloj, logo y usuario a la misma altura. Se gana pantalla.' },
      { tipo: 'mejora', texto: 'El menú entra deslizándose en vez de aparecer de golpe.' },
      { tipo: 'nuevo', texto: 'En Configurar tanques: un esquema visual que explica qué es un paño, una canasta y un molde, y las instrucciones de uso.' },
      { tipo: 'nuevo', texto: 'Volvió la fichita ＋ al final de cada paño para agregar una canasta de un toque.' },
      { tipo: 'mejora', texto: 'En PC se aprovecha todo el ancho: los tanques se acomodan en varias columnas.' },
      { tipo: 'mejora', texto: 'Los nombres de los tanques van centrados y se desplazan de lado si algún día no caben.' }
    ]
  },
  {
    numero: '0.3',
    nombre: 'Producción',
    fecha: '2026-08-23',
    resumen:
      'La pantalla del trabajo diario: sacar y rellenar canastas, con el ' +
      'reloj de congelación corriendo y el color diciendo el estado de un vistazo.',
    cambios: [
      { tipo: 'nuevo', texto: 'Pantalla de Producción con pestañas por tanque y un paño por renglón.' },
      { tipo: 'nuevo', texto: 'Cada canasta es un bloque de cuadritos: un cuadrito es un molde, o sea una marqueta.' },
      { tipo: 'nuevo', texto: 'Los colores dicen el estado sin leer: azul congelando, gris lista, naranja sacada sin rellenar.' },
      { tipo: 'nuevo', texto: 'Un tap en la canasta la saca; si estaba fuera, la rellena. Sin menús de por medio.' },
      { tipo: 'nuevo', texto: 'Turno de producción: se abre, se registra todo dentro, y al cerrar avisa si quedaron canastas sin rellenar.' },
      { tipo: 'nuevo', texto: 'El reloj de congelación corre solo y muestra las horas de cada paño.' },
      { tipo: 'nuevo', texto: 'El sistema sugiere qué paño sigue: el que lleva más tiempo congelando.' },
      { tipo: 'nuevo', texto: 'Marcar merma molde por molde cuando hace falta, con el conteo de marquetas buenas en vivo.' },
      { tipo: 'nuevo', texto: 'Cada rellenado guarda si fue con agua purificada o potable.' },
      { tipo: 'nuevo', texto: 'Resumen del turno: marquetas, merma y todos los movimientos con hora y responsable.' },
      { tipo: 'importante', texto: 'Sacar y rellenar son dos cosas distintas: puedes sacar y dejar la canasta para rellenarla al rato, y el sistema no la pierde de vista.' },
      { tipo: 'importante', texto: 'El estado no se guarda: se deduce de los movimientos. Así cualquier día del pasado se puede reconstruir tal como fue.' }
    ]
  },
  {
    numero: '0.2.2',
    nombre: 'Encabezado, reloj y atajos',
    fecha: '2026-08-23',
    resumen:
      'El logo pasa al encabezado, se agregan reloj y usuario activo, ' +
      'atajos para no entrar hasta la configuración, y qué hacer si se ' +
      'olvida la contraseña del administrador.',
    cambios: [
      { tipo: 'importante', texto: 'RECUPERAR-ACCESO: si el administrador olvida su PIN y su contraseña, se le ponen claves nuevas desde la PC de la fábrica.' },
      { tipo: 'nuevo', texto: 'El logo aparece en medio del encabezado, con la hora y la fecha a la izquierda y quién está dentro a la derecha.' },
      { tipo: 'nuevo', texto: 'Las imágenes se eliminan con una tachita encima, y el sistema avisa "Imagen eliminada".' },
      { tipo: 'nuevo', texto: 'Acciones rápidas en cada tanque de la lista, sin tener que entrar.' },
      { tipo: 'nuevo', texto: 'Agregar y quitar varios paños de un golpe, en vez de uno por uno.' },
      { tipo: 'nuevo', texto: 'La pantalla Sistema dice dónde vive la base de datos y cómo recuperar el acceso.' },
      { tipo: 'arreglo', texto: 'El logo del encabezado no quedaba centrado cuando no había botón de atrás.' }
    ]
  },
  {
    numero: '0.2.1',
    nombre: 'Personalizar y mejor acabado',
    fecha: '2026-08-23',
    resumen:
      'Ya puedes subir tu logo desde el sistema, se puede quitar un paño que ' +
      'sobra, y las ventanas del sistema dejaron de ser las feas del navegador.',
    cambios: [
      { tipo: 'nuevo', texto: 'Pantalla Personalizar: sube tu logo en PNG o SVG, con versión aparte para modo oscuro, y cambia el nombre del negocio.' },
      { tipo: 'importante', texto: 'El logo se guarda junto a tus datos, no dentro del programa: no se pierde al actualizar.' },
      { tipo: 'arreglo', texto: 'Ya se puede quitar un paño que metiste de más, sin borrar el tanque completo. Y recuperarlo desde "Ver bajas".' },
      { tipo: 'nuevo', texto: 'Ventanas propias del sistema en vez de las del navegador, con botones − y ＋ para los moldes.' },
      { tipo: 'mejora', texto: 'La pantalla ahora se llama Configurar tanques. Producción será la del trabajo diario.' },
      { tipo: 'mejora', texto: 'Mejor acabado del configurador: tarjetas de tanque, cabecera y el total en grande.' },
      { tipo: 'arreglo', texto: 'En la PC el botón de opciones del paño se caía a otro renglón.' }
    ]
  },
  {
    numero: '0.2',
    nombre: 'Tanques',
    fecha: '2026-08-23',
    resumen:
      'La primera pantalla del negocio de verdad: la estructura física de la ' +
      'fábrica. Tanques, paños, canastas y moldes, todo creado desde el sistema.',
    cambios: [
      { tipo: 'nuevo', texto: 'Pantalla de Tanques con el total de paños, canastas y moldes de toda la fábrica.' },
      { tipo: 'nuevo', texto: 'Alta de tanque en un solo paso: dices cuántos paños y cómo son sus canastas, y se crea completo.' },
      { tipo: 'nuevo', texto: 'El total de moldes se calcula en vivo mientras lo capturas, antes de guardar.' },
      { tipo: 'nuevo', texto: 'Vista del tanque por dentro: cada paño en un renglón, con sus canastas como bloques.' },
      { tipo: 'nuevo', texto: 'Agregar paños y canastas, cambiar los moldes de una canasta, y dar de baja lo que salga de servicio.' },
      { tipo: 'importante', texto: 'Cada molde es una fila real con su posición. Así, más adelante, el sistema podrá señalar el molde exacto que siempre falla.' },
      { tipo: 'importante', texto: 'Nada está escrito en el código: si mañana crece la fábrica, los tanques nuevos los das de alta tú.' },
      { tipo: 'arreglo', texto: 'Tocar en el menú la pantalla en la que ya estabas no hacía nada.' },
      { tipo: 'arreglo', texto: 'El campo de usuario del asistente de bienvenida daba un error en los navegadores nuevos.' }
    ]
  },
  {
    numero: '0.1.4',
    nombre: 'Hielo LOLHA',
    fecha: '2026-08-23',
    resumen:
      'El sistema toma la identidad de la marca, estrena modo oscuro y ya no ' +
      'trae ninguna cuenta de fábrica: la primera vez te pide crear la tuya.',
    cambios: [
      { tipo: 'importante', texto: 'Al abrirlo por primera vez te pide crear tu cuenta de administrador. Ya no existe el PIN 1234 de fábrica.' },
      { tipo: 'nuevo', texto: 'Modo oscuro. En el menú eliges Claro, Oscuro o Auto, y cada dispositivo guarda el suyo.' },
      { tipo: 'nuevo', texto: 'Los colores del logo de Hielo LOLHA en todo el sistema.' },
      { tipo: 'arreglo', texto: 'En la PC el teclado del PIN se salía de la tarjeta y los números no quedaban centrados.' },
      { tipo: 'arreglo', texto: 'El menú mostraba "admin" en vez de "Administrador".' }
    ]
  },
  {
    numero: '0.1.3',
    nombre: 'Se instala sin pelear',
    fecha: '2026-08-22',
    resumen:
      'La instalación fallaba en Windows porque una pieza del sistema venía en ' +
      'código que hay que compilar y pedía Visual Studio. Esa pieza ya no existe: ' +
      'ahora se usa la base de datos que Node.js trae incluida.',
    cambios: [
      { tipo: 'arreglo', texto: 'Ya no pide Visual Studio ni herramientas de programador para instalarse.' },
      { tipo: 'importante', texto: 'La base de datos ahora es la que Node.js trae adentro. Nada que compilar, nada que descargar.' },
      { tipo: 'mejora', texto: 'La instalación pasó de 104 paquetes a 67, y es cuestión de segundos.' },
      { tipo: 'mejora', texto: 'Si tu Node.js es muy viejo, lo dice en español en vez de soltar un error incomprensible.' },
      { tipo: 'mejora', texto: 'Si la preparación falla, el mensaje te dice qué mandar para arreglarlo.' }
    ]
  },
  {
    numero: '0.1.2',
    nombre: 'Se abre con doble clic',
    fecha: '2026-08-22',
    resumen:
      'Ya no hace falta escribir comandos. Hay un icono en el escritorio: ' +
      'doble clic y el sistema arranca y abre el navegador solo.',
    cambios: [
      { tipo: 'nuevo', texto: 'INICIAR: arranca el sistema y abre el navegador cuando ya está listo.' },
      { tipo: 'nuevo', texto: 'CREAR ACCESO DIRECTO: pone el icono del cubo de hielo en el escritorio.' },
      { tipo: 'nuevo', texto: 'DETENER y ACTUALIZAR, también de doble clic.' },
      { tipo: 'nuevo', texto: 'La primera vez se prepara solo; si falta Node.js, abre la página de descarga.' },
      { tipo: 'nuevo', texto: 'Desde el celular se puede instalar en la pantalla de inicio y se ve como una app.' },
      { tipo: 'mejora', texto: 'Si das doble clic dos veces, avisa que ya está abierto en vez de dar un error.' }
    ]
  },
  {
    numero: '0.1.1',
    nombre: 'Se ve bien en la PC',
    fecha: '2026-08-22',
    resumen:
      'La interfaz ya estaba pensada para el celular. Esta versión la ajusta ' +
      'para que en la pantalla grande de la caja y de la oficina se vea igual de bien.',
    cambios: [
      { tipo: 'mejora', texto: 'En pantalla grande los accesos se acomodan en cuatro columnas y el contenido queda centrado.' },
      { tipo: 'mejora', texto: 'La pantalla de entrada se ve como una tarjeta centrada, no como una columna suelta.' },
      { tipo: 'nuevo',  texto: 'En la PC el PIN se puede escribir con el teclado: números, Retroceso para borrar y Esc para volver.' },
      { tipo: 'mejora', texto: 'Los botones resaltan al pasar el ratón encima y ya no se estiran de lado a lado.' },
      { tipo: 'arreglo', texto: 'La versión aparece en la barra superior, sin repetir la letra "v".' },
      { tipo: 'arreglo', texto: 'Las casillas de verificación ahora son grandes y fáciles de tocar.' }
    ]
  },
  {
    numero: '0.1',
    nombre: 'Cimientos',
    fecha: '2026-08-22',
    resumen:
      'Arranca el sistema: base de datos, migraciones automáticas, respaldos, ' +
      'usuarios con PIN, roles y permisos, y esta misma pantalla de novedades.',
    cambios: [
      { tipo: 'nuevo', texto: 'Servidor local con Express y base de datos SQLite.' },
      { tipo: 'nuevo', texto: 'Migraciones numeradas: la base se actualiza sola al arrancar.' },
      { tipo: 'nuevo', texto: 'Respaldo automático de la base antes de cada actualización.' },
      { tipo: 'nuevo', texto: 'Usuarios y roles: operario, cajero, repartidor y admin.' },
      { tipo: 'nuevo', texto: 'Entrada con PIN de 4 a 6 dígitos y sesión que no se cierra sola.' },
      { tipo: 'nuevo', texto: 'Entrada con usuario y contraseña para el admin.' },
      { tipo: 'nuevo', texto: 'Pantalla de usuarios: alta, edición, cambio de PIN y baja (nadie se borra).' },
      { tipo: 'nuevo', texto: 'Bitácora: cada movimiento guarda quién lo ejecutó y quién lo capturó.' },
      { tipo: 'nuevo', texto: 'Pantalla "Qué hay de nuevo" con el historial de versiones.' },
      { tipo: 'importante', texto: 'Motor de fracciones en dieciseisavos, listo para el punto de venta.' }
    ]
  }
];

module.exports = { VERSION_ACTUAL, VERSIONES };
