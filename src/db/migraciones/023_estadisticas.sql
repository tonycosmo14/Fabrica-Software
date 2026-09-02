-- ============================================================
-- 023 — LOS ÍNDICES DE LAS ESTADÍSTICAS  (v2.9)
--
-- Cero tablas nuevas: una estadística es una pregunta que se le hace a
-- los movimientos, no un dato que se guarda (regla 3.2). Lo único que
-- hace falta es que preguntar sea rápido dentro de tres años, cuando
-- haya medio millón de renglones en vez de unos miles.
--
-- Todos son índices por FECHA, porque toda esta pantalla es "lo que pasó
-- entre estos dos días". Sin ellos, cada número obliga a leer la tabla
-- entera: hoy no se nota y en tres años la pantalla tarda medio minuto.
-- ============================================================

-- LA PRODUCCIÓN POR FECHA. El más importante de todos.
-- Contar marquetas de un mes cruza tres tablas, y sin este índice hay
-- que leer TODOS los moldes de la historia para quedarse con los del
-- mes. Con cuarenta moldes al día son 15,000 al año.
CREATE INDEX idx_sacadas_fecha ON sacadas(fecha);

-- LOS GASTOS Y LAS ENTRADAS POR FECHA. Los índices que había empiezan
-- por caja_id o por concepto_id, que sirven para el corte del turno pero
-- no para "todo lo del mes".
CREATE INDEX idx_mov_caja_fecha ON movimientos_caja(fecha);

-- LA COBRANZA POR FECHA. Igual: el que había empieza por cliente_id.
CREATE INDEX idx_abonos_fecha ON abonos(fecha);

-- LAS VENTAS VIVAS. Índice PARCIAL: las canceladas nunca se suman, así
-- que dejarlas fuera hace el índice más chico y más rápido de recorrer.
CREATE INDEX idx_ventas_vivas ON ventas(fecha) WHERE cancelada_en IS NULL;
