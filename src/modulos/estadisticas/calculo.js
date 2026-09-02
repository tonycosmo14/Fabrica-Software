/**
 * LAS ESTADÍSTICAS  (v2.9)
 *
 * Los números del negocio, calculados de los renglones cada vez que se
 * preguntan (regla 3.2). Aquí no se guarda ni un total.
 *
 * TRES REGLAS QUE SE SIGUEN EN TODAS LAS CONSULTAS DE ESTE ARCHIVO:
 *
 *  1. LO CANCELADO NO CUENTA. Una venta cancelada, una devolución y el
 *     ticket viejo de un cambio son todos lo mismo por dentro: una venta
 *     con `cancelada_en`. Con filtrarla una vez, los tres casos quedan
 *     bien y ningún peso se cuenta dos veces.
 *
 *  2. POR INSTANTES, NO POR date(...,'localtime'). El periodo se traduce
 *     una vez a los dos instantes que lo encierran (lib/periodos.js) y las
 *     consultas comparan la columna tal cual. Así el índice por fecha sí
 *     sirve: dentro de tres años esta pantalla seguirá abriendo igual de
 *     rápido con medio millón de renglones.
 *
 *  3. LO QUE NO SE SABE, SE DICE. Ningún número se rellena con supuestos.
 *     Si falta el recibo de la luz del mes, el costo por marqueta sale
 *     marcado como incompleto en vez de salir más barato de lo que es.
 */
const { bd } = require('../../db/conexion');
const { instantes } = require('../../lib/periodos');
const { DIECISEISAVOS_POR_MARQUETA } = require('../../lib/fracciones');
const { luzEnPeriodo, totalGastado, gastosParejos } = require('../empresa/calculo');


// ============================================================
// LO QUE SE VENDIÓ
// ============================================================

/**
 * Las ventas del periodo, partidas por cómo se pagaron.
 *
 * VENDIDO no es lo mismo que COBRADO: lo fiado se vendió hoy y se cobra
 * quién sabe cuándo. Los dos números importan y por eso van separados; el
 * que dice si el negocio está funcionando es el vendido.
 */
function ventas({ desde, hasta }) {
  const r = bd.prepare(`
    SELECT COUNT(*)                                            AS tickets,
           COALESCE(SUM(total_centavos), 0)                    AS centavos,
           COALESCE(SUM(CASE WHEN forma_pago = 'credito'
                             THEN total_centavos ELSE 0 END), 0) AS fiado
      FROM ventas
     WHERE cancelada_en IS NULL AND fecha >= ? AND fecha < ?
  `).get(desde, hasta);

  // Las canceladas se cuentan aparte: no suman al dinero, pero saber que
  // hubo veinte en un mes dice algo del mostrador.
  const canceladas = bd.prepare(`
    SELECT COUNT(*) cuantas, COALESCE(SUM(total_centavos), 0) centavos
      FROM ventas
     WHERE cancelada_en IS NOT NULL AND fecha >= ? AND fecha < ?
  `).get(desde, hasta);

  return {
    ...r,
    contado: r.centavos - r.fiado,
    canceladas,
    // El ticket promedio: lo que se lleva un cliente cada vez que llega.
    porTicket: r.tickets ? Math.round(r.centavos / r.tickets) : 0
  };
}

/** El hielo que salió vendido, en dieciseisavos y en marquetas. */
function hieloVendido({ desde, hasta }) {
  const r = bd.prepare(`
    SELECT COALESCE(SUM(l.dieciseisavos), 0) AS dieciseisavos
      FROM venta_lineas l
      JOIN ventas v ON v.id = l.venta_id
     WHERE v.cancelada_en IS NULL AND v.fecha >= ? AND v.fecha < ?
       AND l.dieciseisavos > 0
  `).get(desde, hasta);

  return {
    dieciseisavos: r.dieciseisavos,
    marquetas: Math.round((r.dieciseisavos / DIECISEISAVOS_POR_MARQUETA) * 100) / 100
  };
}

/** Cuánto entró de abonos: dinero de ventas fiadas de otros días. */
function abonos({ desde, hasta }) {
  return bd.prepare(`
    SELECT COUNT(*) cuantos, COALESCE(SUM(centavos), 0) centavos
      FROM abonos
     WHERE fecha >= ? AND fecha < ?
  `).get(desde, hasta);
}


// ============================================================
// LO QUE SE PRODUJO
// ============================================================

/**
 * Las marquetas del periodo, y las que se echaron a perder.
 *
 * Se cuentan MOLDES, que es donde está la verdad: un molde que salió bien
 * es una marqueta. Los paños anulados no cuentan —su nota empieza con
 * ANULADA—, y los paños fijados a mano en la puesta en marcha tampoco,
 * porque no tienen moldes: son inertes a propósito (v2.8).
 */
function produccion({ desde, hasta }) {
  const r = bd.prepare(`
    SELECT
      COUNT(CASE WHEN sm.resultado = 'ok'    THEN 1 END) AS buenas,
      COUNT(CASE WHEN sm.resultado = 'merma' THEN 1 END) AS rotas,
      COUNT(CASE WHEN sm.resultado = 'hueco' THEN 1 END) AS huecos
      FROM sacadas_moldes sm
      JOIN sacadas s       ON s.id = sm.sacada_id
      JOIN sacadas_pano sp ON sp.id = s.sacada_pano_id
     WHERE s.fecha >= ? AND s.fecha < ?
       AND (sp.notas IS NULL OR sp.notas NOT LIKE 'ANULADA%')
  `).get(desde, hasta);

  const salieron = r.buenas + r.rotas + r.huecos;
  return {
    ...r,
    salieron,
    // De cada cien moldes, cuántos salieron buenos. Es el número que dice
    // si una máquina está fallando: baja antes de que se pare.
    porCientoBuenas: salieron ? Math.round((r.buenas / salieron) * 1000) / 10 : null
  };
}

/**
 * Cuántos paños se sacaron y quién los sacó.
 *
 * Se filtra por `s.fecha` —cuándo salió cada canasta— y no por cuándo se
 * abrió el paño, por dos razones. La de fondo: así cuenta igual que el
 * número de marquetas de arriba, y dos números de la misma hoja que se
 * contradicen no sirven. La de máquina: `sacadas.fecha` sí tiene índice,
 * y por `sacadas_pano.iniciada_en` SQLite acababa leyendo todos los moldes
 * de la historia aunque el índice existiera (medido con EXPLAIN).
 */
function porObrero({ desde, hasta }) {
  return bd.prepare(`
    SELECT COALESCE(u.nombre, sp.ejecutor_libre, '—') AS nombre,
           COUNT(DISTINCT sp.id) AS panos,
           COUNT(CASE WHEN sm.resultado = 'ok' THEN 1 END) AS marquetas
      FROM sacadas s
      JOIN sacadas_pano sp   ON sp.id = s.sacada_pano_id
      JOIN sacadas_moldes sm ON sm.sacada_id = s.id
      LEFT JOIN usuarios u   ON u.id = sp.ejecutor_id
     WHERE s.fecha >= ? AND s.fecha < ?
       AND (sp.notas IS NULL OR sp.notas NOT LIKE 'ANULADA%')
     GROUP BY COALESCE(sp.ejecutor_id, 'L:' || sp.ejecutor_libre)
     ORDER BY marquetas DESC
  `).all(desde, hasta);
}


// ============================================================
// LO QUE SE FUE
// ============================================================

/**
 * Los gastos del cajón, sin los traspasos.
 *
 * Un retiro a la caja fuerte salió del cajón pero la fábrica no lo gastó
 * (v2.7.1): sumarlo aquí, y sumar además el amoniaco que se pagó con ese
 * mismo efectivo, contaría el peso dos veces.
 */
function gastosDelCajon({ desde, hasta }) {
  const porConcepto = bd.prepare(`
    SELECT COALESCE(c.nombre, m.concepto) AS nombre,
           c.es_traspaso,
           COUNT(*) AS veces,
           SUM(m.centavos) AS centavos
      FROM movimientos_caja m
      LEFT JOIN conceptos_gasto c ON c.id = m.concepto_id
     WHERE m.tipo = 'salida' AND m.anulado_en IS NULL
       AND m.fecha >= ? AND m.fecha < ?
       -- EL MISMO PESO, UNA SOLA VEZ. Si el electricista cobró en efectivo,
       -- el cajero lo anotó en la caja Y el administrador capturó su
       -- factura como gasto grande, es el mismo dinero apuntado dos veces.
       -- Cuando la factura dice de qué salida del cajón salió, esa salida
       -- deja de contarse aquí: manda la factura, que trae el papel.
       AND NOT EXISTS (SELECT 1 FROM gastos_empresa g
                        WHERE g.movimiento_caja_id = m.id AND g.anulado_en IS NULL)
     GROUP BY COALESCE(m.concepto_id, 'libre:' || lower(m.concepto))
     ORDER BY SUM(m.centavos) DESC
  `).all(desde, hasta);

  const gastado = porConcepto.filter((x) => !x.es_traspaso)
    .reduce((n, x) => n + x.centavos, 0);
  const traspasado = porConcepto.filter((x) => x.es_traspaso)
    .reduce((n, x) => n + x.centavos, 0);

  return { porConcepto: porConcepto.filter((x) => !x.es_traspaso), gastado, traspasado };
}


// ============================================================
// EL NÚMERO QUE JUNTA TODO: CUÁNTO CUESTA UNA MARQUETA
// ============================================================

/**
 * CUÁNTO COSTÓ PRODUCIR CADA MARQUETA. El número que junta todo.
 *
 * SALEN DOS, y los dos hacen falta:
 *
 *   PAREJO — lo que cuesta una marqueta en un mes normal. Las cosas que se
 *   compran de tanto en tanto van repartidas a su ritmo: el cilindro de
 *   amoniaco que dura noventa días cuesta un noventavo cada día, caiga la
 *   compra donde caiga. Es el que sirve para COMPARAR meses y el que se
 *   enseña primero, porque sin él la gráfica de tendencia son picos que
 *   solo dicen en qué mes tocó comprar amoniaco.
 *
 *   DEL MES — el dinero que de verdad salió de la caja en esas semanas.
 *   Es el que hace falta para saber si alcanzó, y por eso también se
 *   enseña; simplemente no es con el que se comparan dos meses.
 *
 * LO QUE NINGUNO DE LOS DOS TRAE, y la pantalla lo dice porque si no
 * engaña: LA RAYA. Los sueldos no se llevan en el sistema, así que el
 * costo real es más alto que cualquiera de estos dos números. Sirven para
 * comparar y para vigilar, no para sacar el precio de venta.
 *
 * Y sale marcado como INCOMPLETO cuando faltan días de recibo de luz: en
 * una fábrica de hielo la luz es la mitad del costo, y un mes sin recibo
 * daría un costo por marqueta falsamente barato.
 */
function costoPorMarqueta(periodo) {
  const rango = instantes(periodo);
  const marquetas = produccion(rango).buenas;
  const dias = { desde: periodo.desde, hasta: periodo.hasta };

  const cajon = gastosDelCajon(rango).gastado;
  const luz = luzEnPeriodo(dias);
  const grandesDelMes = totalGastado(dias).centavos;
  const parejos = gastosParejos(dias);

  const totalDelMes = cajon + grandesDelMes + luz.centavos;
  const totalParejo = cajon + parejos.centavos + luz.centavos;
  const entre = (n) => (marquetas > 0 ? Math.round(n / marquetas) : null);

  return {
    marquetas,
    // El de comparar.
    centavos: entre(totalParejo),
    total: totalParejo,
    cajon,
    grandes: parejos.centavos,
    luz: luz.centavos,
    porMarqueta: marquetas > 0 ? {
      cajon: entre(cajon),
      grandes: entre(parejos.centavos),
      luz: entre(luz.centavos)
    } : null,
    grandesPorConcepto: parejos.porConcepto,
    // El del dinero que salió de verdad.
    delMes: {
      centavos: entre(totalDelMes),
      total: totalDelMes,
      grandes: grandesDelMes
    },
    // ¿Se está repartiendo algo? Si no, los dos números son el mismo y la
    // pantalla se ahorra la explicación.
    hayReparto: totalParejo !== totalDelMes,
    completo: luz.completo,
    faltanDiasDeLuz: Math.max(luz.diasDelPeriodo - luz.dias, 0),
    // LA RAYA NO ESTÁ AQUÍ. Se declara para que la pantalla lo diga.
    sinLaRaya: true
  };
}


// ============================================================
// LAS SERIES — lo que se dibuja
// ============================================================

/**
 * DÍA POR DÍA DENTRO DEL PERIODO: ventas y marquetas producidas.
 *
 * Aquí sí se usa date(...,'localtime') para agrupar, y está bien: el rango
 * ya lo acotó el índice, así que la conversión solo toca los renglones del
 * mes, no la tabla entera.
 *
 * Se devuelven TODOS los días del periodo, incluidos los que no tuvieron
 * nada. Un hueco en la gráfica es información —el domingo que no se
 * abrió— y saltárselo dibujaría una línea que miente sobre el ritmo.
 */
function porDia(periodo) {
  const { desde, hasta } = instantes(periodo);

  const ventasPorDia = new Map(bd.prepare(`
    SELECT date(fecha, 'localtime') AS dia,
           COUNT(*)                 AS tickets,
           SUM(total_centavos)      AS centavos
      FROM ventas
     WHERE cancelada_en IS NULL AND fecha >= ? AND fecha < ?
     GROUP BY dia
  `).all(desde, hasta).map((f) => [f.dia, f]));

  const produccionPorDia = new Map(bd.prepare(`
    SELECT date(s.fecha, 'localtime') AS dia,
           COUNT(CASE WHEN sm.resultado = 'ok' THEN 1 END) AS marquetas
      FROM sacadas_moldes sm
      JOIN sacadas s       ON s.id = sm.sacada_id
      JOIN sacadas_pano sp ON sp.id = s.sacada_pano_id
     WHERE s.fecha >= ? AND s.fecha < ?
       AND (sp.notas IS NULL OR sp.notas NOT LIKE 'ANULADA%')
     GROUP BY dia
  `).all(desde, hasta).map((f) => [f.dia, f]));

  const dias = [];
  const d = new Date(`${periodo.desde}T12:00:00`);
  const fin = new Date(`${periodo.hasta}T12:00:00`);
  while (d <= fin) {
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` +
                  `-${String(d.getDate()).padStart(2, '0')}`;
    dias.push({
      dia: clave,
      numero: d.getDate(),
      // 0 = domingo. Sirve para pintar los fines de semana distinto.
      diaSemana: d.getDay(),
      tickets: ventasPorDia.get(clave)?.tickets || 0,
      centavos: ventasPorDia.get(clave)?.centavos || 0,
      marquetas: produccionPorDia.get(clave)?.marquetas || 0
    });
    d.setDate(d.getDate() + 1);
  }
  return dias;
}

/**
 * LOS ÚLTIMOS MESES, uno por renglón. Es la gráfica que contesta "¿cómo
 * vamos?", que es una pregunta de tendencia y no de un mes suelto.
 *
 * El costo que se dibuja es el PAREJO —el repartido a su ritmo— porque el
 * del mes suelto haría picos que solo dicen en qué mes tocó comprar
 * amoniaco, no si la fábrica está trabajando mejor o peor.
 */
function porMes(periodos) {
  return periodos.map((p) => {
    const rango = instantes(p);
    const v = ventas(rango);
    const prod = produccion(rango);
    const costo = costoPorMarqueta(p);
    return {
      clave: p.clave,
      nombre: p.nombre,
      // "ago 26": lo que cabe debajo de una barra.
      corto: `${p.nombre.slice(0, 3).toLowerCase()} ${String(p.desde).slice(2, 4)}`,
      vendido: v.centavos,
      tickets: v.tickets,
      marquetas: prod.buenas,
      gastado: costo.total,
      costoPorMarqueta: costo.centavos,
      completo: costo.completo
    };
  });
}

module.exports = {
  ventas, hieloVendido, abonos, produccion, porObrero,
  gastosDelCajon, costoPorMarqueta, porDia, porMes
};
