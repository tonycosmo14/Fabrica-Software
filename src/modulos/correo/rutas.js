/**
 * LA PANTALLA DE LOS AVISOS POR CORREO  (v4.9)
 *
 * Todo esto es del administrador y de nadie más. La cuenta de correo de
 * la fábrica, y sobre todo su contraseña, no tienen por qué pasar por las
 * manos de un cajero.
 *
 * LA CONTRASEÑA NO SALE DE AQUÍ. Nunca se manda al navegador: la pantalla
 * recibe `tieneContrasena: true` y enseña "ya está puesta". Mandarla para
 * rellenar una casilla es dejarla en el historial del navegador, en la
 * memoria de la pantalla y en cualquier registro de red del camino, y no
 * hace falta para nada: para cambiarla se escribe la nueva.
 */
const express = require('express');
const { ok, error } = require('../../lib/respuestas');
const { exigirPermiso } = require('../../middleware/sesion');
const bitacora = require('../../lib/bitacora');
const cola = require('./cola');
const avisos = require('./avisos');
const programados = require('./programados');
const smtp = require('./smtp');
const { correo } = require('./plantilla');

const router = express.Router();

// `correo.configurar` no lo tiene ningún rol: es del administrador por el
// comodín, como los sueldos.
const soloAdmin = exigirPermiso('correo.configurar');

// ============================================================
// CÓMO ESTÁ TODO
// ============================================================

router.get('/', soloAdmin, (req, res) => {
  const c = cola.cuenta();
  return ok(res, {
    cuenta: {
      activo: c.activo,
      servidor: c.servidor,
      puerto: c.puerto,
      seguridad: c.seguridad,
      usuario: c.usuario,
      para: c.para,
      tieneContrasena: Boolean(c.contrasena)      // el valor NO viaja
    },
    listo: cola.configurado(),
    avisos: avisos.catalogo(),
    ajustes: {
      gastoGrandeDesde: Number(cola.valor('aviso_gasto_grande_desde', '200000')),
      resumenDiaHora: Number(cola.valor('aviso_resumen_dia_hora', '21'))
    },
    pendientes: cola.cuentaPendientes(),
    ultimos: cola.ultimos(30)
  });
});

// ============================================================
// LA CUENTA
// ============================================================

router.put('/cuenta', soloAdmin, (req, res) => {
  const b = req.body || {};

  if (b.servidor !== undefined) {
    const s = String(b.servidor).trim();
    if (!s) return error(res, 'Escribe el servidor de salida.');
    cola.guardarValor('correo_servidor', s, req.usuario.id);
  }

  if (b.puerto !== undefined) {
    const p = Number(b.puerto);
    if (!Number.isInteger(p) || p < 1 || p > 65535) return error(res, 'Ese puerto no existe.');
    cola.guardarValor('correo_puerto', p, req.usuario.id);
  }

  if (b.seguridad !== undefined) {
    // 'plano' solo tiene sentido contra un repartidor de correo en esta
    // misma computadora, y el cliente se niega a usarlo contra otra cosa.
    const s = ['starttls', 'plano'].includes(b.seguridad) ? b.seguridad : 'tls';
    cola.guardarValor('correo_seguridad', s, req.usuario.id);
  }

  if (b.usuario !== undefined) {
    const u = String(b.usuario).trim();
    if (u && !pareceCorreo(u)) return error(res, 'Eso no parece un correo.');
    cola.guardarValor('correo_usuario', u, req.usuario.id);
  }

  // Vacío quiere decir "no la toques": así se puede cambiar el servidor
  // sin volver a escribir la contraseña. Para quitarla se manda `null`.
  if (b.contrasena !== undefined && b.contrasena !== '') {
    cola.guardarValor('correo_contrasena', b.contrasena === null ? '' : String(b.contrasena),
                      req.usuario.id);
  }

  if (b.para !== undefined) {
    const malos = separar(b.para).filter((x) => !pareceCorreo(x));
    if (malos.length) return error(res, `Esto no parece un correo: ${malos[0]}`);
    cola.guardarValor('correo_para', separar(b.para).join(', '), req.usuario.id);
  }

  if (b.activo !== undefined) {
    cola.guardarValor('correo_activo', b.activo ? '1' : '0', req.usuario.id);
  }

  bitacora.registrar({
    accion: 'correo.configuracion', entidad: 'configuracion',
    ejecutorId: req.usuario.id,
    // La contraseña NO se apunta en la bitácora, ni el hecho de cuál es:
    // solo que se cambió.
    detalle: { cambioContrasena: Boolean(b.contrasena), activo: b.activo }
  });

  return ok(res, { guardado: true, listo: cola.configurado() });
});

const separar = (t) => String(t || '').split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
const pareceCorreo = (t) => /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(String(t));

// ============================================================
// LOS INTERRUPTORES
// ============================================================

router.put('/avisos/:id', soloAdmin, (req, res) => {
  const a = avisos.AVISOS.find((x) => x.id === req.params.id);
  if (!a) return error(res, 'Ese aviso no existe.', 404);

  cola.guardarValor(avisos.clave(a.id), req.body?.encendido ? '1' : '0', req.usuario.id);
  return ok(res, { aviso: { ...a, encendido: avisos.encendido(a.id) } });
});

router.put('/ajustes', soloAdmin, (req, res) => {
  const b = req.body || {};

  if (b.gastoGrandeDesde !== undefined) {
    const c = Math.round(Number(b.gastoGrandeDesde) * 100);
    if (!Number.isInteger(c) || c < 0) return error(res, 'Ese monto no se entiende.');
    cola.guardarValor('aviso_gasto_grande_desde', c, req.usuario.id);
  }

  if (b.resumenDiaHora !== undefined) {
    const h = Number(b.resumenDiaHora);
    if (!Number.isInteger(h) || h < 0 || h > 23) return error(res, 'Esa hora no existe.');
    cola.guardarValor('aviso_resumen_dia_hora', h, req.usuario.id);
  }

  return ok(res, { guardado: true });
});

// ============================================================
// PROBAR
// ============================================================

/**
 * MANDA UN CORREO DE PRUEBA, AHORA MISMO Y SIN COLA.
 *
 * Es el único sitio donde se manda en directo: aquí sí hay alguien
 * esperando la respuesta, y lo que quiere saber es exactamente si sale o
 * no sale. Si falla, se le dice POR QUÉ con las palabras del servidor,
 * porque "no se pudo" no ayuda a nadie a arreglar una contraseña mal
 * escrita.
 */
router.post('/probar', soloAdmin, async (req, res) => {
  const c = cola.cuenta();
  if (!c.servidor || !c.usuario || !c.contrasena) {
    return error(res, 'Falta la cuenta o la contraseña.');
  }
  const para = separar(req.body?.para || c.para);
  if (!para.length) return error(res, 'No hay a quién mandarle la prueba.');

  const r = await smtp.mandar({
    servidor: c.servidor, puerto: c.puerto, seguridad: c.seguridad,
    usuario: c.usuario, contrasena: c.contrasena,
    de: c.usuario, deNombre: cola.negocio(), para,
    asunto: `Prueba de ${cola.negocio()}`,
    html: correo({
      negocio: cola.negocio(),
      cuando: avisos.momento(),
      titulo: 'La prueba salió',
      entradilla: 'Si estás leyendo esto, el correo de la fábrica ya funciona ' +
                  'y los avisos que prendas van a llegar aquí.',
      grande: '✓',
      color: 'verde',
      renglones: [
        ['Sale de', c.usuario],
        ['Por', `${c.servidor}:${c.puerto}`],
        ['Le llega a', para.join(', ')]
      ]
    })
  });

  if (!r.ok) return error(res, traducir(r.error), 502);

  bitacora.registrar({
    accion: 'correo.prueba', entidad: 'configuracion', ejecutorId: req.usuario.id
  });
  return ok(res, { salio: true, para });
});

/**
 * Los errores del servidor de correo vienen en inglés y en clave. Los tres
 * que se ven de verdad se dicen en cristiano, porque los tres tienen
 * arreglo y el arreglo no es obvio.
 */
function traducir(e) {
  const t = String(e || '');
  if (/535|5\.7\.8|Username and Password not accepted/i.test(t)) {
    return 'La cuenta o la contraseña no las aceptó el servidor. Si es Gmail, ' +
           'tiene que ser una CONTRASEÑA DE APLICACIÓN de 16 letras, no la ' +
           'contraseña normal. (' + t + ')';
  }
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(t)) {
    return 'No se encontró ese servidor. Revisa cómo está escrito, y que esta ' +
           'computadora tenga internet. (' + t + ')';
  }
  if (/ECONNREFUSED|ETIMEDOUT|no contestó|tardó/i.test(t)) {
    return 'El servidor no contestó por ese puerto. Prueba 465 con TLS, o 587 ' +
           'con STARTTLS. (' + t + ')';
  }
  return t;
}

// ============================================================
// LA COLA
// ============================================================

/** Empuja la cola a mano, para no esperar los cinco minutos del reloj. */
router.post('/cola/sacar', soloAdmin, async (req, res) => {
  return ok(res, await cola.entregarPendientes());
});

/** Revisa los avisos de reloj a mano, para poder probarlos. */
router.post('/revisar', soloAdmin, (req, res) => ok(res, programados.revisar()));

/** Ver un aviso por dentro, sin mandarlo. */
router.get('/cola/:id', soloAdmin, (req, res) => {
  const { bd } = require('../../db/conexion');
  const c = bd.prepare('SELECT * FROM correos WHERE id = ?').get(req.params.id);
  if (!c) return error(res, 'Ese correo no existe.', 404);
  return ok(res, { correo: c });
});

module.exports = router;
