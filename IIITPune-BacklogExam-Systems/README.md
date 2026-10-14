# IIIT Pune — Exam Scheduling & Duty System

A full-stack web application for managing backlog exam scheduling and faculty invigilation duty allocation at IIIT Pune.

**Phase 1** covers: authentication, data upload (CSV/Excel), and CRUD views for students, subjects, faculty, and rooms.

---

## Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Frontend | React 18, Vite, Tailwind CSS      |
| Backend  | Node.js, Express 4                |
| Database | PostgreSQL 14+                    |
| Auth     | JWT + bcrypt                      |

---

## Prerequisites

- **Node.js** ≥ 18 — [Download](https://nodejs.org/)
- **PostgreSQL** ≥ 14 — [Download](https://www.postgresql.org/download/)
- **npm** (comes with Node.js)

---

## Getting Started

### 1. Clone the repository

```bash
git clone <repo-url>
cd IIIT-Pune-Backlog-Examinations
```

### 2. Set up PostgreSQL database

Open a terminal and create the database:

```bash
# Log into PostgreSQL
psql -U postgres

# Inside the psql shell:
CREATE DATABASE iiitpune_exams;
\q
```

### 3. Run the database schema migration

```bash
psql -U postgres -d iiitpune_exams -f backend/db/schema.sql
```

This creates all 12 tables (users, students, subjects, faculty, rooms, etc.).

### 4. Configure environment variables

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and fill in your PostgreSQL credentials:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=iiitpune_exams
DB_USER=postgres
DB_PASSWORD=your_actual_password
JWT_SECRET=pick_a_long_random_string
PORT=5000
```

### 5. Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 6. Seed the database with initial users

```bash
cd backend
npm run seed
```

This creates three users and prints their credentials to the console:

| Role       | Email                  | Password   |
|------------|------------------------|------------|
| superadmin | admin@iiitpune.ac.in   | Admin@123  |
| editor     | staff1@iiitpune.ac.in  | Staff@123  |
| editor     | staff2@iiitpune.ac.in  | Staff@456  |

> **Note:** Change these passwords after first login in production!

### 7. Start the servers

Open **two terminals**:

```bash
# Terminal 1 — Backend (runs on port 5000)
cd backend
npm run dev

# Terminal 2 — Frontend (runs on port 5173)
cd frontend
npm run dev
```

### 8. Open in browser

- **Admin Login**: [http://localhost:5173/login/admin](http://localhost:5173/login/admin)
- **Staff Login**: [http://localhost:5173/login/staff](http://localhost:5173/login/staff)

---

## Project Structure

```
IIIT-Pune-Backlog-Examinations/
├── backend/
│   ├── server.js              # Express entry point
│   ├── db/
│   │   ├── index.js           # PostgreSQL connection pool
│   │   ├── schema.sql         # Database schema (12 tables)
│   │   └── seed.js            # Seed script (3 users)
│   ├── middleware/
│   │   └── auth.js            # JWT verification + role check
│   ├── routes/
│   │   ├── auth.js            # Login endpoints
│   │   ├── students.js        # Student CRUD routes
│   │   ├── subjects.js        # Subject CRUD routes
│   │   ├── faculty.js         # Faculty CRUD routes
│   │   ├── rooms.js           # Room CRUD routes
│   │   ├── upload.js          # CSV/Excel upload routes
│   │   └── scheduling.js      # Backlog scheduling endpoints
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── studentsController.js
│   │   ├── subjectsController.js
│   │   ├── facultyController.js
│   │   ├── roomsController.js
│   │   ├── uploadController.js
│   │   └── schedulingController.js
│   └── utils/
│       ├── fileParser.js      # CSV/XLSX parsing utility
│       └── schedulingEngine.js# Pure backlog scheduling algorithm
│
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx            # Route definitions
│   │   ├── index.css          # Tailwind imports
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── components/
│   │   │   ├── Layout.jsx     # Header + Sidebar + Content
│   │   │   ├── ProtectedRoute.jsx
│   │   │   └── DataTable.jsx  # Reusable searchable table
│   │   ├── pages/
│   │   │   ├── AdminLogin.jsx
│   │   │   ├── StaffLogin.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── UploadData.jsx
│   │   │   ├── Students.jsx
│   │   │   ├── Subjects.jsx
│   │   │   ├── Faculty.jsx
│   │   │   ├── Rooms.jsx
│   │   │   └── Scheduling.jsx # Phase 2 Backlog Scheduling UI
│   │   └── utils/
│   │       └── api.js         # Axios instance with JWT
│   └── public/
│       └── assets/            # Place iiitpune-logo.png here
│
└── README.md
```

---

## Phase 2 Migration

Apply the Phase 2 database migration:

```bash
psql -U postgres -d iiitpune_exams -f backend/db/migrations/002_phase2.sql
```

This adds `room_type` and `people_per_bench` to the `rooms` table, and creates the `seating_blocks` table.

---

## Backlog Exam Scheduling (Phase 2)

The system includes a greedy front-loading scheduling algorithm (`backend/utils/schedulingEngine.js`) that:
- Suggests `papers_per_day` pacing (2 if >15 backlogs, else 1) with manual override support.
- Schedules exams as early and densely as possible while preventing student slot double-booking.
- Strictly respects room capacity per time slot.
- Automatically skips Saturdays, Sundays, and dates listed in `holidays`.
- Allows administrators and editors to manually override dates, time slots, and rooms with conflict checks.

---

## Phase Roadmap

| Phase   | Features                                            | Status     |
|---------|-----------------------------------------------------|------------|
| Phase 1 | Auth, data upload, CRUD views                       | ✅ Complete |
| Phase 2 | Backlog exam auto-scheduling, pacing, manual override| ✅ Complete |
| Phase 3 | Faculty duty allocation, priority logic, approvals  | 🔜 Next    |
| Phase 4 | Regular exam duty module, seating blocks, reports   | 📋 Planned |

---

## License

Internal project — IIIT Pune.
