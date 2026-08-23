/**
 * Conexion unica a SQLite. Todo el sistema usa esta misma instancia.
 *
 * IMPORTANTE: se usa el SQLite que Node.js ya trae adentro (node:sqlite),
 * no una libreria externa. Antes se usaba "better-sqlite3", que viene en
 * codigo C y hay que COMPILARLO al instalarlo: en las PCs sin herramientas
 * de programador eso falla pidiendo Visual Studio. Con node:sqlite no hay
 * nada que compilar, nada que descargar y nada que se rompa al cambiar de
 * version de Node.
 */
const fs = require('node:fs');
const path = require('node:path');

// node:sqlite avisa que es "experimental" cada vez que arranca. Es solo ruido
// para el usuario, asi que se silencia ese aviso concreto y ningun otro.
const avisoOriginal = process.emitWarning;
process.emitWarning = function (aviso, ...resto) {
  const texto = typeof aviso === 'string' ? aviso : aviso?.message || '';
  if (texto.includes('SQLite is an experimental feature')) return;
  return avisoOriginal.call(process, aviso, ...resto);
};

const { DatabaseSync } = require('node:sqlite');
const config = require('../config');

let bd = null;

/**
 * Agrega a la base el ayudante de transacciones.
 * Uso:  const guardar = bd.transaction(() => { ...varios INSERT... });  guardar();
 * O todo se aplica, o no se aplica nada.
 *
 * SE PUEDEN ANIDAR. Una operación compuesta —un cambio de ticket, por
 * ejemplo— usa por dentro otras que ya venían con su propia transacción.
 * SQLite no admite un BEGIN dentro de otro, así que aquí se lleva la cuenta
 * de a qué profundidad vamos: solo la de más afuera abre y cierra de
 * verdad, y las de adentro se dejan llevar por ella.
 *
 * Eso es justo lo que se quiere: si algo revienta en el paso 3, se deshace
 * también el paso 1. Media operación guardada sería peor que ninguna.
 */
function conTransacciones(base) {
  let profundidad = 0;

  base.transaction = (fn) => (...args) => {
    // Ya estamos dentro de una: la de afuera manda.
    if (profundidad > 0) {
      profundidad++;
      try { return fn(...args); }
      finally { profundidad--; }
    }

    base.exec('BEGIN');
    profundidad = 1;
    try {
      const resultado = fn(...args);
      base.exec('COMMIT');
      return resultado;
    } catch (e) {
      try { base.exec('ROLLBACK'); } catch { /* la transaccion ya murio */ }
      throw e;
    } finally {
      profundidad = 0;
    }
  };
  return base;
}

function abrir() {
  if (bd) return bd;

  fs.mkdirSync(path.dirname(config.ARCHIVO_BD), { recursive: true });

  const base = new DatabaseSync(config.ARCHIVO_BD, {
    // Respeta las llaves foraneas declaradas en las migraciones.
    enableForeignKeyConstraints: true
  });

  // WAL: permite leer mientras se escribe. Importante con varios celulares conectados.
  base.exec('PRAGMA journal_mode = WAL');

  bd = conTransacciones(base);
  return bd;
}

function cerrar() {
  if (bd) { bd.close(); bd = null; }
}

module.exports = { abrir, cerrar, get bd() { return abrir(); } };
