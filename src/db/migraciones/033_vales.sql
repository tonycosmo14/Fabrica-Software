-- ============================================================
-- 033_vales.sql  (v4.3)
--
-- LOS VALES.
--
-- En la fábrica se le dice "vale" a dos cosas que se escriben en el mismo
-- papelito y son OPUESTAS. Meterlas en el mismo cajón del sistema sería
-- garantizar que nunca se puedan separar:
--
--   · VALE DE RETIRO. El dueño, un gerente o el papá del dueño llegan y se
--     llevan efectivo del cajón para que las muchachas no tengan mucho
--     dinero junto. Ese dinero NO SE GASTÓ: cambió de sitio, y sigue
--     siendo de la fábrica. Nadie queda debiendo nada.
--
--   · VALE DE RAYA. Un trabajador pide por adelantado una parte de su
--     sueldo de la semana. Ese dinero SÍ ES GASTO —el sueldo es gasto de
--     la fábrica— pero es un gasto que hay que RECORDAR, porque el día de
--     la raya se le tiene que pagar de menos.
--
-- LO QUE SE DECIDIÓ, Y POR QUÉ
--
-- El vale de raya no se guarda como préstamo ni como traspaso: se guarda
-- como lo que es, sueldo pagado antes de tiempo. Si se marcara como
-- traspaso no contaría como gasto del mes, y entonces la única forma de
-- que las cuentas cerraran sería anotar el sábado la raya COMPLETA aunque
-- del cajón salga menos — y ahí el cajón quedaría corto todos los sábados.
--
-- Así que el gasto ocurre cuando el dinero sale, una sola vez:
--
--     martes    vale de raya      $400   ← gasto (sueldo)
--     sábado    lo que le falta $1,100   ← gasto (sueldo)
--                               ──────
--                               $1,500   ← su sueldo, contado UNA vez
--
-- Y la tabla de abajo no es contabilidad: es el RECORDATORIO de que el
-- sábado son $1,100 y no $1,500. Con eso basta, y por eso no lleva nada
-- más de lo que necesita para eso.
--
-- (Cuando exista la nómina, esta tabla es de donde va a leer el descuento.
--  Está hecha para eso, pero no lo supone.)
-- ============================================================

-- --- 1. Los conceptos saben si son un vale ---
--
-- `es_traspaso` ya decía si el dinero se gastó o solo cambió de sitio.
-- `es_vale` dice otra cosa distinta, y por eso es otra columna: si el
-- dinero se lo llevó UNA PERSONA CON NOMBRE, contra su firma. Las dos
-- banderas son independientes a propósito:
--
--     retiro a la caja fuerte   vale = 1   traspaso = 1  (no es gasto)
--     vale de raya              vale = 1   traspaso = 0  (sí es gasto)
--     gasolina                  vale = 0   traspaso = 0  (sí es gasto)
--
-- El corte las usa para no revolver en la misma suma la gasolina de la
-- camioneta con los $2,000 que se llevó el patrón.
ALTER TABLE conceptos_gasto ADD COLUMN es_vale INTEGER NOT NULL DEFAULT 0;

UPDATE conceptos_gasto SET es_vale = 1 WHERE id = 'gasto-retiro';

INSERT INTO conceptos_gasto (id, nombre, tipo, orden, ayuda, es_vale, es_traspaso, fecha_alta)
SELECT 'gasto-vale-raya', 'Vale de raya', 'salida', 6,
       'Parte del sueldo de la semana, pedida antes', 1, 0, datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM conceptos_gasto WHERE id = 'gasto-vale-raya');

-- --- 2. La libreta de vales de raya ---
--
-- Un renglón por vale. NO hay ninguna columna con "cuánto debe" (regla
-- 3.2): eso se suma de los renglones cada vez que se pregunta. Un saldo
-- guardado se desincroniza el día que algo se corte a la mitad; una suma
-- de renglones, no puede.
--
-- Y no se borra ninguno (regla 3.4): un vale mal capturado se anula con su
-- motivo, y el que ya se descontó se queda marcado, no desaparece. El
-- sábado que se pagó tiene que poder mirarse en enero.
CREATE TABLE adelantos (
  id             TEXT PRIMARY KEY,
  usuario_id     TEXT NOT NULL REFERENCES usuarios(id),
  fecha          TEXT NOT NULL,
  centavos       INTEGER NOT NULL,

  -- De qué cajón salió el dinero. Va suelto a propósito: si mañana un
  -- vale se paga de la caja fuerte y no del cajón, este renglón sigue
  -- valiendo sin movimiento.
  movimiento_id  TEXT REFERENCES movimientos_caja(id),
  caja_id        TEXT REFERENCES cajas(id),

  -- Doble responsable (regla 3.6): el trabajador es `usuario_id`, y quien
  -- le entregó el dinero es el capturista. Casi siempre son distintos.
  capturista_id  TEXT REFERENCES usuarios(id),
  notas          TEXT,

  -- El día de la raya se marca "ya se le descontó". No mueve dinero:
  -- apaga el recordatorio, y deja escrito quién lo apagó.
  descontado_en   TEXT,
  descontado_por  TEXT REFERENCES usuarios(id),
  descontado_nota TEXT,

  anulado_en       TEXT,
  anulado_por      TEXT REFERENCES usuarios(id),
  motivo_anulacion TEXT
);

CREATE INDEX idx_adelantos_usuario ON adelantos(usuario_id, fecha);
CREATE INDEX idx_adelantos_mov     ON adelantos(movimiento_id);
CREATE INDEX idx_adelantos_caja    ON adelantos(caja_id);

-- --- 3. Las bolsas, por tamaño ---
--
-- "Las bolsas de 20 kg es muy raro que las hagamos, han pasado años; lo
--  común es la de 5 kg."
--
-- La bolsa que se sembró en la v4.1 se llamaba "gourmet" y en realidad es
-- la de todos los días. Se le cambia el NOMBRE, no el id (regla 3.3): los
-- cortes que ya le metieron bolsas siguen apuntando al mismo producto y no
-- se enteran. Solo se renombra si nadie la ha renombrado ya a mano.
UPDATE productos
   SET nombre = 'Bolsa de hielo de 5 kg', codigo = 'B5'
 WHERE id = 'prod-bolsa-gourmet' AND nombre = 'Bolsa de hielo gourmet';

-- Y la de 20 kg queda sembrada y dada de baja, esperando. Nace igual que
-- la otra —sin precio y de baja— y se da de alta sola el día que un corte
-- le meta las primeras bolsas. Tenerla dada de alta desde hoy sería un
-- AGOTADO permanente en la caja por un producto que no se hace hace años.
INSERT INTO productos (id, codigo, nombre, categoria_id, tipo, precio_centavos,
                       lleva_inventario, minimo, orden, activo, fecha_alta)
SELECT 'prod-bolsa-20', 'B20', 'Bolsa de hielo de 20 kg', 'cat-hielo', 'simple',
       0, 1, NULL, 21, 0, datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM productos WHERE id = 'prod-bolsa-20');
