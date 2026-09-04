-- ============================================================
-- 040_agua_maquina.sql  (v5.2)
--
-- LA MÁQUINA DEL AGUA PURIFICADA.
--
-- "El equipo que se está instalando es de 6 membranas, de ultra baja
--  presión, su carbón activado y zeolita como con su clorinador, en
--  tanques de 4 pies, y luego su suavizador en paralelo son 2 tanques de
--  7 pies, con un almacenamiento de 5 tinacos de 1000 L, medidores de
--  flujo y conteo de TDS a la entrada de las membranas y la salida, sí
--  hay ozono y luz ultravioleta."
--
-- ============================================================
-- EL NÚMERO QUE MANDA: EL RECHAZO DE SALES
-- ============================================================
--
-- Una planta de ósmosis no avisa cuando se está muriendo. Sigue sacando
-- agua, sigue llenando garrafones, y el agua sigue viéndose igual de
-- transparente. Lo único que cambia es un número:
--
--     rechazo de sales = (TDS de entrada − TDS de salida) ÷ TDS de entrada
--
-- Con membranas nuevas anda en 96–98 %. Cuando baja de 90, las membranas
-- ya no están purificando: están colando. Ese número —y no la vista— es
-- el que dice cuándo cambiarlas, y por eso la pantalla lo pone grande,
-- igual que "¿ya se pagó?" en las neveras.
--
-- ============================================================
-- EL PUESTO Y LA PIEZA SON DOS COSAS
-- ============================================================
--
-- Es la misma decisión que la nevera y su comodato (039), aplicada a un
-- equipo que se consume:
--
--   EL EQUIPO es el puesto: "Membrana 3". Vive mientras viva la planta.
--   LA PIEZA es lo que está puesto ahí hoy, y se cambia cada dos o tres
--   años.
--
-- Guardados juntos, cambiar la membrana 3 obligaría a pisar los datos de
-- la anterior. Separados, el puesto acumula: cuántas membranas se ha
-- comido, cuánto duró cada una y cuánto se ha gastado en él. Y ese es
-- justo el dato que descubre un problema: si el puesto 3 se come una
-- membrana cada año y los otros cinco duran tres, lo que está mal no es
-- la membrana — es lo que le llega.
--
-- ============================================================
-- LOS MEDIDORES SE GUARDAN COMO LECTURA, NO COMO GASTO
-- ============================================================
--
-- Un medidor de flujo es un totalizador: nunca se pone en cero, solo
-- sube. Así que se guarda LO QUE MARCA, y lo gastado se saca restando la
-- lectura anterior — igual que los recibos de la CFE (027).
--
-- Esto no es un capricho: si se guardara "hoy pasaron 4,000 litros" y
-- alguien falta un día, ese día se pierde para siempre. Guardando lo que
-- marca, un día sin anotar se recupera solo en la siguiente vuelta.
-- ============================================================

-- ------------------------------------------------------------
-- LOS EQUIPOS: cada puesto del tren de tratamiento, en orden
-- ------------------------------------------------------------
CREATE TABLE agua_equipos (
  id           TEXT PRIMARY KEY,

  -- EL ORDEN EN QUE EL AGUA LOS ATRAVIESA. No es adorno: el carbón va
  -- ANTES de las membranas justamente para quitarles el cloro, y verlo en
  -- orden es lo que hace evidente por qué el cloro después del carbón es
  -- una emergencia y no un detalle. Varios equipos pueden compartir el
  -- mismo orden: los dos suavizadores van en paralelo, y las seis
  -- membranas también.
  orden        INTEGER NOT NULL DEFAULT 0,

  tipo         TEXT NOT NULL
               CHECK (tipo IN ('clorinador','filtro','suavizador','membrana',
                               'tinaco','ozono','uv','medidor','bomba','otro')),
  nombre       TEXT NOT NULL,
  -- "4 pies", "1000 L", "7 pies" — texto, porque cada tipo se mide con
  -- su propia unidad y forzar un número obligaría a inventar cuál.
  capacidad    TEXT,

  -- CUÁNTO DEBERÍA DURAR LO QUE LLEVA PUESTO. Cualquiera de las dos, o
  -- las dos: una lámpara UV se mide en meses aunque no pase agua, y una
  -- membrana en litros aunque el calendario no avance. Vacío = no se
  -- vigila.
  vida_dias    INTEGER,
  vida_litros  INTEGER,

  estado       TEXT NOT NULL DEFAULT 'trabajando'
               CHECK (estado IN ('trabajando','reparacion','baja')),
  notas        TEXT,

  activo       INTEGER NOT NULL DEFAULT 1,
  fecha_alta   TEXT NOT NULL,
  creado_por   TEXT REFERENCES usuarios(id),
  baja_en      TEXT,
  baja_por     TEXT REFERENCES usuarios(id),
  motivo_baja  TEXT
);

CREATE INDEX idx_agua_equipos_orden ON agua_equipos(orden, nombre);

-- ------------------------------------------------------------
-- LAS PIEZAS: lo que está puesto en cada equipo, y lo que estuvo antes
-- ------------------------------------------------------------
CREATE TABLE agua_piezas (
  id              TEXT PRIMARY KEY,
  equipo_id       TEXT NOT NULL REFERENCES agua_equipos(id),

  nombre          TEXT,
  marca           TEXT,
  modelo          TEXT,
  serie           TEXT,
  -- Lo que costó, copiado (regla 3.5). Es lo que permite decir cuánto se
  -- ha gastado en cada puesto sin que el precio de hoy cambie la historia.
  costo_centavos  INTEGER,

  puesta_en       TEXT NOT NULL,
  -- CUÁNTO MARCABA EL MEDIDOR CUANDO SE PUSO. Sin esto, "le quedan
  -- 30,000 litros" no se puede calcular: los litros de una pieza son los
  -- que han pasado DESDE que se puso, no los de toda la planta.
  litros_al_poner INTEGER,

  quitada_en      TEXT,
  motivo_quitada  TEXT CHECK (motivo_quitada IN ('vida','falla','preventivo','otro')),
  notas           TEXT,

  capturista_id   TEXT REFERENCES usuarios(id),
  anulado_en      TEXT,
  anulado_por     TEXT REFERENCES usuarios(id)
);

CREATE INDEX idx_agua_piezas_equipo ON agua_piezas(equipo_id, puesta_en);

-- ------------------------------------------------------------
-- LAS LECTURAS: la vuelta de revisión
--
-- Todo es opcional menos la fecha: no toda vuelta mide todo, y una
-- lectura a medias vale más que ninguna. Lo que no se midió queda vacío
-- y se ve como vacío — nunca como cero, que sería un dato falso.
-- ------------------------------------------------------------
CREATE TABLE agua_lecturas (
  id              TEXT PRIMARY KEY,
  fecha           TEXT NOT NULL,

  -- Partes por millón, a la entrada de las membranas y a la salida.
  tds_entrada     INTEGER,
  tds_salida      INTEGER,

  -- LO QUE MARCAN LOS MEDIDORES, en litros. No lo del día: lo que marca.
  litros_entrada  INTEGER,
  litros_salida   INTEGER,

  -- CLORO DESPUÉS DEL CARBÓN. Tiene que dar CERO. Si sale cloro es que
  -- el carbón ya se saturó, y el cloro que pasa se come las membranas en
  -- días. Es la lectura más barata de tomar y la más cara de saltarse.
  cloro           REAL,
  -- DUREZA DESPUÉS DEL SUAVIZADOR, en ppm. Si sube, hay que regenerar:
  -- el sarro tapa las membranas.
  dureza          REAL,
  presion         REAL,

  notas           TEXT,
  ejecutor_id     TEXT REFERENCES usuarios(id),
  capturista_id   TEXT REFERENCES usuarios(id),
  anulado_en      TEXT,
  anulado_por     TEXT REFERENCES usuarios(id),
  motivo_anulacion TEXT
);

CREATE INDEX idx_agua_lecturas_fecha ON agua_lecturas(fecha);

-- ------------------------------------------------------------
-- LOS SERVICIOS: retrolavados, regeneraciones, fallas y cambios
-- ------------------------------------------------------------
CREATE TABLE agua_servicios (
  id              TEXT PRIMARY KEY,
  -- Puede no ser de ningún equipo en particular: "se sanitizó la línea".
  equipo_id       TEXT REFERENCES agua_equipos(id),

  tipo            TEXT NOT NULL DEFAULT 'falla'
                  CHECK (tipo IN ('falla','retrolavado','regeneracion',
                                  'sanitizacion','cambio_pieza','preventivo','otro')),

  reportado_en    TEXT NOT NULL,
  reportado_por   TEXT REFERENCES usuarios(id),
  quien_reporto   TEXT,
  que_tiene       TEXT NOT NULL,

  atendido_en     TEXT,
  atendido_por    TEXT REFERENCES usuarios(id),
  quien_atendio   TEXT,
  que_se_hizo     TEXT,
  costo_centavos  INTEGER,

  anulado_en      TEXT,
  anulado_por     TEXT REFERENCES usuarios(id),
  motivo_anulacion TEXT
);

CREATE INDEX idx_agua_servicios_equipo ON agua_servicios(equipo_id, reportado_en);

-- ============================================================
-- EL EQUIPO QUE YA ESTÁ INSTALADO
--
-- Se da de alta el de la fábrica, tal como lo describiste, para que la
-- pantalla sirva desde el primer día en vez de pedir que se capturen
-- veinte equipos a mano. Todo es editable y todo se puede dar de baja:
-- si algo no quedó igual que aquí, se corrige desde la pantalla.
--
-- El orden es el que sigue el agua. El carbón va antes de las membranas
-- a propósito.
-- ============================================================
INSERT INTO agua_equipos (id, orden, tipo, nombre, capacidad, vida_dias, vida_litros,
                          estado, activo, fecha_alta)
SELECT * FROM (
  SELECT 'agua-clorinador' AS id, 10 AS orden, 'clorinador' AS tipo,
         'Clorinador' AS nombre, NULL AS capacidad,
         NULL AS vida_dias, NULL AS vida_litros,
         'trabajando' AS estado, 1 AS activo, datetime('now') AS fecha_alta
  UNION ALL SELECT 'agua-zeolita', 20, 'filtro', 'Filtro de zeolita', '4 pies', 1460, NULL, 'trabajando', 1, datetime('now')
  UNION ALL SELECT 'agua-carbon',  30, 'filtro', 'Filtro de carbón activado', '4 pies', 730, NULL, 'trabajando', 1, datetime('now')
  UNION ALL SELECT 'agua-suav-a',  40, 'suavizador', 'Suavizador A', '7 pies', 1825, NULL, 'trabajando', 1, datetime('now')
  UNION ALL SELECT 'agua-suav-b',  40, 'suavizador', 'Suavizador B', '7 pies', 1825, NULL, 'trabajando', 1, datetime('now')
  UNION ALL SELECT 'agua-med-ent', 45, 'medidor', 'Medidor de entrada a las membranas', NULL, NULL, NULL, 'trabajando', 1, datetime('now')
  UNION ALL SELECT 'agua-memb-1',  50, 'membrana', 'Membrana 1', 'Ultra baja presión', 1095, NULL, 'trabajando', 1, datetime('now')
  UNION ALL SELECT 'agua-memb-2',  50, 'membrana', 'Membrana 2', 'Ultra baja presión', 1095, NULL, 'trabajando', 1, datetime('now')
  UNION ALL SELECT 'agua-memb-3',  50, 'membrana', 'Membrana 3', 'Ultra baja presión', 1095, NULL, 'trabajando', 1, datetime('now')
  UNION ALL SELECT 'agua-memb-4',  50, 'membrana', 'Membrana 4', 'Ultra baja presión', 1095, NULL, 'trabajando', 1, datetime('now')
  UNION ALL SELECT 'agua-memb-5',  50, 'membrana', 'Membrana 5', 'Ultra baja presión', 1095, NULL, 'trabajando', 1, datetime('now')
  UNION ALL SELECT 'agua-memb-6',  50, 'membrana', 'Membrana 6', 'Ultra baja presión', 1095, NULL, 'trabajando', 1, datetime('now')
  UNION ALL SELECT 'agua-med-sal', 55, 'medidor', 'Medidor de salida', NULL, NULL, NULL, 'trabajando', 1, datetime('now')
  UNION ALL SELECT 'agua-tinaco-1', 60, 'tinaco', 'Tinaco 1', '1000 L', NULL, NULL, 'trabajando', 1, datetime('now')
  UNION ALL SELECT 'agua-tinaco-2', 60, 'tinaco', 'Tinaco 2', '1000 L', NULL, NULL, 'trabajando', 1, datetime('now')
  UNION ALL SELECT 'agua-tinaco-3', 60, 'tinaco', 'Tinaco 3', '1000 L', NULL, NULL, 'trabajando', 1, datetime('now')
  UNION ALL SELECT 'agua-tinaco-4', 60, 'tinaco', 'Tinaco 4', '1000 L', NULL, NULL, 'trabajando', 1, datetime('now')
  UNION ALL SELECT 'agua-tinaco-5', 60, 'tinaco', 'Tinaco 5', '1000 L', NULL, NULL, 'trabajando', 1, datetime('now')
  UNION ALL SELECT 'agua-ozono',    70, 'ozono', 'Ozono', NULL, NULL, NULL, 'trabajando', 1, datetime('now')
  UNION ALL SELECT 'agua-uv',       80, 'uv', 'Luz ultravioleta', NULL, 365, NULL, 'trabajando', 1, datetime('now')
) WHERE NOT EXISTS (SELECT 1 FROM agua_equipos);

-- ------------------------------------------------------------
-- LOS AJUSTES
-- ------------------------------------------------------------
INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'agua_tds_maximo', '50',
       'TDS máximo permitido en el agua de salida (ppm). Arriba de esto no se embotella',
       datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'agua_tds_maximo');

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'agua_rechazo_minimo', '90',
       'Rechazo de sales mínimo aceptable (%). Abajo de esto las membranas ya no purifican',
       datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'agua_rechazo_minimo');

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'agua_dureza_maxima', '20',
       'Dureza máxima después del suavizador (ppm). Arriba de esto hay que regenerar',
       datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'agua_dureza_maxima');

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'agua_dias_sin_lectura', '2',
       'Días sin tomar lectura antes de avisar',
       datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'agua_dias_sin_lectura');

-- CUÁNTA AGUA LLEVA UNA MARQUETA.
--
-- "Se supone que la marqueta pesa 150 kg si está entera y sellada, por lo
--  que son 150 L. Todo lo que se saca se vuelve a llenar; el detalle es
--  que a veces se llena de más y a veces de menos."
--
-- Ese "a veces de más" es justo lo que nadie ve hoy, y es lo que la
-- resta entre el medidor y esta cuenta va a enseñar.
INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'agua_litros_marqueta', '150',
       'Litros que lleva una marqueta entera. Sirve para comparar el medidor contra la teoría',
       datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'agua_litros_marqueta');

-- ------------------------------------------------------------
-- LOS AVISOS POR CORREO, apagados de fábrica como los demás (v4.9)
-- ------------------------------------------------------------
INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'aviso_agua_cloro', '0',
       'Cloro después del carbón: el cloro que pasa se come las membranas', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'aviso_agua_cloro');

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'aviso_agua_tds', '0',
       'El agua de salida se pasó del TDS permitido', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'aviso_agua_tds');

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'aviso_agua_membranas', '0',
       'El rechazo de sales bajó del mínimo: las membranas se están acabando', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'aviso_agua_membranas');

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'aviso_agua_pieza', '0',
       'Una pieza ya cumplió su vida y toca cambiarla', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'aviso_agua_pieza');

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'aviso_agua_pieza_ultimo', '', 'Último día que se avisó', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'aviso_agua_pieza_ultimo');

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'aviso_agua_sin_lectura', '0',
       'Nadie tomó lectura de la planta de agua', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'aviso_agua_sin_lectura');

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'aviso_agua_sin_lectura_ultimo', '', 'Último día que se avisó', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'aviso_agua_sin_lectura_ultimo');

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'aviso_agua_falla', '0',
       'Cuando se reporta una falla de la planta de agua', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'aviso_agua_falla');
