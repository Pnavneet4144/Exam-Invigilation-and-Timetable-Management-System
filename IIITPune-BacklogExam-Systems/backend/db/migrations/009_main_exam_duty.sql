-- IIIT Pune Exam Scheduling & Duty System
-- Phase 8 Migration — Main Exam Duty
-- Run: psql -U iiituser -d iiitpune_exams -f db/migrations/009_main_exam_duty.sql

CREATE TABLE IF NOT EXISTS main_exam_duty (
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
