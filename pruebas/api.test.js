/**
 * Prueba de punta a punta: arranca el sistema con una base temporal,
 * entra como admin, crea un operario y comprueba los permisos.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Base de datos desechable: no toca la real.
const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'fabrica-prueba-'));
process.env.CARPETA_DATOS = carpeta;
process.env.ARCHIVO_BD = path.join(carpeta, 'prueba.db');

const { migrar } = require('../src/db/migrar');
const { crearApp } = require('../src/servidor');

migrar({ silencioso: true });

// El sistema arranca sin usuarios: el admin se crea desde el asistente.
const admin = { nombre: 'Tony', usuario: 'tony', contrasena: 'clavelarga1', pin: '1234' };

let servidor, base, cookie = '';

async function llamar(ruta, opciones = {}) {
  const r = await fetch(base + ruta, {
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    ...opciones,
    body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined
  });
  const set = r.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  return { estado: r.status, json: await r.json() };
}

test.before(async () => {
  servidor = crearApp().listen(0);
  await new Promise((r) => servidor.once('listening', r));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

test.after(() => {
  servidor.close();
  fs.rmSync(carpeta, { recursive: true, force: true });
});

test('un sistema recien instalado se reporta como no configurado', async () => {
  const { json } = await llamar('/api/auth/estado-inicial');
  assert.equal(json.datos.configurado, false);
});

test('el asistente rechaza una contraseña corta', async () => {
  const r = await llamar('/api/auth/configuracion-inicial', {
    method: 'POST', cuerpo: { ...admin, contrasena: 'corta' }
  });
  assert.equal(r.estado, 400);
});

test('el asistente crea el primer administrador y deja la sesion abierta', async () => {
  const r = await llamar('/api/auth/configuracion-inicial', { method: 'POST', cuerpo: admin });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.usuario.rol, 'admin');

  const yo = await llamar('/api/auth/yo');
  assert.equal(yo.json.datos.usuario.nombre, 'Tony');
});

test('el asistente no se puede usar dos veces', async () => {
  const r = await llamar('/api/auth/configuracion-inicial', {
    method: 'POST', cuerpo: { ...admin, usuario: 'otro' }
  });
  assert.equal(r.estado, 409);
});

test('ya configurado, el estado inicial cambia', async () => {
  const { json } = await llamar('/api/auth/estado-inicial');
  assert.equal(json.datos.configurado, true);
});

test('el servidor responde y reporta su version', async () => {
  const { json } = await llamar('/api/sistema/salud');
  assert.ok(json.ok);
  assert.ok(json.datos.version);
});

test('sin sesion no se pueden ver los usuarios', async () => {
  const guardada = cookie;
  cookie = '';
  const { estado } = await llamar('/api/usuarios');
  cookie = guardada;
  assert.equal(estado, 401);
});

test('el admin entra con contraseña', async () => {
  const { json } = await llamar('/api/auth/entrar-contrasena', {
    method: 'POST', cuerpo: { usuario: admin.usuario, contrasena: admin.contrasena }
  });
  assert.ok(json.ok);
  assert.equal(json.datos.usuario.rol, 'admin');
});

test('el admin crea un operario y aparece en la lista', async () => {
  const alta = await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Juan Operario', rol: 'operario', pin: '4321' }
  });
  assert.equal(alta.estado, 201);

  const lista = await llamar('/api/usuarios');
  assert.ok(lista.json.datos.usuarios.some((u) => u.nombre === 'Juan Operario'));
});

test('un PIN de 3 digitos se rechaza', async () => {
  const r = await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Malo', rol: 'operario', pin: '123' }
  });
  assert.equal(r.estado, 400);
});

test('el operario entra con PIN pero no puede administrar usuarios', async () => {
  const { json } = await llamar('/api/auth/usuarios-disponibles');
  const juan = json.datos.usuarios.find((u) => u.nombre === 'Juan Operario');

  await llamar('/api/auth/entrar-pin', { method: 'POST', cuerpo: { usuarioId: juan.id, pin: '4321' } });

  const yo = await llamar('/api/auth/yo');
  assert.equal(yo.json.datos.usuario.rol, 'operario');

  const intento = await llamar('/api/usuarios');
  assert.equal(intento.estado, 403);
});

test('el PIN equivocado no deja entrar', async () => {
  const { json } = await llamar('/api/auth/usuarios-disponibles');
  const juan = json.datos.usuarios.find((u) => u.nombre === 'Juan Operario');
  const r = await llamar('/api/auth/entrar-pin', { method: 'POST', cuerpo: { usuarioId: juan.id, pin: '9999' } });
  assert.equal(r.estado, 401);
});

test('la bitacora guarda quien ejecuto cada movimiento', async () => {
  await llamar('/api/auth/entrar-contrasena', {
    method: 'POST', cuerpo: { usuario: admin.usuario, contrasena: admin.contrasena }
  });
  const { json } = await llamar('/api/sistema/bitacora');
  const alta = json.datos.eventos.find((e) => e.accion === 'usuario.alta');
  assert.ok(alta);
  assert.ok(alta.ejecutor_id);
  assert.equal(alta.ejecutor_id, alta.capturista_id);
});
