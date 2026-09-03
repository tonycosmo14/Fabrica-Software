/**
 * PRUEBAS DE LA RAYA  (v4.8)
 *
 * "A veces el sueldo se agarra de la caja, a veces se hace el corte y luego
 *  se le da, ¿cómo quieres manejarlo?"
 *
 * Toda la dificultad está ahí, y es lo que se prueba:
 *
 *  · que pagando DEL CAJÓN el corte lo reste — o al contar faltaría dinero
 *  · que pagando DE FUERA el cajón NO se entere — ese dinero ya salió como
 *    retiro, y restarlo otra vez sería contarlo dos veces
 *  · que las dos cuenten como gasto de la fábrica en el costo por marqueta
 *  · que los vales se descuenten solos y queden atados a la raya que los
 *    pagó, para que "ya se le descontó" tenga respaldo
 *  · que anular una raya lo deshaga TODO, vales incluidos
 *  · que subirle el sueldo mañana no cambie el papel que firmó hoy
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, entrarPorNombre, bd, preparar } = fabricaDePrueba('raya');

let chuy;   // operario, sueldo semanal
let rosa;   // encargada de caja, sueldo por día

preparar(async () => {
  const alta = async (n, r, p) => (await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: n, rol: r, pin: p }
  })).json.datos.usuario;
  chuy = await alta('Chuy Pech', 'operario', '2222');
  rosa = await alta('Rosa Canul', 'cajero', '4444');
});

/** El estado del turno abierto ahora mismo, o null. */
async function turno() {
  return (await llamar('/api/caja')).json.datos.abierta || null;
}

// ============================================================
// CUÁNTO GANA
// ============================================================

test('sin sueldo capturado no se inventa un número', async () => {
  const { balance } = (await llamar(`/api/raya/${chuy.id}/balance`)).json.datos;
  assert.equal(balance.sinSueldo, true);
  assert.equal(balance.sueldoCentavos, 0);
});

test('ponerle sueldo semanal', async () => {
  const r = await llamar(`/api/raya/${chuy.id}/sueldo`, {
    method: 'POST', cuerpo: { tipo: 'semanal', monto: 1500 }
  });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.sueldo.centavos, 150000);
  assert.equal(r.json.datos.sueldo.tipo, 'semanal');
});

test('un aumento NO reescribe lo que ganaba antes', async () => {
  await llamar(`/api/raya/${chuy.id}/sueldo`, {
    method: 'POST', cuerpo: { tipo: 'semanal', monto: 1800, desde: '2030-01-01' }
  });

  // El de hoy sigue siendo el viejo: un aumento con fecha de mañana no
  // cambia la raya de esta semana.
  const d = (await llamar(`/api/raya/${chuy.id}`)).json.datos;
  assert.equal(d.sueldo.centavos, 150000, 'vale el que ya entró en vigor');
  assert.equal(d.sueldos.length, 2, 'y el histórico guarda los dos');
});

test('el sueldo por día se multiplica por los días que viene', async () => {
  await llamar(`/api/raya/${rosa.id}/sueldo`, {
    method: 'POST', cuerpo: { tipo: 'por_dia', monto: 350 }
  });
  await llamar(`/api/raya/${rosa.id}/horario`, {
    method: 'PUT',
    cuerpo: { dias: [1, 2, 3, 4, 5, 6].map((dia) => ({ dia, entra: '07:00', sale: '15:00' })) }
  });

  const { balance } = (await llamar(`/api/raya/${rosa.id}/balance`)).json.datos;
  assert.equal(balance.diasContados, 6);
  assert.equal(balance.sueldoCentavos, 35000 * 6);
});

// ============================================================
// QUÉ DÍAS VIENE Y A QUÉ HORA
// ============================================================

test('el horario devuelve los SIETE días, con los que no viene marcados', async () => {
  const { horario } = (await llamar(`/api/raya/${rosa.id}`)).json.datos;
  assert.equal(horario.length, 7);
  assert.equal(horario[0].nombre, 'domingo');
  assert.equal(horario[0].viene, false, 'el domingo no viene, y eso es un dato');
  assert.equal(horario[1].viene, true);
  assert.equal(horario[1].entra, '07:00');
  assert.equal(horario[1].horas, 8);
});

test('un turno que cruza la medianoche cuenta bien las horas', async () => {
  await llamar(`/api/raya/${chuy.id}/horario`, {
    method: 'PUT', cuerpo: { dias: [{ dia: 3, entra: '22:00', sale: '06:00' }] }
  });
  const { horario } = (await llamar(`/api/raya/${chuy.id}`)).json.datos;
  assert.equal(horario[3].horas, 8, 'de las diez de la noche a las seis son ocho, no menos dieciséis');
});

test('una hora mal escrita no se guarda', async () => {
  const r = await llamar(`/api/raya/${chuy.id}/horario`, {
    method: 'PUT', cuerpo: { dias: [{ dia: 1, entra: '7', sale: 'tarde' }] }
  });
  assert.equal(r.estado, 400);
  assert.match(r.json.error, /07:00/);
});

// ============================================================
// PAGAR — LA PREGUNTA QUE DECIDE TODO
// ============================================================

test('pagar DEL CAJÓN deja su salida, y el corte la resta', async () => {
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 5000 } });
  const antes = await turno();

  const r = await llamar(`/api/raya/${chuy.id}/pagar`, {
    method: 'POST', cuerpo: { deDonde: 'cajon' }
  });
  assert.equal(r.estado, 201);
  const raya = r.json.datos.raya;
  assert.equal(raya.pagado_centavos, 150000);
  assert.equal(raya.de_donde, 'cajon');
  assert.ok(raya.movimiento_id, 'dejó su renglón en el cajón');
  assert.equal(raya.gasto_empresa_id, null);

  const ahora = await turno();
  assert.equal(ahora.esperado, antes.esperado - 150000,
    'si el cajón no lo restara, al contar faltaría el dinero y nadie sabría por qué');
});

test('pagar DE FUERA no toca el cajón, pero sí es gasto de la fábrica', async () => {
  const antes = await turno();

  const r = await llamar(`/api/raya/${rosa.id}/pagar`, {
    method: 'POST', cuerpo: { deDonde: 'fuera' }
  });
  assert.equal(r.estado, 201);
  const raya = r.json.datos.raya;
  assert.equal(raya.de_donde, 'fuera');
  assert.equal(raya.movimiento_id, null);
  assert.ok(raya.gasto_empresa_id, 'entra por los gastos de la empresa');

  // EL CAJÓN NO SE ENTERA. Ese dinero ya salió de ahí como retiro:
  // restarlo otra vez sería contarlo dos veces.
  assert.equal((await turno()).esperado, antes.esperado);

  // Pero sí cuenta como gasto: el sueldo es gasto de la fábrica.
  const g = bd.prepare('SELECT * FROM gastos_empresa WHERE id = ?').get(raya.gasto_empresa_id);
  assert.equal(g.concepto_id, 'emp-sueldos');
  assert.equal(g.centavos, raya.pagado_centavos);
});

test('el costo por marqueta ya lleva la raya', async () => {
  const d = (await llamar('/api/estadisticas')).json.datos;
  // Los dos pagos entraron por bolsas distintas y los dos suman.
  assert.ok(d.gastos.gastado > 0, 'el del cajón');
  assert.ok(d.grandes.some((c) => c.nombre === 'Sueldos'), 'y el de fuera');
});

// ============================================================
// LOS VALES
// ============================================================

test('los vales se descuentan solos y quedan atados a su raya', async () => {
  await llamar('/api/caja/vales', {
    method: 'POST', cuerpo: { clase: 'raya', monto: 400, ejecutorId: chuy.id } });
  await llamar('/api/caja/vales', {
    method: 'POST', cuerpo: { clase: 'raya', monto: 200, ejecutorId: chuy.id } });

  const { balance } = (await llamar(`/api/raya/${chuy.id}/balance`)).json.datos;
  assert.equal(balance.valesCentavos, 60000);
  assert.equal(balance.valesCuantos, 2);
  assert.equal(balance.pagadoCentavos, 150000 - 60000, 'se le paga su sueldo menos los vales');

  const r = await llamar(`/api/raya/${chuy.id}/pagar`, {
    method: 'POST', cuerpo: { deDonde: 'cajon' } });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.raya.vales_centavos, 60000);
  assert.equal(r.json.datos.raya.pagado_centavos, 90000);

  // Y cada vale sabe de qué pago salió: sin eso, "ya se le descontó" se
  // queda sin respaldo.
  const vales = bd.prepare('SELECT * FROM adelantos WHERE usuario_id = ?').all(chuy.id);
  assert.ok(vales.every((v) => v.raya_id === r.json.datos.raya.id));
  assert.ok(vales.every((v) => v.descontado_en));

  // Ya no le queda nada pendiente.
  assert.equal((await llamar(`/api/usuarios/${chuy.id}/adelantos`))
    .json.datos.pendiente.centavos, 0);
});

test('si debe más vales que lo que gana, no se paga en rojo', async () => {
  await llamar('/api/caja/vales', {
    method: 'POST', cuerpo: { clase: 'raya', monto: 5000, ejecutorId: chuy.id } });

  const { balance } = (await llamar(`/api/raya/${chuy.id}/balance`)).json.datos;
  assert.equal(balance.enNegativo, true);

  const r = await llamar(`/api/raya/${chuy.id}/pagar`, {
    method: 'POST', cuerpo: { deDonde: 'cajon' } });
  assert.equal(r.estado, 409);
  assert.match(r.json.error, /debe más de vales/i);
});

// ============================================================
// ANULAR
// ============================================================

test('anular una raya lo deshace todo, vales incluidos', async () => {
  // Se quita el vale grandote para poder pagar otra vez.
  const grande = bd.prepare(`
    SELECT movimiento_id FROM adelantos
     WHERE usuario_id = ? AND descontado_en IS NULL AND anulado_en IS NULL
  `).get(chuy.id);
  await llamar(`/api/caja/movimientos/${grande.movimiento_id}/anular`, {
    method: 'POST', cuerpo: { motivo: 'Era para la prueba' } });

  await llamar('/api/caja/vales', {
    method: 'POST', cuerpo: { clase: 'raya', monto: 100, ejecutorId: chuy.id } });

  const pagada = (await llamar(`/api/raya/${chuy.id}/pagar`, {
    method: 'POST', cuerpo: { deDonde: 'cajon' } })).json.datos.raya;
  const antes = await turno();

  const sinMotivo = await llamar(`/api/raya/rayas/${pagada.id}/anular`,
    { method: 'POST', cuerpo: {} });
  assert.equal(sinMotivo.estado, 400, 'anular sin decir por qué, no');

  const r = await llamar(`/api/raya/rayas/${pagada.id}/anular`, {
    method: 'POST', cuerpo: { motivo: 'Se pagó dos veces' } });
  assert.equal(r.estado, 200);

  // El dinero vuelve al cajón.
  assert.equal((await turno()).esperado, antes.esperado + pagada.pagado_centavos);

  // Y sus vales vuelven a estar pendientes: si la raya no valió, tampoco
  // valió el descuento.
  assert.equal((await llamar(`/api/usuarios/${chuy.id}/adelantos`))
    .json.datos.pendiente.centavos, 10000);

  // La raya no se borra: queda marcada (regla 3.4).
  const fila = bd.prepare('SELECT * FROM rayas WHERE id = ?').get(pagada.id);
  assert.ok(fila.anulada_en);
  assert.equal(fila.motivo_anulacion, 'Se pagó dos veces');
});

// ============================================================
// EL PAPEL
// ============================================================

test('el papel dice de quién es, la cuenta entera y de dónde salió', async () => {
  await entrarAdmin();
  const r = bd.prepare(`
    SELECT id FROM rayas WHERE anulada_en IS NULL AND vales_centavos > 0
     ORDER BY pagada_en DESC LIMIT 1
  `).get();

  const { renglones } = (await llamar(`/api/impresion/raya/${r.id}/previa`)).json.datos;
  const papel = renglones.map((x) => x.t).join('\n');

  assert.match(papel, /Sueldo/);
  assert.match(papel, /Chuy Pech/, 'de quién es');
  assert.match(papel, /Vales que se llevo/, 'por qué se lleva menos');
  assert.match(papel, /SE LE PAGA/, 'y el número del papel');
  assert.match(papel, /Salio del cajon/, 'de dónde salió');
  assert.match(papel, /RECIBI CONFORME/, 'con su raya para firmar');
});

test('subirle el sueldo después NO cambia el papel que ya firmó', async () => {
  const r = bd.prepare(
    'SELECT * FROM rayas WHERE anulada_en IS NULL ORDER BY pagada_en DESC LIMIT 1').get();
  const antes = r.sueldo_centavos;

  await llamar(`/api/raya/${r.usuario_id}/sueldo`, {
    method: 'POST', cuerpo: { tipo: 'semanal', monto: 9999 } });

  const despues = bd.prepare('SELECT sueldo_centavos FROM rayas WHERE id = ?').get(r.id);
  assert.equal(despues.sueldo_centavos, antes,
    'los importes se copian a la raya: el papel firmado no cambia (regla 3.5)');
});

test('el papel dice la fecha de cada vale, no NaN', async () => {
  await entrarAdmin();
  const r = bd.prepare(`
    SELECT id FROM rayas WHERE anulada_en IS NULL AND vales_centavos > 0
     ORDER BY pagada_en DESC LIMIT 1
  `).get();

  const { renglones } = (await llamar(`/api/impresion/raya/${r.id}/previa`)).json.datos;
  const papel = renglones.map((x) => x.t).join('\n');

  assert.ok(!/NaN|undefined/.test(papel),
    'los vales guardan la fecha CON hora, y el papel la recorta a día');
  assert.match(papel, /SUS VALES/, 'y van uno por uno con su fecha');
});

test('el papel se puede ver ANTES de pagar, y avisa que no se ha pagado', async () => {
  await entrarAdmin();
  const chuy = bd.prepare("SELECT id FROM usuarios WHERE nombre = 'Chuy Pech'").get();

  const r = await llamar(`/api/impresion/raya-previa/${chuy.id}`);
  assert.equal(r.estado, 200);
  const papel = r.json.datos.renglones.map((x) => x.t).join('\n');

  assert.match(papel, /Chuy Pech/);
  assert.match(papel, /TODAVIA NO SE HA PAGADO/, 'no se confunde con el bueno');
  assert.ok(!/RECIBI CONFORME/.test(papel), 'una previa no se firma');
  assert.ok(!/1\/Ene\/1970/.test(papel), 'ni se fecha en 1970 por no estar pagada');

  const cuantas = bd.prepare('SELECT COUNT(*) c FROM rayas').get().c;
  await llamar(`/api/impresion/raya-previa/${chuy.id}`);
  assert.equal(bd.prepare('SELECT COUNT(*) c FROM rayas').get().c, cuantas,
    'ver la previa no paga nada');
});

// ============================================================
// QUIÉN PUEDE
// ============================================================

test('los sueldos son solo del administrador', async () => {
  await entrarPorNombre('Rosa Canul', '4444');
  const r = await llamar('/api/raya');
  assert.equal(r.estado, 403, 'ni el encargado de caja ve lo que gana la gente');
  await entrarAdmin();
});
