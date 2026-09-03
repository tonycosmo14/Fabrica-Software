/**
 * AVISOS POR CORREO  (v4.9)
 *
 * "Los correos serán varios que pueda activar y desactivar desde
 *  configuraciones, ya que habrá momentos en los que quiera saber y otros
 *  en los que no."
 *
 * La pantalla está partida en dos mitades y el orden importa:
 *
 *   ARRIBA / IZQUIERDA — LA CUENTA. Se toca una vez en la vida y luego no
 *   se vuelve a mirar, así que va recogida y con el botón de probar bien
 *   grande: lo único que se quiere saber ahí es "¿ya funciona?".
 *
 *   DERECHA — LOS QUINCE INTERRUPTORES, agrupados por lo que avisan. Esto
 *   sí se toca: es lo que se viene a cambiar cuando uno se va de viaje o
 *   cuando se cansa de un aviso. Cada uno dice en una frase qué manda,
 *   porque "aviso_corte" no le dice nada a nadie.
 *
 * LA CONTRASEÑA NO SE ENSEÑA. El servidor manda "ya está puesta", no el
 * valor. La casilla vive vacía y lo que se escriba ahí la reemplaza; en
 * blanco no la borra, y eso está escrito debajo de la casilla porque si no
 * cualquiera daría por hecho lo contrario.
 */
import { api } from '../api.js';
import { esc, avisar, fechaCorta } from '../util.js';
import { confirmar, pedirTexto } from '../dialogo.js';
import { pesos } from '../fracciones.js';

export async function vistaCorreo(pantalla) {
  let d;
  await pintar();

  async function pintar() {
    pantalla.innerHTML = '<div class="cargando">Cargando…</div>';
    try { d = await api.obtener('/correo'); }
    catch (e) { pantalla.innerHTML = `<p class="vacio">${esc(e.message)}</p>`; return; }

    pantalla.innerHTML = `
      <div class="cabecera-pantalla">
        <h2>Avisos por correo</h2>
        <p class="ayuda">
          Que el sistema te escriba cuando pase algo que quieras saber.
          Prende y apaga los que quieras, cuando quieras.
        </p>
      </div>

      ${tarjetaEstado()}

      <div class="corte-tablero">
        <div class="corte-columna">${tarjetaCuenta()}</div>
        <div class="corte-columna">${tarjetaAvisos()}</div>
      </div>

      ${/* La libreta va abajo del todo y al ancho: se viene a mirar cuando
            algo no llegó, no cada vez que se abre la pantalla. En el
            celular, además, entre la cuenta y los avisos estorbaría. */''}
      <div class="ancho-completo">${tarjetaCola()}</div>`;

    enganchar();
  }

  // ==========================================================
  // ARRIBA: ¿ESTÁ FUNCIONANDO?
  //
  // Es lo primero porque es la única pregunta que se hace todo el mundo al
  // abrir esta pantalla. Un renglón, y del color de la respuesta.
  // ==========================================================
  function tarjetaEstado() {
    const prendidos = d.avisos.filter((a) => a.encendido).length;

    if (!d.cuenta.activo) {
      return aviso('gris', 'Los avisos están apagados.',
        'Ni se manda ni se apunta nada. Préndelos abajo cuando quieras.');
    }
    if (!d.listo) {
      return aviso('ambar', 'Falta terminar de poner la cuenta.',
        'Sin cuenta, contraseña y a quién mandarle, no sale ningún aviso.');
    }
    if (!prendidos) {
      return aviso('ambar', 'La cuenta está lista, pero no hay ningún aviso prendido.',
        'Prende a la derecha los que quieras recibir.');
    }
    return aviso('verde',
      `Funcionando · ${prendidos} ${prendidos === 1 ? 'aviso prendido' : 'avisos prendidos'}.`,
      `Le llegan a ${esc(d.cuenta.para)}.`);
  }

  function aviso(tono, fuerte, suave) {
    return `<div class="correo-estado ${tono}">
      <b>${esc(fuerte)}</b>
      <span>${suave}</span>
    </div>`;
  }

  // ==========================================================
  // LA CUENTA
  // ==========================================================
  function tarjetaCuenta() {
    const c = d.cuenta;
    return `
      <div class="tarjeta">
        <h3 style="margin:0 0 4px">La cuenta que manda los avisos</h3>
        <p class="ayuda" style="margin:0 0 14px">
          Una cuenta de correo cualquiera. Lo normal es una de Gmail hecha
          para la fábrica — no la personal, para poder cambiarle la
          contraseña sin líos.
        </p>

        <label class="campo">
          <span>Servidor de salida</span>
          <input id="servidor" value="${esc(c.servidor)}" placeholder="smtp.gmail.com">
        </label>

        <div class="correo-dos">
          <label class="campo">
            <span>Puerto</span>
            <input id="puerto" type="number" value="${c.puerto}">
          </label>
          <label class="campo">
            <span>Cómo se cifra</span>
            <select id="seguridad">
              <option value="tls" ${c.seguridad === 'tls' ? 'selected' : ''}>
                TLS · 465</option>
              <option value="starttls" ${c.seguridad === 'starttls' ? 'selected' : ''}>
                STARTTLS · 587</option>
            </select>
          </label>
        </div>

        <label class="campo">
          <span>La cuenta</span>
          <input id="usuario" type="email" value="${esc(c.usuario)}"
                 placeholder="fabrica@gmail.com" autocomplete="off">
        </label>

        <label class="campo">
          <span>Su contraseña${c.tieneContrasena ? ' <b class="correo-puesta">· ya está puesta</b>' : ''}</span>
          <input id="contrasena" type="password" placeholder="${
            c.tieneContrasena ? 'déjala en blanco para no cambiarla' : 'contraseña de aplicación'}"
                 autocomplete="new-password">
        </label>
        <p class="ayuda" style="margin:-6px 0 14px;font-size:13px">
          En Gmail <b>no va la contraseña de siempre</b>: hay que crear una
          <b>contraseña de aplicación</b> de 16 letras desde la cuenta de
          Google. Está explicado paso a paso en el manual.
        </p>

        <label class="campo">
          <span>A quién le llegan</span>
          <input id="para" value="${esc(c.para)}"
                 placeholder="tony@gmail.com, mari@gmail.com">
        </label>
        <p class="ayuda" style="margin:-6px 0 14px;font-size:13px">
          Varios, separados por coma.
        </p>

        <div class="correo-acciones">
          <button id="guardar">Guardar</button>
          <button id="probar" class="secundario">✉️ Mandar una prueba</button>
        </div>

        <label class="interruptor correo-maestro">
          <input type="checkbox" id="activo" ${c.activo ? 'checked' : ''}>
          <span><b>Mandar avisos por correo</b>
            <small>El apagador de todo. Apagado aquí, no sale nada aunque
              los avisos de al lado estén prendidos.</small></span>
        </label>
      </div>`;
  }

  // ==========================================================
  // LOS INTERRUPTORES
  // ==========================================================
  function tarjetaAvisos() {
    const grupos = [];
    for (const a of d.avisos) {
      let g = grupos.find((x) => x.nombre === a.grupo);
      if (!g) { g = { nombre: a.grupo, avisos: [] }; grupos.push(g); }
      g.avisos.push(a);
    }

    return `
      <div class="tarjeta">
        <h3 style="margin:0 0 4px">Qué quieres que te avise</h3>
        <p class="ayuda" style="margin:0 0 16px">
          Cada uno se prende y se apaga por su cuenta. Se guarda solo.
        </p>

        ${grupos.map((g) => `
          <p class="correo-grupo">${esc(g.nombre)}</p>
          ${g.avisos.map((a) => `
            <label class="interruptor correo-aviso">
              <input type="checkbox" data-aviso="${esc(a.id)}" ${a.encendido ? 'checked' : ''}>
              <span><b>${a.icono} ${esc(a.nombre)}</b>
                <small>${esc(a.ayuda)}</small></span>
            </label>
            ${extrasDe(a)}`).join('')}`).join('')}
      </div>`;
  }

  // Declarada con `function` y no con `const`: `pintar()` corre al entrar
  // a la pantalla, o sea ANTES de que se ejecuten los `const` de abajo, y
  // una flecha guardada en un const todavía no existe en ese momento.
  function hora12(h) { return `${h % 12 || 12}:00 ${h < 12 ? 'a.m.' : 'p.m.'}`; }

  /** Los dos avisos que necesitan un número, con él al lado. */
  function extrasDe(a) {
    if (a.id === 'gasto_grande') {
      return `<div class="correo-extra">
        Avisa desde
        <button class="secundario chico" id="monto-gasto">
          ${pesos(d.ajustes.gastoGrandeDesde)}</button>
        para arriba.
      </div>`;
    }
    if (a.id === 'resumen_dia') {
      return `<div class="correo-extra">
        Sale a las
        <select id="hora-resumen">
          ${Array.from({ length: 24 }, (_, h) => `
            <option value="${h}" ${h === d.ajustes.resumenDiaHora ? 'selected' : ''}>
              ${hora12(h)}</option>`).join('')}
        </select>
      </div>`;
    }
    return '';
  }

  // ==========================================================
  // LA LIBRETA DE LO QUE SALIÓ
  //
  // Está aquí para poder contestar "no me llegó el correo" mirando algo en
  // vez de adivinando. El renglón dice qué pasó y, si falló, por qué.
  // ==========================================================
  function tarjetaCola() {
    if (!d.ultimos.length) {
      return `<div class="tarjeta">
        <h3 style="margin:0 0 4px">Lo que ha salido</h3>
        <p class="vacio" style="margin:8px 0 0">Todavía no se ha mandado ningún aviso.</p>
      </div>`;
    }

    return `
      <div class="tarjeta">
        <h3 style="margin:0 0 4px">Lo que ha salido</h3>
        <p class="ayuda" style="margin:0 0 12px">
          Los últimos ${d.ultimos.length}.
          ${d.pendientes
            ? `<b>${d.pendientes} ${d.pendientes === 1 ? 'está esperando' : 'están esperando'}</b>
               a que haya internet.`
            : 'No hay ninguno esperando.'}
          ${d.pendientes ? '<button class="secundario chico" id="sacar">Probar ahora</button>' : ''}
        </p>

        <table class="tabla correo-tabla">
          ${d.ultimos.map((c) => `
            <tr>
              <td>
                <span class="correo-asunto">${esc(c.asunto)}</span>
                <small>${esc(fechaCorta(c.creado_en))}</small>
              </td>
              <td class="der">${estadoDe(c)}</td>
            </tr>`).join('')}
        </table>
      </div>`;
  }

  function estadoDe(c) {
    if (c.enviado_en) return '<span class="correo-marca salio">salió</span>';
    if (c.cancelado_en) {
      return `<span class="correo-marca fallo">no salió</span>
              <small class="correo-porque">${esc(c.motivo_cancelacion || c.ultimo_error || '')}</small>`;
    }
    return `<span class="correo-marca espera">esperando</span>
            ${c.ultimo_error
              ? `<small class="correo-porque">${esc(c.ultimo_error)}</small>` : ''}`;
  }

  // ==========================================================
  // LO QUE SE PUEDE HACER
  // ==========================================================
  function enganchar() {
    pantalla.querySelector('#guardar').onclick = guardar;
    pantalla.querySelector('#probar').onclick = probar;

    // El apagador general se guarda al tocarlo, sin botón: es un
    // interruptor, y un interruptor que hay que confirmar no es un
    // interruptor.
    pantalla.querySelector('#activo').onchange = async (e) => {
      await api.actualizar('/correo/cuenta', { activo: e.target.checked });
      await pintar();
    };

    pantalla.querySelectorAll('[data-aviso]').forEach((x) => {
      x.onchange = async () => {
        try {
          await api.actualizar(`/correo/avisos/${x.dataset.aviso}`,
                               { encendido: x.checked });
          await pintar();
        } catch (err) { avisar(err.message, 'error'); x.checked = !x.checked; }
      };
    });

    const monto = pantalla.querySelector('#monto-gasto');
    if (monto) monto.onclick = cambiarMonto;

    const hora = pantalla.querySelector('#hora-resumen');
    if (hora) hora.onchange = async () => {
      await api.actualizar('/correo/ajustes', { resumenDiaHora: Number(hora.value) });
      avisar('Guardado', 'bien');
    };

    const sacar = pantalla.querySelector('#sacar');
    if (sacar) sacar.onclick = async () => {
      sacar.disabled = true;
      sacar.textContent = 'Probando…';
      const r = await api.enviar('/correo/cola/sacar', {});
      avisar(r.salieron ? `Salieron ${r.salieron}.` : 'Todavía no se pudo.',
             r.salieron ? 'bien' : '');
      await pintar();
    };
  }

  async function guardar() {
    const v = (id) => pantalla.querySelector(`#${id}`).value.trim();
    try {
      await api.actualizar('/correo/cuenta', {
        servidor: v('servidor'),
        puerto: Number(v('puerto')),
        seguridad: pantalla.querySelector('#seguridad').value,
        usuario: v('usuario'),
        contrasena: v('contrasena'),      // en blanco = no la toques
        para: v('para')
      });
      avisar('Guardado', 'bien');
      await pintar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  /**
   * La prueba manda un correo de verdad, en el momento y sin cola.
   *
   * Se guarda primero lo que haya escrito en las casillas: probar con lo
   * que había guardado y no con lo que se acaba de teclear es la forma más
   * rápida de perder media hora.
   */
  async function probar() {
    const boton = pantalla.querySelector('#probar');
    await guardar();

    boton.disabled = true;
    boton.textContent = 'Mandando…';
    try {
      const r = await api.enviar('/correo/probar', {});
      avisar(`Salió. Revisa ${r.para.join(', ')}.`, 'bien');
    } catch (e) {
      await confirmar({ titulo: 'No salió', texto: esc(e.message), ok: 'Entendido' });
    }
    boton.disabled = false;
    boton.textContent = '✉️ Mandar una prueba';
    await pintar();
  }

  async function cambiarMonto() {
    const t = await pedirTexto({
      titulo: '¿Desde cuánto avisa?',
      texto: 'Los gastos de la empresa que pasen de esta cantidad mandan aviso. ' +
             'Poner un número bajo llena el correo de cosas que ya sabías.',
      valor: String(Math.round(d.ajustes.gastoGrandeDesde / 100)),
      unaLinea: true, ok: 'Guardar'
    });
    if (t === null) return;

    const n = Number(String(t).replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(n) || n < 0) return avisar('Ese número no se entiende', 'error');

    await api.actualizar('/correo/ajustes', { gastoGrandeDesde: n });
    await pintar();
  }
}
