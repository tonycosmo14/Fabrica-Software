-- sin-transaccion
-- ============================================================
-- 025_calidad_hielo.sql  (v2.10)
--
-- CÓMO SALIÓ EL HIELO.
--
-- Hasta hoy un molde solo podía salir de tres formas: 'ok', 'merma' o
-- 'hueco'. Eso no es lo que pasa en la fábrica. Una marqueta puede salir
-- perfecta o puede salir casi hueca, y las dos se venden al mismo precio
-- aunque no sean la misma cosa: la segunda deja quejas en el mostrador y
-- avisa —días antes de que se pare una máquina— que algo va mal.
--
-- Los cinco estados son los del dueño, con sus palabras:
--
--   sellada     100% sellada. Bien congelada, el centro cerrado a tope.
--               Sale cuando llueve mucho, cuando no hay venta, o cuando
--               las máquinas están congelando muy bien.
--   normal      Casi selladas o les falta poquito. Es el estándar; con
--               estas no hay quejas.
--   poco_hueca  70%-60% sellada. "Con una noche más hubiera quedado
--               mejor". Algunas personas se quejan.
--   hueca       El centro casi atraviesa la marqueta, y algunas sí lo
--               hacen. La gente se queja pero por necesidad se la lleva.
--   cascara     30% de congelación o menos: el centro atraviesa y los
--               laterales están delgados. Por lo general NO se vende.
--
-- Y 'merma' se queda como estaba: el molde que no dio nada aprovechable.
-- No es una calidad, es una pérdida.
--
-- POR QUÉ LAS CÁSCARAS LLEVAN DESTINO. Una cáscara costó exactamente lo
-- mismo que una marqueta sellada —el mismo molde, la misma agua, la misma
-- luz— así que para el costo cuenta como producida. Pero casi nunca entra
-- al cuarto frío: la mayoría se va a los condensadores para enfriarlos, a
-- veces se vende más barata si hay demanda, y si no, se bota. Sin anotar
-- ese destino, el sistema creería que hay hielo en el cuarto frío que no
-- existe, y el conteo no cuadraría nunca.
--
-- LOS DATOS VIEJOS NO SE PIERDEN NI SE INVENTAN. Lo que estaba como 'ok'
-- pasa a 'normal', que es lo que quería decir; 'hueco' pasa a 'hueca'.
-- Nadie estaba distinguiendo selladas de cáscaras, así que no se puede
-- adivinar hacia atrás, y no se adivina.
-- ============================================================

PRAGMA foreign_keys = OFF;

BEGIN;

CREATE TABLE sacadas_moldes_nueva (
  id         TEXT PRIMARY KEY,
  sacada_id  TEXT NOT NULL REFERENCES sacadas(id),
  molde_id   TEXT NOT NULL REFERENCES moldes(id),
  resultado  TEXT NOT NULL
               CHECK (resultado IN ('sellada','normal','poco_hueca','hueca','cascara','merma')),
  -- Solo para las cáscaras. En los demás resultados va vacío: una marqueta
  -- que salió entera SIEMPRE entra al cuarto frío.
  destino    TEXT CHECK (destino IN ('almacen','condensadores','botada'))
);

INSERT INTO sacadas_moldes_nueva (id, sacada_id, molde_id, resultado, destino)
SELECT id, sacada_id, molde_id,
       CASE resultado
         WHEN 'ok'    THEN 'normal'
         WHEN 'hueco' THEN 'hueca'
         ELSE resultado
       END,
       NULL
  FROM sacadas_moldes;

DROP TABLE sacadas_moldes;
ALTER TABLE sacadas_moldes_nueva RENAME TO sacadas_moldes;

CREATE INDEX idx_sacadas_moldes_sacada ON sacadas_moldes(sacada_id);
CREATE INDEX idx_sacadas_moldes_molde  ON sacadas_moldes(molde_id);

-- Para contar la mezcla de un mes sin leer la tabla entera.
CREATE INDEX idx_sacadas_moldes_result ON sacadas_moldes(resultado);

COMMIT;

PRAGMA foreign_keys = ON;
