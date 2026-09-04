/**
 * PRUEBAS DE LOS PEDIDOS  (v5.6)
 *
 * ============================================================
 * LO QUE ESTE ARCHIVO CUIDA
 * ============================================================
 *
 * Un pedido es una PROMESA con precio, y las promesas se rompen en sitios
 * concretos. Estos son los que cuestan dinero o cuestan un cliente:
 *
 *   · Que el precio quede COPIADO al tomarlo. Si el lunes suben los
 *     precios, el pedido del sábado tiene que cobrarse a lo que dice el
 *     papel que el repartidor lleva en la mano.
 *
 *   · Que la dirección y el horario queden COPIADOS. Si el cliente se
 *     muda, la nota de un pedido viejo tiene que seguir diciendo a dónde
 *     se llevó.
 *
 *   · Que un pedido NO sea una venta hasta que se entrega. Mientras esté
 *     pendiente no puede aparecer en el corte del día ni sacar hielo del
 *     cuarto frío.
 *
 *   · Que la PREPARACIÓN sume bien y parta el agua del hielo. De menos, se
 *     queda un cliente sin su pedido; de más, el hielo se derrite en la
 *     camioneta.
 *
 *   · Que nada se borre (regla 3.4) y que un pedido entregado no se pueda
 *     entregar dos veces.
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, entrarPorNombre, crearUsuario, bd,
        preparar } = fabricaDePrueba('pedidos');

let tienda, sinUbicacion, garrafon, bolsa, mayoreo;

const hoy = () => new Date().toISOString().slice(0, 10);
const manana = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

preparar(async () => {
  await crearUsuario('Mari', 'cajero', '7777');
  await crearUsuario('Beto', 'repartidor', '8888');
  await crearUsuario('Leila', 'gerente', '9999');

  // Una lista de mayoreo, para comprobar que el pedido cotiza con la del
  // cliente y no con la de público.
  mayoreo = (await llamar('/api/ventas/precios/listas', {
    method: 'POST', cuerpo: { nombre: 'Mayoreo 1' }
  })).json.datos.lista;
  await llamar(`/api/ventas/precios/${mayoreo.id}`, {
    method: 'PUT',
    cuerpo: { precios: [{ dieciseisavos: 16, pesos: 240 }, { dieciseisavos: 8, pesos: 125 }] }
  });
  await llamar(`/api/ventas/precios/listas/${mayoreo.id}/predeterminada`,
               { method: 'PUT', cuerpo: {} });

  const cat = (await llamar('/api/catalogo/categorias', {
    method: 'POST', cuerpo: { nombre: 'Reparto' }
  })).json.datos.categoria.id;

  garrafon = (await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: 'Garrafón 20 L', categoriaId: cat, precio: '25', codigo: 'G20' }
  })).json.datos.producto;
  bolsa = (await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: 'Bolsa de 5 kg', categoriaId: cat, precio: '15', codigo: 'B5' }
  })).json.datos.producto;

  // El garrafón se prepara en el área del agua. Se marca en el producto y
  // no se adivina por el nombre.
  bd.prepare('UPDATE productos SET para_agua = 1 WHERE id = ?').run(garrafon.id);

  tienda = (await llamar('/api/clientes', {
    method: 'POST',
    cuerpo: { nombre: 'Juan Pech', negocio: 'Abarrotes Juan',
              direccion: 'Calle 20 #145, Hunucmá', telefono: '9991234567' }
  })).json.datos.cliente;
  await llamar(`/api/clientes/${tienda.id}`, {
    method: 'PUT',
    cuerpo: { listaId: mayoreo.id, horarioEntrega: 'de 8 a 2 y de 5 a 8',
              referencias: 'La de la puerta azul',
              latitud: 21.0163, longitud: -89.8756,
              limite: '5000' }
  });
  tienda = (await llamar(`/api/clientes/${tienda.id}`)).json.datos.cliente;

  sinUbicacion = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Doña Rosa' }
  })).json.datos.cliente;
});

/** Toma un pedido, como lo haría el botón de Vender. */
function tomar(cuerpo) {
  return llamar('/api/pedidos', { method: 'POST', cuerpo });
}

// ============================================================
// TOMARLO
// ============================================================

test('un pedido sin cliente no se toma', async () => {
  // Sin nombre no hay a dónde llevarlo, y una nota de entrega sin
  // destinatario no sirve de nada.
  const r = await tomar({ lineas: [{ productoId: garrafon.id, cantidad: 10 }] });
  assert.equal(r.estado, 400);
  assert.match(r.json.error, /elige al cliente/i);
});

test('un pedido vacío no se toma', async () => {
  const r = await tomar({ clienteId: tienda.id, lineas: [] });
  assert.equal(r.estado, 400);
});

test('se toma con su folio, y el folio no se repite', async () => {
  const a = await tomar({
    clienteId: tienda.id,
    lineas: [{ productoId: garrafon.id, cantidad: 10 }, { productoId: bolsa.id, cantidad: 50 }]
  });
  assert.equal(a.estado, 201);
  const p = a.json.datos.pedido;
  assert.equal(p.estado, 'pendiente');
  assert.equal(p.lineas.length, 2);
  // 10 × $25 + 50 × $15 = $250 + $750
  assert.equal(p.total, 100000);

  const b = await tomar({ clienteId: sinUbicacion.id, lineas: [{ codigo: 'B5' }] });
  assert.equal(b.json.datos.pedido.folio, p.folio + 1);
});

test('los datos del cliente se COPIAN al pedido (regla 3.5)', async () => {
  const p = (await tomar({
    clienteId: tienda.id, lineas: [{ productoId: garrafon.id, cantidad: 2 }]
  })).json.datos.pedido;

  assert.equal(p.direccion, 'Calle 20 #145, Hunucmá');
  assert.equal(p.referencias, 'La de la puerta azul');
  assert.equal(p.horario, 'de 8 a 2 y de 5 a 8');
  assert.equal(p.telefono, '9991234567');
  assert.ok(Math.abs(p.latitud - 21.0163) < 0.0001);

  // Y AHORA EL CLIENTE SE MUDA. La nota de este pedido tiene que seguir
  // diciendo a dónde se llevó: sin esto, nadie podría explicar por qué el
  // repartidor fue a donde fue.
  await llamar(`/api/clientes/${tienda.id}`, {
    method: 'PUT', cuerpo: { direccion: 'Otra calle, otro pueblo' }
  });
  const releido = (await llamar(`/api/pedidos/${p.id}`)).json.datos.pedido;
  assert.equal(releido.direccion, 'Calle 20 #145, Hunucmá');

  // Se deja como estaba para las pruebas que siguen.
  await llamar(`/api/clientes/${tienda.id}`, {
    method: 'PUT', cuerpo: { direccion: 'Calle 20 #145, Hunucmá' }
  });
});

test('el precio sale de la lista del cliente, no de la de público', async () => {
  // Su lista de mayoreo pone la marqueta a $240; la de público, a $264.
  const p = (await tomar({
    clienteId: tienda.id, lineas: [{ codigo: '1M' }]
  })).json.datos.pedido;
  assert.equal(p.total, 24000);
});

test('el precio queda escrito: si suben los precios, el pedido no se mueve', async () => {
  const p = (await tomar({
    clienteId: tienda.id, lineas: [{ codigo: '1M' }]
  })).json.datos.pedido;
  assert.equal(p.total, 24000);

  // El lunes suben los precios.
  await llamar(`/api/ventas/precios/${mayoreo.id}`, {
    method: 'PUT', cuerpo: { precios: [{ dieciseisavos: 16, pesos: 300 }] }
  });

  const releido = (await llamar(`/api/pedidos/${p.id}`)).json.datos.pedido;
  assert.equal(releido.total, 24000,
    'lo que se cobra es lo que dice el papel que el repartidor lleva en la mano');

  // Y al ENTREGARLO se cobra lo prometido, no lo de hoy.
  const r = await llamar(`/api/pedidos/${p.id}/entregar`, {
    method: 'POST', cuerpo: { formaPago: 'efectivo' }
  });
  assert.equal(r.json.datos.venta.total_centavos, 24000);

  // Se dejan los precios como estaban.
  await llamar(`/api/ventas/precios/${mayoreo.id}`, {
    method: 'PUT', cuerpo: { precios: [{ dieciseisavos: 16, pesos: 240 }] }
  });
});

// ============================================================
// UN PEDIDO NO ES UNA VENTA TODAVÍA
// ============================================================

test('un pedido pendiente no aparece en las ventas', async () => {
  const antes = bd.prepare('SELECT COUNT(*) n FROM ventas').get().n;
  await tomar({ clienteId: tienda.id, lineas: [{ productoId: bolsa.id, cantidad: 3 }] });
  assert.equal(bd.prepare('SELECT COUNT(*) n FROM ventas').get().n, antes,
    'el hielo no sale del cuarto frío hasta que sale de verdad');
});

test('al entregarlo nace su venta, con las mismas líneas', async () => {
  const p = (await tomar({
    clienteId: tienda.id,
    lineas: [{ productoId: garrafon.id, cantidad: 4 }, { codigo: '12M' }]
  })).json.datos.pedido;

  const r = await llamar(`/api/pedidos/${p.id}/entregar`, {
    method: 'POST', cuerpo: { formaPago: 'efectivo' }
  });
  assert.equal(r.estado, 200);

  const venta = r.json.datos.venta;
  assert.equal(venta.total_centavos, p.total);
  assert.equal(venta.lineas.length, p.lineas.length);
  assert.equal(venta.cliente_id, tienda.id);
  assert.match(venta.notas, /Pedido/);

  const despues = r.json.datos.pedido;
  assert.equal(despues.estado, 'entregado');
  assert.equal(despues.venta_id, venta.id);
  assert.ok(despues.entregado_en);
});

test('entregarlo a crédito le sube la deuda al cliente, y no cobra nada', async () => {
  // El saldo NO está guardado en ninguna columna: se suma cada vez
  // (regla 3.2). Por eso se lee de `estado`, no del renglón del cliente.
  const saldoDe = async () =>
    (await llamar(`/api/clientes/${tienda.id}`)).json.datos.cliente.estado.saldo;
  const antes = await saldoDe();

  const p = (await tomar({
    clienteId: tienda.id, lineas: [{ productoId: garrafon.id, cantidad: 8 }]
  })).json.datos.pedido;

  const r = await llamar(`/api/pedidos/${p.id}/entregar`, {
    method: 'POST', cuerpo: { formaPago: 'credito' }
  });
  assert.equal(r.json.datos.venta.pago_centavos, null, 'a crédito no se pagó nada');

  assert.equal((await saldoDe()) - antes, p.total);
});

test('pasarse del límite AVISA, pero no frena la entrega', async () => {
  // El repartidor ya dejó la mercancía y ya vino de regreso: negarse a
  // apuntarlo no la devuelve, solo deja la deuda sin escribir.
  const apretado = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Don Justo' }
  })).json.datos.cliente;
  await llamar(`/api/clientes/${apretado.id}`, {
    method: 'PUT', cuerpo: { limite: '100' }
  });

  const p = (await tomar({
    clienteId: apretado.id, lineas: [{ productoId: garrafon.id, cantidad: 20 }],
    formaPago: 'credito'
  })).json.datos.pedido;
  assert.equal(p.total, 50000, '$500 contra un límite de $100');

  const r = await llamar(`/api/pedidos/${p.id}/entregar`, {
    method: 'POST', cuerpo: { formaPago: 'credito' }
  });
  assert.equal(r.estado, 200, 'se apunta de todos modos');
  assert.match(r.json.datos.avisoCredito, /límite/i, 'y se avisa');

  // La deuda quedó escrita, que es de lo que se trataba.
  const saldo = (await llamar(`/api/clientes/${apretado.id}`))
    .json.datos.cliente.estado.saldo;
  assert.equal(saldo, 50000);
});

test('de contado no hay aviso de crédito que dar', async () => {
  const p = (await tomar({
    clienteId: tienda.id, lineas: [{ productoId: garrafon.id, cantidad: 1 }]
  })).json.datos.pedido;
  const r = await llamar(`/api/pedidos/${p.id}/entregar`, {
    method: 'POST', cuerpo: { formaPago: 'efectivo' }
  });
  assert.equal(r.json.datos.avisoCredito, null);
});

test('un pedido no se entrega dos veces', async () => {
  const p = (await tomar({
    clienteId: tienda.id, lineas: [{ productoId: bolsa.id, cantidad: 2 }]
  })).json.datos.pedido;

  await llamar(`/api/pedidos/${p.id}/entregar`, { method: 'POST', cuerpo: {} });
  const otra = await llamar(`/api/pedidos/${p.id}/entregar`, { method: 'POST', cuerpo: {} });
  assert.equal(otra.estado, 400);
  assert.match(otra.json.error, /ya se había entregado/i);
});

// ============================================================
// CANCELARLO
// ============================================================

test('cancelar pide motivo y no borra nada (regla 3.4)', async () => {
  const p = (await tomar({
    clienteId: tienda.id, lineas: [{ productoId: bolsa.id, cantidad: 6 }]
  })).json.datos.pedido;

  const sinMotivo = await llamar(`/api/pedidos/${p.id}/cancelar`, {
    method: 'POST', cuerpo: {}
  });
  assert.equal(sinMotivo.estado, 400);

  const r = await llamar(`/api/pedidos/${p.id}/cancelar`, {
    method: 'POST', cuerpo: { motivo: 'Ya no lo quiso' }
  });
  assert.equal(r.json.datos.pedido.estado, 'cancelado');
  assert.equal(r.json.datos.pedido.motivo_cancelacion, 'Ya no lo quiso');

  // Sigue estando, con sus líneas: tres semanas después alguien pregunta
  // "¿y el de la tiendita, qué pasó?".
  const releido = (await llamar(`/api/pedidos/${p.id}`)).json.datos.pedido;
  assert.equal(releido.lineas.length, 1);
  assert.ok(releido.cancelado_en);
});

test('un pedido entregado ya no se cancela: lo que se cancela es su ticket', async () => {
  const p = (await tomar({
    clienteId: tienda.id, lineas: [{ productoId: bolsa.id, cantidad: 1 }]
  })).json.datos.pedido;
  await llamar(`/api/pedidos/${p.id}/entregar`, { method: 'POST', cuerpo: {} });

  const r = await llamar(`/api/pedidos/${p.id}/cancelar`, {
    method: 'POST', cuerpo: { motivo: 'me equivoqué' }
  });
  assert.equal(r.estado, 409);
});

// ============================================================
// LO QUE HAY QUE PREPARAR
// ============================================================

test('la preparación suma por producto y parte el agua del hielo', async () => {
  // Se limpia lo de antes para contar solo lo de esta prueba: la
  // preparación mira TODO lo pendiente y las pruebas anteriores dejaron
  // pedidos en pie.
  bd.prepare("UPDATE pedidos SET estado = 'cancelado', cancelado_en = datetime('now'), "
             + "motivo_cancelacion = 'limpieza de prueba' WHERE estado = 'pendiente'").run();

  await tomar({ clienteId: tienda.id,
                lineas: [{ productoId: garrafon.id, cantidad: 10 },
                         { productoId: bolsa.id, cantidad: 50 }] });
  await tomar({ clienteId: sinUbicacion.id,
                lineas: [{ productoId: garrafon.id, cantidad: 5 },
                         { codigo: '1M' }] });

  const prep = (await llamar('/api/pedidos/preparacion')).json.datos.preparacion;
  assert.equal(prep.pedidos, 2);
  assert.equal(prep.clientes, 2);

  const agua = prep.areas.find((a) => a.area === 'agua');
  const hielo = prep.areas.find((a) => a.area === 'hielo');
  assert.ok(agua && hielo, 'las dos áreas, porque son dos personas distintas');

  const garrafones = agua.productos.find((p) => p.productoId === garrafon.id);
  assert.equal(garrafones.cantidad, 15, '10 de uno y 5 del otro se preparan juntos');

  const bolsas = hielo.productos.find((p) => p.productoId === bolsa.id);
  assert.equal(bolsas.cantidad, 50);

  // La marqueta de mayoreo es hielo, y se cuenta en dieciseisavos.
  assert.equal(hielo.dieciseisavos, 16);
});

test('lo de mañana no sale en la preparación de hoy', async () => {
  const p = (await tomar({
    clienteId: tienda.id, lineas: [{ productoId: garrafon.id, cantidad: 99 }],
    paraCuando: manana()
  })).json.datos.pedido;
  assert.equal(p.para_cuando, manana());

  const prep = (await llamar('/api/pedidos/preparacion')).json.datos.preparacion;
  const agua = prep.areas.find((a) => a.area === 'agua');
  assert.ok(!agua.productos.some((x) => x.cantidad >= 99),
            'preparar hoy lo de mañana es hielo derritiéndose en la camioneta');

  // Pero pidiendo hasta mañana, ahí está.
  const conManana = (await llamar(`/api/pedidos/preparacion?hasta=${manana()}`))
    .json.datos.preparacion;
  const aguaManana = conManana.areas.find((a) => a.area === 'agua');
  assert.ok(aguaManana.productos.some((x) => x.cantidad >= 99));
});

test('lo atrasado sigue apareciendo', async () => {
  // Se mira el ANTES y el DESPUÉS del mismo producto: la preparación suma
  // todo lo pendiente, así que las bolsas de las pruebas anteriores
  // también están ahí. Comparar contra un número fijo probaría el orden en
  // que corren las pruebas, no lo atrasado.
  const bolsasEn = (prep) => prep.areas.find((a) => a.area === 'hielo')
    ?.productos.find((x) => x.productoId === bolsa.id)?.cantidad || 0;

  const antes = bolsasEn((await llamar('/api/pedidos/preparacion')).json.datos.preparacion);

  const p = (await tomar({
    clienteId: sinUbicacion.id, lineas: [{ productoId: bolsa.id, cantidad: 77 }]
  })).json.datos.pedido;
  // Como si se hubiera tomado antier y no hubiera salido.
  bd.prepare("UPDATE pedidos SET para_cuando = date('now','-2 day') WHERE id = ?").run(p.id);

  const despues = bolsasEn((await llamar('/api/pedidos/preparacion')).json.datos.preparacion);
  assert.equal(despues - antes, 77,
    'esconderlo porque cambió el día es la forma más fácil de perder un cliente');
});

// ============================================================
// LA NOTA DE ENTREGA
// ============================================================

test('la nota lleva el cliente, el horario, las referencias y el QR', async () => {
  const p = (await tomar({
    clienteId: tienda.id, lineas: [{ productoId: garrafon.id, cantidad: 3 }]
  })).json.datos.pedido;

  const r = await llamar(`/api/impresion/pedido/${p.id}/previa`);
  assert.equal(r.estado, 200);
  const papel = r.json.datos.renglones.map((x) => x.t).join('\n');

  assert.match(papel, /NOTA DE ENTREGA/);
  assert.match(papel, /Abarrotes Juan/);
  assert.match(papel, /Calle 20 #145/);
  assert.match(papel, /puerta azul/);
  assert.match(papel, /de 8 a 2/);
  assert.match(papel, /COBRAR/, 'el repartidor tiene que saber si cobra o no');

  const qr = r.json.datos.renglones.find((x) => x.qr);
  assert.ok(qr, 'con ubicación, la nota lleva su código');
  assert.equal(qr.qr.length, qr.qr[0].length, 'el código es cuadrado');
});

test('a crédito la nota dice que NO se cobra', async () => {
  const p = (await tomar({
    clienteId: tienda.id, lineas: [{ productoId: bolsa.id, cantidad: 4 }],
    formaPago: 'credito'
  })).json.datos.pedido;

  const papel = (await llamar(`/api/impresion/pedido/${p.id}/previa`))
    .json.datos.renglones.map((x) => x.t).join('\n');
  assert.match(papel, /A CREDITO/);
  assert.match(papel, /No se cobra/);
  // Y no puede decir las dos cosas: cobrarle a quien va a crédito es
  // cobrarle dos veces.
  assert.ok(!/COBRAR \$/.test(papel));
});

test('sin ubicación, la nota sale igual pero sin QR de coordenadas', async () => {
  const p = (await tomar({
    clienteId: sinUbicacion.id, lineas: [{ productoId: bolsa.id, cantidad: 2 }]
  })).json.datos.pedido;

  const r = await llamar(`/api/impresion/pedido/${p.id}/previa`);
  assert.equal(r.estado, 200, 'la nota sale de todos modos: el pedido existe');
  const qr = r.json.datos.renglones.find((x) => x.qr);
  assert.ok(!qr, 'un QR que lleva a la coordenada cero manda al golfo de Guinea');
});

/**
 * EL PAPEL DE VERDAD, no su espejo.
 *
 * Lo de arriba comprueba lo que se VE en pantalla. Esto comprueba lo que
 * sale por la impresora, que es otro camino entero: el dibujo del QR se
 * manda como imagen de puntos (GS v 0) y ese pedazo de bytes no pasa por
 * ningún renglón de texto. Si se rompiera, la previa seguiría saliendo
 * perfecta y el papel saldría sin código.
 */
test('el QR sale de verdad por la impresora, como imagen de puntos', async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const salida = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'papel-')), 'ticket.bin');

  // Se le dice al sistema que "imprima" a un archivo, que es el camino que
  // existe justo para probar sin impresora.
  bd.prepare(`INSERT INTO configuracion (clave, valor, actualizado_en)
              VALUES ('impresora_destino', ?, datetime('now'))
              ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`).run(salida);

  const p = (await tomar({
    clienteId: tienda.id, lineas: [{ productoId: garrafon.id, cantidad: 6 }]
  })).json.datos.pedido;

  const r = await llamar(`/api/impresion/pedido/${p.id}`, { method: 'POST', cuerpo: {} });
  assert.equal(r.json.datos.impreso, true);

  const bytes = fs.readFileSync(salida);
  // GS v 0 m : la orden de imagen. Detrás van el ancho en bytes y el alto
  // en renglones, y luego el mapa de puntos.
  const i = bytes.indexOf(Buffer.from([0x1d, 0x76, 0x30, 0x00]));
  assert.ok(i > 0, 'la nota tiene que llevar su imagen de puntos');

  const ancho = bytes[i + 4] | (bytes[i + 5] << 8);
  const alto = bytes[i + 6] | (bytes[i + 7] << 8);
  assert.ok(ancho > 0 && alto > 0);
  assert.ok(bytes.length >= i + 8 + ancho * alto, 'el mapa de puntos viene completo');

  // Y NO SALE MICROSCÓPICO. A 203 puntos por pulgada, 150 puntos son unos
  // 19 mm de lado. Menos que eso y el teléfono no enfoca — que es la forma
  // de que el QR "funcione" en las pruebas y no en la calle.
  assert.ok(alto >= 150, `el código mide ${alto} puntos de lado: muy chico`);

  // Se apaga la impresora otra vez: las pruebas que sigan no tienen por qué
  // estar escribiendo en un archivo.
  bd.prepare("UPDATE configuracion SET valor = '' WHERE clave = 'impresora_destino'").run();
  fs.rmSync(path.dirname(salida), { recursive: true, force: true });
});

test('la hoja de preparación se lee sin precios por renglón', async () => {
  const r = await llamar('/api/impresion/preparacion/previa');
  assert.equal(r.estado, 200);
  const papel = r.json.datos.renglones.map((x) => x.t).join('\n');
  assert.match(papel, /PARA PREPARAR/);
});

// ============================================================
// QUIÉN PUEDE QUÉ
// ============================================================

test('el repartidor ve y entrega, pero no toma pedidos', async () => {
  const p = (await tomar({
    clienteId: tienda.id, lineas: [{ productoId: bolsa.id, cantidad: 1 }]
  })).json.datos.pedido;

  await entrarPorNombre('Beto', '8888');

  assert.equal((await llamar('/api/pedidos')).estado, 200);

  const tomando = await tomar({ clienteId: tienda.id, lineas: [{ codigo: 'B5' }] });
  assert.equal(tomando.estado, 403,
    'un pedido nace de una llamada al mostrador, no en la calle');

  const entregando = await llamar(`/api/pedidos/${p.id}/entregar`, {
    method: 'POST', cuerpo: { formaPago: 'efectivo' }
  });
  assert.equal(entregando.estado, 200);

  await entrarAdmin();
});

test('la cajera toma, entrega y cancela', async () => {
  await entrarPorNombre('Mari', '7777');
  const p = (await tomar({
    clienteId: tienda.id, lineas: [{ productoId: bolsa.id, cantidad: 1 }]
  })).json.datos.pedido;
  assert.ok(p);

  const r = await llamar(`/api/pedidos/${p.id}/cancelar`, {
    method: 'POST', cuerpo: { motivo: 'se arrepintió' }
  });
  assert.equal(r.estado, 200);
  await entrarAdmin();
});

test('el operario no ve los pedidos', async () => {
  await crearUsuario('Chema', 'operario', '2222');
  await entrarPorNombre('Chema', '2222');
  assert.equal((await llamar('/api/pedidos')).estado, 403);
  await entrarAdmin();
});

// ============================================================
// CORREGIR
// ============================================================

test('se puede mover la fecha y las notas, nunca las líneas', async () => {
  const p = (await tomar({
    clienteId: tienda.id, lineas: [{ productoId: bolsa.id, cantidad: 5 }]
  })).json.datos.pedido;

  const r = await llamar(`/api/pedidos/${p.id}`, {
    method: 'PUT',
    cuerpo: { paraCuando: manana(), notas: 'Que lo dejen con el vecino',
              lineas: [{ productoId: bolsa.id, cantidad: 500 }] }
  });
  assert.equal(r.estado, 200);
  const d = r.json.datos.pedido;
  assert.equal(d.para_cuando, manana());
  assert.equal(d.notas, 'Que lo dejen con el vecino');
  assert.equal(d.lineas[0].cantidad, 5,
    'cambiar lo que pidió después de imprimir su nota es que salga una cosa y llegue otra');
});

test('un pedido entregado ya no se corrige', async () => {
  const p = (await tomar({
    clienteId: tienda.id, lineas: [{ productoId: bolsa.id, cantidad: 1 }]
  })).json.datos.pedido;
  await llamar(`/api/pedidos/${p.id}/entregar`, { method: 'POST', cuerpo: {} });

  const r = await llamar(`/api/pedidos/${p.id}`, {
    method: 'PUT', cuerpo: { notas: 'tarde' }
  });
  assert.equal(r.estado, 409);
});

// ============================================================
// A DOMICILIO O LO RECOGEN  (v5.8)
// ============================================================

test('un pedido dice si sale en la camioneta o lo vienen a buscar', async () => {
  const dom = await tomar({ clienteId: tienda.id, lineas: [{ productoId: bolsa.id, cantidad: 2 }] });
  assert.equal(dom.json.datos.pedido.tipo, 'domicilio', 'sin decir nada, sale en la camioneta');

  const rec = await tomar({ clienteId: tienda.id, tipo: 'recoger',
                            lineas: [{ productoId: bolsa.id, cantidad: 2 }] });
  assert.equal(rec.json.datos.pedido.tipo, 'recoger');

  // Los dos se preparan; solo uno sube.
  const prep = (await llamar('/api/pedidos/preparacion')).json.datos.preparacion;
  assert.ok(prep.aRecoger >= 1 && prep.aDomicilio >= 1);
});

test('el que vienen a buscar NO lleva nota de entrega ni sube a la camioneta', async () => {
  bd.prepare("UPDATE pedidos SET estado = 'cancelado', cancelado_en = datetime('now'), "
             + "motivo_cancelacion = 'limpieza' WHERE estado = 'pendiente'").run();
  const rec = (await tomar({ clienteId: tienda.id, tipo: 'recoger',
                             lineas: [{ productoId: bolsa.id, cantidad: 3 }] })).json.datos.pedido;

  const notas = await llamar('/api/impresion/pedidos/notas', { method: 'POST', cuerpo: {} });
  assert.equal(notas.estado, 400, 'no hay ninguna nota que imprimir: el único pendiente lo recogen');

  await crearUsuario('Beto2', 'repartidor', '8811');
  const beto = (await llamar('/api/auth/usuarios-disponibles')).json.datos.usuarios
    .find((u) => u.nombre === 'Beto2');
  const s = (await llamar('/api/reparto', {
    method: 'POST', cuerpo: { repartidorId: beto.id }
  })).json.datos.salida;
  const r = await llamar(`/api/reparto/${s.id}/pedidos`, { method: 'POST', cuerpo: { pedidoId: rec.id } });
  assert.equal(r.estado, 409);
  assert.match(r.json.error, /pasar a buscar/);
});

test('cobrarlo en el mostrador: con el pago tecleado sale el cambio', async () => {
  const p = (await tomar({ clienteId: tienda.id, tipo: 'recoger',
                           lineas: [{ productoId: bolsa.id, cantidad: 4 }] })).json.datos.pedido; // $60
  const r = await llamar(`/api/pedidos/${p.id}/entregar`, {
    method: 'POST', cuerpo: { enMostrador: true, formaPago: 'efectivo', pago: '100' }
  });
  assert.equal(r.estado, 200, r.json?.error);
  const v = r.json.datos.venta;
  assert.equal(v.total_centavos, 6000);
  assert.equal(v.pago_centavos, 10000);
  assert.equal(v.cambio_centavos, 4000, 'el cambio, como en cualquier ticket');
  assert.equal(r.json.datos.pedido.estado, 'entregado');
  assert.ok(r.json.datos.cliente?.estado, 'viene el cliente con su cuenta, como en una venta');
});

test('en el mostrador el crédito se REVISA: pasarse del límite pide autorización', async () => {
  const apretado = (await llamar('/api/clientes', {
    method: 'POST', cuerpo: { nombre: 'Don Corto' }
  })).json.datos.cliente;
  await llamar(`/api/clientes/${apretado.id}`, { method: 'PUT', cuerpo: { limite: '50' } });

  const p = (await tomar({ clienteId: apretado.id, tipo: 'recoger',
                           lineas: [{ productoId: garrafon.id, cantidad: 10 }] })).json.datos.pedido; // $250

  const r = await llamar(`/api/pedidos/${p.id}/entregar`, {
    method: 'POST', cuerpo: { enMostrador: true, formaPago: 'credito' }
  });
  assert.equal(r.estado, 403, 'la mercancía sigue de este lado: aquí sí se frena');
  assert.equal(r.json.requiereAutorizacion, true);
  assert.equal((await llamar(`/api/pedidos/${p.id}`)).json.datos.pedido.estado, 'pendiente',
    'no se entregó nada');

  // Desde el reparto, en cambio, ya se entregó y solo se avisa.
  const r2 = await llamar(`/api/pedidos/${p.id}/entregar`, {
    method: 'POST', cuerpo: { formaPago: 'credito' }
  });
  assert.equal(r2.estado, 200);
  assert.match(r2.json.datos.avisoCredito, /límite/i);
});

test('a crédito en el mostrador, lo que deja ahorita se apunta como abono', async () => {
  const p = (await tomar({ clienteId: tienda.id, tipo: 'recoger',
                           lineas: [{ productoId: bolsa.id, cantidad: 10 }] })).json.datos.pedido; // $150
  const saldoAntes = (await llamar(`/api/clientes/${tienda.id}`)).json.datos.cliente.estado.saldo;
  const r = await llamar(`/api/pedidos/${p.id}/entregar`, {
    method: 'POST', cuerpo: { enMostrador: true, formaPago: 'credito', abono: '50' }
  });
  assert.equal(r.estado, 200, r.json?.error);
  assert.equal(r.json.datos.venta.abonoCentavos, 5000);
  const saldo = (await llamar(`/api/clientes/${tienda.id}`)).json.datos.cliente.estado.saldo;
  assert.equal(saldo - saldoAntes, 10000, 'debe $150 menos los $50 que dejó');
});

test('la fecha de un pedido tiene que ser una fecha', async () => {
  const r = await tomar({ clienteId: tienda.id, paraCuando: 'el sábado',
                          lineas: [{ productoId: bolsa.id, cantidad: 1 }] });
  assert.equal(r.estado, 400);
});

// ============================================================
// EL APARTADO: el pedido que vienen a buscar  (v5.8.1)
// ============================================================

test('el que pasan a buscar imprime un APARTADO, no una nota de entrega', async () => {
  const p = (await tomar({
    clienteId: tienda.id, lineas: [{ productoId: garrafon.id, cantidad: 2 }],
    tipo: 'recoger', paraCuando: '2026-09-10'
  })).json.datos.pedido;

  const r = await llamar(`/api/impresion/pedido/${p.id}/previa`);
  assert.equal(r.estado, 200, 'antes no salía nada: el cliente se iba sin papel');
  const papel = r.json.datos.renglones.map((x) => x.t).join('\n');

  assert.match(papel, /APARTADO/);
  assert.ok(!/NOTA DE ENTREGA/.test(papel));
  assert.match(papel, /SE PAGA AL RECOGER/, 'la diferencia con un ticket: el dinero no ha entrado');
  assert.match(papel, /10\/Sep/, 'para cuándo pasa por él');
  assert.match(papel, /Abarrotes Juan/);
  // Ni dirección ni QR: nadie va a ir a ninguna parte.
  assert.ok(!/Calle 20 #145/.test(papel));
  assert.ok(!r.json.datos.renglones.find((x) => x.qr), 'sin QR: no hay a dónde llegar');
});

test('la nota de entrega dice para qué día es', async () => {
  const p = (await tomar({
    clienteId: tienda.id, lineas: [{ productoId: bolsa.id, cantidad: 4 }],
    paraCuando: '2026-09-12'
  })).json.datos.pedido;
  const papel = (await llamar(`/api/impresion/pedido/${p.id}/previa`))
    .json.datos.renglones.map((x) => x.t).join('\n');
  assert.match(papel, /Para el 12\/Sep/);
});
