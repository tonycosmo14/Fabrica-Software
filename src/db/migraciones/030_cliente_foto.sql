-- ============================================================
-- 030_cliente_foto.sql  (v3.8)
--
-- LA FOTO O EL LOGO DEL CLIENTE.
--
-- Un mayorista de esta fábrica es una tienda con nombre, con rótulo y con
-- cara. En la lista de clientes, veinte renglones de texto se leen todos
-- igual y hay que ir deletreando nombres para encontrar a alguien; con el
-- logo de la tienda al lado, se reconoce sin leer — que es exactamente la
-- razón por la que los productos llevan foto desde la v0.13.
--
-- Es opcional y de nadie se exige: quien no tenga logo se queda con la
-- inicial de su nombre en un círculo de color, que ya distingue bastante.
--
-- Se guarda igual que las fotos de producto, en datos/fotos: fuera del
-- programa, para que actualizar por ZIP no se las lleve, y con el nombre
-- puesto por el sistema para que nadie elija dónde se escribe.
-- ============================================================

ALTER TABLE clientes ADD COLUMN foto TEXT;
