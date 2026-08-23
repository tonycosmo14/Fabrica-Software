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

const VERSION_ACTUAL = '0.3';

const VERSIONES = [
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
    ],
    siguiente: 'v0.3.1 — Traspaso a caja: el hielo pasa de producción a la custodia del cajero.'
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
