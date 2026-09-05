/**
 * PRODUCCIÓN  (v3.1 · rediseñada en la v7.2 con el diseño del dueño)
 *
 * ============================================================
 * LA PANTALLA NO SE DESPLAZA  (v7.2)
 * ============================================================
 *
 * "Que la página sea como el módulo de vender: fija, que no se le pueda
 *  hacer scroll. A lo que sí, únicamente a la parte de los tanques que
 *  tengan muchos paños. Así siempre tengo visible qué paño debe seguir y
 *  en qué tanque estoy."
 *
 * Cuatro franjas de arriba abajo, y solo la tercera rueda:
 *
 *   1. LOS TANQUES — lo más grande de la pantalla. Anotar en el tanque
 *      equivocado cuesta un paño entero y no se descubre hasta el día
 *      siguiente: el nombre se tiene que leer desde donde uno está
 *      parado, no de cerca.
 *   2. LA BARRA — en qué tanque estoy, qué paño sigue, cuándo salió el
 *      anterior, con qué agua se rellena, y los tres papeles que se
 *      sacan desde aquí (números a sacar con su F2, revisar el tanque,
 *      el día).
 *   3. LOS PAÑOS — lo único que se desplaza, dentro de su propia caja.
 *      Dieciocho paños no caben en una pantalla, pero la pantalla entera
 *      no tiene por qué irse con ellos.
 *   4. EL PANEL — al lado: cómo está el tanque, la salmuera, el cuarto
 *      frío y cómo salió el hielo hoy.
 *
 * EL PAÑO QUE TOCA LLEVA EL BOTÓN, NO UNA ETIQUETA. Antes se distinguía
 * con un aro verde y había que saber que tocarlo entraba a sacarlo; ahora
 * dice «✓ Sacar el paño 5» con todas sus letras.
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
import { confirmar, menu, pedirTexto, pedirAutorizacion, verTicket } from '../dialogo.js';
import { imprimirTicket, htmlDeEspejo } from '../imprimir.js';
import { aTexto } from '../fracciones.js';

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
  // Los números que siguen los imprime también el cajero: el operario
  // pregunta en el mostrador y ahí no siempre hay un gerente.
  const puedeVerNumeros = estado.permisos.includes('*') ||
                          estado.permisos.includes('produccion.numeros');
  const puedeCorregir = estado.permisos.includes('*') ||
                        estado.permisos.includes('produccion.corregir');
  // Dar la vuelta al tanque para comprobar que lo reportado es lo que hay
  // (v6.7). No lo tiene el operario: revisarse a uno mismo no es revisar.
  const puedeRevisar = estado.permisos.includes('*') ||
                       estado.permisos.includes('produccion.revisar');
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

  // Los estados del hielo los manda el servidor con el estado del tanque:
  // aquí no hay una segunda copia de los nombres que pueda quedarse vieja.
  // Se guardan al pintar y los usa todo el archivo.
  let CALIDADES = [];
  // Cuál es la de por omisión también la manda el servidor: si mañana
  // cambia la escala, aquí no hay un nombre viejo que corregir.
  let POR_OMISION = 'c80';
  // El botón del primer paso que abre los cuatro grados. Viene del
  // servidor: no es un estado, es la pregunta.
  let SALIO = { clave: '__salio', nombre: 'Salió buena', plural: 'Salieron buenas',
                boton: 'buena', icono: '✅', nota: '' };
  let PREGUNTA_GRADO = '¿Qué tan congelada salió?';

  // F2 SACA LOS NÚMEROS. Es lo que más veces al día se hace desde esta
  // pantalla, y con el operario enfrente esperando, un atajo ahorra el viaje
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

  /**
   * LA PANTALLA FIJA ES SOLO LA LISTA DE TANQUES  (v7.2)
   *
   * De este archivo salen cinco pantallas —la lista, el detalle de un paño,
   * medir la salmuera, revisar el tanque y lo de hoy— y solo la primera
   * está pensada para no desplazarse. Las otras son formularios largos: con
   * el alto clavado, el botón de guardar se quedaba debajo del borde y no
   * había forma de llegar a él.
   *
   * El enrutador vuelve a poner la clase que le toque a cada ruta al
   * cambiar de pantalla, así que aquí solo hay que quitarla y ponerla
   * mientras se está dentro. Dentro del corte de caja no se toca: ahí manda
   * la pantalla de la caja, que sí se desplaza.
   */
  function fijar(si) {
    if (enCorte) return;
    document.body.classList.toggle('pantalla-fija', si);
  }

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
    POR_OMISION = datos.calidadPorOmision || POR_OMISION;
    SALIO = datos.calidadSalio || SALIO;
    PREGUNTA_GRADO = datos.preguntaGrado || PREGUNTA_GRADO;

    fijar(true);
    const { tanques, tanque, fuera } = datos;
    tanqueActivo = tanque.id;
    localStorage.setItem('tanque_activo', tanqueActivo);
    const toca = tanque.siguiente;

    pantalla.innerHTML = `
      <div class="prd ${enCorte ? 'en-corte' : ''}">
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

        <!-- ============================================================
             LOS TANQUES, LO MÁS GRANDE DE LA PANTALLA  (v7.2)

             "Los botones de cada tanque me quedaron muy pequeños; más
              grandes, deben ser lo más grande."

             Y tiene razón: anotar en el tanque que no es cuesta un paño
             entero y no se descubre hasta el día siguiente. El nombre se
             tiene que leer desde donde uno está parado, no de cerca.
             ============================================================ -->
        <div class="prd-tanques">
          ${tanques.map((t) => `
            <button class="prd-tanque ${t.id === tanque.id ? 'activo' : ''}"
                    data-tanque="${esc(t.id)}">
              <span class="prd-tanque-nombre">${esc(t.nombre)}</span>
              <small>${t.id === tanque.id ? 'estás aquí' : 'ir a este tanque'}</small>
            </button>`).join('')}
          ${puedeConfigurar ? `
            <a class="prd-tuerca" href="#/config-tanques"
               title="Configurar los tanques, paños y canastas">⚙</a>` : ''}
        </div>

        <!-- LO QUE NO SE PUEDE PERDER DE VISTA: en qué tanque estoy y qué
             paño sigue. Es el renglón que contesta las dos preguntas de
             todos los días, y por eso vive fuera de lo que se desplaza. -->
        <div class="prd-barra">
          <div class="prd-sigue ${toca ? '' : 'sin'}">
            ${toca ? '<span class="prd-sigue-punto"></span>' : ''}
            <span class="prd-sigue-texto">
              <strong>${toca
                ? `${esc(tanque.nombre)} sigue paño ${toca.numero}`
                : 'Este tanque no tiene paños'}</strong>
              <small>${tanque.ultimaSalida
                ? `Última: ${esc(ultimaFrase(tanque))}`
                : (toca ? esc(toca.porque) : '')}</small>
            </span>
          </div>

          <div class="prd-barra-acciones">
            ${puedeRegistrar ? `
              <button class="agua-boton ${agua}" id="agua" title="Cambiar el agua con la que se rellena">
                <span class="agua-icono">💧</span>
                <span>${agua === 'purificada' ? 'Purificada' : 'Potable'}</span>
              </button>` : ''}
            ${puedeVerNumeros ? `
              <button class="prd-accion" id="siguientes">
                <span>🖨️</span>
                <span class="prd-accion-texto">
                  <strong>Números a sacar</strong><small>el papel del operario · F2</small>
                </span>
              </button>` : ''}
            ${puedeRevisar ? `
              <button class="prd-accion" id="revisar">
                <span>🔎</span>
                <span class="prd-accion-texto">
                  <strong>Revisar el tanque</strong><small>comprobar lo reportado</small>
                </span>
              </button>` : ''}
            <button class="prd-accion" id="papel-dia">
              <span>🧾</span>
              <span class="prd-accion-texto">
                <strong>El día</strong><small>cuánto queda y qué salió</small>
              </span>
            </button>
          </div>
        </div>

        <div class="prd-cuerpo">
          <!-- LO ÚNICO QUE RUEDA. Dieciocho paños no caben en una pantalla,
               pero la pantalla entera no tiene por qué moverse con ellos. -->
          <section class="prd-panos">
            ${fuera ? `
              <div class="alerta-fuera">
                ⚠️ ${fuera} ${fuera === 1
                  ? 'canasta quedó fuera del tanque' : 'canastas quedaron fuera del tanque'}
              </div>` : ''}
            <div class="prd-panos-lista">
              ${tanque.panos.map((p) => filaPano(p, toca)).join('') ||
                '<p class="vacio">Este tanque no tiene paños.</p>'}
            </div>
            <div class="leyenda">
              <span><i class="punto-estado congelando"></i> congelando</span>
              <span><i class="punto-estado potable"></i> con potable</span>
              <span><i class="punto-estado lista"></i> lista</span>
              <span><i class="punto-estado fuera"></i> fuera del tanque</span>
              <span><i class="punto-estado proceso"></i> a medias</span>
              <span><i class="punto-estado merma"></i> molde que falla</span>
            </div>
          </section>

          ${panelTanque(tanque)}
        </div>
      </div>`;

    const seguir = pantalla.querySelector('#seguir-corte');
    if (seguir) seguir.onclick = () => opciones.alSeguir?.();

    pantalla.querySelectorAll('[data-tanque]').forEach((b) => {
      b.onclick = () => { tanqueActivo = b.dataset.tanque; pintar(); };
    });
    pantalla.querySelector('#ver-hoy').onclick = verHoy;
    const btnRevisar = pantalla.querySelector('#revisar');
    if (btnRevisar) btnRevisar.onclick = () => revisarTanque();
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
    pantalla.querySelector('#papel-dia').onclick = papelDelDia;
    verElQueToca();
    if (!puedeRegistrar) return;

    pantalla.querySelector('#agua').onclick = () => {
      agua = agua === 'purificada' ? 'potable' : 'purificada';
      localStorage.setItem('tipo_agua', agua);
      pintar();
    };
  }

  /**
   * LA LISTA SE ABRE EN EL PAÑO QUE TOCA  (v7.2)
   *
   * En un tanque de dieciocho, el que sigue puede ser el doce, y abrir
   * siempre por el uno obliga a rodar la lista antes de poder trabajar.
   * La barra de arriba ya dice CUÁL es; esto pone el botón de sacarlo
   * debajo del dedo.
   *
   * Se centra en su caja y no en la página: `scrollIntoView` a secas
   * arrastraría también la ventana, y la pantalla es fija justamente para
   * que eso no pase.
   */
  function verElQueToca() {
    const caja = pantalla.querySelector('.prd-panos-lista');
    const fila = caja?.querySelector('.pano-prod.toca-este');
    if (!caja || !fila) return;
    // Por rectángulos y no por `offsetTop`: ése se mide contra el ancestro
    // POSICIONADO más cercano, que aquí no es la caja que rueda, y la lista
    // acababa abriéndose tres renglones más abajo de donde debía.
    const f = fila.getBoundingClientRect();
    const c = caja.getBoundingClientRect();
    caja.scrollTop += (f.top - c.top) - (c.height - f.height) / 2;
  }

  /**
   * "Paño 3 hace 2 h · Nael · 13 marq" — la última extracción, en una línea.
   *
   * Es la pregunta que sigue enseguida a «¿cuál toca?»: saber que el
   * anterior salió hace veinte minutos o hace ocho horas cambia lo que uno
   * hace a continuación.
   */
  function ultimaFrase(tanque) {
    const ultimos = tanque.panos
      .map((p) => p.ultimaSacada ? { ...p.ultimaSacada, numero: p.numero } : null)
      .filter(Boolean)
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    const u = ultimos[0];
    if (!u) return formatoFecha(tanque.ultimaSalida);

    const partes = [`Paño ${u.numero}`, haceCuanto(u.fecha)];
    if (u.quienes?.length) partes.push(u.quienes.map(nombreDePila).join(', '));
    if (u.marquetas) partes.push(`${u.marquetas} marq`);
    return partes.filter(Boolean).join(' · ');
  }

  /** "hace 2 h 15 m", como se dice. Nada de fechas cuando fue hoy mismo. */
  function haceCuanto(fecha) {
    const minutos = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
    if (!Number.isFinite(minutos) || minutos < 0) return fechaCorta(fecha);
    if (minutos < 60) return `hace ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `hace ${horas} h ${minutos % 60} min`;
    return fechaCorta(fecha);
  }
  /**
   * EL PANEL DE AL LADO.
   *
   * Los paños de un tanque no llegan al ancho de un monitor, y ese hueco
   * estaba vacío. Aquí va lo que uno viene a mirar de reojo mientras
   * trabaja: cómo está el tanque ahora mismo, cuántos moldes vienen
   * saliendo mal, cómo va la salmuera y cómo salió el hielo de hoy.
   *
   * En el celular no hay hueco al lado, así que el panel se va abajo solo
   * (lo resuelve el CSS, no hay dos pantallas que mantener).
   */
  function panelTanque(tanque) {
    const cuenta = (e) => tanque.panos.filter((p) => p.estado === e).length;
    const marcados = tanque.panos.reduce((n, p) => n + (p.moldesMarcados || 0), 0);
    const conMarca = tanque.panos.filter((p) => p.moldesMarcados);

    return `
      <aside class="prd-panel">
        <div class="prd-tarjeta">
          <div class="prd-tarjeta-cabeza">
            <h3>${esc(tanque.nombre)} ahora</h3>
            <span class="prd-capacidad">${tanque.panos.length} paños</span>
          </div>
          <div class="prd-cuentas">
            <span class="prd-cuenta lista"><strong>${cuenta('lista')}</strong><small>listos</small></span>
            <span class="prd-cuenta congelando"><strong>${cuenta('congelando')}</strong><small>congelando</small></span>
            <span class="prd-cuenta proceso"><strong>${cuenta('proceso')}</strong><small>a medias</small></span>
            <span class="prd-cuenta fuera"><strong>${cuenta('fuera')}</strong><small>fuera</small></span>
          </div>

          ${marcados ? `
            <div class="prd-alerta">
              <strong>⚠ ${marcados} ${marcados === 1
                ? 'molde viene saliendo peor que sus vecinos'
                : 'moldes vienen saliendo peor que sus vecinos'}</strong>
              <small>${conMarca.map((p) => `paño ${p.numero}`).join(', ')}</small>
              <button class="enlace" data-ficha="${esc(conMarca[0].id)}">
                Ver cuál en el paño ${conMarca[0].numero} →
              </button>
            </div>` : ''}

          ${salmueraHTML(tanque)}
        </div>

        ${datos.cuartoFrio ? `
          <div class="prd-tarjeta prd-frio">
            <span class="prd-etiqueta">En el cuarto frío</span>
            <strong class="prd-frio-numero ${datos.cuartoFrio.dieciseisavos < 0 ? 'malo' : ''}">
              ${esc(datos.cuartoFrio.texto)}
            </strong>
            <small>
              ${datos.cuartoFrio.dieciseisavos < 0
                ? 'menos que cero: falta capturar producción'
                : `marquetas de 150 kg · ${datos.cuartoFrio.desdeConteo
                    ? `desde el conteo del ${esc(fechaCorta(datos.cuartoFrio.contadoEn))}`
                    : 'nunca se ha contado: es la suma de todo'}`}
            </small>
          </div>` : ''}

        ${hoy ? tarjetaHoy() : ''}

        <div class="prd-panel-botones">
          <button class="secundario" id="ver-hoy">📅 Lo de hoy</button>
          ${estado.permisos.includes('*') || estado.permisos.includes('existencia.ver')
            ? '<a class="boton secundario" href="#/existencia">🧊 El cuarto frío</a>' : ''}
          ${estado.permisos.includes('*') || estado.permisos.includes('estadisticas.ver')
            ? '<a class="boton secundario" href="#/estadisticas">📊 Los números</a>' : ''}
        </div>
      </aside>`;
  }

  /**
   * CÓMO SALIÓ EL HIELO HOY, EN TODA LA FÁBRICA.
   *
   * Tres números y una barra. La barra es lo que de verdad se mira: no
   * importa tanto cuántas salieron como en qué proporción, porque cuando la
   * mezcla se corre hacia abajo varios días seguidos, algo está pasando con
   * el frío y hay tiempo de arreglarlo antes de que se note en la venta.
   *
   * EL PORCENTAJE ES «lo que entró al cuarto frío entre lo que se abrió», y
   * no un promedio de los grados: promediar «80-90%» con «40-60%» daría un
   * número que no significa nada en la vida real.
   */
  function tarjetaHoy() {
    const m = hoy.mezcla;
    const conAlgo = CALIDADES.filter((c) => m[c.clave] > 0);
    const noVendible = CALIDADES.filter((c) => !c.vendible && m[c.clave] > 0);
    const conforme = m.salieron
      ? Math.round((m.alAlmacen / m.salieron) * 1000) / 10 : null;

    return `
      <div class="prd-tarjeta">
        <div class="prd-tarjeta-cabeza">
          <h3>Hoy en la fábrica</h3>
        </div>
        <div class="prd-cuentas">
          <span class="prd-cuenta"><strong>${hoy.panos.length}</strong><small>paños</small></span>
          <span class="prd-cuenta"><strong>${m.producidas}</strong><small>salieron</small></span>
          <span class="prd-cuenta ${m.merma ? 'malo' : ''}">
            <strong>${m.merma}</strong><small>se botaron</small></span>
        </div>

        ${conAlgo.length ? `
          <div class="prd-conforme">
            <span>Cómo salió el hielo</span>
            <strong class="${conforme >= 95 ? 'bien' : conforme >= 85 ? '' : 'malo'}">
              ${conforme}%<small>al cuarto frío</small></strong>
          </div>
          <div class="mezcla-barra">
            ${conAlgo.map((c) => `
              <span class="mezcla-tramo ${esc(c.clave)}" style="flex:${m[c.clave]}"
                    title="${esc(c.plural)}: ${m[c.clave]}"></span>`).join('')}
          </div>
          <div class="mezcla-lista">
            ${conAlgo.map((c) => `
              <span class="mezcla-parte ${esc(c.clave)}">${m[c.clave]} ${esc(c.corto)}</span>`).join('')}
          </div>
          ${noVendible.length ? `
            <p class="prd-nota">
              ${noVendible.map((c) => `${m[c.clave]} ${c.corto}`).join(' · ')} no entraron al cuarto frío.
            </p>` : ''}`
        : '<p class="ayuda" style="margin:10px 0 0">Todavía no se ha sacado nada hoy.</p>'}
      </div>`;
  }

  function sinTanques() {
    fijar(false);
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
  /**
   * UN RENGLÓN = UN PAÑO, y cuenta su historia sin que haya que entrar.
   *
   * De izquierda a derecha: el número, las canastas con sus moldes, lo que
   * le pasó la última vez, y a la derecha en qué está —"10 h", "listo",
   * "a medias"—. Eso es exactamente lo que uno pregunta mirando la lista.
   *
   * EL QUE TOCA NO LLEVA UNA ETIQUETA: LLEVA EL BOTÓN.  (v7.2)
   * Antes se distinguía con un aro verde y había que saber que tocarlo
   * entraba a sacarlo. Ahora dice «✓ Sacar el paño 5» con todas sus letras
   * y del tamaño de una mano, que es la única acción que se hace aquí
   * cincuenta veces al día.
   *
   * Del nombre solo va el DE PILA. En la fábrica nadie dice el apellido, y
   * con tres nombres completos el renglón se parte en dos.
   */
  function filaPano(p, toca) {
    const esElQueToca = toca && toca.id === p.id;

    // ¿Algún molde de este paño viene fallando? Se dice en el renglón y con
    // el número del molde: "hay un molde marcado" no sirve para nada si hay
    // que abrir el paño para saber cuál.
    const fallos = [];
    for (const c of p.canastas || []) {
      for (const m of c.moldes || []) {
        if (m.ultimoFallo) fallos.push(`molde ${m.numero} (canasta ${c.numero})`);
      }
    }

    const chip = p.enProceso
      ? '<span class="prd-chip proceso">a medias</span>'
      : p.estado === 'fuera' ? '<span class="prd-chip fuera">fuera</span>'
      : p.estado === 'lista' ? '<span class="prd-chip lista">listo</span>'
      : `<span class="prd-chip congelando">${Math.floor(p.horas)} h</span>`;

    // Un paño a medias enseña lo que falta, no lo que se sacó la vez pasada:
    // es lo único que hay que hacer con él, y quien mira la lista tiene que
    // verlo sin entrar.
    const historia = p.enProceso
      ? `a medias · faltan ${p.faltan} de ${p.canastas.length} canastas${
          p.empezadoPor ? ` · lo empezó ${esc(nombreDePila(p.empezadoPor))}` : ''}`
      : p.ultimaSacada
        ? [fechaCorta(p.ultimaSacada.fecha),
           p.ultimaSacada.quienes?.length
             ? p.ultimaSacada.quienes.map(nombreDePila).join(', ') : null,
           p.ultimaSacada.horas != null ? `${Math.round(p.ultimaSacada.horas)} h` : null,
           p.ultimaSacada.marquetas ? `${p.ultimaSacada.marquetas} marq` : null
          ].filter(Boolean).map(esc).join(' · ')
        : 'sin registro previo';

    const canastas = (p.canastas || []).map((c) => `
      <span class="canasta-prod ${c.yaSacada ? 'sacada' : c.estado}
                   ${c.tipoAgua === 'potable' ? 'potable' : ''}">
        ${c.moldes.map((m) => `
          <i class="molde ${m.ultimoFallo ? 'fallo' : ''}"
             ${m.rachaFallos > 1 ? 'data-racha="' + m.rachaFallos + '"' : ''}></i>`).join('')}
      </span>`).join('');

    return `
      <div class="pano-prod ${esElQueToca ? 'toca-este' : ''}
                  ${p.enProceso ? 'en-proceso' : ''} ${fallos.length ? 'con-fallo' : ''}">
        ${esElQueToca ? '<span class="pano-prod-turno">Siguiente en turno</span>' : ''}
        <button class="pano-prod-cuerpo" data-pano="${esc(p.id)}">
          <span class="pano-prod-num">${p.numero}</span>
          <span class="pano-prod-medio">
            <span class="canastas-prod">${canastas}</span>
            <small class="pano-prod-historia ${p.ultimaSacada || p.enProceso ? '' : 'nunca'}">
              ${fallos.length
                ? `<b class="pano-prod-fallo">⚠ ${esc(fallos[0])}${
                    fallos.length > 1 ? ` y ${fallos.length - 1} más` : ''}</b>`
                : historia}
            </small>
          </span>
          ${esElQueToca && !p.enProceso
            ? `<span class="pano-prod-sacar">✓ Sacar el paño ${p.numero}</span>`
            : esElQueToca
              ? `<span class="pano-prod-sacar">→ Terminar el paño ${p.numero}</span>`
              : chip}
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
    const esElQueToca = !toca || toca.id === panoId;
    if (esElQueToca) return detallePano(panoId, { mirar: false });

    // ESTE PAÑO NO ES EL QUE SIGUE  (v4.7)
    //
    // Antes se abría callado en modo mirar, y quien venía a sacarlo se
    // quedaba mirando una pantalla que no dejaba tocar nada sin entender
    // por qué. Ahora se dice, y con las dos salidas a la vista: mirar la
    // historia —que no cambia nada y no pide permiso a nadie— o
    // desbloquearlo, que sí lo pide.
    const pano = datos.tanque.panos.find((p) => p.id === panoId);
    const que = await menu({
      titulo: `El paño ${pano?.numero ?? ''} no es el que sigue`,
      texto: `En ${datos.tanque.nombre} toca el paño ${toca.numero}. Sacar este ` +
             'de más lo tiene que autorizar un gerente o el administrador.',
      opciones: [
        { valor: 'historia', texto: '👁 Ver su historia',
          detalle: 'Cuándo se sacó, quién y cómo salió. No cambia nada.' },
        { valor: 'toca', texto: `→ Ir al paño ${toca.numero}`,
          detalle: 'El que de verdad toca ahora' },
        ...(puedeRegistrar
          ? [{ valor: 'desbloquear', texto: '🔓 Desbloquear este paño',
               detalle: 'Con el PIN de quien autoriza' }]
          : [])
      ]
    });
    if (!que) return;
    if (que === 'toca') return detallePano(toca.id, { mirar: false });
    if (que === 'desbloquear') {
      const vale = await pedirVale(pano, toca);
      if (!vale) return detallePano(panoId, { mirar: true });
      return detallePano(panoId, { mirar: false, vale });
    }
    return detallePano(panoId, { mirar: true });
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
    fijar(false);

    const toca = datos.tanque.siguiente;
    const esElQueToca = !toca || toca.id === panoId;
    let vale = opciones.vale || null;

    // Desde la revisión del tanque se entra directo a corregir la sacada
    // que quedó en entredicho, sin tener que buscarla en la historia.
    if (opciones.corregir) return corregirSacada(opciones.corregir);
    let mirando = Boolean(opciones.mirar) || !puedeRegistrar;

    // La historia se pide siempre: en la vista de mirar ES la pantalla, y
    // en la de sacar es el renglón de arriba que dice cuándo fue la última
    // vez — lo primero que se pregunta antes de tocar nada.
    const [ficha, { operarios }] = await Promise.all([
      api.obtener(`/produccion/panos/${panoId}/ficha`).catch(() => null),
      api.obtener('/produccion/operarios')
    ]);

    // CÓMO SALIÓ EL HIELO. Primero una sola respuesta para el paño entero,
    // que es lo que de verdad pasa —la fábrica congela bien o mal esa
    // noche y el paño sale parejo—, y encima las excepciones molde por
    // molde. Al revés sería pedir doce respuestas para contestar una.
    let calidadPano = POR_OMISION;
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
      : (operarios.find((o) => o.id === estado.usuario.id)?.id || operarios[0]?.id || '');
    let quienNombre = '';

    /** Lo que le toca a un molde: su marca propia, o la del paño. */
    const deMolde = (id) => marcas.get(id) || {
      resultado: calidadPano,
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
        }
      }
      return { cuenta, alAlmacen };
    }

    const dibujar = () => {
      const { cuenta, alAlmacen } = contar();
      const elegida = CALIDADES.find((c) => c.clave === calidadPano);
      // Si lo elegido se vende, el primer paso está en «salió buena» y
      // abajo se ve de qué grado. Se DERIVA de la respuesta y no se lleva
      // en una variable aparte, que es como se desincronizan las dos.
      const salioBuena = esVendible(calidadPano);
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
                    ${operarios.map((o) => `
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
                  ${primerPaso().map((c) => `
                    <button class="calidad-boton ${esc(c.clave)} ${
                              c.clave === (salioBuena ? SALIO.clave : calidadPano) ? 'elegida' : ''}"
                            data-calidad="${esc(c.clave)}">
                      <span class="calidad-icono">${c.icono}</span>
                      <span class="calidad-nombre">${esc(c.plural)}</span>
                    </button>`).join('')}
                </div>

                ${salioBuena ? `
                  <label class="calidad-grado-label">${esc(PREGUNTA_GRADO)}
                    <small>solo para el registro: todas se venden igual</small></label>
                  <div class="calidades grados">
                    ${grados().map((c) => `
                      <button class="calidad-boton ${esc(c.clave)} ${c.clave === calidadPano ? 'elegida' : ''}"
                              data-calidad="${esc(c.clave)}">
                        <span class="calidad-icono">${c.icono}</span>
                        <span class="calidad-nombre">${esc(c.plural)}</span>
                      </button>`).join('')}
                  </div>` : ''}

                <p class="ayuda calidad-nota">${esc(elegida ? elegida.nota : '')}</p>

                ${calidadPano === 'otro' && notaPano ? `
                  <p class="nota-escrita">✎ ${esc(notaPano)}
                    <button class="enlace" id="editar-nota">cambiar</button></p>` : ''}

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
                      <span class="molde-boton ${esc(m.ultimoResultado || POR_OMISION)} sin-tocar"
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

      // CORREGIR CÓMO SALIÓ UNA SACADA  (v6.1): la hueca que era ahogada.
      pantalla.querySelectorAll('[data-corregir]').forEach((b) => {
        b.onclick = () => corregirSacada(b.dataset.corregir);
      });

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
          else if (!quienNombre) { quienId = operarios[0]?.id || ''; }
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
          // «Salió buena» no es un estado: abre los cuatro grados con el
          // de siempre ya puesto, y de un solo toque el paño normal queda
          // contestado. Cambiar de grado es el segundo toque, y solo lo da
          // quien quiere afinar el registro.
          if (clave === SALIO.clave) {
            notaPano = '';
            calidadPano = POR_OMISION;
            return dibujar();
          }
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
          tipoAgua: agua, calidad: calidadPano,
          nota: notaPano || null, canastas: [...elegidas],
          resultados, ejecutorId: quienId || null,
          ejecutorNombre: quienNombre || null, vale, ...opciones, autorizacion
        });
        avisar(
          `Paño ${pano.numero}: ${r.marquetas} al cuarto frío` +
          (r.merma ? ` · ${r.merma} se botaron` : '') +
          (r.faltan ? ` · quedan ${r.faltan} canastas pendientes` : ''), 'bien');
        await pintar();
      } catch (e) {
        // YA SE SACÓ HOY  (v6.6): no es un error que se resuelva con un
        // PIN, es que ese hielo no existe. Lo que casi siempre se quería
        // hacer es corregir la sacada de hoy, y ahí se lleva.
        if (e.yaSeSacoHoy && e.sacadaId) {
          const ir = await confirmar({
            titulo: `El paño ${pano.numero} ya se sacó hoy`,
            texto: `${e.message} ¿Vamos a corregir esa sacada?`,
            ok: 'Sí, corregirla'
          });
          if (ir) return corregirSacada(e.sacadaId);
          return;
        }
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

    /**
     * CORREGIR UNA SACADA, MOLDE POR MOLDE  (v6.6)
     *
     * "A veces las correcciones son de una canasta o de un molde nada más,
     *  por lo que necesito corregir una por una."
     *
     * Se abre desde la historia, con la sacada que se eligió por su fecha,
     * y se toca solo lo que estuvo mal. Lo que no se toca no se manda.
     */
    async function corregirSacada(sacadaId) {
      let d;
      try { d = await api.obtener(`/produccion/sacadas-pano/${sacadaId}/moldes`); }
      catch (e) { return avisar(e.message, 'error'); }

      const cambios = new Map();     // moldeId -> { resultado, nota }
      const quitados = new Set();    // moldeId
      const original = new Map(d.moldes.map((m) => [m.moldeId, m]));

      const porCanasta = new Map();
      for (const m of d.moldes) {
        if (!porCanasta.has(m.canasta)) porCanasta.set(m.canasta, []);
        porCanasta.get(m.canasta).push(m);
      }

      const estadoDe = (id) => (quitados.has(id) ? null : (cambios.get(id) || original.get(id)));
      const tocado = (id) => quitados.has(id) || cambios.has(id);

      function cuentas() {
        let antes = 0;
        let ahora = 0;
        for (const [id, m] of original) {
          if (esVendible(m.resultado)) antes++;
          const e = estadoDe(id);
          if (e && esVendible(e.resultado)) ahora++;
        }
        return { antes, ahora };
      }

      function dibujarCorreccion() {
        const { antes, ahora } = cuentas();
        const hay = cambios.size || quitados.size;

        pantalla.innerHTML = `
          <div class="pantalla-corregir">
          <div class="cabecera-pantalla">
            <button class="secundario chico" id="volver">‹ La historia del paño</button>
            <h2>Corregir · ${esc(d.sacada.tanque)} · Paño ${esc(d.sacada.pano)}</h2>
            <p class="ayuda">
              La sacada del <b>${esc(fechaCorta(d.sacada.fecha))}</b>, la reportó
              <b>${esc(d.sacada.quien)}</b>.
              ${d.sacada.correcciones ? ` Ya se corrigió ${d.sacada.correcciones} ${
                d.sacada.correcciones === 1 ? 'vez' : 'veces'}.` : ''}
            </p>
          </div>

          <div class="aviso-sin-caja" style="margin-bottom:14px">
            <strong>Se cambia solo lo que toques.</strong>
            Toca un molde para decir cómo salió de verdad, o para decir que
            <b>no se sacó</b> —esa canasta se quedó en el tanque—. Lo que no
            toques se queda exactamente como está. Lo contado en el cuarto
            frío no se mueve; lo que «debía haber» aquel día, sí.
          </div>

          <div class="canastas-merma">
            ${[...porCanasta.entries()].map(([num, moldes]) => {
              const todosFuera = moldes.every((m) => quitados.has(m.moldeId));
              return `
                <div class="tarjeta">
                  <div class="canasta-cabeza">
                    <strong>Canasta ${num}</strong>
                    <button class="secundario chico" data-canasta="${num}">
                      ${todosFuera ? '↩ Sí se sacó' : '🚫 Esta canasta no se sacó'}
                    </button>
                  </div>
                  <div class="moldes-detalle">
                    ${moldes.map((m) => {
                      const e = estadoDe(m.moldeId);
                      const fuera = quitados.has(m.moldeId);
                      return `
                        <button class="molde-boton ${fuera ? 'quitado' : esc(e.resultado)}
                                       ${tocado(m.moldeId) ? 'tocado' : ''}"
                                data-molde="${esc(m.moldeId)}"
                                title="${fuera ? 'No se sacó' : esc(nombreLargo(e))}">
                          <span class="molde-num">${m.molde}</span>
                          <span class="molde-estado">${
                            fuera ? 'no salió' : esc(etiqueta(e))}</span>
                        </button>`;
                    }).join('')}
                  </div>
                </div>`;
            }).join('')}
          </div>

          <div class="tarjeta corregir-cierre">
            <div class="corregir-cuenta">
              <div><small>Iban al cuarto frío</small><strong>${antes}</strong></div>
              <div class="flecha">→</div>
              <div><small>Quedan</small>
                <strong class="${ahora < antes ? 'malo' : ahora > antes ? 'bien' : ''}">${ahora}</strong></div>
              ${quitados.size ? `<div><small>No se sacaron</small>
                <strong class="malo">${quitados.size}</strong></div>` : ''}
            </div>
            <label>
              <span class="etiqueta-chica">Por qué se corrige<small>queda escrito con tu nombre</small></span>
              <input id="motivo-corr" maxlength="200" value="${esc(motivoEscrito)}"
                     placeholder="La canasta 2 se quedó en el tanque, nunca salió">
            </label>
            <div class="fila-botones" style="margin-top:12px">
              <button id="guardar-corr" ${hay ? '' : 'disabled'}>Guardar la corrección</button>
              <button class="secundario" id="cancelar-corr">Cancelar</button>
            </div>
          </div>

          ${d.correcciones.length ? `
            <h3 style="margin-top:20px">Lo que ya se le corrigió</h3>
            <div class="hist-envoltura">
              <table class="tabla hist-tabla">
                <tr><th>Cuándo</th><th>Quién</th><th>Qué</th><th>Por qué</th></tr>
                ${d.correcciones.map((c) => `
                  <tr>
                    <td>${esc(fechaCorta(c.fecha))}</td>
                    <td>${esc(c.quien || '—')}</td>
                    <td>${c.que === 'quitado'
                      ? `no se sacó <small>(decía ${esc(c.antes)})</small>`
                      : `${esc(c.antes)} → ${esc(c.despues)}`}</td>
                    <td><small>${esc(c.motivo)}</small></td>
                  </tr>`).join('')}
              </table>
            </div>` : ''}
          </div>`;

        const q = (sel) => pantalla.querySelector(sel);
        q('#volver').onclick = () => detallePano(panoId, { mirar: true });
        q('#cancelar-corr').onclick = () => detallePano(panoId, { mirar: true });
        q('#motivo-corr').oninput = (ev) => { motivoEscrito = ev.target.value; };

        pantalla.querySelectorAll('[data-canasta]').forEach((b) => {
          b.onclick = () => {
            const moldes = porCanasta.get(Number(b.dataset.canasta));
            const todosFuera = moldes.every((m) => quitados.has(m.moldeId));
            for (const m of moldes) {
              if (todosFuera) quitados.delete(m.moldeId);
              else { quitados.add(m.moldeId); cambios.delete(m.moldeId); }
            }
            dibujarCorreccion();
          };
        });

        pantalla.querySelectorAll('[data-molde]').forEach((b) => {
          b.onclick = () => tocarMolde(b.dataset.molde);
        });

        q('#guardar-corr').onclick = guardarCorreccion;
      }

      async function tocarMolde(moldeId) {
        const m = original.get(moldeId);
        const opciones = [];
        if (tocado(moldeId)) {
          opciones.push({ valor: '__igual', texto: '↩ Dejarlo como estaba',
                          detalle: `Volver a «${nombreLargo(m)}»` });
        }
        for (const c of primerPaso()) {
          opciones.push({ valor: c.clave, texto: `${c.icono} ${c.nombre}`, detalle: c.nota });
        }
        opciones.push({ valor: '__quitar', texto: '🚫 Este molde no se sacó',
                        detalle: 'Se queda en el tanque con su hielo. Deja de contar como producido de aquel día.',
                        peligro: true });

        const titulo = `Canasta ${m.canasta} · molde ${m.molde}`;
        let elegido = await menu({
          titulo,
          texto: `Ahora dice «${nombreLargo(m)}».`,
          opciones
        });
        if (!elegido) return;

        // El segundo paso, igual que al capturar.
        if (elegido === SALIO.clave) {
          elegido = await preguntarGrado(titulo);
          if (!elegido) return;
        }

        if (elegido === '__igual') { cambios.delete(moldeId); quitados.delete(moldeId); }
        else if (elegido === '__quitar') { quitados.add(moldeId); cambios.delete(moldeId); }
        else {
          let nota = null;
          if (pideNota(elegido)) {
            nota = await pedirNota('');
            if (!nota) return;
          }
          quitados.delete(moldeId);
          if (elegido === m.resultado && (nota || null) === (m.nota || null)) cambios.delete(moldeId);
          else cambios.set(moldeId, { resultado: elegido, nota });
        }
        dibujarCorreccion();
      }

      async function guardarCorreccion() {
        const motivo = (pantalla.querySelector('#motivo-corr')?.value || '').trim();
        if (!motivo) {
          avisar('Escribe por qué se corrige', 'error');
          pantalla.querySelector('#motivo-corr')?.focus();
          return;
        }
        try {
          const r = await api.enviar(`/produccion/sacadas-pano/${sacadaId}/corregir-moldes`, {
            motivo,
            cambios: [...cambios.entries()].map(([moldeId, c]) => ({ moldeId, ...c })),
            quitar: [...quitados]
          });
          const c = r.conteos?.[0];
          avisar(
            `Corregido: ${r.antes.alAlmacen} → ${r.despues.alAlmacen} al cuarto frío` +
            (r.quitados ? ` · ${r.quitados} no se sacaron` : '') +
            (r.anulada ? ' · esa sacada quedó anulada' : '') +
            (c ? ` · el cuadre de aquel corte pasó de ${aTexto(c.faltanteAntes)} a ${aTexto(c.faltanteAhora)}` : ''),
            'bien');
          datos = await api.obtener(`/produccion/estado?tanque=${encodeURIComponent(tanqueActivo)}`);
          detallePano(panoId, { mirar: true });
        } catch (e) { avisar(e.message, 'error'); }
      }

      let motivoEscrito = '';
      dibujarCorreccion();
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
          </span>`
          : ficha?.historial?.length
            ? '<span class="pano-cabeza-ultima">su última sacada se anuló</span>'
            : '<span class="pano-cabeza-ultima">nunca se ha sacado</span>'}
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

    // LA ADVERTENCIA, MIENTRAS SE MIRA (v4.7). "Cuando esté viendo un paño
    // su historial pero no es el que sigue, debe tener el mensaje de que no
    // es el que sigue." Mirar no cuesta nada y por eso se deja mirar; lo
    // que no puede pasar es creer que se está en el paño que toca.
    const toca = datos.tanque.siguiente;
    const esElQueToca = !toca || toca.id === pano.id;

    return `
      ${esElQueToca ? '' : `
        <div class="aviso-sin-caja" style="margin-top:12px">
          <strong>Este paño no es el que sigue.</strong>
          En ${esc(datos.tanque.nombre)} toca el <b>paño ${toca.numero}</b>.
          Aquí solo se mira: para sacar este hay que desbloquearlo abajo, y
          eso lo autoriza un gerente o el administrador.
        </div>`}

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
          ${u.corregidaEn ? `<p class="ayuda">✏️ Se corrigió cómo salió${u.corregidaPor
            ? ` (${esc(nombreDePila(u.corregidaPor))}` : ''}${u.corregidaEn
            ? `${u.corregidaPor ? ', ' : '('}${esc(fechaCorta(u.corregidaEn))})` : ')'}${
            u.motivoCorreccion ? `: «${esc(u.motivoCorreccion)}»` : ''}.</p>` : ''}
          ${puedeCorregir ? `
            <div class="acciones-centradas" style="margin-top:10px">
              <button class="secundario chico" data-corregir="${esc(u.id)}">✏️ Corregir esta sacada</button>
            </div>` : ''}
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
        </div>` : ficha.historial.length ? `
        <!-- Se sacó y se anuló: decir "nunca se ha sacado" sería lo
             contrario de lo que pasó, y justo lo que hay que ver (v4.7). -->
        <p class="vacio">
          Este paño no tiene ninguna sacada en pie: la última se anuló.
          Abajo está quién y por qué.
        </p>` : '<p class="vacio">Este paño nunca se ha sacado.</p>'}

      ${ficha.historial.length ? `
        <h3>${ficha.historial.length === 1 ? 'Lo que hay registrado' : 'Las veces anteriores'}</h3>
        <div class="hist-envoltura">
          <table class="tabla hist-tabla">
            <tr><th>Cuándo</th><th>Quién</th><th class="der">Horas</th>
                <th class="der">Al cuarto frío</th><th>Cómo salió</th>${puedeCorregir ? '<th></th>' : ''}</tr>
            ${ficha.historial.map((h) => `
              <tr class="${h.anulada ? 'anulada' : ''}">
                <td>${esc(fechaCorta(h.fecha))}</td>
                <td>${esc(h.quienes.map(nombreDePila).join(', ') || '—')}</td>
                <td class="der">${h.horas != null ? Math.round(h.horas) : '—'}</td>
                <td class="der">${h.anulada ? '—' : h.mezcla.alAlmacen}</td>
                <!-- QUIÉN LA ANULÓ Y POR QUÉ (v4.7). Antes solo decía
                     «anulada» y el motivo se había escrito dentro de las
                     notas; quién lo hizo no se guardaba en ningún lado, así
                     que no había forma de enterarse. -->
                <td class="${h.anulada ? 'anul-celda' : ''}">${h.anulada ? `
                  <span class="hist-que que-cancelada">anulada</span>
                  <small class="anul-detalle">
                    ${h.anuladaPor ? `por ${esc(nombreDePila(h.anuladaPor))}` : 'no se sabe quién'}${
                      h.anuladaEn ? ` · ${esc(fechaCorta(h.anuladaEn))}` : ''}
                    ${h.motivoAnulada ? `<br>«${esc(h.motivoAnulada)}»` : ''}
                  </small>` : `
                  <span class="mezcla-lista">
                    ${CALIDADES.filter((c) => h.mezcla[c.clave])
                      .map((c) => `<span class="mezcla-parte ${esc(c.clave)}"
                                        >${h.mezcla[c.clave]} ${esc(c.corto)}</span>`).join('')}

                    ${h.corregidaEn ? '<small class="ayuda">✏️ corregida</small>' : ''}
                  </span>`}</td>
                ${puedeCorregir ? `<td class="der">${h.anulada ? '' :
                  `<button class="secundario chico" data-corregir="${esc(h.id)}" title="Corregir cómo salió">✏️</button>`}</td>` : ''}
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
  const pideNota = (clave) => Boolean(deCatalogo(clave)?.pideNota);
  const esVendible = (clave) => Boolean(deCatalogo(clave)?.vendible);

  /**
   * LOS DOS PASOS DE LA PREGUNTA  (v6.8.1)
   *
   * "Que 100% sellada, 80, 60 y 40 sea solo una opción. Eso lo quiero
   *  simplemente para llevar un registro; una vez que se saca y está
   *  aceptable se va a meter al mismo precio sí o sí."
   *
   * Primer paso: la decisión que sí cambia algo —¿entra al cuarto frío o
   * se botó?—. Segundo paso, solo si entró: qué tan congelada, que es el
   * registro y ya viene contestado con lo de siempre.
   *
   * Los cuatro grados son EXACTAMENTE las vendibles, así que se derivan de
   * la bandera que ya trae cada estado. No hay una segunda lista aquí que
   * se pueda quedar vieja.
   */
  const grados = () => CALIDADES.filter((c) => c.vendible);
  const primerPaso = () => [SALIO, ...CALIDADES.filter((c) => !c.vendible)];

  /**
   * El texto corto que va DENTRO del botón de un molde. Tiene que caber en
   * 62 píxeles, así que son una o dos palabras; el nombre entero sale en el
   * título al pasar el ratón.
   */
  const etiqueta = (r) => deCatalogo(r.resultado)?.boton || r.resultado;

  /** El nombre completo, con la nota cuando la hay. */
  function nombreLargo(r) {
    return deCatalogo(r.resultado)?.nombre || r.resultado;
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
   * del paño", o { resultado, nota }.
   */
  async function preguntarComoSalio({ titulo, texto, conIgual }) {
    const opciones = [];
    if (conIgual) {
      opciones.push({ valor: 'igual', texto: '↩ Como el resto del paño',
                      detalle: 'Quita la marca de este molde.' });
    }
    for (const c of primerPaso()) {
      opciones.push({ valor: c.clave, texto: `${c.icono} ${c.nombre}`, detalle: c.nota });
    }
    let elegido = await menu({ titulo, texto, opciones });
    if (!elegido) return undefined;
    if (elegido === 'igual') return null;

    // EL SEGUNDO PASO, solo si salió buena.
    if (elegido === SALIO.clave) {
      elegido = await preguntarGrado(titulo);
      if (!elegido) return undefined;
    }

    let nota = null;
    if (pideNota(elegido)) {
      nota = await pedirNota('');
      if (!nota) return undefined;
    }

    return { resultado: elegido, nota };
  }

  /** El segundo paso: cuál de los cuatro grados. */
  function preguntarGrado(titulo) {
    return menu({
      titulo,
      texto: `${PREGUNTA_GRADO} Es solo para el registro: las cuatro se ` +
             'venden al mismo precio.',
      // Cuál es "lo de siempre" no se marca aquí: la nota del propio
      // estado ya lo dice, y añadírselo lo repetía dos veces seguidas.
      opciones: grados().map((c) => ({
        valor: c.clave, texto: `${c.icono} ${c.nombre}`, detalle: c.nota
      }))
    });
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
    fijar(false);
    const tanque = datos.tanque;
    const { mediciones } = await api.obtener(
      `/clima/salmuera?tanque=${encodeURIComponent(tanque.id)}&limite=20`);
    const { operarios } = await api.obtener('/produccion/operarios');

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
            ${operarios.map((o) => `
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
  // NÚMEROS A SACAR — el papel que se le entrega al operario
  // ==========================================================
  /**
   * EL PAPEL DEL DÍA  (v4.7)
   *
   * "El del día está genial, pero no quiero que se imprima cuando hago el
   *  corte: que lo pueda imprimir en otro lado, en un momento que quiera
   *  ver cómo está la cosa."
   *
   * Cuánto hielo queda en cada cuarto frío y qué paños salieron hoy, con
   * quién los sacó. Sale cuando se pide, no al cerrar el turno de nadie.
   */
  async function papelDelDia() {
    let r;
    try {
      r = await api.enviar('/impresion/dia', {});
    } catch (e) { return avisar(e.message, 'error'); }

    if (r.impreso) return avisar('El día, impreso', 'bien');

    // Sin térmica lo saca el navegador, igual que todo lo demás.
    const que = await verTicket({
      titulo: 'El día', renglones: r.renglones, ancho: r.ancho,
      notas: ['No hay impresora térmica configurada.'],
      acciones: [{ valor: 'imprimir', texto: '🖨️ Imprimir' }]
    });
    if (que === 'imprimir') imprimirTicket(htmlDeEspejo(r.renglones, r.ancho));
  }

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
        Imprime este papel y dáselo al operario. Cuando regrese te dice qué sacó
        de verdad y lo capturas <strong>tocando cada paño</strong> en la lista
        del tanque.
      </p>

      <button id="imprimir" class="no-imprimir">🖨️ Imprimir</button>`;

    pantalla.querySelector('#volver').onclick = pintar;

    // PRIMERO LA TÉRMICA, que sale al instante y sin preguntar nada. La
    // ventana de "elegir impresora" del navegador solo si no hay ninguna
    // puesta: en un cuarto de máquinas nadie va a estar escogiendo bandeja
    // ni tamaño de hoja con el operario esperando.
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
    if (!conAlgo.length) return '';

    const total = conAlgo.reduce((n, c) => n + m[c.clave], 0);
    const porCiento = (n) => Math.round((n / total) * 100);
    const fuera = m.merma || 0;

    return `
      <h3>Cómo salió el hielo</h3>
      <div class="tarjeta plana">
        <div class="mezcla-barra">
          ${conAlgo.map((c) => `
            <span class="mezcla-tramo ${esc(c.clave)}" style="flex:${m[c.clave]}"
                  title="${esc(c.plural)}: ${m[c.clave]} de ${total}"
              >${porCiento(m[c.clave]) >= 8 ? porCiento(m[c.clave]) + '%' : ''}</span>`).join('')}
        </div>

        <div class="mezcla-lista">
          ${conAlgo.map((c) => `
            <span class="mezcla-parte ${esc(c.clave)}">
              ${m[c.clave]} ${esc(c.corto)}
            </span>`).join('')}
        </div>

        ${fuera > 0 ? `
          <p class="ayuda" style="margin:10px 0 0">
            ${fuera} ${fuera === 1 ? 'marqueta se botó' : 'marquetas se botaron'}:
            ${fuera === 1 ? 'no entró' : 'no entraron'} al cuarto frío. Contaron para el
            costo —gastaron la misma agua y la misma luz— pero no hay que ir a
            buscarlas.
          </p>` : ''}
      </div>`;
  }

  // ==========================================================
  // LO DE HOY
  // ==========================================================
  /**
   * LA REVISIÓN DEL TANQUE  (v6.7)
   *
   * "Vamos a revisar los tanques y un paño que se dijo que se sacó está
   *  ahí y no se sacó."
   *
   * El sistema dice qué debería tener cada paño AHORA MISMO —"se sacó hoy
   * a las 6:10, lo reportó Chema, debe tener agua"— y se va marcando lo
   * que de verdad hay. Se hace de pie, con el teléfono, en dos minutos, y
   * cada diferencia queda escrita con quién reportó aquella sacada.
   */
  async function revisarTanque(tanque = tanqueActivo) {
    fijar(false);
    let d;
    try { d = await api.obtener(`/produccion/revision?tanque=${encodeURIComponent(tanque)}`); }
    catch (e) { return avisar(e.message, 'error'); }

    // Se arranca con todo en "cuadra": lo normal es que cuadre, y así la
    // vuelta son cero toques cuando todo está bien.
    const respuestas = new Map(d.panos.map((p) => [p.id, 'cuadra']));
    const notas = new Map();

    const COMO = [
      { valor: 'cuadra', texto: '✓ Como dice', clase: 'bien' },
      { valor: 'con_hielo', texto: '🧊 Tiene hielo', clase: 'malo',
        ayuda: 'y el sistema dice que ya se sacó' },
      { valor: 'con_agua', texto: '💧 Tiene agua', clase: 'malo',
        ayuda: 'y el sistema dice que está listo' },
      { valor: 'vacio', texto: '␀ Vacío', clase: 'malo', ayuda: 'no hay nada dentro' }
    ];

    function dibujar() {
      const distintos = [...respuestas.values()].filter((r) => r !== 'cuadra').length;

      pantalla.innerHTML = `
        <div class="cabecera-pantalla">
          <button class="secundario chico" id="volver">‹ Producción</button>
          <h2>Revisar ${esc(d.tanque.nombre)}</h2>
          <p class="ayuda">
            Camina el tanque y ve marcando. Todo empieza en «como dice»: solo
            se toca lo que NO está como el sistema cree.
            ${d.ultima ? ` La última vuelta la dio ${esc(d.ultima.quien || '—')},
              ${esc(fechaCorta(d.ultima.fecha))}${
                d.ultima.diferencias ? ` · ${d.ultima.diferencias} no cuadraban` : ' · todo cuadró'}.` : ''}
          </p>
        </div>

        ${d.tanques.length > 1 ? `
          <div class="pestanas" style="margin-bottom:12px">
            ${d.tanques.map((t) => `
              <button class="pestana ${t.id === d.tanque.id ? 'activa' : ''}"
                      data-otro-tanque="${esc(t.id)}">${esc(t.nombre)}</button>`).join('')}
          </div>` : ''}

        <div class="revision-lista">
          ${d.panos.map((p) => {
            const r = respuestas.get(p.id);
            const u = p.ultimaSacada;
            return `
              <div class="tarjeta revision-fila ${r === 'cuadra' ? '' : 'no-cuadra'}">
                <div class="revision-quien">
                  <strong>Paño ${p.numero}</strong>
                  <span class="revision-debe">debe tener <b>${esc(p.debeTener.texto)}</b></span>
                  <small class="ayuda">
                    ${esc(p.debeTener.ayuda)}${p.horas != null ? ` · lleva ${p.horas} h` : ''}
                    ${u ? ` · la sacó ${esc(u.quien)}, ${esc(fechaCorta(u.fecha))}${
                      u.hoy ? ' (hoy)' : ''}` : ' · nunca se ha sacado'}
                  </small>
                </div>
                <div class="revision-botones">
                  ${COMO.map((c) => `
                    <button class="${r === c.valor ? '' : 'secundario'} chico ${
                      r === c.valor && c.clase === 'malo' ? 'peligro' : ''}"
                            data-marcar="${esc(p.id)}" data-valor="${c.valor}"
                            title="${esc(c.ayuda || '')}">${c.texto}</button>`).join('')}
                </div>
                ${r !== 'cuadra' ? `
                  <input class="revision-nota" data-nota="${esc(p.id)}" maxlength="300"
                         value="${esc(notas.get(p.id) || '')}"
                         placeholder="Qué encontraste, si hace falta decirlo">
                  ${u ? `
                    <button class="secundario chico" data-ir="${esc(u.id)}" data-pano="${esc(p.id)}">
                      ✏️ Ir a corregir esa sacada
                    </button>` : ''}` : ''}
              </div>`;
          }).join('')}
        </div>

        <div class="tarjeta corregir-cierre">
          <div class="corregir-cuenta">
            <div><small>Paños revisados</small><strong>${d.panos.length}</strong></div>
            <div><small>No cuadran</small>
              <strong class="${distintos ? 'malo' : 'bien'}">${distintos}</strong></div>
          </div>
          <label>
            <span class="etiqueta-chica">Notas de la vuelta<small>opcional</small></span>
            <input id="notas-rev" maxlength="500" value="${esc(notasVuelta)}"
                   placeholder="Vuelta de la mañana, antes de abrir">
          </label>
          <div class="fila-botones" style="margin-top:12px">
            <button id="guardar-rev">Guardar la revisión</button>
            <button class="secundario" id="cancelar-rev">Cancelar</button>
          </div>
          ${distintos ? `
            <p class="ayuda" style="margin:10px 0 0">
              Al guardar queda escrito qué se encontró y <b>quién reportó</b> cada
              sacada que no cuadra, y sale un aviso por correo. Corregir la
              sacada es aparte: con el ✏️ de cada renglón.
            </p>` : ''}
        </div>`;

      const q = (sel) => pantalla.querySelector(sel);
      q('#volver').onclick = pintar;
      q('#cancelar-rev').onclick = pintar;
      q('#notas-rev').oninput = (ev) => { notasVuelta = ev.target.value; };

      pantalla.querySelectorAll('[data-otro-tanque]').forEach((b) => {
        b.onclick = () => revisarTanque(b.dataset.otroTanque);
      });
      pantalla.querySelectorAll('[data-marcar]').forEach((b) => {
        b.onclick = () => { respuestas.set(b.dataset.marcar, b.dataset.valor); dibujar(); };
      });
      pantalla.querySelectorAll('[data-nota]').forEach((el) => {
        el.oninput = () => notas.set(el.dataset.nota, el.value);
      });
      pantalla.querySelectorAll('[data-ir]').forEach((b) => {
        b.onclick = () => detallePano(b.dataset.pano, { mirar: true, corregir: b.dataset.ir });
      });
      q('#guardar-rev').onclick = guardar;
    }

    async function guardar() {
      try {
        const r = await api.enviar('/produccion/revision', {
          tanqueId: d.tanque.id,
          notas: notasVuelta,
          panos: d.panos.map((p) => ({
            panoId: p.id, encontrado: respuestas.get(p.id), notas: notas.get(p.id) || null
          }))
        });
        const rev = r.revision;
        avisar(rev.diferencias
          ? `Revisión guardada · ${rev.diferencias} ${rev.diferencias === 1 ? 'paño no cuadra' : 'paños no cuadran'}`
          : `Revisión guardada · los ${rev.panos} paños cuadran`,
          rev.diferencias ? 'error' : 'bien');
        pintar();
      } catch (e) { avisar(e.message, 'error'); }
    }

    let notasVuelta = '';
    dibujar();
  }

  async function verHoy() {
    fijar(false);
    const r = await api.obtener('/produccion/hoy');

    pantalla.innerHTML = `
      <button class="secundario chico" id="volver">‹ Producción</button>
      <h2 style="margin-top:14px">Lo de hoy</h2>

      <div class="resumen-fabrica">
        <div><strong>${r.marquetas}</strong><small>al cuarto frío</small></div>
        <div><strong>${r.mezcla.producidas}</strong><small>salieron del molde</small></div>
        <div><strong>${r.merma}</strong><small>se botaron</small></div>
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
