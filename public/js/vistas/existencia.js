/**
 * LA EXISTENCIA  (v0.8)
 *
 * Lo que se sacó, lo que salió y lo que sobra. A las 3 y a las 8 alguien
 * cuenta las marquetas del cuarto frío y el sistema hace el cuadre:
 *
 *     existencia anterior + producido − contado = SALIDAS
 *
 * Desde la v0.8 esas salidas se parten en dos:
 *
 *     vendido   = lo que dicen los tickets de la caja
 *     faltante  = salidas − vendido
 *
 * El faltante es lo que se derritió, lo que se cayó y lo que se fue sin
 * pagar. Ese es el número que hay que vigilar.
 *
 * El conteo se captura con fracciones, porque así se dicta en la fábrica:
 * "quedan 14 marquetas y 5/8".
 */
import { api } from '../api.js';
import { esc, avisar, fecha as formatoFecha } from '../util.js';
import { pedirTexto, pedirCantidad, menu } from '../dialogo.js';
import { aTexto } from '../fracciones.js';

/** "+3", "−1/2"... pero un cero se escribe "0" a secas, sin signo. */
function signo(simbolo, dieciseisavos) {
  return dieciseisavos ? `${simbolo}${aTexto(dieciseisavos)}` : '0';
}

export async function vistaExistencia(pantalla, estadoApp) {
  const puedeContar = estadoApp.permisos.includes('*') ||
                      estadoApp.permisos.includes('existencia.contar');
  const puedeCorregir = estadoApp.permisos.includes('*') ||
                        estadoApp.permisos.includes('existencia.corregir');
  const puedeConfigurar = estadoApp.permisos.includes('*') ||
                          estadoApp.permisos.includes('sistema.configurar');

  await pintar();

  async function pintar() {
    const { almacenes, horarios } = await api.obtener('/existencia');

    pantalla.innerHTML = `
      <h2>Existencia</h2>
      <p class="ayuda">
        Lo que hay en el cuarto frío ahora mismo, comparado con lo que
        debería haber. Se cuenta a las ${horarios.join(' y a las ')}.
      </p>

      ${almacenes.map((a) => tarjetaAlmacen(a)).join('')}

      <div class="fila-botones" style="margin-top:18px;flex-wrap:wrap">
        <button class="secundario chico" id="historial">Historial de conteos</button>
        ${puedeConfigurar
          ? '<button class="secundario chico" id="config">Cuartos fríos y horarios</button>'
          : ''}
      </div>`;

    pantalla.querySelector('#historial').onclick = verHistorial;
    if (puedeConfigurar) pantalla.querySelector('#config').onclick = configuracion;

    pantalla.querySelectorAll('[data-contar]').forEach((b) => {
      b.onclick = () => hacerConteo(almacenes.find((a) => a.almacen.id === b.dataset.contar));
    });
    pantalla.querySelectorAll('[data-merma]').forEach((b) => {
      b.onclick = () => anotarMerma(almacenes.find((a) => a.almacen.id === b.dataset.merma));
    });
  }

  /**
   * ANOTAR LO QUE SE PERDIÓ.
   *
   * Antes, el hielo que se derretía aparecía dentro del "faltante" a secas,
   * mezclado con el que se fue sin pagar. Son dos cosas muy distintas: una
   * es física y no tiene remedio, la otra es un problema. Anotarlo es lo
   * que separa las dos.
   */
  async function anotarMerma(a) {
    const dieciseisavos = await pedirCantidad({
      titulo: `Merma en ${a.almacen.nombre}`,
      texto: 'Hielo que salió del cuarto frío sin pasar por la caja.',
      valor: 0, ok: 'Siguiente',
      ayuda: 'Escríbelo como se dicta: "2 marquetas y 1/4".'
    });
    if (!dieciseisavos) return;

    const motivo = await menu({
      titulo: `${aTexto(dieciseisavos)} de hielo`,
      texto: '¿Qué le pasó?',
      opciones: [
        { valor: 'derretida',   texto: '💧 Se derritió' },
        { valor: 'rota',        texto: '🧊 Se rompió o se cayó' },
        { valor: 'regalada',    texto: '🎁 Se regaló' },
        { valor: 'autoconsumo', texto: '🏭 Se usó en la fábrica' },
        { valor: 'otro',        texto: '· Otra cosa' }
      ]
    });
    if (!motivo) return;

    const notas = motivo === 'otro'
      ? await pedirTexto({
          titulo: '¿Qué pasó?', texto: 'Una línea basta.',
          marcador: 'Se cayó la puerta del cuarto', ok: 'Anotar', largo: 200, unaLinea: true
        })
      : '';
    if (motivo === 'otro' && !notas) return;

    try {
      await api.enviar('/existencia/mermas', {
        almacenId: a.almacen.id, dieciseisavos, motivo, notas
      });
      avisar(`Anotadas ${aTexto(dieciseisavos)} de merma`, 'bien');
      await pintar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  /** La tarjeta de un cuarto frío: cómo va y qué debería haber. */
  function tarjetaAlmacen(a) {
    const t = a.textos;
    const nunca = !a.ultimoConteo;

    return `
      <div class="tarjeta existencia-tarjeta ${a.pendiente ? 'toca-contar' : ''}">
        <div class="existencia-cabeza">
          <div>
            <strong>${esc(a.almacen.nombre)}</strong>
            <small>
              ${nunca ? 'Nunca se ha contado'
                      : `Último conteo: ${esc(formatoFecha(a.ultimoConteo.fecha))}
                         · ${esc(a.ultimoConteo.ejecutor_nombre || '—')}`}
            </small>
          </div>
          ${a.pendiente ? `<span class="aviso-contar">toca contar · ${esc(a.pendiente)}</span>` : ''}
        </div>

        <div class="cuadre">
          <div class="cuadre-linea">
            <span>Había en el último conteo</span>
            <strong>${t.anterior}</strong>
          </div>
          <div class="cuadre-linea suma">
            <span>+ Salió de los tanques desde entonces</span>
            <strong>${t.producido}</strong>
          </div>
          ${a.vendido || a.merma ? `
            <div class="cuadre-linea"><span>= Debería haber</span><strong>${t.teorico}</strong></div>` : ''}

          <!-- EL DESGLOSE DE LA SALIDA. Público y mayoreo son dos negocios
               distintos —el mostrador de a cuarto y el que se lleva veinte
               marquetas—, y ver cuánto pesa cada uno es la mitad de saber
               cómo va la fábrica. Lo derretido va aparte porque no es una
               venta: es hielo que se perdió. -->
          <div class="cuadre-linea vendido">
            <span>− Se vendió al público</span>
            <strong>${t.vendidoPublico}</strong>
          </div>
          <div class="cuadre-linea vendido">
            <span>− Se vendió a mayoreo</span>
            <strong>${t.vendidoMayoreo}</strong>
          </div>
          <div class="cuadre-linea vendido">
            <span>− Derretidas, rotas o regaladas</span>
            <strong>${t.merma}</strong>
          </div>
          <div class="cuadre-linea total">
            <span>= Debería haber ahora</span>
            <strong>${t.esperado}</strong>
          </div>
        </div>

        <div class="fila-botones" style="margin-top:14px;flex-wrap:wrap">
          ${puedeContar
            ? `<button class="crece" data-contar="${esc(a.almacen.id)}">
                 📋 Contar el ${esc(a.almacen.nombre.toLowerCase())}
               </button>`
            : ''}
          ${puedeContar
            ? `<button class="secundario" data-merma="${esc(a.almacen.id)}">
                 💧 Anotar merma
               </button>`
            : ''}
        </div>
      </div>`;
  }

  // ==========================================================
  // HACER EL CONTEO
  // ==========================================================
  async function hacerConteo(a) {
    const dieciseisavos = await pedirCantidad({
      titulo: `Contar ${a.almacen.nombre}`,
      texto: `¿Cuánto hay físicamente? Deberían ser ${a.textos.esperado}.`,
      valor: a.esperado,
      ok: 'Registrar el conteo',
      ayuda: 'Si te dictan "14 marquetas y 5/8", escríbelo tal cual o tócalo con los botones.'
    });
    if (dieciseisavos === null) return;

    try {
      const r = await api.enviar('/existencia/conteos', {
        almacenId: a.almacen.id, dieciseisavos
      });
      resultado(a, r.resumen, r.conteo);
    } catch (e) { avisar(e.message, 'error'); }
  }

  /** El cuadre después de contar, con su ticket para imprimir. */
  function resultado(a, r, conteo) {
    const cuadra = r.faltante === 0;
    const sobra = r.faltante < 0;

    pantalla.innerHTML = `
      <button class="secundario chico no-imprimir" id="volver">‹ Existencia</button>

      <div class="tarjeta ${r.primerConteo ? '' : (cuadra ? 'cuadre-exacto' : 'cuadre-diferencia')}"
           style="margin-top:14px">
        <h2 style="margin:0 0 6px">${esc(a.almacen.nombre)}</h2>
        <p class="ayuda" style="margin:0 0 14px">${esc(formatoFecha(conteo.fecha))}</p>

        ${r.primerConteo ? `
          <p class="ayuda" style="margin:0">
            <strong>Primer conteo.</strong> A partir de ahora, cada vez que cuentes
            el sistema te dirá cuánto salió del cuarto frío entre un conteo y otro,
            cuánto de eso lo explican los tickets, y cuánto falta.
          </p>
          <div class="total-vivo" style="margin-top:14px">
            <span>quedan en el cuarto frío</span>
            <strong>${aTexto(r.contado)}</strong>
            <small>marquetas</small>
          </div>` : `
          <div class="cuadre">
            <div class="cuadre-linea"><span>Había</span><strong>${aTexto(r.anterior)}</strong></div>
            <div class="cuadre-linea suma"><span>+ Se produjo</span><strong>${aTexto(r.producido)}</strong></div>
            ${r.vendido ? `
              <div class="cuadre-linea"><span>= Debería haber</span><strong>${aTexto(r.teorico)}</strong></div>` : ''}
            <div class="cuadre-linea vendido"><span>− Se vendió con ticket</span><strong>${aTexto(r.vendido)}</strong></div>
            ${r.merma ? `
              <div class="cuadre-linea vendido"><span>− Derretidas, rotas o regaladas</span><strong>${aTexto(r.merma)}</strong></div>` : ''}
            <div class="cuadre-linea total"><span>= Debería quedar</span><strong>${aTexto(r.esperado)}</strong></div>
            <div class="cuadre-linea contado"><span>− Contaste</span><strong>${aTexto(r.contado)}</strong></div>
          </div>

          <div class="salidas ${cuadra ? 'exacto' : sobra ? 'sobra' : ''}">
            <span>${sobra ? 'Sobra' : 'Falta'}</span>
            <strong>${aTexto(Math.abs(r.faltante))}</strong>
            <small>${Math.abs(r.faltante) === 16 ? 'marqueta' : 'marquetas'}</small>
          </div>

          <p class="ayuda" style="margin:14px 0 0">
            ${sobra
              ? 'Hay más hielo del que debería. Puede que falte capturar una venta cancelada, que sobre producción sin registrar, o que el conteo anterior se quedara corto.'
              : cuadra
                ? 'Cuadra exacto: todo lo que salió del cuarto frío tiene su ticket.'
                : r.vendido
                  ? `Del cuarto frío salieron ${aTexto(r.salidas)} en total. Los tickets explican ${aTexto(r.vendido)}; el resto se derritió, se cayó o se fue sin pagar.`
                  : 'Eso salió del cuarto frío sin que ningún ticket lo explique: se derritió, se cayó o se fue sin pagar.'}
          </p>`}
      </div>

      <div class="ticket" id="ticket">
        <div class="ticket-cabeza">
          <strong>EXISTENCIA</strong>
          <span>${esc(formatoFecha(conteo.fecha))}</span>
        </div>
        <div class="ticket-tanque">
          <div class="ticket-nombre">${esc(a.almacen.nombre.toUpperCase())}</div>
          <table class="ticket-tabla">
            ${r.primerConteo ? '' : `
              <tr><td>Había</td><td>${aTexto(r.anterior)}</td></tr>
              <tr><td>Se produjo</td><td>${signo('+', r.producido)}</td></tr>
              <tr><td>Vendido</td><td>${signo('−', r.vendido)}</td></tr>
              <tr><td>Debería quedar</td><td>${aTexto(r.esperado)}</td></tr>`}
            <tr class="fuerte"><td>Contado</td><td>${aTexto(r.contado)}</td></tr>
            ${r.primerConteo ? '' : `
              <tr class="fuerte"><td>${sobra ? 'Sobra' : 'Falta'}</td><td>${aTexto(Math.abs(r.faltante))}</td></tr>`}
          </table>
        </div>
        <div class="ticket-pie">
          <div>Contó: ${esc(estadoApp.usuario.nombre)}</div>
          <div class="ticket-firma">Firma: ______________________</div>
        </div>
      </div>

      <button class="no-imprimir" id="imprimir" style="margin-top:14px">🖨️ Imprimir el ticket</button>`;

    pantalla.querySelector('#volver').onclick = pintar;

    // Primero la impresora de tickets, que sale al instante. El navegador
    // —con su ventana de "elegir impresora"— solo si no hay ninguna puesta.
    pantalla.querySelector('#imprimir').onclick = async (ev) => {
      const boton = ev.currentTarget;
      boton.disabled = true;
      try {
        const r = await api.enviar(`/impresion/conteo/${conteo.id}`, {});
        if (r.impreso) avisar('Conteo impreso', 'bien');
        else window.print();
      } catch (e) { avisar(e.message, 'error'); }
      boton.disabled = false;
    };
  }

  // ==========================================================
  // HISTORIAL
  // ==========================================================
  async function verHistorial() {
    const { conteos } = await api.obtener('/existencia/conteos?limite=40');

    pantalla.innerHTML = `
      <button class="secundario chico" id="volver">‹ Existencia</button>
      <h2 style="margin-top:14px">Historial de conteos</h2>
      <p class="ayuda">
        Cada renglón es un corte. <strong>Falta</strong> es lo que salió del
        cuarto frío sin que ningún ticket lo explique.
      </p>

      <div class="tarjeta plana">
        <table class="tabla">
          <tr><th>Cuándo</th><th>Contado</th><th>Vendido</th><th>Falta</th><th>Quién</th></tr>
          ${conteos.map((c) => `
            <tr class="${c.anulado_en ? 'anulada' : ''}"
                ${puedeCorregir && !c.anulado_en ? `data-anular="${esc(c.id)}"` : ''}
                style="${puedeCorregir && !c.anulado_en ? 'cursor:pointer' : ''}">
              <td>${esc(formatoFecha(c.fecha))}</td>
              <td><strong>${aTexto(c.contado)}</strong></td>
              <td>${aTexto(c.vendido)}</td>
              <td class="${c.salidas - c.vendido > 0 ? 'malo' : ''}">${aTexto(c.salidas - c.vendido)}</td>
              <td>${esc(c.ejecutor_nombre || '—')}</td>
            </tr>`).join('') || '<tr><td colspan="5">Todavía no hay conteos.</td></tr>'}
        </table>
      </div>

      ${puedeCorregir
        ? '<p class="ayuda" style="margin-top:12px">Toca un conteo para anularlo si se capturó mal.</p>'
        : ''}`;

    pantalla.querySelector('#volver').onclick = pintar;

    pantalla.querySelectorAll('[data-anular]').forEach((fila) => {
      fila.onclick = async () => {
        const motivo = await pedirTexto({
          titulo: 'Anular este conteo',
          texto: 'Se marca como anulado y vuelve a valer el conteo anterior. No se borra nada.',
          marcador: 'Se contó mal, se capturó dos veces...',
          ok: 'Anular'
        });
        if (!motivo) return;
        try {
          await api.enviar(`/existencia/conteos/${fila.dataset.anular}/anular`, { motivo });
          avisar('Conteo anulado', 'bien');
          verHistorial();
        } catch (e) { avisar(e.message, 'error'); }
      };
    });
  }

  // ==========================================================
  // CUARTOS FRÍOS Y HORARIOS
  // ==========================================================
  async function configuracion() {
    const { almacenes, horarios } = await api.obtener('/existencia/almacenes');

    pantalla.innerHTML = `
      <button class="secundario chico" id="volver">‹ Existencia</button>
      <h2 style="margin-top:14px">Cuartos fríos</h2>
      <p class="ayuda">
        Hoy hay uno. Si algún día tienes más, se dan de alta aquí y cada uno
        se cuenta por separado.
      </p>

      ${almacenes.map((a) => `
        <div class="item">
          <div class="crece">
            <strong>${esc(a.nombre)}</strong>
            <small>${a.recibe_produccion
              ? 'Aquí cae el hielo que sale de los tanques'
              : 'Almacenaje aparte'}</small>
          </div>
          <button class="chico secundario" data-editar="${esc(a.id)}">Editar</button>
        </div>`).join('')}

      <button id="nuevo" style="margin-top:12px">＋ Nuevo cuarto frío</button>

      <h3>Horarios de conteo</h3>
      <div class="tarjeta">
        <p class="ayuda" style="margin:0 0 12px">
          A estas horas el sistema avisa que toca contar.
        </p>
        <div class="horarios">
          ${horarios.map((h) => `<span class="horario">${esc(h)}</span>`).join('')}
        </div>
        <button class="secundario" id="editar-horarios" style="margin-top:14px">
          Cambiar los horarios
        </button>
      </div>`;

    pantalla.querySelector('#volver').onclick = pintar;

    pantalla.querySelector('#nuevo').onclick = async () => {
      const nombre = await pedirTexto({
        titulo: 'Nuevo cuarto frío',
        texto: '¿Cómo se le llama?',
        marcador: 'Cuarto frío 2, Bodega...',
        ok: 'Crear'
      });
      if (!nombre) return;
      try {
        await api.enviar('/existencia/almacenes', { nombre, recibeProduccion: false });
        avisar('Cuarto frío creado', 'bien');
        configuracion();
      } catch (e) { avisar(e.message, 'error'); }
    };

    pantalla.querySelectorAll('[data-editar]').forEach((b) => {
      b.onclick = () => editarAlmacen(almacenes.find((a) => a.id === b.dataset.editar));
    });

    pantalla.querySelector('#editar-horarios').onclick = async () => {
      const texto = await pedirTexto({
        titulo: 'Horarios de conteo',
        texto: 'Escribe las horas separadas por comas, en formato de 24 horas.',
        valor: horarios.join(', '),
        marcador: '15:00, 20:00',
        ok: 'Guardar'
      });
      if (!texto) return;
      try {
        const lista = texto.split(',').map((h) => h.trim()).filter(Boolean);
        await api.actualizar('/existencia/horarios', { horarios: lista });
        avisar('Horarios guardados', 'bien');
        configuracion();
      } catch (e) { avisar(e.message, 'error'); }
    };
  }

  async function editarAlmacen(a) {
    const nombre = await pedirTexto({
      titulo: `Editar ${a.nombre}`,
      texto: 'El nombre que aparece en las pantallas y en los tickets.',
      valor: a.nombre, ok: 'Guardar'
    });
    if (nombre === null) return;

    try {
      await api.actualizar(`/existencia/almacenes/${a.id}`, { nombre });
      avisar('Guardado', 'bien');
      configuracion();
    } catch (e) { avisar(e.message, 'error'); }
  }
}
