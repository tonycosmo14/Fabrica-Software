/**
 * QUÉ LE COMPRA CADA CLIENTE, MARCADO SOLO  (v5.7.1)
 *
 * "Lo de qué le compra en clientes no lo entiendo para qué está."
 *
 * Y tenía razón en no entenderlo: eran tres botones que había que apretar
 * a mano, y lo único que hacían era decidir en qué pestaña de Clientes
 * sale cada quien. Nadie iba a ir cliente por cliente marcándolos.
 *
 * Ahora se marcan solos. Cada venta y cada pedido dicen qué se llevó:
 * hielo del cuarto frío es «marquetas», un producto de nevera es «bolsas»
 * y uno del agua es «agua». Con eso la pestaña se arma sola y en la ficha
 * se enseña, nada más, por qué está donde está.
 *
 * Solo se PRENDE, nunca se apaga: que alguien haya comprado agua una vez
 * es un hecho, y dejar de comprarla no lo borra.
 */
const { bd } = require('../../db/conexion');

/**
 * @param clienteId a quién
 * @param lineas    [{ productoId, dieciseisavos }] — las de la venta o el pedido
 */
function marcarLoQueCompra(clienteId, lineas = []) {
  if (!clienteId || !lineas.length) return;

  let marqueta = 0;
  let bolsa = 0;
  let agua = 0;
  const buscar = bd.prepare('SELECT para_nevera, para_agua, tipo FROM productos WHERE id = ?');

  for (const l of lineas) {
    if (Number(l.dieciseisavos) > 0) marqueta = 1;
    if (!l.productoId) continue;
    const p = buscar.get(l.productoId);
    if (!p) continue;
    if (p.para_nevera) bolsa = 1;
    if (p.para_agua) agua = 1;
  }
  if (!marqueta && !bolsa && !agua) return;

  bd.prepare(`
    UPDATE clientes
       SET compra_marqueta = MAX(compra_marqueta, ?),
           compra_bolsa    = MAX(compra_bolsa, ?),
           compra_agua     = MAX(compra_agua, ?)
     WHERE id = ?
  `).run(marqueta, bolsa, agua, clienteId);
}

module.exports = { marcarLoQueCompra };
