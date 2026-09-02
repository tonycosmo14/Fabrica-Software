-- ============================================================
-- 024 — EL ÍNDICE QUE FALTÓ  (v2.9.1)
--
-- `sacadas_pano.iniciada_en` no tenía índice: el que había empieza por
-- `pano_id`, y para una pregunta que no nombra ningún paño no sirve. Lo
-- usa "los paños de hoy" (/produccion/hoy), que se pide en cada corte.
--
-- OJO CON LO QUE ESTE ÍNDICE **NO** ARREGLA. Se puso creyendo que
-- aceleraría "quién sacó cuántos paños este mes", y no lo hizo: con tres
-- tablas encadenadas SQLite seguía entrando por los moldes y leyéndolos
-- todos (medido con EXPLAIN QUERY PLAN). Eso se arregló en la consulta,
-- no aquí: filtrando por `sacadas.fecha`, que sí tiene índice desde la
-- 023 — y de paso quedó contando igual que las marquetas del mes, que
-- antes se contaban por otra fecha.
-- ============================================================

CREATE INDEX idx_sacadas_pano_iniciada ON sacadas_pano(iniciada_en);
