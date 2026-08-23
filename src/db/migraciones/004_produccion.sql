-- ============================================================
-- 004_produccion.sql  (v0.3)
-- El trabajo diario: sacar y rellenar canastas.
--
-- REGLA DE ORO 3.2 — Todo es un movimiento inmutable.
-- Aquí NO hay ninguna columna "estado" que se edite. El estado de una
-- canasta (congelando / lista / fuera) se DEDUCE de sus eventos:
--   último evento = rellenado  ->  congelando, y al cumplir horas, lista
--   último evento = sacada     ->  fuera (sacada pero sin rellenar)
-- Un evento registrado no se edita ni se borra jamás; si algo salió mal,
-- se registra el evento que lo corrige.
--
-- SECCIÓN 6.3 — Sacar y rellenar son DOS EVENTOS SEPARADOS.
-- Normalmente ocurren seguidos, pero cuando hay mucha demanda las canastas
-- se sacan y se dejan a un lado para rellenarlas después. Acoplarlos haría
-- imposible detectar esas canastas.
--
-- SECCIÓN 4 — El turno de producción es una línea de tiempo propia, que no
-- tiene nada que ver con la sesión de caja ni con la jornada de reparto.
-- ============================================================

CREATE TABLE turnos_produccion (
  id          TEXT PRIMARY KEY,
  nombre      TEXT,                                -- "noche", "matutino"...
  abierto_en  TEXT NOT NULL,
  abierto_por TEXT REFERENCES usuarios(id),
  cerrado_en  TEXT,
  cerrado_por TEXT REFERENCES usuarios(id),
  notas       TEXT
);

CREATE INDEX idx_turnos_abiertos ON turnos_produccion(cerrado_en);

-- RELLENADO: arranca el reloj de congelación.
CREATE TABLE rellenados (
  id            TEXT PRIMARY KEY,
  canasta_id    TEXT NOT NULL REFERENCES canastas(id),
  turno_id      TEXT REFERENCES turnos_produccion(id),
  fecha         TEXT NOT NULL,
  ejecutor_id   TEXT REFERENCES usuarios(id),      -- quién lo hizo
  capturista_id TEXT REFERENCES usuarios(id),      -- quién lo capturó
  tipo_agua     TEXT NOT NULL CHECK (tipo_agua IN ('purificada','potable')),
  notas         TEXT
);

CREATE INDEX idx_rellenados_canasta ON rellenados(canasta_id, fecha);

-- SACADA: nace el hielo. Se liga al rellenado del que viene, para poder
-- calcular cuánto tiempo estuvo congelando de verdad (sección 6.8).
CREATE TABLE sacadas (
  id                TEXT PRIMARY KEY,
  canasta_id        TEXT NOT NULL REFERENCES canastas(id),
  turno_id          TEXT REFERENCES turnos_produccion(id),
  fecha             TEXT NOT NULL,
  ejecutor_id       TEXT REFERENCES usuarios(id),
  capturista_id     TEXT REFERENCES usuarios(id),
  rellenado_id      TEXT REFERENCES rellenados(id),
  horas_congelacion REAL,                          -- horas reales, calculadas
  notas             TEXT
);

CREATE INDEX idx_sacadas_canasta ON sacadas(canasta_id, fecha);
CREATE INDEX idx_sacadas_turno   ON sacadas(turno_id);

-- Resultado molde por molde. Una fila por molde de la canasta.
-- Sin esto no se puede detectar que un molde concreto falla siempre.
CREATE TABLE sacadas_moldes (
  id         TEXT PRIMARY KEY,
  sacada_id  TEXT NOT NULL REFERENCES sacadas(id),
  molde_id   TEXT NOT NULL REFERENCES moldes(id),
  resultado  TEXT NOT NULL CHECK (resultado IN ('ok','merma','hueco'))
);

CREATE INDEX idx_sacadas_moldes_sacada ON sacadas_moldes(sacada_id);
CREATE INDEX idx_sacadas_moldes_molde  ON sacadas_moldes(molde_id);
