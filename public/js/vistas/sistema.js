/**
 * Pantalla de sistema: sirve para comprobar que todo esta sano
 * y para ver la bitacora de lo que ha pasado.
 */
import { api } from '../api.js';
import { esc, fecha } from '../util.js';

export async function vistaSistema(pantalla) {
  const [estado, { eventos }] = await Promise.all([
    api.obtener('/sistema/estado'),
    api.obtener('/sistema/bitacora?limite=40')
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
}
