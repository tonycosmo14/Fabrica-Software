/**
 * EL HISTORIAL  (v1.8)
 *
 * Todo lo que ha pasado en la caja, en una sola lista y en orden.
 *
 * NO ES LA BITÁCORA. La bitácora es para el que programa: dice
 * "producto.editado" con un id. Esto es para Tony: dice "Mari cobró el
 * ticket #412 por $264 a las 3:15". Son dos cosas distintas y por eso son
 * dos pantallas distintas.
 *
 * Un cajero solo puede hacer cuatro cosas con el dinero, así que eso es lo
 * que hay que poder revisar:
 *
 *   · VENTAS      lo que cobró
 *   · GASTOS      lo que sacó del cajón
 *   · ENTRADAS    lo que metió
 *   · ABONOS      lo que le pagaron de una cuenta
 *
 * Y se filtra por lo que uno se pregunta de verdad: quién, qué días, a qué
 * horas, de qué tipo.
 *
 * TODO SALE DE LAS TABLAS DE SIEMPRE. No hay una tabla "historial" que
 * llenar: una copia se desincroniza el día que se cancele algo, y entonces
 * el historial diría una cosa y la caja otra.
 */
const { bd } = require('../../db/conexion');
const { numeroDeTicket } = require('../ventas/folio');

const TIPOS = ['venta', 'gasto', 'entrada', 'abono'];

/**
 * Arma los pedazos de WHERE que comparten todas las consultas.
 * Devuelve { donde, valores } listos para pegar.
 *
 * `campoFecha` y `campoUsuario` cambian según la tabla, pero las preguntas
 * son las mismas.
 */
function filtros({ desde, hasta, horaDesde, horaHasta, usuarioId, antesDe },
                 campoFecha, campoUsuario) {
  const donde = [];
  const valores = [];

  // TODO SE COMPARA EN HORA LOCAL, y esto no es un detalle.
  //
  // Las fechas se guardan en UTC: un instante, no una hora de pared. Pero
  // quien filtra escribe la fecha y la hora de la fábrica. En Yucatán son
  // seis horas de diferencia, así que sin convertir:
  //
  //   · un ticket de las 6:29 p.m. cae en el día SIGUIENTE, y buscando
  //     "hoy" no aparecía
  //   · "de 3 a 8 de la tarde" traía lo de 9 de la mañana a 2 de la tarde
  //
  // El modificador 'localtime' convierte el instante guardado al reloj de
  // esta computadora, que es el de la fábrica.
  if (desde) { donde.push(`date(${campoFecha}, 'localtime') >= date(?)`); valores.push(desde); }
  if (hasta) { donde.push(`date(${campoFecha}, 'localtime') <= date(?)`); valores.push(hasta); }

  // Por horas: "de 3 a 8 de la noche", que es como se pregunta cuando algo
  // no cuadró en un turno.
  if (horaDesde) { donde.push(`time(${campoFecha}, 'localtime') >= time(?)`); valores.push(horaDesde); }
  if (horaHasta) { donde.push(`time(${campoFecha}, 'localtime') <= time(?)`); valores.push(horaHasta); }

  if (usuarioId) { donde.push(`${campoUsuario} = ?`); valores.push(usuarioId); }

  // EL CURSOR DE "CARGAR MÁS".
  //
  // No se pagina por número de página —"dame la página 3"— porque entre
  // una página y otra puede entrar una venta nueva y entonces un renglón
  // se ve dos veces o no se ve nunca. Se pagina por INSTANTE: "dame lo
  // anterior a este momento exacto". Lo que entre después no estorba,
  // porque es más nuevo que el corte.
  if (antesDe) { donde.push(`${campoFecha} < ?`); valores.push(antesDe); }

  return { donde, valores };
}

function pegar(donde) {
  return donde.length ? 'WHERE ' + donde.join(' AND ') : '';
}

/**
 * El historial completo, mezclado y del más nuevo al más viejo.
 *
 * Cada renglón trae lo mismo pase lo que pase —cuándo, quién, cuánto, qué—
 * para que la pantalla no tenga que saber de dónde salió cada uno.
 */
function historial(opciones = {}) {
  const limite = Math.min(Math.max(Number(opciones.limite) || 100, 1), 1000);
  // Se pide UNO DE MÁS de lo que se va a enseñar. Si viene, es que hay más
  // atrás y el botón de "cargar más" tiene sentido; si no viene, se llegó
  // al principio de los tiempos y el botón sobra. Cuesta una fila y evita
  // un botón que no hace nada, que es lo que hace desconfiar de un botón.
  const conUnoMas = limite + 1;
  let tipos = Array.isArray(opciones.tipos) && opciones.tipos.length
    ? opciones.tipos.filter((t) => TIPOS.includes(t))
    : TIPOS;

  // BUSCAR POR NÚMERO DE TICKET. Es la pregunta más común del mundo —"a ver
  // el 2026-412"— y no tiene sentido en un gasto ni en un abono, que no
  // llevan número: buscando uno, solo hay ventas.
  const numero = opciones.numero || null;
  if (numero) tipos = ['venta'];

  const filas = [];

  // ---- VENTAS ----
  // capturista_id y no cajero_id: la pregunta es "¿qué hizo esta persona?",
  // y quien tecleó el ticket es quien lo hizo, aunque el turno fuera de otro
  // (regla 3.6, el relevo de las 2:30).
  if (tipos.includes('venta')) {
    const { donde, valores } = filtros(opciones, 'v.fecha', 'v.capturista_id');
    if (numero) {
      // Se busca como lo diga la gente: "2026-412" o "412" a secas.
      if (numero.serie) {
        donde.push('(v.serie = ? AND v.folio_anual = ?)');
        valores.push(numero.serie, numero.folioAnual);
      } else {
        donde.push('(v.folio_anual = ? OR v.folio = ?)');
        valores.push(numero.folioAnual, numero.folio ?? -1);
      }
    }
    filas.push(...bd.prepare(`
      SELECT 'venta' AS tipo, v.id, v.fecha, v.folio, v.serie, v.folio_anual,
             v.total_centavos AS centavos, v.forma_pago,
             v.cancelada_en, v.motivo_cancelacion,
             u.nombre AS quien, cj.nombre AS cajero,
             cl.nombre AS cliente, c.folio AS turno,
             v.caja_id,
             -- La pareja del cambio, para poder decir "#5 cambiado por #8"
             -- en los dos renglones y no dejar ninguno huérfano.
             viejo.folio AS cambio_de,
             viejo.serie AS cambio_de_serie, viejo.folio_anual AS cambio_de_anual,
             nuevo.folio AS cambiado_por,
             nuevo.serie AS cambiado_por_serie, nuevo.folio_anual AS cambiado_por_anual,
             lp.tipo AS lista_tipo, v.lista_nombre,
             -- Qué se llevó, en corto: "5 marquetas, 2 Coca".
             (SELECT group_concat(
                       CASE WHEN vl.cantidad > 1 THEN vl.cantidad || ' × ' || vl.concepto
                            ELSE vl.concepto END, ', ')
                FROM venta_lineas vl WHERE vl.venta_id = v.id) AS detalle
        FROM ventas v
        LEFT JOIN usuarios u  ON u.id = v.capturista_id
        LEFT JOIN usuarios cj ON cj.id = v.cajero_id
        LEFT JOIN clientes cl ON cl.id = v.cliente_id
        LEFT JOIN cajas c     ON c.id = v.caja_id
        LEFT JOIN ventas viejo ON viejo.id = v.cambio_de_venta_id
        LEFT JOIN ventas nuevo ON nuevo.id = v.cambiada_por_venta_id
        LEFT JOIN listas_precios lp ON lp.id = v.lista_id
       ${pegar(donde)}
       ORDER BY v.fecha DESC LIMIT ?
    `).all(...valores, conUnoMas));
  }

  // ---- GASTOS Y ENTRADAS ----
  const deCajon = tipos.filter((t) => t === 'gasto' || t === 'entrada');
  if (deCajon.length) {
    const { donde, valores } = filtros(opciones, 'm.fecha', 'm.capturista_id');
    const conTipo = [...donde];
    const susValores = [...valores];
    if (deCajon.length === 1) {
      conTipo.push('m.tipo = ?');
      susValores.push(deCajon[0] === 'gasto' ? 'salida' : 'entrada');
    }
    filas.push(...bd.prepare(`
      SELECT CASE m.tipo WHEN 'salida' THEN 'gasto' ELSE 'entrada' END AS tipo,
             m.id, m.fecha, NULL AS folio, NULL AS serie, NULL AS folio_anual,
             m.centavos, NULL AS forma_pago,
             m.anulado_en AS cancelada_en, m.motivo_anulacion AS motivo_cancelacion,
             u.nombre AS quien, e.nombre AS cajero,
             m.concepto AS cliente, c.folio AS turno, m.caja_id,
             NULL AS cambio_de, NULL AS cambiado_por,
             NULL AS cambio_de_serie, NULL AS cambio_de_anual,
             NULL AS cambiado_por_serie, NULL AS cambiado_por_anual,
             NULL AS lista_tipo, NULL AS lista_nombre, m.concepto AS detalle
        FROM movimientos_caja m
        LEFT JOIN usuarios u ON u.id = m.capturista_id
        LEFT JOIN usuarios e ON e.id = m.ejecutor_id
        LEFT JOIN cajas c    ON c.id = m.caja_id
       ${pegar(conTipo)}
       ORDER BY m.fecha DESC LIMIT ?
    `).all(...susValores, conUnoMas));
  }

  // ---- ABONOS ----
  if (tipos.includes('abono')) {
    const { donde, valores } = filtros(opciones, 'a.fecha', 'a.capturista_id');
    filas.push(...bd.prepare(`
      SELECT 'abono' AS tipo, a.id, a.fecha, NULL AS folio,
             NULL AS serie, NULL AS folio_anual, a.centavos, a.forma_pago,
             a.anulado_en AS cancelada_en, a.motivo_anulacion AS motivo_cancelacion,
             u.nombre AS quien, e.nombre AS cajero,
             cl.nombre AS cliente, c.folio AS turno, a.caja_id,
             NULL AS cambio_de, NULL AS cambiado_por,
             NULL AS cambio_de_serie, NULL AS cambio_de_anual,
             NULL AS cambiado_por_serie, NULL AS cambiado_por_anual,
             NULL AS lista_tipo, NULL AS lista_nombre,
             'Abono a su cuenta' AS detalle
        FROM abonos a
        LEFT JOIN usuarios u  ON u.id = a.capturista_id
        LEFT JOIN usuarios e  ON e.id = a.ejecutor_id
        LEFT JOIN clientes cl ON cl.id = a.cliente_id
        LEFT JOIN cajas c     ON c.id = a.caja_id
       ${pegar(donde)}
       ORDER BY a.fecha DESC LIMIT ?
    `).all(...valores, conUnoMas));
  }

  filas.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

  const seEnsenan = filas.slice(0, limite);

  return {
    // El número y el "qué" ya escritos, para que la pantalla no tenga que
    // armarlos: son los dos datos que se leen primero y no pueden depender
    // de que cada pantalla los deduzca igual.
    movimientos: seEnsenan.map((f) => ({
      ...f,
      numero: f.folio ? numeroDeTicket(f) : null,
      cambioDeNumero: f.cambio_de
        ? numeroDeTicket({ serie: f.cambio_de_serie, folio_anual: f.cambio_de_anual,
                           folio: f.cambio_de }) : null,
      cambiadoPorNumero: f.cambiado_por
        ? numeroDeTicket({ serie: f.cambiado_por_serie, folio_anual: f.cambiado_por_anual,
                           folio: f.cambiado_por }) : null,
      que: queEs(f)
    })),
    hayMas: filas.length > limite,
    // El instante del último renglón enseñado. Es lo que hay que mandar
    // como `antesDe` para pedir el siguiente pedazo.
    cursor: seEnsenan.length ? seEnsenan[seEnsenan.length - 1].fecha : null
  };
}

/**
 * QUÉ PASÓ AQUÍ, en dos palabras.
 *
 * "Venta" no basta: una devolución, un cambio y una venta de mayoreo son
 * tres cosas distintas y en la lista se veían las tres iguales, con la
 * diferencia escondida en la columna de "se llevó". Quien revisa el día
 * quiere saber de un vistazo qué clase de movimiento fue cada renglón, y
 * eso es un dato, no una interpretación de la pantalla.
 *
 * El orden importa: se va de lo más específico a lo más general, y gana el
 * primero que acierte. Una devolución de un ticket de mayoreo es una
 * DEVOLUCIÓN: lo que se está mirando es el dinero que salió.
 */
function queEs(f) {
  if (f.tipo === 'gasto')   return { clave: 'gasto',   texto: 'Gasto',    emoji: '📤' };
  if (f.tipo === 'entrada') return { clave: 'entrada', texto: 'Entrada',  emoji: '📥' };
  if (f.tipo === 'abono')   return { clave: 'abono',   texto: 'Abono',    emoji: '💰' };

  // El motivo de cancelación es lo que separa una devolución —el cliente
  // se llevó su dinero— de una cancelación a secas, que es un ticket que
  // nunca debió existir. Lo escribe el sistema, no una persona.
  if (f.cancelada_en && String(f.motivo_cancelacion || '').startsWith('Devolución')) {
    return { clave: 'devolucion', texto: 'Devolución', emoji: '↩️' };
  }
  if (f.cambio_de)     return { clave: 'cambio',   texto: 'Cambio',   emoji: '⇄' };
  if (f.cambiado_por)  return { clave: 'cambiado', texto: 'Cambiado',  emoji: '⇄' };
  if (f.cancelada_en)  return { clave: 'cancelada', texto: 'Cancelada', emoji: '✕' };
  if (f.forma_pago === 'credito') return { clave: 'fiado', texto: 'Fiado', emoji: '🤝' };
  if (f.lista_tipo === 'mayoreo') return { clave: 'mayoreo', texto: 'Mayoreo', emoji: '🏷️' };
  return { clave: 'venta', texto: 'Venta', emoji: '🧾' };
}

/**
 * El resumen de lo filtrado: cuánto se cobró, cuánto salió, cuánto entró.
 *
 * Se calcula sobre TODO lo que cae en el filtro, no sobre los cien renglones
 * que se enseñan: si no, revisar un mes daría el total de la última página.
 */
function resumen(opciones = {}) {
  const v = filtros(opciones, 'v.fecha', 'v.capturista_id');
  const ventas = bd.prepare(`
    SELECT COUNT(*) n,
           COALESCE(SUM(CASE WHEN v.cancelada_en IS NULL THEN v.total_centavos ELSE 0 END), 0) centavos,
           COALESCE(SUM(CASE WHEN v.cancelada_en IS NOT NULL THEN 1 ELSE 0 END), 0) canceladas
      FROM ventas v ${pegar(v.donde)}
  `).get(...v.valores);

  const m = filtros(opciones, 'm.fecha', 'm.capturista_id');
  const mov = bd.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN m.tipo = 'salida' AND m.anulado_en IS NULL THEN m.centavos ELSE 0 END), 0) gastos,
      COALESCE(SUM(CASE WHEN m.tipo = 'entrada' AND m.anulado_en IS NULL THEN m.centavos ELSE 0 END), 0) entradas
      FROM movimientos_caja m ${pegar(m.donde)}
  `).get(...m.valores);

  const a = filtros(opciones, 'a.fecha', 'a.capturista_id');
  const abonos = bd.prepare(`
    SELECT COALESCE(SUM(CASE WHEN a.anulado_en IS NULL THEN a.centavos ELSE 0 END), 0) centavos,
           COUNT(*) n
      FROM abonos a ${pegar(a.donde)}
  `).get(...a.valores);

  return {
    ventas: ventas.n,
    canceladas: ventas.canceladas,
    cobrado: ventas.centavos,
    gastos: mov.gastos,
    entradas: mov.entradas,
    abonos: abonos.centavos,
    abonosCuantos: abonos.n
  };
}

/** Quiénes han hecho algo alguna vez, para el filtro de personas. */
function quienes() {
  return bd.prepare(`
    SELECT u.id, u.nombre, u.rol
      FROM usuarios u
     WHERE EXISTS (SELECT 1 FROM ventas v WHERE v.capturista_id = u.id)
        OR EXISTS (SELECT 1 FROM movimientos_caja m WHERE m.capturista_id = u.id)
        OR EXISTS (SELECT 1 FROM abonos a WHERE a.capturista_id = u.id)
     ORDER BY u.nombre
  `).all();
}

module.exports = { historial, resumen, quienes, queEs, TIPOS };
