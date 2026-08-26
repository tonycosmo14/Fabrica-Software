-- ============================================================
-- GASTOS RECURRENTES  (v2.5)
--
-- "Creo el gasto recurrente que se llama desayuno, es todos los días,
--  nunca es igual, a veces $50 a veces $100, y al final del mes quiero ver
--  cuánto gasté en desayunos."
--
-- Hasta ahora el concepto de un gasto era texto libre. Eso está bien para
-- que el cajero escriba lo que pasó, y está MAL para sumar el mes: entre
-- "Desayuno", "desayunos", "Desayuno muchachos" y "DESAYUNO" hay cuatro
-- conceptos distintos y una estadística inservible. Nadie escribe igual
-- dos veces.
--
-- Así que los que se repiten se dan de alta una vez y se tocan. El texto
-- se sigue copiando al movimiento (regla 3.5: el papel dice lo que decía
-- ese día aunque después se renombre), pero además queda el ID, que es
-- estable (regla 3.3) y es por donde suma la estadística.
--
-- Los de siempre siguen pudiendo escribirse a mano: un gasto raro no tiene
-- por qué obligar a dar de alta un concepto que no se va a repetir.
-- ============================================================

CREATE TABLE conceptos_gasto (
  id          TEXT PRIMARY KEY,
  nombre      TEXT NOT NULL,
  -- Casi todos son salidas, pero hay entradas que también se repiten:
  -- "cambio del banco" es de todos los días.
  tipo        TEXT NOT NULL DEFAULT 'salida' CHECK (tipo IN ('salida', 'entrada')),
  -- En qué orden salen los botones en la caja. El cajero aprende dónde
  -- está cada uno con la mano, y que se muevan solos sería un error.
  orden       INTEGER NOT NULL DEFAULT 0,
  color       TEXT,
  -- Una nota para el cajero: "el de los muchachos, no el del patrón".
  ayuda       TEXT,

  activo      INTEGER NOT NULL DEFAULT 1,
  fecha_alta  TEXT NOT NULL,
  fecha_baja  TEXT
);

CREATE UNIQUE INDEX idx_concepto_nombre
  ON conceptos_gasto(lower(nombre)) WHERE activo = 1;

-- El movimiento apunta al concepto, pero SIGUE guardando su texto copiado.
-- Si mañana "Desayuno" se renombra a "Comida de los muchachos", el
-- comprobante que se firmó ayer no cambia, y la suma del mes sí junta los
-- dos porque va por el id.
ALTER TABLE movimientos_caja ADD COLUMN concepto_id TEXT REFERENCES conceptos_gasto(id);

CREATE INDEX idx_mov_concepto ON movimientos_caja(concepto_id, fecha);

-- Unos cuantos de arranque, de los que hay en cualquier fábrica. Se editan
-- y se dan de baja desde la pantalla; están aquí para que el primer día
-- haya algo que tocar y se entienda para qué sirve.
INSERT INTO conceptos_gasto (id, nombre, tipo, orden, ayuda, fecha_alta) VALUES
  ('gasto-desayuno',  'Desayuno',        'salida',  1, 'La comida de los muchachos', datetime('now')),
  ('gasto-gasolina',  'Gasolina',        'salida',  2, 'De la camioneta del reparto', datetime('now')),
  ('gasto-retiro',    'Retiro a la caja fuerte', 'salida', 3, 'Cuando ya hay mucho efectivo junto', datetime('now')),
  ('gasto-mantto',    'Mantenimiento',   'salida',  4, 'Refacciones, un plomero, un electricista', datetime('now')),
  ('entrada-banco',   'Cambio del banco','entrada', 5, 'Los billetes chicos de media tarde', datetime('now'));
