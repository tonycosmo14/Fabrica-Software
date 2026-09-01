/**
 * LAS CUENTAS DE LA EMPRESA  (v2.7)
 *
 * El dinero que NO pasa por el cajón: el amoniaco, la sal, los barriles de
 * aceite, la maquinaria y la luz. Lo importante que se prueba aquí:
 *
 *  · que no toca el arqueo del cajón, ni de lejos
 *  · que el mes se puede partir donde diga el dueño
 *  · que renombrar o dar de baja un concepto no borra ni parte la historia
 *  · que un recibo de la CFE no se puede capturar dos veces
 *  · que los papeles adjuntos van a "datos" y no dentro del programa
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, entrarPorNombre, crearUsuario, bd, carpeta, preparar } =
  fabricaDePrueba('empresa');

/** Un PDF de verdad: la firma de los primeros bytes es lo que se comprueba. */
const PDF = Buffer.concat([
  Buffer.from('%PDF-1.4\n'),
  Buffer.from('1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n')
]);
const comoDataUrl = (b, tipo) => `data:${tipo};base64,${b.toString('base64')}`;

let amoniaco;

preparar(async () => {
  amoniaco = (await llamar('/api/empresa/conceptos')).json.datos
    .conceptos.find((c) => /amoniaco/i.test(c.nombre));
});


// ============================================================
// EL MES DEL NEGOCIO
// ============================================================

test('de fábrica el mes es el del calendario', async () => {
  const r = (await llamar('/api/empresa/periodos')).json.datos;
  assert.equal(r.diaCorte, 1);
  assert.equal(r.actual.desde.slice(-2), '01');
  assert.ok(r.periodos.length >= 13, 'y vienen periodos para elegir');
});

test('el mes se puede partir del 12 al 12, como el recibo de luz', async () => {
  await entrarAdmin();
  const r = await llamar('/api/empresa/periodos', { method: 'PUT', cuerpo: { diaCorte: 12 } });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.diaCorte, 12);
  assert.equal(r.json.datos.actual.desde.slice(-2), '12');

  const ahora = (await llamar('/api/empresa/periodos')).json.datos;
  assert.ok(ahora.actual.fechas.includes('—'), 'y la pantalla dice de cuándo a cuándo va');
});

test('del 29 en adelante no vale: febrero no tiene esos días', async () => {
  await entrarAdmin();
  for (const diaCorte of [0, 29, 31, -1, 'doce', 2.5]) {
    const r = await llamar('/api/empresa/periodos', { method: 'PUT', cuerpo: { diaCorte } });
    assert.equal(r.estado, 400, String(diaCorte));
  }
  assert.equal((await llamar('/api/empresa/periodos')).json.datos.diaCorte, 12,
               'y lo que estaba puesto no se movió');
});


// ============================================================
// LOS GASTOS GRANDES
// ============================================================

test('el sistema arranca con los conceptos que nombró el dueño', async () => {
  const { conceptos } = (await llamar('/api/empresa/conceptos')).json.datos;
  const nombres = conceptos.map((c) => c.nombre.toLowerCase());
  for (const cual of ['amoniaco', 'sal', 'aceite']) {
    assert.ok(nombres.some((n) => n.includes(cual)), `falta ${cual}`);
  }
  assert.ok(conceptos.every((c) => c.unidad), 'y cada uno dice en qué se compra');
});

test('un gasto de la empresa NO toca el cajón, ni el arqueo del turno', async () => {
  await entrarAdmin();
  const antes = (await llamar('/api/caja')).json.datos;

  const r = await llamar('/api/empresa/gastos', {
    method: 'POST',
    cuerpo: { conceptoId: amoniaco.id, fecha: '2026-08-20', monto: 42000,
              cantidad: 2, proveedor: 'Gases del Sureste', factura: 'A-1234' }
  });
  assert.equal(r.estado, 201);

  const despues = (await llamar('/api/caja')).json.datos;
  assert.equal(despues.abierta?.esperado, antes.abierta?.esperado,
               'cuarenta y dos mil pesos no pueden salir del cajón de un cajero');
  assert.equal(despues.movimientos.length, antes.movimientos.length,
               'ni aparecer como un movimiento del turno');

  // Y tampoco en el historial de la caja, que es de lo que pasa en el cajón.
  const hist = (await llamar('/api/historial?desde=2020-01-01&limite=200')).json.datos;
  assert.ok(!hist.movimientos.some((m) => m.centavos === 4200000),
            'el historial de la caja es de la caja');
});

test('el concepto lo pone el catálogo, no quien llama', async () => {
  await entrarAdmin();
  const r = await llamar('/api/empresa/gastos', {
    method: 'POST',
    cuerpo: { conceptoId: amoniaco.id, concepto: 'lo que sea', fecha: '2026-08-21', monto: 100 }
  });
  const g = bd.prepare('SELECT * FROM gastos_empresa WHERE id = ?').get(r.json.datos.gasto.id);
  assert.equal(g.concepto, amoniaco.nombre);
  assert.equal(g.concepto_id, amoniaco.id);
  assert.equal(g.unidad, amoniaco.unidad, 'y hereda la unidad del catálogo');
});

test('el precio por unidad se calcula, no se guarda', async () => {
  await entrarAdmin();
  // Dos cilindros por $42,000 son $21,000 el cilindro.
  const { gastos } = (await llamar(
    `/api/empresa/gastos?concepto=${amoniaco.id}&limite=50`)).json.datos;
  const dos = gastos.find((g) => g.cantidad === 2);
  assert.equal(dos.porUnidad, 2100000, 'veintiún mil pesos el cilindro');

  const columnas = bd.prepare('PRAGMA table_info(gastos_empresa)').all().map((c) => c.name);
  assert.ok(!columnas.includes('por_unidad'),
            'no hay columna guardada: se desincronizaría al corregir la cantidad');
});

test('el resumen dice cuándo fue la última vez de cada cosa', async () => {
  await entrarAdmin();
  const { conceptos } = (await llamar('/api/empresa/resumen?periodo=2026-08')).json.datos;
  const a = conceptos.find((c) => c.id === amoniaco.id);

  assert.equal(a.ultima, '2026-08-21', 'la más reciente de todas');
  assert.ok(a.diasDesdeLaUltima !== null, 'y hace cuántos días fue');
  assert.equal(a.veces, 2, 'las dos compras del periodo');

  // "¿Hace cuánto que no compro sal?" — nunca, y lo dice.
  const sal = conceptos.find((c) => /sal/i.test(c.nombre));
  assert.equal(sal.ultima, null);
  assert.equal(sal.diasDesdeLaUltima, null);
});

test('la última compra se busca en TODA la historia, no solo en el mes que se mira', async () => {
  await entrarAdmin();
  // Un mes en el que no se compró amoniaco: la respuesta a "hace cuánto"
  // sigue siendo agosto, no "nunca".
  const { conceptos } = (await llamar('/api/empresa/resumen?periodo=2026-11')).json.datos;
  const a = conceptos.find((c) => c.id === amoniaco.id);
  assert.equal(a.veces, 0, 'en noviembre no se compró');
  assert.equal(a.ultima, '2026-08-21', 'pero la última vez sigue siendo agosto');
});

test('renombrar un concepto no parte la historia en dos', async () => {
  await entrarAdmin();
  const antes = (await llamar('/api/empresa/resumen?periodo=2026-08')).json.datos
    .conceptos.find((c) => c.id === amoniaco.id);

  await llamar(`/api/empresa/conceptos/${amoniaco.id}`, {
    method: 'PUT', cuerpo: { nombre: 'Amoniaco anhidro' } });

  const despues = (await llamar('/api/empresa/resumen?periodo=2026-08')).json.datos
    .conceptos.find((c) => c.id === amoniaco.id);
  assert.equal(despues.centavos, antes.centavos, 'sigue sumando lo mismo');
  assert.equal(despues.nombre, 'Amoniaco anhidro');

  // Y la factura de ayer sigue diciendo lo que decía (regla 3.5).
  const vieja = bd.prepare(
    'SELECT concepto FROM gastos_empresa WHERE concepto_id = ? ORDER BY fecha LIMIT 1'
  ).get(amoniaco.id);
  assert.equal(vieja.concepto, 'Amoniaco');
});

test('dar de baja un concepto no borra lo que ya se compró', async () => {
  await entrarAdmin();
  await llamar(`/api/empresa/conceptos/${amoniaco.id}`, {
    method: 'PUT', cuerpo: { activo: false } });

  const activos = (await llamar('/api/empresa/conceptos')).json.datos.conceptos;
  assert.ok(!activos.some((c) => c.id === amoniaco.id), 'ya no sale al capturar');

  const { conceptos } = (await llamar('/api/empresa/resumen?periodo=2026-08')).json.datos;
  const a = conceptos.find((c) => c.id === amoniaco.id);
  assert.ok(a && a.centavos > 0, 'una compra de agosto no desaparece porque hoy se deje de usar');

  const r = await llamar('/api/empresa/gastos', {
    method: 'POST', cuerpo: { conceptoId: amoniaco.id, fecha: '2026-08-22', monto: 100 } });
  assert.equal(r.estado, 409, 'y no se puede usar por accidente');

  await llamar(`/api/empresa/conceptos/${amoniaco.id}`, {
    method: 'PUT', cuerpo: { activo: true } });
});

test('anular un gasto lo saca de las cuentas sin borrarlo', async () => {
  await entrarAdmin();
  const r = await llamar('/api/empresa/gastos', {
    method: 'POST', cuerpo: { concepto: 'Compostura del compresor', fecha: '2026-08-23', monto: 5000 } });
  const id = r.json.datos.gasto.id;

  const antes = (await llamar('/api/empresa/resumen?periodo=2026-08')).json.datos.total.centavos;
  const a = await llamar(`/api/empresa/gastos/${id}/anular`, {
    method: 'POST', cuerpo: { motivo: 'Se capturó dos veces' } });
  assert.equal(a.estado, 200);

  const despues = (await llamar('/api/empresa/resumen?periodo=2026-08')).json.datos.total.centavos;
  assert.equal(despues, antes - 500000, 'deja de contar');
  assert.ok(bd.prepare('SELECT id FROM gastos_empresa WHERE id = ?').get(id), 'pero sigue ahí');
});

test('un gasto sin día, sin monto o con una fecha que no existe se rechaza', async () => {
  await entrarAdmin();
  const malos = [
    { concepto: 'X', monto: 100 },
    { concepto: 'X', fecha: '2026-08-20' },
    { concepto: 'X', fecha: '2026-02-31', monto: 100 },
    { concepto: 'X', fecha: 'el jueves', monto: 100 },
    { fecha: '2026-08-20', monto: 100 },
    { concepto: 'X', fecha: '2026-08-20', monto: 100, formaPago: 'trueque' }
  ];
  for (const cuerpo of malos) {
    const r = await llamar('/api/empresa/gastos', { method: 'POST', cuerpo });
    assert.equal(r.estado, 400, JSON.stringify(cuerpo));
  }
});


// ============================================================
// LOS RECIBOS DE LA LUZ
// ============================================================

test('un recibo de CFE se guarda con sus propias fechas', async () => {
  await entrarAdmin();
  const r = await llamar('/api/empresa/cfe', {
    method: 'POST',
    cuerpo: { desde: '2026-07-12', hasta: '2026-08-11', kwh: 8450, monto: 42350,
              numero: '123456789012' }
  });
  assert.equal(r.estado, 201);

  const rec = r.json.datos.recibo;
  assert.equal(rec.dias, 31);
  assert.equal(rec.centavosPorKwh, Math.round(4235000 / 8450), 'lo que costó el kilowatt');
  assert.equal(rec.kwhPorDia, Math.round(8450 / 31));
});

test('el mismo recibo no se puede capturar dos veces', async () => {
  await entrarAdmin();
  const r = await llamar('/api/empresa/cfe', {
    method: 'POST',
    cuerpo: { desde: '2026-07-12', hasta: '2026-08-11', kwh: 8450, monto: 42350 } });
  assert.equal(r.estado, 409, 'duplicaría el gasto del año y partiría en dos los kWh por marqueta');
  assert.match(r.json.error, /Ya hay un recibo/);
});

test('un recibo con fechas al revés o de medio año se rechaza', async () => {
  await entrarAdmin();
  const malos = [
    { desde: '2026-08-11', hasta: '2026-07-12', kwh: 100, monto: 100 },
    { desde: '2026-01-01', hasta: '2026-12-31', kwh: 100, monto: 100 },
    { desde: '2026-09-01', hasta: '2026-10-01', kwh: 0, monto: 100 },
    { desde: '2026-09-01', hasta: '2026-10-01', kwh: 100, monto: 0 },
    { desde: '2026-09-01', kwh: 100, monto: 100 }
  ];
  for (const cuerpo of malos) {
    const r = await llamar('/api/empresa/cfe', { method: 'POST', cuerpo });
    assert.equal(r.estado, 400, JSON.stringify(cuerpo));
  }
});

test('cada recibo se compara solo con el anterior', async () => {
  await entrarAdmin();
  await llamar('/api/empresa/cfe', {
    method: 'POST',
    cuerpo: { desde: '2026-08-12', hasta: '2026-09-11', kwh: 9200, monto: 48000 } });

  const { recibos } = (await llamar('/api/empresa/cfe')).json.datos;
  const nuevo = recibos.find((x) => x.desde === '2026-08-12');
  assert.ok(nuevo.contraElAnterior, 'hay con qué comparar');
  assert.equal(nuevo.contraElAnterior.kwh, 9200 - 8450);
  assert.ok(nuevo.contraElAnterior.porCiento > 0, 'y dice en cuánto por ciento subió');

  const primero = recibos.at(-1);
  assert.equal(primero.contraElAnterior, null, 'el primero no tiene con qué compararse');
});

test('los kilowatts por marqueta salen de la producción de ESE periodo', async () => {
  await entrarAdmin();
  const { recibos } = (await llamar('/api/empresa/cfe')).json.datos;
  for (const r of recibos) {
    if (r.marquetas > 0) {
      assert.equal(r.kwhPorMarqueta, Math.round((r.kwh / r.marquetas) * 100) / 100);
      assert.equal(r.centavosPorMarqueta, Math.round(r.centavos / r.marquetas));
    } else {
      assert.equal(r.kwhPorMarqueta, null, 'sin producción no se inventa el número');
      assert.equal(r.centavosPorMarqueta, null);
    }
  }
});

test('anular un recibo lo saca de las cuentas y libera su periodo', async () => {
  await entrarAdmin();
  const { recibos } = (await llamar('/api/empresa/cfe')).json.datos;
  const uno = recibos.find((r) => r.desde === '2026-08-12');

  await llamar(`/api/empresa/cfe/${uno.id}/anular`, {
    method: 'POST', cuerpo: { motivo: 'Los kilowatts estaban mal' } });

  const vivos = (await llamar('/api/empresa/cfe')).json.datos.recibos;
  assert.ok(!vivos.some((r) => r.id === uno.id), 'deja de contar');

  // Y ahora sí se puede capturar bien el mismo periodo.
  const otra = await llamar('/api/empresa/cfe', {
    method: 'POST',
    cuerpo: { desde: '2026-08-12', hasta: '2026-09-11', kwh: 9100, monto: 47000 } });
  assert.equal(otra.estado, 201, 'el índice único no cuenta los anulados');
});


// ============================================================
// LOS PAPELES ADJUNTOS
// ============================================================

test('el PDF de un recibo se guarda en datos, no dentro del programa', async () => {
  await entrarAdmin();
  const r = await llamar('/api/empresa/cfe', {
    method: 'POST',
    cuerpo: { desde: '2026-09-12', hasta: '2026-10-11', kwh: 7800, monto: 39000,
              archivo: comoDataUrl(PDF, 'application/pdf') } });
  assert.equal(r.estado, 201);

  const guardado = path.join(carpeta, 'empresa', r.json.datos.recibo.archivo);
  assert.ok(fs.existsSync(guardado), 'está en datos/empresa');
  assert.ok(guardado.endsWith('.pdf'));
  // Ahí sobrevive a una actualización por ZIP, que reemplaza src y public.
  assert.ok(!guardado.includes('/public/') && !guardado.includes('/src/'));

  const servido = await llamar(`/api/empresa/cfe/${r.json.datos.recibo.id}/archivo`);
  assert.equal(servido.estado, 200);
  assert.equal(servido.cabeceras.get('content-type'), 'application/pdf');
  assert.match(servido.cabeceras.get('content-security-policy'), /default-src 'none'/);
});

test('un archivo que no es lo que dice ser se rechaza', async () => {
  await entrarAdmin();
  const malos = [
    comoDataUrl(Buffer.from('MZ\x90\x00 esto es un ejecutable'), 'application/pdf'),
    comoDataUrl(PDF, 'application/x-msdownload'),
    'no soy un data url',
    comoDataUrl(Buffer.alloc(0), 'application/pdf')
  ];
  for (const archivo of malos) {
    const r = await llamar('/api/empresa/cfe', {
      method: 'POST',
      cuerpo: { desde: '2027-01-01', hasta: '2027-02-01', kwh: 100, monto: 100, archivo } });
    assert.equal(r.estado, 400, String(archivo).slice(0, 40));
  }
});

test('un recibo que no existe no sirve ningún archivo', async () => {
  await entrarAdmin();
  assert.equal((await llamar('/api/empresa/cfe/no-existe/archivo')).estado, 404);
  assert.equal((await llamar('/api/empresa/gastos/no-existe/archivo')).estado, 404);
});


// ============================================================
// BORRAR UN CONCEPTO DE LA LISTA Y CORREGIR UN RECIBO  (v2.7.1)
// ============================================================

test('eliminar un concepto lo esconde, pero si tiene compras en el mes su renglón se queda', async () => {
  await entrarAdmin();
  const alta = await llamar('/api/empresa/conceptos', {
    method: 'POST', cuerpo: { nombre: 'Compresor viejo', unidad: 'pieza' } });
  const id = alta.json.datos.concepto.id;

  await llamar('/api/empresa/gastos', {
    method: 'POST',
    cuerpo: { conceptoId: id, fecha: '2026-08-20', cantidad: 1, monto: 500 } });

  const r = await llamar(`/api/empresa/conceptos/${id}/eliminar`, { method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 200);

  const lista = (await llamar('/api/empresa/conceptos?todos=1')).json.datos.conceptos;
  assert.ok(!lista.some((c) => c.id === id), 'ya no sale en el catálogo');

  // En el mes de la compra su renglón sigue, para que la tabla cuadre.
  await llamar('/api/empresa/periodos', { method: 'PUT', cuerpo: { diaCorte: 12 } });
  const agosto = (await llamar('/api/empresa/resumen?periodo=2026-08')).json.datos;
  const fila = agosto.conceptos.find((c) => c.id === id);
  assert.ok(fila, 'la compra de agosto sigue sumando en agosto');
  assert.equal(fila.centavos, 50000);

  // En un mes donde no compró nada, ya no aparece.
  const dic = (await llamar('/api/empresa/resumen?periodo=2026-12')).json.datos;
  assert.ok(!dic.conceptos.some((c) => c.id === id));
});

test('corregir un recibo anula el viejo y guarda el bueno de un solo golpe', async () => {
  await entrarAdmin();
  const alta = await llamar('/api/empresa/cfe', {
    method: 'POST',
    cuerpo: { desde: '2026-11-12', hasta: '2026-12-11', kwh: 9000, monto: 46000 } });
  assert.equal(alta.estado, 201);
  const viejo = alta.json.datos.recibo;

  // Los kilowatts estaban mal tecleados: se corrige el número, no el papel.
  const r = await llamar(`/api/empresa/cfe/${viejo.id}`, {
    method: 'PUT',
    cuerpo: { desde: '2026-11-12', hasta: '2026-12-11', kwh: 9500, monto: 46000,
              notas: 'kWh corregidos' } });
  assert.equal(r.estado, 200);
  const nuevo = r.json.datos.recibo;
  assert.notEqual(nuevo.id, viejo.id, 'es un renglón nuevo (regla 3.2)');
  assert.equal(nuevo.kwh, 9500);

  const muerto = bd.prepare('SELECT * FROM recibos_cfe WHERE id = ?').get(viejo.id);
  assert.ok(muerto.anulado_en, 'el viejo queda anulado, no borrado');
  assert.match(muerto.motivo_anulacion, /Corregido/);

  // El periodo NO queda duplicado: vivo solo hay uno.
  const vivos = bd.prepare(
    "SELECT COUNT(*) n FROM recibos_cfe WHERE desde = '2026-11-12' AND anulado_en IS NULL"
  ).get().n;
  assert.equal(vivos, 1);
});

test('la corrección no puede chocar con otro recibo vivo', async () => {
  await entrarAdmin();
  const { recibos } = (await llamar('/api/empresa/cfe')).json.datos;
  const sept = recibos.find((x) => x.desde === '2026-11-12');
  const julio = recibos.find((x) => x.desde === '2026-07-12');
  assert.ok(sept && julio, 'hay dos recibos vivos con qué probar');

  const r = await llamar(`/api/empresa/cfe/${sept.id}`, {
    method: 'PUT',
    cuerpo: { desde: julio.desde, hasta: julio.hasta, kwh: 1, monto: 1 } });
  assert.equal(r.estado, 409, 'duplicaría el periodo de julio');
});

test('la corrección hereda el papel adjunto si no mandan otro', async () => {
  await entrarAdmin();
  const alta = await llamar('/api/empresa/cfe', {
    method: 'POST',
    cuerpo: { desde: '2026-10-12', hasta: '2026-11-11', kwh: 8000, monto: 40000,
              archivo: comoDataUrl(PDF, 'application/pdf') } });
  assert.equal(alta.estado, 201);
  const viejo = alta.json.datos.recibo;
  assert.ok(viejo.archivo);

  const r = await llamar(`/api/empresa/cfe/${viejo.id}`, {
    method: 'PUT',
    cuerpo: { desde: '2026-10-12', hasta: '2026-11-11', kwh: 8100, monto: 40000 } });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.recibo.archivo, viejo.archivo,
               'el PDF del recibo sigue siendo el mismo papel');

  const servido = await llamar(`/api/empresa/cfe/${r.json.datos.recibo.id}/archivo`);
  assert.equal(servido.estado, 200, 'y se sirve desde el renglón nuevo');
});


// ============================================================
// LA LUZ DENTRO DEL MES DEL NEGOCIO
// ============================================================

test('cuando el recibo cae justo en el mes, la luz se dice tal cual', async () => {
  await entrarAdmin();
  // Del 12 al 12 es exactamente como viene el recibo de esta fábrica.
  await llamar('/api/empresa/periodos', { method: 'PUT', cuerpo: { diaCorte: 12 } });

  const d = (await llamar('/api/empresa/resumen?periodo=2026-08')).json.datos;
  assert.equal(d.periodo.desde, '2026-08-12');
  assert.equal(d.periodo.hasta, '2026-09-11');

  assert.equal(d.luz.centavos, 4700000, 'el número del papel, sin repartir');
  assert.equal(d.luz.completo, true, 'todos los días del mes tienen recibo');
  assert.equal(d.luz.recibos.length, 1);
  assert.equal(d.luz.recibos[0].entero, true, 'no hubo que repartirlo');

  assert.equal(d.conLuz.centavos, d.total.centavos + d.luz.centavos,
               'lo grande del mes es las compras MÁS la luz');
});

test('cuando el recibo no cae en el mes, la luz se reparte por días', async () => {
  await entrarAdmin();
  // Con el mes del calendario, el recibo del 12 al 12 queda a caballo.
  await llamar('/api/empresa/periodos', { method: 'PUT', cuerpo: { diaCorte: 1 } });

  const d = (await llamar('/api/empresa/resumen?periodo=2026-08')).json.datos;
  assert.equal(d.periodo.desde, '2026-08-01');
  assert.equal(d.periodo.hasta, '2026-08-31');

  assert.equal(d.luz.recibos.length, 2, 'agosto lo cubren dos recibos, medio y medio');
  assert.ok(d.luz.recibos.every((r) => !r.entero), 'de los dos solo se toma un pedazo');

  // Once días del recibo viejo y veinte del nuevo, cada uno a su precio.
  const viejo = Math.round((4235000 / 31) * 11);
  const nuevo = Math.round((4700000 / 31) * 20);
  assert.equal(d.luz.centavos, viejo + nuevo);
  assert.equal(d.luz.dias, 31);
  assert.equal(d.luz.completo, true);
});

test('un mes sin recibo dice que le falta, en vez de decir cero y ya', async () => {
  await entrarAdmin();
  await llamar('/api/empresa/periodos', { method: 'PUT', cuerpo: { diaCorte: 1 } });

  // Marzo del año que entra no tiene recibo capturado: es lo normal.
  // (Diciembre ya no sirve de ejemplo: la prueba de corregir capturó un
  // recibo que le pisa once días.)
  const d = (await llamar('/api/empresa/resumen?periodo=2027-03')).json.datos;
  assert.equal(d.luz.centavos, 0);
  assert.equal(d.luz.dias, 0);
  assert.equal(d.luz.completo, false, 'para que la pantalla avise que va a subir');
  assert.equal(d.luz.diasDelPeriodo, 31);
});

test('un recibo anulado deja de contar en la luz del mes', async () => {
  await entrarAdmin();
  await llamar('/api/empresa/periodos', { method: 'PUT', cuerpo: { diaCorte: 12 } });

  const antes = (await llamar('/api/empresa/resumen?periodo=2026-08')).json.datos;
  assert.ok(antes.luz.centavos > 0);

  const cual = antes.luz.recibos[0].id;
  await llamar(`/api/empresa/cfe/${cual}/anular`, {
    method: 'POST', cuerpo: { motivo: 'Era el recibo del vecino' } });

  const despues = (await llamar('/api/empresa/resumen?periodo=2026-08')).json.datos;
  assert.equal(despues.luz.centavos, 0);
  assert.equal(despues.luz.completo, false);
  assert.equal(despues.conLuz.centavos, despues.total.centavos);

  // Se vuelve a capturar para no dejarle el destrozo a las pruebas de abajo.
  await llamar('/api/empresa/cfe', {
    method: 'POST',
    cuerpo: { desde: '2026-08-12', hasta: '2026-09-11', kwh: 9100, monto: 47000 } });
});


// ============================================================
// QUIÉN ENTRA
// ============================================================

test('el gerente ve las cuentas pero no las captura', async () => {
  await entrarAdmin();
  await crearUsuario('Rosa', 'gerente', '9090');
  await entrarPorNombre('Rosa', '9090');

  assert.equal((await llamar('/api/empresa/resumen')).estado, 200, 'las ve');
  assert.equal((await llamar('/api/empresa/cfe')).estado, 200);

  const gasto = await llamar('/api/empresa/gastos', {
    method: 'POST', cuerpo: { concepto: 'X', fecha: '2026-08-20', monto: 100 } });
  assert.equal(gasto.estado, 403, 'son facturas de decenas de miles: no es trabajo de turno');

  const mes = await llamar('/api/empresa/periodos', { method: 'PUT', cuerpo: { diaCorte: 5 } });
  assert.equal(mes.estado, 403);
});

test('un cajero no entra aquí', async () => {
  await entrarAdmin();
  await crearUsuario('Beto', 'cajero', '9191');
  await entrarPorNombre('Beto', '9191');

  for (const ruta of ['/api/empresa/resumen', '/api/empresa/cfe', '/api/empresa/periodos',
                      '/api/empresa/conceptos', '/api/empresa/gastos']) {
    assert.equal((await llamar(ruta)).estado, 403, ruta);
  }
  await entrarAdmin();
});
