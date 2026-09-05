-- ============================================================
-- 055_pedidos_como_se_ven.sql  (v7.0)
--
-- EL CONTROL Y DESPACHO DE PEDIDOS.
--
-- El diseño del dueño para la pantalla de pedidos. Casi todo ya estaba
-- —el folio, la hora, el cliente, el monto, la forma de cobro, en qué
-- camioneta va, el desglose y la nota— y lo que faltaba son cuatro datos
-- y una forma distinta de mirarlos.
--
-- ============================================================
-- 1. EL GIRO DEL CLIENTE
-- ============================================================
--
-- "Horeca / Cadena Puerto", "Mayorista Bebidas", "Conveniencia Express",
-- "Catering / Eventos". Es a lo que se dedica, y en una lista de pedidos
-- dice más que el nombre: quien arma la ruta sabe que a un restaurante hay
-- que llegarle antes de que abra la cocina y a una tiendita no.
--
-- Texto libre, como la zona (054): los giros los pone quien vende, no un
-- catálogo, y el día que entre un cliente raro no hay que tocar el sistema.
-- ------------------------------------------------------------
ALTER TABLE clientes ADD COLUMN giro TEXT;

-- ============================================================
-- 2. LAS INSTRUCCIONES DE DESCARGA
-- ============================================================
--
-- "Entrar por rampa trasera de proveedores. Llenar congelador horizontal
--  #2 del muelle. Solicitar firma a Don Arturo (Jefe de Cocina)."
--
-- NO es lo mismo que `referencias` (042), y por eso es otra columna.
-- Referencias es CÓMO SE ENCUENTRA LA PUERTA —"la de la puerta azul, junto
-- a la tortillería"— y se lee mientras se busca la dirección. Esto es QUÉ
-- SE HACE AL LLEGAR, y se lee con el hielo en las manos. Juntarlas haría
-- que el repartidor tuviera que leer un párrafo entero para encontrar el
-- dato que necesita en cada momento.
--
-- Se copia al pedido al tomarlo (regla 3.5), igual que la dirección: si
-- mañana cambian las instrucciones, la nota que se imprimió ayer sigue
-- diciendo lo que se le dijo al repartidor de ayer.
ALTER TABLE clientes ADD COLUMN instrucciones TEXT;
ALTER TABLE pedidos  ADD COLUMN instrucciones TEXT;

-- Lo que ya está tomado y todavía no se entrega hereda las del cliente:
-- son pedidos vivos y su nota se va a imprimir hoy.
UPDATE pedidos
   SET instrucciones = (SELECT c.instrucciones FROM clientes c WHERE c.id = pedidos.cliente_id)
 WHERE estado = 'pendiente';

-- ============================================================
-- 3. EL TELÉFONO DE LA GENTE
-- ============================================================
--
-- "Contactar chofer." Para marcarle o mandarle un WhatsApp desde el pedido
-- que lleva, sin buscar el número en otro lado. Es del usuario y no del
-- pedido: el chofer es el mismo en los veinte pedidos de su salida.
ALTER TABLE usuarios ADD COLUMN telefono TEXT;
