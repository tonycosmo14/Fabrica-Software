/**
 * PRUEBAS DE LA PLANTA DE AGUA  (v5.2)
 *
 * Lo que se prueba es lo que decide el diseño, no la fachada:
 *
 *  · EL RECHAZO DE SALES, que es el número que decide cuándo cambiar seis
 *    membranas. Si esta cuenta está mal, el sistema dice que todo va bien
 *    mientras el agua deja de ser potable — y nadie lo nota, porque el
 *    agua se ve igual.
 *  · QUE VACÍO Y CERO SEAN COSAS DISTINTAS. "Cloro 0" es la buena noticia
 *    del día; "cloro vacío" es que nadie lo midió. Confundirlos daría por
 *    bueno un carbón saturado.
 *  · QUE LOS MEDIDORES SE RESTEN, no se sumen, y que un medidor que marca
 *    menos que la vez pasada no invente un consumo negativo.
 *  · QUE EL PUESTO Y LA PIEZA SEAN DOS COSAS: cambiar una membrana no
 *    puede borrar la anterior.
 *  · QUE UNA VUELTA DE TURNO NO PUEDA MOVER LO QUE CUESTA UNA MEMBRANA.
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, entrarPorNombre, bd, preparar } = fabricaDePrueba('agua');

const calculo = require('../src/modulos/agua/calculo');

let operario;

preparar(async () => {
  operario = (await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Chuy Pech', rol: 'operario', pin: '2222' }
  })).json.datos.usuario;
});

/** Anota una vuelta. Lo que no se le pase, no se midió. */
const vuelta = (cuerpo) => llamar('/api/agua/lecturas', { method: 'POST', cuerpo });

const traerPlanta = async () => (await llamar('/api/agua')).json.datos;
const traer = async (id) => (await llamar(`/api/agua/${id}`)).json.datos;

/**
 * BORRÓN Y CUENTA NUEVA DE LECTURAS.
 *
 * Todas las pruebas de este archivo comparten una sola fábrica, y las
 * lecturas son globales: no cuelgan de un equipo ni de un cliente, cuelgan
 * de la planta. Así que las vueltas que anotó una prueba entran en el
 * cuadre de la siguiente, y las cuentas salen con los litros de otro.
 *
 * Las tres pruebas que miran el ACUMULADO —el cuadre y la anulación—
 * empiezan desde cero llamando a esto. Se borra a mano y no por la API a
 * propósito: anular deja la fila escrita (regla 3.4), que es justo lo que
 * aquí estorba.
 */
const limpiarLecturas = () => bd.prepare('DELETE FROM agua_lecturas').run();

// ============================================================
// EL EQUIPO QUE VIENE DADO DE ALTA
// ============================================================

test('la planta arranca con el equipo que hay en la fábrica, en orden', async () => {
  const d = await traerPlanta();
  const nombres = d.equipos.map((e) => e.nombre);

  // Las seis membranas, los dos suavizadores y los cinco tinacos.
  assert.equal(nombres.filter((n) => n.startsWith('Membrana')).length, 6);
  assert.equal(nombres.filter((n) => n.startsWith('Suavizador')).length, 2);
  assert.equal(nombres.filter((n) => n.startsWith('Tinaco')).length, 5);

  // EL CARBÓN VA ANTES QUE LAS MEMBRANAS, y no es un detalle de adorno:
  // es lo único que evita que el cloro se las coma. Si alguien reordena
  // la migración y esto se invierte, la pantalla enseñaría un tren que no
  // explica por qué el cloro es una emergencia.
  const orden = (n) => d.equipos.find((e) => e.nombre === n).orden;
  assert.ok(orden('Filtro de carbón activado') < orden('Membrana 1'),
    'el carbón tiene que ir antes que las membranas');
  assert.ok(orden('Suavizador A') < orden('Membrana 1'),
    'el suavizador va antes que las membranas');
  assert.ok(orden('Luz ultravioleta') > orden('Tinaco 1'),
    'la luz ultravioleta va al final, después del almacenamiento');
});

// ============================================================
// EL NÚMERO QUE MANDA
// ============================================================

test('el rechazo de sales se saca de las dos lecturas de TDS', async () => {
  const r = await vuelta({ tdsEntrada: 800, tdsSalida: 20 });
  assert.equal(r.estado, 201);
  // (800 − 20) / 800 = 97.5 %
  assert.equal(r.json.datos.lectura.rechazo, 97.5);
});

test('sin TDS de entrada no hay rechazo que sacar, y se dice que no', async () => {
  const r = await vuelta({ tdsSalida: 20 });
  assert.equal(r.estado, 201);
  // null, NO cero: cero se leería como "no rechaza nada", que es lo
  // contrario de "no se sabe".
  assert.equal(r.json.datos.lectura.rechazo, null);
});

test('un TDS de entrada en cero no da un 100 % perfecto', async () => {
  // Dividir entre cero da Infinity, y redondeado se vería como el mejor
  // rechazo de la historia justo cuando el dato no sirve.
  const r = await vuelta({ tdsEntrada: 0, tdsSalida: 0 });
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.lectura.rechazo, null);
});

test('el agua no se purifica al revés: la salida no puede traer más sales', async () => {
  const r = await vuelta({ tdsEntrada: 20, tdsSalida: 800 });
  assert.equal(r.estado, 400);
  assert.match(r.json.error, /al revés/);
});

test('el rechazo bajo enciende el aviso, y el bueno no', async () => {
  await vuelta({ tdsEntrada: 800, tdsSalida: 20 });          // 97.5 %
  let d = await traerPlanta();
  assert.equal(d.pendientes.rechazo, null, 'con 97.5 % no debería avisar');

  await vuelta({ tdsEntrada: 800, tdsSalida: 120 });         // 85 %
  d = await traerPlanta();
  assert.ok(d.pendientes.rechazo, 'con 85 % tiene que avisar');
  assert.equal(d.pendientes.rechazo.rechazo, 85);
});

// ============================================================
// VACÍO Y CERO NO SON LO MISMO
// ============================================================

test('cloro cero es una medición; cloro vacío es que nadie midió', async () => {
  const conCero = await vuelta({ tdsEntrada: 500, cloro: 0 });
  assert.equal(conCero.json.datos.lectura.cloro, 0);
  assert.equal(conCero.json.datos.lectura.hayCloro, false);

  const sinNada = await vuelta({ tdsEntrada: 500 });
  assert.equal(sinNada.json.datos.lectura.cloro, null);
  assert.equal(sinNada.json.datos.lectura.hayCloro, false);

  // Y lo importante: el que sí trae cloro sí avisa.
  const conCloro = await vuelta({ tdsEntrada: 500, cloro: 0.4 });
  assert.equal(conCloro.json.datos.lectura.hayCloro, true);
  const d = await traerPlanta();
  assert.ok(d.pendientes.cloro, 'el cloro después del carbón tiene que avisar');
});

test('una vuelta con todo vacío no se guarda', async () => {
  const r = await vuelta({});
  assert.equal(r.estado, 400);
  assert.match(r.json.error, /al menos una medición/);
});

// ============================================================
// LOS MEDIDORES SON TOTALIZADORES
// ============================================================

test('los litros son la resta contra la vuelta anterior, no lo que marca', async () => {
  await vuelta({ litrosEntrada: 100000, litrosSalida: 60000 });
  const segunda = await vuelta({ litrosEntrada: 104000, litrosSalida: 62400 });

  const l = segunda.json.datos.lectura;
  assert.equal(l.gastoEntrada, 4000);
  assert.equal(l.gastoSalida, 2400);
  assert.equal(l.tirada, 1600);
  assert.equal(l.recuperacion, 60);
});

test('la primera lectura no inventa consumo: no hay contra qué restar', async () => {
  // Sin limpiar, esta prueba pasaría por el motivo equivocado: la lectura
  // anterior marca MÁS, y lo que devolvería null sería la regla del
  // medidor al revés, no la de "no hay contra qué restar".
  limpiarLecturas();
  const r = await vuelta({ litrosEntrada: 100000, litrosSalida: 60000 });
  assert.equal(r.json.datos.lectura.gastoEntrada, null);
  assert.equal(r.json.datos.lectura.tirada, null);
});

test('un medidor que marca MENOS que antes no da consumo negativo', async () => {
  await vuelta({ litrosSalida: 500000 });
  // Se cambió el medidor y el nuevo empieza en cero.
  const r = await vuelta({ litrosSalida: 120 });

  const l = r.json.datos.lectura;
  assert.equal(l.gastoSalida, null, 'no se inventa un consumo');
  assert.equal(l.medidorAlReves, true, 'pero sí se marca, para que se vea');
});

test('un día sin anotar no se pierde: lo recoge la vuelta siguiente', async () => {
  // Es la razón entera de guardar lo que marca en vez de lo del día.
  await vuelta({ litrosSalida: 10000 });
  // (aquí faltaría el día de en medio)
  const despues = await vuelta({ litrosSalida: 16000 });
  assert.equal(despues.json.datos.lectura.gastoSalida, 6000);
});

// ============================================================
// EL CUADRE DEL AGUA
// ============================================================

test('el cuadre compara el medidor contra la teoría del hielo', async () => {
  limpiarLecturas();
  await vuelta({ litrosSalida: 200000 });
  await vuelta({ litrosSalida: 215000 });

  const hoy = calculo.hoy();
  const { cuadre } = (await llamar(`/api/agua/cuadre?desde=${hoy}&hasta=${hoy}`)).json.datos;

  assert.equal(cuadre.producida, 15000);
  assert.equal(cuadre.litrosMarqueta, 150, '150 kg de marqueta son 150 L');
  // Sin producción de hielo en esta prueba, la teoría es cero y todo el
  // agua queda "por explicar" — que es exactamente lo que debe decir.
  assert.equal(cuadre.teoriaHielo, cuadre.marquetas * 150);
  assert.equal(cuadre.sinExplicar, 15000 - cuadre.teoriaHielo);
});

test('sin dos lecturas con medidor, el cuadre dice que no hay datos', async () => {
  limpiarLecturas();
  const hoy = calculo.hoy();
  await vuelta({ tdsEntrada: 700, tdsSalida: 30 });   // sin medidores
  const { cuadre } = (await llamar(`/api/agua/cuadre?desde=${hoy}&hasta=${hoy}`)).json.datos;
  assert.equal(cuadre.hayDatos, false);
});

// ============================================================
// EL PUESTO Y LA PIEZA
// ============================================================

test('cambiar una membrana no borra la anterior: se apila', async () => {
  const id = 'agua-memb-1';

  await llamar(`/api/agua/${id}/piezas`, {
    method: 'POST', cuerpo: { marca: 'Vontron', modelo: 'ULP21-4040', costo: 2800 }
  });
  await llamar(`/api/agua/${id}/piezas`, {
    method: 'POST', cuerpo: { marca: 'Filmtec', modelo: 'BW60', costo: 3400, motivo: 'falla' }
  });

  const d = await traer(id);
  assert.equal(d.piezas.length, 2, 'las dos tienen que seguir ahí');
  assert.equal(d.equipo.pieza.marca, 'Filmtec', 'la puesta es la nueva');

  const vieja = d.piezas.find((p) => p.marca === 'Vontron');
  assert.ok(vieja.quitada_en, 'la anterior queda cerrada');
  assert.equal(vieja.motivo_quitada, 'falla');

  // Y el gasto del PUESTO suma las dos: es el número que descubre que un
  // puesto se come membranas más rápido que sus iguales.
  assert.equal(d.equipo.gasto.piezasCentavos, 620000);
});

test('nunca hay dos piezas puestas en el mismo equipo a la vez', async () => {
  const id = 'agua-memb-2';
  for (const marca of ['A', 'B', 'C']) {
    await llamar(`/api/agua/${id}/piezas`, { method: 'POST', cuerpo: { marca } });
  }
  const puestas = bd.prepare(`
    SELECT COUNT(*) n FROM agua_piezas
     WHERE equipo_id = ? AND quitada_en IS NULL AND anulado_en IS NULL
  `).get(id).n;
  assert.equal(puestas, 1);
});

test('la vida se mide por días y por litros, y manda la más adelantada', async () => {
  const equipo = { vida_dias: 100, vida_litros: 10000, fecha_alta: calculo.hoy() };
  const hace = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);

  // 50 días de 100 = 50 %, pero 9,000 litros de 10,000 = 90 %. Manda 90.
  const v = calculo.vidaDe(equipo, { puesta_en: hace(50), litros_al_poner: 1000 }, 10000);
  assert.equal(v.gastada, 90);
  assert.equal(v.porVencer, true);
  assert.equal(v.vencida, false);

  // Y al revés: 120 días de 100 ya venció, aunque no haya pasado agua.
  const w = calculo.vidaDe(equipo, { puesta_en: hace(120), litros_al_poner: 9999 }, 10000);
  assert.equal(w.vencida, true);
});

test('un equipo sin vida puesta no se vigila, en vez de salir vencido', async () => {
  // Un tinaco no se cambia cada tantos días. Si `vidaDe` devolviera cero
  // por defecto, los cinco tinacos saldrían "por cambiar" para siempre.
  const d = await traerPlanta();
  const tinaco = d.equipos.find((e) => e.nombre === 'Tinaco 1');
  assert.equal(tinaco.vida, null);
  assert.equal(d.pendientes.vencidas.some((e) => e.nombre === 'Tinaco 1'), false);
});

test('una pieza que pasó de sus días sale en las vencidas', async () => {
  const id = 'agua-carbon';
  await llamar(`/api/agua/${id}/piezas`, { method: 'POST', cuerpo: { marca: 'Clack' } });
  // El carbón trae 730 días de vida; se envejece la pieza.
  bd.prepare('UPDATE agua_piezas SET puesta_en = ? WHERE equipo_id = ?')
    .run(new Date(Date.now() - 800 * 86400000).toISOString().slice(0, 10), id);

  const d = await traerPlanta();
  assert.ok(d.pendientes.vencidas.some((e) => e.id === id),
    'el carbón vencido tiene que salir en el tablero');
});

// ============================================================
// LOS SERVICIOS
// ============================================================

test('una falla deja el equipo marcado; un retrolavado no', async () => {
  const falla = await llamar('/api/agua/agua-suav-a/servicios', {
    method: 'POST', cuerpo: { tipo: 'falla', queTiene: 'No regenera' }
  });
  assert.equal(falla.json.datos.equipo.estado, 'reparacion');

  const lavado = await llamar('/api/agua/agua-zeolita/servicios', {
    method: 'POST', cuerpo: { tipo: 'retrolavado', queTiene: 'Retrolavado de 20 min' }
  });
  assert.equal(lavado.json.datos.equipo.estado, 'trabajando',
    'un retrolavado es trabajo normal, no una avería');
  // Y se anota YA HECHO: nadie "reporta" un retrolavado y espera.
  assert.ok(lavado.json.datos.servicios[0].atendido_en);
});

test('al atender la última falla el equipo vuelve a trabajar solo', async () => {
  const id = 'agua-suav-b';
  const r = await llamar(`/api/agua/${id}/servicios`, {
    method: 'POST', cuerpo: { tipo: 'falla', queTiene: 'Gotea' }
  });
  assert.equal(r.json.datos.equipo.estado, 'reparacion');

  const servicio = r.json.datos.servicios[0];
  await llamar(`/api/agua/servicios/${servicio.id}/atender`, {
    method: 'POST', cuerpo: { queSeHizo: 'Se cambió el empaque', costo: 350 }
  });

  const d = await traer(id);
  assert.equal(d.equipo.estado, 'trabajando');
  assert.equal(d.equipo.gasto.serviciosCentavos, 35000);
});

test('lo anulado no cuenta en el gasto', async () => {
  const id = 'agua-ozono';
  const r = await llamar(`/api/agua/${id}/servicios`, {
    method: 'POST', cuerpo: { tipo: 'falla', queTiene: 'No prende' }
  });
  const servicio = r.json.datos.servicios[0];
  await llamar(`/api/agua/servicios/${servicio.id}/atender`, {
    method: 'POST', cuerpo: { queSeHizo: 'Se cambió la celda', costo: 1200 }
  });
  assert.equal((await traer(id)).equipo.gasto.serviciosCentavos, 120000);

  await llamar(`/api/agua/servicios/${servicio.id}/anular`, {
    method: 'POST', cuerpo: { motivo: 'Se anotó en el equipo equivocado' }
  });
  assert.equal((await traer(id)).equipo.gasto.serviciosCentavos, 0);
});

// ============================================================
// LAS LECTURAS NO SE EDITAN, SE ANULAN
// ============================================================

test('una lectura anulada deja de contar, pero se queda escrita', async () => {
  limpiarLecturas();
  const r = await vuelta({ tdsEntrada: 800, tdsSalida: 400 });   // 50 %: malísimo
  const id = r.json.datos.lectura.id;

  let d = await traerPlanta();
  assert.ok(d.pendientes.rechazo, 'con 50 % tiene que estar avisando');

  const anular = await llamar(`/api/agua/lecturas/${id}/anular`, {
    method: 'POST', cuerpo: { motivo: 'Se midió con la sonda descalibrada' }
  });
  assert.equal(anular.estado, 200);

  d = await traerPlanta();
  assert.equal(d.pendientes.ultima, null, 'ya no cuenta');
  // Pero la fila sigue ahí, con su motivo (regla 3.4).
  const fila = bd.prepare('SELECT * FROM agua_lecturas WHERE id = ?').get(id);
  assert.ok(fila.anulado_en);
  assert.match(fila.motivo_anulacion, /descalibrada/);
});

test('anular pide el motivo', async () => {
  const r = await vuelta({ tdsEntrada: 700, tdsSalida: 30 });
  const anular = await llamar(`/api/agua/lecturas/${r.json.datos.lectura.id}/anular`, {
    method: 'POST', cuerpo: {}
  });
  assert.equal(anular.estado, 400);
});

// ============================================================
// QUIÉN PUEDE QUÉ
// ============================================================

test('el operario anota la vuelta pero no toca lo que cuesta una membrana', async () => {
  await entrarPorNombre('Chuy Pech', '2222');

  // Dar la vuelta sí: es su trabajo, y con el aparato en la mano.
  const suya = await vuelta({ tdsEntrada: 800, tdsSalida: 25, cloro: 0 });
  assert.equal(suya.estado, 201);

  // Reportar una falla también: la avería se ve cuando se ve.
  const falla = await llamar('/api/agua/agua-uv/servicios', {
    method: 'POST', cuerpo: { tipo: 'falla', queTiene: 'La lámpara no prende' }
  });
  assert.equal(falla.estado, 201);

  // Poner una pieza no: eso es una compra.
  const pieza = await llamar('/api/agua/agua-uv/piezas', {
    method: 'POST', cuerpo: { marca: 'Sterilight', costo: 1450 }
  });
  assert.equal(pieza.estado, 403);

  // Y mover el límite del TDS tampoco: es lo que decide si el agua se
  // embotella o no.
  const ajustes = await llamar('/api/agua/ajustes', {
    method: 'PUT', cuerpo: { tdsMaximo: 900 }
  });
  assert.equal(ajustes.estado, 403);

  await entrarAdmin();
});

// ============================================================
// LOS AJUSTES
// ============================================================

test('los límites se guardan y cambian a quién avisa', async () => {
  await llamar('/api/agua/ajustes', { method: 'PUT', cuerpo: { tdsMaximo: 10 } });
  await vuelta({ tdsEntrada: 800, tdsSalida: 25 });          // 25 > 10

  let d = await traerPlanta();
  assert.equal(d.pendientes.ajustes.tdsMaximo, 10);
  assert.ok(d.pendientes.tds, 'con el límite en 10, 25 ppm se pasa');

  await llamar('/api/agua/ajustes', { method: 'PUT', cuerpo: { tdsMaximo: 50 } });
  d = await traerPlanta();
  assert.equal(d.pendientes.tds, null, 'con el límite en 50 ya no');
});

test('un límite que no se entiende no se guarda', async () => {
  const r = await llamar('/api/agua/ajustes', {
    method: 'PUT', cuerpo: { rechazoMinimo: 'noventa' }
  });
  assert.equal(r.estado, 400);
});

test('la ruta de los ajustes no se la come la de /:id', async () => {
  // Express prueba en orden: con PUT /:id declarado arriba, esto habría
  // intentado editar un equipo llamado "ajustes". Pasó en las neveras.
  const r = await llamar('/api/agua/ajustes', {
    method: 'PUT', cuerpo: { diasSinLectura: 3 }
  });
  assert.equal(r.estado, 200);
  assert.equal((await traerPlanta()).pendientes.ajustes.diasSinLectura, 3);
});

// ============================================================
// DAR DE BAJA
// ============================================================

test('un equipo de baja sale del tren pero se queda con su historia', async () => {
  const id = 'agua-tinaco-5';
  await llamar(`/api/agua/${id}/servicios`, {
    method: 'POST', cuerpo: { tipo: 'otro', queTiene: 'Se le puso tapa nueva' }
  });

  const r = await llamar(`/api/agua/${id}/baja`, {
    method: 'POST', cuerpo: { motivo: 'Se cambió por uno de 2500 L' }
  });
  assert.equal(r.estado, 200);

  const d = await traerPlanta();
  assert.equal(d.equipos.some((e) => e.id === id), false, 'ya no sale en el tren');

  const conBaja = (await llamar('/api/agua?baja=1')).json.datos;
  const viejo = conBaja.equipos.find((e) => e.id === id);
  assert.equal(viejo.estado, 'baja');
  assert.match(viejo.motivo_baja, /2500/);
  assert.equal((await traer(id)).servicios.length, 1, 'su historia sigue ahí');
});

// ============================================================
// LOS AVISOS POR CORREO
// ============================================================

test('una sola vuelta mala manda los tres correos, no uno', async () => {
  // Son tres problemas distintos con tres arreglos distintos. Juntarlos en
  // un correo haría que el del cloro —el urgente— se leyera como un
  // renglón más de un informe.
  const poner = (clave, valor) => bd.prepare(`
    INSERT INTO configuracion (clave, valor, actualizado_en)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor
  `).run(clave, valor);

  // Una cuenta de mentiras: basta para que la cola acepte apuntar. No se
  // entrega nada — el servidor de ese puerto no existe y la cola reintenta
  // sola, que es justo lo que hace en la fábrica cuando se cae internet.
  for (const [k, v] of [['correo_activo', '1'], ['correo_servidor', '127.0.0.1'],
                        ['correo_puerto', '2599'], ['correo_seguridad', 'plano'],
                        ['correo_usuario', 'fabrica@ejemplo.com'],
                        ['correo_contrasena', 'x'], ['correo_para', 'tony@ejemplo.com'],
                        ['aviso_agua_cloro', '1'], ['aviso_agua_tds', '1'],
                        ['aviso_agua_membranas', '1']]) poner(k, v);

  bd.prepare('DELETE FROM correos').run();
  limpiarLecturas();

  // Cloro pasando, TDS por encima del límite y rechazo por debajo: los tres.
  await vuelta({ tdsEntrada: 800, tdsSalida: 170, cloro: 0.5 });

  const salieron = bd.prepare('SELECT aviso FROM correos ORDER BY rowid').all()
    .map((c) => c.aviso);
  assert.deepEqual(salieron.sort(), ['agua_cloro', 'agua_membranas', 'agua_tds']);

  // Y una vuelta buena no manda ninguno.
  bd.prepare('DELETE FROM correos').run();
  await vuelta({ tdsEntrada: 800, tdsSalida: 20, cloro: 0 });
  assert.equal(bd.prepare('SELECT COUNT(*) n FROM correos').get().n, 0);

  poner('correo_activo', '0');
});
