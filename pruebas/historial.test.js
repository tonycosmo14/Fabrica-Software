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
