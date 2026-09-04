-- ============================================================
-- 039_neveras.sql  (v5.1)
--
-- LAS NEVERAS EN COMODATO.
--
-- "Control de las neveras que damos a comodato para el hielo en cubos:
--  saber dónde están, con dirección escrita, ubicación en Google Maps,
--  quién es el responsable, subir la captura de su documento firmado,
--  poder imprimir el documento rápido cuando hay un nuevo cliente, ver
--  cómo va esa nevera, su historial de mantenimientos, cuánto ha ganado
--  vs lo que costó."
--
-- ============================================================
-- LA DECISIÓN QUE MANDA: LA NEVERA Y EL PRÉSTAMO SON DOS COSAS
-- ============================================================
--
-- Una nevera es un fierro que dura diez años y pasa por tres o cuatro
-- clientes. El comodato es el préstamo a UNO de ellos.
--
-- Si se guardaran juntos, el día que se recoge la nevera de Don Chuy y se
-- le pone a la tienda de la esquina habría que decidir entre dos cosas
-- malas: pisar los datos del anterior —y perder la historia de esa
-- nevera— o dar de alta otra nevera —y perder que es la misma—.
--
-- Separadas, cada una acumula lo suyo:
--
--   LA NEVERA guarda su vida entera: lo que costó, sus mantenimientos,
--   por cuántas manos ha pasado, cuánto ha ganado en total.
--
--   CADA COMODATO guarda su préstamo: a quién, desde cuándo, en qué
--   dirección, quién responde por ella, y el papel firmado.
--
-- Es la misma idea de la regla 3.3 —ids estables, nombres editables—
-- llevada a un objeto que se mueve.
--
-- ============================================================
-- Y NO TODAS LAS NEVERAS ESTÁN CON UN CLIENTE
-- ============================================================
--
-- "¿Solo los clientes usan las neveras? NO. A veces hay ferias, o eventos
--  grandes, y se prestan por un día, o una semana. En cambio con los
--  clientes son años. Algunas están dadas de baja, otras no funcionan,
--  alguna no tengo idea dónde está, y otras se usan en la fábrica."
--
-- Por eso el comodato tiene TIPO, y la nevera tiene ESTADO — incluido
-- `perdida`, que es un estado de verdad y no un error de captura. Una
-- nevera que no se sabe dónde está tiene que poder decirse; si la única
-- salida fuera darla de baja, se perdería la diferencia entre "se vendió"
-- y "se nos perdió", que es justo la que importa.
-- ============================================================

-- ------------------------------------------------------------
-- LA NEVERA: el fierro
-- ------------------------------------------------------------
CREATE TABLE neveras (
  id             TEXT PRIMARY KEY,

  -- EL NÚMERO ECONÓMICO, el que va pegado en la nevera. Sin él, cuando el
  -- repartidor dice "la de la tienda de la esquina" nadie sabe cuál es.
  numero         TEXT NOT NULL UNIQUE,

  marca          TEXT,
  modelo         TEXT,
  serie          TEXT,
  -- Cuántas bolsas le caben. Es lo que decide a qué cliente le queda.
  bolsas         INTEGER,
  -- Lo que costó. Es la mitad de "¿esta nevera ya se pagó?".
  costo_centavos INTEGER,
  fecha_compra   TEXT,
  foto           TEXT,

  -- DÓNDE ESTÁ, en una palabra:
  --   bodega      en la fábrica, lista para prestarse
  --   prestada    con alguien (tiene un comodato vigente)
  --   en_uso      la está usando la fábrica
  --   reparacion  no sirve, hay que arreglarla
  --   perdida     no se sabe dónde está
  --   baja        se vendió, se tiró o se dio por perdida para siempre
  estado         TEXT NOT NULL DEFAULT 'bodega'
                 CHECK (estado IN ('bodega','prestada','en_uso','reparacion','perdida','baja')),

  notas          TEXT,
  fecha_alta     TEXT NOT NULL,
  creado_por     TEXT REFERENCES usuarios(id),
  -- Regla 3.4: nada se borra. Una nevera de baja se queda con su historia.
  baja_en        TEXT,
  baja_por       TEXT REFERENCES usuarios(id),
  motivo_baja    TEXT
);

CREATE INDEX idx_neveras_estado ON neveras(estado);
CREATE INDEX idx_neveras_numero ON neveras(numero);

-- ------------------------------------------------------------
-- EL COMODATO: el préstamo
-- ------------------------------------------------------------
CREATE TABLE comodatos (
  id             TEXT PRIMARY KEY,
  nevera_id      TEXT NOT NULL REFERENCES neveras(id),

  -- A QUIÉN. Con un cliente dado de alta se usa `cliente_id`; una feria de
  -- tres días no merece un cliente en el catálogo para siempre, y para eso
  -- está `nombre_libre` — el mismo camino que ya usan los paños sacados
  -- por alguien que no está en el sistema.
  tipo           TEXT NOT NULL DEFAULT 'cliente'
                 CHECK (tipo IN ('cliente','evento','fabrica')),
  cliente_id     TEXT REFERENCES clientes(id),
  nombre_libre   TEXT,

  desde          TEXT NOT NULL,
  -- Lo que se acordó devolver. Para un cliente va vacío (son años); para
  -- una feria es la fecha en que hay que ir por ella, y es lo que hace que
  -- el sistema pueda avisar de las que ya se pasaron.
  hasta_previsto TEXT,
  -- Cuándo volvió de verdad. Vacío = sigue prestada.
  devuelta_en    TEXT,
  devuelta_por   TEXT REFERENCES usuarios(id),
  motivo_retiro  TEXT,

  -- DÓNDE ESTÁ PUESTA. La dirección escrita es la que manda: el mapa
  -- necesita internet y la dirección no.
  direccion      TEXT,
  referencias    TEXT,
  latitud        REAL,
  longitud       REAL,

  -- QUIÉN RESPONDE por ella. No siempre es el dueño del negocio: es quien
  -- firmó y a quien se le llama.
  responsable    TEXT,
  telefono       TEXT,

  -- El papel firmado, escaneado o fotografiado.
  documento      TEXT,
  documento_en   TEXT,

  -- CADA CUÁNTOS DÍAS DEBERÍA PEDIR.
  --
  -- "La cantidad de días para el aviso la decido yo por cada cliente, ya
  --  que hay unos más lentos y otros más rápidos."
  --
  -- Vacío = se usa el número general de configuración. Va aquí y no en el
  -- cliente porque lo que se vigila es ESTA nevera en ESTE lugar: un
  -- cliente con dos sucursales puede tener una que vuela y otra lenta.
  dias_aviso     INTEGER,

  notas          TEXT,
  fecha_alta     TEXT NOT NULL,
  creado_por     TEXT REFERENCES usuarios(id)
);

CREATE INDEX idx_comodatos_nevera ON comodatos(nevera_id, desde);
CREATE INDEX idx_comodatos_cliente ON comodatos(cliente_id);
CREATE INDEX idx_comodatos_vigentes ON comodatos(devuelta_en);

-- ------------------------------------------------------------
-- LOS SERVICIOS: fallas y mantenimientos, en la misma tabla
--
-- "Botones para cuando un cliente reporta falla, para saber que le falta
--  mantenimiento" y "su historial de mantenimientos".
--
-- Son la misma cosa mirada en dos momentos: un reporte de falla es un
-- servicio que todavía no se ha hecho, y un mantenimiento es uno que ya se
-- hizo. En dos tablas habría que copiar de una a otra al atenderlo, y el
-- día que alguien se salte el paso se pierde el rastro de por qué se fue
-- el técnico.
-- ------------------------------------------------------------
CREATE TABLE nevera_servicios (
  id             TEXT PRIMARY KEY,
  nevera_id      TEXT NOT NULL REFERENCES neveras(id),
  -- En qué comodato estaba cuando pasó. Sirve para saber si una nevera se
  -- descompone siempre con el mismo cliente.
  comodato_id    TEXT REFERENCES comodatos(id),

  tipo           TEXT NOT NULL DEFAULT 'falla'
                 CHECK (tipo IN ('falla','preventivo','limpieza','otro')),
  reportado_en   TEXT NOT NULL,
  reportado_por  TEXT REFERENCES usuarios(id),
  -- Quién avisó: el cliente, el repartidor, quien sea.
  quien_reporto  TEXT,
  que_tiene      TEXT NOT NULL,

  -- Lo que se hizo. Vacío = todavía está pendiente.
  atendido_en    TEXT,
  atendido_por   TEXT REFERENCES usuarios(id),
  quien_lo_hizo  TEXT,
  que_se_hizo    TEXT,
  costo_centavos INTEGER,

  anulado_en     TEXT,
  anulado_por    TEXT REFERENCES usuarios(id),
  motivo_anulacion TEXT
);

CREATE INDEX idx_servicios_nevera ON nevera_servicios(nevera_id, reportado_en);
CREATE INDEX idx_servicios_pendientes ON nevera_servicios(atendido_en, anulado_en);

-- ------------------------------------------------------------
-- LAS CORTESÍAS: lo que se regala
--
-- "Mermas, cambios que se le dan, promociones, porque a veces se les
--  regala bolsas."
--
-- Esto no es un capricho de contabilidad. Si a un cliente se le regalan
-- veinte bolsas al mes, la nevera NO está ganando lo que parece, y sin
-- restarlo el número de "cuánto ha ganado" miente justo en el caso donde
-- más importa: el cliente al que se le consiente.
-- ------------------------------------------------------------
CREATE TABLE nevera_cortesias (
  id             TEXT PRIMARY KEY,
  nevera_id      TEXT NOT NULL REFERENCES neveras(id),
  comodato_id    TEXT REFERENCES comodatos(id),
  fecha          TEXT NOT NULL,
  motivo         TEXT NOT NULL DEFAULT 'cortesia'
                 CHECK (motivo IN ('cortesia','promocion','cambio','merma')),
  cuantas        INTEGER NOT NULL,
  -- Cuánto valían, copiado (regla 3.5): el precio de hoy no puede cambiar
  -- lo que costó una promoción de marzo.
  centavos       INTEGER NOT NULL DEFAULT 0,
  notas          TEXT,
  capturista_id  TEXT REFERENCES usuarios(id),
  anulado_en     TEXT,
  anulado_por    TEXT REFERENCES usuarios(id)
);

CREATE INDEX idx_cortesias_nevera ON nevera_cortesias(nevera_id, fecha);

-- ------------------------------------------------------------
-- QUÉ PRODUCTOS CUENTAN COMO VENTA DE NEVERA
--
-- Para saber cuánto ha ganado una nevera hay que saber qué se le vendió
-- POR SER nevera. Una marqueta que el mismo cliente compró para otra cosa
-- no la pagó la nevera.
--
-- Se marca en el producto y no se adivina: adivinar por cliente contaría
-- de más, y adivinar por precio contaría mal.
-- ------------------------------------------------------------
ALTER TABLE productos ADD COLUMN para_nevera INTEGER NOT NULL DEFAULT 0;

-- Las bolsas de hielo en cubos son lo que va en una nevera. Se marcan las
-- que ya existen; cualquier producto nuevo se marca desde su ficha.
UPDATE productos SET para_nevera = 1
 WHERE id LIKE 'prod-bolsa%' OR lower(nombre) LIKE '%bolsa%';

-- ------------------------------------------------------------
-- LOS AJUSTES
-- ------------------------------------------------------------
INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'nevera_dias_aviso', '21',
       'Días sin pedir para avisar, cuando la nevera no tiene el suyo propio',
       datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'nevera_dias_aviso');

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'nevera_mensaje_whatsapp',
       'Buen día {responsable}, le habla {negocio}. ¿Le mandamos bolsas de hielo hoy?',
       'El mensaje que se le manda por WhatsApp. {responsable}, {cliente}, {negocio} y {dias} se rellenan solos',
       datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'nevera_mensaje_whatsapp');

-- El aviso por correo, apagado de fábrica como los otros catorce (v4.9).
INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'aviso_nevera_sin_pedir', '0', 'Neveras que llevan días sin pedir', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'aviso_nevera_sin_pedir');

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'aviso_nevera_sin_pedir_ultimo', '', 'Último día que se avisó', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'aviso_nevera_sin_pedir_ultimo');

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'aviso_nevera_falla', '0', 'Cuando se reporta una nevera descompuesta', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'aviso_nevera_falla');
