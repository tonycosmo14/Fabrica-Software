/**
 * IMPRESIÓN  (v0.11)
 *
 * El ticket lo manda el SERVIDOR a la impresora, no el navegador. Así sale
 * al instante, sin la ventana de impresión que se asoma un momento.
 *
 * Si no hay impresora configurada, estas rutas contestan que no se imprimió
 * y la pantalla lo resuelve con el navegador. La venta nunca se cae por un
 * problema de impresora: el dinero ya se cobró.
 */
const express = require('express');
const { bd } = require('../../db/conexion');
const { ok, error } = require('../../lib/respuestas');
const bitacora = require('../../lib/bitacora');
const { exigirPermiso } = require('../../middleware/sesion');
const { configuracion, guardarAjuste, imprimirCrudo,
        tipoDeDestino, impresorasDeWindows, APARTADOS } = require('./impresora');
const { ticketVenta, ticketMovimiento, ticketPrueba, pulsoCajon,
        ticketCorte, ticketConteo } = require('./ticket');

const { aTexto } = require('../../lib/fracciones');

const router = express.Router();

const puedeImprimir = exigirPermiso('venta.registrar');
const configurar = exigirPermiso('sistema.configurar');

function nombreNegocio() {
  return bd.prepare("SELECT valor FROM configuracion WHERE clave = 'nombre_negocio'")
    .get()?.valor || 'Hielo LOLHA';
}

/**
 * Arma la venta completa, como la necesita el ticket.
 *
 * El cliente se trae aunque casi nunca haya: en un ticket fiado su nombre
 * es lo que convierte el papel en un vale. Sin él salía "FIADO" a secas.
 */
function ventaCompleta(id) {
  const venta = bd.prepare(`
    SELECT v.*, u.nombre AS cajero_nombre,
           cl.nombre AS cliente_nombre, cl.negocio AS cliente_negocio,
           lp.tipo AS lista_tipo
      FROM ventas v
      LEFT JOIN usuarios u  ON u.id = v.cajero_id
      LEFT JOIN clientes cl ON cl.id = v.cliente_id
      LEFT JOIN listas_precios lp ON lp.id = v.lista_id
     WHERE v.id = ?
  `).get(id);
  if (!venta) return null;
  venta.lineas = bd.prepare('SELECT * FROM venta_lineas WHERE venta_id = ?').all(id);
  return venta;
}

// ============================================================
// CONFIGURACIÓN
// ============================================================

router.get('/config', puedeImprimir, (req, res) => {
  return ok(res, { impresion: configuracion() });
});

/**
 * LAS IMPRESORAS QUE VE WINDOWS.
 *
 * Para no tener que adivinar la IP ni el nombre compartido. De cada una
 * viene ya masticado lo que habría que escribir en el destino, y con un
 * toque se llena el campo.
 */
router.get('/impresoras', configurar, async (req, res) => {
  return ok(res, { impresoras: await impresorasDeWindows(), sistema: process.platform });
});

/**
 * QUÉ ENTIENDE EL SISTEMA DE LO QUE SE ESTÁ ESCRIBIENDO.
 *
 * Se contesta sin guardar nada: sirve para que la pantalla vaya diciendo
 * "voy a mandarlo por red a 192.168.1.65:9100" mientras se teclea. La mitad
 * de arreglar una impresora que no imprime es ver qué entendió el programa.
 */
router.get('/entender', configurar, (req, res) => {
  return ok(res, { como: tipoDeDestino(req.query.destino) });
});

router.put('/config', configurar, (req, res) => {
  const c = req.body || {};

  if (c.destino !== undefined) {
    const d = String(c.destino).trim();
    if (d.length > 200) return error(res, 'Ese destino es demasiado largo.');
    guardarAjuste('impresora_destino', d, req.usuario.id);
  }

  if (c.anchoMm !== undefined) {
    const n = Number(c.anchoMm);
    if (![58, 80].includes(n)) return error(res, 'El papel es de 58 o de 80 milímetros.');
    guardarAjuste('ticket_ancho_mm', n, req.usuario.id);
  }

  if (c.copias !== undefined) {
    const n = Number(c.copias);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      return error(res, 'Se imprimen entre 1 y 5 copias.');
    }
    guardarAjuste('ticket_copias', n, req.usuario.id);
  }

  if (c.pie !== undefined) {
    guardarAjuste('ticket_pie', String(c.pie).slice(0, 80), req.usuario.id);
  }

  if (c.codigoPagina !== undefined) {
    const n = Number(c.codigoPagina);
    if (!Number.isInteger(n) || n < 0 || n > 255) return error(res, 'Tabla de acentos inválida.');
    guardarAjuste('ticket_codepage', n, req.usuario.id);
  }

  if (c.abrirCajon !== undefined) {
    guardarAjuste('ticket_abrir_cajon', c.abrirCajon ? '1' : '0', req.usuario.id);
  }

  // La impresora de cada apartado. Vacío = la de tickets, que es lo que
  // casi siempre se quiere.
  if (c.apartados && typeof c.apartados === 'object') {
    for (const a of APARTADOS) {
      if (c.apartados[a.id] === undefined) continue;
      guardarAjuste(`impresora_destino_${a.id}`,
                    String(c.apartados[a.id]).trim().slice(0, 200), req.usuario.id);
    }
  }

  if (c.salidaCajon !== undefined) {
    const n = Number(c.salidaCajon);
    if (![2, 5].includes(n)) return error(res, 'El cajón va por la salida 2 o la 5.');
    guardarAjuste('ticket_cajon_salida', n, req.usuario.id);
  }

  bitacora.registrar({
    accion: 'impresion.config', entidad: 'configuracion',
    ejecutorId: req.usuario.id, detalle: configuracion()
  });

  return ok(res, { impresion: configuracion() });
});

router.post('/prueba', configurar, async (req, res) => {
  const r = await imprimirCrudo(ticketPrueba({ negocio: nombreNegocio() }));
  if (!r.impreso && r.motivo === 'sin-destino') {
    return error(res, 'Todavía no has puesto el nombre de la impresora.', 409);
  }
  if (!r.impreso) return error(res, `No se pudo imprimir: ${r.motivo}`, 502);
  return ok(res, { impreso: true });
});

// ============================================================
// IMPRIMIR DE VERDAD
// ============================================================

/**
 * El ticket de una venta. Se puede pedir las veces que haga falta: una
 * reimpresión sale marcada como COPIA para que no se confunda con el
 * original.
 */
router.post('/venta/:id', puedeImprimir, async (req, res) => {
  const venta = ventaCompleta(req.params.id);
  if (!venta) return error(res, 'Esa venta no existe.', 404);

  const cfg = configuracion();
  if (!cfg.directa) return ok(res, { impreso: false, motivo: 'sin-destino' });

  const copia = req.body?.copia === true;
  const cuantas = copia ? 1 : cfg.copias;

  let ultimo = { impreso: false, motivo: 'nada' };
  for (let i = 0; i < cuantas; i++) {
    ultimo = await imprimirCrudo(ticketVenta(venta, { copia, negocio: nombreNegocio() }),
                                 { seccion: 'venta' });
    if (!ultimo.impreso) break;
  }

  if (!ultimo.impreso) return error(res, `No se pudo imprimir: ${ultimo.motivo}`, 502);

  if (copia) {
    bitacora.registrar({
      accion: 'venta.reimpresa', entidad: 'venta', entidadId: venta.id,
      ejecutorId: req.usuario.id,
      detalle: { folio: venta.folio, total: venta.total_centavos }
    });
  }

  return ok(res, { impreso: true });
});

/**
 * EL CORTE DE CAJA, en papel térmico y sin ventana de por medio.
 *
 * Sale dos o tres veces al día y siempre en la misma impresora: la ventana
 * de "elegir impresora" del navegador ahí solo estorbaba.
 */
router.post('/corte/:id', exigirPermiso('caja.ver'), async (req, res) => {
  const caja = bd.prepare(`
    SELECT c.*, u.nombre AS cajero_nombre, v.nombre AS cerrada_por_nombre
      FROM cajas c
      LEFT JOIN usuarios u ON u.id = c.cajero_id
      LEFT JOIN usuarios v ON v.id = c.cerrada_por
     WHERE c.id = ?
  `).get(req.params.id);
  if (!caja) return error(res, 'Ese corte no existe.', 404);
  if (!caja.cerrada_en) return error(res, 'Ese turno todavía no se ha cerrado.');

  const corte = {
    caja,
    movimientos: bd.prepare(
      'SELECT * FROM movimientos_caja WHERE caja_id = ? ORDER BY fecha').all(caja.id),
    ventas: bd.prepare(`
      SELECT COUNT(*) FILTER (WHERE cancelada_en IS NULL) AS cobradas,
             COUNT(*) FILTER (WHERE cancelada_en IS NOT NULL) AS canceladas
        FROM ventas WHERE caja_id = ?`).get(caja.id)
  };

  const cfg = configuracion();
  if (!cfg.directa) return ok(res, { impreso: false, motivo: 'sin-destino' });

  const r = await imprimirCrudo(ticketCorte(corte, { negocio: nombreNegocio() }),
                                { seccion: 'corte' });
  if (!r.impreso) return error(res, `No se pudo imprimir: ${r.motivo}`, 502);
  return ok(res, { impreso: true });
});

/** El cuadre de un conteo del cuarto frío. */
router.post('/conteo/:id', exigirPermiso('existencia.ver'), async (req, res) => {
  const c = bd.prepare(`
    SELECT c.*, a.nombre AS almacen_nombre, u.nombre AS ejecutor_nombre
      FROM conteos c
      LEFT JOIN almacenes a ON a.id = c.almacen_id
      LEFT JOIN usuarios u  ON u.id = c.ejecutor_id
     WHERE c.id = ?
  `).get(req.params.id);
  if (!c) return error(res, 'Ese conteo no existe.', 404);

  const cfg = configuracion();
  if (!cfg.directa) return ok(res, { impreso: false, motivo: 'sin-destino' });

  // El conteo guarda sus números congelados en el momento (regla 3.2), así
  // que el papel de hoy dice lo mismo que el de aquel día aunque después se
  // haya cancelado una venta.
  const esperado = c.existencia_anterior + c.producido - c.vendido;
  const conteo = {
    fecha: c.fecha,
    almacen: c.almacen_nombre,
    ejecutor: c.ejecutor_nombre,
    resumen: {
      primerConteo: !c.desde,
      anterior: c.existencia_anterior, producido: c.producido,
      vendido: c.vendido, merma: 0,
      esperado, contado: c.contado,
      faltante: esperado - c.contado
    }
  };

  const r = await imprimirCrudo(ticketConteo(conteo, { negocio: nombreNegocio() }),
                                { seccion: 'conteo' });
  if (!r.impreso) return error(res, `No se pudo imprimir: ${r.motivo}`, 502);
  return ok(res, { impreso: true });
});

/**
 * ABRIR EL CAJÓN DEL DINERO.
 *
 * El cajón cuelga de la impresora por un cable: quien le manda el pulso es
 * ella. Por eso abrirlo es "imprimir" cinco bytes sin papel.
 *
 * Va aparte del ticket y no colgado de él: el ticket solo sale si alguien
 * lo pide, y el cajón tiene que abrirse siempre que entre dinero. También
 * lo usa el botón de la caja, para cuando hay que dar cambio de algo que no
 * fue una venta.
 */
router.post('/cajon', puedeImprimir, async (req, res) => {
  const cfg = configuracion();
  if (!cfg.directa) return ok(res, { abierto: false, motivo: 'sin-destino' });

  const r = await imprimirCrudo(pulsoCajon(cfg.salidaCajon), { seccion: 'venta' });
  if (!r.impreso) return error(res, `No se pudo abrir el cajón: ${r.motivo}`, 502);

  return ok(res, { abierto: true });
});

/**
 * El comprobante de un gasto. Los gastos SÍ llevan papel: alguien se llevó
 * dinero del cajón y tiene que quedar constancia firmada. Meter dinero no
 * lleva ticket: nadie firma por dejar dinero.
 */
router.post('/movimiento/:id', puedeImprimir, async (req, res) => {
  const mov = bd.prepare(`
    SELECT m.*, u.nombre AS ejecutor_nombre, c.nombre AS capturista_nombre
      FROM movimientos_caja m
      LEFT JOIN usuarios u ON u.id = m.ejecutor_id
      LEFT JOIN usuarios c ON c.id = m.capturista_id
     WHERE m.id = ?
  `).get(req.params.id);
  if (!mov) return error(res, 'Ese movimiento no existe.', 404);

  const cfg = configuracion();
  if (!cfg.directa) return ok(res, { impreso: false, motivo: 'sin-destino' });

  const r = await imprimirCrudo(ticketMovimiento(mov, { negocio: nombreNegocio() }),
                                { seccion: 'gasto' });
  if (!r.impreso) return error(res, `No se pudo imprimir: ${r.motivo}`, 502);
  return ok(res, { impreso: true });
});

module.exports = router;
