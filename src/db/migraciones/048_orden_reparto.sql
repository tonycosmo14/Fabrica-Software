-- ============================================================
-- 048 · EL ORDEN DE LAS PARADAS  (v6.3)
-- ============================================================
--
-- "Asignar cada pedido a un repartidor o vehículo, viendo si cabe y qué
--  repartidores hay disponibles."  Y el orden en que se van a visitar:
-- primero se sugiere por cercanía desde la fábrica, y quien arma la
-- salida lo puede mover. Se guarda en la salida, no en el pedido: el
-- mismo pedido en otra salida tendría otro lugar.

ALTER TABLE salida_pedidos ADD COLUMN orden INTEGER;
