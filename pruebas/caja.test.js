/**
 * PRUEBAS DE LA CAJA  (v0.9)
 *
 *     fondo + cobrado en efectivo + entradas − salidas = DEBERÍA HABER
 *     debería haber − contado = DIFERENCIA
 *
 * Lo que se comprueba es lo que puede costar dinero:
 *
 *  · que el dinero se calcule de los movimientos, nunca de un saldo guardado
 *  · que solo pueda haber un turno abierto
 *  · que las ventas se peguen solas al turno
 *  · que una venta cancelada deje de contar
 *  · que un corte cerrado no cambie nunca más
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, entrarPorNombre, crearUsuario, bd, preparar } = fabricaDePrueba('caja');


/** Vende una marqueta ($264) en efectivo. */
async function venderUnaMarqueta(extra = {}) {
  const r = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], ...extra }
  });
  return r.json.datos?.venta;
}

/** Cierra cualquier turno que haya quedado abierto de una prueba anterior. */
async function cerrarSiHayAbierto() {
  const { json } = await llamar('/api/caja');
  if (json.datos?.abierta) {
    await llamar('/api/caja/cerrar', {
      method: 'POST', cuerpo: { contado: json.datos.abierta.esperado / 100 }
    });
  }
}

preparar(async () => {
  await llamar('/api/usuarios', { method: 'POST', cuerpo: { nombre: 'Rosa', rol: 'cajero', pin: '4444' } });
  await llamar('/api/usuarios', { method: 'POST', cuerpo: { nombre: 'Mari', rol: 'gerente', pin: '7777' } });
  await llamar('/api/usuarios', { method: 'POST', cuerpo: { nombre: 'Chema', rol: 'operario', pin: '5555' } });
});

// ============================================================
// ABRIR Y CERRAR
// ============================================================

test('al principio no hay ningún turno abierto', async () => {
  const { json } = await llamar('/api/caja');
  assert.equal(json.datos.abierta, null);
});

test('se puede cobrar sin turno abierto, pero esa venta no entra en ningún corte', async () => {
  const v = await venderUnaMarqueta();
  assert.ok(v, 'la venta se registró igual');

  const guardada = bd.prepare('SELECT caja_id FROM ventas WHERE id = ?').get(v.id);
  assert.equal(guardada.caja_id, null);

  // Y la pantalla de venta tiene que avisarlo.
  const ctx = await llamar('/api/ventas/contexto');
  assert.equal(ctx.json.datos.caja, null);
});

test('abrir el turno con su fondo', async () => {
  const r = await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 500 } });
  assert.equal(r.estado, 201);

  const e = r.json.datos.abierta;
  assert.equal(e.fondo, 50000);      // $500 en centavos
  assert.equal(e.vendido, 0);        // la venta de antes no cuenta
  assert.equal(e.esperado, 50000);
});

test('SOLO puede haber un turno abierto a la vez', async () => {
  const r = await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 100 } });
  assert.equal(r.estado, 409);
  assert.match(r.json.error, /ya hay un turno/i);
});

test('las ventas se pegan solas al turno abierto', async () => {
  const v = await venderUnaMarqueta();
  const guardada = bd.prepare('SELECT caja_id FROM ventas WHERE id = ?').get(v.id);
  assert.ok(guardada.caja_id, 'la venta quedó amarrada al turno');

  const { json } = await llamar('/api/caja');
  assert.equal(json.datos.abierta.vendido, 26400);
  assert.equal(json.datos.abierta.esperado, 50000 + 26400);
  assert.equal(json.datos.abierta.ventas.cobradas, 1);

  // Y la pantalla de venta ya ve el turno.
  const ctx = await llamar('/api/ventas/contexto');
  assert.ok(ctx.json.datos.caja);
});

// ============================================================
// GASTOS Y RETIROS
// ============================================================

test('un gasto baja lo que debería haber en el cajón', async () => {
  const r = await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', concepto: 'Gasolina', monto: 200 }
  });
  assert.equal(r.estado, 201);

  const e = r.json.datos.abierta;
  assert.equal(e.salidas, 20000);
  assert.equal(e.esperado, 50000 + 26400 - 20000);
});

test('una entrada lo sube', async () => {
  const r = await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'entrada', concepto: 'Cambio del banco', monto: 300 }
  });
  const e = r.json.datos.abierta;
  assert.equal(e.entradas, 30000);
  assert.equal(e.esperado, 50000 + 26400 - 20000 + 30000);
});

test('un movimiento sin concepto o sin monto se rechaza', async () => {
  const sinConcepto = await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', monto: 50 }
  });
  assert.equal(sinConcepto.estado, 400);

  const sinMonto = await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', concepto: 'Algo' }
  });
  assert.equal(sinMonto.estado, 400);

  const enCero = await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', concepto: 'Nada', monto: 0 }
  });
  assert.equal(enCero.estado, 400);

  const tipoRaro = await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'prestamo', concepto: 'Algo', monto: 50 }
  });
  assert.equal(tipoRaro.estado, 400);
});

test('anular un movimiento lo saca de la cuenta sin borrarlo', async () => {
  const antes = (await llamar('/api/caja')).json.datos;
  const mov = antes.movimientos.find((m) => m.concepto === 'Cambio del banco');

  const r = await llamar(`/api/caja/movimientos/${mov.id}/anular`, {
    method: 'POST', cuerpo: { motivo: 'Se anotó dos veces' }
  });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.abierta.entradas, 0);

  // Sigue existiendo, solo que marcado.
  const guardado = bd.prepare('SELECT * FROM movimientos_caja WHERE id = ?').get(mov.id);
  assert.ok(guardado);
  assert.ok(guardado.anulado_en);
  assert.equal(guardado.motivo_anulacion, 'Se anotó dos veces');
});

test('anular exige motivo y no se puede anular dos veces', async () => {
  const { json } = await llamar('/api/caja');
  const mov = json.datos.movimientos.find((m) => m.concepto === 'Gasolina');

  const sinMotivo = await llamar(`/api/caja/movimientos/${mov.id}/anular`, {
    method: 'POST', cuerpo: {}
  });
  assert.equal(sinMotivo.estado, 400);

  await llamar(`/api/caja/movimientos/${mov.id}/anular`, {
    method: 'POST', cuerpo: { motivo: 'Prueba' }
  });
  const otra = await llamar(`/api/caja/movimientos/${mov.id}/anular`, {
    method: 'POST', cuerpo: { motivo: 'Otra vez' }
  });
  assert.equal(otra.estado, 400);
});

// ============================================================
// UNA VENTA CANCELADA DEJA DE CONTAR
// ============================================================

test('cancelar una venta baja lo que debería haber en el cajón', async () => {
  const v = await venderUnaMarqueta();
  const conVenta = (await llamar('/api/caja')).json.datos.abierta;

  await llamar(`/api/ventas/${v.id}/cancelar`, {
    method: 'POST', cuerpo: { motivo: 'El cliente se arrepintió' }
  });

  const sinVenta = (await llamar('/api/caja')).json.datos.abierta;
  assert.equal(sinVenta.esperado, conVenta.esperado - 26400);
  assert.equal(sinVenta.ventas.canceladas, 1);
});

// ============================================================
// EL CORTE
// ============================================================

test('el corte dice cuánto sobra o falta', async () => {
  const antes = (await llamar('/api/caja')).json.datos.abierta;

  // Se cuenta $100 menos de lo que debería haber.
  const faltante = (antes.esperado - 10000) / 100;
  const r = await llamar('/api/caja/cerrar', { method: 'POST', cuerpo: { contado: faltante } });
  assert.equal(r.estado, 200);

  const c = r.json.datos.corte.caja;
  assert.equal(c.esperado_centavos, antes.esperado);
  assert.equal(c.contado_centavos, antes.esperado - 10000);
  assert.equal(c.diferencia_centavos, -10000);
  assert.ok(c.cerrada_en);
});

test('cerrado el turno, ya no hay ninguno abierto', async () => {
  const { json } = await llamar('/api/caja');
  assert.equal(json.datos.abierta, null);
  assert.ok(json.datos.ultimoCorte);
});

test('no se puede cerrar ni mover dinero sin turno abierto', async () => {
  const cierre = await llamar('/api/caja/cerrar', { method: 'POST', cuerpo: { contado: 100 } });
  assert.equal(cierre.estado, 409);

  const mov = await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', concepto: 'Algo', monto: 10 }
  });
  assert.equal(mov.estado, 409);
});

/**
 * ESTA ES LA PRUEBA IMPORTANTE DEL MÓDULO.
 * Un corte firmado es un papel firmado: no puede cambiar solo.
 */
test('un corte cerrado NO cambia aunque después se cancele una venta suya', async () => {
  const corte = bd.prepare('SELECT * FROM cajas WHERE cerrada_en IS NOT NULL ORDER BY cerrada_en DESC LIMIT 1').get();
  const venta = bd.prepare(
    'SELECT * FROM ventas WHERE caja_id = ? AND cancelada_en IS NULL LIMIT 1'
  ).get(corte.id);
  assert.ok(venta, 'hay una venta de ese turno para cancelar');

  await llamar(`/api/ventas/${venta.id}/cancelar`, {
    method: 'POST', cuerpo: { motivo: 'Cancelada al día siguiente' }
  });

  const despues = bd.prepare('SELECT * FROM cajas WHERE id = ?').get(corte.id);
  assert.equal(despues.vendido_centavos, corte.vendido_centavos);
  assert.equal(despues.esperado_centavos, corte.esperado_centavos);
  assert.equal(despues.diferencia_centavos, corte.diferencia_centavos);
});

test('un movimiento de un turno ya cerrado no se puede anular', async () => {
  const mov = bd.prepare(`
    SELECT m.id FROM movimientos_caja m
      JOIN cajas c ON c.id = m.caja_id
     WHERE c.cerrada_en IS NOT NULL AND m.anulado_en IS NULL LIMIT 1
  `).get();

  if (mov) {
    const r = await llamar(`/api/caja/movimientos/${mov.id}/anular`, {
      method: 'POST', cuerpo: { motivo: 'Ya no se puede' }
    });
    assert.equal(r.estado, 409);
  }
});

test('el folio del turno es consecutivo y no se repite', async () => {
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 0 } });
  const a = (await llamar('/api/caja')).json.datos.abierta.caja.folio;
  await llamar('/api/caja/cerrar', { method: 'POST', cuerpo: { contado: 0 } });

  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 0 } });
  const b = (await llamar('/api/caja')).json.datos.abierta.caja.folio;
  await llamar('/api/caja/cerrar', { method: 'POST', cuerpo: { contado: 0 } });

  assert.equal(b, a + 1);

  const repetidos = bd.prepare('SELECT folio, COUNT(*) n FROM cajas GROUP BY folio HAVING n > 1').all();
  assert.deepEqual(repetidos, []);
});

test('el historial de cortes los trae del más nuevo al más viejo', async () => {
  const { json } = await llamar('/api/caja/cortes');
  assert.ok(json.datos.cortes.length >= 3);
  const fechas = json.datos.cortes.map((c) => c.cerrada_en);
  assert.deepEqual(fechas, [...fechas].sort().reverse());
});

// ============================================================
// EL RELEVO DE LAS 2:30
//
// La existencia se entrega como a las 2:30 y el cajero que sigue llega a
// las 3. En ese rato el que está sigue cobrando, pero ese dinero ya es del
// que viene. Antes, en el software viejo, se seguía cobrando con el usuario
// del que se iba y las ventas de la noche salían a nombre equivocado.
// ============================================================

test('entregar el turno cuenta el dinero y deja uno nuevo esperando dueño', async () => {
  await entrarAdmin();
  await cerrarSiHayAbierto();
  await entrarPorNombre('Rosa', '4444');       // el turno se abre a su nombre

  await venderUnaMarqueta();                    // $264 de Rosa

  const antes = (await llamar('/api/caja')).json.datos.abierta;
  const r = await llamar('/api/caja/entregar', {
    method: 'POST', cuerpo: { contado: antes.esperado / 100 }
  });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.corte.caja.diferencia_centavos, 0);

  // La venta NO se para: hay turno abierto, pero sin dueño.
  const ahora = (await llamar('/api/caja')).json.datos;
  assert.ok(ahora.abierta, 'quedó un turno abierto');
  assert.equal(ahora.sinDueno, true);
  assert.equal(ahora.abierta.vendido, 0, 'arranca limpio');
});

test('lo que se cobra en ese rato queda apartado, no se mezcla', async () => {
  await venderUnaMarqueta();                    // Rosa teclea, pero no es suyo

  const e = (await llamar('/api/caja')).json.datos.abierta;
  assert.equal(e.vendido, 26400);
  assert.equal(e.caja.cajero_id, null, 'todavía nadie se hizo cargo');
});

test('cuando el que entra pone su PIN, el turno se le asigna', async () => {
  const mari = await entrarPorNombre('Mari', '7777');

  const d = (await llamar('/api/caja')).json.datos;
  assert.equal(d.sinDueno, false);
  assert.equal(d.abierta.caja.cajero_id, mari.id, 'el turno ya es de Mari');
  assert.equal(d.abierta.vendido, 26400, 'con el dinero que le apartaron');

  // Y no se abrió un turno de más.
  const abiertos = bd.prepare('SELECT COUNT(*) n FROM cajas WHERE cerrada_en IS NULL').get().n;
  assert.equal(abiertos, 1);
});

/**
 * Esto es lo que arregla el problema: la venta la tecleó Rosa, pero el
 * dinero es de Mari. Las dos cosas quedan escritas (regla 3.6).
 */
test('la venta guarda quién la tecleó, aunque el turno sea de otro', async () => {
  const turno = bd.prepare('SELECT * FROM cajas WHERE cerrada_en IS NULL').get();
  const venta = bd.prepare(
    'SELECT * FROM ventas WHERE caja_id = ? ORDER BY fecha LIMIT 1'
  ).get(turno.id);

  const rosa = bd.prepare("SELECT id FROM usuarios WHERE nombre = 'Rosa'").get();
  const mari = bd.prepare("SELECT id FROM usuarios WHERE nombre = 'Mari'").get();

  assert.equal(venta.capturista_id, rosa.id, 'la tecleó Rosa');
  assert.equal(turno.cajero_id, mari.id, 'pero el dinero responde Mari');
});

test('un turno sin dueño no se puede entregar otra vez', async () => {
  await entrarAdmin();
  await cerrarSiHayAbierto();
  await entrarPorNombre('Rosa', '4444');
  await llamar('/api/caja/entregar', { method: 'POST', cuerpo: { contado: 0 } });

  const otra = await llamar('/api/caja/entregar', { method: 'POST', cuerpo: { contado: 0 } });
  assert.equal(otra.estado, 409);
  assert.match(otra.json.error, /esperando dueño/i);
});

// ============================================================
// QUIÉN PUEDE QUÉ
// ============================================================

/**
 * v0.10: el turno lo abre el PIN. En la fábrica nadie va a una pantalla
 * aparte a "abrir la caja": se llega, se pone el PIN y se cobra.
 */
test('entrar con el PIN abre el turno solo, en cero', async () => {
  await entrarAdmin();
  await cerrarSiHayAbierto();
  assert.equal((await llamar('/api/caja')).json.datos.abierta, null);

  const u = await entrarPorNombre('Rosa', '4444');

  const e = (await llamar('/api/caja')).json.datos.abierta;
  assert.ok(e, 'entrar abrió el turno');
  assert.equal(e.fondo, 0, 'arranca en cero: el fondo se agrega como movimiento');
  assert.equal(e.caja.cajero_id, u.id, 'el turno es de quien puso su PIN');
});

test('si ya hay un turno abierto, entrar NO abre otro', async () => {
  const antes = (await llamar('/api/caja')).json.datos.abierta.caja;

  await entrarPorNombre('Mari', '7777');

  const despues = (await llamar('/api/caja')).json.datos.abierta.caja;
  assert.equal(despues.id, antes.id, 'Mari sigue en el turno que dejó abierto Rosa');

  const abiertos = bd.prepare('SELECT COUNT(*) n FROM cajas WHERE cerrada_en IS NULL').get().n;
  assert.equal(abiertos, 1);
});

test('un operario no abre ninguna caja al entrar', async () => {
  await entrarAdmin();
  await cerrarSiHayAbierto();

  await entrarPorNombre('Chema', '5555');

  // Se mira la base directamente: volver a entrar como administrador
  // abriría un turno y taparía justo lo que se quiere comprobar.
  const abiertos = bd.prepare('SELECT COUNT(*) n FROM cajas WHERE cerrada_en IS NULL').get().n;
  assert.equal(abiertos, 0, 'el operario no maneja dinero: no abre caja');
});

test('el cajero mueve dinero y cierra; pero no anula movimientos', async () => {
  await entrarAdmin();
  await cerrarSiHayAbierto();
  await entrarPorNombre('Rosa', '4444');   // esto ya le abre el turno

  const mov = await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', concepto: 'Refrescos', monto: 60 }
  });
  assert.equal(mov.estado, 201);

  const id = mov.json.datos.movimientos[0].id;
  const anula = await llamar(`/api/caja/movimientos/${id}/anular`, {
    method: 'POST', cuerpo: { motivo: 'No debería poder' }
  });
  assert.equal(anula.estado, 403);

  assert.equal((await llamar('/api/caja/cerrar', { method: 'POST', cuerpo: { contado: 0 } })).estado, 200);
});

test('el gerente sí puede anular un movimiento', async () => {
  await entrarAdmin();          // entrar ya abre turno si no hay
  const mov = await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', concepto: 'Prueba gerente', monto: 10 }
  });
  const id = mov.json.datos.movimientos[0].id;

  await entrarPorNombre('Mari', '7777');
  const r = await llamar(`/api/caja/movimientos/${id}/anular`, {
    method: 'POST', cuerpo: { motivo: 'Mal capturado' }
  });
  assert.equal(r.estado, 200);
});

test('un operario no entra a la caja', async () => {
  await entrarAdmin();
  await cerrarSiHayAbierto();
  await entrarPorNombre('Chema', '5555');

  assert.equal((await llamar('/api/caja')).estado, 403);
  assert.equal((await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 0 } })).estado, 403);
  assert.equal((await llamar('/api/caja/cortes')).estado, 403);
});

test('cada turno que existe tiene su renglón en la bitácora', () => {
  // Un turno nace de dos formas: alguien lo abre, o alguien entrega el suyo
  // y deja este esperando dueño. Ninguno puede aparecer de la nada.
  const aperturas = bd.prepare(
    "SELECT COUNT(*) n FROM bitacora WHERE accion = 'caja.abierta'"
  ).get().n;
  const entregas = bd.prepare(
    "SELECT COUNT(*) n FROM bitacora WHERE accion = 'caja.entregada'"
  ).get().n;
  const cajas = bd.prepare('SELECT COUNT(*) n FROM cajas').get().n;

  assert.equal(aperturas + entregas, cajas);
});

// ============================================================
// EL HISTORIAL DEL CAJÓN, CRUZANDO TURNOS  (v1.5)
//
// La pregunta de la tarde es "¿y la gasolina de la mañana?", y la mañana
// suele ser otro turno, ya cerrado. Por eso este historial no se queda en
// el turno de ahora.
// ============================================================

test('el historial trae movimientos de turnos ya cerrados', async () => {
  await entrarAdmin();
  await cerrarSiHayAbierto();

  // Turno A: un gasto, y se cierra.
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 500 } });
  await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', concepto: 'Gasolina de la mañana', monto: 200 }
  });
  await llamar('/api/caja/cerrar', { method: 'POST', cuerpo: { contado: 300 } });

  // Turno B: otro movimiento, y sigue abierto.
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 100 } });
  await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'entrada', concepto: 'Cambio de la tarde', monto: 400 }
  });

  const { movimientos } = (await llamar('/api/caja/movimientos')).json.datos;
  const conceptos = movimientos.map((m) => m.concepto);
  assert.ok(conceptos.includes('Gasolina de la mañana'), 'falta el gasto del turno cerrado');
  assert.ok(conceptos.includes('Cambio de la tarde'));

  // Lo más nuevo primero, y cada uno sabe de qué turno es: con eso la
  // pantalla dibuja la raya de "de aquí para abajo es del turno de…".
  assert.equal(movimientos[0].concepto, 'Cambio de la tarde');
  const tarde = movimientos.find((m) => m.concepto === 'Cambio de la tarde');
  const manana = movimientos.find((m) => m.concepto === 'Gasolina de la mañana');
  assert.ok(tarde.caja_folio > manana.caja_folio, 'los folios no distinguen los turnos');
  assert.ok(manana.caja_cerrada_en, 'el turno de la mañana debería venir marcado como cerrado');
  assert.ok(tarde.caja_cajero, 'debería decir de quién es el turno');
});

test('el historial se puede pedir solo de gastos', async () => {
  const { movimientos } = (await llamar('/api/caja/movimientos?tipo=salida')).json.datos;
  assert.ok(movimientos.length > 0);
  assert.ok(movimientos.every((m) => m.tipo === 'salida'));
});

test('un movimiento anulado desaparece del historial', async () => {
  const antes = (await llamar('/api/caja/movimientos')).json.datos.movimientos;
  const mov = antes.find((m) => m.concepto === 'Cambio de la tarde');

  await llamar(`/api/caja/movimientos/${mov.id}/anular`, {
    method: 'POST', cuerpo: { motivo: 'Mal capturado' }
  });

  const despues = (await llamar('/api/caja/movimientos')).json.datos.movimientos;
  assert.ok(!despues.some((m) => m.id === mov.id));
});

test('el cajero ve el historial; el operario no', async () => {
  await entrarPorNombre('Mari', '7777');
  assert.equal((await llamar('/api/caja/movimientos')).estado, 200);

  await entrarPorNombre('Chema', '5555');
  assert.equal((await llamar('/api/caja/movimientos')).estado, 403);
});

// ============================================================
// EL TURNO SIN DUEÑO NO SE ADOPTA SOLO  (v1.7)
// ============================================================

test('refrescar la pantalla NO adopta el turno que espera dueño', async () => {
  await entrarAdmin();
  await cerrarSiHayAbierto();
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 0 } });
  await llamar('/api/caja/entregar', { method: 'POST', cuerpo: { contado: 0 } });

  assert.equal((await llamar('/api/caja')).json.datos.sinDueno, true);

  // /auth/yo es lo que corre en cada arranque de la pantalla. Si adoptara,
  // el cajero que acaba de entregar se quedaría el turno con solo refrescar
  // el navegador, y el relevo de las 2:30 no serviría de nada.
  await llamar('/api/auth/yo');
  await llamar('/api/auth/yo');
  assert.equal((await llamar('/api/caja')).json.datos.sinDueno, true,
               'sigue esperando a quien de verdad llegue');
});

test('teclear el PIN sí lo adopta, y la caja lo dice', async () => {
  const antes = (await llamar('/api/ventas/contexto')).json.datos.caja;
  assert.equal(antes.sinDueno, true, 'la pantalla de venta tiene que saberlo');

  await entrarPorNombre('Mari', '7777');
  const despues = (await llamar('/api/ventas/contexto')).json.datos.caja;
  assert.equal(despues.sinDueno, false);
  assert.equal(despues.cajero, 'Mari');
});


// ============================================================
// LOS GASTOS QUE SE REPITEN  (v2.5)
//
// El desayuno de los muchachos es todos los días y nunca es igual.
// Escrito a mano, a fin de mes hay "Desayuno", "desayunos" y "DESAYUNO":
// tres conceptos y ninguna estadística. Ese es el problema que resuelve.
// ============================================================

test('el sistema arranca con unos conceptos de los de siempre', async () => {
  await entrarAdmin();
  const { conceptos } = (await llamar('/api/caja/conceptos')).json.datos;
  assert.ok(conceptos.length >= 4, 'hay algo que tocar desde el primer día');
  assert.ok(conceptos.some((c) => /desayuno/i.test(c.nombre)));
  assert.ok(conceptos.every((c) => c.tipo === 'salida' || c.tipo === 'entrada'));
});

test('el concepto de un gasto lo pone el catálogo, no quien llama', async () => {
  await entrarAdmin();
  const { conceptos } = (await llamar('/api/caja/conceptos')).json.datos;
  const desayuno = conceptos.find((c) => /desayuno/i.test(c.nombre));

  // Se manda un texto distinto a propósito: tiene que ganar el catálogo.
  const r = await llamar('/api/caja/movimientos', {
    method: 'POST',
    cuerpo: { tipo: 'salida', conceptoId: desayuno.id, concepto: 'lo que sea', monto: 85 }
  });
  assert.equal(r.estado, 201);

  const m = bd.prepare('SELECT * FROM movimientos_caja WHERE id = ?')
    .get(r.json.datos.movimientoId);
  assert.equal(m.concepto, desayuno.nombre, 'el texto sale del catálogo');
  assert.equal(m.concepto_id, desayuno.id, 'y queda amarrado por su id');
});

test('un gasto escrito a mano sigue valiendo: no todo se repite', async () => {
  const r = await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', concepto: 'Le pagué al plomero', monto: 400 }
  });
  assert.equal(r.estado, 201);
  const m = bd.prepare('SELECT * FROM movimientos_caja WHERE id = ?')
    .get(r.json.datos.movimientoId);
  assert.equal(m.concepto, 'Le pagué al plomero');
  assert.equal(m.concepto_id, null);
});

test('un concepto de salidas no se puede usar para meter dinero', async () => {
  const { conceptos } = (await llamar('/api/caja/conceptos')).json.datos;
  const gasto = conceptos.find((c) => c.tipo === 'salida');
  const r = await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'entrada', conceptoId: gasto.id, monto: 50 }
  });
  assert.equal(r.estado, 400);
  assert.match(r.json.error, /salidas/);
});

test('un concepto que no existe se rechaza en vez de inventarlo', async () => {
  const r = await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', conceptoId: 'no-existe', monto: 50 }
  });
  assert.equal(r.estado, 409);
});

test('el resumen del mes suma por concepto, no por lo que se escribió', async () => {
  await entrarAdmin();
  const { conceptos } = (await llamar('/api/caja/conceptos')).json.datos;
  const desayuno = conceptos.find((c) => /desayuno/i.test(c.nombre));

  // Tres desayunos de importes distintos, que es como pasa de verdad.
  for (const monto of [50, 100, 75]) {
    await llamar('/api/caja/movimientos', {
      method: 'POST', cuerpo: { tipo: 'salida', conceptoId: desayuno.id, monto } });
  }

  const { porConcepto, sueltos } = (await llamar('/api/caja/conceptos/resumen')).json.datos;
  const fila = porConcepto.find((r) => r.id === desayuno.id);
  assert.ok(fila, 'el desayuno tiene su renglón');
  assert.equal(fila.veces, 4, 'los tres de ahora más el de la prueba de antes');
  assert.equal(fila.centavos, 8500 + 5000 + 10000 + 7500);

  // Los escritos a mano van aparte: no hay forma honesta de agruparlos.
  assert.ok(sueltos.some((s) => s.tipo === 'salida'),
            'los de texto libre se cuentan, pero por separado');
});

test('renombrar un concepto no parte su historia en dos', async () => {
  await entrarAdmin();
  const { conceptos } = (await llamar('/api/caja/conceptos')).json.datos;
  const desayuno = conceptos.find((c) => /desayuno/i.test(c.nombre));

  const antes = (await llamar('/api/caja/conceptos/resumen')).json.datos
    .porConcepto.find((r) => r.id === desayuno.id);

  const r = await llamar(`/api/caja/conceptos/${desayuno.id}`, {
    method: 'PUT', cuerpo: { nombre: 'Comida de los muchachos' }
  });
  assert.equal(r.estado, 200);

  const despues = (await llamar('/api/caja/conceptos/resumen')).json.datos
    .porConcepto.find((x) => x.id === desayuno.id);
  assert.equal(despues.centavos, antes.centavos, 'sigue sumando lo mismo');
  assert.equal(despues.nombre, 'Comida de los muchachos');

  // Y el comprobante que se firmó ayer no cambió (regla 3.5).
  const viejo = bd.prepare(
    "SELECT concepto FROM movimientos_caja WHERE concepto_id = ? ORDER BY fecha LIMIT 1"
  ).get(desayuno.id);
  assert.equal(viejo.concepto, 'Desayuno', 'el papel dice lo que decía ese día');
});

test('dar de baja un concepto no borra lo que ya se anotó con él', async () => {
  await entrarAdmin();
  const { conceptos } = (await llamar('/api/caja/conceptos')).json.datos;
  const desayuno = conceptos.find((c) => c.id === 'gasto-desayuno');

  const antes = (await llamar('/api/caja/conceptos/resumen')).json.datos
    .porConcepto.find((r) => r.id === desayuno.id);

  await llamar(`/api/caja/conceptos/${desayuno.id}`, { method: 'PUT', cuerpo: { activo: false } });

  const activos = (await llamar('/api/caja/conceptos')).json.datos.conceptos;
  assert.ok(!activos.some((c) => c.id === desayuno.id), 'ya no sale en la caja');

  const despues = (await llamar('/api/caja/conceptos/resumen')).json.datos
    .porConcepto.find((r) => r.id === desayuno.id);
  assert.equal(despues.centavos, antes.centavos, 'un gasto de marzo no desaparece en agosto');

  // Y no se puede usar por accidente estando de baja.
  const r = await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', conceptoId: desayuno.id, monto: 50 } });
  assert.equal(r.estado, 409);

  await llamar(`/api/caja/conceptos/${desayuno.id}`, { method: 'PUT', cuerpo: { activo: true } });
});

test('no se pueden dar de alta dos conceptos con el mismo nombre', async () => {
  await entrarAdmin();
  const r1 = await llamar('/api/caja/conceptos', { method: 'POST', cuerpo: { nombre: 'Hielo seco' } });
  assert.equal(r1.estado, 201);
  const r2 = await llamar('/api/caja/conceptos', { method: 'POST', cuerpo: { nombre: 'hielo SECO' } });
  assert.equal(r2.estado, 409, 'dos que se llaman igual son el problema que esto resuelve');
});

test('un cajero usa los conceptos pero no los da de alta', async () => {
  await crearUsuario('Lupe', 'cajero', '3131');
  await entrarPorNombre('Lupe', '3131');

  assert.equal((await llamar('/api/caja/conceptos')).estado, 200, 'los ve para tocarlos');
  const r = await llamar('/api/caja/conceptos', { method: 'POST', cuerpo: { nombre: 'Lo que sea' } });
  assert.equal(r.estado, 403, 'el catálogo es del gerente para arriba');
  await entrarAdmin();
});


// ============================================================
// EL TURNO QUE SE RELEVÓ  (v2.5)
//
// EL CASO: son las diez de la noche, se va la luz y el turno no se puede
// cortar. A la mañana llega otro cajero, pone su PIN y sigue vendiendo
// sobre el turno abierto. Cuando por fin se corta, el papel salía a
// nombre del primero y el segundo no aparecía por ningún lado.
// ============================================================

test('el corte dice quién metió qué cuando estuvieron dos en la caja', async () => {
  await entrarAdmin();

  // El turno arranca con el administrador.
  const abierta = (await llamar('/api/caja')).json.datos.abierta;
  assert.ok(abierta, 'hay un turno abierto');

  await llamar('/api/ventas', { method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 300 } });
  await llamar('/api/ventas', { method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 8 }], pago: 200 } });

  // Llega el relevo y sigue sobre el MISMO turno, sin cortar.
  await crearUsuario('Beto', 'cajero', '2121');
  await entrarPorNombre('Beto', '2121');
  await llamar('/api/ventas', { method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 4 }], pago: 100 } });
  await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', concepto: 'Refrescos', monto: 60 } });

  await entrarAdmin();
  const cerrar = await llamar('/api/caja/cerrar', { method: 'POST', cuerpo: { contado: 1 } });
  assert.equal(cerrar.estado, 200);

  const { porPersona } = cerrar.json.datos.corte;
  assert.equal(porPersona.length, 2, 'los dos aparecen');

  const beto = porPersona.find((p) => p.nombre === 'Beto');
  assert.ok(beto, 'el que llegó al relevo tiene su renglón');
  assert.equal(beto.cobradas, 1);
  assert.equal(beto.salidas, 6000, 'y sus gastos');

  const tony = porPersona.find((p) => p.nombre !== 'Beto');
  assert.equal(tony.cobradas, 2);

  // El arqueo NO se parte: el dinero del cajón es uno solo.
  const c = cerrar.json.datos.corte.caja;
  assert.equal(c.vendido_centavos,
               porPersona.reduce((n, p) => n + p.efectivo, 0),
               'lo de todos junto es lo del turno');
});

test('con una sola persona el corte no trae desglose: repetiría lo mismo', async () => {
  await entrarAdmin();
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 500 } });
  await llamar('/api/ventas', { method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 300 } });

  const cerrar = await llamar('/api/caja/cerrar', { method: 'POST', cuerpo: { contado: 764 } });
  assert.deepEqual(cerrar.json.datos.corte.porPersona, []);
});


// ============================================================
// EL DINERO QUE SOLO CAMBIA DE SITIO
// ============================================================

test('un retiro a la caja fuerte no cuenta como gasto de la fábrica', async () => {
  await entrarAdmin();
  await cerrarSiHayAbierto();
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 500 } });

  const { conceptos } = (await llamar('/api/caja/conceptos')).json.datos;
  const retiro = conceptos.find((c) => c.id === 'gasto-retiro');
  assert.equal(retiro.es_traspaso, 1, 'de fábrica el retiro viene marcado');

  const antes = (await llamar('/api/caja/conceptos/resumen')).json.datos;

  await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', conceptoId: retiro.id, monto: 400 } });

  const d = (await llamar('/api/caja/conceptos/resumen')).json.datos;
  assert.equal(d.gastado, antes.gastado,
               'el dinero salió del cajón pero la fábrica no lo gastó');
  assert.equal(d.traspasado, antes.traspasado + 40000, 'se cuenta aparte');

  // Y sigue estando en la lista: no se esconde, se separa.
  const fila = d.porConcepto.find((r) => r.id === retiro.id);
  assert.ok(fila && fila.centavos >= 40000, 'el renglón está, marcado');
  assert.equal(fila.es_traspaso, 1);
});

test('un concepto se puede marcar y desmarcar como traspaso', async () => {
  await entrarAdmin();
  const alta = await llamar('/api/caja/conceptos', {
    method: 'POST', cuerpo: { nombre: 'A la cuenta del banco', tipo: 'salida', esTraspaso: true } });
  assert.equal(alta.estado, 201);
  assert.equal(alta.json.datos.concepto.es_traspaso, 1);

  const id = alta.json.datos.concepto.id;
  await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', conceptoId: id, monto: 1000 } });

  const conTraspaso = (await llamar('/api/caja/conceptos/resumen')).json.datos;
  assert.ok(!conTraspaso.porConcepto.filter((r) => !r.es_traspaso).some((r) => r.id === id));

  // Si fue un error marcarlo, se corrige y el dinero pasa al otro lado.
  const cambio = await llamar(`/api/caja/conceptos/${id}`, {
    method: 'PUT', cuerpo: { esTraspaso: false } });
  assert.equal(cambio.estado, 200);

  const ya = (await llamar('/api/caja/conceptos/resumen')).json.datos;
  assert.equal(ya.gastado, conTraspaso.gastado + 100000, 'ahora sí es gasto');
  assert.equal(ya.traspasado, conTraspaso.traspasado - 100000);

  await llamar(`/api/caja/conceptos/${id}`, { method: 'PUT', cuerpo: { activo: false } });
});

test('los gastos escritos a mano nunca son traspaso: no hay dónde marcarlo', async () => {
  await entrarAdmin();
  const d = (await llamar('/api/caja/conceptos/resumen')).json.datos;
  // Los sueltos van por su cuenta y no entran ni en gastado ni en
  // traspasado: son un tercer montón, y decir lo contrario sería inventar.
  assert.ok(Array.isArray(d.sueltos));
  assert.equal(d.gastado + d.traspasado,
               d.porConcepto.reduce((n, r) => n + r.centavos, 0),
               'los dos montones juntos son exactamente lo que tiene concepto');
});


// ============================================================
// BORRAR UN CONCEPTO DE LA LISTA  (v2.7.1)
// ============================================================

test('eliminar un concepto lo esconde de la lista pero no borra sus gastos', async () => {
  await entrarAdmin();
  const alta = await llamar('/api/caja/conceptos', {
    method: 'POST', cuerpo: { nombre: 'Se creó por error', tipo: 'salida' } });
  const id = alta.json.datos.concepto.id;

  await cerrarSiHayAbierto();
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 500 } });
  await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', conceptoId: id, monto: 70 } });

  const antes = (await llamar('/api/caja/conceptos/resumen')).json.datos;

  const r = await llamar(`/api/caja/conceptos/${id}/eliminar`, { method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 200);

  // Ya no sale ni en la lista de administrar…
  const todos = (await llamar('/api/caja/conceptos?todos=1')).json.datos.conceptos;
  assert.ok(!todos.some((c) => c.id === id), 'ni tachado ni nada: ya no está');

  // …pero su gasto sigue sumando exactamente igual.
  const despues = (await llamar('/api/caja/conceptos/resumen')).json.datos;
  assert.equal(despues.gastado, antes.gastado, 'el gasto de $70 no desapareció');
  assert.ok(despues.porConcepto.some((x) => x.id === id),
            'y su renglón sigue en el resumen, porque tiene dinero');

  // Eliminarlo dos veces ya no encuentra nada.
  const otra = await llamar(`/api/caja/conceptos/${id}/eliminar`, { method: 'POST', cuerpo: {} });
  assert.equal(otra.estado, 404);
});

test('un cajero no puede eliminar conceptos', async () => {
  await entrarAdmin();
  const alta = await llamar('/api/caja/conceptos', {
    method: 'POST', cuerpo: { nombre: 'Prueba de permiso', tipo: 'salida' } });
  const id = alta.json.datos.concepto.id;

  await crearUsuario('Caja Dos', 'cajero', '3434');
  await entrarPorNombre('Caja Dos', '3434');
  const r = await llamar(`/api/caja/conceptos/${id}/eliminar`, { method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 403, 'eliminar es del gerente o del administrador');
  await entrarAdmin();
});
