-- ============================================================
-- 007_ventas.sql  (v0.8)
--
-- EL PUNTO DE VENTA.
--
-- Reglas del plan que mandan aquí:
--
--  3.1  Todo en DIECISEISAVOS enteros. Nunca decimales.
--  3.5  El precio se COPIA dentro de la venta, no se referencia. Si mañana
--       suben los precios, el ticket del año pasado no cambia.
--  7.2  Cada fracción tiene su precio propio, no se divide el de la
--       marqueta. El 1/16 se cobra más caro de lo proporcional porque
--       requiere más cortes.
--  7.3  Folio consecutivo histórico: nunca se reinicia ni se reutiliza.
--
-- El dinero se guarda en CENTAVOS enteros, por la misma razón que el hielo
-- en dieciseisavos: los decimales acumulan errores que después no cuadran.
-- ============================================================

CREATE TABLE listas_precios (
  id          TEXT PRIMARY KEY,
  nombre      TEXT NOT NULL,                   -- "Normal", "Temporada alta"
  tipo        TEXT NOT NULL DEFAULT 'publico'
                CHECK (tipo IN ('publico','mayoreo')),
  activa      INTEGER NOT NULL DEFAULT 0,      -- la que se está cobrando hoy
  notas       TEXT,
  activo      INTEGER NOT NULL DEFAULT 1,
  fecha_alta  TEXT NOT NULL,
  fecha_baja  TEXT,
  creado_por  TEXT REFERENCES usuarios(id)
);

CREATE TABLE precios (
  id              TEXT PRIMARY KEY,
  lista_id        TEXT NOT NULL REFERENCES listas_precios(id),
  dieciseisavos   INTEGER NOT NULL,            -- 16, 8, 4, 2 o 1
  centavos        INTEGER NOT NULL,
  actualizado_en  TEXT NOT NULL,
  actualizado_por TEXT REFERENCES usuarios(id)
);

CREATE UNIQUE INDEX idx_precios_lista ON precios(lista_id, dieciseisavos);

CREATE TABLE ventas (
  id                 TEXT PRIMARY KEY,
  folio              INTEGER NOT NULL UNIQUE,  -- consecutivo, jamás se reinicia
  fecha              TEXT NOT NULL,
  cajero_id          TEXT REFERENCES usuarios(id),
  capturista_id      TEXT REFERENCES usuarios(id),
  almacen_id         TEXT REFERENCES almacenes(id),
  lista_id           TEXT REFERENCES listas_precios(id),
  lista_nombre       TEXT,                      -- copiado, por si se renombra
  total_centavos     INTEGER NOT NULL,
  pago_centavos      INTEGER,
  cambio_centavos    INTEGER,
  forma_pago         TEXT NOT NULL DEFAULT 'efectivo',
  notas              TEXT,
  cancelada_en       TEXT,
  cancelada_por      TEXT REFERENCES usuarios(id),
  motivo_cancelacion TEXT
);

CREATE INDEX idx_ventas_fecha ON ventas(fecha);
CREATE INDEX idx_ventas_folio ON ventas(folio);

CREATE TABLE venta_lineas (
  id               TEXT PRIMARY KEY,
  venta_id         TEXT NOT NULL REFERENCES ventas(id),
  concepto         TEXT NOT NULL,               -- "Hielo"
  dieciseisavos    INTEGER NOT NULL,
  precio_centavos  INTEGER NOT NULL,            -- COPIADO (regla 3.5)
  desglose         TEXT                         -- "1/4 + 1/8", para el ticket
);

CREATE INDEX idx_lineas_venta ON venta_lineas(venta_id);

-- Lista de arranque con los precios del plan. Se editan desde el sistema.
INSERT INTO listas_precios (id, nombre, tipo, activa, activo, fecha_alta)
VALUES ('lista-normal', 'Normal', 'publico', 1, 1, datetime('now'));

INSERT INTO precios (id, lista_id, dieciseisavos, centavos, actualizado_en) VALUES
  ('precio-1',    'lista-normal', 16, 26400, datetime('now')),   -- marqueta $264
  ('precio-1-2',  'lista-normal',  8, 13500, datetime('now')),   -- 1/2 $135
  ('precio-1-4',  'lista-normal',  4,  7000, datetime('now')),   -- 1/4 $70
  ('precio-1-8',  'lista-normal',  2,  3600, datetime('now')),   -- 1/8 $36
  ('precio-1-16', 'lista-normal',  1,  1800, datetime('now'));   -- 1/16 $18
