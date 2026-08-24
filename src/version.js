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
 *
 * CÓMO SE NUMERAN
 * Después de la v0.9 viene la v1.0, no la v0.10. El segundo número va de 0
 * a 9 y luego sube el primero. El tercero (v1.4.1) es solo para arreglos de
 * algo que ya estaba, o para cambios de puro aspecto.
 */

const VERSION_ACTUAL = '1.6';

const VERSIONES = [
  {
    numero: '1.6',
    nombre: 'Clientes y crédito',
    fecha: '2026-08-24',
    resumen:
      'A quién se le fía, cuánto debe cada quien y cuánto hay en la calle. ' +
      'El saldo se calcula solo: nunca se guarda un número que pueda mentir.',
    cambios: [
      { tipo: 'nuevo', texto: 'PANTALLA DE CLIENTES: la lista a la izquierda con lo que debe cada uno, y a la derecha su cuenta completa. Arriba, lo que se pregunta todos los días: cuánto hay en la calle y a quién ya se le venció.' },
      { tipo: 'importante', texto: 'SOLO SE LE FÍA A CLIENTES REGISTRADOS, como en la fábrica. Al público en general no. En la caja, el botón "Fiar a un cliente" abre la lista; no hay forma de escribir un nombre a mano con gente esperando.' },
      { tipo: 'importante', texto: 'Antes de confirmar, la pantalla enseña lo que va a deber DESPUÉS de este ticket: debía + este ticket = va a deber. Ese es el número por el que se decide, y hacerlo de cabeza con gente enfrente es como se cometen los errores caros.' },
      { tipo: 'importante', texto: 'EL LÍMITE NO BLOQUEA: pasarse pide el PIN de un gerente y queda escrito quién lo autorizó y por qué. Al de la ferretería que lleva veinte años comprando no se le para la venta por un número que alguien escribió hace meses. Y el límite vacío quiere decir sin límite.' },
      { tipo: 'nuevo', texto: 'El ticket fiado sale marcado FIADO, con el nombre del cliente y su línea para firmar: ese papel es el vale.' },
      { tipo: 'nuevo', texto: 'ABONOS: el cliente pasa y deja lo que trae, no se aplica a un ticket concreto porque él tampoco lo dice así. En efectivo o por transferencia. Si paga de más, queda a su favor y se le avisa.' },
      { tipo: 'importante', texto: 'Un abono EN EFECTIVO entra al cajón como cualquier ingreso, porque el billete sí llegó ahí y el corte tiene que cuadrar. Uno por transferencia no. Y anular un abono también le quita su renglón al cajón.' },
      { tipo: 'importante', texto: 'UNA VENTA FIADA NO ES EFECTIVO: no entra en el arqueo del cajón. En el corte se ve aparte cuánto salió fiado en el turno, que es dinero en la calle, y aparte lo cobrado por transferencia, que ya se cobró.' },
      { tipo: 'nuevo', texto: 'Plazo en días por cliente, solo para marcar lo vencido. Nunca impide vender.' },
      { tipo: 'importante', texto: 'EL SALDO NO SE GUARDA: se suma cada vez. Así, cancelar un ticket viejo o anular un abono corrige la cuenta solo, y el papel del cliente y la pantalla de la fábrica no pueden decir cosas distintas.' },
      { tipo: 'nuevo', texto: 'Un cliente que todavía debe no se puede dar de baja: desaparecería de la cobranza con dinero en la calle.' },
      { tipo: 'arreglo', texto: 'Los importes tecleados ya no se limpian a la brava. Escribir "mucho" en un límite o en un fondo de caja se leía como 0, y un "-500" como 500. El mismo error había aparecido tres veces; ahora hay un solo lector de importes para todo el sistema.' }
    ],
    siguiente: 'v1.7 — Reparto: pedidos, rutas y neveras en comodato.'
  },
  {
    numero: '1.5',
    nombre: 'La caja avisa y la pantalla rinde',
    fecha: '2026-08-24',
    resumen:
      'La pantalla de vender ganó la franja de arriba entera, avisa de lo ' +
      'que se está acabando y ya no deja vender lo que no hay.',
    cambios: [
      { tipo: 'importante', texto: 'AVISO DE LO QUE SE ACABA: arriba a la derecha sale un triángulo con una bolita y el número de productos bajos. Al tocarlo se abre la lista completa, con cuántos quedan de cada uno y cuáles ya se acabaron.' },
      { tipo: 'importante', texto: 'LO QUE SE ACABÓ YA NO SE VENDE. El botón se ve apagado y dice "se acabó"; teclear su código tampoco lo mete. Y si pides 5 y solo hay 4, avisa antes de armar el ticket. Lo que no lleva inventario se sigue vendiendo sin tope.' },
      { tipo: 'importante', texto: 'EL HIELO ES LA EXCEPCIÓN: tiene su propio símbolo 🧊 y AVISA, pero jamás bloquea. El número del sistema es lo que se ha capturado, no lo que hay en el cuarto frío: los obreros reportan hasta como las 3, y hasta entonces siempre va a marcar de menos. Parar la venta de hielo por un dato que todavía no llega sería parar la fábrica.' },
      { tipo: 'nuevo', texto: 'Tú decides con cuántas marquetas avisa el hielo. Está en Productos y precios → Hielo, y ahí mismo se ve lo que hay capturado ahora.' },
      { tipo: 'importante', texto: 'MÁS PANTALLA PARA VENDER: la franja azul de arriba desaparece en la caja. El reloj, la fecha y el nombre del negocio se fueron al renglón de abajo, junto a las teclas; el menú y quién está en la caja se metieron en la fila de los botones. Son cien píxeles de alto que ahora son botones.' },
      { tipo: 'nuevo', texto: 'Atajos discretos arriba a la derecha: la existencia del cuarto frío, los números que siguen en los tanques, los gastos del cajón y terminar el turno. Si había un ticket a medias, se aparta solo antes de salir.' },
      { tipo: 'nuevo', texto: 'EN TICKETS, un botón "Ver" que abre lo que traía cada ticket sin imprimirlo. Antes había que gastar papel para leer qué se llevó el cliente.' },
      { tipo: 'nuevo', texto: 'HISTORIAL DEL CAJÓN desde la caja, cruzando turnos, con una raya que dice "de aquí para abajo es del turno de Fulano". Los gastos van en rojo y con su copia del comprobante; meter dinero se ve, pero discreto: nadie pide cuentas de lo que se dejó.' },
      { tipo: 'arreglo', texto: 'Poner "muchas" en el mínimo del hielo lo dejaba en cero —o sea, apagaba el aviso— y un −3 se leía como 3. Ahora se rechaza.' }
    ],
    siguiente: 'v1.6 — Clientes y crédito: a quién se le fía y cuánto debe.'
  },
  {
    numero: '1.4',
    nombre: 'Editar sin formularios',
    fecha: '2026-08-23',
    resumen:
      'Los productos se editan tocándolos: el nombre, el precio, el costo. ' +
      'Y lo dado de baja por fin se puede recuperar.',
    cambios: [
      { tipo: 'arreglo', texto: 'ARREGLADO: lo que se daba de baja no se podía recuperar. Ahora hay un botón "Ver dados de baja" y desde ahí se vuelven a dar de alta. Si su código lo tomó otro mientras tanto, vuelve sin código en vez de fallar.' },
      { tipo: 'importante', texto: 'Se edita en el sitio: tocas el nombre, el precio o el costo y escribes encima. Sales del campo y ya quedó guardado. Se acabaron los formularios de cinco pasos para corregir un precio.' },
      { tipo: 'importante', texto: 'Cuánto le ganas a cada producto, en porcentaje y en pesos, con una lectura de si el margen está bueno o apretado. Un producto barato con buen margen es el que conviene empujar, y eso no se ve mirando solo la diferencia.' },
      { tipo: 'nuevo', texto: 'El hielo se ve como los demás: sus pedazos son productos, con su foto y su código. Y ahí mismo se ve la existencia del cuarto frío.' },
      { tipo: 'nuevo', texto: 'Las categorías llevan su menú de tres puntos, imagen propia y selector de color de verdad (nada de escribir códigos raros).' },
      { tipo: 'nuevo', texto: 'Al crear un producto ya no se pregunta si es hielo: lo dice la categoría en la que estás.' },
      { tipo: 'importante', texto: 'Dar de baja algo que todavía tiene mercancía avisa cuántas piezas quedan y pide el PIN de un gerente o del administrador.' },
      { tipo: 'importante', texto: 'El cajero entra al inventario con VISTA LIMITADA: ve cuántas hay e imprime la hoja para contar, pero no ve los costos ni puede modificar nada. Y el costo ni siquiera sale del servidor.' },
      { tipo: 'nuevo', texto: 'El gerente ya administra productos y mueve inventario, no solo el administrador.' }
    ],
    siguiente: 'v1.5 — Vender con más pantalla, historiales y accesos rápidos.'
  },
  {
    numero: '1.3',
    nombre: 'Productos con foto, costo e inventario',
    fecha: '2026-08-23',
    resumen:
      'La pantalla de productos rehecha para la PC, con fotos en los ' +
      'botones, el costo de cada cosa y el inventario de lo que no es hielo.',
    cambios: [
      { tipo: 'importante', texto: 'Productos y precios rehecha: tres columnas a lo ancho y sin desplazar la página. Solo se mueven las listas.' },
      { tipo: 'importante', texto: 'El hielo va aparte, arriba del todo. No es un producto más: es el 80% del negocio y sus precios se forman de otra manera.' },
      { tipo: 'nuevo', texto: 'FOTO en cada producto. Con foto el cajero no lee el botón, lo reconoce, y se equivoca menos.' },
      { tipo: 'nuevo', texto: 'Costo de compra y ganancia por pieza a la vista.' },
      { tipo: 'importante', texto: 'INVENTARIO de lo que no es hielo: había + entró − se vendió = debería haber. Y al contar, cuánto falta. La misma cuenta que el cuarto frío, pero a otro ritmo: los refrescos se cuentan cuando toca, no dos veces al día.' },
      { tipo: 'nuevo', texto: 'Aviso de "ya hay que pedir" cuando un producto baja de su mínimo. Arriba dice cuántos van.' },
      { tipo: 'nuevo', texto: 'Hoja para contar imprimible, con su renglón en blanco para ir apuntando.' },
      { tipo: 'nuevo', texto: 'El costo de cada compra queda guardado con esa compra: si mañana sube el proveedor, lo que costó ayer no cambia.' },
      { tipo: 'importante', texto: 'La línea de venta ahora guarda CUÁNTAS PIEZAS. Sin eso, "2 × Coca" habría descontado un solo refresco del inventario.' },
      { tipo: 'arreglo', texto: 'Escribir −5 piezas se convertía en 5 al limpiar el texto. Ahora se rechaza: borrarle el signo habría metido una entrada que nadie pidió.' }
    ],
  },
  {
    numero: '1.2',
    nombre: 'Dos clientes a la vez y cambios de ticket',
    fecha: '2026-08-23',
    resumen:
      'Ya se puede dejar una venta a medias para atender al de atrás, y ' +
      'hacer el cambio clásico de "pedí de más" sin sacar la cuenta a mano.',
    cambios: [
      { tipo: 'nuevo', texto: 'NUEVA VENTA (F2): el ticket a medias se guarda, atiendes al que ya sabe lo que quiere, y al terminar el pendiente vuelve solo.' },
      { tipo: 'nuevo', texto: 'Arriba se ve cuántas ventas quedaron esperando. Puedes tener varias y elegir cuál seguir.' },
      { tipo: 'importante', texto: 'CAMBIO DE TICKET (F4): tecleas el número del ticket que trae el cliente, el sistema lo abona a favor, marcas lo que se lleva ahora y te dice si hay que cobrar la diferencia o devolverla.' },
      { tipo: 'importante', texto: 'En el cambio, el ticket viejo se cancela y queda amarrado al nuevo. El hielo vuelve solo al cuarto frío y la caja cuadra sola: no hay ninguna cuenta especial que se pueda desincronizar.' },
      { tipo: 'nuevo', texto: 'Si el ticket es de un turno ya cerrado, el sistema anota el movimiento para que el arqueo de hoy no salga corto.' },
      { tipo: 'arreglo', texto: 'El campo del código se quedaba con el enter durante el cobro, así que el enter que confirma no llegaba. Pasaba solo cuando no había que cobrar nada.' },
      { tipo: 'arreglo', texto: 'La fila de botones de arriba se metía como columna y descuadraba la pantalla.' }
    ],
  },
  {
    numero: '1.1',
    nombre: 'Impresión de verdad y relevo de turno',
    fecha: '2026-08-23',
    resumen:
      'El ticket ya no lo imprime el navegador: lo manda el sistema directo ' +
      'a la impresora. Y el cambio de cajero de las 3 por fin se puede ' +
      'registrar como pasa en la fábrica.',
    cambios: [
      { tipo: 'importante', texto: 'El ticket sale al instante, sin que se asome la ventana de impresión. El sistema le manda los bytes directo a la impresora térmica, como los programas de caja de verdad.' },
      { tipo: 'nuevo', texto: 'Configuración de la impresora en Productos y precios: nombre, ancho del papel, copias, renglón al pie, y un botón para imprimir una prueba.' },
      { tipo: 'importante', texto: 'YA NO SE IMPRIME SOLO al cobrar. Se cobra con enter, y otro enter imprime si hace falta. No todos los tickets se entregan.' },
      { tipo: 'nuevo', texto: 'F3 abre los tickets del día: se busca por número, importe u hora, y se puede sacar una COPIA. Para cuando el cliente vuelve o te saliste de la pantalla sin querer.' },
      { tipo: 'importante', texto: 'RELEVO DE TURNO. Al terminar, el sistema pregunta si ya llegó quien sigue. Si ya llegó, se hace el corte y se cierra la sesión: el que entra pone su PIN y el turno queda a su nombre.' },
      { tipo: 'importante', texto: 'Y si NO ha llegado (el relevo de las 2:30), se cuenta el dinero del que se va y la venta sigue: queda un turno esperando dueño, y lo que entre se aparta para el que llegue. Antes se seguía cobrando con el usuario equivocado y las ventas de la noche salían a nombre de quien no era.' },
      { tipo: 'nuevo', texto: 'Un gasto imprime su comprobante con espacio para la firma. Meter dinero no: nadie firma por dejar dinero.' },
      { tipo: 'arreglo', texto: 'Los campos de dinero ya no dejan escribir letras, y enter acepta en vez de hacer un salto de línea.' },
      { tipo: 'arreglo', texto: 'Los cajeros ya no ven la configuración de tanques. Sí siguen poniendo la producción y la existencia, y queda anotado quién con su PIN.' }
    ],
  },
  {
    numero: '1.0',
    nombre: 'La caja de verdad',
    fecha: '2026-08-23',
    resumen:
      'El punto de venta rehecho para trabajar con gente esperando: todo en ' +
      'una pantalla, sin desplazar, y sin soltar el teclado.',
    cambios: [
      { tipo: 'importante', texto: 'La venta es ahora la pantalla que se abre al entrar. Es la que se usa el 90% del día.' },
      { tipo: 'importante', texto: 'El turno de caja lo abre tu PIN. Ya no hay que ir a ninguna pantalla a abrirlo: quien entra es el responsable del dinero.' },
      { tipo: 'importante', texto: 'TODO CABE DE UNA VEZ: izquierda lo que lleva el cliente, derecha los botones. Solo se desplaza la rejilla de productos.' },
      { tipo: 'importante', texto: 'Sin tocar el ratón: tecleas 18 y enter y el octavo entra al ticket. F10 cobra. Enter calcula el cambio, otro enter cobra, otro imprime. Esc regresa. Abajo dice siempre qué hace enter.' },
      { tipo: 'nuevo', texto: 'Categorías y productos como carpetas: Hielo, Refrescos, Agua… Se dan de alta en Productos y precios, con su color y su código.' },
      { tipo: 'nuevo', texto: 'Ya se pueden vender cosas que no son hielo: refrescos, garrafones, botellas. Con su propio precio, y sin descontar del cuarto frío.' },
      { tipo: 'importante', texto: 'El hielo es UNA SOLA LÍNEA que se va sumando. Tocar 1/8 tres veces son 3/8 y cuestan $106, no tres renglones de $36. Así el ticket y la lista de precios dicen siempre lo mismo.' },
      { tipo: 'importante', texto: 'Ticket mucho más corto: la cantidad en grande y centrada, el número chiquito, sin "gracias por su compra". Con cientos al día, eso son metros de papel al mes.' },
      { tipo: 'importante', texto: 'El ticket sale directo por la impresora, sin el cuadro de "elegir impresora". INICIAR.bat abre el sistema como programa, sin barra de direcciones.' },
      { tipo: 'nuevo', texto: 'Meter dinero y anotar gastos desde la misma pantalla de venta. Verde entra, rojo sale.' },
      { tipo: 'nuevo', texto: 'Los precios se cambian en Productos y precios, junto al catálogo. Solo el administrador.' },
      { tipo: 'nuevo', texto: 'La calculadora de fracciones sigue ahí, en el botón 🧮, para las cantidades que no tienen botón.' },
      { tipo: 'nuevo', texto: 'El manual explica el teclado paso por paso.' }
    ],
  },
  {
    numero: '0.9.1',
    nombre: 'Manual de ayuda',
    fecha: '2026-08-23',
    resumen:
      'El manual vive dentro del sistema, no en un PDF que nadie abre. ' +
      'Cómo se usa cada parte, escrito para quien lo va a usar.',
    cambios: [
      { tipo: 'nuevo', texto: 'Pantalla de Ayuda con un tema por área: entrar, producción, existencia, venta, caja, respaldos, actualizar y qué hacer si algo no funciona.' },
      { tipo: 'nuevo', texto: 'Buscador: escribes "fracción" o "corte" y quedan solo los temas que hablan de eso, ya abiertos.' },
      { tipo: 'importante', texto: 'La tabla de quién puede hacer qué NO está escrita a mano: la arma el sistema con los permisos de verdad. El día que cambien, el manual se corrige solo. Hay una prueba que lo comprueba rol por rol.' },
      { tipo: 'nuevo', texto: 'Está en el menú y en el inicio, y la ve cualquiera: no hace falta ser administrador para leer cómo se usa el sistema.' }
    ],
  },
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
