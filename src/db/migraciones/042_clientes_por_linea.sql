-- ============================================================
-- 042_clientes_por_linea.sql  (v5.4)
--
-- QUÉ LE COMPRA CADA CLIENTE, Y CUÁNDO SE LE PUEDE ENTREGAR.
--
-- "Hay clientes para el mayoreo de marquetas, hay clientes para el reparto
--  de agua y hay clientes para las bolsas. Podemos dejarlo en el mismo
--  módulo, pero que clientes tenga tres pestañas, una para cada uno."
--
-- ============================================================
-- TRES PESTAÑAS, PERO UN SOLO CLIENTE
-- ============================================================
--
-- La pantalla se parte en tres, que es lo que se pidió y lo que hace falta:
-- cuando se prepara el reparto de agua, los cincuenta de las marquetas
-- estorban.
--
-- Lo que NO se parte es el cliente. Y es la decisión que más cuesta si se
-- toma al revés:
--
--   Abarrotes Juan compra bolsas Y agua. Si fueran dos fichas, tendría dos
--   deudas, dos límites de crédito y dos historiales — y el día que llegue
--   con $500 en la mano, nadie sabría a cuál de las dos cuentas van. Ese
--   día se descubre, y ya es tarde: hay que juntar dos historias que
--   llevan meses separadas.
--
-- Así que el cliente es uno, con su deuda, su límite y su historia; y lo
-- que se guarda aquí es UNA ETIQUETA de qué le compra. Las pestañas
-- filtran por esa etiqueta.
--
-- El que compra las tres cosas sale en las tres pestañas, que es
-- exactamente lo que tiene que pasar: cuando se prepare el agua hay que
-- verlo, y cuando se preparen las bolsas también.
--
-- ============================================================
-- Y EL HORARIO, QUE NO ES UN ADORNO
-- ============================================================
--
-- "Hay que anotar el horario de la tienda del cliente u horario de
--  preferencia del cliente, es que repartimos a muchas tienditas, y ellos
--  tienen horarios."
--
-- Una ruta "corta" que llega a las dos de la tarde a una tienda que cierra
-- a la una no es corta: es un viaje perdido y hay que volver. Por eso el
-- horario se guarda con el cliente, sale en su nota de entrega, y el día
-- que la ruta se ordene sola será lo que mande — antes que la distancia.
-- ============================================================

-- ------------------------------------------------------------
-- QUÉ LE COMPRA
-- ------------------------------------------------------------
ALTER TABLE clientes ADD COLUMN compra_marqueta INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clientes ADD COLUMN compra_bolsa    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clientes ADD COLUMN compra_agua     INTEGER NOT NULL DEFAULT 0;

-- ------------------------------------------------------------
-- CUÁNDO Y DÓNDE SE LE ENTREGA
-- ------------------------------------------------------------

-- Como lo diría una persona: "de 8 a 2 y de 5 a 8", "no antes de las 10",
-- "los domingos no abre". Texto y no dos horas, porque la mitad de las
-- tienditas tienen dos ventanas al día y la otra mitad una regla rara.
ALTER TABLE clientes ADD COLUMN horario_entrega TEXT;

-- La ubicación, para el mapa y para el QR de la nota de entrega. Es lo
-- mismo que ya guardan los comodatos de las neveras (039): se pega el
-- enlace que da Google Maps al compartir y el sistema saca las
-- coordenadas.
ALTER TABLE clientes ADD COLUMN latitud     REAL;
ALTER TABLE clientes ADD COLUMN longitud    REAL;
-- "La de la puerta azul, junto a la tortillería". La dirección escrita
-- lleva al rumbo; esto es lo que hace que el repartidor encuentre la
-- puerta.
ALTER TABLE clientes ADD COLUMN referencias TEXT;

CREATE INDEX idx_clientes_compra
    ON clientes(compra_agua, compra_bolsa, compra_marqueta);

-- ============================================================
-- LO QUE YA COMPRARON, MARCADO SOLO
-- ============================================================
--
-- Nadie va a etiquetar doscientos clientes a mano, y si hubiera que
-- hacerlo las pestañas saldrían vacías el primer día y nadie las usaría.
--
-- Así que se marca por lo que CADA UNO YA COMPRÓ, que está escrito en sus
-- tickets. Es una foto del pasado y puede quedar incompleta —el que solo
-- vino una vez por marquetas y ahora quiere agua— pero se corrige desde su
-- ficha en un toque, y arranca con casi todo bien en vez de con todo mal.
-- ------------------------------------------------------------

-- MARQUETAS: cualquier venta de hielo que salió del cuarto frío.
UPDATE clientes SET compra_marqueta = 1
 WHERE EXISTS (
   SELECT 1 FROM ventas v
     JOIN venta_lineas vl ON vl.venta_id = v.id
    WHERE v.cliente_id = clientes.id
      AND v.cancelada_en IS NULL
      AND vl.dieciseisavos > 0
 );

-- BOLSAS: los productos marcados como de nevera (039) son justo las bolsas
-- de hielo en cubos.
UPDATE clientes SET compra_bolsa = 1
 WHERE EXISTS (
   SELECT 1 FROM ventas v
     JOIN venta_lineas vl ON vl.venta_id = v.id
     JOIN productos p     ON p.id = vl.producto_id
    WHERE v.cliente_id = clientes.id
      AND v.cancelada_en IS NULL
      AND p.para_nevera = 1
 );

-- Y el que tiene una nevera en comodato compra bolsas por definición:
-- para eso se le prestó.
UPDATE clientes SET compra_bolsa = 1
 WHERE EXISTS (
   SELECT 1 FROM comodatos c
    WHERE c.cliente_id = clientes.id AND c.devuelta_en IS NULL
 );

-- EL AGUA todavía no se vende, así que no hay de dónde sacarlo. Se marca a
-- mano conforme se den de alta, que es como va a empezar de todos modos.

-- ------------------------------------------------------------
-- EL QUE NO COMPRÓ NADA TODAVÍA
-- ------------------------------------------------------------
--
-- Un cliente nuevo, sin un solo ticket, quedaría fuera de las tres
-- pestañas y sería invisible. Se le marcan las marquetas, que es a lo que
-- se dedica la fábrica desde el primer día: aparece donde se le busca, y
-- si en realidad es de agua se cambia en su ficha.
UPDATE clientes SET compra_marqueta = 1
 WHERE compra_marqueta = 0 AND compra_bolsa = 0 AND compra_agua = 0;
