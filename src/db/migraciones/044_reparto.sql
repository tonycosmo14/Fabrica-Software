-- ============================================================
-- 044_reparto.sql  (v5.7)
--
-- LA SALIDA Y LA LIQUIDACIÓN.
--
-- "Cuando el repartidor regrese, tenemos que liquidarle todas las cuentas
--  de lo que repartió."
--
-- La v5.6 dejó los pedidos apuntados y sus notas impresas. Falta la otra
-- mitad, que es la que se hace con el camión enfrente: qué subió, qué
-- llegó a su destino, qué volvió, qué se derritió, y cuánto dinero trae.
--
-- ============================================================
-- POR QUÉ ES UNA "SALIDA" Y NO UNA LISTA DE PEDIDOS
-- ============================================================
--
-- Porque en la camioneta van dos cosas distintas:
--
--   LOS PEDIDOS, que son de alguien y ya tienen precio.
--   LO SUELTO, que no es de nadie todavía: hielo y bolsas de más que se
--   suben "por si acaso" y se venden en la calle a quien se atraviese.
--
-- Sin lo suelto no hay cuadre posible: el repartidor volvería con dinero
-- que ningún pedido explica, y la única salida sería no apuntarlo.
--
-- ============================================================
-- LA CUENTA, QUE ES LA MISMA DE SIEMPRE
-- ============================================================
--
--     lo que subió − lo entregado − lo que volvió = LA MERMA
--     lo cobrado en efectivo − lo que entregó     = LA DIFERENCIA
--
-- Es la misma forma del arqueo de caja y del cuadre del cuarto frío, a
-- propósito: quien ya entendió una entiende ésta.
--
-- ============================================================
-- LA MERCANCÍA NO CAMBIA DE ALMACÉN AL SUBIRLA
-- ============================================================
--
-- La camioneta NO es un cuarto frío más, y hacerla uno costaría mover
-- medio sistema para arreglar unas horas.
--
-- Lo que sube y vuelve nunca salió: el conteo del cuarto frío se hace al
-- cerrar el turno, con el camión ya de regreso. Lo que sí salió de verdad
-- se apunta donde ya se apuntaba: lo vendido es una venta, y lo que se
-- derritió en el camino es una merma «derretida» de las de siempre.
-- ============================================================

-- ------------------------------------------------------------
-- EN QUÉ SE REPARTE
--
-- Se dan de alta una vez y se usan años, como los tanques. Lo que importa
-- de un vehículo aquí no es el vehículo: es poder decir "esa carga iba en
-- la camioneta blanca" cuando algo no cuadra.
-- ------------------------------------------------------------
CREATE TABLE vehiculos (
  id            TEXT PRIMARY KEY,
  nombre        TEXT NOT NULL,          -- "La camioneta blanca"
  placas        TEXT,
  tipo          TEXT NOT NULL DEFAULT 'camioneta'
                  CHECK (tipo IN ('camioneta','moto','triciclo','otro')),
  -- Cuántas marquetas le caben. Sirve para avisar cuando la carga se pasa,
  -- que es la forma más común de que el hielo llegue derretido.
  capacidad_marquetas INTEGER,
  notas         TEXT,
  activo        INTEGER NOT NULL DEFAULT 1,
  fecha_alta    TEXT NOT NULL,
  fecha_baja    TEXT,
  creado_por    TEXT REFERENCES usuarios(id)
);

-- ------------------------------------------------------------
-- UN VIAJE
-- ------------------------------------------------------------
CREATE TABLE salidas (
  id             TEXT PRIMARY KEY,
  folio          INTEGER NOT NULL UNIQUE,
  fecha          TEXT NOT NULL,

  vehiculo_id    TEXT REFERENCES vehiculos(id),
  -- QUIÉN SE LA LLEVA. Es el dato que hace que la liquidación tenga a
  -- quién preguntarle: una carga sin nombre no se le puede cuadrar a
  -- nadie.
  repartidor_id  TEXT NOT NULL REFERENCES usuarios(id),

  -- cargando   se está armando; todavía se le agregan cosas
  -- en_ruta    salió
  -- regreso    volvió y se está capturando qué pasó
  -- liquidada  cuadró (o el gerente la cerró explicando la diferencia)
  -- cancelada  no salió
  estado         TEXT NOT NULL DEFAULT 'cargando'
                 CHECK (estado IN ('cargando','en_ruta','regreso','liquidada','cancelada')),

  salio_en       TEXT,
  salio_por      TEXT REFERENCES usuarios(id),
  regreso_en     TEXT,
  regreso_por    TEXT REFERENCES usuarios(id),

  -- ---- EL DINERO ----
  --
  -- No hay ninguna entrada al cajón aquí, y es la decisión que más se
  -- podría hacer al revés:
  --
  -- Cada pedido entregado en efectivo crea SU VENTA, y una venta en
  -- efectivo ya cuenta en el arqueo del turno abierto. Apuntar además una
  -- entrada por el dinero que trae el repartidor contaría ese mismo
  -- dinero dos veces, y la caja sobraría todos los días.
  --
  -- Lo que se guarda aquí es lo que ENTREGÓ, contado billete por billete,
  -- para poder restarlo de lo que debía traer. Si falta, el turno va a
  -- salir corto — y así tiene que ser: el hueco es real. Taparlo con un
  -- movimiento de caja lo escondería justo del papel donde se busca.
  efectivo_esperado_centavos INTEGER,     -- copiado al recibir (regla 3.5)
  efectivo_recibido_centavos INTEGER,
  recibido_en    TEXT,
  recibido_por   TEXT REFERENCES usuarios(id),

  -- La merma del viaje, en dieciseisavos, cargada al cuarto frío. Se
  -- guarda de qué merma se trata para poder deshacerla si se capturó mal.
  merma_id       TEXT REFERENCES mermas_hielo(id),
  -- La venta de lo que se vendió suelto en la calle.
  venta_suelto_id TEXT REFERENCES ventas(id),

  liquidada_en   TEXT,
  liquidada_por  TEXT REFERENCES usuarios(id),
  -- Por qué se cerró con diferencia. Solo el gerente o el dueño la
  -- escriben, y sin ella una salida descuadrada no se cierra.
  motivo_diferencia TEXT,

  cancelada_en   TEXT,
  cancelada_por  TEXT REFERENCES usuarios(id),
  motivo_cancelacion TEXT,

  notas          TEXT,
  -- Regla 3.6: quién la armó y quién la tecleó pueden no ser el mismo.
  ejecutor_id    TEXT REFERENCES usuarios(id),
  capturista_id  TEXT REFERENCES usuarios(id)
);

CREATE INDEX idx_salidas_estado ON salidas(estado, fecha);
CREATE INDEX idx_salidas_repartidor ON salidas(repartidor_id, fecha);

-- ------------------------------------------------------------
-- QUÉ PEDIDOS LLEVA
--
-- Un pedido va en UNA salida a la vez. Si vuelve sin entregar, se suelta
-- de esta salida y queda pendiente otra vez — no se pierde, que es lo que
-- pasaría si el pedido quedara amarrado a un viaje que ya terminó.
-- ------------------------------------------------------------
CREATE TABLE salida_pedidos (
  id          TEXT PRIMARY KEY,
  salida_id   TEXT NOT NULL REFERENCES salidas(id),
  pedido_id   TEXT NOT NULL REFERENCES pedidos(id),
  -- Volvió sin entregarse, y por qué. "Estaba cerrado", "no tenían el
  -- dinero". Es lo que se le dice al cliente cuando llama a preguntar.
  no_entregado_motivo TEXT,
  UNIQUE (salida_id, pedido_id)
);

CREATE INDEX idx_salida_pedidos ON salida_pedidos(pedido_id);

-- ------------------------------------------------------------
-- LO SUELTO: lo que sube sin dueño
--
-- Con su precio COPIADO (regla 3.5), igual que un pedido: lo que se venda
-- en la calle se cobra a lo que decía la lista cuando el camión salió, no
-- a lo que diga cuando vuelva.
-- ------------------------------------------------------------
CREATE TABLE salida_carga (
  id              TEXT PRIMARY KEY,
  salida_id       TEXT NOT NULL REFERENCES salidas(id),
  producto_id     TEXT REFERENCES productos(id),
  concepto        TEXT NOT NULL,
  -- Lo que subió.
  cantidad        INTEGER NOT NULL DEFAULT 0,
  dieciseisavos   INTEGER NOT NULL DEFAULT 0,
  -- POR PIEZA si son piezas; POR LA LÍNEA ENTERA si es hielo.
  --
  -- No es un capricho: de una bolsa se venden seis de las diez que
  -- subieron y hay que cobrar seis veces su precio; de hielo se vende
  -- media marqueta de las cuatro que subieron, y ahí lo que se cobra es
  -- una parte del importe de la línea. Una "pieza" de hielo no vale nada
  -- por sí sola porque no existe.
  precio_centavos INTEGER NOT NULL DEFAULT 0,
  desglose        TEXT,

  -- Lo que se capturó al volver. NULL mientras no ha vuelto: es distinto
  -- de cero —"volvieron cero"— y confundirlos cargaría de merma un viaje
  -- que todavía no ha terminado.
  vendido_cantidad      INTEGER,
  vendido_dieciseisavos INTEGER,
  regreso_cantidad      INTEGER,
  regreso_dieciseisavos INTEGER
);

CREATE INDEX idx_salida_carga ON salida_carga(salida_id);

-- ------------------------------------------------------------
-- DE QUÉ SALIDA VIENE UNA VENTA
--
-- Sin esto, el ticket de un pedido entregado y el de una venta de
-- mostrador se ven iguales en el historial, y "cuánto vendió el reparto
-- este mes" no se puede contestar.
-- ------------------------------------------------------------
ALTER TABLE ventas ADD COLUMN salida_id TEXT REFERENCES salidas(id);
CREATE INDEX idx_ventas_salida ON ventas(salida_id);

-- ------------------------------------------------------------
-- LOS AVISOS
-- ------------------------------------------------------------
INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'aviso_reparto_descuadre', '1',
       'Cuando una salida se liquida y el dinero no cuadra', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'aviso_reparto_descuadre');

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'aviso_reparto_merma', '0',
       'Cuando el hielo derretido de un viaje se pasa de lo normal', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'aviso_reparto_merma');

-- Cuánta merma es "normal" en un viaje, en porcentaje del hielo que subió.
-- Por encima de esto el aviso se manda. Un 5% en un viaje de tres horas
-- con calor de Yucatán es lo esperable; un 30% es que algo pasó.
INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'reparto_merma_normal', '8',
       'Hasta qué % de merma en un viaje se considera normal', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'reparto_merma_normal');
