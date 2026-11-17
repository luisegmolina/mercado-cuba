-- ==================================================================
-- ESQUEMA CANÓNICO de Mercado Cuba (lo que server.js espera).
-- Solo crea lo que falta: es seguro correrlo sobre una base existente.
--
-- RECONSTRUIDO a partir de server.js y de las migraciones del repo
-- (NO de un pg_dump de Neon): si algún detalle difiere de producción,
-- manda lo que diga Neon. Verificado en Neon el 2026-11-17: la tabla
-- stores tiene exactamente las columnas de aquí (sin password_hash ni
-- is_public_market), existen los índices trigram de abajo y los CHECK
-- de product_images y store_licenses son los que pone este archivo.
-- Queda sin verificar algún largo de VARCHAR y algún default menor.
-- Las tablas admin_config y activation_codes son del esquema viejo y
-- server.js ya no las usa: no están aquí. Las tablas *_old tampoco.
-- ==================================================================

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Provincias (16 oficiales)
CREATE TABLE IF NOT EXISTS provinces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Municipios (168 oficiales, ONEI) por provincia
CREATE TABLE IF NOT EXISTS municipalities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    province_id UUID NOT NULL REFERENCES provinces(id),
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (province_id, name)
);

-- 3. Usuarios (vendedores): un WhatsApp = una cuenta
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    whatsapp VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    owner_name VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
    must_reset_password BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Administradores (súper admin; solo hay uno en producción)
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    password_hash VARCHAR(255) NOT NULL,
    support_whatsapp VARCHAR(20),
    password_changed_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Tiendas (un usuario = una tienda)
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
    description TEXT,
    whatsapp VARCHAR(20) NOT NULL,
    owner_name VARCHAR(100),
    logo_url TEXT,
    cover_url TEXT,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    province_id UUID REFERENCES provinces(id),
    municipality_id UUID REFERENCES municipalities(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Productos (precio dual CUP/USD)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price_cup NUMERIC(12, 2) NOT NULL DEFAULT 0,
    price_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
    category VARCHAR(50),
    stock INTEGER NOT NULL DEFAULT 0,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    featured_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Fotos de productos (máx. 5 por producto; sin data: URLs)
CREATE TABLE IF NOT EXISTS product_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url TEXT NOT NULL CHECK (url LIKE 'http%' AND url NOT ILIKE 'data:%'),
    position INTEGER NOT NULL CHECK (position >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, position)
);

-- 8. Licencias (códigos PRO-XXXXXX; vigencia 365 días)
CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'used', 'revoked')),
    expires_at TIMESTAMPTZ,
    duration_days INTEGER NOT NULL DEFAULT 365,
    created_by_admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Concesiones de licencia (tienda activa solo con una vigente)
CREATE TABLE IF NOT EXISTS store_licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
    valid_until TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Historial de eventos de licencias
CREATE TABLE IF NOT EXISTS license_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_id UUID REFERENCES licenses(id),
    store_id UUID REFERENCES stores(id),
    user_id UUID REFERENCES users(id),
    admin_id UUID REFERENCES admins(id),
    event VARCHAR(50) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Auditoría (actor_type solo 'admin' o 'vendor')
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('admin', 'vendor')),
    actor_id UUID,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Tasas de cambio (elTOQUE para USD/EUR/MLC; resto manual)
CREATE TABLE IF NOT EXISTS exchange_rates (
    currency VARCHAR(10) PRIMARY KEY,
    rate_cup NUMERIC(12, 2) NOT NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'elTOQUE',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. Precios de anuncios destacados por duración (NULL = sin definir)
CREATE TABLE IF NOT EXISTS featured_prices (
    duration_days INTEGER PRIMARY KEY CHECK (duration_days IN (3, 7, 30)),
    price_cup NUMERIC(12, 2),
    price_usd NUMERIC(12, 2),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);
CREATE INDEX IF NOT EXISTS idx_stores_province ON stores(province_id);
CREATE INDEX IF NOT EXISTS idx_stores_municipality ON stores(municipality_id);
CREATE INDEX IF NOT EXISTS idx_stores_verified ON stores(is_verified);
CREATE INDEX IF NOT EXISTS idx_municipalities_province ON municipalities(province_id);
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at);
CREATE INDEX IF NOT EXISTS idx_products_featured
    ON products(featured_until) WHERE featured_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);

-- Búsqueda por texto: índices trigram (pg_trgm), confirmados en Neon.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_stores_name_trgm
    ON stores USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
    ON products USING gin (name gin_trgm_ops);

-- Provincias de Cuba (16)
INSERT INTO provinces (name) VALUES
    ('Pinar del Río'), ('Artemisa'), ('La Habana'), ('Mayabeque'),
    ('Matanzas'), ('Cienfuegos'), ('Villa Clara'), ('Sancti Spíritus'),
    ('Ciego de Ávila'), ('Camagüey'), ('Las Tunas'), ('Holguín'),
    ('Granma'), ('Santiago de Cuba'), ('Guantánamo'), ('Isla de la Juventud')
ON CONFLICT (name) DO NOTHING;

-- Duraciones de destacados (precios los fija el súper admin)
INSERT INTO featured_prices (duration_days) VALUES (3), (7), (30)
ON CONFLICT (duration_days) DO NOTHING;

-- Tasas iniciales (valores del 2026-11-17; el arranque del backend las
-- actualiza desde elTOQUE, y el resto se corrige desde el panel admin).
INSERT INTO exchange_rates (currency, rate_cup, source) VALUES
    ('USD', 930, 'elTOQUE'),
    ('EUR', 1000, 'elTOQUE'),
    ('MLC', 845.37, 'elTOQUE'),
    ('CAD', 580.03, 'manual'),
    ('MXN', 50.95, 'manual'),
    ('ZELLE', 907.33, 'manual'),
    ('CLA', 852.64, 'manual')
ON CONFLICT (currency) DO NOTHING;
