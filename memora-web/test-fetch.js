const fetch = require('node-fetch');
async function run() {
  const res = await fetch('https://memora-production-7134.up.railway.app/api/auth/oauth/google', {
    method: 'POST',
    body: JSON.stringify({ email: 'test@example.com', firstName: 'test' }),
    headers: { 'Content-Type': 'application/json', 'x-backend-secret': 'super-secret-jwt-key' }
  });
  console.log(res.status, await res.text());
}
run();
