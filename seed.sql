-- Script para poblar la base de datos 'mercado_cuba' con datos de EJEMPLO.
-- SOLO para desarrollo/pruebas. NO correr en producción (borra los datos).
-- Requiere que schema.sql ya esté aplicado (provincias incluidas).
-- Limpia las tablas antes de insertar para evitar duplicados si lo corres varias veces.
TRUNCATE products, activation_codes, stores CASCADE;

DO $$
DECLARE
    store1_id UUID;
    store2_id UUID;
    store3_id UUID;
    store4_id UUID;
    store5_id UUID;
    habana_id UUID;
    las_tunas_id UUID;
BEGIN
    SELECT id INTO habana_id FROM provinces WHERE name = 'La Habana';
    SELECT id INTO las_tunas_id FROM provinces WHERE name = 'Las Tunas';

    -- ==========================================
    -- 1. CREAR TIENDAS (ejemplo)
    -- ==========================================

    -- Tienda 1: Ropa (La Habana, visible en el mercado global)
    INSERT INTO stores (name, slug, description, whatsapp, owner_name, logo_url, whatsapp_clicks, is_public_market, province_id)
    VALUES ('Modas Habana', 'modas-habana', 'Ropa importada de alta calidad. Tallas S a XL. Entregas en toda La Habana.', '5351111111', 'Maria Gonzalez', 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400', 150, TRUE, habana_id)
    RETURNING id INTO store1_id;

    -- Tienda 2: Tecnología (La Habana)
    INSERT INTO stores (name, slug, description, whatsapp, owner_name, logo_url, whatsapp_clicks, is_public_market, province_id)
    VALUES ('TecnoImport Cuba', 'tecnoimport-cuba', 'Celulares, Laptops y Accesorios con garantía. Aceptamos pagos en USD/MLC.', '5352222222', 'Alejandro Perez', 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=400', 340, TRUE, habana_id)
    RETURNING id INTO store2_id;

    -- Tienda 3: Comida (Las Tunas)
    INSERT INTO stores (name, slug, description, whatsapp, owner_name, logo_url, whatsapp_clicks, is_public_market, province_id)
    VALUES ('Paladar Doña Yuya', 'paladar-dona-yuya', 'La mejor comida criolla a domicilio. Combos para cumpleaños y fiestas.', '5353333333', 'Yuliet Rodriguez', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400', 89, TRUE, las_tunas_id)
    RETURNING id INTO store3_id;

    -- Tienda 4: Ferretería (La Habana)
    INSERT INTO stores (name, slug, description, whatsapp, owner_name, logo_url, whatsapp_clicks, is_public_market, province_id)
    VALUES ('Ferretería El Tornillo', 'ferreteria-el-tornillo', 'Materiales de construcción, herramientas y plomería. Precios competitivos.', '5354444444', 'Roberto Chang', 'https://images.unsplash.com/photo-1581235720704-06d3acfcb36f?w=400', 45, TRUE, habana_id)
    RETURNING id INTO store4_id;

    -- Tienda 5: Regalos (La Habana)
    INSERT INTO stores (name, slug, description, whatsapp, owner_name, logo_url, whatsapp_clicks, is_public_market, province_id)
    VALUES ('Detalles y Amor', 'detalles-y-amor', 'Arreglos florales, peluches y tazas personalizadas para toda ocasión.', '5355555555', 'Carmen Lopez', 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?w=400', 210, TRUE, habana_id)
    RETURNING id INTO store5_id;

    -- ==========================================
    -- 2. CREAR PRODUCTOS (ejemplo, precio dual CUP/USD)
    -- ==========================================

    -- Productos Tienda 1 (Modas Habana)
    INSERT INTO products (store_id, name, price_cup, price_usd, category, image_url, stock) VALUES
    (store1_id, 'Vestido de Verano Floral', 2500, 10, 'Ropa Mujer', 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400', 5),
    (store1_id, 'Jeans Levi Original', 5000, 40, 'Ropa Hombre', 'https://images.unsplash.com/photo-1542272617-08f083157f5d?w=400', 10),
    (store1_id, 'Zapatillas Nike Air', 12000, 120, 'Calzado', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400', 3),
    (store1_id, 'Blusa Blanca Formal', 1500, 15, 'Ropa Mujer', 'https://images.unsplash.com/photo-1598532163257-ae3c6b2524b6?w=400', 8);

    -- Productos Tienda 2 (TecnoImport)
    INSERT INTO products (store_id, name, price_cup, price_usd, category, image_url, stock) VALUES
    (store2_id, 'iPhone 13 Pro Max 128GB', 0, 950, 'Celulares', 'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=400', 2),
    (store2_id, 'Samsung Galaxy A54', 0, 350, 'Celulares', 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400', 5),
    (store2_id, 'Audífonos Bluetooth Xiaomi', 3500, 15, 'Accesorios', 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400', 20),
    (store2_id, 'Laptop HP 15 Pulgadas', 0, 450, 'Laptops', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400', 1),
    (store2_id, 'Cargador Carga Rápida 20W', 1500, 15, 'Accesorios', 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=400', 15);

    -- Productos Tienda 3 (Doña Yuya)
    INSERT INTO products (store_id, name, price_cup, price_usd, category, image_url, stock) VALUES
    (store3_id, 'Combo Cumpleaños (Cake + Ensalada + Refresco)', 5000, 0, 'Combos', 'https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec?w=400', 10),
    (store3_id, 'Pizza Familiar de Jamón', 1200, 0, 'Comida Rápida', 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400', 50),
    (store3_id, 'Caja de Croquetas (20u)', 800, 0, 'Picadera', 'https://images.unsplash.com/photo-1560155016-bd4879ae8f21?w=400', 100);

    -- Productos Tienda 4 (Ferretería)
    INSERT INTO products (store_id, name, price_cup, price_usd, category, image_url, stock) VALUES
    (store4_id, 'Juego de Destornilladores', 4000, 15, 'Herramientas', 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=400', 5),
    (store4_id, 'Lata de Pintura Vinil (Blanca)', 9000, 30, 'Materiales', 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=400', 12),
    (store4_id, 'Bombillos LED 12W (Paquete x4)', 3000, 10, 'Iluminación', 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400', 30);

    -- Productos Tienda 5 (Regalos)
    INSERT INTO products (store_id, name, price_cup, price_usd, category, image_url, stock) VALUES
    (store5_id, 'Taza Personalizada con Foto', 1500, 0, 'Personalizados', 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400', 50),
    (store5_id, 'Ramo de Rosas (12u)', 3000, 0, 'Flores', 'https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=400', 5),
    (store5_id, 'Caja de Bombones Artesanales', 1200, 0, 'Dulces', 'https://images.unsplash.com/photo-1548907040-4baa42d10919?w=400', 20);

    -- ==========================================
    -- 3. CÓDIGOS DE ACTIVACIÓN (solo ejemplos)
    -- ==========================================

    -- Códigos ya canjeados (asignados a las tiendas de ejemplo, con fecha de canje)
    INSERT INTO activation_codes (code, status, used_by_store_id, used_at) VALUES
    ('EJEMPLO-MODA-001', 'used', store1_id, now()),
    ('EJEMPLO-TECNO-002', 'used', store2_id, now()),
    ('EJEMPLO-COMIDA-003', 'used', store3_id, now()),
    ('EJEMPLO-FERRE-004', 'used', store4_id, now()),
    ('EJEMPLO-REGALO-005', 'used', store5_id, now());

    -- Códigos activos de ejemplo (listos para crear tiendas de prueba)
    INSERT INTO activation_codes (code, status) VALUES
    ('EJEMPLO-NUEVA-006', 'active'),
    ('EJEMPLO-NUEVA-007', 'active'),
    ('EJEMPLO-NUEVA-008', 'active'),
    ('EJEMPLO-VIP-2026', 'active'),
    ('EJEMPLO-EMPRENDE-25', 'active');

END $$;
