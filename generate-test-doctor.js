// generate-test-doctor.js
// Run this once with: node generate-test-doctor.js
// Prints a ready-to-paste SQL INSERT statement for a test Doctor account.

const bcrypt = require('bcryptjs');

const username = 'drcruz';
const plainPassword = 'Doctor123!'; // change this if you want a different password
const fullName = 'Dr. Ana Cruz'; // change to whatever name you'd like
const email = 'dr.cruz@everwell.test';

async function run() {
  const hash = await bcrypt.hash(plainPassword, 10);

  console.log('\n--- Copy everything below into the Neon SQL Editor ---\n');
  console.log(`INSERT INTO users (role_id, username, password_hash, full_name, email, status)
VALUES (
  (SELECT role_id FROM roles WHERE role_name = 'Doctor'),
  '${username}',
  '${hash}',
  '${fullName}',
  '${email}',
  'active'
);`);
  console.log('\n--- End of SQL ---\n');
  console.log(`Login with username: ${username} and password: ${plainPassword}`);
}

run();
