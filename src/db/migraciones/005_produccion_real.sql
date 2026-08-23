-- sin-transaccion
-- ============================================================
-- 005_produccion_real.sql  (v0.4)
--
-- Ajuste del modelo de producción a cómo funciona la fábrica de verdad:
--
--  1. LA UNIDAD DE TRABAJO ES EL PAÑO, no la canasta. Se empieza un paño y
--     se termina; si el obrero se va o se acaba el agua, queda EN PROCESO y
--     otro lo continúa. Por eso nace la tabla sacadas_pano.
--
--  2. LOS MOLDES SIEMPRE SE RELLENAN. Sacar y rellenar siguen siendo dos
--     eventos separados en la base (el reloj de congelación depende de eso),
--     pero en la interfaz son un solo movimiento. Dejar una canasta fuera es
--     la excepción, y se marca a propósito.
--
--  3. LA ROTACIÓN ES INTERCALADA Y OBLIGATORIA: 1, 3, 5... y luego 2, 4, 6...
--     Sacar un paño que no toca requiere autorización de un administrador o
--     de un gerente, y queda registrado quién autorizó y por qué.
--
--  4. NO HAY TURNOS QUE ABRIR Y CERRAR. Cada movimiento guarda su hora y
--     quién lo hizo. La tabla de turnos se conserva por los registros que
--     ya existan, pero deja de usarse.
--
--  5. Nace el rol GERENTE, entre cajero y administrador.
-- ============================================================

PRAGMA foreign_keys = OFF;

BEGIN;

-- --- Rol gerente: hay que rehacer la tabla porque el rol vive en un CHECK ---
CREATE TABLE usuarios_nueva (
  id              TEXT PRIMARY KEY,
  nombre          TEXT NOT NULL,
  usuario         TEXT UNIQUE,
  rol             TEXT NOT NULL
                    CHECK (rol IN ('operario','cajero','repartidor','gerente','admin')),
  pin_hash        TEXT,
  pin_sal         TEXT,
  contrasena_hash TEXT,
  contrasena_sal  TEXT,
  activo          INTEGER NOT NULL DEFAULT 1,
  fecha_alta      TEXT NOT NULL,
  fecha_baja      TEXT,
  creado_por      TEXT REFERENCES usuarios(id)
);

INSERT INTO usuarios_nueva
  SELECT id, nombre, usuario, rol, pin_hash, pin_sal, contrasena_hash,
         contrasena_sal, activo, fecha_alta, fecha_baja, creado_por
    FROM usuarios;

DROP TABLE usuarios;
ALTER TABLE usuarios_nueva RENAME TO usuarios;

CREATE INDEX idx_usuarios_activo ON usuarios(activo);

-- --- El paño como unidad de trabajo ---
CREATE TABLE sacadas_pano (
  id             TEXT PRIMARY KEY,
  pano_id        TEXT NOT NULL REFERENCES panos(id),
  iniciada_en    TEXT NOT NULL,
  terminada_en   TEXT,                              -- NULL = todavía en proceso
  ejecutor_id    TEXT REFERENCES usuarios(id),      -- quién la empezó
  capturista_id  TEXT REFERENCES usuarios(id),
  autorizada_por TEXT REFERENCES usuarios(id),      -- si se sacó fuera de orden
  motivo_orden   TEXT,                              -- por qué se saltó la rotación
  notas          TEXT
);

CREATE INDEX idx_sacadas_pano_pano   ON sacadas_pano(pano_id, iniciada_en);
CREATE INDEX idx_sacadas_pano_abierta ON sacadas_pano(terminada_en);

-- Cada sacada de canasta pertenece a la sacada del paño
ALTER TABLE sacadas    ADD COLUMN sacada_pano_id TEXT REFERENCES sacadas_pano(id);
ALTER TABLE rellenados ADD COLUMN sacada_pano_id TEXT REFERENCES sacadas_pano(id);

-- Quién sigue: el registro de la rotación por tanque vive en los datos,
-- pero se guarda el último paño sacado para no recalcularlo cada vez.
ALTER TABLE tanques ADD COLUMN ultimo_pano_sacado INTEGER;

COMMIT;

PRAGMA foreign_keys = ON;
