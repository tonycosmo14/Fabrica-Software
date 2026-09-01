/**
 * LAS CUENTAS DE LA EMPRESA  (v2.7)
 *
 * Los gastos grandes —amoniaco, sal, aceite, maquinaria— y los recibos de
 * la luz. Va aparte de la caja a propósito: es dinero que no pasa por el
 * cajón y que no cuadra nadie al final del turno.
 *
 * QUIÉN ENTRA. El gerente VE: hace falta para saber si un paro de máquina
 * ya se pagó, o cuándo fue la última compra de amoniaco. Solo el
 * administrador CAPTURA: son facturas de decenas de miles de pesos y no es
 * trabajo de turno.
 */
const express = require('express');
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');
const { ok, error } = require('../../lib/respuestas');
const bitacora = require('../../lib/bitacora');
const { exigirPermiso } = require('../../middleware/sesion');
const periodos = require('../../lib/periodos');
const calculo = require('./calculo');
const archivos = require('./archivos');

const router = express.Router();

const ver = exigirPermiso('empresa.ver');
const administrar = exigirPermiso('empresa.administrar');

const FORMAS_PAGO = ['transferencia', 'efectivo', 'cheque', 'tarjeta', 'credito'];

/**
 * Un día del calendario: 2026-08-26. Nada más.
 *
 * No basta con el patrón: "2026-02-31" lo pasa y no existe, y algunos
 * navegadores lo corren al 3 de marzo sin decir nada. Se comprueba que la
 * fecha, ida y vuelta, siga siendo la misma.
 */
function leerDia(valor) {
  const t = String(valor || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return null;

  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (anio < 2000 || anio > 2200 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

  const d = new Date(anio, mes - 1, dia, 12);
  if (d.getFullYear() !== anio || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return t;
}

/** Un importe en pesos, a centavos enteros. */
function leerCentavos(valor) {
  const n = Number(String(valor ?? '').replace(/[$,\s]/g, ''));
  if (!Number.isFinite(n) || n < 0 || n > 99999999) return null;
  return Math.round(n * 100);
}


// ============================================================
// EL MES DEL NEGOCIO
// ============================================================

/**
 * Cómo está partido el mes, y los últimos periodos.
 *
 * Lo pide cualquiera que pueda ver: las pantallas que enseñan "este mes"
 * necesitan saber dónde empieza, y todas tienen que usar la misma regla.
 */
router.get('/periodos', ver, (req, res) => {
  const cuantos = Math.min(Math.max(Number(req.query.cuantos) || 13, 1), 60);
  return ok(res, {
    diaCorte: periodos.diaDeCorte(),
    minimo: periodos.MINIMO,
    maximo: periodos.MAXIMO,
    actual: periodos.periodoDe(),
    periodos: periodos.ultimos(cuantos)
  });
});

router.put('/periodos', administrar, (req, res) => {
  // Entero de verdad: "2.5" redondeado a 3 sería obedecer algo que nadie
  // escribió, y el mes empezaría un día que el dueño no eligió.
  const n = Number(req.body?.diaCorte);
  if (!Number.isInteger(n) || n < periodos.MINIMO || n > periodos.MAXIMO) {
    return error(res,
      `El mes puede empezar del día ${periodos.MINIMO} al ${periodos.MAXIMO}. ` +
      'Del 29 en adelante no vale: febrero no tiene esos días.');
  }

  bd.prepare(`
    INSERT INTO configuracion (clave, valor, actualizado_en, actualizado_por)
    VALUES ('periodo_dia_corte', ?, ?, ?)
    ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor,
      actualizado_en = excluded.actualizado_en, actualizado_por = excluded.actualizado_por
  `).run(String(n), ahora(), req.usuario.id);

  bitacora.registrar({
    accion: 'empresa.mes', entidad: 'configuracion',
    ejecutorId: req.usuario.id, detalle: { diaCorte: n }
  });

  return ok(res, { diaCorte: n, actual: periodos.periodoDe() });
});


// ============================================================
// EN QUÉ SE GASTA — el catálogo
// ============================================================

router.get('/conceptos', ver, (req, res) => {
  const todos = req.query.todos === '1';
  return ok(res, {
    // Los ocultos no salen ni con todos=1: "eliminar" los saca de esta
    // pantalla para siempre. Sus compras viejas siguen contando.
    conceptos: bd.prepare(`
      SELECT * FROM conceptos_empresa
       WHERE oculto = 0 ${todos ? '' : 'AND activo = 1'}
       ORDER BY activo DESC, orden, nombre
    `).all()
  });
});

router.post('/conceptos', administrar, (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  if (!nombre) return error(res, 'Escribe cómo se llama el gasto.');
  if (nombre.length > 40) return error(res, 'El nombre es demasiado largo.');

  const repetido = bd.prepare(
    'SELECT id FROM conceptos_empresa WHERE lower(nombre) = lower(?) AND activo = 1'
  ).get(nombre);
  if (repetido) return error(res, `Ya hay un concepto que se llama "${nombre}".`, 409);

  const cada = req.body?.cadaDias === '' || req.body?.cadaDias == null
    ? null : Math.round(Number(req.body.cadaDias));
  if (cada !== null && (!Number.isFinite(cada) || cada < 1 || cada > 3650)) {
    return error(res, 'Cada cuánto se compra va de 1 día a 10 años, o se deja vacío.');
  }

  const id = nuevoId();
  const orden = bd.prepare('SELECT COALESCE(MAX(orden), 0) n FROM conceptos_empresa').get().n + 1;

  bd.prepare(`
    INSERT INTO conceptos_empresa (id, nombre, unidad, cada_dias, ayuda, orden, fecha_alta)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, nombre,
         String(req.body?.unidad || '').trim().slice(0, 20) || null,
         cada,
         String(req.body?.ayuda || '').trim().slice(0, 120) || null,
         orden, ahora());

  bitacora.registrar({
    accion: 'empresa.concepto_alta', entidad: 'concepto_empresa', entidadId: id,
    ejecutorId: req.usuario.id, detalle: { nombre }
  });

  return ok(res, { concepto: bd.prepare('SELECT * FROM conceptos_empresa WHERE id = ?').get(id) }, 201);
});

/**
 * BORRARLO DE LA LISTA. Igual que en los conceptos de la caja: eliminar lo
 * esconde del catálogo para siempre, pero NO borra nada (regla 3.4). Las
 * facturas que se capturaron con él siguen en la lista de gastos, siguen
 * sumando en el total del mes, y si tienen dinero en el periodo que se está
 * mirando, su renglón sigue saliendo en la tabla de "en qué se fue".
 */
router.post('/conceptos/:id/eliminar', administrar, (req, res) => {
  const c = bd.prepare('SELECT * FROM conceptos_empresa WHERE id = ? AND oculto = 0')
    .get(req.params.id);
  if (!c) return error(res, 'Ese concepto no existe.', 404);

  bd.prepare('UPDATE conceptos_empresa SET oculto = 1, activo = 0, fecha_baja = COALESCE(fecha_baja, ?) WHERE id = ?')
    .run(ahora(), c.id);

  bitacora.registrar({
    accion: 'empresa.concepto_eliminado', entidad: 'concepto_empresa', entidadId: c.id,
    ejecutorId: req.usuario.id,
    detalle: { nombre: c.nombre, nota: 'Se ocultó del catálogo; sus compras siguen contando.' }
  });

  return ok(res, { eliminado: true });
});

/**
 * Editar un concepto. EL ID NO CAMBIA NUNCA (regla 3.3): renombrar
 * "Amoniaco" a "Amoniaco anhidro" no parte el año en dos, y las facturas
 * viejas siguen diciendo lo que decían (regla 3.5).
 */
router.put('/conceptos/:id', administrar, (req, res) => {
  const c = bd.prepare('SELECT * FROM conceptos_empresa WHERE id = ?').get(req.params.id);
  if (!c) return error(res, 'Ese concepto no existe.', 404);

  const cambios = {};

  if (req.body?.nombre !== undefined) {
    const nombre = String(req.body.nombre).trim();
    if (!nombre) return error(res, 'El nombre no puede quedar vacío.');
    if (nombre.length > 40) return error(res, 'El nombre es demasiado largo.');
    const otro = bd.prepare(
      'SELECT id FROM conceptos_empresa WHERE lower(nombre) = lower(?) AND activo = 1 AND id <> ?'
    ).get(nombre, c.id);
    if (otro) return error(res, `Ya hay un concepto que se llama "${nombre}".`, 409);
    cambios.nombre = nombre;
  }
  if (req.body?.unidad !== undefined) {
    cambios.unidad = String(req.body.unidad).trim().slice(0, 20) || null;
  }
  if (req.body?.ayuda !== undefined) {
    cambios.ayuda = String(req.body.ayuda).trim().slice(0, 120) || null;
  }
  if (req.body?.cadaDias !== undefined) {
    const n = req.body.cadaDias === '' || req.body.cadaDias === null
      ? null : Math.round(Number(req.body.cadaDias));
    if (n !== null && (!Number.isFinite(n) || n < 1 || n > 3650)) {
      return error(res, 'Cada cuánto se compra va de 1 día a 10 años, o se deja vacío.');
    }
    cambios.cada_dias = n;
  }
  // Dar de baja no borra nada (regla 3.4): deja de salir al capturar, y lo
  // que ya se compró con él sigue contando en las cuentas del año.
  if (req.body?.activo !== undefined) {
    cambios.activo = req.body.activo ? 1 : 0;
    cambios.fecha_baja = req.body.activo ? null : ahora();
  }

  if (!Object.keys(cambios).length) return error(res, 'No mandaste nada que cambiar.');

  bd.prepare(`UPDATE conceptos_empresa SET ${
    Object.keys(cambios).map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .run(...Object.values(cambios), c.id);

  bitacora.registrar({
    accion: 'empresa.concepto_editado', entidad: 'concepto_empresa', entidadId: c.id,
    ejecutorId: req.usuario.id, detalle: { antes: c.nombre, ...cambios }
  });

  return ok(res, { concepto: bd.prepare('SELECT * FROM conceptos_empresa WHERE id = ?').get(c.id) });
});


// ============================================================
// LOS GASTOS GRANDES
// ============================================================

/**
 * En qué se fue el dinero, por concepto y en un periodo.
 *
 * Sin periodo, el del mes en curso según cómo esté partido el mes.
 */
router.get('/resumen', ver, (req, res) => {
  const p = req.query.periodo ? periodos.porClave(req.query.periodo) : periodos.periodoDe();
  if (!p) return error(res, 'Ese periodo no se entiende.');

  const antes = periodos.anterior(p);
  const total = calculo.totalGastado({ desde: p.desde, hasta: p.hasta });
  const luz = calculo.luzEnPeriodo({ desde: p.desde, hasta: p.hasta });
  const luzAntes = calculo.luzEnPeriodo(antes);

  return ok(res, {
    periodo: p,
    conceptos: calculo.porConcepto({ desde: p.desde, hasta: p.hasta }),
    total,
    // El mismo periodo del mes pasado, para poder comparar sin hacer otra
    // llamada: es lo primero que se mira.
    anterior: calculo.totalGastado(antes),
    // LA LUZ VA APARTE PERO VA. Los recibos de la CFE no son renglones de
    // gastos_empresa (tienen sus propias fechas, su medidor y su papel),
    // pero dejarlos fuera de esta pantalla haría que "lo grande del mes"
    // excluyera justo el gasto más caro de la fábrica. Aquí se reparte por
    // días y se suma, diciendo siempre que es un reparto.
    luz,
    luzAnterior: luzAntes,
    // Y el total de verdad: compras grandes + luz. Se marca si va
    // incompleto para que nadie tome una decisión con medio recibo.
    conLuz: {
      centavos: total.centavos + luz.centavos,
      completo: luz.completo,
      anterior: calculo.totalGastado(antes).centavos + luzAntes.centavos
    }
  });
});

/** Los gastos capturados, del más nuevo al más viejo. */
router.get('/gastos', ver, (req, res) => {
  const limite = Math.min(Math.max(Number(req.query.limite) || 50, 1), 500);
  const p = req.query.periodo ? periodos.porClave(req.query.periodo) : null;
  if (req.query.periodo && !p) return error(res, 'Ese periodo no se entiende.');

  const donde = [];
  const valores = [];
  if (p) { donde.push('g.fecha >= ? AND g.fecha <= ?'); valores.push(p.desde, p.hasta); }
  if (req.query.concepto) { donde.push('g.concepto_id = ?'); valores.push(req.query.concepto); }
  if (req.query.todos !== '1') donde.push('g.anulado_en IS NULL');

  const gastos = bd.prepare(`
    SELECT g.*, u.nombre AS capturista_nombre, e.nombre AS ejecutor_nombre,
           a.nombre AS anulado_por_nombre
      FROM gastos_empresa g
      LEFT JOIN usuarios u ON u.id = g.capturista_id
      LEFT JOIN usuarios e ON e.id = g.ejecutor_id
      LEFT JOIN usuarios a ON a.id = g.anulado_por
     ${donde.length ? 'WHERE ' + donde.join(' AND ') : ''}
     ORDER BY g.fecha DESC, g.fecha_captura DESC
     LIMIT ?
  `).all(...valores, limite);

  return ok(res, {
    periodo: p,
    gastos: gastos.map((g) => ({
      ...g,
      // El precio por unidad se CALCULA (regla 3.2): guardarlo se
      // desincronizaría el día que se corrija la cantidad.
      porUnidad: g.cantidad > 0 ? Math.round(g.centavos / g.cantidad) : null
    }))
  });
});

router.post('/gastos', administrar, (req, res) => {
  const fecha = leerDia(req.body?.fecha);
  if (!fecha) return error(res, 'Escribe el día de la compra, como 2026-08-26.');

  const centavos = leerCentavos(req.body?.monto);
  if (centavos === null || centavos === 0) return error(res, 'Escribe cuánto se pagó.');

  const formaPago = req.body?.formaPago || 'transferencia';
  if (!FORMAS_PAGO.includes(formaPago)) return error(res, 'Esa forma de pago no existe.');

  // El concepto lo pone el CATÁLOGO, no quien llama: es lo único que
  // garantiza que las diez compras de amoniaco del año se llamen igual.
  let conceptoId = null;
  let concepto = String(req.body?.concepto || '').trim();
  let unidad = String(req.body?.unidad || '').trim().slice(0, 20) || null;

  if (req.body?.conceptoId) {
    const c = bd.prepare('SELECT * FROM conceptos_empresa WHERE id = ? AND activo = 1')
      .get(req.body.conceptoId);
    if (!c) return error(res, 'Ese concepto no existe o se dio de baja.', 409);
    conceptoId = c.id;
    concepto = c.nombre;
    if (!unidad) unidad = c.unidad;
  }
  if (!concepto) return error(res, 'Escoge o escribe en qué se gastó.');
  concepto = concepto.slice(0, 60);

  let cantidad = null;
  if (req.body?.cantidad !== undefined && req.body.cantidad !== null && req.body.cantidad !== '') {
    cantidad = Number(req.body.cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0 || cantidad > 1000000) {
      return error(res, 'La cantidad no se entiende.');
    }
  }

  const id = nuevoId();

  // El archivo se guarda ANTES de tocar la base: si falla, no queda un
  // gasto apuntando a un papel que no existe.
  let archivo = null;
  if (req.body?.archivo) {
    const r = archivos.guardar(req.body.archivo, `gasto-${id}`);
    if (r.error) return error(res, r.error);
    archivo = r.archivo;
  }

  bd.prepare(`
    INSERT INTO gastos_empresa
      (id, fecha, concepto_id, concepto, proveedor, cantidad, unidad, centavos,
       forma_pago, factura, archivo, notas, ejecutor_id, capturista_id, fecha_captura)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, fecha, conceptoId, concepto,
         String(req.body?.proveedor || '').trim().slice(0, 60) || null,
         cantidad, unidad, centavos, formaPago,
         String(req.body?.factura || '').trim().slice(0, 40) || null,
         archivo,
         String(req.body?.notas || '').trim().slice(0, 300) || null,
         req.body?.ejecutorId || req.usuario.id, req.usuario.id, ahora());

  bitacora.registrar({
    accion: 'empresa.gasto', entidad: 'gasto_empresa', entidadId: id,
    ejecutorId: req.body?.ejecutorId || req.usuario.id, capturistaId: req.usuario.id,
    detalle: { concepto, centavos, fecha, cantidad, unidad, conArchivo: Boolean(archivo) }
  });

  return ok(res, {
    gasto: bd.prepare('SELECT * FROM gastos_empresa WHERE id = ?').get(id)
  }, 201);
});

/** Anular un gasto mal capturado. No se borra: se marca (regla 3.4). */
router.post('/gastos/:id/anular', administrar, (req, res) => {
  const g = bd.prepare('SELECT * FROM gastos_empresa WHERE id = ?').get(req.params.id);
  if (!g) return error(res, 'Ese gasto no existe.', 404);
  if (g.anulado_en) return error(res, 'Ese gasto ya está anulado.');

  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) return error(res, 'Escribe por qué se anula.');

  bd.prepare(`
    UPDATE gastos_empresa SET anulado_en = ?, anulado_por = ?, motivo_anulacion = ?
     WHERE id = ?
  `).run(ahora(), req.usuario.id, motivo.slice(0, 200), g.id);

  bitacora.registrar({
    accion: 'empresa.gasto_anulado', entidad: 'gasto_empresa', entidadId: g.id,
    ejecutorId: req.usuario.id, detalle: { motivo, concepto: g.concepto, centavos: g.centavos }
  });

  return ok(res, { anulado: true });
});

/** El papel que respalda un gasto. */
router.get('/gastos/:id/archivo', ver, (req, res) => {
  const g = bd.prepare('SELECT archivo, concepto, fecha FROM gastos_empresa WHERE id = ?')
    .get(req.params.id);
  if (!g) return res.status(404).end();
  return archivos.servir(res, g.archivo, `${g.concepto}-${g.fecha}`);
});


// ============================================================
// LOS RECIBOS DE LA LUZ
// ============================================================

router.get('/cfe', ver, (req, res) => {
  return ok(res, {
    recibos: calculo.recibos({
      limite: req.query.limite,
      incluirAnulados: req.query.todos === '1'
    })
  });
});

router.post('/cfe', administrar, (req, res) => {
  const desde = leerDia(req.body?.desde);
  const hasta = leerDia(req.body?.hasta);
  if (!desde || !hasta) {
    return error(res, 'Escribe las dos fechas del recibo, las que vienen impresas.');
  }
  if (hasta <= desde) return error(res, 'La fecha de fin va después de la de inicio.');
  if (calculo.diasEntre(desde, hasta) > 200) {
    return error(res, 'Ese periodo es de más de seis meses. Revisa las fechas.');
  }

  const kwh = Math.round(Number(req.body?.kwh));
  if (!Number.isFinite(kwh) || kwh <= 0 || kwh > 100000000) {
    return error(res, 'Escribe los kilowatts que dice el recibo.');
  }

  const centavos = leerCentavos(req.body?.monto);
  if (centavos === null || centavos === 0) return error(res, 'Escribe cuánto cobraron.');

  // El mismo recibo dos veces duplicaría el gasto del año y partiría a la
  // mitad los kilowatts por marqueta. Se dice antes de guardar, con el
  // renglón que ya está, para que se entienda qué pasó.
  const yaEsta = bd.prepare(
    'SELECT id, desde, hasta FROM recibos_cfe WHERE desde = ? AND hasta = ? AND anulado_en IS NULL'
  ).get(desde, hasta);
  if (yaEsta) {
    return error(res, `Ya hay un recibo capturado del ${desde} al ${hasta}.`, 409);
  }

  const id = nuevoId();

  let archivo = null;
  if (req.body?.archivo) {
    const r = archivos.guardar(req.body.archivo, `cfe-${id}`);
    if (r.error) return error(res, r.error);
    archivo = r.archivo;
  }

  bd.prepare(`
    INSERT INTO recibos_cfe
      (id, desde, hasta, kwh, centavos, numero, archivo, notas, capturista_id, fecha_captura)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, desde, hasta, kwh, centavos,
         String(req.body?.numero || '').trim().slice(0, 40) || null,
         archivo,
         String(req.body?.notas || '').trim().slice(0, 300) || null,
         req.usuario.id, ahora());

  bitacora.registrar({
    accion: 'empresa.cfe', entidad: 'recibo_cfe', entidadId: id,
    ejecutorId: req.usuario.id,
    detalle: { desde, hasta, kwh, centavos, conArchivo: Boolean(archivo) }
  });

  return ok(res, { recibo: calculo.recibo(id) }, 201);
});

/**
 * CORREGIR UN RECIBO capturado con un dato mal.
 *
 * No se retoca el renglón (regla 3.2: los registros no se editan por
 * debajo): se ANULA el viejo con el motivo "corregido" y se captura el
 * bueno, las dos cosas en una sola transacción para que no pueda quedar el
 * periodo sin recibo si algo falla a la mitad. El papel adjunto se hereda
 * salvo que venga uno nuevo, y en la bitácora quedan el viejo y el nuevo.
 */
router.put('/cfe/:id', administrar, (req, res) => {
  const viejo = bd.prepare('SELECT * FROM recibos_cfe WHERE id = ?').get(req.params.id);
  if (!viejo) return error(res, 'Ese recibo no existe.', 404);
  if (viejo.anulado_en) return error(res, 'Ese recibo está anulado; captura uno nuevo.');

  const desde = leerDia(req.body?.desde);
  const hasta = leerDia(req.body?.hasta);
  if (!desde || !hasta) {
    return error(res, 'Escribe las dos fechas del recibo, las que vienen impresas.');
  }
  if (hasta <= desde) return error(res, 'La fecha de fin va después de la de inicio.');
  if (calculo.diasEntre(desde, hasta) > 200) {
    return error(res, 'Ese periodo es de más de seis meses. Revisa las fechas.');
  }

  const kwh = Math.round(Number(req.body?.kwh));
  if (!Number.isFinite(kwh) || kwh <= 0 || kwh > 100000000) {
    return error(res, 'Escribe los kilowatts que dice el recibo.');
  }

  const centavos = leerCentavos(req.body?.monto);
  if (centavos === null || centavos === 0) return error(res, 'Escribe cuánto cobraron.');

  // El periodo nuevo no puede chocar con OTRO recibo vivo (el propio no
  // cuenta: es el que se está corrigiendo).
  const choca = bd.prepare(`
    SELECT id FROM recibos_cfe
     WHERE desde = ? AND hasta = ? AND anulado_en IS NULL AND id <> ?
  `).get(desde, hasta, viejo.id);
  if (choca) return error(res, `Ya hay otro recibo capturado del ${desde} al ${hasta}.`, 409);

  const id = nuevoId();

  let archivo = viejo.archivo;
  if (req.body?.archivo) {
    const r = archivos.guardar(req.body.archivo, `cfe-${id}`);
    if (r.error) return error(res, r.error);
    archivo = r.archivo;
  }

  bd.transaction(() => {
    bd.prepare(`
      UPDATE recibos_cfe SET anulado_en = ?, anulado_por = ?, motivo_anulacion = ?
       WHERE id = ?
    `).run(ahora(), req.usuario.id, 'Corregido: lo sustituye otro renglón', viejo.id);

    bd.prepare(`
      INSERT INTO recibos_cfe
        (id, desde, hasta, kwh, centavos, numero, archivo, notas, capturista_id, fecha_captura)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, desde, hasta, kwh, centavos,
           String(req.body?.numero || '').trim().slice(0, 40) || null,
           archivo,
           String(req.body?.notas || '').trim().slice(0, 300) || null,
           req.usuario.id, ahora());
  })();

  bitacora.registrar({
    accion: 'empresa.cfe_corregido', entidad: 'recibo_cfe', entidadId: id,
    ejecutorId: req.usuario.id,
    detalle: { sustituyeA: viejo.id, desde, hasta, kwh, centavos }
  });

  return ok(res, { recibo: calculo.recibo(id) });
});

router.post('/cfe/:id/anular', administrar, (req, res) => {
  const r = bd.prepare('SELECT * FROM recibos_cfe WHERE id = ?').get(req.params.id);
  if (!r) return error(res, 'Ese recibo no existe.', 404);
  if (r.anulado_en) return error(res, 'Ese recibo ya está anulado.');

  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) return error(res, 'Escribe por qué se anula.');

  bd.prepare(`
    UPDATE recibos_cfe SET anulado_en = ?, anulado_por = ?, motivo_anulacion = ?
     WHERE id = ?
  `).run(ahora(), req.usuario.id, motivo.slice(0, 200), r.id);

  bitacora.registrar({
    accion: 'empresa.cfe_anulado', entidad: 'recibo_cfe', entidadId: r.id,
    ejecutorId: req.usuario.id, detalle: { motivo, desde: r.desde, hasta: r.hasta }
  });

  return ok(res, { anulado: true });
});

// ============================================================
// LOS PROVEEDORES — el manual de la fábrica
//
// "Para dejárselo a mis hijos si un día no estoy: mínimo que sepan qué
// hacer." No es un catálogo de compras: es a quién hablarle para que la
// fábrica siga andando, y qué hay que saber al tratar con cada uno.
// ============================================================

const CAMPOS_PROVEEDOR = ['nombre', 'que_hace', 'telefono', 'direccion',
                          'ubicacion', 'horarios', 'notas'];

function leerProveedor(cuerpo = {}) {
  const limpio = {};
  for (const campo of CAMPOS_PROVEEDOR) {
    // En el cuerpo llegan en camelCase (queHace); en la tabla van con guion.
    const clave = campo.replace(/_(\w)/g, (_, l) => l.toUpperCase());
    if (cuerpo[clave] === undefined) continue;
    const tope = campo === 'que_hace' || campo === 'notas' ? 600 : 160;
    limpio[campo] = String(cuerpo[clave]).trim().slice(0, tope) || null;
  }
  return limpio;
}

router.get('/proveedores', ver, (req, res) => {
  const todos = req.query.todos === '1';
  return ok(res, {
    proveedores: bd.prepare(`
      SELECT * FROM proveedores
       ${todos ? '' : 'WHERE activo = 1'}
       ORDER BY activo DESC, nombre
    `).all()
  });
});

router.post('/proveedores', administrar, (req, res) => {
  const datos = leerProveedor(req.body);
  if (!datos.nombre) return error(res, 'Escribe cómo se llama el proveedor.');

  const repetido = bd.prepare(
    'SELECT id FROM proveedores WHERE lower(nombre) = lower(?) AND activo = 1'
  ).get(datos.nombre);
  if (repetido) return error(res, `Ya hay un proveedor que se llama "${datos.nombre}".`, 409);

  const id = nuevoId();
  bd.prepare(`
    INSERT INTO proveedores (id, nombre, que_hace, telefono, direccion,
                             ubicacion, horarios, notas, fecha_alta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, datos.nombre, datos.que_hace || null, datos.telefono || null,
         datos.direccion || null, datos.ubicacion || null,
         datos.horarios || null, datos.notas || null, ahora());

  bitacora.registrar({
    accion: 'empresa.proveedor_alta', entidad: 'proveedor', entidadId: id,
    ejecutorId: req.usuario.id, detalle: { nombre: datos.nombre }
  });
  return ok(res, { proveedor: bd.prepare('SELECT * FROM proveedores WHERE id = ?').get(id) }, 201);
});

router.put('/proveedores/:id', administrar, (req, res) => {
  const pr = bd.prepare('SELECT * FROM proveedores WHERE id = ?').get(req.params.id);
  if (!pr) return error(res, 'Ese proveedor no existe.', 404);

  const cambios = leerProveedor(req.body);
  if (cambios.nombre === null) return error(res, 'El nombre no puede quedar vacío.');

  if (req.body?.activo !== undefined) {
    cambios.activo = req.body.activo ? 1 : 0;
    cambios.fecha_baja = req.body.activo ? null : ahora();
  }
  if (!Object.keys(cambios).length) return error(res, 'No mandaste nada que cambiar.');

  const campos = Object.keys(cambios).map((k) => `${k} = ?`).join(', ');
  bd.prepare(`UPDATE proveedores SET ${campos} WHERE id = ?`)
    .run(...Object.values(cambios), pr.id);

  bitacora.registrar({
    accion: 'empresa.proveedor_editado', entidad: 'proveedor', entidadId: pr.id,
    ejecutorId: req.usuario.id, detalle: { cambios: Object.keys(cambios) }
  });
  return ok(res, { proveedor: bd.prepare('SELECT * FROM proveedores WHERE id = ?').get(pr.id) });
});

/**
 * Eliminar un proveedor de verdad. Aquí sí se puede: ningún registro apunta
 * a esta tabla —en los gastos el proveedor va COPIADO como texto (regla
 * 3.5)—, así que borrar un renglón no deja a nadie mintiendo.
 */
router.post('/proveedores/:id/eliminar', administrar, (req, res) => {
  const pr = bd.prepare('SELECT * FROM proveedores WHERE id = ?').get(req.params.id);
  if (!pr) return error(res, 'Ese proveedor no existe.', 404);

  bd.prepare('DELETE FROM proveedores WHERE id = ?').run(pr.id);
  bitacora.registrar({
    accion: 'empresa.proveedor_eliminado', entidad: 'proveedor', entidadId: pr.id,
    ejecutorId: req.usuario.id, detalle: { nombre: pr.nombre }
  });
  return ok(res, { eliminado: true });
});

/** El PDF del recibo. */
router.get('/cfe/:id/archivo', ver, (req, res) => {
  const r = bd.prepare('SELECT archivo, desde FROM recibos_cfe WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).end();
  return archivos.servir(res, r.archivo, `recibo-cfe-${r.desde}`);
});

module.exports = router;
