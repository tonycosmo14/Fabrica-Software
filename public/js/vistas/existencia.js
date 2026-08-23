/**
 * LA EXISTENCIA  (v0.7)
 *
 * Lo que se sacó, lo que salió y lo que sobra. A las 3 y a las 8 alguien
 * cuenta las marquetas del cuarto frío y el sistema hace el cuadre:
 *
 *     existencia anterior + producido − contado = SALIDAS
 *
 * Hoy las salidas son "vendido y perdido" todo junto. Cuando exista el
 * punto de venta, lo vendido saldrá de los tickets y lo que sobre de esa
 * resta es lo que hay que explicar.
 */
import { api } from '../api.js';
import { esc, avisar, fecha as formatoFecha } from '../util.js';
import { pedirTexto, pedirNumero, confirmar } from '../dialogo.js';

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
  }

  /** La tarjeta de un cuarto frío: cómo va y qué debería haber. */
  function tarjetaAlmacen(a) {
    const m = a.enMarquetas;
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
            <strong>${m.anterior}</strong>
          </div>
          <div class="cuadre-linea suma">
            <span>+ Salió de los tanques desde entonces</span>
            <strong>${m.producido}</strong>
          </div>
          <div class="cuadre-linea total">
            <span>= Debería haber ahora</span>
            <strong>${m.teorico}</strong>
          </div>
        </div>

        ${puedeContar
          ? `<button data-contar="${esc(a.almacen.id)}" style="margin-top:14px">
               📋 Contar el ${esc(a.almacen.nombre.toLowerCase())}
             </button>`
          : ''}
      </div>`;
  }

  // ==========================================================
  // HACER EL CONTEO
  // ==========================================================
  async function hacerConteo(a) {
    const marquetas = await pedirNumero({
      titulo: `Contar ${a.almacen.nombre}`,
      texto: `¿Cuántas marquetas hay físicamente? Deberían ser ${a.enMarquetas.teorico}.`,
      valor: a.enMarquetas.teorico, min: 0, max: 100000, ok: 'Registrar el conteo'
    });
    if (marquetas === null) return;

    try {
      const r = await api.enviar('/existencia/conteos', {
        almacenId: a.almacen.id, marquetas
      });
      resultado(a, r.resumen, r.conteo);
    } catch (e) { avisar(e.message, 'error'); }
  }

  /** El cuadre después de contar, con su ticket para imprimir. */
  function resultado(a, r, conteo) {
    const cuadra = r.salidas === 0;
    const sobra = r.salidas < 0;

    pantalla.innerHTML = `
      <button class="secundario chico no-imprimir" id="volver">‹ Existencia</button>

      <div class="tarjeta ${r.primerConteo ? '' : (cuadra ? 'cuadre-exacto' : 'cuadre-diferencia')}"
           style="margin-top:14px">
        <h2 style="margin:0 0 6px">${esc(a.almacen.nombre)}</h2>
        <p class="ayuda" style="margin:0 0 14px">${esc(formatoFecha(conteo.fecha))}</p>

        ${r.primerConteo ? `
          <p class="ayuda" style="margin:0">
            <strong>Primer conteo.</strong> A partir de ahora, cada vez que cuentes
            el sistema te dirá cuánto salió del cuarto frío entre un conteo y otro.
          </p>
          <div class="total-vivo" style="margin-top:14px">
            <span>quedan en el cuarto frío</span>
            <strong>${r.contado}</strong>
            <small>marquetas</small>
          </div>` : `
          <div class="cuadre">
            <div class="cuadre-linea"><span>Había</span><strong>${r.anterior}</strong></div>
            <div class="cuadre-linea suma"><span>+ Se produjo</span><strong>${r.producido}</strong></div>
            <div class="cuadre-linea total"><span>= Debería haber</span><strong>${r.teorico}</strong></div>
            <div class="cuadre-linea contado"><span>− Contaste</span><strong>${r.contado}</strong></div>
          </div>

          <div class="salidas ${cuadra ? 'exacto' : sobra ? 'sobra' : ''}">
            <span>${sobra ? 'Sobran' : 'Salieron del cuarto frío'}</span>
            <strong>${Math.abs(r.salidas)}</strong>
            <small>marquetas</small>
          </div>

          <p class="ayuda" style="margin:14px 0 0">
            ${sobra
              ? 'Hay más marquetas de las que deberían. Puede que falte registrar producción, o que el conteo anterior se quedara corto.'
              : cuadra
                ? 'Cuadra exacto: no salió nada entre un conteo y otro.'
                : 'Eso es lo que se vendió más lo que se perdió. Cuando entre el punto de venta, esta cifra se partirá en vendido y faltante.'}
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
              <tr><td>Había</td><td>${r.anterior}</td></tr>
              <tr><td>Se produjo</td><td>+${r.producido}</td></tr>
              <tr><td>Debería haber</td><td>${r.teorico}</td></tr>`}
            <tr class="fuerte"><td>Contado</td><td>${r.contado}</td></tr>
            ${r.primerConteo ? '' : `
              <tr class="fuerte"><td>Salidas</td><td>${r.salidas}</td></tr>`}
          </table>
        </div>
        <div class="ticket-pie">
          <div>Contó: ${esc(estadoApp.usuario.nombre)}</div>
          <div class="ticket-firma">Firma: ______________________</div>
        </div>
      </div>

      <button class="no-imprimir" id="imprimir" style="margin-top:14px">🖨️ Imprimir el ticket</button>`;

    pantalla.querySelector('#volver').onclick = pintar;
    pantalla.querySelector('#imprimir').onclick = () => window.print();
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
        Cada renglón es un corte. La columna de salidas es lo que dejó el
        cuarto frío entre ese conteo y el anterior.
      </p>

      <div class="tarjeta plana">
        <table class="tabla">
          <tr><th>Cuándo</th><th>Contado</th><th>Salidas</th><th>Quién</th></tr>
          ${conteos.map((c) => `
            <tr class="${c.anulado_en ? 'anulada' : ''}"
                ${puedeCorregir && !c.anulado_en ? `data-anular="${esc(c.id)}"` : ''}
                style="${puedeCorregir && !c.anulado_en ? 'cursor:pointer' : ''}">
              <td>${esc(formatoFecha(c.fecha))}</td>
              <td><strong>${c.contado / 16}</strong></td>
              <td>${c.salidas / 16}</td>
              <td>${esc(c.ejecutor_nombre || '—')}</td>
            </tr>`).join('') || '<tr><td colspan="4">Todavía no hay conteos.</td></tr>'}
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
