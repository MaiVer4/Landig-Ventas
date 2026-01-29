-- SQL para agregar la columna gallery a la tabla Products en Supabase
-- Ejecuta este código en el SQL Editor de Supabase

-- 1. Agregar la columna gallery como JSONB (permite almacenar arrays de URLs)
ALTER TABLE "Products" 
ADD COLUMN IF NOT EXISTS gallery JSONB DEFAULT '[]'::JSONB;

-- 2. Migrar datos existentes: convertir la columna 'image' en el primer elemento del gallery
UPDATE "Products" 
SET gallery = jsonb_build_array(image)
WHERE gallery = '[]'::JSONB OR gallery IS NULL;

-- 3. Verificar los datos
SELECT id, name, image, gallery FROM "Products" LIMIT 5;
