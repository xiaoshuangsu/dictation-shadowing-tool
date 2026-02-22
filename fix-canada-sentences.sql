-- Fix sentence time boundaries for "Canada Provinces and Territories" material
-- Issue: "world" is being split to the next sentence

-- First, let's find the material ID
SELECT id, title FROM materials WHERE title LIKE '%Canada Provinces%';
