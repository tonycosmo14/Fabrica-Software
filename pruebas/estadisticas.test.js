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
  assert.equal(p.alAlmacen, 5);
  assert.equal(p.producidas, 5);
  assert.equal(p.rotas, 1);
  assert.equal(p.salieron, 6);
  assert.equal(p.normal, 5, 'sin decir nada, el hielo sale normal');
  assert.equal(p.porCientoSinQueja, 100,
    'cinco normales de cinco producidas: nadie se queja de ninguna');
});

test('los paños fijados en la puesta en marcha no son producción', async () => {
  await entrarAdmin();
  const antes = (await hoy()).produccion.alAlmacen;

  const t = (await llamar('/api/produccion/estado')).json.datos.tanques[0];
  const est = (await llamar(`/api/produccion/estado?tanque=${t.id}`)).json.datos;
  const virgen = est.tanque.panos.find((p) => p.canastas.every((c) => c.sinRegistro));
  assert.ok(virgen, 'hay un paño sin historia con qué probar');

  await llamar('/api/arranque/panos', {
    method: 'POST',
    cuerpo: { panos: [{ panoId: virgen.id, situacion: 'congelando',
                        desde: new Date(Date.now() - 3600 * 1000).toISOString() }] } });

  assert.equal((await hoy()).produccion.alAlmacen, antes,
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
  // LA RAYA YA ESTÁ AQUÍ (v4.8). Hasta la v4.7 este número decía
  // expresamente que le faltaba lo más caro después de la luz, porque no
  // había dónde anotar los sueldos.
  assert.equal(c.sinLaRaya, false);
  assert.equal(typeof c.rayaCentavos, 'number', 'y dice cuánto fue de sueldos');
});

test('una compra que dura meses NO le carga todo al mes que se pagó', async () => {
  // EL RITMO SE MIDE, NO SE PREGUNTA (v3.5). Entre un cilindro de amoniaco
  // y el siguiente pueden pasar quince días o dos años, así que preguntar
  // "cada cuántos días se compra" era pedir una adivinanza y después
  // creérsela. Ahora sale de las compras que ya hay: con dos, el sistema
  // sabe cuánto duró una.
  await entrarAdmin();
  const cs = (await llamar('/api/empresa/conceptos')).json.datos.conceptos;
  const amoniaco = cs.find((c) => /amoniaco/i.test(c.nombre));

  const p = require('../src/lib/periodos').periodoDe();
  const noventaAntes = new Date(`${p.desde}T12:00:00`);
  noventaAntes.setDate(noventaAntes.getDate() - 90);
  const comoDia = (d) => d.toISOString().slice(0, 10);

  // La compra anterior, hace noventa días: es la que enseña el ritmo.
  await llamar('/api/empresa/gastos', {
    method: 'POST',
    cuerpo: { conceptoId: amoniaco.id, fecha: comoDia(noventaAntes),
              cantidad: 1, monto: 36000 } });

  // Y la de este mes, el día 1.
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
  assert.equal(c.hayReparto, true);

  // Y el ritmo que usó es el MEDIDO, no uno escrito a mano.
  const despues = (await llamar('/api/empresa/conceptos')).json.datos.conceptos;
  const a2 = (await llamar(`/api/empresa/resumen?periodo=${p.clave}`)).json.datos
    .conceptos.find((x) => x.id === amoniaco.id);
  assert.equal(a2.ritmoReal, 90, 'noventa días entre una compra y la otra');
  assert.ok(despues.length, 'y el catálogo sigue entero');
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
  assert.equal(d.produccion.producidas, 0);
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
  assert.equal(suma, d.produccion.alAlmacen,
    'los dos números salen de la misma fecha: si no cuadraran, uno de los dos mentiría');
});

// ============================================================
// LA LUZ, DESARMADA  (v4.6)
//
// "Necesito poder observar de manera clara si estamos consumiendo más luz
//  y produciendo menos, o es lo mismo y el precio de la luz está
//  aumentando."
//
// Son tres preguntas distintas dentro de un solo recibo más caro, y juntas
// no se contestan. Lo que se prueba es que salgan separadas y que cada una
// se mueva por su lado.
// ============================================================

test('la luz se parte en consumo, precio y kilowatts por marqueta', async () => {
  await entrarAdmin();
  const p = (await llamar('/api/estadisticas')).json.datos.periodo;

  const r = await llamar('/api/empresa/cfe', {
    method: 'POST',
    cuerpo: { desde: p.desde, hasta: p.hasta, kwh: 20000, monto: '60000.00' }
  });
  assert.equal(r.estado, 201);

  const d = (await llamar('/api/estadisticas')).json.datos;
  const l = d.luzPorMarqueta;

  assert.equal(l.kwh, 20000, 'los kilowatts del recibo');
  assert.equal(l.centavos, 6000000, 'y su importe');
  assert.equal(l.centavosPorKwh, 300, '$3 el kilowatt: eso lo pone la CFE');

  if (l.marquetas > 0) {
    // El número que NO se puede leer en el papel del recibo: cuánta luz
    // cuesta hacer una marqueta. Si sube, es la máquina, no la CFE.
    assert.equal(l.kwhPorMarqueta, Number((20000 / l.marquetas).toFixed(2)));
    assert.equal(l.centavosPorMarqueta, Math.round(6000000 / l.marquetas));
  } else {
    assert.equal(l.kwhPorMarqueta, null, 'sin producción no se inventa el número');
  }
});

test('sin recibos capturados no se inventa un precio del kilowatt', async () => {
  const d = (await llamar('/api/estadisticas?periodo=2020-01')).json.datos;
  assert.equal(d.luzPorMarqueta.kwh, 0);
  assert.equal(d.luzPorMarqueta.centavosPorKwh, null,
    'dividir entre cero kilowatts no significa nada');
});

test('la tendencia trae la luz mes a mes, con sus dos números', async () => {
  const { meses } = (await llamar('/api/estadisticas/meses?cuantos=3')).json.datos;
  assert.ok(meses.length >= 2);
  for (const m of meses) {
    assert.ok('luzKwh' in m && 'luzCentavosPorKwh' in m && 'luzKwhPorMarqueta' in m,
      'las tres, para poder dibujar cada una por su lado');
  }
});

// ============================================================
// QUIÉN COMPRA MÁS  (v4.6)
// ============================================================

test('los clientes salen del que más se lleva al que menos', async () => {
  await entrarAdmin();
  const grande = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Hotel Maya' } })).json.datos.cliente;
  const chico = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Tiendita de la esquina' } })).json.datos.cliente;

  await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 5 * 16 }], clienteId: grande.id, pago: 5000 } });
  await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], clienteId: chico.id, pago: 500 } });
  // Y una del mostrador, sin nombre: no debe aparecer.
  await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 8 * 16 }], pago: 5000 } });

  const lista = (await llamar('/api/estadisticas')).json.datos.porCliente;
  assert.ok(lista.length >= 2);
  assert.equal(lista[0].nombre, 'Hotel Maya', 'el que más se llevó, primero');
  assert.ok(lista[0].centavos > lista[1].centavos);
  assert.equal(lista[0].marquetas, 5);
  assert.ok(!lista.some((c) => !c.nombre),
    'el mostrador de a cuarto no tiene dueño y no entra');
});

// ============================================================
// EL ORDEN DE LA HOJA  (v4.6)
// ============================================================

test('el orden de los apartados se guarda en la fábrica', async () => {
  const r = await llamar('/api/estadisticas/orden', {
    method: 'PUT', cuerpo: { orden: ['luz', 'clientes', 'resumen'] } });
  assert.equal(r.estado, 200);
  assert.deepEqual(r.json.datos.orden, ['luz', 'clientes', 'resumen']);

  // Y viaja con los números, para que la pantalla lo pinte así al entrar.
  assert.deepEqual((await llamar('/api/estadisticas')).json.datos.orden,
    ['luz', 'clientes', 'resumen']);
});

test('el orden se limpia de repetidos y de basura', async () => {
  const r = await llamar('/api/estadisticas/orden', {
    method: 'PUT',
    cuerpo: { orden: ['luz', 'luz', '  ', '<script>', 'clientes'] } });
  assert.equal(r.estado, 200);
  assert.deepEqual(r.json.datos.orden, ['luz', 'clientes']);
});

test('un orden vacío no se guarda: dejaría la hoja sin nada', async () => {
  const r = await llamar('/api/estadisticas/orden', { method: 'PUT', cuerpo: { orden: [] } });
  assert.equal(r.estado, 400);
});
