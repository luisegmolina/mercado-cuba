-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de Configuración Admin (Para la contraseña maestra)
CREATE TABLE IF NOT EXISTS admin_config (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL
);

-- 2. Tabla de Tiendas
CREATE TABLE stores (
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
    whatsapp_clicks INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Productos
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'CUP',
    category VARCHAR(50),
    image_url TEXT, -- Aquí guardamos las URLs separadas por coma
    stock INTEGER DEFAULT 1,
    is_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla de Códigos de Activación
CREATE TABLE activation_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
    generated_by VARCHAR(50) DEFAULT 'SUPERADMIN',
    used_by_store_id UUID REFERENCES stores(id),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_stores_slug ON stores(slug);
CREATE INDEX idx_products_store ON products(store_id);
CREATE INDEX idx_products_search ON products(name);