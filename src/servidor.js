/**
 * ARRANQUE DEL SISTEMA
 * --------------------
 * 1. Aplica migraciones pendientes (con respaldo previo)
 * 2. Crea el admin inicial si la base esta vacia
 * 3. Levanta el servidor web
 *
 * Se arranca con:  npm start
 */
const os = require('node:os');
const express = require('express');
const config = require('./config');
const { VERSION_ACTUAL } = require('./version');
const { migrar } = require('./db/migrar');
const { sembrar } = require('./semillas');
const { cargarUsuario } = require('./middleware/sesion');
const { error } = require('./lib/respuestas');

function crearApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(cargarUsuario);

  // API
  app.use('/api/auth', require('./modulos/auth/rutas'));
  app.use('/api/usuarios', require('./modulos/usuarios/rutas'));
  app.use('/api/versiones', require('./modulos/versiones/rutas'));
  app.use('/api/sistema', require('./modulos/sistema/rutas'));

  app.use('/api', (req, res) => error(res, 'Esa ruta de la API no existe.', 404));

  // Interfaz
  app.use(express.static(config.CARPETA_PUBLICA));
  app.get('*', (req, res) => res.sendFile('index.html', { root: config.CARPETA_PUBLICA }));

  // Errores no controlados: se registran y se responde sin tumbar el servidor.
  app.use((err, req, res, next) => {
    console.error('Error no controlado:', err);
    error(res, 'Ocurrió un error en el servidor.', 500);
  });

  return app;
}

function ipsLocales() {
  const salida = [];
  for (const lista of Object.values(os.networkInterfaces())) {
    for (const i of lista || []) {
      if (i.family === 'IPv4' && !i.internal) salida.push(i.address);
    }
  }
  return salida;
}

function arrancar() {
  console.log(`\n  Fábrica de Hielo — v${VERSION_ACTUAL}`);
  console.log('  ' + '-'.repeat(42));

  migrar();
  const admin = sembrar();

  if (admin) {
    console.log('\n  Primer arranque: se creó el administrador');
    console.log(`     usuario:    ${admin.usuario}`);
    console.log(`     contraseña: ${admin.contrasena}`);
    console.log(`     PIN:        ${admin.pin}`);
    console.log('     >> Cámbialos desde la pantalla de Usuarios.\n');
  }

  const app = crearApp();
  app.listen(config.PUERTO, config.HOST, () => {
    console.log('\n  Listo. Abre el sistema en:');
    console.log(`     En esta PC:      http://localhost:${config.PUERTO}`);
    for (const ip of ipsLocales()) {
      console.log(`     En el celular:   http://${ip}:${config.PUERTO}`);
    }
    console.log('\n  Para detenerlo: Ctrl + C\n');
  });
}

module.exports = { crearApp, arrancar };

if (require.main === module) arrancar();
