/**
 * REGISTRAR LO QUE SE SACÓ — la captura de una jornada entera
 *
 * El obrero llega a las 3 con su papel, dice los números y se capturan
 * todos de golpe. Vive aquí y no dentro de Producción porque lo piden DOS
 * pantallas, y una pantalla copiada dos veces es una pantalla que tarde o
 * temprano se comporta de dos maneras distintas:
 *
 *   · PRODUCCIÓN, con el botón "Registrar lo que se sacó".
 *   · EXISTENCIA, como primer paso de anotar la existencia: antes de
 *     preguntar cuánto hielo queda hay que saber cuánto entró, porque el
 *     obrero canta las dos cosas juntas y si se anota el conteo primero,
 *     el cuadre sale mal por los paños que aún no estaban capturados.
 *
 * Quien la llama decide qué pasa al terminar y al volverse atrás, y si
 * lleva un renglón de "paso 1 de 3" arriba.
 */
import { api } from './api.js';
import { esc, avisar } from './util.js';
import { pedirTexto, pedirAutorizacion, menu } from './dialogo.js';

/** Siguiente número en una rotación intercalada ya calculada por el servidor. */
function siguienteEnOrden(orden, ultimo) {
  if (!orden.length) return null;
  if (ultimo == null) return orden[0];
  const i = orden.indexOf(ultimo);
  return i === -1 ? orden[0] : orden[(i + 1) % orden.length];
}

/**
 * @param pantalla   dónde pintar
 * @param estado     el estado de la aplicación (usuario y permisos)
 * @param opciones   { agua, alVolver, alGuardar, paso, titulo, textoBoton }
 */
export async function capturaDePanos(pantalla, estado, opciones = {}) {
  const alVolver = opciones.alVolver || (() => {});
  const alGuardar = opciones.alGuardar || (() => {});
  let agua = opciones.agua || localStorage.getItem('tipo_agua') || 'purificada';

  let CALIDADES = [];
  let DESTINOS = [];

  const deCatalogo = (clave) => CALIDADES.find((c) => c.clave === clave);
  const pideDestino = (clave) => Boolean(deCatalogo(clave)?.pideDestino);
  const pideNota = (clave) => Boolean(deCatalogo(clave)?.pideNota);

  /** Pide el texto de "Otro": sin él, ese estado no dice nada. */
  function pedirNota(valor) {
    return pedirTexto({
      titulo: '¿Qué pasó?',
      texto: 'Escríbelo como lo dirías. Queda guardado con el paño, y si dentro ' +
             'de un año esto se repite, ahí estará la razón.',
      valor: valor || '', marcador: 'Se fue la luz cuatro horas…',
      ok: 'Guardar', largo: 300
    });
  }


  const { obreros } = await api.obtener('/produccion/obreros');
  const todos = await api.obtener('/produccion/estado');
  // Los estados del hielo y sus destinos vienen del servidor con las reglas
  // ya resueltas: aquí no hay una segunda copia de los nombres.
  CALIDADES = todos.calidades || [];
  DESTINOS = todos.destinos || [];
  let quienId = obreros[0]?.id || '';
  let quienNombre = '';
  const elegidos = new Set();
  const valesPorPano = {};           // paños marcados fuera de orden

  // Aquí la calidad es UNA sola respuesta para toda la captura, y no
  // molde por molde como en la pantalla del paño. Se está anotando de
  // memoria algo que ya pasó: pedir un detalle que nadie apuntó no daría
  // más verdad, daría datos inventados.
  let calidadLote = 'normal';
  let destinoLote = 'condensadores';
  let notaLote = '';

  const porTanque = [];
  for (const t of todos.tanques) {
    const d = await api.obtener(`/produccion/estado?tanque=${encodeURIComponent(t.id)}`);
    porTanque.push(d.tanque);
  }

  /**
   * La rotación avanza conforme se marca. Si el obrero sacó el 1, el 3 y
   * el 5 en ese orden, los tres son correctos: al marcar el 1, el que
   * sigue pasa a ser el 3, y así. Solo se pide autorización cuando de
   * verdad se rompió el orden.
   */
  function siguienteDe(t) {
    let ultimo = t.ultimoPanoSacado;
    const marcadosAqui = t.panos.filter((p) => elegidos.has(p.id)).map((p) => p.numero);

    // Se avanza tantas veces como paños ya marcados haya en este tanque,
    // saltando los que ya están marcados.
    for (let i = 0; i < marcadosAqui.length; i++) {
      ultimo = siguienteEnOrden(t.ordenRotacion, ultimo);
    }
    return siguienteEnOrden(t.ordenRotacion, ultimo);
  }

  /** El primero sin marcar de la rotación: ese es el que se resalta. */
  function tocaEn(t) {
    let ultimo = t.ultimoPanoSacado;
    for (let i = 0; i < t.ordenRotacion.length; i++) {
      const n = siguienteEnOrden(t.ordenRotacion, ultimo);
      const pano = t.panos.find((p) => p.numero === n);
      if (!pano) return null;
      if (!elegidos.has(pano.id)) return pano;
      ultimo = n;
    }
    return null;
  }

  const dibujar = () => {
    pantalla.innerHTML = `
      <button class="secundario chico" id="volver">‹ ${esc(opciones.textoVolver || 'Producción de hielo')}</button>
      ${opciones.paso ? `<p class="paso-de">${esc(opciones.paso)}</p>` : ''}
      <h2 style="margin-top:14px">${esc(opciones.titulo || 'Registrar lo que se sacó')}</h2>
      <p class="ayuda">
        Marca los paños que te dijeron. Se registran todos de golpe, a nombre
        de quien los sacó, con la hora de ahora.
      </p>

      <div class="tarjeta">
        <label for="quien">¿Quién los sacó?</label>
        <select id="quien">
          ${obreros.map((o) => `
            <option value="${esc(o.id)}" ${o.id === quienId ? 'selected' : ''}>
              ${esc(o.nombre)}
            </option>`).join('')}
          <option value="" ${quienId ? '' : 'selected'}>
            Otro… ${quienNombre ? `(${esc(quienNombre)})` : ''}
          </option>
        </select>

        <label style="margin-top:16px">Agua con la que se rellenó</label>
        <div class="fila-botones">
          <button class="${agua === 'purificada' ? '' : 'secundario'}" data-agua="purificada">Purificada</button>
          <button class="${agua === 'potable' ? 'agua-potable-activa' : 'secundario'}" data-agua="potable">Potable</button>
        </div>

        <label style="margin-top:16px">¿Cómo salió el hielo?</label>
        <div class="calidades">
          ${CALIDADES.map((c) => `
            <button class="calidad-boton ${esc(c.clave)} ${c.clave === calidadLote ? 'elegida' : ''}"
                    data-calidad="${esc(c.clave)}">
              <span class="calidad-icono">${c.icono}</span>
              <span class="calidad-nombre">${esc(c.plural)}</span>
            </button>`).join('')}
        </div>
        <p class="ayuda calidad-nota">
          ${esc(CALIDADES.find((c) => c.clave === calidadLote)?.nota || '')}
        </p>

        ${calidadLote === 'otro' && notaLote ? `
          <p class="nota-escrita">✎ ${esc(notaLote)}
            <button class="enlace" id="editar-nota">cambiar</button></p>` : ''}

        ${pideDestino(calidadLote) ? `
          <label style="margin-top:14px">¿Qué se hizo con ese hielo?</label>
          <div class="fila-botones">
            ${DESTINOS.map((d) => `
              <button class="${d.clave === destinoLote ? '' : 'secundario'}"
                      data-destino="${esc(d.clave)}">${d.icono} ${esc(d.nombre)}</button>`).join('')}
          </div>` : ''}
      </div>

      ${porTanque.map((t) => {
        const toca = tocaEn(t);
        return `
        <h3>${esc(t.nombre)}</h3>
        <div class="rejilla-panos">
          ${t.panos.map((p) => `
            <button class="ficha-pano ${elegidos.has(p.id) ? 'elegido' : ''}
                            ${toca && toca.id === p.id ? 'toca' : ''}
                            ${valesPorPano[p.id] ? 'autorizado' : ''}"
                    data-elegir="${esc(p.id)}" data-tanque-ficha="${esc(t.id)}"
                    >${p.numero}</button>`).join('')}
        </div>`; }).join('')}

      <div class="total-vivo" style="margin-top:18px">
        <span>paños marcados</span>
        <strong>${elegidos.size}</strong>
        <small>${calcular()} marquetas</small>
      </div>

      <div class="acciones-centradas">
        <button id="guardar" ${elegidos.size ? '' : 'disabled'}>
          ${esc(opciones.textoBoton || 'Registrar')} ${elegidos.size}
          ${elegidos.size === 1 ? 'paño' : 'paños'}
        </button>
        ${opciones.textoSaltar ? `
          <button class="secundario" id="saltar">${esc(opciones.textoSaltar)}</button>` : ''}
      </div>`;

    pantalla.querySelector('#volver').onclick = alVolver;
    pantalla.querySelector('#quien').onchange = async (e) => {
      quienId = e.target.value;
      if (!quienId) {
        const nombre = await pedirTexto({
          titulo: '¿Quién los sacó?',
          texto: 'El nombre de quien sacó los paños. Queda guardado tal cual, ' +
                 'y también queda quién lo anotó.',
          valor: quienNombre, marcador: 'Juan', ok: 'Ese fue', largo: 40, unaLinea: true
        });
        if (nombre) quienNombre = nombre;
        else if (!quienNombre) { quienId = obreros[0]?.id || ''; }
        dibujar();
      }
    };

    pantalla.querySelectorAll('[data-agua]').forEach((b) => {
      b.onclick = () => { agua = b.dataset.agua; localStorage.setItem('tipo_agua', agua); dibujar(); };
    });
    pantalla.querySelectorAll('[data-calidad]').forEach((b) => {
      b.onclick = async () => {
        const clave = b.dataset.calidad;
        if (pideNota(clave)) {
          const texto = await pedirNota(notaLote);
          if (!texto) return;
          notaLote = texto;
        } else { notaLote = ''; }
        calidadLote = clave;
        dibujar();
      };
    });
    const btnNota = pantalla.querySelector('#editar-nota');
    if (btnNota) btnNota.onclick = async () => {
      const texto = await pedirNota(notaLote);
      if (texto) { notaLote = texto; dibujar(); }
    };
    pantalla.querySelectorAll('[data-destino]').forEach((b) => {
      b.onclick = () => { destinoLote = b.dataset.destino; dibujar(); };
    });
    pantalla.querySelectorAll('[data-elegir]').forEach((b) => {
      b.onclick = () => marcar(b.dataset.elegir, b.dataset.tanqueFicha);
    });

    const btnSaltar = pantalla.querySelector('#saltar');
    if (btnSaltar) btnSaltar.onclick = () => alGuardar(null);

    pantalla.querySelector('#guardar').onclick = async () => {
      try {
        const r = await api.enviar('/produccion/lote', {
          ejecutorId: quienId || null, ejecutorNombre: quienNombre || null,
          panos: [...elegidos], tipoAgua: agua, vales: valesPorPano,
          calidad: calidadLote, destino: destinoLote, nota: notaLote || null
        });
        avisar(`${r.panos.length} paños · ${r.marquetas} al cuarto frío` +
               (r.mezcla.fueraDelAlmacen
                 ? ` · ${r.mezcla.fueraDelAlmacen} no entraron` : ''), 'bien');
        alGuardar(r);
      } catch (e) { avisar(e.message, 'error'); }
    };
  };

  /** Marca o desmarca un paño, pidiendo permiso si rompe la rotación. */
  async function marcar(panoId, tanqueId) {
    if (elegidos.has(panoId)) {
      elegidos.delete(panoId);
      delete valesPorPano[panoId];
      return dibujar();
    }

    const t = porTanque.find((x) => x.id === tanqueId);
    const esperado = siguienteDe(t);
    const pano = t.panos.find((p) => p.id === panoId);

    if (pano.numero === esperado) {
      elegidos.add(panoId);
      return dibujar();
    }

    const auth = await pedirAutorizacion({
      titulo: `El paño ${pano.numero} no es el que sigue`,
      texto: `En el tanque ${t.nombre} tocaba el ${esperado}. ` +
             'Un gerente o el administrador tiene que autorizarlo con su PIN.',
      responsables: todos.responsables
    });
    if (!auth) return;

    try {
      const r = await api.enviar('/produccion/autorizar', { panoId, ...auth });
      valesPorPano[panoId] = r.vale;
      elegidos.add(panoId);
      avisar(`Autorizado por ${r.autorizadaPor}`, 'bien');
      dibujar();
    } catch (e) { avisar(e.message, 'error'); }
  }

  function calcular() {
    let n = 0;
    for (const t of porTanque) for (const p of t.panos) if (elegidos.has(p.id)) n += p.total_moldes;
    return n;
  }

  dibujar();
}
