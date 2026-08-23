/**
 * MANDAR LOS BYTES A LA IMPRESORA  (v0.11)
 *
 * Aquí es donde el ticket deja de ser datos y se vuelve papel.
 *
 * En Windows la forma de mandarle bytes crudos a una impresora sin
 * instalar nada es copiarlos a su nombre compartido:
 *
 *     copy /b ticket.bin \\localhost\TICKET
 *
 * Por eso hay que compartir la impresora una vez (clic derecho →
 * Propiedades de impresora → Compartir → nombre corto y sin espacios). No
 * es para que la usen otras PC: es para que Windows le dé un nombre al que
 * se le puede escribir directo, saltándose el motor de impresión.
 *
 * Si el destino no está configurado, no se imprime en el servidor y la
 * pantalla lo resuelve como pueda (el navegador). Nunca se rompe la venta
 * por un problema de impresora.
 */
const fs = require('node:fs');
const os = require('node:os');
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

/** Cómo está configurada la impresión ahora mismo. */
function configuracion() {
  return {
    destino: ajuste('impresora_destino', ''),
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
  if (!destino) return { impreso: false, motivo: 'sin-destino' };

  const temporal = path.join(os.tmpdir(), `lolha-${process.pid}-${Date.now()}.bin`);

  try {
    fs.writeFileSync(temporal, bytes);

    // Un destino que es una carpeta o un archivo sirve para probar sin
    // impresora: se guarda el ticket y se puede abrir para ver qué salió.
    if (!destino.startsWith('\\\\') && !/^(LPT|COM)\d/i.test(destino)) {
      const esCarpeta = fs.existsSync(destino) && fs.statSync(destino).isDirectory();
      const salida = esCarpeta
        ? path.join(destino, `ticket-${Date.now()}.bin`)
        : destino;
      fs.appendFileSync(salida, bytes);
      return { impreso: true, motivo: 'archivo' };
    }

    await copiarCrudo(temporal, destino);
    return { impreso: true, motivo: 'impresora' };
  } catch (e) {
    return { impreso: false, motivo: e.message };
  } finally {
    try { fs.unlinkSync(temporal); } catch { /* ya no está */ }
  }
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

module.exports = { configuracion, ajuste, guardarAjuste, imprimirCrudo };
