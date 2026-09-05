-- ============================================================
-- 051 · CORREGIR MOLDE POR MOLDE, EN SU FECHA  (v6.6)
-- ============================================================
--
-- "Si aprieto corregir cómo salió y uso uno, me cambia completamente
--  todas. Y a veces las correcciones son de una canasta o de un molde
--  nada más, por lo que necesito corregir una por una."
--
-- "Un paño no se puede sacar dos veces el mismo día. Es imposible, el
--  hielo no congela. Y cuando quiera corregir algo, debería corregirlo en
--  base al historial de ese paño: yo selecciono el movimiento, la fecha
--  que quiero corregir, para que se refleje en los cortes de esa fecha."
--
-- Dos cosas distintas se pueden corregir de una sacada vieja, y las dos
-- dejan rastro aquí:
--
--   CAMBIÓ    ese molde salió distinto de lo que se anotó (la hueca que
--             era ahogada). Se guarda qué decía antes y qué dice ahora.
--   NO SE SACÓ  ese molde nunca salió del tanque: alguien reportó el paño
--             completo y dejó una canasta adentro. La fila de
--             `sacadas_moldes` se borra —nunca existió esa marqueta— y
--             aquí queda escrito que existió en el papel y por qué se
--             quitó. Es lo único que deja ver el faltante que provoca.
--
-- La tabla es de solo agregar (regla de oro 3.2): nunca se actualiza ni se
-- borra un renglón de aquí.
CREATE TABLE correcciones_moldes (
  id             TEXT PRIMARY KEY,
  sacada_pano_id TEXT NOT NULL REFERENCES sacadas_pano(id),
  molde_id       TEXT NOT NULL REFERENCES moldes(id),
  -- 'cambio' o 'quitado'
  que            TEXT NOT NULL CHECK (que IN ('cambio', 'quitado')),
  antes          TEXT,          -- el resultado que tenía
  antes_nota     TEXT,
  despues        TEXT,          -- el resultado que quedó ('quitado' no tiene)
  despues_nota   TEXT,
  motivo         TEXT NOT NULL,
  fecha          TEXT NOT NULL,
  ejecutor_id    TEXT REFERENCES usuarios(id)
);

CREATE INDEX idx_correcciones_moldes_sacada ON correcciones_moldes(sacada_pano_id);
CREATE INDEX idx_correcciones_moldes_molde  ON correcciones_moldes(molde_id);
