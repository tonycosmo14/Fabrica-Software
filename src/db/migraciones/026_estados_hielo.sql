-- sin-transaccion
-- ============================================================
-- 026_estados_hielo.sql  (v3.1)
--
-- FALTABAN DOS ESTADOS Y UNA SALIDA DE EMERGENCIA.
--
-- Los cinco de la v3.0 describían cómo CONGELÓ el hielo, y con eso no
-- alcanza, porque en la fábrica pasan dos cosas más que no son de frío:
--
--   aguada       No congeló nada. Sale agua del molde: no hay marqueta.
--                No es "muy hueca": es que no hay hielo.
--   contaminada  Se rompió el molde y le entró salmuera, se oxidó el
--                fondo, o le cayó algo. PUEDE ESTAR BIEN CONGELADA — el
--                problema no es el frío, es el molde—. No se toma; a
--                veces se vende a quien solo quiere enfriar.
--
-- Y "otro", que obliga a escribir qué pasó. Una lista cerrada, el día que
-- pasa algo que no está en ella, obliga a mentir: se elige lo más
-- parecido y la verdad se pierde. Con la salida de emergencia queda
-- escrita, y si dentro de un año resulta que ese "otro" se repite treinta
-- veces, ahí está la razón para volverlo un estado propio.
--
-- POR ESO NACE LA COLUMNA `nota`: es lo que se escribió en ese "otro".
-- Va en el molde y no en el paño porque un molde suelto puede salir con
-- algo raro mientras los demás salen normales, y esa es justo la
-- información que hay que poder leer después.
--
-- LAS QUE PIDEN DESTINO PASAN DE UNA A TRES. Antes solo la cáscara tenía
-- que decir a dónde fue; ahora también la contaminada y la de "otro",
-- porque de las tres depende que el conteo del cuarto frío cuadre. La
-- aguada no lo pide: de ella no hay nada que mandar a ningún lado.
--
-- Nada de lo ya capturado cambia: los seis estados de antes siguen
-- llamándose igual.
-- ============================================================

PRAGMA foreign_keys = OFF;

BEGIN;

CREATE TABLE sacadas_moldes_nueva (
  id         TEXT PRIMARY KEY,
  sacada_id  TEXT NOT NULL REFERENCES sacadas(id),
  molde_id   TEXT NOT NULL REFERENCES moldes(id),
  resultado  TEXT NOT NULL
               CHECK (resultado IN ('sellada','normal','poco_hueca','hueca',
                                    'cascara','contaminada','aguada','otro','merma')),
  -- Solo para cáscara, contaminada y otro. En los demás va vacío: una
  -- marqueta entera SIEMPRE entra al cuarto frío, y de una aguada no hay
  -- nada que mandar a ningún lado.
  destino    TEXT CHECK (destino IN ('almacen','condensadores','botada')),
  -- Qué pasó, cuando se eligió "otro". Se escribe tal cual se dijo.
  nota       TEXT
);

INSERT INTO sacadas_moldes_nueva (id, sacada_id, molde_id, resultado, destino, nota)
SELECT id, sacada_id, molde_id, resultado, destino, NULL
  FROM sacadas_moldes;

DROP TABLE sacadas_moldes;
ALTER TABLE sacadas_moldes_nueva RENAME TO sacadas_moldes;

CREATE INDEX idx_sacadas_moldes_sacada ON sacadas_moldes(sacada_id);
CREATE INDEX idx_sacadas_moldes_molde  ON sacadas_moldes(molde_id);
CREATE INDEX idx_sacadas_moldes_result ON sacadas_moldes(resultado);

COMMIT;

PRAGMA foreign_keys = ON;
