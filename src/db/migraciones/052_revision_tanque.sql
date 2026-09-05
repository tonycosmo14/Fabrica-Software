-- ============================================================
-- 052 · LA REVISIÓN DEL TANQUE  (v6.7)
-- ============================================================
--
-- "Un empleado va, saca el hielo, te dice aquel paño y aquel paño del
--  tanque tal. Hasta ahí todo correcto. El día termina, hacen el corte y
--  reporta la existencia. Ese día no hubo mucha venta, por lo que si no se
--  revisa el cuarto frío, que a veces pasa, se les cree. Pasan los días y
--  de repente en un día con venta grande se acaban las marquetas, cuando
--  no se debieron acabar. Vamos a revisar los tanques y un paño que se
--  dijo que se sacó está ahí y no se sacó."
--
-- Corregir sirve para arreglar; esto sirve para DESCUBRIR, y al día
-- siguiente en vez de a los tres días. Es una vuelta al tanque con el
-- sistema diciendo qué debería tener cada paño ahora mismo:
--
--     "paño 1 · se sacó hoy a las 6:10, lo reportó Chema · debe tener AGUA"
--
-- Se marca lo que se encuentra de verdad, paño por paño. Cada diferencia
-- queda escrita con quién reportó aquella sacada, y desde ahí se corrige.
-- No avisa a nadie de antemano y se hace en dos minutos.

CREATE TABLE revisiones_tanque (
  id           TEXT PRIMARY KEY,
  tanque_id    TEXT NOT NULL REFERENCES tanques(id),
  fecha        TEXT NOT NULL,
  -- Quién dio la vuelta al tanque. No es el que sacó el hielo: revisarse a
  -- uno mismo no es revisar nada.
  ejecutor_id  TEXT REFERENCES usuarios(id),
  notas        TEXT,
  -- Cuántos paños se miraron y en cuántos no cuadró, congelados al
  -- terminar (regla 3.2 al revés, como los conteos): es el papel de esa
  -- vuelta y no cambia porque después se corrija una sacada.
  panos        INTEGER NOT NULL DEFAULT 0,
  diferencias  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE revisiones_panos (
  id             TEXT PRIMARY KEY,
  revision_id    TEXT NOT NULL REFERENCES revisiones_tanque(id),
  pano_id        TEXT NOT NULL REFERENCES panos(id),
  -- Lo que el sistema decía que debía haber: 'congelando', 'lista',
  -- 'fuera' o 'proceso'.
  esperado       TEXT NOT NULL,
  -- Lo que se encontró de verdad:
  --   cuadra      está como dice
  --   con_hielo   tiene hielo y el sistema dice que ya se sacó  ← el robo
  --   con_agua    tiene agua y el sistema dice que está listo   ← salió sin reportarse
  --   vacio       no tiene nada, y debería
  encontrado     TEXT NOT NULL
                   CHECK (encontrado IN ('cuadra','con_hielo','con_agua','vacio')),
  -- La sacada que queda en entredicho, y quién la reportó. Se copian aquí
  -- (regla 3.5): si mañana se corrige o se anula, este papel sigue
  -- diciendo lo que decía el día de la revisión.
  sacada_pano_id TEXT REFERENCES sacadas_pano(id),
  reporto        TEXT,
  reportado_en   TEXT,
  notas          TEXT
);

CREATE INDEX idx_revisiones_tanque_fecha ON revisiones_tanque(tanque_id, fecha);
CREATE INDEX idx_revisiones_panos_rev    ON revisiones_panos(revision_id);
CREATE INDEX idx_revisiones_panos_pano   ON revisiones_panos(pano_id);

-- El aviso por correo cuando una revisión no cuadra. Encendido de fábrica:
-- es justo el momento en que hay que enterarse aunque no se esté ahí.
INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'aviso_revision_tanque', '1',
       'Cuando una revisión de tanque encuentra un paño que no cuadra', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'aviso_revision_tanque');
