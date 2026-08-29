-- ============================================================
-- LAS CUENTAS DE LA EMPRESA  (v2.7)
--
-- Hasta aquí el sistema sabía del dinero que pasa por el cajón: las
-- ventas, los gastos chicos del día, los abonos. Pero una fábrica de hielo
-- gasta la mayor parte de su dinero en cosas que NUNCA tocan ese cajón: el
-- amoniaco, la sal, los barriles de aceite, una compostura de la máquina, y
-- sobre todo la luz, que en una fábrica de hielo suele ser el gasto más
-- grande de todos.
--
-- Eso es lo que se guarda aquí. Y va DELIBERADAMENTE APARTE de la caja:
--
--  · No entra en el arqueo del turno. Si un gasto de $40,000 de amoniaco
--    entrara al cajón, el corte del cajero saldría corto por cuarenta mil
--    pesos que él nunca vio.
--  · No lo captura el cajero. Lo captura el administrador cuando llega la
--    factura, que puede ser semanas después de la compra.
--  · Se paga por transferencia, con cheque o del dinero de la caja fuerte:
--    de sitios que el programa no cuadra al final del día.
--
-- Los gastos CHICOS del cajón siguen donde estaban (conceptos_gasto, v2.5).
-- Son dos cosas distintas y por eso son dos tablas distintas.
-- ============================================================


-- ── EL MES DEL NEGOCIO ──
--
-- "El recibo de luz no es del 1 al 30, es del 12 al 12, a veces del 15 al
--  15." Comparar un recibo del 12 al 12 contra las ventas del 1 al 31 es
-- comparar dos cosas distintas. Así que el mes empieza el día que se diga.
--
-- Arranca en 1 —el mes del calendario de siempre— porque quien no configure
-- nada no tiene por qué entender nada. Va del 1 al 28: con el corte en 30,
-- febrero no tiene ese día y el periodo empezaría distinto cada año.
INSERT INTO configuracion (clave, valor, descripcion, actualizado_en) VALUES
  ('periodo_dia_corte', '1',
   'Día en que empieza el mes del negocio, del 1 al 28', datetime('now'));


-- ── EL DINERO QUE SOLO SE MUEVE ──
--
-- Este es el error más caro que puede tener este módulo, y el más
-- silencioso: EL MISMO PESO CONTADO DOS VECES.
--
-- Pasa así. Tony saca $40,000 del cajón: eso es una salida de caja, y el
-- corte del turno la resta bien. Con ese dinero paga el amoniaco: eso es un
-- gasto de la empresa. Los dos renglones son correctos y los dos son
-- necesarios —uno cuadra el cajón, el otro dice en qué se fue—, pero
-- sumados dicen que la fábrica gastó ochenta mil pesos, y gastó cuarenta.
--
-- La diferencia es que un retiro a la caja fuerte NO ES UN GASTO: el dinero
-- no salió de la empresa, solo cambió de sitio. Es un TRASPASO. Marcarlo
-- ahora cuesta una columna; descubrirlo dentro de un año, con las
-- estadísticas ya hechas, cuesta volver a mirar cada renglón capturado.
ALTER TABLE conceptos_gasto ADD COLUMN es_traspaso INTEGER NOT NULL DEFAULT 0;

UPDATE conceptos_gasto SET es_traspaso = 1 WHERE id = 'gasto-retiro';


-- ── EN QUÉ SE GASTA ──
--
-- El catálogo. Igual que los gastos chicos del cajón: escrito a mano, a
-- fin de año hay "amoniaco", "Amoniaco" y "AMONIACO", que son tres cosas
-- distintas y ninguna estadística.
CREATE TABLE conceptos_empresa (
  id          TEXT PRIMARY KEY,
  nombre      TEXT NOT NULL,

  -- EN QUÉ SE COMPRA. Un barril de aceite y un litro de aceite no son lo
  -- mismo, y sin la unidad no se puede decir si el precio subió: $12,000
  -- puede ser una ganga o un robo según cuántos barriles vinieran.
  unidad      TEXT,

  -- CADA CUÁNTO SE COMPRA, en días. No es una alarma: es para poder decir
  -- "el amoniaco se compra cada tres meses y la última fue hace ciento
  -- veinte días". Vacío = no se sabe o no tiene ritmo.
  cada_dias   INTEGER,

  ayuda       TEXT,
  orden       INTEGER NOT NULL DEFAULT 0,

  activo      INTEGER NOT NULL DEFAULT 1,
  fecha_alta  TEXT NOT NULL,
  fecha_baja  TEXT
);

CREATE UNIQUE INDEX idx_concepto_empresa_nombre
  ON conceptos_empresa(lower(nombre)) WHERE activo = 1;


-- ── LO QUE SE COMPRÓ ──
CREATE TABLE gastos_empresa (
  id            TEXT PRIMARY KEY,

  -- EL DÍA DE LA COMPRA, no el de la captura. Son distintos a propósito:
  -- una factura de amoniaco de marzo puede capturarse en mayo, y ese gasto
  -- es de marzo. Se guarda como día de calendario (2026-08-26) y no como
  -- instante: "¿de qué mes es esta compra?" es una pregunta de calendario.
  fecha         TEXT NOT NULL,

  concepto_id   TEXT REFERENCES conceptos_empresa(id),
  -- COPIADO (regla 3.5): si mañana el concepto se renombra, la factura de
  -- hace un año sigue diciendo lo que decía. La estadística suma por id.
  concepto      TEXT NOT NULL,

  proveedor     TEXT,

  -- CUÁNTO SE COMPRÓ y en qué. Lleva decimales a propósito —"50.5 kilos de
  -- sal" es un dato de verdad— y no es dinero: el dinero sigue en centavos
  -- enteros, aquí abajo. De estos dos sale el precio por unidad, que se
  -- CALCULA y no se guarda (regla 3.2).
  cantidad      REAL,
  unidad        TEXT,

  -- Lo que se pagó EN TOTAL, en centavos enteros.
  centavos      INTEGER NOT NULL,

  forma_pago    TEXT NOT NULL DEFAULT 'transferencia'
                CHECK (forma_pago IN ('transferencia','efectivo','cheque','tarjeta','credito')),

  -- SI EL DINERO SALIÓ DEL CAJÓN, DE CUÁL SALIDA.
  --
  -- El otro lado del traspaso: cuando el amoniaco se pagó con el efectivo
  -- que se retiró del cajón, aquí se apunta ESA salida. Así la estadística
  -- puede decir "de estos $40,000, ya estaban contados como retiro" en vez
  -- de sumarlos otra vez.
  --
  -- Casi siempre va vacío: lo grande se paga por transferencia.
  movimiento_caja_id TEXT REFERENCES movimientos_caja(id),

  -- Para poder defender el renglón contra el papel.
  factura       TEXT,
  archivo       TEXT,                       -- el PDF o la foto, en datos/empresa
  notas         TEXT,

  -- Regla 3.6: quién lo compró y quién lo capturó.
  ejecutor_id   TEXT REFERENCES usuarios(id),
  capturista_id TEXT REFERENCES usuarios(id),
  fecha_captura TEXT NOT NULL,

  -- Regla 3.4: nada se borra.
  anulado_en    TEXT,
  anulado_por   TEXT REFERENCES usuarios(id),
  motivo_anulacion TEXT
);

CREATE INDEX idx_gasto_empresa_fecha    ON gastos_empresa(fecha);
CREATE INDEX idx_gasto_empresa_concepto ON gastos_empresa(concepto_id, fecha);


-- ── LOS RECIBOS DE LA LUZ ──
--
-- Van en su propia tabla y no como un gasto más, por una razón: un recibo
-- de CFE trae un dato que ningún otro gasto tiene —los KILOWATTS— y ese
-- dato es el que contesta la pregunta que importa en una fábrica de hielo:
-- cuánta luz cuesta cada marqueta.
--
-- Y trae SUS PROPIAS FECHAS. El mes del negocio es una regla pareja para
-- todo lo demás; este papel dice exactamente de cuándo a cuándo midieron, y
-- sus cuentas se hacen con esas fechas y no con las nuestras. Cuando la CFE
-- cambia de día —"a veces del 15 al 15"— el recibo lo dice solo.
CREATE TABLE recibos_cfe (
  id            TEXT PRIMARY KEY,

  desde         TEXT NOT NULL,              -- las fechas impresas en el recibo
  hasta         TEXT NOT NULL,

  kwh           INTEGER NOT NULL,           -- kilowatts-hora consumidos
  centavos      INTEGER NOT NULL,           -- lo que cobraron, en centavos

  -- El número de servicio o de recibo, para buscarlo con la CFE.
  numero        TEXT,
  archivo       TEXT,                       -- el PDF, en datos/empresa
  notas         TEXT,

  capturista_id TEXT REFERENCES usuarios(id),
  fecha_captura TEXT NOT NULL,

  anulado_en    TEXT,
  anulado_por   TEXT REFERENCES usuarios(id),
  motivo_anulacion TEXT
);

-- El mismo recibo capturado dos veces duplicaría el gasto del año y
-- partiría a la mitad los kilowatts por marqueta. Dos recibos no pueden
-- cubrir exactamente el mismo periodo.
CREATE UNIQUE INDEX idx_cfe_periodo
  ON recibos_cfe(desde, hasta) WHERE anulado_en IS NULL;

CREATE INDEX idx_cfe_desde ON recibos_cfe(desde);


-- Unos conceptos de arranque: los que Tony nombró. Se editan y se dan de
-- baja desde la pantalla; están aquí para que el primer día haya algo que
-- tocar y se entienda para qué sirve la unidad.
INSERT INTO conceptos_empresa (id, nombre, unidad, cada_dias, ayuda, orden, fecha_alta) VALUES
  ('emp-amoniaco', 'Amoniaco',     'cilindro', 90,  'El refrigerante de las máquinas', 1, datetime('now')),
  ('emp-sal',      'Sal',          'saco',     30,  'Para el agua de los tanques',     2, datetime('now')),
  ('emp-aceite',   'Aceite',       'barril',   120, 'Para los compresores',            3, datetime('now')),
  ('emp-refac',    'Refacciones',  'pieza',    NULL, 'Bandas, empaques, lo que se rompe', 4, datetime('now')),
  ('emp-mantto',   'Mantenimiento','servicio', NULL, 'El mecánico, el electricista',   5, datetime('now')),
  ('emp-maquina',  'Maquinaria',   'pieza',    NULL, 'Compras grandes que duran años', 6, datetime('now'));
