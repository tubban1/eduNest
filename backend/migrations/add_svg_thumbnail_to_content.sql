-- Migration: Add svg_thumbnail field to content table
-- Date: 2024
-- Description: Add svg_thumbnail field to store SVG thumbnail code directly from AI generation

-- Add svg_thumbnail column to content table
ALTER TABLE content
ADD COLUMN IF NOT EXISTS svg_thumbnail text;

-- Add comment
COMMENT ON COLUMN content.svg_thumbnail IS 'SVG thumbnail code directly from AI generation. Used as primary thumbnail source, with thumbnail_url as fallback.';

-- Note: We use the existing thumbnail_status and thumbnail_updated_at fields
-- No need for separate status/updated_at for svg_thumbnail since it's part of the same thumbnail system

