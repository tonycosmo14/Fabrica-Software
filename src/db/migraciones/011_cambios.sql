-- ============================================================
-- 011_cambios.sql  (v0.12)
--
-- CAMBIOS DE TICKET.
--
-- Pasa seguido en el mostrador: "pedí 1/2 pero no sabía que era tanto,
-- quería 1/8". El cliente devuelve el ticket y se le hace el cambio.
--
-- Cómo se registra: el ticket viejo se CANCELA y se hace uno nuevo, y los
-- dos quedan amarrados. No se edita el original (regla 7.4) ni se inventa
-- un tipo de venta aparte: un cambio son dos hechos que ya sabíamos
-- registrar, y así el hielo vuelve solo al cuarto frío y la caja cuadra
-- sola, sin ninguna cuenta especial.
--
-- Las dos columnas nuevas son para poder seguir el hilo después: desde el
-- ticket viejo, cuál lo reemplazó; desde el nuevo, cuál reemplazó.
-- ============================================================

ALTER TABLE ventas ADD COLUMN cambiada_por_venta_id TEXT REFERENCES ventas(id);
ALTER TABLE ventas ADD COLUMN cambio_de_venta_id    TEXT REFERENCES ventas(id);

CREATE INDEX idx_ventas_cambio ON ventas(cambio_de_venta_id);
