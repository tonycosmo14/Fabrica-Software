-- ============================================================
-- MAYOREO RÁPIDO, NÚMERO DE CLIENTE Y MERMAS DEL CUARTO FRÍO
-- v2.0
-- ============================================================
--
-- Tres cosas que salen de cómo se trabaja de verdad en el mostrador.
--
-- 1. EL MAYOREO SE TECLEA, NO SE BUSCA. En el software anterior Tony tenía
--    dos productos —"1m" y "12m"— y con teclearlos ya salía el precio de
--    mayoreo. Eso es un toque; buscar al cliente en una lista antes de
--    capturar son diez. Se conservan las listas de precios (cada cliente
--    puede tener la suya), pero la ENTRADA es el código.
--
-- 2. EL CLIENTE TIENE NÚMERO. Para poder decir "el 7" y enter en vez de
--    escribir "Pescadería Chuc". El número se asigna solo y no se repite.
--
-- 3. LO QUE SE DERRITE SE ANOTA. Hasta hoy el hielo que no salió por un
--    ticket aparecía como "faltante" a secas, mezclando lo derretido con lo
--    que se fue sin pagar. Son dos cosas muy distintas: una es física y la
--    otra es un problema.

-- ------------------------------------------------------------
-- 1. Productos que se cobran a precio de mayoreo
-- ------------------------------------------------------------
-- Un producto con mayoreo = 1 NO tiene precio propio: su precio sale de la
-- lista de mayoreo del cliente, y mientras no se sepa quién es, de la lista
-- de mayoreo activa. Por eso un ticket que lleve uno de estos no se puede
-- cobrar sin decir de quién es.
ALTER TABLE productos ADD COLUMN mayoreo INTEGER NOT NULL DEFAULT 0;

INSERT INTO productos (id, codigo, nombre, categoria_id, tipo, dieciseisavos,
                       mayoreo, orden, activo, fecha_alta) VALUES
  ('prod-may-1',   '1M',  'Marqueta mayoreo', 'cat-hielo', 'hielo', 16, 1, 6, 1, datetime('now')),
  ('prod-may-1-2', '12M', '1/2 mayoreo',      'cat-hielo', 'hielo',  8, 1, 7, 1, datetime('now'));

-- La lista de mayoreo que se cobra mientras no se sabe quién es el cliente.
-- `activa` ya quería decir eso mismo en la lista de público: la que está en
-- uso. Si solo hay una lista de mayoreo, esa es.
UPDATE listas_precios
   SET activa = 1
 WHERE tipo = 'mayoreo' AND activo = 1
   AND (SELECT COUNT(*) FROM listas_precios WHERE tipo = 'mayoreo' AND activo = 1) = 1;

-- ------------------------------------------------------------
-- 2. El número del cliente
-- ------------------------------------------------------------
-- Se teclea en la caja: "7" y enter. Se asigna por orden de alta y no se
-- reusa nunca, ni aunque el cliente se dé de baja: el número es del cliente,
-- como el folio es del ticket (regla 3.3).
ALTER TABLE clientes ADD COLUMN numero INTEGER;

UPDATE clientes
   SET numero = (SELECT COUNT(*) FROM clientes c2 WHERE c2.rowid <= clientes.rowid);

CREATE UNIQUE INDEX idx_clientes_numero ON clientes(numero) WHERE numero IS NOT NULL;

-- ------------------------------------------------------------
-- 3. Mermas del cuarto frío
-- ------------------------------------------------------------
-- Hielo que salió del cuarto frío sin pasar por la caja porque se derritió,
-- se rompió o se regaló. Se anota igual que un movimiento de dinero: quién
-- lo vio, quién lo capturó (regla 3.6) y cuándo.
--
-- Nada se borra (regla 3.4): un renglón mal capturado se anula y queda
-- tachado con su motivo.
CREATE TABLE mermas_hielo (
  id             TEXT PRIMARY KEY,
  fecha          TEXT NOT NULL,
  almacen_id     TEXT NOT NULL REFERENCES almacenes(id),
  dieciseisavos  INTEGER NOT NULL CHECK (dieciseisavos > 0),
  motivo         TEXT NOT NULL
                   CHECK (motivo IN ('derretida','rota','regalada','autoconsumo','otro')),
  notas          TEXT,
  ejecutor_id    TEXT REFERENCES usuarios(id),
  capturista_id  TEXT REFERENCES usuarios(id),
  anulada_en     TEXT,
  anulada_por    TEXT REFERENCES usuarios(id),
  motivo_anulacion TEXT
);

CREATE INDEX idx_mermas_fecha   ON mermas_hielo(fecha);
CREATE INDEX idx_mermas_almacen ON mermas_hielo(almacen_id, fecha);
