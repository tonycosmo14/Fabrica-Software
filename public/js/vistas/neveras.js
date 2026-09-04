/**
 * LAS NEVERAS EN COMODATO  (v5.1)
 *
 * Dos pantallas, como en La raya:
 *
 *   LA LISTA  — arriba lo que hay que atender hoy, luego el mapa con
 *               todas, y debajo la lista completa.
 *   LA FICHA  — dónde está, cuánto ha ganado, sus fallas, sus pedidos y
 *               su contrato.
 *
 * EL ORDEN NO ES DECORATIVO. Lo primero que se ve son las que llevan días
 * sin pedir y las descompuestas, porque son las únicas que piden que
 * alguien haga algo hoy. Lo demás es para cuando se viene a buscar algo, y
 * eso pasa menos veces.
 */
import { api } from '../api.js';
import { esc, avisar, fechaCorta, soloDia } from '../util.js';
import { confirmar, pedirTexto, pedirEntero, pedirImporte, menu } from '../dialogo.js';
import { pesos } from '../fracciones.js';
import { mapa, enlaceMaps } from '../mapa.js';
import { ubicacionDe, elegirEnMapa } from '../ubicacion.js';
import { imprimirHoja } from '../imprimir.js';

export async function vistaNeveras(pantalla) {
  let d;
  let verBaja = false;
  await lista();

  // ==========================================================
  // LA LISTA
  // ==========================================================
  async function lista() {
    pantalla.innerHTML = '<div class="cargando">Buscando las neveras…</div>';
    try { d = await api.obtener(`/neveras${verBaja ? '?baja=1' : ''}`); }
    catch (e) { pantalla.innerHTML = `<p class="vacio">${esc(e.message)}</p>`; return; }

    const p = d.pendientes;
    const conMapa = d.neveras.filter((n) => n.comodato?.latitud != null);

    pantalla.innerHTML = `
      <div class="cabecera-pantalla">
        <h2>Las neveras</h2>
        <p class="ayuda">
          Dónde está cada una, cómo va, y cuáles piden que alguien vaya hoy.
          <button class="secundario chico" id="nueva">+ Nevera</button>
          <button class="secundario chico" id="ajustes">Ajustes</button>
        </p>
      </div>

      ${tablero(p)}
      ${resumen()}

      ${conMapa.length ? `
        <div class="tarjeta ancho-completo">
          <h3 style="margin:0 0 4px">Dónde están</h3>
          <p class="ayuda" style="margin:0 0 12px">
            ${conMapa.length} de ${d.neveras.length} tienen ubicación puesta.
            Toca una chincheta para abrir su ficha.
          </p>
          <div id="mapa" class="mapa-caja"></div>
        </div>` : ''}

      <div class="tarjeta ancho-completo">
        <div class="nevera-cabeza">
          <h3 style="margin:0">Todas</h3>
          <button class="secundario chico" id="ver-baja">
            ${verBaja ? 'Ocultar las de baja' : 'Ver también las de baja'}
          </button>
        </div>
        ${d.neveras.length
          ? `<div class="nevera-lista">${d.neveras.map(tarjeta).join('')}</div>`
          : '<p class="vacio">Todavía no hay ninguna nevera dada de alta.</p>'}
      </div>`;

    if (conMapa.length) {
      mapa(pantalla.querySelector('#mapa'), {
        puntos: conMapa.map((n) => ({
          id: n.id, numero: n.numero,
          lat: n.comodato.latitud, lon: n.comodato.longitud,
          etiqueta: `${n.numero} · ${n.comodato.quien || ''}`,
          tono: n.ritmo.seTardo ? 'tarde' : (n.pendientes ? 'malo' : 'bien')
        })),
        alTocar: (id) => ficha(id)
      });
    }

    pantalla.querySelector('#nueva').onclick = nueva;
    pantalla.querySelector('#ajustes').onclick = ajustes;
    pantalla.querySelector('#ver-baja').onclick = () => { verBaja = !verBaja; lista(); };
    pantalla.querySelectorAll('[data-ficha]').forEach((x) => {
      x.onclick = () => ficha(x.dataset.ficha);
    });
  }

  /**
   * LO QUE PIDE ACCIÓN HOY.
   *
   * Solo sale lo que hay: un tablero con cuatro cuadros en cero enseña
   * cuatro veces la palabra "ninguna" y se deja de mirar a la semana.
   */
  function tablero(p) {
    const cuadros = [
      p.sinPedir.length && {
        tono: 'tarde', icono: '📞', n: p.sinPedir.length,
        que: p.sinPedir.length === 1 ? 'lleva días sin pedir' : 'llevan días sin pedir',
        quienes: p.sinPedir
      },
      p.descompuestas.length && {
        tono: 'malo', icono: '🔧', n: p.descompuestas.length,
        que: p.descompuestas.length === 1 ? 'necesita reparación' : 'necesitan reparación',
        quienes: p.descompuestas
      },
      p.vencidas.length && {
        tono: 'tarde', icono: '📅', n: p.vencidas.length,
        que: 'ya se pasaron de la fecha de devolución',
        quienes: p.vencidas
      },
      p.perdidas.length && {
        tono: 'perdida', icono: '❓', n: p.perdidas.length,
        que: 'no se sabe dónde están',
        quienes: p.perdidas
      }
    ].filter(Boolean);

    if (!cuadros.length) return '';

    return `<div class="nevera-tablero">
      ${cuadros.map((c) => `
        <div class="nevera-alerta ${c.tono}">
          <b>${c.icono} ${c.n} ${esc(c.que)}</b>
          <span>${c.quienes.slice(0, 6).map((n) =>
            `<button class="nevera-chip" data-ficha="${esc(n.id)}">${esc(n.numero)}${
              n.comodato?.quien ? ` · ${esc(n.comodato.quien)}` : ''}</button>`).join('')}
            ${c.quienes.length > 6 ? `<small>y ${c.quienes.length - 6} más</small>` : ''}
          </span>
        </div>`).join('')}
    </div>`;
  }

  /** Cuántas hay de cada estado, en un renglón. */
  function resumen() {
    const e = d.porEstado;
    const partes = Object.entries(d.estados)
      .filter(([clave]) => e[clave])
      .map(([clave, info]) =>
        `<span class="nevera-cuenta ${info.tono}"><b>${e[clave]}</b> ${esc(info.nombre)}</span>`);
    return partes.length ? `<div class="nevera-resumen">${partes.join('')}</div>` : '';
  }

  function tarjeta(n) {
    const c = n.cuenta;
    return `
      <button class="nevera-tarjeta ${n.tono}" data-ficha="${esc(n.id)}">
        <span class="nevera-numero">${esc(n.numero)}</span>

        <span class="nevera-quien">
          <b>${esc(n.comodato?.quien || n.etiqueta)}</b>
          <small>${n.comodato?.direccion_util
            ? esc(n.comodato.direccion_util)
            : `${esc([n.marca, n.modelo].filter(Boolean).join(' ')) || 'sin marca'}`}</small>
        </span>

        <span class="nevera-dato">
          <small>Estado</small>
          <b class="nevera-estado ${n.tono}">${esc(n.corto || n.etiqueta)}</b>
        </span>

        <span class="nevera-dato der">
          <small>${c.sinCosto ? 'Ha vendido' : (c.sePago ? 'A favor' : 'Le falta')}</small>
          <b class="${c.sinCosto ? '' : (c.sePago ? 'bien' : 'malo')}">${
            c.sinCosto ? pesos(c.vendido.centavos) : pesos(Math.abs(c.aFavor))}</b>
        </span>

        <span class="nevera-dato der">
          <small>Último pedido</small>
          <b class="${n.ritmo.seTardo ? 'malo' : ''}">${
            n.ritmo.dias == null ? '—'
            : n.ritmo.nuncaPidio ? 'nunca'
            : n.ritmo.dias === 0 ? 'hoy'
            : `hace ${n.ritmo.dias} d`}</b>
        </span>

        <span class="nevera-flecha">${n.pendientes ? '🔧' : '›'}</span>
      </button>`;
  }

  // ==========================================================
  // LA FICHA
  // ==========================================================
  async function ficha(id) {
    pantalla.innerHTML = '<div class="cargando">Cargando…</div>';

    let n;
    try { n = (await api.obtener(`/neveras/${id}`)).nevera; }
    catch (e) { pantalla.innerHTML = `<p class="vacio">${esc(e.message)}</p>`; return; }

    const co = n.comodato;
    const c = n.cuenta;

    pantalla.innerHTML = `
      <div class="cabecera-pantalla">
        <button class="secundario chico" id="volver">‹ Las neveras</button>
        <h2>Nevera ${esc(n.numero)}
          <span class="nevera-estado ${n.tono}">${esc(n.etiqueta)}</span></h2>
        <p class="ayuda">
          ${esc([n.marca, n.modelo].filter(Boolean).join(' ')) || 'sin marca capturada'}
          ${n.bolsas ? ` · le caben <b>${n.bolsas} bolsas</b>` : ''}
          ${n.serie ? ` · serie ${esc(n.serie)}` : ''}
        </p>
      </div>

      ${n.pendientes.length ? `
        <div class="nevera-alerta malo" style="margin-bottom:14px">
          <b>🔧 ${n.pendientes.length === 1 ? 'Tiene una falla sin atender'
                                            : `Tiene ${n.pendientes.length} fallas sin atender`}</b>
          <span>${n.pendientes.map((s) => `${esc(s.que_tiene)}
            <small>· reportó ${esc(s.quien_reporto || s.reportado_por_nombre || '—')},
            ${esc(fechaCorta(s.reportado_en))}</small>`).join('<br>')}</span>
        </div>` : ''}

      <div class="corte-tablero">
        <div class="corte-columna">
          ${tarjetaDonde(n, co)}
          ${tarjetaCuenta(n, c)}
        </div>
        <div class="corte-columna">
          ${tarjetaPedidos(n)}
          ${tarjetaServicios(n)}
        </div>
      </div>`;

    if (co?.latitud != null) {
      mapa(pantalla.querySelector('#mapa-ficha'), {
        puntos: [{ id: n.id, numero: n.numero, lat: co.latitud, lon: co.longitud,
                   etiqueta: co.quien || '', tono: 'bien' }],
        zoom: 17, centro: { lat: co.latitud, lon: co.longitud }
      });
    }

    engancharFicha(n, co);
  }

  function tarjetaDonde(n, co) {
    const maps = co ? enlaceMaps(co.latitud, co.longitud, co.direccion_util) : null;
    const wa = telefonoWhatsapp(co);

    return `
      <div class="tarjeta">
        <h3 style="margin:0 0 4px">Dónde está</h3>

        ${co ? `
          <p class="nevera-grande">${esc(co.quien || '—')}</p>
          <p class="ayuda" style="margin:0 0 12px">
            ${co.negocio ? `${esc(co.negocio)} · ` : ''}
            desde el ${esc(soloDia(co.desde, { conAnio: true }))}
            ${co.hasta_previsto
              ? ` · <b class="${co.hasta_previsto < hoy() ? 'malo' : ''}">se devuelve el
                  ${esc(soloDia(co.hasta_previsto, { conAnio: true }))}</b>` : ''}
          </p>

          <table class="tabla">
            <tr><td>Dirección</td>
                <td class="der">${esc(co.direccion_util || '—')}</td></tr>
            ${co.referencias ? `<tr><td>Referencias</td>
                <td class="der">${esc(co.referencias)}</td></tr>` : ''}
            <tr><td>Responsable</td>
                <td class="der">${esc(co.responsable || '—')}</td></tr>
            <tr><td>Teléfono</td>
                <td class="der">${esc(co.telefono_util || '—')}</td></tr>
            <tr><td>Avisa si no pide en</td>
                <td class="der">${co.dias_aviso || d.diasAviso} días
                  ${co.dias_aviso ? '' : '<small>(el general)</small>'}</td></tr>
          </table>

          ${co.latitud != null
            ? '<div id="mapa-ficha" class="mapa-caja chico" style="margin-top:12px"></div>'
            : `<p class="ayuda" style="margin:12px 0 0">
                 Sin ubicación puesta. <b>Poner ubicación</b> abajo, pegando
                 el enlace que Google Maps da al compartir.</p>`}

          <div class="nevera-acciones">
            ${wa ? `<a class="boton-enlace" href="${wa}" target="_blank"
                       rel="noopener">💬 WhatsApp</a>` : ''}
            ${maps ? `<a class="boton-enlace" href="${maps}" target="_blank"
                         rel="noopener">📍 Cómo llegar</a>` : ''}
            <button class="secundario" id="editar-comodato">Cambiar los datos</button>
            <button class="secundario" id="contrato">📄 Contrato</button>
            ${co.documento
              ? `<a class="boton-enlace" href="/api/neveras/comodatos/${co.id}/documento"
                    target="_blank" rel="noopener">📎 Ver el firmado</a>`
              : '<button class="secundario" id="subir-doc">📎 Subir el firmado</button>'}
            <button class="secundario" id="devolver">↩ La recogimos</button>
          </div>`

        : `<p class="nevera-grande">${esc(n.etiqueta)}</p>
           <p class="ayuda" style="margin:0 0 14px">
             ${n.estado === 'bodega' ? 'Está en la fábrica, lista para prestarse.'
             : n.estado === 'reparacion' ? 'Hay que arreglarla antes de prestarla.'
             : n.estado === 'perdida' ? 'Nadie sabe dónde está. Si aparece, se marca de vuelta.'
             : n.estado === 'baja' ? `De baja${n.motivo_baja ? `: ${esc(n.motivo_baja)}` : ''}.`
             : ''}
           </p>
           <div class="nevera-acciones">
             ${n.estado !== 'baja'
               ? '<button id="entregar">📦 Entregar a alguien</button>' : ''}
             <button class="secundario" id="cambiar-estado">Cambiar el estado</button>
           </div>`}

        <div class="nevera-acciones" style="margin-top:10px">
          <button class="secundario" id="reportar">🔧 Reporta falla</button>
          <button class="secundario" id="cortesia">🎁 Regalé bolsas</button>
          <button class="secundario" id="editar">Editar la nevera</button>
          ${n.estado !== 'baja'
            ? '<button class="secundario peligro-suave" id="baja">Dar de baja</button>' : ''}
        </div>
      </div>`;
  }

  /**
   * ¿YA SE PAGÓ?
   *
   * El número grande de la ficha, y el que decide si conviene comprar más
   * neveras o recoger ésta.
   */
  function tarjetaCuenta(n, c) {
    return `
      <div class="tarjeta ${c.sinCosto ? '' : (c.sePago ? 'cuadre-exacto' : 'cuadre-diferencia')}">
        <h3 style="margin:0 0 4px">${c.sinCosto ? 'Lo que ha vendido' : '¿Ya se pagó?'}</h3>

        ${c.sinCosto ? `
          <p class="nevera-grande">${pesos(c.vendido.centavos)}</p>
          <p class="ayuda" style="margin:0 0 12px">
            No se puede decir si se pagó porque <b>no tiene capturado lo que
            costó</b>. Ponlo en «Editar la nevera» y este número cambia a
            decirte si ya se pagó sola.
          </p>`
        : `
          <p class="nevera-grande ${c.sePago ? 'bien' : 'malo'}">
            ${c.sePago ? `+${pesos(c.aFavor)}` : pesos(Math.abs(c.aFavor))}
          </p>
          <p class="ayuda" style="margin:0 0 12px">
            ${c.sePago
              ? 'Ya se pagó sola, y esto es lo que lleva ganado encima.'
              : 'Es lo que le falta para pagarse.'}
          </p>`}

        <table class="tabla">
          <tr><td>Ha comprado en bolsas
                  <small>${c.vendido.veces} ${c.vendido.veces === 1 ? 'pedido' : 'pedidos'}
                  · ${c.vendido.piezas} bolsas</small></td>
              <td class="der bien">+${pesos(c.vendido.centavos)}</td></tr>
          ${c.costoCentavos ? `<tr><td>Lo que costó la nevera</td>
              <td class="der malo">−${pesos(c.costoCentavos)}</td></tr>` : ''}
          ${c.mantenimiento.centavos ? `<tr><td>Reparaciones
                  <small>${c.mantenimiento.cuantos}</small></td>
              <td class="der malo">−${pesos(c.mantenimiento.centavos)}</td></tr>` : ''}
          ${c.cortesias.centavos ? `<tr><td>Lo que se le ha regalado
                  <small>${c.cortesias.piezas} bolsas</small></td>
              <td class="der malo">−${pesos(c.cortesias.centavos)}</td></tr>` : ''}
        </table>

        ${c.cortesias.piezas && !c.cortesias.centavos ? `
          <p class="ayuda" style="margin:10px 0 0;font-size:13px">
            Las ${c.cortesias.piezas} bolsas regaladas no tienen valor
            capturado, así que no restan. Al anotar una cortesía conviene
            ponerle cuánto valía.
          </p>` : ''}
      </div>`;
  }

  function tarjetaPedidos(n) {
    return `
      <div class="tarjeta">
        <h3 style="margin:0 0 4px">Cómo va pidiendo</h3>
        <p class="ayuda" style="margin:0 0 12px">
          ${n.ritmo.dias == null
            ? 'No está prestada, así que no hay ritmo que vigilar.'
            : n.ritmo.nuncaPidio
              ? `<b class="malo">Nunca ha pedido</b> desde que se le entregó,
                 hace ${n.ritmo.dias} días.`
              : `Último pedido <b class="${n.ritmo.seTardo ? 'malo' : ''}">${
                  n.ritmo.dias === 0 ? 'hoy'
                  : n.ritmo.dias === 1 ? 'ayer'
                  : `hace ${n.ritmo.dias} días`}</b>. Avisa a los ${n.ritmo.limite}.`}
        </p>

        ${n.pedidos.length ? `
          <table class="tabla">
            <tr><th>Cuándo</th><th class="der">Bolsas</th><th class="der">Cuánto</th></tr>
            ${n.pedidos.map((p) => `
              <tr><td>${esc(fechaCorta(p.fecha))}
                      <small>#${esc(p.folio)}</small></td>
                  <td class="der">${p.piezas}</td>
                  <td class="der">${pesos(p.centavos)}</td></tr>`).join('')}
          </table>`
          : '<p class="vacio" style="margin:0">Todavía no hay pedidos de bolsas.</p>'}

        ${n.cortesias.length ? `
          <h4 style="margin:16px 0 6px">Lo que se le ha regalado</h4>
          <table class="tabla">
            ${n.cortesias.map((c) => `
              <tr><td>${esc(soloDia(c.fecha))}
                      <small>${esc(c.motivo)}${c.notas ? ` · ${esc(c.notas)}` : ''}</small></td>
                  <td class="der">${c.cuantas} bolsas</td>
                  <td class="der">${c.centavos ? pesos(c.centavos) : '—'}</td></tr>`).join('')}
          </table>` : ''}
      </div>`;
  }

  function tarjetaServicios(n) {
    if (!n.servicios.length) {
      return `<div class="tarjeta">
        <h3 style="margin:0 0 4px">Mantenimientos</h3>
        <p class="vacio" style="margin:8px 0 0">Nunca se le ha hecho nada. Buena señal.</p>
      </div>`;
    }

    return `
      <div class="tarjeta">
        <h3 style="margin:0 0 12px">Mantenimientos</h3>
        <table class="tabla">
          ${n.servicios.map((s) => `
            <tr class="${s.anulado_en ? 'anulada' : ''}">
              <td>
                <b>${esc(s.que_tiene)}</b>
                <small>${esc(fechaCorta(s.reportado_en))}
                  ${s.quien_reporto ? `· lo reportó ${esc(s.quien_reporto)}` : ''}</small>
                ${s.que_se_hizo ? `<small class="nevera-hecho">✓ ${esc(s.que_se_hizo)}${
                  s.quien_lo_hizo ? ` — ${esc(s.quien_lo_hizo)}` : ''}</small>` : ''}
              </td>
              <td class="der">
                ${s.anulado_en ? '<span class="hist-que que-cancelada">anulado</span>'
                : s.atendido_en
                  ? `<b>${s.costo_centavos ? pesos(s.costo_centavos) : 'sin costo'}</b>
                     <small>${esc(soloDia(s.atendido_en))}</small>`
                  : `<button class="secundario chico" data-atender="${esc(s.id)}">
                       Atender</button>`}
              </td>
            </tr>`).join('')}
        </table>
      </div>`;
  }

  // ==========================================================
  // LO QUE SE PUEDE HACER
  // ==========================================================

  const hoy = () => new Date().toISOString().slice(0, 10);

  /** El enlace de WhatsApp con el mensaje ya escrito. */
  function telefonoWhatsapp(co) {
    const tel = String(co?.telefono_util || '').replace(/\D/g, '');
    if (tel.length < 10) return null;
    // México: si vienen los diez dígitos, se les pone el 52 de país.
    const numero = tel.length === 10 ? `52${tel}` : tel;

    const texto = (d.mensajeWhatsapp || '')
      .replace(/\{responsable\}/g, co.responsable || co.quien || '')
      .replace(/\{cliente\}/g, co.quien || '')
      .replace(/\{negocio\}/g, 'Hielo LOLHA')
      .replace(/\{dias\}/g, '');

    return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
  }

  function engancharFicha(n, co) {
    const cuando = (id, f) => {
      const b = pantalla.querySelector(`#${id}`);
      if (b) b.onclick = f;
    };

    cuando('volver', lista);
    cuando('editar', () => editar(n));
    cuando('entregar', () => entregar(n));
    cuando('devolver', () => devolver(n, co));
    cuando('editar-comodato', () => editarComodato(n, co));
    cuando('contrato', () => contrato(co));
    cuando('subir-doc', () => subirDocumento(n, co));
    cuando('reportar', () => reportar(n));
    cuando('cortesia', () => cortesia(n));
    cuando('cambiar-estado', () => cambiarEstado(n));
    cuando('baja', () => darDeBaja(n));

    pantalla.querySelectorAll('[data-atender]').forEach((x) => {
      x.onclick = () => atender(n, x.dataset.atender);
    });
  }

  // ---- ALTA Y EDICIÓN ----

  async function pedirDatos(n = null) {
    const numero = await pedirTexto({
      titulo: n ? `Nevera ${n.numero}` : 'Nevera nueva',
      texto: 'El número que va pegado en la nevera. Es con el que se le llama.',
      valor: n?.numero || '', marcador: '12', unaLinea: true, largo: 20
    });
    if (numero === null) return null;

    const marca = await pedirTexto({
      titulo: 'Marca y modelo', texto: 'Como venga en la placa. Si no se sabe, déjalo en blanco.',
      valor: [n?.marca, n?.modelo].filter(Boolean).join(' '),
      marcador: 'Torrey CHC-16', unaLinea: true, opcional: true, largo: 120
    });
    if (marca === null) return null;

    const bolsas = await pedirEntero({
      titulo: '¿Cuántas bolsas le caben?',
      texto: 'Es lo que decide a qué cliente le queda. Si no se sabe, déjalo en blanco.',
      valor: n?.bolsas ?? '', marcador: '60', opcional: true
    });
    if (bolsas === null) return null;

    const costo = await pedirImporte({
      titulo: '¿Cuánto costó?',
      texto: 'Sin esto no se puede decir si la nevera ya se pagó sola, que es ' +
             'el número que dice si conviene comprar más.',
      valor: n?.costo_centavos ? String(n.costo_centavos / 100) : '', opcional: true
    });
    if (costo === null) return null;

    const [primera, ...resto] = String(marca || '').trim().split(/\s+/);
    return {
      numero, bolsas: bolsas === '' ? null : bolsas, costo,
      marca: primera || null, modelo: resto.join(' ') || null,
      serie: n?.serie || null, fechaCompra: n?.fecha_compra || null, notas: n?.notas || null
    };
  }

  async function nueva() {
    const datos = await pedirDatos();
    if (!datos) return;
    try {
      const r = await api.enviar('/neveras', datos);
      avisar(`Nevera ${r.nevera.numero} dada de alta`, 'bien');
      ficha(r.nevera.id);
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function editar(n) {
    const datos = await pedirDatos(n);
    if (!datos) return;
    try {
      await api.actualizar(`/neveras/${n.id}`, datos);
      avisar('Guardado', 'bien');
      ficha(n.id);
    } catch (e) { avisar(e.message, 'error'); }
  }

  // ---- ENTREGAR ----

  async function entregar(n) {
    const tipo = await menu({
      titulo: `Entregar la nevera ${n.numero}`,
      texto: '¿A quién se le entrega?',
      opciones: [
        { valor: 'cliente', texto: 'A un cliente', detalle: 'Los de siempre, por años' },
        { valor: 'evento', texto: 'A un evento o feria',
          detalle: 'Prestada unos días, con fecha de devolución' },
        { valor: 'fabrica', texto: 'La usa la fábrica', detalle: 'Se queda aquí adentro' }
      ]
    });
    if (!tipo) return;

    const cuerpo = { tipo, desde: hoy() };

    if (tipo === 'cliente') {
      const cliente = await elegirCliente();
      if (cliente === null) return;
      if (cliente.id) cuerpo.clienteId = cliente.id;
      else cuerpo.nombre = cliente.nombre;
    } else if (tipo === 'evento') {
      const nombre = await pedirTexto({
        titulo: '¿Qué evento?', texto: 'La feria, el nombre del lugar, lo que sea.',
        marcador: 'Feria de Hunucmá', unaLinea: true, largo: 120
      });
      if (!nombre) return;
      cuerpo.nombre = nombre;

      const hasta = await pedirTexto({
        titulo: '¿Cuándo se recoge?',
        texto: 'La fecha en que hay que ir por ella, en formato 2026-09-20. ' +
               'El sistema avisa si se pasa.',
        marcador: '2026-09-20', unaLinea: true, opcional: true, largo: 10
      });
      if (hasta === null) return;
      if (hasta) cuerpo.hastaPrevisto = hasta;
    }

    if (tipo !== 'fabrica') {
      const direccion = await pedirTexto({
        titulo: '¿Dónde queda?',
        texto: 'La dirección escrita. Es la que manda: el mapa necesita internet y ésta no.',
        marcador: 'Calle 20 x 15 y 17, centro', opcional: true, largo: 300
      });
      if (direccion === null) return;
      cuerpo.direccion = direccion;

      const responsable = await pedirTexto({
        titulo: '¿Quién responde por ella?',
        texto: 'Quien firma y a quien se le llama. No siempre es el dueño del negocio.',
        unaLinea: true, opcional: true, largo: 120
      });
      if (responsable === null) return;
      cuerpo.responsable = responsable;

      const telefono = await pedirTexto({
        titulo: 'Su teléfono',
        texto: 'Con diez dígitos. Es el del botón de WhatsApp.',
        marcador: '9991234567', unaLinea: true, opcional: true, largo: 30
      });
      if (telefono === null) return;
      cuerpo.telefono = telefono;
    }

    try {
      await api.enviar(`/neveras/${n.id}/entregar`, cuerpo);
      avisar('Entregada', 'bien');
      ficha(n.id);
    } catch (e) { avisar(e.message, 'error'); }
  }

  /** Elegir de los clientes dados de alta, o escribir un nombre suelto. */
  async function elegirCliente() {
    let clientes = [];
    try { clientes = (await api.obtener('/clientes')).clientes || []; }
    catch { clientes = []; }

    const opciones = clientes.slice(0, 40).map((c) => ({
      valor: c.id, texto: c.nombre, detalle: c.negocio || c.direccion || ''
    }));
    opciones.push({ valor: '__libre', texto: 'Escribir un nombre',
                    detalle: 'Para quien no está dado de alta' });

    const elegido = await menu({ titulo: '¿A qué cliente?', opciones });
    if (!elegido) return null;
    if (elegido !== '__libre') return { id: elegido };

    const nombre = await pedirTexto({
      titulo: '¿A nombre de quién?', unaLinea: true, largo: 120
    });
    return nombre ? { nombre } : null;
  }

  async function devolver(n, co) {
    const motivo = await pedirTexto({
      titulo: `Recogimos la nevera ${n.numero}`,
      texto: '¿Por qué se recogió? Cerró, no pedía, la cambiamos por otra…',
      opcional: true, largo: 300
    });
    if (motivo === null) return;

    const como = await menu({
      titulo: '¿Cómo volvió?',
      opciones: [
        { valor: 'bien', texto: 'Bien', detalle: 'Se puede volver a prestar' },
        { valor: 'mal', texto: 'Descompuesta', detalle: 'Queda marcada por reparar' }
      ]
    });
    if (!como) return;

    try {
      await api.enviar(`/neveras/comodatos/${co.id}/devolver`,
                       { motivo, descompuesta: como === 'mal' });
      avisar('Registrada como devuelta', 'bien');
      ficha(n.id);
    } catch (e) { avisar(e.message, 'error'); }
  }

  /**
   * Cambiar dirección, responsable, teléfono, días de aviso y ubicación.
   *
   * La ubicación se pone pegando el enlace que da Google Maps al
   * compartir: nadie va a teclear una latitud a mano, y del enlace se
   * sacan las coordenadas solas.
   */
  async function editarComodato(n, co) {
    const direccion = await pedirTexto({
      titulo: 'La dirección', valor: co.direccion || '', opcional: true, largo: 300
    });
    if (direccion === null) return;

    const responsable = await pedirTexto({
      titulo: 'Quién responde', valor: co.responsable || '',
      unaLinea: true, opcional: true, largo: 120
    });
    if (responsable === null) return;

    const telefono = await pedirTexto({
      titulo: 'Su teléfono', valor: co.telefono || '',
      marcador: '9991234567', unaLinea: true, opcional: true, largo: 30
    });
    if (telefono === null) return;

    // LA UBICACIÓN, DE DOS FORMAS  (v5.8.1): tocando el mapa —que es lo que
    // se hace parado frente a la tienda— o pegando el enlace del celular.
    const tiene = co.latitud != null && co.longitud != null;
    const como = await menu({
      titulo: '¿Dónde quedó la nevera?',
      texto: tiene
        ? `Ahora: ${Number(co.latitud).toFixed(5)}, ${Number(co.longitud).toFixed(5)}`
        : 'Todavía no tiene ubicación.',
      opciones: [
        { valor: 'mapa', texto: '🗺️ Tocar en el mapa', detalle: 'Se busca la tienda y se toca' },
        { valor: 'enlace', texto: '🔗 Pegar el enlace de Google Maps',
          detalle: 'El que da «Compartir» en el celular, corto o largo' },
        { valor: 'igual', texto: tiene ? 'Dejarla como está' : 'Sin ubicación por ahora' },
        ...(tiene ? [{ valor: 'quitar', texto: 'Quitar la ubicación', peligro: true }] : [])
      ]
    });
    if (!como) return;

    let punto = null;
    if (como === 'mapa') {
      punto = await elegirEnMapa({ titulo: `¿Dónde está la nevera ${n.numero}?`,
                                   lat: co.latitud, lon: co.longitud });
      if (!punto) return;
    } else if (como === 'enlace') {
      const enlace = await pedirTexto({
        titulo: 'El enlace de Google Maps',
        texto: 'Pega el que da «Compartir» en el celular. Sirve el corto (maps.app.goo.gl) ' +
               'y el largo. También las coordenadas tal cual: 21.0167, -89.8744',
        marcador: 'https://maps.app.goo.gl/…', unaLinea: true, largo: 600
      });
      if (enlace === null) return;
      if (enlace) {
        avisar('Leyendo el enlace…', '');
        punto = await ubicacionDe(enlace);
        if (!punto) {
          return avisar('De ahí no salieron coordenadas. Prueba con «Tocar en el mapa».', 'error');
        }
      }
    } else if (como === 'quitar') {
      punto = { lat: null, lon: null };
    }

    const dias = await pedirEntero({
      titulo: '¿A los cuántos días avisar?',
      texto: `Si este cliente no pide en tantos días, sale en el tablero. ` +
             `En blanco usa el general, que son ${d.diasAviso}.`,
      valor: co.dias_aviso ?? '', marcador: String(d.diasAviso), opcional: true
    });
    if (dias === null) return;

    const cuerpo = {
      direccion, responsable, telefono,
      diasAviso: dias === '' ? null : dias,
      referencias: co.referencias, hastaPrevisto: co.hasta_previsto, notas: co.notas,
      latitud: co.latitud, longitud: co.longitud
    };

    if (punto) {
      cuerpo.latitud = punto.lat;
      cuerpo.longitud = punto.lon;
    }

    try {
      await api.actualizar(`/neveras/comodatos/${co.id}`, cuerpo);
      avisar('Guardado', 'bien');
      ficha(n.id);
    } catch (e) { avisar(e.message, 'error'); }
  }

  // ---- EL CONTRATO ----

  /**
   * Saca el contrato relleno en una ventana para imprimir.
   *
   * Si le faltan datos se dice ANTES: descubrir que falta el domicilio con
   * el cliente enfrente y la pluma en la mano es la peor forma.
   */
  async function contrato(co) {
    let r;
    try { r = await api.obtener(`/neveras/comodatos/${co.id}/contrato`); }
    catch (e) { return avisar(e.message, 'error'); }

    if (r.faltan.length) {
      const seguir = await confirmar({
        titulo: 'Al contrato le faltan datos',
        texto: `Estos van a salir como una raya para llenar a mano: ` +
               `<b>${r.faltan.join(', ')}</b>.<br><br>` +
               `Los del negocio —representante, domicilio— se ponen una sola vez ` +
               `en Personalizar. ¿Lo imprimo así?`,
        ok: 'Imprimir así'
      });
      if (!seguir) return;
    }

    const area = document.getElementById('area-impresion');
    if (!area) return avisar('No se pudo preparar la impresión', 'error');
    // Solo el cuerpo: la hoja ya trae su propio estilo de página.
    area.innerHTML = String(r.html).replace(/^[\s\S]*<body[^>]*>|<\/body>[\s\S]*$/g, '');
    imprimirHoja();
  }

  async function subirDocumento(n, co) {
    const archivo = await elegirArchivo();
    if (!archivo) return;
    try {
      await api.actualizar(`/neveras/comodatos/${co.id}/documento`, { archivo });
      avisar('Documento guardado', 'bien');
      ficha(n.id);
    } catch (e) { avisar(e.message, 'error'); }
  }

  /** Abre el selector de archivos y devuelve el contenido en base64. */
  function elegirArchivo() {
    return new Promise((listo) => {
      const campo = document.createElement('input');
      campo.type = 'file';
      campo.accept = 'application/pdf,image/jpeg,image/png,image/webp';
      campo.onchange = () => {
        const f = campo.files?.[0];
        if (!f) return listo(null);
        const lector = new FileReader();
        lector.onload = () => listo(lector.result);
        lector.onerror = () => { avisar('No se pudo leer el archivo', 'error'); listo(null); };
        lector.readAsDataURL(f);
      };
      campo.click();
    });
  }

  // ---- FALLAS, CORTESÍAS Y ESTADOS ----

  async function reportar(n) {
    const queTiene = await pedirTexto({
      titulo: `¿Qué tiene la nevera ${n.numero}?`,
      texto: 'Como lo dijo quien avisó: "no enfría", "hace ruido", "gotea".',
      largo: 500
    });
    if (!queTiene) return;

    const quien = await pedirTexto({
      titulo: '¿Quién avisó?', texto: 'El cliente, el repartidor, quien sea.',
      valor: n.comodato?.responsable || n.comodato?.quien || '',
      unaLinea: true, opcional: true, largo: 120
    });
    if (quien === null) return;

    try {
      await api.enviar(`/neveras/${n.id}/servicios`,
                       { queTiene, quienReporto: quien, tipo: 'falla' });
      avisar('Anotado. La nevera queda marcada por reparar.', 'bien');
      ficha(n.id);
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function atender(n, servicioId) {
    const queSeHizo = await pedirTexto({
      titulo: '¿Qué se le hizo?',
      texto: 'Se cambió el termostato, se limpió el condensador…', largo: 500
    });
    if (!queSeHizo) return;

    const quien = await pedirTexto({
      titulo: '¿Quién lo hizo?', unaLinea: true, opcional: true, largo: 120
    });
    if (quien === null) return;

    const costo = await pedirImporte({
      titulo: '¿Cuánto costó?',
      texto: 'Se resta de lo que la nevera ha ganado. En blanco es cero.',
      opcional: true
    });
    if (costo === null) return;

    try {
      await api.enviar(`/neveras/servicios/${servicioId}/atender`,
                       { queSeHizo, quienLoHizo: quien, costo });
      avisar('Anotado', 'bien');
      ficha(n.id);
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function cortesia(n) {
    const cuantas = await pedirEntero({
      titulo: '¿Cuántas bolsas se le regalaron?', marcador: '10'
    });
    if (!cuantas) return;

    const motivo = await menu({
      titulo: '¿Por qué?',
      opciones: [
        { valor: 'cortesia', texto: 'Cortesía', detalle: 'Se le regalaron y ya' },
        { valor: 'promocion', texto: 'Promoción', detalle: 'Por una promoción' },
        { valor: 'cambio', texto: 'Cambio', detalle: 'Se le repuso lo que salió mal' },
        { valor: 'merma', texto: 'Merma', detalle: 'Se echaron a perder en la nevera' }
      ]
    });
    if (!motivo) return;

    const valor = await pedirImporte({
      titulo: '¿Cuánto valían?',
      texto: 'Se resta de lo que la nevera ha ganado. Sin esto, las bolsas ' +
             'regaladas no restan y el número sale mejor de lo que es.',
      opcional: true
    });
    if (valor === null) return;

    try {
      await api.enviar(`/neveras/${n.id}/cortesias`, { cuantas, motivo, valor });
      avisar('Anotado', 'bien');
      ficha(n.id);
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function cambiarEstado(n) {
    const estado = await menu({
      titulo: `La nevera ${n.numero}`,
      texto: '¿Cómo está?',
      opciones: [
        { valor: 'bodega', texto: 'En bodega', detalle: 'Aquí, lista para prestarse' },
        { valor: 'reparacion', texto: 'Por reparar', detalle: 'No sirve' },
        { valor: 'perdida', texto: 'No se sabe dónde está',
          detalle: 'Se marca así hasta que aparezca' },
        { valor: 'en_uso', texto: 'La usa la fábrica' }
      ]
    });
    if (!estado) return;

    try {
      await api.actualizar(`/neveras/${n.id}/estado`, { estado });
      ficha(n.id);
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function darDeBaja(n) {
    const motivo = await pedirTexto({
      titulo: `Dar de baja la nevera ${n.numero}`,
      texto: 'Se vendió, ya no sirve, se perdió para siempre. Queda con toda ' +
             'su historia: no se borra nada.',
      largo: 300
    });
    if (!motivo) return;

    try {
      await api.enviar(`/neveras/${n.id}/baja`, { motivo });
      avisar('Dada de baja', 'bien');
      lista();
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function ajustes() {
    const dias = await pedirEntero({
      titulo: '¿A los cuántos días avisar?',
      texto: 'Es el general, para las neveras que no tengan el suyo propio. ' +
             'El de cada cliente se pone en su ficha.',
      valor: d.diasAviso, marcador: '21'
    });
    if (dias === null) return;

    const mensaje = await pedirTexto({
      titulo: 'El mensaje de WhatsApp',
      texto: '{responsable}, {cliente} y {negocio} se rellenan solos.',
      valor: d.mensajeWhatsapp, largo: 600
    });
    if (mensaje === null) return;

    try {
      await api.actualizar('/neveras/ajustes',
                           { diasAviso: dias, mensajeWhatsapp: mensaje });
      avisar('Guardado', 'bien');
      lista();
    } catch (e) { avisar(e.message, 'error'); }
  }
}
