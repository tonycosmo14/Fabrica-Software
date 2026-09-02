/**
 * PRUEBAS DEL HISTORIAL Y DE BORRAR DE VERDAD  (v1.8)
 *
 * Dos cosas que se tocan entre sí:
 *
 *  · EL HISTORIAL sale de las tablas de siempre, no de una copia. Por eso
 *    cancelar un ticket se refleja solo, y por eso lo que se borra deja de
 *    salir. Una tabla "historial" aparte se desincronizaría el primer día.
 *
 *  · BORRAR es distinto de DAR DE BAJA. Solo se borra lo que NUNCA SE USÓ:
 *    en cuanto algo se vendió, su nombre está en tickets ya cobrados, y
 *    borrarlo dejaría el histórico mintiendo.
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, entrarPorNombre, bd, preparar } = fabricaDePrueba('historial');

const ADMIN = { usuario: 'tony', contrasena: 'clavelarga1' };
let tony, mari, cat, coca, basura, cliente;

/** La autorización que pide todo lo que se borra. */
const conContrasena = (extra = {}) => ({
  autorizacion: { usuarioId: tony.id, contrasena: ADMIN.contrasena }, ...extra
});

preparar(async () => {
  await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Mari', rol: 'cajero', pin: '7777' }
  });
  const usuarios = (await llamar('/api/auth/usuarios-disponibles')).json.datos.usuarios;
  tony = usuarios.find((u) => u.nombre === 'Tony');
  mari = usuarios.find((u) => u.nombre === 'Mari');

  cat = (await llamar('/api/catalogo/categorias', {
    method: 'POST', cuerpo: { nombre: 'Refrescos' }
  })).json.datos.categoria;

  coca = (await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: 'Coca 600', categoriaId: cat.id, tipo: 'simple', precio: 25, codigo: 'COCA' }
  })).json.datos.producto;

  // El producto de prueba que alguien dio de alta sin querer: eso es lo que
  // Tony quiere poder borrar.
  basura = (await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: 'prod23', categoriaId: cat.id, tipo: 'simple', precio: 23 }
  })).json.datos.producto;

  cliente = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Se escribió mal' }
  })).json.datos.cliente;
});

// ============================================================
// BORRAR LO QUE NUNCA SE USÓ
// ============================================================

test('un producto que nunca se vendió se borra de verdad', async () => {
  const r = await llamar(`/api/catalogo/productos/${basura.id}`, {
    method: 'DELETE', cuerpo: conContrasena()
  });
  assert.equal(r.estado, 200);

  // De verdad: la fila ya no existe, no es que esté marcada.
  const quedan = bd.prepare('SELECT COUNT(*) n FROM productos WHERE id = ?').get(basura.id).n;
  assert.equal(quedan, 0);
});

test('borrar sin contraseña no borra nada', async () => {
  const otro = (await llamar('/api/catalogo/productos', {
    method: 'POST', cuerpo: { nombre: 'sobra', categoriaId: cat.id, tipo: 'simple', precio: 1 }
  })).json.datos.producto;

  const r = await llamar(`/api/catalogo/productos/${otro.id}`, { method: 'DELETE', cuerpo: {} });
  assert.equal(r.estado, 403);
  assert.equal(r.json.requiereContrasena, true);
  assert.ok(r.json.administradores.length > 0, 'la pantalla necesita a quién ofrecer');
  assert.equal(bd.prepare('SELECT COUNT(*) n FROM productos WHERE id = ?').get(otro.id).n, 1);
});

test('con el PIN en vez de la contraseña tampoco', async () => {
  const otro = bd.prepare("SELECT id FROM productos WHERE nombre = 'sobra'").get();
  const r = await llamar(`/api/catalogo/productos/${otro.id}`, {
    method: 'DELETE', cuerpo: { autorizacion: { usuarioId: tony.id, contrasena: '1111' } }
  });
  assert.equal(r.estado, 403);
  assert.match(r.json.error, /contraseña incorrecta/i);
});

test('un gerente no puede borrar, aunque sepa su propia contraseña', async () => {
  await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Lupe', rol: 'gerente', pin: '8888', contrasena: 'lupelarga1' }
  });
  const lupe = (await llamar('/api/auth/usuarios-disponibles')).json.datos.usuarios
    .find((u) => u.nombre === 'Lupe');
  const otro = bd.prepare("SELECT id FROM productos WHERE nombre = 'sobra'").get();

  const r = await llamar(`/api/catalogo/productos/${otro.id}`, {
    method: 'DELETE', cuerpo: { autorizacion: { usuarioId: lupe.id, contrasena: 'lupelarga1' } }
  });
  assert.equal(r.estado, 403);
  assert.match(r.json.error, /no es administrador/i);
});

// ============================================================
// LO QUE YA SE VENDIÓ NO SE BORRA
// ============================================================

test('un producto ya vendido se niega a borrarse y dice qué hacer', async () => {
  await entrarAdmin();
  await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ codigo: 'COCA', cantidad: 2 }] }
  });

  const r = await llamar(`/api/catalogo/productos/${coca.id}`, {
    method: 'DELETE', cuerpo: conContrasena()
  });
  assert.equal(r.estado, 409);
  assert.equal(r.json.sugerencia, 'baja');
  assert.match(r.json.error, /dale de baja/i);
  assert.equal(bd.prepare('SELECT COUNT(*) n FROM productos WHERE id = ?').get(coca.id).n, 1);
});

test('y ese producto sí se puede dar de baja, que es lo que toca', async () => {
  const r = await llamar(`/api/catalogo/productos/${coca.id}/baja`, { method: 'POST', cuerpo: {} });
  assert.equal(r.estado, 200);
  assert.equal(bd.prepare('SELECT activo FROM productos WHERE id = ?').get(coca.id).activo, 0);
});

test('el ticket viejo sigue diciendo lo mismo aunque el producto se fuera', async () => {
  // El concepto y el precio están COPIADOS en la línea (regla 3.5), así que
  // el papel del cliente no cambia pase lo que pase con el catálogo.
  const linea = bd.prepare(
    'SELECT concepto, precio_centavos FROM venta_lineas WHERE producto_id = ?').get(coca.id);
  assert.equal(linea.concepto, 'Coca 600');
  assert.equal(linea.precio_centavos, 5000);
});

test('una categoría con productos dentro no se borra', async () => {
  const r = await llamar(`/api/catalogo/categorias/${cat.id}`, {
    method: 'DELETE', cuerpo: conContrasena()
  });
  assert.equal(r.estado, 409);
  assert.match(r.json.error, /productos? dentro/i);
});

test('vacía sí se borra', async () => {
  const vacia = (await llamar('/api/catalogo/categorias', {
    method: 'POST', cuerpo: { nombre: 'Se creó sin querer' }
  })).json.datos.categoria;

  const r = await llamar(`/api/catalogo/categorias/${vacia.id}`, {
    method: 'DELETE', cuerpo: conContrasena()
  });
  assert.equal(r.estado, 200);
  assert.equal(bd.prepare('SELECT COUNT(*) n FROM categorias WHERE id = ?').get(vacia.id).n, 0);
});

test('un cliente sin movimientos se borra; con movimientos, no', async () => {
  const r = await llamar(`/api/clientes/${cliente.id}`, {
    method: 'DELETE', cuerpo: conContrasena()
  });
  assert.equal(r.estado, 200);

  const conDeuda = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Doña Mary' }
  })).json.datos.cliente;
  await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ dieciseisavos: 4 }], formaPago: 'credito', clienteId: conDeuda.id }
  });

  const negado = await llamar(`/api/clientes/${conDeuda.id}`, {
    method: 'DELETE', cuerpo: conContrasena()
  });
  assert.equal(negado.estado, 409);
  assert.equal(negado.json.sugerencia, 'baja');
});

// ============================================================
// BORRAR UN MOVIMIENTO DEL CAJÓN
// ============================================================

test('el administrador borra un gasto capturado por error', async () => {
  const m = await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', concepto: 'Gasolina', monto: 200 }
  });
  const id = m.json.datos.movimientoId;

  const r = await llamar(`/api/caja/movimientos/${id}`, {
    method: 'DELETE', cuerpo: conContrasena()
  });
  assert.equal(r.estado, 200);
  assert.equal(bd.prepare('SELECT COUNT(*) n FROM movimientos_caja WHERE id = ?').get(id).n, 0);
});

test('lo que frena al cajero es la contraseña, no la pantalla', async () => {
  // Es el mismo patrón de siempre: el cajero puede pedirlo, pero solo pasa
  // si el administrador está ahí y escribe su contraseña. Sin ella, no.
  const uno = await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', concepto: 'Gasto A', monto: 50 }
  });
  const otro = await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', concepto: 'Gasto B', monto: 50 }
  });

  await entrarPorNombre('Mari', '7777');

  const solo = await llamar(`/api/caja/movimientos/${uno.json.datos.movimientoId}`, {
    method: 'DELETE', cuerpo: {}
  });
  assert.equal(solo.estado, 403, 'sola no puede');
  assert.equal(
    bd.prepare('SELECT COUNT(*) n FROM movimientos_caja WHERE id = ?')
      .get(uno.json.datos.movimientoId).n, 1, 'y no se borró nada');

  const conElJefe = await llamar(`/api/caja/movimientos/${otro.json.datos.movimientoId}`, {
    method: 'DELETE', cuerpo: conContrasena()
  });
  assert.equal(conElJefe.estado, 200, 'con el administrador ahí escribiendo, sí');

  await entrarAdmin();
});

test('borrar deja constancia en la bitácora', () => {
  // Lo único que no se puede borrar nunca es que alguien borró.
  const n = bd.prepare(
    "SELECT COUNT(*) n FROM bitacora WHERE accion LIKE '%eliminad%' OR accion LIKE '%borrado%'"
  ).get().n;
  assert.ok(n >= 3, `deberían quedar rastros de lo borrado, hay ${n}`);
});

// ============================================================
// EL HISTORIAL
// ============================================================

test('el historial trae ventas, gastos, entradas y abonos juntos', async () => {
  await entrarAdmin();
  await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'entrada', concepto: 'Fondo del banco', monto: 500 }
  });

  const { movimientos } = (await llamar('/api/historial')).json.datos;
  const tipos = new Set(movimientos.map((m) => m.tipo));
  assert.ok(tipos.has('venta'), 'faltan las ventas');
  assert.ok(tipos.has('entrada'), 'faltan las entradas');

  // Del más nuevo al más viejo, siempre.
  for (let i = 1; i < movimientos.length; i++) {
    assert.ok(movimientos[i - 1].fecha >= movimientos[i].fecha, 'salió desordenado');
  }
});

test('cada renglón dice quién lo hizo', async () => {
  const { movimientos } = (await llamar('/api/historial')).json.datos;
  assert.ok(movimientos.every((m) => m.quien), 'todos tienen que tener nombre');
});

test('se filtra por tipo', async () => {
  const { movimientos } = (await llamar('/api/historial?tipos=gasto,entrada')).json.datos;
  assert.ok(movimientos.length > 0);
  assert.ok(movimientos.every((m) => m.tipo === 'gasto' || m.tipo === 'entrada'));
});

test('se filtra por persona', async () => {
  const mios = (await llamar(`/api/historial?usuarioId=${tony.id}`)).json.datos;
  assert.ok(mios.movimientos.length > 0);
  assert.ok(mios.movimientos.every((m) => m.quien === 'Tony'));

  const suyos = (await llamar(`/api/historial?usuarioId=${mari.id}`)).json.datos;
  assert.equal(suyos.movimientos.length, 0, 'Mari todavía no ha hecho nada');
});

test('se filtra por fechas', async () => {
  const hoy = new Date().toISOString().slice(0, 10);
  const conHoy = (await llamar(`/api/historial?desde=${hoy}&hasta=${hoy}`)).json.datos;
  assert.ok(conHoy.movimientos.length > 0);

  const viejo = (await llamar('/api/historial?hasta=2020-01-01')).json.datos;
  assert.equal(viejo.movimientos.length, 0);
});

test('se filtra por horas', async () => {
  // De medianoche a medianoche cae todo; una ventana imposible, nada.
  const todo = (await llamar('/api/historial?horaDesde=00:00&horaHasta=23:59')).json.datos;
  assert.ok(todo.movimientos.length > 0);

  const nada = (await llamar('/api/historial?horaDesde=23:58&horaHasta=23:59')).json.datos;
  assert.ok(nada.movimientos.length <= todo.movimientos.length);
});

test('una fecha que no se entiende se rechaza en vez de ignorarse', async () => {
  // Ignorarla daría una lista que parece filtrada y no lo está, que es la
  // forma más fácil de sacar una conclusión equivocada.
  for (const mala of ['ayer', '24/08/2026', '2026-13-45x']) {
    const r = await llamar(`/api/historial?desde=${encodeURIComponent(mala)}`);
    assert.equal(r.estado, 400, `debería rechazar ${mala}`);
  }
  const horaMala = await llamar('/api/historial?horaDesde=tarde');
  assert.equal(horaMala.estado, 400);
});

test('el resumen suma lo filtrado, no la página', async () => {
  const { resumen } = (await llamar('/api/historial?limite=1')).json.datos;
  const cobrado = bd.prepare(
    'SELECT COALESCE(SUM(total_centavos),0) n FROM ventas WHERE cancelada_en IS NULL').get().n;
  assert.equal(resumen.cobrado, cobrado, 'el total es de todo lo filtrado');
});

test('cancelar un ticket se refleja solo en el resumen', async () => {
  const v = (await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }] }
  })).json.datos.venta;

  const antes = (await llamar('/api/historial')).json.datos.resumen;
  await llamar(`/api/ventas/${v.id}/cancelar`, {
    method: 'POST', cuerpo: { motivo: 'Se equivocó' }
  });
  const despues = (await llamar('/api/historial')).json.datos.resumen;

  assert.equal(despues.cobrado, antes.cobrado - v.total_centavos,
               'el historial sale de las tablas de siempre, no de una copia');
  assert.equal(despues.canceladas, antes.canceladas + 1);
});

test('el historial es solo del administrador', async () => {
  await entrarPorNombre('Mari', '7777');
  assert.equal((await llamar('/api/historial')).estado, 403);
  assert.equal((await llamar('/api/historial/quienes')).estado, 403);
});


// ============================================================
// LA VENTANA DE HOY Y EL "CARGAR MÁS"  (v2.4)
//
// Dentro de tres años esta tabla va a tener cientos de miles de renglones.
// Abrir el historial no puede querer decir "tráemelos todos": se abre con
// lo de hoy y lo de más atrás se pide a propósito.
// ============================================================

test('el historial se abre con lo del día de hoy, no con todo', async () => {
  await entrarAdmin();

  // Una venta de hace tres años, metida directo: por la API no se puede
  // cobrar en el pasado, y es justo lo que hay que dejar fuera.
  const vieja = bd.prepare('SELECT id FROM ventas ORDER BY fecha DESC LIMIT 1').get();
  bd.prepare("UPDATE ventas SET fecha = '2023-04-10T18:00:00.000Z' WHERE id = ?").run(vieja.id);

  const r = (await llamar('/api/historial')).json.datos;
  assert.equal(r.ventana, 'hoy');
  assert.ok(!r.movimientos.some((m) => m.id === vieja.id),
            'lo de hace tres años no se enseña de entrada');
});

test('con fechas puestas, la ventana de hoy se quita', async () => {
  await entrarAdmin();
  const r = (await llamar('/api/historial?desde=2023-01-01')).json.datos;
  assert.equal(r.ventana, 'filtro');
  assert.ok(r.movimientos.some((m) => String(m.fecha).startsWith('2023-')),
            'quien pide 2023 es que sabe lo que pide');
});

test('buscar por número tampoco se queda encerrado en hoy', async () => {
  await entrarAdmin();
  const vieja = bd.prepare(
    "SELECT * FROM ventas WHERE fecha LIKE '2023-%' LIMIT 1"
  ).get();
  const r = (await llamar(`/api/historial?folio=${vieja.folio_anual}`)).json.datos;
  assert.equal(r.ventana, 'filtro');
  assert.ok(r.movimientos.some((m) => m.id === vieja.id),
            'el ticket que se busca aparece aunque sea viejo');
});

test('cargar más trae lo anterior al cursor, sin repetir ni saltarse nada', async () => {
  await entrarAdmin();

  const primera = (await llamar('/api/historial?desde=2020-01-01&limite=3')).json.datos;
  assert.equal(primera.movimientos.length, 3);
  assert.equal(primera.hayMas, true, 'hay más atrás');
  assert.ok(primera.cursor, 'y viene el instante por donde seguir');

  const segunda = (await llamar(
    `/api/historial?desde=2020-01-01&limite=3&antesDe=${encodeURIComponent(primera.cursor)}`
  )).json.datos;

  const ids = new Set(primera.movimientos.map((m) => m.id));
  for (const m of segunda.movimientos) {
    assert.ok(!ids.has(m.id), `${m.id} salió dos veces`);
    assert.ok(m.fecha < primera.cursor, 'todo lo del segundo tirón es más viejo que el corte');
  }
});

test('el último tirón dice que ya no hay más', async () => {
  await entrarAdmin();
  const todo = (await llamar('/api/historial?desde=2020-01-01&limite=500')).json.datos;
  assert.equal(todo.hayMas, false, 'cabe entero: el botón de cargar más sobra');
});

test('los totales no se paginan: son de todo el filtro, no del tirón', async () => {
  await entrarAdmin();
  const entero = (await llamar('/api/historial?desde=2020-01-01&limite=500')).json.datos;
  const pedacito = (await llamar('/api/historial?desde=2020-01-01&limite=2')).json.datos;

  assert.equal(pedacito.movimientos.length, 2);
  assert.deepEqual(pedacito.resumen, entero.resumen,
                   'cargar más no puede cambiar los totales de arriba');
});

test('un cursor con basura se rechaza en vez de traer cualquier cosa', async () => {
  await entrarAdmin();
  const r = await llamar('/api/historial?antesDe=el-jueves');
  assert.equal(r.estado, 400);
});


// ============================================================
// QUÉ PASÓ EN CADA RENGLÓN
// ============================================================

test('cada renglón dice qué clase de movimiento fue', async () => {
  await entrarAdmin();
  const { movimientos } = (await llamar('/api/historial?desde=2020-01-01&limite=500')).json.datos;

  for (const m of movimientos) {
    assert.ok(m.que && m.que.clave && m.que.texto,
              `un renglón sin "qué": ${m.tipo} ${m.id}`);
  }

  const claves = new Set(movimientos.map((m) => m.que.clave));
  assert.ok(claves.has('venta'), 'las ventas se llaman ventas');
});

test('una devolución no se ve igual que una cancelación', async () => {
  await entrarAdmin();
  const v = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 4 }], pago: 100 }
  });
  const id = v.json.datos.venta.id;
  await llamar(`/api/ventas/${id}/devolver`, {
    method: 'POST', cuerpo: { motivo: 'espera' }
  });

  const { movimientos } = (await llamar('/api/historial?limite=200')).json.datos;
  const fila = movimientos.find((m) => m.id === id);
  assert.equal(fila.que.clave, 'devolucion',
               'el dinero salió del cajón: eso no es una cancelación cualquiera');
});

test('un ticket de mayoreo se distingue de una venta de mostrador', async () => {
  await entrarAdmin();
  const { movimientos } = (await llamar('/api/historial?desde=2020-01-01&limite=500')).json.datos;
  const mayoreo = movimientos.filter((m) => m.lista_tipo === 'mayoreo' && !m.cancelada_en
                                            && !m.cambio_de && !m.cambiado_por
                                            && m.forma_pago !== 'credito');
  for (const m of mayoreo) assert.equal(m.que.clave, 'mayoreo');
});


// ============================================================
// LOS ATAJOS DE TIEMPO  (v3.9)
//
// "Hoy" y "las últimas 24 horas" NO son lo mismo: a las diez de la mañana,
// hoy son diez horas y las últimas 24 llegan hasta ayer a las diez, donde
// estuvo el turno de la tarde. Cuando algo no cuadró, la pregunta casi
// siempre es la segunda.
// ============================================================

test('las últimas horas van por instante, no por día', async () => {
  await entrarAdmin();

  // Una venta de hace 30 horas: es de ayer, así que "hoy" no la trae.
  const hace30 = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
  const v = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }] } });
  bd.prepare('UPDATE ventas SET fecha = ? WHERE id = ?')
    .run(hace30, v.json.datos.venta.id);

  const hoy = (await llamar('/api/historial')).json.datos;
  assert.ok(!hoy.movimientos.some((m) => m.id === v.json.datos.venta.id),
    'de hoy no es');

  const dosDias = (await llamar('/api/historial?ultimasHoras=48')).json.datos;
  assert.ok(dosDias.movimientos.some((m) => m.id === v.json.datos.venta.id),
    'en las últimas 48 horas sí cae');
  assert.equal(dosDias.ventana, 'filtro',
    'pedir horas quita la ventana de hoy, igual que poner fechas');

  const un_dia = (await llamar('/api/historial?ultimasHoras=24')).json.datos;
  assert.ok(!un_dia.movimientos.some((m) => m.id === v.json.datos.venta.id),
    'en las últimas 24 no, porque fue hace 30');
});

test('el resumen de las últimas horas cuenta lo mismo que la lista', async () => {
  await entrarAdmin();
  const d = (await llamar('/api/historial?ultimasHoras=48')).json.datos;
  const ventas = d.movimientos.filter((m) => m.tipo === 'venta' && !m.cancelada);
  assert.equal(d.resumen.ventas, ventas.length,
    'los totales de arriba son de lo mismo que la tabla');
});

test('unas horas que no se entienden se rechazan', async () => {
  await entrarAdmin();
  for (const v of ['cero', '0', '-3', '99999']) {
    const r = await llamar(`/api/historial?ultimasHoras=${encodeURIComponent(v)}`);
    assert.equal(r.estado, 400, v);
  }
});
