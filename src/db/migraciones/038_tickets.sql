-- ============================================================
-- 038_tickets.sql  (v5.0)
--
-- EL TAMAÑO DE LA LETRA DE LOS TICKETS.
--
-- "Puedes usar el tipo de fuente más compatible. De lo que no estoy
--  seguro es del tamaño de la fuente; pues dado que no estoy seguro
--  déjamelo en configuraciones para que yo lo modifique: si el real lo veo
--  muy pequeño lo agrando."
--
-- Exacto, y no se puede saber desde aquí: depende de la impresora, del
-- papel y de la vista de quien lo lee. Así que se configura.
--
-- POR QUÉ SON TRES PASOS Y NO UN NÚMERO DE PUNTOS
--
-- Porque una impresora térmica no tiene tamaños libres. Tiene DOS letras
-- grabadas de fábrica —la A, de 12 puntos de ancho, y la B, de 9— y un
-- multiplicador de 1 a 8 que agranda lo que ya hay. No existe un "13.5" y
-- ofrecerlo sería mentir.
--
--   chica   fuente B. 64 columnas en papel de 80 mm: cabe más y se gasta
--           menos papel, pero la letra es más apretada.
--   normal  fuente A. 48 columnas. Lo de siempre.
--   grande  fuente A con el ALTO al doble. Siguen siendo 48 columnas —o
--           sea que ningún renglón se desacomoda— y las letras miden el
--           doble de altas. Cuesta el doble de papel.
--
-- Solo se dobla el alto, no el ancho: doblando el ancho quedarían 24
-- columnas y ahí ya no cabe "Retiro a la caja fuerte ... $2,000" en un
-- renglón. El diseño entero se vendría abajo por un ajuste.
-- ============================================================

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'ticket_tamano', 'normal',
       'Tamaño de la letra de los tickets: chica, normal o grande',
       datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'ticket_tamano');
