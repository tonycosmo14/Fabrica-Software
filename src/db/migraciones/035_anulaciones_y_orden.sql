-- ============================================================
-- 035_anulaciones_y_orden.sql  (v4.7)
--
-- 1. QUIÉN ANULÓ UNA SACADA, Y POR QUÉ.
--
-- "Al corregir o anular la última sacada de hielo, ¿dónde veo después ese
--  dato, quién lo anuló y el motivo? Si no, jamás me voy a enterar."
--
-- Tenía razón, y el problema era peor de lo que parecía: la anulación se
-- guardaba ESCRIBIÉNDOLA EN LAS NOTAS del paño —`ANULADA: se equivocó de
-- tanque`—, así que:
--
--   · QUIÉN la anuló no se guardaba en ningún lado. Estaba en la bitácora,
--     que es para auditar, no para mirar la historia de un paño.
--   · La nota de verdad se perdía. Si alguien había escrito "la grúa se
--     atoró", al anular se borraba.
--   · Y doce consultas de todo el sistema decidían si una sacada contaba
--     mirando si su texto empezaba con una palabra. Un operario que
--     escribiera "ANULADA POR ERROR" en las notas hacía desaparecer un paño
--     de la producción del mes.
--
-- Ahora son tres columnas, como en todas las demás tablas del sistema, y
-- las notas vuelven a ser notas.
-- ============================================================

ALTER TABLE sacadas_pano ADD COLUMN anulada_en       TEXT;
ALTER TABLE sacadas_pano ADD COLUMN anulada_por      TEXT REFERENCES usuarios(id);
ALTER TABLE sacadas_pano ADD COLUMN motivo_anulacion TEXT;

-- Las que ya estaban anuladas se pasan a las columnas nuevas. Quién lo
-- hizo no se puede recuperar —nunca se guardó— y queda vacío: inventar un
-- nombre sería peor que no tenerlo.
UPDATE sacadas_pano
   SET anulada_en = COALESCE(terminada_en, iniciada_en),
       motivo_anulacion = TRIM(SUBSTR(notas, 9)),
       notas = NULL
 WHERE notas LIKE 'ANULADA:%';

-- Y las que llevan el marcador sin dos puntos, por si alguna quedó así.
UPDATE sacadas_pano
   SET anulada_en = COALESCE(terminada_en, iniciada_en),
       motivo_anulacion = COALESCE(motivo_anulacion, 'Sin motivo anotado'),
       notas = NULL
 WHERE notas LIKE 'ANULADA%' AND anulada_en IS NULL;

CREATE INDEX idx_sacadas_pano_anuladas ON sacadas_pano(anulada_en);

-- ============================================================
-- 2. EL VALE DE SUELDO SE LLAMA ASÍ.
--
-- "Vales no se llama vale en raya, no sé qué es eso; sería mejor Vale
--  sueldo."
--
-- "Raya" es como se le dice al sueldo semanal en media México, pero no
-- aquí, y el nombre sale impreso en el papel que firma el trabajador. Solo
-- se renombra si nadie lo ha renombrado ya a mano: el id no cambia (regla
-- 3.3) y los vales viejos siguen colgando de él.
-- ============================================================

UPDATE conceptos_gasto
   SET nombre = 'Vale sueldo',
       ayuda  = 'Parte de su sueldo de la semana, pedida antes'
 WHERE id = 'gasto-vale-raya' AND nombre = 'Vale de raya';

-- ============================================================
-- 3. LOS PAPELES QUE SALEN POR DUPLICADO.
--
-- "Hay tickets que me salen en duplicado. No quiero nada en duplicado, o
--  en su caso que yo lo decida en configuraciones; por lo pronto que por
--  defecto nada esté en duplicado."
--
-- Era el vale, que salía siempre de a dos —uno para quien se llevó el
-- dinero y otro para el cajón—. La idea era buena y la decisión no era
-- mía: ahora sale UNO, y quien quiera los dos lo enciende aquí.
-- ============================================================

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'ticket_vale_duplicado', '0',
       'El papel de un vale sale por duplicado (uno para quien se lleva el dinero, otro para el cajón)',
       datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'ticket_vale_duplicado');

-- ============================================================
-- 4. EL RESUMEN DEL DÍA YA NO SALE CON EL CORTE.
--
-- "Al hacer el corte me das 4 tickets, me parece mucho. El del día está
--  genial, pero no quiero que se imprima cuando hago el corte: que lo
--  pueda imprimir en otro lado, en un momento que quiera ver cómo está la
--  cosa."
--
-- Se queda como botón propio en Producción de hielo. Configurable por si
-- alguna vez conviene lo contrario, pero apagado de fábrica.
-- ============================================================

INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
SELECT 'corte_imprime_dia', '0',
       'Al cerrar el turno, imprimir también el resumen del día de producción',
       datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'corte_imprime_dia');
