/**
 * Pruebas de la Existencia: el cuadre del cuarto frío.
 *
 *     existencia anterior + producido − contado = SALIDAS
 *     salidas − vendido = FALTANTE
 *
 * Todo viaja en DIECISEISAVOS: 6 marquetas son 96.
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, bd, preparar } = fabricaDePrueba('exis');

let tanqueId, panos, almacenId;


/** Saca el paño que toca en el tanque, sin pedir autorización. */
async function sacarElQueToca() {
  const { json } = await llamar(`/api/produccion/estado?tanque=${tanqueId}`);
  const toca = json.datos.tanque.siguiente;
  await llamar(`/api/produccion/panos/${toca.id}/sacar`, {
    method: 'POST', cuerpo: { tipoAgua: 'purificada' }
  });
  return json.datos.tanque.panos.find((p) => p.id === toca.id).total_moldes;
}

preparar(async () => {
  const r = await llamar('/api/tanques', {
    method: 'POST',
    cuerpo: { nombre: '2N', panos: 6, plantilla: [3, 3], horasCongelacion: 24 }
  });
  tanqueId = r.json.datos.tanque.id;
  panos = r.json.datos.tanque.panos;

  const a = await llamar('/api/existencia/almacenes');
  almacenId = a.json.datos.almacenes[0].id;
});

test('el sistema arranca con un cuarto frío listo', async () => {
  const { json } = await llamar('/api/existencia');
  assert.equal(json.datos.almacenes.length, 1);
  assert.equal(json.datos.almacenes[0].almacen.nombre, 'Cuarto frío');
  assert.deepEqual(json.datos.horarios, ['15:00', '20:00']);
});

test('lo que sale de los tanques suma a lo que debería haber', async () => {
  const moldes = await sacarElQueToca();      // 6 marquetas

  const { json } = await llamar('/api/existencia');
  const a = json.datos.almacenes[0];
  assert.equal(a.existenciaAnterior, 0);
  assert.equal(a.producido, moldes * 16);
  assert.equal(a.teorico, moldes * 16);
  assert.equal(a.textos.teorico, String(moldes));
});

test('el primer conteo solo fija el punto de partida', async () => {
  const r = await llamar('/api/existencia/conteos', {
    method: 'POST', cuerpo: { almacenId, dieciseisavos: 6 * 16 }
  });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.resumen.primerConteo, true);
  assert.equal(r.json.datos.resumen.contado, 96);
});

test('el segundo conteo revela lo que salió del cuarto frío', async () => {
  await sacarElQueToca();                     // +6 marquetas producidas

  // De las 12 que debería haber, solo quedan 4: salieron 8.
  const r = await llamar('/api/existencia/conteos', {
    method: 'POST', cuerpo: { almacenId, dieciseisavos: 4 * 16 }
  });
  const s = r.json.datos.resumen;

  assert.equal(s.anterior, 6 * 16);
  assert.equal(s.producido, 6 * 16);
  assert.equal(s.teorico, 12 * 16);
  assert.equal(s.contado, 4 * 16);
  assert.equal(s.salidas, 8 * 16);
  // Todavía no hay punto de venta en esta prueba: nada explica esas salidas.
  assert.equal(s.vendido, 0);
  assert.equal(s.faltante, 8 * 16);
});

test('si sobran marquetas, las salidas salen en negativo', async () => {
  const r = await llamar('/api/existencia/conteos', {
    method: 'POST', cuerpo: { almacenId, dieciseisavos: 10 * 16 }
  });
  // Debería haber 4 (no se produjo nada) y hay 10: sobran 6.
  assert.equal(r.json.datos.resumen.salidas, -6 * 16);
});

test('el conteo se guarda en dieciseisavos enteros', () => {
  const c = bd.prepare('SELECT * FROM conteos ORDER BY fecha DESC LIMIT 1').get();
  assert.equal(c.contado, 10 * 16);
  assert.equal(Number.isInteger(c.contado), true);
});

/**
 * En la fábrica el conteo se dicta con fracción: "quedan 14 marquetas y 5/8".
 * Si el sistema solo aceptara enteros, ese 5/8 se perdería todos los días.
 */
test('el conteo acepta marquetas con fracción: 14 y 5/8', async () => {
  const r = await llamar('/api/existencia/conteos', {
    method: 'POST', cuerpo: { almacenId, dieciseisavos: 14 * 16 + 10 }
  });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.resumen.contado, 234);

  const c = bd.prepare('SELECT * FROM conteos ORDER BY fecha DESC LIMIT 1').get();
  assert.equal(c.contado, 234);

  const { json } = await llamar('/api/existencia');
  assert.equal(json.datos.almacenes[0].textos.anterior, '14 5/8');
});

test('otra fracción de las que se dictan: 30 y 11/16', async () => {
  const r = await llamar('/api/existencia/conteos', {
    method: 'POST', cuerpo: { almacenId, dieciseisavos: 30 * 16 + 11 }
  });
  assert.equal(r.json.datos.resumen.contado, 491);

  const { json } = await llamar('/api/existencia');
  assert.equal(json.datos.almacenes[0].textos.anterior, '30 11/16');
});

test('sigue aceptando marquetas enteras, como lo mandaban las pantallas viejas', async () => {
  const r = await llamar('/api/existencia/conteos', {
    method: 'POST', cuerpo: { almacenId, marquetas: 7 }
  });
  assert.equal(r.json.datos.resumen.contado, 7 * 16);
});

test('una cantidad que no es entera de dieciseisavos se rechaza', async () => {
  const r = await llamar('/api/existencia/conteos', {
    method: 'POST', cuerpo: { almacenId, dieciseisavos: 12.5 }
  });
  assert.equal(r.estado, 400);
});

test('el conteo congela los números: corregir producción vieja no lo cambia', async () => {
  const antes = bd.prepare('SELECT * FROM conteos ORDER BY fecha DESC LIMIT 1').get();

  // Se anula una sacada anterior al conteo.
  const sp = bd.prepare('SELECT id, pano_id FROM sacadas_pano ORDER BY iniciada_en LIMIT 1').get();
  await llamar(`/api/produccion/panos/${sp.pano_id}/anular-ultima`, {
    method: 'POST', cuerpo: { motivo: 'Prueba de que el histórico no se mueve' }
  });

  const despues = bd.prepare('SELECT * FROM conteos WHERE id = ?').get(antes.id);
  assert.equal(despues.producido, antes.producido);
  assert.equal(despues.salidas, antes.salidas);
  assert.equal(despues.existencia_anterior, antes.existencia_anterior);
});

test('anular un conteo devuelve el anterior como bueno', async () => {
  const ultimo = bd.prepare('SELECT * FROM conteos WHERE anulado_en IS NULL ORDER BY fecha DESC LIMIT 1').get();
  const previo = bd.prepare(`
    SELECT * FROM conteos WHERE anulado_en IS NULL AND fecha < ? ORDER BY fecha DESC LIMIT 1
  `).get(ultimo.fecha);

  const r = await llamar(`/api/existencia/conteos/${ultimo.id}/anular`, {
    method: 'POST', cuerpo: { motivo: 'Se contó mal' }
  });
  assert.equal(r.estado, 200);

  const { json } = await llamar('/api/existencia');
  assert.equal(json.datos.almacenes[0].existenciaAnterior, previo.contado);
});

test('anular exige motivo', async () => {
  const c = bd.prepare('SELECT id FROM conteos WHERE anulado_en IS NULL LIMIT 1').get();
  const r = await llamar(`/api/existencia/conteos/${c.id}/anular`, { method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 400);
});

test('se puede dar de alta un segundo cuarto frío que no recibe producción', async () => {
  const r = await llamar('/api/existencia/almacenes', {
    method: 'POST', cuerpo: { nombre: 'Bodega chica', recibeProduccion: false }
  });
  assert.equal(r.estado, 201);

  const { json } = await llamar('/api/existencia');
  const bodega = json.datos.almacenes.find((a) => a.almacen.nombre === 'Bodega chica');
  assert.equal(bodega.producido, 0);          // no recibe lo de los tanques
  assert.equal(bodega.teorico, 0);
  assert.equal(bodega.textos.teorico, '0');
});

test('no se puede dejar la fábrica sin un cuarto que reciba la producción', async () => {
  const { json } = await llamar('/api/existencia/almacenes');
  const principal = json.datos.almacenes.find((a) => a.recibe_produccion);

  const r = await llamar(`/api/existencia/almacenes/${principal.id}`, {
    method: 'PUT', cuerpo: { recibeProduccion: false }
  });
  assert.equal(r.estado, 400);
  assert.match(r.json.error, /tiene que recibir la producción/);
});

test('los horarios de conteo se validan', async () => {
  const mala = await llamar('/api/existencia/horarios', {
    method: 'PUT', cuerpo: { horarios: ['25:00'] }
  });
  assert.equal(mala.estado, 400);

  const buena = await llamar('/api/existencia/horarios', {
    method: 'PUT', cuerpo: { horarios: ['15:00', '20:00', '07:30'] }
  });
  assert.equal(buena.estado, 200);
  assert.deepEqual(buena.json.datos.horarios, ['07:30', '15:00', '20:00']);
});

test('un cajero cuenta pero no configura ni anula', async () => {
  await llamar('/api/usuarios', { method: 'POST', cuerpo: { nombre: 'Rosa', rol: 'cajero', pin: '4444' } });
  const lista = (await llamar('/api/auth/usuarios-disponibles')).json.datos.usuarios;
  const rosa = lista.find((u) => u.nombre === 'Rosa');
  await llamar('/api/auth/entrar-pin', { method: 'POST', cuerpo: { usuarioId: rosa.id, pin: '4444' } });

  const cuenta = await llamar('/api/existencia/conteos', {
    method: 'POST', cuerpo: { almacenId, dieciseisavos: 3 * 16 }
  });
  assert.equal(cuenta.estado, 201);

  const c = bd.prepare('SELECT id FROM conteos WHERE anulado_en IS NULL ORDER BY fecha DESC LIMIT 1').get();
  const anula = await llamar(`/api/existencia/conteos/${c.id}/anular`, {
    method: 'POST', cuerpo: { motivo: 'No debería poder' }
  });
  assert.equal(anula.estado, 403);

  const config = await llamar('/api/existencia/horarios', {
    method: 'PUT', cuerpo: { horarios: ['10:00'] }
  });
  assert.equal(config.estado, 403);
});

test('un operario no ve la existencia', async () => {
  await entrarAdmin();
  await llamar('/api/usuarios', { method: 'POST', cuerpo: { nombre: 'Chema', rol: 'operario', pin: '5555' } });
  const lista = (await llamar('/api/auth/usuarios-disponibles')).json.datos.usuarios;
  const chema = lista.find((u) => u.nombre === 'Chema');
  await llamar('/api/auth/entrar-pin', { method: 'POST', cuerpo: { usuarioId: chema.id, pin: '5555' } });

  const r = await llamar('/api/existencia');
  assert.equal(r.estado, 403);
});


// ============================================================
// EL HISTORIAL DE CONTEOS  (v2.3)
//
// Tocar un renglón ya no anula nada: hay tres botones a la izquierda —ver,
// imprimir, anular—. Para que el ojito pueda volver a enseñar el cuadre sin
// pedirle nada más al servidor, el historial tiene que traer ya todos los
// números congelados de aquel día.
// ============================================================

test('cada renglón del historial trae el cuadre completo de aquel día', async () => {
  await entrarAdmin();
  const { conteos } = (await llamar('/api/existencia/conteos?limite=40')).json.datos;
  assert.ok(conteos.length, 'hay conteos que mirar');

  for (const c of conteos) {
    for (const campo of ['id', 'fecha', 'contado', 'existencia_anterior',
                         'producido', 'vendido', 'salidas', 'almacen']) {
      assert.ok(c[campo] !== undefined, `falta ${campo}: el ojito no podría pintar el detalle`);
    }
  }

  // Y la cuenta cierra con lo que se guardó, no con lo que haya hoy.
  const c = conteos.find((x) => x.desde);
  if (c) {
    assert.equal(c.salidas, c.existencia_anterior + c.producido - c.contado,
                 'las salidas son las de aquel momento');
  }
});

test('el historial dice quién anuló un conteo y por qué', async () => {
  await entrarAdmin();
  const vivo = bd.prepare(
    'SELECT id FROM conteos WHERE anulado_en IS NULL ORDER BY fecha DESC LIMIT 1'
  ).get();
  await llamar(`/api/existencia/conteos/${vivo.id}/anular`, {
    method: 'POST', cuerpo: { motivo: 'Se capturó dos veces' }
  });

  const { conteos } = (await llamar('/api/existencia/conteos?limite=40')).json.datos;
  const anulado = conteos.find((c) => c.id === vivo.id);
  assert.ok(anulado.anulado_en, 'queda marcado, no borrado');
  assert.equal(anulado.motivo_anulacion, 'Se capturó dos veces');
  assert.ok(anulado.anulado_por_nombre, 'y con nombre y apellido');
});

test('un conteo se puede volver a imprimir tantas veces como haga falta', async () => {
  await entrarAdmin();
  const c = bd.prepare('SELECT id FROM conteos ORDER BY fecha DESC LIMIT 1').get();

  // Sin impresora puesta contesta "no imprimí", que es lo que la pantalla
  // necesita para avisar. Lo que no puede es fallar ni desaparecer.
  const r = await llamar(`/api/impresion/conteo/${c.id}`, { method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.impreso, false);
  assert.equal(r.json.datos.motivo, 'sin-destino');

  const otra = await llamar(`/api/impresion/conteo/${c.id}`, { method: 'POST', cuerpo: {} });
  assert.equal(otra.estado, 200, 'reimprimir no gasta el conteo');
});

test('un conteo que no existe no imprime nada', async () => {
  await entrarAdmin();
  const r = await llamar('/api/impresion/conteo/no-existe', { method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 404);
});
