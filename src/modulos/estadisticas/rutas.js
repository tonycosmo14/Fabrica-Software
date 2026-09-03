/**
 * LAS ESTADÍSTICAS — la API  (v2.9)
 *
 * Una sola llamada devuelve todo lo de un periodo: la pantalla no puede
 * pedir ocho cosas por separado y quedarse a medio pintar si una falla.
 * Las series de doce meses van aparte porque son las caras y no siempre
 * se miran.
 */
const express = require('express');
const { bd } = require('../../db/conexion');
const { ahora } = require('../../lib/ids');
const { ok, error } = require('../../lib/respuestas');
const { exigirPermiso } = require('../../middleware/sesion');
const periodos = require('../../lib/periodos');
const calculo = require('./calculo');
const empresa = require('../empresa/calculo');
const { CALIDADES } = require('../produccion/calidad');

const router = express.Router();
const ver = exigirPermiso('estadisticas.ver');

/**
 * EL ORDEN DE LOS APARTADOS DE LA HOJA  (v4.6)
 *
 * "Que pueda subir o bajar las gráficas o datos que quiera ver primero."
 *
 * Se guarda en la fábrica y no en el navegador, para que sea el mismo
 * desde la PC y desde la pantalla táctil. Es una lista de ids separados
 * por comas; lo que no se reconozca lo tira la pantalla.
 */
function ordenGuardado() {
  const valor = bd.prepare(
    "SELECT valor FROM configuracion WHERE clave = 'estadisticas_orden'").get()?.valor || '';
  return valor.split(',').map((x) => x.trim()).filter(Boolean);
}

/** Todo lo de un periodo, y el anterior para poder comparar. */
router.get('/', ver, (req, res) => {
  const p = req.query.periodo ? periodos.porClave(req.query.periodo) : periodos.periodoDe();
  if (!p) return error(res, 'Ese periodo no se entiende.');

  const antes = periodos.anterior(p);
  const rango = periodos.instantes(p);
  const rangoAntes = periodos.instantes(antes);

  const v = calculo.ventas(rango);
  const vAntes = calculo.ventas(rangoAntes);
  const prod = calculo.produccion(rango);
  const prodAntes = calculo.produccion(rangoAntes);
  const costo = calculo.costoPorMarqueta(p);
  const costoAntes = calculo.costoPorMarqueta(antes);

  return ok(res, {
    periodo: p,
    anterior: { clave: antes.clave, nombre: antes.nombre },
    ventas: v,
    ventasAntes: vAntes,
    hielo: calculo.hieloVendido(rango),
    abonos: calculo.abonos(rango),
    produccion: prod,
    produccionAntes: prodAntes,
    costo,
    costoAntes,
    gastos: calculo.gastosDelCajon(rango),
    // Los gastos grandes por concepto ya los sabe sacar el módulo de la
    // empresa; no se copia la consulta, se le pregunta a él.
    grandes: empresa.porConcepto({ desde: p.desde, hasta: p.hasta })
      .filter((c) => c.centavos > 0),
    luz: empresa.luzEnPeriodo({ desde: p.desde, hasta: p.hasta }),
    // LA LUZ, DESARMADA (v4.6): cuánta se consumió, a cómo la cobraron y
    // cuánta cuesta hacer una marqueta. Tres preguntas distintas dentro de
    // un recibo más caro, y por separado cada una tiene respuesta.
    luzPorMarqueta: calculo.luzPorMarqueta(p),
    luzPorMarquetaAntes: calculo.luzPorMarqueta(antes),
    // Quién compra más, del que más se lleva al que menos.
    porCliente: calculo.porCliente(rango),
    porObrero: calculo.porObrero(rango),
    porDia: calculo.porDia(p),
    // Cómo se llama y qué significa cada estado del hielo. Viaja con los
    // números para que la pantalla no tenga su propia copia de los nombres.
    calidades: CALIDADES,
    // Los meses que se pueden elegir arriba.
    periodos: periodos.ultimos(25).map((x) => ({ clave: x.clave, nombre: x.nombre, fechas: x.fechas })),
    orden: ordenGuardado()
  });
});

/** Guardar el orden en que se quieren ver los apartados. */
router.put('/orden', ver, (req, res) => {
  const lista = Array.isArray(req.body?.orden) ? req.body.orden : null;
  if (!lista) return error(res, 'Mándame la lista de apartados.');

  // Ids cortos y sin repetir. No se comprueba contra una lista fija a
  // propósito: los apartados los conoce la pantalla, y atarlos aquí
  // obligaría a tocar el servidor cada vez que se agrega uno.
  const limpios = [...new Set(lista.map((x) => String(x).trim())
    .filter((x) => /^[a-z0-9_-]{1,30}$/i.test(x)))];
  if (!limpios.length) return error(res, 'Esa lista no trae ningún apartado.');
  if (limpios.length > 40) return error(res, 'Esa lista trae demasiados apartados.');

  bd.prepare(`
    INSERT INTO configuracion (clave, valor, actualizado_en, actualizado_por)
    VALUES ('estadisticas_orden', ?, ?, ?)
    ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor,
      actualizado_en = excluded.actualizado_en, actualizado_por = excluded.actualizado_por
  `).run(limpios.join(','), ahora(), req.usuario.id);

  return ok(res, { orden: limpios });
});

/** La tendencia: los últimos meses, uno por renglón. */
router.get('/meses', ver, (req, res) => {
  const cuantos = Math.min(Math.max(Number(req.query.cuantos) || 12, 2), 24);
  // Del más viejo al más nuevo: así se lee una gráfica de tiempo.
  const lista = periodos.ultimos(cuantos).reverse();
  return ok(res, { meses: calculo.porMes(lista) });
});

module.exports = router;
