-- ============================================================
-- 028_temperatura.sql  (v3.6)
--
-- DOS TEMPERATURAS QUE NO TIENEN NADA QUE VER ENTRE SÍ.
--
-- LA DE AFUERA. En una fábrica de hielo el clima es materia prima: en
-- mayo, cuando calientan los tanques, el hielo simplemente no se forma por
-- más días que pase en el molde. Ese dato hoy no está en ninguna parte, y
-- dentro de un año, mirando un mes malo, no habrá manera de saber si hizo
-- calor. Se toma de internet cada rato y se guarda, para que cuando haga
-- falta ya exista.
--
-- Se guarda UNA MEDIDA POR HORA como mucho. Con eso se tiene la máxima y
-- la mínima de cada día, que es lo que sirve, sin llenar la base de
-- renglones que nadie va a leer.
--
-- SI NO HAY INTERNET NO PASA NADA. El sistema sigue trabajando igual: la
-- temperatura es un dato de más, no una condición para vender hielo. Se
-- enseña la última que se pudo tomar, diciendo de cuándo es, y se puede
-- escribir a mano si alguien la mira en el termómetro de la pared.
--
-- LA DE ADENTRO es otra cosa: la salmuera de los tanques. Se mide de vez
-- en cuando, con tres tomas —cerca de los serpentines, en la salida más
-- cercana y en la más lejana— y lo que interesa es el promedio. No tiene
-- horario: se hace cuando alguien se acuerda. Aquí solo se guarda, con su
-- fecha y quién la tomó, porque son datos que a veces sirven.
--
-- EL PROMEDIO NO SE GUARDA (regla 3.2): se calcula de las tres tomas cada
-- vez. Un promedio guardado es un número que puede dejar de cuadrar con
-- los suyos el día que alguien corrija una toma.
-- ============================================================

CREATE TABLE clima_registros (
  id           TEXT PRIMARY KEY,
  fecha        TEXT NOT NULL,
  -- Grados centígrados, con un decimal. Se guardan como número real
  -- porque aquí no hay nada que cuadrar: es una lectura, no dinero.
  temperatura  REAL NOT NULL,
  -- Lo que se siente, que en Yucatán no es lo mismo que lo que marca.
  sensacion    REAL,
  humedad      REAL,
  -- 'internet' o 'mano': quién lo dijo importa para saber si fiarse.
  fuente       TEXT NOT NULL DEFAULT 'internet'
                 CHECK (fuente IN ('internet', 'mano')),
  ejecutor_id  TEXT REFERENCES usuarios(id)
);

CREATE INDEX idx_clima_fecha ON clima_registros(fecha);

CREATE TABLE temperaturas_salmuera (
  id            TEXT PRIMARY KEY,
  tanque_id     TEXT NOT NULL REFERENCES tanques(id),
  fecha         TEXT NOT NULL,
  -- Las tres tomas. Van en grados y pueden ser negativas: la salmuera
  -- trabaja bajo cero.
  serpentines   REAL,
  salida_cerca  REAL,
  salida_lejos  REAL,
  notas         TEXT,
  -- Regla 3.6: quién la tomó y quién la anotó.
  ejecutor_id   TEXT REFERENCES usuarios(id),
  capturista_id TEXT REFERENCES usuarios(id),
  -- Regla 3.4: nada se borra.
  anulada_en    TEXT,
  anulada_por   TEXT REFERENCES usuarios(id),
  motivo_anulacion TEXT
);

CREATE INDEX idx_salmuera_tanque ON temperaturas_salmuera(tanque_id, fecha);

-- Dónde está la fábrica, para pedirle el clima a internet. Hunucmá,
-- Yucatán. Se puede cambiar desde Personalizar si algún día hace falta.
INSERT OR IGNORE INTO configuracion (clave, valor, descripcion, actualizado_en) VALUES
  ('clima_latitud',  '21.0167',  'Dónde está la fábrica, para el clima', datetime('now')),
  ('clima_longitud', '-89.8747', 'Dónde está la fábrica, para el clima', datetime('now')),
  ('clima_activo',   '1',        'Pedirle la temperatura a internet',    datetime('now'));
