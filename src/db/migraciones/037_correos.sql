-- ============================================================
-- 037_correos.sql  (v4.9)
--
-- LOS AVISOS POR CORREO.
--
-- "Los correos serán varios que pueda activar y desactivar desde
--  configuraciones, ya que habrá momentos en los que quiera saber y otros
--  en los que no."
--
-- LAS DOS DECISIONES QUE MANDAN AQUÍ
--
-- 1) CADA AVISO ES UN INTERRUPTOR SUYO. No hay un "modo correo" que
--    prenda todo: son quince interruptores independientes, porque querer
--    enterarse de las anulaciones no tiene nada que ver con querer el
--    corte de cada turno. Se guardan como filas de `configuracion`
--    ('aviso_corte' = '1'), que es donde vive todo lo que se prende y se
--    apaga en este sistema.
--
-- 2) EL CORREO NO SE MANDA: SE ENCOLA. Todo aviso cae primero en la tabla
--    `correos` y un reloj aparte lo entrega. Tres razones, y las tres son
--    de fábrica y no de programador:
--
--      · AQUÍ SE VA EL INTERNET. Si el aviso se mandara en el momento, un
--        corte de red se llevaría el aviso. Encolado, sale cuando vuelva.
--      · NADA PUEDE ESPERAR AL CORREO. Cerrar un turno tarda lo que tarda
--        cerrar un turno; si el servidor de Gmail tarda diez segundos en
--        contestar, el cajero se queda diez segundos viendo una rueda por
--        un correo que no le importa. Encolar tarda un parpadeo.
--      · SI ALGO FALLA, QUEDA ESCRITO. El último error se guarda en su
--        fila, así que "no me llegó el correo" se puede contestar mirando
--        la cola en vez de adivinando.
--
-- Y una tercera regla que viene de las de siempre (3.4): un correo no se
-- borra. Se marca enviado, o cancelado con su motivo. Lo que se mandó
-- desde esta fábrica tiene que poder mirarse en enero.
-- ============================================================

-- ------------------------------------------------------------
-- LA COLA DE SALIDA
-- ------------------------------------------------------------
CREATE TABLE correos (
  id             TEXT PRIMARY KEY,
  creado_en      TEXT NOT NULL,
  aviso          TEXT NOT NULL,         -- 'corte', 'anulaciones', ...
  asunto         TEXT NOT NULL,
  cuerpo         TEXT NOT NULL,         -- HTML
  resumen        TEXT,                  -- la versión en texto pelón
  para           TEXT NOT NULL,         -- a quién iba, copiado (regla 3.5)

  -- Lo que se llevó el intento de entregarlo.
  intentos       INTEGER NOT NULL DEFAULT 0,
  ultimo_intento TEXT,
  ultimo_error   TEXT,
  proximo_intento TEXT,                 -- cuándo se vuelve a probar

  enviado_en     TEXT,
  cancelado_en   TEXT,
  motivo_cancelacion TEXT
);

CREATE INDEX idx_correos_pendientes ON correos(enviado_en, cancelado_en, proximo_intento);
CREATE INDEX idx_correos_creado ON correos(creado_en);

-- ------------------------------------------------------------
-- CÓMO SE CONECTA AL CORREO
--
-- Vacío a propósito: hasta que no se escriba una cuenta no se manda nada,
-- y así una fábrica que no quiera correos no tiene que apagar nada.
--
-- La contraseña que va aquí NO es la de la cuenta de Gmail: es una
-- "contraseña de aplicación" de 16 letras, que se saca desde la cuenta de
-- Google y se puede revocar sola sin tocar la cuenta. Nunca sale de la
-- base: la pantalla enseña "ya está puesta", no el valor.
-- ------------------------------------------------------------
INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'correo_activo', '0', 'Mandar avisos por correo (0/1)', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'correo_activo');

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'correo_servidor', 'smtp.gmail.com', 'Servidor de salida (SMTP)', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'correo_servidor');

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'correo_puerto', '465', 'Puerto del servidor de salida', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'correo_puerto');

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'correo_seguridad', 'tls', 'tls (465) o starttls (587)', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'correo_seguridad');

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'correo_usuario', '', 'La cuenta desde la que salen los avisos', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'correo_usuario');

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'correo_contrasena', '', 'Contraseña de aplicación de esa cuenta', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'correo_contrasena');

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'correo_para', '', 'A quién le llegan los avisos (separados por coma)', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'correo_para');

-- ------------------------------------------------------------
-- LOS INTERRUPTORES
--
-- Todos apagados de fábrica. Un sistema que empieza a mandar correos solo
-- el día que se instala es un sistema que se desinstala.
-- ------------------------------------------------------------
INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT clave, '0', descripcion, datetime('now') FROM (
  SELECT 'aviso_informe_mes'      AS clave, 'Informe del mes' AS descripcion UNION ALL
  SELECT 'aviso_resumen_dia',          'Resumen del día'                     UNION ALL
  SELECT 'aviso_corte',                'Cada corte de caja'                  UNION ALL
  SELECT 'aviso_corte_descuadrado',    'Solo los cortes donde falta dinero'  UNION ALL
  SELECT 'aviso_anulaciones',          'Anulaciones que no hizo el administrador' UNION ALL
  SELECT 'aviso_inventario_bajo',      'Producto bajo de inventario'         UNION ALL
  SELECT 'aviso_hielo_bajo',           'Hielo por debajo del mínimo'         UNION ALL
  SELECT 'aviso_conteo_descuadrado',   'El cuarto frío no cuadró'            UNION ALL
  SELECT 'aviso_tanque_nuevo',         'Tanque nuevo'                        UNION ALL
  SELECT 'aviso_empleado_nuevo',       'Empleado nuevo'                      UNION ALL
  SELECT 'aviso_entrada_salida',       'Llegada y salida de un trabajador'   UNION ALL
  SELECT 'aviso_vale',                 'Vale de sueldo'                      UNION ALL
  SELECT 'aviso_raya',                 'Raya pagada'                         UNION ALL
  SELECT 'aviso_gasto_grande',         'Gasto grande de la empresa'          UNION ALL
  SELECT 'aviso_precios',              'Cambio de precios'
) AS nuevos
 WHERE NOT EXISTS (SELECT 1 FROM configuracion c WHERE c.clave = nuevos.clave);

-- Cuánto tiene que costar un gasto de la empresa para que avise, y a qué
-- hora sale el resumen del día. Un aviso que llega por todo no se lee.
INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'aviso_gasto_grande_desde', '200000',
       'Desde cuántos centavos avisa un gasto de la empresa', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'aviso_gasto_grande_desde');

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'aviso_resumen_dia_hora', '21',
       'A qué hora sale el resumen del día (0 a 23)', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'aviso_resumen_dia_hora');

-- La marca de agua de los avisos que salen una vez al día o al mes: sin
-- esto, el reloj mandaría el mismo resumen cada vez que da la vuelta.
INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'aviso_resumen_dia_ultimo', '', 'Último día resumido', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'aviso_resumen_dia_ultimo');

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'aviso_informe_mes_ultimo', '', 'Último mes informado', datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'aviso_informe_mes_ultimo');

-- ------------------------------------------------------------
-- LO QUE YA SE AVISÓ DE CADA PRODUCTO
--
-- Un producto bajo de inventario sigue bajo mañana, y pasado. Sin esta
-- marca, el reloj mandaría el mismo aviso cada media hora hasta que
-- alguien surta —y a la tercera vez nadie lee los correos de este
-- sistema—. Se avisa cuando CRUZA el mínimo, y no se vuelve a avisar
-- hasta que suba otra vez por encima.
-- ------------------------------------------------------------
CREATE TABLE avisos_inventario (
  producto_id  TEXT PRIMARY KEY REFERENCES productos(id),
  avisado_en   TEXT NOT NULL,
  cantidad     REAL
);
