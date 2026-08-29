/**
 * Pantalla de sistema: sirve para comprobar que todo esta sano
 * y para ver la bitacora de lo que ha pasado.
 */
import { api } from '../api.js';
import { esc, fecha, avisar } from '../util.js';
import { pedirTexto, pedirNumero, confirmar } from '../dialogo.js';

export async function vistaSistema(pantalla, estadoApp) {
  const puedeConfigurar = estadoApp?.permisos?.includes('*') ||
                          estadoApp?.permisos?.includes('sistema.configurar');

  // Qué impresora tiene puesta cada apartado. Lo llena el panel al pintarse
  // y lo lee la lista de impresoras, que es otra función: por eso vive aquí
  // arriba, en el único sitio que las dos alcanzan.
  let impresorasPorApartado = {};

  await pintar();

  async function pintar() {
  const [estado, { eventos }, resp, impresion] = await Promise.all([
    api.obtener('/sistema/estado'),
    api.obtener('/sistema/bitacora?limite=40'),
    api.obtener('/sistema/respaldos'),
    // La impresora es un aparato de esta PC, como el disco de los
    // respaldos. Vivía en Productos, donde nadie la buscaba.
    api.obtener('/impresion/config').then((r) => r.impresion).catch(() => null)
  ]);

  // DOS COLUMNAS EN LA PC. A la izquierda lo que se toca —respaldos e
  // impresoras—, a la derecha lo que se consulta. En el celular se apilan
  // solas, que es como se leen bien en una pantalla angosta.
  pantalla.innerHTML = `
    <div class="ancho-completo">
    <h2>Sistema</h2>

    <div class="tarjeta">
      <table class="tabla">
        <tr><th>Versión</th><td>v${esc(estado.version)}</td></tr>
        <tr><th>Negocio</th><td>${esc(estado.negocio.nombre_negocio || '—')}</td></tr>
        <tr><th>Usuarios activos</th><td>${esc(estado.usuariosActivos)}</td></tr>
        <tr><th>Base de datos</th><td>${esc(estado.baseDeDatos.tamanoKb)} KB</td></tr>
      </table>
    </div>

    <div class="sistema-columnas">
    <div class="sistema-columna">

    <h3>Respaldos</h3>
    <div class="tarjeta respaldo-estado ${resp.sano ? 'sano' : 'alerta'}">
      <div class="respaldo-cabeza">
        <span class="respaldo-icono">${resp.sano ? '🛡️' : '⚠️'}</span>
        <div>
          <strong>${resp.sano ? 'Tus datos están respaldados' : 'Atención con los respaldos'}</strong>
          <small>
            ${resp.ajustes.ultimo
              ? `Último: ${esc(fecha(resp.ajustes.ultimo))} · hace ${resp.horasDesdeUltimo} h`
              : 'Todavía no se ha hecho ninguno'}
          </small>
        </div>
      </div>

      <table class="tabla" style="margin-top:12px">
        <tr><th>Cada cuánto</th><td>${resp.ajustes.cadaHoras} horas</td></tr>
        <tr><th>Se conservan</th><td>los últimos ${resp.ajustes.conservar}</td></tr>
        <tr><th>Copias guardadas</th><td>${resp.respaldos.length}</td></tr>
        <tr>
          <th>Copia fuera de la PC</th>
          <td>
            ${resp.ajustes.carpetaExtra
              ? `<span class="ruta">${esc(resp.ajustes.carpetaExtra)}</span>
                 ${resp.ajustes.ultimoError
                    ? `<br><span class="mal">Falló: ${esc(resp.ajustes.ultimoError)}</span>`
                    : `<br><span class="bien">funcionando · ${resp.respaldosExtra.length} copias</span>`}`
              : '<span class="mal">sin configurar</span>'}
          </td>
        </tr>
      </table>

      ${!resp.ajustes.carpetaExtra ? `
        <p class="ayuda" style="margin:14px 0 0">
          <strong>Falta lo más importante.</strong> Las copias están en esta misma
          PC: si el disco muere, se van con él. Configura una segunda carpeta
          en una USB pegada atrás, o en una carpeta de Drive o OneDrive que se
          sincroniza sola.
        </p>` : ''}

      ${puedeConfigurar ? `
        <div class="fila-botones" style="margin-top:16px;flex-wrap:wrap">
          <button class="chico" id="respaldar">Respaldar ahora</button>
          <button class="secundario chico" id="carpeta">Carpeta fuera de la PC</button>
          <button class="secundario chico" id="frecuencia">Cada cuánto</button>
        </div>` : ''}
    </div>

    ${resp.respaldos.length ? `
      <details class="ayuda-bloque">
        <summary>Ver las ${resp.respaldos.length} copias guardadas</summary>
        <div class="ayuda-cuerpo">
          <table class="tabla">
            <tr><th>Cuándo</th><th>Tamaño</th></tr>
            ${resp.respaldos.map((b) => `
              <tr><td>${esc(fecha(b.fecha))}</td><td>${b.kb} KB</td></tr>`).join('')}
          </table>
          <p class="ayuda" style="margin:12px 0 0;font-size:14px">
            Están en <span class="ruta">${esc(resp.carpeta)}</span>.
            Para restaurar: cierra el sistema, copia el archivo que quieras
            encima de <span class="ruta">${esc(estado.baseDeDatos.archivo)}</span>
            quitándole la parte de la fecha, y vuelve a abrir.
          </p>
        </div>
      </details>` : ''}

    ${impresion ? panelImpresora(impresion) : ''}

    </div>
    <div class="sistema-columna">

    ${puedeConfigurar ? panelActualizar(estado) : ''}

    <h3>Dónde viven los datos</h3>
    <div class="tarjeta plana">
      <table class="tabla">
        <tr><th>Base de datos</th><td class="ruta">${esc(estado.baseDeDatos.archivo)}</td></tr>
      </table>
      <p class="ayuda" style="margin:12px 0 0;font-size:14px">
        Ese archivo <strong>es el negocio</strong>: usuarios, tanques y, más
        adelante, ventas y cortes. Cópialo de vez en cuando a una USB.
        El sistema hace un respaldo solo antes de cada actualización.
      </p>
    </div>

    <h3>Si se olvida la contraseña</h3>
    <div class="tarjeta plana">
      <p class="ayuda" style="margin:0">
        Si el administrador olvida su PIN <em>y</em> su contraseña, se arregla
        desde esta misma PC: doble clic en <strong>RECUPERAR-ACCESO</strong>,
        en la carpeta del sistema. Pide qué cuenta arreglar y le pone claves
        nuevas. Queda anotado en la bitácora.
      </p>
      <p class="ayuda" style="margin:12px 0 0">
        Lo más sano es tener <strong>dos administradores</strong>: uno le
        cambia el PIN al otro desde Usuarios y no hace falta nada más.
      </p>
    </div>

    <h3>Migraciones aplicadas</h3>
    <div class="tarjeta plana">
      <table class="tabla">
        <tr><th>Archivo</th><th>Fecha</th></tr>
        ${estado.migraciones.map((m) => `
          <tr><td>${esc(m.archivo)}</td><td>${esc(fecha(m.aplicada_en))}</td></tr>`).join('')}
      </table>
    </div>

    <h3>Bitácora reciente</h3>
    <p class="ayuda">Cada registro guarda quién lo ejecutó y quién lo capturó.</p>
    <div class="tarjeta plana">
      <table class="tabla">
        <tr><th>Cuándo</th><th>Acción</th><th>Quién</th></tr>
        ${eventos.map((e) => `
          <tr>
            <td>${esc(fecha(e.fecha))}</td>
            <td>${esc(e.accion)}</td>
            <td>${esc(e.ejecutor_nombre || '—')}</td>
          </tr>`).join('') || '<tr><td colspan="3">Sin eventos.</td></tr>'}
      </table>
    </div>

    </div>
    </div>
    </div>`;

    if (!puedeConfigurar) return;

    pantalla.querySelector('#respaldar').onclick = async () => {
      try {
        const r = await api.enviar('/sistema/respaldos/ahora', {});
        avisar(r.errorExtra ? 'Respaldado, pero la copia de fuera falló' : 'Respaldo hecho',
               r.errorExtra ? 'error' : 'bien');
        pintar();
      } catch (e) { avisar(e.message, 'error'); }
    };

    pantalla.querySelector('#carpeta').onclick = async () => {
      const ruta = await pedirTexto({
        titulo: 'Carpeta fuera de la PC',
        texto: 'Pega la ruta de una USB o de una carpeta de Drive u OneDrive. ' +
               'Ahí se guardará una segunda copia cada vez.',
        valor: resp.ajustes.carpetaExtra,
        marcador: 'D:\\RespaldosHielo',
        ok: 'Guardar'
      });
      if (ruta === null) return;
      try {
        await api.actualizar('/sistema/respaldos', { carpetaExtra: ruta });
        avisar('Carpeta guardada y probada', 'bien');
        pintar();
      } catch (e) { avisar(e.message, 'error'); }
    };

    const guardarImp = pantalla.querySelector('#guardar-impresora');
    if (guardarImp) {
      guardarImp.onclick = () => guardarImpresora();
      pantalla.querySelector('#probar-impresora').onclick = () => guardarImpresora({ probar: true });
      // La lista se llena sola al abrir la pantalla.
      llenarImpresoras();

      const zip = pantalla.querySelector('#zip');
      if (zip) zip.onchange = () => {
        const archivo = zip.files?.[0];
        zip.value = '';                       // que se pueda volver a escoger el mismo
        if (archivo) revisarZip(archivo);
      };

      pantalla.querySelector('#probar-cajon').onclick = async () => {
        try {
          await api.actualizar('/impresion/config', {
            abrirCajon: pantalla.querySelector('#imp-cajon').checked,
            salidaCajon: Number(pantalla.querySelector('#imp-cajon-salida').value),
            avanceCorte: Number(pantalla.querySelector('#imp-avance').value)
          });
          const r = await api.enviar('/impresion/cajon', {});
          avisar(r.abierto ? 'Se le mandó el pulso al cajón'
                           : 'Primero elige la impresora', r.abierto ? 'bien' : '');
        } catch (e) { avisar(e.message, 'error'); }
      };

      // Y el cartel de "por dónde va a salir" se actualiza mientras se
      // teclea a mano: es lo que hace que este campo se pueda depurar solo.
      const destino = pantalla.querySelector('#imp-destino');
      let espera;
      destino.oninput = () => { clearTimeout(espera); espera = setTimeout(entenderDestino, 250); };
    }

    pantalla.querySelector('#frecuencia').onclick = async () => {
      const horas = await pedirNumero({
        titulo: '¿Cada cuántas horas se respalda?',
        texto: 'Cuatro horas es un buen término medio: casi nunca se pierde nada ' +
               'y no llena el disco.',
        valor: resp.ajustes.cadaHoras, min: 1, max: 48
      });
      if (horas === null) return;
      try {
        await api.actualizar('/sistema/respaldos', { cadaHoras: horas });
        avisar(`Se respaldará cada ${horas} horas`, 'bien');
        pintar();
      } catch (e) { avisar(e.message, 'error'); }
    };
  }

  // ==========================================================
  // LA IMPRESORA DE TICKETS
  //
  // Es un aparato de esta computadora, igual que el disco donde caen los
  // respaldos: por eso vive aquí y no en Productos, que es donde estaba y
  // donde nadie la iba a buscar.
  // ==========================================================
  /**
   * ACTUALIZAR EL SISTEMA.
   *
   * Se sube un ZIP y el sistema se reemplaza a sí mismo. Es el botón más
   * peligroso del programa, así que va en dos pasos: primero se REVISA y se
   * enseña qué trae, y solo después se instala. Nadie debería apretar
   * "actualizar" a ciegas cuando lo que está en juego es el programa con el
   * que se cobra.
   */
  function panelActualizar(estado) {
    return `
      <h3>Actualizar el sistema</h3>
      <div class="tarjeta">
        <p class="ayuda" style="margin:0 0 12px">
          Tienes la <b>v${esc(estado.version)}</b>. Cuando te mande una versión
          nueva, va a llegar como un archivo <b>.zip</b>: lo subes aquí y el
          sistema se actualiza solo.
        </p>

        <label class="subir" style="width:100%;justify-content:center">
          📦 Escoger el archivo ZIP
          <input type="file" id="zip" accept=".zip,application/zip" hidden>
        </label>

        <div id="revision-zip"></div>

        <p class="ayuda" style="margin:12px 0 0">
          <b>Tus datos no se tocan.</b> Ventas, clientes, cortes y precios
          viven en la carpeta <code>datos</code>, que la actualización nunca
          abre. Aun así, antes de cambiar nada se hace un respaldo, y la
          versión anterior se guarda por si hay que volver a ella.
        </p>
      </div>`;
  }

  /** Sube el ZIP y enseña qué trae, sin instalar todavía. */
  async function revisarZip(archivo) {
    const caja = pantalla.querySelector('#revision-zip');
    caja.innerHTML = '<p class="ayuda">Revisando el archivo…</p>';

    let base64;
    try { base64 = await leerComoBase64(archivo); }
    catch { caja.innerHTML = '<p class="ayuda malo">No se pudo leer el archivo.</p>'; return; }

    let revision;
    try {
      revision = (await api.enviar('/sistema/actualizar/revisar', { archivo: base64 })).revision;
    } catch (e) {
      caja.innerHTML = `<p class="ayuda malo">${esc(e.message)}</p>`;
      return;
    }

    caja.innerHTML = `
      <div class="cuadre" style="margin-top:14px">
        <div class="cuadre-linea">
          <span>Versión que traes ahora</span><strong>v${esc(revision.versionActual)}</strong>
        </div>
        <div class="cuadre-linea total">
          <span>Versión del archivo</span>
          <strong class="${revision.esMasNueva ? 'bueno' : 'malo'}">v${esc(revision.version)}</strong>
        </div>
        <div class="cuadre-linea">
          <span>Archivos que se reemplazan</span><strong>${revision.archivos}</strong>
        </div>
      </div>
      ${revision.avisos.map((a) => `
        <div class="aviso-sin-caja" style="margin-top:10px">${esc(a)}</div>`).join('')}
      <button id="instalar-zip" class="${revision.esMasNueva ? '' : 'peligro'}"
              style="margin-top:14px;width:100%">
        Actualizar a la v${esc(revision.version)}
      </button>`;

    caja.querySelector('#instalar-zip').onclick = () => instalarZip(base64, revision);
  }

  async function instalarZip(base64, revision) {
    if (!await confirmar({
      titulo: `¿Actualizar a la v${revision.version}?`,
      texto: 'El sistema se va a reiniciar. Asegúrate de que nadie esté cobrando ' +
             'en este momento.',
      ok: 'Actualizar', peligro: !revision.esMasNueva
    })) return;

    const caja = pantalla.querySelector('#revision-zip');
    caja.innerHTML = '<p class="ayuda">Actualizando… no cierres esta ventana.</p>';

    let r;
    try {
      r = (await api.enviar('/sistema/actualizar', { archivo: base64 })).actualizado;
    } catch (e) {
      caja.innerHTML = `<p class="ayuda malo">${esc(e.message)}</p>`;
      avisar(e.message, 'error');
      return;
    }

    caja.innerHTML = `
      <div class="tarjeta" style="margin-top:14px">
        <p style="margin:0"><b>Listo: v${esc(r.versionAnterior)} → v${esc(r.version)}</b></p>
        <p class="ayuda" style="margin:8px 0 0">
          Se reemplazaron ${r.archivos} archivos.
          ${r.respaldo ? `Respaldo guardado: <code>${esc(r.respaldo)}</code>.` : ''}
        </p>
        <p class="ayuda" style="margin:8px 0 12px">
          Falta <b>reiniciar</b> para que el programa nuevo entre en marcha.
          El código viejo sigue cargado en memoria hasta entonces.
        </p>
        <button id="reiniciar-ya" style="width:100%">Reiniciar el sistema ahora</button>
      </div>`;

    caja.querySelector('#reiniciar-ya').onclick = async () => {
      try { await api.enviar('/sistema/reiniciar', {}); } catch { /* se está apagando */ }
      caja.innerHTML = `
        <p class="ayuda" style="margin-top:14px">
          Reiniciando. Si en unos segundos no vuelve solo, cierra la ventana
          negra y da doble clic en <b>INICIAR</b>.
        </p>`;
      // Se espera a que vuelva a levantar y se recarga.
      setTimeout(() => location.reload(), 4000);
    };
  }

  /** El ZIP como texto, para poder mandarlo en el JSON. */
  function leerComoBase64(archivo) {
    return new Promise((resolver, rechazar) => {
      const lector = new FileReader();
      lector.onload = () => resolver(lector.result);
      lector.onerror = () => rechazar(lector.error);
      lector.readAsDataURL(archivo);
    });
  }

  function panelImpresora(i) {
    const como = i.comoSeManda || { tipo: 'ninguno', texto: 'sin configurar' };
    impresorasPorApartado = Object.fromEntries(
      (i.apartados || []).map((a) => [a.id, a.destino || '']));
    return `
      <h3>Impresora de tickets</h3>
      <div class="tarjeta">
        <p class="ayuda" style="margin:0 0 12px">
          Elige cuál es la impresora de tickets y ya. El ticket sale
          <strong>al instante</strong>, sin que se asome la ventana de
          impresión del navegador.
        </p>

        <label class="etiqueta-chica" for="imp-elegir">¿Cuál es la impresora de tickets?</label>
        <select id="imp-elegir" ${puedeConfigurar ? '' : 'disabled'}>
          <option value="">Buscando las impresoras de esta computadora…</option>
        </select>

        <p class="imp-entendido ${como.tipo}" id="imp-entendido">
          ${como.tipo === 'ninguno'
            ? 'Sin impresora elegida, el ticket se imprime por la ventana del navegador.'
            : `El ticket se manda <b>${esc(como.texto)}</b>.`}
        </p>

        <details class="ayuda-bloque" id="imp-manual" ${i.destino ? '' : ''}>
          <summary>Escribir la dirección a mano</summary>
          <div class="ayuda-cuerpo">
            <p>Solo hace falta si la impresora no aparece en la lista. Se puede
            poner su <b>dirección de red</b> (<code>192.168.1.65</code>), su
            <b>nombre compartido</b> de Windows
            (<code>\\\\localhost\\TICKET</code>), o la ruta de una carpeta
            para probar sin impresora.</p>
            <input id="imp-destino" autocomplete="off" placeholder="192.168.1.65"
                   value="${esc(i.destino)}" ${puedeConfigurar ? '' : 'disabled'}>
          </div>
        </details>

        <div class="rejilla-config" style="margin-top:14px">
          <label>
            <span class="etiqueta-chica">Ancho del papel</span>
            <select id="imp-ancho" ${puedeConfigurar ? '' : 'disabled'}>
              <option value="80" ${i.anchoMm === 80 ? 'selected' : ''}>80 mm</option>
              <option value="58" ${i.anchoMm === 58 ? 'selected' : ''}>58 mm</option>
            </select>
          </label>
          <label>
            <span class="etiqueta-chica">Copias por venta</span>
            <input id="imp-copias" inputmode="numeric" value="${i.copias}"
                   ${puedeConfigurar ? '' : 'disabled'}>
          </label>
        </div>

        <label class="etiqueta-chica" for="imp-pie">Renglón al pie (opcional)</label>
        <input id="imp-pie" autocomplete="off" placeholder="Tel. 999 000 0000"
               value="${esc(i.pie)}" ${puedeConfigurar ? '' : 'disabled'}>

        <div class="rejilla-config" style="margin-top:12px">
          <label>
            <span class="etiqueta-chica">
              Avance antes de cortar
              <small>renglones en blanco al final</small>
            </span>
            <select id="imp-avance" ${puedeConfigurar ? '' : 'disabled'}>
              ${[0, 1, 2, 3, 4, 5, 6, 8].map((n) => `
                <option value="${n}" ${Number(i.avanceCorte) === n ? 'selected' : ''}>
                  ${n === 0 ? '0 — nada' : n + (n === 1 ? ' renglón' : ' renglones')}
                  ${n ? ` (${n * 3} mm)` : ''}
                </option>`).join('')}
            </select>
          </label>
        </div>
        <p class="ayuda" style="margin:8px 0 0;font-size:13.5px">
          La cuchilla no está donde imprime: está uno o dos centímetros más
          arriba. La orden de cortar ya le dice a la impresora <b>«avanza
          hasta donde cortas y corta»</b>, así que muchas no necesitan ni un
          renglón — y ahí son <b>12 mm menos por ticket</b>, que al mes son
          metros. Pero hay impresoras baratas que cortan donde están.
          <b>Baja el número, imprime una prueba y mira el papel:</b> si la
          cuchilla se comió el último renglón, súbelo uno.
        </p>

        <h4 class="cfg-subtitulo">El cajón del dinero</h4>
        <label class="interruptor">
          <input type="checkbox" id="imp-cajon" ${i.abrirCajon ? 'checked' : ''}
                 ${puedeConfigurar ? '' : 'disabled'}>
          <span>
            <strong>Abrir el cajón al imprimir</strong>
            <small>
              El cajón cuelga de la impresora por un cable: quien lo abre es
              ella. Por eso el pulso viaja pegado al ticket: si sale papel se
              abre, y si la impresora está apagada no se abre ni se finge que
              sí. Se abre cada vez que se imprime, y una sola vez aunque
              salgan tres copias del mismo ticket.
            </small>
          </span>
        </label>
        <div class="rejilla-config" style="margin-top:10px">
          <label>
            <span class="etiqueta-chica">Salida del conector<small>si no abre, prueba la otra</small></span>
            <select id="imp-cajon-salida" ${puedeConfigurar ? '' : 'disabled'}>
              <option value="2" ${i.salidaCajon !== 5 ? 'selected' : ''}>Salida 2 (la normal)</option>
              <option value="5" ${i.salidaCajon === 5 ? 'selected' : ''}>Salida 5</option>
            </select>
          </label>
          ${puedeConfigurar ? `
            <label>
              <span class="etiqueta-chica">&nbsp;</span>
              <button class="secundario" id="probar-cajon" type="button">Abrirlo ahora</button>
            </label>` : ''}
        </div>

        <h4 class="cfg-subtitulo">Qué se imprime dónde</h4>
        <p class="ayuda" style="margin:0 0 10px">
          Cada cosa puede ir a una impresora distinta. Vacío quiere decir
          <b>la de tickets</b>, que es lo que casi siempre se quiere.
        </p>
        ${(i.apartados || []).map((a) => `
          <div class="cuadre-linea campo-vivo">
            <span>${esc(a.nombre)}<small>${esc(a.ayuda)}</small></span>
            <select data-apartado="${esc(a.id)}" ${puedeConfigurar ? '' : 'disabled'}>
              <option value="">La de tickets</option>
            </select>
          </div>`).join('')}

        ${puedeConfigurar ? `
          <div class="fila-botones" style="margin-top:14px">
            <button class="secundario" id="probar-impresora">Imprimir una prueba</button>
            <button id="guardar-impresora">Guardar</button>
          </div>` : ''}

        <details class="ayuda-bloque" style="margin-top:14px">
          <summary>Si no imprime</summary>
          <div class="ayuda-cuerpo">
            <p>El renglón de arriba dice <b>por dónde va a salir</b> el ticket.
            Si algo falla, el aviso dice qué revisar. Lo que suele pasar:</p>
            <ul>
              <li><b>"no contesta"</b> — está apagada, sin cable de red, o en
              una red distinta a la de esta computadora.</li>
              <li><b>"no acepta nada en el puerto"</b> — la dirección es buena
              pero el puerto no. Casi siempre es el <code>9100</code>.</li>
              <li><b>"no se encuentra el nombre de red"</b> — está apuntando a
              un nombre compartido que ya no existe. Elige la impresora de la
              lista de arriba y se arregla.</li>
            </ul>
            <p class="ayuda-tip">Las térmicas de red se cobran solas: basta con
            su dirección IP y el sistema les habla directo por el puerto 9100,
            sin driver y sin compartir nada. Las de USB van por su nombre de
            Windows, que también sale en la lista.</p>
          </div>
        </details>
      </div>`;
  }

  /**
   * LLENA LA LISTA DE IMPRESORAS.
   *
   * Se hace sola al abrir la pantalla: pedirle al usuario que toque un botón
   * para descubrir algo que el programa puede averiguar solo es trabajo que
   * no le toca. Si Windows no contesta nada, queda la opción de escribirla
   * a mano, que es la que había antes.
   */
  async function llenarImpresoras() {
    const lista = pantalla.querySelector('#imp-elegir');
    if (!lista) return;

    let impresoras = [];
    try { impresoras = (await api.obtener('/impresion/impresoras')).impresoras; }
    catch { /* sin permiso o sin Windows: se queda la opción de escribirla */ }

    const actual = pantalla.querySelector('#imp-destino')?.value.trim() || '';
    const sueltas = impresoras.filter((p) => p.sugerencia);
    // Lo que ya estaba guardado puede no salir en la lista (una dirección
    // escrita a mano, por ejemplo). No se pierde: se le hace su renglón.
    const aparte = actual && !sueltas.some((p) => p.sugerencia === actual);

    lista.innerHTML = `
      <option value="">Ninguna · imprimir por el navegador</option>
      ${sueltas.map((p) => `
        <option value="${esc(p.sugerencia)}" ${p.sugerencia === actual ? 'selected' : ''}>
          ${esc(p.nombre)}${p.puerto ? ` — ${esc(p.puerto)}` : ''}
        </option>`).join('')}
      ${aparte ? `<option value="${esc(actual)}" selected>${esc(actual)} (a mano)</option>` : ''}`;

    if (!impresoras.length) {
      lista.insertAdjacentHTML('afterend',
        '<p class="ayuda" style="margin:6px 0 0">Windows no contestó con ninguna ' +
        'impresora. Escríbela a mano aquí abajo.</p>');
      pantalla.querySelector('#imp-manual')?.setAttribute('open', '');
    }

    lista.onchange = () => {
      const campo = pantalla.querySelector('#imp-destino');
      if (campo) campo.value = lista.value;
      entenderDestino();
    };

    // Los selectores de cada apartado llevan las mismas impresoras, más la
    // opción de dejarlo en "la de tickets".
    const opciones = sueltas.map((p) => `
      <option value="${esc(p.sugerencia)}">${esc(p.nombre)}</option>`).join('');
    pantalla.querySelectorAll('[data-apartado]').forEach((sel) => {
      const puesto = (impresorasPorApartado[sel.dataset.apartado] || '').trim();
      const conocida = sueltas.some((p) => p.sugerencia === puesto);
      sel.innerHTML = `
        <option value="">La de tickets</option>
        ${opciones}
        ${puesto && !conocida ? `<option value="${esc(puesto)}">${esc(puesto)}</option>` : ''}`;
      sel.value = puesto;
    });
  }

  /** Va diciendo por dónde va a salir el ticket con lo que está elegido. */
  async function entenderDestino() {
    const campo = pantalla.querySelector('#imp-destino');
    const cartel = pantalla.querySelector('#imp-entendido');
    if (!campo || !cartel) return;
    try {
      const { como } = await api.obtener(
        `/impresion/entender?destino=${encodeURIComponent(campo.value.trim())}`);
      cartel.className = `imp-entendido ${como.tipo}`;
      cartel.innerHTML = como.tipo === 'ninguno'
        ? 'Sin impresora elegida, el ticket se imprime por la ventana del navegador.'
        : `El ticket se manda <b>${esc(como.texto)}</b>.`;
    } catch { /* es un cartel de ayuda: si falla, no pasa nada */ }
  }

  async function guardarImpresora({ probar = false } = {}) {
    const apartados = {};
    pantalla.querySelectorAll('[data-apartado]').forEach((sel) => {
      apartados[sel.dataset.apartado] = sel.value;
    });

    const datos = {
      destino: pantalla.querySelector('#imp-destino').value.trim(),
      anchoMm: Number(pantalla.querySelector('#imp-ancho').value),
      copias: Number(pantalla.querySelector('#imp-copias').value.replace(/[^0-9]/g, '')) || 1,
      pie: pantalla.querySelector('#imp-pie').value.trim(),
      abrirCajon: pantalla.querySelector('#imp-cajon').checked,
      salidaCajon: Number(pantalla.querySelector('#imp-cajon-salida').value),
      avanceCorte: Number(pantalla.querySelector('#imp-avance').value),
      apartados
    };
    try {
      const r = await api.actualizar('/impresion/config', datos);
      if (!probar) {
        avisar('Impresora guardada', 'bien');
        entenderDestino();
        return;
      }
      const como = r.impresion?.comoSeManda;
      await api.enviar('/impresion/prueba', {});
      avisar(como?.tipo === 'archivo'
        ? `Se guardó el ticket ${como.texto}.`
        : 'Salió la prueba. Revisa el papel.', 'bien');
    } catch (e) {
      // El mensaje del servidor ya dice qué revisar; no se tapa con uno
      // genérico, que es lo que deja al usuario sin saber por dónde seguir.
      avisar(e.message, 'error');
    }
  }
}
