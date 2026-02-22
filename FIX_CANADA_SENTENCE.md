# Fix Canada Provinces Sentence Split Issue

## Problem
The sentence "Canada is one of the largest countries in the world" is being incorrectly split, with "world" appearing in the next sentence.

## Root Cause
The `end_time` of the sentence is set too early, cutting off the word "world".

## Solution

### Option 1: Fix via Supabase Dashboard (Recommended)

1. Go to Supabase Dashboard → Table Editor
2. Find the `materials` table and locate "Canada Provinces and Territories"
3. Click the `transcript` field to edit
4. Find the sentence with text: "Canada is one of the largest countries in the world"
5. Adjust its `end_time` to ensure it includes the complete sentence

### Option 2: Update via SQL Script

```sql
-- Step 1: Find the material ID
SELECT id, title FROM materials
WHERE title LIKE '%Canada Provinces%';

-- Step 2: View current sentences for this material
SELECT id, text, start_time, end_time
FROM sentences
WHERE material_id = <MATERIAL_ID_FROM_STEP_1>
ORDER BY id;

-- Step 3: Update the problematic sentence
-- Adjust the end_time to include "world" (add ~0.5-1.0 seconds)
UPDATE sentences
SET end_time = <CORRECT_END_TIME>
WHERE id = <PROBLEMATIC_SENTENCE_ID>;

-- Step 4: Update subsequent sentences' start_time if needed
UPDATE sentences
SET start_time = <CORRECT_END_TIME>
WHERE id = <NEXT_SENTENCE_ID>
AND start_time < <CORRECT_END_END_TIME>;
```

## How to Determine Correct End Time

1. Play the audio and listen to the sentence
2. Note when the speaker finishes saying "world"
3. Set the `end_time` to that timestamp

Example:
- If "world" ends at 15.3 seconds, set `end_time = 15.3`
- Ensure the next sentence starts AFTER this time (e.g., 15.5 or later)

## Verify the Fix

After updating, refresh the page and verify:
1. The complete sentence "Canada is one of the largest countries in the world" appears in ONE sentence card
2. The word "world" is NOT in the next sentence
3. Audio playback aligns with the text
