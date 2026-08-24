/**
 * FRACCIONES EN PANTALLA  (v0.8)
 *
 * La misma regla de oro 3.1 que en el servidor, pero del lado del navegador:
 * todo se cuenta en DIECISEISAVOS ENTEROS. Aquí nunca hay decimales.
 *
 * La gente de la fábrica no dice "14.625 marquetas": dice
 * "quedan 14 marquetas y 5/8". Este archivo es el único lugar del frente
 * autorizado a traducir entre esas dos formas de hablar.
 *
 * Exporta dos cosas:
 *   · las conversiones (aTexto, deTexto, aMarquetas...)
 *   · el TECLADO, que es el mismo control que se usa para contar el cuarto
 *     frío y para cobrar en el punto de venta. Un solo control, aprendido
 *     una sola vez.
 */

export const POR_MARQUETA = 16;

/** Los botones del teclado, de mayor a menor (sección 7.1 del plan). */
export const FRACCIONES = [
  { etiqueta: '1',    dieciseisavos: 16 },
  { etiqueta: '1/2',  dieciseisavos: 8 },
  { etiqueta: '1/4',  dieciseisavos: 4 },
  { etiqueta: '1/8',  dieciseisavos: 2 },
  { etiqueta: '1/16', dieciseisavos: 1 }
];

function mcd(a, b) { return b === 0 ? a : mcd(b, a % b); }

/**
 * Dieciseisavos a texto de fábrica.
 *   0   -> "0"
 *   6   -> "3/8"
 *   16  -> "1"
 *   234 -> "14 5/8"
 */
export function aTexto(dieciseisavos) {
  const n = Math.trunc(Number(dieciseisavos) || 0);
  if (n === 0) return '0';

  const signo = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const enteros = Math.floor(abs / POR_MARQUETA);
  const resto = abs % POR_MARQUETA;

  if (resto === 0) return `${signo}${enteros}`;

  const d = mcd(resto, POR_MARQUETA);
  const fraccion = `${resto / d}/${POR_MARQUETA / d}`;
  return enteros === 0 ? `${signo}${fraccion}` : `${signo}${enteros} ${fraccion}`;
}

/** Lo mismo pero diciendo la unidad: "14 5/8 marquetas". */
export function aTextoLargo(dieciseisavos) {
  const n = Math.trunc(Number(dieciseisavos) || 0);
  return `${aTexto(n)} ${Math.abs(n) === POR_MARQUETA ? 'marqueta' : 'marquetas'}`;
}

/** Marquetas enteras que hay dentro de una cantidad. */
export function marquetasEnteras(dieciseisavos) {
  return Math.floor(Math.abs(dieciseisavos) / POR_MARQUETA) * Math.sign(dieciseisavos || 1);
}

/** Los dieciseisavos sueltos que sobran de las marquetas enteras. */
export function resto(dieciseisavos) {
  return Math.abs(dieciseisavos) % POR_MARQUETA;
}

/**
 * Lee lo que alguien escribió a mano y lo convierte a dieciseisavos.
 * Acepta las formas en las que de verdad se dicta el conteo:
 *
 *   "14"        -> 224
 *   "14 5/8"    -> 234
 *   "5/8"       -> 10
 *   "14 y 5/8"  -> 234
 *   "30 11/16"  -> 491
 *
 * Devuelve null si no se entiende. Nunca adivina.
 */
export function deTexto(texto) {
  const limpio = String(texto ?? '').trim().toLowerCase().replace(/\s+y\s+/g, ' ');
  if (!limpio) return null;

  const m = limpio.match(/^(?:(\d+))?\s*(?:(\d+)\s*\/\s*(\d+))?$/);
  if (!m || (!m[1] && !m[2])) return null;

  const enteros = m[1] ? Number(m[1]) : 0;
  let fraccion = 0;

  if (m[2]) {
    const arriba = Number(m[2]);
    const abajo = Number(m[3]);
    // Solo denominadores que existen físicamente: la marqueta se parte en dos
    // hasta el dieciseisavo. Un 1/3 de marqueta no se puede cortar.
    if (![1, 2, 4, 8, 16].includes(abajo)) return null;
    if (arriba >= abajo) return null;
    fraccion = arriba * (POR_MARQUETA / abajo);
  }

  return enteros * POR_MARQUETA + fraccion;
}

/**
 * Parte una cantidad en las fracciones más grandes posibles.
 * Es la MISMA descomposición que usa el servidor para cobrar, así que lo
 * que la pantalla muestra y lo que la caja cobra siempre coinciden.
 */
export function descomponer(dieciseisavos) {
  let queda = Math.trunc(dieciseisavos);
  const partes = [];
  for (const paso of [16, 8, 4, 2, 1]) {
    while (queda >= paso) { partes.push(paso); queda -= paso; }
  }
  return partes;
}

/** El desglose escrito: "14x1 + 1/2 + 1/8". Es como se forma el precio. */
export function desglose(dieciseisavos) {
  const cuenta = new Map();
  for (const parte of descomponer(dieciseisavos)) {
    cuenta.set(parte, (cuenta.get(parte) || 0) + 1);
  }
  return [...cuenta.entries()]
    .map(([parte, veces]) => (veces > 1 ? `${veces}×${aTexto(parte)}` : aTexto(parte)))
    .join(' + ');
}

/** Pesos a partir de centavos, con formato mexicano. */
export function pesos(centavos) {
  const n = Number(centavos) || 0;
  // SIN DECIMALES CUANDO SON CERO. En la fábrica todo se cobra en pesos
  // enteros —$264, $70, $36— y ese ".00" repetido en cada renglón solo
  // ensucia. Pero si un número SÍ trae centavos se enseñan completos: es
  // preferible un renglón más largo a decirle al cliente un número que no
  // es el suyo.
  const cerrados = n % 100 === 0;
  return (n / 100).toLocaleString('es-MX', {
    style: 'currency', currency: 'MXN',
    minimumFractionDigits: cerrados ? 0 : 2,
    maximumFractionDigits: 2
  });
}

/**
 * El mismo importe, pero para ESCRIBIRLO en un campo: sin el signo, sin
 * las comas de los miles y sin el ".00" cuando son pesos redondos.
 *
 *   26400 -> "264"      1250 -> "12.50"      null -> ""
 */
export function paraEditar(centavos) {
  if (centavos === null || centavos === undefined || centavos === '') return '';
  const n = Number(centavos) || 0;
  return n % 100 === 0 ? String(n / 100) : (n / 100).toFixed(2);
}

// ============================================================
// EL TECLADO
// ============================================================

/**
 * Crea el teclado de cantidades y lo mete dentro de un elemento.
 *
 * Funciona sumando: se toca 1/2 y luego 1/8 y queda 5/8. Cuando los
 * pedacitos completan una marqueta, sube solo al contador de marquetas.
 * Así se teclea igual que se dicta.
 *
 *   const teclado = crearTeclado(caja, { valor: 224, alCambiar: (n) => ... });
 *   teclado.valor()   -> dieciseisavos
 *   teclado.poner(0)  -> lo deja en cero
 *
 * opciones:
 *   valor      cantidad inicial en dieciseisavos
 *   max        tope en dieciseisavos (por defecto 100 000 marquetas)
 *   alCambiar  se llama con los dieciseisavos cada vez que cambia
 *   nota       texto chico bajo el número (por ejemplo el precio)
 *   marquetas  false para esconder el contador de marquetas enteras
 */
export function crearTeclado(contenedor, opciones = {}) {
  const max = opciones.max ?? 100000 * POR_MARQUETA;
  const conMarquetas = opciones.marquetas !== false;
  let n = Math.min(Math.max(Math.trunc(opciones.valor || 0), 0), max);

  contenedor.innerHTML = `
    <div class="teclado-frac">
      <div class="frac-visor">
        <strong class="frac-numero">${aTexto(n)}</strong>
        <small class="frac-unidad">marquetas</small>
        <div class="frac-nota"></div>
      </div>

      ${conMarquetas ? `
        <div class="frac-enteras">
          <button type="button" class="contador-boton" data-menos aria-label="Una marqueta menos">−</button>
          <input class="frac-campo" inputmode="numeric" aria-label="Marquetas enteras" value="0">
          <button type="button" class="contador-boton" data-mas aria-label="Una marqueta más">＋</button>
        </div>
        <p class="frac-ayuda">marquetas enteras · abajo los pedazos</p>` : ''}

      <div class="frac-botones">
        ${FRACCIONES.map((f) => `
          <button type="button" class="frac-boton" data-suma="${f.dieciseisavos}">${f.etiqueta}</button>
        `).join('')}
      </div>

      <div class="frac-acciones">
        <button type="button" class="secundario chico" data-quitar>‹ Quitar 1/16</button>
        <button type="button" class="secundario chico" data-limpiar>Borrar todo</button>
      </div>
    </div>`;

  const visor = contenedor.querySelector('.frac-numero');
  const unidad = contenedor.querySelector('.frac-unidad');
  const nota = contenedor.querySelector('.frac-nota');
  const campo = conMarquetas ? contenedor.querySelector('.frac-campo') : null;

  function pintar(avisa = true) {
    visor.textContent = aTexto(n);
    unidad.textContent = n === POR_MARQUETA ? 'marqueta' : 'marquetas';
    if (campo && document.activeElement !== campo) {
      campo.value = Math.floor(n / POR_MARQUETA);
    }
    if (avisa && opciones.alCambiar) opciones.alCambiar(n);
  }

  function fijar(nuevo) {
    n = Math.min(Math.max(Math.trunc(nuevo), 0), max);
    pintar();
  }

  contenedor.querySelectorAll('[data-suma]').forEach((b) => {
    b.onclick = () => fijar(n + Number(b.dataset.suma));
  });
  contenedor.querySelector('[data-quitar]').onclick = () => fijar(n - 1);
  contenedor.querySelector('[data-limpiar]').onclick = () => fijar(0);

  if (campo) {
    contenedor.querySelector('[data-menos]').onclick = () => fijar(n - POR_MARQUETA);
    contenedor.querySelector('[data-mas]').onclick = () => fijar(n + POR_MARQUETA);
    campo.oninput = () => {
      const enteras = Number(campo.value.replace(/[^0-9]/g, ''));
      if (!Number.isFinite(enteras)) return;
      fijar(enteras * POR_MARQUETA + resto(n));
    };
    campo.onblur = () => pintar(false);
  }

  pintar(false);

  return {
    valor: () => n,
    poner: (v) => fijar(v),
    /** Texto chico bajo el número: se usa para el precio en vivo. */
    decir: (texto) => { nota.innerHTML = texto || ''; }
  };
}
