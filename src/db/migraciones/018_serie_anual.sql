-- ============================================================
-- LA SERIE DEL AÑO EN EL TICKET
-- v2.2
-- ============================================================
--
-- "El folio me llegó a preocupar: ¿qué va a pasar cuando el número esté tan
-- grande que se vea ridículamente grande?"
--
-- A trescientos tickets diarios son ciento diez mil al año. En nueve años
-- el ticket diría #1,000,000. No se rompe nada —es un entero y SQLite
-- aguanta cifras astronómicas— pero se ve mal, y un número que nadie puede
-- leer de un vistazo deja de servir para lo único que sirve: decirlo en voz
-- alta. "Tráeme el 2026-412" se dice; "tráeme el un millón doce mil" no.
--
-- DOS NÚMEROS, NO UNO. El `folio` de siempre se queda como está: es la
-- identidad interna, no se reinicia nunca y todo lo que ya lo referencia
-- sigue funcionando. Encima se agrega la SERIE —el año— y el número dentro
-- de ese año, que es lo que se enseña y lo que se imprime.
--
-- Reiniciar el folio de verdad habría sido cambiarle la identidad a algo
-- que ya está escrito en papeles firmados. Esto no toca nada de eso.

ALTER TABLE ventas ADD COLUMN serie INTEGER;        -- el año: 2026
ALTER TABLE ventas ADD COLUMN folio_anual INTEGER;  -- el número dentro del año

-- ------------------------------------------------------------
-- Los tickets que ya existen
-- ------------------------------------------------------------
-- Se les reparte su número por orden de folio dentro de cada año.
--
-- OJO CON 'localtime': las fechas se guardan en UTC y aquí se necesita el
-- año del RELOJ DE LA FÁBRICA. Un ticket del 31 de diciembre a las 7 de la
-- tarde en Yucatán se guarda como el 1 de enero en UTC; sin convertir,
-- estrenaría la serie del año siguiente con un día de anticipación.
UPDATE ventas
   SET serie = CAST(strftime('%Y', fecha, 'localtime') AS INTEGER),
       folio_anual = (
         SELECT COUNT(*) FROM ventas v2
          WHERE strftime('%Y', v2.fecha, 'localtime')
              = strftime('%Y', ventas.fecha, 'localtime')
            AND v2.folio <= ventas.folio
       );

-- Dos tickets no pueden compartir número dentro del mismo año. Es la misma
-- garantía que da el folio, pero sobre lo que la gente de verdad dice.
CREATE UNIQUE INDEX idx_ventas_serie ON ventas(serie, folio_anual)
  WHERE serie IS NOT NULL;
