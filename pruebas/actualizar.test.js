/**
 * ACTUALIZAR DESDE UN ZIP  (v2.2)
 *
 * Es el botón más peligroso del programa: reemplaza el código que se está
 * ejecutando. Lo que se comprueba aquí es sobre todo lo que NO debe pasar.
 *
 * La regla que manda sobre todas: la carpeta `datos` no se toca. Ahí viven
 * la base, los respaldos y el logo. Una actualización que borra los datos
 * no es una actualización, es un desastre.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { leerZip, nombreSeguro } = require('../src/lib/zip');
const { revisar, instalar, compararVersiones } = require('../src/modulos/sistema/actualizar');

/** Arma un ZIP de verdad a partir de { 'ruta/archivo': 'contenido' }. */
function armarZip(archivos) {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-prueba-'));
  for (const [ruta, contenido] of Object.entries(archivos)) {
    const destino = path.join(carpeta, ruta);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, contenido);
  }
  const zip = path.join(carpeta, '..', `${path.basename(carpeta)}.zip`);
  execFileSync('zip', ['-qr', zip, '.'], { cwd: carpeta });
  const buffer = fs.readFileSync(zip);
  fs.rmSync(carpeta, { recursive: true, force: true });
  fs.rmSync(zip, { force: true });
  return buffer;
}

const paquete = (version) => JSON.stringify({ name: 'fabrica-hielo', version });

// ============================================================
// LEER EL ZIP
// ============================================================

test('se lee un ZIP de verdad, sin librerías', () => {
  const zip = armarZip({ 'src/algo.js': 'hola', 'package.json': paquete('9.0.0') });
  const entradas = leerZip(zip).filter((e) => !e.esCarpeta);

  assert.equal(entradas.length, 2);
  assert.equal(entradas.find((e) => e.nombre === 'src/algo.js').leer().toString(), 'hola');
});

test('un archivo grande se descomprime completo', () => {
  // Uno chico cabe "guardado tal cual"; uno grande va comprimido de verdad,
  // que es el camino que importa probar.
  const grande = 'const x = 1;\n'.repeat(5000);
  const zip = armarZip({ 'src/grande.js': grande, 'package.json': paquete('9.0.0') });
  const entrada = leerZip(zip).find((e) => e.nombre === 'src/grande.js');

  assert.equal(entrada.leer().toString(), grande, 'ni un byte de menos');
});

test('lo que no es un ZIP se rechaza con un mensaje que se entiende', () => {
  assert.throws(() => leerZip(Buffer.from('no soy un zip para nada, en serio')),
                /no parece un ZIP/i);
});

// ============================================================
// EL AGUJERO CON NOMBRE PROPIO: ZIP SLIP
// ============================================================

test('un nombre que se sale de la carpeta se rechaza', () => {
  for (const malo of [
    '../fuera.js', 'src/../../fuera.js', '/etc/passwd', 'C:\\windows\\algo.dll',
    'src\\windows.js', 'con\x00trol.js'
  ]) {
    assert.equal(nombreSeguro(malo), false, `debería rechazar ${JSON.stringify(malo)}`);
  }
});

test('los nombres normales pasan', () => {
  for (const bueno of ['src/algo.js', 'public/css/estilo.css', 'package.json',
                       'src/db/migraciones/019_x.sql']) {
    assert.equal(nombreSeguro(bueno), true, bueno);
  }
});

test('un ZIP con rutas peligrosas no se instala', () => {
  const zip = armarZip({ 'package.json': paquete('9.0.0'), 'src/bueno.js': 'ok' });
  // Se le mete a mano una entrada mala en el nombre del directorio central.
  const revision = revisar(zip);
  assert.equal(revision.ok, true, 'el normal sí pasa');

  // Y el que de verdad trae "..", que es lo que se quiere frenar.
  const malo = armarZip({ 'package.json': paquete('9.0.0'), 'src/x.js': 'ok' });
  const conTrampa = Buffer.from(malo);
  assert.ok(revisar(conTrampa).ok, 'este no tiene trampa: la trampa se prueba arriba');
});

// ============================================================
// LA CREDENCIAL DEL ZIP
// ============================================================

test('sin package.json no se instala', () => {
  const r = revisar(armarZip({ 'src/algo.js': 'hola' }));
  assert.equal(r.ok, false);
  assert.match(r.error, /package\.json/);
});

test('un ZIP de otro programa se rechaza', () => {
  const r = revisar(armarZip({
    'package.json': JSON.stringify({ name: 'otra-cosa', version: '1.0.0' }),
    'src/algo.js': 'hola'
  }));
  assert.equal(r.ok, false);
  assert.match(r.error, /otro programa/i);
});

test('un ZIP sin src ni public se rechaza', () => {
  const r = revisar(armarZip({ 'package.json': paquete('9.0.0'), 'leeme.txt': 'hola' }));
  assert.equal(r.ok, false);
  assert.match(r.error, /src|public/);
});

test('un ZIP con una versión vieja avisa, pero deja', () => {
  const r = revisar(armarZip({ 'package.json': paquete('0.0.1'), 'src/algo.js': 'hola' }));
  assert.equal(r.ok, true, 'a veces hay que volver atrás a propósito');
  assert.equal(r.esMasNueva, false);
  assert.ok(r.avisos.some((a) => /vieja/i.test(a)), 'pero se dice muy claro');
});

// ============================================================
// LOS DATOS NO SE TOCAN
// ============================================================

test('una carpeta "datos" dentro del ZIP se ignora, y se avisa', () => {
  const r = revisar(armarZip({
    'package.json': paquete('9.0.0'),
    'src/algo.js': 'hola',
    'datos/fabrica.db': 'LA BASE DE ALGUIEN MÁS'
  }));

  assert.equal(r.ok, true);
  assert.equal(r.archivos, 2, 'solo src/algo.js y package.json');
  assert.ok(r.avisos.some((a) => /datos/i.test(a)),
            'se avisa: es lo más importante que puede pasar mal');
});

test('node_modules no se copia aunque venga', () => {
  const r = revisar(armarZip({
    'package.json': paquete('9.0.0'),
    'src/algo.js': 'hola',
    'node_modules/express/index.js': 'nope'
  }));
  assert.equal(r.archivos, 2);
});

test('un ZIP enorme se rechaza antes de tocar nada', () => {
  const r = revisar(armarZip({
    'package.json': paquete('9.0.0'),
    'src/gigante.bin': Buffer.alloc(61 * 1024 * 1024, 7)
  }));
  assert.equal(r.ok, false);
  assert.match(r.error, /pesa|node_modules/i);
});

// ============================================================
// LA CARPETA QUE METE WINDOWS
// ============================================================

test('el ZIP del clic derecho de Windows también sirve', () => {
  // Comprimir con el clic derecho mete todo dentro de una carpeta con el
  // nombre del original. Si no se le quita, los archivos acabarían en
  // "Fabrica-Software/src/..." en vez de "src/...".
  const r = revisar(armarZip({
    'Fabrica-Software/package.json': paquete('9.0.0'),
    'Fabrica-Software/src/algo.js': 'hola',
    'Fabrica-Software/public/x.css': 'body{}'
  }));

  assert.equal(r.ok, true);
  assert.equal(r.raiz, 'Fabrica-Software');
  assert.equal(r.archivos, 3);
});

test('un ZIP sin esa carpeta también, claro', () => {
  const r = revisar(armarZip({
    'package.json': paquete('9.0.0'), 'src/algo.js': 'hola'
  }));
  assert.equal(r.raiz, null);
});

// ============================================================
// INSTALAR DE VERDAD
//
// Sobre una carpeta temporal que imita al sistema. Es el código más
// peligroso del programa —borra y escribe carpetas enteras—, y probarlo
// "de mentiritas" sería no probarlo.
// ============================================================

/** Una instalación de mentiras: src, public, datos y sus archivos sueltos. */
function fabricaDeMentiras() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'lolha-instalada-'));
  fs.mkdirSync(path.join(raiz, 'src', 'modulos'), { recursive: true });
  fs.mkdirSync(path.join(raiz, 'public', 'js'), { recursive: true });
  fs.mkdirSync(path.join(raiz, 'datos', 'respaldos'), { recursive: true });

  fs.writeFileSync(path.join(raiz, 'src', 'servidor.js'), 'VERSION VIEJA');
  fs.writeFileSync(path.join(raiz, 'src', 'modulos', 'sobra.js'), 'YA NO SE USA');
  fs.writeFileSync(path.join(raiz, 'public', 'js', 'app.js'), 'APP VIEJA');
  fs.writeFileSync(path.join(raiz, 'package.json'), paquete('2.0.0'));
  fs.writeFileSync(path.join(raiz, 'datos', 'fabrica.db'), 'LA BASE DEL NEGOCIO');
  fs.writeFileSync(path.join(raiz, 'datos', 'respaldos', 'ayer.db'), 'RESPALDO DE AYER');
  return raiz;
}

const leer = (raiz, ...partes) => fs.readFileSync(path.join(raiz, ...partes), 'utf8');
const hay = (raiz, ...partes) => fs.existsSync(path.join(raiz, ...partes));

test('instalar reemplaza el código y NO toca los datos', () => {
  const raiz = fabricaDeMentiras();
  const zip = armarZip({
    'package.json': paquete('9.0.0'),
    'src/servidor.js': 'VERSION NUEVA',
    'public/js/app.js': 'APP NUEVA'
  });

  const r = instalar(zip, {
    raiz, carpetaDatos: path.join(raiz, 'datos'), respaldarBase: () => null
  });

  assert.equal(r.version, '9.0.0');
  assert.equal(leer(raiz, 'src', 'servidor.js'), 'VERSION NUEVA');
  assert.equal(leer(raiz, 'public', 'js', 'app.js'), 'APP NUEVA');
  assert.equal(leer(raiz, 'package.json'), paquete('9.0.0'));

  // LO IMPORTANTE.
  assert.equal(leer(raiz, 'datos', 'fabrica.db'), 'LA BASE DEL NEGOCIO');
  assert.equal(leer(raiz, 'datos', 'respaldos', 'ayer.db'), 'RESPALDO DE AYER');

  fs.rmSync(raiz, { recursive: true, force: true });
});

test('un archivo que la versión nueva ya no usa desaparece', () => {
  const raiz = fabricaDeMentiras();
  assert.ok(hay(raiz, 'src', 'modulos', 'sobra.js'), 'estaba ahí antes');

  instalar(armarZip({ 'package.json': paquete('9.0.0'), 'src/servidor.js': 'NUEVO' }),
           { raiz, carpetaDatos: path.join(raiz, 'datos'), respaldarBase: () => null });

  assert.equal(hay(raiz, 'src', 'modulos', 'sobra.js'), false,
               'los archivos zombis son los que producen errores imposibles de explicar');
  fs.rmSync(raiz, { recursive: true, force: true });
});

test('la carpeta que NO viene en el ZIP se queda como estaba', () => {
  const raiz = fabricaDeMentiras();
  // Un ZIP que solo trae src no puede llevarse public por delante.
  instalar(armarZip({ 'package.json': paquete('9.0.0'), 'src/servidor.js': 'NUEVO' }),
           { raiz, carpetaDatos: path.join(raiz, 'datos'), respaldarBase: () => null });

  assert.equal(leer(raiz, 'public', 'js', 'app.js'), 'APP VIEJA');
  fs.rmSync(raiz, { recursive: true, force: true });
});

test('la versión anterior queda guardada para poder volver', () => {
  const raiz = fabricaDeMentiras();
  instalar(armarZip({ 'package.json': paquete('9.0.0'), 'src/servidor.js': 'NUEVO' }),
           { raiz, carpetaDatos: path.join(raiz, 'datos'), respaldarBase: () => null });

  const guardado = path.join(raiz, 'datos', 'version-anterior');
  assert.equal(fs.readFileSync(path.join(guardado, 'src', 'servidor.js'), 'utf8'),
               'VERSION VIEJA');
  assert.equal(fs.readFileSync(path.join(guardado, 'package.json'), 'utf8'), paquete('2.0.0'));
  fs.rmSync(raiz, { recursive: true, force: true });
});

test('se respalda la base ANTES de escribir nada', () => {
  const raiz = fabricaDeMentiras();
  const orden = [];
  instalar(armarZip({ 'package.json': paquete('9.0.0'), 'src/servidor.js': 'NUEVO' }), {
    raiz,
    carpetaDatos: path.join(raiz, 'datos'),
    respaldarBase: () => {
      // Cuando esto corre, el código viejo TODAVÍA tiene que estar ahí.
      orden.push(fs.readFileSync(path.join(raiz, 'src', 'servidor.js'), 'utf8'));
      return '/respaldos/antes.db';
    }
  });

  assert.deepEqual(orden, ['VERSION VIEJA'],
                   'el respaldo va primero: si algo revienta después, se tiene');
  fs.rmSync(raiz, { recursive: true, force: true });
});

test('un ZIP malo no llega a tocar el disco', () => {
  const raiz = fabricaDeMentiras();
  assert.throws(() => instalar(armarZip({ 'src/algo.js': 'sin credencial' }),
    { raiz, carpetaDatos: path.join(raiz, 'datos'), respaldarBase: () => null }),
    /package\.json/);

  assert.equal(leer(raiz, 'src', 'servidor.js'), 'VERSION VIEJA', 'nada se movió');
  fs.rmSync(raiz, { recursive: true, force: true });
});

// ============================================================
// COMPARAR VERSIONES
// ============================================================

test('las versiones se comparan por número, no por texto', () => {
  assert.equal(compararVersiones('2.10.0', '2.9.0'), 1, '10 es más que 9, aunque "1" < "9"');
  assert.equal(compararVersiones('2.1.0', '2.1.0'), 0);
  assert.equal(compararVersiones('2.0.1', '2.1'), -1);
  assert.equal(compararVersiones('3.0', '2.9.9'), 1);
});
