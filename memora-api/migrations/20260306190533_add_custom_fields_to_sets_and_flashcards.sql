-- Add fields_schema to sets and fields_data to flashcards
ALTER TABLE sets ADD COLUMN IF NOT EXISTS fields_schema JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS fields_data JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Migrate existing data
-- Step 1: Set the default schema for all existing sets
UPDATE sets 
SET fields_schema = '[
    {"id": "term", "name": "TERM", "type": "text", "side": "front", "order": 1, "settings": {"language": "default"}},
    {"id": "definition", "name": "DEFINITION", "type": "text", "side": "back", "order": 1, "settings": {"language": "default"}}
]'::jsonb
WHERE jsonb_array_length(fields_schema) = 0;

-- Step 2: Migrate existing flashcard data to the new JSONB structure
-- We wrap the existing term and definition into fields_data using IDs that match the schema above.
UPDATE flashcards
SET fields_data = jsonb_build_object(
    'term', term,
    'definition', definition
)
WHERE fields_data = '{}'::jsonb;

-- Also migrate the image_url to fields_data if it exists
UPDATE flashcards
SET fields_data = jsonb_set(fields_data, '{image}', to_jsonb(image_url))
WHERE image_url IS NOT NULL;

-- Step 3: Update the sets schema to include the image if any card in the set has an image
UPDATE sets
SET fields_schema = jsonb_insert(
    fields_schema,
    '{2}',
    '{"id": "image", "name": "IMAGE", "type": "image", "side": "back", "order": 2, "settings": {}}'::jsonb
)
WHERE id IN (
    SELECT DISTINCT set_id FROM flashcards WHERE image_url IS NOT NULL
) AND NOT (fields_schema @> '[{"id": "image"}]');

-- Note: We are keeping the old columns (term, definition, image_url) for now for backward compatibility during rollout. We can drop them in a future migration.
