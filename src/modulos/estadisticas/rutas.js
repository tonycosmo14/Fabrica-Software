/**
 * LAS ESTADÍSTICAS — la API  (v2.9)
 *
 * Una sola llamada devuelve todo lo de un periodo: la pantalla no puede
 * pedir ocho cosas por separado y quedarse a medio pintar si una falla.
 * Las series de doce meses van aparte porque son las caras y no siempre
 * se miran.
 */
const express = require('express');
const { ok, error } = require('../../lib/respuestas');
const { exigirPermiso } = require('../../middleware/sesion');
const periodos = require('../../lib/periodos');
const calculo = require('./calculo');
const empresa = require('../empresa/calculo');

const router = express.Router();
const ver = exigirPermiso('estadisticas.ver');

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
    porObrero: calculo.porObrero(rango),
    porDia: calculo.porDia(p),
    // Cuántas listas de precios: si hay mayoreo, la pantalla lo dice.
    periodos: periodos.ultimos(25).map((x) => ({ clave: x.clave, nombre: x.nombre, fechas: x.fechas }))
  });
});

/** La tendencia: los últimos meses, uno por renglón. */
router.get('/meses', ver, (req, res) => {
  const cuantos = Math.min(Math.max(Number(req.query.cuantos) || 12, 2), 24);
  // Del más viejo al más nuevo: así se lee una gráfica de tiempo.
  const lista = periodos.ultimos(cuantos).reverse();
  return ok(res, { meses: calculo.porMes(lista) });
});

module.exports = router;
