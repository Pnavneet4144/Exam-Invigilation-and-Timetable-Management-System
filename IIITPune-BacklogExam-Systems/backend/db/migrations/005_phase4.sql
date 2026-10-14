ALTER TABLE regular_exam_duty ADD COLUMN exam_type VARCHAR(20) CHECK (exam_type IN ('midsem', 'endsem', 'quiz'));
ALTER TABLE regular_exam_duty ADD COLUMN subject_id INT REFERENCES subjects(id);
ALTER TABLE regular_exam_duty ADD COLUMN rejection_notes TEXT;
ALTER TABLE regular_exam_duty ADD COLUMN created_by INT REFERENCES users(id);
ALTER TABLE regular_exam_duty ADD COLUMN is_manual_override BOOLEAN DEFAULT FALSE;
