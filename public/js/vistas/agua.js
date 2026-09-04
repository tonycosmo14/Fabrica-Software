/**
 * LA PLANTA DE AGUA  (v5.2)
 *
 * Dos pantallas, como en Las neveras:
 *
 *   LA PLANTA — lo que hay que atender hoy, la vuelta de revisión, el
 *               número que manda, a dónde se fue el agua, y el tren de
 *               tratamiento en el orden que el agua lo atraviesa.
 *   LA FICHA  — un equipo: qué tiene puesto, cuánta vida le queda, sus
 *               servicios y todo lo que ha pasado por ese puesto.
 *
 * POR QUÉ LA VUELTA ES UN FORMULARIO Y NO UNA FILA DE PREGUNTAS.
 *
 * En las neveras, dar de alta una es algo que pasa dos veces al año, y ahí
 * una pregunta tras otra está bien: guía. Esto es lo contrario — se hace
 * TODOS LOS DÍAS, con siete números, con el aparato en una mano. Siete
 * ventanitas seguidas cada mañana harían que la vuelta se dejara de
 * anotar en una semana, y una planta sin lecturas es una planta a ciegas.
 * Todo cabe en una tarjeta y se guarda de un botón.
 */
import { api } from '../api.js';
import { esc, avisar, fechaCorta } from '../util.js';
import { confirmar, pedirTexto, pedirEntero, pedirImporte, menu } from '../dialogo.js';
import { pesos } from '../fracciones.js';

const NUM = new Intl.NumberFormat('es-MX');
const litros = (n) => (n == null ? '—' : `${NUM.format(Math.round(n))} L`);
const ppm = (n) => (n == null ? '—' : `${NUM.format(n)} ppm`);
const pct = (n) => (n == null ? '—' : `${n} %`);

export async function vistaAgua(pantalla) {
  let d;
  let cuadre = null;
  let ultimas = [];
  let verBaja = false;
  await planta();

  // ==========================================================
  // LA PLANTA
  // ==========================================================
  async function planta() {
    pantalla.innerHTML = '<div class="cargando">Revisando la planta…</div>';
    try {
      d = await api.obtener(`/agua${verBaja ? '?baja=1' : ''}`);
      cuadre = (await api.obtener('/agua/cuadre')).cuadre;
      ultimas = (await api.obtener('/agua/lecturas?limite=20')).lecturas;
    } catch (e) {
      pantalla.innerHTML = `<p class="vacio">${esc(e.message)}</p>`;
      return;
    }

    const p = d.pendientes;

    pantalla.innerHTML = `
      <div class="cabecera-pantalla">
        <h2>La planta de agua</h2>
        <p class="ayuda">
          Cómo está saliendo el agua, qué le toca a cada equipo y a dónde se fue.
          <button class="secundario chico" id="nuevo">+ Equipo</button>
          <button class="secundario chico" id="ajustes">Ajustes</button>
        </p>
      </div>

      ${tablero(p)}

      <div class="planta-dos">
        ${tarjetaVuelta(p)}
        ${tarjetaSalud(p)}
      </div>

      ${tarjetaCuadre()}
      ${tarjetaTren()}
      ${tarjetaLecturas()}
    `;

    dibujarLinea();
    conectarVuelta();

    pantalla.querySelector('#nuevo').onclick = nuevoEquipo;
    pantalla.querySelector('#ajustes').onclick = ajustes;
    const baja = pantalla.querySelector('#ver-baja');
    if (baja) baja.onclick = () => { verBaja = !verBaja; planta(); };
    pantalla.querySelectorAll('[data-ficha]').forEach((x) => {
      x.onclick = () => ficha(x.dataset.ficha);
    });
  }

  // ---- LO QUE HAY QUE ATENDER HOY ----

  /**
   * EL ORDEN ES EL DEL DAÑO, no el del catálogo.
   *
   * El cloro va primero de todo, y no es exageración: si el carbón se
   * saturó y está pasando cloro, las membranas —seis— se echan a perder
   * en días. Es lo único de esta pantalla que se arregla el mismo día o
   * se paga muy caro.
   */
  function tablero(p) {
    const avisos = [];

    if (p.cloro) {
      avisos.push(aviso('malo', '⚠️', 'Está pasando cloro por el carbón',
        `${ppm(p.cloro.cloro)} después del filtro. El carbón ya no lo está `
        + 'reteniendo, y el cloro que llega a las membranas se las come. '
        + 'Cambia el carbón antes de seguir produciendo.'));
    }
    if (p.tds) {
      avisos.push(aviso('malo', '🚱', 'El agua se pasó del TDS permitido',
        `Salió en ${ppm(p.tds.tds_salida)} y el límite está en `
        + `${ppm(p.ajustes.tdsMaximo)}. Esa agua no debería embotellarse.`));
    }
    if (p.rechazo) {
      avisos.push(aviso('tarde', '🌀', 'Las membranas se están acabando',
        `El rechazo de sales bajó a ${pct(p.rechazo.rechazo)} y el mínimo es `
        + `${pct(p.ajustes.rechazoMinimo)}. Ve pidiendo membranas.`));
    }
    if (p.dureza) {
      avisos.push(aviso('tarde', '🧂', 'Hay que regenerar el suavizador',
        `La dureza salió en ${ppm(p.dureza.dureza)} y el límite es `
        + `${ppm(p.ajustes.durezaMaxima)}. El sarro tapa las membranas.`));
    }
    if (p.vencidas.length) {
      avisos.push(aviso('tarde', '🔧', `${p.vencidas.length} ${
        p.vencidas.length === 1 ? 'pieza ya cumplió' : 'piezas ya cumplieron'} su vida`,
        p.vencidas.map((e) => e.nombre).join(' · ')));
    }
    if (p.descompuestos.length) {
      avisos.push(aviso('malo', '🛠️', `${p.descompuestos.length} ${
        p.descompuestos.length === 1 ? 'equipo descompuesto' : 'equipos descompuestos'}`,
        p.descompuestos.map((e) => e.nombre).join(' · ')));
    }
    if (p.sinLectura) {
      avisos.push(aviso('perdida', '📋',
        p.diasSinLectura == null ? 'Todavía no hay ninguna lectura'
          : `Van ${p.diasSinLectura} días sin tomar lectura`,
        'Sin lectura no se sabe cómo está saliendo el agua. Da la vuelta y anótala.'));
    }
    if (p.porVencer.length) {
      avisos.push(aviso('avisa', '🗓️', `${p.porVencer.length} ${
        p.porVencer.length === 1 ? 'pieza está' : 'piezas están'} por cumplir`,
        `${p.porVencer.map((e) => e.nombre).join(' · ')} — ve pidiéndolas, `
        + 'que no llegan el mismo día.'));
    }

    if (!avisos.length) {
      return `<div class="planta-alerta bien">
                <b>✅ La planta está bien</b>
                <span>Nada que atender hoy.</span>
              </div>`;
    }
    return `<div class="planta-tablero">${avisos.join('')}</div>`;
  }

  function aviso(tono, emoji, titulo, detalle) {
    return `<div class="planta-alerta ${tono}">
              <b>${emoji} ${esc(titulo)}</b>
              <span>${esc(detalle)}</span>
            </div>`;
  }

  // ---- LA VUELTA DE REVISIÓN ----

  function tarjetaVuelta(p) {
    const u = p.ultima;
    // Lo que marcaba la última vez, debajo de cada medidor. Sin esto hay
    // que ir a buscarlo a la tabla de abajo, y el que está capturando no
    // tiene forma de darse cuenta de que se equivocó de un dígito.
    const antes = (v) => (v == null ? '' :
      `<small class="planta-antes">La vez pasada: ${NUM.format(v)}</small>`);

    return `
      <div class="tarjeta">
        <h3 style="margin:0 0 4px">La vuelta de hoy</h3>
        <p class="ayuda" style="margin:0 0 12px">
          Lo que no se midió se deja en blanco. Vacío y cero no son lo mismo:
          <b>cloro 0</b> quiere decir que se midió y salió limpio.
        </p>

        <div class="planta-campos">
          <label>TDS de entrada
            <input id="v-tds-e" class="campo-importe" inputmode="numeric" placeholder="ppm">
            ${antes(u?.tds_entrada)}
          </label>
          <label>TDS de salida
            <input id="v-tds-s" class="campo-importe" inputmode="numeric" placeholder="ppm">
            ${antes(u?.tds_salida)}
          </label>
          <label class="planta-ojo">Cloro después del carbón
            <input id="v-cloro" class="campo-importe" inputmode="decimal" placeholder="ppm">
            <small class="planta-antes">Tiene que dar 0</small>
          </label>
          <label>Dureza después del suavizador
            <input id="v-dureza" class="campo-importe" inputmode="decimal" placeholder="ppm">
            ${antes(u?.dureza)}
          </label>
          <label>Medidor de entrada
            <input id="v-lit-e" class="campo-importe" inputmode="numeric" placeholder="litros">
            ${antes(u?.litros_entrada)}
          </label>
          <label>Medidor de salida
            <input id="v-lit-s" class="campo-importe" inputmode="numeric" placeholder="litros">
            ${antes(u?.litros_salida)}
          </label>
          <label>Presión <small class="planta-antes">opcional</small>
            <input id="v-presion" class="campo-importe" inputmode="decimal" placeholder="psi">
          </label>
          <label>Notas
            <input id="v-notas" class="dialogo-campo-linea" maxlength="500"
                   placeholder="Lo que se vio raro">
          </label>
        </div>

        <div class="planta-adelanto" id="v-adelanto"></div>
        <button id="v-guardar" style="margin-top:12px">Guardar la vuelta</button>
      </div>`;
  }

  /**
   * EL RECHAZO SE VE MIENTRAS SE ESCRIBE.
   *
   * Es la diferencia entre enterarse hoy y enterarse cuando alguien mire
   * la tabla. El que está capturando tiene el aparato en la mano: si el
   * número sale mal, puede volver a medir AHORA — y la mitad de las veces
   * lo que estaba mal era la medición.
   */
  function conectarVuelta() {
    const c = (id) => pantalla.querySelector(id);
    const adelanto = c('#v-adelanto');
    const a = d.pendientes.ajustes;

    const repasar = () => {
      const e = Number(c('#v-tds-e').value);
      const s = Number(c('#v-tds-s').value);
      const cloro = c('#v-cloro').value.trim();
      const partes = [];

      if (e > 0 && c('#v-tds-s').value.trim() !== '' && Number.isFinite(s)) {
        if (s > e) {
          partes.push('<b class="malo">La salida trae más sales que la entrada '
            + '— ¿están al revés?</b>');
        } else {
          const r = Math.round(((e - s) / e) * 1000) / 10;
          partes.push(r < a.rechazoMinimo
            ? `<b class="malo">Rechazo de sales: ${r} %</b> — abajo del mínimo `
              + `(${a.rechazoMinimo} %). Las membranas ya no están purificando.`
            : `<b class="bueno">Rechazo de sales: ${r} %</b> — bien.`);
        }
      }
      if (c('#v-tds-s').value.trim() !== '' && s > a.tdsMaximo) {
        partes.push(`<b class="malo">${ppm(s)} de salida</b> se pasa del límite `
          + `(${ppm(a.tdsMaximo)}): esa agua no se embotella.`);
      }
      if (cloro !== '' && Number(cloro) > 0) {
        partes.push('<b class="malo">⚠️ Está pasando cloro</b> — el carbón ya no '
          + 'lo retiene y las membranas se echan a perder.');
      }
      adelanto.innerHTML = partes.join('<br>');
      adelanto.classList.toggle('hay', partes.length > 0);
    };

    ['#v-tds-e', '#v-tds-s', '#v-cloro'].forEach((id) => { c(id).oninput = repasar; });
    c('#v-guardar').onclick = guardarVuelta;
  }

  async function guardarVuelta() {
    const v = (id) => pantalla.querySelector(id).value.trim();
    const cuerpo = {
      tdsEntrada: v('#v-tds-e'), tdsSalida: v('#v-tds-s'),
      cloro: v('#v-cloro'), dureza: v('#v-dureza'),
      litrosEntrada: v('#v-lit-e'), litrosSalida: v('#v-lit-s'),
      presion: v('#v-presion'), notas: v('#v-notas')
    };
    if (Object.values(cuerpo).every((x) => x === '')) {
      return avisar('Anota al menos una medición.', 'error');
    }
    try {
      const r = await api.enviar('/agua/lecturas', cuerpo);
      avisar(r.lectura?.rechazo != null
        ? `Vuelta guardada · rechazo ${r.lectura.rechazo} %`
        : 'Vuelta guardada', 'bien');
      planta();
    } catch (e) { avisar(e.message, 'error'); }
  }

  // ---- EL NÚMERO QUE MANDA ----

  function tarjetaSalud(p) {
    const u = p.ultima;
    if (!u) {
      return `<div class="tarjeta">
                <h3 style="margin:0 0 4px">Cómo está saliendo el agua</h3>
                <p class="vacio">Todavía no hay ninguna lectura. En cuanto anotes
                   la primera vuelta, aquí sale el número.</p>
              </div>`;
    }

    const bien = u.rechazo == null || u.rechazo >= p.ajustes.rechazoMinimo;
    return `
      <div class="tarjeta planta-salud ${bien ? 'bien' : 'malo'}">
        <h3 style="margin:0 0 4px">Rechazo de sales</h3>
        <div class="planta-grande ${bien ? 'bien' : 'malo'}">${pct(u.rechazo)}</div>
        <p class="ayuda" style="margin:0 0 12px">
          ${u.rechazo == null
            ? 'Hace falta el TDS de entrada y el de salida para poder sacarlo.'
            : bien
              ? `De ${ppm(u.tds_entrada)} que entran salen ${ppm(u.tds_salida)}.
                 El mínimo aceptable es ${pct(p.ajustes.rechazoMinimo)}.`
              : `De ${ppm(u.tds_entrada)} que entran salen ${ppm(u.tds_salida)}.
                 Debería quedar arriba de ${pct(p.ajustes.rechazoMinimo)}:
                 las membranas ya están colando.`}
        </p>

        <div class="planta-tira">
          <span><small>Recuperación</small><b>${pct(u.recuperacion)}</b></span>
          <span><small>Cloro</small><b class="${u.hayCloro ? 'malo' : ''}">${
            u.cloro == null ? '—' : ppm(u.cloro)}</b></span>
          <span><small>Dureza</small><b class="${u.durezaAlta ? 'malo' : ''}">${
            u.dureza == null ? '—' : ppm(u.dureza)}</b></span>
          <span><small>Última vuelta</small><b>${
            u.dias === 0 ? 'hoy' : u.dias === 1 ? 'ayer' : `hace ${u.dias} días`}</b></span>
        </div>

        ${d.tendencia.length > 2 ? `
          <p class="ayuda" style="margin:14px 0 4px">
            Cómo viene. Un dato suelto no dice nada —el TDS del pozo cambia con la
            lluvia—; lo que importa es si la línea va bajando.
          </p>
          <svg class="planta-linea" id="linea" viewBox="0 0 300 60"
               preserveAspectRatio="none" aria-hidden="true"></svg>` : ''}
      </div>`;
  }

  /**
   * La línea del rechazo, dibujada a mano.
   *
   * La escala NO empieza en cero a propósito: entre 90 y 98 se juega todo,
   * y con el eje desde cero los ocho puntos que importan quedarían
   * aplastados contra el techo y la línea se vería plana siempre.
   */
  function dibujarLinea() {
    const svg = pantalla.querySelector('#linea');
    if (!svg) return;
    const datos = d.tendencia;
    const valores = datos.map((x) => x.rechazo);
    const min = Math.min(...valores, d.pendientes.ajustes.rechazoMinimo) - 1;
    const max = Math.max(...valores, 100);
    const alto = max - min || 1;

    const punto = (v, i) => {
      const x = (i / Math.max(1, datos.length - 1)) * 300;
      const y = 58 - ((v - min) / alto) * 56;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    };
    const yLimite = 58 - ((d.pendientes.ajustes.rechazoMinimo - min) / alto) * 56;

    svg.innerHTML = `
      <line x1="0" y1="${yLimite.toFixed(1)}" x2="300" y2="${yLimite.toFixed(1)}"
            class="planta-limite"></line>
      <polyline points="${valores.map(punto).join(' ')}" class="planta-trazo"></polyline>`;
  }

  // ---- A DÓNDE SE FUE EL AGUA ----

  function tarjetaCuadre() {
    const c = cuadre;
    if (!c || !c.hayDatos) {
      return `<div class="tarjeta">
                <h3 style="margin:0 0 4px">A dónde se fue el agua</h3>
                <p class="vacio">Hacen falta dos vueltas con los medidores anotados
                   para poder restar. Con una sola no hay de dónde.</p>
              </div>`;
    }

    return `
      <div class="tarjeta ancho-completo">
        <h3 style="margin:0 0 4px">A dónde se fue el agua</h3>
        <p class="ayuda" style="margin:0 0 12px">
          Del ${esc(c.desde)} al ${esc(c.hasta)}, según los medidores.
          ${c.saltos ? `<b class="malo">Ojo: ${c.saltos} ${c.saltos === 1
            ? 'lectura marcó menos que la anterior' : 'lecturas marcaron menos que la anterior'}
            (¿se cambió el medidor?) y no se contaron.</b>` : ''}
        </p>

        <div class="planta-tira grande">
          <span><small>Entró a las membranas</small><b>${litros(c.entrada)}</b></span>
          <span><small>Salió purificada</small><b class="bueno">${litros(c.producida)}</b></span>
          <span><small>Se tiró al rechazo</small><b>${litros(c.tirada)}</b></span>
          <span><small>Marquetas sacadas</small><b>${NUM.format(c.marquetas)}</b></span>
        </div>

        <table class="tabla planta-cuadre">
          <tbody>
            <tr>
              <td>Agua purificada, según el medidor</td>
              <td class="der"><b>${litros(c.producida)}</b></td>
            </tr>
            <tr>
              <td>Lo que en teoría se llevó el hielo
                <small>${NUM.format(c.marquetas)} marquetas ×
                       ${c.litrosMarqueta} L</small></td>
              <td class="der">−${litros(c.teoriaHielo)}</td>
            </tr>
            <tr class="planta-resultado">
              <td>Lo que falta por explicar</td>
              <td class="der"><b class="${c.sinExplicar < 0 ? 'malo' : ''}">${
                litros(c.sinExplicar)}</b></td>
            </tr>
          </tbody>
        </table>

        <p class="ayuda" style="margin:10px 0 0">
          <b>Todavía no cuadra del todo, y es a propósito.</b> Los garrafones y las
          botellas salen de esta misma agua y todavía no se registran — van en la
          siguiente versión, y entonces se restan aquí. Mientras tanto, lo que falta
          por explicar los lleva dentro.
          ${c.sinExplicar < 0 ? '<br>Que salga en <b>negativo</b> quiere decir que el '
            + 'hielo se llevó más agua de la que marcó el medidor: o los moldes se '
            + 'están llenando de más, o falta anotar alguna vuelta.' : ''}
        </p>
      </div>`;
  }

  // ---- EL TREN DE TRATAMIENTO ----

  function tarjetaTren() {
    return `
      <div class="tarjeta ancho-completo">
        <div class="planta-cabeza">
          <h3 style="margin:0">El tren de tratamiento</h3>
          <button class="secundario chico" id="ver-baja">
            ${verBaja ? 'Ocultar los de baja' : 'Ver también los de baja'}
          </button>
        </div>
        <p class="ayuda" style="margin:0 0 12px">
          En el orden en que el agua los atraviesa. El carbón va antes de las
          membranas justamente para quitarles el cloro.
        </p>
        ${d.equipos.length
          ? `<div class="planta-tren">${d.equipos.map(renglonEquipo).join('')}</div>`
          : '<p class="vacio">Todavía no hay ningún equipo dado de alta.</p>'}
      </div>`;
  }

  function renglonEquipo(e) {
    const v = e.vida;
    const tono = e.estado === 'baja' ? 'baja'
      : e.estado === 'reparacion' ? 'malo'
      : v?.vencida ? 'malo' : v?.porVencer ? 'tarde' : 'bien';

    return `
      <button class="planta-equipo ${tono}" data-ficha="${e.id}">
        <span class="planta-emoji">${e.emoji}</span>
        <span class="planta-quien">
          <b>${esc(e.nombre)}</b>
          <small>${esc(e.tipoNombre)}${e.capacidad ? ` · ${esc(e.capacidad)}` : ''}</small>
        </span>
        <span class="planta-dato">
          <small>Estado</small>
          <span class="planta-estado ${e.tono}">${esc(e.etiqueta)}</span>
        </span>
        <span class="planta-dato">
          <small>Puesta</small>
          <b>${e.pieza
            ? esc([e.pieza.marca, e.pieza.modelo].filter(Boolean).join(' ') || 'Sin marca')
            : '<i>sin capturar</i>'}</b>
        </span>
        <span class="planta-dato der">
          <small>Vida</small>
          ${v ? barraVida(v) : '<b>—</b>'}
        </span>
        <span class="planta-flecha">›</span>
      </button>`;
  }

  /** La vida gastada, en barra: un número entre líneas no se lee de un vistazo. */
  function barraVida(v) {
    const ancho = Math.min(100, v.gastada);
    const tono = v.vencida ? 'malo' : v.porVencer ? 'tarde' : 'bien';
    return `<span class="planta-barra ${tono}" title="${v.gastada} % gastada">
              <span style="width:${ancho}%"></span>
            </span>
            <small>${v.vencida ? 'ya toca' : `${v.gastada} %`}</small>`;
  }

  // ---- LAS ÚLTIMAS LECTURAS ----

  function tarjetaLecturas() {
    const a = d.pendientes.ajustes;
    return `
      <div class="tarjeta ancho-completo">
        <h3 style="margin:0 0 4px">Las últimas vueltas</h3>
        <p class="ayuda" style="margin:0 0 12px">
          Los litros son la resta contra la vuelta anterior, no lo que marca el
          medidor: así un día que nadie anotó no se pierde, lo recoge la
          siguiente vuelta.
        </p>
        ${ultimas.length ? `
        <table class="tabla planta-tabla">
          <thead><tr>
            <th>Cuándo</th><th class="der">TDS ent.</th><th class="der">TDS sal.</th>
            <th class="der">Rechazo</th><th class="der">Cloro</th><th class="der">Dureza</th>
            <th class="der">Litros</th><th class="der">Se tiró</th><th>Quién</th>
          </tr></thead>
          <tbody>${ultimas.map((l) => `
            <tr>
              <td>${fechaCorta(l.fecha)}${l.medidorAlReves
                ? '<small class="malo">el medidor marcó menos que antes</small>' : ''}${
                l.notas ? `<small>${esc(l.notas)}</small>` : ''}</td>
              <td class="der">${l.tds_entrada ?? '—'}</td>
              <td class="der"><b class="${l.tdsAlto ? 'malo' : ''}">${l.tds_salida ?? '—'}</b></td>
              <td class="der"><b class="${l.rechazoBajo ? 'malo' : l.rechazo != null ? 'bueno' : ''}">${
                l.rechazo != null ? `${l.rechazo} %` : '—'}</b></td>
              <td class="der"><b class="${l.hayCloro ? 'malo' : ''}">${l.cloro ?? '—'}</b></td>
              <td class="der"><b class="${l.durezaAlta ? 'malo' : ''}">${l.dureza ?? '—'}</b></td>
              <td class="der">${l.gastoSalida != null ? NUM.format(l.gastoSalida) : '—'}</td>
              <td class="der">${l.tirada != null ? NUM.format(l.tirada) : '—'}</td>
              <td>${esc(l.ejecutor || '—')}</td>
            </tr>`).join('')}</tbody>
        </table>
        <p class="ayuda" style="margin:10px 0 0">
          El límite de TDS está en ${ppm(a.tdsMaximo)} y el rechazo mínimo en
          ${pct(a.rechazoMinimo)}. Lo que salga de ahí sale en rojo.
        </p>`
        : '<p class="vacio">Todavía no se ha anotado ninguna vuelta.</p>'}
      </div>`;
  }

  // ==========================================================
  // LA FICHA DE UN EQUIPO
  // ==========================================================
  async function ficha(id) {
    pantalla.innerHTML = '<div class="cargando">Buscando el equipo…</div>';
    let f;
    try { f = await api.obtener(`/agua/${id}`); }
    catch (e) { pantalla.innerHTML = `<p class="vacio">${esc(e.message)}</p>`; return; }

    const e = f.equipo;
    const v = e.vida;

    pantalla.innerHTML = `
      <div class="cabecera-pantalla">
        <button class="secundario chico" id="volver">‹ La planta</button>
        <h2>${e.emoji} ${esc(e.nombre)}
          <span class="planta-estado ${e.tono}">${esc(e.etiqueta)}</span></h2>
        <p class="ayuda">
          ${esc(e.tipoNombre)}${e.capacidad ? ` · ${esc(e.capacidad)}` : ''}
          · lugar ${e.orden} en el tren
        </p>
      </div>

      <div class="planta-dos">
        <div class="tarjeta">
          <h3 style="margin:0 0 10px">Lo que tiene puesto</h3>
          ${e.pieza ? `
            <div class="planta-grande chico">${esc(
              [e.pieza.marca, e.pieza.modelo].filter(Boolean).join(' ') || 'Sin marca')}</div>
            <table class="tabla">
              <tbody>
                <tr><td>Puesta el</td><td class="der">${esc(e.pieza.puesta_en)}</td></tr>
                ${e.pieza.serie ? `<tr><td>Serie</td><td class="der">${esc(e.pieza.serie)}</td></tr>` : ''}
                ${e.pieza.costo_centavos != null
                  ? `<tr><td>Costó</td><td class="der">${pesos(e.pieza.costo_centavos)}</td></tr>` : ''}
                ${v ? `<tr><td>Lleva puesta</td><td class="der">${v.diasUsados} días${
                  v.diasVida ? ` de ${v.diasVida}` : ''}</td></tr>` : ''}
                ${v?.litrosUsados != null
                  ? `<tr><td>Le han pasado</td><td class="der">${litros(v.litrosUsados)}${
                      v.litrosVida ? ` de ${litros(v.litrosVida)}` : ''}</td></tr>` : ''}
              </tbody>
            </table>`
            : `<p class="vacio">No se ha capturado qué tiene puesto.
                 ${v ? 'Mientras tanto la vida se cuenta desde que se dio de alta el equipo.' : ''}</p>`}

          ${v ? `<div style="margin-top:12px">${barraVida(v)}</div>
                 <p class="ayuda" style="margin:6px 0 0">${
                   v.vencida ? '<b class="malo">Ya cumplió su vida: toca cambiarla.</b>'
                   : v.porVencer ? '<b>Va por cumplir.</b> Ve pidiéndola, que no llega el mismo día.'
                   : 'Le queda vida.'}</p>` : ''}

          <div class="planta-acciones">
            <button class="secundario chico" id="cambiar">🔄 Cambiar la pieza</button>
            <button class="secundario chico" id="reportar">🔧 Reportar algo</button>
            <button class="secundario chico" id="estado">Cambiar el estado</button>
            <button class="secundario chico" id="editar">Editar el equipo</button>
            <button class="secundario chico" id="baja">Dar de baja</button>
          </div>
        </div>

        <div class="tarjeta">
          <h3 style="margin:0 0 4px">Lo que se ha gastado aquí</h3>
          <div class="planta-grande chico">${pesos(e.gasto.centavos)}</div>
          <p class="ayuda" style="margin:0 0 12px">
            ${e.gasto.piezas} ${e.gasto.piezas === 1 ? 'pieza' : 'piezas'} y
            ${e.gasto.servicios} ${e.gasto.servicios === 1 ? 'servicio' : 'servicios'}
            en toda la vida de este puesto.
          </p>
          <table class="tabla">
            <tbody>
              <tr><td>En piezas</td><td class="der">${pesos(e.gasto.piezasCentavos)}</td></tr>
              <tr><td>En reparaciones</td><td class="der">${pesos(e.gasto.serviciosCentavos)}</td></tr>
            </tbody>
          </table>
          <p class="ayuda" style="margin:10px 0 0">
            Un puesto que gasta mucho más que sus iguales casi nunca tiene la culpa:
            lo que está mal suele ser lo que le llega.
          </p>
        </div>
      </div>

      <div class="tarjeta ancho-completo">
        <h3 style="margin:0 0 10px">Los servicios</h3>
        ${f.servicios.length ? tablaServicios(f.servicios)
          : '<p class="vacio">Nunca se le ha hecho nada.</p>'}
      </div>

      <div class="tarjeta ancho-completo">
        <h3 style="margin:0 0 4px">Todo lo que ha pasado por este puesto</h3>
        <p class="ayuda" style="margin:0 0 10px">
          El equipo es el puesto y la pieza es lo que está puesto hoy. Por eso
          cambiar una membrana no borra la anterior: se apila.
        </p>
        ${f.piezas.length ? tablaPiezas(f.piezas)
          : '<p class="vacio">No se ha capturado ninguna pieza.</p>'}
      </div>`;

    pantalla.querySelector('#volver').onclick = planta;
    pantalla.querySelector('#cambiar').onclick = () => cambiarPieza(e);
    pantalla.querySelector('#reportar').onclick = () => reportar(e);
    pantalla.querySelector('#estado').onclick = () => cambiarEstado(e);
    pantalla.querySelector('#editar').onclick = () => editarEquipo(e);
    pantalla.querySelector('#baja').onclick = () => darDeBaja(e);
    pantalla.querySelectorAll('[data-atender]').forEach((b) => {
      b.onclick = () => atender(b.dataset.atender, e.id);
    });
    pantalla.querySelectorAll('[data-anular]').forEach((b) => {
      b.onclick = () => anularServicio(b.dataset.anular, e.id);
    });
  }

  function tablaServicios(filas) {
    return `<table class="tabla planta-tabla">
      <thead><tr><th>Cuándo</th><th>Qué</th><th>Pasó</th><th>Se hizo</th>
                 <th class="der">Costó</th><th></th></tr></thead>
      <tbody>${filas.map((s) => `
        <tr class="${s.atendido_en ? '' : 'pendiente'}">
          <td>${fechaCorta(s.reportado_en)}</td>
          <td>${esc(d.servicios[s.tipo] || s.tipo)}</td>
          <td>${esc(s.que_tiene)}</td>
          <td>${s.atendido_en
            ? `${esc(s.que_se_hizo || '')}<small>${fechaCorta(s.atendido_en)}${
                s.quien_atendio ? ` · ${esc(s.quien_atendio)}` : ''}</small>`
            : '<b class="malo">Pendiente</b>'}</td>
          <td class="der">${s.costo_centavos != null ? pesos(s.costo_centavos) : '—'}</td>
          <td class="der">
            ${s.atendido_en ? '' : `<button class="secundario chico"
                                    data-atender="${s.id}">Atender</button>`}
            <button class="secundario chico" data-anular="${s.id}">Anular</button>
          </td>
        </tr>`).join('')}</tbody></table>`;
  }

  function tablaPiezas(filas) {
    return `<table class="tabla planta-tabla">
      <thead><tr><th>Puesta</th><th>Qué era</th><th>Serie</th><th>Duró</th>
                 <th class="der">Costó</th><th>Se quitó</th></tr></thead>
      <tbody>${filas.map((p) => {
        const dias = p.quitada_en
          ? Math.round((new Date(p.quitada_en) - new Date(`${p.puesta_en}T12:00:00`)) / 86400000)
          : null;
        return `<tr class="${p.quitada_en ? '' : 'planta-puesta'}">
          <td>${esc(p.puesta_en)}</td>
          <td>${esc([p.marca, p.modelo].filter(Boolean).join(' ') || p.nombre || '—')}</td>
          <td>${esc(p.serie || '—')}</td>
          <td>${dias != null ? `${dias} días` : '<b>puesta hoy</b>'}</td>
          <td class="der">${p.costo_centavos != null ? pesos(p.costo_centavos) : '—'}</td>
          <td>${p.quitada_en ? `${esc(p.quitada_en.slice(0, 10))}
               <small>${esc(MOTIVOS[p.motivo_quitada] || '')}</small>` : '—'}</td>
        </tr>`;
      }).join('')}</tbody></table>`;
  }

  const MOTIVOS = {
    vida: 'ya había cumplido', falla: 'se descompuso',
    preventivo: 'preventivo', otro: 'otro'
  };

  // ==========================================================
  // LAS ACCIONES
  // ==========================================================

  async function cambiarPieza(e) {
    const motivo = await menu({
      titulo: `Cambiar la pieza de ${e.nombre}`,
      texto: '¿Por qué se cambia?',
      opciones: [
        { valor: 'vida', texto: 'Ya había cumplido', detalle: 'Le tocaba por tiempo o por litros' },
        { valor: 'falla', texto: 'Se descompuso', detalle: 'Se rompió antes de tiempo' },
        { valor: 'preventivo', texto: 'Preventivo', detalle: 'Todavía servía, pero mejor no arriesgar' },
        { valor: 'otro', texto: 'Otro' }
      ]
    });
    if (!motivo) return;

    const marca = await pedirTexto({
      titulo: 'Marca y modelo de la nueva',
      texto: 'Como venga en la etiqueta. Si no se sabe, déjalo en blanco.',
      marcador: 'Vontron ULP21-4040', unaLinea: true, opcional: true, largo: 120
    });
    if (marca === null) return;

    const serie = await pedirTexto({
      titulo: 'Número de serie', texto: 'Opcional, pero es lo que sirve para reclamar garantía.',
      marcador: 'Sin serie', unaLinea: true, opcional: true, largo: 80
    });
    if (serie === null) return;

    const costo = await pedirImporte({
      titulo: '¿Cuánto costó?',
      texto: 'Es lo que permite saber cuánto cuesta de verdad mantener la planta.',
      opcional: true
    });
    if (costo === null) return;

    const litrosMedidor = await pedirEntero({
      titulo: '¿Cuánto marca el medidor de salida?',
      texto: 'Sin esto no se puede saber cuántos litros lleva la pieza nueva. '
           + 'Si lo dejas en blanco se toma el de la última vuelta.',
      valor: '', marcador: '0', opcional: true, maximo: 2000000000
    });
    if (litrosMedidor === null) return;

    const [primera, ...resto] = String(marca || '').trim().split(/\s+/);
    try {
      await api.enviar(`/agua/${e.id}/piezas`, {
        motivo, marca: primera || null, modelo: resto.join(' ') || null,
        serie: serie || null, costo, litros: litrosMedidor
      });
      avisar('Pieza cambiada', 'bien');
      ficha(e.id);
    } catch (err) { avisar(err.message, 'error'); }
  }

  async function reportar(e) {
    const tipo = await menu({
      titulo: `${e.nombre}`,
      texto: '¿Qué se anota?',
      opciones: [
        { valor: 'falla', texto: 'Una falla', detalle: 'Algo no está funcionando' },
        { valor: 'retrolavado', texto: 'Un retrolavado', detalle: 'Ya hecho' },
        { valor: 'regeneracion', texto: 'Una regeneración', detalle: 'Ya hecha' },
        { valor: 'sanitizacion', texto: 'Una sanitización', detalle: 'Ya hecha' },
        { valor: 'preventivo', texto: 'Un preventivo', detalle: 'Ya hecho' }
      ]
    });
    if (!tipo) return;

    const queTiene = await pedirTexto({
      titulo: tipo === 'falla' ? '¿Qué tiene?' : '¿Qué se hizo?',
      texto: tipo === 'falla'
        ? 'Como lo dirías: "no sube la presión", "gotea por abajo".'
        : 'Lo que se hizo, en pocas palabras.',
      marcador: tipo === 'falla' ? 'No sube la presión' : 'Retrolavado de 20 minutos',
      largo: 500
    });
    if (!queTiene) return;

    try {
      await api.enviar(`/agua/${e.id}/servicios`, { tipo, queTiene });
      avisar(tipo === 'falla' ? 'Falla reportada' : 'Anotado', 'bien');
      ficha(e.id);
    } catch (err) { avisar(err.message, 'error'); }
  }

  async function atender(servicioId, equipoId) {
    const queSeHizo = await pedirTexto({
      titulo: '¿Qué se hizo?', texto: 'Lo que se cambió o se arregló.',
      marcador: 'Se cambió el empaque', largo: 500
    });
    if (!queSeHizo) return;

    const costo = await pedirImporte({
      titulo: '¿Cuánto costó?', texto: 'Refacciones y mano de obra. Si no costó, déjalo en blanco.',
      opcional: true
    });
    if (costo === null) return;

    try {
      await api.enviar(`/agua/servicios/${servicioId}/atender`, { queSeHizo, costo });
      avisar('Atendido', 'bien');
      ficha(equipoId);
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function anularServicio(servicioId, equipoId) {
    const motivo = await pedirTexto({
      titulo: 'Anular el servicio', texto: '¿Por qué se anula? Queda escrito.',
      marcador: 'Se anotó en el equipo equivocado', largo: 300
    });
    if (!motivo) return;
    try {
      await api.enviar(`/agua/servicios/${servicioId}/anular`, { motivo });
      avisar('Anulado', 'bien');
      ficha(equipoId);
    } catch (e) { avisar(e.message, 'error'); }
  }

  async function cambiarEstado(e) {
    const estado = await menu({
      titulo: e.nombre, texto: '¿Cómo está?',
      opciones: [
        { valor: 'trabajando', texto: 'Trabajando', detalle: 'Todo bien' },
        { valor: 'reparacion', texto: 'Por reparar', detalle: 'No sirve, hay que arreglarlo' }
      ]
    });
    if (!estado) return;
    try {
      await api.actualizar(`/agua/${e.id}/estado`, { estado });
      avisar('Guardado', 'bien');
      ficha(e.id);
    } catch (err) { avisar(err.message, 'error'); }
  }

  async function darDeBaja(e) {
    const seguro = await confirmar({
      titulo: `Dar de baja ${e.nombre}`,
      texto: 'Se queda con toda su historia, pero sale del tren de tratamiento.',
      ok: 'Dar de baja', peligro: true
    });
    if (!seguro) return;
    const motivo = await pedirTexto({
      titulo: '¿Por qué se da de baja?', marcador: 'Se cambió por uno más grande', largo: 300
    });
    if (!motivo) return;
    try {
      await api.enviar(`/agua/${e.id}/baja`, { motivo });
      avisar('Dado de baja', 'bien');
      planta();
    } catch (err) { avisar(err.message, 'error'); }
  }

  async function nuevoEquipo() { await pedirEquipo(null); }
  async function editarEquipo(e) { await pedirEquipo(e); }

  async function pedirEquipo(e) {
    const nombre = await pedirTexto({
      titulo: e ? esc(e.nombre) : 'Equipo nuevo',
      texto: 'Como se le llama aquí: "Membrana 3", "Suavizador B".',
      valor: e?.nombre || '', marcador: 'Membrana 7', unaLinea: true, largo: 120
    });
    if (!nombre) return;

    const tipo = await menu({
      titulo: '¿Qué es?',
      opciones: Object.entries(d.tipos).map(([valor, t]) => ({
        valor, texto: `${t.emoji} ${t.nombre}`
      }))
    });
    if (!tipo) return;

    const orden = await pedirEntero({
      titulo: '¿En qué lugar del tren va?',
      texto: 'Un número: el agua los atraviesa de menor a mayor. Los que van en '
           + 'paralelo llevan el mismo número. Hoy: clorinador 10, zeolita 20, '
           + 'carbón 30, suavizadores 40, membranas 50, tinacos 60, ozono 70, UV 80.',
      valor: e?.orden ?? '', marcador: '50', opcional: true, maximo: 9999
    });
    if (orden === null) return;

    const capacidad = await pedirTexto({
      titulo: 'Capacidad o tamaño', texto: 'Como se dice: "4 pies", "1000 L". Opcional.',
      valor: e?.capacidad || '', marcador: '4 pies', unaLinea: true, opcional: true, largo: 60
    });
    if (capacidad === null) return;

    const vidaDias = await pedirEntero({
      titulo: '¿Cada cuántos días se cambia?',
      texto: 'Para que avise solo cuando le toque. En blanco = no se vigila. '
           + 'De referencia: carbón 730, zeolita 1460, membranas 1095, lámpara UV 365.',
      valor: e?.vida_dias ?? '', marcador: '1095', opcional: true, maximo: 36500
    });
    if (vidaDias === null) return;

    const cuerpo = { nombre, tipo, orden, capacidad, vidaDias };
    try {
      if (e) { await api.actualizar(`/agua/${e.id}`, cuerpo); avisar('Guardado', 'bien'); ficha(e.id); }
      else {
        const r = await api.enviar('/agua/equipos', cuerpo);
        avisar('Equipo dado de alta', 'bien');
        ficha(r.equipo.id);
      }
    } catch (err) { avisar(err.message, 'error'); }
  }

  async function ajustes() {
    const a = d.pendientes.ajustes;

    const tdsMaximo = await pedirEntero({
      titulo: 'TDS máximo de salida',
      texto: 'Arriba de esto el sistema avisa que esa agua no debería embotellarse. '
           + 'Lo normal para agua purificada anda entre 10 y 50 ppm.',
      valor: a.tdsMaximo, marcador: '50', maximo: 5000
    });
    if (tdsMaximo === null) return;

    const rechazoMinimo = await pedirEntero({
      titulo: 'Rechazo de sales mínimo (%)',
      texto: 'Abajo de esto las membranas ya no purifican. Con membranas nuevas '
           + 'anda en 96–98; el mínimo que se suele aceptar es 90.',
      valor: a.rechazoMinimo, marcador: '90', maximo: 100
    });
    if (rechazoMinimo === null) return;

    const durezaMaxima = await pedirEntero({
      titulo: 'Dureza máxima después del suavizador (ppm)',
      texto: 'Arriba de esto hay que regenerar: el sarro tapa las membranas.',
      valor: a.durezaMaxima, marcador: '20', maximo: 5000
    });
    if (durezaMaxima === null) return;

    const diasSinLectura = await pedirEntero({
      titulo: '¿Cuántos días sin lectura antes de avisar?',
      valor: a.diasSinLectura, marcador: '2', maximo: 365
    });
    if (diasSinLectura === null) return;

    const litrosMarqueta = await pedirEntero({
      titulo: '¿Cuántos litros lleva una marqueta?',
      texto: 'Una marqueta entera y sellada pesa 150 kg, así que son 150 L. '
           + 'Sirve para comparar el medidor contra lo que en teoría se llevó el hielo.',
      valor: a.litrosMarqueta, marcador: '150', maximo: 1000
    });
    if (litrosMarqueta === null) return;

    try {
      await api.actualizar('/agua/ajustes', {
        tdsMaximo, rechazoMinimo, durezaMaxima, diasSinLectura, litrosMarqueta
      });
      avisar('Ajustes guardados', 'bien');
      planta();
    } catch (e) { avisar(e.message, 'error'); }
  }
}
