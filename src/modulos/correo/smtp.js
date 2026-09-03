/**
 * SMTP A MANO  (v4.9)
 *
 * Mandar un correo es hablar con un servidor por un socket y decirle seis
 * frases en orden. Eso es todo lo que hay aquí.
 *
 * POR QUÉ NO SE USA UNA LIBRERÍA
 *
 * Este sistema no tiene ni una sola dependencia, a propósito: se copia la
 * carpeta y funciona, y una actualización es reemplazar archivos. Meter
 * `nodemailer` traería doscientos paquetes, un `npm install` obligatorio
 * en cada actualización y una cadena de gente que puede meterle código a
 * la computadora de la fábrica. Para mandar un correo de texto a Gmail no
 * hace falta nada de eso: el protocolo entero cabe en este archivo.
 *
 * LA CONVERSACIÓN, TAL CUAL
 *
 *     ← 220 smtp.gmail.com listo
 *     → EHLO fabrica                 «hola, soy yo»
 *     ← 250-… lista de lo que sabe hacer
 *     → AUTH LOGIN                   «me voy a identificar»
 *     ← 334 VXNlcm5hbWU6            «dime el usuario» (en base64)
 *     → …                            el usuario, en base64
 *     ← 334 UGFzc3dvcmQ6            «dime la contraseña»
 *     → …                            la contraseña, en base64
 *     ← 235 entrale
 *     → MAIL FROM:<…>                de quién es
 *     → RCPT TO:<…>                  para quién es
 *     → DATA                         «ahí te va»
 *     ← 354 escribe y termina con un punto solo
 *     → …el correo… \r\n.\r\n
 *     ← 250 recibido
 *     → QUIT
 *
 * Los números son el idioma: 2xx salió bien, 3xx sigue hablando, 4xx algo
 * pasó y se puede reintentar, 5xx no lo vuelvas a intentar así.
 */
const net = require('node:net');
const tls = require('node:tls');
const os = require('node:os');

const ESPERA_MS = 25000;

/**
 * MANDAR UN CORREO.
 *
 * Devuelve `{ ok: true }` o `{ ok: false, error, reintentable }`. Nunca
 * lanza: quien llama es una cola que tiene que decidir si reintenta, y
 * decidirlo con un try/catch alrededor de todo es más difícil de leer.
 */
async function mandar({
  servidor, puerto, seguridad = 'tls', usuario, contrasena,
  de, deNombre, para, asunto, html, texto
} = {}) {
  const destinos = (Array.isArray(para) ? para : String(para || '').split(','))
    .map((x) => x.trim()).filter(Boolean);

  if (!servidor) return fallo('Falta el servidor de salida.', false);
  if (!usuario || !contrasena) return fallo('Falta la cuenta o su contraseña.', false);
  if (!destinos.length) return fallo('No hay a quién mandarle el aviso.', false);

  let charla = null;
  try {
    charla = await conectar({ servidor, puerto: Number(puerto) || 465, seguridad });

    await charla.decir(`EHLO ${limpio(os.hostname()) || 'fabrica'}`, 250);
    await charla.decir('AUTH LOGIN', 334);
    await charla.decir(base64(usuario), 334);
    await charla.decir(base64(contrasena), 235);

    await charla.decir(`MAIL FROM:<${de || usuario}>`, 250);
    for (const d of destinos) await charla.decir(`RCPT TO:<${d}>`, 250);
    await charla.decir('DATA', 354);

    // El cuerpo se manda de un jalón y se cierra con un punto solo en su
    // renglón. Va todo en base64, y eso resuelve de paso los dos líos
    // clásicos del correo: los acentos y el renglón que empieza con punto
    // —que en SMTP significa "aquí acaba"—.
    await charla.decir(
      armar({ de: de || usuario, deNombre, destinos, asunto, html, texto }) + '\r\n.',
      250
    );

    await charla.decir('QUIT', 221).catch(() => {});   // si no contesta, da igual
    charla.cerrar();
    return { ok: true };
  } catch (e) {
    charla?.cerrar();
    return fallo(e.message, e.reintentable !== false);
  }
}

function fallo(error, reintentable) { return { ok: false, error, reintentable }; }

// ============================================================
// EL SOCKET Y LAS FRASES
// ============================================================

/**
 * Abre la conversación y devuelve un objeto que sabe decir frases.
 *
 * Dos maneras de cifrar, y las dos se usan en la vida real:
 *   · 'tls'      — puerto 465, cifrado desde el primer byte. Es el que
 *                  quiere Gmail y el que menos se rompe.
 *   · 'starttls' — puerto 587, se empieza a hablar en claro y a media
 *                  charla se sube a cifrado. Muchos correos de dominio
 *                  propio solo tienen éste.
 */
async function conectar({ servidor, puerto, seguridad }) {
  // SIN CIFRAR, SOLO CONTRA ESTA MISMA COMPUTADORA.
  //
  // Hay fábricas que tienen su propio repartidor de correo corriendo al
  // lado, y ahí no hay nada que cifrar: el mensaje no sale de la máquina.
  // Fuera de eso NO se permite, y no es una precaución de manual: sin
  // cifrar, la contraseña de la cuenta viaja legible por la red de la
  // fábrica y por la del vecino.
  if (seguridad === 'plano' && !esEstaMaquina(servidor)) {
    const e = new Error('Sin cifrar solo se puede contra esta misma computadora.');
    e.reintentable = false;
    throw e;
  }

  const enClaro = seguridad === 'starttls' || seguridad === 'plano';
  let socket = enClaro
    ? await enchufar(() => net.connect({ host: servidor, port: puerto }))
    : await enchufar(() => tls.connect({ host: servidor, port: puerto, servername: servidor }));

  let charla = conversacion(socket);
  await charla.esperar(220);

  if (seguridad === 'starttls') {
    await charla.decir(`EHLO ${limpio(os.hostname()) || 'fabrica'}`, 250);
    await charla.decir('STARTTLS', 220);
    charla.soltar();
    socket = await enchufar(() => tls.connect({ socket, servername: servidor }));
    charla = conversacion(socket);
  }

  return charla;
}

const esEstaMaquina = (h) =>
  ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(String(h || '').toLowerCase());

/** Abre un socket y espera a que esté listo, o se rinde a los 25 segundos. */
function enchufar(abrir) {
  return new Promise((listo, mal) => {
    const s = abrir();
    const reloj = setTimeout(() => {
      s.destroy();
      mal(reintentable(new Error('El servidor de correo no contestó.')));
    }, ESPERA_MS);

    const bien = () => { clearTimeout(reloj); s.off('error', feo); listo(s); };
    const feo = (e) => { clearTimeout(reloj); s.destroy(); mal(reintentable(e)); };

    s.once(s instanceof tls.TLSSocket ? 'secureConnect' : 'connect', bien);
    s.once('error', feo);
  });
}

/**
 * La conversación: acumula lo que llega y va sirviendo respuestas enteras.
 *
 * Una respuesta de SMTP puede venir en varios renglones ("250-ESTO" y
 * luego "250 AQUELLO"): solo el que lleva ESPACIO después del número es
 * el último. Leer renglón por renglón sin esto es el error clásico que
 * hace que el EHLO parezca haber terminado cuando aún faltaban seis.
 */
function conversacion(socket) {
  let pila = '';
  let esperando = null;
  let muerto = null;

  socket.setEncoding('utf8');
  socket.setTimeout?.(ESPERA_MS);

  const entregar = () => {
    if (!esperando) return;
    const fin = pila.match(/^\d{3} [^\n]*\r?\n/m) ? completa(pila) : null;
    if (fin) {
      const { codigo, texto, resto } = fin;
      pila = resto;
      const quien = esperando; esperando = null;
      quien.listo({ codigo, texto });
    }
  };

  const romper = (e) => {
    muerto = muerto || e;
    const quien = esperando; esperando = null;
    quien?.mal(e);
  };

  socket.on('data', (t) => { pila += t; entregar(); });
  socket.on('error', (e) => romper(reintentable(e)));
  socket.on('timeout', () => { socket.destroy(); romper(reintentable(new Error('El servidor de correo tardó demasiado.'))); });
  socket.on('close', () => romper(reintentable(new Error('El servidor de correo cortó la llamada.'))));

  function esperar(codigoEsperado) {
    return new Promise((listo, mal) => {
      if (muerto) return mal(muerto);
      esperando = {
        listo: ({ codigo, texto }) => {
          if (!codigoEsperado || codigo === codigoEsperado) return listo({ codigo, texto });
          // 4xx es "ahorita no" y 5xx es "así no". Solo el primero se
          // reintenta; repetir un 535 (contraseña mala) mil veces no la
          // arregla y sí acaba con la cuenta bloqueada.
          const e = new Error(`${codigo} ${texto.trim().split('\n')[0]}`);
          e.reintentable = codigo >= 400 && codigo < 500;
          mal(e);
        },
        mal
      };
      entregar();
    });
  }

  return {
    esperar,
    decir(frase, codigoEsperado) {
      if (muerto) return Promise.reject(muerto);
      socket.write(frase + '\r\n');
      return esperar(codigoEsperado);
    },
    soltar() { socket.removeAllListeners('data'); socket.removeAllListeners('close'); },
    cerrar() { try { socket.destroy(); } catch { /* ya estaba cerrado */ } }
  };
}

/** Corta de la pila la primera respuesta completa. */
function completa(pila) {
  const renglones = pila.split(/\r?\n/);
  for (let i = 0; i < renglones.length; i++) {
    if (/^\d{3} /.test(renglones[i])) {
      const usados = renglones.slice(0, i + 1);
      return {
        codigo: Number(renglones[i].slice(0, 3)),
        texto: usados.map((r) => r.slice(4)).join('\n'),
        resto: renglones.slice(i + 1).join('\n')
      };
    }
  }
  return null;
}

function reintentable(e) {
  const err = e instanceof Error ? e : new Error(String(e));
  if (err.reintentable === undefined) err.reintentable = true;
  return err;
}

// ============================================================
// EL CORREO EN SÍ
// ============================================================

/**
 * ARMA EL SOBRE Y LA CARTA.
 *
 * Va en `multipart/alternative`: la misma cosa dos veces, en texto pelón
 * y en HTML, y cada programa de correo enseña la que sepa. El texto no
 * es adorno: un reloj, un correo leído por voz o un filtro de spam ven
 * ese, y un correo que solo trae HTML llega peor.
 */
function armar({ de, deNombre, destinos, asunto, html, texto }) {
  const marca = `lolha-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const dominio = String(de).split('@')[1] || 'localhost';

  const cabeceras = [
    `From: ${deNombre ? `${palabraMime(deNombre)} ` : ''}<${de}>`,
    `To: ${destinos.join(', ')}`,
    `Subject: ${palabraMime(asunto)}`,
    `Date: ${fechaCorreo()}`,
    `Message-ID: <${marca}@${dominio}>`,
    'MIME-Version: 1.0',
    'Auto-Submitted: auto-generated',      // no es una carta: que nadie conteste
    `Content-Type: multipart/alternative; boundary="${marca}"`
  ];

  const partes = [
    `--${marca}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    trocear(base64(texto || quitarEtiquetas(html))),
    `--${marca}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    trocear(base64(html)),
    `--${marca}--`
  ];

  return cabeceras.join('\r\n') + '\r\n\r\n' + partes.join('\r\n');
}

/** Un asunto con acentos se escribe así, o llega hecho garabatos. */
function palabraMime(t) {
  const s = String(t || '');
  return /^[\x20-\x7E]*$/.test(s) ? s : `=?UTF-8?B?${base64(s)}?=`;
}

/** "Thu, 03 Sep 2026 18:30:00 -0500" — el formato que pide el correo. */
function fechaCorreo(d = new Date()) {
  const DIAS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MESES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dos = (n) => String(n).padStart(2, '0');
  const min = -d.getTimezoneOffset();
  const huso = `${min < 0 ? '-' : '+'}${dos(Math.floor(Math.abs(min) / 60))}${dos(Math.abs(min) % 60)}`;
  return `${DIAS[d.getDay()]}, ${dos(d.getDate())} ${MESES[d.getMonth()]} ${d.getFullYear()} ` +
         `${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())} ${huso}`;
}

const base64 = (t) => Buffer.from(String(t ?? ''), 'utf8').toString('base64');

/** El correo no admite renglones larguísimos: se parte de 76 en 76. */
const trocear = (b) => (b.match(/.{1,76}/g) || ['']).join('\r\n');

/** El HTML, en texto leíble, para la parte de texto pelón. */
function quitarEtiquetas(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n').map((r) => r.trim()).join('\n')
    .trim();
}

/** Un nombre de máquina sin cosas raras, para el EHLO. */
const limpio = (t) => String(t || '').replace(/[^A-Za-z0-9.-]/g, '').slice(0, 60);

module.exports = { mandar, armar, fechaCorreo, quitarEtiquetas, esEstaMaquina };
