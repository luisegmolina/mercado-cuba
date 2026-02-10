-- Script para poblar la base de datos 'mercado_cuba' con datos de prueba
-- Limpia las tablas antes de insertar para evitar errores de duplicados si lo corres varias veces
TRUNCATE products, activation_codes, stores CASCADE;

DO $$
DECLARE
    store1_id UUID;
    store2_id UUID;
    store3_id UUID;
    store4_id UUID;
    store5_id UUID;
BEGIN
    -- ==========================================
    -- 1. CREAR TIENDAS
    -- ==========================================

    -- Tienda 1: Ropa
    INSERT INTO stores (name, description, whatsapp, owner_name, logo_url, whatsapp_clicks)
    VALUES ('Modas Habana', 'Ropa importada de alta calidad. Tallas S a XL. Entregas en toda La Habana.', '5351111111', 'Maria Gonzalez', 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400', 150)
    RETURNING id INTO store1_id;

    -- Tienda 2: Tecnología
    INSERT INTO stores (name, description, whatsapp, owner_name, logo_url, whatsapp_clicks)
    VALUES ('TecnoImport Cuba', 'Celulares, Laptops y Accesorios con garantía. Aceptamos pagos en USD/MLC.', '5352222222', 'Alejandro Perez', 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=400', 340);
    -- (Nota: Para PostgreSQL < 9.x se usaría otra forma, pero esto funciona en versiones modernas)
    -- Recuperamos el ID recién insertado si no usamos RETURNING en la misma línea para múltiples variables de forma segura
    SELECT id INTO store2_id FROM stores WHERE whatsapp = '5352222222';

    -- Tienda 3: Comida
    INSERT INTO stores (name, description, whatsapp, owner_name, logo_url, whatsapp_clicks)
    VALUES ('Paladar Doña Yuya', 'La mejor comida criolla a domicilio. Combos para cumpleaños y fiestas.', '5353333333', 'Yuliet Rodriguez', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400', 89)
    RETURNING id INTO store3_id;

    -- Tienda 4: Ferretería
    INSERT INTO stores (name, description, whatsapp, owner_name, logo_url, whatsapp_clicks)
    VALUES ('Ferretería El Tornillo', 'Materiales de construcción, herramientas y plomería. Precios competitivos.', '5354444444', 'Roberto Chang', 'https://images.unsplash.com/photo-1581235720704-06d3acfcb36f?w=400', 45)
    RETURNING id INTO store4_id;

    -- Tienda 5: Regalos
    INSERT INTO stores (name, description, whatsapp, owner_name, logo_url, whatsapp_clicks)
    VALUES ('Detalles y Amor', 'Arreglos florales, peluches y tazas personalizadas para toda ocasión.', '5355555555', 'Carmen Lopez', 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?w=400', 210)
    RETURNING id INTO store5_id;


    -- ==========================================
    -- 2. CREAR PRODUCTOS
    -- ==========================================

    -- Productos Tienda 1 (Modas Habana)
    INSERT INTO products (store_id, name, price, currency, category, image_url, stock) VALUES
    (store1_id, 'Vestido de Verano Floral', 2500, 'CUP', 'Ropa Mujer', 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400', 5),
    (store1_id, 'Jeans Levi Original', 40, 'USD', 'Ropa Hombre', 'https://images.unsplash.com/photo-1542272617-08f083157f5d?w=400', 10),
    (store1_id, 'Zapatillas Nike Air', 120, 'MLC', 'Calzado', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400', 3),
    (store1_id, 'Blusa Blanca Formal', 1500, 'CUP', 'Ropa Mujer', 'https://images.unsplash.com/photo-1598532163257-ae3c6b2524b6?w=400', 8);

    -- Productos Tienda 2 (TecnoImport)
    INSERT INTO products (store_id, name, price, currency, category, image_url, stock) VALUES
    (store2_id, 'iPhone 13 Pro Max 128GB', 950, 'USD', 'Celulares', 'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=400', 2),
    (store2_id, 'Samsung Galaxy A54', 350, 'USD', 'Celulares', 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400', 5),
    (store2_id, 'Audífonos Bluetooth Xiaomi', 3500, 'CUP', 'Accesorios', 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400', 20),
    (store2_id, 'Laptop HP 15 Pulgadas', 450, 'MLC', 'Laptops', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400', 1),
    (store2_id, 'Cargador Carga Rápida 20W', 15, 'USD', 'Accesorios', 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=400', 15);

    -- Productos Tienda 3 (Doña Yuya)
    INSERT INTO products (store_id, name, price, currency, category, image_url, stock) VALUES
    (store3_id, 'Combo Cumpleaños (Cake + Ensalada + Refresco)', 5000, 'CUP', 'Combos', 'https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec?w=400', 10),
    (store3_id, 'Pizza Familiar de Jamón', 1200, 'CUP', 'Comida Rápida', 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400', 50),
    (store3_id, 'Caja de Croquetas (20u)', 800, 'CUP', 'Picadera', 'https://images.unsplash.com/photo-1560155016-bd4879ae8f21?w=400', 100);

    -- Productos Tienda 4 (Ferretería)
    INSERT INTO products (store_id, name, price, currency, category, image_url, stock) VALUES
    (store4_id, 'Juego de Destornilladores', 15, 'MLC', 'Herramientas', 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=400', 5),
    (store4_id, 'Lata de Pintura Vinil (Blanca)', 30, 'USD', 'Materiales', 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=400', 12),
    (store4_id, 'Bombillos LED 12W (Paquete x4)', 10, 'USD', 'Iluminación', 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400', 30);

    -- Productos Tienda 5 (Regalos)
    INSERT INTO products (store_id, name, price, currency, category, image_url, stock) VALUES
    (store5_id, 'Taza Personalizada con Foto', 1500, 'CUP', 'Personalizados', 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400', 50),
    (store5_id, 'Ramo de Rosas (12u)', 3000, 'CUP', 'Flores', 'https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=400', 5),
    (store5_id, 'Caja de Bombones Artesanales', 1200, 'CUP', 'Dulces', 'https://images.unsplash.com/photo-1548907040-4baa42d10919?w=400', 20);


    -- ==========================================
    -- 3. CÓDIGOS DE ACTIVACIÓN
    -- ==========================================

    -- Códigos "usados" (asignados a las tiendas que acabamos de crear para que conste en registro)
    INSERT INTO activation_codes (code, status, used_by_store_id) VALUES 
    ('CODIGO-MODA-001', 'used', store1_id),
    ('CODIGO-TECNO-002', 'used', store2_id),
    ('CODIGO-COMIDA-003', 'used', store3_id),
    ('CODIGO-FERRE-004', 'used', store4_id),
    ('CODIGO-REGALO-005', 'used', store5_id);

    -- Códigos "activos" (Listos para crear tiendas nuevas)
    INSERT INTO activation_codes (code, status) VALUES 
    ('NUEVO-TIENDA-006', 'active'),
    ('NUEVO-TIENDA-007', 'active'),
    ('NUEVO-TIENDA-008', 'active'),
    ('VIP-SELLER-2024', 'active'),
    ('CUBA-EMPRENDE-25', 'active');

END $$;