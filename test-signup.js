// test-signup.js
// Run this with: node test-signup.js
// (while vercel dev is still running in your other terminal)

async function testSignup() {
  const response = await fetch('http://localhost:3000/api/patient-signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Maria',
      lastName: 'Santos',
      dateOfBirth: '1998-05-14',
      sex: 'Female',
      contactNumber: '09171234567',
      email: 'maria.santos@example.com',
      address: 'Quezon City, Metro Manila',
      username: 'mariasantos',
      password: 'Patient123!',
    }),
  });

  const data = await response.json();

  console.log('Status:', response.status);
  console.log('Response:', data);
}

testSignup();
