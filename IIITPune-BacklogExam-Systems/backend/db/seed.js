const bcrypt = require('bcryptjs');
const db = require('./index');

async function seed() {
  try {
    const users = [
      { name: 'Dr. Chandrakant Narayan Guled', email: 'admin@iiitpune.ac.in', password: 'Admin@123', role: 'superadmin' },
      { name: 'Staff Member 1', email: 'staff1@iiitpune.ac.in', password: 'Staff@123', role: 'editor' },
      { name: 'Staff Member 2', email: 'staff2@iiitpune.ac.in', password: 'Staff@456', role: 'editor' },
    ];

    for (let u of users) {
      // Hash password
      // salt rounds = 10, provides good security balance
      const hash = await bcrypt.hash(u.password, 10);
      
      // INSERT ... ON CONFLICT DO NOTHING
      // This allows the seed script to be run multiple times safely
      await db.query(
        `INSERT INTO users (name, email, password_hash, role) 
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING`,
        [u.name, u.email, hash, u.role]
      );
    }

    console.log(`
===== SEED USERS CREATED =====
Role        | Email                    | Password
------------|--------------------------|----------
superadmin  | admin@iiitpune.ac.in     | Admin@123
editor      | staff1@iiitpune.ac.in    | Staff@123
editor      | staff2@iiitpune.ac.in    | Staff@456
===============================
`);

    process.exit(0);
  } catch (err) {
    console.error('Error seeding data:', err);
    process.exit(1);
  }
}

seed();
