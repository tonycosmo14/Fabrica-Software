/**
 * MANDAR LOS BYTES A LA IMPRESORA  (v0.11, por red desde la v2.0.1)
 *
 * Aquí es donde el ticket deja de ser datos y se vuelve papel. Hay tres
 * caminos, y el sistema elige solo según lo que esté escrito en el destino.
 *
 * 1. POR RED, que es el bueno cuando la impresora tiene su propia IP:
 *
 *        192.168.1.65        (se le pone el puerto 9100 solo)
 *        192.168.1.65:9100
 *
 *    Se le abre un socket y se le escriben los bytes. Punto. No hace falta
 *    compartir nada, ni que Windows tenga instalado el driver, ni siquiera
 *    que sea Windows: la impresora escucha en el 9100 y con eso basta. Es
 *    como hablan todas las térmicas de red desde hace treinta años.
 *
 * 2. POR NOMBRE COMPARTIDO DE WINDOWS, para las de USB:
 *
 *        \\localhost\TICKET
 *
 *    Hay que compartir la impresora una vez. No es para que la usen otras
 *    PC: es para que Windows le dé un nombre al que se le puede escribir
 *    directo, saltándose el motor de impresión.
 *
 * 3. A UN ARCHIVO O UNA CARPETA, para probar sin impresora: el ticket se
 *    guarda en bytes y se puede abrir para ver qué habría salido.
 *
 * Si el destino no está configurado, no se imprime en el servidor y la
 * pantalla lo resuelve como pueda (el navegador). Nunca se rompe la venta
 * por un problema de impresora.
 */
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { bd } = require('../../db/conexion');
const { ahora } = require('../../lib/ids');

/** Lee un ajuste de la tabla de configuración. */
function ajuste(clave, porOmision = '') {
  const fila = bd.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(clave);
  return fila?.valor ?? porOmision;
}

function guardarAjuste(clave, valor, usuarioId) {
  bd.prepare(`
    INSERT INTO configuracion (clave, valor, actualizado_en, actualizado_por)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor,
      actualizado_en = excluded.actualizado_en, actualizado_por = excluded.actualizado_por
  `).run(clave, String(valor), ahora(), usuarioId || null);
}

/**
 * QUÉ CLASE DE DESTINO ES LO QUE ESTÁ ESCRITO.
 *
 * Se decide leyendo el texto, sin preguntarle nada a nadie, y la pantalla
 * enseña el resultado: que el usuario vea "voy a mandarlo por red a
 * 192.168.1.65:9100" es la mitad de poder arreglarlo cuando no sale.
 */
function tipoDeDestino(destino) {
  const t = String(destino || '').trim();
  if (!t) return { tipo: 'ninguno', texto: 'sin configurar' };

  if (t.startsWith('\\\\')) {
    return { tipo: 'compartida', nombre: t, texto: `nombre compartido de Windows (${t})` };
  }
  if (/^(LPT|COM)\d/i.test(t)) {
    return { tipo: 'puerto', nombre: t, texto: `puerto ${t}` };
  }

  // Una IP, con o sin puerto. También un nombre de red si trae puerto:
  // "impresora:9100". Un nombre suelto NO, porque sería confundir una
  // carpeta llamada "tickets" con una máquina llamada "tickets".
  const red = t.match(/^([a-zA-Z0-9][a-zA-Z0-9.\-]*)(?::(\d{1,5}))?$/);
  const esIP = red && /^\d{1,3}(\.\d{1,3}){3}$/.test(red[1]);
  if (red && (esIP || red[2])) {
    const puerto = Number(red[2] || 9100);
    return { tipo: 'red', host: red[1], puerto, texto: `por red a ${red[1]}:${puerto}` };
  }

  return { tipo: 'archivo', ruta: t, texto: `a un archivo (${t})` };
}

/** Cómo está configurada la impresión ahora mismo. */
function configuracion() {
  const destino = ajuste('impresora_destino', '');
  return {
    destino,
    // Qué entendió el sistema de lo que está escrito.
    comoSeManda: tipoDeDestino(destino),
    anchoMm: Number(ajuste('ticket_ancho_mm', '80')),
    copias: Math.min(Math.max(Number(ajuste('ticket_copias', '1')) || 1, 1), 5),
    pie: ajuste('ticket_pie', ''),
    codigoPagina: Number(ajuste('ticket_codepage', '2')),
    abrirCajon: ajuste('ticket_abrir_cajon', '0') === '1',
    // Sin destino, el servidor no imprime y la pantalla usa el navegador.
    directa: Boolean(ajuste('impresora_destino', ''))
  };
}

/**
 * Manda los bytes al destino.
 *
 * Devuelve { impreso, motivo }. NUNCA lanza: una impresora apagada no puede
 * tumbar una venta que ya se cobró.
 */
async function imprimirCrudo(bytes) {
  const destino = ajuste('impresora_destino', '').trim();
  const como = tipoDeDestino(destino);
  if (como.tipo === 'ninguno') return { impreso: false, motivo: 'sin-destino' };

  try {
    // ---- POR RED ----
    // Ni archivo temporal ni cmd de por medio: se le escriben los bytes a
    // la impresora y ya. Es el camino más corto y el que menos se rompe.
    if (como.tipo === 'red') {
      await mandarPorRed(bytes, como.host, como.puerto);
      return { impreso: true, motivo: 'red', como };
    }

    // ---- A UN ARCHIVO O CARPETA ----
    if (como.tipo === 'archivo') {
      const esCarpeta = fs.existsSync(como.ruta) && fs.statSync(como.ruta).isDirectory();
      const salida = esCarpeta
        ? path.join(como.ruta, `ticket-${Date.now()}.bin`)
        : como.ruta;
      fs.appendFileSync(salida, bytes);
      return { impreso: true, motivo: 'archivo', como };
    }

    // ---- POR NOMBRE COMPARTIDO O PUERTO DE WINDOWS ----
    const temporal = path.join(os.tmpdir(), `lolha-${process.pid}-${Date.now()}.bin`);
    try {
      fs.writeFileSync(temporal, bytes);
      await copiarCrudo(temporal, destino);
      return { impreso: true, motivo: 'impresora', como };
    } finally {
      try { fs.unlinkSync(temporal); } catch { /* ya no está */ }
    }
  } catch (e) {
    return { impreso: false, motivo: e.message, como };
  }
}

/**
 * MANDARLE LOS BYTES A UNA IMPRESORA DE RED.
 *
 * El puerto 9100 es "RAW": lo que entra por ahí se imprime tal cual. La
 * impresora no contesta nada, así que se da por bueno cuando los bytes
 * salieron y se cerró la conexión.
 *
 * Con reloj, y corto: una impresora apagada no puede dejar colgada una
 * venta que ya se cobró. Ocho segundos y se avisa.
 */
function mandarPorRed(bytes, host, puerto, milisegundos = 8000) {
  return new Promise((resolver, rechazar) => {
    let enviado = false;
    let terminado = false;

    const acabar = (error) => {
      if (terminado) return;
      terminado = true;
      socket.destroy();
      if (error) rechazar(error); else resolver();
    };

    const socket = net.connect({ host, port: puerto });
    socket.setTimeout(milisegundos);

    socket.on('connect', () => {
      socket.write(bytes, () => { enviado = true; socket.end(); });
    });

    socket.on('timeout', () => acabar(new Error(
      `${host}:${puerto} no contesta. Revisa que la impresora esté encendida ` +
      'y conectada a la misma red.')));

    socket.on('error', (e) => acabar(new Error(explicarRed(e, host, puerto))));

    socket.on('close', () => acabar(enviado ? null : new Error(
      `${host}:${puerto} cortó la conexión antes de recibir el ticket.`)));
  });
}

/** El error de red, dicho como para arreglarlo, no como lo dice Node. */
function explicarRed(e, host, puerto) {
  switch (e.code) {
    case 'ECONNREFUSED':
      return `${host} está ahí, pero no acepta nada en el puerto ${puerto}. ` +
             'Casi siempre el puerto correcto es el 9100.';
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
      return `No se llega a ${host} desde esta computadora. ` +
             '¿Está en la misma red que la impresora?';
    case 'ETIMEDOUT':
      return `${host}:${puerto} no contesta. ¿Está encendida?`;
    case 'ENOTFOUND':
      return `No se encuentra "${host}" en la red. Escribe su dirección IP.`;
    default:
      return `No se pudo mandar el ticket a ${host}:${puerto}: ${e.message}`;
  }
}

/**
 * LAS IMPRESORAS QUE VE WINDOWS.
 *
 * Para no tener que adivinar el nombre ni la IP: se le pregunta a Windows y
 * la pantalla las ofrece para tocarlas. El puerto de una impresora de red
 * suele ser su propia dirección, que es justo lo que hay que escribir aquí.
 *
 * Fuera de Windows devuelve una lista vacía sin quejarse.
 */
function impresorasDeWindows(milisegundos = 6000) {
  return new Promise((resolver) => {
    if (process.platform !== 'win32') return resolver([]);

    const p = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command',
      'Get-Printer | Select-Object Name,ShareName,PortName | ConvertTo-Json -Compress'],
      { windowsHide: true });

    let salida = '';
    const reloj = setTimeout(() => { p.kill(); resolver([]); }, milisegundos);

    p.stdout.on('data', (d) => { salida += d.toString(); });
    p.on('error', () => { clearTimeout(reloj); resolver([]); });
    p.on('close', () => {
      clearTimeout(reloj);
      try {
        const crudo = JSON.parse(salida.trim() || '[]');
        const lista = Array.isArray(crudo) ? crudo : [crudo];
        resolver(lista.map((i) => ({
          nombre: i.Name || '',
          compartida: i.ShareName || null,
          puerto: i.PortName || null,
          // Lo que habría que escribir en el destino, ya masticado.
          sugerencia: sugerirDestino(i)
        })).filter((i) => i.nombre));
      } catch { resolver([]); }
    });
  });
}

/**
 * Qué escribirle al sistema para esa impresora.
 *
 * Si su puerto es una dirección de red, esa dirección es la respuesta: es
 * el camino corto y no depende de que nadie comparta nada. Si no, y está
 * compartida, su nombre compartido.
 */
function sugerirDestino(i) {
  const puerto = String(i.PortName || '');
  const ip = puerto.match(/(\d{1,3}(?:\.\d{1,3}){3})/);
  if (ip) return ip[1];
  if (i.ShareName) return `\\\\localhost\\${i.ShareName}`;
  return null;
}

/** copy /b archivo destino — la forma de Windows de escribir bytes crudos. */
function copiarCrudo(archivo, destino) {
  return new Promise((resolver, rechazar) => {
    if (process.platform !== 'win32') {
      return rechazar(new Error('La impresión directa a un nombre compartido solo funciona en Windows.'));
    }
    const p = spawn('cmd', ['/c', 'copy', '/b', archivo, destino], { windowsHide: true });
    let salida = '';
    p.stderr.on('data', (d) => { salida += d.toString(); });
    p.on('error', rechazar);
    p.on('close', (codigo) => {
      if (codigo === 0) resolver();
      else rechazar(new Error(salida.trim() || `No se pudo escribir en ${destino}.`));
    });
  });
}

module.exports = {
  configuracion, ajuste, guardarAjuste, imprimirCrudo,
  tipoDeDestino, impresorasDeWindows
};
