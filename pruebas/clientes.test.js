/**
 * PRUEBAS DE CLIENTES Y CRÉDITO  (v1.6)
 *
 *     lo que se llevó fiado  −  lo que ha abonado  =  DEBE
 *
 * Aquí es donde se puede perder dinero de verdad, así que lo que se
 * comprueba es lo que cuesta:
 *
 *  · que el saldo se calcule, nunca se guarde (regla 3.2)
 *  · que solo se le fíe a clientes registrados
 *  · que una venta a crédito NO cuente como efectivo en el cajón
 *  · que un abono en efectivo SÍ entre al cajón
 *  · que cancelar un ticket o anular un abono corrija el saldo solo
 *  · que pasarse del límite pida PIN y quede escrito quién dijo que sí
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, entrarPorNombre, bd, preparar } = fabricaDePrueba('clientes');

let mary, publico;


/** Fía una marqueta ($264) al cliente. */
async function fiar(clienteId, dieciseisavos = 16, extra = {}) {
  return llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ dieciseisavos }], formaPago: 'credito', clienteId, ...extra }
  });
}

const ficha = async (id) => (await llamar(`/api/clientes/${id}`)).json.datos;

preparar(async () => {
  for (const [nombre, rol, pin] of [
    ['Mari', 'cajero', '7777'], ['Lupe', 'gerente', '8888'], ['Chema', 'operario', '5555']
  ]) {
    await llamar('/api/usuarios', { method: 'POST', cuerpo: { nombre, rol, pin } });
  }

  mary = (await llamar('/api/clientes', {
    method: 'POST',
    cuerpo: { nombre: 'María Canul', negocio: 'Abarrotes Doña Mary',
              telefono: '9991234567', limite: 1000, diasPlazo: 15 }
  })).json.datos.cliente;

  publico = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Don Beto' }   // sin límite ni plazo
  })).json.datos.cliente;
});

// ============================================================
// LA FICHA
// ============================================================

test('el cliente nace debiendo cero', () => {
  assert.equal(mary.estado.saldo, 0);
  assert.equal(mary.estado.limite, 100000, 'el límite se guarda en centavos');
  assert.equal(mary.estado.disponible, 100000);
  assert.equal(mary.dias_plazo, 15);
});

test('sin límite escrito no hay límite', () => {
  assert.equal(publico.estado.limite, null);
  assert.equal(publico.estado.disponible, null, 'sin límite no hay disponible que calcular');
});

test('el límite vacío no es lo mismo que cero', async () => {
  const r = await llamar(`/api/clientes/${publico.id}`, {
    method: 'PUT', cuerpo: { limite: '0' }
  });
  assert.equal(r.json.datos.cliente.estado.limite, 0, 'cero es un límite de verdad: no le fíes nada');

  const vacio = await llamar(`/api/clientes/${publico.id}`, {
    method: 'PUT', cuerpo: { limite: '' }
  });
  assert.equal(vacio.json.datos.cliente.estado.limite, null);
});

test('un límite que no es un importe se rechaza', async () => {
  for (const malo of ['mucho', '-500', 'abc']) {
    const r = await llamar(`/api/clientes/${mary.id}`, {
      method: 'PUT', cuerpo: { limite: malo }
    });
    assert.equal(r.estado, 400, `debería rechazar ${malo}`);
  }
  assert.equal((await ficha(mary.id)).cliente.estado.limite, 100000, 'no se movió');
});

test('el nombre se edita y el id no cambia', async () => {
  const r = await llamar(`/api/clientes/${mary.id}`, {
    method: 'PUT', cuerpo: { nombre: 'María Canul Pech' }
  });
  assert.equal(r.json.datos.cliente.nombre, 'María Canul Pech');
  assert.equal(r.json.datos.cliente.id, mary.id);
});

// ============================================================
// SOLO SE LE FÍA A QUIEN ESTÁ REGISTRADO
// ============================================================

test('a crédito sin cliente no se vende', async () => {
  const r = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], formaPago: 'credito' }
  });
  assert.equal(r.estado, 400);
  assert.match(r.json.error, /cliente registrado/i);
});

test('a crédito con un cliente inventado tampoco', async () => {
  const r = await fiar('no-existe-este-id');
  assert.equal(r.estado, 400);
});

test('una forma de pago inventada se rechaza', async () => {
  // Si pasara, esa venta saldría del arqueo del cajón sin que nadie lo note.
  const r = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], formaPago: 'vales-de-despensa' }
  });
  assert.equal(r.estado, 400);
});

// ============================================================
// LA CUENTA
// ============================================================

test('fiar sube el saldo', async () => {
  const r = await fiar(mary.id, 4);            // un cuarto: $70
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.venta.forma_pago, 'credito');
  assert.equal(r.json.datos.venta.cliente_id, mary.id);
  assert.equal(r.json.datos.cliente.estado.saldo, 7000);
});

test('el ticket fiado no guarda pago aunque se lo manden', async () => {
  // Fiado quiere decir que no pagó: si el ticket dijera "pagó $70" y la
  // cuenta dijera "debe $70", uno de los dos estaría mintiendo.
  const r = await fiar(mary.id, 2, { pago: '36' });
  assert.equal(r.json.datos.venta.pago_centavos, null);
  assert.equal(r.json.datos.venta.cambio_centavos, null);
  assert.equal((await ficha(mary.id)).cliente.estado.saldo, 7000 + 3600);
});

test('el saldo se calcula, no se guarda', () => {
  // No hay columna de saldo en la tabla. Si algún día se agrega, esta
  // prueba avisa: un saldo guardado se desincroniza el día que se cancele
  // un ticket viejo, y ese día el cliente y la fábrica dejan de coincidir.
  const columnas = bd.prepare('PRAGMA table_info(clientes)').all().map((c) => c.name);
  assert.ok(!columnas.some((c) => /saldo|debe|adeudo/i.test(c)),
            `la tabla clientes no debe guardar saldo: ${columnas.join(', ')}`);
});

test('un abono baja el saldo', async () => {
  const r = await llamar(`/api/clientes/${mary.id}/abonos`, {
    method: 'POST', cuerpo: { monto: 50 }
  });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.cliente.estado.saldo, 10600 - 5000);
});

test('la cuenta corriente trae cargos y abonos mezclados', async () => {
  const { cuenta } = await ficha(mary.id);
  assert.equal(cuenta[0].tipo, 'abono', 'lo más nuevo primero');
  assert.ok(cuenta.some((m) => m.tipo === 'cargo'));
  assert.ok(cuenta.every((m) => m.centavos > 0));
});

test('cancelar un ticket fiado le quita la deuda al cliente', async () => {
  const antes = (await ficha(mary.id)).cliente.estado.saldo;
  const v = await fiar(mary.id, 4);
  assert.equal((await ficha(mary.id)).cliente.estado.saldo, antes + 7000);

  await llamar(`/api/ventas/${v.json.datos.venta.id}/cancelar`, {
    method: 'POST', cuerpo: { motivo: 'Se equivocó' }
  });
  assert.equal((await ficha(mary.id)).cliente.estado.saldo, antes,
               'un ticket cancelado no se le puede seguir cobrando');
});

test('anular un abono lo devuelve al saldo', async () => {
  const antes = (await ficha(mary.id)).cliente.estado.saldo;
  const a = await llamar(`/api/clientes/${mary.id}/abonos`, {
    method: 'POST', cuerpo: { monto: 10 }
  });
  assert.equal((await ficha(mary.id)).cliente.estado.saldo, antes - 1000);

  const r = await llamar(`/api/clientes/abonos/${a.json.datos.abonoId}/anular`, {
    method: 'POST', cuerpo: { motivo: 'Mal capturado' }
  });
  assert.equal(r.estado, 200);
  assert.equal((await ficha(mary.id)).cliente.estado.saldo, antes);
});

test('anular un abono pide motivo', async () => {
  const a = await llamar(`/api/clientes/${mary.id}/abonos`, {
    method: 'POST', cuerpo: { monto: 5 }
  });
  const r = await llamar(`/api/clientes/abonos/${a.json.datos.abonoId}/anular`, {
    method: 'POST', cuerpo: {}
  });
  assert.equal(r.estado, 400);
  await llamar(`/api/clientes/abonos/${a.json.datos.abonoId}/anular`, {
    method: 'POST', cuerpo: { motivo: 'Prueba' }
  });
});

test('pagar de más deja saldo a favor y lo avisa', async () => {
  const saldo = (await ficha(mary.id)).cliente.estado.saldo;
  const r = await llamar(`/api/clientes/${mary.id}/abonos`, {
    method: 'POST', cuerpo: { monto: (saldo / 100) + 100 }
  });
  assert.equal(r.json.datos.deMas, 10000, 'debería avisar que se pasó');
  assert.equal(r.json.datos.cliente.estado.saldo, -10000, 'queda a favor');

  // Y lo que se lleve después se le descuenta de lo que tenía a favor.
  await fiar(mary.id, 4);
  assert.equal((await ficha(mary.id)).cliente.estado.saldo, -10000 + 7000);
});

// ============================================================
// EL DINERO EN EL CAJÓN
// ============================================================

test('una venta a crédito NO entra al arqueo del cajón', async () => {
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 500 } });
  const inicial = (await llamar('/api/caja')).json.datos.abierta;

  await fiar(publico.id, 16);                  // una marqueta fiada: $264

  const despues = (await llamar('/api/caja')).json.datos.abierta;
  assert.equal(despues.esperado, inicial.esperado,
               'ese dinero nunca pasó por el cajón; contarlo lo haría faltar todos los días');
  assert.ok(despues.vendidoSinEfectivo > inicial.vendidoSinEfectivo ||
            despues.vendido === inicial.vendido);
});

test('un abono en efectivo SÍ entra al cajón', async () => {
  const antes = (await llamar('/api/caja')).json.datos.abierta.esperado;

  const r = await llamar(`/api/clientes/${publico.id}/abonos`, {
    method: 'POST', cuerpo: { monto: 100 }
  });
  assert.ok(r.json.datos.movimientoId, 'el abono en efectivo deja su renglón en el cajón');

  const despues = (await llamar('/api/caja')).json.datos.abierta.esperado;
  assert.equal(despues, antes + 10000, 'el billete sí llegó al cajón');
});

test('un abono por transferencia no toca el cajón', async () => {
  const antes = (await llamar('/api/caja')).json.datos.abierta.esperado;

  const r = await llamar(`/api/clientes/${publico.id}/abonos`, {
    method: 'POST', cuerpo: { monto: 50, formaPago: 'transferencia' }
  });
  assert.equal(r.json.datos.movimientoId, null);
  assert.equal((await llamar('/api/caja')).json.datos.abierta.esperado, antes,
               'ese dinero nunca pasó por el cajón');
});

test('anular un abono en efectivo también quita su renglón del cajón', async () => {
  const antes = (await llamar('/api/caja')).json.datos.abierta.esperado;
  const a = await llamar(`/api/clientes/${publico.id}/abonos`, {
    method: 'POST', cuerpo: { monto: 30 }
  });
  assert.equal((await llamar('/api/caja')).json.datos.abierta.esperado, antes + 3000);

  await llamar(`/api/clientes/abonos/${a.json.datos.abonoId}/anular`, {
    method: 'POST', cuerpo: { motivo: 'Se anotó dos veces' }
  });
  assert.equal((await llamar('/api/caja')).json.datos.abierta.esperado, antes,
               'si no, el corte quedaría con un ingreso que ya no existe');
});

// ============================================================
// EL LÍMITE: NO BLOQUEA, PIDE PIN
// ============================================================

test('pasarse del límite pide autorización, no rechaza a secas', async () => {
  // Mary tiene $1,000 de límite. Se le fían cuatro marquetas: $1,056.
  const nuevo = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Ferretería del Centro', limite: 1000 }
  })).json.datos.cliente;

  const r = await fiar(nuevo.id, 16 * 4);
  assert.equal(r.estado, 403);
  assert.equal(r.json.requiereAutorizacion, true);
  assert.equal(r.json.permiso, 'credito.autorizar');
  assert.match(r.json.error, /límite/i);

  // Y no se registró nada.
  assert.equal((await ficha(nuevo.id)).cliente.estado.saldo, 0);
});

test('con el PIN de un gerente sí pasa, y queda escrito quién', async () => {
  const nuevo = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Cocina Económica', limite: 100 }
  })).json.datos.cliente;

  const lupe = (await llamar('/api/auth/usuarios-disponibles')).json.datos.usuarios
    .find((u) => u.nombre === 'Lupe');

  const r = await fiar(nuevo.id, 16, {
    autorizacion: { usuarioId: lupe.id, pin: '8888' }
  });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.venta.credito_autorizado_nombre, 'Lupe',
               'al mes nadie se acuerda de quién dijo que sí');
});

test('el PIN equivocado no autoriza', async () => {
  const nuevo = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Taquería El Güero', limite: 50 }
  })).json.datos.cliente;
  const lupe = (await llamar('/api/auth/usuarios-disponibles')).json.datos.usuarios
    .find((u) => u.nombre === 'Lupe');

  const r = await fiar(nuevo.id, 16, { autorizacion: { usuarioId: lupe.id, pin: '0000' } });
  assert.equal(r.estado, 403);
  assert.equal((await ficha(nuevo.id)).cliente.estado.saldo, 0);
});

test('un cajero no puede autorizar que alguien se pase', async () => {
  const nuevo = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Lonchería Yaz', limite: 50 }
  })).json.datos.cliente;
  const mari = (await llamar('/api/auth/usuarios-disponibles')).json.datos.usuarios
    .find((u) => u.nombre === 'Mari');

  const r = await fiar(nuevo.id, 16, { autorizacion: { usuarioId: mari.id, pin: '7777' } });
  assert.equal(r.estado, 403);
  assert.match(r.json.error, /no puede autorizar/i);
});

test('sin límite se le fía lo que sea', async () => {
  const sinTope = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Hotel Playa' }
  })).json.datos.cliente;

  const r = await fiar(sinTope.id, 16 * 50);
  assert.equal(r.estado, 201);
});

// ============================================================
// BAJA
// ============================================================

test('un cliente que debe no se da de baja', async () => {
  const debe = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Tienda La Esquina' }
  })).json.datos.cliente;
  await fiar(debe.id, 4);

  const r = await llamar(`/api/clientes/${debe.id}/baja`, { method: 'POST' });
  assert.equal(r.estado, 409);
  assert.match(r.json.error, /todavía debe/i);
});

test('en cero sí se da de baja, y se puede recuperar', async () => {
  const c = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Se mudó' }
  })).json.datos.cliente;

  assert.equal((await llamar(`/api/clientes/${c.id}/baja`, { method: 'POST' })).estado, 200);

  const activos = (await llamar('/api/clientes')).json.datos.clientes;
  assert.ok(!activos.some((x) => x.id === c.id));

  const conBajas = (await llamar('/api/clientes?incluirBajas=1')).json.datos.clientes;
  assert.ok(conBajas.some((x) => x.id === c.id), 'sin poder verlos, para el usuario están borrados');

  assert.equal((await llamar(`/api/clientes/${c.id}/alta`, { method: 'POST' })).estado, 200);
  assert.ok((await llamar('/api/clientes')).json.datos.clientes.some((x) => x.id === c.id));
});

test('a un cliente dado de baja no se le fía', async () => {
  const c = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Ya no viene' }
  })).json.datos.cliente;
  await llamar(`/api/clientes/${c.id}/baja`, { method: 'POST' });

  const r = await fiar(c.id, 4);
  assert.equal(r.estado, 409);
});

// ============================================================
// LA CARTERA Y LOS PERMISOS
// ============================================================

test('la cartera dice cuánto hay en la calle', async () => {
  const { cartera, clientes } = (await llamar('/api/clientes')).json.datos;
  const suma = clientes.filter((c) => c.estado.saldo > 0)
                       .reduce((t, c) => t + c.estado.saldo, 0);
  assert.equal(cartera.enLaCalle, suma);
  assert.equal(cartera.deudores, clientes.filter((c) => c.estado.saldo > 0).length);
});

test('la lista de cobranza trae solo a los que deben', async () => {
  const { clientes } = (await llamar('/api/clientes?deben=1')).json.datos;
  assert.ok(clientes.length > 0);
  assert.ok(clientes.every((c) => c.estado.saldo > 0));
});

test('el cajero fía y cobra, pero no da de alta clientes ni pone límites', async () => {
  await entrarPorNombre('Mari', '7777');

  assert.equal((await llamar('/api/clientes')).estado, 200);
  assert.equal((await fiar(mary.id, 2)).estado, 201, 'el cajero es quien está en el mostrador');
  assert.equal((await llamar(`/api/clientes/${mary.id}/abonos`, {
    method: 'POST', cuerpo: { monto: 10 }
  })).estado, 201);

  assert.equal((await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Nuevo' }
  })).estado, 403, 'a quién se le fía no lo decide el cajero');
  assert.equal((await llamar(`/api/clientes/${mary.id}`, {
    method: 'PUT', cuerpo: { limite: 999999 }
  })).estado, 403);
});

test('un operario no ve los clientes', async () => {
  await entrarPorNombre('Chema', '5555');
  assert.equal((await llamar('/api/clientes')).estado, 403);
  assert.equal((await fiar(mary.id, 2)).estado, 403);
});

test('el corte separa lo fiado de lo cobrado por transferencia', async () => {
  await entrarAdmin();
  const e = (await llamar('/api/caja')).json.datos.abierta;
  assert.ok(e.vendidoFiado > 0, 'en este turno sí salió mercancía fiada');
  assert.equal(e.vendidoFiado + e.vendidoTransferencia, e.vendidoOtrosMedios,
               'lo fiado y las transferencias suman todo lo que no fue efectivo');
  // Y ninguno de los dos toca lo que tiene que haber en el cajón.
  assert.equal(e.esperado, e.fondo + e.vendido + e.entradas - e.salidas);
});

test('el ticket fiado sale marcado y con el nombre del cliente', async () => {
  const { ticketVenta } = require('../src/modulos/impresion/ticket');
  const v = await fiar(mary.id, 4);
  const detalle = (await llamar(`/api/ventas/${v.json.datos.venta.id}`)).json.datos.venta;

  const papel = Buffer.from(ticketVenta(detalle, { negocio: 'Hielo LOLHA' })).toString('latin1');
  assert.match(papel, /FIADO/, 'el ticket es el vale: tiene que decirlo');
  assert.match(papel, /Mar/, 'y llevar el nombre de quien se lo llevó');
  assert.match(papel, /Firma de recibido/, 'y la línea para firmar');
});

test('cada venta a crédito deja su renglón en la bitácora', async () => {
  await entrarAdmin();
  const enBitacora = bd.prepare(
    "SELECT COUNT(*) n FROM bitacora WHERE accion = 'venta.credito'"
  ).get().n;
  const enVentas = bd.prepare(
    "SELECT COUNT(*) n FROM ventas WHERE forma_pago = 'credito'"
  ).get().n;
  assert.equal(enBitacora, enVentas);
});
