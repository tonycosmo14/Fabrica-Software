-- ============================================================
-- 034_encomiendas.sql  (v4.5)
--
-- EL HIELO QUE YA SE PAGÓ Y SE QUEDA EN EL CUARTO FRÍO.
--
-- "A veces algún cliente nos regresa un poco de hielo, pero no es que lo
--  devuelva: es que quiere que se lo guardemos para que pase por él al
--  otro día o más tarde. Le decimos encomendados. Ese hielo ya está
--  pagado, solo se guarda en el cuarto frío. Normalmente le hago un
--  papelito con el nombre del cliente, la fecha y la hora."
--
-- El papelito es lo que pidió. Pero hay algo debajo que hay que arreglar
-- al mismo tiempo, o el papelito rompe el cuadre del hielo:
--
-- CUANDO SE VENDE, EL HIELO SE RESTA DEL CUARTO FRÍO. Y esa marqueta
-- encomendada NO SE FUE: sigue ahí, en el cuarto. Así que al contar
-- aparecería una marqueta de más — "SOBRA 1" — todos los días hasta que el
-- cliente pasara por ella. Y "sobra" es justo la palabra que no queremos
-- que aparezca sin motivo, porque es la que avisa de un paño sin capturar.
--
-- Así que la encomienda es un movimiento más del cuarto frío, con la misma
-- forma que todos los demás (regla 3.2: nada de saldos guardados):
--
--     tenía que haber
--       − vendido − derretido − cortado      lo que salió
--       + lo que se quedó guardado           vendido pero NO salió
--       − lo que se llevaron guardado        salió pero se vendió antes
--     = debería quedar
--
-- Una encomienda guardada y recogida el mismo día se cancela sola en esa
-- cuenta, que es exactamente lo que tiene que pasar.
--
-- NO SE BORRA NINGUNA (regla 3.4): la que se entregó queda marcada con
-- quién y cuándo, y la mal capturada se anula con su motivo. El papel que
-- el cliente trae en la mano tiene que poder buscarse en enero.
-- ============================================================

CREATE TABLE encomiendas (
  id            TEXT PRIMARY KEY,
  fecha         TEXT NOT NULL,
  almacen_id    TEXT NOT NULL REFERENCES almacenes(id),
  dieciseisavos INTEGER NOT NULL,

  -- DE QUIÉN ES. Con cliente dado de alta si lo hay, y si no, el nombre
  -- escrito a mano: al que pasa una vez al año no hay por qué darlo de
  -- alta para guardarle media marqueta. El nombre se guarda copiado
  -- siempre (regla 3.5), porque el papel dice lo que decía ese día.
  cliente_id     TEXT REFERENCES clientes(id),
  cliente_nombre TEXT NOT NULL,

  -- De qué ticket salió, cuando se sabe. Es opcional a propósito: casi
  -- siempre se anota justo después de cobrar, pero también pasa que el
  -- cliente lo pide media hora más tarde y ya nadie se acuerda del folio.
  venta_id      TEXT REFERENCES ventas(id),

  notas         TEXT,
  capturista_id TEXT REFERENCES usuarios(id),
  caja_id       TEXT REFERENCES cajas(id),

  -- Cuándo pasó por él. Mientras esté vacío, ese hielo sigue en el cuarto.
  entregado_en      TEXT,
  entregado_por     TEXT REFERENCES usuarios(id),
  entregado_caja_id TEXT REFERENCES cajas(id),

  anulado_en       TEXT,
  anulado_por      TEXT REFERENCES usuarios(id),
  motivo_anulacion TEXT
);

CREATE INDEX idx_encomiendas_pendientes
  ON encomiendas(almacen_id, entregado_en, anulado_en);
CREATE INDEX idx_encomiendas_fecha    ON encomiendas(fecha);
CREATE INDEX idx_encomiendas_entrega  ON encomiendas(entregado_en);
CREATE INDEX idx_encomiendas_cliente  ON encomiendas(cliente_id);

-- El conteo congela su foto del momento, igual que hace con lo vendido y
-- lo derretido: corregir mañana una encomienda vieja no puede mover un
-- corte que ya se firmó.
ALTER TABLE conteos ADD COLUMN guardado INTEGER NOT NULL DEFAULT 0;
ALTER TABLE conteos ADD COLUMN recogido INTEGER NOT NULL DEFAULT 0;

-- CÓMO SE LE LLAMA AQUÍ.
--
-- "Le decimos encomendados, podemos cambiarles de nombre." Cada fábrica
-- le dice de una manera —encomendado, apartado, guardado— y la palabra
-- sale impresa en el papelito que se le da al cliente. Que se pueda
-- cambiar cuesta un renglón y evita que el papel diga algo que ahí nadie
-- dice.
INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'nombre_encomienda', 'Encomendado',
       'Cómo se le llama al hielo ya pagado que se queda guardado', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'nombre_encomienda');
