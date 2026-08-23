/**
 * RECUPERAR EL ACCESO
 *
 * Qué hacer si el administrador olvidó su PIN y su contraseña.
 *
 * Este programa se ejecuta EN LA PC donde vive el sistema, desde la
 * terminal o con doble clic en RECUPERAR-ACCESO.bat. Pide qué cuenta
 * arreglar y le pone un PIN y una contraseña nuevos.
 *
 * Por qué esto es seguro: el sistema y sus datos viven en esa PC. Quien
 * tiene la PC en las manos ya tiene todo. La protección real de la fábrica
 * es quién puede sentarse frente a esa máquina, no una contraseña que
 * nadie podría restablecer nunca.
 *
 * Todo queda anotado en la bitácora.
 */
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

const { migrar } = require('./db/migrar');
const { bd } = require('./db/conexion');
const { hashear, esPinValido } = require('./lib/seguridad');
const { ahora } = require('./lib/ids');
const bitacora = require('./lib/bitacora');
const { VERSION_ACTUAL } = require('./version');

async function principal() {
  console.log(`\n  Hielo LOLHA — Recuperar el acceso  (v${VERSION_ACTUAL})`);
  console.log('  ' + '-'.repeat(46) + '\n');

  migrar({ silencioso: true });

  const admins = bd.prepare(`
    SELECT id, nombre, usuario FROM usuarios
    WHERE rol = 'admin' AND activo = 1 ORDER BY nombre
  `).all();

  if (admins.length === 0) {
    console.log('  No hay ningún administrador activo en el sistema.');
    console.log('  Abre el sistema: te pedirá crear la cuenta desde cero.\n');
    return;
  }

  console.log('  Administradores del sistema:\n');
  admins.forEach((a, i) => {
    console.log(`     ${i + 1}) ${a.nombre}${a.usuario ? `   (usuario: ${a.usuario})` : ''}`);
  });
  console.log('');

  const consola = readline.createInterface({ input: stdin, output: stdout });

  try {
    const eleccion = await consola.question('  ¿A cuál le pongo claves nuevas? (número, o Enter para salir): ');
    if (!eleccion.trim()) { console.log('\n  No se cambió nada.\n'); return; }

    const admin = admins[Number(eleccion.trim()) - 1];
    if (!admin) { console.log('\n  Ese número no está en la lista. No se cambió nada.\n'); return; }

    console.log(`\n  Cuenta elegida: ${admin.nombre}\n`);

    const pin = (await consola.question('  PIN nuevo (4 a 6 dígitos): ')).trim();
    if (!esPinValido(pin)) { console.log('\n  El PIN debe ser de 4 a 6 dígitos. No se cambió nada.\n'); return; }

    const contrasena = (await consola.question('  Contraseña nueva (mínimo 8 caracteres): ')).trim();
    if (contrasena.length < 8) { console.log('\n  La contraseña es muy corta. No se cambió nada.\n'); return; }

    let usuario = admin.usuario;
    if (!usuario) {
      usuario = (await consola.question('  Nombre de usuario para entrar (ej. tony): ')).trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,20}$/.test(usuario)) {
        console.log('\n  Usuario inválido. No se cambió nada.\n'); return;
      }
    }

    const p = hashear(pin);
    const c = hashear(contrasena);

    bd.prepare(`
      UPDATE usuarios
         SET pin_hash = ?, pin_sal = ?, contrasena_hash = ?, contrasena_sal = ?, usuario = ?
       WHERE id = ?
    `).run(p.hash, p.sal, c.hash, c.sal, usuario, admin.id);

    // Se cierran todas sus sesiones: si alguien más estaba dentro, sale.
    bd.prepare('UPDATE sesiones_dispositivo SET cerrada_en = ? WHERE usuario_id = ? AND cerrada_en IS NULL')
      .run(ahora(), admin.id);

    bitacora.registrar({
      accion: 'usuario.recuperacion_acceso', entidad: 'usuario', entidadId: admin.id,
      ejecutorId: admin.id, detalle: { desde: 'consola de la PC' }
    });

    console.log('\n  ' + '='.repeat(46));
    console.log('   Listo. Ya puedes entrar con:');
    console.log(`      usuario:    ${usuario}`);
    console.log('      contraseña: la que acabas de escribir');
    console.log('      PIN:        el que acabas de escribir');
    console.log('  ' + '='.repeat(46));
    console.log('\n   Quedó anotado en la bitácora del sistema.\n');
  } finally {
    consola.close();
  }
}

principal().catch((e) => {
  console.error('\n  Ocurrió un error:', e.message, '\n');
  process.exit(1);
});
