-- ============================================================
-- 001_inicial.sql  (v0.1)
-- Cimientos: usuarios, sesiones, bitacora y configuracion.
--
-- Reglas aplicadas aqui:
--  3.3 IDs internos estables (UUID) y nombres editables
--  3.4 Nada se borra: activo + fecha_baja
--  3.6 Doble responsable: ejecutor y capturista en cada movimiento
-- ============================================================

CREATE TABLE usuarios (
  id              TEXT PRIMARY KEY,               -- UUID, jamas cambia
  nombre          TEXT NOT NULL,                  -- etiqueta editable
  usuario         TEXT UNIQUE,                    -- solo para login con contraseña (admin)
  rol             TEXT NOT NULL
                    CHECK (rol IN ('operario','cajero','repartidor','admin')),
  pin_hash        TEXT,
  pin_sal         TEXT,
  contrasena_hash TEXT,
  contrasena_sal  TEXT,
  activo          INTEGER NOT NULL DEFAULT 1,
  fecha_alta      TEXT NOT NULL,
  fecha_baja      TEXT,
  creado_por      TEXT REFERENCES usuarios(id)
);

CREATE INDEX idx_usuarios_activo ON usuarios(activo);

-- Sesion del dispositivo. Persistente: el celular no vuelve a pedir PIN cada rato.
CREATE TABLE sesiones_dispositivo (
  id          TEXT PRIMARY KEY,
  usuario_id  TEXT NOT NULL REFERENCES usuarios(id),
  token_hash  TEXT NOT NULL UNIQUE,               -- nunca se guarda el token en claro
  creada_en   TEXT NOT NULL,
  expira_en   TEXT NOT NULL,
  cerrada_en  TEXT,
  dispositivo TEXT
);

CREATE INDEX idx_sesiones_usuario ON sesiones_dispositivo(usuario_id);

-- Bitacora general. Regla 3.2: nada se edita, todo queda como evento.
CREATE TABLE bitacora (
  id            TEXT PRIMARY KEY,
  fecha         TEXT NOT NULL,
  accion        TEXT NOT NULL,                    -- 'usuario.alta', 'sesion.inicio', ...
  entidad       TEXT,                             -- 'usuario', 'tanque', ...
  entidad_id    TEXT,
  ejecutor_id   TEXT REFERENCES usuarios(id),     -- quien lo hizo fisicamente
  capturista_id TEXT REFERENCES usuarios(id),     -- quien lo capturo en el sistema
  detalle       TEXT                              -- JSON libre con el contexto
);

CREATE INDEX idx_bitacora_fecha  ON bitacora(fecha);
CREATE INDEX idx_bitacora_accion ON bitacora(accion);

-- Configuracion editable desde la interfaz (nada hardcodeado, error 11 del plan).
CREATE TABLE configuracion (
  clave           TEXT PRIMARY KEY,
  valor           TEXT NOT NULL,
  descripcion     TEXT,
  actualizado_en  TEXT NOT NULL,
  actualizado_por TEXT REFERENCES usuarios(id)
);

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en) VALUES
  ('nombre_negocio', 'Fábrica de Hielo', 'Nombre que aparece en pantallas y tickets', datetime('now')),
  ('ciudad',         'Hunucmá, Yucatán', 'Ubicación del negocio', datetime('now'));
