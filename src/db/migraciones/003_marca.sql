-- ============================================================
-- 003_marca.sql  (v0.2.1)
-- El nombre del negocio de arranque pasa a ser el de la marca.
-- Solo se cambia si nadie lo ha tocado todavía: si el usuario ya
-- puso el suyo desde Personalizar, se respeta.
-- ============================================================

UPDATE configuracion
   SET valor = 'Hielo LOLHA'
 WHERE clave = 'nombre_negocio'
   AND valor = 'Fábrica de Hielo';
