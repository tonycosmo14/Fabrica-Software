/**
 * PRUEBAS DE LOS VALES  (v4.3)
 *
 * En la fábrica se le dice "vale" a dos papelitos opuestos, y lo que se
 * comprueba aquí es justamente que no se revuelvan:
 *
 *   · VALE DE RETIRO — el dueño o un gerente se llevan efectivo. El dinero
 *     no se gastó, cambió de sitio, y nadie queda debiendo.
 *   · VALE DE RAYA — un trabajador se lleva parte de su sueldo antes de
 *     tiempo. Sí es gasto, y hay que acordarse el día de la raya.
 *
 * Lo que puede costar dinero, y por eso se prueba:
 *
 *  · que un vale no se pueda hacer sin nombre (sin nombre es un faltante)
 *  · que la cajera no pueda "retirar" dinero a su propio nombre
 *  · que marcar "ya se le descontó" NO mueva ni un peso del cajón
 *  · que anular el movimiento anule también el renglón de la libreta
 *  · que un vale ya descontado no se pueda anular por detrás
 *  · que el corte parta gastos y vales y los dos sigan sumando lo mismo
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, entrarPorNombre, bd, preparar } = fabricaDePrueba('vales');

let rosa;   // cajera
let mari;   // gerente
let chema;  // operario

preparar(async () => {
  const alta = async (nombre, rol, pin) => (await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre, rol, pin }
  })).json.datos.usuario;

  rosa = await alta('Rosa', 'cajero', '4444');
  mari = await alta('Mari', 'gerente', '7777');
  chema = await alta('Chema', 'operario', '5555');

  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 1000 } });
});

/** El estado del turno abierto ahora mismo. */
async function turno() {
  return (await llamar('/api/caja')).json.datos.abierta;
}

// ============================================================
// LO QUE UN VALE NO PUEDE SER
// ============================================================

test('los dos vales vienen de fábrica, y con sus banderas al revés', async () => {
  const { json } = await llamar('/api/caja/vales');
  const porId = new Map(json.datos.conceptos.map((c) => [c.id, c]));

  const retiro = porId.get('gasto-retiro');
  const raya = porId.get('gasto-vale-raya');
  assert.ok(retiro && raya, 'los dos conceptos existen');

  // Los dos son vales: se los llevó alguien con nombre.
  assert.equal(retiro.es_vale, 1);
  assert.equal(raya.es_vale, 1);

  // Pero solo el retiro es traspaso. El adelanto de sueldo SÍ es gasto:
  // el sueldo es gasto de la fábrica, y se cuenta una sola vez, el día que
  // el dinero sale del cajón.
  assert.equal(retiro.es_traspaso, 1);
  assert.equal(raya.es_traspaso, 0, 'un adelanto de sueldo es gasto, no traspaso');
});

test('un vale sin nombre no es un vale: es un faltante', async () => {
  const r = await llamar('/api/caja/vales', {
    method: 'POST', cuerpo: { clase: 'retiro', monto: 500 }
  });
  assert.equal(r.estado, 400);
  assert.match(r.json.error, /quién/i);
});

test('un vale sin importe no se hace', async () => {
  const r = await llamar('/api/caja/vales', {
    method: 'POST', cuerpo: { clase: 'retiro', ejecutorId: mari.id }
  });
  assert.equal(r.estado, 400);
});

test('un retiro se lo lleva quien manda, no la cajera', async () => {
  const r = await llamar('/api/caja/vales', {
    method: 'POST', cuerpo: { clase: 'retiro', monto: 500, ejecutorId: rosa.id }
  });
  assert.equal(r.estado, 409);
  assert.match(r.json.error, /vale de raya/i,
    'y de paso le dice cuál era el vale que sí');

  // Ni un peso salió del cajón.
  assert.equal((await turno()).salidas, 0);
});

test('la lista de a quién dársela es distinta según la clase', async () => {
  const { gente } = (await llamar('/api/caja/vales')).json.datos;

  const retiro = gente.retiro.map((u) => u.nombre);
  assert.ok(retiro.includes('Mari') && retiro.includes('Tony'));
  assert.ok(!retiro.includes('Rosa'), 'a la cajera no se le ofrece llevarse el dinero');

  // El adelanto lo puede pedir cualquiera que cobre sueldo: todos.
  assert.ok(gente.raya.length >= 4);
});

// ============================================================
// EL VALE DE RETIRO
// ============================================================

test('un retiro sale del cajón a nombre de quien se lo llevó', async () => {
  const antes = await turno();
  const r = await llamar('/api/caja/vales', {
    method: 'POST', cuerpo: { clase: 'retiro', monto: 400, ejecutorId: mari.id }
  });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.quien, 'Mari');

  const ahora = await turno();
  assert.equal(ahora.salidas - antes.salidas, 40000);
  assert.equal(ahora.esperado, antes.esperado - 40000);

  // El doble responsable (regla 3.6): se lo llevó Mari, lo anotó el admin.
  const m = bd.prepare('SELECT * FROM movimientos_caja WHERE id = ?')
    .get(r.json.datos.movimientoId);
  assert.equal(m.ejecutor_id, mari.id);
  assert.notEqual(m.capturista_id, mari.id);

  // Y NO deja deuda: nadie tiene que devolver un retiro.
  assert.equal(bd.prepare('SELECT COUNT(*) n FROM adelantos').get().n, 0);
});

test('el retiro se separa de los gastos, y los dos siguen sumando lo mismo', async () => {
  await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', conceptoId: 'gasto-gasolina', monto: 150 }
  });

  const e = await turno();
  assert.equal(e.porVales.valesCentavos, 40000, 'el retiro de la prueba anterior');
  assert.equal(e.porVales.gastosCentavos, 15000, 'la gasolina');
  assert.equal(e.porVales.gastosCentavos + e.porVales.valesCentavos, e.salidas,
    'partirlas no cambia ninguna cuenta');
  assert.equal(e.porVales.traspasadoCentavos, 40000,
    'y solo el retiro es dinero que se guardó, no que se gastó');
});

// ============================================================
// EL VALE DE RAYA
// ============================================================

test('un adelanto de sueldo sale del cajón Y deja su renglón en la libreta', async () => {
  const antes = await turno();
  const r = await llamar('/api/caja/vales', {
    method: 'POST', cuerpo: { clase: 'raya', monto: 300, ejecutorId: chema.id }
  });
  assert.equal(r.estado, 201);
  assert.ok(r.json.datos.adelantoId, 'se apuntó en su libreta');

  // EL DINERO SALE UNA SOLA VEZ. El renglón de la libreta es un
  // recordatorio, no un segundo movimiento.
  const ahora = await turno();
  assert.equal(ahora.salidas - antes.salidas, 30000);

  const a = bd.prepare('SELECT * FROM adelantos WHERE id = ?').get(r.json.datos.adelantoId);
  assert.equal(a.usuario_id, chema.id);
  assert.equal(a.centavos, 30000);
  assert.equal(a.movimiento_id, r.json.datos.movimientoId);
  assert.equal(a.descontado_en, null);
});

test('el adelanto SÍ cuenta como gasto de la fábrica; el retiro no', async () => {
  const e = await turno();
  // El adelanto entra en los vales (se lo llevó alguien con nombre)...
  assert.equal(e.porVales.valesCentavos, 70000, 'retiro 400 + adelanto 300');
  // ...pero no en lo traspasado, porque ese dinero se gastó: es sueldo.
  assert.equal(e.porVales.traspasadoCentavos, 40000, 'solo el retiro volvió a la casa');
});

test('en su ficha aparece cuánto hay que descontarle el día de la raya', async () => {
  const { json } = await llamar(`/api/usuarios/${chema.id}/adelantos`);
  assert.equal(json.datos.pendiente.centavos, 30000);
  assert.equal(json.datos.pendiente.cuantos, 1);
  assert.equal(json.datos.adelantos.length, 1);

  // Y también en la lista, que es donde se mira el día de la raya.
  const lista = (await llamar('/api/usuarios?actividad=1')).json.datos.usuarios;
  assert.equal(lista.find((u) => u.id === chema.id).valesPendientes.centavos, 30000);
  assert.equal(lista.find((u) => u.id === rosa.id).valesPendientes.centavos, 0);
});

test('"ya se le descontó" apaga el recordatorio y NO mueve un peso', async () => {
  const antes = await turno();

  const r = await llamar(`/api/usuarios/${chema.id}/adelantos/descontar`, {
    method: 'POST', cuerpo: { nota: 'Raya del sábado' }
  });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.descontados, 1);
  assert.equal(r.json.datos.pendiente.centavos, 0);

  // EL CAJÓN NO SE ENTERA. El gasto se contó el día del vale; contarlo
  // otra vez aquí sería pagarle el sueldo dos veces en los números.
  const ahora = await turno();
  assert.equal(ahora.salidas, antes.salidas);
  assert.equal(ahora.esperado, antes.esperado);

  // Y el renglón no se borra: queda con quién y cuándo (regla 3.4).
  const a = bd.prepare('SELECT * FROM adelantos WHERE usuario_id = ?').get(chema.id);
  assert.ok(a.descontado_en);
  assert.equal(a.descontado_nota, 'Raya del sábado');
});

test('descontar dos veces no hace nada: ya no hay nada pendiente', async () => {
  const r = await llamar(`/api/usuarios/${chema.id}/adelantos/descontar`, { method: 'POST' });
  assert.equal(r.estado, 409);
  assert.match(r.json.error, /no tiene vales pendientes/i);
});

test('un descuento mal marcado se deshace y el vale vuelve a estar pendiente', async () => {
  const a = bd.prepare('SELECT id FROM adelantos WHERE usuario_id = ?').get(chema.id);

  const r = await llamar(`/api/usuarios/${chema.id}/adelantos/${a.id}/deshacer`,
    { method: 'POST' });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.pendiente.centavos, 30000);

  // Se vuelve a dejar como estaba para las pruebas que siguen.
  await llamar(`/api/usuarios/${chema.id}/adelantos/descontar`, { method: 'POST' });
});

// ============================================================
// ANULAR
// ============================================================

test('anular el movimiento de un vale anula también su renglón de la libreta', async () => {
  const hecho = await llamar('/api/caja/vales', {
    method: 'POST', cuerpo: { clase: 'raya', monto: 200, ejecutorId: rosa.id }
  });
  assert.equal((await llamar(`/api/usuarios/${rosa.id}/adelantos`))
    .json.datos.pendiente.centavos, 20000);

  const r = await llamar(`/api/caja/movimientos/${hecho.json.datos.movimientoId}/anular`, {
    method: 'POST', cuerpo: { motivo: 'Se capturó dos veces' }
  });
  assert.equal(r.estado, 200);

  // Si el renglón siguiera vivo, el sábado se le descontaría un dinero que
  // nunca salió del cajón.
  const despues = await llamar(`/api/usuarios/${rosa.id}/adelantos`);
  assert.equal(despues.json.datos.pendiente.centavos, 0);
  assert.equal(despues.json.datos.adelantos[0].anulado_en !== null, true);
  assert.equal(despues.json.datos.adelantos[0].motivo_anulacion, 'Se capturó dos veces');
});

test('un vale YA DESCONTADO no se puede anular por detrás', async () => {
  const a = bd.prepare(`
    SELECT movimiento_id FROM adelantos
     WHERE usuario_id = ? AND descontado_en IS NOT NULL
  `).get(chema.id);

  const r = await llamar(`/api/caja/movimientos/${a.movimiento_id}/anular`, {
    method: 'POST', cuerpo: { motivo: 'Ya no' }
  });
  assert.equal(r.estado, 409);
  assert.match(r.json.error, /ya se le descontó/i);

  // Su raya ya se pagó de menos: borrar el vale ahora lo dejaría debiendo
  // un sueldo que sí cobró.
  assert.equal((await llamar(`/api/usuarios/${chema.id}/adelantos`))
    .json.datos.pendiente.centavos, 0);
});

// ============================================================
// EL CORTE
// ============================================================

test('el corte parte gastos y vales, y trae los adelantos con nombre', async () => {
  const e = await turno();
  const cerrado = await llamar('/api/caja/cerrar', {
    method: 'POST', cuerpo: { contado: e.esperado / 100 }
  });
  assert.equal(cerrado.estado, 200);

  const corte = cerrado.json.datos.corte;
  const s = corte.salidas;

  assert.equal(s.gastosCentavos + s.valesCentavos, corte.caja.salidas_centavos,
    'los dos montones suman lo mismo que el corte congelado');
  assert.equal(s.gastosCentavos, 15000, 'la gasolina');
  assert.equal(s.valesCentavos, 70000, 'el retiro y el adelanto vivos');
  assert.equal(s.traspasadoCentavos, 40000);

  // Cada vale trae el nombre de quien se lo llevó: es lo único que separa
  // un vale de un faltante.
  assert.ok(s.vales.every((v) => v.ejecutor_nombre));

  // Y los adelantos del turno, aparte, porque cada uno deja algo que
  // descontar. El anulado no viene.
  assert.equal(corte.adelantos.length, 1);
  assert.equal(corte.adelantos[0].usuario_nombre, 'Chema');
});

test('el papel de un vale sale por duplicado; el de un gasto no', async () => {
  const { json } = await llamar('/api/caja/cortes?limite=1');
  const corte = (await llamar(`/api/caja/cortes/${json.datos.cortes[0].id}`)).json.datos.corte;

  const vale = corte.salidas.vales[0];
  const gasto = corte.salidas.gastos[0];

  const papel = async (id) => (await llamar(`/api/impresion/movimiento/${id}/previa`))
    .json.datos.renglones.map((r) => r.t).join('\n');

  const delVale = await papel(vale.id);
  assert.match(delVale, /VALE/i);
  assert.match(delVale, new RegExp(vale.ejecutor_nombre, 'i'),
    'el nombre de quien se lo llevó va en el papel');
  assert.match(delVale, /Se lo lleva quien recibio el dinero/);
  assert.match(delVale, /Se queda en el cajon/,
    'uno se lo lleva y el otro se queda: son dos papeles');

  const delGasto = await papel(gasto.id);
  assert.doesNotMatch(delGasto, /Se queda en el cajon/, 'un gasto lleva un solo papel');
});

// ============================================================
// QUIÉN PUEDE
// ============================================================

test('el cajero puede anotar el vale de quien se llevó el dinero', async () => {
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 500 } });
  await entrarPorNombre('Rosa', '4444');

  // Es el caso de verdad: el papá del dueño llega, se lleva el efectivo y
  // no toca la computadora. Ella lo anota a nombre de él.
  const r = await llamar('/api/caja/vales', {
    method: 'POST', cuerpo: { clase: 'retiro', monto: 200, ejecutorId: mari.id }
  });
  assert.equal(r.estado, 201);

  const m = bd.prepare('SELECT * FROM movimientos_caja WHERE id = ?')
    .get(r.json.datos.movimientoId);
  assert.equal(m.ejecutor_id, mari.id, 'se lo llevó Mari');
  assert.equal(m.capturista_id, rosa.id, 'lo anotó Rosa');

  await entrarAdmin();
});

test('la libreta de vales es del administrador', async () => {
  await entrarPorNombre('Rosa', '4444');
  const r = await llamar(`/api/usuarios/${chema.id}/adelantos`);
  assert.equal(r.estado, 403);
  await entrarAdmin();
});

// ============================================================
// EL VALE NO SE PUEDE ROMPER DESDE LOS AJUSTES  (v4.4)
//
// Lo que le pasó a Tony: dio de baja "Retiro a la caja fuerte" en los
// gastos que se repiten —cosa razonable de hacer— y a partir de ahí NINGÚN
// vale se podía hacer, con un mensaje que hablaba de una pantalla que él
// no estaba usando. Un ajuste no puede tumbar una parte del programa.
// ============================================================

test('los conceptos de vale no se pueden dar de baja', async () => {
  const r = await llamar('/api/caja/conceptos/gasto-retiro', {
    method: 'PUT', cuerpo: { activo: false }
  });
  assert.equal(r.estado, 409);
  assert.match(r.json.error, /botón 📤 Vale/);
});

test('ni quitar de la lista', async () => {
  const r = await llamar('/api/caja/conceptos/gasto-vale-raya/eliminar', { method: 'POST' });
  assert.equal(r.estado, 409);
});

test('renombrarlos sí se puede, y el vale sigue funcionando', async () => {
  const r = await llamar('/api/caja/conceptos/gasto-retiro', {
    method: 'PUT', cuerpo: { nombre: 'Se lo llevó el patrón' }
  });
  assert.equal(r.estado, 200);

  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 100 } })
    .catch(() => {});
  const v = await llamar('/api/caja/vales', {
    method: 'POST', cuerpo: { clase: 'retiro', monto: 50, ejecutorId: mari.id }
  });
  assert.equal(v.estado, 201);

  // Y el papel dice el nombre nuevo (regla 3.5: el texto se copia).
  const m = bd.prepare('SELECT concepto FROM movimientos_caja WHERE id = ?')
    .get(v.json.datos.movimientoId);
  assert.equal(m.concepto, 'Se lo llevó el patrón');

  await llamar('/api/caja/conceptos/gasto-retiro', {
    method: 'PUT', cuerpo: { nombre: 'Retiro a la caja fuerte' }
  });
});

test('si YA estaba dado de baja, el vale lo revive en vez de fallar', async () => {
  // Se le da de baja por la puerta de atrás, que es como quedó la base de
  // Tony antes de que existiera la protección de arriba.
  bd.prepare("UPDATE conceptos_gasto SET activo = 0, oculto = 1 WHERE id = 'gasto-retiro'").run();

  const r = await llamar('/api/caja/vales', {
    method: 'POST', cuerpo: { clase: 'retiro', monto: 75, ejecutorId: mari.id }
  });
  assert.equal(r.estado, 201, 'el vale se hace igual');

  const c = bd.prepare("SELECT * FROM conceptos_gasto WHERE id = 'gasto-retiro'").get();
  assert.equal(c.activo, 1, 'y de paso quedó revivido');
  assert.equal(c.oculto, 0);
});

test('si alguien creó a mano otro con el mismo nombre, se adopta el suyo', async () => {
  bd.prepare("UPDATE conceptos_gasto SET activo = 0, oculto = 1 WHERE id = 'gasto-vale-raya'").run();
  const alta = await llamar('/api/caja/conceptos', {
    method: 'POST', cuerpo: { nombre: 'Vale de raya', tipo: 'salida' }
  });
  assert.equal(alta.estado, 201);
  const suyo = alta.json.datos.concepto.id;

  const r = await llamar('/api/caja/vales', {
    method: 'POST', cuerpo: { clase: 'raya', monto: 60, ejecutorId: chema.id }
  });
  assert.equal(r.estado, 201);

  // Se usó el que él dio de alta —es el que ya está tocando— y quedó
  // marcado como vale para que el corte lo separe bien.
  const m = bd.prepare('SELECT concepto_id FROM movimientos_caja WHERE id = ?')
    .get(r.json.datos.movimientoId);
  assert.equal(m.concepto_id, suyo);
  assert.equal(bd.prepare('SELECT es_vale FROM conceptos_gasto WHERE id = ?').get(suyo).es_vale, 1);
});

// ============================================================
// LAS BOLSAS, POR TAMAÑO
// ============================================================

test('la bolsa de todos los días es la de 5 kg, y la de 20 espera dada de baja', () => {
  const cinco = bd.prepare("SELECT * FROM productos WHERE id = 'prod-bolsa-gourmet'").get();
  const veinte = bd.prepare("SELECT * FROM productos WHERE id = 'prod-bolsa-20'").get();

  assert.equal(cinco.nombre, 'Bolsa de hielo de 5 kg');
  assert.equal(veinte.nombre, 'Bolsa de hielo de 20 kg');

  // Las dos nacen de baja: un producto con existencia en cero sale como
  // AGOTADO en la caja para siempre. Se dan de alta solas con el primer
  // corte que les meta bolsas.
  assert.equal(cinco.activo, 0);
  assert.equal(veinte.activo, 0);

  // Y el id de la de 5 kg no cambió aunque le cambiara el nombre (regla
  // 3.3): los cortes que ya le metieron bolsas siguen apuntando ahí.
  assert.equal(cinco.codigo, 'B5');
});
