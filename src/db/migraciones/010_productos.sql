-- ============================================================
-- 010_productos.sql  (v0.10)
--
-- EL CATÁLOGO: categorías y productos.
--
-- Hasta ahora el punto de venta solo sabía vender hielo, y las fracciones
-- estaban escritas en el código. Pero en el mostrador también se venden
-- refrescos, garrafones y botellas, y eso cambia con la temporada.
--
-- Así que el catálogo se vuelve datos: se dan de alta desde la pantalla de
-- configuración, sin tocar el programa.
--
-- DOS CLASES DE PRODUCTO
--
--   'hielo'   La cantidad son DIECISEISAVOS y el precio NO vive aquí: sale
--             de la lista de precios por fracción (regla 7.2), donde cada
--             pedazo tiene el suyo. Si el precio del 1/8 se guardara también
--             aquí, un día los dos números dirían cosas distintas.
--
--   'simple'  Un refresco, un garrafón, una bolsa. Tiene su propio precio y
--             no descuenta hielo del cuarto frío.
--
-- EL CÓDIGO es lo que hace rápida la caja: el cajero con práctica no busca
-- el botón del octavo, teclea 18, da enter y ya está en el ticket.
-- ============================================================

CREATE TABLE categorias (
  id          TEXT PRIMARY KEY,
  nombre      TEXT NOT NULL,
  color       TEXT,                        -- "#29abe2", para el botón
  orden       INTEGER NOT NULL DEFAULT 0,
  activo      INTEGER NOT NULL DEFAULT 1,
  fecha_alta  TEXT NOT NULL,
  fecha_baja  TEXT,
  creado_por  TEXT REFERENCES usuarios(id)
);

-- Dos categorías activas no pueden llamarse igual; una dada de baja sí puede
-- repetir el nombre de una viva (regla 3.4: nada se borra).
CREATE UNIQUE INDEX idx_categorias_nombre ON categorias(nombre) WHERE activo = 1;

CREATE TABLE productos (
  id             TEXT PRIMARY KEY,
  codigo         TEXT,                     -- lo que se teclea: "18", "1", "GAR20"
  nombre         TEXT NOT NULL,
  categoria_id   TEXT REFERENCES categorias(id),
  tipo           TEXT NOT NULL DEFAULT 'simple'
                   CHECK (tipo IN ('hielo','simple')),

  -- Solo para 'hielo': cuántos dieciseisavos entrega este botón.
  dieciseisavos  INTEGER,
  -- Solo para 'simple': cuánto cuesta.
  precio_centavos INTEGER,

  color          TEXT,
  orden          INTEGER NOT NULL DEFAULT 0,
  activo         INTEGER NOT NULL DEFAULT 1,
  fecha_alta     TEXT NOT NULL,
  fecha_baja     TEXT,
  creado_por     TEXT REFERENCES usuarios(id),

  -- Un producto de hielo sin cantidad, o uno simple sin precio, no se
  -- podría cobrar. Se prohíbe desde la base: es más barato que descubrirlo
  -- con un cliente enfrente.
  CHECK (
    (tipo = 'hielo'  AND dieciseisavos IS NOT NULL AND dieciseisavos > 0) OR
    (tipo = 'simple' AND precio_centavos IS NOT NULL AND precio_centavos >= 0)
  )
);

CREATE UNIQUE INDEX idx_productos_codigo ON productos(codigo)
  WHERE activo = 1 AND codigo IS NOT NULL;
CREATE INDEX idx_productos_categoria ON productos(categoria_id, orden);

-- Qué botón se tocó. Se guarda por si mañana se quiere saber qué se vende
-- más; el precio y el nombre siguen COPIADOS en la línea (regla 3.5), así
-- que borrar un producto no cambia un ticket viejo.
ALTER TABLE venta_lineas ADD COLUMN producto_id TEXT REFERENCES productos(id);

-- ------------------------------------------------------------
-- El catálogo con el que arranca la fábrica: el hielo.
-- Los códigos son la fracción sin la diagonal, que es como se dicta.
-- ------------------------------------------------------------
INSERT INTO categorias (id, nombre, color, orden, activo, fecha_alta)
VALUES ('cat-hielo', 'Hielo', '#29abe2', 1, 1, datetime('now'));

INSERT INTO productos (id, codigo, nombre, categoria_id, tipo, dieciseisavos, orden, activo, fecha_alta) VALUES
  ('prod-1',    '1',   'Marqueta', 'cat-hielo', 'hielo', 16, 1, 1, datetime('now')),
  ('prod-1-2',  '12',  '1/2',      'cat-hielo', 'hielo',  8, 2, 1, datetime('now')),
  ('prod-1-4',  '14',  '1/4',      'cat-hielo', 'hielo',  4, 3, 1, datetime('now')),
  ('prod-1-8',  '18',  '1/8',      'cat-hielo', 'hielo',  2, 4, 1, datetime('now')),
  ('prod-1-16', '116', '1/16',     'cat-hielo', 'hielo',  1, 5, 1, datetime('now'));

-- Dónde se imprime y cómo. El ticket de hielo se imprime a cientos: cada
-- renglón de más son metros de papel al mes.
INSERT INTO configuracion (clave, valor, descripcion, actualizado_en) VALUES
  ('ticket_ancho_mm',  '80', 'Ancho del papel de la impresora térmica', datetime('now')),
  ('ticket_pie',       '',   'Renglón libre al pie del ticket (teléfono, dirección...)', datetime('now')),
  ('ticket_copias',    '1',  'Cuántos tickets se imprimen por venta', datetime('now'));
