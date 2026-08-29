/**
 * LOS PAPELES QUE RESPALDAN UN GASTO  (v2.7)
 *
 * El PDF del recibo de la CFE, la foto de una factura. Se guardan en la
 * carpeta "datos" y NO dentro del programa: al actualizar por ZIP se
 * reemplazan los archivos del programa, y un recibo de luz guardado ahí se
 * perdería en la primera actualización. Es el mismo sitio y la misma razón
 * que el logo.
 *
 * A diferencia del logo, ESTOS NO SON PÚBLICOS: un recibo de la CFE lleva
 * el número de servicio y el domicilio de la fábrica. Se sirven solo a quien
 * tiene permiso, y con las cabeceras puestas para que el navegador no
 * ejecute nada de lo que haya dentro.
 */
const fs = require('node:fs');
const path = require('node:path');
const config = require('../../config');

const CARPETA = path.join(config.CARPETA_DATOS, 'empresa');
const MAX_BYTES = 8 * 1024 * 1024;   // 8 MB: un recibo escaneado cabe de sobra

/**
 * Lo que se acepta, y cómo se comprueba que es lo que dice ser.
 *
 * No basta con el tipo que declara el navegador —eso lo escribe quien
 * quiera—: se mira la firma de los primeros bytes, que es lo que de verdad
 * distingue un PDF de un ejecutable con nombre de PDF.
 */
const TIPOS = {
  'application/pdf': { ext: 'pdf', firma: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  'image/jpeg':      { ext: 'jpg', firma: (b) => b[0] === 0xff && b[1] === 0xd8 },
  'image/png':       { ext: 'png', firma: (b) => b.subarray(0, 8).equals(
                        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/webp':      { ext: 'webp', firma: (b) => b.subarray(0, 4).toString() === 'RIFF'
                        && b.subarray(8, 12).toString() === 'WEBP' }
};

/**
 * Guarda un archivo que llegó como "data:application/pdf;base64,...".
 * Devuelve { archivo } o { error } — nunca lanza.
 */
function guardar(datos, nombreBase) {
  if (typeof datos !== 'string' || !datos) return { error: 'No llegó ningún archivo.' };

  const coincide = /^data:([\w/+.-]+);base64,(.+)$/s.exec(datos);
  if (!coincide) return { error: 'El archivo no se pudo leer. Prueba con un PDF o una foto.' };

  const [, tipo, base64] = coincide;
  const permitido = TIPOS[tipo];
  if (!permitido) return { error: 'Solo se admiten PDF, JPG, PNG o WEBP.' };

  let bytes;
  try { bytes = Buffer.from(base64, 'base64'); }
  catch { return { error: 'El archivo llegó dañado.' }; }

  if (!bytes.length) return { error: 'El archivo está vacío.' };
  if (bytes.length > MAX_BYTES) {
    return { error: `El archivo pesa ${Math.round(bytes.length / 1024 / 1024)} MB y el máximo son 8 MB.` };
  }
  if (!permitido.firma(bytes)) {
    return { error: 'Ese archivo no parece ser del tipo que dice.' };
  }

  try {
    fs.mkdirSync(CARPETA, { recursive: true });
    // El nombre lo pone el sistema con el id del renglón: así no hay forma
    // de que alguien elija dónde se escribe ni de que dos se pisen.
    const nombre = `${nombreBase}.${permitido.ext}`;
    fs.writeFileSync(path.join(CARPETA, nombre), bytes);
    return { archivo: nombre, tipo, kb: Math.round(bytes.length / 1024) };
  } catch (e) {
    return { error: `No se pudo guardar el archivo: ${e.message}` };
  }
}

/** Borra el archivo de un renglón, si lo tenía. Se usa al reemplazarlo. */
function borrar(nombre) {
  if (!nombre) return;
  const archivo = path.join(CARPETA, path.basename(nombre));
  try { fs.unlinkSync(archivo); } catch { /* ya no estaba */ }
}

/**
 * Manda el archivo al navegador.
 *
 * `path.basename` no es adorno: sin él, un nombre guardado como
 * "../../datos/lolha.db" serviría la base de datos entera.
 */
function servir(res, nombre, comoSeLlama) {
  if (!nombre) return res.status(404).end();
  const archivo = path.join(CARPETA, path.basename(nombre));
  if (!fs.existsSync(archivo)) return res.status(404).end();

  const ext = path.extname(archivo).slice(1);
  const tipo = Object.entries(TIPOS).find(([, t]) => t.ext === ext)?.[0]
               || 'application/octet-stream';

  res.setHeader('Content-Type', tipo);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Content-Disposition',
                `inline; filename="${String(comoSeLlama || 'documento').replace(/[^\w.-]/g, '_')}.${ext}"`);
  res.setHeader('Cache-Control', 'private, no-cache');
  return res.sendFile(archivo);
}

module.exports = { guardar, borrar, servir, CARPETA, MAX_BYTES, TIPOS };
