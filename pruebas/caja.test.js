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
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'fabrica-caja-'));
process.env.CARPETA_DATOS = carpeta;
process.env.ARCHIVO_BD = path.join(carpeta, 'prueba.db');

const { migrar } = require('../src/db/migrar');
const { crearApp } = require('../src/servidor');
const { bd } = require('../src/db/conexion');

migrar({ silencioso: true });

let servidor, base, cookie = '';

async function llamar(ruta, opciones = {}) {
  const r = await fetch(base + ruta, {
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    ...opciones,
    body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined
  });
  const set = r.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  return { estado: r.status, json: await r.json() };
}

async function entrarAdmin() {
  await llamar('/api/auth/entrar-contrasena', {
    method: 'POST', cuerpo: { usuario: 'tony', contrasena: 'clavelarga1' }
  });
}

async function entrarPorNombre(nombre, pin) {
  const lista = (await llamar('/api/auth/usuarios-disponibles')).json.datos.usuarios;
  const u = lista.find((x) => x.nombre === nombre);
  await llamar('/api/auth/entrar-pin', { method: 'POST', cuerpo: { usuarioId: u.id, pin } });
  return u;
}

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

test.before(async () => {
  servidor = crearApp().listen(0);
  await new Promise((r) => servidor.once('listening', r));
  base = `http://127.0.0.1:${servidor.address().port}`;

  await llamar('/api/auth/configuracion-inicial', {
    method: 'POST',
    cuerpo: { nombre: 'Tony', usuario: 'tony', contrasena: 'clavelarga1', pin: '1111' }
  });

  await llamar('/api/usuarios', { method: 'POST', cuerpo: { nombre: 'Rosa', rol: 'cajero', pin: '4444' } });
  await llamar('/api/usuarios', { method: 'POST', cuerpo: { nombre: 'Mari', rol: 'gerente', pin: '7777' } });
  await llamar('/api/usuarios', { method: 'POST', cuerpo: { nombre: 'Chema', rol: 'operario', pin: '5555' } });
});

test.after(() => {
  servidor.close();
  fs.rmSync(carpeta, { recursive: true, force: true });
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

test('la bitácora deja constancia de cada apertura y cada cierre', async () => {
  const aperturas = bd.prepare("SELECT COUNT(*) n FROM bitacora WHERE accion = 'caja.abierta'").get().n;
  const cajas = bd.prepare('SELECT COUNT(*) n FROM cajas').get().n;
  assert.equal(aperturas, cajas);
});
