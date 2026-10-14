CREATE TABLE IF NOT EXISTS exam_periods (
    id SERIAL PRIMARY KEY,
    academic_year VARCHAR(9) UNIQUE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    source VARCHAR(20) DEFAULT 'seating_plan_header'
);
