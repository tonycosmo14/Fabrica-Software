-- ============================================================
-- 043_pedidos.sql  (v5.6)
--
-- LOS PEDIDOS.
--
-- "A la cajera le llaman por teléfono o mandan a alguien en persona: la
--  tiendita Abarrotes Juan de la esquina necesita diez garrafones y 50
--  bolsas. Los pedidos se van acumulando hasta que salen."
--
-- ============================================================
-- UN PEDIDO NO ES UNA VENTA TODAVÍA
-- ============================================================
--
-- Es la diferencia que hace falta y la que hoy no existe: para anotar que
-- alguien pidió algo hay que cobrarlo en la caja, y eso deja una venta de
-- hielo que todavía está en el cuarto frío y un cliente al que no se le ha
-- entregado nada.
--
-- Aquí un pedido es una PROMESA: alguien pidió, alguien va a llevarlo.
-- La venta nace cuando se entrega, no antes. Así:
--
--   · Un pedido que no se entregó no ensucia las ventas del día.
--   · El hielo no sale del cuarto frío hasta que sale de verdad.
--   · Y cancelar un pedido es cancelar una promesa, no cancelar un
--     ticket cobrado — que es una cosa mucho más fea de explicar.
--
-- ============================================================
-- LOS DATOS DEL CLIENTE SE COPIAN (regla 3.5)
-- ============================================================
--
-- La dirección, las referencias, el horario y las coordenadas se guardan
-- CON el pedido, no se leen del cliente al imprimir.
--
-- Parece redundante hasta el día que un cliente se muda: sin copiarlos, la
-- nota de un pedido de hace tres meses diría la dirección nueva, y nadie
-- podría explicar por qué el repartidor fue a donde fue.
--
-- ============================================================
-- Y EL PRECIO TAMBIÉN
-- ============================================================
--
-- Se copia al TOMAR el pedido, no al entregarlo. Un pedido es una promesa
-- con precio: "te lo llevo a $240". Si el lunes suben los precios y el
-- pedido se tomó el sábado, lo que hay que cobrar es lo que dice el papel
-- que el repartidor lleva en la mano — discutirlo en la puerta del cliente
-- es perder el cliente.
-- ============================================================

CREATE TABLE pedidos (
  id             TEXT PRIMARY KEY,

  -- EL NÚMERO QUE SE DICE EN VOZ ALTA. "El pedido 47 ya salió." Nunca se
  -- reusa, ni siquiera si se cancela: el número es de ese pedido.
  folio          INTEGER NOT NULL UNIQUE,

  fecha          TEXT NOT NULL,              -- cuándo se tomó
  -- PARA CUÁNDO ES. Casi siempre hoy, pero se piden cosas para mañana y
  -- eso no puede salir en la preparación de hoy.
  para_cuando    TEXT NOT NULL,

  cliente_id     TEXT NOT NULL REFERENCES clientes(id),

  -- Copiados del cliente al tomarlo (regla 3.5).
  direccion      TEXT,
  referencias    TEXT,
  horario        TEXT,
  telefono       TEXT,
  latitud        REAL,
  longitud       REAL,

  -- pendiente   se tomó y todavía no sale
  -- entregado   llegó a su destino y se convirtió en venta
  -- cancelado   no se va a llevar
  estado         TEXT NOT NULL DEFAULT 'pendiente'
                 CHECK (estado IN ('pendiente','entregado','cancelado')),

  notas          TEXT,

  -- CÓMO SE VA A PAGAR, dicho al tomarlo. No es definitivo —el cliente
  -- puede cambiar de opinión en la puerta— pero es lo que el repartidor
  -- necesita saber antes de salir: si va a cobrar o no.
  forma_pago     TEXT NOT NULL DEFAULT 'efectivo',

  -- La venta que nació al entregarlo. NULL mientras no se ha entregado.
  venta_id       TEXT REFERENCES ventas(id),
  entregado_en   TEXT,
  entregado_por  TEXT REFERENCES usuarios(id),

  cancelado_en   TEXT,
  cancelado_por  TEXT REFERENCES usuarios(id),
  motivo_cancelacion TEXT,

  -- Regla 3.6: quién lo tomó y quién lo tecleó pueden no ser el mismo.
  ejecutor_id    TEXT REFERENCES usuarios(id),
  capturista_id  TEXT REFERENCES usuarios(id)
);

CREATE INDEX idx_pedidos_estado ON pedidos(estado, para_cuando);
CREATE INDEX idx_pedidos_cliente ON pedidos(cliente_id, fecha);

-- ------------------------------------------------------------
-- LO QUE PIDIÓ
--
-- Mismo molde que `venta_lineas`, porque al entregarse se convierten en
-- eso: concepto y precio COPIADOS, y los dieciseisavos aparte para que el
-- hielo siga contándose en dieciseisavos enteros (regla 3.1).
-- ------------------------------------------------------------
CREATE TABLE pedido_lineas (
  id              TEXT PRIMARY KEY,
  pedido_id       TEXT NOT NULL REFERENCES pedidos(id),
  producto_id     TEXT REFERENCES productos(id),
  concepto        TEXT NOT NULL,
  cantidad        INTEGER NOT NULL DEFAULT 1,
  dieciseisavos   INTEGER NOT NULL DEFAULT 0,
  precio_centavos INTEGER NOT NULL,
  desglose        TEXT
);

CREATE INDEX idx_pedido_lineas ON pedido_lineas(pedido_id);

-- ------------------------------------------------------------
-- QUÉ SE PREPARA EN EL ÁREA DEL AGUA
--
-- Un pedido es UNA llamada de UN cliente —"diez garrafones y cincuenta
-- bolsas"— y no se parte en dos al capturarlo: partirlo haría que el
-- repartidor llegara con dos notas a la misma puerta.
--
-- Lo que sí se parte es la PREPARACIÓN, porque ahí sí son dos áreas con
-- dos personas distintas. Y eso lo decide el producto, no quien capturó.
--
-- Misma idea que `para_nevera` (039): se marca en el producto y no se
-- adivina. Adivinar por el nombre funcionaría hasta el día que alguien dé
-- de alta "Hielo en botella".
-- ------------------------------------------------------------
ALTER TABLE productos ADD COLUMN para_agua INTEGER NOT NULL DEFAULT 0;

-- Lo que ya está dado de alta y es claramente de agua. Los productos del
-- agua de verdad todavía no existen —se venden a partir de la v5.3 del
-- plan— así que esto casi siempre no marca nada, y está bien: se marca
-- desde la ficha del producto conforme se den de alta.
UPDATE productos SET para_agua = 1
 WHERE lower(nombre) LIKE '%garraf%'
    OR lower(nombre) LIKE '%botell%'
    OR lower(nombre) LIKE '%agua%';

-- ------------------------------------------------------------
-- LOS AJUSTES
-- ------------------------------------------------------------
INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'pedido_aviso_nuevo', '0',
       'Avisar por correo cada vez que se toma un pedido', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'pedido_aviso_nuevo');

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'aviso_pedido_cancelado', '0',
       'Cuando se cancela un pedido que ya estaba tomado', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'aviso_pedido_cancelado');
