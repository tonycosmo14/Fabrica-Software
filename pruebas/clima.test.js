/**
 * LA TEMPERATURA  (v3.6)
 *
 * Lo que de verdad hay que probar aquí no es que sepa leer un número: es
 * que NUNCA estorbe. La fábrica vende hielo sin internet, así que el clima
 * es un dato de más y jamás una condición.
 *
 * El servicio de afuera se sustituye por uno de mentira en cada prueba
 * —así se comprueba el reloj, el guardado y lo que pasa cuando falla sin
 * depender de que haya internet mientras se prueba—.
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, bd, preparar } = fabricaDePrueba('clima');

let servicio, tanqueId;

preparar(async () => {
  servicio = require('../src/modulos/clima/servicio');
  const r = await llamar('/api/tanques', {
    method: 'POST',
    cuerpo: { nombre: 'N', panos: 2, plantilla: [2], horasCongelacion: 24 } });
  tanqueId = r.json.datos.tanque.id;
});

/** Un servicio de mentira que contesta lo que se le diga. */
const contesta = (current) => async () => ({ ok: true, json: async () => ({ current }) });
const revienta = (mensaje) => async () => { throw new Error(mensaje); };

test('lee la temperatura y la guarda', async () => {
  servicio.olvidar();
  const c = await servicio.ahoraMismo({
    traer: contesta({ temperature_2m: 31.24, relative_humidity_2m: 70.6,
                      apparent_temperature: 38.1 }),
    forzar: true
  });

  assert.equal(c.temperatura, 31.2, 'un decimal, no catorce');
  assert.equal(c.sensacion, 38.1);
  assert.equal(c.humedad, 71);
  assert.equal(c.hayInternet, true);

  const guardado = bd.prepare('SELECT * FROM clima_registros ORDER BY fecha DESC LIMIT 1').get();
  assert.equal(guardado.temperatura, 31.2);
  assert.equal(guardado.fuente, 'internet');
});

test('sin internet NO se rompe: devuelve la última que se supo', async () => {
  servicio.olvidar();
  const c = await servicio.ahoraMismo({ traer: revienta('getaddrinfo ENOTFOUND'), forzar: true });

  assert.equal(c.hayInternet, false, 'dice que no pudo');
  assert.equal(c.temperatura, 31.2, 'y da la última buena en vez de nada');
  assert.ok(c.cuando, 'diciendo de cuándo es');
  assert.match(c.porque, /ENOTFOUND/, 'el motivo queda apuntado, no se grita');
});

test('la pantalla sigue funcionando aunque nunca se haya podido tomar ninguna', async () => {
  // Se borra todo lo guardado: es el caso del primer día sin internet.
  bd.prepare('DELETE FROM clima_registros').run();
  servicio.olvidar();

  const c = await servicio.ahoraMismo({ traer: revienta('sin red'), forzar: true });
  assert.equal(c.temperatura, null, 'no inventa un número');
  assert.equal(c.hayInternet, false);
});

test('no le pregunta a internet a cada rato', async () => {
  servicio.olvidar();
  let veces = 0;
  const contando = async (...args) => {
    veces++;
    return contesta({ temperature_2m: 30, relative_humidity_2m: 60 })(...args);
  };

  await servicio.ahoraMismo({ traer: contando, forzar: true });
  await servicio.ahoraMismo({ traer: contando });
  await servicio.ahoraMismo({ traer: contando });

  assert.equal(veces, 1, 'tres pantallas abiertas no son tres llamadas a internet');
});

test('no guarda un renglón por minuto', async () => {
  bd.prepare('DELETE FROM clima_registros').run();
  servicio.olvidar();

  for (let i = 0; i < 5; i++) {
    await servicio.ahoraMismo({
      traer: contesta({ temperature_2m: 30 + i }), forzar: true });
  }

  const cuantos = bd.prepare('SELECT COUNT(*) n FROM clima_registros').get().n;
  assert.equal(cuantos, 1, 'una por hora: con la máxima y la mínima del día alcanza');
});

test('se puede escribir a mano cuando no hay internet', async () => {
  await entrarAdmin();
  const r = await llamar('/api/clima', { method: 'POST', cuerpo: { temperatura: 34.5, humedad: 80 } });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.registro.fuente, 'mano');

  const mal = await llamar('/api/clima', { method: 'POST', cuerpo: { temperatura: 300 } });
  assert.equal(mal.estado, 400, 'trescientos grados no es una temperatura');
});

test('la ruta del clima no falla nunca, ni sin internet', async () => {
  await entrarAdmin();
  const r = await llamar('/api/clima');
  assert.equal(r.estado, 200, 'una fábrica que no vende porque no cargó el clima sería peor');
  assert.ok('temperatura' in r.json.datos.clima);
});

// ============================================================
// LA SALMUERA
// ============================================================

test('tres tomas y su promedio, que no se guarda', async () => {
  await entrarAdmin();
  const r = await llamar('/api/clima/salmuera', {
    method: 'POST',
    cuerpo: { tanqueId, serpentines: -9.5, salidaCerca: -8.5, salidaLejos: -7 }
  });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.medicion.promedio, -8.3);

  const columnas = bd.prepare('SELECT * FROM pragma_table_info(?)')
    .all('temperaturas_salmuera').map((c) => c.name);
  assert.ok(!columnas.includes('promedio'),
    'el promedio se calcula, no se guarda: si no, dejaría de cuadrar con sus tomas');
});

test('con una sola toma también se puede anotar', async () => {
  await entrarAdmin();
  const r = await llamar('/api/clima/salmuera', {
    method: 'POST', cuerpo: { tanqueId, salidaLejos: -6.2 } });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.medicion.promedio, -6.2);
  assert.equal(r.json.datos.medicion.tomas, 1);

  const vacia = await llamar('/api/clima/salmuera', { method: 'POST', cuerpo: { tanqueId } });
  assert.equal(vacia.estado, 400, 'pero una medición vacía no es una medición');
});

test('cada tanque sabe cuándo se le midió por última vez', async () => {
  await entrarAdmin();
  const { json } = await llamar(`/api/clima/salmuera?tanque=${tanqueId}`);
  assert.equal(json.datos.mediciones.length, 2);
  assert.ok(json.datos.ultimaPorTanque[tanqueId], 'el panel puede enseñar la última');
  assert.equal(json.datos.ultimaPorTanque[tanqueId].promedio, -6.2, 'la más nueva');
});

test('una medición mal capturada se anula, no se borra', async () => {
  await entrarAdmin();
  const { json } = await llamar(`/api/clima/salmuera?tanque=${tanqueId}`);
  const m = json.datos.mediciones[0];

  const sinMotivo = await llamar(`/api/clima/salmuera/${m.id}/anular`, {
    method: 'POST', cuerpo: {} });
  assert.equal(sinMotivo.estado, 400, 'siempre con su motivo');

  const r = await llamar(`/api/clima/salmuera/${m.id}/anular`, {
    method: 'POST', cuerpo: { motivo: 'Se apuntó el tanque equivocado' } });
  assert.equal(r.estado, 200);

  const sigue = bd.prepare('SELECT * FROM temperaturas_salmuera WHERE id = ?').get(m.id);
  assert.ok(sigue, 'el renglón sigue ahí');
  assert.equal(sigue.motivo_anulacion, 'Se apuntó el tanque equivocado');

  const despues = (await llamar(`/api/clima/salmuera?tanque=${tanqueId}`)).json.datos;
  assert.equal(despues.ultimaPorTanque[tanqueId].id, json.datos.mediciones[1].id,
    'y la última pasa a ser la anterior');
});
