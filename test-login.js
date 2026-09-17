// test-login.js
// Run this with: node test-login.js
// (while vercel dev is still running in your other terminal)
// This sends a test login request and prints the result,
// so you don't have to fight PowerShell's curl quoting.

async function testLogin() {
  const response = await fetch('http://localhost:3000/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: 'Admin123!', // change this if you used a different password
    }),
  });

  const data = await response.json();

  console.log('Status:', response.status);
  console.log('Response:', data);
}

testLogin();
