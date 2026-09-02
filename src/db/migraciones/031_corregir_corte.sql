-- ============================================================
-- 031_corregir_corte.sql  (v3.9)
--
-- CORREGIR UN CORTE YA FIRMADO.
--
-- EL CASO, tal como pasa: a la cajera se le olvidó anotar un gasto. Cerró
-- su turno, el cajón salió $200 corto y ahí quedó, como si faltara
-- dinero. Al día siguiente llega con el ticket de la gasolina en la mano y
-- demuestra que sí se gastó. Hasta hoy no había nada que hacer: un corte
-- cerrado no se toca, y el faltante se quedaba escrito para siempre.
--
-- Ahora el administrador —solo él— puede agregarle ese gasto o quitarle
-- uno, y el corte se vuelve a sacar. Pero eso NO puede hacerse en
-- silencio, porque el papel que se firmó decía otra cosa:
--
--   · SE GUARDA LO QUE DECÍA ANTES. La primera vez que se corrige un
--     corte, sus números originales quedan copiados aquí. Así, mirando
--     un corte corregido, siempre se puede decir qué decía el papel y
--     qué dice ahora.
--   · SE GUARDA QUIÉN, CUÁNDO Y POR QUÉ. El motivo es obligatorio.
--   · CADA MOVIMIENTO QUE SE AGREGA DESPUÉS QUEDA MARCADO. Al reimprimir
--     el corte, esos renglones se distinguen de los que sí estaban en el
--     papel firmado.
--
-- Lo que NO se recalcula es `contado_centavos`: eso es lo que se contó
-- físicamente en el cajón y no lo cambia ningún papel que aparezca
-- después. Lo que cambia es lo que DEBÍA haber, y con ello la diferencia
-- — que es justo el número que estaba mal.
-- ============================================================

-- Lo que decía el papel firmado, la primera vez que se corrige.
ALTER TABLE cajas ADD COLUMN esperado_original_centavos   INTEGER;
ALTER TABLE cajas ADD COLUMN diferencia_original_centavos INTEGER;
ALTER TABLE cajas ADD COLUMN salidas_original_centavos    INTEGER;
ALTER TABLE cajas ADD COLUMN entradas_original_centavos   INTEGER;

-- Quién lo corrigió, cuándo y por qué.
ALTER TABLE cajas ADD COLUMN corregido_en      TEXT;
ALTER TABLE cajas ADD COLUMN corregido_por     TEXT REFERENCES usuarios(id);
ALTER TABLE cajas ADD COLUMN motivo_correccion TEXT;
-- Cuántas veces. Un corte que se corrige cinco veces es una señal.
ALTER TABLE cajas ADD COLUMN correcciones INTEGER NOT NULL DEFAULT 0;

-- El renglón que no estaba en el papel firmado.
ALTER TABLE movimientos_caja ADD COLUMN tras_corte INTEGER NOT NULL DEFAULT 0;
