/**
 * CÓMO SALIÓ EL HIELO  (v2.10, rehecho en la v6.5)
 *
 * Lo que se comprueba aquí es la diferencia entre TRES números que antes
 * eran uno solo, y que confundirlos costaría dinero de verdad:
 *
 *   · lo que salió del molde  — lo que costó agua, luz y amoniaco
 *   · lo que entró al cuarto frío — lo único que se puede vender
 *   · cómo salió — la mezcla, que es el aviso temprano de que algo falla
 *
 * Desde la v6.5 la regla es una sola y no hay pregunta de destino: o es de
 * las cuatro que se venden —sellada, 80-90%, 60-80%, 40-60%— o se botó. El
 * caso que lo resume: un paño entero de huecas costó lo mismo que uno de
 * selladas, pero no dejó ni una sola marqueta en el cuarto frío. Si el
 * sistema las contara como existencia, el conteo no cuadraría nunca.
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, bd, preparar } = fabricaDePrueba('calidad');

let tanqueId, almacenId;

/** El paño que toca, con sus moldes. */
async function elQueToca() {
  const { json } = await llamar(`/api/produccion/estado?tanque=${tanqueId}`);
  const t = json.datos.tanque;
  const pano = t.panos.find((p) => p.id === t.siguiente.id);
  return { pano, moldes: pano.canastas.flatMap((c) => c.moldes) };
}

const hoy = async () => (await llamar('/api/produccion/hoy')).json.datos;

preparar(async () => {
  const r = await llamar('/api/tanques', {
    method: 'POST',
    cuerpo: { nombre: '2N', panos: 6, plantilla: [3, 3], horasCongelacion: 24 }
  });
  tanqueId = r.json.datos.tanque.id;

  const a = await llamar('/api/existencia/almacenes');
  almacenId = a.json.datos.almacenes[0].id;
});

// ============================================================
// LA ESCALA
// ============================================================

test('los ocho estados: cuatro se venden y cuatro se botan', () => {
  const calidad = require('../src/modulos/produccion/calidad');
  assert.deepEqual(calidad.VENDIBLES, ['sellada', 'c80', 'c60', 'c40']);
  assert.deepEqual(calidad.MERMAS, ['hueca', 'contaminada', 'aguada', 'otro']);
  assert.equal(calidad.CALIDADES.length, 8);
  // Ni una sola pregunta de destino: eso se fue con la v6.5.
  assert.ok(!calidad.DESTINOS, 'ya no hay destinos');
  assert.ok(!calidad.alAlmacen('sm').includes('destino'));
});

test('sin decir nada, el hielo sale del 80 al 90%', async () => {
  await entrarAdmin();
  const { pano } = await elQueToca();

  const r = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST', cuerpo: { tipoAgua: 'purificada' }
  });

  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.marquetas, 6);
  assert.equal(r.json.datos.producidas, 6);
  assert.equal(r.json.datos.mezcla.c80, 6,
    'lo de siempre no debe costar ni un toque de más');
});

test('un paño de huecas NO es hielo del cuarto frío, y no se pregunta nada', async () => {
  await entrarAdmin();
  const antes = await hoy();
  const { pano } = await elQueToca();

  const r = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST', cuerpo: { tipoAgua: 'purificada', calidad: 'hueca' }
  });

  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.producidas, 6, 'costaron lo mismo que seis selladas');
  assert.equal(r.json.datos.marquetas, 0, 'ninguna se puede vender: se botaron');
  assert.equal(r.json.datos.merma, 6);

  const d = await hoy();
  assert.equal(d.mezcla.hueca - antes.mezcla.hueca, 6);
  assert.equal(d.marquetas, antes.marquetas, 'el cuarto frío no creció');
});

test('las tres del medio se venden igual que la sellada', async () => {
  await entrarAdmin();
  for (const [clave, cuantas] of [['sellada', 6], ['c60', 6], ['c40', 6]]) {
    const antes = await hoy();
    const { pano } = await elQueToca();
    const r = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
      method: 'POST', cuerpo: { tipoAgua: 'purificada', calidad: clave }
    });
    assert.equal(r.estado, 201, clave);
    assert.equal(r.json.datos.marquetas, cuantas, `${clave} se vende`);
    assert.equal(r.json.datos.merma, 0, `${clave} no es merma`);
    const d = await hoy();
    assert.equal(d.marquetas - antes.marquetas, cuantas);
  }
});

test('la existencia esperada solo cuenta el hielo que se puede vender', async () => {
  await entrarAdmin();
  const { json } = await llamar('/api/existencia');
  const a = json.datos.almacenes[0];

  // Hasta aquí: 80-90%, huecas, selladas, 60-80% y 40-60%. Solo el paño de
  // huecas se quedó fuera.
  assert.equal(a.producido, 24 * 16,
    'las huecas no están en el cuarto frío por más que hayan costado igual');
});

test('un molde suelto manda sobre la calidad del paño', async () => {
  await entrarAdmin();
  const { pano, moldes } = await elQueToca();

  const r = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST',
    cuerpo: {
      tipoAgua: 'purificada',
      calidad: 'sellada',
      resultados: [
        { moldeId: moldes[0].id, resultado: 'aguada' },
        { moldeId: moldes[1].id, resultado: 'hueca' }
      ]
    }
  });

  const m = r.json.datos.mezcla;
  assert.equal(m.sellada, 4);
  assert.equal(m.hueca, 1);
  assert.equal(m.aguada, 1);
  assert.equal(m.producidas, 5, 'de la aguada no salió nada; la hueca sí salió');
  assert.equal(r.json.datos.marquetas, 4, 'ni la hueca ni la aguada llegaron al cuarto frío');
});

test('el molde marcado hueco sí cuenta como fallo de ESE molde', async () => {
  await entrarAdmin();
  const { json } = await llamar(`/api/produccion/estado?tanque=${tanqueId}`);
  const moldes = json.datos.tanque.panos.flatMap((p) => p.canastas.flatMap((c) => c.moldes));
  const conFallo = moldes.filter((m) => m.ultimoFallo);

  // Del paño anterior: uno aguado y uno hueco, en un paño de selladas.
  assert.ok(conFallo.length >= 2,
    'salir peor que sus vecinos es lo que marca a un molde');
});

test('que el paño entero salga hueco NO es culpa de ningún molde', async () => {
  await entrarAdmin();
  const { pano } = await elQueToca();

  await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST', cuerpo: { tipoAgua: 'purificada', calidad: 'hueca' }
  });

  const { json } = await llamar(`/api/produccion/estado?tanque=${tanqueId}`);
  const suyos = json.datos.tanque.panos.find((p) => p.id === pano.id)
    .canastas.flatMap((c) => c.moldes);

  assert.ok(suyos.every((m) => m.ultimoResultado === 'hueca'));
  assert.ok(suyos.every((m) => !m.ultimoFallo),
    'si una noche mala pintara de rojo todos los moldes, el aviso dejaría de servir');
});

test('la captura en lote también pregunta cómo salió', async () => {
  await entrarAdmin();
  const { json } = await llamar(`/api/produccion/estado?tanque=${tanqueId}`);
  const toca = json.datos.tanque.siguiente;

  const r = await llamar('/api/produccion/lote', {
    method: 'POST',
    cuerpo: { panos: [toca.id], tipoAgua: 'purificada', calidad: 'c60' }
  });

  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.calidad, 'c60');
  assert.equal(r.json.datos.marquetas, 6, 'del 60 al 80% se vende igual');
});

test('un estado que no existe se rechaza en vez de guardarse', async () => {
  await entrarAdmin();
  const { pano, moldes } = await elQueToca();

  for (const viejo of ['ok', 'normal', 'poco_hueca', 'cascara', 'merma']) {
    const r = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
      method: 'POST', cuerpo: { tipoAgua: 'purificada', calidad: viejo }
    });
    assert.equal(r.estado, 400, `"${viejo}" ya no significa nada`);
  }

  const b = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST',
    cuerpo: { tipoAgua: 'purificada',
              resultados: [{ moldeId: moldes[0].id, resultado: 'hueco' }] }
  });
  assert.equal(b.estado, 400);
});

test('el corte del día cuadra paño por paño', async () => {
  // El papel del corte enseña un renglón por paño y abajo los totales. Si
  // los totales se sacaran de otro lado que los renglones, podrían no
  // cuadrar — y un papel que no cuadra consigo mismo no se puede usar para
  // discutir con nadie.
  const { resumenDelDia } = require('../src/modulos/produccion/dia');
  const r = resumenDelDia();

  assert.equal(r.merma, r.panos.reduce((n, p) => n + p.merma, 0));
  assert.equal(r.alAlmacen, r.panos.reduce((n, p) => n + p.alAlmacen, 0));
  assert.equal(r.producidas, r.panos.reduce((n, p) => n + p.producidas, 0));
  assert.equal(r.cuantos, r.panos.length);
  assert.ok(r.producidas > 0, 'esta prueba no sirve de nada con el día vacío');
  assert.ok(r.merma > 0, 'y hoy sí se botaron varias');
});

// ============================================================
// LOS ESTADOS QUE NO SON DE FRÍO
// ============================================================

test('una aguada no es hielo: no cuenta ni para el costo', async () => {
  await entrarAdmin();
  const antes = await hoy();
  const { pano } = await elQueToca();

  const r = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST', cuerpo: { tipoAgua: 'purificada', calidad: 'aguada' }
  });

  assert.equal(r.json.datos.marquetas, 0, 'no hay marqueta que vender');
  assert.equal(r.json.datos.producidas, 0,
    'y tampoco hay entre qué repartir el costo: de ahí no salió una sola marqueta');
  assert.equal(r.json.datos.mezcla.aguada, 6);
  assert.equal(r.json.datos.mezcla.salieron, 6, 'los seis moldes sí se abrieron');

  const d = await hoy();
  assert.equal(d.marquetas, antes.marquetas, 'el cuarto frío no creció');
});

test('la contaminada salió hielo, pero se bota igual', async () => {
  await entrarAdmin();
  const { pano } = await elQueToca();

  const r = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST', cuerpo: { tipoAgua: 'purificada', calidad: 'contaminada' }
  });

  assert.equal(r.json.datos.producidas, 6,
    'costó la misma agua y la misma luz: cuenta para el costo por marqueta');
  assert.equal(r.json.datos.marquetas, 0,
    'pero con salmuera adentro no se vende: se bota');
});

test('el molde contaminado se señala aunque el paño entero lo esté', async () => {
  // La contaminación es la excepción a la regla del "peor que su paño": un
  // molde roto por el que entra salmuera está roto, y si están rotos varios
  // hay que verlos todos.
  await entrarAdmin();
  const { json } = await llamar(`/api/produccion/estado?tanque=${tanqueId}`);
  const suyos = json.datos.tanque.panos
    .flatMap((p) => p.canastas.flatMap((c) => c.moldes))
    .filter((m) => m.ultimoResultado === 'contaminada');

  assert.ok(suyos.length, 'el paño anterior salió contaminado entero');
  assert.ok(suyos.every((m) => m.ultimoFallo),
    'salmuera dentro del molde es daño del molde, no frío de esa noche');
});

test('"otro" sin explicación no se guarda', async () => {
  await entrarAdmin();
  const { pano, moldes } = await elQueToca();

  const a = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST', cuerpo: { tipoAgua: 'purificada', calidad: 'otro' }
  });
  assert.equal(a.estado, 400, 'un "otro" en blanco no dice nada dentro de un año');

  const b = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST',
    cuerpo: { tipoAgua: 'purificada',
              resultados: [{ moldeId: moldes[0].id, resultado: 'otro', nota: '   ' }] }
  });
  assert.equal(b.estado, 400, 'ni escrito con puros espacios');
});

test('"otro" da de baja esa marqueta, con lo que pasó escrito', async () => {
  await entrarAdmin();
  const { pano, moldes } = await elQueToca();

  const r = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST',
    cuerpo: {
      tipoAgua: 'purificada',
      resultados: [{ moldeId: moldes[0].id, resultado: 'otro',
                     nota: 'Se cayó de la grúa' }]
    }
  });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.mezcla.otro, 1);
  assert.equal(r.json.datos.marquetas, 5, 'la que se cayó no llegó al cuarto frío');

  const guardada = bd.prepare(
    "SELECT nota FROM sacadas_moldes WHERE resultado = 'otro'").get();
  assert.equal(guardada.nota, 'Se cayó de la grúa');
});

// ============================================================
// LA FICHA DEL PAÑO
// ============================================================

test('la ficha del paño se abre sin autorización de nadie', async () => {
  await entrarAdmin();
  const { json } = await llamar(`/api/produccion/estado?tanque=${tanqueId}`);
  const t = json.datos.tanque;
  // Uno que NO es el que toca: mirarlo no cambia nada, así que no pide PIN.
  const otro = t.panos.find((p) => p.id !== t.siguiente.id);

  const r = await llamar(`/api/produccion/panos/${otro.id}/ficha`);
  assert.equal(r.estado, 200);
  assert.ok(r.json.datos.pano.numero);
  assert.ok(Array.isArray(r.json.datos.historial));
});

test('la ficha dice cuándo, quién y cómo salió cada molde', async () => {
  await entrarAdmin();
  const { json } = await llamar(`/api/produccion/estado?tanque=${tanqueId}`);
  const conHistoria = json.datos.tanque.panos.find((p) => p.ultimaSacada);
  assert.ok(conHistoria, 'a estas alturas ya se sacaron varios paños');

  const r = await llamar(`/api/produccion/panos/${conHistoria.id}/ficha`);
  const d = r.json.datos;
  assert.ok(d.ultima, 'trae la última vez que se sacó');
  assert.ok(d.ultima.fecha);
  assert.ok(d.ultima.quienes.length, 'y quién lo sacó');
  assert.equal(d.moldes.length, 6, 'molde por molde, como salió');
  assert.ok(d.moldes.every((m) => m.resultado));
  assert.ok(!('destino' in d.moldes[0]), 'el destino ya no existe');
});

test('el renglón del paño trae su última sacada', async () => {
  await entrarAdmin();
  const { json } = await llamar(`/api/produccion/estado?tanque=${tanqueId}`);
  const t = json.datos.tanque;
  const u = t.panos.find((p) => p.ultimaSacada)?.ultimaSacada;

  assert.ok(u.fecha, 'cuándo');
  assert.ok(u.quienes.length, 'quién');
  assert.ok(t.ultimaSalida, 'y el tanque dice cuándo salió hielo por última vez');
});

test('de los estados viejos no queda ni uno en la base', () => {
  // La migración 050 tradujo lo de antes con las definiciones que el propio
  // dueño les había dado: normal → 80-90%, poco hueca → 60-80%, cáscara →
  // hueca, y "se rompió" → otro con su nota.
  const quedan = bd.prepare(`
    SELECT COUNT(*) n FROM sacadas_moldes
     WHERE resultado IN ('ok','hueco','normal','poco_hueca','cascara','merma')
  `).get().n;
  assert.equal(quedan, 0);

  const columnas = bd.prepare('SELECT * FROM pragma_table_info(?)').all('sacadas_moldes')
    .map((c) => c.name);
  assert.ok(!columnas.includes('destino'), 'la columna del destino se fue');
});

// ============================================================
// CUÁNTO TARDA EN CONGELAR  (v6.5)
// ============================================================

test('las horas de congelación son un ajuste, y de fábrica son 48', () => {
  const fila = bd.prepare(
    "SELECT valor FROM configuracion WHERE clave = 'horas_congelacion'").get();
  assert.equal(fila?.valor, '48',
    'en mayo se van arriba de 48 y en enero bajan: tiene que poder cambiarse');
});
