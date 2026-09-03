-- ============================================================
-- 036_la_raya.sql  (v4.8)
--
-- CÓMO SE LE PAGA A LA GENTE.
--
-- "Necesitamos la parte de cómo vamos a manejar el pago de los empleados.
--  Necesito una forma más visual donde anotar cuánto gana, qué días viene,
--  a qué hora llega, a qué hora se va, cuántos vales, e imprimir su balance
--  para darle su sueldo. A veces el sueldo se agarra de la caja, a veces se
--  hace el corte y luego se le da, ¿cómo quieres manejarlo?"
--
-- LA DECISIÓN, Y POR QUÉ
--
-- El pago SIEMPRE es un gasto de la fábrica, pero NO siempre sale del
-- cajón, y ahí está toda la dificultad:
--
--   · SI SALE DEL CAJÓN, el corte de ese turno tiene que restarlo, o al
--     contar el dinero va a faltar y nadie va a saber por qué.
--   · SI SALE DE FUERA —de la caja fuerte, del dinero que ya se retiró,
--     de una transferencia— el cajón NO se puede enterar. Ese dinero ya
--     salió del cajón como retiro; restarlo otra vez sería contarlo dos
--     veces y dejar el turno corto para siempre.
--
-- Así que al pagar se pregunta DE DÓNDE SALE, y solo hay dos respuestas.
-- El sistema ya sabía distinguirlas desde la v2.7: los gastos del cajón y
-- los gastos de la empresa son dos bolsas distintas que se suman juntas
-- al sacar el costo por marqueta. La raya entra por la puerta que le toque
-- y las dos cuentas siguen cuadrando.
--
-- (Y con esto el costo por marqueta deja de mentir: hasta hoy decía
--  expresamente que NO llevaba la raya, porque no había dónde anotarla.)
-- ============================================================

-- --- 1. CUÁNTO GANA CADA QUIEN ---
--
-- Un renglón por CAMBIO de sueldo, no uno por persona: el día que a Chuy
-- le suban, el aumento no puede reescribir lo que ganaba en marzo. Vale el
-- más reciente cuya fecha ya pasó (regla 3.2: nada se sobrescribe).
CREATE TABLE sueldos (
  id            TEXT PRIMARY KEY,
  usuario_id    TEXT NOT NULL REFERENCES usuarios(id),
  desde         TEXT NOT NULL,              -- desde qué día vale este sueldo

  -- 'semanal'  — una cantidad fija por semana, venga los días que venga
  -- 'por_dia'  — tanto por cada día trabajado
  tipo          TEXT NOT NULL DEFAULT 'semanal' CHECK (tipo IN ('semanal', 'por_dia')),
  centavos      INTEGER NOT NULL,

  notas         TEXT,
  capturista_id TEXT REFERENCES usuarios(id),
  fecha_alta    TEXT NOT NULL,

  anulado_en    TEXT,
  anulado_por   TEXT REFERENCES usuarios(id)
);

CREATE INDEX idx_sueldos_usuario ON sueldos(usuario_id, desde);

-- --- 2. QUÉ DÍAS VIENE Y A QUÉ HORA ---
--
-- El horario de costumbre, no un reloj checador: es lo que se contesta
-- cuando alguien pregunta "¿el martes quién abre?". Un día sin renglón es
-- un día que no viene, que es más claro que un renglón vacío.
--
-- `dia` va de 0 (domingo) a 6 (sábado), como el reloj del sistema.
CREATE TABLE horarios_empleado (
  id         TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  dia        INTEGER NOT NULL CHECK (dia BETWEEN 0 AND 6),
  entra      TEXT NOT NULL,                 -- 'HH:MM'
  sale       TEXT NOT NULL,
  notas      TEXT
);

CREATE UNIQUE INDEX idx_horario_unico ON horarios_empleado(usuario_id, dia);

-- --- 3. LA RAYA PAGADA ---
--
-- El papel que se firma al darle su dinero, con la cuenta entera:
--
--     sueldo + extras − vales − otros descuentos = se le pagó
--
-- Los importes se COPIAN aquí (regla 3.5): subirle el sueldo mañana no
-- puede cambiar lo que dice una raya que ya se firmó.
CREATE TABLE rayas (
  id         TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),

  -- La semana que se paga. Las dos fechas van impresas en el papel.
  desde      TEXT NOT NULL,
  hasta      TEXT NOT NULL,

  sueldo_centavos     INTEGER NOT NULL DEFAULT 0,
  dias_trabajados     INTEGER,              -- solo cuando el sueldo es por día
  extras_centavos     INTEGER NOT NULL DEFAULT 0,
  extras_notas        TEXT,
  vales_centavos      INTEGER NOT NULL DEFAULT 0,
  descuentos_centavos INTEGER NOT NULL DEFAULT 0,
  descuentos_notas    TEXT,
  pagado_centavos     INTEGER NOT NULL,

  -- DE DÓNDE SALIÓ EL DINERO. Es la pregunta que decide si el cajón se
  -- entera o no, y por eso es obligatoria.
  --   'cajon' — salió del cajón; deja su movimiento y el corte lo resta
  --   'fuera' — de la caja fuerte, del dinero ya retirado, o transferencia;
  --             el cajón no lo ve, y se anota como gasto de la empresa
  de_donde   TEXT NOT NULL CHECK (de_donde IN ('cajon', 'fuera')),
  movimiento_id     TEXT REFERENCES movimientos_caja(id),
  gasto_empresa_id  TEXT REFERENCES gastos_empresa(id),

  pagada_en  TEXT NOT NULL,
  pagada_por TEXT REFERENCES usuarios(id),
  notas      TEXT,

  anulada_en       TEXT,
  anulada_por      TEXT REFERENCES usuarios(id),
  motivo_anulacion TEXT
);

CREATE INDEX idx_rayas_usuario ON rayas(usuario_id, hasta);
CREATE INDEX idx_rayas_fecha   ON rayas(pagada_en);

-- Qué vales entraron en qué raya. Sin esto, un vale descontado no sabe de
-- qué pago salió, y "ya se le descontó" se queda sin respaldo.
ALTER TABLE adelantos ADD COLUMN raya_id TEXT REFERENCES rayas(id);
CREATE INDEX idx_adelantos_raya ON adelantos(raya_id);

-- --- 4. LOS DOS CONCEPTOS DEL PAGO ---
--
-- Uno en cada bolsa, para que la raya sume igual salga por donde salga.
INSERT INTO conceptos_gasto (id, nombre, tipo, orden, ayuda, fecha_alta)
SELECT 'gasto-sueldos', 'Sueldos', 'salida', 7,
       'El pago de la semana, cuando sale del cajón', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM conceptos_gasto WHERE id = 'gasto-sueldos');

INSERT INTO conceptos_empresa (id, nombre, orden, ayuda, activo, fecha_alta)
SELECT 'emp-sueldos', 'Sueldos', 7,
       'El pago de la semana, cuando no sale del cajón', 1, datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM conceptos_empresa WHERE id = 'emp-sueldos');

-- --- 5. EL DÍA DE PAGO ---
--
-- "Pagamos a la semana." Saber qué día cierra la semana es lo que deja
-- proponer el periodo solo, sin que nadie teclee dos fechas cada viernes.
INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'raya_dia_pago', '6',
       'Día de la semana en que se paga la raya (0 domingo … 6 sábado)',
       datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'raya_dia_pago');
