-- Migration: Add is_premium field to materials table
-- Date: 2025-03-24
-- Description: Add is_premium boolean field to distinguish free and premium materials
-- Rule: First 200 materials are free, starting from 201st are premium

-- Step 1: Add is_premium column (default true for new materials)
ALTER TABLE materials 
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT true;

-- Step 2: Set the oldest 200 materials to free (is_premium = false)
-- Order by created_at ASC to get the oldest materials first
UPDATE materials 
SET is_premium = false 
WHERE id IN (
  SELECT id 
  FROM materials 
  ORDER BY created_at ASC 
  LIMIT 200
);

-- Step 3: Verify the changes
SELECT 
  COUNT(*) FILTER (WHERE is_premium = false) as free_materials_count,
  COUNT(*) FILTER (WHERE is_premium = true) as premium_materials_count,
  COUNT(*) as total_materials
FROM materials;
