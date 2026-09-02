/**
 * CANASTA POR CANASTA  (v3.2)
 *
 * Un paño no siempre sale de un jalón. A veces se saca una canasta y no se
 * toca la siguiente hasta que esa se gasta, para darle más horas al hielo;
 * entonces el turno cierra a media faena y quedan canastas colgadas que
 * saca el turno de mañana.
 *
 * Lo que se comprueba aquí es lo que hace que eso NO se convierta en un
 * lío: que una canasta ya sacada no vuelva a ofrecerse, que cada quien
 * quede con lo suyo, que nadie pueda pasar al siguiente paño mientras
 * quede una canasta colgada, y que el papel del obrero lo diga.
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, entrarPorNombre, bd, preparar } = fabricaDePrueba('pend');

let tanqueId, chemaId, juanId;

const estadoTanque = async () =>
  (await llamar(`/api/produccion/estado?tanque=${tanqueId}`)).json.datos.tanque;

preparar(async () => {
  const r = await llamar('/api/tanques', {
    method: 'POST',
    cuerpo: { nombre: 'N', panos: 4, plantilla: [2, 2, 2], horasCongelacion: 24 }
  });
  tanqueId = r.json.datos.tanque.id;

  const a = await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Don Chema', rol: 'operario', pin: '2222' } });
  chemaId = a.json.datos.usuario.id;
  const b = await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Juan', rol: 'operario', pin: '3333' } });
  juanId = b.json.datos.usuario.id;
});

test('se puede sacar una sola canasta y el paño queda a medias', async () => {
  await entrarAdmin();
  const t = await estadoTanque();
  const pano = t.panos.find((p) => p.id === t.siguiente.id);

  const r = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST',
    cuerpo: { tipoAgua: 'purificada', ejecutorId: chemaId,
              canastas: [pano.canastas[0].id] }
  });

  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.canastas, 1);
  assert.equal(r.json.datos.terminado, false);
  assert.equal(r.json.datos.faltan, 2, 'quedaron dos canastas colgadas');
});

test('la canasta ya sacada no se vuelve a ofrecer', async () => {
  // Al sacar una canasta se rellena en el mismo movimiento, así que al
  // ratito vuelve a verse "congelando". Sin la resta, terminar el paño
  // inventaría otra vez las marquetas de la de ayer.
  await entrarAdmin();
  const t = await estadoTanque();
  const pano = t.panos.find((p) => p.enProceso);
  assert.ok(pano, 'hay un paño a medias');

  assert.equal(pano.faltan, 2);
  assert.equal(pano.canastas.filter((c) => c.yaSacada).length, 1);
  const hecha = pano.canastas.find((c) => c.yaSacada);
  assert.equal(hecha.sacadaPor, 'Don Chema', 'y dice quién la sacó');
  assert.ok(hecha.sacadaEn);

  // Pedirla otra vez a propósito: el servidor no la deja pasar.
  const r = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST', cuerpo: { tipoAgua: 'purificada', canastas: [hecha.id] }
  });
  assert.equal(r.estado, 409);
});

test('nadie puede pasar al siguiente paño mientras quede una canasta', async () => {
  await entrarAdmin();
  const t = await estadoTanque();
  const aMedias = t.panos.find((p) => p.enProceso);

  assert.equal(t.siguiente.id, aMedias.id, 'el que toca sigue siendo el de a medias');
  assert.match(t.siguiente.porque, /a medias/i);

  // Y el de al lado exige autorización.
  const otro = t.panos.find((p) => p.id !== aMedias.id);
  const r = await llamar(`/api/produccion/panos/${otro.id}/sacar`, {
    method: 'POST', cuerpo: { tipoAgua: 'purificada' }
  });
  assert.equal(r.estado, 409);
  assert.equal(r.json.requiereAutorizacion, true);
});

test('otro turno termina el paño, y cada canasta queda con quien la sacó', async () => {
  await entrarAdmin();
  const t = await estadoTanque();
  const pano = t.panos.find((p) => p.enProceso);
  const faltan = pano.canastas.filter((c) => !c.yaSacada).map((c) => c.id);

  const r = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST',
    cuerpo: { tipoAgua: 'purificada', ejecutorId: juanId, canastas: faltan }
  });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.terminado, true, 'ahora sí se cerró');
  assert.equal(r.json.datos.faltan, 0);

  // Cada canasta guarda su propio responsable, no el del paño.
  const quienes = bd.prepare(`
    SELECT COALESCE(u.nombre,'') AS nombre, COUNT(*) n
      FROM sacadas s
      JOIN sacadas_pano sp ON sp.id = s.sacada_pano_id
      LEFT JOIN usuarios u ON u.id = s.ejecutor_id
     WHERE sp.pano_id = ?
     GROUP BY s.ejecutor_id ORDER BY nombre
  `).all(pano.id);

  assert.deepEqual(quienes.map((q) => [q.nombre, q.n]), [['Don Chema', 1], ['Juan', 2]],
    'una la sacó Chema y dos Juan: el papel del día tiene que poder decirlo');
});

test('la ficha del paño nombra a los dos que le metieron mano', async () => {
  await entrarAdmin();
  const t = await estadoTanque();
  const pano = t.panos.find((p) => p.ultimaSacada);

  const r = await llamar(`/api/produccion/panos/${pano.id}/ficha`);
  const quienes = r.json.datos.ultima.quienes;
  assert.ok(quienes.includes('Don Chema'), `sale Chema: ${quienes}`);
  assert.ok(quienes.includes('Juan'), `sale Juan: ${quienes}`);
});

test('el renglón del paño también los nombra a los dos', async () => {
  await entrarAdmin();
  const t = await estadoTanque();
  const u = t.panos.find((p) => p.ultimaSacada).ultimaSacada;
  assert.equal(u.quienes.length, 2);
});

test('el papel del obrero dice qué canastas quedaron y quién empezó', async () => {
  await entrarAdmin();
  // Se deja otro paño a medias a propósito.
  const t = await estadoTanque();
  const pano = t.panos.find((p) => p.id === t.siguiente.id);
  await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST',
    cuerpo: { tipoAgua: 'purificada', ejecutorId: chemaId, canastas: [pano.canastas[0].id] }
  });

  const r = await llamar('/api/produccion/siguientes');
  const grupo = r.json.datos.lista.find((g) => g.tanque === 'N');

  assert.equal(grupo.aMedias.length, 1);
  assert.equal(grupo.aMedias[0].pano, pano.numero);
  assert.equal(grupo.aMedias[0].faltan, 2);
  assert.equal(grupo.aMedias[0].total, 3);
  assert.equal(grupo.aMedias[0].empezadoPor, 'Don Chema');
});

test('el papel no pierde la fila del turno por una canasta colgada', async () => {
  // Antes, con un paño a medias la cuenta de la rotación se quedaba quieta:
  // en la segunda vuelta salía otra vez el mismo número, se detectaba
  // repetido y el papel se quedaba con UN solo paño. El obrero perdía la
  // fila de toda su jornada por una canasta.
  await entrarAdmin();
  const r = await llamar('/api/produccion/siguientes');
  const grupo = r.json.datos.lista.find((g) => g.tanque === 'N');

  assert.ok(grupo.aMedias.length, 'este tanque tiene un paño a medias');
  assert.ok(grupo.siguientes.length > 1,
    `la lista trae la jornada entera, no un número suelto: ${grupo.siguientes}`);
  assert.equal(grupo.siguientes[0], grupo.aMedias[0].pano,
    'y el primero es el que hay que terminar');
  assert.equal(new Set(grupo.siguientes).size, grupo.siguientes.length,
    'sin repetidos');
});

test('lo que ya no va a salir se cierra marcándolo, y el paño avanza', async () => {
  // "Si ya no fueran a salir se marcan como merma, aguadas o algo y ya se
  // pasa al siguiente paño." Eso es sacar las que faltan con un estado que
  // dice la verdad, no borrarlas.
  await entrarAdmin();
  const t = await estadoTanque();
  const pano = t.panos.find((p) => p.enProceso);
  const faltan = pano.canastas.filter((c) => !c.yaSacada).map((c) => c.id);

  const r = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST',
    cuerpo: { tipoAgua: 'purificada', calidad: 'aguada', canastas: faltan }
  });
  assert.equal(r.json.datos.terminado, true);
  assert.equal(r.json.datos.mezcla.aguada, 4, 'dos canastas de dos moldes');
  assert.equal(r.json.datos.marquetas, 0, 'de esas no salió nada que vender');

  const despues = await estadoTanque();
  assert.ok(!despues.panos.some((p) => p.enProceso), 'ya no hay nada a medias');
  assert.notEqual(despues.siguiente.id, pano.id, 'y la rotación avanzó');
});
