-- ============================================================
-- 016_mayoreo.sql  (v1.9)
--
-- PRECIOS DE MAYOREO POR CLIENTE.
--
-- Regla del negocio, dicha por Tony: "algunos clientes gozan de mayoreo, a
-- partir de 1/2 marqueta". Y el mayoreo no es un descuento por cliente: es
-- una LISTA con su propio nombre y sus propios precios por fracción —
-- "Mayoreo 1", donde la marqueta vale $240 en vez de $264—. Varios clientes
-- comparten la misma lista, y subirle el precio a la lista se lo sube a
-- todos de una vez.
--
-- Esa estructura ya existía desde la v0.8: listas_precios tiene tipo
-- 'publico' o 'mayoreo', y precios cuelga de la lista. Lo único que faltaba
-- era decir QUÉ LISTA le toca a cada cliente.
--
-- DOS COSAS QUE NO CAMBIAN:
--
--  · El precio se sigue COPIANDO dentro de la venta (regla 3.5). Subirle
--    mañana el precio al mayoreo no toca los tickets de ayer.
--  · Cada fracción sigue teniendo su propio precio (7.2). El mayoreo no es
--    un porcentaje sobre el público: es su propia lista, porque en la
--    práctica el descuento no es parejo entre la marqueta y el 1/16.
-- ============================================================

-- Vacío = paga precio de público, que es la inmensa mayoría.
ALTER TABLE clientes ADD COLUMN lista_id TEXT REFERENCES listas_precios(id);

CREATE INDEX idx_clientes_lista ON clientes(lista_id);

-- Desde cuánto hielo aplica el mayoreo. 8 dieciseisavos = media marqueta.
--
-- Se mide sobre el HIELO DE TODO EL TICKET, no renglón por renglón: en la
-- caja el hielo se acumula en una sola línea, y el cliente que pide "5
-- marquetas" está pidiendo una cosa, no cinco.
INSERT INTO configuracion (clave, valor, descripcion, actualizado_en) VALUES
  ('mayoreo_minimo_dieciseisavos', '8',
   'Desde cuánto hielo aplica el precio de mayoreo (en dieciseisavos)',
   datetime('now'));
