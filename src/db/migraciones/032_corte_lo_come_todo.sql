-- ============================================================
-- 032_corte_lo_come_todo.sql  (v4.1)
--
-- EL CORTE DE CAJA SE COME LA EXISTENCIA.
--
-- Anotar la existencia y hacer el corte de caja eran la misma cosa hecha
-- dos veces: se hacen al mismo tiempo, con la misma persona enfrente y con
-- los mismos números en la boca. Tener dos pantallas para eso solo servía
-- para que a veces se hiciera una y no la otra.
--
-- Ahora hay un solo momento —terminar el turno— y dentro van, en el orden
-- en que se cantan de verdad:
--
--     1. qué paños se sacaron
--     2. cuánto hielo queda en el cuarto frío
--     3. si se cortó hielo para bolsas, y cuánto
--     4. cuántas bolsas salieron de ese hielo
--
-- 1. LAS BOLSAS SON UN PRODUCTO DE VERDAD
--
-- Hasta hoy las bolsas se contaban y ahí se quedaban: un número suelto sin
-- dónde sumarse. Ahora la bolsa es un producto del catálogo con su propia
-- existencia, como los refrescos: cortar marquetas le SUMA bolsas, y
-- venderlas se las resta solo, con la misma cuenta que todo lo demás
-- (regla 3.2: no hay ninguna columna con "cuántas hay").
--
-- NACE SIN PRECIO Y DADA DE BAJA. Sin precio porque inventárselo sería
-- peor que no ponerlo: se vendería al precio equivocado el primer día sin
-- que nadie se diera cuenta. Y de baja porque un producto con existencia
-- en cero sale como AGOTADO en la caja, y una fábrica que todavía no corta
-- hielo tendría ese aviso puesto para siempre.
--
-- Se da de alta sola en cuanto un corte le mete las primeras bolsas: ahí
-- es cuando de verdad existe, y ahí es cuando toca ponerle su precio.
--
-- 2. EL DINERO YA NO SE CUENTA AL CERRAR
--
-- "Como los cortes son rápidos y se tiene que seguir atendiendo, no hay que
-- anotar cuánto dinero hay físicamente, sino imprimir el ticket con el
-- dinero que debería haber."
--
-- Así que el corte se cierra SIN contar: imprime lo que debía haber, el
-- cajero entrega el cajón y sigue vendiendo. Cuando el dueño o el gerente
-- llegan, anotan cuánto les entregaron de verdad, y ESA es la diferencia.
--
-- `contado_centavos` se queda como estaba —los cortes viejos lo tienen y
-- siguen valiendo—; los nuevos lo dejan vacío y llenan `entregado_centavos`
-- cuando alguien recibe el dinero. La diferencia sale de lo que haya de los
-- dos, y mientras no haya ninguno, no hay diferencia que enseñar: no se
-- sabe, y decir "cuadró exacto" cuando no se ha contado sería mentir.
-- ============================================================

-- --- 1. La bolsa de hielo gourmet ---

INSERT INTO productos (id, codigo, nombre, categoria_id, tipo, precio_centavos,
                       lleva_inventario, minimo, orden, activo, fecha_alta)
SELECT 'prod-bolsa-gourmet', 'BG', 'Bolsa de hielo gourmet', 'cat-hielo', 'simple',
       0, 1, NULL, 20, 0, datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM productos WHERE id = 'prod-bolsa-gourmet');

-- De qué producto son las bolsas de este corte, y con qué renglón de
-- inventario le entraron. Se guardan los dos: el producto porque mañana
-- puede haber más de una clase de bolsa, y el movimiento para poder
-- deshacerlo entero si el corte se anula.
ALTER TABLE cortes_hielo ADD COLUMN producto_id   TEXT REFERENCES productos(id);
ALTER TABLE cortes_hielo ADD COLUMN movimiento_id TEXT REFERENCES movimientos_inventario(id);

-- --- 2. El dinero que se entregó, anotado después ---

ALTER TABLE cajas ADD COLUMN entregado_centavos INTEGER;
ALTER TABLE cajas ADD COLUMN recibido_por  TEXT REFERENCES usuarios(id);
ALTER TABLE cajas ADD COLUMN recibido_en   TEXT;
ALTER TABLE cajas ADD COLUMN notas_entrega TEXT;

-- --- 3. El hielo y el dinero, atados al mismo turno ---
--
-- El conteo del cuarto frío y el corte de hielo se hacen DENTRO del corte
-- de caja. Guardar de cuál turno salió cada uno es lo que permite volver a
-- imprimir un corte completo, con su hielo, meses después.
ALTER TABLE conteos      ADD COLUMN caja_id TEXT REFERENCES cajas(id);
ALTER TABLE cortes_hielo ADD COLUMN caja_id TEXT REFERENCES cajas(id);

CREATE INDEX idx_conteos_caja ON conteos(caja_id);
CREATE INDEX idx_cortes_hielo_caja ON cortes_hielo(caja_id);
