/**
 * CORREGIR UN PAÑO EN SU FECHA, Y QUE NO SE SAQUE DOS VECES  (v6.6)
 *
 * Las dos cosas van juntas porque son la misma historia, contada por el
 * dueño:
 *
 *   "Si desbloqueo el paño ya puedo modificar una por una, pero al
 *    terminar me vuelve a contar todas y se suma como si se hubiera
 *    vuelto a sacar. Un paño no se puede sacar dos veces el mismo día: es
 *    imposible, el hielo no congela."
 *
 *   "A veces las correcciones son de una canasta o de un molde nada más,
 *    por lo que necesito corregir una por una. Y debería corregirlo en
 *    base al historial de ese paño: yo selecciono el movimiento, la fecha
 *    que quiero corregir, para que se refleje en los cortes de esa fecha."
 *
 * Y detrás de todo, lo que de verdad se quiere atrapar: el que reporta el
 * paño completo y deja una canasta adentro para venderla otro día.
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, entrarPorNombre, crearUsuario, bd, preparar } =
  fabricaDePrueba('panos');

let tanqueId, almacenId;

async function estado() {
  return (await llamar(`/api/produccion/estado?tanque=${tanqueId}`)).json.datos;
}

/** Saca el paño que toca y devuelve su sacada. */
async function sacarElQueToca(cuerpo = {}) {
  const d = await estado();
  const pano = d.tanque.panos.find((p) => p.id === d.tanque.siguiente.id);
  const r = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST', cuerpo: { tipoAgua: 'purificada', ...cuerpo }
  });
  assert.equal(r.estado, 201, r.json?.error);
  const sp = bd.prepare(
    'SELECT id FROM sacadas_pano WHERE pano_id = ? ORDER BY iniciada_en DESC LIMIT 1'
  ).get(pano.id);
  return { pano, sacadaId: sp.id, r };
}

/** Manda las sacadas de un paño a ayer, que aquí un día es una prueba. */
function otroDia(panoId) {
  bd.prepare(`
    UPDATE sacadas_pano
       SET iniciada_en = datetime(iniciada_en, '-1 day'),
           terminada_en = datetime(terminada_en, '-1 day')
     WHERE pano_id = ?
  `).run(panoId);
}

preparar(async () => {
  const t = await llamar('/api/tanques', {
    method: 'POST',
    cuerpo: { nombre: '2N', panos: 8, plantilla: [3, 3], horasCongelacion: 48 }
  });
  tanqueId = t.json.datos.tanque.id;
  almacenId = (await llamar('/api/existencia/almacenes')).json.datos.almacenes[0].id;
  await crearUsuario('Chema', 'operario', '5555');
  await crearUsuario('Lupe', 'gerente', '9999');
});

// ============================================================
// UN PAÑO NO SE SACA DOS VECES EL MISMO DÍA
// ============================================================

test('el mismo paño no puede salir dos veces hoy, ni desbloqueándolo', async () => {
  await entrarAdmin();
  const { pano } = await sacarElQueToca();

  // Otra vez, con la autorización del administrador en la mano: da igual.
  const admin = bd.prepare("SELECT id FROM usuarios WHERE usuario = 'tony'").get();
  const r = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST',
    cuerpo: {
      tipoAgua: 'purificada',
      autorizacion: { usuarioId: admin.id, pin: '1111', motivo: 'Es que me equivoqué' }
    }
  });
  assert.equal(r.estado, 409);
  assert.equal(r.json.yaSeSacoHoy, true, 'se dice por qué, para poder ofrecer corregir');
  assert.ok(r.json.sacadaId, 'y cuál es la sacada de hoy, para ir a corregirla');
  assert.match(r.json.error, /ya se sacó hoy/);

  // Y no se coló ni un molde de más.
  const n = bd.prepare(`
    SELECT COUNT(*) n FROM sacadas_pano WHERE pano_id = ? AND anulada_en IS NULL
  `).get(pano.id).n;
  assert.equal(n, 1, 'una sola sacada, no dos');
});

test('al día siguiente sí, que ya congeló', async () => {
  await entrarAdmin();
  const d = await estado();
  const pano = d.tanque.panos.find((p) => p.estado === 'congelando');
  otroDia(pano.id);

  const admin = bd.prepare("SELECT id FROM usuarios WHERE usuario = 'tony'").get();
  const r = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST',
    cuerpo: {
      tipoAgua: 'purificada',
      autorizacion: { usuarioId: admin.id, pin: '1111', motivo: 'Hace falta hielo' }
    }
  });
  assert.equal(r.estado, 201, r.json?.error);
});

// ============================================================
// CORREGIR MOLDE POR MOLDE
// ============================================================

test('se corrige UN molde y los demás se quedan como estaban', async () => {
  await entrarAdmin();
  const { sacadaId } = await sacarElQueToca({ calidad: 'c80' });

  const antes = (await llamar(`/api/produccion/sacadas-pano/${sacadaId}/moldes`)).json.datos;
  assert.equal(antes.moldes.length, 6);
  assert.ok(antes.moldes.every((m) => m.resultado === 'c80'));

  const uno = antes.moldes[0];
  const r = await llamar(`/api/produccion/sacadas-pano/${sacadaId}/corregir-moldes`, {
    method: 'POST',
    cuerpo: {
      motivo: 'Ese salió hueco y se anotó como los demás',
      cambios: [{ moldeId: uno.moldeId, resultado: 'hueca' }]
    }
  });
  assert.equal(r.estado, 200, JSON.stringify(r.json));
  assert.equal(r.json.datos.cambiados, 1);
  assert.equal(r.json.datos.antes.alAlmacen, 6);
  assert.equal(r.json.datos.despues.alAlmacen, 5, 'una menos, no seis menos');

  const ahora = (await llamar(`/api/produccion/sacadas-pano/${sacadaId}/moldes`)).json.datos;
  assert.equal(ahora.moldes.filter((m) => m.resultado === 'hueca').length, 1);
  assert.equal(ahora.moldes.filter((m) => m.resultado === 'c80').length, 5);

  // Con su rastro: qué decía, qué dice, quién y por qué.
  const rastro = ahora.correcciones;
  assert.equal(rastro.length, 1);
  assert.equal(rastro[0].que, 'cambio');
  assert.equal(rastro[0].antes, 'c80');
  assert.equal(rastro[0].despues, 'hueca');
  assert.match(rastro[0].motivo, /salió hueco/);
  assert.ok(rastro[0].quien);
});

test('«esa canasta no se sacó»: los moldes se quitan y la canasta vuelve al tanque', async () => {
  await entrarAdmin();
  const { pano, sacadaId } = await sacarElQueToca({ calidad: 'sellada' });

  const antes = (await llamar(`/api/produccion/sacadas-pano/${sacadaId}/moldes`)).json.datos;
  const canasta1 = antes.moldes.filter((m) => m.canasta === 1);
  assert.equal(canasta1.length, 3);

  const rellenadosAntes = bd.prepare(
    'SELECT COUNT(*) n FROM rellenados WHERE sacada_pano_id = ?').get(sacadaId).n;
  assert.equal(rellenadosAntes, 2, 'al sacar se rellenaron las dos canastas');

  const r = await llamar(`/api/produccion/sacadas-pano/${sacadaId}/corregir-moldes`, {
    method: 'POST',
    cuerpo: {
      motivo: 'Esa canasta se quedó adentro, no se sacó',
      quitar: canasta1.map((m) => m.moldeId)
    }
  });
  assert.equal(r.estado, 200, JSON.stringify(r.json));
  assert.equal(r.json.datos.quitados, 3);
  assert.equal(r.json.datos.antes.alAlmacen, 6);
  assert.equal(r.json.datos.despues.alAlmacen, 3, 'esas tres marquetas nunca existieron');

  // La canasta volvió al tanque: sin sacada y sin el rellenado que se le
  // había apuntado.
  const rellenadosDespues = bd.prepare(
    'SELECT COUNT(*) n FROM rellenados WHERE sacada_pano_id = ?').get(sacadaId).n;
  assert.equal(rellenadosDespues, 1, 'el rellenado de esa canasta se deshizo');
  const sacadas = bd.prepare(
    'SELECT COUNT(*) n FROM sacadas WHERE sacada_pano_id = ?').get(sacadaId).n;
  assert.equal(sacadas, 1, 'y su renglón de sacada también');

  // Queda escrito que existió en el papel y por qué se quitó.
  const rastro = bd.prepare(
    "SELECT * FROM correcciones_moldes WHERE sacada_pano_id = ? AND que = 'quitado'").all(sacadaId);
  assert.equal(rastro.length, 3);
  assert.equal(rastro[0].antes, 'sellada');
  assert.equal(rastro[0].despues, null);
  assert.match(rastro[0].motivo, /no se sacó/);

  // Y la canasta volvió al tanque con su hielo: no está "congelando" con
  // agua que nadie echó, está lista, como estuvo siempre.
  const d2 = await estado();
  const suyas = d2.tanque.panos.find((p) => p.id === pano.id).canastas;
  assert.equal(suyas[0].estado, 'lista', 'la que no se sacó sigue con su hielo');
  assert.equal(suyas[1].estado, 'congelando', 'la que sí salió se rellenó');
});

test('si se quitan TODOS, la sacada queda anulada: no ocurrió', async () => {
  await entrarAdmin();
  const { sacadaId } = await sacarElQueToca();
  const d = (await llamar(`/api/produccion/sacadas-pano/${sacadaId}/moldes`)).json.datos;

  const r = await llamar(`/api/produccion/sacadas-pano/${sacadaId}/corregir-moldes`, {
    method: 'POST',
    cuerpo: { motivo: 'Ese paño nunca se sacó, estaba entero', quitar: d.moldes.map((m) => m.moldeId) }
  });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.anulada, true);
  assert.equal(r.json.datos.despues.alAlmacen, 0);

  const sp = bd.prepare('SELECT * FROM sacadas_pano WHERE id = ?').get(sacadaId);
  assert.ok(sp.anulada_en);
  assert.match(sp.motivo_anulacion, /No se sacó/);
});

test('sin motivo, o con un molde que no es de esa sacada, no se corrige', async () => {
  await entrarAdmin();
  const { sacadaId } = await sacarElQueToca();
  const d = (await llamar(`/api/produccion/sacadas-pano/${sacadaId}/moldes`)).json.datos;

  let r = await llamar(`/api/produccion/sacadas-pano/${sacadaId}/corregir-moldes`, {
    method: 'POST', cuerpo: { cambios: [{ moldeId: d.moldes[0].moldeId, resultado: 'hueca' }] }
  });
  assert.equal(r.estado, 400, 'sin motivo no');

  r = await llamar(`/api/produccion/sacadas-pano/${sacadaId}/corregir-moldes`, {
    method: 'POST', cuerpo: { motivo: 'porque sí' }
  });
  assert.equal(r.estado, 400, 'sin decir qué corregir tampoco');

  r = await llamar(`/api/produccion/sacadas-pano/${sacadaId}/corregir-moldes`, {
    method: 'POST',
    cuerpo: { motivo: 'porque sí', cambios: [{ moldeId: 'no-existe', resultado: 'hueca' }] }
  });
  assert.equal(r.estado, 409);

  r = await llamar(`/api/produccion/sacadas-pano/${sacadaId}/corregir-moldes`, {
    method: 'POST',
    cuerpo: { motivo: 'porque sí',
              cambios: [{ moldeId: d.moldes[0].moldeId, resultado: 'marciana' }] }
  });
  assert.equal(r.estado, 400, 'un estado que no existe tampoco');

  // Nada de eso tocó nada.
  const igual = (await llamar(`/api/produccion/sacadas-pano/${sacadaId}/moldes`)).json.datos;
  assert.deepEqual(igual.moldes.map((m) => m.resultado), d.moldes.map((m) => m.resultado));
});

test('el operario no corrige; el gerente sí', async () => {
  await entrarAdmin();
  const { sacadaId } = await sacarElQueToca();
  const d = (await llamar(`/api/produccion/sacadas-pano/${sacadaId}/moldes`)).json.datos;
  const cuerpo = {
    motivo: 'Salió hueca', cambios: [{ moldeId: d.moldes[0].moldeId, resultado: 'hueca' }]
  };

  await entrarPorNombre('Chema', '5555');
  let r = await llamar(`/api/produccion/sacadas-pano/${sacadaId}/corregir-moldes`,
                       { method: 'POST', cuerpo });
  assert.equal(r.estado, 403, 'que el que reporta arregle su propio reporte es el agujero');

  await entrarPorNombre('Lupe', '9999');
  r = await llamar(`/api/produccion/sacadas-pano/${sacadaId}/corregir-moldes`,
                   { method: 'POST', cuerpo });
  assert.equal(r.estado, 200);
  await entrarAdmin();
});

// ============================================================
// Y QUE SE REFLEJE EN EL CORTE DE AQUELLA FECHA
// ============================================================

test('quitar una canasta de una sacada vieja arregla el corte de aquel día', async () => {
  await entrarAdmin();

  // El día del robo: se reporta el paño completo, se cuenta el cuarto frío
  // con lo que se reportó, y el turno cierra cuadrado.
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 500 } });
  const { pano, sacadaId } = await sacarElQueToca({ calidad: 'sellada' });
  const caja = (await llamar('/api/caja')).json.datos.abierta.caja;

  const antesDelConteo = (await llamar('/api/existencia')).json.datos.almacenes[0];
  const c = await llamar('/api/existencia/conteos', {
    method: 'POST',
    cuerpo: { almacenId, dieciseisavos: antesDelConteo.esperado, cajaId: caja.id }
  });
  assert.equal(c.estado, 201);
  const cierre = await llamar('/api/caja/cerrar', { method: 'POST', cuerpo: { contado: 500 } });
  const corte = cierre.json.datos.corte;
  assert.equal(corte.hielo.cuadre.faltante, 0, 'aquel día todo cuadró… en el papel');

  // Tres días después se descubre que una canasta seguía adentro.
  const d = (await llamar(`/api/produccion/sacadas-pano/${sacadaId}/moldes`)).json.datos;
  const canasta2 = d.moldes.filter((m) => m.canasta === 2);
  const r = await llamar(`/api/produccion/sacadas-pano/${sacadaId}/corregir-moldes`, {
    method: 'POST',
    cuerpo: { motivo: 'La canasta 2 seguía en el tanque, nunca salió',
              quitar: canasta2.map((m) => m.moldeId) }
  });
  assert.equal(r.estado, 200, JSON.stringify(r.json));
  assert.equal(r.json.datos.conteos.length, 1, 'el conteo de aquel día se vuelve a sacar');
  assert.equal(r.json.datos.conteos[0].faltanteAntes, 0);
  assert.equal(r.json.datos.conteos[0].faltanteAhora, -3 * 16,
    'sobra hielo: se había contado de menos porque tres marquetas no existían');

  // Y el corte de aquel día lo enseña, con lo que decía al firmarse.
  const otra = (await llamar(`/api/caja/cortes/${caja.id}`)).json.datos.corte;
  assert.equal(otra.hielo.cuadre.producido, corte.hielo.cuadre.producido - 3 * 16,
    'aquel día se produjeron tres marquetas menos de las que se dijo');
  assert.ok(otra.hielo.corregido, 'y el papel dice que se corrigió');
  assert.equal(otra.hielo.corregido.faltanteAntes, 0);
  assert.match(otra.hielo.corregido.motivo, /paño/);
  assert.equal(otra.hielo.cuadre.contado, antesDelConteo.esperado, 'LO CONTADO NO SE TOCA');
  assert.ok(pano.id);
});
