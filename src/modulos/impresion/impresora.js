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
 * 2. POR SU NOMBRE DE WINDOWS, que sirve para cualquiera que esté
 *    instalada, esté compartida o no:
 *
 *        windows:ch-e80print en 192.168.1.65
 *
 *    Se le entrega el trabajo al motor de impresión de Windows marcado como
 *    RAW, o sea "esto ya viene listo, no lo toques". Es lo que permite que
 *    el usuario solo ELIJA su impresora de una lista en vez de andar
 *    averiguando direcciones.
 *
 * 3. POR NOMBRE COMPARTIDO DE WINDOWS, el camino viejo:
 *
 *        \\localhost\TICKET
 *
 *    Hay que compartir la impresora una vez. Se conserva porque a quien ya
 *    lo tenía funcionando no se le rompe nada.
 *
 * 4. A UN ARCHIVO O UNA CARPETA, para probar sin impresora: el ticket se
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

  // windows:NOMBRE — la impresora tal como la llama Windows. Lleva prefijo
  // porque un nombre suelto no se distingue de una carpeta.
  if (/^windows:/i.test(t)) {
    const nombre = t.slice(t.indexOf(':') + 1).trim();
    return nombre
      ? { tipo: 'windows', nombre, texto: `a la impresora "${nombre}" de Windows` }
      : { tipo: 'ninguno', texto: 'sin configurar' };
  }

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

/**
 * LOS APARTADOS QUE IMPRIMEN.
 *
 * No todo lo que sale por papel es igual: el ticket de una venta y el corte
 * del turno pueden ir a impresoras distintas —una en el mostrador y otra en
 * la oficina—, y en una fábrica con dos cajas eso deja de ser un capricho.
 *
 * Cada apartado puede tener su propia impresora. Vacío quiere decir "la de
 * tickets", que es lo que casi siempre se quiere y evita tener que
 * configurar cuatro cosas para usar una sola.
 */
const APARTADOS = [
  { id: 'venta', nombre: 'Tickets de venta',
    ayuda: 'El ticket que se le da al cliente. También el pulso del cajón.' },
  { id: 'corte', nombre: 'Corte de caja',
    ayuda: 'El papel que se firma al cerrar el turno.' },
  { id: 'gasto', nombre: 'Comprobantes de gasto',
    ayuda: 'El papel que firma quien saca dinero del cajón.' },
  { id: 'conteo', nombre: 'Conteos del cuarto frío',
    ayuda: 'El cuadre de las marquetas, cada vez que se cuenta.' },
  { id: 'produccion', nombre: 'Números a sacar',
    ayuda: 'El papel que se le da al obrero con los paños que le tocan.' }
];

/** Dónde imprime un apartado. Vacío = donde imprimen los tickets. */
function destinoDe(apartado) {
  const propio = ajuste(`impresora_destino_${apartado}`, '').trim();
  return propio || ajuste('impresora_destino', '').trim();
}

/** Cómo está configurada la impresión ahora mismo. */
function configuracion() {
  const destino = ajuste('impresora_destino', '');
  return {
    destino,
    // Qué entendió el sistema de lo que está escrito.
    comoSeManda: tipoDeDestino(destino),
    // Y qué tiene puesto cada apartado. `propia` distingue "tiene la suya"
    // de "usa la de tickets", que en la pantalla se ve muy distinto.
    apartados: APARTADOS.map((a) => {
      const propio = ajuste(`impresora_destino_${a.id}`, '').trim();
      return {
        ...a,
        destino: propio,
        propia: Boolean(propio),
        comoSeManda: tipoDeDestino(propio || destino)
      };
    }),
    anchoMm: Number(ajuste('ticket_ancho_mm', '80')),
    copias: Math.min(Math.max(Number(ajuste('ticket_copias', '1')) || 1, 1), 5),
    pie: ajuste('ticket_pie', ''),
    codigoPagina: Number(ajuste('ticket_codepage', '2')),
    abrirCajon: ajuste('ticket_abrir_cajon', '0') === '1',
    // Por cuál de las dos salidas del conector se manda el pulso. Casi
    // todos los cajones van en la 2; si no abre, se prueba la 5.
    salidaCajon: Number(ajuste('ticket_cajon_salida', '2')) === 5 ? 5 : 2,
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
async function imprimirCrudo(bytes, opciones = {}) {
  const destino = destinoDe(opciones.seccion || 'venta');
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

    // ---- POR EL NOMBRE DE WINDOWS, O POR NOMBRE COMPARTIDO ----
    const temporal = path.join(os.tmpdir(), `lolha-${process.pid}-${Date.now()}.bin`);
    try {
      fs.writeFileSync(temporal, bytes);
      if (como.tipo === 'windows') {
        await mandarPorNombreDeWindows(temporal, como.nombre);
        return { impreso: true, motivo: 'windows', como };
      }
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

/**
 * MANDARLE EL TICKET A UNA IMPRESORA POR SU NOMBRE DE WINDOWS.
 *
 * Se le entrega el trabajo al motor de impresión marcado como RAW, que
 * quiere decir "esto ya son los bytes finales, no los conviertas". Es lo
 * mismo que hace `copy /b` a un nombre compartido, pero sin obligar a
 * compartir nada: basta con que la impresora esté instalada.
 *
 * Se hace desde PowerShell porque Node no puede llamar a winspool.drv por
 * su cuenta. El guion se escribe en un archivo temporal en vez de pasarlo
 * por la línea de comandos: son cincuenta líneas de C# y meterlas en un
 * argumento es pedir que un día una comilla lo rompa.
 */
function mandarPorNombreDeWindows(archivo, nombre, milisegundos = 15000) {
  return new Promise((resolver, rechazar) => {
    if (process.platform !== 'win32') {
      return rechazar(new Error('Imprimir por el nombre de Windows solo funciona en Windows.'));
    }

    const guion = path.join(os.tmpdir(), `lolha-imp-${process.pid}-${Date.now()}.ps1`);
    try { fs.writeFileSync(guion, GUION_RAW, 'utf8'); }
    catch (e) { return rechazar(new Error(`No se pudo preparar la impresión: ${e.message}`)); }

    const p = spawn('powershell', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', guion, nombre, archivo
    ], { windowsHide: true });

    let salida = '';
    const limpiar = () => { try { fs.unlinkSync(guion); } catch { /* ya no está */ } };
    const reloj = setTimeout(() => {
      p.kill();
      limpiar();
      rechazar(new Error(`Windows no terminó de mandarle el ticket a "${nombre}".`));
    }, milisegundos);

    p.stdout.on('data', (d) => { salida += d.toString(); });
    p.stderr.on('data', (d) => { salida += d.toString(); });
    p.on('error', (e) => { clearTimeout(reloj); limpiar(); rechazar(e); });
    p.on('close', (codigo) => {
      clearTimeout(reloj);
      limpiar();
      if (codigo === 0) return resolver();
      rechazar(new Error(
        salida.trim().split('\n').pop() ||
        `Windows no pudo mandarle el ticket a "${nombre}". ¿Sigue instalada?`));
    });
  });
}

/**
 * El guion de PowerShell que entrega los bytes al motor de impresión.
 *
 * Es C# de toda la vida llamando a winspool.drv: abrir la impresora,
 * empezar un documento RAW, escribir los bytes, cerrar. Está aquí como
 * texto porque es lo único de este programa que no se puede escribir en
 * JavaScript, y esconderlo en otro archivo sería esconderlo.
 */
const GUION_RAW = `
param([string]$Impresora, [string]$Archivo)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;
public class LolhaRaw {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  [DllImport("winspool.Drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint = "ClosePrinter")]
  static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFO di);
  [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter")]
  static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter")]
  static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter")]
  static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true)]
  static extern bool WritePrinter(IntPtr hPrinter, IntPtr bytes, int count, out int written);

  public static void Mandar(string impresora, string archivo) {
    byte[] datos = File.ReadAllBytes(archivo);
    IntPtr h;
    if (!OpenPrinter(impresora, out h, IntPtr.Zero))
      throw new Exception("Windows no pudo abrir esa impresora: " + impresora);
    try {
      DOCINFO di = new DOCINFO();
      di.pDocName = "Ticket Hielo LOLHA";
      di.pDataType = "RAW";
      if (!StartDocPrinter(h, 1, di)) throw new Exception("Windows no aceptó el trabajo de impresion.");
      try {
        if (!StartPagePrinter(h)) throw new Exception("Windows no aceptó la pagina.");
        IntPtr buffer = Marshal.AllocCoTaskMem(datos.Length);
        try {
          Marshal.Copy(datos, 0, buffer, datos.Length);
          int escritos;
          if (!WritePrinter(h, buffer, datos.Length, out escritos))
            throw new Exception("Windows no pudo escribirle a la impresora.");
        } finally { Marshal.FreeCoTaskMem(buffer); }
        EndPagePrinter(h);
      } finally { EndDocPrinter(h); }
    } finally { ClosePrinter(h); }
  }
}
"@
[LolhaRaw]::Mandar($Impresora, $Archivo)
`;

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
  // Si su puerto es una dirección de red, esa dirección: es el camino más
  // corto y no depende ni del driver ni del motor de impresión.
  const ip = String(i.PortName || '').match(/(\d{1,3}(?:\.\d{1,3}){3})/);
  if (ip) return ip[1];

  // Y si no, por su nombre de Windows. Sirve para cualquiera que esté
  // instalada —USB incluida— sin tener que compartir nada, que era el paso
  // que hacía que la gente se rindiera.
  return i.Name ? `windows:${i.Name}` : null;
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
  tipoDeDestino, impresorasDeWindows, destinoDe, APARTADOS
};
