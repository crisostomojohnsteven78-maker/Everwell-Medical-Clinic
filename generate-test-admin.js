// generate-test-admin.js
// Run this once with: node generate-test-admin.js
// It prints a ready-to-paste SQL INSERT statement with a properly hashed password.
// Delete this file (or at least don't commit it) once you've used it —
// it's just a one-time helper, not part of the actual app.

const bcrypt = require('bcryptjs');

const username = 'admin';
const plainPassword = 'Admin123!'; // change this to whatever you want to log in with
const fullName = 'John Steven Crisostomo'; // change to your name, or a placeholder like "System Admin"
const email = 'admin@everwell.test';

async function run() {
  const hash = await bcrypt.hash(plainPassword, 10);

  console.log('\n--- Copy everything below into the Neon SQL Editor ---\n');
  console.log(`INSERT INTO users (role_id, username, password_hash, full_name, email, status)
VALUES (
  (SELECT role_id FROM roles WHERE role_name = 'Admin'),
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
