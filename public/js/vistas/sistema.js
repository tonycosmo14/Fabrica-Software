/**
 * Pantalla de sistema: sirve para comprobar que todo esta sano
 * y para ver la bitacora de lo que ha pasado.
 */
import { api } from '../api.js';
import { esc, fecha, avisar } from '../util.js';
import { pedirTexto, pedirNumero } from '../dialogo.js';

export async function vistaSistema(pantalla, estadoApp) {
  const puedeConfigurar = estadoApp?.permisos?.includes('*') ||
                          estadoApp?.permisos?.includes('sistema.configurar');

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

  pantalla.innerHTML = `
    <h2>Sistema</h2>

    <div class="tarjeta">
      <table class="tabla">
        <tr><th>Versión</th><td>v${esc(estado.version)}</td></tr>
        <tr><th>Negocio</th><td>${esc(estado.negocio.nombre_negocio || '—')}</td></tr>
        <tr><th>Usuarios activos</th><td>${esc(estado.usuariosActivos)}</td></tr>
        <tr><th>Base de datos</th><td>${esc(estado.baseDeDatos.tamanoKb)} KB</td></tr>
      </table>
    </div>

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
  function panelImpresora(i) {
    return `
      <h3>Impresora de tickets</h3>
      <div class="tarjeta">
        <p class="ayuda" style="margin:0 0 12px">
          Con el nombre puesto, el ticket sale <strong>al instante</strong>, sin
          que se asome la ventana de impresión del navegador.
        </p>

        <label class="etiqueta-chica" for="imp-destino">Nombre compartido de la impresora</label>
        <input id="imp-destino" autocomplete="off" placeholder="\\\\localhost\\TICKET"
               value="${esc(i.destino)}" ${puedeConfigurar ? '' : 'disabled'}>

        <div class="rejilla-config">
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

        ${puedeConfigurar ? `
          <div class="fila-botones" style="margin-top:14px">
            <button class="secundario" id="probar-impresora">Imprimir una prueba</button>
            <button id="guardar-impresora">Guardar</button>
          </div>` : ''}

        <details class="ayuda-bloque" style="margin-top:14px">
          <summary>¿De dónde saco ese nombre?</summary>
          <div class="ayuda-cuerpo">
            <p>Hay que <b>compartir la impresora</b> una vez en Windows: es para
            que Windows le dé un nombre al que se le puede escribir directo,
            saltándose el motor de impresión.</p>
            <ol class="instrucciones">
              <li>Panel de control → <b>Dispositivos e impresoras</b>.</li>
              <li>Clic derecho en la térmica → <b>Propiedades de impresora</b>.</li>
              <li>Pestaña <b>Compartir</b> → nombre corto, por ejemplo <code>TICKET</code>.</li>
              <li>Aquí escribe <code>\\\\localhost\\TICKET</code> y dale a probar.</li>
            </ol>
          </div>
        </details>
      </div>`;
  }

  async function guardarImpresora({ probar = false } = {}) {
    const datos = {
      destino: pantalla.querySelector('#imp-destino').value.trim(),
      anchoMm: Number(pantalla.querySelector('#imp-ancho').value),
      copias: Number(pantalla.querySelector('#imp-copias').value.replace(/[^0-9]/g, '')) || 1,
      pie: pantalla.querySelector('#imp-pie').value.trim()
    };
    try {
      await api.actualizar('/impresion/config', datos);
      if (probar) {
        await api.enviar('/impresion/prueba', {});
        avisar('Salió la prueba. Revisa el papel.', 'bien');
      } else {
        avisar('Impresora guardada', 'bien');
      }
    } catch (e) { avisar(e.message, 'error'); }
  }
}
