/**
 * Respaldo de la base de datos.
 * Se corre solo antes de aplicar migraciones, y tambien a mano:  npm run respaldo
 */
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');

function respaldar(motivo = 'manual') {
  if (!fs.existsSync(config.ARCHIVO_BD)) return null; // base nueva, nada que respaldar

  fs.mkdirSync(config.CARPETA_RESPALDOS, { recursive: true });

  const sello = new Date().toISOString().replace(/[:.]/g, '-');
  const destino = path.join(config.CARPETA_RESPALDOS, `fabrica_${sello}_${motivo}.db`);

  fs.copyFileSync(config.ARCHIVO_BD, destino);
  return destino;
}

module.exports = { respaldar };

// Permite ejecutarlo directo desde la terminal.
if (require.main === module) {
  const destino = respaldar('manual');
  console.log(destino ? `Respaldo creado: ${destino}` : 'No hay base de datos que respaldar todavia.');
}
