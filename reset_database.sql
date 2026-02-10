-- ==================================================================
-- 1. LIMPIEZA TOTAL (BORRÓN Y CUENTA NUEVA)
-- ==================================================================
DROP TABLE IF EXISTS activation_codes CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS stores CASCADE;
DROP TABLE IF EXISTS admin_config CASCADE;

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================================================================
-- 2. CREACIÓN DE TABLAS (ESQUEMA ACTUALIZADO)
-- ==================================================================

-- Configuración Admin (Seguridad)
CREATE TABLE admin_config (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL
);

-- Tiendas
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
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

-- Productos (Con precio dual CUP/USD)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    price_cup DECIMAL(12, 2) DEFAULT 0,
    price_usd DECIMAL(12, 2) DEFAULT 0,
    category VARCHAR(50),
    image_url TEXT, -- URLs separadas por coma
    stock INTEGER DEFAULT 1,
    is_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Códigos de Activación
CREATE TABLE activation_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
    generated_by VARCHAR(50) DEFAULT 'SUPERADMIN',
    used_by_store_id UUID REFERENCES stores(id),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para velocidad
CREATE INDEX idx_stores_slug ON stores(slug);
CREATE INDEX idx_products_store ON products(store_id);
CREATE INDEX idx_products_search ON products(name);

-- ==================================================================
-- 3. CARGA MASIVA DE DATOS (SEED)
-- ==================================================================

-- ¡CORRECCIÓN!: NO insertamos el hash del admin aquí. 
-- Dejamos que server.js lo genere al arrancar para asegurar que sea válido.

DO $$
DECLARE
    -- Variables para guardar los IDs de las tiendas generadas
    s1 UUID; s2 UUID; s3 UUID; s4 UUID; s5 UUID;
    s6 UUID; s7 UUID; s8 UUID; s9 UUID; s10 UUID;
    
    -- Hash para contraseña de tiendas '123456'
    pass_hash VARCHAR := '$2a$10$X7V.j/tJ.X7V.j/tJ.X7V.e';
BEGIN

    -- -------------------------------------------------------
    -- TIENDA 1: MODAS HABANA (Ropa)
    -- -------------------------------------------------------
    INSERT INTO stores (name, slug, description, whatsapp, owner_name, logo_url, password_hash, whatsapp_clicks)
    VALUES ('Modas Habana', 'modas-habana', 'La mejor ropa importada de Panamá y Europa. Vestidos, Jeans y Zapatos de marca.', '5351111111', 'Maria Gonzalez', 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400', pass_hash, 120)
    RETURNING id INTO s1;

    INSERT INTO products (store_id, name, price_cup, price_usd, category, image_url, stock) VALUES
    (s1, 'Vestido de Verano Floral', 3500, 10, 'Mujer', 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400', 5),
    (s1, 'Jeans Levi Original', 5000, 15, 'Hombre', 'https://images.unsplash.com/photo-1542272617-08f083157f5d?w=400', 12),
    (s1, 'Zapatillas Nike Air Force', 12000, 35, 'Calzado', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400', 3),
    (s1, 'Gorra New Era NY', 2500, 8, 'Accesorios', 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400', 20),
    (s1, 'Blusa Blanca Elegante', 2800, 9, 'Mujer', 'https://images.unsplash.com/photo-1598532163257-ae3c6b2524b6?w=400', 8);

    -- -------------------------------------------------------
    -- TIENDA 2: TECNOIMPORT CUBA (Tecnología)
    -- -------------------------------------------------------
    INSERT INTO stores (name, slug, description, whatsapp, owner_name, logo_url, password_hash, whatsapp_clicks)
    VALUES ('TecnoImport Cuba', 'tecnoimport-cuba', 'Celulares sellados en caja, Laptops, Micas y Forros. Garantía de 1 mes.', '5352222222', 'Alejandro Perez', 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=400', pass_hash, 340)
    RETURNING id INTO s2;

    INSERT INTO products (store_id, name, price_cup, price_usd, category, image_url, stock) VALUES
    (s2, 'iPhone 14 Pro Max 256GB', 0, 1100, 'Celulares', 'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=400', 2),
    (s2, 'Samsung Galaxy A54 5G', 0, 380, 'Celulares', 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400', 5),
    (s2, 'Laptop HP 15" i5 16GB RAM', 0, 550, 'Laptops', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400', 1),
    (s2, 'AirPods Pro 2da Gen', 8000, 25, 'Audio', 'https://images.unsplash.com/photo-1603351154351-5cf23309275b?w=400', 10),
    (s2, 'Cargador Rápido 20W Apple', 3000, 10, 'Accesorios', 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=400', 15),
    (s2, 'Powerbank Xiaomi 10000mAh', 4500, 15, 'Accesorios', 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400', 8);

    -- -------------------------------------------------------
    -- TIENDA 3: PALADAR DOÑA YUYA (Comida)
    -- -------------------------------------------------------
    INSERT INTO stores (name, slug, description, whatsapp, owner_name, logo_url, password_hash, whatsapp_clicks)
    VALUES ('Paladar Doña Yuya', 'paladar-dona-yuya', 'Comida criolla a domicilio. Combos para cumpleaños, cakes y buffet. Sabor 100% cubano.', '5353333333', 'Yuliet Rodriguez', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400', pass_hash, 89)
    RETURNING id INTO s3;

    INSERT INTO products (store_id, name, price_cup, price_usd, category, image_url, stock) VALUES
    (s3, 'Combo Familiar (Arroz, Cerdo, Vianda)', 4500, 0, 'Combos', 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400', 10),
    (s3, 'Pizza Familiar de Jamón', 1200, 0, 'Comida Rápida', 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400', 50),
    (s3, 'Caja de Croquetas (20u)', 800, 0, 'Picadera', 'https://images.unsplash.com/photo-1560155016-bd4879ae8f21?w=400', 100),
    (s3, 'Cake de Chocolate', 3000, 0, 'Dulces', 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400', 5),
    (s3, 'Tamales en Cazuela', 500, 0, 'Comida Criolla', 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400', 30);

    -- -------------------------------------------------------
    -- TIENDA 4: FERRETERÍA EL TORNILLO (Hogar)
    -- -------------------------------------------------------
    INSERT INTO stores (name, slug, description, whatsapp, owner_name, logo_url, password_hash, whatsapp_clicks)
    VALUES ('Ferretería El Tornillo', 'ferreteria-el-tornillo', 'Materiales de construcción, herramientas, plomería y electricidad.', '5354444444', 'Roberto Chang', 'https://images.unsplash.com/photo-1581235720704-06d3acfcb36f?w=400', pass_hash, 45)
    RETURNING id INTO s4;

    INSERT INTO products (store_id, name, price_cup, price_usd, category, image_url, stock) VALUES
    (s4, 'Juego de Destornilladores', 4000, 12, 'Herramientas', 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=400', 5),
    (s4, 'Lata de Pintura Vinil (Blanca)', 9000, 28, 'Materiales', 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=400', 12),
    (s4, 'Bombillos LED 12W (Paquete x4)', 3000, 9, 'Iluminación', 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400', 30),
    (s4, 'Cemento Gris P-350 (Saco)', 0, 15, 'Materiales', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400', 50);

    -- -------------------------------------------------------
    -- TIENDA 5: REGALOS Y FLORES (Varios)
    -- -------------------------------------------------------
    INSERT INTO stores (name, slug, description, whatsapp, owner_name, logo_url, password_hash, whatsapp_clicks)
    VALUES ('Detalles y Amor', 'detalles-y-amor', 'Arreglos florales, peluches y tazas personalizadas para toda ocasión.', '5355555555', 'Carmen Lopez', 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?w=400', pass_hash, 210)
    RETURNING id INTO s5;

    INSERT INTO products (store_id, name, price_cup, price_usd, category, image_url, stock) VALUES
    (s5, 'Taza Personalizada con Foto', 1500, 0, 'Personalizados', 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400', 50),
    (s5, 'Ramo de Rosas (12u)', 3000, 0, 'Flores', 'https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=400', 5),
    (s5, 'Oso de Peluche Gigante', 7000, 20, 'Regalos', 'https://images.unsplash.com/photo-1559454403-b8fb87521bc7?w=400', 2);

    -- -------------------------------------------------------
    -- TIENDA 6: AUTOPARTES VEDADO (Automotriz)
    -- -------------------------------------------------------
    INSERT INTO stores (name, slug, description, whatsapp, owner_name, logo_url, password_hash, whatsapp_clicks)
    VALUES ('AutoPartes Vedado', 'autopartes-vedado', 'Piezas de repuesto para Lada, Moskvitch y autos modernos. Baterías y Neumáticos.', '5356666666', 'Carlos Mecánico', 'https://images.unsplash.com/photo-1486262715619-01b80250e0dc?w=400', pass_hash, 60)
    RETURNING id INTO s6;

    INSERT INTO products (store_id, name, price_cup, price_usd, category, image_url, stock) VALUES
    (s6, 'Batería 12V 75Ah', 0, 120, 'Baterías', 'https://images.unsplash.com/photo-1623999427329-a1b7e289453c?w=400', 4),
    (s6, 'Juego de Neumáticos R13', 0, 200, 'Neumáticos', 'https://images.unsplash.com/photo-1578844251758-2f71da645217?w=400', 8),
    (s6, 'Aceite de Motor 10W40 (5L)', 6000, 20, 'Mantenimiento', 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400', 15);

    -- -------------------------------------------------------
    -- TIENDA 7: MUEBLES CUBANOS (Hogar)
    -- -------------------------------------------------------
    INSERT INTO stores (name, slug, description, whatsapp, owner_name, logo_url, password_hash, whatsapp_clicks)
    VALUES ('Muebles Cubanos', 'muebles-cubanos', 'Muebles de madera preciosa y aluminio. Juegos de sala y comedor.', '5357777777', 'Jose Ebanista', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400', pass_hash, 95)
    RETURNING id INTO s7;

    INSERT INTO products (store_id, name, price_cup, price_usd, category, image_url, stock) VALUES
    (s7, 'Juego de Sala (Sofá en L)', 0, 400, 'Sala', 'https://images.unsplash.com/photo-1550254478-ead40cc54513?w=400', 2),
    (s7, 'Cama Camera de Madera', 0, 250, 'Dormitorio', 'https://images.unsplash.com/photo-1505693416388-b0346efee539?w=400', 3),
    (s7, 'Mesita de Noche', 5000, 15, 'Dormitorio', 'https://images.unsplash.com/photo-1532372320572-cda25653a26d?w=400', 10);

    -- -------------------------------------------------------
    -- TIENDA 8: ELECTROHOGAR (Electrodomésticos)
    -- -------------------------------------------------------
    INSERT INTO stores (name, slug, description, whatsapp, owner_name, logo_url, password_hash, whatsapp_clicks)
    VALUES ('ElectroHogar', 'electrohogar', 'Ollas reina, batidoras, ventiladores y aires acondicionados.', '5358888888', 'Ana Laura', 'https://images.unsplash.com/photo-1571175443880-49e1d58b794a?w=400', pass_hash, 180)
    RETURNING id INTO s8;

    INSERT INTO products (store_id, name, price_cup, price_usd, category, image_url, stock) VALUES
    (s8, 'Olla Reina 6L', 0, 70, 'Cocina', 'https://images.unsplash.com/photo-1585237671758-29a3998066c3?w=400', 10),
    (s8, 'Ventilador Recargable', 9000, 30, 'Clima', 'https://images.unsplash.com/photo-1617101880859-997576579ec7?w=400', 25),
    (s8, 'Batidora Oster', 0, 50, 'Cocina', 'https://images.unsplash.com/photo-1570222094114-28a9d88a27e6?w=400', 8);

    -- -------------------------------------------------------
    -- TIENDA 9: SUPERMARKET 23 (Mixto)
    -- -------------------------------------------------------
    INSERT INTO stores (name, slug, description, whatsapp, owner_name, logo_url, password_hash, whatsapp_clicks)
    VALUES ('Minimarket El Rápido', 'minimarket-el-rapido', 'Aseo, alimentos y bebidas. Todo lo que necesitas para tu hogar.', '5359999999', 'Pedro Luis', 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400', pass_hash, 300)
    RETURNING id INTO s9;

    INSERT INTO products (store_id, name, price_cup, price_usd, category, image_url, stock) VALUES
    (s9, 'Paquete de Pollo (5kg)', 0, 12, 'Cárnicos', 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400', 20),
    (s9, 'Detergente en Polvo (1kg)', 800, 0, 'Aseo', 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=400', 50),
    (s9, 'Aceite Vegetal (1L)', 900, 0, 'Alimentos', 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400', 30);

    -- -------------------------------------------------------
    -- TIENDA 10: GAMER ZONE (Juegos) - SUSPENDIDA (EJEMPLO)
    -- -------------------------------------------------------
    INSERT INTO stores (name, slug, description, whatsapp, owner_name, logo_url, password_hash, is_suspended, whatsapp_clicks)
    VALUES ('Gamer Zone', 'gamer-zone', 'Consolas, videojuegos y tarjetas de regalo.', '5350001111', 'Kevin Gamer', 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=400', pass_hash, TRUE, 10)
    RETURNING id INTO s10;

    INSERT INTO products (store_id, name, price_cup, price_usd, category, image_url, stock) VALUES
    (s10, 'PlayStation 5', 0, 800, 'Consolas', 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=400', 1);


    -- ==================================================================
    -- 4. CÓDIGOS DE ACTIVACIÓN
    -- ==================================================================

    -- Códigos usados (vinculados a las tiendas anteriores)
    INSERT INTO activation_codes (code, status, used_by_store_id) VALUES 
    ('COD-MODAS-01', 'used', s1),
    ('COD-TECNO-02', 'used', s2),
    ('COD-YUYA-03', 'used', s3),
    ('COD-FERRE-04', 'used', s4),
    ('COD-REGAL-05', 'used', s5),
    ('COD-AUTO-06', 'used', s6),
    ('COD-MUEBL-07', 'used', s7),
    ('COD-ELECT-08', 'used', s8),
    ('COD-MARKET-09', 'used', s9),
    ('COD-GAME-10', 'used', s10);

    -- Códigos activos (Para probar registro nuevo)
    INSERT INTO activation_codes (code, status) VALUES 
    ('CUBA-LIBRE', 'active'),
    ('EMPRENDE-2026', 'active'),
    ('VENDEDOR-VIP', 'active'),
    ('TIENDA-NUEVA-1', 'active'),
    ('TIENDA-NUEVA-2', 'active');

END $$;