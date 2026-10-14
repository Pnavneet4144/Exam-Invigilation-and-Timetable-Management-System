CREATE TABLE exam_time_slots (
    id SERIAL PRIMARY KEY,
    academic_year VARCHAR(9) NOT NULL,
    exam_type VARCHAR(20) NOT NULL CHECK (exam_type IN ('backlog', 'midsem', 'endsem', 'quiz')),
    slot_label VARCHAR(30) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL
);
