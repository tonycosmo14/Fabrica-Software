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

// ============================================================
// LA RAYA, COMO SE PAGA DE VERDAD  (v6.8)
//
// "Aquí los sueldos pueden ser muy variados. Hay trabajadores que se les
//  paga por día, pero depende del día el sueldo es diferente: a veces los
//  sábados o los domingos se paga un poco más, o los días feriados. Hay
//  trabajadores que se les paga la quincena, otros a la semana, otros
//  diario, otros por horas."
// ============================================================

let beto;   // por hora
let lupita; // por quincena

/** Un lunes fijo, para que las pruebas no dependan de qué día se corran. */
const LUNES = '2026-08-24';
const MARTES = '2026-08-25';
const MIERCOLES = '2026-08-26';
const SABADO = '2026-08-29';
const DOMINGO = '2026-08-30';
/** Un día que el dueño marcó a mano, de una semana anterior. */
const FERIADO = '2026-08-19';   // miércoles

test('se dan de alta las otras dos formas de pago', async () => {
  await entrarAdmin();
  const alta = async (n, r, p) => (await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: n, rol: r, pin: p }
  })).json.datos.usuario;
  beto = await alta('Beto Ken', 'repartidor', '6161');
  lupita = await alta('Lupita May', 'gerente', '7171');

  const cat = (await llamar('/api/raya')).json.datos;
  assert.deepEqual(cat.tiposSueldo.map((t) => t.clave),
    ['semanal', 'quincenal', 'por_dia', 'por_hora']);
  assert.deepEqual(cat.tiposDia.map((t) => t.clave),
    ['entre_semana', 'sabado', 'domingo', 'especial']);
});

test('el sueldo por día lleva su tarifa de sábado, domingo y especial', async () => {
  // Rosa ya traía un sueldo por día puesto hoy. Se le anula para rehacerlo
  // con sus tarifas y con fecha vieja, que es lo que van a mirar las
  // semanas de atrás.
  for (const s of (await llamar(`/api/raya/${rosa.id}`)).json.datos.sueldos) {
    await llamar(`/api/raya/sueldos/${s.id}/anular`, { method: 'POST' });
  }
  const r = await llamar(`/api/raya/${rosa.id}/sueldo`, {
    method: 'POST',
    cuerpo: { tipo: 'por_dia', monto: 300, sabado: 350, domingo: 400, especial: 500,
              desde: '2026-01-01' }
  });
  assert.equal(r.estado, 201);
  const s = r.json.datos.sueldo;
  assert.equal(s.tipo, 'por_dia');
  assert.equal(s.centavos, 30000);
  assert.equal(s.sabado_centavos, 35000);
  assert.equal(s.domingo_centavos, 40000);
  assert.equal(s.especial_centavos, 50000);
});

test('las tarifas vacías quieren decir «lo mismo que un día normal»', async () => {
  const r = await llamar(`/api/raya/${beto.id}/sueldo`, {
    method: 'POST', cuerpo: { tipo: 'por_hora', monto: 40, domingo: 60, desde: '2026-01-01' }
  });
  assert.equal(r.estado, 201);
  const s = r.json.datos.sueldo;
  assert.equal(s.tipo, 'por_hora');
  assert.equal(s.centavos, 4000, 'la hora normal');
  assert.equal(s.sabado_centavos, null, 'el sábado se paga como un día normal');
  assert.equal(s.domingo_centavos, 6000);
});

test('a quien cobra por quincena no se le piden tarifas de día', async () => {
  const r = await llamar(`/api/raya/${lupita.id}/sueldo`, {
    method: 'POST', cuerpo: { tipo: 'quincenal', monto: 6000, sabado: 999, desde: '2026-01-01' }
  });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.sueldo.tipo, 'quincenal');
  assert.equal(r.json.datos.sueldo.sabado_centavos, null,
    'a quien se le paga la quincena completa le da igual el sábado');
});

// ---------- LOS DÍAS ESPECIALES ----------

test('los días especiales los marca el dueño, no hay lista fija', async () => {
  let r = await llamar('/api/raya/dias-especiales', {
    method: 'POST', cuerpo: { dia: FERIADO, nombre: 'El aniversario de la fábrica' }
  });
  assert.equal(r.estado, 201);
  assert.ok(r.json.datos.dias.some((d) => d.dia === FERIADO));

  // El mismo día dos veces, no.
  r = await llamar('/api/raya/dias-especiales', {
    method: 'POST', cuerpo: { dia: FERIADO, nombre: 'otra vez' }
  });
  assert.equal(r.estado, 409);

  // Sin nombre tampoco: "especial" a secas no dice nada dentro de un año.
  r = await llamar('/api/raya/dias-especiales', { method: 'POST', cuerpo: { dia: '2026-12-25' } });
  assert.equal(r.estado, 400);
});

test('el día especial manda sobre el sábado y el domingo', async () => {
  const calculo = require('../src/modulos/raya/calculo');
  assert.equal(calculo.tipoDeDia(LUNES), 'entre_semana');
  assert.equal(calculo.tipoDeDia(SABADO), 'sabado');
  assert.equal(calculo.tipoDeDia(DOMINGO), 'domingo');
  assert.equal(calculo.tipoDeDia(FERIADO), 'especial');

  await llamar('/api/raya/dias-especiales', {
    method: 'POST', cuerpo: { dia: SABADO, nombre: 'La feria del pueblo' }
  });
  assert.equal(calculo.tipoDeDia(SABADO), 'especial',
    'un feriado que cae en sábado se paga como especial');

  // Y se puede desmarcar.
  const dias = (await llamar('/api/raya/dias-especiales')).json.datos.dias;
  const feria = dias.find((d) => d.dia === SABADO);
  const r = await llamar(`/api/raya/dias-especiales/${feria.id}`, { method: 'DELETE' });
  assert.equal(r.estado, 200);
  assert.equal(calculo.tipoDeDia(SABADO), 'sabado');
});

// ---------- LO QUE SE TRABAJÓ CADA DÍA ----------

test('un día se apunta con hora de entrada y salida, y las horas salen solas', async () => {
  const r = await llamar(`/api/raya/${beto.id}/jornadas`, {
    method: 'PUT',
    cuerpo: { dia: LUNES, entrada: '8:00', salida: '14:30', desde: LUNES, hasta: LUNES }
  });
  assert.equal(r.estado, 201, JSON.stringify(r.json));
  const d = r.json.datos.dias[0];
  assert.equal(d.entrada, '08:00');
  assert.equal(d.salida, '14:30');
  assert.equal(d.horas, 6.5, 'de la resta, sin teclearlas');
  assert.equal(d.tipoDia, 'entre_semana');
  assert.equal(d.centavos, 26000, '6.5 horas por $40');
});

test('o con las horas a secas, para el que nada más dice «hice seis»', async () => {
  const r = await llamar(`/api/raya/${beto.id}/jornadas`, {
    method: 'PUT',
    cuerpo: { dia: MARTES, horas: 6, desde: MARTES, hasta: MARTES }
  });
  assert.equal(r.estado, 201);
  const d = r.json.datos.dias[0];
  assert.equal(d.horas, 6);
  assert.equal(d.entrada, null, 'no se inventa una hora de entrada');
  assert.equal(d.centavos, 24000);
});

test('el día que no vino se apunta también: es un dato', async () => {
  const r = await llamar(`/api/raya/${beto.id}/jornadas`, {
    method: 'PUT',
    cuerpo: { dia: MIERCOLES, vino: false, notas: 'Se reportó enfermo',
              desde: MIERCOLES, hasta: MIERCOLES }
  });
  assert.equal(r.estado, 201);
  const d = r.json.datos.dias[0];
  assert.equal(d.vino, false);
  assert.equal(d.centavos, 0);
  assert.match(d.notas, /enfermo/);
});

test('volver a mandar el mismo día lo corrige, no lo duplica', async () => {
  const r = await llamar(`/api/raya/${beto.id}/jornadas`, {
    method: 'PUT',
    cuerpo: { dia: LUNES, entrada: '08:00', salida: '16:00', desde: LUNES, hasta: LUNES }
  });
  assert.equal(r.estado, 200, 'ya existía: se corrige');
  assert.equal(r.json.datos.dias[0].horas, 8);
  const n = bd.prepare(
    'SELECT COUNT(*) n FROM jornadas WHERE usuario_id = ? AND dia = ? AND anulada_en IS NULL'
  ).get(beto.id, LUNES).n;
  assert.equal(n, 1);
});

test('media hora de entrada sin la de salida no se guarda, ni un día del futuro', async () => {
  let r = await llamar(`/api/raya/${beto.id}/jornadas`, {
    method: 'PUT', cuerpo: { dia: LUNES, entrada: '08:00' }
  });
  assert.equal(r.estado, 400);

  r = await llamar(`/api/raya/${beto.id}/jornadas`, {
    method: 'PUT', cuerpo: { dia: '2099-01-01', horas: 8 }
  });
  assert.equal(r.estado, 400, 'ese día todavía no llega');

  r = await llamar(`/api/raya/${beto.id}/jornadas`, {
    method: 'PUT', cuerpo: { dia: LUNES, horas: 30 }
  });
  assert.equal(r.estado, 400, 'un día tiene 24 horas');
});

test('la semana se rellena de un golpe con su horario de costumbre', async () => {
  // Rosa viene de lunes a sábado, de 7 a 3.
  const horario = [1, 2, 3, 4, 5, 6].map((dia) => ({ dia, entra: '07:00', sale: '15:00' }));
  const h = await llamar(`/api/raya/${rosa.id}/horario`, { method: 'PUT', cuerpo: { dias: horario } });
  assert.equal(h.estado, 200);

  const r = await llamar(`/api/raya/${rosa.id}/jornadas/de-costumbre`, {
    method: 'POST', cuerpo: { desde: LUNES, hasta: DOMINGO }
  });
  assert.equal(r.estado, 200, JSON.stringify(r.json));
  assert.ok(r.json.datos.puestos >= 7, 'los siete días de esa semana ya pasaron');

  const dias = r.json.datos.dias;
  const lunes = dias.find((d) => d.dia === LUNES);
  assert.equal(lunes.vino, true);
  assert.equal(lunes.entrada, '07:00');
  const domingo = dias.find((d) => d.dia === DOMINGO);
  assert.equal(domingo.vino, false, 'el domingo no viene, y eso queda apuntado');
});

test('rellenar de nuevo NO pisa lo que ya se había corregido a mano', async () => {
  await llamar(`/api/raya/${rosa.id}/jornadas`, {
    method: 'PUT', cuerpo: { dia: LUNES, vino: false, notas: 'No vino' }
  });
  const r = await llamar(`/api/raya/${rosa.id}/jornadas/de-costumbre`, {
    method: 'POST', cuerpo: { desde: LUNES, hasta: DOMINGO }
  });
  assert.equal(r.json.datos.puestos, 0, 'ya estaban todos apuntados');
  const lunes = r.json.datos.dias.find((d) => d.dia === LUNES);
  assert.equal(lunes.vino, false, 'lo corregido a mano manda');
});

// ---------- Y LA CUENTA ----------

test('la raya por día suma cada día con la tarifa que le toca', async () => {
  const { balance } = (await llamar(
    `/api/raya/${rosa.id}/balance?desde=${LUNES}&hasta=${DOMINGO}`)).json.datos;

  // Rosa: lunes no vino; martes a viernes normales ($300); sábado ($350);
  // domingo no viene.
  assert.equal(balance.tipo, 'por_dia');
  assert.equal(balance.diasContados, 5);
  assert.equal(balance.sueldoCentavos, 4 * 30000 + 35000);
  assert.equal(balance.porCostumbre, false, 'salió de lo apuntado, no de su horario');

  const sabado = balance.porTipoDia.find((t) => t.clave === 'sabado');
  assert.equal(sabado.dias, 1);
  assert.equal(sabado.centavos, 35000, 'el sábado se pagó más caro, y se ve aparte');
});

test('la raya por hora suma las horas de cada día por su tarifa', async () => {
  // Beto: lunes 8 h normales, martes 6 h normales, miércoles no vino.
  const { balance } = (await llamar(
    `/api/raya/${beto.id}/balance?desde=${LUNES}&hasta=${DOMINGO}`)).json.datos;
  assert.equal(balance.tipo, 'por_hora');
  assert.equal(balance.horasContadas, 14);
  assert.equal(balance.sueldoCentavos, 14 * 4000);
  assert.equal(balance.diasContados, 2);
  assert.ok(balance.diasSinApuntar > 0, 'y dice cuántos días faltan por apuntar');
});

test('el domingo del que cobra por hora se paga a su tarifa', async () => {
  await llamar(`/api/raya/${beto.id}/jornadas`, {
    method: 'PUT', cuerpo: { dia: DOMINGO, horas: 4 }
  });
  const { balance } = (await llamar(
    `/api/raya/${beto.id}/balance?desde=${LUNES}&hasta=${DOMINGO}`)).json.datos;
  assert.equal(balance.horasContadas, 18);
  assert.equal(balance.sueldoCentavos, 14 * 4000 + 4 * 6000, 'el domingo va a $60 la hora');
});

test('sin ni un día apuntado se cae al horario de costumbre, y lo dice', async () => {
  const { balance } = (await llamar(
    `/api/raya/${rosa.id}/balance?desde=2026-08-03&hasta=2026-08-09`)).json.datos;
  assert.equal(balance.porCostumbre, true,
    'es una suposición, y quien paga tiene que saberlo');
  assert.equal(balance.diasContados, 6, 'los días que viene de costumbre');
});

test('al que cobra la quincena no le cambia el número por los días', async () => {
  const { balance } = (await llamar(
    `/api/raya/${lupita.id}/balance?desde=${LUNES}&hasta=${DOMINGO}`)).json.datos;
  assert.equal(balance.tipo, 'quincenal');
  assert.equal(balance.cuentaDias, false);
  assert.equal(balance.sueldoCentavos, 600000);
  assert.ok(Array.isArray(balance.dias), 'aunque sí se ve quién vino y quién no');
});

test('la raya pagada guarda cómo se sacó, congelado', async () => {
  await entrarAdmin();
  const r = await llamar(`/api/raya/${rosa.id}/pagar`, {
    method: 'POST', cuerpo: { desde: LUNES, hasta: DOMINGO, deDonde: 'fuera' }
  });
  assert.equal(r.estado, 201, JSON.stringify(r.json));
  const raya = r.json.datos.raya;
  assert.equal(raya.tipo_sueldo, 'por_dia');
  assert.equal(raya.dias_trabajados, 5);
  assert.equal(raya.sueldo_centavos, 4 * 30000 + 35000);

  const detalle = JSON.parse(raya.detalle);
  assert.equal(detalle.dias.length, 5);
  assert.ok(detalle.dias.some((d) => d.tipo === 'sabado' && d.centavos === 35000));

  // Y aunque después le suban el sueldo o se desmarque el feriado, el
  // papel que firmó dice lo mismo.
  await llamar(`/api/raya/${rosa.id}/sueldo`, {
    method: 'POST', cuerpo: { tipo: 'por_dia', monto: 500 }
  });
  const otra = (await llamar(`/api/raya/rayas/${raya.id}`)).json.datos.raya;
  assert.equal(otra.sueldo_centavos, 4 * 30000 + 35000);
  assert.equal(JSON.parse(otra.detalle).dias.length, 5);
});

test('el día especial se paga a su tarifa, y desmarcarlo después no cambia la raya', async () => {
  await entrarAdmin();
  // El aniversario de la fábrica, que está marcado como especial.
  const r = await llamar(`/api/raya/${rosa.id}/jornadas`, {
    method: 'PUT', cuerpo: { dia: FERIADO, entrada: '07:00', salida: '15:00' }
  });
  assert.equal(r.estado, 201);

  let { balance } = (await llamar(
    `/api/raya/${rosa.id}/balance?desde=${FERIADO}&hasta=${FERIADO}`)).json.datos;
  assert.equal(balance.dias[0].tipoDia, 'especial');
  assert.equal(balance.sueldoCentavos, 50000, 'el feriado vale $500');

  // Se desmarca el feriado: la jornada ya apuntada NO cambia de clase.
  const dias = (await llamar('/api/raya/dias-especiales')).json.datos.dias;
  const aniversario = dias.find((d) => d.dia === FERIADO);
  await llamar(`/api/raya/dias-especiales/${aniversario.id}`, { method: 'DELETE' });

  ({ balance } = (await llamar(
    `/api/raya/${rosa.id}/balance?desde=${FERIADO}&hasta=${FERIADO}`)).json.datos);
  assert.equal(balance.dias[0].tipoDia, 'especial',
    'la jornada copió su clase al guardarse: lo trabajado no se reescribe');
});

test('el papel dice qué días trabajó, uno por uno', async () => {
  await entrarAdmin();
  const raya = (await llamar(`/api/raya/${rosa.id}`)).json.datos.rayas
    .find((r) => r.desde === LUNES && !r.anulada_en);
  const { renglones } = (await llamar(
    `/api/impresion/raya/${raya.id}/previa`)).json.datos;
  const papel = renglones.map((x) => x.t).join('\n');

  assert.match(papel, /LO QUE TRABAJO/,
    'la pregunta al recibir el papel es «¿me contaste el domingo?»');
  assert.match(papel, /sábado/, 'y el día que se pagó distinto se ve como tal');
  assert.match(papel, /29\/Ago sábado\s+\$350/, 'con lo que valió ese día');
  assert.doesNotMatch(papel, /1 dia de sábado/,
    'y no se repite abajo: con un solo sábado, repetirlo hace dudar de si ' +
    'se contó dos veces');
});

test('el papel de quien cobra por hora cuenta horas, no días', async () => {
  const previa = (await llamar(
    `/api/impresion/raya-previa/${beto.id}?desde=${LUNES}&hasta=${DOMINGO}`)).json.datos;
  const papel = previa.renglones.map((x) => x.t).join('\n');
  assert.match(papel, /Sueldo \(18 h\)/, 'a Beto se le pagan horas');
  assert.match(papel, /TODAVIA NO SE HA PAGADO/, 'y esto es solo la cuenta');
});

test('una raya vieja, sin detalle, se sigue pudiendo reimprimir', async () => {
  // Las rayas de antes de la v6.8 no guardaron el día por día, y ese papel
  // tiene que salir igual: alguien lo firmó. Se simula una vaciándole la
  // columna, que es exactamente como quedaron al actualizar.
  const vieja = (await llamar(`/api/raya/${chuy.id}`)).json.datos.rayas[0];
  bd.prepare('UPDATE rayas SET detalle = NULL, tipo_sueldo = NULL WHERE id = ?')
    .run(vieja.id);
  const r = await llamar(`/api/impresion/raya/${vieja.id}/previa`);
  assert.equal(r.estado, 200);
  assert.match(r.json.datos.renglones.map((x) => x.t).join('\n'), /SE LE PAGA/);
});

test('el cajero no captura jornadas ni marca días especiales', async () => {
  await entrarPorNombre('Rosa Canul', '4444');
  let r = await llamar(`/api/raya/${beto.id}/jornadas`, {
    method: 'PUT', cuerpo: { dia: LUNES, horas: 8 }
  });
  assert.equal(r.estado, 403);
  r = await llamar('/api/raya/dias-especiales', {
    method: 'POST', cuerpo: { dia: '2026-11-20', nombre: 'Revolución' }
  });
  assert.equal(r.estado, 403);
  await entrarAdmin();
});
