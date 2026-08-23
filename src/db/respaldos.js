/**
 * RESPALDOS AUTOMÁTICOS
 *
 * El archivo de la base de datos ES el negocio: usuarios, tanques, todo lo
 * que se sacó y, más adelante, las ventas. Si esa PC muere sin copias, se
 * pierde. Este módulo hace que eso no pase.
 *
 * Cómo funciona:
 *  · Copia la base cada cierto tiempo, sin que nadie lo pida.
 *  · Guarda una copia en datos/respaldos y, si se configuró, otra en una
 *    SEGUNDA CARPETA: una USB pegada a la PC, o una carpeta de Drive o
 *    OneDrive que se sincroniza sola a internet.
 *  · Conserva los últimos N y borra los viejos, para no llenar el disco.
 *
 * Por qué se copia el archivo entero y no "las últimas ventas": para
 * restaurar solo hay que pegar el archivo de vuelta. Sin pasos, sin
 * herramientas, sin depender de nadie.
 *
 * Nota técnica: SQLite en modo WAL guarda lo más reciente en un archivo
 * aparte. Por eso, antes de copiar, se fuerza un "checkpoint" que vuelca
 * todo al archivo principal. Sin eso, el respaldo podría no traer los
 * últimos movimientos.
 */
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');
const { bd } = require('./conexion');

const PREFIJO = 'fabrica_';

/** Vuelca a disco lo que SQLite tenga pendiente en el diario. */
function consolidar() {
  try { bd.exec('PRAGMA wal_checkpoint(TRUNCATE)'); }
  catch { /* si falla, la copia sigue siendo válida, solo puede faltar lo último */ }
}

function nombreArchivo(motivo) {
  const sello = new Date().toISOString().replace(/[:.]/g, '-');
  return `${PREFIJO}${sello}_${motivo}.db`;
}

/** Copia la base a una carpeta. Devuelve la ruta o lanza el error. */
function copiarA(carpeta, motivo) {
  fs.mkdirSync(carpeta, { recursive: true });
  const destino = path.join(carpeta, nombreArchivo(motivo));
  fs.copyFileSync(config.ARCHIVO_BD, destino);
  return destino;
}

/** Deja solo los N respaldos más nuevos de una carpeta. */
function podar(carpeta, cuantosConservar) {
  if (!fs.existsSync(carpeta)) return 0;

  const archivos = fs.readdirSync(carpeta)
    .filter((a) => a.startsWith(PREFIJO) && a.endsWith('.db'))
    .map((a) => ({ nombre: a, ruta: path.join(carpeta, a) }))
    .sort((a, b) => b.nombre.localeCompare(a.nombre));   // el más nuevo primero

  let borrados = 0;
  for (const viejo of archivos.slice(cuantosConservar)) {
    try { fs.unlinkSync(viejo.ruta); borrados++; } catch { /* ya no estaba */ }
  }
  return borrados;
}

function leerConfig(clave, porOmision = null) {
  return bd.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(clave)?.valor ?? porOmision;
}

function guardarConfig(clave, valor) {
  bd.prepare(`
    INSERT INTO configuracion (clave, valor, actualizado_en) VALUES (?, ?, datetime('now'))
    ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')
  `).run(clave, String(valor));
}

/** La configuración de respaldos, con valores sensatos por omisión. */
function ajustes() {
  return {
    cadaHoras: Number(leerConfig('respaldo_cada_horas', 4)),
    conservar: Number(leerConfig('respaldo_conservar', 30)),
    carpetaExtra: leerConfig('respaldo_carpeta_extra', '') || '',
    ultimo: leerConfig('respaldo_ultimo', null),
    ultimoExtra: leerConfig('respaldo_ultimo_extra', null),
    ultimoError: leerConfig('respaldo_ultimo_error', null)
  };
}

/**
 * Hace un respaldo ahora.
 * motivo: 'automatico' | 'manual' | 'pre-migracion' | 'cierre'
 */
function respaldar(motivo = 'manual') {
  if (!fs.existsSync(config.ARCHIVO_BD)) return { hecho: false, razon: 'todavía no hay base de datos' };

  consolidar();
  const a = ajustes();
  const resultado = { hecho: true, motivo, principal: null, extra: null, errorExtra: null };

  resultado.principal = copiarA(config.CARPETA_RESPALDOS, motivo);
  podar(config.CARPETA_RESPALDOS, a.conservar);
  guardarConfig('respaldo_ultimo', new Date().toISOString());

  // La segunda copia es la que de verdad salva: vive fuera de esta PC.
  if (a.carpetaExtra) {
    try {
      resultado.extra = copiarA(a.carpetaExtra, motivo);
      podar(a.carpetaExtra, a.conservar);
      guardarConfig('respaldo_ultimo_extra', new Date().toISOString());
      guardarConfig('respaldo_ultimo_error', '');
    } catch (e) {
      // Que falle la USB no debe tumbar nada: se anota y se avisa en pantalla.
      resultado.errorExtra = e.message;
      guardarConfig('respaldo_ultimo_error', `${new Date().toISOString()} · ${e.message}`);
    }
  }

  return resultado;
}

/** Lista los respaldos que existen, del más nuevo al más viejo. */
function listar(carpeta = config.CARPETA_RESPALDOS, limite = 20) {
  if (!fs.existsSync(carpeta)) return [];

  return fs.readdirSync(carpeta)
    .filter((a) => a.startsWith(PREFIJO) && a.endsWith('.db'))
    .map((a) => {
      const info = fs.statSync(path.join(carpeta, a));
      return { archivo: a, kb: Math.round(info.size / 1024), fecha: info.mtime.toISOString() };
    })
    .sort((a, b) => b.archivo.localeCompare(a.archivo))
    .slice(0, limite);
}

/** Comprueba que se pueda escribir en una carpeta antes de configurarla. */
function probarCarpeta(carpeta) {
  try {
    fs.mkdirSync(carpeta, { recursive: true });
    const prueba = path.join(carpeta, '.prueba-lolha');
    fs.writeFileSync(prueba, 'ok');
    fs.unlinkSync(prueba);
    return { sirve: true };
  } catch (e) {
    return { sirve: false, error: e.message };
  }
}

// ------------------------------------------------------------
// El reloj de los respaldos automáticos
// ------------------------------------------------------------
let reloj = null;

function arrancarAutomaticos() {
  detenerAutomaticos();
  const a = ajustes();
  if (!(a.cadaHoras > 0)) return null;

  const cadaMs = a.cadaHoras * 3600000;

  // Se revisa cada 10 minutos si ya toca. Así, aunque el sistema se apague
  // por la noche, al encenderlo hace el respaldo que faltaba.
  reloj = setInterval(() => {
    const ultimo = ajustes().ultimo;
    const pasado = ultimo ? Date.now() - new Date(ultimo).getTime() : Infinity;
    if (pasado >= cadaMs) {
      try { respaldar('automatico'); }
      catch (e) { console.error('  No se pudo respaldar:', e.message); }
    }
  }, 10 * 60000);

  reloj.unref?.();
  return reloj;
}

function detenerAutomaticos() {
  if (reloj) { clearInterval(reloj); reloj = null; }
}

module.exports = {
  respaldar, listar, ajustes, guardarConfig, probarCarpeta,
  arrancarAutomaticos, detenerAutomaticos, podar
};
