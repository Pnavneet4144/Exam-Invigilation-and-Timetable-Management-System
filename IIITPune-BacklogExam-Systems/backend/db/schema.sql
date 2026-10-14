-- IIIT Pune Exam Scheduling & Duty System
-- Database Schema — Phase 1
-- Run: psql -U postgres -d iiitpune_exams -f db/schema.sql

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('superadmin', 'editor')),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    roll_no VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    department VARCHAR(50),
    semester INT,
    email VARCHAR(150)
);

CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    subject_code VARCHAR(20) UNIQUE NOT NULL,
    subject_name VARCHAR(150) NOT NULL,
    semester INT NOT NULL,
    department VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS backlog_papers (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    subject_id INT REFERENCES subjects(id),
    academic_year VARCHAR(9) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS faculty (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    department VARCHAR(50),
    designation VARCHAR(30) CHECK (designation IN ('HOD', 'Assistant Professor', 'Associate Professor', 'Professor')),
    email VARCHAR(150),
    max_duty_load INT DEFAULT 5,
    is_available BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    room_no VARCHAR(20) UNIQUE NOT NULL,
    building VARCHAR(50),
    capacity INT NOT NULL
);

CREATE TABLE IF NOT EXISTS holidays (
    id SERIAL PRIMARY KEY,
    holiday_date DATE UNIQUE NOT NULL,
    description VARCHAR(150)
);

CREATE TABLE IF NOT EXISTS exam_schedule (
    id SERIAL PRIMARY KEY,
    backlog_paper_id INT REFERENCES backlog_papers(id) ON DELETE CASCADE,
    room_id INT REFERENCES rooms(id),
    exam_date DATE NOT NULL,
    time_slot VARCHAR(20) NOT NULL,
    academic_year VARCHAR(9) NOT NULL,
    is_manual_override BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved')),
    created_by INT REFERENCES users(id),
    approved_by INT REFERENCES users(id),
    UNIQUE (backlog_paper_id)
);

CREATE TABLE IF NOT EXISTS student_pacing (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    academic_year VARCHAR(9) NOT NULL,
    papers_per_day INT DEFAULT 1,
    is_manual_override BOOLEAN DEFAULT FALSE,
    UNIQUE (student_id, academic_year)
);

CREATE TABLE IF NOT EXISTS duties (
    id SERIAL PRIMARY KEY,
    faculty_id INT REFERENCES faculty(id),
    exam_schedule_id INT REFERENCES exam_schedule(id) ON DELETE CASCADE,
    is_manual_override BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS sections (
    id SERIAL PRIMARY KEY,
    class_name VARCHAR(50) NOT NULL,
    section_name VARCHAR(10) NOT NULL
);

CREATE TABLE IF NOT EXISTS regular_exam_duty (
    id SERIAL PRIMARY KEY,
    section_id INT REFERENCES sections(id),
    faculty_id_1 INT REFERENCES faculty(id),
    faculty_id_2 INT REFERENCES faculty(id),
    room_id INT REFERENCES rooms(id),
    exam_date DATE NOT NULL,
    time_slot VARCHAR(20) NOT NULL,
    academic_year VARCHAR(9) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved')),
    approved_by INT REFERENCES users(id)
);
