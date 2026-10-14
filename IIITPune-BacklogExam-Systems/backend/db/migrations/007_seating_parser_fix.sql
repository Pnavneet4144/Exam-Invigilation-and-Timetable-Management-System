-- IIIT Pune Exam Scheduling & Duty System
-- Phase 6 Migration — Seating blocks student count
-- Adds student_count to seating_blocks to support blocks where only a count is known (no roll range)
-- Run: psql -U iiituser -d iiitpune_exams -f db/migrations/007_seating_parser_fix.sql

ALTER TABLE seating_blocks ADD COLUMN IF NOT EXISTS student_count INT;
