-- ============================================================
-- 049 · LOS DE SIEMPRE Y LOS DE UNA VEZ  (v6.4)
-- ============================================================
--
-- "Separar los clientes de verdad frecuentes —los de todos los días— de
--  los de una entrega de una vez."
--
-- No se marca a mano: sale de los tickets. Un cliente es "de siempre" si
-- en los últimos 30 días le has vendido tantas veces como diga esto.
INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'clientes_frecuente_tickets', '4',
       'Cuántos tickets en 30 días hacen a un cliente «de siempre»', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'clientes_frecuente_tickets');
