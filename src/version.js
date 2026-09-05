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

const VERSION_ACTUAL = '7.2';

const VERSIONES = [
  {
    numero: '7.2',
    nombre: 'Producción, como la quiero ver',
    fecha: '2026-09-05',
    resumen:
      'La pantalla de los tanques ya no se desplaza: los tanques arriba, '
      + 'grandes, y el paño que sigue siempre a la vista. Lo único que '
      + 'rueda es la lista de paños, dentro de su propia caja.',
    cambios: [
      { tipo: 'mejora', texto:
        'LA PANTALLA NO SE MUEVE, como la de vender. Antes, con dieciocho '
        + 'paños, al bajar la lista se perdían de vista los tanques y el '
        + 'paño que tocaba. Ahora esos dos se quedan quietos arriba y solo '
        + 'la lista de paños se desplaza.' },
      { tipo: 'mejora', texto:
        'LOS TANQUES, LO MÁS GRANDE DE LA PANTALLA. Se reparten todo el '
        + 'ancho y el encendido canta cuál es: anotar en el tanque que no '
        + 'es cuesta un paño entero y no se descubre hasta el día '
        + 'siguiente.' },
      { tipo: 'nuevo', texto:
        'EL PAÑO QUE TOCA LLEVA EL BOTÓN. Ya no es solo un aro verde que '
        + 'había que saber interpretar: dice «✓ Sacar el paño 5» con todas '
        + 'sus letras, y la lista se abre puesta en él aunque sea el doce '
        + 'de dieciocho.' },
      { tipo: 'nuevo', texto:
        'EL MOLDE QUE FALLA SE VE DESDE LA LISTA. El renglón se marca en '
        + 'rojo y dice cuál es —«⚠ molde 2 (canasta 1)»— sin tener que '
        + 'entrar al paño a buscarlo.' },
      { tipo: 'nuevo', texto:
        'LA ÚLTIMA EXTRACCIÓN, junto al paño que sigue: «Paño 3 hace 2 h '
        + '15 min · Nael · 13 marq». Es la pregunta que viene enseguida.' },
      { tipo: 'mejora', texto:
        'EL PANEL DE AL LADO, ordenado: los cuatro números del tanque en '
        + 'casillas con su color, cuántos paños tiene, la salmuera, el '
        + 'cuarto frío en grande, y cómo salió el hielo hoy con su '
        + 'porcentaje —cuánto de lo que se abrió entró al cuarto frío—.' },
      { tipo: 'mejora', texto:
        'Los tres papeles que se sacan desde aquí —números a sacar, revisar '
        + 'el tanque y el día— pasaron a la barra de arriba, en un renglón, '
        + 'para dejarle el alto a la lista de paños.' }
    ]
  },
  {
    numero: '7.1',
    nombre: 'Productos y precios, como los quiero ver',
    fecha: '2026-09-05',
    resumen:
      'El catálogo entero en una pantalla, con la ficha partida en tres '
      + 'bloques, y el mayoreo por cantidad que faltaba: «de cincuenta '
      + 'bolsas para arriba, a $16.50», y le toca a quien sea.',
    cambios: [
      { tipo: 'nuevo', texto:
        'PRECIO POR VOLUMEN. En la ficha de cada producto se pone a partir '
        + 'de cuántas piezas baja el precio y a cuánto queda la pieza. Le '
        + 'toca a QUIEN SEA que se lleve esa cantidad, tenga trato o no: no '
        + 'es un acuerdo con nadie, es cuánto vale comprar mucho. Los dos '
        + 'datos van juntos y se apaga borrando los dos.' },
      { tipo: 'nuevo', texto:
        'LOS TRES PRECIOS, EN UN SOLO BLOQUE. Mostrador, precio por volumen '
        + 'y a cuántos clientes se les dejó precio propio. Al cobrar gana el '
        + 'más particular: su convenio, luego el volumen, luego su lista de '
        + 'mayoreo y al final el mostrador.' },
      { tipo: 'nuevo', texto:
        'AVISA SI REGALAS EL PRODUCTO. Debajo del precio por volumen se ve '
        + 'el descuento que estás dando y cuánto sigues ganando a ese '
        + 'precio. Si queda por debajo de lo que te cuesta, lo dice.' },
      { tipo: 'nuevo', texto:
        'HISTORIAL DE PRECIOS. Cada cambio con la fecha, quién lo hizo y de '
        + 'cuánto a cuánto. Sale de la bitácora, no de una lista aparte. Los '
        + 'tickets ya cobrados no cambian.' },
      { tipo: 'nuevo', texto:
        'DUPLICAR UN PRODUCTO. La copia trae el mismo precio, costo y '
        + 'ajustes; nace sin código y con «(copia)» en el nombre.' },
      { tipo: 'nuevo', texto:
        'BUSCADOR Y FILTROS. Se busca por nombre o código en TODO el '
        + 'catálogo, no solo en la categoría abierta, y hay tres botones: '
        + 'Todos, Con existencia y Por pedir.' },
      { tipo: 'mejora', texto:
        'LA FICHA, EN TRES BLOQUES NUMERADOS: identificación, precios y '
        + 'existencias. Son tres decisiones distintas y ahora se encuentran '
        + 'sin leer la columna entera.' },
      { tipo: 'mejora', texto:
        'CUATRO NÚMEROS ABAJO: catálogo activo, cuántos tienen precio '
        + 'especial, el valor de lo que hay en mostrador con su margen '
        + 'promedio, y cuántos hay que pedir.' },
      { tipo: 'mejora', texto:
        'MARCAS EN LA LISTA. En cada renglón, ▣ si tiene precio por volumen '
        + 'y ◆ si hay clientes con precio propio.' }
    ]
  },
  {
    numero: '7.0',
    nombre: 'Pedidos, como los quiero ver',
    fecha: '2026-09-05',
    resumen:
      'El control y despacho entero en una pantalla: las seis etapas del '
      + 'flujo arriba, el padrón de pedidos en tabla y la inspección al '
      + 'lado, con lo que lleva y lo que se hace al llegar.',
    cambios: [
      { tipo: 'nuevo', texto: 'LAS SEIS ETAPAS DEL FLUJO, arriba y con cuántos hay en cada una: todos, pendientes, en preparación, en ruta, entregados y cancelados. SE TOCAN Y FILTRAN la lista — es la pregunta de todos los días y por eso está a la vista, no escondida en un desplegable. Tocar otra vez la encendida la apaga.' },
      { tipo: 'importante', texto: '«EN PREPARACIÓN» Y «EN RUTA» NO SE APUNTAN A MANO: salen solas de en qué salida va el pedido y de cómo va esa salida. Si hubiera que marcarlas, el día que a alguien se le olvidara la pantalla diría que un pedido sigue en la planta mientras va llegando a la puerta del cliente.' },
      { tipo: 'nuevo', texto: 'EL PADRÓN EN TABLA: número de guía (#GL-) y hora, cliente y giro, cuánto es y cómo se cobra, y en qué camioneta va con su parada. El atrasado lleva su guía en rojo. Al tocar un renglón se abre su inspección al lado.' },
      { tipo: 'nuevo', texto: 'LA INSPECCIÓN DEL PEDIDO: a dónde va, su horario, sus referencias, QUÉ SE HACE AL LLEGAR, y qué lleva línea por línea con precio unitario y subtotal. Y los botones: remisión, contactar al chofer, subirlo a una camioneta, entregado o cancelar.' },
      { tipo: 'nuevo', texto: 'LAS INSTRUCCIONES DE DESCARGA del cliente: «entrar por la rampa trasera, pedir firma a Don Arturo». Se escriben una vez en su ficha y salen en cada pedido suyo. No son las referencias: aquellas dicen cómo encontrar la puerta y se leen buscando la dirección; éstas se leen ya en la puerta, con el hielo en las manos.' },
      { tipo: 'nuevo', texto: 'EL GIRO DEL CLIENTE («Horeca / Cadena Puerto», «Conveniencia Express»). En una lista de pedidos dice más que el nombre: quien arma la ruta sabe que a un restaurante hay que llegarle antes de que abra la cocina.' },
      { tipo: 'nuevo', texto: 'BUSCAR por número de guía —«8», «#GL-0008» o «gl-8», como salga—, por cliente, por giro o por dirección. Y FILTRAR POR PRODUCTO: «¿quién pidió garrafones hoy?», que es la pregunta cuando la planta va corta de algo.' },
      { tipo: 'nuevo', texto: 'EXPORTAR A EXCEL, con los filtros que estés viendo. Sale un archivo que Excel abre en columnas y con los acentos bien puestos, con guía, fechas, cliente, giro, zona, dirección, etapa, cobro, unidad, chofer y total.' },
      { tipo: 'nuevo', texto: 'CONTACTAR AL CHOFER por WhatsApp desde el pedido que lleva. El teléfono se le pone a cada quien en Usuarios.' },
      { tipo: 'mejora', texto: 'La hoja de preparación sigue donde debe: en un botón de imprimir. Es un papel que se lee en la planta con las manos mojadas, no una vista más de la lista.' }
    ]
  },
  {
    numero: '6.9.1',
    nombre: 'La nevera del cliente, y el ancho de la ficha',
    fecha: '2026-09-05',
    resumen:
      'Entregarle una nevera desde su propia ficha, y la ficha más ancha: '
      + 'dos tercios la tabla y un tercio los datos, en proporción y no en '
      + 'píxeles clavados.',
    cambios: [
      { tipo: 'nuevo', texto: 'ENTREGARLE UNA NEVERA DESDE SU FICHA, en «Tarifas y envases». Salen solo las que están en bodega —una nevera prestada no se presta dos veces— y el comodato se arma con la dirección, el contacto y la ubicación que ya tiene capturados, así que no hay que volver a teclearlos.' },
      { tipo: 'nuevo', texto: 'Y SE VEN LAS QUE TIENE: número, marca, cuántas bolsas le caben, número de serie y desde cuándo. Recogerla o sacar su contrato se sigue haciendo en «Las neveras», y la flecha del renglón lleva directo a esa nevera.' },
      { tipo: 'mejora', texto: 'LA FICHA, MÁS ANCHA. Valía 400 píxeles clavados: en una laptop se veía bien y en un monitor grande se quedaba pinchada mientras la tabla se estiraba sola. Ahora son dos tercios y un tercio en proporción, y las dos crecen con la pantalla.' },
      { tipo: 'arreglo', texto: 'EL BOTÓN DE «LEVANTAR PEDIDO» YA FUNCIONA. Llevaba a una dirección que el sistema no sabía leer y se caía al inicio. Ahora abre la caja CON EL CLIENTE YA PUESTO en el ticket: solo queda marcar lo que se lleva.' }
    ]
  },
  {
    numero: '6.9',
    nombre: 'Clientes, como los quiero ver',
    fecha: '2026-09-05',
    resumen:
      'La cartera entera en una pantalla: cuatro números arriba, el padrón '
      + 'en tabla y la ficha al lado. Cada cliente con sus datos fiscales, su '
      + 'zona, su ventana de recepción, SUS PRECIOS producto por producto y '
      + 'los garrafones que trae.',
    cambios: [
      { tipo: 'nuevo', texto: 'LA CARTERA, EN UNA SOLA PANTALLA. Arriba, cuatro números: padrón comercial, cuentas con crédito, saldo por cobrar y altas de los últimos 30 días — cada uno con su renglón chico, porque un número solo no dice nada. Debajo, el padrón en tabla y la ficha del que toques al lado.' },
      { tipo: 'mejora', texto: 'EL PADRÓN EN TABLA, no en lista: código, cliente y razón social, contacto y zona, frecuencia, lo que se lleva al mes, saldo y estado. Se ordena por saldo mayor, por consumo, por nombre o por quién compró hace poco. Las preguntas de todos los días se contestan comparando columnas, y eso una lista de renglones no lo deja hacer.' },
      { tipo: 'nuevo', texto: 'EL ALTA ES UNA PANTALLA ENTERA, con el resumen de la cuenta armándose a la derecha conforme escribes. Cuatro bloques: información comercial y fiscal, reparto y descarga, esquema de pago, y envases en comodato. Solo el nombre comercial es obligatorio.' },
      { tipo: 'importante', texto: 'PRECIOS ACORDADOS PRODUCTO POR PRODUCTO. Antes solo se le podía pegar una lista de mayoreo entera, y esas listas solo saben de hielo por fracción: la bolsa y el garrafón no cabían. Ahora cada cliente puede tener su precio en el producto que sea, y gana a la lista y al mostrador. Al lado sale el de mostrador tachado y la diferencia en porcentaje.' },
      { tipo: 'mejora', texto: 'Y ese precio NO pide autorización: es su precio normal, igual que el de mayoreo. El PIN se sigue pidiendo para el descuento de una vez, que lleva su porqué escrito. Quitarle el precio propio lo devuelve al de mostrador, no lo deja en cero.' },
      { tipo: 'nuevo', texto: 'LOS GARRAFONES QUE TRAE EL CLIENTE, con su límite acordado y su garantía. La cuenta sale de sumar entregas y devoluciones, no de un contador que alguien pueda editar. Pasarse del límite avisa pero no se rechaza: el garrafón ya se lo llevó. La garantía va APARTE del saldo, porque una garantía no es una deuda.' },
      { tipo: 'nuevo', texto: 'DATOS FISCALES: razón social, RFC, régimen y correo de facturación. El sistema NO factura —no emite CFDI ni habla con el SAT— pero los guarda y los saca impresos en el ticket a crédito y en el recibo de abono, para pasárselos a quien factura.' },
      { tipo: 'nuevo', texto: 'ZONA, FRECUENCIA ACORDADA Y VENTANA DE RECEPCIÓN en horas de reloj. La ventana se puede ordenar y comparar —sirve para armar la ruta por quién cierra primero— y el horario de texto libre se queda para las rarezas.' },
      { tipo: 'mejora', texto: 'LO QUE SE LLEVA AL MES, en kilos de hielo y garrafones aparte, sacado de sus tickets de 30 días. Sale en la tabla y en su ficha.' },
      { tipo: 'mejora', texto: 'SE FUE «¿DÓNDE SE PREPARA?» de la ficha del producto. La fábrica es una sola y cualquier cliente puede pedir lo que quiera; la marca de agua se deduce sola del nombre y sigue sirviendo para la pestaña de clientes de agua y para partir la hoja de preparación.' }
    ]
  },
  {
    numero: '6.8.1',
    nombre: 'Tres cosas que estorbaban',
    fecha: '2026-09-05',
    resumen:
      'La pregunta del hielo en dos pasos: primero si se vende, y solo '
      + 'después qué tan congelada. El inventario ya se puede apagar. Y «dónde '
      + 'se prepara» ahora dice para qué sirve de verdad.',
    cambios: [
      { tipo: 'mejora', texto: 'CÓMO SALIÓ EL HIELO, EN DOS PASOS. Primero lo que decide: ✅ Salió buena, hueca o cáscara, salada, aguada, otro. Y solo si salió buena, enseguida los cuatro grados: 100% sellada, 80-90, 60-80, 40-60. Antes eran ocho botones en fila y afinar un porcentaje que no cambia el dinero parecía tan importante como decir si el hielo se vendía.' },
      { tipo: 'mejora', texto: 'EL PAÑO NORMAL SIGUE SIENDO UN SOLO TOQUE: al elegir «salió buena» el grado ya viene puesto en el de siempre (del 80 al 90%). Cambiarlo es el segundo toque, y solo lo da quien quiere afinar el registro. Igual en un molde suelto y al corregir una sacada.' },
      { tipo: 'arreglo', texto: 'EL INVENTARIO YA SE PUEDE APAGAR. Se podía encender y no apagar, así que un producto al que se le dio una vez quedaba pidiendo conteos para siempre. Ahora hay un «Dejar de llevar inventario de esto», y no borra nada: entradas, salidas y conteos se quedan, y si lo vuelves a encender la cuenta sigue desde donde iba.' },
      { tipo: 'mejora', texto: '«¿DÓNDE SE PREPARA?» AHORA DICE QUÉ ES: «¿de cuál de los dos negocios es?», la fábrica de hielo o la planta de agua. Es lo que parte en dos la hoja de preparación de los pedidos y lo que marca al cliente como «💧 agua» para poder buscarlo después. Y lo dice claro: NO limita nada, cualquier producto de los dos lados se vende y se puede pedir.' }
    ]
  },
  {
    numero: '6.8',
    nombre: 'La raya, como se paga de verdad',
    fecha: '2026-09-05',
    resumen:
      'Cuatro formas de pago en vez de dos, tarifas distintas para el '
      + 'sábado, el domingo y los días que tú marques, y la semana se apunta '
      + 'día por día: lo que trabajó, no lo que le tocaba trabajar.',
    cambios: [
      { tipo: 'nuevo', texto: 'CUATRO FORMAS DE PAGO: por semana, por quincena, por día y POR HORA. Antes solo había dos, y a quien se le paga la quincena o por horas no había dónde ponerlo.' },
      { tipo: 'importante', texto: 'TARIFAS DISTINTAS PARA EL SÁBADO, EL DOMINGO Y LOS DÍAS ESPECIALES, para el que cobra por día o por hora. Se preguntan al ponerle sueldo y se pueden dejar vacías: vacío quiere decir «ese día gana lo mismo», que es lo que pasa con casi todos.' },
      { tipo: 'nuevo', texto: 'LOS DÍAS ESPECIALES LOS MARCAS TÚ, con el botón 📅 de la lista de sueldos. No hay lista fija: un 16 de septiembre, la feria, el día que se trabajó de más. Un día marcado manda sobre el sábado y el domingo.' },
      { tipo: 'importante', texto: 'LA SEMANA SE APUNTA DÍA POR DÍA: qué días VINO, no qué días le tocaba venir. Un renglón por día, y los que nadie apuntó salen en ámbar, porque un hueco es trabajo pendiente de alguien.' },
      { tipo: 'nuevo', texto: 'LAS DOS FORMAS DE APUNTAR UN DÍA, porque las dos se usan: hora de entrada y hora de salida —y las horas salen de la resta— o las horas a secas, para el que dice «hice seis» y ya. El día que no vino también se apunta: es la diferencia entre «faltó» y «nadie lo apuntó».' },
      { tipo: 'mejora', texto: 'EL BOTÓN QUE AHORRA LA SEMANA ENTERA: «Rellenar con su horario de costumbre» deja apuntados de un golpe los días que le tocaban, con sus horas, y después solo se corrigen las excepciones. No pisa lo que ya se corrigió a mano ni apunta días que no han llegado.' },
      { tipo: 'mejora', texto: 'LA CUENTA ENSEÑA POR QUÉ SALIÓ ASÍ: «de eso, 1 día de sábado $350», «1 día de especial $500». Y si no se apuntó ni un día, dice claro que el número salió de su horario de costumbre y que es una suposición.' },
      { tipo: 'mejora', texto: 'EL PAPEL QUE FIRMA LLEVA LOS DÍAS, uno por uno, con lo que valió cada uno. La pregunta al recibirlo es «¿me contaste el domingo?», y sin los días la única respuesta era volver a la computadora.' },
      { tipo: 'mejora', texto: 'Con las flechas ‹ › se camina a la semana anterior, para apuntar una que se quedó pendiente. Y todo lo pagado sigue congelado: subirle el sueldo o desmarcar aquel feriado no cambia un papel ya firmado.' }
    ]
  },
  {
    numero: '6.7',
    nombre: 'Revisar el tanque',
    fecha: '2026-09-05',
    resumen:
      'Una vuelta al tanque con el sistema diciendo qué debería tener cada '
      + 'paño. Es lo que descubre al día siguiente lo que hoy aparece a los '
      + 'tres días, con el faltante en el turno de otra persona.',
    cambios: [
      { tipo: 'nuevo', texto: 'EL BOTÓN 🔎 REVISAR EL TANQUE, arriba en Producción de hielo. Sale la lista de sus paños con lo que el sistema dice que debería tener cada uno AHORA MISMO: «paño 5, debe tener agua congelando, se sacó hoy a las 6:10, la sacó Don Chema». Se camina el tanque y se va marcando lo que hay de verdad.' },
      { tipo: 'importante', texto: 'LA RESPUESTA QUE IMPORTA ES «🧊 TIENE HIELO» y el sistema dice que ya se sacó: quiere decir que se reportó una sacada que no pasó. Hay producción apuntada que no existe, y ese faltante iba a aparecer días después en el conteo, cuando ya le tocaba a otro.' },
      { tipo: 'nuevo', texto: 'DE CADA PAÑO QUE NO CUADRA queda escrito qué se esperaba, qué se encontró, lo que anotes, y QUIÉN REPORTÓ aquella sacada, con su fecha. Y ahí mismo, con el ✏️, se va directo a corregirla molde por molde.' },
      { tipo: 'nuevo', texto: 'AVISO POR CORREO cuando una revisión no cuadra, encendido de fábrica: para enterarte aunque no estés ahí. La vuelta en que todo cuadra también se guarda —«se revisaron los 18 y cuadraron»— pero no manda correo.' },
      { tipo: 'mejora', texto: 'Todo empieza marcado en «como dice»: una vuelta en la que todo está bien no cuesta ni un toque. Es del gerente y del administrador; el operario no se revisa a sí mismo.' }
    ]
  },
  {
    numero: '6.6',
    nombre: 'Corregir el paño, molde por molde',
    fecha: '2026-09-05',
    resumen:
      'Un paño ya no se puede sacar dos veces el mismo día —eso era lo que '
      + 'inflaba el cuarto frío— y las correcciones se hacen molde por molde, '
      + 'en la sacada y la fecha que se elija del historial.',
    cambios: [
      { tipo: 'importante', texto: 'UN PAÑO NO SE SACA DOS VECES EL MISMO DÍA. El agua no se hace hielo en unas horas. Antes, desbloquear un paño ya sacado y capturarlo otra vez SUMABA otra vez sus marquetas, y el error aparecía dos o tres días después en el conteo, cuando ya le tocaba a otro. Ahora no se deja ni con el PIN del administrador, y en vez del error pregunta si vamos a corregir esa sacada.' },
      { tipo: 'importante', texto: 'CORREGIR MOLDE POR MOLDE, no el paño entero. Se entra por la 👁 Historia, se elige la sacada por su fecha y su hora, y sale el mapa de moldes de AQUEL día. Se toca solo lo que estuvo mal; lo que no se toca se queda igual.' },
      { tipo: 'nuevo', texto: '«🚫 ESTA CANASTA NO SE SACÓ». El caso del que reporta el paño completo y deja una canasta adentro para venderla otro día: esos moldes nunca salieron, dejan de contar como producidos de aquel día, y la canasta vuelve al tanque con su hielo y sin el rellenado que se le había apuntado. Si se quitan todos, la sacada queda anulada.' },
      { tipo: 'mejora', texto: 'ABAJO SE VE EN VIVO cuántas iban al cuarto frío y cuántas quedan, y cuántas no se sacaron. Se escribe el porqué y se guarda de un botón.' },
      { tipo: 'mejora', texto: 'TODO DEJA RASTRO, molde por molde: lo que decía, lo que dice, quién lo cambió y por qué. Sale en la misma pantalla de corregir, debajo.' },
      { tipo: 'mejora', texto: 'LA HISTORIA DEL PAÑO GUARDA LAS ÚLTIMAS TREINTA SACADAS, no seis: el error a veces aparece hasta que el paño da la vuelta completa, y hay que poder retroceder hasta esa fecha.' },
      { tipo: 'mejora', texto: 'Los cuadres de hielo de aquella fecha se vuelven a sacar solos, como en la v6.1: lo contado no se toca, lo que «debía haber» sí, y el corte enseña lo que decía al firmarse.' }
    ]
  },
  {
    numero: '6.5.1',
    nombre: 'Que no se pierda de vista',
    fecha: '2026-09-05',
    resumen:
      'Dos arreglos de los que pediste: el tanque se queda a la vista al '
      + 'desplazar, y la ficha del cliente deja de estar achocada y de '
      + 'parpadear.',
    cambios: [
      { tipo: 'arreglo', texto: 'EL TANQUE SE QUEDA A LA VISTA. Las pestañas de los tanques y el renglón del paño que toca se pegan debajo de la barra de arriba al desplazar. Con dieciocho paños, al bajar ya no se pierde en cuál tanque estabas; todo lo demás se desliza igual.' },
      { tipo: 'mejora', texto: 'LA FICHA DEL CLIENTE, EN DOS PESTAÑAS: «💳 Su cuenta» —lo que debe, los abonos y sus movimientos— y «✏️ Sus datos» —el formulario—. Arriba se quedan siempre su nombre, su teléfono y lo que debe.' },
      { tipo: 'arreglo', texto: 'SE ACABÓ EL PARPADEO. Los datos del cliente ya no se guardan al salir de cada campo: se rellenan de corrido y abajo, SIEMPRE A LA VISTA, está «Guardar los cambios», que se enciende en cuanto algo cambia. Y «Deshacer» lo deja como estaba.' },
      { tipo: 'mejora', texto: 'LOS DATOS EN DOS COLUMNAS, con la etiqueta arriba y el campo debajo: nombre y negocio, teléfono y horario, y la dirección y las referencias a lo ancho. La ubicación y su mapa en su propio renglón.' }
    ]
  },
  {
    numero: '6.5',
    nombre: 'Los estados del hielo, como son',
    fecha: '2026-09-05',
    resumen:
      'Ocho estados y ninguna pregunta de destino: o se vende, o se botó. '
      + 'Y las horas de congelación se cambian en configuración, que en mayo '
      + 'no son las de enero.',
    cambios: [
      { tipo: 'importante', texto: 'HUECA Y CÁSCARA SON LO MISMO, y son merma. Se juntaron en un solo estado: «hueca o cáscara», menos del 40%. Cuando sale así se botó, y no cuenta como existencia, vaya a donde vaya.' },
      { tipo: 'importante', texto: 'SE FUE LA PREGUNTA DEL DESTINO. Ya no hay que decir si el hielo se fue a los condensadores, al cuarto frío o a la basura. Era una pregunta de más de pie y con las manos mojadas, y de ella dependía si el conteo cuadraba. Ahora la regla es una: o es de las cuatro que se venden, o se botó.' },
      { tipo: 'nuevo', texto: 'DONDE DECÍA «NORMAL» AHORA SE PREGUNTA EL PORCENTAJE: del 80 al 90%, del 60 al 80%, o del 40 al 60%. Del 90 para arriba ya es 100% sellada. Las cuatro se venden igual; el porcentaje es lo que avisa que el frío se está corriendo.' },
      { tipo: 'mejora', texto: 'SE QUITARON «un poco hueca» y «se rompió». Lo que se rompe se anota como «Otro» y se escribe qué pasó, que es lo que de verdad sirve para darle de baja a esa marqueta.' },
      { tipo: 'nuevo', texto: 'CUÁNTO TARDA EN CONGELAR, EN CONFIGURACIÓN. Arriba de la lista de tanques, un solo número para toda la fábrica: en enero y febrero baja, en mayo sube de 48. De fábrica son 48 horas. Al guardarlo se les pone a todos los tanques.' },
      { tipo: 'mejora', texto: 'La merma del día ya es un número visible —«6 se botaron»— en el panel, en el corte y en Los números. Antes quedaba escondida detrás del destino.' },
      { tipo: 'importante', texto: 'LO QUE YA ESTABA CAPTURADO se traduce con tus propias definiciones: normal → 80 al 90%, un poco hueca → 60 al 80%, cáscara → hueca, y «se rompió» → otro con su nota.' }
    ]
  },
  {
    numero: '6.4',
    nombre: 'Los de siempre y los de una vez',
    fecha: '2026-09-05',
    resumen:
      'Dos pestañas nuevas en Clientes: ⭐ De siempre y 🕓 De una vez. '
      + 'Sale solo de los tickets, sin marcar nada a mano.',
    cambios: [
      { tipo: 'nuevo', texto: 'LOS DE SIEMPRE Y LOS DE UNA VEZ. Como pediste: los clientes de verdad frecuentes separados de los de una entrega. Es «de siempre» quien lleva 4 tickets o más en los últimos 30 días (uno por semana); los demás son de una vez. El número se configura.' },
      { tipo: 'mejora', texto: 'CADA RENGLÓN DICE SU RITMO: «3 tickets en 30 días · último hace 2 d», y el de siempre lleva su ⭐. En la ficha sale igual. El que deja de comprar se mueve solo a «de una vez» con los días: es lo que avisa que algo pasó con él.' },
      { tipo: 'mejora', texto: 'Al armar una salida, la lista de pedidos cabe con quién se la lleva y los botones a la vista, sin desplazar de más.' }
    ]
  },
  {
    numero: '6.3',
    nombre: 'Los pedidos, a su camioneta',
    fecha: '2026-09-05',
    resumen:
      'Asignar los pedidos a un repartidor y un vehículo desde un solo '
      + 'cuadro: quién está libre, qué le cabe, y las paradas en orden de '
      + 'cercanía, con su mapa.',
    cambios: [
      { tipo: 'importante', texto: 'ARMAR LA SALIDA DE UN JALÓN. Desde Los pedidos («Armar una salida con estos pedidos») o desde El reparto («+ Salida») sale un cuadro con todo: los pedidos que esperan camioneta con casilla, quién se la lleva, en qué, y la cuenta en vivo de cuánto hielo sube contra lo que cabe.' },
      { tipo: 'nuevo', texto: 'QUIÉN ESTÁ LIBRE. Cada repartidor dice si está libre o en qué salida anda (cargando, en la calle, por cuadrar), y el ocupado sale apagado. Cada vehículo dice lo que le cabe y si ya lo tiene otra salida. Lo de "no vino" el sistema no lo sabe: se elige a quien sí está.' },
      { tipo: 'nuevo', texto: 'LAS PARADAS EN ORDEN. El sistema sugiere el orden de visita por cercanía —del más cercano en adelante, saliendo de la fábrica— y se mueve con ▲▼. Los pedidos sin ubicación van al final. La hoja de carga lleva el número de parada delante de cada pedido.' },
      { tipo: 'nuevo', texto: 'LA RUTA EN EL MAPA. En la ficha de la salida, una chincheta por parada con su número y la fábrica marcada. Es el mapa de siempre, el de las neveras.' },
      { tipo: 'mejora', texto: 'Si no cabe, avisa ANTES de crear nada, y se puede forzar cuando se sabe que van a ser dos viajes. Cada tarjeta en Los pedidos dice en qué salida va y qué parada es; las que no tienen camioneta lo dicen y llevan su botón 🚚 Subir.' }
    ]
  },
  {
    numero: '6.2',
    nombre: 'El precio especial de una vez',
    fecha: '2026-09-05',
    resumen:
      '"Vendí 20 bolsas a $12 en vez de $20": se toca el importe del renglón, '
      + 'se pone el precio y se dice por qué. Queda en el ticket con lo de '
      + 'lista y quién lo autorizó.',
    cambios: [
      { tipo: 'nuevo', texto: 'EL PRECIO ESPECIAL EN EL RENGLÓN. En Vender se toca el importe de cualquier renglón y se teclea el precio por pieza (en el hielo suelto, el total). Pide el porqué. El renglón queda con lo de lista tachado al lado.' },
      { tipo: 'nuevo', texto: 'EL TICKET LO DICE: «precio especial ($12 c/u), de lista $400». Y en el historial cada renglón guarda lo que decía la lista ese día, el motivo y quién lo autorizó. Sin eso, al mes nadie sabe si $12 era un descuento o el precio de entonces.' },
      { tipo: 'importante', texto: 'QUIÉN PUEDE: el gerente y el administrador lo ponen y ya. El cajero también lo puede poner, pero al cobrar se le pide el PIN de un responsable, igual que el crédito por encima del límite. Permiso nuevo: «Poner un precio especial de una vez».' },
      { tipo: 'mejora', texto: 'Para volver al precio de lista se toca el importe y se deja en blanco. Si cambia la cantidad de hielo, su precio especial se quita solo: era por esa cantidad.' }
    ]
  },
  {
    numero: '6.1',
    nombre: 'El administrador corrige lo que sea',
    fecha: '2026-09-05',
    resumen:
      'Lo que pediste después de tu prueba real: la venta que faltó en un '
      + 'corte cerrado se cobra al corte, y la sacada mal marcada se corrige '
      + 'aunque el corte ya esté firmado. Todo deja rastro y el corte se '
      + 'vuelve a sacar solo.',
    cambios: [
      { tipo: 'importante', texto: 'LA VENTA QUE FALTÓ EN UN CORTE CERRADO. En Historial de cortes, ⋯ Corregir, hay un botón nuevo: «Cobrar la venta que faltó». Lleva a Vender con ese corte en la mano; se captura como cualquier ticket —mayoreo, cliente, bolsas— y queda amarrado a ESE turno, con la fecha de ese turno. El corte se vuelve a sacar solo; si llevaba hielo, el cuadre del hielo también.' },
      { tipo: 'importante', texto: 'CORREGIR CÓMO SALIÓ UNA SACADA, aunque el corte ya esté firmado. En la 👁 Historia del paño cada sacada tiene un ✏️: se dice cómo salió de verdad (la hueca que era ahogada) y por qué. Se cambia el estado de todos sus moldes, y los cuadres de hielo que ya la contaban se vuelven a sacar solos.' },
      { tipo: 'mejora', texto: 'EL CORTE ENSEÑA LAS DOS CIFRAS. Lo contado nunca se toca —eso fue lo que había—; lo que «debía haber» sí. Lo que decía el papel cuando se firmó se guarda una sola vez, y en el corte sale un aviso: quién corrigió, cuándo, por qué y cuánto faltaba antes.' },
      { tipo: 'mejora', texto: 'TODO DEJA RASTRO. La venta lleva la marca de que entró después del corte y su porqué; la sacada dice quién la corrigió, cuándo y por qué; la bitácora guarda la mezcla de antes y la de después.' },
      { tipo: 'mejora', texto: 'Quién puede: cobrar al corte cerrado es solo del administrador; corregir cómo salió una sacada es del gerente y del administrador, el mismo permiso que anular.' }
    ]
  },
  {
    numero: '6.0',
    nombre: 'La hueca es merma',
    fecha: '2026-09-05',
    resumen:
      'Lo que cuenta como existencia son la sellada, la normal y la un poco '
      + 'hueca. Hueca, cáscara, salada o contaminada y aguada son merma: no '
      + 'entran al cuarto frío, salvo que se guarden a propósito.',
    cambios: [
      { tipo: 'importante', texto: 'LA HUECA YA NO CUENTA COMO EXISTENCIA. Como dijiste: "la hueca y la cáscara no se cuentan, son mermas". Antes un paño hueco entraba al cuarto frío como si fuera normal, y el conteo salía corto. Ahora al marcar hueca el sistema pregunta a dónde fue —igual que con la cáscara— y por omisión va a los condensadores.' },
      { tipo: 'mejora', texto: 'SI UN DÍA SE GUARDA HUECA PARA VENDERLA, se dice «al cuarto frío» y entonces sí entra a la existencia. La regla es la misma para todo lo que no sea sellada, normal o un poco hueca.' },
      { tipo: 'mejora', texto: 'LA AGUADA SE LLAMA TAMBIÉN AHOGADA, que es como se dice en la planta. Sigue sin contar para nada: ni existencia, ni costo, ni se resta de ninguna parte.' },
      { tipo: 'mejora', texto: 'El manual dice en corto qué cuenta y qué no, en la sección de producción.' },
      { tipo: 'importante', texto: 'LO DE ANTES NO SE TOCA: las huecas que ya estaban anotadas siguen contadas como estaban ese día. El cambio aplica a lo que se saque de hoy en adelante.' }
    ]
  },
  {
    numero: '5.9',
    nombre: 'Las neveras en el mapa',
    fecha: '2026-09-05',
    resumen:
      'La lista de neveras a la izquierda y el mapa a la derecha, como lo '
      + 'pediste: cada renglón con su 📍 para señalarla en el mapa y su ✏️ '
      + 'para cambiarle los datos.',
    cambios: [
      { tipo: 'nuevo', texto: 'LA PANTALLA EN DOS COLUMNAS: la lista con los datos de cada nevera a la izquierda, y a la derecha el mapa de OpenStreetMap con una chincheta por nevera, con su número. El mapa se queda quieto mientras la lista corre. En pantalla angosta se apila, mapa arriba.' },
      { tipo: 'nuevo', texto: 'EL BOTÓN 📍 DE CADA RENGLÓN señala esa nevera en el mapa: se centra en ella y su chincheta sale más grande. Si no tiene ubicación, lleva un ? y al tocarlo abre el mapa para ponérsela ahí mismo.' },
      { tipo: 'nuevo', texto: 'EL BOTÓN ✏️ DE CADA RENGLÓN cambia sus datos sin entrar a la ficha: dirección, quién responde, teléfono y ubicación.' },
      { tipo: 'mejora', texto: 'LAS CHINCHETAS POR ESTADO: verde prestada y al día, ámbar lleva días sin pedir, rojo por reparar o con falla, morado no se sabe dónde está, azul la usa la fábrica. Con su leyenda abajo del mapa.' },
      { tipo: 'mejora', texto: 'El renglón dice en una línea lo que importa: cómo va (le falta o a favor) y cuándo pidió por última vez. Lo demás sigue en la ficha.' }
    ]
  },
  {
    numero: '5.8.1',
    nombre: 'Los QR ya se leen',
    fecha: '2026-09-05',
    resumen:
      'Los códigos QR de las notas no los reconocía ningún celular: estaba '
      + 'al revés un pedazo del dibujo. Ya se leen. Y tres cosas más de tu '
      + 'revisión.',
    cambios: [
      { tipo: 'arreglo', texto: 'LOS QR NO SE ESCANEABAN. El código llevaba invertida la franja que le dice al celular con qué máscara se dibujó: el celular la leía, no le cuadraba, y se rendía. Se comparó el dibujo, punto por punto, con un codificador de fuera hasta salir idéntico. Ahora cualquier celular lo lee a la primera.' },
      { tipo: 'arreglo', texto: 'EL PEDIDO QUE PASAN A BUSCAR YA IMPRIME SU PAPEL: el «apartado», para la mano del cliente, con lo que apartó, para cuándo y «SE PAGA AL RECOGER» en grande. Antes no salía nada porque la nota de entrega es del repartidor, y ese pedido no sube a ninguna camioneta. En Los pedidos también se puede ver e imprimir.' },
      { tipo: 'mejora', texto: 'La nota de entrega dice ahora PARA QUÉ DÍA es el pedido, arriba del todo.' },
      { tipo: 'mejora', texto: 'EL BOTÓN 🚚 DE VENDER EXPLICA PARA QUÉ ES cuando no hay nadie: es donde se le recibe el dinero al repartidor que vuelve de una salida. Las salidas se arman en Reparto; cuando una marca que ya regresó, aparece aquí con lo que debe entregar.' },
      { tipo: 'mejora', texto: 'LA UBICACIÓN DE UNA NEVERA SE PONE TOCANDO EL MAPA, igual que la de un cliente. Se busca la tienda, se toca, y listo. Pegar el enlace de Google Maps sigue sirviendo.' }
    ]
  },
  {
    numero: '5.8',
    nombre: 'El pedido, desde cobrar',
    fecha: '2026-09-05',
    resumen:
      'Cualquier ticket se vuelve pedido desde F10 —a domicilio o para que '
      + 'pasen por él—, se da de alta al cliente ahí mismo, y el que vienen '
      + 'a buscar se cobra en la caja con lo que se le prometió.',
    cambios: [
      { tipo: 'importante', texto: 'EL PEDIDO SE TOMA DESDE COBRAR, como lo pediste: se arma el ticket como siempre, F10, y ahí junto a cobrar hay dos botones: «🚚 Pedido a domicilio» y «🏪 Lo pasan a buscar». El botón suelto de «Apartar como pedido» ya no existe, y la columna del ticket vuelve a su tamaño.' },
      { tipo: 'nuevo', texto: 'DOS CLASES DE PEDIDO. El de domicilio sale en la camioneta con su nota y su QR. El que vienen a buscar se queda aquí, sale en «para preparar» igual —hay que llenar los garrafones de todos modos—, pero no sube a la camioneta ni lleva nota de entrega.' },
      { tipo: 'nuevo', texto: 'PREGUNTA DE QUIÉN ES, Y SI NO ESTÁ, SE DA DE ALTA AHÍ MISMO: nombre, teléfono y dirección, desde la caja, sin salir a buscar al gerente. Lo que la caja NO puede ponerle es el límite de crédito ni la lista de mayoreo: eso sigue siendo de Clientes.' },
      { tipo: 'nuevo', texto: 'PARA CUÁNDO: hoy, mañana, u otro día con su fecha. Y cómo va a pagar, solo si es a domicilio —el que viene a buscarlo paga aquí cuando venga—.' },
      { tipo: 'nuevo', texto: 'COBRAR EL QUE VIENEN A BUSCAR: el botón 🛍️ de arriba en Vender, con su numerito. Se elige el pedido y se carga en el ticket con los precios que se le prometieron; de ahí es una venta como cualquiera: F10, con cuánto paga, el cambio, o a crédito. Al cobrarlo queda entregado.' },
      { tipo: 'importante', texto: 'Y AHÍ EL CRÉDITO SE REVISA DE VERDAD. Un pedido cobrado en el mostrador es una venta de mostrador: la mercancía sigue de este lado, y pasarse del límite se frena y pide autorización igual que en cualquier ticket. Es distinto del reparto, donde ya se entregó y solo se avisa.' },
      { tipo: 'mejora', texto: 'Lo que pidió no se edita en el ticket: si quiere algo más, se cobra aparte. Cambiar lo apuntado después de haberle dicho un precio es la forma de que salga una cosa y se cobre otra.' },
      { tipo: 'mejora', texto: 'En Los pedidos cada tarjeta dice si es 🚚 a domicilio o 🏪 lo recogen, y el botón de imprimir es ahora «las notas de entrega»: solo las de domicilio.' }
    ]
  },
  {
    numero: '5.7.1',
    nombre: 'Lo que salió en la revisión',
    fecha: '2026-09-05',
    resumen:
      'La barra de abajo en un renglón, la contraseña sin dedazos, Esc que '
      + 'vuelve en todas partes, un solo botón para lo que sale del cajón, y la '
      + 'ubicación del cliente pegando el enlace del celular o tocando el mapa.',
    cambios: [
      { tipo: 'arreglo', texto: 'LA BARRA DE ABAJO DE VENDER, EN UN SOLO RENGLÓN. Se partía en dos cuando no cabía. Ya no repite F2, F3, F4, F6 ni F10 —cada una está escrita en su botón— y solo dice lo que no se ve en ningún lado: qué hacen Enter y Esc en ese momento. Y ya no se envuelve: si algo no cabe se recorta, empezando por el nombre del negocio.' },
      { tipo: 'arreglo', texto: 'LA CONTRASEÑA Y EL PIN SE ESCRIBEN DOS VECES, TAPADOS. Se pedían con el cuadro pelón del navegador: en texto visible, una sola vez y sin avisar de nada. Un dedazo se guardaba tal cual y después «no me detecta la contraseña» — porque la guardada no era la que se creía haber escrito. Ahora van con puntitos, dos veces, y solo se aceptan si las dos coinciden.' },
      { tipo: 'arreglo', texto: 'ESC VUELVE ATRÁS EN TODAS LAS PANTALLAS. Cerraba los diálogos y funcionaba en Vender, pero en las fichas —un tanque, una salida, un corte— no hacía nada aunque tuvieran su botón de «‹ Volver». Ahora ese botón también escucha la tecla. Y dos ventanas del reparto que se habían armado aparte tampoco cerraban con Esc: ya sí.' },
      { tipo: 'mejora', texto: 'UN SOLO BOTÓN PARA LO QUE SALE DEL CAJÓN. «Gasto» y «Vale» enseñaban las mismas opciones —el retiro a la caja fuerte y el vale de sueldo salían en las dos listas— y eran un botón de más en una columna que ya iba alta. Ahora es «− Sale dinero»: los vales son dos renglones de esa misma lista, con su papel firmado como siempre.' },
      { tipo: 'arreglo', texto: 'EL ENLACE DE GOOGLE MAPS YA SE ACEPTA, EL CORTO Y EL LARGO. El que da «Compartir» en el celular es corto (maps.app.goo.gl) y no trae las coordenadas adentro; están en el largo al que ese manda. Seguirlo no lo puede hacer la pantalla, pero el servidor sí: lo sigue y saca las coordenadas de ahí. Solo sigue enlaces de Google, a propósito.' },
      { tipo: 'nuevo', texto: 'Y LA UBICACIÓN TAMBIÉN SE PONE TOCANDO EL MAPA. El mismo mapa de las neveras, con una chincheta que va a donde se toque. Arranca donde ya estaba el cliente, o en Hunucmá. Con esto la nota de entrega ya sale con su QR, que era lo que faltaba.' },
      { tipo: 'mejora', texto: '«QUÉ LE COMPRA» YA NO SE MARCA A MANO. Eran tres botones que nadie entendía y que solo decidían en qué pestaña de Clientes sale cada quien. Ahora se marcan solos con cada venta y cada pedido: el que se lleva un garrafón es cliente del agua desde ese momento. La ficha solo lo enseña, para que se entienda por qué está donde está.' },
      { tipo: 'mejora', texto: 'Dar de baja a alguien pregunta con el cuadro del sistema, no con el del navegador.' }
    ]
  },
  {
    numero: '5.7',
    nombre: 'La salida y la liquidación',
    fecha: '2026-09-04',
    resumen:
      'La camioneta sale con lo que le toca, y al volver se cuadra: qué '
      + 'llegó, qué se derritió y cuánto dinero trae. La cajera lo recibe '
      + 'sin salirse de vender.',
    cambios: [
      { tipo: 'nuevo', texto: 'LA SALIDA: se elige quién se la lleva y en qué, se le cuelgan los pedidos del día con casillas —todos de un botón, no de uno en uno— y se le sube lo suelto para vender en la calle. Sale su hoja de carga impresa, sin precios: en el patio, con el camión abierto, un renglón de dinero estorba.' },
      { tipo: 'nuevo', texto: 'AVISA CUANDO NO LE CABE. A cada vehículo se le pone cuántas marquetas le caben, y si la carga se pasa lo dice antes de salir. Sobrecargar la camioneta es la forma más común de que el hielo llegue derretido.' },
      { tipo: 'importante', texto: 'AL VOLVER, EL CUADRE. Se marca qué pedido llegó a su puerta —y cómo pagó de verdad, que en la puerta el cliente cambia de opinión— y qué volvió sin entregar, con su motivo. El que vuelve queda PENDIENTE otra vez y aparece en el reparto de mañana: no se pierde porque el camión ya llegó.' },
      { tipo: 'importante', texto: 'LA MERMA SE CALCULA, NO SE TECLEA. Se cuenta lo que se puede contar con las manos —cuánto volvió y cuánto se vendió— y lo que se derritió sale solo de la resta. Teclearla sería pedirle a alguien que confiese, y lo que se confiesa se redondea. El hielo derretido se carga al cuarto frío como merma, una sola vez.' },
      { tipo: 'nuevo', texto: 'Y AVISA SI SE DERRITIÓ DE MÁS: se pone qué porcentaje es normal en un viaje (8% de entrada) y por encima de eso llega un correo. Suele ser una lona rota, una hielera que ya no cierra, o una ruta que se está haciendo muy larga para el calor que hace.' },
      { tipo: 'nuevo', texto: 'EL DINERO SE RECIBE EN VENDER, con el botón 🚚 y su numerito: es donde está quien lo va a contar, y no se va a salir de su pantalla con gente enfrente. Sale cuánto debía traer, se teclea lo que entregó y se apunta. Con dos camionetas esperando, se elige de cuál es el dinero.' },
      { tipo: 'importante', texto: 'LA CAJERA RECIBE; NO CIERRA. Si el dinero no cuadra se apunta igual —ya está en su mano—, sale el correo al momento y la salida queda ABIERTA. Cerrarla con su motivo es del gerente o del dueño: eso ya no es contar billetes, es decidir quién se come la diferencia, y esa decisión tiene dueño.' },
      { tipo: 'importante', texto: 'Y EL REPARTIDOR NO SE CUADRA A SÍ MISMO. Ve su salida —es su hoja de trabajo— y puede marcar lo que entregó, pero no arma cargas ni se recibe su propio dinero. La persona a la que se le cuadra no puede ser la que cuadra.' },
      { tipo: 'importante', texto: 'EL DINERO NO SE CUENTA DOS VECES, y era lo más fácil de hacer al revés. Cada pedido entregado en efectivo ya crea su venta, y una venta en efectivo ya cuenta en el arqueo del turno; apuntar además una entrada al cajón por lo que trae el repartidor haría que la caja sobrara todos los días. Y si falta, el turno sale corto — así tiene que ser: el hueco es real, y taparlo lo escondería del único papel donde se busca.' },
      { tipo: 'nuevo', texto: 'SOLO SE LE PIDE EL EFECTIVO. Lo que se fue a crédito o por transferencia no viene en su bolsa, y sale escrito aparte en su papel para que nadie se lo cobre.' },
      { tipo: 'nuevo', texto: 'LA LIQUIDACIÓN IMPRESA, que firma el repartidor: qué llevaba, qué llegó, qué se derritió y la cuenta del dinero con el resultado en grande. Sale sola al recibirle.' },
      { tipo: 'nuevo', texto: 'LOS VEHÍCULOS se dan de alta una vez y se usan años, como los tanques. Nada se borra: uno de baja se queda con todos sus viajes.' },
      { tipo: 'mejora', texto: 'Y una venta que salió del reparto queda marcada con su salida. Sin eso, en el historial el ticket de un pedido repartido y el de una venta de mostrador se ven iguales, y «cuánto vendió el reparto este mes» no se puede contestar.' }
    ]
  },
  {
    numero: '5.6',
    nombre: 'Los pedidos',
    fecha: '2026-09-04',
    resumen:
      'Se aparta un pedido en vez de cobrarlo, se ve todo junto lo que hay '
      + 'que preparar, y cada cliente se lleva su nota de entrega con un QR '
      + 'que abre su ubicación en el mapa.',
    cambios: [
      { tipo: 'importante', texto: 'ANTES, PARA ANOTAR UN PEDIDO HABÍA QUE COBRARLO. «Tengo que literalmente hacerlo desde la caja y asignarle un cliente.» Eso dejaba dos mentiras escritas: una venta cobrada de hielo que seguía en el cuarto frío, y un cliente al que no se le había entregado nada. Y si el pedido después no salía, había que cancelar un ticket ya cobrado.' },
      { tipo: 'nuevo', texto: 'AHORA SE APARTA. Se arma el ticket como siempre —los mismos botones, los mismos precios, el mismo teclado de fracciones—, se elige al cliente y se toca «📦 Apartar como pedido». No se cobra: un pedido es una promesa, y la venta nace cuando se entrega.' },
      { tipo: 'nuevo', texto: 'UN SOLO BOTÓN PARA AGUA Y PARA HIELO. Un pedido es UNA llamada de UN cliente —«diez garrafones y cincuenta bolsas»— y partirlo en dos al capturarlo haría que el repartidor llegara con dos notas a la misma puerta. Lo que se parte es la PREPARACIÓN, que sí son dos áreas con dos personas.' },
      { tipo: 'nuevo', texto: 'LA PANTALLA «PARA PREPARAR»: todo sumado por producto y partido en Agua y Hielo. Es lo que se lee en la planta con las manos mojadas —«40 garrafones, 180 bolsas»— y ahí a nadie le importa de quién es cada cosa. Con su hoja impresa para llevarla.' },
      { tipo: 'nuevo', texto: 'LA NOTA DE ENTREGA, una por cliente, con las tres respuestas en el orden en que se preguntan bajando de la camioneta: a dónde, qué llevo y qué cobro. Con el horario de la tienda arriba, las referencias de la puerta, y en grande si se cobra o va a su cuenta.' },
      { tipo: 'nuevo', texto: 'Y SU CÓDIGO QR: se escanea con el teléfono y abre la ubicación del cliente en Google Maps. Sin teclear una dirección mientras se maneja, que es la parte peligrosa.' },
      { tipo: 'importante', texto: 'EL QR SE DIBUJA AQUÍ DENTRO, sin internet y sin librerías de fuera. El día que se caiga la conexión —y se cae— las notas siguen saliendo igual. Y si el cliente no tiene ubicación guardada, la nota sale SIN QR: un código que lleva a la coordenada cero manda al golfo de Guinea, y un repartidor que aprende que el QR miente deja de usarlo para siempre.' },
      { tipo: 'importante', texto: 'EL PRECIO SE COPIA AL TOMAR EL PEDIDO, no al entregarlo. Si el lunes suben los precios y el pedido se tomó el sábado, lo que se cobra es lo que dice el papel que el repartidor lleva en la mano. Discutir el precio en la puerta del cliente es perder el cliente.' },
      { tipo: 'importante', texto: 'Y LA DIRECCIÓN TAMBIÉN. Si el cliente se muda, la nota de un pedido de hace tres meses sigue diciendo a dónde se llevó — si no, nadie podría explicar por qué el repartidor fue a donde fue.' },
      { tipo: 'nuevo', texto: 'LO ATRASADO NO SE ESCONDE. Un pedido de ayer que no salió sigue apareciendo, marcado. Ocultarlo porque cambió el día es la forma más fácil de perder un cliente. Y lo de mañana NO sale en la preparación de hoy: sería hielo derritiéndose en la camioneta.' },
      { tipo: 'nuevo', texto: 'AL MARCARLO ENTREGADO NACE SU VENTA, con las líneas del pedido tal cual, y sale su ticket. Ahí se pregunta cómo pagó de verdad —en la puerta el cliente cambia de opinión— y ahí es cuando entra al corte y sale el hielo del cuarto frío.' },
      { tipo: 'nuevo', texto: 'CANCELAR UN PEDIDO ES CANCELAR UNA PROMESA, con su motivo, no un ticket cobrado — que es una cosa mucho más fea de explicar. Y no se borra: queda para poder contestar «¿y el de la tiendita, qué pasó?» tres semanas después.' },
      { tipo: 'mejora', texto: 'EL REPARTIDOR VE Y ENTREGA, pero no toma pedidos: uno nace de una llamada al mostrador. La cajera y el gerente toman, entregan y cancelan.' }
    ]
  },
  {
    numero: '5.5',
    nombre: 'Cobrar la deuda desde la caja',
    fecha: '2026-09-04',
    resumen:
      'La cajera recibe un abono sin salirse de vender, ve cuánto debe cada '
      + 'cliente, y el que paga se va con su recibo en la mano.',
    cambios: [
      { tipo: 'nuevo', texto: 'ABONAR AL CRÉDITO SIN SALIRSE DE VENDER. Se elige al cliente con F6 sin nada en el ticket, y el botón grande deja de decir «Cobrar» para decir «Abonar a su cuenta». Es el mismo gesto de siempre —F10— y no hay un botón más que aprender.' },
      { tipo: 'importante', texto: 'ANTES ERAN TRES PANTALLAS PARA RECIBIR UN BILLETE: terminar lo que estabas haciendo, irte a Clientes, buscarlo otra vez y apuntárselo ahí. Con gente en el mostrador eso no se hace — se apunta «al rato», y al rato ya nadie se acuerda de cuánto era.' },
      { tipo: 'nuevo', texto: 'Y AHORA SE VE CUÁNTO DEBE JUNTO A SU NOMBRE, en el renglón del ticket. Es lo primero que se pregunta cuando llega alguien de crédito, y hasta hoy había que salirse a buscarlo.' },
      { tipo: 'nuevo', texto: 'EL PANEL: cuánto debe en grande, cuánto está dejando —con un botón de «Todo», que es lo más común—, y la cuenta rehaciéndose sola: debe − deja = le queda. Con su botón aparte para cuando fue por transferencia, que no entra al cajón.' },
      { tipo: 'importante', texto: 'SI NO DEBE NADA, LO DICE Y NO DEJA ABONARLE. Cobrarle un abono a quien está al corriente le deja un saldo a favor que nadie pidió, y encontrarlo tres meses después cuesta más que el minuto que se ahorró.' },
      { tipo: 'nuevo', texto: 'EL RECIBO DE ABONO, IMPRESO, y sale solo al recibir. Hasta hoy el cliente entregaba dinero y se iba con las manos vacías. Lleva los tres números que se discuten cuando una cuenta no cuadra: debía − abonó = le queda, con el abono en grande y la línea para firmar.' },
      { tipo: 'importante', texto: 'Y EL RECIBO DICE LO QUE DECÍA EL DÍA QUE SE IMPRIMIÓ, no lo que debe hoy. Si se reimprime la semana que viene después de otros dos abonos, sigue diciendo lo mismo — si no, el papel que tiene el cliente en la mano y el sistema se contradirían, y el que pierde siempre es quien tiene el papel.' },
      { tipo: 'nuevo', texto: 'Si pagó de más, el recibo lo dice: A SU FAVOR. Ese es dinero suyo que se quedó en la fábrica, y tiene que estar escrito en algún lado.' },
      { tipo: 'mejora', texto: 'Por debajo no hay nada nuevo: se llama al mismo apunte de abono de siempre, el que ya mete el dinero al cajón y hace que el corte cuadre. Lo único que cambió es que ahora se llega desde la caja.' }
    ]
  },
  {
    numero: '5.4',
    nombre: 'Los clientes, por lo que compran',
    fecha: '2026-09-04',
    resumen:
      'Tres pestañas en Clientes —marquetas, bolsas y agua— más el horario '
      + 'y la ubicación de cada quien. Es lo que hace falta debajo para que '
      + 'los pedidos y el reparto funcionen.',
    cambios: [
      { tipo: 'nuevo', texto: 'CUATRO PESTAÑAS EN CLIENTES: Todos, 🧊 Marquetas, 🧊 Bolsas y 💧 Agua, cada una con su cuenta. Lo que decide en cuál sale es «Qué le compra», tres botones en su ficha que se prenden y se apagan.' },
      { tipo: 'importante', texto: 'PERO ES UN FILTRO, NO TRES LISTAS, y esta es la decisión que más habría costado al revés. Abarrotes Juan compra bolsas Y agua: si fueran dos fichas tendría DOS DEUDAS, dos límites de crédito y dos historiales — y el día que llegara con $500 en la mano nadie sabría a cuál van. Para cuando se descubriera serían meses de historias separadas que ya no se pueden juntar. El cliente es uno; lo que se guarda es una etiqueta.' },
      { tipo: 'nuevo', texto: 'Y EL QUE COMPRA LAS TRES SALE EN LAS TRES. No es un descuido: cuando se prepare el agua hay que verlo, y cuando se preparen las bolsas también.' },
      { tipo: 'mejora', texto: 'AL ACTUALIZAR, CADA CLIENTE QUEDÓ MARCADO SOLO, por lo que ya te compró — sacado de sus tickets y de las neveras que tiene prestadas. Nadie va a etiquetar doscientos clientes a mano, y si hubiera que hacerlo las pestañas saldrían vacías el primer día y no las usaría nadie. Lo que quede mal se corrige en su ficha de un toque.' },
      { tipo: 'nuevo', texto: 'EL HORARIO DE ENTREGA, como lo dirías: «de 8 a 2 y de 5 a 8». Tú lo dijiste y es de lo más importante que hay para el reparto: una ruta corta que llega a las dos a una tienda que cierra a la una no es corta, es un viaje perdido y hay que volver. El día que la ruta se ordene sola, esto va a mandar antes que la distancia.' },
      { tipo: 'nuevo', texto: 'LAS REFERENCIAS Y LA UBICACIÓN. «La de la puerta azul, junto a la tortillería» — la dirección lleva al rumbo, esto hace que se encuentre la puerta. Y la ubicación se pone pegando el enlace de Google Maps, igual que en las neveras: es la que va a llevar el QR de la nota de entrega.' },
      { tipo: 'arreglo', texto: 'EL BOTÓN DE ENCOMENDAR HIELO YA NO ES EL MISMO CUBO QUE EL AVISO DE HIELO BAJO. Estaban a dos dedos uno del otro en la misma barra de la caja, los dos con 🧊. El cubo se queda con el AVISO, que es el que habla del hielo; encomendar es apartar hielo para alguien, y eso ahora es 📦.' },
      { tipo: 'arreglo', texto: 'De paso, un tropiezo que ya había pasado tres veces en el proyecto: una constante declarada dentro de la pantalla y usada al pintarla dejaba Clientes en blanco con un mensaje en inglés. Ahora vive fuera, donde no puede pasar.' }
    ]
  },
  {
    numero: '5.3',
    nombre: 'Paga una parte y debe la otra',
    fecha: '2026-09-04',
    resumen:
      'Cobrar a medias sin salirse de la caja: el cliente deja lo que trae '
      + 'y el resto se le queda a deber, en un solo gesto.',
    cambios: [
      { tipo: 'nuevo', texto: 'YA SE PUEDE COBRAR A MEDIAS. En la pantalla de crédito hay un campo «¿Deja algo ahorita?». Se lleva $480, deja $300, queda debiendo $180 — y todo en el mismo momento, sin terminar la venta e ir hasta Clientes a ponerle un abono.' },
      { tipo: 'mejora', texto: 'LA CUENTA SE REHACE SOLA mientras se teclea: «Debía $0 + Este ticket $480 − Deja ahorita $300 = Va a deber $180». Y el botón dice exactamente lo que va a pasar: «Cobrar $300 y dejar $180 a crédito».' },
      { tipo: 'importante', texto: 'SE GUARDA COMO DOS COSAS, QUE ES LO QUE PASÓ: el ticket entero a su cuenta, y su abono. En el estado de cuenta se ve que se llevó $480 y entregó $300. Si se guardara como «una venta de $180», dentro de tres meses nadie sabría que se llevó dos marquetas completas — y el día que ese ticket se cancele, la cuenta no se corregiría sola.' },
      { tipo: 'importante', texto: 'EL TICKET LO DICE: «PAGÓ AHORA $300 · QUEDA A DEBER $180», arriba de la línea para firmar. Es la mitad del sentido de ese papel: el cliente se lleva su copia y los dos saben lo mismo. Y lo va a seguir diciendo dentro de tres años, porque el abono queda amarrado a SU ticket.' },
      { tipo: 'nuevo', texto: 'Y SI SE ANULA ESE ABONO —porque el billete era falso—, el ticket vuelve a decir que debe todo. El importe no se guarda: se saca de los abonos vivos, así que la verdad de hoy es la que sale impresa hoy.' },
      { tipo: 'mejora', texto: 'EL LÍMITE SE MIDE CONTRA LO QUE SE LE QUEDA A DEBER, no contra el ticket. A un cliente pegado a su límite que paga casi todo ya no se le para la venta ni hay que llamar al gerente por lo poco que queda.' },
      { tipo: 'importante', texto: 'EL DINERO ENTRA AL CAJÓN por el mismo camino que la cobranza de siempre, así que el corte cuadra sin tocar nada. Y la venta y el abono se guardan JUNTOS: si uno fallara, no se guarda ninguno — nunca puede quedar dinero cobrado sin venta que lo explique, ni un cliente debiendo algo que ya entregó.' },
      { tipo: 'nuevo', texto: 'No se puede dejar más de lo que se lleva, y si lo paga todo el sistema lo dice: eso no es crédito, es una venta normal. Para abonar a lo que debía de antes sigue estando su ficha en Clientes, donde además se ve contra qué se aplica.' }
    ]
  },
  {
    numero: '5.2.2',
    nombre: 'El ticket de mayoreo y la palabra crédito',
    fecha: '2026-09-04',
    resumen:
      'El ticket de mayoreo como lo dibujaste, y «fiado» fuera de todos '
      + 'lados: ahora dice crédito, que es lo que es.',
    cambios: [
      { tipo: 'arreglo', texto: 'FUERA EL RENGLÓN DE «PRECIO DE MAYOREO» DEBAJO DEL TOTAL. Y en su lugar, el precio por marqueta va donde se busca: pegado a lo que se llevó. «2 · 1/2   x $240 ......... $600». Es lo que explica por qué la marqueta salió a $240 y no a $264, y ahí sí lo lee alguien.' },
      { tipo: 'arreglo', texto: 'FUERA EL PARÉNTESIS «(2x1 + 1/2)». Decía de qué pedazos salió la cuenta, y en el mostrador nadie lo miraba: lo que el cliente comprueba es cuánto se llevó y cuánto costó, y eso ya está arriba en grande.' },
      { tipo: 'arreglo', texto: 'FUERA «HIELO LOLHA» DEL TICKET DE VENTA. El papel sale de la fábrica; a nadie hay que recordarle dónde acaba de comprar hielo. Los papeles que sí viajan solos —el corte, el vale de sueldo, la cotización, el comodato— lo siguen llevando, porque ésos sí hay que saber de quién son. Y si tienes puesto un renglón de pie («Gracias por su compra»), ése sí se imprime: lo pusiste tú.' },
      { tipo: 'mejora', texto: 'Y EL RENGLÓN AHORA SEPARA LA MARQUETA DEL PEDAZO: «2 · 1/2» en vez de «2 1/2», que se leían como un número raro.' },
      { tipo: 'importante', texto: 'LA PALABRA «FIADO» SALIÓ DE TODAS PARTES. Ahora dice A CRÉDITO. En el botón de la caja («🧾 Dejarlo a crédito»), en el sello del ticket («A CRÉDITO»), en el corte del turno, en la ficha del cliente, en el historial, en los números y en todo el manual. Suena a lo que es —una cuenta— y no a un apunte en una libreta.' },
      { tipo: 'nuevo', texto: 'De paso el vocabulario quedó parejo: LA DEUDA es lo que debe, EL CRÉDITO DISPONIBLE es lo que todavía se le puede dar, y EL LÍMITE DE CRÉDITO es hasta dónde. Tres palabras distintas para tres números distintos, en vez de «fiado» para todo.' }
    ]
  },
  {
    numero: '5.2.1',
    nombre: 'La puesta en marcha, arreglada',
    fecha: '2026-09-04',
    resumen:
      'Lo que se rompió al revisarla de verdad: el hielo del cuarto frío no '
      + 'se podía capturar, el botón de limpiar dejaba dentro los cortes, y '
      + 'preguntaba por un dinero que empieza en cero.',
    cambios: [
      { tipo: 'arreglo', texto: 'YA SE PUEDE PONER EL HIELO QUE HAY. La puesta en marcha decía «ve a contar el cuarto frío» y del otro lado NO se podía contar: contar solo existía dentro del cierre de turno. El paso mandaba a un sitio donde el paso no se podía hacer. Ahora se captura ahí mismo, con el mismo teclado de fracciones del cierre —"114 y 1/2"— y se puede volver a anotar hasta que quede bien.' },
      { tipo: 'arreglo', texto: 'Y EL ARREGLO DE FONDO: contar el cuarto frío contestaba «ese cuarto frío no existe» cuando no se le decía cuál, aunque hubiera uno solo. Los cortes de hielo, que son de la misma familia, siempre cayeron al único que hay; el conteo se había quedado sin esa red porque el único sitio que lo llamaba siempre se lo mandaba.' },
      { tipo: 'importante', texto: 'AHORA SÍ DEJA TODO LIMPIO. El botón de borrar las pruebas era de la v2.8 y borraba trece tablas de las veintiocho que hay hoy: SE QUEDABAN DENTRO los cortes de caja, los cortes de hielo, los gastos de la empresa, los recibos de la luz, los vales, las encomiendas y las lecturas de la planta. Decía «te dejo limpio» y no era cierto, y esos números de prueba iban a salir mezclados con los meses buenos del negocio para siempre.' },
      { tipo: 'nuevo', texto: 'Y AHORA TE ENSEÑA QUÉ SE VA A BORRAR, CONTADO, antes de apretar: «48 ventas · 3 cortes de caja · 7 gastos de la empresa». Al lado, lo que se queda. La lista que se ve es exactamente la que se ejecuta, así que ya no puede pasar que el texto prometa una cosa y el botón haga otra.' },
      { tipo: 'importante', texto: 'LA LÍNEA ES: se borra lo que PASÓ, se queda lo que ES. Se borra una venta, un corte, una sacada, un gasto, una lectura — los de las pruebas son hechos que no pasaron. Se quedan los tanques, los productos, los precios, la gente, los clientes, LAS NEVERAS CON DÓNDE ESTÁ CADA UNA y los equipos de la planta con la pieza que traen puesta: eso costó trabajo capturar y sigue siendo verdad mañana.' },
      { tipo: 'importante', texto: 'Y PARA QUE NO SE VUELVA A QUEDAR VIEJA, cada tabla está clasificada a mano y hay una prueba que revienta cuando aparece una nueva sin clasificar. O sea: el día que agregue un módulo, el sistema me obliga a decidir si lo que guarda se borra o se queda. Olvidarse ya no es una opción silenciosa.' },
      { tipo: 'arreglo', texto: 'YA NO PREGUNTA CUÁNTO DINERO HAY. Quedamos en que la caja empieza en cero, así que ese paso solo servía para meter un número que después no cuadraba con nada. En su lugar dice lo que hay que saber: el primer cajero entra con su PIN, eso abre su turno, y desde ahí el arqueo cuadra solo.' },
      { tipo: 'mejora', texto: 'LA PANTALLA ES UN FORMULARIO, no una lista de enlaces a otras pantallas. Lo que se puede capturar ahí, se captura ahí. Un enlace es una promesa de que del otro lado hay algo; si no lo hay, es peor que nada.' },
      { tipo: 'mejora', texto: '«LA RAYA» AHORA SE LLAMA SUELDOS, y tiene su propio icono (💰). Tenía el mismo billete que Caja, y dos apartados con el mismo dibujo se confunden desde el otro lado del mostrador. De paso quedaron todos distintos: Producción 🏭, Caja 💵, Sueldos 💰, Neveras 🧊, Agua 💧, Clientes 🧾, Historial 📋 — y el menú de la izquierda ya usa los mismos que el inicio, que antes no coincidían.' },
      { tipo: 'nuevo', texto: 'El manual, al día: qué se borra, qué se queda y por qué las neveras y las piezas puestas no se tocan.' }
    ]
  },
  {
    numero: '5.2',
    nombre: 'El agua: la máquina',
    fecha: '2026-09-04',
    resumen:
      'La planta de ósmosis, con el número que de verdad dice cuándo cambiar '
      + 'las membranas — porque una planta que se está muriendo sigue sacando '
      + 'agua que se ve igual de transparente. Y el primer cuadre de litros.',
    cambios: [
      { tipo: 'nuevo', texto: 'LA PLANTA DE AGUA, pantalla nueva en el inicio (💧 La planta de agua). Ya viene con TU equipo dado de alta: el clorinador, la zeolita y el carbón en tanques de 4 pies, los dos suavizadores de 7 pies en paralelo, las seis membranas de ultra baja presión, los dos medidores, los cinco tinacos de 1000 L, el ozono y la luz ultravioleta. Todo editable, todo se puede dar de baja.' },
      { tipo: 'importante', texto: 'EL RECHAZO DE SALES, que es el número que manda y sale grande. (TDS de entrada − TDS de salida) ÷ TDS de entrada. Con membranas nuevas anda en 96–98 %; cuando baja de 90 ya no purifican, cuelan. Esto es lo que hace falta de verdad: una planta de ósmosis NO AVISA cuando se está muriendo — sigue sacando agua, sigue llenando garrafones, y el agua se sigue viendo igual. Lo único que cambia es ese número.' },
      { tipo: 'importante', texto: 'Y ABAJO, CÓMO VIENE LA LÍNEA. Un dato suelto no dice nada, porque el TDS del pozo cambia con la lluvia. Lo que importa es si lleva tres meses bajando, y eso solo se ve dibujado. La escala no empieza en cero a propósito: entre 90 y 98 se juega todo, y con el eje desde cero se vería plana siempre.' },
      { tipo: 'importante', texto: 'EL CLORO DESPUÉS DEL CARBÓN VA RESALTADO, y tiene su propio aviso. Es la medición más barata de tomar y la más cara de saltarse: el clorinador echa cloro al principio y el carbón está ahí para quitárselo ANTES de las membranas. Si el carbón se saturó y pasa cloro, las SEIS membranas se echan a perder en días. Por eso el tren de tratamiento sale en orden — para que se vea por qué.' },
      { tipo: 'nuevo', texto: 'LA VUELTA DE REVISIÓN, en una sola tarjeta con un botón: TDS de entrada y salida, cloro, dureza, los dos medidores, presión y notas. Está así porque se hace todos los días con el aparato en la mano: siete ventanitas seguidas cada mañana harían que se dejara de anotar en una semana, y una planta sin lecturas es una planta a ciegas.' },
      { tipo: 'importante', texto: 'VACÍO Y CERO NO SON LO MISMO, y aquí importa más que en ningún lado. «Cloro 0» quiere decir que se midió y salió limpio, que es la buena noticia del día. «Cloro vacío» quiere decir que nadie lo midió. Confundirlos daría por bueno un carbón saturado, así que lo que no se midió se deja en blanco y sale en blanco.' },
      { tipo: 'nuevo', texto: 'EL RECHAZO SE VE MIENTRAS SE ESCRIBE. En cuanto se teclean los dos TDS, la pantalla ya dice cómo va a salir. Es la diferencia entre enterarse hoy y enterarse cuando alguien mire la tabla: el que captura tiene el aparato en la mano y puede volver a medir ahí mismo — la mitad de las veces lo que estaba mal era la medición.' },
      { tipo: 'importante', texto: 'LOS MEDIDORES SE ANOTAN COMO MARCAN, no lo del día. Un medidor de flujo nunca se pone en cero: solo sube. Así que se guarda lo que marca y los litros salen restando la vuelta anterior, igual que los recibos de la luz. Eso tiene una ventaja grande: UN DÍA QUE NADIE ANOTÓ NO SE PIERDE, el medidor lo siguió contando y la siguiente vuelta lo recoge. Y si un día marca menos —porque se cambió el medidor— se marca el renglón y no se cuenta, en vez de inventar un consumo negativo.' },
      { tipo: 'nuevo', texto: 'A DÓNDE SE FUE EL AGUA: el primer cuadre de litros. Lo que marca el medidor contra marquetas × 150 L, que es lo que en teoría se llevó el hielo. Tú me lo diste: «la marqueta pesa 150 kg si está entera y sellada, por lo que son 150 L». La diferencia es el agua que se derrama por llenar los moldes de más, que hoy no la ve nadie.' },
      { tipo: 'importante', texto: 'OJO: ESE CUADRE TODAVÍA NO CIERRA, y la pantalla lo dice en vez de presumir. Los garrafones y las botellas salen de esta misma agua y todavía no se registran — van en la v5.3, y entonces se restan ahí. Y si sale en negativo es al revés: el hielo se llevó más agua de la que marcó el medidor, o sea que los moldes se están llenando de menos y las marquetas salen chicas.' },
      { tipo: 'importante', texto: 'EL EQUIPO Y LA PIEZA SON DOS COSAS, igual que la nevera y su comodato. El equipo es el puesto —«Membrana 3»— y vive lo que viva la planta; la pieza es lo que está puesto hoy. Cambiar la membrana 3 no borra la anterior: se apila. Y eso descubre cosas — si el puesto 3 se come una membrana cada año y los otros cinco duran tres, lo que está mal no es la membrana, es lo que le llega.' },
      { tipo: 'nuevo', texto: 'LA VIDA DE CADA PIEZA, en días, en litros o las dos, y manda la que vaya más adelantada: una lámpara de UV se acaba por meses aunque no pase agua, y una membrana por litros aunque el calendario no avance. Sale como barra, no como número, para poder compararlas de un vistazo entre veinte renglones. Avisa a los TRES CUARTOS de su vida, no al final: una membrana no llega el mismo día que se pide.' },
      { tipo: 'nuevo', texto: 'LOS SERVICIOS, con la diferencia que importa: una FALLA deja el equipo marcado como «por reparar» hasta que alguien anote qué se le hizo; un retrolavado, una regeneración o una sanitización se anotan YA HECHOS, porque son trabajo normal y nadie «reporta» un retrolavado esperando a que alguien vaya. Al atender la última falla, el equipo vuelve a trabajando solo.' },
      { tipo: 'nuevo', texto: 'SEIS AVISOS POR CORREO nuevos, en orden de qué tan caro sale no atenderlos: cloro pasando por el carbón, el agua se pasó del TDS, las membranas se están acabando, pieza que ya cumplió su vida, nadie dio la vuelta, y falla en la planta. Una sola vuelta puede disparar tres, y salen los tres: son tres problemas con tres arreglos distintos, y juntarlos haría que el del cloro se leyera como un renglón más.' },
      { tipo: 'importante', texto: 'QUIÉN PUEDE QUÉ. Dar la vuelta y reportar una falla lo puede hacer CUALQUIERA —operario, cajero, gerente—: la avería se ve cuando se ve, y el que trae el aparato en la mano es quien está ahí. Cambiar una pieza, capturar lo que costó y mover los límites del TDS es solo tuyo: una membrana cuesta lo que cuesta, y ese límite decide si el agua se embotella o no.' },
      { tipo: 'nuevo', texto: 'LAS LECTURAS NO SE EDITAN, SE ANULAN, con su motivo. Una lectura es lo que marcaba el aparato ese día y eso no cambia. Si se anotó mal, lo que dice la verdad es que alguien se equivocó — y eso también se guarda.' },
      { tipo: 'nuevo', texto: 'AJUSTES: el TDS máximo de salida (50 ppm de fábrica), el rechazo mínimo (90 %), la dureza máxima después del suavizador (20 ppm), los días sin lectura antes de avisar, y los litros por marqueta (150). Todo lo tuyo, todo cambiable.' },
      { tipo: 'nuevo', texto: 'Y TODO EXPLICADO en el manual (❓ Ayuda › La planta de agua: la máquina), incluida la parte de por qué el carbón va antes de las membranas.' }
    ]
  },
  {
    numero: '5.1',
    nombre: 'Las neveras',
    fecha: '2026-09-04',
    resumen:
      'Dónde está cada nevera, en un mapa, con su contrato, su historial ' +
      'de fallas y el número que de verdad importa: si ya se pagó sola. Y ' +
      'el aviso de a quién hay que llamarle hoy.',
    cambios: [
      { tipo: 'nuevo', texto: 'LAS NEVERAS, pantalla nueva en el inicio (🧊 Las neveras). Todo lo que pediste: dónde está cada una con su dirección escrita, quién es el responsable con su teléfono, el documento de comodato escaneado, su historial de mantenimientos, cuántas bolsas le caben, qué ha pedido y cuándo fue la última vez.' },
      { tipo: 'importante', texto: 'LA NEVERA Y EL PRÉSTAMO SON DOS COSAS, y es lo que hace que esto siga sirviendo dentro de diez años. La nevera es el fierro y guarda su vida entera; el comodato es el préstamo a UNO. Así, el día que recojas la de Don Chuy y se la pongas a la tienda de la esquina, no se pierde nada: la nevera acumula lo de los dos. Guardadas como una sola cosa habría que elegir entre pisar los datos del anterior o dar de alta otra nevera, y las dos son perder información.' },
      { tipo: 'nuevo', texto: '¿YA SE PAGÓ? El número grande de cada ficha: lo que ha comprado de bolsas, MENOS lo que costó la nevera, MENOS sus reparaciones, MENOS lo que se le ha regalado. Es el que dice qué neveras valen la pena y cuáles hay que recoger.' },
      { tipo: 'importante', texto: 'Y LO REGALADO RESTA, que era la parte fina. Si a un cliente se le regalan veinte bolsas al mes, esa nevera no está ganando lo que parece — y sin restarlo, justo la del cliente al que más se le consiente saldría como la mejor de todas. Hay botón de 🎁 Regalé bolsas, con motivo: cortesía, promoción, cambio o merma.' },
      { tipo: 'nuevo', texto: 'EL MAPA, con OpenStreetMap como pediste. Todas las neveras con su número, se arrastra, se acerca, y al tocar una chincheta se abre su ficha. Verde va bien, ámbar lleva días sin pedir, rojo está descompuesta. La ubicación se pone pegando el enlace que Google Maps da al compartir: el sistema saca las coordenadas solo.' },
      { tipo: 'importante', texto: 'EL MAPA NECESITA INTERNET; LA DIRECCIÓN ESCRITA NO. Por eso la dirección es la que manda y el mapa es el lujo: si un día no hay señal, el mapa lo dice y se pone en gris, pero las direcciones y los teléfonos siguen ahí. Y está escrito a mano, sin meter ninguna librería: el sistema sigue sin una sola dependencia en la pantalla.' },
      { tipo: 'nuevo', texto: 'EL CONTRATO DE COMODATO, REDACTADO Y QUE SE RELLENA SOLO. Sale en hoja carta con el cliente, el responsable, la dirección, la nevera y su valor, listo para firmar. Si le faltan datos TE LO DICE ANTES de imprimirlo: descubrir que falta el domicilio con el cliente enfrente y la pluma en la mano es la peor forma de descubrirlo. Y el texto se puede cambiar sin actualizar el programa.' },
      { tipo: 'importante', texto: 'OJO CON EL CONTRATO: está redactado siguiendo la figura del comodato y cubre lo que suele cubrirse —destino del bien, conservación, daños, robo, devolución— pero NO lo ha revisado un abogado. Antes de firmarlo con el primer cliente que lo lea uno de Yucatán. Y cuidado con cargarlo demasiado de un lado, que un contrato desequilibrado se puede caer entero: las tres cláusulas que más se miran están marcadas en el propio texto.' },
      { tipo: 'nuevo', texto: 'NO SOLO A CLIENTES. Una nevera se entrega a un CLIENTE (años), a un EVENTO O FERIA (unos días, con fecha de devolución y aviso cuando se pasa, sin tener que dar de alta un cliente para tres días) o A LA FÁBRICA. Y hay un estado para «no sé dónde está», que dijiste que te pasa: no es lo mismo que haberla vendido, y esa diferencia es justo la que importa.' },
      { tipo: 'nuevo', texto: 'FALLAS Y MANTENIMIENTOS. El botón 🔧 Reporta falla anota lo que dijo el cliente y deja la nevera marcada POR REPARAR, para que nadie la vuelva a prestar sin querer. Al atenderla se anota qué se le hizo, quién y cuánto costó — y ese costo resta de lo que la nevera ha ganado. Una limpieza no la marca: sigue trabajando.' },
      { tipo: 'nuevo', texto: 'LOS DÍAS PARA AVISAR, POR CADA CLIENTE, como pediste: hay unos más lentos y otros más rápidos. Se ponen en su ficha; el que no tenga los suyos usa el general. Arriba de la lista sale lo que pide acción HOY: las que no han pedido, las descompuestas, las que se pasaron de la fecha y las perdidas. Si no hay nada, no sale nada.' },
      { tipo: 'nuevo', texto: 'Y DOS AVISOS POR CORREO MÁS (ya son diecisiete): «Nevera que no ha pedido», una vez al día con la lista y los teléfonos —es el que más va a vender, porque dice a quién llamarle hoy— y «Nevera descompuesta», en cuanto alguien reporta una falla.' },
      { tipo: 'nuevo', texto: 'BOTÓN DE WHATSAPP con el mensaje ya escrito para el responsable de esa nevera, y botón de 📍 Cómo llegar que abre Google Maps. El mensaje se cambia en Ajustes.' },
      { tipo: 'arreglo', texto: 'ARREGLO QUE VENÍA DE ANTES Y NO SE HABÍA VISTO: un PDF de más de 1 MB en un gasto de la empresa —o sea, cualquier recibo de la CFE escaneado— reventaba con «ocurrió un error en el servidor», sin ninguna pista de por qué. El lector de archivos grandes estaba declarado DESPUÉS del general, así que el chico rechazaba el archivo antes de que el grande lo viera.' },
      { tipo: 'arreglo', texto: 'Y en las neveras mismas, otro que cazaron las pruebas antes de que llegara: guardar los ajustes entraba por la ruta de editar una nevera, con el id «ajustes».' },
      { tipo: 'mejora', texto: 'Todo está en el manual, en «Las neveras en comodato».' }
    ]
  },
  {
    numero: '5.0',
    nombre: 'Los tickets, como los dibujaste',
    fecha: '2026-09-03',
    resumen:
      'Los papeles rediseñados con los cuatro dibujos que mandaste: todo ' +
      'por renglones, puntitos hasta el número, una raya encima del ' +
      'resultado, y el tamaño de la letra a tu gusto en configuraciones.',
    cambios: [
      { tipo: 'importante', texto: 'LOS TICKETS, REDIBUJADOS con los cuatro papeles que mandaste. Todo va por renglones del mismo ancho, de orilla a orilla: arriba a la izquierda qué es el papel y a la derecha quién lo hizo, la fecha debajo, y en medio el contenido entre rayas.' },
      { tipo: 'nuevo', texto: 'EL TAMAÑO DE LA LETRA, EN CONFIGURACIONES, que es lo que pediste. Está en Sistema › La impresora de tickets, junto al ancho del papel, y tiene tres pasos: CHICA (64 letras por renglón en vez de 48: cabe más y se gasta menos papel), NORMAL (lo de siempre) y GRANDE (las mismas 48 columnas —así que NADA se desacomoda— pero al doble de alto). Sácate una prueba con cada una y quédate con la que se lea mejor.' },
      { tipo: 'importante', texto: 'POR QUÉ SON TRES Y NO UN NÚMERO DE PUNTOS: una impresora térmica no tiene tamaños libres como Word. Trae DOS LETRAS GRABADAS de fábrica y un multiplicador que agranda lo que ya hay. Un «13.5» no existe en esa máquina, y ponértelo en la pantalla sería mentirte. La grande solo dobla el ALTO a propósito: doblando también el ancho quedarían 24 columnas y ahí ya no cabe «Retiro a la caja fuerte ... $2,000» en un renglón.' },
      { tipo: 'nuevo', texto: 'LA CUENTA DEL CORTE, CON PUNTITOS Y CUADRADA, como en tu dibujo: las etiquetas alineadas, los puntos llevando el ojo hasta el número, todos los importes en la misma columna, UNA RAYA encima del resultado —como en una suma de papel— y el FALTA $55 en grande y SUBRAYADO.' },
      { tipo: 'nuevo', texto: 'Y LOS TRES NÚMEROS DEL TURNO DE UN VISTAZO en un renglón: 750 tickets · 15 gastos · 1 vale. La hora de abrir se subió arriba junto a la de cerrar, que es el mismo dato —de cuándo a cuándo fue este turno— y estaba en dos sitios.' },
      { tipo: 'importante', texto: 'EL VALE ES EL MISMO PAPEL QUE EL GASTO, como dijiste: donde el gasto dice «Gasto», el vale dice «VALE DE JESÚS». Y con eso el nombre subió al título, que es donde tiene que estar — antes iba a media altura del papel, y es el único dato que separa un vale de un faltante. Debajo del importe va su nombre completo.' },
      { tipo: 'nuevo', texto: 'HIELO A SACAR, UN RENGLÓN POR TANQUE: la letra del tanque a la izquierda y sus cuatro números en grande, separados por puntos, con una raya fina entre tanque y tanque. Antes eran dos renglones por tanque y solo el primer paño salía grande. Los cuatro en grande se leen desde el otro lado del cuarto, que es donde se lee ese papel.' },
      { tipo: 'nuevo', texto: 'EN LA VENTA, EL HIELO Y SU PRECIO EN EL MISMO RENGLÓN («2 3/8 ......... $627»), y abajo TOTAL, PAGO y CAMBIO también en uno solo, repartidos a lo ancho. Eran cuatro renglones y son dos, en el papel que más se imprime.' },
      { tipo: 'mejora', texto: 'LAS RAYAS QUE SEPARAN AHORA LLEVAN HUECO entre guión y guión, como en un recibo de papel. Una fila de guiones pegados salía casi como una línea sólida y pesaba demasiado para lo que hace, que es solo separar.' },
      { tipo: 'mejora', texto: 'EL TEXTO LARGO —el concepto de un gasto— VA JUSTIFICADO, de orilla a orilla, como en tu dibujo. El último renglón no se estira: una frase de tres palabras estirada a lo ancho queda ridícula, y eso lo sabe cualquier imprenta desde hace quinientos años.' },
      { tipo: 'importante', texto: 'DOS COSAS QUE UNA TÉRMICA NO PUEDE HACER, para que no las busques en el papel. NO CAMBIA DE ESTILO A MEDIA LÍNEA: en «Hielo a sacar · Tony Castilla» o los dos van en negritas o ninguno, y va el renglón entero. Y NO TIENE CURSIVAS: donde tu dibujo lleva cursiva va subrayado, que sí existe y hace el mismo trabajo — decir «esto es el resultado».' },
      { tipo: 'arreglo', texto: 'Un corte sin nombre de quien lo cerró decía «Cerro -: ______», que se lee como un error. Ahora dice «FIRMA DE QUIEN CIERRA».' },
      { tipo: 'mejora', texto: 'Todo está en el manual, en «Cómo se lee un ticket», con los cuatro papeles dibujados.' }
    ]
  },
  {
    numero: '4.9',
    nombre: 'Que el sistema te escriba',
    fecha: '2026-09-03',
    resumen:
      'Quince avisos por correo que prendes y apagas uno por uno: el ' +
      'corte, las anulaciones que no hiciste tú, el inventario bajo, el ' +
      'resumen del día, el informe del mes y diez más.',
    cambios: [
      { tipo: 'nuevo', texto: 'AVISOS POR CORREO, pantalla nueva en el inicio (✉️ Avisos). Son QUINCE y cada uno se prende y se apaga por su cuenta, como pediste: hay semanas en las que quieres enterarte de todo y semanas en las que no. Es solo del administrador: ahí vive la contraseña de la cuenta de correo de la fábrica.' },
      { tipo: 'nuevo', texto: 'LOS QUE PEDISTE: el INFORME DEL MES, el PRODUCTO BAJO DE INVENTARIO, CADA CORTE de caja, las ANULACIONES —tickets cancelados, sacadas anuladas, cosas eliminadas—, TANQUE NUEVO, EMPLEADO NUEVO y la LLEGADA Y SALIDA de un trabajador.' },
      { tipo: 'importante', texto: 'Y LO QUE ANULA UN ADMINISTRADOR NO AVISA, como dijiste. Lo hiciste tú y ya lo sabes; un correo por cada cosa que uno mismo acaba de hacer es la forma más rápida de que se dejen de leer los correos de este sistema. Lo que anula cualquier otro sí llega, con su nombre, su rol y el motivo que escribió.' },
      { tipo: 'nuevo', texto: 'Y OCHO MÁS QUE ME PARECIERON OPORTUNOS: SOLO LOS CORTES QUE NO CUADRAN —para el que no quiere el corte de todos los días pero sí quiere enterarse cuando falta dinero—, VALE DE SUELDO, RAYA PAGADA, GASTO GRANDE DE LA EMPRESA con su monto configurable, CAMBIO DE PRECIOS, HIELO POR DEBAJO DEL MÍNIMO, EL CUARTO FRÍO NO CUADRÓ y el RESUMEN DEL DÍA a la hora que pongas.' },
      { tipo: 'nuevo', texto: 'EL APAGADOR GENERAL, abajo de la cuenta. Apagado ahí no sale nada aunque los quince estén prendidos: sirve para callarlo todo un fin de semana sin perder lo que tenías configurado.' },
      { tipo: 'importante', texto: 'CÓMO SE CONECTA: con SMTP, que era tu pregunta. Una cuenta de correo cualquiera —lo mejor, una de Gmail hecha para la fábrica y no la personal—. OJO: Gmail NO acepta la contraseña normal, hay que crear una CONTRASEÑA DE APLICACIÓN de 16 letras. Está explicado paso a paso en el manual, incluido el requisito que atora a todo el mundo: la cuenta necesita la verificación en dos pasos prendida.' },
      { tipo: 'nuevo', texto: 'EL BOTÓN DE PROBAR manda un correo de verdad en el momento, y si algo está mal TE DICE QUÉ ESTÁ MAL. «Contraseña no aceptada — si es Gmail tiene que ser una de aplicación», «no se encontró ese servidor», «no contestó por ese puerto, prueba el otro». Un «no se pudo» a secas no le sirve a nadie.' },
      { tipo: 'importante', texto: 'UN AVISO NO SE PIERDE SI SE VA EL INTERNET. No se manda en el momento: se apunta y sale en cuanto haya línea. Se vuelve a intentar solo, cada vez con más espera, hasta ocho veces. Y como el aviso no se manda en el momento, cerrar un turno sigue tardando lo que tarda cerrar un turno, no lo que tarde Gmail en contestar.' },
      { tipo: 'nuevo', texto: 'LA LIBRETA DE LO QUE SALIÓ, abajo en la misma pantalla: los últimos avisos, cada uno diciendo si SALIÓ, si está ESPERANDO o si NO SALIÓ, y en los dos últimos casos por qué. Así «no me llegó el correo» se contesta mirando algo en vez de adivinando.' },
      { tipo: 'mejora', texto: 'EL PRODUCTO BAJO AVISA UNA VEZ, cuando cruza el mínimo, y no vuelve hasta que se surta y se acabe otra vez. Un correo cada media hora diciendo lo mismo acaba en la carpeta de spam, y se lleva con él los otros catorce avisos.' },
      { tipo: 'mejora', texto: 'Y EN EL CORREO DEL CORTE, EL RETIRO A LA CAJA FUERTE VA APARTE de los gastos, bajo «salió del cajón, pero no se gastó». Tenías razón cuando lo dijiste de los tickets: no es tan literal un gasto, aunque el cajón lo reste igual.' },
      { tipo: 'mejora', texto: 'Todo está en el manual, en «Avisos por correo: que el sistema te escriba».' }
    ]
  },
  {
    numero: '4.8',
    nombre: 'La raya',
    fecha: '2026-09-03',
    resumen:
      'Cuánto gana cada quien, qué días viene y a qué hora, cuántos vales ' +
      'se llevó, y el papel que firma cuando se le paga. Con la respuesta ' +
      'a lo del dinero: al pagar se dice DE DÓNDE salió.',
    cambios: [
      { tipo: 'nuevo', texto: 'LA RAYA, pantalla nueva en el inicio (💵 La raya). Ahí está todo lo que preguntaste: cuánto gana cada quien, qué días viene, a qué hora llega y a qué hora se va, cuántos vales se llevó, y el botón para imprimirle su balance y darle su sueldo. Es SOLO DEL ADMINISTRADOR: lo que gana cada quien no se anda enseñando.' },
      { tipo: 'importante', texto: 'LO DEL DINERO, QUE ERA TU PREGUNTA. Me dijiste que a veces el sueldo se agarra de la caja y a veces se hace el corte y luego se le da. Las dos son correctas y las dos pasan, así que el sistema NO ELIGE POR TI: al pagar pregunta DE DÓNDE SALE. Si sale DEL CAJÓN, se anota como salida de la caja abierta y el corte de ese turno lo resta, porque ese dinero ya no está ahí. Si sale DE FUERA —de la caja fuerte, del banco, de tu bolsa— se anota como gasto de la empresa y el cajón ni se entera, porque ese dinero ya salió antes cuando hiciste el retiro. De las dos maneras cuenta igual como gasto de la fábrica.' },
      { tipo: 'importante', texto: 'Y POR ESO EL COSTO POR MARQUETA YA INCLUYE LOS SUELDOS. Hasta la versión pasada el número decía, abajo, que le faltaba la raya. Ya no le falta: ese aviso se cambió por lo que sí falta.' },
      { tipo: 'nuevo', texto: 'CUÁNTO GANA, de dos formas: A LA SEMANA —gana lo mismo venga cinco días o seis— o POR DÍA, que se multiplica por los días que se le cuenten y ese número se puede cambiar al pagarle, porque faltó un día o porque entró uno extra. Pagamos a la semana, como me dijiste, y así viene puesto.' },
      { tipo: 'nuevo', texto: 'UN AUMENTO NO BORRA LO ANTERIOR. Cada sueldo se guarda con la fecha desde cuándo vale, y quedan todos apuntados. Puedes dejar anotado un aumento con fecha de la semana que entra: la raya de esta semana se paga todavía con el sueldo viejo, que es lo correcto.' },
      { tipo: 'nuevo', texto: 'SU HORARIO, DIBUJADO COMO UNA SEMANA: siete casillas de domingo a sábado. Los días que viene en verde con su hora de entrada, la de salida y cuántas horas son; los que no viene, en gris. Un turno que cruza la medianoche —entra a las 10 de la noche y sale a las 6— se cuenta bien, son ocho horas.' },
      { tipo: 'nuevo', texto: 'EL PAPEL QUE FIRMA. Sale por la impresora al pagarle: su nombre, la semana, los días, el sueldo, los extras, CADA VALE CON SU FECHA, los descuentos y lo que se le entregó, con la raya para firmar. Se puede ver antes de pagar, para enseñárselo y que no haya sorpresas. Sin impresora térmica se imprime desde la computadora.' },
      { tipo: 'nuevo', texto: 'LOS VALES SE DESCUENTAN SOLOS al pagarle la raya, todos de un jalón — ya no hay que ir a marcarlos a mano en su ficha. Y si debe más vales de lo que gana, el sistema NO DEJA PAGAR: eso no se arregla con un número rojo en un papel.' },
      { tipo: 'nuevo', texto: 'EXTRAS Y DESCUENTOS, cada uno con su nota: horas de más, un domingo que entró, una gratificación; o lo que se le descuenta por otra cosa. Quedan escritos en el papel.' },
      { tipo: 'mejora', texto: 'UNA RAYA PAGADA SE CONGELA. Si mañana le subes el sueldo, la del sábado pasado sigue diciendo lo que decía: es un papel que ya se firmó. Y si se pagó mal, SE ANULA CON SU MOTIVO — se deshace el movimiento de la caja o el gasto de la empresa, y sus vales vuelven a quedar pendientes. Nada se borra: queda quién la anuló y por qué.' },
      { tipo: 'mejora', texto: 'EL DÍA DE PAGO se configura desde la misma pantalla. Viene en sábado.' },
      { tipo: 'mejora', texto: 'Todo está en el manual, en «La raya: sueldos, horarios y el pago de la semana».' }
    ]
  },
  {
    numero: '4.7',
    nombre: 'Menos papel, más rastro',
    fecha: '2026-09-03',
    resumen:
      'El corte pasa de cuatro papeles a tres, el vale deja de salir por ' +
      'duplicado, los tanques se acomodan con flechas, y al anular una ' +
      'sacada queda escrito quién fue y por qué.',
    cambios: [
      { tipo: 'importante', texto: 'AL ANULAR UNA SACADA YA QUEDA ESCRITO QUIÉN FUE. Tenías razón: si no, jamás te ibas a enterar. Y el problema era peor de lo que parecía — la anulación se guardaba ESCRIBIÉNDOLA EN LAS NOTAS del paño, así que quién lo hizo no se guardaba en ningún lado y la nota de verdad se perdía. Ahora se ve en la historia del paño (botón 👁 Historia) con nombre, fecha y motivo, y la nota original se queda donde estaba.' },
      { tipo: 'nuevo', texto: 'LOS TANQUES SE SUBEN Y SE BAJAN con las flechas ↑ ↓, sin dar de baja nada. Antes cambiar el orden obligaba a borrar y volver a crear, que se lleva por delante el historial entero del tanque.' },
      { tipo: 'nuevo', texto: 'AL TOCAR UN PAÑO QUE NO ES EL QUE SIGUE, EL SISTEMA LO DICE, y ofrece las tres salidas: ver su historia —que no cambia nada y no pide permiso a nadie—, ir al paño que sí toca, o desbloquearlo con el PIN de quien autoriza. Antes se abría callado en modo mirar y quien venía a sacarlo se quedaba viendo una pantalla que no dejaba tocar nada. Y mientras se mira un paño que no toca, arriba queda el aviso.' },
      { tipo: 'importante', texto: 'NADA SALE POR DUPLICADO. Era el vale, que salía siempre de a dos. La idea era buena y la decisión no era mía: ahora sale UNO, y si quieres los dos se encienden en Sistema › Impresora.' },
      { tipo: 'importante', texto: 'EL CORTE PASA DE CUATRO PAPELES A TRES. El del día —cuánto hielo queda y qué paños salieron— ya no sale pegado al corte: tiene su propio botón 🧾 El día en Producción de hielo, y se saca cuando quieras ver cómo va la cosa. También se puede volver a encender en Sistema › Impresora.' },
      { tipo: 'mejora', texto: 'Y EL PAPEL DEL HIELO SE QUEDA CON LO SUYO: el cuarto frío —qué había, qué debía haber, qué se contó y qué faltó— y cuánto se vendió al público y a mayoreo. Los paños se mudaron al papel del día, CON QUIÉN LOS SACÓ: son producción del día, no del turno de caja, y estaban saliendo dos veces.' },
      { tipo: 'mejora', texto: 'EL VALE DE RAYA AHORA SE LLAMA VALE DE SUELDO. Tienes razón, «raya» aquí no se dice. El nombre sale impreso en el papel que firma el trabajador, así que importa.' },
      { tipo: 'mejora', texto: 'Y donde decía «obrero» ahora dice OPERARIO, en las pantallas, en los papeles y en el manual.' }
    ]
  },
  {
    numero: '4.6',
    nombre: 'La hoja, a tu manera',
    fecha: '2026-09-03',
    resumen:
      'Los números en dos columnas y con los apartados que se suben y se ' +
      'bajan a mano. Y dos datos nuevos: la luz desarmada en tres preguntas ' +
      '—cuánta, a cómo y cuánta por marqueta— y quién compra más.',
    cambios: [
      { tipo: 'nuevo', texto: 'EL ORDEN DE LA HOJA LO PONES TÚ. Cada apartado tiene sus flechas ↑ ↓ en la esquina: con ellas se sube o se baja lo que quieras ver primero. El orden se guarda EN LA FÁBRICA y no en la computadora donde lo cambiaste, así que sale igual desde la PC y desde la pantalla táctil. Se mueve con flechas y no arrastrando: arrastrar media pantalla en una táctil no lo hace nadie dos veces.' },
      { tipo: 'mejora', texto: 'LA HOJA VA EN DOS COLUMNAS en pantalla ancha. Las gráficas que necesitan el ancho entero —el resumen, el día por día y la tendencia— lo siguen ocupando solas; el resto se acomoda de a dos. En un teléfono se apila todo, como antes.' },
      { tipo: 'nuevo', texto: 'LA LUZ, DESARMADA EN TRES PREGUNTAS. Un recibo más caro puede ser tres cosas distintas y juntas no se contestan: cuántos KILOWATTS se consumieron, A CÓMO salió el kilowatt —eso lo pone la CFE— y cuántos KILOWATTS CUESTA HACER UNA MARQUETA, que es lo que pone la fábrica. El último no se puede leer en el papel del recibo, y es el que avisa de una máquina trabajando peor aunque el recibo venga igual.' },
      { tipo: 'nuevo', texto: 'Y CADA UNA CON SU LÍNEA en los últimos doce meses, para ver si algo viene subiendo desde hace rato o si fue solo este mes. Si sube «a cómo salió el kilowatt», la luz está más cara y no hay nada que arreglar en la fábrica. Si sube «kilowatts por marqueta», es al revés. Pueden subir las dos a la vez, y por eso van separadas.' },
      { tipo: 'nuevo', texto: 'QUIÉN COMPRA MÁS: los clientes del mes del que más se llevó al que menos, con su dinero, sus marquetas, cuántas veces vino, cuántas fiadas y cuándo fue la última. Solo entra lo que se cobró con nombre: el mostrador de a cuarto no tiene dueño y meterlo taparía a todos los demás.' },
      { tipo: 'mejora', texto: 'Todo está en el manual, en «Los números: qué significa cada uno».' }
    ]
  },
  {
    numero: '4.5',
    nombre: 'Lo encomendado',
    fecha: '2026-09-03',
    resumen:
      'El hielo que un cliente ya pagó y deja guardado en el cuarto frío ' +
      'para pasar por él después. Su papelito, con el nombre y la hora — y ' +
      'el cuadre del cuarto frío arreglado, que era lo que faltaba debajo.',
    cambios: [
      { tipo: 'nuevo', texto: 'EL PAPELITO DE LO ENCOMENDADO, que es lo que pediste. Con el botón 🧊 de la pantalla de vender: se elige de quién es el hielo —o se escribe el nombre, si no está dado de alta— y cuánto, y sale su papel con la fecha, la hora y su nombre en grande. Con ese papel vuelve el cliente. El mismo botón sirve para entregárselo: se toca su renglón y listo.' },
      { tipo: 'importante', texto: 'Y LO QUE HACÍA FALTA DEBAJO: ESE HIELO SIGUE EN EL CUARTO FRÍO. Como la venta ya lo restó, sin arreglarlo habría salido como «SOBRA» en cada conteo hasta que el cliente pasara por él — y «sobra» es justo la palabra que avisa de un paño sin capturar. Ahora el cuadre lo SUMA mientras esté guardado y lo RESTA el día que se lo llevan. Guardarlo y entregarlo el mismo día se cancela solo, que es lo correcto.' },
      { tipo: 'nuevo', texto: 'EL NUMERITO NARANJA encima del botón dice cuántos papelitos hay esperando. Sin él, un encomendado se anota y se olvida hasta que alguien reclama, y para entonces nadie se acuerda de dónde quedó el papel.' },
      { tipo: 'nuevo', texto: 'En El cuarto frío sale la lista de QUIÉN TIENE QUÉ y desde cuándo, y el cuadre de esa pantalla ya lleva sus dos renglones nuevos.' },
      { tipo: 'mejora', texto: 'CÓMO SE LE LLAMA SE PUEDE CAMBIAR —encomendado, apartado, guardado— en El cuarto frío › Cuartos fríos y horarios. Esa es la palabra que sale impresa en el papelito, así que conviene que sea la que se usa ahí.' },
      { tipo: 'mejora', texto: 'El papelito dice YA ESTÁ PAGADO y lleva su raya para firmar al recogerlo. Sin esa línea el papel se parece a un ticket y alguien podría cobrarlo otra vez.' },
      { tipo: 'arreglo', texto: 'El nombre de la fábrica se iba disparado a la esquina de la pantalla en la caja de vender: el contador nuevo se llamaba igual que él por dentro. Ya no.' }
    ]
  },
  {
    numero: '4.4',
    nombre: 'El corte en dos columnas',
    fecha: '2026-09-03',
    resumen:
      'Dos cosas que estaban rotas —la cotización no se podía imprimir y el ' +
      'vale no dejaba hacerse—, el corte partido en dos columnas con el ' +
      'dinero y el hielo, el papel del hielo mucho más corto, y el vale ' +
      'también desde Vender.',
    cambios: [
      { tipo: 'arreglo', texto: 'LA COTIZACIÓN NO SE PODÍA IMPRIMIR. Sin impresora térmica salía en pantalla y ahí moría: el cliente venía por un papel con el precio y no había manera de dárselo. Ahora lleva su botón 🖨️ Imprimir y la saca por la impresora del navegador, igual que el ticket de una venta. Lo mismo la copia de cualquier ticket viejo desde el historial.' },
      { tipo: 'arreglo', texto: 'EL VALE NO DEJABA HACERSE, dijera lo que dijera el mensaje. La culpa fue mía: até el botón de vales a un renglón de «gastos que se repiten», que se puede dar de baja — y al darlo de baja, los vales dejaron de funcionar sin que nada lo dijera. Ahora los dos conceptos de vale se reviven solos si hacen falta, y en esa pantalla salen marcados 📤 Vale y ya no se pueden dar de baja. Cambiarles el nombre sí se puede.' },
      { tipo: 'nuevo', texto: 'EL VALE, TAMBIÉN DESDE VENDER. Tienes razón en que ahí es más rápido: quien llega a llevarse el efectivo llega al mostrador, no a la pantalla de Caja. El botón 📤 Vale está debajo de Meter dinero y Gasto, y es exactamente el mismo vale desde los dos sitios.' },
      { tipo: 'mejora', texto: 'EL CORTE, EN DOS COLUMNAS: el dinero a la izquierda y el hielo a la derecha. Son las dos cuentas del mismo turno y casi siempre se miran juntas —«cuadró el dinero pero faltó hielo» es una sola pregunta—; una debajo de otra había que rodar la pantalla para compararlas. Los dos papeles también salen lado a lado, y en un teléfono se apila todo solo.' },
      { tipo: 'mejora', texto: 'EL PAPEL DEL HIELO, MUCHO MÁS CORTO. Ahora solo dice qué paños salieron y QUIÉN LOS SACÓ, y cuántas marquetas se vendieron al público y cuántas a mayoreo. Es todo. Los pedazos uno por uno, las mermas por motivo y lo cortado para bolsas siguen contando —están restados arriba, en el cuadre— pero desglosarlos hacía un papel largo que nadie leía de pie.' },
      { tipo: 'mejora', texto: 'CUANDO SOBRA DINERO, EL NÚMERO SALE EN ÁMBAR. Ni rojo ni verde: rojo diría «falta», que es mentira, y verde diría «todo en orden», que tampoco. Que sobre no está bien, pero no es lo mismo que faltar.' },
      { tipo: 'mejora', texto: 'El botón de vale de la caja ocupa el ancho entero en vez de quedarse a media fila, y un vale más grande que lo que hay en el cajón pregunta si es correcto: casi siempre es un cero de más.' },
      { tipo: 'mejora', texto: 'Todo está en el manual, en Vender y en Caja.' }
    ]
  },
  {
    numero: '4.3',
    nombre: 'Los vales',
    fecha: '2026-09-03',
    resumen:
      'En la fábrica hay dos papelitos que se llaman igual y son opuestos: ' +
      'el que deja quien se lleva el efectivo, y el del trabajador que pide ' +
      'parte de su sueldo antes. Ahora cada uno tiene lo suyo, sale su papel ' +
      'firmado por duplicado, y el corte ya no los revuelve con la gasolina.',
    cambios: [
      { tipo: 'nuevo', texto: 'EL VALE DE RETIRO: cuando tú, un gerente o tu papá llegan y se llevan el efectivo para que las muchachas no tengan mucho dinero junto. Hay un botón propio en la caja —📤 Vale— que pregunta lo único que hace falta: quién se lo llevó y cuánto. Ese dinero NO CUENTA COMO GASTO de la fábrica: cambió de sitio, sigue siendo tuyo.' },
      { tipo: 'nuevo', texto: 'EL VALE SALE POR DUPLICADO. Uno se lo lleva quien recibió el dinero y otro se queda en el cajón, los dos con su raya para firmar y con el nombre de quien se lo llevó en grande. Con un solo papel, el día que alguien pregunte "¿y esos dos mil?" solo hay una versión, y es la del que la tiene en la mano.' },
      { tipo: 'importante', texto: 'LO ANOTA QUIEN ESTÁ EN LA COMPUTADORA, NO QUIEN SE LLEVA EL DINERO. Es el caso de verdad: tu papá llega, se lleva el efectivo y no toca la máquina. La cajera lo anota a nombre de él, y el papel sale con los dos nombres. Lo que NO puede hacer nadie es retirarse dinero a sí mismo: un retiro se lo lleva el dueño o un gerente, y el sistema no deja otra cosa.' },
      { tipo: 'nuevo', texto: 'EL VALE DE RAYA: el trabajador que pide por adelantado parte de su sueldo de la semana. Tienes razón en que el sueldo es gasto de la empresa, así que se cuenta como gasto el día que el dinero sale del cajón, UNA SOLA VEZ. Si el martes se lleva $400 de vale, el sábado se le paga su raya con $400 de menos: gastaste $1,500 en total, no $1,900.' },
      { tipo: 'nuevo', texto: 'Y POR ESO CADA QUIEN TIENE SU LIBRETA, en su ficha de La gente de la fábrica: cuánto se llevó, cuándo, y de qué turno salió. En la lista, junto a su nombre, sale «debe $400 de vales» — que es lo que se pregunta uno mirando esa pantalla el día de la raya. Cuando ya se le pagó de menos, un botón dice «ya se le descontó» y el recordatorio se apaga. Ese botón NO MUEVE UN PESO: el dinero salió el día del vale.' },
      { tipo: 'nuevo', texto: 'EL CORTE YA NO REVUELVE LOS GASTOS CON LOS VALES. Salían sumados en un solo renglón, y así un turno con mucha salida no dice si la fábrica gastó o si nada más movieron el dinero. Ahora son dos renglones —Gastos y Vales— en la pantalla y en el papel, y el desglose trae los vales en su propia columna CON EL NOMBRE de quien se llevó cada uno.' },
      { tipo: 'nuevo', texto: 'Y EL CORTE SUMA LO QUE DE VERDAD TE LLEGÓ DE ESE TURNO: «se llevaron $2,000 en vales + te entregaron $3,500 = $5,500». Un retiro a media mañana es dinero del mismo turno que ya está guardado: al final entregan menos porque ya se llevaron una parte, no porque falte.' },
      { tipo: 'mejora', texto: 'LAS BOLSAS, POR TAMAÑO. La que se sembró se llamaba «gourmet» y en realidad la de todos los días es la de 5 kg: ahora se llama así. La de 20 kg queda dada de baja esperando, y se da de alta sola el día que hagan una tanda, igual que pasó con la otra. Las que se compran entran como cualquier otra mercancía, sin tocar nada.' },
      { tipo: 'arreglo', texto: 'Anular un vale de raya anula también su renglón de la libreta: si se quedara vivo, el sábado se le descontaría un dinero que nunca salió. Y un vale que YA se descontó no se puede anular por detrás — eso dejaría al trabajador debiendo un sueldo que sí cobró.' },
      { tipo: 'mejora', texto: 'Los dos vales están explicados en el manual, en Caja y en La gente de la fábrica.' }
    ]
  },
  {
    numero: '4.2',
    nombre: 'El corte del hielo',
    fecha: '2026-09-03',
    resumen:
      'Faltaba lo más importante: el corte no decía si faltó hielo. Ahora ' +
      'sale su propio papel con el cuadre entero, los paños, quién los ' +
      'sacó y qué pedazos se vendieron. Y arreglos del uso diario.',
    cambios: [
      { tipo: 'nuevo', texto: 'EL CORTE YA DICE SI FALTÓ HIELO. Tenías razón: se anotaba el conteo, se modificaba la existencia y ahí moría. El corte enseñaba el dinero con todo detalle y del hielo no decía nada — cuando el hielo es el producto. Ahora hay un tercer papel, y lo mismo en la pantalla del corte: había + se produjo = TENÍA QUE HABER, menos lo vendido, lo derretido y lo cortado = debería quedar, contra lo que se contó = FALTA o SOBRA.' },
      { tipo: 'nuevo', texto: 'Y DEBAJO, DE DÓNDE SALIÓ CADA NÚMERO: los paños que se sacaron con su tanque y QUIÉN LOS SACÓ, cuántas marquetas entraron y cuántas se rompieron; qué pedazos se vendieron —3 octavos, 1 cuarto, 2 marquetas—; cuánto salió a mayoreo y cuánto al público; en qué se derritió lo que se derritió; y lo que se cortó para bolsas. Todo comparado desde el conteo anterior, como pediste.' },
      { tipo: 'mejora', texto: 'LOS PEDAZOS SE AGRUPAN POR SU TAMAÑO, no por su nombre. El mismo octavo se llama "1/8" cuando el cajero toca el botón y "Hielo" cuando teclea la fracción a mano: agrupando por nombre saldrían en dos renglones distintos siendo lo mismo.' },
      { tipo: 'importante', texto: 'UN TURNO QUE NO CONTÓ HIELO NO TIENE CUADRE, y lo dice en vez de imprimir un papel con todo en cero: eso haría creer que se contó y salió cero. Y todo esto se vuelve a ver cuando quieras desde Cortes, que es donde dijiste que ibas a estar consultando.' },
      { tipo: 'arreglo', texto: 'EN EL CONTEO DEL CUARTO FRÍO NO SE PODÍAN PONER 3/16 NI 11/16. Había una lista con unas cuantas fracciones sueltas, y con eso no se puede decir "1 y 3/16". Ahora está el teclado de siempre, el que SUMA: se toca 1/8, luego 1/16, y quedan 3/16. O se escribe tal cual, "25 y 3/16", como se dicta.' },
      { tipo: 'arreglo', texto: 'EL NÚMERO DEL HIELO NO SE ACTUALIZABA EN VIVO en la pantalla de vender: había que salir a Inicio y volver a entrar. Ahora baja con cada venta, y sale de la misma cuenta que los avisos de existencias — no hay dos números del mismo dato.' },
      { tipo: 'importante', texto: 'UN OPERARIO YA NO ELIGE QUIÉN SACÓ EL PAÑO: fue él, y su nombre sale escrito. Es la misma regla que en la caja, donde el cajero no escoge quién cobró. Un operario solo entra a mover tanques, y ponerle una lista con los nombres de sus compañeros era darle la opción de anotarle el trabajo a otro. El gerente y el administrador sí eligen, porque ellos capturan lo que les cantan.' },
      { tipo: 'mejora', texto: 'La temperatura de la salmuera dice ahora que es en GRADOS CENTÍGRADOS (°C): en el promedio, en cada casilla al capturarla y en las columnas del historial.' },
      { tipo: 'mejora', texto: 'Todo lo nuevo está en el manual, en Caja y en Producción de hielo.' }
    ]
  },
  {
    numero: '4.1',
    nombre: 'El corte se lo come todo',
    fecha: '2026-09-02',
    resumen:
      'Anotar la existencia y hacer el corte eran la misma cosa hecha dos ' +
      'veces. Ahora es un solo momento con cuatro pasos, el dinero no se ' +
      'cuenta al cerrar —se anota cuando se entrega—, el corte sale en dos ' +
      'papeles, y las bolsas de gourmet son un producto de verdad.',
    cambios: [
      { tipo: 'importante', texto: 'SE ELIMINÓ ANOTAR LA EXISTENCIA COMO PANTALLA APARTE. Tenías razón: era prácticamente el corte de caja. Se hacen al mismo tiempo, con la misma persona enfrente y con los mismos números en la boca, así que tener dos pantallas solo servía para que a veces se hiciera una y no la otra. Ahora al TERMINAR EL TURNO aparecen los cuatro pasos, en el orden en que se cantan: 1) qué paños se sacaron, 2) cuánto hielo queda en el cuarto frío, 3) si se cortó hielo para bolsas, 4) cuántas bolsas salieron.' },
      { tipo: 'importante', texto: 'Y EL PASO DE LOS PAÑOS ES LA PANTALLA DE PRODUCCIÓN ENTERA, no la página rápida: se toca cada paño y se anota como todos los días, canasta por canasta, con lo que le pasó a cada molde. Es la misma pantalla de siempre, no una parecida.' },
      { tipo: 'mejora', texto: 'POR DENTRO, EL ORDEN DE GUARDAR NO ES EL DE PREGUNTAR. Se pregunta como se canta —primero cuánto queda, luego si se cortó— pero se guarda el hielo cortado PRIMERO: el conteo se congela con la foto de lo que ya se había explicado, y si el corte de hielo entrara después, esas marquetas aparecerían como faltante.' },
      { tipo: 'importante', texto: 'EL DINERO YA NO SE CUENTA AL CERRAR EL TURNO. Como dijiste: los cortes son rápidos y se tiene que seguir atendiendo. Ahora sale el papel con LO QUE DEBERÍA HABER, el cajero entrega el cajón y sigue vendiendo. Cuando tú o el gerente reciben el dinero, lo cuentan y lo anotan en ese corte, y de ahí sale la diferencia.' },
      { tipo: 'importante', texto: 'MIENTRAS NADIE CUENTE, EL CORTE DICE "SIN CONTAR", no "cuadró exacto". Decir que cuadró cuando nadie ha contado sería inventarse justo el dato que falta. En la lista de Cortes sale arriba cuántos turnos están esperando que se anote su dinero, para que ninguno se quede olvidado.' },
      { tipo: 'nuevo', texto: 'ANOTAR LA ENTREGA es del gerente o del administrador, nunca del cajero: sería firmarse a sí mismo la entrega. Y no se puede anotar dos veces por descuido — para cambiarla hay que decir que se está corrigiendo.' },
      { tipo: 'nuevo', texto: 'EL CORTE SALE EN DOS PAPELES, como pediste. El primero es el del dinero, con espacio para la firma y una raya para escribir a mano lo que se entrega; los gastos van solo como TOTAL, con cuántos son. Corta el papel, y sale el segundo con los gastos y las entradas UNO POR UNO, con sus sumas. Son dos porque son de dos personas distintas: el primero se entrega con el cajón, el segundo se queda en la carpeta.' },
      { tipo: 'mejora', texto: 'Si el turno no tuvo ningún gasto ni entrada, el segundo papel no se imprime: media hoja en blanco que dice GASTOS es papel tirado todos los días.' },
      { tipo: 'nuevo', texto: 'LAS BOLSAS DE HIELO GOURMET SON UN PRODUCTO DE VERDAD. Me preguntaste dónde se guardan y dónde se suman: ahora tienen su lugar. Cortar marquetas no es perder hielo, es TRANSFORMARLO — sale del cuarto frío y entra al inventario como bolsas, y desde ahí se venden como cualquier otra cosa, restándose solas con cada venta.' },
      { tipo: 'importante', texto: 'LA BOLSA NACE DADA DE BAJA Y SIN PRECIO, y se da de alta sola con el primer corte que le meta bolsas. Sin precio porque inventárselo sería peor: se vendería mal el primer día sin que nadie se diera cuenta — hay que ponérselo en Productos y precios. Y de baja porque un producto con existencia en cero sale como AGOTADO en la caja, y una fábrica que todavía no corta hielo tendría ese aviso puesto para siempre.' },
      { tipo: 'nuevo', texto: 'CUÁNTO HIELO QUEDA, A LA VISTA. En Producción de hielo, grande, en el panel de la derecha: el operario que saca el hielo es a quien más le sirve saber si el cuarto está vacío, y era justo quien nunca lo tenía delante. Y en la pantalla de vender, junto al reloj, SOLO PARA EL ADMINISTRADOR — en el mostrador, con gente esperando, un número más que leer es un número más que estorba.' },
      { tipo: 'mejora', texto: 'LA PANTALLA DE EXISTENCIA SALIÓ DEL INICIO Y DEL MENÚ. Lo que quedaba de ella —mirar lo que hay, anotar lo derretido o roto, y revisar los conteos viejos— vive ahora dentro de PRODUCCIÓN DE HIELO, con el botón 🧊 El cuarto frío. Es donde está el hielo y donde está la gente que lo mueve.' },
      { tipo: 'mejora', texto: 'Todo esto está explicado en el manual, en Caja, en El cuarto frío y en Productos y precios.' }
    ]
  },
  {
    numero: '4.0',
    nombre: 'Una sola manera de anotar el hielo',
    fecha: '2026-09-02',
    resumen:
      'Fuera el botón de "Registrar lo que se sacó": hacía lo mismo que ' +
      'tocar el paño pero peor. Los nombres de los tanques, grandes. Y a ' +
      'los gastos ya se les puede sacar otra copia.',
    cambios: [
      { tipo: 'importante', texto: 'SE QUITÓ EL BOTÓN DE "REGISTRAR LO QUE SE SACÓ". Tenías razón: hacía prácticamente lo mismo que tocar el paño, pero peor — no dejaba escoger canasta por canasta, ni decir qué le pasó a un molde suelto, ni mandar una cáscara al condensador. Tener dos maneras de anotar lo mismo solo servía para que la mitad de las veces se anotara por la que menos cuenta. Ahora hay UNA: se toca el paño y ahí está todo.' },
      { tipo: 'mejora', texto: 'LOS NOMBRES DE LOS TANQUES, GRANDES, y el del tanque en el que estás más grande todavía y en azul. Anotar en el tanque que no es cuesta un paño entero y no se descubre hasta el día siguiente: el nombre tiene que verse desde donde estás parado, no leerse de cerca.' },
      { tipo: 'mejora', texto: 'Y AL ABRIR UN PAÑO, el nombre del tanque va en el título junto al número —"N(A) · Paño 3"—, que es donde de verdad se está anotando.' },
      { tipo: 'nuevo', texto: 'A LOS GASTOS Y A LAS ENTRADAS SE LES PUEDE SACAR OTRA COPIA, con el 🖨 de su renglón en la caja, o con el botón Copia en el historial. El papel se pierde, se moja, o hace falta uno para quien se llevó el dinero y otro para la carpeta.' },
      { tipo: 'importante', texto: 'La copia sale marcada ** COPIA ** hasta arriba, igual que la de un ticket: un comprobante sin marcar puede pasar dos veces por la misma carpeta y contarse dos veces al cuadrar el mes. Y NO vuelve a abrir el cajón — el dinero ya se movió cuando se anotó el gasto.' },
      { tipo: 'mejora', texto: 'En el historial, el botón de Copia ya no es solo de las ventas: sale en todo lo que tenga papel. En un abono por transferencia no sale, porque ese no pasó por el cajón y no imprimió nada — un botón que siempre falla es peor que no tenerlo.' }
    ]
  },
  {
    numero: '3.9',
    nombre: 'Corregir un corte, y el historial de un vistazo',
    fecha: '2026-09-02',
    resumen:
      'Cuando a la cajera se le olvidó anotar un gasto, el administrador ' +
      'puede agregárselo al corte ya firmado y el faltante desaparece — ' +
      'quedando escrito qué decía antes, quién lo corrigió y por qué. Y el ' +
      'historial abre con atajos de tiempo.',
    cambios: [
      { tipo: 'nuevo', texto: 'YA SE PUEDE CORREGIR UN CORTE YA FIRMADO. El caso completo, tal como pasa: a la cajera se le olvidó anotar la gasolina, cerró su turno, el cajón salió $200 corto y ahí quedó escrito un faltante que no existió. Al día siguiente llega con el ticket en la mano. Hasta hoy no había nada que hacer. Ahora, en Historial de cortes, los ⋯ de cada renglón abren la pantalla de corregir: se le agrega ese gasto —o se le quita uno que no era— y el corte se vuelve a sacar solo.' },
      { tipo: 'importante', texto: 'LO QUE SE CONTÓ NO SE TOCA. Ese es el dinero que había en el cajón cuando se contó, y no lo cambia ningún ticket que aparezca después. Lo que cambia es lo que DEBÍA haber, y con ello la diferencia — que es justo el número que estaba mal.' },
      { tipo: 'importante', texto: 'Y LO QUE DECÍA EL PAPEL FIRMADO SE GUARDA. Un corte corregido enseña LAS DOS CIFRAS: la que decía cuando se firmó y la que dice ahora, con quién lo corrigió, cuándo y por qué. Sin eso, quien guardó su copia impresa vería dos números distintos y no habría manera de saber cuál vale. Corregirlo dos veces no pisa lo original: lo del papel sigue siendo lo del papel.' },
      { tipo: 'importante', texto: 'ES SOLO DEL ADMINISTRADOR Y PIDE MOTIVO. Ni el gerente puede: anular un movimiento del turno abierto es trabajo del día, pero esto toca un papel que ya se firmó y cambia un faltante que ya se dio por bueno. El motivo es obligatorio y queda escrito en el corte.' },
      { tipo: 'mejora', texto: 'El gasto que se agrega lleva LA FECHA DE ESE TURNO, no la de hoy: ahí fue donde pasó, y con la fecha de hoy se iría al mes en curso, donde no ocurrió nada. Y queda marcado como agregado después, para que al reimprimir el corte se distinga de los renglones que sí estaban en el papel.' },
      { tipo: 'mejora', texto: 'Quitarle un gasto a un corte NO LO BORRA (regla 3.4): queda tachado con su motivo y deja de contar. Así después se puede entender qué pasó con ese corte.' },
      { tipo: 'nuevo', texto: 'EL HISTORIAL ABRE CON ATAJOS DE TIEMPO: hoy, últimas 24 horas, últimos 7 días y últimos 30 días. "Hoy" y "las últimas 24 horas" NO son lo mismo, y por eso están los dos: a las diez de la mañana, hoy son diez horas y las últimas 24 llegan hasta ayer a las diez, donde estuvo el turno de la tarde. Cuando algo no cuadró, la pregunta casi siempre es la segunda.' },
      { tipo: 'nuevo', texto: 'Y EL BOTÓN DE ORDENAR POR QUIÉN, que junta los renglones de cada persona SIN esconder a nadie. Es distinto de escoger a alguien en el selector de Quién, que sí deja fuera a los demás: a veces lo que se quiere es comparar los dos turnos, no mirar uno.' },
      { tipo: 'mejora', texto: 'Los filtros están ahora en dos filas con su etiqueta —DE CUÁNDO arriba y QUÉ abajo—, que es el orden en que se preguntan.' },
      { tipo: 'mejora', texto: 'Todo esto está en el manual, en Caja y en Historial.' }
    ]
  },
  {
    numero: '3.8',
    nombre: 'La gente y los clientes, con cara',
    fecha: '2026-09-02',
    resumen:
      'Los empleados salen agrupados por trabajo y cada ficha dice lo que ' +
      'esa persona ha hecho en el mes. Y los clientes pueden llevar su ' +
      'logo, con la ficha rediseñada alrededor de quién es y cuánto debe.',
    cambios: [
      { tipo: 'nuevo', texto: 'LA PANTALLA DE USUARIOS AHORA SE LLAMA LA GENTE DE LA FÁBRICA Y VA PARTIDA POR TRABAJOS: operarios, cajeros, repartidores, gerentes y administradores, cada apartado con cuántos hay y qué hace ese trabajo. Los roles no son cinco categorías iguales, son cinco trabajos distintos, y quien abre esta pantalla casi siempre viene a buscar a alguien de UNO de ellos: con una lista alfabética esa pregunta se contestaba leyéndola entera.' },
      { tipo: 'nuevo', texto: 'Y CADA FICHA DICE LO QUE ESA PERSONA HA HECHO en los últimos treinta días: los paños que sacó y cuándo fue el último, lo que vendió y en cuántos tickets, los turnos de caja que abrió, la última vez que entró al sistema y desde cuándo está en la fábrica. Antes decía nombre y rol, y con eso no se contestaba ninguna de las preguntas que uno se hace mirando esa lista.' },
      { tipo: 'mejora', texto: 'A CADA QUIEN LO SUYO: a un operario no se le enseña cuánto vendió, porque no vende, ni a un repartidor cuántos paños sacó. Las mismas cinco casillas para todos, con tres en cero, es peor que no enseñar ninguna: los ceros se leen como si algo estuviera mal.' },
      { tipo: 'mejora', texto: 'UN RENGLÓN POR PERSONA, con su inicial en un círculo de color. Con la ficha alta de antes, seis empleados llenaban la pantalla y no se podían comparar dos de un vistazo.' },
      { tipo: 'mejora', texto: 'Al elegir el rol de alguien, debajo se dice QUÉ VA A PODER HACER. "Gerente de turno" no le dice a nadie qué va a poder tocar esa persona.' },
      { tipo: 'nuevo', texto: 'LOS CLIENTES PUEDEN LLEVAR SU LOGO O SU FOTO. Un mayorista es una tienda con rótulo. Se le pone con el botón de la cámara en la esquina de su retrato, y desde entonces aparece con él en la lista. Es opcional: quien no tenga logo se queda con la inicial de su nombre en un círculo de color, y el color sale del propio nombre, así que es siempre el mismo para el mismo cliente — que es justo lo que lo hace útil para reconocerlo de reojo.' },
      { tipo: 'importante', texto: 'EL LOGO SE GUARDA EN LA CARPETA DATOS, igual que las fotos de los productos y el recibo de la luz: actualizar el sistema no se lo lleva. Y no se acepta cualquier archivo con nombre de imagen: se mira la firma de los primeros bytes, que es lo que de verdad distingue una foto de otra cosa.' },
      { tipo: 'mejora', texto: 'LA FICHA DEL CLIENTE, REDISEÑADA. Arriba, juntos y grandes, QUIÉN ES Y CUÁNTO DEBE: son la misma pregunta y se miran a la vez. Debajo su teléfono, que desde la tablet se toca para marcarle — es lo primero que uno busca cuando alguien debe. Y sus datos en dos bloques en vez de una tira: quién es y dónde está por un lado, su crédito y su precio por otro. Son dos cosas distintas y se tocan en momentos distintos.' },
      { tipo: 'mejora', texto: 'En la lista, el nombre grande es el DEL NEGOCIO cuando lo tiene, y abajo el de la persona. Al mayorista se le busca por su tienda, no por su apellido.' },
      { tipo: 'mejora', texto: 'Las dos pantallas están explicadas en el manual, con un apartado nuevo para la gente de la fábrica.' }
    ]
  },
  {
    numero: '3.7',
    nombre: 'El recibo de luz completo, y el IVA que nos deben',
    fecha: '2026-09-02',
    resumen:
      'El recibo de la CFE deja de ser un total: se le anotan la lectura ' +
      'del medidor, los kilowatts de base, intermedia y punta, la demanda ' +
      'y el IVA. Y una pantalla nueva lleva la cuenta de cuánto IVA falta ' +
      'por recuperar, que hasta hoy estaba en la memoria de alguien.',
    cambios: [
      { tipo: 'nuevo', texto: 'EL RECIBO DE LUZ AL DETALLE. Como la fábrica es GDMTH peninsular, el mismo kilowatt cuesta distinto según la hora: base la madrugada (la barata), intermedia casi todo el día, y punta la tarde (la cara, y por mucho). Ahora se anotan los kWh de cada franja, y los pesos de cada una si el recibo los desglosa. Guardando solo el total, el recibo decía cuánto se pagó y nada más; con las franjas separadas se puede contestar lo que de verdad vale en una fábrica de hielo: si conviene mover producción de horario.' },
      { tipo: 'nuevo', texto: 'LA LECTURA DEL MEDIDOR, la anterior y la de ahora, con su multiplicador. Es lo único que permite comprobar el recibo contra el aparato de la pared: el sistema multiplica y compara con lo que cobraron, y si no cuadra lo dice. Si la CFE dice cuarenta mil kilowatts y el medidor no los da, hay algo que reclamar — y ahora se ve en la pantalla, no después.' },
      { tipo: 'mejora', texto: 'MIENTRAS SE ESCRIBEN LAS FRANJAS, la pantalla va diciendo si las tres suman los kilowatts del recibo. Cuando no suman casi siempre es un dedazo o una franja que se quedó sin capturar, y decirlo con el papel todavía en la mano no cuesta nada. Se puede guardar así de todos modos: un recibo capturado a medias vale más que uno no capturado.' },
      { tipo: 'mejora', texto: 'TODO ESTO ES OPCIONAL Y VA PLEGADO, en una sección que se abre con ＋. La captura de siempre siguen siendo cuatro datos: si al abrir salieran doce casillas parecería que hacen falta las doce. En la tabla, el botón ⌄ de cada renglón abre el detalle debajo — no se pusieron como columnas nuevas porque esa tabla contesta la pregunta de todos los días, cuánta luz cuesta cada marqueta, y con ocho columnas más dejaría de leerse de un vistazo.' },
      { tipo: 'nuevo', texto: 'EL IVA, EN SU PROPIA PANTALLA. Dijiste "a veces ya no se sabe qué IVA nos deben", y ese es exactamente el problema que resuelve. Se anota el IVA de cada recibo de luz y el de cada factura de gasto grande, y por otro lado lo que Hacienda devuelve —con su fecha, su periodo, su folio y su papel—. Arriba sale la resta: lo pagado menos lo devuelto es LO QUE FALTA POR RECUPERAR.' },
      { tipo: 'importante', texto: 'ESE NÚMERO NO SE GUARDA EN NINGÚN LADO: se saca de los papeles cada vez que se abre la pantalla. Por eso corregir un recibo o anular una devolución lo corrige solo, sin que nadie tenga que acordarse de ajustar un saldo. Es la misma regla de siempre en este sistema: los totales se calculan, no se guardan.' },
      { tipo: 'importante', texto: 'Y SI FALTAN PAPELES POR CAPTURAR, LA PANTALLA LO DICE. Mientras haya recibos o gastos sin su IVA anotado, avisa cuántos son y advierte que lo que falta por recuperar es CUANDO MENOS eso, no exactamente eso. Vale más un número honesto con su advertencia que uno redondo que miente.' },
      { tipo: 'mejora', texto: 'EL IVA DE LOS GASTOS GRANDES SE ESCRIBE TAL COMO LO DICE LA FACTURA, no calculado como el 16 %: hay compras con partidas exentas o a tasa cero donde no lo es. Y no se acepta un IVA mayor que lo que se pagó.' },
      { tipo: 'mejora', texto: 'AÑO POR AÑO, abajo. Ahí la diferencia de cada año se lee con cuidado y la pantalla lo explica: las devoluciones llegan tarde y casi siempre caen en el año siguiente al del gasto, así que un año puede verse en rojo y el siguiente en verde sin que falte ni sobre nada. El número que vale es el acumulado de arriba.' },
      { tipo: 'mejora', texto: 'Cuando un dato del recibo viene mal escrito, el aviso dice CUÁL es —"el factor de potencia", "los kWh de punta"—. Con doce casillas, "algún número está mal" no ayuda a nadie.' },
      { tipo: 'mejora', texto: 'Todo esto está explicado en el manual, en Las cuentas de la empresa: qué es cada franja, para qué sirve el multiplicador y cómo se lleva la cuenta del IVA.' }
    ]
  },
  {
    numero: '3.6',
    nombre: 'Las dos temperaturas',
    fecha: '2026-09-02',
    resumen:
      'La de afuera, que se toma de internet sola y se va guardando, junto ' +
      'al reloj de la caja. Y la de la salmuera de los tanques, con sus ' +
      'tres tomas y su promedio, para cuando alguien se acuerda de medirla.',
    cambios: [
      { tipo: 'nuevo', texto: 'LA TEMPERATURA DE AFUERA, JUNTO AL RELOJ DE LA CAJA. En una fábrica de hielo el clima es materia prima: en mayo, cuando calientan los tanques, el hielo no se forma por más días que pase en el molde, y cuando llueve mucho sale sellado sin que nadie haya hecho nada distinto. Tenerla a la vista mientras se cobra la deja ligada a los días buenos y a los malos sin que nadie apunte nada.' },
      { tipo: 'importante', texto: 'Y SE VA GUARDANDO SOLA, una medida por hora. Ese dato no estaba en ninguna parte, y dentro de un año, mirando un mes malo, no habría manera de saber si hizo calor. Ahora cuando haga falta ya va a existir.' },
      { tipo: 'importante', texto: 'SI NO HAY INTERNET NO PASA ABSOLUTAMENTE NADA. La fábrica vende hielo sin internet, así que el clima es un dato de más y nunca una condición: la llamada lleva reloj y si no contesta se abandona, se enseña la última que se pudo tomar diciendo de cuándo es, y si nunca se pudo tomar ninguna simplemente no se enseña. No sale ningún error. Y si un día hace falta, se puede escribir a mano mirando el termómetro de la pared.' },
      { tipo: 'nuevo', texto: 'LA TEMPERATURA DE LA SALMUERA, en el panel de Producción de hielo. Tres tomas —cerca de los serpentines, en la salida más cercana y en la más lejana— y el sistema saca el promedio. Sin horario ninguno: se anota cuando se mide, que es cuando alguien se acuerda. El panel dice cuándo fue la última vez de ese tanque, y adentro está la lista de todas las anteriores con quién las tomó.' },
      { tipo: 'mejora', texto: 'El promedio de la salmuera NO se guarda: se saca de las tres tomas cada vez que se mira. Un promedio guardado es un número que puede dejar de cuadrar con los suyos el día que alguien corrija una toma.' },
      { tipo: 'importante', texto: 'OJO CON ESTO, TONY: la llamada a internet NO se pudo probar de verdad, porque la computadora donde te escribo tiene bloqueado ese servicio. Todo lo demás está probado —el reloj, el guardado, qué pasa cuando falla— con un servicio de mentira. La primera vez que abras la caja en la fábrica, dime si sale la temperatura o no, y si no sale lo arreglo con lo que veas.' }
    ]
  },
  {
    numero: '3.5',
    nombre: 'Lo que estaba roto y lo que estorbaba',
    fecha: '2026-09-02',
    resumen:
      'El botón de anotar un gasto grande no funcionaba. Las listas de ' +
      'mayoreo ya se pueden dar de baja. Y "cada cuánto se compra" deja de ' +
      'preguntarse: el sistema lo mide de las compras que ya hay.',
    cambios: [
      { tipo: 'arreglo', texto: 'EL BOTÓN DE ANOTAR UN GASTO GRANDE NO ABRÍA NADA. Se quedaba muerto, sin aviso ni explicación. Era un renglón mal copiado del formulario de los recibos de luz que reventaba el formulario entero antes de pintarlo. Ya funciona. De paso quedó hecho un barrido que aprieta todos los botones de todas las pantallas buscando fallas de este tipo: esta era la única.' },
      { tipo: 'nuevo', texto: 'LAS LISTAS DE MAYOREO YA SE PUEDEN DAR DE BAJA. Se crean para probar precios de temporada y luego estorban en la caja, donde cada lista de más es un botón más que leer con gente esperando. Antes de confirmar se dice a cuántos clientes afecta —esos pasan al mayoreo normal— y las ventas viejas no cambian una coma: el precio quedó copiado en cada ticket. La última que quede no se puede quitar, porque sin ninguna la caja no sabría qué cobrarle a un mayorista.' },
      { tipo: 'importante', texto: 'YA NO SE PREGUNTA CADA CUÁNTO SE COMPRA CADA COSA. Tenías razón: entre un cilindro de amoniaco y el siguiente pueden pasar quince días o dos años, así que preguntarlo era pedir una adivinanza y después creérsela para repartir el costo por marqueta de todos los meses. Ahora se MIDE de las compras que se van anotando —dos bastan— y se corrige solo con cada una nueva. En la tabla sale "suele ser cada tantos días", y el 👁 enseña las fechas de cada compra.' },
      { tipo: 'mejora', texto: 'LAS CUENTAS DE LA EMPRESA, ORDENADAS: el título y su explicación a la izquierda, y los tres botones —Gastos grandes, Recibos de luz, Proveedores— a la derecha, uno debajo del otro. Antes empujaban media pantalla hacia abajo mientras sobraba todo el hueco de la derecha.' },
      { tipo: 'mejora', texto: 'EN PROVEEDORES, "QUÉ HACE" Y "SUS MAÑAS" DEJARON DE SER DOS CUADRITOS. Son la parte que de verdad vale de ese directorio —lo que uno sabe de tratar con alguien y nadie más tiene apuntado— y estaban metidos en tres renglones mientras sobraba media pantalla. Ahora se escriben en dos cuadros grandes, lado a lado, y en la ficha salen con su etiqueta y su propio recuadro.' },
      { tipo: 'importante', texto: 'DAR DE ALTA UN GASTO QUE SE REPITE ES AHORA COSA DEL ADMINISTRADOR, no del gerente. No es capturar un gasto —eso lo sigue haciendo el cajero todos los días— sino decidir CÓMO se suma el mes: un concepto de más ("Desayunos" y "Desayuno muchachos") parte la estadística en dos y ya no se junta, que es justo lo que estos conceptos vinieron a evitar.' },
      { tipo: 'arreglo', texto: 'Por dentro: el ritmo entre compras se contaba con un día de más. Comprando el 1 y el 91 pasaron 90 días, no 91.' }
    ]
  },
  {
    numero: '3.4',
    nombre: 'Anotar la existencia, en el orden en que se canta',
    fecha: '2026-09-02',
    resumen:
      'El conteo del cuarto frío deja de ser una pregunta suelta y pasa a ' +
      'ser tres pasos en el orden real: primero los paños que se sacaron, ' +
      'luego el hielo que se cortó para gourmet, y al final cuánto quedó.',
    cambios: [
      { tipo: 'nuevo', texto: 'EL BOTÓN AHORA DICE "ANOTAR LA EXISTENCIA" y no empieza preguntando cuánto hielo queda. EMPIEZA POR LOS PAÑOS, y el orden no es capricho: el operario llega y canta las dos cosas juntas —los números que sacó y cuánto quedó—. Anotando el conteo primero, la producción de esa jornada todavía no está capturada y el cuadre sale mal: parece que SOBRA hielo, cuando lo que falta es el registro.' },
      { tipo: 'nuevo', texto: 'PASO 2: ¿SE CORTÓ HIELO? Hay temporadas en que se agarran marquetas del cuarto frío y se cortan para hacer hielo gourmet en bolsas. Esas salen de la existencia sin pasar por la caja y sin haberse derretido: DEJAN DE SER MARQUETAS. Hasta hoy el sistema no tenía dónde ponerlas y aparecían dentro del FALTANTE, revueltas con lo derretido y con lo que se fue sin pagar. En temporada, el corte decía que faltan cuarenta marquetas y nadie sabía si era robo o era trabajo.' },
      { tipo: 'nuevo', texto: 'LAS BOLSAS SE ANOTAN SI SE CONTARON, y si no, se dejan vacías en vez de guardar un cero que mañana parecería un dato. Todavía no son un producto del sistema —lo serán—, pero el día que lo sean ese número va a hacer falta, y ya no se puede ir a buscar hacia atrás.' },
      { tipo: 'importante', texto: 'EL PASO 3 YA NO TE DICE CUÁNTO DEBERÍA HABER antes de que anotes tu número, y esto es un cambio de fondo: antes el cuadrito venía relleno con el número esperado. Con ese número a la vista, contar se vuelve confirmar —se aprieta aceptar, el cuadre da cero siempre— y el conteo deja de servir para lo único que sirve, que es descubrir lo que no cuadra. El número sale enseguida, en el resultado, cuando ya no puede influir en nadie. Si lo prefieres como antes, se cambia en un renglón.' },
      { tipo: 'arreglo', texto: 'DOS NÚMEROS DE LA MISMA PANTALLA NO PODÍAN CUADRAR ENTRE SÍ. "Debería quedar" ya descontaba lo derretido, pero "Falta" solo restaba lo vendido: el hielo que alguien anotaba como derretido volvía a aparecer como faltante. Ahora los dos hablan de lo mismo, y FALTA es exactamente lo que NADIE explicó.' },
      { tipo: 'mejora', texto: 'El renglón del hielo cortado sale en la tarjeta del cuarto frío, en el cuadre del conteo y en el papel de la térmica. Y el conteo se guarda su copia de lo derretido y lo cortado, para que corregir algo viejo no cambie un corte que ya se firmó.' },
      { tipo: 'mejora', texto: 'POR DENTRO: la pantalla de "registrar lo que se sacó" ahora vive en un solo sitio y la usan las dos —Producción de hielo y el paso 1 de la existencia—. Copiada dos veces sería una pantalla que tarde o temprano se comporta de dos maneras distintas.' }
    ]
  },
  {
    numero: '3.3',
    nombre: 'Configurar tanques, donde le toca',
    fecha: '2026-09-02',
    resumen:
      'Los tanques se dan de alta una vez y no se vuelven a tocar en años. ' +
      'Ese acceso salió del inicio y del menú, y se fue a la tuerca de ' +
      'Producción de hielo, que es donde hace falta.',
    cambios: [
      { tipo: 'mejora', texto: 'CONFIGURAR TANQUES SALIÓ DEL INICIO Y DEL MENÚ RÁPIDO. En más de treinta años no ha habido un tanque nuevo: un acceso permanente para algo que se usa una vez en la vida estaba ocupando el sitio de lo que sí se usa todos los días. Ahora se entra por la TUERCA ⚙ de arriba a la derecha, en Producción de hielo, junto a las pestañas de los tanques.' },
      { tipo: 'mejora', texto: 'Y "Producción" pasa a llamarse PRODUCCIÓN DE HIELO, que es lo que es.' },
      { tipo: 'mejora', texto: 'LA PANTALLA DE CONFIGURAR TANQUES, ORDENADA: todo centrado y con un ancho de lectura —se abre una vez cada muchos años, no tiene por qué llenar un monitor— y con su botón para volver a Producción de hielo.' },
      { tipo: 'arreglo', texto: 'EL TANQUE Y SUS "⋯" YA SE VEN COMO DOS COSAS, que es lo que son. Antes iban pegados, como si el botoncito fuera parte de la ficha del tanque, y confundía: uno lleva a ver y configurar ese tanque, el otro abre la lista de lo que se le puede hacer. Ahora hay aire entre los dos y el de los puntos es un botón redondo aparte.' }
    ]
  },
  {
    numero: '3.2',
    nombre: 'Las canastas que quedaron pendientes',
    fecha: '2026-09-02',
    resumen:
      'Un paño no siempre sale de un jalón: a veces se saca una canasta y ' +
      'no se toca la siguiente hasta que esa se gasta. Ahora eso se puede ' +
      'registrar tal cual, retomarlo al día siguiente con otro turno, y ' +
      'sale impreso en el papel del operario.',
    cambios: [
      { tipo: 'nuevo', texto: 'SACAR CANASTA POR CANASTA. En la pantalla del paño cada canasta trae su casilla: desmarca las que hoy no vas a sacar y el botón cambia a «Sacar 2 canastas». Las demás quedan pendientes. Sacar el paño entero sigue siendo un solo toque, como siempre: desmarcar es la excepción.' },
      { tipo: 'importante', texto: 'Y CON ESO EL PAÑO QUEDA A MEDIAS, que quiere decir que NADIE PUEDE PASAR AL SIGUIENTE hasta terminarlo. En la lista sale con lo que falta —"faltan 3 de 4 canastas, lo empezó Chema"— en vez de con la fecha de la última vez, porque eso es lo único que hay que hacer con ese paño.' },
      { tipo: 'nuevo', texto: 'AL DÍA SIGUIENTE SE RETOMA SOLO. Se entra al mismo paño y aparecen únicamente las canastas que faltan; las de ayer se ven marcadas con un ✓, con quién las sacó y a qué hora, y ya no se pueden volver a registrar. CADA CANASTA GUARDA SU PROPIO RESPONSABLE: si Chema sacó una y Juan las otras tres, el papel del día lo dice, y la ficha del paño los nombra a los dos.' },
      { tipo: 'importante', texto: 'ESO ERA UN AGUJERO DE VERDAD, no una comodidad. Al sacar una canasta se rellena en el mismo movimiento, así que al ratito vuelve a verse "congelando": sin llevar la cuenta de cuáles ya salieron, terminar un paño a medias habría vuelto a registrar las canastas de ayer e inventado marquetas que nadie sacó.' },
      { tipo: 'nuevo', texto: 'EL PAPEL DEL OBRERO LO DICE. "Números a sacar" ahora imprime PAÑO 3 A MEDIAS: FALTAN 2 DE 4 CANASTAS, y quién lo empezó. Antes decía "a medias: 3" y había que ir a contar canastas al tanque.' },
      { tipo: 'arreglo', texto: 'Y de paso, ese mismo papel PERDÍA LA FILA DE TODA LA JORNADA cuando había un paño a medias: la cuenta de la rotación se quedaba quieta, en la segunda vuelta salía otra vez el mismo número, se detectaba repetido y el papel se quedaba con un solo paño. Ya sale la lista completa, con el de a medias primero.' },
      { tipo: 'mejora', texto: 'Si el hielo que falta YA NO VA A SALIR, no se borra: se saca marcándolo por lo que es —aguada, se rompió, lo que haya pasado— y con eso el paño se cierra y la rotación avanza. Un paño abandonado a medias trabaría el tanque para siempre.' }
    ]
  },
  {
    numero: '3.1',
    nombre: 'Lo que faltaba del hielo, y la pantalla ordenada',
    fecha: '2026-09-02',
    resumen:
      'Dos estados más del hielo y una salida de emergencia para lo que no ' +
      'está en la lista; cualquier paño se puede mirar sin pedirle permiso ' +
      'a nadie; y las dos pantallas de producción reordenadas para que quepa ' +
      'lo que hay que ver sin bajar.',
    cambios: [
      { tipo: 'importante', texto: 'ANTES QUE NADA, UN NÚMERO MAL PUESTO: la versión anterior salió como "2.10" y eso no existe. Después de la 2.9 viene la 3.0, igual que después de la 0.9 viene la 1.0. Ya quedó como 3.0, y esta es la 3.1. No cambia una sola línea del programa: solo el número.' },
      { tipo: 'nuevo', texto: 'DOS ESTADOS MÁS DEL HIELO. AGUADA: no congeló nada, sale agua del molde. No es "muy hueca", es que NO HAY MARQUETA — y por eso una aguada no cuenta ni para el costo: no se puede repartir el gasto entre marquetas que no existen. SALADA O CONTAMINADA: se rompió el molde y le entró salmuera, se oxidó el fondo, o le cayó algo. Puede estar perfectamente congelada; el problema no es el frío, es el molde. No se toma, pero a veces se vende a quien solo quiere enfriar.' },
      { tipo: 'nuevo', texto: 'Y "OTRA COSA", PARA LO QUE NO ESTÁ EN LA LISTA. Una lista cerrada, el día que pasa algo que no está en ella, obliga a mentir: se elige lo más parecido y la verdad se pierde. Ahora se escribe qué pasó, con tus palabras, y queda guardado con el paño. Sin ese texto no se guarda: un "otro" en blanco no dice nada dentro de un año. Y si resulta que ese "otro" se repite treinta veces, ahí estará la razón para volverlo un estado propio.' },
      { tipo: 'mejora', texto: 'LAS QUE PIDEN DESTINO PASAN DE UNA A TRES: cáscara, contaminada y "otra cosa". De las tres depende que el conteo del cuarto frío cuadre. La aguada es la única que no lo pide: de ahí no salió nada que mandar a ningún lado.' },
      { tipo: 'nuevo', texto: 'CUALQUIER PAÑO SE PUEDE MIRAR SIN PERMISO DE NADIE. Antes, tocar un paño que no era el que tocaba pedía el PIN antes de enseñar nada, y eso estaba mal para lo que más se hace: ver un molde en rojo y querer saber qué le pasó. Mirar no cambia nada. Ahora cada paño tiene un OJO al lado que abre su historia —cuándo se sacó la última vez, quién, cuántas horas llevaba, cómo salió cada molde y las veces anteriores— y el PIN se pide desde dentro, con el botón de Desbloquear, cuando de verdad se va a sacar.' },
      { tipo: 'nuevo', texto: 'CADA PAÑO DICE SU HISTORIA EN EL RENGLÓN: cuándo se sacó la última vez, quién lo sacó (el nombre de pila, como se llaman en la fábrica) y cuántas horas llevaba congelando. Antes había que entrar paño por paño para saberlo, y era lo primero que uno pregunta.' },
      { tipo: 'mejora', texto: 'LA PANTALLA DE PRODUCCIÓN, REORDENADA. "Números a sacar" pasa a primero y a la izquierda —es lo que más veces al día se aprieta— con "Registrar lo que se sacó" a su derecha, en el MISMO renglón: dos botones grandes uno encima del otro se comían media pantalla sin decir nada más. Y la tecla F2 saca los números sin buscar el botón.' },
      { tipo: 'nuevo', texto: 'UN PANEL AL LADO DE LOS PAÑOS, donde antes había hueco vacío: cómo está el tanque ahora mismo (listos, congelando, a medias, fuera), cuántos moldes vienen saliendo peor que sus vecinos, y cómo salió el hielo de hoy en toda la fábrica con su barra de colores. En el celular se va abajo solo.' },
      { tipo: 'mejora', texto: 'LA PANTALLA DEL PAÑO, APRETADA. El botón de volver, el número y los datos van ahora en UN renglón en vez de tres. "¿Quién lo sacó?" se angostó —los nombres son cortos— y al lado, en el hueco que dejó, está "¿Cómo salió el hielo?". Y el resultado y los botones de sacar comparten renglón, con el resultado más chico. Todo eso son renglones de canastas que se ven sin bajar la pantalla.' },
      { tipo: 'mejora', texto: 'Los ocho estados salen de cuatro en cuatro y no de ocho en fila: seguidos salían tan angostos que "Saladas o contaminadas" se partía en tres renglones, y en una pantalla táctil el dedo agradece el ancho. Y "Corregir" quedó plegado: es lo raro, no lo de todos los días.' },
      { tipo: 'arreglo', texto: 'El nombre de pila ya no se come los tratamientos: "Don Chema" es Chema, no "Don". Con la primera palabra a secas, media plantilla se llamaba igual.' }
    ]
  },
  {
    numero: '3.0',
    nombre: 'Cómo salió el hielo',
    fecha: '2026-09-02',
    resumen:
      'El sistema sabía tres cosas del hielo —salió, se rompió, salió ' +
      'hueca— y la fábrica distingue cinco. Ahora al sacar un paño se dice ' +
      'cómo salió, con un toque, y ese dato aparece en la pantalla del día, ' +
      'en la hoja de los números y en el corte impreso.',
    cambios: [
      { tipo: 'nuevo', texto: 'LOS CINCO ESTADOS DEL HIELO, con las palabras de la fábrica: 100% SELLADAS (bien congeladas, el centro cerrado a tope: salen cuando llueve mucho, cuando no hay venta, o cuando las máquinas están congelando muy bien), NORMALES (casi selladas o les falta poquito; con estas no hay quejas), UN POCO HUECAS (del 70% al 60%: con una noche más hubieran quedado mejor, y alguna gente se queja), HUECAS (el centro casi atraviesa, y algunas sí lo hacen: la gente se queja pero por necesidad se la lleva) y CÁSCARAS (30% de congelación o menos, con los laterales delgados).' },
      { tipo: 'importante', texto: 'POR QUÉ IMPORTA ANOTARLO. Una marqueta hueca SE COBRA IGUAL que una sellada, así que en el dinero no se nota: se nota en las quejas del mostrador, y esa información se perdía el mismo día. Ahora queda escrita. Cuando la mezcla se corre hacia lo hueco varios días seguidos, algo está pasando —el amoniaco, un compresor, el calor de mayo— y se ve ANTES de que una máquina se pare.' },
      { tipo: 'nuevo', texto: 'SE PREGUNTA UNA VEZ POR PAÑO, no doce veces. La fábrica congela bien o mal esa noche y el paño sale parejo, así que se dice cómo salió TODO el paño de un toque; si un molde salió distinto del resto, se toca ese molde y se elige lo suyo. Y como el sistema pone NORMALES solo, el día de siempre no cuesta ni un toque de más.' },
      { tipo: 'importante', texto: 'LAS CÁSCARAS AHORA LLEVAN DESTINO: a los condensadores (lo normal, para enfriarlos), al cuarto frío (cuando hay demanda y se van a vender más baratas) o se botó. Una cáscara costó lo mismo que una sellada —la misma agua, la misma luz, el mismo molde— así que CUENTA para el costo por marqueta; lo que no hace es contar como hielo del cuarto frío. Si contara, el conteo no cuadraría nunca y andarías buscando marquetas que no existen.' },
      { tipo: 'nuevo', texto: 'NINGUNA PANTALLA ENSEÑA EL TOTAL SOLO. Junto al número va siempre la MEZCLA, en una barra de colores: dos días con las mismas marquetas pueden ser un buen día y uno malo, y lo que los separa es el reparto. Sale en "Lo de hoy", en la hoja de "Los números" y en el corte de turno impreso. En papel la barra sale en grises, de claro (bien) a oscuro (mal), para que se lea igual en la impresora en blanco y negro.' },
      { tipo: 'mejora', texto: 'CAMBIÓ LA REGLA DEL MOLDE QUE FALLA, y para bien. Antes se marcaba el molde que no saliera "bien"; ahora se marca el que salió PEOR QUE EL RESTO DE SU PROPIO PAÑO. La diferencia se ve en mayo: cuando calientan los tanques no sale una sola marqueta sellada en toda la fábrica, y con la regla vieja la pantalla se habría pintado entera de rojo señalando cien moldes que no tienen nada. Con la nueva, la noche mala no señala a nadie y el molde que sale cáscara mientras sus vecinos salen normales queda marcado al instante — que es justo el aviso que sirve para ir a revisarlo.' },
      { tipo: 'mejora', texto: 'EN LA HOJA DE LOS NÚMEROS, "salieron buenas" se partió en dos números que antes se confundían: SALIERON DEL MOLDE (todo el hielo que se hizo, cáscaras incluidas: es lo que costó agua, luz y amoniaco) y SIN UNA SOLA QUEJA (el porcentaje que salió sellado o normal). El costo por marqueta ahora se divide entre lo producido, cáscaras incluidas, porque también costaron.' },
      { tipo: 'arreglo', texto: 'De paso, en el papel del corte el total de marquetas ROTAS del día salía en cero aunque cada paño sí las enseñara en su renglón — la peor forma de estar mal, porque parece que cuadra. Ya suma, y hay una prueba que vigila que el papel cuadre consigo mismo.' },
      { tipo: 'importante', texto: 'LO QUE YA ESTABA CAPTURADO NO SE PIERDE NI SE INVENTA. Lo que decía "salió bien" pasó a NORMAL, que es lo que quería decir, y lo que decía "hueco" pasó a HUECA. Lo que no se puede es adivinar hacia atrás qué fue sellada y qué cáscara, y no se adivina: nadie lo estaba anotando.' }
    ]
  },
  {
    numero: '2.9.1',
    nombre: 'Que los números cuadren',
    fecha: '2026-09-02',
    resumen:
      'Seis cosas que estaban mal en la pantalla de los números recién ' +
      'estrenada: la más grave, que el botón de imprimir la hoja mandaba el ' +
      'reporte a la impresora de tickets sin preguntar, y que dos números de ' +
      'la misma hoja no cuadraban entre sí.',
    cambios: [
      { tipo: 'arreglo', texto: 'IMPRIMIR LA HOJA NO FUNCIONABA EN LA VENTANA DEL PROGRAMA. El sistema se abre con la impresión directa puesta —eso es lo que hace que los tickets salgan solos, sin preguntar nada— y por eso el reporte se iba a la impresora de tickets sin dar oportunidad de elegir ni de guardar el PDF. Ahora, en esa ventana, el botón abre el sistema en el navegador de siempre y desde ahí sí deja elegir impresora o "Guardar como PDF".' },
      { tipo: 'arreglo', texto: 'LA TARJETA DE ARRIBA NO CUADRABA CON LAS BARRAS DE ABAJO. Decía "se fue en gastos" y enseñaba el número repartido, mientras que las barras de "en qué se fue el dinero" sumaban lo que de verdad se pagó: sumando las barras con el dedo no daba. Ahora la tarjeta dice "Salió de la caja" y es exactamente la suma de las barras; el número repartido sigue donde le toca, en el costo por marqueta.' },
      { tipo: 'importante', texto: 'EL MISMO GASTO YA NO SE CUENTA DOS VECES. "Mantenimiento" existe en la caja y en las cuentas de la empresa: si el plomero cobra en efectivo, el cajero lo anota y el administrador captura la factura del mismo trabajo, eran dos gastos. Ahora, cuando la factura dice de qué salida del cajón salió, esa salida deja de contarse — manda la factura, que trae el papel. Y en la gráfica, dos gastos con el mismo nombre salen marcados con de dónde vienen.' },
      { tipo: 'arreglo', texto: 'La hoja carta no estaba tomando sus márgenes: heredaba los del ticket, que son cero, y el navegador le recortaba las orillas al imprimir.' },
      { tipo: 'mejora', texto: 'En la nota de las ventas ahora también sale cuánto entró de ABONOS: dinero de ventas fiadas de otros meses, que no suma en lo vendido de este pero sí entró al cajón.' },
      { tipo: 'mejora', texto: 'Por dentro: la función que se había escrito para acelerar los recibos de luz tenía el mismo error que venía a arreglar y leía la producción entera; "quién sacó cuántos paños" también. Los dos ya usan su índice, y de paso ese número quedó contando por la misma fecha que las marquetas del mes — antes eran dos fechas distintas y podían no cuadrar.' }
    ]
  },
  {
    numero: '2.9',
    nombre: 'Los números',
    fecha: '2026-09-02',
    resumen:
      'Una hoja que contesta las preguntas del dueño —cómo nos fue, en qué ' +
      'se fue el dinero, cuánto cuesta una marqueta, vamos mejor o peor— ' +
      'con la explicación de cada número al lado, y que se imprime en hoja ' +
      'carta tal como se ve.',
    cambios: [
      { tipo: 'nuevo', texto: 'PANTALLA NUEVA: LOS NÚMEROS (📊). No es un tablero de esos con lucecitas: es una HOJA que se lee de arriba abajo, en el orden en que uno se hace las preguntas. Cómo nos fue este mes, qué días se vendió, cuánto cuesta una marqueta, en qué se fue el dinero, cuánto hielo se hizo y quién, y si vamos mejor o peor que antes.' },
      { tipo: 'nuevo', texto: 'CADA NÚMERO LLEVA SU EXPLICACIÓN debajo, en castellano de todos los días: qué es, de dónde sale y para qué sirve. Un número que hay que preguntarle a alguien qué significa no sirve para decidir nada.' },
      { tipo: 'importante', texto: 'CUÁNTO CUESTA UNA MARQUETA, y salen DOS números a propósito. Un cilindro de amoniaco cuesta $38,500 y enfría tres meses: cargárselo entero al mes que se pagó hace que ese mes se vea carísimo y los dos siguientes baratísimos, sin que en la fábrica haya pasado nada. Así que cada compra se reparte sobre los días que dura —los que ya dice su ficha— y sale el costo de un MES NORMAL, que es el que sirve para comparar. Al lado sale lo que de verdad se pagó ese mes, que es el que dice si alcanzó.' },
      { tipo: 'importante', texto: 'Y SE DICE LO QUE EL NÚMERO NO TRAE: la raya no está en el sistema, así que lo que de verdad cuesta una marqueta es más. Sirve para comparar meses y para vigilar, no para sacar el precio de venta. Un mes al que le falte el recibo de la luz sale marcado como incompleto, en vez de salir falsamente barato.' },
      { tipo: 'nuevo', texto: 'SE IMPRIME EN HOJA CARTA con el botón de arriba, y sale como se ve: sin el menú, sin los botones, en blanco y negro para no gastar tinta, y sin que una gráfica se parta a la mitad entre dos hojas. Para guardarla en PDF se elige "Guardar como PDF" en el mismo cuadro de impresión — no hace falta nada más.' },
      { tipo: 'arreglo', texto: 'De paso se arregló que imprimir cualquier pantalla normal sacaba una hoja EN BLANCO: el sistema estaba puesto para que al imprimir saliera solo el ticket de la térmica, y eso se comía todo lo demás.' },
      { tipo: 'nuevo', texto: 'TRES GRÁFICAS, dibujadas por el propio sistema sin librerías de fuera: las ventas día por día (con los domingos marcados), en qué se fue el dinero de mayor a menor, y los últimos doce meses. La del costo por marqueta es una línea porque lo que hay que leer ahí es la inclinación, no la altura — y la pantalla lo dice, porque esa línea no empieza en cero a propósito.' },
      { tipo: 'mejora', texto: 'EL GERENTE TAMBIÉN LOS VE. Es quien puede hacer algo con ellos en su turno: si el hielo se está echando a perder o una máquina empezó a gastar de más, lo atiende el mismo día.' },
      { tipo: 'mejora', texto: 'POR DENTRO: la pantalla se abrirá igual de rápido dentro de tres años con medio millón de renglones. Los periodos se traducen una vez a instantes para que los índices sirvan, se agregaron cuatro índices por fecha, y la tabla de recibos de luz dejó de recorrer la producción entera una vez POR RECIBO — ahora la recorre una sola vez para todos.' }
    ]
  },
  {
    numero: '2.8',
    nombre: 'El día del arranque',
    fecha: '2026-09-01',
    resumen:
      'Todo lo que hace falta para pasar de probar el sistema a usarlo de ' +
      'verdad: la puesta en marcha que cuadra el sistema con la realidad, ' +
      'las cotizaciones que no son venta, y el directorio de proveedores — ' +
      'el principio del manual de la fábrica.',
    cambios: [
      { tipo: 'nuevo', texto: 'LA PUESTA EN MARCHA (🚀, en Sistema, solo administrador). El día que el sistema entre a trabajar de verdad, se le dice cómo está el mundo real: qué paños llevan horas congelando y cuáles están fuera, cuál fue el último que se sacó (la rotación), el primer conteo del hielo, los productos y el dinero del cajón. Casi todo son las herramientas de siempre, enlazadas en orden.' },
      { tipo: 'importante', texto: 'BORRAR LOS DATOS DE PRUEBA, una sola vez. Las ventas y sacadas de ensayo se borran para que los números del negocio empiecen limpios; se quedan usuarios, tanques, productos, precios, clientes y TODA la bitácora. Antes de borrar se hace un respaldo solo, pide escribir BORRAR PRUEBAS y la contraseña del administrador, y en cuanto se da por hecha la puesta en marcha, el botón desaparece para siempre. El primer ticket real vuelve a ser el #1.' },
      { tipo: 'nuevo', texto: 'CUADRAR CON LA REALIDAD, para después: el apagón, la semana que nadie capturó. La misma captura de paños queda para siempre, pero cada uso exige su motivo, queda firmado en la bitácora y la pantalla dice cuántas veces se ha usado. Los paños fijados así NUNCA inventan marquetas: la producción solo cuenta lo que de verdad se registró.' },
      { tipo: 'nuevo', texto: 'SOLO COTIZACIÓN (📋, en la caja). Se arma el ticket normal y en vez de cobrar se toca "Solo cotización": sale el papel con los precios de HOY, la leyenda PRECIOS SUJETOS A CAMBIO SIN PREVIO AVISO y la fecha. No es una venta: sin folio, sin abrir el cajón, sin tocar la existencia y sin entrar al corte. Si lleva mayoreo, pide el nombre del cliente y cotiza con SU lista.' },
      { tipo: 'nuevo', texto: 'PROVEEDORES (📒, en las cuentas de la empresa). El directorio de la fábrica: quién es cada proveedor, QUÉ HACE y para qué sirve, teléfono, dirección, horarios y sus mañas. Es el principio del manual del negocio: escrito aquí, no se lo lleva nadie en la cabeza. Al capturar un gasto grande, el nombre del proveedor se sugiere solo del directorio.' },
      { tipo: 'mejora', texto: 'El gerente ve el directorio de proveedores; editarlo es del administrador.' }
    ]
  },
  {
    numero: '2.7.1',
    nombre: 'Los arreglos del estreno',
    fecha: '2026-09-01',
    resumen:
      'Los detalles que salieron al probar la v2.7: el ojito del historial ' +
      'ahora enseña el ticket con forma de ticket, el paño se ve en una ' +
      'sola fila como está en el tanque, y las listas se pueden limpiar de ' +
      'verdad sin borrar ni un registro.',
    cambios: [
      { tipo: 'mejora', texto: 'EL OJITO DEL HISTORIAL ENSEÑA EL TICKET, con su forma de ticket: papel blanco, la misma letra, los mismos renglones que salen por la impresora. No es una imagen —son los datos del propio ticket— así que abre al instante, y desde ahí mismo se saca la copia.' },
      { tipo: 'mejora', texto: 'EL PAÑO SE VE EN UNA SOLA FILA, con sus canastas una al lado de la otra, igual que está metido en el tanque. Así quien anota no se confunde de renglón.' },
      { tipo: 'mejora', texto: 'EN "QUIÉN LO SACÓ" SOLO SALEN LOS OPERARIOS —sacar paños es su trabajo— más la opción "Otro…" para escribir el nombre del eventual de un día, o del patrón. El nombre queda guardado tal cual, y aparte queda siempre quién lo anotó.' },
      { tipo: 'mejora', texto: 'LAS LISTAS SE PUEDEN LIMPIAR DE VERDAD. Un concepto dado de baja ahora se puede borrar de la lista para siempre (✕), en la caja y en las cuentas de la empresa. NO se borra ningún registro: sus gastos siguen en el historial y siguen sumando; solo desaparece el renglón que estorbaba. Lo puede hacer el gerente o el administrador.' },
      { tipo: 'mejora', texto: 'LOS RECIBOS DE LUZ SE PUEDEN CORREGIR (✎), no solo anular: se abre el formulario con los datos capturados, se corrige el que estaba mal y listo. Por dentro el renglón viejo queda anulado con la nota "corregido" y se guarda el bueno, para que siempre se pueda ver qué decía antes.' },
      { tipo: 'mejora', texto: 'EN UNA LAPTOP EL HISTORIAL Y LAS TABLAS ANCHAS USAN LA PANTALLA COMPLETA. En un monitor muy panorámico se quedan centradas con un tope, porque leer renglones de tres mil píxeles es peor que un margen.' },
      { tipo: 'arreglo', texto: 'Las cuentas de la empresa ya salen en la pantalla de inicio (🏦) y ya se pueden crear conceptos nuevos desde ahí mismo.' },
      { tipo: 'arreglo', texto: 'La pantalla de las cuentas de la empresa no se podía rodar hasta abajo; los últimos renglones quedaban escondidos.' }
    ]
  },
  {
    numero: '2.7',
    nombre: 'Las cuentas de la empresa',
    fecha: '2026-08-29',
    resumen:
      'El dinero grande —el que nunca pasa por el cajón— ya tiene dónde ' +
      'anotarse: el amoniaco, la sal, los barriles de aceite, la ' +
      'maquinaria y el recibo de la luz. Y el mes del negocio ya se puede ' +
      'partir donde de verdad empieza, no donde diga el calendario.',
    cambios: [
      { tipo: 'nuevo', texto: 'PANTALLA NUEVA: LAS CUENTAS DE LA EMPRESA (🏭). Ahí van los gastos que no salen del cajón. La caja sigue siendo la caja: esto no la toca, no le mueve el arqueo y no le cambia un peso al corte del turno.' },
      { tipo: 'nuevo', texto: 'EL MES EMPIEZA DONDE USTED DIGA. Si su recibo de luz va del 12 al 12, ponga 12 y todo el sistema cuenta los meses así. Del 1 al 28: del 29 en adelante no se puede porque febrero no tiene esos días.' },
      { tipo: 'nuevo', texto: 'CADA GASTO GRANDE SE ANOTA CON SU CANTIDAD Y SU UNIDAD: un cilindro de amoniaco, tres sacos de sal, medio barril de aceite. Por eso el sistema puede decir cuánto costó LA UNIDAD y contestar si el barril está subiendo, en vez de solo cuánto se pagó.' },
      { tipo: 'nuevo', texto: 'CUÁNDO FUE LA ÚLTIMA VEZ Y CUÁNTO HACE. El sistema aprende solo cada cuánto se compra cada cosa —lo saca de sus propias compras, no de una tabla— y avisa "toca pronto" cuando ya pasó más tiempo del que suele pasar. No es una alarma; es un recordatorio de mirarlo.' },
      { tipo: 'nuevo', texto: 'LOS RECIBOS DE LA CFE, CON SUS KILOWATTS. Se captura el papel con sus fechas de verdad, sus kWh y lo que se pagó. El sistema saca solo el precio del kilowatt, cuánto por día, cuánto contra el recibo anterior y —el número que importa en una fábrica de hielo— CUÁNTA LUZ CUESTA CADA MARQUETA.' },
      { tipo: 'nuevo', texto: 'SE LE PUEDE PEGAR EL PDF O LA FOTO al gasto y al recibo. Los papeles se guardan en la carpeta de datos, así que una actualización del programa no se los lleva.' },
      { tipo: 'importante', texto: 'EL DINERO QUE SOLO CAMBIA DE SITIO YA NO SE CUENTA DOS VECES. Un retiro a la caja fuerte salió del cajón, pero la fábrica no lo gastó. Si con ese mismo efectivo se paga el amoniaco y el amoniaco se anota aquí, sería el mismo peso contado dos veces. Ahora los conceptos se marcan "gasto" o "solo cambia de sitio" y los totales salen partidos.' },
      { tipo: 'mejora', texto: 'La luz sale también en el total del mes, repartida por días cuando el recibo queda a caballo entre dos meses. Y si todavía faltan días sin recibo, la pantalla lo dice en vez de presumir un total que va a subir.' },
      { tipo: 'mejora', texto: 'Un gasto anotado mal se anula con su motivo y quién lo anuló; no se borra (regla 3.4). El mismo recibo de la CFE no se puede capturar dos veces: partiría en dos los kWh por marqueta.' },
      { tipo: 'mejora', texto: 'El gerente ve todas estas cuentas; capturarlas es del administrador. Son facturas de decenas de miles de pesos: no es trabajo de turno.' }
    ]
  },
  {
    numero: '2.6',
    nombre: 'El ticket chico',
    fecha: '2026-08-29',
    resumen:
      'Los mismos papeles, con una cuarta parte menos de papel. Nada de ' +
      'lo que dicen se perdió: se quitaron los renglones que decían dos ' +
      'veces lo mismo o que no decían nada.',
    cambios: [
      { tipo: 'importante', texto: 'TODOS LOS TICKETS BAJARON UN 24% DE PAPEL. Una venta pasa de 60 a 48 mm, un ticket de mostrador de 54 a 39, y el corte del turno de 123 a 84. Se imprimen cientos al día: eso son metros al mes.' },
      { tipo: 'mejora', texto: 'En una térmica el ALTO es lo que cuesta y el ancho es gratis: una letra a doble alto se come dos renglones de papel y a doble ancho, uno. Así que los números grandes ahora son anchos en vez de altos. Se ven igual de grandes y valen la mitad.' },
      { tipo: 'mejora', texto: 'Quién estaba en la caja y a qué hora eran dos renglones y son el mismo dato: ahora van juntos. Con un nombre largo se separan solos antes que recortarle el nombre a nadie.' },
      { tipo: 'mejora', texto: 'PAGANDO JUSTO ya no se imprime "PAGO $17 · CAMBIO $0". Era el total otra vez y un cero: dos renglones para no decir nada, en el papel que más se imprime. Cuando sí hay cambio, los dos números van juntos en un renglón.' },
      { tipo: 'mejora', texto: 'La raya para firmar era cuatro renglones —dos en blanco, la raya y su letrero—. Ahora es uno: el letrero delante y la raya hasta la orilla. Se firma SOBRE la raya, así que hay más sitio para firmar que antes, no menos.' },
      { tipo: 'mejora', texto: 'EN EL CORTE: la hora de cierre salía dos veces, el total de gastos salía dos veces, y cada bloque gastaba una raya y un título. Ahora el título va dentro de la raya —"-- GASTOS (3) ------"— y quién cerró va delante de la raya que va a firmar.' },
      { tipo: 'mejora', texto: 'El papel del conteo se arma como todos los demás: qué es arriba a la izquierda, quién y cuándo a la derecha, el negocio abajo. Era el único que se había quedado con la cabecera vieja de cinco renglones.' },
      { tipo: 'nuevo', texto: 'SE PUEDE AJUSTAR EL AVANCE ANTES DE CORTAR, en Sistema. La cuchilla está uno o dos centímetros por encima de donde imprime, y la orden de cortar ya le dice a la impresora "avanza hasta donde cortas": muchas no necesitan ni un renglón, y ahí son 12 mm menos POR TICKET. Se queda en 4 de fábrica porque hay impresoras que cortan donde están: baja el número, imprime una prueba y mira el papel.' },
      { tipo: 'arreglo', texto: 'Tres renglones se salían del papel y la impresora los partía por donde le tocaba: el nombre de un cliente largo, un desglose con cifras grandes y un producto de nombre largo. Ahora se parten por palabras o se recortan a lo que cabe.' },
      { tipo: 'arreglo', texto: 'En el corte, la hora de apertura salía cortada a la mitad ("08:00 a") y decía "1 cancelados".' }
    ]
  },
  {
    numero: '2.5',
    nombre: 'Los gastos de siempre y el turno relevado',
    fecha: '2026-08-26',
    resumen:
      'Los gastos que se repiten se tocan en vez de escribirse, y a fin de ' +
      'mes se pueden sumar. El corte sale con el hielo y los paños del día, ' +
      'y con un papel por cada quien si el turno se relevó.',
    cambios: [
      { tipo: 'nuevo', texto: 'GASTOS QUE SE REPITEN. El desayuno de los muchachos es todos los días y nunca es igual. Se da de alta una vez y el cajero lo toca: pone la cantidad y listo. En Caja › Gastos que se repiten se administran.' },
      { tipo: 'importante', texto: 'Lo que se gana no es escribir menos: es que los cien desayunos del mes se llamen IGUAL. Escrito a mano quedaban "Desayuno", "desayunos" y "DESAYUNO", que son tres conceptos y ninguna estadística. Ahí ya se ve cuánto lleva cada uno este mes.' },
      { tipo: 'mejora', texto: 'Renombrar un concepto no parte su historia en dos: los gastos viejos siguen sumando ahí, y sus comprobantes siguen diciendo lo que decían el día que se firmaron. Darlo de baja tampoco borra nada.' },
      { tipo: 'nuevo', texto: 'EL GASTO RARO SE SIGUE ESCRIBIENDO. "Otro" está ahí para el plomero de una vez: obligar a dar de alta un concepto para eso sería peor que el problema.' },
      { tipo: 'importante', texto: 'EL TURNO QUE SE RELEVA. Si se va la luz y el turno queda abierto, y a la mañana otro cajero pone su PIN y sigue vendiendo, el corte ya no sale solo a nombre del primero: sale un papel POR CADA QUIEN con lo suyo, además del corte del turno. El arqueo no se parte, porque el dinero del cajón es uno solo.' },
      { tipo: 'nuevo', texto: 'AL CERRAR EL TURNO SALE TODO SOLO: el corte que se firma, el papel de cada cajero si hubo relevo, y el resumen del día con cuánto hielo queda y qué paños se sacaron. Juntos, porque juntos es como se leen: si el cajón cuadra pero falta hielo, el problema no está en la caja.' },
      { tipo: 'mejora', texto: 'El corte se apretó: mismo contenido, menos renglones. De estos salen dos o tres al día.' },
      { tipo: 'arreglo', texto: 'LOS ACENTOS EN LA IMPRESORA. Error viejo y silencioso: el texto se mandaba en una tabla de letras y a la impresora se le pedía otra. "Cuarto frío" salía "Cuarto frÝo". Ya salen bien la í, la ñ, la é, los signos de apertura y todo lo demás.' }
    ]
  },
  {
    numero: '2.4',
    nombre: 'Listas que se pueden leer',
    fecha: '2026-08-26',
    resumen:
      'El historial se abre con lo de hoy y no con diez años de golpe, se ' +
      'ordena tocando la columna y cada renglón dice qué pasó. Y el cajón ' +
      'ya se abre con el ticket, no por su cuenta.',
    cambios: [
      { tipo: 'importante', texto: 'EL HISTORIAL SE ABRE CON LO DE HOY. Dentro de tres años va a haber cientos de miles de renglones y abrirlo no puede querer decir "tráemelos todos". Lo de más atrás se pide con el botón de abajo, que va anexando de cien en cien, o poniendo fechas.' },
      { tipo: 'nuevo', texto: 'SE ORDENA TOCANDO LA COLUMNA: por número, por qué fue, por fecha, por quién o por importe. Ordena lo que ya está cargado, así que "de lo más viejo a lo más nuevo" te enseña las siete de la mañana de hoy y no la primera venta de hace diez años.' },
      { tipo: 'importante', texto: 'CADA RENGLÓN DICE QUÉ PASÓ: Venta, Mayoreo, Fiado, Cambio, Devolución, Cancelada, Gasto, Entrada o Abono, con su color. Antes había que deducirlo leyendo la columna de al lado.' },
      { tipo: 'arreglo', texto: 'El número de ticket ya se ve completo. Con "2026-152125" salía "202…", que es justo el dato por el que se busca.' },
      { tipo: 'nuevo', texto: 'El ojito de cada renglón abre el movimiento entero, con sus renglones y su motivo. Y todo lo que se recorta con puntos suspensivos enseña el texto completo al pasarle el ratón encima.' },
      { tipo: 'nuevo', texto: 'SUENA CADA COSA QUE ENTRA AL TICKET, no solo el cobro. El cajero no está mirando la pantalla mientras captura: está viendo al cliente.' },
      { tipo: 'importante', texto: 'EL CAJÓN VA PEGADO AL TICKET. Antes el pulso se mandaba al cobrar, aparte: con la impresora apagada el cajón no se abría igual —el pulso se lo manda ella— y al reimprimir ya no se abría. Ahora viaja con los bytes del papel: si sale ticket, se abre. Y cada vez que se imprime, no solo la primera.' },
      { tipo: 'nuevo', texto: 'El comprobante de un gasto también abre el cajón: de ahí hay que sacar los billetes.' },
      { tipo: 'arreglo', texto: 'EL TICKET DE UN CAMBIO ya dice cuánto se le devuelve al cliente. Antes salía "TOTAL $132 · PAGO $132 · CAMBIO $0", que es verdad para la caja y mentira para el cliente, que trajo un vale de $314 y se lleva $182.' },
      { tipo: 'nuevo', texto: 'LOS NÚMEROS A SACAR salen por la impresora térmica, con el paño que toca en grande y su raya para firmar. Ya no sale la ventana de imprimir del navegador. Y pueden tener su propia impresora, en el cuarto de tanques.' },
      { tipo: 'mejora', texto: 'Los gastos y el dinero del cajón enseñan los del día, no los últimos cuarenta cruzando días. Hay un botón para ver los anteriores.' },
      { tipo: 'arreglo', texto: 'ESC cierra el menú de la derecha, como todo lo demás que se abre encima. Y cada apartado del menú lleva su dibujito.' },
      { tipo: 'arreglo', texto: 'En la lista de tickets de la caja, cada uno lleva su etiqueta de qué es y el número completo.' }
    ]
  },
  {
    numero: '2.3',
    nombre: 'Como se construye un ticket',
    fecha: '2026-08-26',
    resumen:
      'Todos los papeles del negocio se arman igual: qué es arriba a la ' +
      'izquierda, quién y cuándo arriba a la derecha. Y los cuadros de ' +
      'Vender ya se pueden hacer más grandes o más chicos.',
    cambios: [
      { tipo: 'importante', texto: 'EL TICKET SE REHIZO ENTERO, con la forma de la foto que mandaste. El número arriba a la izquierda, y a la derecha quién estaba en la caja y la fecha con el mes en letras: 26/Ago/2026 5:45pm. Abajo el nombre del negocio.' },
      { tipo: 'mejora', texto: 'El hielo sigue en grande, pero ahora su desglose lleva el precio al final, con puntitos que llevan el ojo de un lado al otro del renglón. Igual cada artículo, con cuántos eran.' },
      { tipo: 'mejora', texto: 'TOTAL, PAGO y CAMBIO van juntos abajo a la derecha y en columna: los pesos quedan uno debajo del otro y el cambio se comprueba de un vistazo.' },
      { tipo: 'mejora', texto: 'LA MARCA DE COPIA se ve de lejos: dos rayas de asteriscos de lado a lado y la palabra en grande, hasta arriba de todo, antes que el número.' },
      { tipo: 'nuevo', texto: 'Los tickets que son un cambio ahora lo dicen: "CAMBIO DEL #2026-152124" hasta abajo. Sin eso, un cambio se veía igual que una venta.' },
      { tipo: 'importante', texto: 'EL COMPROBANTE DE GASTO ya no dice "lo tomó" ni "lo anotó". Dice quién estaba en el turno de caja —de ese cajón salió el dinero— y nada más. Los dos nombres siguen guardados en la bitácora, que es donde se buscan cuando hacen falta.' },
      { tipo: 'nuevo', texto: 'EN EL HISTORIAL DE CONTEOS, tocar un renglón ya no lanza la anulación. Ahora hay tres botones a la izquierda: 👁 para volver a ver el cuadre de aquel día, 🖨 para reimprimirlo y 🗑 para anularlo. El bote de basura solo le sale al gerente y al administrador.' },
      { tipo: 'nuevo', texto: 'EL TAMAÑO DE LOS CUADROS DE VENDER se elige en Personalizar: cuántas columnas y cuántas filas quieres ver de una vez, de 2 a 10 columnas y de 1 a 8 filas. Con su dibujito de cómo va a quedar mientras lo tecleas.' },
      { tipo: 'arreglo', texto: 'El "×" de un desglose como "2 × 1/4" salía en la impresora como una cruz de rayitas. Ese y las comillas curvas ya se cambian por los de máquina de escribir antes de imprimir.' },
      { tipo: 'arreglo', texto: 'En un ticket de mayoreo, el renglón del precio decía "undefined" en vez del nombre de la lista.' },
      { tipo: 'arreglo', texto: 'Pagar justo ya sale en el ticket como "CAMBIO: $0". Antes se escondía el renglón y parecía que faltaba algo.' }
    ]
  },
  {
    numero: '2.2',
    nombre: 'El número del año, y actualizar solo',
    fecha: '2026-08-26',
    resumen:
      'Los tickets se numeran por año —2026-412— y vuelven a empezar cada ' +
      '1 de enero. Y el sistema se actualiza subiendo un archivo ZIP.',
    cambios: [
      { tipo: 'importante', texto: 'EL TICKET AHORA SE LLAMA 2026-412. El número vuelve a empezar en 1 cada 1 de enero, así que nunca se hace ridículamente grande. Y se dice fácil por teléfono, que es para lo único que sirve un número de ticket.' },
      { tipo: 'nuevo', texto: 'Se busca como lo digas: "2026-412" o solo "412". Vale en la caja (F3), en el historial y en los cambios de ticket.' },
      { tipo: 'importante', texto: 'Por dentro cada venta sigue teniendo su folio de siempre, que NO se reinicia nunca: es lo que amarra un cambio con otro y un ticket con su corte. Reiniciar ese habría sido cambiarle la identidad a papeles ya firmados.' },
      { tipo: 'nuevo', texto: 'ACTUALIZAR EL SISTEMA DESDE UN ZIP. En Sistema, escoges el archivo que te mande y listo. Antes de instalar te enseña qué versión trae y cuántos archivos va a reemplazar: nadie debería apretar "actualizar" a ciegas.' },
      { tipo: 'importante', texto: 'TUS DATOS NO SE TOCAN. Ventas, clientes, cortes y precios viven en la carpeta datos, que la actualización nunca abre. Aun así, antes de cambiar nada se hace un respaldo, y la versión anterior se guarda por si hay que volver a ella.' },
      { tipo: 'nuevo', texto: 'El ZIP se revisa antes de tocar el disco: que sea del sistema y no de otro programa, que traiga código de verdad, y que ningún archivo intente salirse de la carpeta.' },
      { tipo: 'mejora', texto: 'Sirve igual el ZIP hecho con el clic derecho de Windows, que mete todo dentro de una carpeta: el sistema se la quita solo.' }
    ],
    siguiente: 'v2.3 — Estadísticas, gráficas, recibos de CFE y gastos grandes de la empresa.'
  },
  {
    numero: '2.1',
    nombre: 'El cajón, el sonido y las devoluciones',
    fecha: '2026-08-26',
    resumen:
      'El cajón se abre solo, la caja hace ruido cuando algo entra, y se ' +
      'le puede devolver el dinero completo a un cliente.',
    cambios: [
      { tipo: 'arreglo', texto: 'ARREGLADO: el cajón del dinero no se abría. El interruptor estaba en configuraciones desde hace meses, pero el comando nunca se mandaba. Ahora sí, y se abre al COBRAR en efectivo, no al imprimir: el ticket solo sale si alguien lo pide y el cajón hace falta siempre.' },
      { tipo: 'nuevo', texto: 'Si tu cajón no abre con eso, en Sistema se puede cambiar la SALIDA del conector (la 2 o la 5). Hay un botón para abrirlo ahí mismo y probar.' },
      { tipo: 'nuevo', texto: 'DEVOLVER EL DINERO COMPLETO. En la lista de tickets, el botón ↩. Se escoge por qué —se cansó de esperar, llevaba prisa, el hielo no estaba bien— y el sistema cancela el ticket, regresa el hielo al cuarto frío, ajusta la caja y abre el cajón.' },
      { tipo: 'importante', texto: 'Y el caso que se olvida: si el ticket es de un turno YA CERRADO, el dinero entró otro día pero sale del cajón de HOY. Queda anotado como salida para que el arqueo no salga corto.' },
      { tipo: 'nuevo', texto: 'SONIDO. Un ruidito cuando algo se acepta y otro cuando algo falla, y uno especial al cobrar. En el mostrador el cajero no está mirando la pantalla cuando aprieta enter: está viendo al cliente. Se enciende y se apaga en Personalizar, y se guarda en cada aparato.' },
      { tipo: 'arreglo', texto: 'ARREGLADO: con una marqueta de mayoreo (1m) en el ticket, apretar enter para repetir metía una marqueta NORMAL. Ahora repite lo mismo que agregaste.' },
      { tipo: 'arreglo', texto: 'ARREGLADO: en la lista de clientes solo se veía el botón "Fiarle", así que no parecía posible ponerle nombre a una venta de contado. Volvió el botón "Es él".' },
      { tipo: 'mejora', texto: 'EL CORTE Y LOS CONTEOS ya salen por la impresora de tickets, sin la ventana de impresión del navegador. Solo se cae al navegador si no hay impresora puesta.' },
      { tipo: 'nuevo', texto: 'Y CADA COSA PUEDE IR A SU IMPRESORA: tickets de venta, corte de caja, comprobantes de gasto y conteos. Vacío quiere decir "la de tickets", que es lo que casi siempre se quiere.' },
      { tipo: 'mejora', texto: 'La pantalla de Sistema se acomodó en dos columnas: a la izquierda lo que se toca, a la derecha lo que se consulta.' }
    ],
    siguiente: 'v2.2 — Actualizar el sistema desde un archivo ZIP, sin perder datos.'
  },
  {
    numero: '2.0.2',
    nombre: 'Tres que estorbaban',
    fecha: '2026-08-26',
    resumen:
      'Los tickets del día ya no desaparecen después de las 6 de la tarde, ' +
      'vaciar el ticket ya no repite lo último, y la impresora se elige de ' +
      'una lista.',
    cambios: [
      { tipo: 'arreglo', texto: 'ARREGLADO Y GRAVE: los tickets de HOY desaparecían de la lista a partir de las 6 de la tarde. Las fechas se guardan en hora universal y se comparaban contra el reloj de la fábrica: a las 6:29 p.m. de aquí, para el sistema ya era mañana. En una fábrica que cierra a las 8, eso era media tarde sin poder buscar un ticket.' },
      { tipo: 'arreglo', texto: 'Lo mismo pasaba en el HISTORIAL: buscar "hoy" no traía lo de la tarde, y el filtro por horas venía corrido seis horas —pedías de 3 a 8 de la tarde y salía lo de 9 de la mañana—. Ya está todo en el reloj de la fábrica.' },
      { tipo: 'arreglo', texto: 'ARREGLADO: al vaciar el ticket con Esc y confirmar con Enter, se vaciaba y en el mismo golpe repetía lo último capturado. El diálogo se cerraba al APRETAR la tecla y el campo de códigos alcanzaba a ver cuando la SOLTABAS.' },
      { tipo: 'importante', texto: 'LA IMPRESORA YA SE ELIGE DE UNA LISTA. Al abrir Sistema, el programa le pregunta a Windows qué impresoras tiene y las pone en un selector. Eliges la tuya y ya: no hay que averiguar direcciones ni compartir nada.' },
      { tipo: 'nuevo', texto: 'Y funcionan las dos clases: si es de red se le habla directo por su dirección, y si es de USB por su nombre de Windows. Escribir la dirección a mano sigue estando, pero ya solo para casos raros.' },
      { tipo: 'mejora', texto: 'Si dice "no se encuentra el nombre de red especificado", es que está apuntando a un nombre compartido que ya no existe. Se arregla eligiendo la impresora de la lista.' }
    ],
    siguiente: 'v2.1 — Actualizar el sistema desde un archivo ZIP, sin perder datos.'
  },
  {
    numero: '2.0.1',
    nombre: 'La impresora de red',
    fecha: '2026-08-26',
    resumen:
      'El ticket ya se le puede mandar directo a una impresora de red, ' +
      'escribiendo nada más su dirección.',
    cambios: [
      { tipo: 'arreglo', texto: 'ARREGLADO: si la impresora es de RED, el sistema no podía mandarle el ticket. Solo sabía escribirle a una impresora COMPARTIDA de Windows, y eso obliga a compartirla y a que el driver esté puesto.' },
      { tipo: 'importante', texto: 'AHORA BASTA CON SU DIRECCIÓN. Escribe 192.168.1.65 en Sistema → Impresora de tickets y listo. El sistema le habla directo por el puerto 9100, que es por donde escuchan todas las térmicas de red.' },
      { tipo: 'nuevo', texto: 'Botón BUSCAR LAS IMPRESORAS DE ESTA PC: le pregunta a Windows cuáles tiene y te ofrece la dirección ya masticada. Un toque en "Usar esta" y el campo se llena solo.' },
      { tipo: 'nuevo', texto: 'Debajo del campo, un renglón dice POR DÓNDE VA A SALIR el ticket mientras escribes: "por red a 192.168.1.65:9100", "nombre compartido de Windows", "a un archivo". Ver qué entendió el programa es la mitad de arreglarlo.' },
      { tipo: 'mejora', texto: 'Cuando falla, el aviso dice QUÉ REVISAR: que está apagada, que no se llega a esa dirección, que el puerto no es ese. No un error en inglés.' },
      { tipo: 'importante', texto: 'Y si la impresora no contesta, la venta NO se cae: el dinero ya se cobró, y ningún problema de impresora puede tumbar eso. A los ocho segundos se rinde y avisa.' }
    ],
    siguiente: 'v2.1 — Actualizar el sistema desde un archivo ZIP, sin perder datos.'
  },
  {
    numero: '2.0',
    nombre: 'La caja de diario',
    fecha: '2026-08-25',
    resumen:
      'El mayoreo se teclea, el historial hace de verdad lo que se le pide, ' +
      'y todas las listas se leen de un renglón.',
    cambios: [
      { tipo: 'importante', texto: 'EL MAYOREO SE TECLEA. Ahora hay dos botones nuevos: 1m es la marqueta de mayoreo y 12m la media. Tecleas 1m, enter, y el renglón entra ya con precio de mayoreo. Buscar al cliente ANTES de capturar era lo que hacía lento el mayoreo.' },
      { tipo: 'nuevo', texto: 'Al apretar F10 en un ticket con mayoreo, la caja pide de quién es ANTES de cobrar. Tecleas el NÚMERO del cliente —"7" y enter— o las primeras letras de su nombre, y sigue el cobro de siempre.' },
      { tipo: 'nuevo', texto: 'CADA CLIENTE TIENE SU NÚMERO, asignado solo y para siempre. Sale en su ficha y en la lista de la caja. Es lo que se teclea.' },
      { tipo: 'importante', texto: 'Un ticket con mayoreo NO SE COBRA SIN NOMBRE. El precio especial es de alguien; sin saber de quién, al mes nadie puede explicar por qué esa marqueta salió a $240.' },
      { tipo: 'importante', texto: 'Y si te sales del cobro antes de cobrar, el cliente se suelta y hay que volver a decir quién es. Un cliente pegado al ticket es la forma de cobrarle a uno el precio del anterior.' },
      { tipo: 'mejora', texto: 'Ya no hay "mínimo de mayoreo" que configurar: el mínimo lo dicen los botones que existen. Si solo hay marqueta y media, no hay forma de pedir mayoreo por un cuarto.' },
      { tipo: 'nuevo', texto: 'DESDE EL HISTORIAL se saca copia de cualquier ticket. Y el administrador puede cancelarlo o eliminarlo, detrás del botón "⋯". A los demás ni les sale.' },
      { tipo: 'importante', texto: 'ELIMINAR UN TICKET solo se puede mientras su turno sigue ABIERTO. En cuanto se corta el turno hay un papel firmado con ese número: entonces se cancela, que deja el renglón tachado con su motivo y las cuentas cuadrando.' },
      { tipo: 'nuevo', texto: 'LOS CAMBIOS SE VEN DE LOS DOS LADOS: los dos tickets salen marcados con ⇄ y cada uno dice cuál es su pareja (#5→#6). Cayendo en cualquiera se ve la historia completa.' },
      { tipo: 'nuevo', texto: 'En el historial se busca POR NÚMERO DE TICKET. Escribes 412 y ahí está.' },
      { tipo: 'mejora', texto: 'EL HISTORIAL, LOS TICKETS Y LOS GASTOS: un renglón es una línea. Nada se parte en dos, todo va centrado y las columnas siempre en el mismo sitio. Lo que no cabe se corta con puntos suspensivos y se ve completo al pasar el ratón.' },
      { tipo: 'mejora', texto: 'En la lista de tickets se quitó el botón "Ver": ahora cada renglón ya dice qué se llevó el cliente.' },
      { tipo: 'mejora', texto: 'El dinero que ENTRA al cajón se ve en verde, y el que sale en rojo.' },
      { tipo: 'nuevo', texto: 'SE ANOTA LO QUE SE DERRITE. Botón "Anotar merma" en Existencia: cuánto, y si se derritió, se rompió, se regaló o se usó en la fábrica.' },
      { tipo: 'importante', texto: 'Y la existencia ya trae el desglose completo: cuánto se vendió AL PÚBLICO, cuánto A MAYOREO y cuánto se perdió. Antes todo eso iba revuelto en un solo "faltante".' },
      { tipo: 'mejora', texto: 'Productos y precios ya no trae el cuadre completo del cuarto frío: queda el dato de cuánto debería haber y un botón para ir a Existencia, que es donde eso se trabaja.' },
      { tipo: 'arreglo', texto: 'ARREGLADO: los códigos de producto ya no distinguen mayúsculas. Teclear "1m" o "1M" es lo mismo, que es lo que espera cualquiera.' },
      { tipo: 'arreglo', texto: 'ARREGLADO: la insignia del margen se alinea a la derecha, como el resto de los números.' }
    ],
    siguiente: 'v2.1 — Actualizar el sistema desde un archivo ZIP, sin perder datos.'
  },
  {
    numero: '1.9',
    nombre: 'Mayoreo, papel y WhatsApp',
    fecha: '2026-08-24',
    resumen:
      'El cliente de mayoreo dice quién es y el precio cambia en la ' +
      'pantalla, el corte gasta la mitad de papel, y se manda por WhatsApp.',
    cambios: [
      { tipo: 'nuevo', texto: 'PRECIO DE MAYOREO. Capturas lo que te pidieron, aprietas F6 (o el botón CLIENTE), dices quién es, y el precio cambia al instante en la pantalla. Sigues tu flujo normal.' },
      { tipo: 'importante', texto: 'EL MAYOREO ES UNA LISTA, NO UN DESCUENTO. "Mayoreo 1" es la lista donde la marqueta vale $240 en vez de $264, y a ella se apuntan los clientes que la tienen. Subirle el precio a la lista se lo sube a todos de una vez.' },
      { tipo: 'importante', texto: 'Y CADA FRACCIÓN LLEVA SU PROPIO PRECIO, igual que en la de público: el cuarto no sale de dividir la marqueta entre cuatro, porque cortar da trabajo y ese trabajo no desaparece por vender mucho.' },
      { tipo: 'nuevo', texto: 'APLICA DESDE MEDIA MARQUETA, y ese mínimo lo pones tú en Productos y precios. Al que lleva un cuarto no se le hace precio, y la pantalla se lo dice: "le falta 1/4 para su precio de mayoreo".' },
      { tipo: 'nuevo', texto: 'Se mide sobre TODO el hielo del ticket: quien pide un cuarto y un cuarto está pidiendo media marqueta.' },
      { tipo: 'nuevo', texto: 'Vale igual pagando en efectivo que fiado. El de la nevería paga y se va, pero paga su precio, y el ticket queda a su nombre para que se sepa por qué salió a $240.' },
      { tipo: 'nuevo', texto: 'La lista de mayoreo de cada cliente se pone en su ficha, en CLIENTES. Las listas se crean y se les cambia el precio en PRODUCTOS Y PRECIOS. Una lista nueva nace copiando los precios de público, para que nunca quede a medio llenar.' },
      { tipo: 'mejora', texto: 'EL CORTE GASTA LA MITAD DE PAPEL: los movimientos salen en dos columnas, gastos de un lado y entradas del otro, cada uno con su suma. Un día de gastos son quince renglones, y eso todos los días.' },
      { tipo: 'nuevo', texto: 'MANDAR EL CORTE POR WHATSAPP. Un botón en el corte arma la imagen del ticket y abre el menú de compartir del celular. En la computadora baja la imagen y abre WhatsApp Web con el resumen escrito.' },
      { tipo: 'importante', texto: 'EL PRECIO LO DECIDE EL SERVIDOR. La pantalla lo calcula para que se vea al instante, pero al cobrar se vuelve a decidir desde cero: mandar el nombre de un mayorista no alcanza para llevarse su precio.' }
    ],
    siguiente: 'v2.0 — Reparto: rutas, neveras en comodato y liquidación del repartidor.'
  },
  {
    numero: '1.8',
    nombre: 'Historial, y borrar de verdad',
    fecha: '2026-08-24',
    resumen:
      'Una pantalla para revisar todo lo que ha pasado en la caja, y la ' +
      'posibilidad de borrar lo que nunca debió estar.',
    cambios: [
      { tipo: 'nuevo', texto: 'HISTORIAL, solo para el administrador. Todo lo que ha pasado en la caja: ventas, gastos, entradas y abonos, de quien sea y de cuando sea, en una sola lista.' },
      { tipo: 'nuevo', texto: 'Se filtra por lo que uno se pregunta de verdad: por persona, por días, por horas y por tipo. "¿Qué hizo Mari el jueves entre las 3 y las 8?" son cuatro toques.' },
      { tipo: 'nuevo', texto: 'Arriba, los cuatro números: cuánto se cobró, cuánto salió, cuánto entró y cuánto abonaron. Suman TODO lo que cae en el filtro, no solo lo que se alcanza a ver.' },
      { tipo: 'importante', texto: 'ELIMINAR ya no es lo mismo que DAR DE BAJA. La baja es para lo de temporada: se recupera. Eliminar es para el producto de prueba, el que se dio de alta dos veces, el que ya no va a volver.' },
      { tipo: 'importante', texto: 'PERO SOLO SE BORRA LO QUE NUNCA SE USÓ. En cuanto algo se vendió, su nombre está en tickets ya cobrados, y borrarlo dejaría el histórico mintiendo. Eso se da de baja, y el sistema lo dice con esas palabras.' },
      { tipo: 'importante', texto: 'BORRAR PIDE LA CONTRASEÑA DEL ADMINISTRADOR, no un PIN. El PIN se teclea veinte veces al día delante de quien sea; esto no se deshace. Y solo el administrador: dar de baja lo puede hacer un gerente.' },
      { tipo: 'nuevo', texto: 'El administrador también puede BORRAR UN GASTO capturado por error, en vez de dejarlo tachado. Si es de un turno ya cortado, la pantalla avisa antes de que el papel firmado deje de coincidir.' },
      { tipo: 'nuevo', texto: 'Se pueden eliminar categorías vacías y clientes que nunca tuvieron movimientos.' },
      { tipo: 'importante', texto: 'Lo único que no se borra nunca es la constancia de que alguien borró: todo queda en la bitácora con nombre y detalle.' }
    ],
    siguiente: 'v1.9 — Precios de mayoreo, corte en dos columnas y compartir por WhatsApp.'
  },
  {
    numero: '1.7',
    nombre: 'La caja obedece',
    fecha: '2026-08-24',
    resumen:
      'Cambios de la primera prueba a fondo: listas que no se aprietan, ' +
      'cantidades que se tocan, F1 para vender y el dinero sin decimales.',
    cambios: [
      { tipo: 'arreglo', texto: 'ARREGLADO: con muchos productos en una categoría, la lista los iba aplastando hasta dejarlos en la mitad de su alto. Ahora cada renglón conserva su tamaño y la lista se desplaza, que es lo que se espera.' },
      { tipo: 'importante', texto: 'LA CANTIDAD SE TOCA Y SE ESCRIBE. Si te piden 50 marquetas ya no hay que tocar el botón cincuenta veces: se toca el número del renglón y se teclea 50. Poner 0 lo quita del ticket.' },
      { tipo: 'importante', texto: 'ENTER CON EL CAMPO VACÍO REPITE lo último que agregaste. "Dame otro igual" es media venta del mostrador.' },
      { tipo: 'nuevo', texto: 'F1 lleva a VENDER desde donde estés. Estabas viendo la existencia y llegó un cliente: una tecla y ya.' },
      { tipo: 'mejora', texto: 'EL DINERO SIN DECIMALES: $264 en vez de $264.00. Si un número sí trae centavos se enseñan completos, porque redondear sería decirle al cliente algo que no es.' },
      { tipo: 'mejora', texto: 'El margen de ganancia ya no es un cartel de tres renglones: es una etiqueta chica junto a la foto del producto.' },
      { tipo: 'mejora', texto: 'La impresora de tickets se mudó de Productos a SISTEMA, junto a los respaldos. Es un aparato de la computadora, no un producto.' },
      { tipo: 'nuevo', texto: 'CLIENTES ya aparece en la pantalla de inicio.' },
      { tipo: 'arreglo', texto: 'ARREGLADO Y GRAVE: el turno que quedaba esperando dueño se adoptaba solo al recargar la pantalla, así que el cajero que acababa de entregar se lo volvía a quedar sin darse cuenta. Ahora solo lo adopta quien teclea su PIN.' },
      { tipo: 'nuevo', texto: 'Y ese aviso ya sale en VENDER, con un botón "Tomar el turno": el que entra pone su PIN ahí mismo y el turno y el dinero apartado quedan a su nombre.' },
      { tipo: 'mejora', texto: 'Los tickets que se buscan desde la caja son solo los de HOY. Para el histórico completo viene un módulo aparte.' },
      { tipo: 'mejora', texto: 'Al vaciar el ticket con Esc, otro Enter acepta: la mano no tiene que soltar el teclado.' },
      { tipo: 'importante', texto: 'Los CAJEROS ya pueden imprimir los números que siguen en los tanques. El operario pregunta en el mostrador y ahí no siempre hay un gerente.' },
      { tipo: 'arreglo', texto: 'El ticket fiado se imprimía diciendo FIADO pero sin el nombre del cliente, que es justo lo que lo convierte en un vale.' }
    ],
    siguiente: 'v1.8 — Historial, y borrar de verdad.'
  },
  {
    numero: '1.6.1',
    nombre: 'Sin teclas en el celular',
    fecha: '2026-08-24',
    resumen:
      'En el teléfono ya no salen las teclas que no existen, y por dentro ' +
      'las pruebas se limpiaron.',
    cambios: [
      { tipo: 'arreglo', texto: 'En el celular desaparecen las etiquetas de teclado: F2, F3, F4, F10, Enter y el "Esc ·" de los botones. En un teléfono no hay esas teclas, así que solo estorbaban. En la PC y en tableta siguen igual.' },
      { tipo: 'mejora', texto: 'Por dentro: las pruebas automáticas ya no repiten treinta y cinco renglones de arranque en cada archivo. Son 465 líneas menos, las mismas 279 pruebas y los mismos 5 segundos.' }
    ],
    siguiente: 'v1.7 — Los ajustes de la primera prueba a fondo.'
  },
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
      { tipo: 'importante', texto: 'EL HIELO ES LA EXCEPCIÓN: tiene su propio símbolo 🧊 y AVISA, pero jamás bloquea. El número del sistema es lo que se ha capturado, no lo que hay en el cuarto frío: los operarios reportan hasta como las 3, y hasta entonces siempre va a marcar de menos. Parar la venta de hielo por un dato que todavía no llega sería parar la fábrica.' },
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
      { tipo: 'nuevo', texto: 'Números a sacar: un papel con los paños que siguen en cada tanque, con fecha y hora, para imprimirlo y dárselo al operario.' },
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
      { tipo: 'nuevo', texto: 'Registrar lo que sacó un operario: marcas los paños que te dice y se capturan todos de golpe, a su nombre.' },
      { tipo: 'nuevo', texto: 'Un paño empezado y sin terminar queda "a medias" y es el siguiente que toca; otro operario lo termina y quedan los dos registrados.' },
      { tipo: 'nuevo', texto: 'El agua se cambia con un botón al lado, sin entrar a ningún menú.' },
      { tipo: 'nuevo', texto: 'Rol Gerente de turno: autoriza saltarse la rotación y corrige errores. El cajero no puede.' },
      { tipo: 'nuevo', texto: 'Anular un registro equivocado: no se borra nada, queda marcado como anulado con su motivo.' },
      { tipo: 'nuevo', texto: 'Un molde que falló la última vez queda marcado en rojo. Si siempre aparece marcado, ese molde tiene un problema físico.' },
      { tipo: 'nuevo', texto: 'Lo de hoy: marquetas y merma del día, repartidas por operario.' },
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
