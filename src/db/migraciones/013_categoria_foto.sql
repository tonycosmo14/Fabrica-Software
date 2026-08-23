-- ============================================================
-- 013_categoria_foto.sql  (v1.4)
--
-- Una imagen en la categoría, igual que en el producto. En la caja, el
-- cajero busca por color y por dibujo antes que por texto: con la imagen
-- puesta, la mano llega sola.
-- ============================================================

ALTER TABLE categorias ADD COLUMN foto TEXT;
