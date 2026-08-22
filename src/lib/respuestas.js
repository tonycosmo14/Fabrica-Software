/** Formato unico de respuesta para toda la API, para que el frontend sea simple. */

function ok(res, datos = {}, codigo = 200) {
  return res.status(codigo).json({ ok: true, datos });
}

function error(res, mensaje, codigo = 400, extra = {}) {
  return res.status(codigo).json({ ok: false, error: mensaje, ...extra });
}

/** Envuelve un manejador async para que los errores no tumben el servidor. */
function asincrono(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { ok, error, asincrono };
