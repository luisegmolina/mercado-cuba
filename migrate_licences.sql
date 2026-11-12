-- Migración: auditoría de canje de licencias.
-- Añade la fecha de canje a los códigos de activación.
-- SOLO el archivo: NO aplicar directamente a producción sin revisar.
ALTER TABLE activation_codes ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;
