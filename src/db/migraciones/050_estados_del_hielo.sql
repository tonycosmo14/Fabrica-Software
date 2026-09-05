-- sin-transaccion
-- ============================================================
-- 050 · LOS ESTADOS DEL HIELO, COMO SON  (v6.5)
-- ============================================================
--
-- "Hueca y cáscara son lo mismo, y cuando salen así no se cuentan: damos
--  por entendido que se botaron, sea a donde sea que vayan. Puedes
--  eliminar la pregunta de si se tiran al condensador o se vendieron.
--  Salada y contaminada igual: es merma, se tienen que botar. Aguada o
--  ahogada lo mismo. Quitamos el estado un poco hueco. Se queda 100%
--  sellada, y donde decía normal que pregunte mejor el estado de
--  congelación: del 80 al 90, del 60 al 80, o del 40 al 60. Elimina la de
--  se rompió y deja otros, y que se pueda escribir lo que haya pasado."
--
-- Quedan ocho estados y NINGUNA pregunta de destino. Cuatro cuentan como
-- existencia y cuatro son merma. Por eso la columna `destino` se va: ya no
-- hay nada que decidir con ella, y dejarla vacía llenando la tabla sería
-- guardar una pregunta que nadie vuelve a hacer.
--
-- LO QUE YA ESTABA CAPTURADO se traduce con las definiciones que el propio
-- dueño les había dado, no a ojo:
--     normal      "casi selladas, o les falta poquito"  → 80 al 90%
--     poco_hueca  "del 70% al 60% selladas"             → 60 al 80%
--     cascara     el centro atraviesa                   → hueca o cáscara
--     merma       "se rompió"                           → otro, con su nota
--
-- Una cáscara vieja que se hubiera guardado al cuarto frío (destino
-- 'almacen') pasa a contar como merma, porque en la escala nueva la
-- cáscara no es existencia. Se dice aquí para que quede escrito: al hacer
-- este cambio no había ni una sola fila así, todo lo capturado eran
-- pruebas con hielo normal.

PRAGMA foreign_keys = OFF;

BEGIN;

CREATE TABLE sacadas_moldes_nueva (
  id         TEXT PRIMARY KEY,
  sacada_id  TEXT NOT NULL REFERENCES sacadas(id),
  molde_id   TEXT NOT NULL REFERENCES moldes(id),
  -- Los cuatro primeros son hielo que se vende; los cuatro últimos, merma.
  resultado  TEXT NOT NULL
               CHECK (resultado IN ('sellada','c80','c60','c40',
                                    'hueca','contaminada','aguada','otro')),
  -- Qué pasó, cuando se eligió "otro". Se escribe tal cual se dijo.
  nota       TEXT
);

INSERT INTO sacadas_moldes_nueva (id, sacada_id, molde_id, resultado, nota)
SELECT id, sacada_id, molde_id,
       CASE resultado
         WHEN 'normal'     THEN 'c80'
         WHEN 'poco_hueca' THEN 'c60'
         WHEN 'cascara'    THEN 'hueca'
         WHEN 'merma'      THEN 'otro'
         ELSE resultado
       END,
       CASE WHEN resultado = 'merma' AND (nota IS NULL OR nota = '')
            THEN 'Se rompió' ELSE nota END
  FROM sacadas_moldes;

DROP TABLE sacadas_moldes;
ALTER TABLE sacadas_moldes_nueva RENAME TO sacadas_moldes;

CREATE INDEX idx_sacadas_moldes_sacada ON sacadas_moldes(sacada_id);
CREATE INDEX idx_sacadas_moldes_molde  ON sacadas_moldes(molde_id);
CREATE INDEX idx_sacadas_moldes_result ON sacadas_moldes(resultado);

-- ------------------------------------------------------------
-- CUÁNTO TARDA EN CONGELAR, EN GENERAL
-- ------------------------------------------------------------
--
-- "Dependiendo del año las marquetas pueden congelarse en treinta o en
--  cuarenta y ocho horas. En enero y febrero se congelan más rápido; en
--  mayo se van hasta arriba de cuarenta y ocho. Idealmente debo poder
--  modificarlo en configuraciones."
--
-- Un solo número para toda la fábrica, que se cambia cuando cambia el
-- tiempo. Cada tanque puede llevar el suyo si de verdad se porta distinto,
-- pero lo normal es que los tres sigan al general.
INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'horas_congelacion', '48',
       'Cuántas horas tarda en congelar un paño, en general', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'horas_congelacion');

-- Los tanques que seguían con las 24 de fábrica pasan a las 48 nuevas. Uno
-- al que le hayan puesto un número a mano se queda con el suyo.
UPDATE tanques SET horas_congelacion = 48 WHERE horas_congelacion = 24;

COMMIT;

PRAGMA foreign_keys = ON;
