-- ============================================================
-- 022 — LOS PROVEEDORES  (v2.8)
--
-- No es un catálogo de compras: es EL MANUAL DE LA FÁBRICA. Quién es cada
-- proveedor, qué le vende a la fábrica, a qué teléfono se le habla, dónde
-- está y a qué horas abre. La intención la dijo el dueño con todas sus
-- letras: que si un día él no está, sus hijos abran esta pantalla y
-- sepan a quién hablarle mínimo para que la fábrica siga andando.
--
-- Por eso el campo importante no es el teléfono: es `que_hace`, el texto
-- donde se explica para qué sirve ese proveedor y qué hay que saber al
-- tratar con él.
--
-- En los gastos grandes, el proveedor se sigue escribiendo COPIADO al
-- renglón (regla 3.5): esta tabla no manda sobre las facturas viejas, solo
-- ayuda a escribir el nombre igual las veces siguientes.
-- ============================================================

CREATE TABLE proveedores (
  id          TEXT PRIMARY KEY,
  nombre      TEXT NOT NULL,
  que_hace    TEXT,              -- qué le vende a la fábrica y para qué sirve
  telefono    TEXT,
  direccion   TEXT,
  ubicacion   TEXT,              -- un enlace de mapa, o señas de cómo llegar
  horarios    TEXT,
  notas       TEXT,              -- "preguntar por don Raúl", "solo efectivo"…

  activo      INTEGER NOT NULL DEFAULT 1,
  fecha_alta  TEXT NOT NULL,
  fecha_baja  TEXT
);
