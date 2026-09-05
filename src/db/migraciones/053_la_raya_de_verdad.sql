-- sin-transaccion
-- ============================================================
-- 053 · LA RAYA, COMO SE PAGA DE VERDAD  (v6.8)
-- ============================================================
--
-- "Aquí los sueldos pueden ser muy variados. Hay trabajadores que se les
--  paga por día, pero depende del día el sueldo es diferente: a veces los
--  sábados o los domingos se paga un poco más, o los días feriados o días
--  especiales entre la semana. Hay trabajadores que se les paga la
--  quincena, otros a la semana, otros diario, otros por horas."
--
-- Tres cosas hacían falta y ninguna estaba:
--
--   LAS CUATRO FORMAS DE PAGO. Había semanal y por día. Faltan la quincena
--   y la hora.
--
--   QUE EL DÍA VALGA DISTINTO. El sábado, el domingo y los días especiales
--   se pagan más. Se guarda como una tarifa aparte colgada del sueldo, y
--   vacía quiere decir "lo mismo que un día normal": así quien gana igual
--   todos los días no tiene que capturar cuatro números.
--
--   QUÉ SE TRABAJÓ DE VERDAD. El horario de costumbre dice qué días
--   VIENE; la raya necesita qué días VINO, y a qué hora. Eso son las
--   jornadas, y se apuntan día por día.

PRAGMA foreign_keys = OFF;

BEGIN;

-- --- 1. EL SUELDO, CON SUS CUATRO FORMAS Y SUS TARIFAS ---
CREATE TABLE sueldos_nuevo (
  id            TEXT PRIMARY KEY,
  usuario_id    TEXT NOT NULL REFERENCES usuarios(id),
  desde         TEXT NOT NULL,

  -- 'semanal'   — una cantidad fija por semana, venga los días que venga
  -- 'quincenal' — una cantidad fija por quincena
  -- 'por_dia'   — tanto por cada día trabajado
  -- 'por_hora'  — tanto por cada hora trabajada
  tipo          TEXT NOT NULL DEFAULT 'semanal'
                  CHECK (tipo IN ('semanal', 'quincenal', 'por_dia', 'por_hora')),
  -- Lo que vale un día normal (o la semana, o la quincena, según el tipo).
  centavos      INTEGER NOT NULL,

  -- Lo que vale ESE día cuando cae en sábado, domingo o día especial.
  -- Vacío = lo mismo que un día normal. Solo se usan en 'por_dia' y
  -- 'por_hora': a quien se le paga la semana completa le da igual en qué
  -- día cayó el trabajo.
  sabado_centavos   INTEGER,
  domingo_centavos  INTEGER,
  especial_centavos INTEGER,

  notas         TEXT,
  capturista_id TEXT REFERENCES usuarios(id),
  fecha_alta    TEXT NOT NULL,

  anulado_en    TEXT,
  anulado_por   TEXT REFERENCES usuarios(id)
);

INSERT INTO sueldos_nuevo
  (id, usuario_id, desde, tipo, centavos, notas, capturista_id, fecha_alta,
   anulado_en, anulado_por)
SELECT id, usuario_id, desde, tipo, centavos, notas, capturista_id, fecha_alta,
       anulado_en, anulado_por
  FROM sueldos;

DROP TABLE sueldos;
ALTER TABLE sueldos_nuevo RENAME TO sueldos;
CREATE INDEX idx_sueldos_usuario ON sueldos(usuario_id, desde);

COMMIT;

PRAGMA foreign_keys = ON;

-- --- 2. LOS DÍAS ESPECIALES ---
--
-- No hay lista fija: los marca el dueño cuando caen, o antes si ya sabe.
-- Un día marcado aquí se paga con la tarifa de especial para todo el que
-- cobre por día o por hora.
CREATE TABLE dias_especiales (
  id            TEXT PRIMARY KEY,
  dia           TEXT NOT NULL UNIQUE,       -- 'YYYY-MM-DD'
  nombre        TEXT NOT NULL,              -- "16 de septiembre", "la feria"
  notas         TEXT,
  capturista_id TEXT REFERENCES usuarios(id),
  fecha_alta    TEXT NOT NULL
);

CREATE INDEX idx_dias_especiales_dia ON dias_especiales(dia);

-- --- 3. LO QUE SE TRABAJÓ DE VERDAD, DÍA POR DÍA ---
--
-- Un renglón por persona y día. Las dos formas de apuntarlo conviven,
-- porque el dueño quiere las dos:
--
--   HORA DE ENTRADA Y SALIDA — y las horas salen solas de la resta.
--   HORAS TRABAJADAS a secas — para el que nada más dice "hice seis".
--
-- `vino = 0` es un día que no vino, y es un dato: sin él, "no vino" y "no
-- se ha capturado" serían lo mismo, y de eso depende que la raya cuadre.
CREATE TABLE jornadas (
  id            TEXT PRIMARY KEY,
  usuario_id    TEXT NOT NULL REFERENCES usuarios(id),
  dia           TEXT NOT NULL,              -- 'YYYY-MM-DD'

  -- Qué clase de día fue, copiado al guardar (regla 3.5): si mañana se
  -- desmarca un día especial, la raya que ya se pagó no cambia.
  tipo_dia      TEXT NOT NULL
                  CHECK (tipo_dia IN ('entre_semana','sabado','domingo','especial')),

  vino          INTEGER NOT NULL DEFAULT 1,
  entrada       TEXT,                       -- 'HH:MM', si se apuntó
  salida        TEXT,
  -- Las horas del día. Salen de entrada y salida cuando las hay; si no, se
  -- teclean. Se guardan siempre resueltas para que la raya no tenga que
  -- adivinar cuál de las dos formas se usó.
  horas         REAL,

  notas         TEXT,
  capturista_id TEXT REFERENCES usuarios(id),
  fecha_alta    TEXT NOT NULL,

  anulada_en    TEXT,
  anulada_por   TEXT REFERENCES usuarios(id)
);

-- Un día, un renglón por persona. Los anulados no estorban.
CREATE UNIQUE INDEX idx_jornada_unica ON jornadas(usuario_id, dia)
  WHERE anulada_en IS NULL;
CREATE INDEX idx_jornadas_usuario ON jornadas(usuario_id, dia);

-- --- 4. LA RAYA GUARDA CÓMO SE SACÓ ---
--
-- `detalle` lleva en JSON los días que se contaron, con su tipo y su
-- tarifa. Es lo que permite mirar una raya de hace tres meses y entender
-- de dónde salió el número, aunque desde entonces se le haya cambiado el
-- sueldo o desmarcado un día especial.
ALTER TABLE rayas ADD COLUMN tipo_sueldo     TEXT;
ALTER TABLE rayas ADD COLUMN horas_trabajadas REAL;
ALTER TABLE rayas ADD COLUMN detalle         TEXT;
