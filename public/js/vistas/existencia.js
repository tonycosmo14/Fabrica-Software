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
import { pedirTexto, pedirCantidad, pedirNumero, menu } from '../dialogo.js';
import { aTexto } from '../fracciones.js';
import { capturaDePanos } from '../captura-panos.js';

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
      b.onclick = () => anotarExistencia(almacenes.find((a) => a.almacen.id === b.dataset.contar));
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
          ${a.cortado ? `
            <div class="cuadre-linea vendido">
              <span>− Se cortó para hielo gourmet</span>
              <strong>${t.cortado}</strong>
            </div>` : ''}
          <div class="cuadre-linea total">
            <span>= Debería haber ahora</span>
            <strong>${t.esperado}</strong>
          </div>
        </div>

        <div class="fila-botones" style="margin-top:14px;flex-wrap:wrap">
          ${puedeContar
            ? `<button class="crece" data-contar="${esc(a.almacen.id)}">
                 📋 Anotar la existencia
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
  // ==========================================================
  // ANOTAR LA EXISTENCIA — los tres pasos, en el orden en que se cantan
  //
  // EL ORDEN NO ES CAPRICHO. El obrero llega con su papel y canta las dos
  // cosas juntas: los paños que sacó y cuánto quedó en el cuarto frío.
  // Anotando el conteo primero, la producción de esa misma jornada todavía
  // no estaría capturada y el cuadre saldría mal — parecería que sobra
  // hielo, cuando lo que falta es el registro.
  //
  // Y en medio va el hielo que se cortó, porque esas marquetas salieron del
  // cuarto frío sin pasar por la caja: si no se anotan, aparecen como
  // faltante, que es el número que de verdad hay que vigilar.
  //
  //     1. ¿Qué paños se sacaron?      → entra hielo
  //     2. ¿Se cortó hielo?            → sale hielo, sin ticket
  //     3. ¿Cuánto quedó?              → la foto
  //
  // Quien lo anota es siempre el usuario que tiene la sesión abierta: eso
  // no se pregunta, se guarda solo (regla 3.6).
  // ==========================================================

  function anotarExistencia(a) {
    return paso1(a.almacen);
  }

  /** PASO 1 — lo que entró: los paños de la jornada. */
  function paso1(almacen) {
    return capturaDePanos(pantalla, estadoApp, {
      paso: 'Paso 1 de 3',
      titulo: '¿Qué paños se sacaron?',
      textoVolver: 'Existencia',
      textoBoton: 'Registrar',
      textoSaltar: 'No se sacó ninguno',
      alVolver: pintar,
      alGuardar: () => paso2(almacen)
    });
  }

  /** PASO 2 — lo que salió sin pasar por la caja: el hielo que se cortó. */
  function paso2(almacen) {
    pantalla.innerHTML = `
      <button class="secundario chico" id="volver">‹ Existencia</button>
      <p class="paso-de">Paso 2 de 3</p>
      <h2 style="margin-top:14px">¿Se cortó hielo?</h2>
      <p class="ayuda">
        Marquetas que se agarraron del cuarto frío para cortarlas y hacer
        <b>hielo gourmet</b>. Salen de la existencia porque dejan de ser
        marquetas: se vuelven bolsas.
      </p>
      <p class="ayuda">
        Anotarlo aquí es lo que evita que aparezcan como hielo perdido. En
        temporada, sin esto el corte diría que faltan cuarenta marquetas y
        nadie sabría si es robo o es trabajo.
      </p>

      <div class="acciones-centradas" style="margin-top:24px">
        <button class="secundario" id="nada">No se cortó nada</button>
        <button id="si">Sí, se cortó hielo</button>
      </div>`;

    pantalla.querySelector('#volver').onclick = pintar;
    pantalla.querySelector('#nada').onclick = () => paso3(almacen);
    pantalla.querySelector('#si').onclick = async () => {
      const dieciseisavos = await pedirCantidad({
        titulo: '¿Cuánto hielo se cortó?',
        texto: 'Las marquetas que se agarraron del cuarto frío para cortarlas.',
        valor: 0, ok: 'Siguiente',
        ayuda: 'Escríbelo como se dicta: "8 marquetas" o "3 y 1/2".'
      });
      if (!dieciseisavos) return;

      // Las bolsas son opcionales a propósito: si nadie las contó, mejor
      // vacío que un cero que mañana parecería un dato.
      const bolsas = await pedirNumero({
        titulo: '¿Cuántas bolsas salieron?',
        texto: 'Si nadie las contó, déjalo en cero y se guarda sin ese dato. ' +
               'Las bolsas todavía no son un producto del sistema; el día que ' +
               'lo sean, este número va a hacer falta y ya no se puede ir a ' +
               'buscar hacia atrás.',
        valor: 0, min: 0, max: 100000, ok: 'Anotar el corte'
      });
      if (bolsas === null) return;

      try {
        await api.enviar('/existencia/cortes', {
          almacenId: almacen.id, dieciseisavos, bolsas: bolsas || null
        });
        avisar(`${aTexto(dieciseisavos)} de hielo cortado`, 'bien');
        paso3(almacen);
      } catch (e) { avisar(e.message, 'error'); }
    };
  }

  /**
   * PASO 3 — la foto: cuánto hay de verdad.
   *
   * AQUÍ NO SE ENSEÑA CUÁNTO DEBERÍA HABER, y es a propósito. Con el número
   * esperado a la vista, contar se vuelve confirmar: se aprieta aceptar, el
   * cuadre da cero siempre y el conteo deja de servir para lo único que
   * sirve, que es descubrir lo que no cuadra. Sale enseguida, en el
   * resultado, cuando ya no puede influir en nadie.
   */
  function paso3(almacen) {
    pantalla.innerHTML = `
      <button class="secundario chico" id="volver">‹ Existencia</button>
      <p class="paso-de">Paso 3 de 3</p>
      <h2 style="margin-top:14px">¿Cuánto quedó en el cuarto frío?</h2>
      <p class="ayuda">
        Cuenta las marquetas de <b>${esc(almacen.nombre)}</b> ahora.
      </p>
      <p class="ayuda">
        El sistema <b>no te enseña cuánto debería haber</b> hasta que anotes
        tu número. Con el número a la vista, contar se vuelve confirmar, y el
        conteo deja de servir para lo único que sirve: descubrir lo que no
        cuadra. Sale enseguida, en el resultado.
      </p>

      <div class="acciones-centradas" style="margin-top:24px">
        <button id="contar">Escribir lo que conté</button>
      </div>`;

    pantalla.querySelector('#volver').onclick = pintar;
    pantalla.querySelector('#contar').onclick = async () => {
      const dieciseisavos = await pedirCantidad({
        titulo: `Contar ${almacen.nombre}`,
        texto: '¿Cuánto hay físicamente?',
        valor: 0,
        ok: 'Registrar el conteo',
        ayuda: 'Si te dictan "14 marquetas y 5/8", escríbelo tal cual o tócalo con los botones.'
      });
      if (dieciseisavos === null) return;

      try {
        const r = await api.enviar('/existencia/conteos', {
          almacenId: almacen.id, dieciseisavos
        });
        // El estado de la tarjeta se vuelve a pedir para que el resultado
        // enseñe el nombre y los textos ya con el conteo aplicado.
        const { almacenes } = await api.obtener('/existencia');
        const suyo = almacenes.find((x) => x.almacen.id === almacen.id);
        resultado(suyo, r.resumen, r.conteo);
      } catch (e) { avisar(e.message, 'error'); }
    };
  }

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
            ${r.cortado ? `
              <div class="cuadre-linea vendido"><span>− Se cortó para hielo gourmet</span><strong>${aTexto(r.cortado)}</strong></div>` : ''}
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
              ${r.merma ? `<tr><td>Merma</td><td>${signo('−', r.merma)}</td></tr>` : ''}
              ${r.cortado ? `<tr><td>Se cortó</td><td>${signo('−', r.cortado)}</td></tr>` : ''}
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
  // HISTORIAL DE CONTEOS
  //
  // Antes bastaba tocar cualquier parte del renglón para que saltara la
  // anulación. Un historial es para MIRAR: se abre a repasar los conteos de
  // la semana y el dedo resbala. Tocar no hace nada; lo que se puede hacer
  // son tres botones a la izquierda, con su dibujito, y cada uno dice qué
  // hace: ver, imprimir, anular.
  // ==========================================================
  async function verHistorial() {
    const { conteos } = await api.obtener('/existencia/conteos?limite=40');

    pantalla.innerHTML = `
      <button class="secundario chico" id="volver">‹ Existencia</button>
      <h2 style="margin-top:14px">Historial de conteos</h2>
      <p class="ayuda">
        Cada renglón es un conteo. <strong>Falta</strong> es lo que salió del
        cuarto frío sin que ningún ticket lo explique.
        ${puedeCorregir
          ? 'Con 🗑 se anula uno mal capturado: no se borra, se marca, y vuelve a valer el anterior.'
          : ''}
      </p>

      <div class="ancho-completo">
        <div class="tarjeta plana">
          <div class="hist-envoltura">
            <table class="tabla hist-tabla conteo-tabla">
              <tr>
                <th class="conteo-c-acciones"></th>
                <th class="conteo-c-cuando">Cuándo</th>
                <th class="conteo-c-donde">Cuarto frío</th>
                <th class="conteo-c-num der">Contado</th>
                <th class="conteo-c-num der">Vendido</th>
                <th class="conteo-c-num der">Falta</th>
                <th class="conteo-c-quien">Quién contó</th>
              </tr>
              ${conteos.map(renglonDeConteo).join('')
                || '<tr><td colspan="7">Todavía no hay conteos.</td></tr>'}
            </table>
          </div>
        </div>
      </div>`;

    pantalla.querySelector('#volver').onclick = pintar;
    enlazarAcciones(conteos, verHistorial);
  }

  /** Un renglón del historial: primero lo que se puede hacer, luego los datos. */
  function renglonDeConteo(c) {
    // El primer conteo de un cuarto frío no cuadra nada: solo fija el punto
    // de partida. Restarle lo vendido daba un "falta" de veinte marquetas
    // negativas que no quería decir nada.
    const primero = !c.desde;
    const falta = c.salidas - c.vendido;
    return `
      <tr class="${c.anulado_en ? 'anulada' : ''}">
        <td class="conteo-c-acciones">
          <button class="secundario chico" data-ver="${esc(c.id)}"
                  title="Ver este conteo con todas sus cuentas">👁</button>
          <button class="secundario chico" data-imprimir="${esc(c.id)}"
                  title="Volver a imprimir el papel">🖨</button>
          ${puedeCorregir && !c.anulado_en
            ? `<button class="secundario chico" data-anular="${esc(c.id)}"
                       title="Anular este conteo">🗑</button>`
            : ''}
        </td>
        <td class="conteo-c-cuando">${esc(formatoFecha(c.fecha))}</td>
        <td class="conteo-c-donde">${esc(c.almacen || '—')}</td>
        <td class="conteo-c-num der"><strong>${aTexto(c.contado)}</strong></td>
        <td class="conteo-c-num der">${primero ? '—' : aTexto(c.vendido)}</td>
        <td class="conteo-c-num der ${!primero && falta > 0 ? 'malo' : ''}">
          ${primero ? '<small>primer conteo</small>' : aTexto(falta)}
        </td>
        <td class="conteo-c-quien">
          ${esc(c.ejecutor_nombre || '—')}
          ${c.anulado_en ? '<small>anulado</small>' : ''}
        </td>
      </tr>`;
  }

  /**
   * Los tres botones, en el único sitio donde se sabe qué conteo es cada
   * renglón. `volverA` es a qué pantalla se regresa después de anular: el
   * historial completo, o el detalle de ese conteo.
   */
  function enlazarAcciones(conteos, volverA) {
    const buscar = (id) => conteos.find((c) => c.id === id);

    pantalla.querySelectorAll('[data-ver]').forEach((b) => {
      b.onclick = () => verConteo(buscar(b.dataset.ver), conteos);
    });
    pantalla.querySelectorAll('[data-imprimir]').forEach((b) => {
      b.onclick = () => reimprimirConteo(b.dataset.imprimir, b);
    });
    pantalla.querySelectorAll('[data-anular]').forEach((b) => {
      b.onclick = () => anularConteo(buscar(b.dataset.anular), volverA);
    });
  }

  /** Volver a sacar el papel de un conteo, tal como salió aquel día. */
  async function reimprimirConteo(id, boton) {
    boton.disabled = true;
    try {
      const r = await api.enviar(`/impresion/conteo/${id}`, {});
      if (r.impreso) avisar('Conteo impreso', 'bien');
      else avisar('No hay impresora de tickets puesta. Ponla en Sistema.', 'error');
    } catch (e) { avisar(e.message, 'error'); }
    boton.disabled = false;
  }

  async function anularConteo(c, volverA) {
    if (!c) return;
    const motivo = await pedirTexto({
      titulo: `Anular el conteo de ${formatoFecha(c.fecha)}`,
      texto: 'Se marca como anulado y vuelve a valer el conteo anterior. No se borra nada.',
      marcador: 'Se contó mal, se capturó dos veces...',
      ok: 'Anular'
    });
    if (!motivo) return;
    try {
      await api.enviar(`/existencia/conteos/${c.id}/anular`, { motivo });
      avisar('Conteo anulado', 'bien');
      volverA();
    } catch (e) { avisar(e.message, 'error'); }
  }

  /**
   * VOLVER A VER UN CONTEO.
   *
   * Con los números CONGELADOS de aquel día (regla 3.2), no recalculados
   * hoy: si después se canceló una venta, el papel que se firmó aquella
   * tarde sigue diciendo lo mismo, y esta pantalla también.
   */
  function verConteo(c, conteos) {
    if (!c) return;
    const esperado = c.existencia_anterior + c.producido - c.vendido;
    const faltante = esperado - c.contado;
    const primero = !c.desde;
    const sobra = faltante < 0;

    pantalla.innerHTML = `
      <button class="secundario chico" id="volver">‹ Historial de conteos</button>

      <div class="tarjeta ${primero ? '' : (faltante === 0 ? 'cuadre-exacto' : 'cuadre-diferencia')}"
           style="margin-top:14px">
        <h2 style="margin:0 0 6px">${esc(c.almacen || 'Cuarto frío')}</h2>
        <p class="ayuda" style="margin:0 0 14px">
          ${esc(formatoFecha(c.fecha))} · contó ${esc(c.ejecutor_nombre || '—')}
        </p>

        ${c.anulado_en ? `
          <div class="aviso-anulado">
            <strong>Anulado</strong>
            <span>${esc(formatoFecha(c.anulado_en))}
              ${c.anulado_por_nombre ? `· ${esc(c.anulado_por_nombre)}` : ''}</span>
            ${c.motivo_anulacion ? `<small>${esc(c.motivo_anulacion)}</small>` : ''}
          </div>` : ''}

        ${primero ? `
          <div class="total-vivo">
            <span>había en el cuarto frío</span>
            <strong>${aTexto(c.contado)}</strong>
            <small>primer conteo</small>
          </div>` : `
          <div class="cuadre">
            <div class="cuadre-linea"><span>Había</span><strong>${aTexto(c.existencia_anterior)}</strong></div>
            <div class="cuadre-linea suma"><span>+ Se produjo</span><strong>${aTexto(c.producido)}</strong></div>
            <div class="cuadre-linea vendido"><span>− Se vendió con ticket</span><strong>${aTexto(c.vendido)}</strong></div>
            <div class="cuadre-linea total"><span>= Debería quedar</span><strong>${aTexto(esperado)}</strong></div>
            <div class="cuadre-linea contado"><span>− Se contó</span><strong>${aTexto(c.contado)}</strong></div>
          </div>

          <div class="salidas ${faltante === 0 ? 'exacto' : sobra ? 'sobra' : ''}">
            <span>${sobra ? 'Sobró' : 'Faltó'}</span>
            <strong>${aTexto(Math.abs(faltante))}</strong>
            <small>${Math.abs(faltante) === 16 ? 'marqueta' : 'marquetas'}</small>
          </div>`}

        ${c.notas ? `<p class="ayuda" style="margin:14px 0 0">${esc(c.notas)}</p>` : ''}
      </div>

      <div class="fila-botones" style="margin-top:14px;flex-wrap:wrap">
        <button class="secundario chico" data-imprimir="${esc(c.id)}">🖨 Volver a imprimir</button>
        ${puedeCorregir && !c.anulado_en
          ? `<button class="secundario chico peligro" data-anular="${esc(c.id)}">🗑 Anular este conteo</button>`
          : ''}
      </div>`;

    pantalla.querySelector('#volver').onclick = verHistorial;
    enlazarAcciones(conteos, verHistorial);
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
