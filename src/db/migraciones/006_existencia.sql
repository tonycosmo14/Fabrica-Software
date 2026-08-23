-- ============================================================
-- 006_existencia.sql  (v0.7)
--
-- LA EXISTENCIA: lo que se sacó, lo que salió y lo que sobra.
--
-- Así se controla la fábrica hoy: a las 3 y a las 8 alguien cuenta las
-- marquetas que quedan físicamente en el cuarto frío, y ese número se
-- compara contra lo que debería haber.
--
--     existencia anterior + producido − contado = SALIDAS
--
-- Las salidas son lo vendido más lo que se perdió. Mientras no exista el
-- punto de venta, la diferencia va junta; cuando llegue, se parte en
-- vendido y faltante, y ahí es donde se ve el robo.
--
-- REGLA DE ORO 3.1: la cantidad se guarda en DIECISEISAVOS enteros, aunque
-- se cuente en marquetas. Así el día que se cuente media marqueta el
-- sistema ya sabe guardarla.
--
-- REGLA DE ORO 3.2: el conteo guarda congelados los números con los que se
-- cuadró. Si mañana se corrige una sacada vieja, el corte de hoy no cambia.
-- ============================================================

CREATE TABLE almacenes (
  id                 TEXT PRIMARY KEY,
  nombre             TEXT NOT NULL,
  orden              INTEGER NOT NULL DEFAULT 0,
  -- Dónde cae el hielo que sale de los tanques. Hoy hay un solo cuarto
  -- frío; si mañana hay dos, uno recibe la producción y el otro es
  -- almacenaje aparte, y cada uno se cuenta por separado.
  recibe_produccion  INTEGER NOT NULL DEFAULT 1,
  notas              TEXT,
  activo             INTEGER NOT NULL DEFAULT 1,
  fecha_alta         TEXT NOT NULL,
  fecha_baja         TEXT,
  creado_por         TEXT REFERENCES usuarios(id)
);

CREATE TABLE conteos (
  id                  TEXT PRIMARY KEY,
  almacen_id          TEXT NOT NULL REFERENCES almacenes(id),
  fecha               TEXT NOT NULL,
  ejecutor_id         TEXT REFERENCES usuarios(id),   -- quién contó
  capturista_id       TEXT REFERENCES usuarios(id),   -- quién lo capturó

  contado             INTEGER NOT NULL,               -- dieciseisavos contados

  -- Congelados en el momento del conteo (regla 3.2)
  existencia_anterior INTEGER NOT NULL DEFAULT 0,
  producido           INTEGER NOT NULL DEFAULT 0,
  salidas             INTEGER NOT NULL DEFAULT 0,     -- anterior + producido − contado
  desde               TEXT,                           -- ventana de producción contada
  notas               TEXT,

  anulado_en          TEXT,
  anulado_por         TEXT REFERENCES usuarios(id),
  motivo_anulacion    TEXT
);

CREATE INDEX idx_conteos_almacen ON conteos(almacen_id, fecha);

-- El cuarto frío que ya existe. El nombre es editable desde el sistema.
INSERT INTO almacenes (id, nombre, orden, recibe_produccion, activo, fecha_alta)
VALUES ('almacen-principal', 'Cuarto frío', 1, 1, 1, datetime('now'));

-- Horarios en los que toca contar. Editables desde la configuración.
INSERT INTO configuracion (clave, valor, descripcion, actualizado_en) VALUES
  ('conteo_horarios', '15:00,20:00', 'Horas del día en las que toca contar la existencia', datetime('now'));
