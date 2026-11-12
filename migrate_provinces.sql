-- Migración Mercado Cuba: tabla provinces + columnas que server.js ya espera
-- Problema: server.js hace JOIN con provinces y filtra por
-- stores.province_id / stores.is_public_market, pero NINGÚN .sql del
-- repo crea esa tabla ni esas columnas (schema.sql, reset_database.sql
-- y copia_mercado.sql no las tienen). Por eso /api/public/provinces
-- devuelve 500 aunque la base responda.
-- Aplicar DESPUÉS de tener una base alcanzable (ver DATABASE_URL en Render),
-- y DESPUÉS de restaurar copia_mercado.sql si la base es nueva/vacía.
-- No borra nada: todo es IF NOT EXISTS / ON CONFLICT DO NOTHING.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS provinces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE stores
    ADD COLUMN IF NOT EXISTS province_id UUID REFERENCES provinces(id),
    ADD COLUMN IF NOT EXISTS is_public_market BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_stores_province ON stores(province_id);

INSERT INTO provinces (name) VALUES
    ('Pinar del Río'), ('Artemisa'), ('La Habana'), ('Mayabeque'),
    ('Matanzas'), ('Cienfuegos'), ('Villa Clara'), ('Sancti Spíritus'),
    ('Ciego de Ávila'), ('Camagüey'), ('Las Tunas'), ('Holguín'),
    ('Granma'), ('Santiago de Cuba'), ('Guantánamo'), ('Isla de la Juventud')
ON CONFLICT (name) DO NOTHING;

-- Las tiendas ya existentes quedan visibles en el mercado global
-- (el filtro de server.js exige is_public_market = true).
-- Su provincia queda en NULL hasta que cada vendedor la elija en
-- Configuración; por eso no aparecerán aún en el filtro por provincia.
UPDATE stores SET is_public_market = TRUE WHERE is_public_market IS FALSE OR is_public_market IS NULL;
