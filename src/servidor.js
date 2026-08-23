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
const net = require('node:net');
const { spawn } = require('node:child_process');
const express = require('express');
const config = require('./config');
const { VERSION_ACTUAL } = require('./version');
const { migrar } = require('./db/migrar');
const { bd } = require('./db/conexion');
const respaldos = require('./db/respaldos');
const { cargarUsuario } = require('./middleware/sesion');
const { error } = require('./lib/respuestas');

function crearApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cargarUsuario);

  // El logo puede pesar más que el resto de peticiones, así que este módulo
  // lleva su propio lector de datos, con un límite mayor, y va antes que el
  // general para que sea el suyo el que aplique.
  const personalizacion = require('./modulos/personalizacion/rutas');
  app.use('/api/personalizacion', express.json({ limit: '5mb' }), personalizacion.router);
  app.get('/marca/logo', personalizacion.servirLogo('logo_claro'));
  app.get('/marca/logo-oscuro', personalizacion.servirLogo('logo_oscuro'));

  app.use(express.json({ limit: '1mb' }));

  // API
  app.use('/api/auth', require('./modulos/auth/rutas'));
  app.use('/api/usuarios', require('./modulos/usuarios/rutas'));
  app.use('/api/tanques', require('./modulos/tanques/rutas'));
  app.use('/api/produccion', require('./modulos/produccion/rutas'));
  app.use('/api/existencia', require('./modulos/existencia/rutas'));
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

/**
 * Abre el navegador en la direccion del sistema.
 * Se usa cuando se arranca con doble clic (bandera --abrir).
 */
function abrirNavegador(url) {
  const comandos = {
    win32:  ['cmd', ['/c', 'start', '""', url]],
    darwin: ['open', [url]],
    linux:  ['xdg-open', [url]]
  };
  const elegido = comandos[process.platform] || comandos.linux;
  try {
    const p = spawn(elegido[0], elegido[1], { detached: true, stdio: 'ignore' });
    p.on('error', () => {});   // si no hay navegador, no pasa nada
    p.unref();
  } catch { /* sin navegador disponible */ }
}

/**
 * Comprueba si el puerto ya esta ocupado ANTES de tocar la base de datos.
 * Asi un segundo doble clic no aplica migraciones mientras la primera
 * copia esta trabajando.
 */
function puertoOcupado(puerto, host) {
  return new Promise((resolve) => {
    const prueba = net.createServer();
    prueba.once('error', (e) => resolve(e.code === 'EADDRINUSE'));
    prueba.once('listening', () => prueba.close(() => resolve(false)));
    prueba.listen(puerto, host);
  });
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

/**
 * El sistema usa el SQLite que Node trae adentro, disponible desde la
 * version 22.5. Con una version mas vieja el error de Node seria
 * incomprensible, asi que se avisa en claro.
 */
function comprobarNode() {
  const [mayor, menor] = process.versions.node.split('.').map(Number);
  if (mayor > 22 || (mayor === 22 && menor >= 5)) return true;

  console.log(`\n  Tu version de Node.js es la ${process.versions.node} y es muy vieja.`);
  console.log('  El sistema necesita la 22.5 o mas nueva.');
  console.log('\n  Descarga la version LTS desde https://nodejs.org, instalala,');
  console.log('  y vuelve a abrir el sistema.\n');
  return false;
}

async function arrancar() {
  console.log(`\n  Fábrica de Hielo — v${VERSION_ACTUAL}`);
  console.log('  ' + '-'.repeat(42));

  if (!comprobarNode()) { process.exitCode = 1; return; }

  const abrirAlIniciar = process.argv.includes('--abrir');
  const url = `http://localhost:${config.PUERTO}`;

  if (await puertoOcupado(config.PUERTO, config.HOST)) {
    console.log('\n  El sistema YA ESTA ABIERTO en otra ventana.');
    console.log(`  Dirección: ${url}\n`);
    if (abrirAlIniciar) abrirNavegador(url);
    setTimeout(() => process.exit(0), 1500);
    return;
  }

  migrar();

  // El sistema no trae ningun usuario de fabrica. Si la base esta vacia,
  // la propia aplicacion pide crear la cuenta del administrador al abrirla.
  const sinUsuarios = bd.prepare('SELECT COUNT(*) n FROM usuarios').get().n === 0;
  if (sinUsuarios) {
    console.log('\n  Primer arranque: al abrir el sistema te pedirá crear');
    console.log('  la cuenta del administrador.\n');
  }

  // Con --abrir (el doble clic en INICIAR) el navegador se abre solo,
  // pero hasta que el servidor esta realmente listo.
  const abrir = abrirAlIniciar;
  const direccion = url;

  // Un respaldo al encender y el reloj de los automáticos en marcha.
  try {
    const r = respaldos.respaldar('arranque');
    if (r.hecho) {
      console.log(`  Respaldo al arrancar: ${r.principal}`);
      if (r.errorExtra) console.log(`  ⚠ La copia de seguridad extra falló: ${r.errorExtra}`);
      else if (r.extra) console.log(`  Copia extra: ${r.extra}`);
    }
  } catch (e) {
    console.log(`  ⚠ No se pudo respaldar al arrancar: ${e.message}`);
  }
  respaldos.arrancarAutomaticos();

  const app = crearApp();
  const servidor = app.listen(config.PUERTO, config.HOST, () => {
    console.log('\n  Listo. Abre el sistema en:');
    console.log(`     En esta PC:      ${direccion}`);
    for (const ip of ipsLocales()) {
      console.log(`     En el celular:   http://${ip}:${config.PUERTO}`);
    }
    console.log('\n  Para detenerlo: cierra esta ventana o presiona Ctrl + C\n');

    if (abrir) abrirNavegador(direccion);
  });

  // Si el puerto ya esta ocupado casi siempre es porque el sistema ya estaba
  // corriendo. Se avisa en español en vez de escupir el error de Node.
  servidor.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.log('\n  El sistema YA ESTA ABIERTO en otra ventana.');
      console.log(`  Direccion: ${direccion}\n`);
      if (abrir) abrirNavegador(direccion);
      setTimeout(() => process.exit(0), 1500);
      return;
    }
    console.error('\n  No se pudo arrancar el servidor:', e.message, '\n');
    process.exit(1);
  });
}

module.exports = { crearApp, arrancar };

if (require.main === module) {
  arrancar().catch((e) => {
    console.error('\n  No se pudo arrancar el sistema:', e.message, '\n');
    process.exit(1);
  });
}
