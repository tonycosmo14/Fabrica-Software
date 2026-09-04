/**
 * DIÁLOGOS DEL SISTEMA
 *
 * Sustituyen a los prompt() y confirm() del navegador, que son feos, no
 * respetan los colores de la marca y en el celular salen como una alerta
 * del sistema.
 *
 * En celular aparecen desde abajo (hoja); en PC, centrados.
 * Todos devuelven una promesa: se usan con await.
 */
import { crearTeclado, aTexto, deTexto } from './fracciones.js';
import { svgDeQr } from './imprimir.js';

function cerrar(caja) {
  caja.classList.remove('abierto');
  setTimeout(() => caja.remove(), 160);
}

/**
 * Monta el diálogo y devuelve { caja, salir }.
 *
 * salir(valor) cierra y resuelve la promesa UNA sola vez: si el usuario
 * elige una opción y además se dispara el cierre del fondo, la primera
 * llamada manda y las demás se ignoran.
 */
function montar(contenido, resolver, valorAlCancelar = null) {
  const caja = document.createElement('div');
  caja.className = 'dialogo';
  caja.innerHTML = `<div class="dialogo-fondo"></div><div class="dialogo-hoja">${contenido}</div>`;
  document.body.appendChild(caja);

  // Un cuadro de animación para que la transición de entrada se vea.
  requestAnimationFrame(() => caja.classList.add('abierto'));

  let resuelto = false;
  const escape = (ev) => { if (ev.key === 'Escape') salir(valorAlCancelar); };

  function salir(valor) {
    if (resuelto) return;
    resuelto = true;
    document.removeEventListener('keydown', escape);
    cerrar(caja);
    resolver(valor);
  }

  caja.querySelector('.dialogo-fondo').onclick = () => salir(valorAlCancelar);
  document.addEventListener('keydown', escape);

  return { caja, salir };
}

/**
 * UN DIÁLOGO PROPIO, para las pantallas que arman el suyo  (v5.7.1).
 *
 * Devuelve { caja, salir, hecho }, y con eso se llevan lo que ningún
 * diálogo hecho a mano trae solo: Esc lo cierra, tocar el fondo lo cierra
 * y `salir` resuelve una sola vez. Antes había pantallas que pegaban su
 * propio <div class="dialogo"> a la página y ahí Esc no hacía nada.
 *
 *
 *   const d = armarDialogo(html);
 *   d.caja.querySelector('#si').onclick = () => d.salir(valor);
 *   const valor = await d.hecho;      // null si canceló con Esc o el fondo
 */
export function armarDialogo(contenido) {
  let salir;
  let caja;
  const hecho = new Promise((resolver) => {
    ({ caja, salir } = montar(contenido, resolver));
  });
  return { caja, salir, hecho };
}

/**
 * UNA CONTRASEÑA O UN PIN NUEVOS, ESCRITOS DOS VECES  (v5.7.1)
 *
 * Antes se pedían con el `prompt()` pelón del navegador: en texto visible,
 * una sola vez, y sin decir nada si se colaba un dedazo. Se guardaba lo
 * que fuera y después «no me detecta la contraseña» — porque la que se
 * guardó no era la que se creía haber escrito.
 *
 * Aquí va tapada, dos veces, y solo se acepta si las dos coinciden.
 */
export function pedirClaveNueva({ titulo, texto = '', tipo = 'contrasena', ok = 'Guardar' }) {
  const esPin = tipo === 'pin';
  const minimo = esPin ? 4 : 8;
  return new Promise((resolver) => {
    const { caja, salir } = montar(`
      <h3 class="dialogo-titulo">${titulo}</h3>
      ${texto ? `<p class="dialogo-texto">${texto}</p>` : ''}
      <label for="clave1">${esPin ? 'PIN nuevo' : 'Contraseña nueva'}
        <small class="ayuda"> · ${esPin ? 'de 4 a 6 números' : 'mínimo 8 letras o números'}</small>
      </label>
      <input id="clave1" type="password" autocomplete="new-password"
             inputmode="${esPin ? 'numeric' : 'text'}" ${esPin ? 'maxlength="6"' : ''}>
      <label for="clave2" style="margin-top:10px">Otra vez, para estar seguros</label>
      <input id="clave2" type="password" autocomplete="new-password"
             inputmode="${esPin ? 'numeric' : 'text'}" ${esPin ? 'maxlength="6"' : ''}>
      <p class="ayuda" id="clave-malo" style="margin:8px 0 0;color:var(--rojo)" hidden></p>
      <div class="dialogo-botones">
        <button class="secundario" data-no>Cancelar</button>
        <button data-si>${ok}</button>
      </div>`, resolver);

    const c1 = caja.querySelector('#clave1');
    const c2 = caja.querySelector('#clave2');
    const malo = caja.querySelector('#clave-malo');
    setTimeout(() => c1.focus(), 220);

    const decir = (t) => { malo.textContent = t; malo.hidden = !t; };
    const enviar = () => {
      const a = c1.value;
      const b = c2.value;
      if (esPin && !/^[0-9]{4,6}$/.test(a)) { decir('El PIN son de 4 a 6 números, nada más.'); c1.focus(); return; }
      if (!esPin && a.length < minimo) { decir(`Tiene que tener al menos ${minimo} caracteres.`); c1.focus(); return; }
      if (a !== b) { decir('No coinciden. Escríbela otra vez en los dos.'); c2.value = ''; c2.focus(); return; }
      salir(a);
    };

    c1.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); c2.focus(); } };
    c2.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); enviar(); } };
    caja.querySelector('[data-no]').onclick = () => salir(null);
    caja.querySelector('[data-si]').onclick = enviar;
  });
}

/** Confirmación de sí o no. Devuelve true o false. */
export function confirmar({ titulo, texto = '', ok = 'Aceptar', peligro = false }) {
  return new Promise((resolver) => {
    const { caja, salir } = montar(`
      <h3 class="dialogo-titulo">${titulo}</h3>
      ${texto ? `<p class="dialogo-texto">${texto}</p>` : ''}
      <div class="dialogo-botones">
        <button class="secundario" data-no>Cancelar</button>
        <button class="${peligro ? 'peligro' : ''}" data-si>${ok}</button>
      </div>`, resolver, false);

    const si = caja.querySelector('[data-si]');
    caja.querySelector('[data-no]').onclick = () => salir(false);
    si.onclick = () => salir(true);

    // ENTER ACEPTA. Quien viene tecleando —Esc para vaciar, por ejemplo—
    // sigue tecleando: parar la mano para buscar el ratón rompe el ritmo.
    // El foco va al botón, así que también se ve cuál se va a activar.
    setTimeout(() => si.focus(), 220);
  });
}

/**
 * Pide un número con botones − y +, además del teclado.
 * Con las manos mojadas es mucho más fácil tocar + que escribir.
 */
export function pedirNumero({ titulo, texto = '', valor = 1, min = 1, max = 99, ok = 'Guardar' }) {
  return new Promise((resolver) => {
    let n = Math.min(Math.max(Number(valor) || min, min), max);

    const { caja, salir } = montar(`
      <h3 class="dialogo-titulo">${titulo}</h3>
      ${texto ? `<p class="dialogo-texto">${texto}</p>` : ''}
      <div class="contador">
        <button class="contador-boton" data-menos>−</button>
        <input class="contador-valor" id="valor" inputmode="numeric" value="${n}">
        <button class="contador-boton" data-mas>＋</button>
      </div>
      <div class="dialogo-botones">
        <button class="secundario" data-no>Cancelar</button>
        <button data-si>${ok}</button>
      </div>`, resolver);

    const campo = caja.querySelector('#valor');
    const pintar = () => { campo.value = n; };

    caja.querySelector('[data-menos]').onclick = () => { n = Math.max(min, n - 1); pintar(); };
    caja.querySelector('[data-mas]').onclick   = () => { n = Math.min(max, n + 1); pintar(); };
    campo.oninput = () => {
      const v = Number(campo.value);
      if (Number.isInteger(v)) n = Math.min(Math.max(v, min), max);
    };

    caja.querySelector('[data-no]').onclick = () => salir(null);
    caja.querySelector('[data-si]').onclick = () => salir(n);
  });
}

/**
 * PIDE UNA CANTIDAD DE HIELO, CON FRACCIONES.
 *
 * En la fábrica el conteo se dicta así: "quedan 14 marquetas y 5/8". Este
 * diálogo deja capturarlo de las dos formas en que la gente lo hace:
 *
 *   · tocando los botones 1, 1/2, 1/4, 1/8, 1/16 (que se van sumando)
 *   · o escribiéndolo tal cual: 14 5/8
 *
 * Devuelve DIECISEISAVOS enteros, o null si se canceló.
 */
export function pedirCantidad({ titulo, texto = '', valor = 0, ok = 'Guardar', ayuda = '' }) {
  return new Promise((resolver) => {
    const { caja, salir } = montar(`
      <h3 class="dialogo-titulo">${titulo}</h3>
      ${texto ? `<p class="dialogo-texto">${texto}</p>` : ''}
      <div id="teclado"></div>
      <label for="escrito" class="etiqueta-chica">o escríbelo tal cual</label>
      <input id="escrito" class="frac-escrito" inputmode="text"
             placeholder="14 y 5/8" autocomplete="off">
      <p class="dialogo-error" id="malo" hidden>
        No se entiende. Escríbelo como <strong>14 5/8</strong>, y en octavos o
        dieciseisavos: la marqueta no se parte en tercios.
      </p>
      ${ayuda ? `<p class="ayuda" style="margin:10px 0 0">${ayuda}</p>` : ''}
      <div class="dialogo-botones">
        <button class="secundario" data-no>Cancelar</button>
        <button data-si>${ok}</button>
      </div>`, resolver);

    const escrito = caja.querySelector('#escrito');
    const malo = caja.querySelector('#malo');

    const teclado = crearTeclado(caja.querySelector('#teclado'), {
      valor,
      alCambiar: (n) => {
        // Si tocan los botones, el campo escrito se pone al día solo.
        if (document.activeElement !== escrito) escrito.value = n ? aTexto(n) : '';
        malo.hidden = true;
      }
    });
    escrito.value = valor ? aTexto(valor) : '';

    escrito.oninput = () => {
      const n = deTexto(escrito.value);
      malo.hidden = escrito.value.trim() === '' || n !== null;
      if (n !== null) teclado.poner(n);
    };

    const enviar = () => {
      // Si escribieron algo a mano y no se entiende, no se guarda nada.
      if (escrito.value.trim() && deTexto(escrito.value) === null) {
        malo.hidden = false;
        escrito.focus();
        return;
      }
      salir(teclado.valor());
    };

    escrito.onkeydown = (ev) => { if (ev.key === 'Enter') enviar(); };
    caja.querySelector('[data-no]').onclick = () => salir(null);
    caja.querySelector('[data-si]').onclick = enviar;
  });
}

/**
 * PIDE UN IMPORTE EN PESOS.
 *
 * Un campo de dinero no debe dejar escribir letras: si lo que se necesita
 * es una cantidad, teclear "doscientos" solo puede terminar mal. Aquí solo
 * entran números y un punto.
 *
 * Y ENTER ACEPTA. En un campo de una sola línea, enter no tiene por qué
 * hacer nada más; en la caja se teclea con una mano y se cobra con enter.
 */
/**
 * Un número entero de piezas: "¿cuántas?".
 *
 * Solo dígitos, y el cero se acepta a propósito: poner 0 es la forma
 * natural de quitar un renglón del ticket sin buscar la tachita.
 */
export function pedirEntero({ titulo, texto = '', valor = '', marcador = '1',
                              ok = 'Guardar', maximo = 100000, opcional = false }) {
  return new Promise((resolver) => {
    const { caja, salir } = montar(`
      <h3 class="dialogo-titulo">${titulo}</h3>
      ${texto ? `<p class="dialogo-texto">${texto}</p>` : ''}
      <input id="cuantos" class="campo-importe" inputmode="numeric"
             autocomplete="off" placeholder="${marcador}" value="${valor}">
      <div class="dialogo-botones">
        <button class="secundario" data-no>Cancelar</button>
        <button data-si>${ok}</button>
      </div>`, resolver);

    const campo = caja.querySelector('#cuantos');
    setTimeout(() => { campo.focus(); campo.select(); }, 220);

    campo.oninput = () => {
      const limpio = campo.value.replace(/[^0-9]/g, '');
      if (limpio !== campo.value) campo.value = limpio;
    };

    const enviar = () => {
      const v = campo.value.trim();
      // Con `opcional`, dejarlo en blanco es una respuesta —"no sé cuántas
      // bolsas le caben"— y se devuelve la cadena vacía. Sin él, el campo
      // simplemente no deja seguir, que es lo que hacía siempre.
      if (v === '' && opcional) return salir('');
      if (!/^\d+$/.test(v) || Number(v) > maximo) { campo.focus(); campo.select(); return; }
      salir(Number(v));
    };

    campo.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); enviar(); } };
    caja.querySelector('[data-no]').onclick = () => salir(null);
    caja.querySelector('[data-si]').onclick = enviar;
  });
}

/**
 * BORRAR PIDE LA CONTRASEÑA DEL ADMINISTRADOR.
 *
 * No el PIN, y es a propósito: el PIN se teclea veinte veces al día delante
 * de quien sea, y sirve para decir "yo estoy aquí". Esto respalda algo que
 * no se puede deshacer.
 */
export function pedirContrasena({ titulo, texto = '', administradores = [],
                                  ok = 'Borrar', aviso = '' }) {
  return new Promise((resolver) => {
    const { caja, salir } = montar(`
      <h3 class="dialogo-titulo">${titulo}</h3>
      ${texto ? `<p class="dialogo-texto">${texto}</p>` : ''}
      ${aviso ? `<div class="aviso-sin-caja" style="margin-bottom:12px">${aviso}</div>` : ''}

      ${administradores.length > 1 ? `
        <label for="quien">¿Quién?</label>
        <select id="quien">
          ${administradores.map((a) => `
            <option value="${a.id}">${a.nombre}</option>`).join('')}
        </select>` : `
        <input type="hidden" id="quien" value="${administradores[0]?.id || ''}">
        <p class="ayuda" style="margin:0 0 6px">
          Contraseña de <strong>${administradores[0]?.nombre || 'el administrador'}</strong>
        </p>`}

      <label for="clave">Contraseña del administrador</label>
      <input id="clave" type="password" autocomplete="off" placeholder="••••••••">

      <div class="dialogo-botones">
        <button class="secundario" data-no>Cancelar</button>
        <button class="peligro" data-si>${ok}</button>
      </div>`, resolver);

    const clave = caja.querySelector('#clave');
    setTimeout(() => clave.focus(), 220);

    const enviar = () => {
      const c = clave.value;
      if (!c) { clave.focus(); return; }
      salir({ usuarioId: caja.querySelector('#quien').value, contrasena: c });
    };

    clave.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); enviar(); } };
    caja.querySelector('[data-no]').onclick = () => salir(null);
    caja.querySelector('[data-si]').onclick = enviar;
  });
}

export function pedirImporte({ titulo, texto = '', valor = '', marcador = '0.00',
                               ok = 'Guardar', ayuda = '', opcional = false }) {
  return new Promise((resolver) => {
    const { caja, salir } = montar(`
      <h3 class="dialogo-titulo">${titulo}</h3>
      ${texto ? `<p class="dialogo-texto">${texto}</p>` : ''}
      <input id="importe" class="campo-importe" inputmode="decimal"
             autocomplete="off" placeholder="${marcador}" value="${valor}">
      ${ayuda ? `<p class="ayuda" style="margin:10px 0 0">${ayuda}</p>` : ''}
      <div class="dialogo-botones">
        <button class="secundario" data-no>Cancelar</button>
        <button data-si>${ok}</button>
      </div>`, resolver);

    const campo = caja.querySelector('#importe');
    setTimeout(() => { campo.focus(); campo.select(); }, 220);

    // Se filtra al escribir: así no hay forma de dejar dentro una letra.
    campo.oninput = () => {
      const limpio = campo.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
      if (limpio !== campo.value) campo.value = limpio;
    };

    const enviar = () => {
      const v = campo.value.trim();
      // "No sé cuánto costó" es una respuesta válida para una nevera vieja:
      // con `opcional` se deja pasar en blanco en vez de trabar el diálogo.
      if (v === '' && opcional) return salir('');
      if (v === '' || Number.isNaN(Number(v))) { campo.focus(); return; }
      salir(v);
    };

    campo.onkeydown = (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); enviar(); }
    };
    caja.querySelector('[data-no]').onclick = () => salir(null);
    caja.querySelector('[data-si]').onclick = enviar;
  });
}

/**
 * Pide un texto libre. Para motivos, notas y todo lo que no cabe en una
 * lista de opciones cerrada.
 *
 * Con `unaLinea` se usa un campo de un renglón y ENTER acepta, en vez de
 * meter un salto de línea. Para un nombre o un concepto corto, el salto de
 * línea nunca es lo que se quería.
 */
/**
 * EL TICKET EN PANTALLA.
 *
 * Pinta los renglones tal como los armó la impresora —el "espejo" que
 * devuelve el servidor—: misma letra de máquina, misma alineación, mismos
 * tamaños (la térmica estira las letras, y aquí se estiran con transform).
 * El papel es blanco aunque el sistema esté en oscuro: es papel.
 */
export function verTicket({ titulo = 'Ticket', renglones = [], ancho = 48,
                            notas = [], acciones = [] }) {
  return new Promise((resolver) => {
    const linea = (r) => {
      // El QR se dibuja; lo demás se escribe. (v5.6)
      if (r.qr) return `<div class="tira-linea alin-centro">${svgDeQr(r.qr, { lado: 130 })}</div>`;
      const escapado = String(r.t)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `
        <div class="tira-linea alin-${r.alin || 'izquierda'}"
             style="--ax:${r.anchoLetra || 1};--ay:${r.altoLetra || 1}">
          <span class="${r.negrita ? 'negra' : ''}">${escapado || ' '}</span>
        </div>`;
    };

    const { caja, salir } = montar(`
      <h3 class="dialogo-titulo">${titulo}</h3>
      <div class="tira-envoltura">
        <div class="tira" style="--cols:${Number(ancho) || 48}">
          ${renglones.map(linea).join('')}
        </div>
      </div>
      ${notas.length
        ? `<p class="dialogo-texto tira-notas">${notas.map((n) => String(n)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')).join('<br>')}</p>`
        : ''}
      <div class="dialogo-botones">
        ${acciones.map((a) => `
          <button class="secundario" data-accion="${a.valor}">${a.texto}</button>`).join('')}
        <button data-si>Cerrar</button>
      </div>`, resolver);

    caja.querySelector('[data-si]').onclick = () => salir(null);
    caja.querySelectorAll('[data-accion]').forEach((b) => {
      b.onclick = () => salir(b.dataset.accion);
    });
  });
}

export function pedirTexto({ titulo, texto = '', valor = '', marcador = '',
                             ok = 'Guardar', largo = 200, unaLinea = false,
                             opcional = false }) {
  return new Promise((resolver) => {
    // Un campo corto se escribe en un renglón; ahí enter acepta.
    const corto = unaLinea || largo <= 60;

    const { caja, salir } = montar(`
      <h3 class="dialogo-titulo">${titulo}</h3>
      ${texto ? `<p class="dialogo-texto">${texto}</p>` : ''}
      ${corto
        ? `<input id="texto" class="dialogo-campo-linea" maxlength="${largo}"
                  autocomplete="off" placeholder="${marcador}" value="${valor}">`
        : `<textarea id="texto" class="dialogo-texto-campo" rows="3"
                     maxlength="${largo}" placeholder="${marcador}">${valor}</textarea>`}
      <div class="dialogo-botones">
        <button class="secundario" data-no>Cancelar</button>
        <button data-si>${ok}</button>
      </div>`, resolver);

    const campo = caja.querySelector('#texto');
    setTimeout(() => { campo.focus(); if (corto) campo.select(); }, 220);

    const enviar = () => {
      const v = campo.value.trim();
      // Un campo opcional se puede dejar vacío: se entrega '' y quien lo
      // pidió decide qué hacer. null sigue significando "canceló".
      if (!v && !opcional) { campo.focus(); return; }
      salir(v);
    };

    if (corto) {
      campo.onkeydown = (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); enviar(); }
      };
    }

    caja.querySelector('[data-no]').onclick = () => salir(null);
    caja.querySelector('[data-si]').onclick = enviar;
  });
}

/**
 * AUTORIZACIÓN DE UN RESPONSABLE.
 *
 * Se usa cuando alguien quiere hacer algo que se sale de la regla: escribe
 * el motivo, elige quién autoriza y ese responsable teclea SU PIN.
 * El PIN se comprueba en el servidor, nunca aquí.
 */
export function pedirAutorizacion({ titulo, texto = '', responsables, motivoSugerido = '' }) {
  return new Promise((resolver) => {
    const { caja, salir } = montar(`
      <h3 class="dialogo-titulo">${titulo}</h3>
      ${texto ? `<p class="dialogo-texto">${texto}</p>` : ''}

      <label for="motivo">¿Por qué?</label>
      <textarea id="motivo" class="dialogo-texto-campo" rows="2" maxlength="200"
                placeholder="Escribe qué pasó">${motivoSugerido}</textarea>

      <label for="quien">¿Quién autoriza?</label>
      <select id="quien">
        ${responsables.map((r) => `
          <option value="${r.id}">${r.nombre} · ${r.rolEtiqueta}</option>`).join('')}
      </select>

      <label for="pin">Su PIN</label>
      <input id="pin" type="password" inputmode="numeric" maxlength="6"
             autocomplete="off" placeholder="••••">

      <div class="dialogo-botones">
        <button class="secundario" data-no>Cancelar</button>
        <button data-si>Autorizar</button>
      </div>`, resolver);

    const motivo = caja.querySelector('#motivo');
    const pin = caja.querySelector('#pin');
    setTimeout(() => motivo.focus(), 220);

    const enviar = () => {
      const m = motivo.value.trim();
      if (!m) { motivo.focus(); return; }
      if (!/^[0-9]{4,6}$/.test(pin.value)) { pin.focus(); return; }
      salir({ motivo: m, usuarioId: caja.querySelector('#quien').value, pin: pin.value });
    };

    pin.onkeydown = (ev) => { if (ev.key === 'Enter') enviar(); };
    caja.querySelector('[data-no]').onclick = () => salir(null);
    caja.querySelector('[data-si]').onclick = enviar;
  });
}

/**
 * Menú de opciones. Cada opción es { valor, texto, detalle, peligro }.
 * Devuelve el valor elegido, o null si se cerró.
 */
export function menu({ titulo, texto = '', opciones }) {
  return new Promise((resolver) => {
    const { caja, salir } = montar(`
      <h3 class="dialogo-titulo">${titulo}</h3>
      ${texto ? `<p class="dialogo-texto">${texto}</p>` : ''}
      <div class="dialogo-opciones">
        ${opciones.map((o) => `
          <button class="dialogo-opcion ${o.peligro ? 'peligrosa' : ''}" data-valor="${o.valor}">
            <strong>${o.texto}</strong>
            ${o.detalle ? `<small>${o.detalle}</small>` : ''}
          </button>`).join('')}
      </div>
      <div class="dialogo-botones">
        <button class="secundario" data-no>Cancelar</button>
      </div>`, resolver);

    caja.querySelectorAll('[data-valor]').forEach((b) => {
      b.onclick = () => salir(b.dataset.valor);
    });
    caja.querySelector('[data-no]').onclick = () => salir(null);
  });
}
