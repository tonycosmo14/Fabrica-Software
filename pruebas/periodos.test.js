/**
 * EL MES DEL NEGOCIO  (v2.7)
 *
 * "El recibo de luz no es del 1 al 30, es del 12 al 12."
 *
 * El mes del calendario es una convención de los calendarios, no de las
 * fábricas. Estas pruebas fijan la regla: dónde empieza y dónde acaba un
 * periodo, cómo se llama, y qué pasa en los bordes —que es donde se rompen
 * las cuentas de fin de mes.
 *
 * Se le pasa el corte a mano en casi todas para no depender de lo que haya
 * configurado: la regla tiene que valer para cualquier día de corte.
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, bd, preparar } = fabricaDePrueba('periodos');
const p = require('../src/lib/periodos');


// ============================================================
// DÓNDE EMPIEZA Y DÓNDE ACABA
// ============================================================

test('con el corte en 1 el periodo es el mes del calendario de siempre', () => {
  const agosto = p.periodoDe('2026-08-26', 1);
  assert.equal(agosto.desde, '2026-08-01');
  assert.equal(agosto.hasta, '2026-08-31');
  assert.equal(agosto.nombre, 'Agosto 2026');
  assert.equal(agosto.fechas, '', 'sin fechas al lado: no hacen falta si es el mes normal');
});

test('con el corte en 12, agosto va del 12 de agosto al 11 de septiembre', () => {
  const agosto = p.periodoDe('2026-08-26', 12);
  assert.equal(agosto.desde, '2026-08-12');
  assert.equal(agosto.hasta, '2026-09-11');
  assert.equal(agosto.clave, '2026-08');
  assert.equal(agosto.fechas, '12 ago — 11 sep', 'y lo dice, para no tener que acordarse');
});

test('el periodo se llama por el mes en que EMPIEZA, que es como lo dice la gente', () => {
  // El 5 de septiembre, con el corte en 12, todavía se está en agosto:
  // es "el recibo de agosto", aunque el día sea de septiembre.
  assert.equal(p.periodoDe('2026-09-05', 12).nombre, 'Agosto 2026');
  assert.equal(p.periodoDe('2026-09-11', 12).nombre, 'Agosto 2026', 'el último día todavía es agosto');
  assert.equal(p.periodoDe('2026-09-12', 12).nombre, 'Septiembre 2026', 'y el día del corte ya es el siguiente');
});

test('los periodos se tocan sin dejar huecos ni encimarse', () => {
  // Un día que caiga en dos periodos se contaría dos veces; uno que no
  // caiga en ninguno desaparecería de las cuentas del año.
  for (const corte of [1, 5, 12, 15, 28]) {
    let periodo = p.periodoDe('2026-01-20', corte);
    for (let i = 0; i < 24; i++) {
      const siguiente = p.periodoDe(sumarDias(periodo.hasta, 1), corte);
      assert.equal(siguiente.desde, sumarDias(periodo.hasta, 1),
                   `corte ${corte}: hueco entre ${periodo.clave} y ${siguiente.clave}`);
      assert.ok(siguiente.desde > periodo.desde, 'y siempre hacia adelante');
      periodo = siguiente;
    }
  }
});

/** Un día del calendario más N días, sin que la zona horaria lo mueva. */
function sumarDias(dia, n) {
  const d = new Date(`${dia}T12:00:00`);
  d.setDate(d.getDate() + n);
  const dd = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;
}

test('cada día del año cae en exactamente un periodo', () => {
  const corte = 12;
  let dia = '2026-01-01';
  for (let i = 0; i < 400; i++) {
    const q = p.periodoDe(dia, corte);
    assert.ok(dia >= q.desde && dia <= q.hasta,
              `${dia} no cae dentro de su propio periodo ${q.desde}..${q.hasta}`);
    dia = sumarDias(dia, 1);
  }
});


// ============================================================
// LOS BORDES, QUE ES DONDE SE ROMPEN LAS CUENTAS
// ============================================================

test('el corte va del 1 al 28: con 30, febrero no tendría ese día', () => {
  assert.equal(p.MINIMO, 1);
  assert.equal(p.MAXIMO, 28);
  // Con 28 todos los meses del año tienen ese día, bisiesto o no, y el
  // periodo empieza siempre el mismo número.
  for (const anio of [2026, 2027, 2028]) {
    const feb = p.porClave(`${anio}-02`, 28);
    assert.equal(feb.desde, `${anio}-02-28`);
  }
});

test('el paso de diciembre a enero no se salta el año', () => {
  const diciembre = p.periodoDe('2026-12-20', 12);
  assert.equal(diciembre.desde, '2026-12-12');
  assert.equal(diciembre.hasta, '2027-01-11');
  assert.equal(diciembre.nombre, 'Diciembre 2026');

  const enero = p.periodoDe('2027-01-15', 12);
  assert.equal(enero.nombre, 'Enero 2027');
  assert.equal(p.anterior(enero, 12).clave, '2026-12');
});

test('un febrero bisiesto se cuenta con los días que de verdad tiene', () => {
  assert.equal(p.porClave('2028-02', 1).dias, 29, '2028 es bisiesto');
  assert.equal(p.porClave('2026-02', 1).dias, 28);
});

test('el periodo dice cuántos días tiene, porque no todos miden igual', () => {
  // Comparar el gasto de un periodo de 28 días contra uno de 31 sin saberlo
  // es sacar una cuenta que no significa nada.
  const agosto = p.periodoDe('2026-08-26', 12);
  assert.equal(agosto.dias, 31);
  assert.equal(p.porClave('2026-02', 12).dias, 28, 'del 12 feb al 11 mar');
});


// ============================================================
// LA LISTA Y LAS CLAVES
// ============================================================

test('los últimos periodos vienen del más nuevo al más viejo, sin repetir', () => {
  const lista = p.ultimos(15, 12);
  assert.equal(lista.length, 15);
  assert.equal(new Set(lista.map((x) => x.clave)).size, 15, 'ninguno repetido');
  for (let i = 1; i < lista.length; i++) {
    assert.ok(lista[i].desde < lista[i - 1].desde, 'y en orden');
  }
});

test('una clave con basura no devuelve un periodo inventado', () => {
  for (const mala of ['', 'agosto', '2026-13', '2026-00', '26-08', null, '1800-05']) {
    assert.equal(p.porClave(mala, 12), null, String(mala));
  }
});

test('la clave y el periodo son la misma cosa vista de dos maneras', () => {
  for (const corte of [1, 12, 28]) {
    const hoy = p.periodoDe('2026-08-26', corte);
    assert.deepEqual(p.porClave(hoy.clave, corte), hoy);
  }
});


// ============================================================
// EL AJUSTE
// ============================================================

test('de fábrica el mes es el del calendario', async () => {
  await entrarAdmin();
  assert.equal(p.diaDeCorte(), 1, 'quien no configure nada no tiene que entender nada');
});

test('un día de corte fuera de rango no rompe el cálculo', () => {
  // Aunque alguien meta basura en la base a mano, el mes tiene que seguir
  // partiéndose de alguna forma sensata.
  const poner = (v) => bd.prepare(`
    INSERT INTO configuracion (clave, valor, actualizado_en) VALUES ('periodo_dia_corte', ?, datetime('now'))
    ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor
  `).run(v);

  poner('99');
  assert.equal(p.diaDeCorte(), 28, 'se recorta al máximo');
  poner('0');
  assert.equal(p.diaDeCorte(), 1);
  poner('el jueves');
  assert.equal(p.diaDeCorte(), 1, 'y con basura, el mes normal');
  poner('12');
  assert.equal(p.diaDeCorte(), 12);
});


// ============================================================
// DE DÍAS DE CALENDARIO A INSTANTES  (v2.9)
// ============================================================

test('los instantes encierran el periodo completo, con el final abierto', () => {
  const { instantes } = p;
  const i = instantes({ desde: '2026-08-12', hasta: '2026-09-11' });

  // El principio es la medianoche local del primer día.
  assert.equal(i.desde, new Date('2026-08-12T00:00:00').toISOString());
  // El final es la medianoche del día SIGUIENTE al último: así el 11 de
  // septiembre cuenta entero, hasta las 23:59:59.999.
  assert.equal(i.hasta, new Date('2026-09-12T00:00:00').toISOString());
  assert.ok(i.desde < i.hasta);
});

test('un movimiento del último día a las 11 de la noche SÍ entra', () => {
  const { instantes } = p;
  const i = instantes({ desde: '2026-08-01', hasta: '2026-08-31' });

  const casi = new Date('2026-08-31T23:59:59').toISOString();
  assert.ok(casi >= i.desde && casi < i.hasta, 'la última noche del mes cuenta');

  const yaNo = new Date('2026-09-01T00:00:00').toISOString();
  assert.ok(!(yaNo < i.hasta), 'y el primer instante del mes que sigue, no');

  const antes = new Date('2026-07-31T23:59:59').toISOString();
  assert.ok(!(antes >= i.desde), 'ni la noche anterior al primer día');
});

test('un periodo de un solo día dura exactamente 24 horas', () => {
  const { instantes } = p;
  const i = instantes({ desde: '2026-08-15', hasta: '2026-08-15' });
  const horas = (new Date(i.hasta) - new Date(i.desde)) / 3600000;
  assert.equal(horas, 24);
});
