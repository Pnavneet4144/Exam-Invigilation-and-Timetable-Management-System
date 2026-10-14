-- Phase 3 Migration: Approval workflow columns
-- Run after 002_phase2.sql

-- Add rejection_notes to exam_schedule for the approval workflow
-- When a superadmin rejects a submission, the reason is stored here
ALTER TABLE exam_schedule ADD COLUMN IF NOT EXISTS rejection_notes TEXT;

-- Add status workflow columns to duties table
-- Duties now go through the same draft → pending_approval → approved workflow
ALTER TABLE duties ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft';

-- Add CHECK constraint for duties.status (only if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'duties_status_check'
  ) THEN
    ALTER TABLE duties ADD CONSTRAINT duties_status_check 
      CHECK (status IN ('draft', 'pending_approval', 'approved'));
  END IF;
END $$;

-- Track who created and approved each duty assignment
ALTER TABLE duties ADD COLUMN IF NOT EXISTS created_by INT REFERENCES users(id);
ALTER TABLE duties ADD COLUMN IF NOT EXISTS approved_by INT REFERENCES users(id);
ALTER TABLE duties ADD COLUMN IF NOT EXISTS rejection_notes TEXT;
