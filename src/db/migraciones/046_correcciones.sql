-- ============================================================
-- 046 · LO QUE SE CORRIGE DESPUÉS DEL CORTE  (v6.1)
-- ============================================================
--
-- "Cerré un corte y faltaba una venta, y una sacada estaba mal marcada.
--  El sistema no me dejaba corregir nada. El administrador debería
--  tener el poder de corregir cualquier cosa."
--
-- Tres cosas se pueden corregir ahora, y las tres dejan rastro:
--
--   · UNA VENTA QUE FALTÓ en un corte ya cerrado: se cobra normal, pero
--     amarrada a ese turno y con la fecha de ese turno. Lleva marca de
--     que entró después del corte y el porqué.
--   · CÓMO SALIÓ UNA SACADA: se cambia el estado de sus moldes (hueca
--     que era ahogada). La sacada guarda cuándo, quién y por qué.
--   · EL CUADRE DE HIELO de un conteo ya hecho: sus números congelados
--     se vuelven a sacar de los registros, y lo que decía antes se
--     guarda para poder enseñar las dos cifras.

ALTER TABLE ventas ADD COLUMN tras_corte        INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ventas ADD COLUMN motivo_correccion TEXT;

ALTER TABLE sacadas_pano ADD COLUMN corregida_en      TEXT;
ALTER TABLE sacadas_pano ADD COLUMN corregida_por     TEXT REFERENCES usuarios(id);
ALTER TABLE sacadas_pano ADD COLUMN motivo_correccion TEXT;
ALTER TABLE sacadas_pano ADD COLUMN correcciones      INTEGER NOT NULL DEFAULT 0;

-- `original` guarda, en JSON y solo la primera vez, los números con los
-- que se firmó el corte: producido, vendido, merma, cortado, guardado,
-- recogido y salidas.
ALTER TABLE conteos ADD COLUMN original          TEXT;
ALTER TABLE conteos ADD COLUMN corregido_en      TEXT;
ALTER TABLE conteos ADD COLUMN corregido_por     TEXT REFERENCES usuarios(id);
ALTER TABLE conteos ADD COLUMN motivo_correccion TEXT;
ALTER TABLE conteos ADD COLUMN correcciones      INTEGER NOT NULL DEFAULT 0;
