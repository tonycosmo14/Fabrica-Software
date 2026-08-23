/**
 * Configuracion general. Todo lo que pueda cambiar de una PC a otra vive aqui.
 * Se puede sobreescribir con variables de entorno sin tocar el codigo.
 */
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const CARPETA_DATOS = process.env.CARPETA_DATOS || path.join(RAIZ, 'datos');

module.exports = {
  RAIZ,
  PUERTO: Number(process.env.PUERTO || 3000),
  // Escuchar en 0.0.0.0 permite que celulares y tablets entren por WiFi local.
  HOST: process.env.HOST || '0.0.0.0',
  // Si se mueve la carpeta de datos, TODO se mueve con ella: la base, los
  // respaldos y el logo. Antes la base se quedaba atrás y era un enredo.
  CARPETA_DATOS: CARPETA_DATOS,
  CARPETA_RESPALDOS: path.join(CARPETA_DATOS, 'respaldos'),
  ARCHIVO_BD: process.env.ARCHIVO_BD || path.join(CARPETA_DATOS, 'fabrica.db'),
  CARPETA_PUBLICA: path.join(RAIZ, 'public'),
  CARPETA_MIGRACIONES: path.join(RAIZ, 'src', 'db', 'migraciones'),
  // Cuanto dura la sesion en el dispositivo antes de volver a pedir PIN.
  DIAS_SESION: Number(process.env.DIAS_SESION || 30),
  // Datos del admin que se crea la primera vez que arranca el sistema.
  ADMIN_INICIAL: {
    nombre: process.env.ADMIN_NOMBRE || 'Administrador',
    usuario: process.env.ADMIN_USUARIO || 'admin',
    contrasena: process.env.ADMIN_CONTRASENA || 'admin1234',
    pin: process.env.ADMIN_PIN || '1234'
  }
};
