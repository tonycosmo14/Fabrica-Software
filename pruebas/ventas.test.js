/**
 * PRUEBAS DEL PUNTO DE VENTA  (v0.8)
 *
 * Lo que se comprueba aquí es lo que de verdad puede costar dinero:
 *
 *  · que el precio de una fracción no dependa de cómo se teclee
 *  · que el total lo calcule el SERVIDOR y no se pueda mandar desde fuera
 *  · que el folio nunca se repita ni se reinicie
 *  · que una venta cobrada no se pueda editar, solo cancelar
 *  · que el precio quede COPIADO en el ticket (regla 3.5)
 *  · que lo vendido se descuente del cuarto frío
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, entrarPorNombre, bd, preparar } = fabricaDePrueba('venta');
const ADMIN_PIN = require('./ayudante').ADMIN.pin;

let tanqueId, almacenId;


/** Vende y devuelve la venta ya guardada. */
async function vender(dieciseisavos, extra = {}) {
  const r = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ dieciseisavos }], ...extra }
  });
  return r;
}

preparar(async () => {
  const t = await llamar('/api/tanques', {
    method: 'POST',
    cuerpo: { nombre: '2N', panos: 6, plantilla: [3, 3], horasCongelacion: 24 }
  });
  tanqueId = t.json.datos.tanque.id;

  almacenId = (await llamar('/api/existencia/almacenes')).json.datos.almacenes[0].id;

  await llamar('/api/usuarios', { method: 'POST', cuerpo: { nombre: 'Rosa', rol: 'cajero', pin: '4444' } });
  await llamar('/api/usuarios', { method: 'POST', cuerpo: { nombre: 'Mari', rol: 'gerente', pin: '7777' } });
  await llamar('/api/usuarios', { method: 'POST', cuerpo: { nombre: 'Chema', rol: 'operario', pin: '5555' } });
});

// ============================================================
// PRECIOS
// ============================================================

test('la fábrica arranca con la lista de precios del plan', async () => {
  const { json } = await llamar('/api/ventas/contexto');
  const p = Object.fromEntries(json.datos.precios.map((x) => [x.dieciseisavos, x.centavos]));

  assert.equal(json.datos.lista.nombre, 'Normal');
  assert.equal(p[16], 26400);   // marqueta $264
  assert.equal(p[8], 13500);    // 1/2 $135
  assert.equal(p[4], 7000);     // 1/4 $70
  assert.equal(p[2], 3600);     // 1/8 $36
  assert.equal(p[1], 1800);     // 1/16 $18
});

test('el precio de una fracción es la suma de sus pedazos', async () => {
  // 3/8 = 1/4 + 1/8 = 70 + 36 = $106
  const { json } = await llamar('/api/ventas/precio?dieciseisavos=6');
  assert.equal(json.datos.centavos, 10600);
  assert.equal(json.datos.texto, '3/8');
  assert.equal(json.datos.desglose, '1/4 + 1/8');
});

/**
 * ESTA ES LA PRUEBA IMPORTANTE DEL MÓDULO.
 *
 * En la caja, 3/8 se puede teclear tocando 1/4 y 1/8, o tocando seis veces
 * 1/16. Si las dos formas dieran precios distintos, el cliente pagaría de
 * más o de menos según quién lo atendiera.
 */
test('tocar 6 veces 1/16 cuesta lo mismo que tocar 1/4 y 1/8', async () => {
  const juntos = await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 6 }] }
  });

  const sueltos = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ dieciseisavos: 4 }, { dieciseisavos: 2 }] }
  });

  assert.equal(juntos.json.datos.venta.total_centavos, 10600);
  assert.equal(sueltos.json.datos.venta.total_centavos, 10600);
});

test('una marqueta y media son $399, no $396', async () => {
  // 24/16 = 1 + 1/2 = 26400 + 13500. Dividir $264 entre 16 daría otra cosa.
  const r = await vender(24);
  assert.equal(r.json.datos.venta.total_centavos, 39900);
});

// ============================================================
// EL TOTAL LO MANDA EL SERVIDOR
// ============================================================

test('el total lo calcula el servidor: mandarle un precio no sirve de nada', async () => {
  const r = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: {
      lineas: [{ dieciseisavos: 16, precio_centavos: 1, centavos: 1, total: 1 }],
      total_centavos: 1
    }
  });
  assert.equal(r.json.datos.venta.total_centavos, 26400);
});

test('no se puede vender media fracción ni cantidades raras', async () => {
  for (const malo of [0, -4, 2.5, 'mucho', null]) {
    const r = await llamar('/api/ventas', {
      method: 'POST', cuerpo: { lineas: [{ dieciseisavos: malo }] }
    });
    assert.equal(r.estado, 400, `debería rechazar ${malo}`);
  }
});

test('una venta vacía se rechaza', async () => {
  const r = await llamar('/api/ventas', { method: 'POST', cuerpo: { lineas: [] } });
  assert.equal(r.estado, 400);
});

test('si el pago no alcanza, no se cobra', async () => {
  const r = await vender(16, { pago: 100 });
  assert.equal(r.estado, 400);
  assert.match(r.json.error, /menor que el total/);
});

test('el cambio se calcula en centavos enteros', async () => {
  const r = await vender(6, { pago: 200 });          // $106 de $200
  const v = r.json.datos.venta;
  assert.equal(v.pago_centavos, 20000);
  assert.equal(v.cambio_centavos, 9400);
  assert.equal(Number.isInteger(v.cambio_centavos), true);
});

// ============================================================
// EL FOLIO
// ============================================================

test('el folio es consecutivo y nunca se repite', async () => {
  const a = (await vender(16)).json.datos.venta.folio;
  const b = (await vender(16)).json.datos.venta.folio;
  const c = (await vender(16)).json.datos.venta.folio;

  assert.equal(b, a + 1);
  assert.equal(c, b + 1);

  const repetidos = bd.prepare(
    'SELECT folio, COUNT(*) n FROM ventas GROUP BY folio HAVING n > 1'
  ).all();
  assert.deepEqual(repetidos, []);
});

test('ni dos cajas cobrando al mismo tiempo sacan el mismo folio', async () => {
  const antes = bd.prepare('SELECT COUNT(*) n FROM ventas').get().n;

  await Promise.all(Array.from({ length: 8 }, () => vender(16)));

  const despues = bd.prepare('SELECT COUNT(*) n FROM ventas').get().n;
  assert.equal(despues, antes + 8);

  const distintos = bd.prepare('SELECT COUNT(DISTINCT folio) n FROM ventas').get().n;
  assert.equal(distintos, despues);
});

// ============================================================
// EL PRECIO QUEDA COPIADO (regla 3.5)
// ============================================================

test('subir los precios no cambia los tickets ya cobrados', async () => {
  await entrarAdmin();
  const vieja = (await vender(16)).json.datos.venta;
  assert.equal(vieja.total_centavos, 26400);

  await llamar('/api/ventas/precios/lista-normal', {
    method: 'PUT', cuerpo: { precios: [{ dieciseisavos: 16, pesos: 300 }] }
  });

  const nueva = (await vender(16)).json.datos.venta;
  assert.equal(nueva.total_centavos, 30000);

  // El ticket viejo sigue diciendo lo mismo que decía.
  const r = await llamar(`/api/ventas/${vieja.id}`);
  assert.equal(r.json.datos.venta.total_centavos, 26400);
  assert.equal(r.json.datos.venta.lineas[0].precio_centavos, 26400);

  // Se deja como estaba para las pruebas que siguen.
  await llamar('/api/ventas/precios/lista-normal', {
    method: 'PUT', cuerpo: { precios: [{ dieciseisavos: 16, pesos: 264 }] }
  });
});

test('la línea guarda su desglose, para que el ticket explique el precio', async () => {
  const v = (await vender(22)).json.datos.venta;   // 1 3/8
  assert.equal(v.lineas[0].texto, '1 3/8');
  assert.equal(v.lineas[0].desglose, '1 + 1/4 + 1/8');
});

// ============================================================
// NO SE EDITA: SE CANCELA (regla 7.4)
// ============================================================

test('cancelar no borra el ticket, lo marca', async () => {
  const v = (await vender(16)).json.datos.venta;

  const r = await llamar(`/api/ventas/${v.id}/cancelar`, {
    method: 'POST', cuerpo: { motivo: 'El cliente devolvió el hielo' }
  });
  assert.equal(r.estado, 200);

  const guardada = bd.prepare('SELECT * FROM ventas WHERE id = ?').get(v.id);
  assert.ok(guardada, 'la venta sigue existiendo');
  assert.equal(guardada.total_centavos, 26400, 'el total no se tocó');
  assert.ok(guardada.cancelada_en);
  assert.equal(guardada.motivo_cancelacion, 'El cliente devolvió el hielo');

  const lineas = bd.prepare('SELECT COUNT(*) n FROM venta_lineas WHERE venta_id = ?').get(v.id).n;
  assert.equal(lineas, 1, 'las líneas tampoco se borran');
});

test('cancelar exige motivo y no se puede cancelar dos veces', async () => {
  const v = (await vender(16)).json.datos.venta;

  const sinMotivo = await llamar(`/api/ventas/${v.id}/cancelar`, { method: 'POST', cuerpo: {} });
  assert.equal(sinMotivo.estado, 400);

  await llamar(`/api/ventas/${v.id}/cancelar`, { method: 'POST', cuerpo: { motivo: 'Error de captura' } });
  const otra = await llamar(`/api/ventas/${v.id}/cancelar`, {
    method: 'POST', cuerpo: { motivo: 'Otra vez' }
  });
  assert.equal(otra.estado, 400);
});

// ============================================================
// LO VENDIDO SALE DEL CUARTO FRÍO
// ============================================================

test('lo vendido con ticket se descuenta de la existencia', async () => {
  await entrarAdmin();

  // Punto de partida limpio. Las pruebas de arriba ya vendieron hielo que
  // nunca se produjo, así que aquí se corta por lo sano: el cuarto frío
  // arranca vacío y a partir de este conteo se mide todo.
  const cero = await llamar('/api/existencia/conteos', {
    method: 'POST', cuerpo: { almacenId, dieciseisavos: 0 }
  });
  assert.equal(cero.estado, 201);

  // Se produce: sale un paño completo del tanque.
  const est = await llamar(`/api/produccion/estado?tanque=${tanqueId}`);
  const toca = est.json.datos.tanque.siguiente;
  await llamar(`/api/produccion/panos/${toca.id}/sacar`, {
    method: 'POST', cuerpo: { tipoAgua: 'purificada' }
  });
  const producido = est.json.datos.tanque.panos
    .find((p) => p.id === toca.id).total_moldes * 16;

  // Y se venden 2 marquetas y media.
  await vender(40, { almacenId });

  const a = (await llamar('/api/existencia')).json.datos.almacenes[0];
  assert.equal(a.existenciaAnterior, 0);
  assert.equal(a.producido, producido);
  assert.equal(a.vendido, 40);
  assert.equal(a.esperado, producido - 40);
});

test('el cuadre parte las salidas en vendido y faltante', async () => {
  const antes = (await llamar('/api/existencia')).json.datos.almacenes[0];

  // Se cuenta una marqueta menos de la que debería quedar: esa falta.
  const r = await llamar('/api/existencia/conteos', {
    method: 'POST', cuerpo: { almacenId, dieciseisavos: antes.esperado - 16 }
  });
  const s = r.json.datos.resumen;

  assert.equal(s.vendido, 40);
  assert.equal(s.faltante, 16);
  assert.equal(s.salidas, s.vendido + s.faltante);
});

test('una venta cancelada deja de descontar del cuarto frío', async () => {
  const v = (await vender(16, { almacenId })).json.datos.venta;

  const conVenta = (await llamar('/api/existencia')).json.datos.almacenes[0];
  assert.equal(conVenta.vendido, 16);

  await llamar(`/api/ventas/${v.id}/cancelar`, {
    method: 'POST', cuerpo: { motivo: 'Se capturó de más' }
  });

  const sinVenta = (await llamar('/api/existencia')).json.datos.almacenes[0];
  assert.equal(sinVenta.vendido, 0);
  assert.equal(sinVenta.esperado, conVenta.esperado + 16);
});

// ============================================================
// QUIÉN PUEDE QUÉ
// ============================================================

test('el cajero vende pero no cancela ni toca los precios', async () => {
  await entrarAdmin();
  await entrarPorNombre('Rosa', '4444');

  const v = await vender(16);
  assert.equal(v.estado, 201);

  const cancela = await llamar(`/api/ventas/${v.json.datos.venta.id}/cancelar`, {
    method: 'POST', cuerpo: { motivo: 'No debería poder' }
  });
  assert.equal(cancela.estado, 403);

  const precios = await llamar('/api/ventas/precios/lista-normal', {
    method: 'PUT', cuerpo: { precios: [{ dieciseisavos: 16, pesos: 1 }] }
  });
  assert.equal(precios.estado, 403);
});

test('el gerente sí puede cancelar', async () => {
  await entrarAdmin();
  const v = (await vender(16)).json.datos.venta;

  await entrarPorNombre('Mari', '7777');
  const r = await llamar(`/api/ventas/${v.id}/cancelar`, {
    method: 'POST', cuerpo: { motivo: 'El cliente se arrepintió' }
  });
  assert.equal(r.estado, 200);
});

test('un operario no puede vender ni ver tickets', async () => {
  await entrarAdmin();
  await entrarPorNombre('Chema', '5555');

  assert.equal((await llamar('/api/ventas/contexto')).estado, 403);
  assert.equal((await vender(16)).estado, 403);
  assert.equal((await llamar('/api/ventas')).estado, 403);
});

// ============================================================
// BUSCAR
// ============================================================

test('los tickets se buscan por folio', async () => {
  await entrarAdmin();
  const v = (await vender(16)).json.datos.venta;

  const { json } = await llamar(`/api/ventas?busca=${v.folio}`);
  assert.ok(json.datos.ventas.some((x) => x.id === v.id));
});

test('la bitácora deja constancia de cada venta', () => {
  const n = bd.prepare("SELECT COUNT(*) n FROM bitacora WHERE accion = 'venta.registrada'").get().n;
  const ventas = bd.prepare('SELECT COUNT(*) n FROM ventas').get().n;
  assert.equal(n, ventas);
});

// ============================================================
// EL PRECIO ESPECIAL DE UNA VEZ  (v6.2)
// "Vendí 20 bolsas a $12 en vez de $20."
// ============================================================

let bolsaEspecial;
test('se da de alta una bolsa de $20 para probar el precio especial', async () => {
  await entrarAdmin();
  const cat = (await llamar('/api/catalogo/categorias', {
    method: 'POST', cuerpo: { nombre: 'Bolsas especiales' }
  })).json.datos.categoria;
  bolsaEspecial = (await llamar('/api/catalogo/productos', {
    method: 'POST',
    cuerpo: { nombre: 'Bolsa de 3 kg', categoriaId: cat.id, precio: '20', codigo: 'B3E' }
  })).json.datos.producto;
  assert.ok(bolsaEspecial?.id);
});

test('el gerente pone el precio especial y queda escrito lo de lista y el porqué', async () => {
  await entrarAdmin();
  const r = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: {
      lineas: [{ productoId: bolsaEspecial.id, cantidad: 20,
                 precioEspecial: '12', motivoPrecio: 'Se llevó veinte, cliente de siempre' }],
      pago: 240
    }
  });
  assert.equal(r.estado, 201, JSON.stringify(r.json));
  const v = r.json.datos.venta;
  assert.equal(v.total_centavos, 24000, '20 × $12');
  const l = v.lineas[0];
  assert.equal(l.precio_centavos, 24000);
  assert.equal(l.precio_lista_centavos, 40000, 'lo que decía la lista: 20 × $20');
  assert.match(l.motivo_precio, /cliente de siempre/);
  assert.ok(l.precio_autorizado_nombre, 'quién dijo que sí');

  // Y el ticket lo dice: a cuánto salió y de lista cuánto era.
  const papel = (await llamar(`/api/impresion/venta/${v.id}/previa`)).json.datos.renglones
    .map((x) => x.t).join('\n');
  assert.match(papel, /precio especial/);
  assert.match(papel, /de lista \$400/);
});

test('sin porqué no hay precio especial', async () => {
  const r = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ productoId: bolsaEspecial.id, cantidad: 2, precioEspecial: '12' }], pago: 100 }
  });
  assert.equal(r.estado, 400);
  assert.match(r.json.error, /porqu/);
});

test('el cajero lo pide con el PIN de un responsable, igual que el crédito', async () => {
  await entrarPorNombre('Rosa', '4444');
  const cuerpo = {
    lineas: [{ productoId: bolsaEspecial.id, cantidad: 2, precioEspecial: '12', motivoPrecio: 'Estaban chicas' }],
    pago: 100
  };
  let r = await llamar('/api/ventas', { method: 'POST', cuerpo });
  assert.equal(r.estado, 403);
  assert.equal(r.json.requierePrecio, true);
  assert.ok(Array.isArray(r.json.responsables) && r.json.responsables.length);

  const admin = r.json.responsables.find((x) => x.rol === 'admin') || r.json.responsables[0];
  r = await llamar('/api/ventas', { method: 'POST', cuerpo: {
    ...cuerpo, autorizacionPrecio: { usuarioId: admin.id, pin: '0000', motivo: 'no' }
  } });
  assert.equal(r.estado, 403, 'con el PIN equivocado no pasa');

  r = await llamar('/api/ventas', { method: 'POST', cuerpo: {
    ...cuerpo, autorizacionPrecio: { usuarioId: admin.id, pin: ADMIN_PIN, motivo: 'Estaban chicas' }
  } });
  assert.equal(r.estado, 201, JSON.stringify(r.json));
  assert.equal(r.json.datos.venta.total_centavos, 2400);
  assert.equal(r.json.datos.venta.lineas[0].precio_autorizado_nombre, admin.nombre);
  await entrarAdmin();
});

test('el hielo suelto también: el precio especial es el total del renglón', async () => {
  await entrarAdmin();
  const r = await llamar('/api/ventas', {
    method: 'POST',
    cuerpo: { lineas: [{ dieciseisavos: 16, precioEspecial: '200', motivoPrecio: 'Estaba hueca' }], pago: 200 }
  });
  assert.equal(r.estado, 201, JSON.stringify(r.json));
  assert.equal(r.json.datos.venta.total_centavos, 20000);
  assert.ok(r.json.datos.venta.lineas[0].precio_lista_centavos > 20000, 'de lista era más');
});
