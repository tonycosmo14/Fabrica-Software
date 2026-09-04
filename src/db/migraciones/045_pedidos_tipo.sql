-- ============================================================
-- 045_pedidos_tipo.sql  (v5.8)
--
-- DOS CLASES DE PEDIDO: EL QUE SE LLEVA Y EL QUE VIENEN A BUSCAR.
--
-- "Yo puedo decidir si es un pedido a domicilio, o sea un encargo, o lo
--  pasan a buscar otro día."
--
-- Es la misma promesa —alguien pidió, se le aparta— con dos finales
-- distintos: uno sale en la camioneta con su nota y su QR; el otro se
-- queda en la fábrica hasta que el cliente llega, y entonces se cobra en
-- la caja como cualquier ticket, con los precios que se le prometieron.
--
-- La preparación los junta (hay que llenar los garrafones igual); la
-- camioneta solo se lleva los de domicilio.
-- ============================================================
ALTER TABLE pedidos ADD COLUMN tipo TEXT NOT NULL DEFAULT 'domicilio'
  CHECK (tipo IN ('domicilio','recoger'));

CREATE INDEX idx_pedidos_tipo ON pedidos(tipo, estado);
