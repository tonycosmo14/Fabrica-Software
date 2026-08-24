/**
 * Todas las llamadas al servidor pasan por aqui.
 * Si algo falla, lanza un Error con el mensaje que mando el servidor.
 */

async function pedir(ruta, opciones = {}) {
  const r = await fetch(`/api${ruta}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones,
    body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined
  });

  let json = {};
  try { json = await r.json(); } catch { /* respuesta sin cuerpo */ }

  if (!r.ok || json.ok === false) {
    const e = new Error(json.error || `Error ${r.status}`);
    e.codigo = r.status;

    // El servidor manda datos extra junto al error (por ejemplo
    // "requiereAutorizacion" o "tocaPano"). Se conservan: la pantalla los
    // necesita para saber qué preguntar.
    for (const [clave, valor] of Object.entries(json)) {
      if (clave !== 'ok' && clave !== 'error') e[clave] = valor;
    }
    throw e;
  }
  return json.datos;
}

export const api = {
  obtener: (ruta) => pedir(ruta),
  enviar:  (ruta, cuerpo) => pedir(ruta, { method: 'POST', cuerpo }),
  actualizar: (ruta, cuerpo) => pedir(ruta, { method: 'PUT', cuerpo }),
  // Borrar de verdad. Casi nada se borra en este sistema; lo que se puede,
  // pide la contraseña del administrador y va por aquí.
  borrar: (ruta, cuerpo) => pedir(ruta, { method: 'DELETE', cuerpo })
};
