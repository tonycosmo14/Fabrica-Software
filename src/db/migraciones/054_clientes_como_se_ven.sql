-- ============================================================
-- 054_clientes_como_se_ven.sql  (v6.9)
--
-- LA FICHA DEL CLIENTE, COMPLETA.
--
-- "Por fin terminé el diseño que quiero para clientes. Tenemos casi todos
--  los datos, los que no tengamos los agregas."
--
-- Y es verdad: el saldo, el crédito, el ritmo, el horario, la ubicación y
-- qué le compra ya estaban. Lo que faltaba es esto.
--
-- ============================================================
-- 1. LOS DATOS FISCALES
-- ============================================================
--
-- El sistema NO factura —no emite CFDI, no habla con el SAT ni con un PAC—
-- y esto no lo cambia. Lo que hace es GUARDAR los datos y sacarlos
-- impresos, que es lo que se necesita para pasárselos a quien factura sin
-- andar buscando el RFC en un WhatsApp de hace ocho meses.
--
-- `nombre` y `negocio` NO cambian de significado y por eso no se agrega
-- ninguna columna para el contacto: `negocio` siempre fue el rótulo del
-- local y `nombre` la persona con la que se trata. Lo único que cambia es
-- cómo se llaman en la pantalla.
-- ------------------------------------------------------------
ALTER TABLE clientes ADD COLUMN razon_social   TEXT;
ALTER TABLE clientes ADD COLUMN rfc            TEXT;
ALTER TABLE clientes ADD COLUMN regimen_fiscal TEXT;   -- clave del SAT: '601', '626'…
ALTER TABLE clientes ADD COLUMN correo         TEXT;   -- a dónde va la factura

-- ============================================================
-- 2. CÓMO SE LE REPARTE
-- ============================================================
--
-- La zona es para agrupar la ruta: "Zona Costa (Muelle 4)", "Sector 03".
-- Se escribe libre a propósito: las zonas de una ciudad las inventa quien
-- reparte, no un catálogo, y cambian cuando se abre un cliente grande.
ALTER TABLE clientes ADD COLUMN zona TEXT;

-- CADA CUÁNTO SE LE SURTE, DICHO POR ÉL.
--
-- No es lo mismo que el `ritmo`, que sale de los tickets y dice lo que de
-- verdad pasó. Esto es el acuerdo: "diario, de lunes a domingo". Sirve
-- para armar el reparto de mañana ANTES de que existan los tickets de
-- mañana, y para notar que el que quedó en diario lleva cuatro días sin
-- pedir.
ALTER TABLE clientes ADD COLUMN frecuencia TEXT;

-- LA VENTANA DE RECEPCIÓN, en horas de reloj.
--
-- `horario_entrega` (v5.4) sigue existiendo y sigue siendo texto libre:
-- "de 8 a 2 y de 5 a 8, los domingos no abre". Eso NO se puede ordenar ni
-- comparar. Estas dos horas sí, y son las que dejan ordenar una ruta por
-- quién cierra primero. Las dos conviven: la ventana manda para la ruta,
-- el texto explica las rarezas.
ALTER TABLE clientes ADD COLUMN hora_desde TEXT;      -- 'HH:MM'
ALTER TABLE clientes ADD COLUMN hora_hasta TEXT;

-- ============================================================
-- 3. CÓMO PAGA
-- ============================================================
--
-- El límite y el plazo ya estaban (015). Faltaba de qué forma se acordó
-- que pague, que es lo que se pregunta al llegar con la nota en la mano.
ALTER TABLE clientes ADD COLUMN metodo_pago TEXT;     -- 'credito' | 'contado' | 'transferencia'

-- ============================================================
-- 4. LOS GARRAFONES EN RESGUARDO
-- ============================================================
--
-- "Cantidad, límite y garantía."
--
-- El garrafón de policarbonato no se vende: se presta y se intercambia
-- lleno por vacío, vuelta tras vuelta. Lo que importa es CUÁNTOS TRAE EL
-- CLIENTE, porque el día que se va del negocio se va con ellos.
--
-- No se guarda un número: se guardan los movimientos y el número se saca
-- de sumarlos (regla 3.2). Un contador que se edita a mano acaba diciendo
-- 15 cuando en el patio hay 9, y nadie sabe cuándo empezó a mentir.
--
--   `cuantos` en POSITIVO  se le entregaron y se quedaron con él
--   `cuantos` en NEGATIVO  los devolvió
--
-- Esto NO es el comodato de neveras (039), que es una máquina con número
-- de serie y vive en su propia tabla. Un garrafón no tiene identidad: son
-- veinte iguales y lo único que se cuenta es cuántos.
CREATE TABLE garrafones_movimientos (
  id            TEXT PRIMARY KEY,
  cliente_id    TEXT NOT NULL REFERENCES clientes(id),
  fecha         TEXT NOT NULL,
  cuantos       INTEGER NOT NULL,            -- + se le dieron · − los trajo
  motivo        TEXT,

  ejecutor_id   TEXT REFERENCES usuarios(id),   -- quién los entregó o recibió
  capturista_id TEXT REFERENCES usuarios(id),   -- quién lo anotó (regla 3.6)

  anulado_en    TEXT,
  anulado_por   TEXT REFERENCES usuarios(id),
  motivo_anulacion TEXT
);

CREATE INDEX idx_garrafones_cliente ON garrafones_movimientos(cliente_id, fecha);

-- Cuántos se le autorizaron como máximo, y cuánto dejó de garantía por
-- cada uno. La garantía se guarda POR CLIENTE y no en un ajuste general
-- porque no todos dejaron lo mismo: al de hace tres años se le cobraron
-- $80 y ese trato no se le puede subir hoy.
ALTER TABLE clientes ADD COLUMN garrafones_limite   INTEGER;
ALTER TABLE clientes ADD COLUMN garrafon_deposito_centavos INTEGER;

-- ============================================================
-- 5. LOS PRECIOS ACORDADOS, PRODUCTO POR PRODUCTO
-- ============================================================
--
-- "Personalice los precios directos acordados para este cliente. Estos
--  valores reemplazarán automáticamente la tarifa de mostrador."
--
-- Hasta hoy un cliente llevaba una LISTA DE MAYOREO entera (016), y esas
-- listas solo saben de hielo por fracción: la bolsa de 5 kg y el garrafón
-- no cabían en ellas. Y una lista es un trato compartido — al de la
-- pescadería no se le puede bajar la barra sin bajársela a los otros
-- treinta que traen la misma lista.
--
-- Así que las dos cosas conviven, y el orden es de lo más particular a lo
-- más general:
--
--   1. EL PRECIO PROPIO de este cliente en este producto   ← esta tabla
--   2. LA LISTA DE MAYOREO que trae asignada               (016)
--   3. EL PRECIO DE MOSTRADOR                              (010)
--
-- El precio se COPIA a la venta cuando se cobra (regla 3.5): cambiárselo
-- mañana no toca ni un ticket de ayer.
CREATE TABLE cliente_precios (
  id             TEXT PRIMARY KEY,
  cliente_id     TEXT NOT NULL REFERENCES clientes(id),
  producto_id    TEXT NOT NULL REFERENCES productos(id),
  centavos       INTEGER NOT NULL,

  -- "25 pzas", "12 garrafones / semana". Es lo que se acordó que se lleva,
  -- escrito como se dijo: sirve para preparar la primera carga y para
  -- notar que el que quedó en 25 barras lleva un mes pidiendo 8.
  volumen        TEXT,

  actualizado_en TEXT NOT NULL,
  actualizado_por TEXT REFERENCES usuarios(id)
);

CREATE UNIQUE INDEX idx_cliente_precio ON cliente_precios(cliente_id, producto_id);

-- ============================================================
-- 6. LO QUE SE VA
-- ============================================================
--
-- "Es que toda la fábrica es una misma, no hay dos partes. Un cliente
--  puede pedir en la caja agua, hielo, refrescos, lo que quiera."
--
-- `productos.para_agua` (043) preguntaba en la ficha de cada producto de
-- cuál de los dos lados era. No hay dos lados. La columna se queda —la
-- pestaña «clientes de agua» se apoya en ella para saber quién compra
-- garrafones— pero deja de preguntarse: se deduce del propio producto,
-- como se dedujo aquí la primera vez.
UPDATE productos SET para_agua = 1
 WHERE para_agua = 0
   AND (lower(nombre) LIKE '%garraf%'
     OR lower(nombre) LIKE '%botell%'
     OR lower(nombre) LIKE '%agua%');
