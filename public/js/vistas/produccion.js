/**
 * PRODUCCIÓN  (v3.1 — ordenado para la pantalla que de verdad se usa)
 *
 * Lo primero que se ve es lo que más se usa:
 *
 *   1. NÚMEROS A SACAR — el papel que se imprime a cada rato y se le
 *      entrega al obrero. Va primero, y tiene atajo de teclado (F2),
 *      porque es lo que más veces al día se hace desde aquí.
 *   2. REGISTRAR LO QUE SE SACÓ — el flujo de las 3 de la tarde. El obrero
 *      llega con su papel, dice los números y se capturan todos de golpe.
 *      Va en el MISMO renglón, a la derecha: dos botones grandes uno
 *      encima del otro se comían media pantalla sin decir nada más.
 *   3. LOS TANQUES — la vista del estado, con un panel al lado. Los paños
 *      no llegan al ancho de un monitor, y ese hueco vacío puede llevar lo
 *      que uno viene a mirar: cómo va el tanque y cómo salió el hielo hoy.
 *
 * CADA PAÑO DICE SU HISTORIA en el renglón: cuándo se sacó la última vez,
 * quién lo sacó y cuántas horas llevaba congelando. Antes había que entrar
 * paño por paño para saberlo, y era lo primero que uno pregunta.
 *
 * Y CUALQUIER PAÑO SE PUEDE MIRAR SIN PERMISO DE NADIE. Ver qué le pasó a
 * un molde marcado no cambia nada; pedir un PIN para eso convertía una
 * consulta de dos segundos en ir a buscar al gerente. El PIN se pide para
 * SACARLO, que es lo que sí mueve el mundo.
 *
 * Colores: azul congelando, gris lista, naranja fuera del tanque, ámbar a
 * medias. El agua potable se ve distinta de la purificada.
 */
import { api } from '../api.js';
import { esc, avisar, fecha as formatoFecha, fechaCorta } from '../util.js';
import { confirmar, menu, pedirTexto, pedirAutorizacion } from '../dialogo.js';

/**
 * EL NOMBRE DE PILA, que es como se llaman entre ellos en la fábrica.
 *
 * Quitando primero los tratamientos: "Don Chema" es Chema, no "Don". Con la
 * primera palabra a secas, media plantilla se llamaba igual.
 */
const TRATAMIENTOS = new Set(['don', 'doña', 'dona', 'sr', 'sr.', 'sra', 'sra.',
                              'srta', 'srta.', 'ing', 'ing.', 'lic', 'lic.']);
function nombreDePila(completo) {
  const partes = String(completo || '').trim().split(/\s+/).filter(Boolean);
  const util = partes.filter((p, i) => !(i === 0 && TRATAMIENTOS.has(p.toLowerCase())));
  return util[0] || partes[0] || '';
}

/**
 * @param opciones.enCorte    se está usando DENTRO del corte de caja: sale
 *                            una barra arriba con el paso y el botón de
 *                            seguir. La pantalla es la misma a propósito —
 *                            tener dos maneras de anotar el hielo fue justo
 *                            lo que se quitó en la v4.0.
 * @param opciones.alSeguir   qué hacer cuando dice "ya anoté los paños".
 */
export async function vistaProduccion(pantalla, estado, opciones = {}) {
  const enCorte = Boolean(opciones.enCorte);
  const puedeRegistrar = estado.permisos.includes('*') ||
                         estado.permisos.includes('produccion.registrar');
  const puedeAutorizar = estado.permisos.includes('*') ||
                         estado.permisos.includes('produccion.autorizar');
  // Los números que siguen los imprime también el cajero: el obrero
  // pregunta en el mostrador y ahí no siempre hay un gerente.
  const puedeVerNumeros = estado.permisos.includes('*') ||
                          estado.permisos.includes('produccion.numeros');
  const puedeCorregir = estado.permisos.includes('*') ||
                        estado.permisos.includes('produccion.corregir');
  // EL OPERARIO NO ELIGE QUIÉN SACÓ EL PAÑO: fue él.
  //
  // Es la misma regla que en la caja, donde el cajero no escoge quién
  // cobró. Un operario solo entra a mover tanques, y ponerle una lista con
  // los nombres de sus compañeros es darle la opción de anotarle el trabajo
  // a otro — sin querer o queriendo. El gerente y el administrador sí
  // eligen, porque ellos capturan lo que les cantan (regla 3.6: quién lo
  // hizo y quién lo anotó son dos cosas).
  const soyElQueSaca = estado.usuario?.rol === 'operario';
  // Configurar los tanques ya no vive en el inicio ni en el menú rápido: se
  // hace una vez en la vida —en más de treinta años no ha habido un tanque
  // nuevo— y estaba ocupando el sitio de lo que sí se usa a diario. Ahora
  // está donde hace falta, en la tuerca de esta pantalla.
  const puedeConfigurar = estado.permisos.includes('*') ||
                          estado.permisos.includes('tanques.configurar');

  let agua = localStorage.getItem('tipo_agua') || 'purificada';
  let tanqueActivo = localStorage.getItem('tanque_activo') || null;
  let datos = null;
  let hoy = null;
  // La última vez que se midió la salmuera de cada tanque. Se mide de vez
  // en cuando, sin horario: aquí solo se enseña cuándo fue y cuánto dio.
  let ultimaSalmuera = {};

  // Los estados del hielo y sus destinos los manda el servidor con el
  // estado del tanque: aquí no hay una segunda copia de los nombres que
  // pueda quedarse vieja. Se guardan al pintar y los usa todo el archivo.
  let CALIDADES = [];
  let DESTINOS = [];

  // F2 SACA LOS NÚMEROS. Es lo que más veces al día se hace desde esta
  // pantalla, y con el obrero enfrente esperando, un atajo ahorra el viaje
  // del ratón. F2 y no una letra suelta: una letra se dispararía mientras
  // alguien escribe un nombre en cualquier campo.
  const atajo = (ev) => {
    if (ev.key !== 'F2' || ev.ctrlKey || ev.altKey || ev.metaKey) return;
    if (!puedeVerNumeros) return;
    ev.preventDefault();
    numerosASacar();
  };
  document.addEventListener('keydown', atajo);
  // Al salir de Producción el atajo se va con ella: en la caja, F2 no tiene
  // por qué imprimir paños. `vista-desmontada` es el aviso que manda el
  // enrutador justo antes de cambiar de pantalla.
  pantalla.addEventListener('vista-desmontada', () => {
    document.removeEventListener('keydown', atajo);
  }, { once: true });

  await pintar();

  // ==========================================================
  // PANTALLA PRINCIPAL
  // ==========================================================
  async function pintar() {
    // Las dos llamadas van juntas: el panel de la derecha enseña lo de hoy
    // y esperar una después de la otra pintaría la pantalla en dos tiempos.
    let salmuera;
    [datos, hoy, salmuera] = await Promise.all([
      api.obtener(`/produccion/estado${tanqueActivo ? `?tanque=${encodeURIComponent(tanqueActivo)}` : ''}`),
      api.obtener('/produccion/hoy').catch(() => null),
      api.obtener('/clima/salmuera?limite=1').catch(() => null)
    ]);
    ultimaSalmuera = salmuera?.ultimaPorTanque || {};

    if (!datos.tanques.length) return sinTanques();

    CALIDADES = datos.calidades || [];
    DESTINOS = datos.destinos || [];

    const { tanques, tanque, fuera } = datos;
    tanqueActivo = tanque.id;
    localStorage.setItem('tanque_activo', tanqueActivo);
    const toca = tanque.siguiente;

    pantalla.innerHTML = `
      ${enCorte ? `
        <div class="corte-paso">
          <div class="crece">
            <span class="corte-paso-num">Paso 1 de 4</span>
            <strong>¿Qué paños se sacaron?</strong>
            <small>
              Toca cada paño que salió y anótalo como siempre: quién lo sacó,
              cómo salió el hielo, canasta por canasta si hace falta. Cuando
              termines, sigue.
            </small>
          </div>
          <button id="seguir-corte">Ya anoté los paños →</button>
        </div>` : ''}

      <div class="prod-acciones">
        ${puedeVerNumeros ? `
          <button id="siguientes" class="accion-principal">
            <span class="accion-icono">🖨️</span>
            <span class="accion-texto">
              <strong>Números a sacar</strong>
              <small>El papel para el obrero · tecla F2</small>
            </span>
          </button>` : ''}

      </div>

      <div class="pestanas-fila">
        <div class="pestanas">
          ${tanques.map((t) => `
            <button class="pestana ${t.id === tanque.id ? 'activa' : ''}"
                    data-tanque="${esc(t.id)}">${esc(t.nombre)}</button>`).join('')}
        </div>
        ${puedeConfigurar ? `
          <a class="tuerca" href="#/config-tanques"
             title="Configurar los tanques, paños y canastas">⚙</a>` : ''}
      </div>

      <div class="barra-produccion">
        ${toca ? `
          <div class="toca">
            <span class="toca-etiqueta">toca</span>
            <strong>paño ${toca.numero}</strong>
            <small>${esc(toca.porque)}${
              tanque.ultimaSalida ? ` · ${esc(formatoFecha(tanque.ultimaSalida))}` : ''}</small>
          </div>` : '<div class="toca"><small>Este tanque no tiene paños.</small></div>'}

        ${puedeRegistrar ? `
          <button class="agua-boton ${agua}" id="agua" title="Cambiar el agua">
            <span class="agua-icono">💧</span>
            <span>${agua === 'purificada' ? 'Purificada' : 'Potable'}</span>
          </button>` : ''}
      </div>

      ${fuera ? `
        <div class="alerta-fuera">
          ⚠️ ${fuera} ${fuera === 1 ? 'canasta quedó fuera del tanque' : 'canastas quedaron fuera del tanque'}
        </div>` : ''}

      <div class="prod-cuerpo">
        <div class="panos-produccion">
          ${tanque.panos.map((p) => filaPano(p, toca)).join('') ||
            '<p class="vacio">Este tanque no tiene paños.</p>'}

          <div class="leyenda">
            <span><i class="punto-estado congelando"></i> congelando</span>
            <span><i class="punto-estado potable"></i> con potable</span>
            <span><i class="punto-estado lista"></i> lista</span>
            <span><i class="punto-estado fuera"></i> fuera del tanque</span>
            <span><i class="punto-estado proceso"></i> a medias</span>
            <span><i class="punto-estado merma"></i> molde que falla</span>
          </div>
        </div>

        ${panelTanque(tanque)}
      </div>`;

    const seguir = pantalla.querySelector('#seguir-corte');
    if (seguir) seguir.onclick = () => opciones.alSeguir?.();

    pantalla.querySelectorAll('[data-tanque]').forEach((b) => {
      b.onclick = () => { tanqueActivo = b.dataset.tanque; pintar(); };
    });
    pantalla.querySelector('#ver-hoy').onclick = verHoy;
    const btnSalmuera = pantalla.querySelector('#medir-salmuera');
    if (btnSalmuera) btnSalmuera.onclick = medirSalmuera;

    // El ojo abre el paño para MIRARLO. No pide permiso a nadie porque no
    // cambia nada, y es lo que uno hace cuando ve un molde en rojo.
    pantalla.querySelectorAll('[data-ficha]').forEach((b) => {
      b.onclick = (ev) => { ev.stopPropagation(); detallePano(b.dataset.ficha, { mirar: true }); };
    });
    // Tocar el paño entra a sacarlo. Si no es el que toca, se abre igual
    // pero sin poder mover nada, con el botón para desbloquearlo.
    pantalla.querySelectorAll('[data-pano]').forEach((b) => {
      b.onclick = () => abrirPano(b.dataset.pano);
    });

    if (puedeVerNumeros) pantalla.querySelector('#siguientes').onclick = numerosASacar;
    if (!puedeRegistrar) return;

    pantalla.querySelector('#agua').onclick = () => {
      agua = agua === 'purificada' ? 'potable' : 'purificada';
      localStorage.setItem('tipo_agua', agua);
      pintar();
    };
  }

  /**
   * EL PANEL DE AL LADO.
   *
   * Los paños de un tanque no llegan al ancho de un monitor, y ese hueco
   * estaba vacío. Aquí va lo que uno viene a mirar de reojo mientras
   * trabaja: cómo está el tanque ahora mismo, cuántos moldes vienen
   * saliendo mal, y cómo salió el hielo de hoy en toda la fábrica.
   *
   * En el celular no hay hueco al lado, así que el panel se va abajo solo
   * (lo resuelve el CSS, no hay dos pantallas que mantener).
   */
  function panelTanque(tanque) {
    const cuenta = (e) => tanque.panos.filter((p) => p.estado === e).length;
    const marcados = tanque.panos.reduce((n, p) => n + (p.moldesMarcados || 0), 0);
    const m = hoy?.mezcla;
    const conAlgo = m ? CALIDADES.filter((c) => m[c.clave] > 0) : [];

    return `
      <aside class="prod-panel">
        <div class="tarjeta plana">
          <h3 class="panel-titulo">${esc(tanque.nombre)} ahora</h3>
          <div class="panel-cuentas">
            <span><strong>${cuenta('lista')}</strong><small>listos</small></span>
            <span><strong>${cuenta('congelando')}</strong><small>congelando</small></span>
            <span><strong>${cuenta('proceso')}</strong><small>a medias</small></span>
            <span><strong>${cuenta('fuera')}</strong><small>fuera</small></span>
          </div>
          ${marcados ? `
            <p class="panel-aviso">
              ⚠ ${marcados} ${marcados === 1 ? 'molde viene saliendo' : 'moldes vienen saliendo'}
              peor que sus vecinos. Toca el ojo del paño para ver cuál.
            </p>` : ''}

          ${salmueraHTML(tanque)}
        </div>

        ${datos.cuartoFrio ? `
          <div class="tarjeta plana cuarto-frio">
            <h3 class="panel-titulo">En el cuarto frío</h3>
            <strong class="cuarto-frio-numero ${datos.cuartoFrio.dieciseisavos < 0 ? 'malo' : ''}">
              ${esc(datos.cuartoFrio.texto)}
            </strong>
            <small>
              ${datos.cuartoFrio.dieciseisavos < 0
                ? 'menos que cero: falta capturar producción'
                : datos.cuartoFrio.desdeConteo
                  ? `desde el último conteo, ${esc(fechaCorta(datos.cuartoFrio.contadoEn))}`
                  : 'todavía no se ha contado nunca: es la suma de todo'}
            </small>
          </div>` : ''}

        ${hoy ? `
          <div class="tarjeta plana">
            <h3 class="panel-titulo">Hoy en la fábrica</h3>
            <div class="panel-cuentas">
              <span><strong>${hoy.panos.length}</strong><small>paños</small></span>
              <span><strong>${hoy.marquetas}</strong><small>al cuarto frío</small></span>
              <span><strong>${hoy.mezcla.producidas}</strong><small>salieron</small></span>
            </div>
            ${conAlgo.length || m.merma ? `
              <div class="mezcla-barra" style="margin-top:10px">
                ${conAlgo.map((c) => `
                  <span class="mezcla-tramo ${esc(c.clave)}" style="flex:${m[c.clave]}"
                        title="${esc(c.plural)}: ${m[c.clave]}"></span>`).join('')}
                ${m.merma ? `<span class="mezcla-tramo merma" style="flex:${m.merma}"
                                   title="Rotas: ${m.merma}"></span>` : ''}
              </div>
              <div class="mezcla-lista">
                ${conAlgo.map((c) => `
                  <span class="mezcla-parte ${esc(c.clave)}">${m[c.clave]} ${esc(c.corto)}</span>`).join('')}
                ${m.merma ? `<span class="mezcla-parte merma">${m.merma} rotas</span>` : ''}
              </div>` : '<p class="ayuda" style="margin:8px 0 0">Todavía no se ha sacado nada hoy.</p>'}
          </div>` : ''}

        <div class="panel-botones">
          <button class="secundario chico" id="ver-hoy">📅 Lo de hoy</button>
          ${estado.permisos.includes('*') || estado.permisos.includes('existencia.ver')
            ? '<a class="boton secundario chico" href="#/existencia">🧊 El cuarto frío</a>' : ''}
          ${estado.permisos.includes('*') || estado.permisos.includes('estadisticas.ver')
            ? '<a class="boton secundario chico" href="#/estadisticas">📊 Los números</a>' : ''}
        </div>
      </aside>`;
  }

  function sinTanques() {
    pantalla.innerHTML = `
      <h2>Producción</h2>
      <div class="tarjeta plana" style="text-align:center;padding:34px 20px">
        <div style="font-size:44px">🧊</div>
        <p class="ayuda" style="margin:12px 0 0">
          Todavía no hay tanques dados de alta.<br>
          Primero configúralos en <strong>Configurar tanques</strong>.
        </p>
        <a class="boton" href="#/config-tanques" style="margin-top:16px">Ir a configurar</a>
      </div>`;
  }

  /**
   * Una fila = un paño, y ahora también su historia.
   *
   * Debajo de las canastas va lo que uno pregunta mirando la lista: cuándo
   * se sacó la última vez, quién lo sacó y cuántas horas llevaba
   * congelando. Antes había que entrar paño por paño para saberlo.
   *
   * Del nombre solo va el DE PILA. En la fábrica nadie dice el apellido, y
   * con tres nombres completos el renglón se parte en dos.
   */
  function filaPano(p, toca) {
    const esElQueToca = toca && toca.id === p.id;
    const derecha = p.enProceso ? 'a medias'
                  : p.estado === 'fuera' ? 'fuera'
                  : p.estado === 'lista' ? 'listo'
                  : `${Math.floor(p.horas)} h`;

    // Un paño a medias enseña lo que falta, no lo que se sacó la vez pasada:
    // es lo único que hay que hacer con él, y quien mira la lista tiene que
    // verlo sin entrar.
    if (p.enProceso) {
      const quien = p.empezadoPor ? nombreDePila(p.empezadoPor) : null;
      // Un paño a medias es siempre el que toca, así que lleva también el
      // aro verde: si no, el que toca desaparecía de la pantalla justo
      // cuando hay algo urgente que hacer con él.
      return `
      <div class="pano-prod en-proceso ${esElQueToca ? 'toca-este' : ''}">
        <button class="pano-prod-cuerpo" data-pano="${esc(p.id)}">
          <span class="pano-prod-num">${p.numero}</span>
          <span class="pano-prod-medio">
            <span class="canastas-prod">
              ${p.canastas.map((c) => `
                <span class="canasta-prod ${c.yaSacada ? 'sacada' : c.estado}
                             ${c.tipoAgua === 'potable' ? 'potable' : ''}">
                  ${c.moldes.map((m) => `<i class="molde"></i>`).join('')}
                </span>`).join('')}
            </span>
            <small class="pano-prod-historia">
              a medias · faltan ${p.faltan} de ${p.canastas.length} canastas${
                quien ? ` · lo empezó ${esc(quien)}` : ''}
            </small>
          </span>
          <span class="pano-prod-horas proceso">a medias</span>
        </button>
        <button class="pano-prod-ojo" data-ficha="${esc(p.id)}"
                title="Ver el detalle de este paño (no cambia nada)">👁</button>
      </div>`;
    }

    const u = p.ultimaSacada;
    const historia = u
      ? [fechaCorta(u.fecha),
         u.quienes.length ? u.quienes.map(nombreDePila).join(', ') : null,
         u.horas != null ? `${Math.round(u.horas)} h` : null,
         u.marquetas ? `${u.marquetas} marq.` : null
        ].filter(Boolean).join(' · ')
      : 'nunca se ha sacado';

    return `
      <div class="pano-prod ${esElQueToca ? 'toca-este' : ''} ${p.enProceso ? 'en-proceso' : ''}">
        <button class="pano-prod-cuerpo" data-pano="${esc(p.id)}">
          <span class="pano-prod-num">${p.numero}</span>
          <span class="pano-prod-medio">
            <span class="canastas-prod">
              ${p.canastas.map((c) => `
                <span class="canasta-prod ${c.estado} ${c.tipoAgua === 'potable' ? 'potable' : ''}">
                  ${c.moldes.map((m) => `
                    <i class="molde ${m.ultimoFallo ? 'fallo' : ''}"
                       ${m.rachaFallos > 1 ? 'data-racha="' + m.rachaFallos + '"' : ''}></i>
                  `).join('')}
                </span>`).join('')}
            </span>
            <small class="pano-prod-historia ${u ? '' : 'nunca'}">${esc(historia)}</small>
          </span>
          <span class="pano-prod-horas ${p.enProceso ? 'proceso' : p.estado}">${derecha}</span>
        </button>
        <button class="pano-prod-ojo" data-ficha="${esc(p.id)}"
                title="Ver el detalle de este paño (no cambia nada)">👁</button>
      </div>`;
  }

  /**
   * Puerta de entrada al paño.
   *
   * ANTES pedía el PIN antes de enseñar nada, y eso estaba mal para el uso
   * más común: ver un molde marcado en rojo y querer saber qué le pasó.
   * Mirar no cambia nada. Ahora cualquier paño se abre siempre; lo que
   * queda bajo llave es SACARLO, y el PIN se pide desde dentro, cuando de
   * verdad se va a mover algo.
   */
  async function abrirPano(panoId) {
    const toca = datos.tanque.siguiente;
    return detallePano(panoId, { mirar: !(!toca || toca.id === panoId) });
  }

  /** Pide el PIN para sacar un paño fuera de la rotación. Devuelve el vale. */
  async function pedirVale(pano, toca) {
    const auth = await pedirAutorizacion({
      titulo: `El paño ${pano.numero} no es el que sigue`,
      texto: `Toca el ${toca.numero}. Un gerente o el administrador tiene que ` +
             'autorizar con su PIN para poder sacar este paño.',
      responsables: datos.responsables
    });
    if (!auth) return null;

    try {
      const r = await api.enviar('/produccion/autorizar', { panoId: pano.id, ...auth });
      avisar(`Autorizado por ${r.autorizadaPor}`, 'bien');
      return r.vale;
    } catch (e) { avisar(e.message, 'error'); return null; }
  }

  // ==========================================================
  // DETALLE DEL PAÑO — mirarlo, y si toca, sacarlo
  // ==========================================================

  /**
   * Una sola pantalla para las dos cosas, y no dos parecidas que mantener.
   *
   *   MIRAR    cualquier paño, sin permiso de nadie: cuándo se sacó la
   *            última vez, quién, cuántas horas llevaba y qué salió de cada
   *            molde. Abajo, el botón para desbloquearlo con PIN.
   *   SACAR    el que toca (o el autorizado): cómo salió el hielo, los
   *            moldes que salieron distintos, y sacar.
   */
  async function detallePano(panoId, opciones = {}) {
    const pano = datos.tanque.panos.find((p) => p.id === panoId);
    if (!pano) return pintar();

    const toca = datos.tanque.siguiente;
    const esElQueToca = !toca || toca.id === panoId;
    let vale = opciones.vale || null;
    let mirando = Boolean(opciones.mirar) || !puedeRegistrar;

    // La historia se pide siempre: en la vista de mirar ES la pantalla, y
    // en la de sacar es el renglón de arriba que dice cuándo fue la última
    // vez — lo primero que se pregunta antes de tocar nada.
    const [ficha, { obreros }] = await Promise.all([
      api.obtener(`/produccion/panos/${panoId}/ficha`).catch(() => null),
      api.obtener('/produccion/obreros')
    ]);

    // CÓMO SALIÓ EL HIELO. Primero una sola respuesta para el paño entero,
    // que es lo que de verdad pasa —la fábrica congela bien o mal esa
    // noche y el paño sale parejo—, y encima las excepciones molde por
    // molde. Al revés sería pedir doce respuestas para contestar una.
    let calidadPano = 'normal';
    let destinoPano = 'condensadores';
    let notaPano = '';
    const marcas = new Map();          // moldeId -> { resultado, destino, nota }

    const fuera = pano.canastas.filter((c) => c.estado === 'fuera');
    const dentro = pano.canastas.filter((c) => c.estado !== 'fuera');

    // CANASTA POR CANASTA.
    //
    // Un paño no siempre sale de un jalón: a veces se saca una canasta y no
    // se toca la siguiente hasta que esa se gasta, para darle más horas al
    // hielo. Entonces el turno cierra a media faena y quedan canastas
    // colgadas, que las saca el turno de mañana — y cada una guarda quién
    // la sacó de verdad.
    //
    // Por omisión van todas marcadas: sacar el paño entero sigue siendo un
    // solo toque, como siempre. Desmarcar es la excepción, y se paga.
    const hechas = dentro.filter((c) => c.yaSacada);
    const porSacar = dentro.filter((c) => !c.yaSacada);
    const elegidas = new Set(porSacar.map((c) => c.id));

    // Quién lo sacó: por omisión el que tiene la sesión, pero casi siempre
    // es otra persona la que estuvo en la grúa.
    // Solo salen los operarios: sacar paños es su trabajo. Para el eventual
    // de un día, o el dueño, está "Otro…" y su nombre se escribe tal cual.
    // Quién lo ANOTÓ no se pregunta: es el usuario de la sesión, siempre.
    // Para el operario se da por hecho que fue él, y ni se le pregunta.
    let quienId = soyElQueSaca
      ? estado.usuario.id
      : (obreros.find((o) => o.id === estado.usuario.id)?.id || obreros[0]?.id || '');
    let quienNombre = '';

    /** Lo que le toca a un molde: su marca propia, o la del paño. */
    const deMolde = (id) => marcas.get(id) || {
      resultado: calidadPano,
      destino: pideDestino(calidadPano) ? destinoPano : null,
      nota: notaPano || null
    };

    /** La mezcla de todo el paño tal como va quedando. */
    function contar() {
      const cuenta = {};
      let alAlmacen = 0;
      for (const c of porSacar.filter((x) => elegidas.has(x.id))) {
        for (const m of c.moldes) {
          const r = deMolde(m.id);
          cuenta[r.resultado] = (cuenta[r.resultado] || 0) + 1;
          if (esVendible(r.resultado)) alAlmacen++;
          else if (pideDestino(r.resultado) && r.destino === 'almacen') alAlmacen++;
        }
      }
      return { cuenta, alAlmacen };
    }

    const dibujar = () => {
      const { cuenta, alAlmacen } = contar();
      const elegida = CALIDADES.find((c) => c.clave === calidadPano);
      const destino = DESTINOS.find((d) => d.clave === destinoPano);
      const marcadas = porSacar.filter((c) => elegidas.has(c.id));
      const totalMoldes = marcadas.reduce((n, c) => n + c.moldes.length, 0);
      const quedarian = porSacar.length - marcadas.length;

      pantalla.innerHTML = `
        ${cabezaPano(pano, ficha, vale, mirando)}

        ${mirando ? fichaHTML(ficha, pano) : `
          ${porSacar.length ? `
            <div class="pano-captura">
              <div class="tarjeta">
                ${soyElQueSaca ? `
                  <label>Lo saca</label>
                  <p class="quien-fijo">${esc(estado.usuario.nombre)}</p>`
                : `
                  <label for="quien">¿Quién lo sacó?</label>
                  <select id="quien" class="select-angosto">
                    ${obreros.map((o) => `
                      <option value="${esc(o.id)}" ${o.id === quienId ? 'selected' : ''}>
                        ${esc(o.nombre)}
                      </option>`).join('')}
                    <option value="" ${quienId ? '' : 'selected'}>
                      Otro… ${quienNombre ? `(${esc(quienNombre)})` : ''}
                    </option>
                  </select>`}

                <label style="margin-top:14px">Agua con la que se rellena</label>
                <button class="agua-boton ${agua}" id="agua-pano">
                  <span class="agua-icono">💧</span>
                  <span>${agua === 'purificada' ? 'Purificada' : 'Potable'}</span>
                </button>
              </div>

              <div class="tarjeta">
                <label>¿Cómo salió el hielo de este paño?</label>
                <div class="calidades">
                  ${CALIDADES.map((c) => `
                    <button class="calidad-boton ${esc(c.clave)} ${c.clave === calidadPano ? 'elegida' : ''}"
                            data-calidad="${esc(c.clave)}">
                      <span class="calidad-icono">${c.icono}</span>
                      <span class="calidad-nombre">${esc(c.plural)}</span>
                    </button>`).join('')}
                </div>
                <p class="ayuda calidad-nota">${esc(elegida ? elegida.nota : '')}</p>

                ${calidadPano === 'otro' && notaPano ? `
                  <p class="nota-escrita">✎ ${esc(notaPano)}
                    <button class="enlace" id="editar-nota">cambiar</button></p>` : ''}

                ${pideDestino(calidadPano) ? `
                  <label style="margin-top:12px">¿Qué se hizo con ese hielo?</label>
                  <div class="fila-botones">
                    ${DESTINOS.map((d) => `
                      <button class="${d.clave === destinoPano ? '' : 'secundario'}"
                              data-destino="${esc(d.clave)}">${d.icono} ${esc(d.nombre)}</button>`).join('')}
                  </div>
                  <p class="ayuda">${esc(destino ? destino.nota : '')}</p>` : ''}
              </div>
            </div>` : ''}

          ${fuera.length ? `
            <div class="alerta-fuera">
              ⚠️ ${fuera.length} ${fuera.length === 1 ? 'canasta está' : 'canastas están'} fuera del tanque
            </div>
            <button id="rellenar" style="margin-bottom:14px">
              💧 Rellenar con agua ${agua}
            </button>` : ''}

          ${hechas.length ? `
            <div class="aviso-medias">
              <strong>Este paño quedó a medias.</strong>
              Ya se ${hechas.length === 1 ? 'sacó' : 'sacaron'} ${hechas.length} de
              ${dentro.length} canastas${pano.empezadoPor
                ? `; ${hechas.length === 1 ? 'la sacó' : 'las sacó'} ${esc(pano.empezadoPor)}` : ''}.
              ${porSacar.length
                ? `Faltan ${porSacar.length}, y hasta terminarlas nadie puede pasar al siguiente paño.`
                : 'Ya no falta ninguna.'}
            </div>

            <div class="canastas-merma">
              ${hechas.map((c) => `
                <div class="tarjeta canasta-hecha">
                  <div class="canasta-cabeza">
                    <strong>✓ Canasta ${c.numero}</strong>
                    <small>${esc([c.sacadaPor && nombreDePila(c.sacadaPor),
                                  c.sacadaEn && fechaCorta(c.sacadaEn)].filter(Boolean).join(' · ')
                                 || 'ya se sacó')}</small>
                  </div>
                  <div class="moldes-detalle">
                    ${c.moldes.map((m) => `
                      <span class="molde-boton ${esc(m.ultimoResultado || 'normal')} sin-tocar"
                            title="${esc(nombreLargo({ resultado: m.ultimoResultado }))}">
                        <span class="molde-num">${m.numero}</span>
                        <span class="molde-estado">${esc(etiqueta({ resultado: m.ultimoResultado }))}</span>
                      </span>`).join('')}
                  </div>
                </div>`).join('')}
            </div>` : ''}

          ${porSacar.length ? `
            <p class="ayuda">
              ${porSacar.length === dentro.length
                ? 'Así queda TODO el paño. Toca un molde suelto solo si ese salió distinto del resto.'
                : 'Así quedan las canastas que faltan. Toca un molde suelto si salió distinto del resto.'}
              ${porSacar.length > 1
                ? ' Si hoy solo vas a sacar unas, desmárcalas: las demás quedan pendientes.'
                : ''}
            </p>

            <div class="canastas-merma">
              ${porSacar.map((c) => `
                <div class="tarjeta ${elegidas.has(c.id) ? '' : 'canasta-dejada'}">
                  <div class="canasta-cabeza">
                    ${porSacar.length > 1 ? `
                      <label class="canasta-elegir">
                        <input type="checkbox" data-canasta="${esc(c.id)}"
                               ${elegidas.has(c.id) ? 'checked' : ''}>
                        <strong>Canasta ${c.numero}</strong>
                      </label>` : `<strong>Canasta ${c.numero}</strong>`}
                    <small>${elegidas.has(c.id)
                      ? (c.tipoAgua ? `agua ${esc(c.tipoAgua)}` : 'sin registro')
                      : 'queda pendiente'}</small>
                  </div>
                  <div class="moldes-detalle">
                    ${c.moldes.map((m) => {
                      const r = deMolde(m.id);
                      const propia = marcas.has(m.id);
                      return `<button class="molde-boton ${esc(r.resultado)} ${propia ? 'aparte' : ''}"
                                      data-molde="${esc(m.id)}"
                                      ${elegidas.has(c.id) ? '' : 'disabled'}
                                      title="${esc(nombreLargo(r))}">
                                <span class="molde-num">${m.numero}</span>
                                <span class="molde-estado">${esc(etiqueta(r))}</span>
                                ${m.rachaFallos ? `<span class="molde-aviso"
                                   title="Ha salido peor que sus vecinos ${m.rachaFallos} ${
                                     m.rachaFallos === 1 ? 'vez' : 'veces'} seguidas"
                                   >${m.rachaFallos}</span>` : ''}
                              </button>`;
                    }).join('')}
                  </div>
                </div>`).join('')}
            </div>

            <div class="pano-cierre">
              <div class="cierre-resultado">
                <div class="cierre-numero">
                  <strong>${alAlmacen}</strong>
                  <small>de ${totalMoldes} moldes entran al cuarto frío</small>
                </div>
                ${quedarian ? `
                  <p class="cierre-aviso">
                    ${quedarian} ${quedarian === 1 ? 'canasta queda' : 'canastas quedan'}
                    pendiente${quedarian === 1 ? '' : 's'}: el paño sigue a medias y no se
                    puede pasar al siguiente hasta terminarlo.
                  </p>` : ''}
                <div class="mezcla-viva">
                  ${CALIDADES.filter((c) => cuenta[c.clave])
                      .map((c) => `<span class="mezcla-parte ${esc(c.clave)}"
                                         >${cuenta[c.clave]} ${esc(c.corto)}</span>`).join('')}
                  ${cuenta.merma ? `<span class="mezcla-parte merma">${cuenta.merma} rotas</span>` : ''}
                </div>
              </div>
              <div class="cierre-botones">
                <button id="sacar" ${marcadas.length ? '' : 'disabled'}>${
                  marcadas.length === dentro.length
                    ? `Sacar el paño ${pano.numero}`
                    : `Sacar ${marcadas.length} ${marcadas.length === 1 ? 'canasta' : 'canastas'}`}</button>
                <button class="secundario" id="sacar-fuera"
                        ${marcadas.length ? '' : 'disabled'}>Sacar y dejarlo fuera</button>
              </div>
            </div>` : ''}

          ${puedeCorregir ? `
            <details class="corregir">
              <summary>Corregir</summary>
              <div class="tarjeta" style="text-align:center">
                <button class="peligro" id="anular">Anular la última sacada de este paño</button>
                <p class="ayuda" style="margin:14px 0 0">
                  Para cuando se equivocaron de paño. No se borra nada: el registro
                  queda marcado como anulado, con su motivo y quién lo hizo.
                </p>
              </div>
            </details>` : ''}

          <p class="firma">
            Los números en rojo son las veces seguidas que ese molde salió PEOR
            QUE EL RESTO de su paño. Que una noche entera salga hueca no marca
            a nadie: eso es la fábrica, no el molde.
          </p>`}`;

      pantalla.querySelector('#volver').onclick = pintar;

      const btnDesbloquear = pantalla.querySelector('#desbloquear');
      if (btnDesbloquear) btnDesbloquear.onclick = async () => {
        if (!esElQueToca) {
          const v = await pedirVale(pano, toca);
          if (!v) return;
          vale = v;
        }
        mirando = false;
        dibujar();
      };

      const btnMirar = pantalla.querySelector('#mirar');
      if (btnMirar) btnMirar.onclick = () => { mirando = true; dibujar(); };

      if (mirando) return;

      // La tarjeta de captura solo existe si queda algo por sacar.
      if (!porSacar.length) {
        const btnAnularSolo = pantalla.querySelector('#anular');
        if (btnAnularSolo) btnAnularSolo.onclick = anular;
        return;
      }

      const selQuien = pantalla.querySelector('#quien');
      if (selQuien) selQuien.onchange = async (e) => {
        quienId = e.target.value;
        if (!quienId) {
          const nombre = await pedirTexto({
            titulo: '¿Quién lo sacó?',
            texto: 'El nombre de quien sacó el paño: un eventual, alguien de ' +
                   'fuera… Queda guardado tal cual, y también queda quién lo anotó.',
            valor: quienNombre, marcador: 'Juan', ok: 'Ese fue', largo: 40, unaLinea: true
          });
          if (nombre) quienNombre = nombre;
          else if (!quienNombre) { quienId = obreros[0]?.id || ''; }
          dibujar();
        }
      };

      // El agua se cambia aquí mismo y se queda para las siguientes veces.
      pantalla.querySelector('#agua-pano').onclick = () => {
        agua = agua === 'purificada' ? 'potable' : 'purificada';
        localStorage.setItem('tipo_agua', agua);
        dibujar();
      };

      pantalla.querySelectorAll('[data-calidad]').forEach((b) => {
        b.onclick = async () => {
          const clave = b.dataset.calidad;
          // "Otro" no sirve de nada sin la explicación: si no se escribe,
          // no se cambia el estado.
          if (pideNota(clave)) {
            const texto = await pedirNota(notaPano);
            if (!texto) return;
            notaPano = texto;
          } else {
            notaPano = '';
          }
          calidadPano = clave;
          dibujar();
        };
      });
      const btnNota = pantalla.querySelector('#editar-nota');
      if (btnNota) btnNota.onclick = async () => {
        const texto = await pedirNota(notaPano);
        if (texto) { notaPano = texto; dibujar(); }
      };
      pantalla.querySelectorAll('[data-destino]').forEach((b) => {
        b.onclick = () => { destinoPano = b.dataset.destino; dibujar(); };
      });

      pantalla.querySelectorAll('[data-canasta]').forEach((casilla) => {
        casilla.onchange = () => {
          if (casilla.checked) elegidas.add(casilla.dataset.canasta);
          else elegidas.delete(casilla.dataset.canasta);
          dibujar();
        };
      });

      // UN MOLDE SUELTO. Se abre la lista y se elige: con nueve estados,
      // ir cambiando de uno en uno a cada toque sería peor que buscar.
      pantalla.querySelectorAll('[data-molde]').forEach((b) => {
        b.onclick = async () => {
          const id = b.dataset.molde;
          const numero = b.querySelector('.molde-num').textContent;
          const elegido = await preguntarComoSalio({
            titulo: `Molde ${numero}`,
            texto: 'Cómo salió ESTE molde, si salió distinto del resto del paño.',
            conIgual: marcas.has(id),
            destinoSugerido: destinoPano
          });
          if (elegido === undefined) return;         // se canceló
          if (elegido === null) marcas.delete(id);   // "como el resto"
          else marcas.set(id, elegido);
          dibujar();
        };
      });

      const btnRellenar = pantalla.querySelector('#rellenar');
      if (btnRellenar) btnRellenar.onclick = async () => {
        try {
          const r = await api.enviar(`/produccion/panos/${pano.id}/rellenar`,
            { tipoAgua: agua, ejecutorId: quienId || null, ejecutorNombre: quienNombre || null });
          avisar(`${r.rellenadas} canastas rellenadas con agua ${agua}`, 'bien');
          pintar();
        } catch (e) { avisar(e.message, 'error'); }
      };

      const btnSacar = pantalla.querySelector('#sacar');
      if (btnSacar) btnSacar.onclick = () => sacar({ rellenar: true });

      const btnFuera = pantalla.querySelector('#sacar-fuera');
      if (btnFuera) btnFuera.onclick = async () => {
        const sigue = await confirmar({
          titulo: marcadas.length === dentro.length
            ? `¿Dejar el paño ${pano.numero} fuera?`
            : `¿Dejar fuera ${marcadas.length} ${marcadas.length === 1 ? 'canasta' : 'canastas'}?`,
          texto: 'Se saca el hielo pero los moldes NO se rellenan. Quedarán en la alerta ' +
                 'hasta que alguien los llene.',
          ok: 'Dejarlo fuera'
        });
        if (sigue) sacar({ rellenar: false });
      };

      const btnAnular = pantalla.querySelector('#anular');
      if (btnAnular) btnAnular.onclick = anular;
    };

    async function sacar(opciones, autorizacion) {
      // Solo los moldes de las canastas que de verdad se van a sacar: una
      // marca en una canasta desmarcada no tiene dónde guardarse.
      const deLasElegidas = new Set(
        porSacar.filter((c) => elegidas.has(c.id)).flatMap((c) => c.moldes.map((m) => m.id)));
      const resultados = [...marcas.entries()]
        .filter(([moldeId]) => deLasElegidas.has(moldeId))
        .map(([moldeId, m]) => ({ moldeId, ...m }));

      try {
        const r = await api.enviar(`/produccion/panos/${pano.id}/sacar`, {
          tipoAgua: agua, calidad: calidadPano, destino: destinoPano,
          nota: notaPano || null, canastas: [...elegidas],
          resultados, ejecutorId: quienId || null,
          ejecutorNombre: quienNombre || null, vale, ...opciones, autorizacion
        });
        const fuera = r.mezcla.fueraDelAlmacen;
        avisar(
          `Paño ${pano.numero}: ${r.marquetas} al cuarto frío` +
          (fuera ? ` · ${fuera} no entraron` : '') +
          (r.merma ? ` · ${r.merma} rotas` : '') +
          (r.faltan ? ` · quedan ${r.faltan} canastas pendientes` : ''), 'bien');
        await pintar();
      } catch (e) {
        if (e.requiereAutorizacion || /autoriza|PIN/i.test(e.message)) {
          const auth = await pedirAutorizacion({
            titulo: `No toca el paño ${pano.numero}`,
            texto: e.message + ' Un gerente o el administrador tiene que autorizarlo con su PIN.',
            responsables: datos.responsables
          });
          if (!auth) return;
          return sacar(opciones, auth);
        }
        avisar(e.message, 'error');
      }
    }

    async function anular() {
      const motivo = await pedirTexto({
        titulo: `Anular la última sacada del paño ${pano.numero}`,
        texto: 'El registro queda marcado como anulado y el paño vuelve como estaba.',
        marcador: 'Se equivocaron de paño, se registró dos veces...',
        ok: 'Anular'
      });
      if (!motivo) return;

      try {
        await api.enviar(`/produccion/panos/${pano.id}/anular-ultima`, { motivo });
        avisar('Registro anulado', 'bien');
        pintar();
      } catch (e) { avisar(e.message, 'error'); }
    }

    dibujar();
  }

  /**
   * LA CABECERA DEL PAÑO, en un solo renglón.
   *
   * Antes eran tres —el botón de volver, el título y los datos— y en la
   * pantalla del paño cada renglón que se gana es un renglón de canastas
   * que se ve sin bajar.
   */
  function cabezaPano(pano, ficha, vale, mirando) {
    const u = ficha?.ultima;

    return `
      <div class="pano-cabeza">
        <button class="secundario chico" id="volver">‹ Volver</button>
        <!-- EL TANQUE VA EN EL TÍTULO, con el mismo peso que el paño.
             Aquí es donde de verdad se anota, y anotar en el tanque que no
             es cuesta un paño entero que no se descubre hasta el día
             siguiente. -->
        <h2><span class="pano-tanque">${esc(datos.tanque.nombre)}</span> · Paño ${pano.numero}</h2>
        <span class="pano-cabeza-datos">
          ${pano.canastas.length} canastas ·
          ${pano.horas != null ? `${Math.floor(pano.horas)} h congelando`
            : pano.estado === 'fuera' ? 'fuera del tanque' : 'listo'}
          ${pano.enProceso ? ` · empezado por ${esc(pano.empezadoPor || '—')}` : ''}
        </span>
        ${u ? `
          <span class="pano-cabeza-ultima" title="La última vez que se sacó este paño">
            última vez: ${esc(fechaCorta(u.fecha))}${
              u.quienes.length ? ` · ${esc(u.quienes.map(nombreDePila).join(', '))}` : ''}
          </span>` : '<span class="pano-cabeza-ultima">nunca se ha sacado</span>'}
        ${vale ? '<strong class="autorizado">autorizado</strong>' : ''}
        ${mirando ? '' : '<button class="secundario chico" id="mirar">👁 Historia</button>'}
      </div>`;
  }

  /**
   * LO QUE PASÓ AQUÍ, en solo lectura.
   *
   * Es la respuesta a "veo un molde en rojo, ¿qué le pasó?", y por eso lo
   * primero es el mapa de moldes de la última vez, con su color. Debajo,
   * las veces anteriores, para ver si algo se viene repitiendo.
   */
  function fichaHTML(ficha, pano) {
    if (!ficha) return '<p class="vacio">No se pudo leer la historia de este paño.</p>';

    const u = ficha.ultima;
    const porCanasta = new Map();
    for (const m of ficha.moldes || []) {
      if (!porCanasta.has(m.canasta)) porCanasta.set(m.canasta, []);
      porCanasta.get(m.canasta).push(m);
    }

    return `
      <p class="ayuda">
        Esto es historia: aquí no se cambia nada. Para sacar este paño hay que
        desbloquearlo abajo.
      </p>

      ${u ? `
        <div class="tarjeta plana">
          <h3>La última vez</h3>
          <div class="hist-resumen">
            <div class="hist-dato"><small>Cuándo</small>
              <strong>${esc(fechaCorta(u.fecha))}</strong></div>
            <div class="hist-dato"><small>Quién</small>
              <strong>${esc(u.quienes.map(nombreDePila).join(', ') || '—')}</strong></div>
            <div class="hist-dato"><small>Congelando</small>
              <strong>${u.horas != null ? `${Math.round(u.horas)} h` : '—'}</strong></div>
            <div class="hist-dato"><small>Al cuarto frío</small>
              <strong>${u.mezcla.alAlmacen}</strong></div>
          </div>
          ${u.autorizo ? `<p class="ayuda">Se sacó fuera de la rotación, autorizado por
            <b>${esc(u.autorizo)}</b>${u.motivoOrden ? `: ${esc(u.motivoOrden)}` : ''}.</p>` : ''}
        </div>

        <div class="canastas-merma">
          ${[...porCanasta.entries()].map(([num, moldes]) => `
            <div class="tarjeta">
              <div class="canasta-cabeza"><strong>Canasta ${num}</strong></div>
              <div class="moldes-detalle">
                ${moldes.map((m) => `
                  <span class="molde-boton ${esc(m.resultado)} sin-tocar"
                        title="${esc(nombreLargo(m))}${m.nota ? ` — ${esc(m.nota)}` : ''}">
                    <span class="molde-num">${m.molde}</span>
                    <span class="molde-estado">${esc(etiqueta(m))}</span>
                  </span>`).join('')}
              </div>
            </div>`).join('')}
        </div>` : '<p class="vacio">Este paño nunca se ha sacado.</p>'}

      ${ficha.historial.length > 1 ? `
        <h3>Las veces anteriores</h3>
        <div class="hist-envoltura">
          <table class="tabla hist-tabla">
            <tr><th>Cuándo</th><th>Quién</th><th class="der">Horas</th>
                <th class="der">Al cuarto frío</th><th>Cómo salió</th></tr>
            ${ficha.historial.map((h) => `
              <tr class="${h.anulada ? 'anulada' : ''}">
                <td>${esc(fechaCorta(h.fecha))}</td>
                <td>${esc(h.quienes.map(nombreDePila).join(', ') || '—')}</td>
                <td class="der">${h.horas != null ? Math.round(h.horas) : '—'}</td>
                <td class="der">${h.anulada ? '—' : h.mezcla.alAlmacen}</td>
                <td>${h.anulada ? '<em>anulada</em>' : `
                  <span class="mezcla-lista">
                    ${CALIDADES.filter((c) => h.mezcla[c.clave])
                      .map((c) => `<span class="mezcla-parte ${esc(c.clave)}"
                                        >${h.mezcla[c.clave]} ${esc(c.corto)}</span>`).join('')}
                    ${h.mezcla.merma ? `<span class="mezcla-parte merma">${h.mezcla.merma} rotas</span>` : ''}
                  </span>`}</td>
              </tr>`).join('')}
          </table>
        </div>` : ''}

      ${puedeRegistrar ? `
        <div class="acciones-centradas" style="margin-top:18px">
          <button id="desbloquear">🔓 Desbloquear para sacar el paño ${pano.numero}</button>
        </div>` : ''}`;
  }

  // ==========================================================
  // LOS ESTADOS DEL HIELO, vistos desde la pantalla
  //
  // Ninguna de estas funciones sabe CUÁLES estados hay ni cómo se llaman:
  // eso viaja del servidor en `CALIDADES` (src/modulos/produccion/calidad.js)
  // con las reglas ya resueltas. Así no hay una segunda lista aquí que se
  // pueda quedar vieja el día que entre un estado nuevo.
  // ==========================================================

  const deCatalogo = (clave) => CALIDADES.find((c) => c.clave === clave);
  const pideDestino = (clave) => Boolean(deCatalogo(clave)?.pideDestino);
  const pideNota = (clave) => Boolean(deCatalogo(clave)?.pideNota);
  const esVendible = (clave) => Boolean(deCatalogo(clave)?.vendible);

  /**
   * El texto corto que va DENTRO del botón de un molde. Tiene que caber en
   * 62 píxeles, así que son una o dos palabras; el nombre entero sale en el
   * título al pasar el ratón.
   */
  const etiqueta = (r) =>
    (r.resultado === 'merma' ? 'rota' : deCatalogo(r.resultado)?.boton) || r.resultado;

  /** El nombre completo, con el destino y la nota cuando los hay. */
  function nombreLargo(r) {
    if (r.resultado === 'merma') return 'Se rompió';
    const c = deCatalogo(r.resultado);
    let texto = c?.nombre || r.resultado;
    if (c?.pideDestino && r.destino) {
      const d = DESTINOS.find((x) => x.clave === r.destino);
      if (d) texto += ` — ${d.nombre.toLowerCase()}`;
    }
    return texto;
  }

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

  /**
   * LA PREGUNTA COMPLETA PARA UN MOLDE SUELTO: cómo salió, a dónde fue y
   * qué pasó. Se hace en pasos porque no todos los estados piden lo mismo:
   * la mayoría se contesta con un solo toque y solo tres siguen preguntando.
   *
   * Devuelve `undefined` si se canceló, `null` si se eligió "como el resto
   * del paño", o { resultado, destino, nota }.
   */
  async function preguntarComoSalio({ titulo, texto, conIgual, destinoSugerido }) {
    const opciones = [];
    if (conIgual) {
      opciones.push({ valor: 'igual', texto: '↩ Como el resto del paño',
                      detalle: 'Quita la marca de este molde.' });
    }
    for (const c of CALIDADES) {
      opciones.push({ valor: c.clave, texto: `${c.icono} ${c.nombre}`, detalle: c.nota });
    }
    opciones.push({ valor: 'merma', texto: '💔 Se rompió',
                    detalle: 'No dio nada aprovechable. No es una calidad: es una pérdida.',
                    peligro: true });

    const elegido = await menu({ titulo, texto, opciones });
    if (!elegido) return undefined;
    if (elegido === 'igual') return null;

    let destino = null;
    if (pideDestino(elegido)) {
      const sug = DESTINOS.find((d) => d.clave === destinoSugerido);
      destino = await menu({
        titulo: '¿Qué se hizo con ese hielo?',
        texto: sug ? `El resto del paño se fue ${sug.nombre.toLowerCase()}.` : '',
        opciones: DESTINOS.map((d) => ({
          valor: d.clave, texto: `${d.icono} ${d.nombre}`, detalle: d.nota
        }))
      });
      if (!destino) return undefined;
    }

    let nota = null;
    if (pideNota(elegido)) {
      nota = await pedirNota('');
      if (!nota) return undefined;
    }

    return { resultado: elegido, destino, nota };
  }

  /**
   * LA SALMUERA DEL TANQUE.
   *
   * Se mide de vez en cuando, sin horario: cuando alguien se acuerda. Tres
   * tomas —cerca de los serpentines, en la salida más cercana y en la más
   * lejana— y lo que interesa es el promedio. Aquí solo se dice cuándo fue
   * la última y cuánto dio, porque son datos que a veces sirven y que hasta
   * hoy no quedaban en ninguna parte.
   */
  function salmueraHTML(tanque) {
    const u = ultimaSalmuera[tanque.id];
    const dias = u ? Math.floor((Date.now() - new Date(u.fecha).getTime()) / 86400000) : null;

    return `
      <div class="salmuera">
        <span class="salmuera-etiqueta">Salmuera</span>
        ${u ? `
          <strong class="salmuera-grados">${u.promedio} °C</strong>
          <small>${dias === 0 ? 'medida hoy'
            : dias === 1 ? 'medida ayer'
            : `medida hace ${dias} días`}</small>`
          : '<small class="salmuera-nunca">nunca se ha medido</small>'}
        ${puedeRegistrar ? `
          <button class="secundario chico" id="medir-salmuera">🌡 Medir</button>` : ''}
      </div>`;
  }

  /**
   * MEDIR LA SALMUERA: las tres tomas.
   *
   * Las tres son opcionales por separado —a veces solo se alcanza una— pero
   * alguna tiene que venir. El promedio sale de las que haya y no se
   * guarda: se calcula cada vez, para que corregir una toma no deje un
   * promedio viejo diciendo otra cosa.
   */
  async function medirSalmuera() {
    const tanque = datos.tanque;
    const { mediciones } = await api.obtener(
      `/clima/salmuera?tanque=${encodeURIComponent(tanque.id)}&limite=20`);
    const { obreros } = await api.obtener('/produccion/obreros');

    const campo = (id, titulo, ayuda) => `
      <label>
        <span class="etiqueta-chica">${titulo}<small>${ayuda || '°C'}</small></span>
        <div class="campo-con-unidad">
          <input id="${id}" inputmode="decimal" placeholder="-8.5" autocomplete="off">
          <span class="unidad">°C</span>
        </div>
      </label>`;

    pantalla.innerHTML = `
      <button class="secundario chico" id="volver">‹ ${esc(tanque.nombre)}</button>
      <h2 style="margin-top:14px">Temperatura de la salmuera · ${esc(tanque.nombre)}</h2>
      <p class="ayuda">
        Tres tomas <b>en grados centígrados (°C)</b> y el sistema saca el
        promedio. No hace falta hacerlo con ningún horario: se anota cuando
        se mide, y queda de registro.
      </p>

      <div class="tarjeta">
        <div class="salmuera-campos">
          ${campo('t-serp', 'Cerca de los serpentines', 'donde más frío hace')}
          ${campo('t-cerca', 'Salida más cercana', '')}
          ${campo('t-lejos', 'Salida más lejana', 'donde menos frío llega')}
        </div>
        <p class="ayuda">
          En <b>grados centígrados</b>, y con su signo: la salmuera trabaja
          bajo cero, así que casi siempre van con un menos delante. Se puede
          dejar alguna vacía.
        </p>

        <label style="margin-top:10px">
          <span class="etiqueta-chica">¿Quién la midió?</span>
          <select id="t-quien" class="select-angosto">
            <option value="">Yo mismo</option>
            ${obreros.map((o) => `
              <option value="${esc(o.id)}">${esc(o.nombre)}</option>`).join('')}
          </select>
        </label>
        <label style="margin-top:10px">
          <span class="etiqueta-chica">Notas<small>opcional</small></span>
          <input id="t-notas" maxlength="300" placeholder="Se acababa de arrancar el compresor…">
        </label>

        <div class="acciones-centradas">
          <button id="t-guardar">Guardar la medición</button>
        </div>
      </div>

      ${mediciones.length ? `
        <h3>Las anteriores</h3>
        <div class="hist-envoltura">
          <table class="tabla hist-tabla">
            <tr><th>Cuándo</th><th class="der">Serpentines °C</th><th class="der">Cerca °C</th>
                <th class="der">Lejos °C</th><th class="der">Promedio</th><th>Quién</th><th></th></tr>
            ${mediciones.map((m) => `
              <tr class="${m.anulada_en ? 'anulada' : ''}">
                <td>${esc(fechaCorta(m.fecha))}</td>
                <td class="der">${m.serpentines ?? '—'}</td>
                <td class="der">${m.salida_cerca ?? '—'}</td>
                <td class="der">${m.salida_lejos ?? '—'}</td>
                <td class="der"><strong>${m.anulada_en ? '—' : `${m.promedio} °C`}</strong></td>
                <td>${esc(nombreDePila(m.ejecutor_nombre))}</td>
                <td>${puedeCorregir && !m.anulada_en
                  ? `<button class="secundario chico" data-anular-medicion="${esc(m.id)}"
                             title="Anularla">×</button>` : ''}</td>
              </tr>
              ${m.notas ? `<tr class="${m.anulada_en ? 'anulada' : ''}">
                <td colspan="7"><small>${esc(m.notas)}</small></td></tr>` : ''}`).join('')}
          </table>
        </div>` : '<p class="vacio">Todavía no se ha medido la salmuera de este tanque.</p>'}`;

    const q = (sel) => pantalla.querySelector(sel);
    q('#volver').onclick = pintar;

    q('#t-guardar').onclick = async () => {
      try {
        await api.enviar('/clima/salmuera', {
          tanqueId: tanque.id,
          serpentines: q('#t-serp').value,
          salidaCerca: q('#t-cerca').value,
          salidaLejos: q('#t-lejos').value,
          ejecutorId: q('#t-quien').value || null,
          notas: q('#t-notas').value
        });
        avisar('Medición guardada', 'bien');
        medirSalmuera();
      } catch (e) { avisar(e.message, 'error'); }
    };

    pantalla.querySelectorAll('[data-anular-medicion]').forEach((b) => {
      b.onclick = async () => {
        const motivo = await pedirTexto({
          titulo: 'Anular la medición',
          texto: 'No se borra: queda tachada con su motivo.',
          marcador: 'Se apuntó el tanque equivocado', ok: 'Anular'
        });
        if (!motivo) return;
        try {
          await api.enviar(`/clima/salmuera/${b.dataset.anularMedicion}/anular`, { motivo });
          avisar('Medición anulada', 'bien');
          medirSalmuera();
        } catch (e) { avisar(e.message, 'error'); }
      };
    });
  }

  // ==========================================================
  // NÚMEROS A SACAR — el papel que se le entrega al obrero
  // ==========================================================
  async function numerosASacar() {
    const r = await api.obtener('/produccion/siguientes');

    pantalla.innerHTML = `
      <button class="secundario chico no-imprimir" id="volver">‹ Producción</button>

      <div class="ticket" id="ticket">
        <div class="ticket-cabeza">
          <strong>NÚMEROS A SACAR</strong>
          <span>${esc(formatoFecha(r.fecha))}</span>
        </div>

        ${r.lista.map((t) => `
          <div class="ticket-tanque">
            <div class="ticket-nombre">TANQUE ${esc(t.tanque)}</div>
            <div class="ticket-numeros">
              ${t.siguientes.length
                ? t.siguientes.map((n, i) => `<span class="${i === 0 ? 'primero' : ''}">${n}</span>`).join('')
                : '<em>sin paños</em>'}
            </div>
            ${t.enProceso.length
              ? `<div class="ticket-nota">A medias: ${t.enProceso.join(', ')} — terminar primero</div>`
              : ''}
          </div>`).join('')}

        <div class="ticket-pie">
          <div>Entregó: ${esc(r.entregadoPor)}</div>
          <div class="ticket-firma">Recibió: ______________________</div>
          <div class="ticket-firma">Sacó de verdad: ______________</div>
        </div>
      </div>

      <p class="ayuda no-imprimir" style="margin-top:18px">
        Imprime este papel y dáselo al obrero. Cuando regrese te dice qué sacó
        de verdad y lo capturas <strong>tocando cada paño</strong> en la lista
        del tanque.
      </p>

      <button id="imprimir" class="no-imprimir">🖨️ Imprimir</button>`;

    pantalla.querySelector('#volver').onclick = pintar;

    // PRIMERO LA TÉRMICA, que sale al instante y sin preguntar nada. La
    // ventana de "elegir impresora" del navegador solo si no hay ninguna
    // puesta: en un cuarto de máquinas nadie va a estar escogiendo bandeja
    // ni tamaño de hoja con el obrero esperando.
    pantalla.querySelector('#imprimir').onclick = async (ev) => {
      const boton = ev.currentTarget;
      boton.disabled = true;
      try {
        const r = await api.enviar('/impresion/produccion', {});
        if (r.impreso) avisar('Números impresos', 'bien');
        else window.print();
      } catch (e) { avisar(e.message, 'error'); }
      boton.disabled = false;
    };
  }

  /**
   * CÓMO SALIÓ EL HIELO, en una barra de proporciones.
   *
   * Va pegada al total a propósito. Dos días con las mismas marquetas
   * pueden ser un buen día y uno malo, y lo que los separa es este reparto:
   * enseñar el total solo escondería justo el dato que sirve para decidir
   * algo. Es una barra y no una tabla porque la pregunta es "¿de qué color
   * está saliendo el hielo?", y eso se ve de un vistazo o no se ve.
   */
  function mezclaHTML(r) {
    const cal = r.calidades || [];
    const m = r.mezcla || {};
    const conAlgo = cal.filter((c) => m[c.clave] > 0);
    if (!conAlgo.length && !m.merma) return '';

    const total = conAlgo.reduce((n, c) => n + m[c.clave], 0) + (m.merma || 0);
    const porCiento = (n) => Math.round((n / total) * 100);
    const fuera = m.fueraDelAlmacen || 0;

    return `
      <h3>Cómo salió el hielo</h3>
      <div class="tarjeta plana">
        <div class="mezcla-barra">
          ${conAlgo.map((c) => `
            <span class="mezcla-tramo ${esc(c.clave)}" style="flex:${m[c.clave]}"
                  title="${esc(c.plural)}: ${m[c.clave]} de ${total}"
              >${porCiento(m[c.clave]) >= 8 ? porCiento(m[c.clave]) + '%' : ''}</span>`).join('')}
          ${m.merma ? `<span class="mezcla-tramo merma" style="flex:${m.merma}"
                             title="Rotas: ${m.merma}"></span>` : ''}
        </div>

        <div class="mezcla-lista">
          ${conAlgo.map((c) => `
            <span class="mezcla-parte ${esc(c.clave)}">
              ${m[c.clave]} ${esc(c.corto)}
            </span>`).join('')}
          ${m.merma ? `<span class="mezcla-parte merma">${m.merma} rotas</span>` : ''}
        </div>

        ${fuera > 0 ? `
          <p class="ayuda" style="margin:10px 0 0">
            ${fuera} ${fuera === 1 ? 'marqueta salió del molde pero no entró'
                                   : 'marquetas salieron del molde pero no entraron'} al
            cuarto frío: ${fuera === 1 ? 'se fue' : 'se fueron'} a los condensadores o
            ${fuera === 1 ? 'se botó' : 'se botaron'}. Contaron para el costo —gastaron la
            misma agua y la misma luz— pero no hay que ir a buscarlas al cuarto frío.
          </p>` : ''}
      </div>`;
  }

  // ==========================================================
  // LO DE HOY
  // ==========================================================
  async function verHoy() {
    const r = await api.obtener('/produccion/hoy');

    pantalla.innerHTML = `
      <button class="secundario chico" id="volver">‹ Producción</button>
      <h2 style="margin-top:14px">Lo de hoy</h2>

      <div class="resumen-fabrica">
        <div><strong>${r.marquetas}</strong><small>al cuarto frío</small></div>
        <div><strong>${r.mezcla.producidas}</strong><small>salieron del molde</small></div>
        <div><strong>${r.merma}</strong><small>rotas</small></div>
        <div><strong>${r.fuera}</strong><small>canastas fuera</small></div>
      </div>

      ${mezclaHTML(r)}

      ${r.porObrero.length ? `
        <h3>Quién sacó qué</h3>
        <div class="tarjeta plana">
          <table class="tabla">
            <tr><th>Quién</th><th>Paños</th><th>Marquetas</th></tr>
            ${r.porObrero.map((o) => `
              <tr><td>${esc(o.nombre)}</td><td>${o.panos}</td>
                  <td><strong>${o.marquetas}</strong></td></tr>`).join('')}
          </table>
        </div>` : ''}

      <h3>Paños sacados</h3>
      <div class="tarjeta plana">
        <table class="tabla">
          <tr><th>Hora</th><th>Dónde</th><th>Quién</th><th>Marq.</th></tr>
          ${r.panos.map((p) => `
            <tr class="${p.notas && p.notas.startsWith('ANULADA') ? 'anulada' : ''}">
              <td>${esc(new Date(p.iniciada_en).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }))}</td>
              <td>${esc(p.tanque)} · paño ${p.pano}
                  ${p.motivo_orden ? '<small class="marca-orden">autorizado</small>' : ''}
                  ${!p.terminada_en ? '<small class="marca-orden">a medias</small>' : ''}</td>
              <td>${esc(p.quien || '—')}</td>
              <td><strong>${p.marquetas}</strong></td>
            </tr>`).join('') || '<tr><td colspan="4">Todavía no hay nada registrado hoy.</td></tr>'}
        </table>
      </div>`;

    pantalla.querySelector('#volver').onclick = pintar;
  }
}
