/**
 * AVISOS PARA LA CAJA  (v1.5)
 *
 * Dos cosas que el cajero tiene que saber sin ir a buscarlas:
 *
 *  · qué productos se están acabando o ya se acabaron
 *  · si queda poco hielo
 *
 * LA DIFERENCIA ENTRE LOS DOS ES IMPORTANTE.
 *
 * De un refresco, el sistema sabe exactamente cuántos hay: entraron 24,
 * se vendieron 20, quedan 4. Si llega a cero, no se puede vender más,
 * porque vender lo que no existe solo genera un problema en el mostrador.
 *
 * Del hielo NO lo sabe. Los obreros sacan hielo toda la mañana y reportan
 * lo que sacaron hasta como las 3 de la tarde. Así que el número del
 * sistema es "lo que se ha capturado", no "lo que hay": puede decir que
 * queda poco cuando el cuarto frío está lleno.
 *
 * Por eso el hielo solo avisa y jamás bloquea. Bloquear la venta de hielo
 * por un dato que todavía no llega sería parar la fábrica.
 */
const { bd } = require('../../db/conexion');
const { aTexto, DIECISEISAVOS_POR_MARQUETA } = require('../../lib/fracciones');
const { inventarioCompleto, estadoProducto } = require('./inventario');
const { estadoAlmacen } = require('../existencia/calculo');

/** Cuántas marquetas tienen que quedar para que salte el aviso. */
function minimoHielo() {
  const valor = bd.prepare(
    "SELECT valor FROM configuracion WHERE clave = 'hielo_minimo_marquetas'"
  ).get()?.valor;
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : 10;
}

function guardarMinimoHielo(marquetas, usuarioId) {
  bd.prepare(`
    INSERT INTO configuracion (clave, valor, actualizado_en, actualizado_por)
    VALUES ('hielo_minimo_marquetas', ?, datetime('now'), ?)
    ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor,
      actualizado_en = excluded.actualizado_en, actualizado_por = excluded.actualizado_por
  `).run(String(marquetas), usuarioId || null);
}

/** Cómo va el hielo. Nunca bloquea: solo informa. */
function avisoHielo() {
  const almacen = bd.prepare(
    'SELECT * FROM almacenes WHERE activo = 1 AND recibe_produccion = 1 ORDER BY orden LIMIT 1'
  ).get();
  if (!almacen) return null;

  const estado = estadoAlmacen(almacen);
  const minimo = minimoHielo();
  const minimoEnDieciseisavos = minimo * DIECISEISAVOS_POR_MARQUETA;

  return {
    almacen: almacen.nombre,
    dieciseisavos: estado.esperado,
    texto: aTexto(estado.esperado),
    minimoMarquetas: minimo,
    bajo: estado.esperado <= minimoEnDieciseisavos,
    // Cuándo fue la última vez que alguien capturó producción. Si hace
    // horas, el número de arriba está viejo y hay que decirlo.
    ultimaProduccion: bd.prepare(`
      SELECT MAX(s.fecha) f FROM sacadas s
    `).get()?.f || null
  };
}

/**
 * Los productos que se están acabando o ya se acabaron.
 * Solo los que llevan cuenta de piezas: de los demás no hay nada que saber.
 */
function productosBajos(inventario = inventarioCompleto()) {
  return inventario
    .filter((i) => i.bajo || i.esperado <= 0)
    .map((i) => ({
      id: i.producto.id,
      nombre: i.producto.nombre,
      codigo: i.producto.codigo,
      foto: i.producto.foto,
      quedan: i.esperado,
      minimo: i.producto.minimo,
      agotado: i.esperado <= 0
    }))
    // Primero lo que ya no hay: es lo que va a dar problema en el mostrador.
    .sort((a, b) => a.quedan - b.quedan);
}

/**
 * Cuántas piezas quedan de cada cosa que lleva cuenta, por id.
 *
 * La caja lo necesita completo, no solo lo que está bajo: así puede negarse
 * en el acto —sin ir al servidor— cuando alguien captura 12 y solo hay 4.
 * No lleva costos; son números de piezas y el cajero puede verlos.
 */
function existencias(inventario = inventarioCompleto()) {
  const mapa = {};
  for (const i of inventario) mapa[i.producto.id] = i.esperado;
  return mapa;
}

/** Todo junto, que es como lo pide la pantalla de venta. */
function avisos() {
  // Una sola pasada al inventario: recorrerlo dos veces costaría el doble
  // de consultas por cada venta que refresca los avisos.
  const inventario = inventarioCompleto();
  const productos = productosBajos(inventario);
  return {
    productos,
    bajos: productos.length,
    agotados: productos.filter((p) => p.agotado).length,
    existencias: existencias(inventario),
    hielo: avisoHielo()
  };
}

/**
 * ¿Alcanza para vender esto?
 *
 * Devuelve null si sí, o el motivo si no. Solo aplica a lo que lleva cuenta
 * de piezas: el hielo y lo ilimitado pasan siempre.
 */
function alcanza(producto, cantidad) {
  if (!producto || !producto.lleva_inventario) return null;

  // Solo de este producto: recorrer el inventario entero por cada renglón
  // de cada ticket sería pagar el catálogo completo en cada venta.
  const quedan = estadoProducto(producto)?.esperado ?? 0;

  if (quedan <= 0) return `Ya no hay ${producto.nombre}. Se acabó.`;
  if (cantidad > quedan) {
    return `Solo ${quedan === 1 ? 'queda 1' : `quedan ${quedan}`} de ${producto.nombre}.`;
  }
  return null;
}

module.exports = {
  avisos, avisoHielo, productosBajos, existencias, alcanza, minimoHielo, guardarMinimoHielo
};
