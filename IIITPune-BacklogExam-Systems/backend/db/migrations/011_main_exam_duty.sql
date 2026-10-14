DROP TABLE IF EXISTS main_exam_duty CASCADE;
CREATE TABLE main_exam_duty (
    id SERIAL PRIMARY KEY,
    room_id INT REFERENCES rooms(id),
    exam_date DATE NOT NULL,
    faculty_id INT REFERENCES faculty(id),
    academic_year VARCHAR(9) NOT NULL,
    is_manual_override BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved')),
    approved_by INT REFERENCES users(id),
    UNIQUE (room_id, exam_date)
);
