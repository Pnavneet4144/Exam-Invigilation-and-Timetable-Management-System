const axios = require('axios');
const http = require('http');

async function test() {
  try {
    const res = await axios.post('http://localhost:5000/api/main-exam-duty/generate', {
      academic_year: '2026-2027',
      start_date: '2026-05-14',
      end_date: '2026-05-25'
    }, {
      // we would need auth, or just bypass it for testing if possible.
      // Actually we can just run the function directly.
    });
    console.log(res.data);
  } catch (err) {
    console.error(err.response?.data || err.message);
  }
}
test();
