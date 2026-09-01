/**
 * LA PUESTA EN MARCHA  (v2.8)
 *
 * Lo que importa probar:
 *  · que sembrar un paño NO fabrica marquetas (las estadísticas quedan en
 *    cero) pero SÍ deja el estado real (congelando con sus horas)
 *  · que un paño con historia real no se puede pisar desde la siembra
 *  · que cerrar-pruebas borra los movimientos, deja lo configurado y la
 *    bitácora, y solo funciona UNA vez
 *  · que nadie más que el administrador entra aquí
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, entrarPorNombre, crearUsuario, bd, preparar } =
  fabricaDePrueba('arranque');

let tanque, panos;

preparar(async () => {
  const r = await llamar('/api/tanques', {
    method: 'POST',
    cuerpo: { nombre: 'T1', panos: 6, plantilla: [3, 3], horasCongelacion: 24 }
  });
  tanque = r.json.datos.tanque;
  panos = tanque.panos;
});

test('solo el administrador entra a la puesta en marcha', async () => {
  await entrarAdmin();
  await crearUsuario('Gerente G', 'gerente', '5555');
  await entrarPorNombre('Gerente G', '5555');
  assert.equal((await llamar('/api/arranque/estado')).estado, 403,
               'ni el gerente: es el botón del super administrador');
  await entrarAdmin();
  assert.equal((await llamar('/api/arranque/estado')).estado, 200);
});

test('sembrar un paño lo deja congelando SIN fabricar una sola marqueta', async () => {
  await entrarAdmin();
  const hace12h = new Date(Date.now() - 12 * 3600 * 1000).toISOString();

  const r = await llamar('/api/arranque/panos', {
    method: 'POST',
    cuerpo: { panos: [{ panoId: panos[0].id, situacion: 'congelando',
                        desde: hace12h, tipoAgua: 'purificada' }] }
  });
  assert.equal(r.estado, 201);

  // El estado sale del cálculo de siempre, no de ninguna columna nueva.
  const d = (await llamar(`/api/produccion/estado?tanque=${tanque.id}`)).json.datos;
  const p1 = d.tanque.panos.find((p) => p.numero === 1);
  assert.equal(p1.estado, 'congelando');
  assert.ok(p1.horas >= 11 && p1.horas <= 13, `lleva ~12 h (${p1.horas})`);

  // Y la producción sigue en CERO: la siembra es estadísticamente inerte.
  const hoy = (await llamar('/api/produccion/hoy')).json.datos;
  assert.equal(hoy.marquetas, 0, 'ni una marqueta fantasma');
  assert.equal(hoy.panos.length, 0, 'ningún papel de producción');
});

test('un paño se puede dejar fuera del tanque, también sin marquetas', async () => {
  await entrarAdmin();
  const r = await llamar('/api/arranque/panos', {
    method: 'POST',
    cuerpo: { panos: [{ panoId: panos[1].id, situacion: 'fuera',
                        desde: new Date().toISOString() }] }
  });
  assert.equal(r.estado, 201);

  const d = (await llamar(`/api/produccion/estado?tanque=${tanque.id}`)).json.datos;
  assert.equal(d.tanque.panos.find((p) => p.numero === 2).estado, 'fuera');
  assert.equal((await llamar('/api/produccion/hoy')).json.datos.marquetas, 0);
});

test('re-sembrar corrige la siembra sin duplicarla', async () => {
  await entrarAdmin();
  const hace6h = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
  await llamar('/api/arranque/panos', {
    method: 'POST',
    cuerpo: { panos: [{ panoId: panos[0].id, situacion: 'congelando',
                        desde: hace6h, tipoAgua: 'potable' }] } });

  const filas = bd.prepare(`
    SELECT COUNT(*) n FROM rellenados r
      JOIN canastas c ON c.id = r.canasta_id
     WHERE c.pano_id = ?
  `).get(panos[0].id).n;
  assert.equal(filas, 2, 'una por canasta, las viejas sembradas se fueron');

  const d = (await llamar(`/api/produccion/estado?tanque=${tanque.id}`)).json.datos;
  const p1 = d.tanque.panos.find((p) => p.numero === 1);
  assert.ok(p1.horas >= 5 && p1.horas <= 7, 'ahora dice ~6 h');
});

test('las fechas inventadas no pasan: ni futuras ni de hace un mes', async () => {
  await entrarAdmin();
  for (const desde of [
    new Date(Date.now() + 3600 * 1000).toISOString(),
    new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    'ayer como a las 8'
  ]) {
    const r = await llamar('/api/arranque/panos', {
      method: 'POST',
      cuerpo: { panos: [{ panoId: panos[2].id, situacion: 'congelando', desde }] } });
    assert.equal(r.estado, 400, desde);
  }
});

test('la rotación se fija diciendo cuál fue el último, y contesta cuál toca', async () => {
  await entrarAdmin();
  const r = await llamar('/api/arranque/rotacion', {
    method: 'POST', cuerpo: { tanqueId: tanque.id, ultimoPanoSacado: 3 } });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.entoncesToca, 5, 'después del 3 va el 5: intercalado');

  const d = (await llamar(`/api/produccion/estado?tanque=${tanque.id}`)).json.datos;
  assert.equal(d.tanque.siguiente.numero, 5);
});

test('un paño con historia REAL no se deja pisar por la siembra', async () => {
  await entrarAdmin();
  // El 5 toca: se saca de verdad.
  const p5 = panos.find((p) => p.numero === 5);
  const real = await llamar(`/api/produccion/panos/${p5.id}/sacar`, {
    method: 'POST', cuerpo: { tipoAgua: 'purificada' } });
  assert.equal(real.estado, 201);

  const r = await llamar('/api/arranque/panos', {
    method: 'POST',
    cuerpo: { panos: [{ panoId: p5.id, situacion: 'fuera',
                        desde: new Date().toISOString() }] } });
  assert.equal(r.estado, 409, 'ya tiene registros de verdad');
  assert.match(r.json.error, /historia/);
});

test('el cuadre exige motivo y fecha posterior a lo registrado', async () => {
  await entrarAdmin();
  const p5 = panos.find((p) => p.numero === 5);

  const sinMotivo = await llamar('/api/arranque/cuadre-panos', {
    method: 'POST',
    cuerpo: { panos: [{ panoId: p5.id, situacion: 'fuera',
                        desde: new Date().toISOString() }] } });
  assert.equal(sinMotivo.estado, 400, 'sin motivo no hay cuadre');

  const atras = await llamar('/api/arranque/cuadre-panos', {
    method: 'POST',
    cuerpo: { motivo: 'Prueba', panos: [{ panoId: p5.id, situacion: 'fuera',
              desde: new Date(Date.now() - 24 * 3600 * 1000).toISOString() }] } });
  assert.equal(atras.estado, 409, 'no se reescribe lo ya registrado');

  const bien = await llamar('/api/arranque/cuadre-panos', {
    method: 'POST',
    cuerpo: { motivo: 'Se fue la luz y se sacó sin capturar',
              panos: [{ panoId: p5.id, situacion: 'fuera',
                        desde: new Date(Date.now() + 60 * 1000).toISOString() }] } });
  // +1 minuto se recorta a "no futuro" con 5 min de tolerancia: pasa.
  assert.equal(bien.estado, 201);

  const cuantos = (await llamar('/api/arranque/estado')).json.datos.cuadres;
  assert.equal(cuantos, 1, 'y el contador de cuadres lo dice');
});

test('cerrar las pruebas borra el ensayo, deja lo configurado, y es de una vez', async () => {
  await entrarAdmin();
  // Ensayo: una venta y un gasto.
  await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 500 } });
  assert.ok(bd.prepare('SELECT COUNT(*) n FROM ventas').get().n >= 1);

  // Sin contraseña no pasa.
  const sinClave = await llamar('/api/arranque/cerrar-pruebas', { method: 'POST', cuerpo: {} });
  assert.equal(sinClave.estado, 403);
  assert.ok(sinClave.json.requiereContrasena);

  const admin = sinClave.json.administradores[0];
  const r = await llamar('/api/arranque/cerrar-pruebas', {
    method: 'POST',
    cuerpo: { autorizacion: { usuarioId: admin.id, contrasena: 'clavelarga1' } } });
  assert.equal(r.estado, 200);

  assert.equal(bd.prepare('SELECT COUNT(*) n FROM ventas').get().n, 0);
  assert.equal(bd.prepare('SELECT COUNT(*) n FROM sacadas').get().n, 0);
  assert.equal(bd.prepare('SELECT COUNT(*) n FROM cajas').get().n, 0);
  // Lo que costó trabajo armar se queda:
  assert.ok(bd.prepare('SELECT COUNT(*) n FROM tanques').get().n >= 1);
  assert.ok(bd.prepare('SELECT COUNT(*) n FROM usuarios').get().n >= 1);
  assert.ok(bd.prepare('SELECT COUNT(*) n FROM bitacora').get().n > 0,
            'la bitácora es intocable');
  assert.equal(bd.prepare('SELECT ultimo_pano_sacado FROM tanques LIMIT 1').get()
    .ultimo_pano_sacado, null, 'el cursor de la rotación también era de prueba');

  // Y el folio del primer ticket real vuelve a empezar.
  await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 500 } });
  const v = bd.prepare('SELECT folio FROM ventas ORDER BY fecha DESC LIMIT 1').get();
  assert.equal(v.folio, 1, 'el ticket #1 de la vida real');
});

test('tras dar por hecha la puesta en marcha, cerrar-pruebas muere para siempre', async () => {
  await entrarAdmin();
  const t = await llamar('/api/arranque/terminar', { method: 'POST', cuerpo: {} });
  assert.equal(t.estado, 200);

  const otra = await llamar('/api/arranque/cerrar-pruebas', {
    method: 'POST', cuerpo: { autorizacion: { usuarioId: 'x', contrasena: 'x' } } });
  assert.equal(otra.estado, 410, 'era de una sola vez');

  const d = (await llamar('/api/arranque/estado')).json.datos;
  assert.ok(d.terminada?.terminada_en, 'queda la constancia con su fecha');

  const dosVeces = await llamar('/api/arranque/terminar', { method: 'POST', cuerpo: {} });
  assert.equal(dosVeces.estado, 400);
});
