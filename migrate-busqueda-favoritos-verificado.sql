-- Migración Mercado Cuba: búsqueda por productos, favoritos (rehidratación),
-- confianza del vendedor y anuncios destacados (2026-11-15).
-- Idempotente: todo es IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- El backend aplica estas mismas sentencias solo al arrancar
-- (ensureSchema en server.js), así que correr este archivo a mano es
-- opcional: sirve como registro y para aplicarlo antes del despliegue
-- si se quiere verificar en la base antes de que Render reinicie.
-- No borra nada ni toca tablas *_old.

-- 1. Sello "Vendedor verificado" en tiendas (solo el súper admin lo activa).
ALTER TABLE stores
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_stores_verified ON stores(is_verified);

-- 2. La columna de categoría ya existe en el esquema nuevo; por si una
-- base vieja no la tiene, se crea aquí (no hace nada en producción).
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS category VARCHAR(50);

-- 3. Anuncios destacados: vigencia por fecha. El producto es destacado
-- solo mientras featured_until > now(); ningún cron lo apaga.
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_products_featured
    ON products(featured_until) WHERE featured_until IS NOT NULL;

-- 4. Precios configurables de los destacados por duración (3, 7, 30 días).
-- NULL = sin definir: Luis fija los precios desde el panel del súper admin.
CREATE TABLE IF NOT EXISTS featured_prices (
    duration_days INTEGER PRIMARY KEY CHECK (duration_days IN (3, 7, 30)),
    price_cup NUMERIC(12,2),
    price_usd NUMERIC(12,2),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO featured_prices (duration_days) VALUES (3), (7), (30)
ON CONFLICT (duration_days) DO NOTHING;

-- 5. Limpieza de datos reales: 'Bebida ' (con espacio) es 'Bebidas';
-- recorta espacios en todas las categorías para que el filtro exacto
-- las encuentre.
UPDATE products SET category = 'Bebidas' WHERE btrim(category) = 'Bebida';
UPDATE products SET category = btrim(category)
WHERE category IS NOT NULL AND category <> btrim(category);
