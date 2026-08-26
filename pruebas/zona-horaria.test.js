/**
 * LA ZONA HORARIA  (v2.0.2)
 *
 * Las fechas se guardan en UTC, que es lo correcto: un instante, no una
 * hora de pared. Pero quien busca escribe la hora de la fábrica, y en
 * Yucatán son seis horas de diferencia.
 *
 * Sin convertir, pasaba esto de verdad: un ticket cobrado a las 6:29 de la
 * tarde se guarda como las 00:29 del día SIGUIENTE en UTC, y la lista de
 * "los tickets de hoy" salía VACÍA a partir de las 6 de la tarde. En una
 * fábrica de hielo, que cierra a las 8, eso es la mitad del día.
 *
 * Esta prueba corre con el reloj de Yucatán puesto a propósito.
 */
process.env.TZ = 'America/Merida';           // ANTES de cargar nada más

const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, bd, preparar } = fabricaDePrueba('zona-horaria');

/** El día de hoy según el reloj de la fábrica. */
function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${
    String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Mueve un ticket a una hora concreta del reloj de la fábrica.
 *
 * Se guarda en UTC, como todo, para que la prueba pase por el mismo camino
 * que la vida real.
 */
function ponerHoraLocal(ventaId, hora, minuto = 0) {
  const d = new Date();
  d.setHours(hora, minuto, 0, 0);
  bd.prepare('UPDATE ventas SET fecha = ? WHERE id = ?').run(d.toISOString(), ventaId);
  return d;
}

function vender() {
  return llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: '300' }
  }).then((r) => r.json.datos.venta);
}

// ============================================================
// LOS TICKETS DE HOY
// ============================================================

test('el reloj de la prueba es el de Yucatán', () => {
  assert.equal(process.env.TZ, 'America/Merida');
  assert.equal(new Date().getTimezoneOffset(), 360,
               'seis horas detrás de UTC: es lo que hacía desaparecer los tickets');
});

test('un ticket de las 6:29 de la tarde SÍ es de hoy', async () => {
  const v = await vender();
  const cuando = ponerHoraLocal(v.id, 18, 29);

  // En UTC ese ticket ya es de mañana. Ahí estaba el error.
  assert.notEqual(cuando.toISOString().slice(0, 10), hoyLocal(),
                  'la prueba no sirve si no cruza la medianoche de UTC');

  const { ventas } = (await llamar('/api/ventas?hoy=1&limite=50')).json.datos;
  assert.ok(ventas.some((x) => x.id === v.id),
            'a las 6:29 de la tarde el ticket tiene que seguir siendo de hoy');
});

test('los tickets de toda la tarde siguen en la lista', async () => {
  const ids = [];
  for (const hora of [19, 20, 21, 22, 23]) {
    const v = await vender();
    ponerHoraLocal(v.id, hora, 15);
    ids.push(v.id);
  }

  const { ventas } = (await llamar('/api/ventas?hoy=1&limite=50')).json.datos;
  for (const id of ids) {
    assert.ok(ventas.some((x) => x.id === id), 'ninguna hora de la tarde se cae');
  }
});

test('un ticket de ayer NO es de hoy', async () => {
  const v = await vender();
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  ayer.setHours(14, 0, 0, 0);
  bd.prepare('UPDATE ventas SET fecha = ? WHERE id = ?').run(ayer.toISOString(), v.id);

  const { ventas } = (await llamar('/api/ventas?hoy=1&limite=50')).json.datos;
  assert.ok(!ventas.some((x) => x.id === v.id));
});

test('uno de las 7 de la mañana también es de hoy', async () => {
  const v = await vender();
  ponerHoraLocal(v.id, 7, 5);

  const { ventas } = (await llamar('/api/ventas?hoy=1&limite=50')).json.datos;
  assert.ok(ventas.some((x) => x.id === v.id));
});

// ============================================================
// EL HISTORIAL: POR DÍA Y POR HORA
// ============================================================

test('el historial filtrado por hoy trae los de la tarde', async () => {
  const v = await vender();
  ponerHoraLocal(v.id, 19, 40);

  const hoy = hoyLocal();
  const { movimientos } = (await llamar(
    `/api/historial?desde=${hoy}&hasta=${hoy}&limite=300`)).json.datos;

  assert.ok(movimientos.some((m) => m.id === v.id),
            'buscar "hoy" tiene que traer lo de la tarde de hoy');
});

test('el filtro por horas usa el reloj de la fábrica', async () => {
  const tarde = await vender();
  ponerHoraLocal(tarde.id, 17, 30);          // 5:30 p.m.
  const manana = await vender();
  ponerHoraLocal(manana.id, 9, 30);          // 9:30 a.m.

  // "De 3 a 8 de la tarde". Sin convertir, esto traía lo de la mañana.
  const { movimientos } = (await llamar(
    '/api/historial?horaDesde=15:00&horaHasta=20:00&limite=300')).json.datos;

  assert.ok(movimientos.some((m) => m.id === tarde.id), 'el de las 5:30 p.m. sí');
  assert.ok(!movimientos.some((m) => m.id === manana.id), 'el de las 9:30 a.m. no');
});

test('el resumen del historial cuenta lo mismo que la lista', async () => {
  const hoy = hoyLocal();
  const r = (await llamar(`/api/historial?desde=${hoy}&hasta=${hoy}&limite=300`)).json.datos;

  const enLaLista = r.movimientos.filter((m) => m.tipo === 'venta' && !m.cancelada_en).length;
  assert.equal(r.resumen.ventas, enLaLista,
               'si los totales y la lista no usan el mismo reloj, nunca cuadran');
});
