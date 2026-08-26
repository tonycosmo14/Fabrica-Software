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
const { leerNumero } = require('../ventas/folio');

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
 *   ?antesDe=2026-08-26T15:30:00.000Z    ← el "cargar más"
 *
 * DE ENTRADA SOLO SE ENSEÑA EL DÍA DE HOY, y esto no es un capricho de
 * pantalla: dentro de tres años esta tabla va a tener cientos de miles de
 * renglones, y abrir el historial no puede querer decir "tráemelos todos y
 * ordénalos". Se abre con lo de hoy, que es lo que se viene a ver el 95%
 * de las veces, y lo de más atrás se pide a propósito: con el botón de
 * cargar más, o poniendo fechas.
 *
 * Basta con que el que llama mande UNA fecha, un número de ticket o un
 * cursor para que la ventana de hoy se quite: si alguien pregunta por
 * agosto del año pasado, es que sabe lo que está pidiendo.
 */
router.get('/', verHistorial, (req, res) => {
  const opciones = {
    desde: leerFecha(req.query.desde),
    hasta: leerFecha(req.query.hasta),
    horaDesde: leerHora(req.query.horaDesde),
    horaHasta: leerHora(req.query.horaHasta),
    usuarioId: req.query.usuarioId || null,
    tipos: String(req.query.tipos || '').split(',').filter(Boolean),
    numero: leerNumero(req.query.folio),
    antesDe: leerInstante(req.query.antesDe),
    limite: Number(req.query.limite) || 100
  };

  if (req.query.folio && !opciones.numero) {
    return error(res, 'El número de ticket se escribe como 2026-412, o solo 412.');
  }

  if (req.query.desde && !opciones.desde) return error(res, 'Esa fecha no se entiende.');
  if (req.query.hasta && !opciones.hasta) return error(res, 'Esa fecha no se entiende.');
  if (req.query.horaDesde && !opciones.horaDesde) return error(res, 'Esa hora no se entiende.');
  if (req.query.horaHasta && !opciones.horaHasta) return error(res, 'Esa hora no se entiende.');
  if (req.query.antesDe && !opciones.antesDe) return error(res, 'Ese momento no se entiende.');

  // La ventana de hoy. Se pone aquí y no en el navegador para que valga
  // aunque la llamada venga de otro lado, y en hora LOCAL de la fábrica:
  // en Yucatán un ticket de las 6:29 p.m. se guarda con la fecha de mañana.
  const soloHoy = !opciones.desde && !opciones.hasta
                  && !opciones.numero && !opciones.antesDe;
  if (soloHoy) opciones.desde = hoyLocal();

  const { movimientos, hayMas, cursor } = historial(opciones);

  // EL RESUMEN NO SE PAGINA. Suma todo lo que cae en el filtro, no los cien
  // renglones que se están viendo: si no, cargar más cambiaría los totales
  // de arriba y nadie sabría cuál creer. Por eso va sin el cursor.
  const { antesDe, ...delFiltro } = opciones;

  return ok(res, {
    movimientos,
    hayMas,
    cursor,
    ventana: soloHoy ? 'hoy' : 'filtro',
    resumen: resumen(delFiltro)
  });
});

/** El día de hoy según el reloj de la fábrica, como 2026-08-26. */
function hoyLocal() {
  const d = new Date();
  const dosDigitos = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
}

/** Un instante exacto, como lo devuelve el propio historial en `cursor`. */
function leerInstante(valor) {
  const t = String(valor || '').trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : t;
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
