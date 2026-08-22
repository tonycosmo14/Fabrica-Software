/**
 * Estado del sistema: version, base de datos, migraciones aplicadas y bitacora.
 * Sirve para comprobar de un vistazo que todo esta sano.
 */
const express = require('express');
const fs = require('node:fs');
const { bd } = require('../../db/conexion');
const config = require('../../config');
const { VERSION_ACTUAL } = require('../../version');
const { ok } = require('../../lib/respuestas');
const bitacora = require('../../lib/bitacora');
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

module.exports = router;
