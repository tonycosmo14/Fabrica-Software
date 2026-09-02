-- ============================================================
-- 029_luz_iva.sql  (v3.7)
--
-- EL RECIBO DE LUZ COMPLETO, Y EL IVA QUE NOS DEBEN.
--
-- 1. LA LUZ AL DETALLE
--
-- La fábrica está en tarifa GDMTH (Gran Demanda en Media Tensión
-- Horaria), y en esa tarifa el recibo NO es un número: el mismo kilowatt
-- cuesta distinto según la hora en que se gastó. Hay tres franjas:
--
--     BASE        la madrugada y la mañana temprano. La barata.
--     INTERMEDIA  casi todo el día.
--     PUNTA       las horas de más demanda de la tarde. La cara.
--
-- Guardando solo el total, el recibo dice cuánto se pagó y nada más.
-- Guardando las tres franjas se puede contestar la pregunta que de verdad
-- vale en una fábrica de hielo: ¿conviene mover producción de horario?
-- Un tanque que congela de madrugada usa el mismo amoniaco y cuesta menos
-- luz, y eso solo se ve si las franjas están separadas.
--
-- LOS PESOS DE CADA FRANJA VAN APARTE Y SON OPCIONALES. En unos recibos
-- vienen desglosados y en otros no; cuando vienen, se anotan y sale el
-- precio del kilowatt de cada franja. Cuando no vienen, se deja vacío y
-- no pasa nada: el total sigue siendo el que manda.
--
-- LA LECTURA DEL MEDIDOR es la otra cosa que faltaba. Es lo único que
-- permite comprobar el recibo contra el aparato de la pared: si la CFE
-- dice que se gastaron 40,000 kWh y la diferencia de lecturas no da eso,
-- hay algo que reclamar. Y con el multiplicador —los medidores de media
-- tensión no cuentan de uno en uno— la cuenta cuadra.
--
-- 2. EL IVA QUE NOS DEBEN
--
-- "A veces ya no se sabe qué IVA nos deben." Ese es el problema entero.
-- El IVA de la luz se paga cada mes y se recupera después, a destiempo y
-- en cantidades que no coinciden con ningún recibo, así que la cuenta se
-- lleva de memoria y se pierde.
--
-- Aquí se apunta el IVA de cada factura —el de la luz y el de los gastos
-- grandes— y por otro lado lo que el SAT devuelve. La diferencia entre
-- los dos es lo que falta por recuperar, y ese número deja de estar en la
-- cabeza de nadie.
-- ============================================================

-- --- La luz, al detalle ---

-- Lo que marcaba el aparato al principio y al final del periodo.
ALTER TABLE recibos_cfe ADD COLUMN lectura_anterior REAL;
ALTER TABLE recibos_cfe ADD COLUMN lectura_actual   REAL;
-- Los medidores de media tensión no cuentan de uno en uno: lo que marcan
-- se multiplica por una constante que viene impresa en el recibo.
ALTER TABLE recibos_cfe ADD COLUMN multiplicador    REAL;

-- Los kilowatts de cada franja. Suman (o deberían sumar) el total.
ALTER TABLE recibos_cfe ADD COLUMN kwh_base        INTEGER;
ALTER TABLE recibos_cfe ADD COLUMN kwh_intermedia  INTEGER;
ALTER TABLE recibos_cfe ADD COLUMN kwh_punta       INTEGER;

-- Y lo que costó cada una, si el recibo lo desglosa. Opcional.
ALTER TABLE recibos_cfe ADD COLUMN centavos_base       INTEGER;
ALTER TABLE recibos_cfe ADD COLUMN centavos_intermedia INTEGER;
ALTER TABLE recibos_cfe ADD COLUMN centavos_punta      INTEGER;

-- La demanda facturable en kW y el factor de potencia: los otros dos
-- números que mueven el precio de un recibo GDMTH. Opcionales.
ALTER TABLE recibos_cfe ADD COLUMN demanda_kw       REAL;
ALTER TABLE recibos_cfe ADD COLUMN factor_potencia  REAL;

-- EL IVA DEL RECIBO. Se paga con la luz y se recupera después: por eso va
-- aparte del total y no dentro.
ALTER TABLE recibos_cfe ADD COLUMN iva_centavos INTEGER;

-- --- El IVA de las facturas de los gastos grandes ---
-- Sin esto, el saldo de IVA solo miraría la luz y estaría mal por la
-- mitad: el amoniaco y la maquinaria también lo llevan.
ALTER TABLE gastos_empresa ADD COLUMN iva_centavos INTEGER;

-- --- Lo que el SAT devuelve ---

CREATE TABLE iva_devoluciones (
  id            TEXT PRIMARY KEY,
  -- El día en que entró el dinero (o se acreditó).
  fecha         TEXT NOT NULL,
  centavos      INTEGER NOT NULL CHECK (centavos > 0),
  -- Devuelto en efectivo, o acreditado contra otro impuesto: no es lo
  -- mismo para la contabilidad, y quien lo apunta lo sabe.
  tipo          TEXT NOT NULL DEFAULT 'devolucion'
                  CHECK (tipo IN ('devolucion', 'acreditamiento', 'otro')),
  -- A qué periodo corresponde, tal como lo diga el papel del SAT.
  periodo       TEXT,
  -- El folio del trámite, para poder buscarlo.
  folio         TEXT,
  archivo       TEXT,
  notas         TEXT,
  capturista_id TEXT REFERENCES usuarios(id),
  fecha_captura TEXT NOT NULL,
  anulado_en    TEXT,
  anulado_por   TEXT REFERENCES usuarios(id),
  motivo_anulacion TEXT
);

CREATE INDEX idx_iva_fecha ON iva_devoluciones(fecha);
