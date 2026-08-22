/**
 * MIGRACIONES
 * -----------
 * Los archivos .sql de src/db/migraciones/ se aplican en orden numerico
 * (001_, 002_, 003_...) una sola vez cada uno. Al arrancar, el sistema mira
 * cuales faltan y las aplica.
 *
 * Antes de aplicar cualquier cosa se hace un respaldo automatico de la base.
 *
 * Regla: una migracion ya aplicada NUNCA se edita. Si algo esta mal,
 * se crea la siguiente que lo corrige.
 */
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');
const { abrir } = require('./conexion');
const { respaldar } = require('./respaldar');

function asegurarTablaControl(bd) {
  bd.exec(`
    CREATE TABLE IF NOT EXISTS migraciones (
      archivo    TEXT PRIMARY KEY,
      aplicada_en TEXT NOT NULL
    );
  `);
}

function listarArchivos() {
  if (!fs.existsSync(config.CARPETA_MIGRACIONES)) return [];
  return fs
    .readdirSync(config.CARPETA_MIGRACIONES)
    .filter((a) => a.endsWith('.sql'))
    .sort(); // 001, 002, 003... el orden alfabetico es el correcto con ceros a la izquierda
}

function migrar({ silencioso = false } = {}) {
  const bd = abrir();
  asegurarTablaControl(bd);

  const aplicadas = new Set(bd.prepare('SELECT archivo FROM migraciones').all().map((f) => f.archivo));
  const pendientes = listarArchivos().filter((a) => !aplicadas.has(a));

  if (pendientes.length === 0) {
    if (!silencioso) {
      const n = aplicadas.size;
      console.log(`  Base de datos al día (${n} ${n === 1 ? 'migración aplicada' : 'migraciones aplicadas'}).`);
    }
    return { aplicadas: [], respaldo: null };
  }

  // Solo tiene sentido respaldar si ya habia algo dentro: una base recien creada
  // no tiene nada que perder.
  const respaldo = aplicadas.size > 0 ? respaldar('pre-migracion') : null;
  if (respaldo && !silencioso) console.log(`  Respaldo previo: ${respaldo}`);

  const registrar = bd.prepare('INSERT INTO migraciones (archivo, aplicada_en) VALUES (?, ?)');
  const hechas = [];

  for (const archivo of pendientes) {
    const sql = fs.readFileSync(path.join(config.CARPETA_MIGRACIONES, archivo), 'utf8');

    // Cada migracion es una transaccion: o se aplica completa, o no se aplica.
    const aplicarUna = bd.transaction(() => {
      bd.exec(sql);
      registrar.run(archivo, new Date().toISOString());
    });

    try {
      aplicarUna();
      hechas.push(archivo);
      if (!silencioso) console.log(`  Aplicada: ${archivo}`);
    } catch (e) {
      console.error(`\nFALLO la migracion ${archivo}: ${e.message}`);
      if (respaldo) console.error(`La base quedo intacta. Respaldo disponible en: ${respaldo}`);
      throw e;
    }
  }

  return { aplicadas: hechas, respaldo };
}

module.exports = { migrar };

if (require.main === module) migrar();
