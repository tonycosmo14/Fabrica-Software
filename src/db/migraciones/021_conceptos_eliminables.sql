-- ============================================================
-- 021 — BORRAR DE LA LISTA SIN BORRAR LA HISTORIA  (v2.7.1)
--
-- "Eliminar" un concepto lo saca de la pantalla de conceptos para
-- siempre: ni activo, ni tachado como "de baja". Pero NO borra nada
-- (regla 3.4): los gastos que se anotaron con él siguen existiendo,
-- siguen sumando en las estadísticas y siguen saliendo en el historial.
-- Solo desaparece el renglón del catálogo, que era lo que estorbaba.
--
-- Por eso la columna se llama `oculto` y no `eliminado`: dice la verdad.
-- ============================================================

ALTER TABLE conceptos_gasto   ADD COLUMN oculto INTEGER NOT NULL DEFAULT 0;
ALTER TABLE conceptos_empresa ADD COLUMN oculto INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- QUIÉN SACÓ EL PAÑO cuando no es de la casa.
--
-- A veces saca un eventual de un día, o el dueño, o su papá: gente que no
-- tiene usuario y no debe tenerlo. Su nombre se escribe tal cual y se
-- guarda AQUÍ, copiado al registro (regla 3.5). En esos casos ejecutor_id
-- queda vacío: atribuirle el paño al cajero que capturó sería mentir en la
-- estadística de "quién sacó cuánto". El capturista_id sigue siendo el
-- usuario real de la sesión (regla 3.6): siempre se sabe quién lo anotó.
-- ============================================================

ALTER TABLE sacadas_pano ADD COLUMN ejecutor_libre TEXT;
