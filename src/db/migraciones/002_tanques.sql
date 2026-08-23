-- ============================================================
-- 002_tanques.sql  (v0.2)
-- La jerarquia fisica de la fabrica:
--
--     Tanque  →  Paño (fila)  →  Canasta  →  Molde (= 1 marqueta)
--
-- Reglas aplicadas:
--  3.3 UUID interno estable, nombre editable ("2N" es una etiqueta)
--  3.4 Nada se borra: activo + fecha_baja
--  Error 11 del plan: NADA hardcodeado. Los tanques se crean desde
--      la interfaz, no desde el codigo.
--
-- IMPORTANTE: cada molde es una fila real con su posicion. Sin esto es
-- imposible detectar que un molde concreto falla siempre, que es el dato
-- que revela un problema fisico.
--
-- El ESTADO de una canasta (congelando / lista / fuera) NO vive aqui:
-- se deduce de los movimientos de produccion (regla 3.2). Aqui solo
-- esta la estructura fisica.
-- ============================================================

CREATE TABLE tanques (
  id                TEXT PRIMARY KEY,
  nombre            TEXT NOT NULL,              -- etiqueta editable: "2N", "T", "N"
  orden             INTEGER NOT NULL DEFAULT 0, -- para acomodarlos en pantalla
  horas_congelacion REAL NOT NULL DEFAULT 24,   -- punto de partida; el sistema
                                                -- aprende el real con el uso (6.8)
  notas             TEXT,
  activo            INTEGER NOT NULL DEFAULT 1,
  fecha_alta        TEXT NOT NULL,
  fecha_baja        TEXT,
  creado_por        TEXT REFERENCES usuarios(id)
);

CREATE TABLE panos (
  id          TEXT PRIMARY KEY,
  tanque_id   TEXT NOT NULL REFERENCES tanques(id),
  numero      INTEGER NOT NULL,                 -- posicion fisica dentro del tanque
  nombre      TEXT,                             -- opcional, si le dicen de otro modo
  activo      INTEGER NOT NULL DEFAULT 1,
  fecha_alta  TEXT NOT NULL,
  fecha_baja  TEXT
);

CREATE INDEX idx_panos_tanque ON panos(tanque_id);
CREATE UNIQUE INDEX idx_panos_numero ON panos(tanque_id, numero) WHERE activo = 1;

CREATE TABLE canastas (
  id          TEXT PRIMARY KEY,
  pano_id     TEXT NOT NULL REFERENCES panos(id),
  numero      INTEGER NOT NULL,                 -- posicion dentro del paño
  activo      INTEGER NOT NULL DEFAULT 1,
  fecha_alta  TEXT NOT NULL,
  fecha_baja  TEXT
);

CREATE INDEX idx_canastas_pano ON canastas(pano_id);
CREATE UNIQUE INDEX idx_canastas_numero ON canastas(pano_id, numero) WHERE activo = 1;

CREATE TABLE moldes (
  id          TEXT PRIMARY KEY,
  canasta_id  TEXT NOT NULL REFERENCES canastas(id),
  numero      INTEGER NOT NULL,                 -- posicion dentro de la canasta
  activo      INTEGER NOT NULL DEFAULT 1,
  fecha_alta  TEXT NOT NULL,
  fecha_baja  TEXT,
  motivo_baja TEXT                              -- "roto", "fuga", ...
);

CREATE INDEX idx_moldes_canasta ON moldes(canasta_id);
CREATE UNIQUE INDEX idx_moldes_numero ON moldes(canasta_id, numero) WHERE activo = 1;
