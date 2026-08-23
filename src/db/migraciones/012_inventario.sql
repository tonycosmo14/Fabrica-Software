-- ============================================================
-- 012_inventario.sql  (v0.13)
--
-- INVENTARIO DE LO QUE NO ES HIELO.
--
-- El hielo ya tiene su control: la EXISTENCIA, que se cuenta dos veces al
-- día porque se derrite y es el 80% del negocio.
--
-- Los refrescos, los garrafones y las botellas son otra cosa: no se
-- derriten, y lo que hace falta saber de ellos es "¿qué hay que pedir?".
-- Eso se revisa cuando toca, no dos veces al día. Por eso vive aquí y no
-- en la existencia: son dos preguntas distintas con dos ritmos distintos.
--
-- La cuenta es la misma que la del hielo, para que quien entendió una
-- entienda la otra:
--
--     lo que había + lo que entró − lo vendido = DEBERÍA HABER
--     debería haber − contado = FALTA
--
-- REGLA 3.2: no hay columna "existencia" que se vaya sumando. Lo que hay se
-- CALCULA de los movimientos. Un número guardado se desincroniza el día que
-- algo falle a la mitad; una suma de movimientos, no puede.
-- ============================================================

-- El costo y el aviso de "ya hay que pedir" viven con el producto.
ALTER TABLE productos ADD COLUMN costo_centavos INTEGER;
ALTER TABLE productos ADD COLUMN minimo         INTEGER;   -- avisar por debajo de esto
ALTER TABLE productos ADD COLUMN lleva_inventario INTEGER NOT NULL DEFAULT 0;
ALTER TABLE productos ADD COLUMN foto           TEXT;      -- nombre del archivo en datos/fotos

-- Cada entrada, salida o conteo. Nada se borra: se anula (regla 3.4).
CREATE TABLE movimientos_inventario (
  id            TEXT PRIMARY KEY,
  producto_id   TEXT NOT NULL REFERENCES productos(id),
  fecha         TEXT NOT NULL,
  tipo          TEXT NOT NULL
                  CHECK (tipo IN ('entrada','salida','conteo')),
  -- entrada/salida: cuántas piezas. conteo: cuántas se contaron.
  cantidad      INTEGER NOT NULL,
  -- Solo en las entradas: a cómo se compró cada pieza, para saber la
  -- ganancia sin adivinar. Se COPIA aquí (regla 3.5): si mañana sube el
  -- proveedor, lo que costó la compra de hoy no cambia.
  costo_centavos INTEGER,
  concepto      TEXT,
  ejecutor_id   TEXT REFERENCES usuarios(id),
  capturista_id TEXT REFERENCES usuarios(id),

  anulado_en    TEXT,
  anulado_por   TEXT REFERENCES usuarios(id),
  motivo_anulacion TEXT
);

CREATE INDEX idx_mov_inv_producto ON movimientos_inventario(producto_id, fecha);

-- Los productos que ya existen no llevan inventario hasta que se diga: no
-- tendría sentido que el hielo, que se mide en marquetas, apareciera aquí.
UPDATE productos SET lleva_inventario = 0;

-- CUÁNTAS PIEZAS lleva la línea.
--
-- Hasta ahora no hacía falta: al hielo lo cuentan los dieciseisavos, y los
-- demás productos solo tenían que sumar bien al total. Pero para descontar
-- del inventario sí hace falta, porque una línea de "2 x Coca" son dos
-- refrescos y no uno.
--
-- Las líneas viejas quedan en 1, que es lo que casi siempre fueron; las que
-- no, ya se contaron en el conteo que se haga al empezar a usar esto.
ALTER TABLE venta_lineas ADD COLUMN cantidad INTEGER NOT NULL DEFAULT 1;
