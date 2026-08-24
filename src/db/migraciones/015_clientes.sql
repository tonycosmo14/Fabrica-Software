-- ============================================================
-- 015_clientes.sql  (v1.6)
--
-- CLIENTES Y CRÉDITO.
--
-- Regla del negocio: se le fía SOLO a clientes registrados. Al público en
-- general no. Por eso el cliente es una ficha que existe ANTES de la venta:
-- si no está dado de alta, no hay crédito que valga.
--
-- NO HAY COLUMNA DE SALDO (regla 3.2). El saldo se calcula cada vez:
--
--     lo que se llevó a crédito − lo que ha abonado = DEBE
--
-- Un saldo guardado se desincroniza el día que se cancele un ticket viejo o
-- se anule un abono, y entonces el número que ve el cliente y el que ve la
-- fábrica dejan de coincidir. Una suma no puede desincronizarse.
--
-- El límite y el plazo van aquí porque son de cada cliente, pero NINGUNO
-- BLOQUEA: pasarse del límite pide el PIN de un responsable, y el plazo
-- solo sirve para marcar lo vencido. Al de la ferretería que lleva veinte
-- años comprando no se le para la venta por un número.
-- ============================================================

CREATE TABLE clientes (
  id             TEXT PRIMARY KEY,
  nombre         TEXT NOT NULL,               -- editable (regla 3.3)
  negocio        TEXT,                        -- "Abarrotes Doña Mary"
  telefono       TEXT,
  direccion      TEXT,
  notas          TEXT,

  -- Vacío = sin límite. En centavos, como todo el dinero del sistema.
  limite_centavos INTEGER,
  -- Días para pagar cada ticket. Vacío = sin plazo definido.
  dias_plazo     INTEGER,

  activo         INTEGER NOT NULL DEFAULT 1,  -- regla 3.4: nada se borra
  fecha_alta     TEXT NOT NULL,
  fecha_baja     TEXT,
  creado_por     TEXT REFERENCES usuarios(id)
);

CREATE INDEX idx_clientes_nombre ON clientes(nombre);
CREATE INDEX idx_clientes_activo ON clientes(activo);

-- A qué cliente se le fió esta venta. NULL es la inmensa mayoría: el
-- público que paga y se va.
ALTER TABLE ventas ADD COLUMN cliente_id TEXT REFERENCES clientes(id);
CREATE INDEX idx_ventas_cliente ON ventas(cliente_id);

-- Quién autorizó pasarse del límite, si hizo falta. Se guarda en la venta
-- porque es de esa venta: al mes nadie se acuerda de quién dijo que sí.
ALTER TABLE ventas ADD COLUMN credito_autorizado_por TEXT REFERENCES usuarios(id);

-- ============================================================
-- LOS ABONOS
--
-- Lo que el cliente va pagando de lo que debe. No se aplican a un ticket
-- concreto a propósito: el cliente llega y deja $500 "a cuenta", no dice
-- "esto es del ticket 412". La cuenta es una sola.
--
-- Un abono EN EFECTIVO también deja su movimiento en el cajón, porque el
-- billete sí llegó ahí y el corte tiene que cuadrar. Ese enlace se guarda
-- para poder anular las dos cosas juntas.
-- ============================================================

CREATE TABLE abonos (
  id             TEXT PRIMARY KEY,
  cliente_id     TEXT NOT NULL REFERENCES clientes(id),
  fecha          TEXT NOT NULL,
  centavos       INTEGER NOT NULL,            -- siempre positivo
  forma_pago     TEXT NOT NULL DEFAULT 'efectivo',
  notas          TEXT,

  caja_id        TEXT REFERENCES cajas(id),          -- en qué turno se recibió
  movimiento_id  TEXT REFERENCES movimientos_caja(id), -- su renglón en el cajón

  ejecutor_id    TEXT REFERENCES usuarios(id),   -- quién recibió el dinero
  capturista_id  TEXT REFERENCES usuarios(id),   -- quién lo anotó (regla 3.6)

  anulado_en     TEXT,
  anulado_por    TEXT REFERENCES usuarios(id),
  motivo_anulacion TEXT
);

CREATE INDEX idx_abonos_cliente ON abonos(cliente_id, fecha);
CREATE INDEX idx_abonos_caja ON abonos(caja_id);
