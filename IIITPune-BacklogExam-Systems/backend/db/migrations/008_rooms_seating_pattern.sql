-- IIIT Pune Exam Scheduling & Duty System
-- Phase 7 Migration — Rooms seating_pattern
-- Adds seating_pattern to rooms to preserve data like "3X3" from seating plans
-- Run: psql -U iiituser -d iiitpune_exams -f db/migrations/008_rooms_seating_pattern.sql

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS seating_pattern VARCHAR(10);
