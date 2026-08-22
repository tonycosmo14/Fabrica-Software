/**
 * Conexion unica a SQLite. Todo el sistema usa esta misma instancia.
 */
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const config = require('../config');

let bd = null;

function abrir() {
  if (bd) return bd;

  fs.mkdirSync(path.dirname(config.ARCHIVO_BD), { recursive: true });
  bd = new Database(config.ARCHIVO_BD);

  // WAL: permite leer mientras se escribe. Importante con varios celulares conectados.
  bd.pragma('journal_mode = WAL');
  // Respeta las llaves foraneas declaradas en las migraciones.
  bd.pragma('foreign_keys = ON');

  return bd;
}

module.exports = { abrir, get bd() { return abrir(); } };
