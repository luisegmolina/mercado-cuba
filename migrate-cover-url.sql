-- Foto de fondo propia de la tienda (2026-11-15).
-- Idempotente: el backend aplica la misma sentencia al arrancar
-- (ensureSchema en server.js). NULL = portada por defecto: foto del
-- primer producto y, si no hay, el hero de Cuba.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS cover_url TEXT;
