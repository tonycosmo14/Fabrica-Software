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

const VERSION_ACTUAL = '0.1.4';

const VERSIONES = [
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
    ],
    siguiente: 'v0.2 — Configurador de tanques, paños, canastas y moldes.'
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
