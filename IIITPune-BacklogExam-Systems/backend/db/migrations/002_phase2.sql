-- IIIT Pune Exam Scheduling & Duty System
-- Phase 2 Migration — Backlog Scheduling Support
-- Run: psql -U postgres -d iiitpune_exams -f db/migrations/002_phase2.sql

-- Add room type (LH = Lecture Hall, CR = Classroom) and bench configuration
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_type VARCHAR(5) CHECK (room_type IN ('LH', 'CR'));
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS people_per_bench INT NOT NULL DEFAULT 2;

-- Seating blocks: defines which semester range sits where in a room
-- Used in later phases for seating chart generation
CREATE TABLE IF NOT EXISTS seating_blocks (
    id SERIAL PRIMARY KEY,
    room_id INT REFERENCES rooms(id) ON DELETE CASCADE,
    semester INT,
    seat_range_start INT,
    seat_range_end INT
);

-- student_pacing already exists from schema.sql (Phase 1) — no changes needed
