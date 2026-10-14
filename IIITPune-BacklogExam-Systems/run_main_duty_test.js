require('dotenv').config({ path: './backend/.env' });
const { generate } = require('./backend/controllers/mainExamDutyController');

const req = {
  body: {
    academic_year: '2026-2027',
    start_date: '2026-05-14',
    end_date: '2026-05-25'
  }
};

const res = {
  status: (code) => {
    return {
      json: (data) => console.log('STATUS', code, data)
    };
  },
  json: (data) => console.log('SUCCESS:', JSON.stringify(data, null, 2))
};

async function test() {
  await generate(req, res);
  process.exit(0);
}
test();
