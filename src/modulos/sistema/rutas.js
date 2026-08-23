/**
 * Estado del sistema: version, base de datos, migraciones aplicadas y bitacora.
 * Sirve para comprobar de un vistazo que todo esta sano.
 */
const express = require('express');
const fs = require('node:fs');
const { bd } = require('../../db/conexion');
const config = require('../../config');
const { VERSION_ACTUAL } = require('../../version');
const { ok, error: fallo } = require('../../lib/respuestas');
const bitacora = require('../../lib/bitacora');
const respaldos = require('../../db/respaldos');
const { exigirPermiso } = require('../../middleware/sesion');

const router = express.Router();

/** Salud basica. No requiere sesion: sirve para probar que el servidor responde. */
router.get('/salud', (req, res) => ok(res, { version: VERSION_ACTUAL, estado: 'arriba' }));

router.get('/estado', exigirPermiso('sistema.ver'), (req, res) => {
  const migraciones = bd.prepare('SELECT archivo, aplicada_en FROM migraciones ORDER BY archivo').all();
  const usuarios = bd.prepare('SELECT COUNT(*) n FROM usuarios WHERE activo = 1').get().n;
  const tamano = fs.existsSync(config.ARCHIVO_BD) ? fs.statSync(config.ARCHIVO_BD).size : 0;

  const config_negocio = {};
  for (const f of bd.prepare('SELECT clave, valor FROM configuracion').all()) config_negocio[f.clave] = f.valor;

  return ok(res, {
    version: VERSION_ACTUAL,
    baseDeDatos: { archivo: config.ARCHIVO_BD, tamanoKb: Math.round(tamano / 1024) },
    migraciones,
    usuariosActivos: usuarios,
    negocio: config_negocio
  });
});

router.get('/bitacora', exigirPermiso('sistema.ver'), (req, res) => {
  const limite = Math.min(Number(req.query.limite) || 50, 200);
  return ok(res, { eventos: bitacora.ultimos(limite) });
});

// ============================================================
// RESPALDOS
// ============================================================

/** Estado de los respaldos: cuándo fue el último y si está sano. */
router.get('/respaldos', exigirPermiso('sistema.ver'), (req, res) => {
  const a = respaldos.ajustes();
  const lista = respaldos.listar();

  // Sano = hay al menos un respaldo y no es más viejo que el doble del
  // intervalo configurado. Si no, algo dejó de funcionar.
  const ultimoMs = a.ultimo ? Date.now() - new Date(a.ultimo).getTime() : null;
  const limite = a.cadaHoras * 2 * 3600000;
  const sano = Boolean(a.ultimo) && ultimoMs <= limite;

  return ok(res, {
    ajustes: a,
    sano,
    horasDesdeUltimo: ultimoMs == null ? null : Math.round(ultimoMs / 360000) / 10,
    respaldos: lista,
    carpeta: config.CARPETA_RESPALDOS,
    respaldosExtra: a.carpetaExtra ? respaldos.listar(a.carpetaExtra, 5) : []
  });
});

/** Respaldar ahora mismo. */
router.post('/respaldos/ahora', exigirPermiso('sistema.configurar'), (req, res) => {
  try {
    const r = respaldos.respaldar('manual');
    bitacora.registrar({
      accion: 'respaldo.manual', entidad: 'sistema',
      ejecutorId: req.usuario.id, detalle: { extra: Boolean(r.extra), error: r.errorExtra }
    });
    return ok(res, r);
  } catch (e) {
    return fallo(res, `No se pudo respaldar: ${e.message}`, 500);
  }
});

/** Cambiar cada cuánto se respalda, cuántos se conservan y la carpeta extra. */
router.put('/respaldos', exigirPermiso('sistema.configurar'), (req, res) => {
  const { cadaHoras, conservar, carpetaExtra } = req.body || {};

  if (cadaHoras !== undefined) {
    const n = Number(cadaHoras);
    if (!Number.isFinite(n) || n < 1 || n > 48) {
      return fallo(res, 'El respaldo debe hacerse entre cada 1 y cada 48 horas.');
    }
    respaldos.guardarConfig('respaldo_cada_horas', n);
  }

  if (conservar !== undefined) {
    const n = Number(conservar);
    if (!Number.isInteger(n) || n < 3 || n > 500) {
      return fallo(res, 'Hay que conservar entre 3 y 500 respaldos.');
    }
    respaldos.guardarConfig('respaldo_conservar', n);
  }

  if (carpetaExtra !== undefined) {
    const ruta = String(carpetaExtra).trim();
    if (ruta) {
      const prueba = respaldos.probarCarpeta(ruta);
      if (!prueba.sirve) {
        return fallo(res, `No se puede escribir en esa carpeta: ${prueba.error}`);
      }
    }
    respaldos.guardarConfig('respaldo_carpeta_extra', ruta);
  }

  respaldos.arrancarAutomaticos();

  bitacora.registrar({
    accion: 'respaldo.configuracion', entidad: 'sistema',
    ejecutorId: req.usuario.id, detalle: { cadaHoras, conservar, carpetaExtra }
  });

  return ok(res, { ajustes: respaldos.ajustes() });
});

module.exports = router;
