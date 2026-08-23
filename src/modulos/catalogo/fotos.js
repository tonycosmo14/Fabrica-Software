/**
 * FOTOS DE LOS PRODUCTOS  (v0.13)
 *
 * Con foto, el cajero no lee el botón: lo reconoce. Es más rápido y se
 * equivoca menos, sobre todo con quien apenas está aprendiendo.
 *
 * Las fotos viven en la carpeta de DATOS, no dentro del programa: al
 * actualizar el sistema se reemplazan los archivos del programa, y si las
 * fotos vivieran ahí se perderían en cada actualización.
 *
 * Se acepta lo mismo que en el logo, salvo SVG: un SVG es texto que puede
 * traer código dentro, y una foto de producto no tiene ninguna razón para
 * ser un SVG.
 */
const fs = require('node:fs');
const path = require('node:path');
const config = require('../../config');

const CARPETA_FOTOS = path.join(config.CARPETA_DATOS, 'fotos');
const MAX_BYTES = 2 * 1024 * 1024;   // 2 MB: es un botón, no un cartel

const TIPOS = {
  'image/png':  { ext: 'png', firma: (b) => b.subarray(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/jpeg': { ext: 'jpg', firma: (b) => b[0] === 0xff && b[1] === 0xd8 },
  'image/webp': { ext: 'webp', firma: (b) => b.subarray(0, 4).toString() === 'RIFF'
    && b.subarray(8, 12).toString() === 'WEBP' }
};

/**
 * Guarda la foto que llegó como "data:image/png;base64,....".
 * Devuelve { archivo } o { error }.
 */
function guardar(productoId, textoDatos) {
  const coincide = /^data:([\w/+.-]+);base64,(.+)$/s.exec(String(textoDatos || ''));
  if (!coincide) return { error: 'Eso no parece una imagen.' };

  const [, tipo, base64] = coincide;
  const permitido = TIPOS[tipo];
  if (!permitido) {
    return { error: 'La foto tiene que ser PNG, JPG o WEBP.' };
  }

  let datos;
  try { datos = Buffer.from(base64, 'base64'); }
  catch { return { error: 'La imagen llegó dañada.' }; }

  if (datos.length > MAX_BYTES) {
    return { error: `La foto pesa ${Math.round(datos.length / 1024)} KB y el máximo son 2 MB.` };
  }

  // No basta con lo que diga el navegador: se comprueba que el archivo sea
  // de verdad lo que dice ser.
  if (!permitido.firma(datos)) {
    return { error: 'El archivo no es la imagen que dice ser.' };
  }

  fs.mkdirSync(CARPETA_FOTOS, { recursive: true });
  quitar(productoId);

  // El nombre lleva la hora para que el navegador no muestre la foto vieja
  // en caché cuando se cambia.
  const archivo = `${productoId}-${Date.now()}.${permitido.ext}`;
  fs.writeFileSync(path.join(CARPETA_FOTOS, archivo), datos);
  return { archivo };
}

/** Borra las fotos de un producto. */
function quitar(productoId) {
  if (!fs.existsSync(CARPETA_FOTOS)) return;
  for (const nombre of fs.readdirSync(CARPETA_FOTOS)) {
    if (nombre.startsWith(`${productoId}-`)) {
      try { fs.unlinkSync(path.join(CARPETA_FOTOS, nombre)); } catch { /* ya no está */ }
    }
  }
}

/** Sirve la foto de un producto o de una categoría. */
function servir(req, res) {
  const nombre = String(req.params.archivo || '');
  // Solo nombres que este módulo pudo haber creado: nada de subir carpetas.
  // Los ids de siembra son cortos (cat-hielo), así que se admite cualquier
  // id razonable, pero sin barras ni puntos que permitan salir de aquí.
  if (!/^[0-9a-zA-Z-]{1,40}-\d+\.(png|jpg|webp)$/.test(nombre)) {
    return res.status(404).end();
  }

  const ruta = path.join(CARPETA_FOTOS, nombre);
  if (!fs.existsSync(ruta)) return res.status(404).end();

  const ext = path.extname(nombre).slice(1).toLowerCase();
  const tipo = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  // El nombre cambia cada vez que se sube otra, así que se puede cachear
  // para siempre sin miedo.
  res.setHeader('Content-Type', tipo);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return fs.createReadStream(ruta).pipe(res);
}

module.exports = { guardar, quitar, servir, CARPETA_FOTOS };
