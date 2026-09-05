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
let faro, garrafonId;


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

test('el cajero fía, cobra y da de alta lo básico, pero no pone límites', async () => {
  await entrarPorNombre('Mari', '7777');

  assert.equal((await llamar('/api/clientes')).estado, 200);
  assert.equal((await fiar(mary.id, 2)).estado, 201, 'el cajero es quien está en el mostrador');
  assert.equal((await llamar(`/api/clientes/${mary.id}/abonos`, {
    method: 'POST', cuerpo: { monto: 10 }
  })).estado, 201);

  // DESDE LA v5.8 SÍ DA DE ALTA, con lo básico: al tomar un pedido por
  // teléfono hay que poder apuntar a quién es, con su teléfono y su
  // dirección, sin salir a buscar al gerente.
  const alta = await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Nuevo del teléfono', telefono: '9991112233' }
  });
  assert.equal(alta.estado, 201, alta.json?.error);
  assert.equal(alta.json.datos.cliente.limite_centavos, null, 'sin límite: eso no es suyo');

  // Lo que NO puede: decidir a quién se le fía y cuánto, ni a qué precio.
  assert.equal((await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Con límite', limite: '5000' }
  })).estado, 403, 'el límite lo pone el gerente');
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

test('el ticket a crédito sale marcado y con el nombre del cliente', async () => {
  const { ticketVenta } = require('../src/modulos/impresion/ticket');
  const v = await fiar(mary.id, 4);
  const detalle = (await llamar(`/api/ventas/${v.json.datos.venta.id}`)).json.datos.venta;

  const papel = Buffer.from(ticketVenta(detalle, { negocio: 'Hielo LOLHA' })).toString('latin1');
  // "A CREDITO" y ya no "FIADO" (v5.2.2): el papel se lo lleva el cliente
  // y sirve para reclamar; "fiado" suena a apunte en una libreta.
  assert.match(papel, /A CREDITO/, 'el ticket es el vale: tiene que decirlo');
  assert.ok(!papel.includes('FIADO'), 'y ya no dice fiado en ningún lado');
  assert.match(papel, /Mar/, 'y llevar el nombre de quien se lo llevó');
  assert.match(papel, /FIRMA DE RECIBIDO/, 'y la línea para firmar');
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


// ============================================================
// SU LOGO  (v3.8)
//
// Un mayorista es una tienda con rótulo. Con su logo al lado se reconoce
// en la lista sin leer, que es la misma razón por la que los productos
// llevan foto. Lo que se prueba es que no se cuele cualquier archivo.
// ============================================================

/** Un PNG de verdad de un pixel: lo que se comprueba es su firma. */
const PNG = 'data:image/png;base64,'
  + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('el cliente puede llevar su logo', async () => {
  await entrarAdmin();
  const r = await llamar(`/api/clientes/${mary.id}/foto`, {
    method: 'POST', cuerpo: { archivo: PNG } });
  assert.equal(r.estado, 200);
  assert.match(r.json.datos.cliente.foto, /\.png$/);

  // Y sale en la lista, que es donde sirve.
  const lista = (await llamar('/api/clientes')).json.datos.clientes;
  assert.ok(lista.find((c) => c.id === mary.id).foto, 'la lista la trae');
});

test('un archivo que no es imagen no se guarda', async () => {
  await entrarAdmin();
  for (const archivo of [
    'data:application/pdf;base64,JVBERi0xLjQK',            // un PDF de verdad
    'data:image/png;base64,QUJD',                          // dice PNG y no lo es
    'no es una url de datos',
    ''
  ]) {
    const r = await llamar(`/api/clientes/${mary.id}/foto`, {
      method: 'POST', cuerpo: { archivo } });
    assert.equal(r.estado, 400, JSON.stringify(archivo).slice(0, 40));
  }
});

test('quitarle el logo lo deja con su inicial', async () => {
  await entrarAdmin();
  const r = await llamar(`/api/clientes/${mary.id}/foto`, { method: 'DELETE' });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.cliente.foto, null);
});

test('el logo es cosa de quien administra clientes', async () => {
  await entrarPorNombre('Mari', '7777');    // cajera: ve clientes, no los administra
  const r = await llamar(`/api/clientes/${mary.id}/foto`, {
    method: 'POST', cuerpo: { archivo: PNG } });
  assert.equal(r.estado, 403);
  await entrarAdmin();
});

test('poner el logo de un cliente que no existe da 404', async () => {
  await entrarAdmin();
  const r = await llamar('/api/clientes/no-existe/foto', {
    method: 'POST', cuerpo: { archivo: PNG } });
  assert.equal(r.estado, 404);
});

// ============================================================
// PAGA UNA PARTE Y DEBE LA OTRA  (v5.3)
//
// "Se lleva $480 pero solo paga $300 y queda debiendo $180. No me deja
//  anotar que solo pagó $300: tengo que terminar la venta que me da todo e
//  ir hasta Clientes a ponerle un abono. Muy lento."
//
// Lo que importa probar es que sea UNA venta a crédito MÁS UN ABONO, y no
// una tercera cosa: así el saldo lo sigue calculando la misma resta de
// siempre, y el día que se cancele ese ticket la cuenta se corrige sola.
// ============================================================

/** Vende a crédito dejando algo en el mostrador. */
const aCreditoConAbono = (clienteId, dieciseisavos, abono, extra = {}) =>
  llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ dieciseisavos }], formaPago: 'credito', clienteId, abono, ...extra }
  });

test('dejar una parte en el mostrador baja la deuda de una vez', async () => {
  await entrarAdmin();
  const quien = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Doña Parcial' }
  })).json.datos.cliente;

  // Una marqueta son $264. Deja $100 y queda debiendo $164.
  const r = await aCreditoConAbono(quien.id, 16, '100');
  assert.equal(r.estado, 201, r.json?.error);
  assert.equal(r.json.datos.abono.centavos, 10000);
  assert.equal(r.json.datos.abono.quedaADeber, 16400);
  assert.equal((await ficha(quien.id)).cliente.estado.saldo, 16400);
});

test('en la cuenta salen las dos cosas: el cargo entero y su abono', async () => {
  // Es lo que de verdad pasó, y es lo que hace que se pueda explicar. Si
  // se guardara "una venta de $164" nadie sabría después que se llevó una
  // marqueta completa.
  await entrarAdmin();
  const quien = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Don Detalle' }
  })).json.datos.cliente;

  await aCreditoConAbono(quien.id, 16, '100');
  const { cuenta } = await ficha(quien.id);

  const cargo = cuenta.find((m) => m.tipo === 'cargo');
  const abono = cuenta.find((m) => m.tipo === 'abono');
  assert.equal(cargo.centavos, 26400, 'el cargo es por lo que se llevó');
  assert.equal(abono.centavos, 10000, 'y el abono por lo que dejó');
});

test('el abono del mostrador queda amarrado a SU ticket', async () => {
  // Sin eso, una reimpresión de ese ticket no podría decir "pagó $100", y
  // el papel del cliente diría una cosa y el sistema otra.
  await entrarAdmin();
  const quien = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Doña Amarre' }
  })).json.datos.cliente;

  const v = (await aCreditoConAbono(quien.id, 16, '100')).json.datos.venta;
  const fila = bd.prepare('SELECT venta_id, centavos FROM abonos WHERE venta_id = ?').get(v.id);
  assert.ok(fila, 'el abono sabe de qué ticket es');
  assert.equal(fila.centavos, 10000);

  // Y el detalle del ticket lo trae ya sumado, para el papel.
  const detalle = (await llamar(`/api/ventas/${v.id}`)).json.datos.venta;
  assert.equal(detalle.abonoCentavos, 10000);
});

test('el ticket dice lo que dejó y lo que queda a deber', async () => {
  const { ticketVenta } = require('../src/modulos/impresion/ticket');
  await entrarAdmin();
  const quien = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Don Papel' }
  })).json.datos.cliente;

  const v = (await aCreditoConAbono(quien.id, 16, '100')).json.datos.venta;
  const detalle = (await llamar(`/api/ventas/${v.id}`)).json.datos.venta;
  const papel = Buffer.from(ticketVenta(detalle, { negocio: 'X' })).toString('latin1');

  assert.match(papel, /PAGO AHORA/, 'el papel dice lo que entregó');
  assert.match(papel, /QUEDA A DEBER/, 'y lo que se le queda a deber');
});

test('anular ese abono deja el ticket diciendo la verdad otra vez', async () => {
  // El billete era falso: se anula el abono y el papel vuelve a decir que
  // debe todo, porque el importe se saca de los abonos vivos (regla 3.2).
  const { ticketVenta } = require('../src/modulos/impresion/ticket');
  await entrarAdmin();
  const quien = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Don Billete' }
  })).json.datos.cliente;

  const v = (await aCreditoConAbono(quien.id, 16, '100')).json.datos.venta;
  const abonoId = bd.prepare('SELECT id FROM abonos WHERE venta_id = ?').get(v.id).id;
  await llamar(`/api/clientes/abonos/${abonoId}/anular`, {
    method: 'POST', cuerpo: { motivo: 'El billete era falso' }
  });

  const detalle = (await llamar(`/api/ventas/${v.id}`)).json.datos.venta;
  assert.equal(detalle.abonoCentavos, 0);
  const papel = Buffer.from(ticketVenta(detalle, { negocio: 'X' })).toString('latin1');
  assert.ok(!papel.includes('PAGO AHORA'));
  assert.equal((await ficha(quien.id)).cliente.estado.saldo, 26400, 'debe todo otra vez');
});

test('el dinero que deja entra al cajón, para que el corte cuadre', async () => {
  await entrarAdmin();
  const quien = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Doña Cajón' }
  })).json.datos.cliente;

  const v = (await aCreditoConAbono(quien.id, 16, '100')).json.datos.venta;
  const abono = bd.prepare('SELECT * FROM abonos WHERE venta_id = ?').get(v.id);

  if (abono.caja_id) {
    // Con turno abierto, su renglón de entrada tiene que estar.
    const mov = bd.prepare('SELECT * FROM movimientos_caja WHERE id = ?').get(abono.movimiento_id);
    assert.ok(mov, 'el abono deja su renglón en el cajón');
    assert.equal(mov.tipo, 'entrada');
    assert.equal(mov.centavos, 10000);
  } else {
    // Sin turno abierto se guarda igual —la deuda sí bajó— pero no hay
    // cajón al que entrar, y eso se dice en vez de inventarlo.
    assert.equal(abono.movimiento_id, null);
  }
});

test('no se puede dejar más de lo que se lleva', async () => {
  await entrarAdmin();
  const quien = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Don Exceso' }
  })).json.datos.cliente;

  const r = await aCreditoConAbono(quien.id, 16, '500');
  assert.equal(r.estado, 400);
  assert.match(r.json.error, /más de lo que se lleva/);
  assert.equal((await ficha(quien.id)).cliente.estado.saldo, 0, 'no se guardó nada');
});

test('si lo paga todo no es a crédito, y se dice', async () => {
  await entrarAdmin();
  const quien = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Don Completo' }
  })).json.datos.cliente;

  const r = await aCreditoConAbono(quien.id, 16, '264');
  assert.equal(r.estado, 400);
  assert.match(r.json.error, /no es a crédito/);
});

test('el abono de mostrador no va con una venta de contado', async () => {
  await entrarAdmin();
  const r = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: '300', abono: '100' }
  });
  assert.equal(r.estado, 400);
});

test('el límite se mide contra lo que se le QUEDA a deber, no contra el ticket', async () => {
  // A un cliente pegado a su límite que paga casi todo el ticket no tiene
  // sentido pararle la venta y llamar al gerente por lo poco que queda.
  await entrarAdmin();
  const apretado = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Don Justito', limite: 100 }   // $100
  })).json.datos.cliente;

  // Una marqueta son $264: sin abono se pasa de su límite y pide permiso.
  const sinAbono = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ dieciseisavos: 16 }], formaPago: 'credito', clienteId: apretado.id }
  });
  assert.equal(sinAbono.estado, 403);
  assert.ok(sinAbono.json.requiereAutorizacion);

  // Dejando $200 solo se le quedan $64, que sí caben: pasa sin permiso.
  const conAbono = await aCreditoConAbono(apretado.id, 16, '200');
  assert.equal(conAbono.estado, 201, conAbono.json?.error);
  assert.equal((await ficha(apretado.id)).cliente.estado.saldo, 6400);
});

test('si la venta falla no queda un abono suelto', async () => {
  // Los dos se guardan en la misma transacción. Si el abono se escribiera
  // aparte, un tropiezo dejaría dinero cobrado sin venta que lo explique.
  await entrarAdmin();
  const quien = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Doña Atomica' }
  })).json.datos.cliente;

  const antes = bd.prepare('SELECT COUNT(*) n FROM abonos').get().n;
  const r = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [], formaPago: 'credito', clienteId: quien.id, abono: '100' }
  });
  assert.equal(r.estado, 400, 'una venta vacía no se guarda');
  assert.equal(bd.prepare('SELECT COUNT(*) n FROM abonos').get().n, antes,
               'y su abono tampoco');
});

// ============================================================
// LAS TRES LÍNEAS DEL NEGOCIO  (v5.4)
//
// "Hay clientes para el mayoreo de marquetas, hay clientes para el reparto
//  de agua y hay clientes para las bolsas. Que clientes tenga tres
//  pestañas, una para cada uno."
//
// Lo que se prueba es la decisión de fondo: que las pestañas sean un
// FILTRO y no tres listas. Un cliente partido en tres tendría tres deudas
// y tres límites, y el día que llegue con $500 nadie sabría a cuál van.
// ============================================================

test('un cliente puede comprar las tres cosas y sigue siendo uno', async () => {
  await entrarAdmin();
  const juan = (await llamar('/api/clientes', {
    method: 'POST',
    cuerpo: { nombre: 'Abarrotes Juan', compra_bolsa: 1, compra_agua: 1 }
  })).json.datos.cliente;

  assert.equal(juan.compra_bolsa, 1);
  assert.equal(juan.compra_agua, 1);
  assert.equal(juan.compra_marqueta, 0);

  // Y su cuenta es UNA. Se lleva bolsas a crédito y agua a crédito, y lo
  // que debe es la suma: no dos deudas que nadie sabría cómo cobrar.
  await fiar(juan.id, 4);
  await fiar(juan.id, 4);
  const e = (await ficha(juan.id)).cliente.estado;
  assert.equal(e.saldo, 14000, 'una sola deuda para las dos líneas');
});

test('sin decir qué compra, se marca marquetas: si no, sería invisible', async () => {
  // Un cliente sin ninguna marca no saldría en ninguna pestaña y no habría
  // forma de encontrarlo más que buscándolo por nombre.
  await entrarAdmin();
  const c = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Don Sin Marca' }
  })).json.datos.cliente;
  assert.equal(c.compra_marqueta, 1);
});

test('cada pestaña trae solo los suyos, y el de las tres sale en las tres', async () => {
  await entrarAdmin();
  const soloAgua = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Purificadora Ele', compra_agua: 1 }
  })).json.datos.cliente;
  const todo = (await llamar('/api/clientes', {
    method: 'POST',
    cuerpo: { nombre: 'La Surtidora', compra_marqueta: 1, compra_bolsa: 1, compra_agua: 1 }
  })).json.datos.cliente;

  const dePestana = async (cual) =>
    (await llamar(`/api/clientes?compra=${cual}`)).json.datos.clientes.map((c) => c.id);

  const agua = await dePestana('agua');
  assert.ok(agua.includes(soloAgua.id));
  assert.ok(agua.includes(todo.id), 'el de las tres también es de agua');

  const marqueta = await dePestana('marqueta');
  assert.ok(!marqueta.includes(soloAgua.id), 'el de agua no estorba en marquetas');
  assert.ok(marqueta.includes(todo.id));

  // Y sin pestaña salen todos.
  const todos = (await llamar('/api/clientes')).json.datos.clientes.map((c) => c.id);
  assert.ok(todos.includes(soloAgua.id) && todos.includes(todo.id));
});

test('las cuentas de cada pestaña no dependen de la que se esté viendo', async () => {
  // La pestaña de agua tiene que poder decir cuántos hay aunque ahorita se
  // esté mirando la de bolsas.
  await entrarAdmin();
  const mirandoAgua = (await llamar('/api/clientes?compra=agua')).json.datos;
  const mirandoTodo = (await llamar('/api/clientes')).json.datos;
  assert.deepEqual(mirandoAgua.porLinea, mirandoTodo.porLinea);
  assert.ok(mirandoAgua.porLinea.agua >= 1);
});

test('prender una línea no apaga las otras', async () => {
  await entrarAdmin();
  const c = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Doña Suma', compra_bolsa: 1 }
  })).json.datos.cliente;

  await llamar(`/api/clientes/${c.id}`, { method: 'PUT', cuerpo: { compra_agua: 1 } });
  const d = (await ficha(c.id)).cliente;
  assert.equal(d.compra_bolsa, 1, 'la que ya tenía se queda');
  assert.equal(d.compra_agua, 1);

  await llamar(`/api/clientes/${c.id}`, { method: 'PUT', cuerpo: { compra_bolsa: 0 } });
  assert.equal((await ficha(c.id)).cliente.compra_bolsa, 0, 'y se puede apagar sola');
  assert.equal((await ficha(c.id)).cliente.compra_agua, 1);
});

test('el horario y la ubicación se guardan con el cliente', async () => {
  // El horario no es adorno: una ruta que llega a las 2 a una tienda que
  // cierra a la 1 es un viaje perdido. Y la ubicación es la del QR.
  await entrarAdmin();
  const c = (await llamar('/api/clientes', {
    method: 'POST',
    cuerpo: { nombre: 'Tiendita La Esquina', compra_agua: 1,
              horarioEntrega: 'de 8 a 2 y de 5 a 8',
              referencias: 'La de la puerta azul',
              latitud: 21.0167, longitud: -89.8744 }
  })).json.datos.cliente;

  assert.equal(c.horario_entrega, 'de 8 a 2 y de 5 a 8');
  assert.equal(c.referencias, 'La de la puerta azul');
  assert.equal(c.latitud, 21.0167);

  // Y se pueden cambiar y quitar después.
  await llamar(`/api/clientes/${c.id}`, {
    method: 'PUT', cuerpo: { horarioEntrega: 'solo por la mañana', latitud: '', longitud: '' }
  });
  const d = (await ficha(c.id)).cliente;
  assert.equal(d.horario_entrega, 'solo por la mañana');
  assert.equal(d.latitud, null, 'una ubicación vacía se borra, no se queda a medias');
});

test('una coordenada imposible no se guarda', async () => {
  await entrarAdmin();
  const c = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Don Marte', latitud: 999, longitud: -89 }
  })).json.datos.cliente;
  assert.equal(c.latitud, null, 'fuera del planeta no se guarda');
});

// ============================================================
// EL RECIBO DE UN ABONO  (v5.5)
//
// El cliente entrega dinero y hasta la v5.5 se iba con las manos vacías.
// Lo que importa probar es que el papel diga lo que decía EL DÍA QUE SE
// IMPRIMIÓ, no lo que el cliente debe hoy: si no, una reimpresión de la
// semana que viene lo contradice y el que pierde es quien tiene el papel.
// ============================================================

test('el recibo dice lo que debía, lo que dejó y lo que le queda', async () => {
  await entrarAdmin();
  const c = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Don Recibo' }
  })).json.datos.cliente;

  await fiar(c.id, 16);                                    // se lleva $264
  const a = await llamar(`/api/clientes/${c.id}/abonos`, {
    method: 'POST', cuerpo: { monto: 100 }                 // deja $100
  });

  const previa = await llamar(`/api/impresion/abono/${a.json.datos.abonoId}/previa`);
  assert.equal(previa.estado, 200, previa.json?.error);
  const papel = previa.json.datos.renglones.map((x) => x.t).join('\n');

  assert.match(papel, /RECIBO DE ABONO/);
  assert.match(papel, /Don Recibo/);
  assert.match(papel, /\$100/, 'lo que dejó, en grande');
  assert.match(papel, /Debia:\s*\$264/);
  assert.match(papel, /LE QUEDA:\s*\$164/);
});

test('reimprimir un recibo viejo sigue diciendo lo de ese día', async () => {
  // Es la razón de calcular el saldo anterior a partir de la fecha del
  // abono en vez de guardar un número: sin eso, el segundo abono cambiaría
  // el papel del primero.
  await entrarAdmin();
  const c = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Doña Historia' }
  })).json.datos.cliente;

  await fiar(c.id, 16);                                    // debe $264
  const primero = (await llamar(`/api/clientes/${c.id}/abonos`, {
    method: 'POST', cuerpo: { monto: 100 } })).json.datos.abonoId;
  await llamar(`/api/clientes/${c.id}/abonos`, { method: 'POST', cuerpo: { monto: 50 } });

  const papel = (await llamar(`/api/impresion/abono/${primero}/previa`))
    .json.datos.renglones.map((x) => x.t).join('\n');
  assert.match(papel, /Debia:\s*\$264/, 'lo que debía ANTES del primer abono');
  assert.match(papel, /LE QUEDA:\s*\$164/, 'y no los $114 de hoy');
});

test('el recibo avisa cuando pagó de más', async () => {
  await entrarAdmin();
  const c = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Don Generoso' }
  })).json.datos.cliente;

  await fiar(c.id, 4);                                     // debe $70
  const a = (await llamar(`/api/clientes/${c.id}/abonos`, {
    method: 'POST', cuerpo: { monto: 100 } })).json.datos.abonoId;

  const papel = (await llamar(`/api/impresion/abono/${a}/previa`))
    .json.datos.renglones.map((x) => x.t).join('\n');
  assert.match(papel, /A SU FAVOR: \$30/,
    'un saldo a favor es dinero suyo: el papel tiene que decirlo');
});

test('un recibo anulado sale marcado, con su motivo', async () => {
  await entrarAdmin();
  const c = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Don Anulado' }
  })).json.datos.cliente;

  await fiar(c.id, 16);
  const a = (await llamar(`/api/clientes/${c.id}/abonos`, {
    method: 'POST', cuerpo: { monto: 100 } })).json.datos.abonoId;
  await llamar(`/api/clientes/abonos/${a}/anular`, {
    method: 'POST', cuerpo: { motivo: 'El billete era falso' } });

  const papel = (await llamar(`/api/impresion/abono/${a}/previa`))
    .json.datos.renglones.map((x) => x.t).join('\n');
  assert.match(papel, /ANULADO/);
  assert.match(papel, /billete era falso/);
});

test('el cajero puede recibir un abono; el operario no', async () => {
  // Es lo que hace que se pueda cobrar desde la caja sin llamar a nadie.
  await entrarAdmin();
  const c = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Doña Turno' }
  })).json.datos.cliente;
  await fiar(c.id, 16);

  await entrarPorNombre('Mari', '7777');                   // cajero
  const suyo = await llamar(`/api/clientes/${c.id}/abonos`, {
    method: 'POST', cuerpo: { monto: 50 } });
  assert.equal(suyo.estado, 201);

  await entrarPorNombre('Chema', '5555');                  // operario
  const ajeno = await llamar(`/api/clientes/${c.id}/abonos`, {
    method: 'POST', cuerpo: { monto: 50 } });
  assert.equal(ajeno.estado, 403);

  await entrarAdmin();
});

// ============================================================
// QUÉ LE COMPRA, MARCADO SOLO  (v5.7.1)
// ============================================================

test('la pestaña de cada cliente se marca sola con lo que compra', async () => {
  await entrarAdmin();
  const c = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Doña Etiqueta' }
  })).json.datos.cliente;

  // Recién dado de alta cae en marquetas (es a lo que se dedica la
  // fábrica) y en nada más.
  assert.equal(c.compra_marqueta, 1);
  assert.equal(c.compra_agua, 0);
  assert.equal(c.compra_bolsa, 0);

  // Un producto del agua y uno de nevera, marcados en la ficha del producto.
  const cat = (await llamar('/api/catalogo/categorias', {
    method: 'POST', cuerpo: { nombre: 'Etiquetas' }
  })).json.datos.categoria.id;
  const garrafon = (await llamar('/api/catalogo/productos', {
    method: 'POST', cuerpo: { nombre: 'Garrafón etiqueta', categoriaId: cat, precio: '25', paraAgua: true }
  })).json.datos.producto;
  const bolsa = (await llamar('/api/catalogo/productos', {
    method: 'POST', cuerpo: { nombre: 'Bolsa etiqueta', categoriaId: cat, precio: '18' }
  })).json.datos.producto;
  bd.prepare('UPDATE productos SET para_nevera = 1 WHERE id = ?').run(bolsa.id);

  // Le vende un garrafón: ya es cliente del agua, sin que nadie lo marque.
  const v = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ productoId: garrafon.id, cantidad: 1 }], pago: '25', clienteId: c.id }
  });
  assert.equal(v.estado, 201, v.json?.error);
  let d = (await llamar(`/api/clientes/${c.id}`)).json.datos.cliente;
  assert.equal(d.compra_agua, 1, 'compró agua: sale en la pestaña del agua');
  assert.equal(d.compra_bolsa, 0);

  // Y un PEDIDO de bolsas también lo marca, aunque todavía no se entregue:
  // es lo que lo pone en la preparación de ese reparto.
  const p = await llamar('/api/pedidos', {
    method: 'POST', cuerpo: { clienteId: c.id, lineas: [{ productoId: bolsa.id, cantidad: 10 }] }
  });
  assert.equal(p.estado, 201, p.json?.error);
  d = (await llamar(`/api/clientes/${c.id}`)).json.datos.cliente;
  assert.equal(d.compra_bolsa, 1);
  // Lo de antes no se apaga: comprar agua una vez es un hecho.
  assert.equal(d.compra_agua, 1);
  assert.equal(d.compra_marqueta, 1);
});

// ============================================================
// LOS DE SIEMPRE Y LOS DE UNA VEZ  (v6.4)
// ============================================================

test('un cliente nuevo es de una vez; con cuatro tickets en 30 días es de siempre', async () => {
  await entrarAdmin();
  const chuy = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Don Chuy' }
  })).json.datos.cliente;
  assert.equal(chuy.estado.ritmo.frecuente, false);
  assert.equal(chuy.estado.ritmo.tickets30, 0);
  assert.equal(chuy.estado.ritmo.tope, 4, 'cuatro de fábrica: uno por semana');

  for (let i = 0; i < 4; i++) {
    const r = await llamar('/api/ventas', {
      method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 500, clienteId: chuy.id }
    });
    assert.equal(r.estado, 201);
  }
  const f = await ficha(chuy.id);
  assert.equal(f.cliente.estado.ritmo.tickets30, 4);
  assert.equal(f.cliente.estado.ritmo.frecuente, true);
  assert.equal(f.cliente.estado.ritmo.diasSinComprar, 0, 'compró hoy');

  // Las pestañas: sale en «de siempre» y no en «de una vez».
  const siempre = (await llamar('/api/clientes?ritmo=frecuente')).json.datos;
  assert.ok(siempre.clientes.some((c) => c.id === chuy.id));
  const unaVez = (await llamar('/api/clientes?ritmo=ocasional')).json.datos;
  assert.ok(!unaVez.clientes.some((c) => c.id === chuy.id));
  assert.equal(siempre.porLinea.frecuentes + siempre.porLinea.ocasionales, siempre.porLinea.todos,
    'todos están en una de las dos');
});

test('el número de tickets que hace a uno «de siempre» se configura', async () => {
  bd.prepare("UPDATE configuracion SET valor = '20' WHERE clave = 'clientes_frecuente_tickets'").run();
  const siempre = (await llamar('/api/clientes?ritmo=frecuente')).json.datos;
  assert.equal(siempre.clientes.length, 0, 'con veinte, nadie llega');
  bd.prepare("UPDATE configuracion SET valor = '4' WHERE clave = 'clientes_frecuente_tickets'").run();
});

// ============================================================
// LA FICHA COMPLETA  (v6.9)
// ============================================================
//
// "Por fin terminé el diseño que quiero para clientes. Tenemos casi todos
//  los datos, los que no tengamos los agregas."

test('se dan de alta los datos fiscales, la zona y la ventana de recepción', async () => {
  await entrarAdmin();
  const r = await llamar('/api/clientes', {
    method: 'POST',
    cuerpo: {
      nombre: 'Cap. Mateo Villanueva', negocio: 'Mariscos El Faro',
      razonSocial: 'OPERADORA GASTRONÓMICA DEL LITORAL S.A. DE C.V.',
      rfc: 'ogl180422k98', regimenFiscal: '601',
      correo: 'facturas@elfaro.com.mx',
      zona: 'Sector 03 (Muelle Pesquero)', frecuencia: 'diario',
      horaDesde: '6:30', horaHasta: '09:00',
      metodoPago: 'credito', diasPlazo: 15, limite: 45000,
      garrafonesLimite: 20, garrafonDeposito: 120
    }
  });
  assert.equal(r.estado, 201);
  const c = r.json.datos.cliente;

  assert.equal(c.razon_social, 'OPERADORA GASTRONÓMICA DEL LITORAL S.A. DE C.V.');
  assert.equal(c.rfc, 'OGL180422K98', 'el RFC se guarda en mayúsculas, como la constancia');
  assert.equal(c.regimen_fiscal, '601');
  assert.equal(c.zona, 'Sector 03 (Muelle Pesquero)');
  assert.equal(c.frecuencia, 'diario');
  assert.equal(c.hora_desde, '06:30', 'la hora se normaliza a dos dígitos');
  assert.equal(c.hora_hasta, '09:00');
  assert.equal(c.metodo_pago, 'credito');
  assert.equal(c.garrafones_limite, 20);
  assert.equal(c.garrafon_deposito_centavos, 12000);

  faro = c;
});

test('una hora mal escrita o un régimen inventado no pasan', async () => {
  let r = await llamar(`/api/clientes/${faro.id}`, {
    method: 'PUT', cuerpo: { horaDesde: 'a las seis' }
  });
  assert.equal(r.estado, 400);

  r = await llamar(`/api/clientes/${faro.id}`, {
    method: 'PUT', cuerpo: { regimenFiscal: '999' }
  });
  assert.equal(r.estado, 400);

  r = await llamar(`/api/clientes/${faro.id}`, {
    method: 'PUT', cuerpo: { frecuencia: 'cuando sea' }
  });
  assert.equal(r.estado, 400);
});

test('la pantalla recibe los catálogos y los cuatro números de arriba', async () => {
  const d = (await llamar('/api/clientes')).json.datos;
  assert.ok(d.frecuencias.some((f) => f.clave === 'diario'));
  assert.ok(d.metodosPago.some((m) => m.clave === 'credito'));
  assert.ok(d.regimenes.some((x) => x.clave === '601'));

  const c = d.cartera;
  assert.equal(typeof c.conCredito, 'number');
  assert.equal(typeof c.nuevosMes, 'number');
  assert.equal(typeof c.operativos, 'number');
  assert.ok(c.conCredito >= 1, 'El Faro tiene límite y plazo');
});

// ---------- LOS PRECIOS ACORDADOS ----------

test('el precio acordado con un cliente le gana a la lista y al mostrador', async () => {
  await entrarAdmin();
  // Un producto de piezas, que es donde las listas de mayoreo no llegaban.
  const cat = (await llamar('/api/catalogo/categorias', {
    method: 'POST', cuerpo: { nombre: 'Agua' } })).json.datos.categoria;
  const garrafon = (await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: 'Garrafón 20L', categoriaId: cat.id, tipo: 'simple',
              precio: 42, codigo: 'G20' } })).json.datos.producto;

  // De mostrador cuesta $42; a El Faro se le deja en $35.
  const r = await llamar(`/api/clientes/${faro.id}/precios`, {
    method: 'PUT', cuerpo: { productoId: garrafon.id, precio: 35, volumen: '12 por semana' }
  });
  assert.equal(r.estado, 200);
  const suyo = r.json.datos.precios.find((p) => p.producto_id === garrafon.id);
  assert.equal(suyo.centavos, 3500);
  assert.equal(suyo.lista_centavos, 4200);
  assert.equal(suyo.volumen, '12 por semana');
  assert.ok(suyo.diferencia < 0, 'y se ve cuánto por debajo del mostrador quedó');

  // Al cobrarle, se le cobra el suyo. Dos piezas: el precio es por pieza.
  const venta = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ productoId: garrafon.id, cantidad: 2 }],
              formaPago: 'efectivo', pago: 100, clienteId: faro.id }
  });
  assert.equal(venta.estado, 201);
  assert.equal(venta.json.datos.venta.total_centavos, 7000, '2 × $35, no 2 × $42');

  // Y a otro cliente se le sigue cobrando el de mostrador.
  const otra = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ productoId: garrafon.id, cantidad: 2 }],
              formaPago: 'efectivo', pago: 100, clienteId: mary.id }
  });
  assert.equal(otra.json.datos.venta.total_centavos, 8400, 'a Mary, $42 cada uno');

  garrafonId = garrafon.id;
});

test('quitar el precio acordado devuelve al de mostrador, no lo deja en cero', async () => {
  const r = await llamar(`/api/clientes/${faro.id}/precios`, {
    method: 'PUT', cuerpo: { productoId: garrafonId, precio: '' }
  });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.precios.length, 0);

  const venta = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ productoId: garrafonId, cantidad: 1 }],
              formaPago: 'efectivo', pago: 100, clienteId: faro.id }
  });
  assert.equal(venta.json.datos.venta.total_centavos, 4200);
});

test('el precio acordado NO pide autorización: es su precio normal', async () => {
  await entrarAdmin();
  await llamar(`/api/clientes/${faro.id}/precios`, {
    method: 'PUT', cuerpo: { productoId: garrafonId, precio: 35 }
  });
  // La cajera, que no puede poner precios especiales, le cobra el suyo sin
  // que nadie le pida un PIN: es lo que compra todos los días.
  await entrarPorNombre('Mari', '7777');
  const venta = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ productoId: garrafonId, cantidad: 1 }],
              formaPago: 'efectivo', pago: 100, clienteId: faro.id }
  });
  assert.equal(venta.estado, 201);
  assert.equal(venta.json.datos.venta.total_centavos, 3500);

  const linea = bd.prepare(`
    SELECT * FROM venta_lineas WHERE venta_id = ?`).get(venta.json.datos.venta.id);
  assert.equal(linea.precio_lista_centavos, null,
    'no es un descuento de una vez: es su precio, y no lleva ni motivo ni autorización');
  await entrarAdmin();
});

// ---------- LOS GARRAFONES EN RESGUARDO ----------

test('los garrafones se suman de sus movimientos, no de un contador', async () => {
  let r = await llamar(`/api/clientes/${faro.id}/garrafones`, {
    method: 'POST', cuerpo: { cuantos: 12, motivo: 'Primera entrega' }
  });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.retenidos, 12);
  assert.equal(r.json.datos.limite, 20);
  assert.equal(r.json.datos.depositoCentavos, 12 * 12000, '12 garrafones × $120 de garantía');
  assert.equal(r.json.datos.pasado, false);

  // Devuelve cinco.
  r = await llamar(`/api/clientes/${faro.id}/garrafones`, {
    method: 'POST', cuerpo: { cuantos: -5 }
  });
  assert.equal(r.json.datos.retenidos, 7);

  // No puede devolver más de los que trae.
  r = await llamar(`/api/clientes/${faro.id}/garrafones`, {
    method: 'POST', cuerpo: { cuantos: -20 }
  });
  assert.equal(r.estado, 409);
});

test('pasarse del límite avisa pero NO se rechaza: el garrafón ya se lo llevó', async () => {
  const r = await llamar(`/api/clientes/${faro.id}/garrafones`, {
    method: 'POST', cuerpo: { cuantos: 20 }
  });
  assert.equal(r.estado, 201, 'esconderlo no lo trae de vuelta');
  assert.equal(r.json.datos.retenidos, 27);
  assert.equal(r.json.datos.pasado, true);
  assert.match(r.json.datos.aviso, /27/);
});

test('un movimiento mal capturado se anula y la cuenta se rehace sola', async () => {
  const historial = (await llamar(`/api/clientes/${faro.id}/garrafones`)).json.datos.historial;
  const ultimo = historial[0];
  assert.equal(ultimo.cuantos, 20);

  let r = await llamar(`/api/clientes/garrafones/${ultimo.id}/anular`, {
    method: 'POST', cuerpo: {}
  });
  assert.equal(r.estado, 400, 'sin motivo no se anula');

  r = await llamar(`/api/clientes/garrafones/${ultimo.id}/anular`, {
    method: 'POST', cuerpo: { motivo: 'Se apuntó dos veces' }
  });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.retenidos, 7, 'vuelve a lo que había');
  assert.equal(r.json.datos.pasado, false);

  // No se borra: sigue ahí, marcado.
  const quedan = bd.prepare(
    'SELECT COUNT(*) n FROM garrafones_movimientos WHERE cliente_id = ?').get(faro.id).n;
  assert.equal(quedan, 3, 'los tres movimientos siguen guardados');
});

test('la garantía de los envases va APARTE del saldo', async () => {
  const f = await ficha(faro.id);
  assert.equal(f.garrafones.retenidos, 7);
  assert.equal(f.garrafones.depositoCentavos, 7 * 12000);
  // Su deuda es de lo que compró, no de lo que dejó en garantía: una
  // garantía no es una deuda, y sumarla mandaría a cobrar dinero que
  // nadie debe.
  assert.equal(f.cliente.estado.saldo, 0);
});

test('la ficha trae su consumo de los últimos 30 días', async () => {
  const f = await ficha(faro.id);
  assert.equal(typeof f.cliente.estado.consumo.kilos, 'number');
  assert.ok(f.cliente.estado.consumo.garrafones >= 1,
    'los garrafones que compró se cuentan aparte de los kilos de hielo');
});

test('solo el gerente pone precios acordados', async () => {
  await entrarPorNombre('Mari', '7777');
  const r = await llamar(`/api/clientes/${faro.id}/precios`, {
    method: 'PUT', cuerpo: { productoId: garrafonId, precio: 1 }
  });
  assert.equal(r.estado, 403, 'bajarle el precio a alguien es decidir cuánto gana la fábrica');
  await entrarAdmin();
});

test('el papel que se lleva el cliente trae su razón social y su RFC', async () => {
  await entrarAdmin();
  const venta = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ dieciseisavos: 16 }], formaPago: 'credito', clienteId: faro.id }
  });
  assert.equal(venta.estado, 201);

  const { renglones } = (await llamar(
    `/api/impresion/venta/${venta.json.datos.venta.id}/previa`)).json.datos;
  const papel = renglones.map((x) => x.t).join('\n');
  assert.match(papel, /OPERADORA GASTRON/, 'la razón social, para quien factura');
  assert.match(papel, /RFC: OGL180422K98/);
});
