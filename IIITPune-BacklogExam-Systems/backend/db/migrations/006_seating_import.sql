-- IIIT Pune Exam Scheduling & Duty System
-- Phase 5 Migration — Advanced Import Support (Seating Blocks)
-- Adds branch and VARCHAR roll number columns to seating_blocks
-- Run: psql -U iiituser -d iiitpune_exams -f db/migrations/006_seating_import.sql

ALTER TABLE seating_blocks ADD COLUMN IF NOT EXISTS branch VARCHAR(20);
ALTER TABLE seating_blocks ADD COLUMN IF NOT EXISTS roll_no_start VARCHAR(30);
ALTER TABLE seating_blocks ADD COLUMN IF NOT EXISTS roll_no_end VARCHAR(30);
