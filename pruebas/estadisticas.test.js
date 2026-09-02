/**
 * LOS NÚMEROS DEL NEGOCIO  (v2.9)
 *
 * Aquí no se prueba que la pantalla se vea bonita: se prueba que NINGÚN
 * NÚMERO MIENTA. Las trampas de este sistema, una por una:
 *
 *  · una venta cancelada, una devolución y el ticket viejo de un cambio
 *    son la misma cosa por dentro, y ninguna debe sumar
 *  · un cambio crea DOS tickets: si los dos contaran, el mes vendería el
 *    doble de lo que vendió
 *  · un retiro a la caja fuerte salió del cajón pero no es un gasto
 *  · lo fiado se vendió, pero no se cobró
 *  · los paños sembrados en la puesta en marcha no son producción
 *  · el mes del negocio puede ir del 12 al 12, y la última noche del
 *    último día todavía cuenta
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, entrarPorNombre, crearUsuario, bd, preparar } =
  fabricaDePrueba('estadisticas');

/** El periodo que contiene a hoy, con el corte que esté puesto. */
async function hoy() {
  return (await llamar('/api/estadisticas')).json.datos;
}

preparar(async () => {
  await llamar('/api/tanques', {
    method: 'POST',
    cuerpo: { nombre: 'T1', panos: 4, plantilla: [3, 3], horasCongelacion: 24 }
  });
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 500 } });
});


// ============================================================
// QUIÉN ENTRA
// ============================================================

test('el gerente ve los números; el cajero no', async () => {
  await entrarAdmin();
  assert.equal((await llamar('/api/estadisticas')).estado, 200);

  await crearUsuario('Gera', 'gerente', '7070');
  await entrarPorNombre('Gera', '7070');
  assert.equal((await llamar('/api/estadisticas')).estado, 200,
               'el gerente decide en su turno: necesita los números');

  await entrarAdmin();
  await crearUsuario('Caja', 'cajero', '7171');
  await entrarPorNombre('Caja', '7171');
  assert.equal((await llamar('/api/estadisticas')).estado, 403);
  assert.equal((await llamar('/api/estadisticas/meses')).estado, 403);
  await entrarAdmin();
});


// ============================================================
// LO QUE SE VENDIÓ
// ============================================================

test('una venta cancelada deja de sumar, y se cuenta aparte', async () => {
  await entrarAdmin();
  const v = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 500 } });
  const venta = v.json.datos.venta;

  const antes = await hoy();
  assert.equal(antes.ventas.tickets, 1);
  assert.equal(antes.ventas.centavos, venta.total_centavos);

  await llamar(`/api/ventas/${venta.id}/cancelar`, {
    method: 'POST', cuerpo: { motivo: 'Se equivocó el cliente' } });

  const despues = await hoy();
  assert.equal(despues.ventas.tickets, 0, 'ya no cuenta como venta');
  assert.equal(despues.ventas.centavos, 0);
  assert.equal(despues.ventas.canceladas.cuantas, 1, 'pero se sabe que la hubo');
  assert.equal(despues.ventas.canceladas.centavos, venta.total_centavos);
});

test('un cambio de ticket NO vende dos veces', async () => {
  await entrarAdmin();
  const v = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 8 }], pago: 500 } });
  const vieja = v.json.datos.venta;

  const antes = (await hoy()).ventas;

  // El cliente cambia media marqueta por un cuarto.
  const c = await llamar(`/api/ventas/${vieja.id}/cambiar`, {
    method: 'POST',
    cuerpo: { lineas: [{ dieciseisavos: 4 }], motivo: 'Le sobraba' } });
  assert.equal(c.estado, 201);
  const nueva = c.json.datos.venta;

  const despues = (await hoy()).ventas;
  assert.equal(despues.tickets, antes.tickets,
               'sigue habiendo un solo ticket vivo: el viejo quedó cancelado');
  assert.equal(despues.centavos, antes.centavos - vieja.total_centavos + nueva.total_centavos,
               'y el dinero es el del ticket nuevo, no la suma de los dos');
});

test('lo fiado se vendió pero no se cobró, y se dice por separado', async () => {
  await entrarAdmin();
  const cl = await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Doña Mary', limite: 5000 } });
  const cliente = cl.json.datos.cliente;

  const antes = (await hoy()).ventas;
  const v = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ dieciseisavos: 16 }], formaPago: 'credito', clienteId: cliente.id } });
  assert.equal(v.estado, 201);
  const total = v.json.datos.venta.total_centavos;

  const d = (await hoy()).ventas;
  assert.equal(d.centavos, antes.centavos + total, 'se vendió');
  assert.equal(d.fiado, antes.fiado + total, 'y se sabe que se fio');
  assert.equal(d.contado, d.centavos - d.fiado, 'lo contado es la resta, no otro número');
});


// ============================================================
// LO QUE SE PRODUJO
// ============================================================

test('la producción cuenta moldes, y separa los que salieron mal', async () => {
  await entrarAdmin();
  const t = (await llamar('/api/produccion/estado')).json.datos.tanques[0];
  const d1 = (await llamar(`/api/produccion/estado?tanque=${t.id}`)).json.datos;
  const pano = d1.tanque.siguiente;

  // Seis moldes: uno sale roto.
  const moldes = d1.tanque.panos.find((p) => p.id === pano.id)
    .canastas.flatMap((c) => c.moldes);
  await llamar(`/api/produccion/panos/${pano.id}/sacar`, {
    method: 'POST',
    cuerpo: { tipoAgua: 'purificada',
              resultados: [{ moldeId: moldes[0].id, resultado: 'merma' }] } });

  const p = (await hoy()).produccion;
  assert.equal(p.buenas, 5);
  assert.equal(p.rotas, 1);
  assert.equal(p.salieron, 6);
  assert.ok(Math.abs(p.porCientoBuenas - 83.3) < 0.2, `83.3% (${p.porCientoBuenas})`);
});

test('los paños fijados en la puesta en marcha no son producción', async () => {
  await entrarAdmin();
  const antes = (await hoy()).produccion.buenas;

  const t = (await llamar('/api/produccion/estado')).json.datos.tanques[0];
  const est = (await llamar(`/api/produccion/estado?tanque=${t.id}`)).json.datos;
  const virgen = est.tanque.panos.find((p) => p.canastas.every((c) => c.sinRegistro));
  assert.ok(virgen, 'hay un paño sin historia con qué probar');

  await llamar('/api/arranque/panos', {
    method: 'POST',
    cuerpo: { panos: [{ panoId: virgen.id, situacion: 'congelando',
                        desde: new Date(Date.now() - 3600 * 1000).toISOString() }] } });

  assert.equal((await hoy()).produccion.buenas, antes,
               'sembrar no fabrica marquetas: si contara, el costo por marqueta mentiría');
});


// ============================================================
// LO QUE SE FUE, Y EL COSTO POR MARQUETA
// ============================================================

test('un traspaso a la caja fuerte no es un gasto de la fábrica', async () => {
  await entrarAdmin();
  const { conceptos } = (await llamar('/api/caja/conceptos')).json.datos;
  const retiro = conceptos.find((c) => c.id === 'gasto-retiro');
  const gasolina = conceptos.find((c) => /gasolina/i.test(c.nombre));

  const antes = (await hoy()).gastos;
  await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', conceptoId: gasolina.id, monto: 200 } });
  await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', conceptoId: retiro.id, monto: 3000 } });

  const g = (await hoy()).gastos;
  assert.equal(g.gastado, antes.gastado + 20000, 'solo la gasolina es gasto');
  assert.equal(g.traspasado, antes.traspasado + 300000, 'el retiro se cuenta aparte');
  assert.ok(!g.porConcepto.some((x) => x.es_traspaso),
            'y no sale en la lista de "en qué se fue"');
});

test('el costo por marqueta es todo lo que costó entre lo que se produjo', async () => {
  await entrarAdmin();
  const d = await hoy();
  const c = d.costo;

  assert.equal(c.total, c.cajon + c.grandes + c.luz, 'el total es la suma de los tres');
  if (c.marquetas > 0) assert.equal(c.centavos, Math.round(c.total / c.marquetas));
  assert.equal(c.sinLaRaya, true, 'y el sistema declara que los sueldos no están aquí');
});

test('una compra que dura meses NO le carga todo al mes que se pagó', async () => {
  await entrarAdmin();
  const cs = (await llamar('/api/empresa/conceptos')).json.datos.conceptos;
  const amoniaco = cs.find((c) => /amoniaco/i.test(c.nombre));
  assert.equal(amoniaco.cada_dias, 90, 'de fábrica el amoniaco dura 90 días');

  // Un cilindro de $36,000 comprado el día 1 de este mes.
  const p = require('../src/lib/periodos').periodoDe();
  const r = await llamar('/api/empresa/gastos', {
    method: 'POST',
    cuerpo: { conceptoId: amoniaco.id, fecha: p.desde, cantidad: 1, monto: 36000 } });
  assert.equal(r.estado, 201);

  const c = (await hoy()).costo;

  // El mes de verdad pagó los $36,000 completos…
  assert.ok(c.delMes.total >= 3600000, 'el dinero salió entero');
  // …pero al costo de comparar solo le toca la parte de los días que
  // el cilindro pasó enfriando DENTRO de este mes.
  assert.ok(c.total < c.delMes.total,
            'repartido cuesta menos que de golpe: eso es justo el arreglo');
  const proporcion = c.grandes / 3600000;
  assert.ok(proporcion > 0.2 && proporcion < 0.5,
            `a un mes le toca ~un tercio de los 90 días (le tocó ${Math.round(proporcion * 100)}%)`);
  assert.equal(c.hayReparto, true);
  assert.ok(c.grandesPorConcepto.some((g) => g.repartido),
            'y se dice cuál se repartió, para poder explicarlo en la pantalla');
});

test('lo que no tiene ritmo va entero al mes en que pasó', async () => {
  await entrarAdmin();
  const cs = (await llamar('/api/empresa/conceptos')).json.datos.conceptos;
  const mant = cs.find((c) => /mantenimiento/i.test(c.nombre));
  assert.equal(mant.cada_dias, null, 'una compostura no se repite cada tantos días');

  const p = require('../src/lib/periodos').periodoDe();
  const antes = (await hoy()).costo.grandes;
  await llamar('/api/empresa/gastos', {
    method: 'POST', cuerpo: { conceptoId: mant.id, fecha: p.desde, monto: 5000 } });

  const despues = (await hoy()).costo.grandes;
  assert.equal(despues, antes + 500000,
               'entera: repartir una compostura que no se repite sería inventar');
});

test('el costo parejo no da saltos de un mes a otro por una sola compra', async () => {
  await entrarAdmin();
  const { meses } = (await llamar('/api/estadisticas/meses?cuantos=4')).json.datos;
  const conCosto = meses.filter((m) => m.costoPorMarqueta != null);
  if (conCosto.length < 2) return;   // sin datos suficientes no se puede juzgar

  // Ningún mes puede costar más del triple que el anterior solo porque
  // tocó comprar amoniaco: para eso está el reparto.
  for (let i = 1; i < conCosto.length; i++) {
    const razon = conCosto[i].costoPorMarqueta / conCosto[i - 1].costoPorMarqueta;
    assert.ok(razon < 3 && razon > 1 / 3,
              `${conCosto[i - 1].corto} → ${conCosto[i].corto} saltó ${razon.toFixed(1)}×`);
  }
});

test('sin producción el costo por marqueta no se inventa: sale nulo', async () => {
  await entrarAdmin();
  // Un mes viejo donde no hubo nada.
  const d = (await llamar('/api/estadisticas?periodo=2020-03')).json.datos;
  assert.equal(d.produccion.buenas, 0);
  assert.equal(d.costo.centavos, null, 'repartir entre cero no significa nada');
  assert.equal(d.costo.porMarqueta, null);
});

test('un mes al que le falta el recibo de luz se marca incompleto', async () => {
  await entrarAdmin();
  const d = await hoy();
  assert.equal(d.costo.completo, false, 'todavía no se ha capturado ningún recibo');
  assert.ok(d.costo.faltanDiasDeLuz > 0,
            'y dice cuántos días faltan, para que nadie crea que la luz fue gratis');
});


// ============================================================
// EL MES DEL NEGOCIO Y SUS ORILLAS
// ============================================================

test('el periodo respeta el día de corte del negocio', async () => {
  await entrarAdmin();
  await llamar('/api/empresa/periodos', { method: 'PUT', cuerpo: { diaCorte: 12 } });

  const d = (await llamar('/api/estadisticas?periodo=2026-08')).json.datos;
  assert.equal(d.periodo.desde, '2026-08-12');
  assert.equal(d.periodo.hasta, '2026-09-11');
  assert.equal(d.porDia.length, 31, 'un renglón por día, incluidos los vacíos');
  assert.equal(d.porDia[0].numero, 12, 'empieza el 12');
  assert.equal(d.porDia.at(-1).numero, 11, 'y acaba el 11');

  await llamar('/api/empresa/periodos', { method: 'PUT', cuerpo: { diaCorte: 1 } });
});

test('las orillas del mes: la última noche entra, la primera del siguiente no', async () => {
  await entrarAdmin();
  const p = require('../src/lib/periodos').periodoDe();

  const antes = (await llamar(`/api/estadisticas?periodo=${p.clave}`)).json.datos.ventas.centavos;

  // Dos ventas metidas a mano en las dos orillas exactas del periodo: es
  // justo donde un filtro mal hecho pierde una o cuenta la que no.
  const dentro = new Date(`${p.hasta}T23:59:59`).toISOString();
  const fuera = new Date(`${p.hasta}T23:59:59`);
  fuera.setSeconds(fuera.getSeconds() + 1);          // el primer instante del día siguiente

  bd.prepare(`INSERT INTO ventas (id, folio, fecha, total_centavos, forma_pago)
              VALUES ('v-dentro', 999999, ?, 12345, 'efectivo')`).run(dentro);
  bd.prepare(`INSERT INTO ventas (id, folio, fecha, total_centavos, forma_pago)
              VALUES ('v-fuera', 999998, ?, 777, 'efectivo')`).run(fuera.toISOString());

  const d = (await llamar(`/api/estadisticas?periodo=${p.clave}`)).json.datos;
  assert.equal(d.ventas.centavos, antes + 12345,
               'entró la de las 23:59:59 del último día, y NO la del segundo siguiente');

  bd.prepare("DELETE FROM ventas WHERE id IN ('v-dentro','v-fuera')").run();
});

test('un periodo que no se entiende se rechaza', async () => {
  await entrarAdmin();
  assert.equal((await llamar('/api/estadisticas?periodo=ayer')).estado, 400);
  assert.equal((await llamar('/api/estadisticas?periodo=2026-77')).estado, 400);
});


// ============================================================
// LA TENDENCIA
// ============================================================

test('los meses vienen del más viejo al más nuevo, como se lee una gráfica', async () => {
  await entrarAdmin();
  const { meses } = (await llamar('/api/estadisticas/meses?cuantos=6')).json.datos;
  assert.equal(meses.length, 6);
  for (let i = 1; i < meses.length; i++) {
    assert.ok(meses[i].clave > meses[i - 1].clave, `${meses[i].clave} va después`);
  }
  assert.ok(meses.at(-1).corto.length <= 7, 'la etiqueta cabe debajo de una barra');
});

test('no se pueden pedir cien años de un golpe', async () => {
  await entrarAdmin();
  const r = (await llamar('/api/estadisticas/meses?cuantos=500')).json.datos;
  assert.equal(r.meses.length, 24, 'se topa en 24: es una pantalla, no un reporte anual');
});


// ============================================================
// QUE NINGÚN PESO SE CUENTE DOS VECES  (v2.9.1)
// ============================================================

test('una factura pagada del cajón no cuenta en las dos bolsas', async () => {
  await entrarAdmin();
  const cs = (await llamar('/api/caja/conceptos')).json.datos.conceptos;
  const mantCaja = cs.find((c) => /mantenimiento/i.test(c.nombre));
  assert.ok(mantCaja, '"Mantenimiento" existe en la caja…');
  const ce = (await llamar('/api/empresa/conceptos')).json.datos.conceptos;
  const mantEmp = ce.find((c) => /mantenimiento/i.test(c.nombre));
  assert.ok(mantEmp, '…y también en las cuentas de la empresa: ahí está el riesgo');

  // El electricista cobra $3,000 en efectivo: el cajero lo anota.
  const mov = await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', conceptoId: mantCaja.id, monto: 3000 } });
  const movId = mov.json.datos.movimientoId;

  const conDoble = (await hoy()).gastos.gastado;

  // Y el administrador captura la factura del MISMO trabajo, diciendo de
  // qué salida del cajón salió.
  const p = require('../src/lib/periodos').periodoDe();
  await llamar('/api/empresa/gastos', {
    method: 'POST',
    cuerpo: { conceptoId: mantEmp.id, fecha: p.desde, monto: 3000, formaPago: 'efectivo' } });
  bd.prepare('UPDATE gastos_empresa SET movimiento_caja_id = ? WHERE movimiento_caja_id IS NULL AND centavos = 300000')
    .run(movId);

  const d = await hoy();
  assert.equal(d.gastos.gastado, conDoble - 300000,
    'la salida del cajón deja de contarse: manda la factura, que trae el papel');
  assert.ok(!d.gastos.porConcepto.some((g) => g.centavos === 300000 && /mantenimiento/i.test(g.nombre)),
    'y desaparece de "en qué se fue", para no salir dos veces con el mismo nombre');
});

test('sin amarrar, las dos siguen contando — y eso también se prueba', async () => {
  await entrarAdmin();
  const cs = (await llamar('/api/caja/conceptos')).json.datos.conceptos;
  const gasolina = cs.find((c) => /gasolina/i.test(c.nombre));

  const antes = (await hoy()).gastos.gastado;
  await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', conceptoId: gasolina.id, monto: 450 } });

  assert.equal((await hoy()).gastos.gastado, antes + 45000,
    'un gasto normal del cajón cuenta entero: el descuento es SOLO cuando hay factura amarrada');
});

test('quién sacó cuánto cuadra con las marquetas del mes', async () => {
  await entrarAdmin();
  const d = await hoy();
  const suma = d.porObrero.reduce((n, o) => n + o.marquetas, 0);
  assert.equal(suma, d.produccion.buenas,
    'los dos números salen de la misma fecha: si no cuadraran, uno de los dos mentiría');
});
