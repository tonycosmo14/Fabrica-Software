-- ============================================================
-- 009_caja.sql  (v0.9)
--
-- LA CAJA: el espejo en dinero del cuadre en hielo.
--
-- El cuarto frío se cuadra contando marquetas. La caja se cuadra contando
-- billetes, y la cuenta tiene exactamente la misma forma:
--
--     fondo + cobrado en efectivo + entradas − salidas = DEBERÍA HABER
--     deberia haber − contado = DIFERENCIA
--
-- Si sobra, alguien no dio un cambio. Si falta, alguien se equivocó o se
-- llevó dinero. Igual que con el hielo: el número existe, y por eso se ve.
--
-- REGLA 3.2: aquí no hay columna "saldo" que se vaya sumando. El dinero que
-- hay en la caja se CALCULA de los movimientos cada vez que se pregunta. Un
-- saldo guardado se desincroniza el día que algo falle a la mitad; una suma
-- de movimientos, no.
--
-- REGLA 3.4: un corte cerrado guarda sus números congelados. Cancelar
-- mañana una venta de ayer no cambia un corte que ya se firmó.
--
-- El dinero va en CENTAVOS enteros, como en las ventas.
-- ============================================================

CREATE TABLE cajas (
  id                TEXT PRIMARY KEY,
  folio             INTEGER NOT NULL UNIQUE,   -- consecutivo, como los tickets
  cajero_id         TEXT REFERENCES usuarios(id),   -- de quién es el turno
  abierta_por       TEXT REFERENCES usuarios(id),   -- quién la capturó
  abierta_en        TEXT NOT NULL,
  fondo_centavos    INTEGER NOT NULL DEFAULT 0,     -- con cuánto arrancó
  notas_apertura    TEXT,

  -- Todo esto se llena al cerrar, y ya no se vuelve a tocar.
  cerrada_en        TEXT,
  cerrada_por       TEXT REFERENCES usuarios(id),
  contado_centavos  INTEGER,                        -- lo que se contó físicamente
  esperado_centavos INTEGER,                        -- lo que debía haber (congelado)
  diferencia_centavos INTEGER,                      -- contado − esperado
  vendido_centavos  INTEGER,                        -- congelado
  entradas_centavos INTEGER,                        -- congelado
  salidas_centavos  INTEGER,                        -- congelado
  notas_cierre      TEXT
);

CREATE INDEX idx_cajas_abierta ON cajas(cerrada_en, abierta_en);

-- Movimientos de dinero que NO son ventas: gastos, retiros al fondo fijo,
-- cambio que se trae de afuera. Las ventas no se copian aquí; se leen de la
-- tabla de ventas, que es donde viven (una sola verdad).
CREATE TABLE movimientos_caja (
  id            TEXT PRIMARY KEY,
  caja_id       TEXT NOT NULL REFERENCES cajas(id),
  fecha         TEXT NOT NULL,
  tipo          TEXT NOT NULL CHECK (tipo IN ('entrada','salida')),
  concepto      TEXT NOT NULL,              -- "Gasolina", "Retiro a la caja fuerte"
  centavos      INTEGER NOT NULL,           -- siempre positivo; el tipo dice si suma o resta
  ejecutor_id   TEXT REFERENCES usuarios(id),   -- quién se llevó o trajo el dinero
  capturista_id TEXT REFERENCES usuarios(id),   -- quién lo anotó
  notas         TEXT,

  anulado_en    TEXT,
  anulado_por   TEXT REFERENCES usuarios(id),
  motivo_anulacion TEXT
);

CREATE INDEX idx_mov_caja ON movimientos_caja(caja_id, fecha);

-- Cada venta queda amarrada al turno de caja en el que se cobró.
-- Las ventas viejas (de la v0.8, antes de que existiera la caja) se quedan
-- en NULL: no pertenecen a ningún turno y no entran en ningún corte.
ALTER TABLE ventas ADD COLUMN caja_id TEXT REFERENCES cajas(id);

CREATE INDEX idx_ventas_caja ON ventas(caja_id);
