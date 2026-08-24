-- ============================================================
-- 014_avisos.sql  (v1.5)
--
-- Cuándo avisar de que queda poco hielo.
--
-- Se guarda en MARQUETAS porque así lo piensa quien lo configura, pero al
-- comparar se convierte a dieciseisavos como todo lo demás (regla 3.1).
--
-- OJO CON ESTE AVISO. El hielo que el sistema cree que hay sale de lo que
-- se ha capturado, y en la fábrica los obreros reportan lo que sacaron
-- hasta como las 3 de la tarde. Así que puede decir "queda poco" cuando en
-- el cuarto frío todavía hay: simplemente nadie ha anotado la producción.
--
-- Por eso este aviso NUNCA bloquea una venta. Solo avisa, y dice de dónde
-- salió el número.
-- ============================================================

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en) VALUES
  ('hielo_minimo_marquetas', '10',
   'Avisar en la caja cuando queden menos marquetas que esto, según lo capturado',
   datetime('now'));
