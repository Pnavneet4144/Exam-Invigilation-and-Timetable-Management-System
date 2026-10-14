require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import routes
const authRoutes = require('./routes/auth');
const studentsRoutes = require('./routes/students');
const subjectsRoutes = require('./routes/subjects');
const facultyRoutes = require('./routes/faculty');
const roomsRoutes = require('./routes/rooms');
const uploadRoutes = require('./routes/upload');
const schedulingRoutes = require('./routes/scheduling');
const dutiesRoutes = require('./routes/duties');
const approvalsRoutes = require('./routes/approvals');
const sectionsRoutes = require('./routes/sections');
const regularDutyRoutes = require('./routes/regularDuty');
const mainExamDutyRoutes = require('./routes/mainExamDuty');
const importRoutes = require('./routes/import');

const app = express();

// Set up CORS
app.use(cors({ origin: 'http://localhost:5173' }));

// Use JSON body parser
app.use(express.json());

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/upload', uploadRoutes);
const resetRoutes = require('./routes/reset');
app.use('/api/reset', resetRoutes);
app.use('/api/scheduling', schedulingRoutes);
app.use('/api/duties', dutiesRoutes);
app.use('/api/approvals', approvalsRoutes);
app.use('/api/sections', sectionsRoutes);
app.use('/api/regular-duty', regularDutyRoutes);
app.use('/api/main-exam-duty', mainExamDutyRoutes);
app.use('/api/import', importRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Something went wrong!' });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
