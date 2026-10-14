ALTER TABLE seating_blocks ADD COLUMN IF NOT EXISTS academic_year VARCHAR(9);
UPDATE seating_blocks SET academic_year = '2026-2027' WHERE academic_year IS NULL;
