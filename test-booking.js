// test-booking.js
// Run this with: node test-booking.js
// (while vercel dev is still running in your other terminal)

async function testBooking() {
  const response = await fetch('http://localhost:3000/api/book-appointment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientId: 1,       // Maria Santos, from the signup test
      doctorId: 2,        // Dr. Ana Cruz, the test doctor account
      appointmentType: 'scheduled',
      scheduledAt: '2026-08-25T10:00:00', // any future date/time works
    }),
  });

  const data = await response.json();

  console.log('Status:', response.status);
  console.log('Response:', data);
}

testBooking();
