/**
 * CÓMO SE VE UN AVISO  (v4.9)
 *
 * Un correo no se dibuja como una página web. Los programas de correo se
 * quedaron veinte años atrás: no entienden hojas de estilo aparte, ni
 * flexbox, ni casi nada. Así que aquí todo va con TABLAS y con el estilo
 * escrito en cada etiqueta, que es feo de escribir y es lo único que se
 * ve igual en Gmail, en el correo del teléfono y en Outlook.
 *
 * La forma es siempre la misma, y es la del ticket: un título grande, el
 * número importante en grande, y debajo los renglones. Quien lo abre en
 * el teléfono tiene que entender qué pasó SIN hacer scroll.
 */
const { formato } = require('../../lib/dinero');

const AZUL = '#0f4c75';
const GRIS = '#5b6b78';
const BORDE = '#dde5ea';
const ROJO = '#b3261e';
const VERDE = '#1c7a4a';
const AMBAR = '#a86a00';

const COLORES = { rojo: ROJO, verde: VERDE, ambar: AMBAR, azul: AZUL, gris: GRIS };

/**
 * ARMA EL CORREO ENTERO.
 *
 *   titulo     — de qué se trata, en grande
 *   entradilla — una frase que lo explica
 *   grande     — el número que importa, si hay uno (y su color)
 *   renglones  — [[etiqueta, valor], …]  o  { titulo, filas }
 *   nota       — la letra chiquita del final
 */
function correo({ negocio, titulo, entradilla, grande, color, renglones = [], nota, cuando }) {
  const bloques = [];

  if (entradilla) {
    bloques.push(`<p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#22303a">
      ${entradilla}</p>`);
  }

  if (grande) {
    bloques.push(`<p style="margin:0 0 16px;font-size:32px;font-weight:700;
      line-height:1.1;color:${COLORES[color] || AZUL}">${grande}</p>`);
  }

  for (const grupo of agrupar(renglones)) {
    if (grupo.titulo) {
      bloques.push(`<p style="margin:18px 0 6px;font-size:12px;font-weight:700;
        letter-spacing:.06em;text-transform:uppercase;color:${GRIS}">${grupo.titulo}</p>`);
    }
    bloques.push(tabla(grupo.filas));
  }

  if (nota) {
    bloques.push(`<p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:${GRIS}">
      ${nota}</p>`);
  }

  return envoltura({ negocio, titulo, cuando, dentro: bloques.join('\n') });
}

/** Los renglones, en dos columnas: qué y cuánto. */
function tabla(filas) {
  const utiles = filas.filter(Array.isArray);
  if (!utiles.length) return '';

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="border-collapse:collapse;width:100%">
    ${utiles.map(([que, cuanto, tono]) => `
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid ${BORDE};font-size:15px;
                   color:#22303a">${que}</td>
        <td style="padding:9px 0;border-bottom:1px solid ${BORDE};font-size:15px;
                   text-align:right;font-weight:700;white-space:nowrap;
                   color:${COLORES[tono] || '#22303a'}">${cuanto ?? ''}</td>
      </tr>`).join('')}
  </table>`;
}

/**
 * Acepta las tres formas: una lista pelona de filas, una lista de grupos
 * con su título, y las dos MEZCLADAS —unas filas sueltas arriba y grupos
 * debajo—, que es lo que quiere el correo del corte: los tres números del
 * cuadre y luego el desglose de gastos con su encabezado.
 */
function agrupar(renglones) {
  const grupos = [];
  let sueltas = null;

  for (const r of renglones.filter(Boolean)) {
    if (Array.isArray(r)) {
      if (!sueltas) { sueltas = { titulo: null, filas: [] }; grupos.push(sueltas); }
      sueltas.filas.push(r);
    } else {
      sueltas = null;
      grupos.push({ titulo: r.titulo || null, filas: (r.filas || []).filter(Array.isArray) });
    }
  }
  return grupos.filter((g) => g.filas.length);
}

/** El marco: el nombre de la fábrica arriba y la letra chiquita abajo. */
function envoltura({ negocio, titulo, cuando, dentro }) {
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#eef3f6">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="border-collapse:collapse;background:#eef3f6">
    <tr><td align="center" style="padding:22px 12px">

      <table role="presentation" width="560" cellpadding="0" cellspacing="0"
             style="border-collapse:collapse;width:100%;max-width:560px;
                    background:#ffffff;border-radius:14px;overflow:hidden;
                    font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif">

        <tr><td style="background:${AZUL};padding:16px 24px">
          <span style="color:#ffffff;font-size:16px;font-weight:700">
            ${escapar(negocio || 'La fábrica')}</span>
        </td></tr>

        <tr><td style="padding:22px 24px 26px">
          <h1 style="margin:0 0 4px;font-size:20px;line-height:1.25;color:#0b1e2a">
            ${titulo}</h1>
          ${cuando ? `<p style="margin:0 0 16px;font-size:13px;color:${GRIS}">
            ${escapar(cuando)}</p>` : '<div style="height:12px"></div>'}
          ${dentro}
        </td></tr>

        <tr><td style="padding:14px 24px 20px;border-top:1px solid ${BORDE}">
          <p style="margin:0;font-size:12px;line-height:1.5;color:${GRIS}">
            Este aviso lo manda solo el sistema de la fábrica. No hace falta
            contestarlo.<br>
            Para dejar de recibirlo: <b>Sistema › Avisos por correo</b>.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** El texto que viene de la fábrica puede traer &, < o comillas. */
function escapar(t) {
  return String(t ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** El dinero, ya escapado, para meterlo en un renglón. */
const dinero = (centavos) => escapar(formato(centavos));

module.exports = { correo, escapar, dinero };
