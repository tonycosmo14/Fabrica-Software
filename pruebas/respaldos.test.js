/**
 * Pruebas de los respaldos. Es el seguro de vida del negocio:
 * si esto falla, se pierde la fábrica entera.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, carpeta, bd } = fabricaDePrueba('resp');

// Estas dos se piden DESPUÉS de la fábrica: leen la configuración al
// cargarse, y hasta ese momento no apunta a la carpeta de prueba.
const respaldos = require('../src/db/respaldos');
const config = require('../src/config');

const carpetaExtra = path.join(carpeta, 'usb-simulada');

test('un respaldo crea un archivo que se puede abrir como base de datos', () => {
  const r = respaldos.respaldar('prueba');
  assert.ok(r.hecho);
  assert.ok(fs.existsSync(r.principal));

  // La copia tiene que servir de verdad, no solo pesar.
  const { DatabaseSync } = require('node:sqlite');
  const copia = new DatabaseSync(r.principal, { readOnly: true });
  const usuarios = copia.prepare('SELECT COUNT(*) n FROM usuarios').get().n;
  copia.close();
  assert.equal(usuarios, 1);
});

test('el respaldo se lleva lo último que se guardó', () => {
  const { bd } = require('../src/db/conexion');
  bd.prepare(`
    INSERT INTO configuracion (clave, valor, actualizado_en)
    VALUES ('prueba_wal', 'este dato es reciente', datetime('now'))
  `).run();

  const r = respaldos.respaldar('prueba-wal');
  const { DatabaseSync } = require('node:sqlite');
  const copia = new DatabaseSync(r.principal, { readOnly: true });
  const valor = copia.prepare("SELECT valor FROM configuracion WHERE clave = 'prueba_wal'").get();
  copia.close();

  // Sin consolidar el diario de SQLite, este dato no estaría en la copia.
  assert.equal(valor.valor, 'este dato es reciente');
});

test('se conservan solo los últimos N y se borran los viejos', () => {
  respaldos.guardarConfig('respaldo_conservar', 3);
  for (let i = 0; i < 6; i++) respaldos.respaldar(`tanda${i}`);

  const lista = respaldos.listar(config.CARPETA_RESPALDOS, 100);
  assert.equal(lista.length, 3);
});

test('la carpeta de fuera se prueba antes de aceptarla', async () => {
  // Una carpeta DENTRO de un archivo: imposible en cualquier sistema.
  // (Una ruta cualquiera no sirve de prueba: si el programa corre con
  // permisos altos, la crearía sin problema.)
  const imposible = path.join(process.env.ARCHIVO_BD, 'no-puede-ser');
  const mala = await llamar('/api/sistema/respaldos', {
    method: 'PUT', cuerpo: { carpetaExtra: imposible }
  });
  assert.equal(mala.estado, 400);
  assert.match(mala.json.error, /No se puede escribir/);

  const buena = await llamar('/api/sistema/respaldos', {
    method: 'PUT', cuerpo: { carpetaExtra: carpetaExtra }
  });
  assert.equal(buena.estado, 200);
  assert.equal(buena.json.datos.ajustes.carpetaExtra, carpetaExtra);
});

test('con carpeta de fuera configurada, se guardan DOS copias', () => {
  const r = respaldos.respaldar('doble');
  assert.ok(fs.existsSync(r.principal));
  assert.ok(r.extra && fs.existsSync(r.extra), 'debería existir la copia extra');
  assert.equal(r.errorExtra, null);
});

test('si la USB se desconecta, el respaldo principal sigue funcionando', () => {
  fs.rmSync(carpetaExtra, { recursive: true, force: true });
  // Se simula un destino imposible, como cuando alguien saca la memoria.
  respaldos.guardarConfig('respaldo_carpeta_extra',
    path.join(process.env.ARCHIVO_BD, 'usb-desconectada'));

  const r = respaldos.respaldar('sin-usb');
  assert.ok(r.hecho);
  assert.ok(fs.existsSync(r.principal), 'la copia local no debe fallar');
  assert.ok(r.errorExtra, 'y el fallo de la USB debe quedar anotado');

  assert.match(respaldos.ajustes().ultimoError, /ENOTDIR|ENOENT|no-puede|usb-desconectada/);
});

test('la pantalla avisa cuando la copia de fuera está fallando', async () => {
  const { json } = await llamar('/api/sistema/respaldos');
  assert.ok(json.datos.ajustes.ultimoError);
  assert.ok(json.datos.respaldos.length > 0);
  assert.equal(typeof json.datos.sano, 'boolean');
});

test('la frecuencia se valida', async () => {
  const mala = await llamar('/api/sistema/respaldos', { method: 'PUT', cuerpo: { cadaHoras: 0 } });
  assert.equal(mala.estado, 400);

  const buena = await llamar('/api/sistema/respaldos', { method: 'PUT', cuerpo: { cadaHoras: 6 } });
  assert.equal(buena.estado, 200);
  assert.equal(buena.json.datos.ajustes.cadaHoras, 6);
});

test('un cajero no puede tocar la configuración de respaldos', async () => {
  await llamar('/api/usuarios', { method: 'POST', cuerpo: { nombre: 'Rosa', rol: 'cajero', pin: '4444' } });
  const { json } = await llamar('/api/auth/usuarios-disponibles');
  const rosa = json.datos.usuarios.find((u) => u.nombre === 'Rosa');
  await llamar('/api/auth/entrar-pin', { method: 'POST', cuerpo: { usuarioId: rosa.id, pin: '4444' } });

  const r = await llamar('/api/sistema/respaldos', { method: 'PUT', cuerpo: { cadaHoras: 2 } });
  assert.equal(r.estado, 403);

  const ahora = await llamar('/api/sistema/respaldos/ahora', { method: 'POST', cuerpo: {} });
  assert.equal(ahora.estado, 403);
});
