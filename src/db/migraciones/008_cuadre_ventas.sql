-- ============================================================
-- 008_cuadre_ventas.sql  (v0.8)
--
-- Ahora que existe el punto de venta, el cuadre del cuarto frío se puede
-- partir en dos, que es de lo que se trataba todo:
--
--     salidas   = existencia anterior + producido − contado
--     vendido   = lo que dicen los tickets de esa misma ventana
--     faltante  = salidas − vendido
--
-- El FALTANTE es lo que se derritió, lo que se cayó... y lo que se fue sin
-- pagar. Antes ese número no existía; iba escondido dentro de "salidas".
--
-- Se guarda congelado dentro del conteo (regla 3.2): si mañana se cancela
-- una venta vieja, el corte que ya se firmó no cambia solo.
-- ============================================================

ALTER TABLE conteos ADD COLUMN vendido INTEGER NOT NULL DEFAULT 0;
