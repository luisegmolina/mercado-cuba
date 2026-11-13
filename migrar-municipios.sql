-- Migración Mercado Cuba: municipios por provincia (168, lista oficial ONEI)
-- La columna es OPCIONAL: las tiendas sin municipio quedan en NULL
-- ("Sin especificar") y siguen apareciendo en todos los listados.
-- Idempotente: todo es IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- Aplicar en Neon PRODUCCIÓN antes de desplegar el código que la usa
-- (los endpoints hacen JOIN a municipalities).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS municipalities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    province_id UUID NOT NULL REFERENCES provinces(id),
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (province_id, name)
);

ALTER TABLE stores
    ADD COLUMN IF NOT EXISTS municipality_id UUID REFERENCES municipalities(id);

CREATE INDEX IF NOT EXISTS idx_stores_municipality ON stores(municipality_id);
CREATE INDEX IF NOT EXISTS idx_municipalities_province ON municipalities(province_id);

-- Pinar del Río (11)
INSERT INTO municipalities (province_id, name) VALUES
((SELECT id FROM provinces WHERE name = 'Pinar del Río'), 'Consolación del Sur'),
((SELECT id FROM provinces WHERE name = 'Pinar del Río'), 'Guane'),
((SELECT id FROM provinces WHERE name = 'Pinar del Río'), 'La Palma'),
((SELECT id FROM provinces WHERE name = 'Pinar del Río'), 'Los Palacios'),
((SELECT id FROM provinces WHERE name = 'Pinar del Río'), 'Mantua'),
((SELECT id FROM provinces WHERE name = 'Pinar del Río'), 'Minas de Matahambre'),
((SELECT id FROM provinces WHERE name = 'Pinar del Río'), 'Pinar del Río'),
((SELECT id FROM provinces WHERE name = 'Pinar del Río'), 'San Juan y Martínez'),
((SELECT id FROM provinces WHERE name = 'Pinar del Río'), 'San Luis'),
((SELECT id FROM provinces WHERE name = 'Pinar del Río'), 'Sandino'),
((SELECT id FROM provinces WHERE name = 'Pinar del Río'), 'Viñales')
ON CONFLICT (province_id, name) DO NOTHING;

-- Artemisa (11)
INSERT INTO municipalities (province_id, name) VALUES
((SELECT id FROM provinces WHERE name = 'Artemisa'), 'Alquízar'),
((SELECT id FROM provinces WHERE name = 'Artemisa'), 'Artemisa'),
((SELECT id FROM provinces WHERE name = 'Artemisa'), 'Bahía Honda'),
((SELECT id FROM provinces WHERE name = 'Artemisa'), 'Bauta'),
((SELECT id FROM provinces WHERE name = 'Artemisa'), 'Caimito'),
((SELECT id FROM provinces WHERE name = 'Artemisa'), 'Candelaria'),
((SELECT id FROM provinces WHERE name = 'Artemisa'), 'Guanajay'),
((SELECT id FROM provinces WHERE name = 'Artemisa'), 'Güira de Melena'),
((SELECT id FROM provinces WHERE name = 'Artemisa'), 'Mariel'),
((SELECT id FROM provinces WHERE name = 'Artemisa'), 'San Antonio de los Baños'),
((SELECT id FROM provinces WHERE name = 'Artemisa'), 'San Cristóbal')
ON CONFLICT (province_id, name) DO NOTHING;

-- La Habana (15)
INSERT INTO municipalities (province_id, name) VALUES
((SELECT id FROM provinces WHERE name = 'La Habana'), 'Arroyo Naranjo'),
((SELECT id FROM provinces WHERE name = 'La Habana'), 'Boyeros'),
((SELECT id FROM provinces WHERE name = 'La Habana'), 'Centro Habana'),
((SELECT id FROM provinces WHERE name = 'La Habana'), 'Cerro'),
((SELECT id FROM provinces WHERE name = 'La Habana'), 'Cotorro'),
((SELECT id FROM provinces WHERE name = 'La Habana'), 'Diez de Octubre'),
((SELECT id FROM provinces WHERE name = 'La Habana'), 'Guanabacoa'),
((SELECT id FROM provinces WHERE name = 'La Habana'), 'Habana del Este'),
((SELECT id FROM provinces WHERE name = 'La Habana'), 'Habana Vieja'),
((SELECT id FROM provinces WHERE name = 'La Habana'), 'La Lisa'),
((SELECT id FROM provinces WHERE name = 'La Habana'), 'Marianao'),
((SELECT id FROM provinces WHERE name = 'La Habana'), 'Playa'),
((SELECT id FROM provinces WHERE name = 'La Habana'), 'Plaza de la Revolución'),
((SELECT id FROM provinces WHERE name = 'La Habana'), 'Regla'),
((SELECT id FROM provinces WHERE name = 'La Habana'), 'San Miguel del Padrón')
ON CONFLICT (province_id, name) DO NOTHING;

-- Mayabeque (11)
INSERT INTO municipalities (province_id, name) VALUES
((SELECT id FROM provinces WHERE name = 'Mayabeque'), 'Batabanó'),
((SELECT id FROM provinces WHERE name = 'Mayabeque'), 'Bejucal'),
((SELECT id FROM provinces WHERE name = 'Mayabeque'), 'Güines'),
((SELECT id FROM provinces WHERE name = 'Mayabeque'), 'Jaruco'),
((SELECT id FROM provinces WHERE name = 'Mayabeque'), 'Madruga'),
((SELECT id FROM provinces WHERE name = 'Mayabeque'), 'Melena del Sur'),
((SELECT id FROM provinces WHERE name = 'Mayabeque'), 'Nueva Paz'),
((SELECT id FROM provinces WHERE name = 'Mayabeque'), 'Quivicán'),
((SELECT id FROM provinces WHERE name = 'Mayabeque'), 'San José de las Lajas'),
((SELECT id FROM provinces WHERE name = 'Mayabeque'), 'San Nicolás de Bari'),
((SELECT id FROM provinces WHERE name = 'Mayabeque'), 'Santa Cruz del Norte')
ON CONFLICT (province_id, name) DO NOTHING;

-- Matanzas (13)
INSERT INTO municipalities (province_id, name) VALUES
((SELECT id FROM provinces WHERE name = 'Matanzas'), 'Calimete'),
((SELECT id FROM provinces WHERE name = 'Matanzas'), 'Cárdenas'),
((SELECT id FROM provinces WHERE name = 'Matanzas'), 'Ciénaga de Zapata'),
((SELECT id FROM provinces WHERE name = 'Matanzas'), 'Colón'),
((SELECT id FROM provinces WHERE name = 'Matanzas'), 'Jagüey Grande'),
((SELECT id FROM provinces WHERE name = 'Matanzas'), 'Jovellanos'),
((SELECT id FROM provinces WHERE name = 'Matanzas'), 'Limonar'),
((SELECT id FROM provinces WHERE name = 'Matanzas'), 'Los Arabos'),
((SELECT id FROM provinces WHERE name = 'Matanzas'), 'Martí'),
((SELECT id FROM provinces WHERE name = 'Matanzas'), 'Matanzas'),
((SELECT id FROM provinces WHERE name = 'Matanzas'), 'Pedro Betancourt'),
((SELECT id FROM provinces WHERE name = 'Matanzas'), 'Perico'),
((SELECT id FROM provinces WHERE name = 'Matanzas'), 'Unión de Reyes')
ON CONFLICT (province_id, name) DO NOTHING;

-- Villa Clara (13)
INSERT INTO municipalities (province_id, name) VALUES
((SELECT id FROM provinces WHERE name = 'Villa Clara'), 'Caibarién'),
((SELECT id FROM provinces WHERE name = 'Villa Clara'), 'Camajuaní'),
((SELECT id FROM provinces WHERE name = 'Villa Clara'), 'Cifuentes'),
((SELECT id FROM provinces WHERE name = 'Villa Clara'), 'Corralillo'),
((SELECT id FROM provinces WHERE name = 'Villa Clara'), 'Encrucijada'),
((SELECT id FROM provinces WHERE name = 'Villa Clara'), 'Manicaragua'),
((SELECT id FROM provinces WHERE name = 'Villa Clara'), 'Placetas'),
((SELECT id FROM provinces WHERE name = 'Villa Clara'), 'Quemado de Güines'),
((SELECT id FROM provinces WHERE name = 'Villa Clara'), 'Ranchuelo'),
((SELECT id FROM provinces WHERE name = 'Villa Clara'), 'Remedios'),
((SELECT id FROM provinces WHERE name = 'Villa Clara'), 'Sagua la Grande'),
((SELECT id FROM provinces WHERE name = 'Villa Clara'), 'Santa Clara'),
((SELECT id FROM provinces WHERE name = 'Villa Clara'), 'Santo Domingo')
ON CONFLICT (province_id, name) DO NOTHING;

-- Cienfuegos (8)
INSERT INTO municipalities (province_id, name) VALUES
((SELECT id FROM provinces WHERE name = 'Cienfuegos'), 'Abreus'),
((SELECT id FROM provinces WHERE name = 'Cienfuegos'), 'Aguada de Pasajeros'),
((SELECT id FROM provinces WHERE name = 'Cienfuegos'), 'Cienfuegos'),
((SELECT id FROM provinces WHERE name = 'Cienfuegos'), 'Cruces'),
((SELECT id FROM provinces WHERE name = 'Cienfuegos'), 'Cumanayagua'),
((SELECT id FROM provinces WHERE name = 'Cienfuegos'), 'Lajas'),
((SELECT id FROM provinces WHERE name = 'Cienfuegos'), 'Palmira'),
((SELECT id FROM provinces WHERE name = 'Cienfuegos'), 'Rodas')
ON CONFLICT (province_id, name) DO NOTHING;

-- Sancti Spíritus (8)
INSERT INTO municipalities (province_id, name) VALUES
((SELECT id FROM provinces WHERE name = 'Sancti Spíritus'), 'Cabaiguán'),
((SELECT id FROM provinces WHERE name = 'Sancti Spíritus'), 'Fomento'),
((SELECT id FROM provinces WHERE name = 'Sancti Spíritus'), 'Jatibonico'),
((SELECT id FROM provinces WHERE name = 'Sancti Spíritus'), 'La Sierpe'),
((SELECT id FROM provinces WHERE name = 'Sancti Spíritus'), 'Sancti Spíritus'),
((SELECT id FROM provinces WHERE name = 'Sancti Spíritus'), 'Taguasco'),
((SELECT id FROM provinces WHERE name = 'Sancti Spíritus'), 'Trinidad'),
((SELECT id FROM provinces WHERE name = 'Sancti Spíritus'), 'Yaguajay')
ON CONFLICT (province_id, name) DO NOTHING;

-- Ciego de Ávila (10)
INSERT INTO municipalities (province_id, name) VALUES
((SELECT id FROM provinces WHERE name = 'Ciego de Ávila'), 'Baraguá'),
((SELECT id FROM provinces WHERE name = 'Ciego de Ávila'), 'Bolivia'),
((SELECT id FROM provinces WHERE name = 'Ciego de Ávila'), 'Chambas'),
((SELECT id FROM provinces WHERE name = 'Ciego de Ávila'), 'Ciego de Ávila'),
((SELECT id FROM provinces WHERE name = 'Ciego de Ávila'), 'Ciro Redondo'),
((SELECT id FROM provinces WHERE name = 'Ciego de Ávila'), 'Florencia'),
((SELECT id FROM provinces WHERE name = 'Ciego de Ávila'), 'Majagua'),
((SELECT id FROM provinces WHERE name = 'Ciego de Ávila'), 'Morón'),
((SELECT id FROM provinces WHERE name = 'Ciego de Ávila'), 'Primero de Enero'),
((SELECT id FROM provinces WHERE name = 'Ciego de Ávila'), 'Venezuela')
ON CONFLICT (province_id, name) DO NOTHING;

-- Camagüey (13)
INSERT INTO municipalities (province_id, name) VALUES
((SELECT id FROM provinces WHERE name = 'Camagüey'), 'Camagüey'),
((SELECT id FROM provinces WHERE name = 'Camagüey'), 'Carlos Manuel de Céspedes'),
((SELECT id FROM provinces WHERE name = 'Camagüey'), 'Esmeralda'),
((SELECT id FROM provinces WHERE name = 'Camagüey'), 'Florida'),
((SELECT id FROM provinces WHERE name = 'Camagüey'), 'Guáimaro'),
((SELECT id FROM provinces WHERE name = 'Camagüey'), 'Jimaguayú'),
((SELECT id FROM provinces WHERE name = 'Camagüey'), 'Minas'),
((SELECT id FROM provinces WHERE name = 'Camagüey'), 'Najasa'),
((SELECT id FROM provinces WHERE name = 'Camagüey'), 'Nuevitas'),
((SELECT id FROM provinces WHERE name = 'Camagüey'), 'Santa Cruz del Sur'),
((SELECT id FROM provinces WHERE name = 'Camagüey'), 'Sibanicú'),
((SELECT id FROM provinces WHERE name = 'Camagüey'), 'Sierra de Cubitas'),
((SELECT id FROM provinces WHERE name = 'Camagüey'), 'Vertientes')
ON CONFLICT (province_id, name) DO NOTHING;

-- Las Tunas (8)
INSERT INTO municipalities (province_id, name) VALUES
((SELECT id FROM provinces WHERE name = 'Las Tunas'), 'Amancio'),
((SELECT id FROM provinces WHERE name = 'Las Tunas'), 'Colombia'),
((SELECT id FROM provinces WHERE name = 'Las Tunas'), 'Jesús Menéndez'),
((SELECT id FROM provinces WHERE name = 'Las Tunas'), 'Jobabo'),
((SELECT id FROM provinces WHERE name = 'Las Tunas'), 'Las Tunas'),
((SELECT id FROM provinces WHERE name = 'Las Tunas'), 'Majibacoa'),
((SELECT id FROM provinces WHERE name = 'Las Tunas'), 'Manatí'),
((SELECT id FROM provinces WHERE name = 'Las Tunas'), 'Puerto Padre')
ON CONFLICT (province_id, name) DO NOTHING;

-- Granma (13)
INSERT INTO municipalities (province_id, name) VALUES
((SELECT id FROM provinces WHERE name = 'Granma'), 'Bartolomé Masó'),
((SELECT id FROM provinces WHERE name = 'Granma'), 'Bayamo'),
((SELECT id FROM provinces WHERE name = 'Granma'), 'Buey Arriba'),
((SELECT id FROM provinces WHERE name = 'Granma'), 'Campechuela'),
((SELECT id FROM provinces WHERE name = 'Granma'), 'Cauto Cristo'),
((SELECT id FROM provinces WHERE name = 'Granma'), 'Guisa'),
((SELECT id FROM provinces WHERE name = 'Granma'), 'Jiguaní'),
((SELECT id FROM provinces WHERE name = 'Granma'), 'Manzanillo'),
((SELECT id FROM provinces WHERE name = 'Granma'), 'Media Luna'),
((SELECT id FROM provinces WHERE name = 'Granma'), 'Niquero'),
((SELECT id FROM provinces WHERE name = 'Granma'), 'Pilón'),
((SELECT id FROM provinces WHERE name = 'Granma'), 'Río Cauto'),
((SELECT id FROM provinces WHERE name = 'Granma'), 'Yara')
ON CONFLICT (province_id, name) DO NOTHING;

-- Holguín (14)
INSERT INTO municipalities (province_id, name) VALUES
((SELECT id FROM provinces WHERE name = 'Holguín'), 'Antilla'),
((SELECT id FROM provinces WHERE name = 'Holguín'), 'Báguanos'),
((SELECT id FROM provinces WHERE name = 'Holguín'), 'Banes'),
((SELECT id FROM provinces WHERE name = 'Holguín'), 'Cacocúm'),
((SELECT id FROM provinces WHERE name = 'Holguín'), 'Calixto García'),
((SELECT id FROM provinces WHERE name = 'Holguín'), 'Cueto'),
((SELECT id FROM provinces WHERE name = 'Holguín'), 'Frank País'),
((SELECT id FROM provinces WHERE name = 'Holguín'), 'Gibara'),
((SELECT id FROM provinces WHERE name = 'Holguín'), 'Holguín'),
((SELECT id FROM provinces WHERE name = 'Holguín'), 'Mayarí'),
((SELECT id FROM provinces WHERE name = 'Holguín'), 'Moa'),
((SELECT id FROM provinces WHERE name = 'Holguín'), 'Rafael Freyre'),
((SELECT id FROM provinces WHERE name = 'Holguín'), 'Sagua de Tánamo'),
((SELECT id FROM provinces WHERE name = 'Holguín'), 'Urbano Noris')
ON CONFLICT (province_id, name) DO NOTHING;

-- Santiago de Cuba (9)
INSERT INTO municipalities (province_id, name) VALUES
((SELECT id FROM provinces WHERE name = 'Santiago de Cuba'), 'Contramaestre'),
((SELECT id FROM provinces WHERE name = 'Santiago de Cuba'), 'Guamá'),
((SELECT id FROM provinces WHERE name = 'Santiago de Cuba'), 'Julio Antonio Mella'),
((SELECT id FROM provinces WHERE name = 'Santiago de Cuba'), 'Palma Soriano'),
((SELECT id FROM provinces WHERE name = 'Santiago de Cuba'), 'San Luis'),
((SELECT id FROM provinces WHERE name = 'Santiago de Cuba'), 'Santiago de Cuba'),
((SELECT id FROM provinces WHERE name = 'Santiago de Cuba'), 'Segundo Frente'),
((SELECT id FROM provinces WHERE name = 'Santiago de Cuba'), 'Songo-La Maya'),
((SELECT id FROM provinces WHERE name = 'Santiago de Cuba'), 'Tercer Frente')
ON CONFLICT (province_id, name) DO NOTHING;

-- Guantánamo (10)
INSERT INTO municipalities (province_id, name) VALUES
((SELECT id FROM provinces WHERE name = 'Guantánamo'), 'Baracoa'),
((SELECT id FROM provinces WHERE name = 'Guantánamo'), 'Caimanera'),
((SELECT id FROM provinces WHERE name = 'Guantánamo'), 'El Salvador'),
((SELECT id FROM provinces WHERE name = 'Guantánamo'), 'Guantánamo'),
((SELECT id FROM provinces WHERE name = 'Guantánamo'), 'Imías'),
((SELECT id FROM provinces WHERE name = 'Guantánamo'), 'Maisí'),
((SELECT id FROM provinces WHERE name = 'Guantánamo'), 'Manuel Tames'),
((SELECT id FROM provinces WHERE name = 'Guantánamo'), 'Niceto Pérez'),
((SELECT id FROM provinces WHERE name = 'Guantánamo'), 'San Antonio del Sur'),
((SELECT id FROM provinces WHERE name = 'Guantánamo'), 'Yateras')
ON CONFLICT (province_id, name) DO NOTHING;

-- Isla de la Juventud (1, municipio especial)
INSERT INTO municipalities (province_id, name) VALUES
((SELECT id FROM provinces WHERE name = 'Isla de la Juventud'), 'Isla de la Juventud')
ON CONFLICT (province_id, name) DO NOTHING;
