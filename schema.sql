-- ==================================================================
-- ESQUEMA CANÓNICO de Mercado Cuba (lo que server.js espera).
-- Solo crea lo que falta: es seguro correrlo sobre una base existente.
-- ==================================================================

-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de Configuración Admin (contraseña maestra y WhatsApp de soporte)
CREATE TABLE IF NOT EXISTS admin_config (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL
);

-- 2. Tabla de Provincias
CREATE TABLE IF NOT EXISTS provinces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL
);

-- 3. Tabla de Tiendas
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL, -- Para la URL amigable
    description TEXT,
    whatsapp VARCHAR(20) NOT NULL UNIQUE,
    owner_name VARCHAR(100),
    logo_url TEXT,
    password_hash VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    is_suspended BOOLEAN DEFAULT FALSE,
    is_public_market BOOLEAN DEFAULT FALSE,
    province_id UUID REFERENCES provinces(id),
    whatsapp_clicks INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla de Productos (precio dual CUP/USD)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    price_cup DECIMAL(12, 2) DEFAULT 0,
    price_usd DECIMAL(12, 2) DEFAULT 0,
    category VARCHAR(50),
    description TEXT,
    image_url TEXT, -- URLs o data URIs (JSON) de las fotos
    stock INTEGER DEFAULT 1,
    is_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabla de Códigos de Activación (licencias)
CREATE TABLE IF NOT EXISTS activation_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
    generated_by VARCHAR(50) DEFAULT 'SUPERADMIN',
    used_by_store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);
CREATE INDEX IF NOT EXISTS idx_stores_province ON stores(province_id);
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_search ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at);
CREATE INDEX IF NOT EXISTS idx_products_public ON products(store_id, is_visible);
CREATE INDEX IF NOT EXISTS idx_stores_public ON stores(is_public_market, is_suspended);

-- Provincias de Cuba (16)
INSERT INTO provinces (name) VALUES
    ('Pinar del Río'), ('Artemisa'), ('La Habana'), ('Mayabeque'),
    ('Matanzas'), ('Cienfuegos'), ('Villa Clara'), ('Sancti Spíritus'),
    ('Ciego de Ávila'), ('Camagüey'), ('Las Tunas'), ('Holguín'),
    ('Granma'), ('Santiago de Cuba'), ('Guantánamo'), ('Isla de la Juventud')
ON CONFLICT (name) DO NOTHING;
