/**
 * LO QUE EL ADMINISTRADOR CORRIGE DESPUÉS DEL CORTE  (v6.1)
 *
 * "Cerré un corte y faltaba una venta —una marqueta de mayoreo y veinte
 *  bolsas— y una sacada estaba mal marcada: hueca, y era ahogada. Cinco
 *  marquetas y media de diferencia. El sistema no me dejaba corregir
 *  nada después del corte. El administrador debería tener el poder de
 *  corregir cualquier cosa."
 *
 * Tres caminos, y los tres dejan rastro y vuelven a sacar el corte solos.
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, entrarPorNombre, bd, preparar } = fabricaDePrueba('correcciones');

let tanqueId, almacenId;

async function elQueToca() {
  const { json } = await llamar(`/api/produccion/estado?tanque=${tanqueId}`);
  const t = json.datos.tanque;
  return t.panos.find((p) => p.id === t.siguiente.id);
}

async function cerrarSiHayAbierto() {
  const { json } = await llamar('/api/caja');
  if (json.datos?.abierta) {
    await llamar('/api/caja/cerrar', {
      method: 'POST', cuerpo: { contado: json.datos.abierta.esperado / 100 }
    });
  }
}

preparar(async () => {
  const r = await llamar('/api/tanques', {
    method: 'POST', cuerpo: { nombre: '1N', panos: 4, plantilla: [3, 3], horasCongelacion: 24 }
  });
  tanqueId = r.json.datos.tanque.id;
  almacenId = (await llamar('/api/existencia/almacenes')).json.datos.almacenes[0].id;
  await llamar('/api/usuarios', { method: 'POST', cuerpo: { nombre: 'Rosa', rol: 'cajero', pin: '4444' } });
});

// ============================================================
// LA SACADA QUE ESTABA MAL MARCADA
// ============================================================

let corteHielo;   // el corte que se firmó con la sacada mal marcada
let sacadaId;

test('un paño normal, contado, y el corte firmado con su faltante', async () => {
  await entrarAdmin();
  await cerrarSiHayAbierto();
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 500 } });

  const pano = await elQueToca();
  const r = await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST', cuerpo: { tipoAgua: 'purificada', calidad: 'c80' }
  });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.marquetas, 6);
  sacadaId = bd.prepare(
    'SELECT id FROM sacadas_pano WHERE pano_id = ? ORDER BY iniciada_en DESC LIMIT 1').get(pano.id).id;

  // Se cuenta el cuarto frío y no hay NADA: las seis del 80 al 90% en
  // realidad eran agua. El corte sale seis marquetas corto.
  const caja = (await llamar("/api/caja")).json.datos.abierta.caja;
  const c = await llamar('/api/existencia/conteos', {
    method: 'POST', cuerpo: { almacenId, dieciseisavos: 0, cajaId: caja.id }
  });
  assert.equal(c.estado, 201);

  const cierre = await llamar('/api/caja/cerrar', { method: 'POST', cuerpo: { contado: 5 } });
  corteHielo = cierre.json.datos.corte;
  assert.equal(corteHielo.hielo.cuadre.producido, 96);
  assert.equal(corteHielo.hielo.cuadre.faltante, 96, 'seis marquetas que nadie explicó');
  assert.equal(corteHielo.hielo.corregido, null);
});

test('corregir cómo salió la sacada vuelve a sacar el cuadre del corte solo', async () => {
  const r = await llamar(`/api/produccion/sacadas-pano/${sacadaId}/corregir`, {
    method: 'POST', cuerpo: { calidad: 'aguada', motivo: 'Era agua, se marcó al 80% por error' }
  });
  assert.equal(r.estado, 200, JSON.stringify(r.json));
  assert.equal(r.json.datos.antes.alAlmacen, 6);
  assert.equal(r.json.datos.despues.alAlmacen, 0);
  assert.equal(r.json.datos.despues.aguada, 6);
  assert.equal(r.json.datos.conteos.length, 1, 'el conteo que la abarcaba se corrigió');
  assert.equal(r.json.datos.conteos[0].faltanteAntes, 96);
  assert.equal(r.json.datos.conteos[0].faltanteAhora, 0);

  // La sacada dice que se corrigió, quién y por qué.
  const sp = bd.prepare('SELECT * FROM sacadas_pano WHERE id = ?').get(sacadaId);
  assert.ok(sp.corregida_en);
  assert.equal(sp.correcciones, 1);
  assert.match(sp.motivo_correccion, /Era agua/);

  // Y el corte ya firmado enseña las dos cifras.
  const corte = (await llamar(`/api/caja/cortes/${corteHielo.caja.id}`)).json.datos.corte;
  assert.equal(corte.hielo.cuadre.producido, 0);
  assert.equal(corte.hielo.cuadre.faltante, 0, 'ya no falta nada: nunca hubo hielo');
  assert.ok(corte.hielo.corregido, 'el cuadre dice que se corrigió');
  assert.equal(corte.hielo.corregido.faltanteAntes, 96);
  assert.equal(corte.hielo.corregido.faltanteAhora, 0);
  assert.equal(corte.hielo.cuadre.contado, 0, 'LO CONTADO NO SE TOCA');

  // Lo original se guardó una sola vez.
  const conteo = bd.prepare('SELECT * FROM conteos WHERE caja_id = ?').get(corteHielo.caja.id);
  assert.equal(JSON.parse(conteo.original).producido, 96);
});

test('corregir dos veces conserva lo ORIGINAL, no lo de la corrección anterior', async () => {
  const r = await llamar(`/api/produccion/sacadas-pano/${sacadaId}/corregir`, {
    method: 'POST', cuerpo: { calidad: 'c40', motivo: 'Al final sí hubo hielo' }
  });
  assert.equal(r.estado, 200);
  const conteo = bd.prepare('SELECT * FROM conteos WHERE caja_id = ?').get(corteHielo.caja.id);
  assert.equal(JSON.parse(conteo.original).producido, 96, 'lo del papel firmado');
  assert.equal(conteo.producido, 96, 'ahora vuelve a contar: al 40-60% sí se vende');
  assert.equal(conteo.correcciones, 2);
  assert.equal(bd.prepare('SELECT correcciones FROM sacadas_pano WHERE id = ?').get(sacadaId).correcciones, 2);
});

test('corregir sin motivo o sin decir cómo salió se rechaza', async () => {
  let r = await llamar(`/api/produccion/sacadas-pano/${sacadaId}/corregir`, {
    method: 'POST', cuerpo: { calidad: 'c80' }
  });
  assert.equal(r.estado, 400);
  r = await llamar(`/api/produccion/sacadas-pano/${sacadaId}/corregir`, {
    method: 'POST', cuerpo: { motivo: 'porque sí' }
  });
  assert.equal(r.estado, 400);
  r = await llamar(`/api/produccion/sacadas-pano/${sacadaId}/corregir`, {
    method: 'POST', cuerpo: { calidad: 'marciana', motivo: 'porque sí' }
  });
  assert.equal(r.estado, 400);
});

test('el cajero no corrige sacadas', async () => {
  await entrarPorNombre('Rosa', '4444');
  const r = await llamar(`/api/produccion/sacadas-pano/${sacadaId}/corregir`, {
    method: 'POST', cuerpo: { calidad: 'c80', motivo: 'yo sé' }
  });
  assert.equal(r.estado, 403);
  await entrarAdmin();
});

// ============================================================
// LA VENTA QUE FALTÓ
// ============================================================

let corteCerrado;

test('un turno cerrado, cuadrado exacto', async () => {
  await entrarAdmin();
  await cerrarSiHayAbierto();
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 500 } });
  // Se cuenta el hielo dentro del turno, ANTES de cerrar.
  const caja = (await llamar("/api/caja")).json.datos.abierta.caja;
  await llamar('/api/existencia/conteos', {
    method: 'POST', cuerpo: { almacenId, dieciseisavos: 96, cajaId: caja.id }
  });
  const cierre = await llamar('/api/caja/cerrar', { method: 'POST', cuerpo: { contado: 500 } });
  corteCerrado = cierre.json.datos.corte.caja;
  assert.ok(corteCerrado.cerrada_en);
  assert.equal(corteCerrado.diferencia_centavos, 0);
});

test('la venta que faltó entra al corte cerrado, con la fecha de ese turno', async () => {
  const r = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: {
      lineas: [{ dieciseisavos: 16 }], pago: 300,
      cajaId: corteCerrado.id, motivoCorreccion: 'Se cobró y no se tecleó'
    }
  });
  assert.equal(r.estado, 201, JSON.stringify(r.json));
  const v = r.json.datos.venta;
  const fila = bd.prepare('SELECT * FROM ventas WHERE id = ?').get(v.id);
  assert.equal(fila.caja_id, corteCerrado.id, 'amarrada al corte cerrado');
  assert.equal(fila.tras_corte, 1);
  assert.match(fila.motivo_correccion, /no se tecleó/);
  assert.ok(fila.fecha >= corteCerrado.abierta_en && fila.fecha < corteCerrado.cerrada_en,
    'con la fecha de ese turno, no la de hoy');

  // El corte se volvió a sacar: ahora debía haber más y falta ese dinero.
  assert.ok(r.json.datos.correccion);
  assert.equal(r.json.datos.correccion.corte.diferenciaAntes, 0);
  assert.equal(r.json.datos.correccion.corte.diferenciaAhora, -v.total_centavos);

  const corte = (await llamar(`/api/caja/cortes/${corteCerrado.id}`)).json.datos.corte;
  assert.equal(corte.caja.esperado_original_centavos, 50000, 'lo del papel firmado se guarda');
  assert.equal(corte.caja.esperado_centavos, 50000 + v.total_centavos);
  assert.equal(corte.caja.contado_centavos, 50000, 'LO CONTADO NO SE TOCA');
  assert.equal(corte.caja.correcciones, 1);

  // Y como llevaba hielo, el cuadre del hielo de ese turno también.
  assert.equal(r.json.datos.correccion.conteos.length, 1);
  assert.equal(corte.hielo.cuadre.vendido, 16);
  assert.ok(corte.hielo.corregido);
  assert.equal(fila.fecha < corte.hielo.conteo.fecha, true,
    'la venta cae ANTES del conteo: ese hielo salió antes de contar');
});

test('sin motivo no entra, y a un turno abierto se cobra normal', async () => {
  let r = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 300, cajaId: corteCerrado.id }
  });
  assert.equal(r.estado, 400);

  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 100 } });
  const abierta = (await llamar("/api/caja")).json.datos.abierta.caja;
  r = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 300, cajaId: abierta.id, motivoCorreccion: 'x' }
  });
  assert.equal(r.estado, 409);
  await cerrarSiHayAbierto();
});

test('la venta a un corte cerrado es solo del administrador', async () => {
  await entrarPorNombre('Rosa', '4444');
  const r = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 300, cajaId: corteCerrado.id, motivoCorreccion: 'x' }
  });
  assert.equal(r.estado, 403);
  await entrarAdmin();
});
