/**
 * "Que hay de nuevo": el historial de versiones del sistema.
 * Lee src/version.js, no la base de datos, para que agregar una version
 * sea editar un solo archivo.
 */
const express = require('express');
const { VERSION_ACTUAL, VERSIONES } = require('../../version');
const { ok } = require('../../lib/respuestas');

const router = express.Router();

router.get('/', (req, res) => ok(res, { versionActual: VERSION_ACTUAL, versiones: VERSIONES }));

module.exports = router;
