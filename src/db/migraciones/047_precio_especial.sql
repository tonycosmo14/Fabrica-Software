-- ============================================================
-- 047 · EL PRECIO ESPECIAL DE UNA VEZ  (v6.2)
-- ============================================================
--
-- "Vendí 20 bolsas a $12 en vez de $20. ¿Cómo doy un descuento de una
--  sola vez?"
--
-- Se pone el precio en el renglón y se dice por qué. Lo que se cobró va
-- en precio_centavos como siempre (regla 3.5: el precio se COPIA al
-- documento); aquí se guarda además lo que decía la lista ese día, para
-- que el ticket y las estadísticas puedan decir "salió a $12, de lista
-- $20, autorizó Lupe". Sin lista guardada, mañana nadie sabe si $12 era
-- un descuento o el precio de entonces.

ALTER TABLE venta_lineas ADD COLUMN precio_lista_centavos INTEGER;
ALTER TABLE venta_lineas ADD COLUMN motivo_precio         TEXT;
ALTER TABLE venta_lineas ADD COLUMN precio_autorizado_por TEXT REFERENCES usuarios(id);
