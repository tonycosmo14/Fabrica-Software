/**
 * PERSONALIZAR — el logo y el nombre del negocio.
 *
 * El logo se sube desde la interfaz, no copiando archivos a mano, y se
 * guarda en la carpeta "datos" (NO en "public"). Eso importa: al actualizar
 * el sistema se reemplazan los archivos del programa, y si el logo viviera
 * ahí se perdería en cada actualización. En "datos" sobrevive siempre.
 */
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { bd } = require('../../db/conexion');
const { ahora } = require('../../lib/ids');
const { ok, error } = require('../../lib/respuestas');
const bitacora = require('../../lib/bitacora');
const { exigirPermiso } = require('../../middleware/sesion');
const config = require('../../config');
const { REJILLA, rejillaDeLaCaja } = require('./rejilla');

const router = express.Router();

const CARPETA_MARCA = path.join(config.CARPETA_DATOS, 'marca');
const MAX_BYTES = 3 * 1024 * 1024;   // 3 MB

const TIPOS = {
  'image/png':     { ext: 'png',  firma: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/jpeg':    { ext: 'jpg',  firma: (b) => b[0] === 0xff && b[1] === 0xd8 },
  'image/webp':    { ext: 'webp', firma: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
  'image/svg+xml': { ext: 'svg',  firma: () => true }
};

const VARIANTES = { claro: 'logo_claro', oscuro: 'logo_oscuro' };

function leerConfig(clave) {
  return bd.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(clave)?.valor || null;
}

function guardarConfig(clave, valor, usuarioId) {
  bd.prepare(`
    INSERT INTO configuracion (clave, valor, actualizado_en, actualizado_por)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor,
      actualizado_en = excluded.actualizado_en, actualizado_por = excluded.actualizado_por
  `).run(clave, valor, ahora(), usuarioId || null);
}

/**
 * Un SVG es texto y puede traer código dentro. Como se sirve desde el mismo
 * servidor, se revisa antes de aceptarlo y además se manda con cabeceras que
 * impiden ejecutar nada.
 */
function svgPeligroso(texto) {
  return /<script|<foreignObject|javascript:|\son\w+\s*=/i.test(texto);
}

/** Estado actual: qué hay puesto. Público, porque el logo sale en la pantalla de entrada. */
router.get('/', (req, res) => ok(res, {
  nombreNegocio: leerConfig('nombre_negocio') || 'Hielo LOLHA',
  ciudad: leerConfig('ciudad') || '',
  logoClaro: leerConfig('logo_claro'),
  logoOscuro: leerConfig('logo_oscuro'),
  version: leerConfig('logo_version') || '0',
  rejilla: rejillaDeLaCaja()
}));

router.put('/', exigirPermiso('sistema.configurar'), (req, res) => {
  const { nombreNegocio, ciudad, posColumnas, posFilas } = req.body || {};

  if (nombreNegocio !== undefined) {
    const n = String(nombreNegocio).trim();
    if (!n) return error(res, 'El nombre del negocio no puede quedar vacío.');
    if (n.length > 60) return error(res, 'El nombre es demasiado largo.');
    guardarConfig('nombre_negocio', n, req.usuario.id);
  }
  if (ciudad !== undefined) guardarConfig('ciudad', String(ciudad).trim(), req.usuario.id);

  // La rejilla de la caja. Se rechaza lo que se sale de los topes en vez de
  // recortarlo en silencio: si alguien pide 40 columnas es que se equivocó,
  // y guardarle 10 sin decir nada lo deja pensando que el sistema no le hizo
  // caso.
  for (const [valor, clave, topes, comoSeLlama] of [
    [posColumnas, 'pos_columnas', REJILLA.columnas, 'columnas'],
    [posFilas, 'pos_filas', REJILLA.filas, 'filas']
  ]) {
    if (valor === undefined) continue;
    const n = Math.round(Number(valor));
    if (!Number.isFinite(n) || n < topes.minimo || n > topes.maximo) {
      return error(res, `Las ${comoSeLlama} de la caja van de ${topes.minimo} a ${topes.maximo}.`);
    }
    guardarConfig(clave, String(n), req.usuario.id);
  }

  bitacora.registrar({
    accion: 'personalizacion.datos', entidad: 'configuracion',
    ejecutorId: req.usuario.id, detalle: { nombreNegocio, ciudad, posColumnas, posFilas }
  });

  return ok(res, { guardado: true });
});

/** Subir el logo. Llega como texto "data:image/png;base64,...." desde el navegador. */
router.post('/logo', exigirPermiso('sistema.configurar'), (req, res) => {
  const { variante = 'claro', archivo } = req.body || {};
  const clave = VARIANTES[variante];
  if (!clave) return error(res, 'Variante de logo desconocida.');
  if (typeof archivo !== 'string') return error(res, 'No llegó ningún archivo.');

  const coincide = /^data:([\w/+.-]+);base64,(.+)$/s.exec(archivo);
  if (!coincide) return error(res, 'El archivo no se pudo leer. Prueba con un PNG o un SVG.');

  const [, tipo, base64] = coincide;
  const permitido = TIPOS[tipo];
  if (!permitido) {
    return error(res, 'Formato no admitido. Usa PNG, SVG, JPG o WEBP.');
  }

  let datos;
  try { datos = Buffer.from(base64, 'base64'); }
  catch { return error(res, 'El archivo llegó dañado.'); }

  if (!datos.length) return error(res, 'El archivo está vacío.');
  if (datos.length > MAX_BYTES) {
    return error(res, `El logo pesa ${Math.round(datos.length / 1024)} KB y el máximo son 3 MB.`);
  }
  if (!permitido.firma(datos)) {
    return error(res, 'El archivo no parece ser una imagen de ese tipo.');
  }
  if (tipo === 'image/svg+xml' && svgPeligroso(datos.toString('utf8'))) {
    return error(res, 'Ese SVG trae código dentro y no se puede usar. Expórtalo como PNG.');
  }

  fs.mkdirSync(CARPETA_MARCA, { recursive: true });

  // Se borra la variante anterior aunque fuera de otro formato.
  for (const t of Object.values(TIPOS)) {
    const viejo = path.join(CARPETA_MARCA, `${clave}.${t.ext}`);
    if (fs.existsSync(viejo)) fs.unlinkSync(viejo);
  }

  const nombreArchivo = `${clave}.${permitido.ext}`;
  fs.writeFileSync(path.join(CARPETA_MARCA, nombreArchivo), datos);

  guardarConfig(clave, nombreArchivo, req.usuario.id);
  guardarConfig('logo_version', String(Date.now()), req.usuario.id);

  bitacora.registrar({
    accion: 'personalizacion.logo', entidad: 'configuracion',
    ejecutorId: req.usuario.id, detalle: { variante, tipo, kb: Math.round(datos.length / 1024) }
  });

  return ok(res, { guardado: true, archivo: nombreArchivo });
});

/** Quitar el logo y volver al nombre escrito. */
router.post('/logo/quitar', exigirPermiso('sistema.configurar'), (req, res) => {
  const clave = VARIANTES[req.body?.variante || 'claro'];
  if (!clave) return error(res, 'Variante de logo desconocida.');

  const actual = leerConfig(clave);
  if (actual) {
    const archivo = path.join(CARPETA_MARCA, actual);
    if (fs.existsSync(archivo)) fs.unlinkSync(archivo);
  }
  bd.prepare('DELETE FROM configuracion WHERE clave = ?').run(clave);
  guardarConfig('logo_version', String(Date.now()), req.usuario.id);

  bitacora.registrar({
    accion: 'personalizacion.logo_quitado', entidad: 'configuracion',
    ejecutorId: req.usuario.id, detalle: { variante: req.body?.variante }
  });

  return ok(res, { quitado: true });
});

/**
 * Sirve el archivo del logo. Público: aparece en la pantalla de entrada,
 * antes de que nadie haya iniciado sesión.
 */
function servirLogo(clave) {
  return (req, res) => {
    const nombreArchivo = leerConfig(clave);
    if (!nombreArchivo) return res.status(404).end();

    const archivo = path.join(CARPETA_MARCA, nombreArchivo);
    if (!fs.existsSync(archivo)) return res.status(404).end();

    const ext = path.extname(archivo).slice(1);
    const tipo = Object.entries(TIPOS).find(([, t]) => t.ext === ext)?.[0] || 'application/octet-stream';

    // Cabeceras de seguridad: aunque el SVG trajera algo, aquí no se ejecuta.
    res.setHeader('Content-Type', tipo);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(archivo);
  };
}

module.exports = { router, servirLogo };
