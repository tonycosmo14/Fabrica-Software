-- ============================================================
-- 027_hielo_cortado.sql  (v3.4)
--
-- EL HIELO QUE SE CORTA NO SE PIERDE: SE TRANSFORMA.
--
-- Hay temporadas en que se agarran marquetas del cuarto frío y se cortan
-- para hacer hielo gourmet, que se vende en bolsas. Esas marquetas salen
-- de la existencia sin pasar por la caja y sin haberse derretido: dejan de
-- ser marquetas y se vuelven otro producto.
--
-- Hasta hoy el sistema no tenía dónde ponerlas, así que aparecían dentro
-- del FALTANTE, revueltas con lo que se derritió y con lo que se fue sin
-- pagar. Y ese faltante es justo el número que hay que vigilar: si un día
-- se cortan cuarenta marquetas, el corte diría que faltan cuarenta y nadie
-- sabría si es robo o es trabajo.
--
-- POR QUÉ NO ES UNA MERMA. La merma es hielo perdido y no tiene remedio.
-- Esto es hielo que se vendió, solo que en otra forma. Meterlos en el
-- mismo saco haría que "lo que se derrite" creciera en temporada alta sin
-- que se hubiera derretido nada.
--
-- LAS BOLSAS SE ANOTAN SI SE CUENTAN, y si no, se deja vacío. Todavía no
-- son un producto del sistema —lo serán—, pero el dato de cuántas salieron
-- de cuántas marquetas es el que hará falta el día que lo sean, y ese día
-- ya no se puede ir a buscar hacia atrás.
-- ============================================================

CREATE TABLE cortes_hielo (
  id            TEXT PRIMARY KEY,
  fecha         TEXT NOT NULL,
  almacen_id    TEXT NOT NULL REFERENCES almacenes(id),
  -- Lo que salió del cuarto frío, en dieciseisavos (regla 3.1).
  dieciseisavos INTEGER NOT NULL CHECK (dieciseisavos > 0),
  -- Cuántas bolsas salieron, si alguien las contó. Puede ir vacío.
  bolsas        INTEGER CHECK (bolsas IS NULL OR bolsas >= 0),
  notas         TEXT,
  -- Regla 3.6: quién lo hizo y quién lo anotó, siempre los dos.
  ejecutor_id   TEXT REFERENCES usuarios(id),
  capturista_id TEXT REFERENCES usuarios(id),
  -- Regla 3.4: nada se borra.
  anulado_en    TEXT,
  anulado_por   TEXT REFERENCES usuarios(id),
  motivo_anulacion TEXT
);

CREATE INDEX idx_cortes_fecha   ON cortes_hielo(fecha);
CREATE INDEX idx_cortes_almacen ON cortes_hielo(almacen_id, fecha);

-- El conteo guarda su foto del momento (regla 3.2): lo cortado y lo
-- derretido se congelan igual que lo vendido, para que corregir algo viejo
-- no cambie un corte que ya se hizo y se firmó.
ALTER TABLE conteos ADD COLUMN merma   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE conteos ADD COLUMN cortado INTEGER NOT NULL DEFAULT 0;
