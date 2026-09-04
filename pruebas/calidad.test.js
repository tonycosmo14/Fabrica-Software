/**
 * CÓMO SALIÓ EL HIELO  (v2.10)
 *
 * Lo que se comprueba aquí es la diferencia entre TRES números que antes
 * eran uno solo, y que confundirlos costaría dinero de verdad:
 *
 *   · lo que salió del molde  — lo que costó agua, luz y amoniaco
 *   · lo que entró al cuarto frío — lo único que se puede vender
 *   · cómo salió — la mezcla, que es el aviso temprano de que algo falla
 *
 * El caso que lo resume: un paño entero de cáscaras que se va a los
 * condensadores costó lo mismo que uno de marquetas selladas, pero no
 * dejó ni una sola marqueta en el cuarto frío. Si el sistema las contara
 * como existencia, el conteo del cuarto frío no cuadraría nunca.
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

test('sin decir nada, el hielo sale normal', async () => {
  await entrarAdmin();
  const { pano } = await elQueToca();

  const r = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST', cuerpo: { tipoAgua: 'purificada' }
  });

  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.marquetas, 6);
  assert.equal(r.json.datos.producidas, 6);
  assert.equal(r.json.datos.mezcla.normal, 6,
    'lo de siempre no debe costar ni un toque de más');
});

test('un paño de cáscaras al condensador NO es hielo del cuarto frío', async () => {
  await entrarAdmin();
  const antes = await hoy();
  const { pano } = await elQueToca();

  const r = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST',
    cuerpo: { tipoAgua: 'purificada', calidad: 'cascara', destino: 'condensadores' }
  });

  assert.equal(r.json.datos.producidas, 6, 'costaron lo mismo que seis selladas');
  assert.equal(r.json.datos.marquetas, 0, 'ninguna se puede vender');

  const d = await hoy();
  assert.equal(d.mezcla.cascara - antes.mezcla.cascara, 6);
  assert.equal(d.marquetas, antes.marquetas, 'el cuarto frío no creció');
});

test('la cáscara que se guarda sí entra al cuarto frío', async () => {
  await entrarAdmin();
  const antes = await hoy();
  const { pano } = await elQueToca();

  const r = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST',
    cuerpo: { tipoAgua: 'purificada', calidad: 'cascara', destino: 'almacen' }
  });

  assert.equal(r.json.datos.marquetas, 6, 'se van a vender más baratas, pero se venden');
  const d = await hoy();
  assert.equal(d.marquetas - antes.marquetas, 6);
  assert.equal(d.mezcla.guardadas, 6);
});

test('la existencia esperada solo cuenta el hielo que se puede vender', async () => {
  await entrarAdmin();
  const { json } = await llamar('/api/existencia');
  const a = json.datos.almacenes[0];

  // Hasta aquí se sacaron tres paños de 6 moldes: normales, cáscaras al
  // condensador y cáscaras guardadas. Solo dos de los tres son existencia.
  assert.equal(a.producido, 12 * 16,
    'las cáscaras del condensador no están en el cuarto frío por más que hayan costado');
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
        { moldeId: moldes[0].id, resultado: 'merma' },
        { moldeId: moldes[1].id, resultado: 'cascara', destino: 'botada' }
      ]
    }
  });

  const m = r.json.datos.mezcla;
  assert.equal(m.sellada, 4);
  assert.equal(m.cascara, 1);
  assert.equal(m.merma, 1);
  assert.equal(m.producidas, 5, 'la rota no dio hielo; la cáscara sí, aunque se botara');
  assert.equal(r.json.datos.marquetas, 4, 'la cáscara botada no llegó al cuarto frío');
});

test('el molde marcado cáscara sí cuenta como fallo de ESE molde', async () => {
  await entrarAdmin();
  const { json } = await llamar(`/api/produccion/estado?tanque=${tanqueId}`);
  const moldes = json.datos.tanque.panos.flatMap((p) => p.canastas.flatMap((c) => c.moldes));
  const conFallo = moldes.filter((m) => m.ultimoFallo);

  // Del paño anterior: uno roto y uno de cáscara.
  assert.equal(conFallo.length, 2);
  assert.ok(conFallo.every((m) => m.rachaFallos >= 1));
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
    cuerpo: { panos: [toca.id], tipoAgua: 'purificada', calidad: 'poco_hueca' }
  });

  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.calidad, 'poco_hueca');
  assert.equal(r.json.datos.marquetas, 6, 'poco huecas se venden igual');
});

test('un estado que no existe se rechaza en vez de guardarse', async () => {
  await entrarAdmin();
  const { pano, moldes } = await elQueToca();

  const a = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST', cuerpo: { tipoAgua: 'purificada', calidad: 'ok' }
  });
  assert.equal(a.estado, 400, '"ok" era el nombre viejo: ya no significa nada');

  const b = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST',
    cuerpo: { tipoAgua: 'purificada',
              resultados: [{ moldeId: moldes[0].id, resultado: 'hueco' }] }
  });
  assert.equal(b.estado, 400);

  const c = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST',
    cuerpo: { tipoAgua: 'purificada', calidad: 'cascara', destino: 'a la basura' }
  });
  assert.equal(c.estado, 400);
});

test('el corte del día cuadra paño por paño', async () => {
  // El papel del corte enseña un renglón por paño y abajo los totales. Si
  // los totales se sacaran de otro lado que los renglones, podrían no
  // cuadrar — y un papel que no cuadra consigo mismo no se puede usar para
  // discutir con nadie.
  const { resumenDelDia } = require('../src/modulos/produccion/dia');
  const r = resumenDelDia();

  assert.equal(r.rotas, r.panos.reduce((n, p) => n + p.rotas, 0));
  assert.equal(r.alAlmacen, r.panos.reduce((n, p) => n + p.alAlmacen, 0));
  assert.equal(r.producidas, r.panos.reduce((n, p) => n + p.producidas, 0));
  assert.equal(r.cuantos, r.panos.length);
  assert.ok(r.producidas > 0, 'esta prueba no sirve de nada con el día vacío');
});

// ============================================================
// LOS ESTADOS QUE NO SON DE FRÍO  (v3.1)
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

test('la contaminada sí es hielo, aunque no se tome', async () => {
  await entrarAdmin();
  const { pano } = await elQueToca();

  const r = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST',
    cuerpo: { tipoAgua: 'purificada', calidad: 'contaminada', destino: 'almacen' }
  });

  assert.equal(r.json.datos.producidas, 6,
    'costó la misma agua y la misma luz: cuenta para el costo por marqueta');
  assert.equal(r.json.datos.marquetas, 6,
    'se guardó para quien solo quiere enfriar, así que sí es existencia');
});

test('el molde contaminado se señala aunque el paño entero lo esté', async () => {
  // La contaminación es la excepción a la regla del "peor que su paño": un
  // molde roto por el que entra salmuera está roto, y si están rotos varios
  // hay que verlos todos, no ninguno.
  await entrarAdmin();
  const { json } = await llamar(`/api/produccion/estado?tanque=${tanqueId}`);
  const t = json.datos.tanque;
  const suyos = t.panos.flatMap((p) => p.canastas.flatMap((c) => c.moldes))
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

test('"otro" con su explicación queda guardado tal cual', async () => {
  await entrarAdmin();
  const { pano, moldes } = await elQueToca();

  const r = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST',
    cuerpo: {
      tipoAgua: 'purificada',
      resultados: [{ moldeId: moldes[0].id, resultado: 'otro',
                     destino: 'botada', nota: 'Se cayó de la grúa' }]
    }
  });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.mezcla.otro, 1);
  assert.equal(r.json.datos.marquetas, 5, 'la que se cayó no llegó al cuarto frío');

  const guardada = bd.prepare(
    "SELECT nota, destino FROM sacadas_moldes WHERE resultado = 'otro'").get();
  assert.equal(guardada.nota, 'Se cayó de la grúa');
  assert.equal(guardada.destino, 'botada');
});

test('el molde suelto hereda el destino del paño si no dice otro', async () => {
  await entrarAdmin();
  const { pano, moldes } = await elQueToca();

  await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST',
    cuerpo: {
      tipoAgua: 'purificada', calidad: 'cascara', destino: 'almacen',
      resultados: [{ moldeId: moldes[0].id, resultado: 'cascara' }]
    }
  });

  const fila = bd.prepare(`
    SELECT sm.destino FROM sacadas_moldes sm
      JOIN sacadas s ON s.id = sm.sacada_id
     WHERE sm.molde_id = ? ORDER BY s.fecha DESC LIMIT 1`).get(moldes[0].id);
  assert.equal(fila.destino, 'almacen',
    'si el paño se guardó, la cáscara de ese molde también: es lo que uno espera');
});

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

test('las marquetas de antes del cambio se leen como normales', async () => {
  // La migración 025 tradujo lo viejo: 'ok' pasó a 'normal' y 'hueco' a
  // 'hueca'. Lo que no se puede es adivinar hacia atrás qué era sellada y
  // qué cáscara, y no se adivina: nadie lo estaba anotando.
  const quedan = bd.prepare(
    "SELECT COUNT(*) n FROM sacadas_moldes WHERE resultado IN ('ok','hueco')"
  ).get().n;
  assert.equal(quedan, 0);

  const columnas = bd.prepare('SELECT * FROM pragma_table_info(?)').all('sacadas_moldes')
    .map((c) => c.name);
  assert.ok(columnas.includes('destino'));
});

// ============================================================
// LA HUECA ES MERMA  (v6.0)
// "La hueca y la cáscara no se cuentan, son mermas."
// ============================================================

test('un paño hueco NO entra al cuarto frío si no se dice que se guardó', async () => {
  await entrarAdmin();
  const antes = await hoy();
  const { pano } = await elQueToca();

  // Sin destino: se va a donde va por omisión, que son los condensadores.
  const r = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST', cuerpo: { tipoAgua: 'purificada', calidad: 'hueca' }
  });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.producidas, 6, 'costó lo mismo que seis selladas');
  assert.equal(r.json.datos.marquetas, 0, 'pero no es existencia: es merma');

  const d = await hoy();
  assert.equal(d.marquetas, antes.marquetas, 'el cuarto frío no creció');

  const destino = bd.prepare(`
    SELECT sm.destino FROM sacadas_moldes sm
      JOIN sacadas s ON s.id = sm.sacada_id
     WHERE s.sacada_pano_id = (SELECT id FROM sacadas_pano WHERE pano_id = ? ORDER BY rowid DESC LIMIT 1)
     LIMIT 1`).get(pano.id);
  assert.equal(destino?.destino, 'condensadores');
});

test('la hueca que se guarda a propósito sí cuenta', async () => {
  await entrarAdmin();
  const antes = await hoy();
  const { pano } = await elQueToca();

  const r = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST',
    cuerpo: { tipoAgua: 'purificada', calidad: 'hueca', destino: 'almacen' }
  });
  assert.equal(r.json.datos.marquetas, 6, 'se dijo «al cuarto frío», así que entra');
  const d = await hoy();
  assert.equal(d.marquetas - antes.marquetas, 6);
});

test('lo que cuenta como existencia son la sellada, la normal y la poco hueca', () => {
  const calidad = require('../src/modulos/produccion/calidad');
  const vendibles = calidad.CALIDADES.filter((c) => c.vendible).map((c) => c.clave);
  assert.deepEqual(vendibles, ['sellada', 'normal', 'poco_hueca']);
  const merma = calidad.CALIDADES.filter((c) => !c.vendible).map((c) => c.clave);
  assert.deepEqual(merma, ['hueca', 'cascara', 'contaminada', 'aguada', 'otro']);
});
