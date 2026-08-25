/**
 * HISTORIAL  (v1.8)
 *
 * Solo el administrador. No porque sea un secreto, sino porque es la
 * pantalla para revisar el trabajo de los demás, y esa no es de los demás.
 */
const express = require('express');
const { ok, error } = require('../../lib/respuestas');
const { exigirPermiso } = require('../../middleware/sesion');
const { historial, resumen, quienes, TIPOS } = require('./calculo');

const router = express.Router();

const verHistorial = exigirPermiso('historial.ver');

/** Lo que la pantalla necesita para armar los filtros. */
router.get('/quienes', verHistorial, (req, res) => {
  return ok(res, { quienes: quienes(), tipos: TIPOS });
});

/**
 * El historial filtrado, con su resumen.
 *
 *   ?desde=2026-08-01&hasta=2026-08-24
 *   ?horaDesde=15:00&horaHasta=20:00
 *   ?usuarioId=...
 *   ?tipos=venta,gasto
 */
router.get('/', verHistorial, (req, res) => {
  const opciones = {
    desde: leerFecha(req.query.desde),
    hasta: leerFecha(req.query.hasta),
    horaDesde: leerHora(req.query.horaDesde),
    horaHasta: leerHora(req.query.horaHasta),
    usuarioId: req.query.usuarioId || null,
    tipos: String(req.query.tipos || '').split(',').filter(Boolean),
    folio: leerFolio(req.query.folio),
    limite: Number(req.query.limite) || 150
  };

  if (req.query.folio && opciones.folio === null) {
    return error(res, 'El número de ticket se escribe con números.');
  }

  if (req.query.desde && !opciones.desde) return error(res, 'Esa fecha no se entiende.');
  if (req.query.hasta && !opciones.hasta) return error(res, 'Esa fecha no se entiende.');
  if (req.query.horaDesde && !opciones.horaDesde) return error(res, 'Esa hora no se entiende.');
  if (req.query.horaHasta && !opciones.horaHasta) return error(res, 'Esa hora no se entiende.');

  return ok(res, {
    movimientos: historial(opciones),
    resumen: resumen(opciones)
  });
});

/** El número de un ticket. Solo dígitos: "#412" y "412" son lo mismo. */
function leerFolio(valor) {
  const t = String(valor || '').trim().replace(/^#/, '');
  if (!t) return null;
  if (!/^\d{1,9}$/.test(t)) return null;
  return Number(t);
}

/** Una fecha del calendario: 2026-08-24. Nada más. */
function leerFecha(valor) {
  const t = String(valor || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  return t;
}

/** Una hora del reloj: 15:00. Se acepta con o sin segundos. */
function leerHora(valor) {
  const t = String(valor || '').trim();
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(t)) return null;
  return t.length === 5 ? t + ':00' : t;
}

module.exports = router;
