/**
 * LA COLA DE CORREOS  (v4.9)
 *
 * Ningún aviso se manda en el momento: se apunta aquí y un reloj lo
 * entrega. Está explicado con detalle en la migración 037; en corto son
 * tres cosas que pasan en una fábrica y no en un servidor:
 *
 *   · aquí se va el internet,
 *   · nadie puede esperar diez segundos a Gmail para cerrar un turno,
 *   · y "no me llegó el correo" tiene que poder contestarse mirando algo.
 *
 * Si un intento falla se vuelve a probar más tarde, cada vez con más
 * espera: 1, 5, 15, 60 minutos y luego cada dos horas. Eso es a propósito:
 * un servidor que está rechazando no se arregla insistiendo cada minuto,
 * y sí puede acabar con la cuenta bloqueada por abuso.
 */
const { bd } = require('../../db/conexion');
const { nuevoId, ahora } = require('../../lib/ids');
const smtp = require('./smtp');

const INTENTOS_MAXIMOS = 8;
const ESPERAS_MINUTOS = [1, 5, 15, 60, 120, 120, 240];

// ============================================================
// LA CUENTA DE CORREO
// ============================================================

function valor(clave, siNoHay = '') {
  return bd.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(clave)?.valor ?? siNoHay;
}

function guardarValor(clave, v, quien = null) {
  bd.prepare(`
    INSERT INTO configuracion (clave, valor, actualizado_en, actualizado_por)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor,
      actualizado_en = excluded.actualizado_en, actualizado_por = excluded.actualizado_por
  `).run(clave, String(v), ahora(), quien);
}

/** La configuración del correo. La contraseña NUNCA sale de aquí. */
function cuenta() {
  return {
    activo: valor('correo_activo', '0') === '1',
    servidor: valor('correo_servidor', 'smtp.gmail.com'),
    puerto: Number(valor('correo_puerto', '465')) || 465,
    seguridad: ['starttls', 'plano'].includes(valor('correo_seguridad', 'tls'))
      ? valor('correo_seguridad') : 'tls',
    usuario: valor('correo_usuario', ''),
    contrasena: valor('correo_contrasena', ''),
    para: valor('correo_para', '')
  };
}

/** ¿Está lista para mandar? Sin esto, la cola se llenaría de nada. */
function configurado() {
  const c = cuenta();
  return Boolean(c.activo && c.servidor && c.usuario && c.contrasena && c.para.trim());
}

const negocio = () => valor('nombre_negocio', 'Hielo LOLHA');

// ============================================================
// ENCOLAR
// ============================================================

/**
 * APUNTA UN AVISO PARA QUE SALGA.
 *
 * Nunca lanza. Se le llama desde el corazón del sistema —al cerrar un
 * turno, al anular una venta— y un problema con el correo no puede
 * tumbar el trabajo de la fábrica. Si algo sale mal, se calla y sigue.
 */
function encolar({ aviso, asunto, html, texto = null }) {
  try {
    if (!configurado()) return null;

    const id = nuevoId();
    bd.prepare(`
      INSERT INTO correos (id, creado_en, aviso, asunto, cuerpo, resumen, para,
                           proximo_intento)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, ahora(), aviso, asunto, html,
           texto || smtp.quitarEtiquetas(html), cuenta().para, ahora());

    // Se despierta al cartero, pero sin esperarlo: quien llamó tiene que
    // seguir con lo suyo en el mismo parpadeo.
    setImmediate(() => { entregarPendientes().catch(() => {}); });
    return id;
  } catch (e) {
    console.error('  No se pudo apuntar el aviso:', e.message);
    return null;
  }
}

// ============================================================
// ENTREGAR
// ============================================================

// El cartero sale de uno en uno. Si ya anda fuera cuando le llega otro
// encargo, se le espera y se le manda otra vez — no se le contesta
// "ocupado", que dejaría ese aviso esperando los cinco minutos del reloj.
let enMarcha = null;

/** Los que están esperando su turno y ya les tocaba. */
function pendientes(limite = 20) {
  return bd.prepare(`
    SELECT * FROM correos
     WHERE enviado_en IS NULL AND cancelado_en IS NULL
       AND (proximo_intento IS NULL OR proximo_intento <= ?)
     ORDER BY creado_en
     LIMIT ?
  `).all(ahora(), limite);
}

/**
 * SACA LA COLA.
 *
 * De uno en uno y por la misma puerta: dos entregas a la vez con la misma
 * cuenta de Gmail es la forma más rápida de que la den de baja por abuso.
 */
function entregarPendientes() {
  if (!configurado()) return Promise.resolve({ salieron: 0, fallaron: 0, sinCuenta: true });

  const siguiente = (enMarcha || Promise.resolve()).then(sacarCola, sacarCola);
  enMarcha = siguiente.catch(() => {});
  return siguiente;
}

async function sacarCola() {
  let salieron = 0;
  let fallaron = 0;

  {
    const c = cuenta();
    for (const correo of pendientes()) {
      const r = await smtp.mandar({
        servidor: c.servidor, puerto: c.puerto, seguridad: c.seguridad,
        usuario: c.usuario, contrasena: c.contrasena,
        de: c.usuario, deNombre: negocio(),
        para: correo.para,
        asunto: correo.asunto, html: correo.cuerpo, texto: correo.resumen
      });

      if (r.ok) { marcarEnviado(correo.id); salieron++; }
      else { marcarFallo(correo, r); fallaron++; }
    }
  }

  return { salieron, fallaron };
}

function marcarEnviado(id) {
  bd.prepare('UPDATE correos SET enviado_en = ?, ultimo_intento = ?, intentos = intentos + 1 WHERE id = ?')
    .run(ahora(), ahora(), id);
}

/**
 * Apunta el error y decide cuándo se vuelve a probar.
 *
 * Un error que no se arregla solo —la contraseña está mal, el correo del
 * destino no existe— no se reintenta: se cancela con su motivo, y así el
 * problema se ve en la pantalla en vez de esconderse en una cola que
 * crece. Ocho intentos fallidos también se rinden: si en un día no salió,
 * no va a salir.
 */
function marcarFallo(correo, r) {
  const intentos = correo.intentos + 1;
  const rendirse = !r.reintentable || intentos >= INTENTOS_MAXIMOS;

  if (rendirse) {
    bd.prepare(`
      UPDATE correos SET intentos = ?, ultimo_intento = ?, ultimo_error = ?,
             cancelado_en = ?, motivo_cancelacion = ?
       WHERE id = ?
    `).run(intentos, ahora(), r.error, ahora(),
           r.reintentable ? 'No se pudo después de varios intentos.' : r.error, correo.id);
    return;
  }

  const espera = ESPERAS_MINUTOS[Math.min(intentos - 1, ESPERAS_MINUTOS.length - 1)];
  // La MISMA forma de escribir la fecha que `ahora()`, con su T. Se
  // comparan como texto, y un espacio en lugar de la T las vuelve menores
  // que cualquier fecha con T: la cola agarraría el correo en el acto y
  // la espera creciente no serviría para nada.
  const cuando = new Date(Date.now() + espera * 60000).toISOString();
  bd.prepare(`
    UPDATE correos SET intentos = ?, ultimo_intento = ?, ultimo_error = ?, proximo_intento = ?
     WHERE id = ?
  `).run(intentos, ahora(), r.error, cuando, correo.id);
}

// ============================================================
// LA LIBRETA
// ============================================================

/** Los últimos correos, para poder mirar qué salió y qué no. */
function ultimos(limite = 40) {
  return bd.prepare(`
    SELECT id, creado_en, aviso, asunto, para, intentos, ultimo_intento,
           ultimo_error, proximo_intento, enviado_en, cancelado_en, motivo_cancelacion
      FROM correos ORDER BY creado_en DESC LIMIT ?
  `).all(limite);
}

function cuentaPendientes() {
  return bd.prepare(
    'SELECT COUNT(*) c FROM correos WHERE enviado_en IS NULL AND cancelado_en IS NULL'
  ).get().c;
}

/**
 * Tira los correos viejos que ya salieron.
 *
 * La regla 3.4 dice que nada se borra, y aquí no se rompe: lo que se tira
 * son los que YA SE ENTREGARON hace más de tres meses, que son un acuse
 * de recibo y no un registro de la fábrica. Los cancelados se quedan
 * siempre: esos son los que hay que poder mirar.
 */
function podar(dias = 90) {
  const corte = new Date(Date.now() - dias * 86400000).toISOString().replace('T', ' ').slice(0, 19);
  return bd.prepare('DELETE FROM correos WHERE enviado_en IS NOT NULL AND creado_en < ?')
    .run(corte).changes;
}

// ============================================================
// EL RELOJ
// ============================================================

let reloj = null;

/**
 * Cada cinco minutos se asoma a la cola.
 *
 * Sirve para dos cosas: entregar lo que quedó pendiente cuando no había
 * internet, y disparar los avisos de reloj —el resumen del día, el
 * informe del mes, el inventario bajo— que no salen de un botón sino de
 * que pase el tiempo.
 */
function arrancarReloj({ cada = 5 } = {}) {
  detenerReloj();
  reloj = setInterval(() => {
    try { require('./programados').revisar(); }
    catch (e) { console.error('  Avisos de reloj:', e.message); }
    entregarPendientes().catch(() => {});
  }, cada * 60000);
  reloj.unref?.();
  return reloj;
}

function detenerReloj() {
  if (reloj) { clearInterval(reloj); reloj = null; }
}

module.exports = {
  valor, guardarValor, cuenta, configurado, negocio,
  encolar, pendientes, entregarPendientes, ultimos, cuentaPendientes, podar,
  arrancarReloj, detenerReloj
};
