// api/patient-signup.js
// Patient self-registration. Lives at POST /api/patient-signup once deployed.
// Creates a row in `patients` (the clinical record) AND `patient_accounts`
// (login credentials) together, since a self-signup needs both to exist.

const bcrypt = require('bcryptjs');
const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    firstName,
    lastName,
    dateOfBirth,
    sex,
    contactNumber,
    email,
    address,
    username,
    password,
  } = req.body;

  // Required fields — everything else in `patients` is nullable per the schema
  if (!firstName || !lastName || !dateOfBirth || !username || !password) {
    return res.status(400).json({
      error: 'First name, last name, date of birth, username, and password are required',
    });
  }

  // A patient and their login share one database transaction: if creating
  // the account fails after the patient record succeeds, we don't want an
  // orphaned patient with no way to log in. Postgres transactions handle this.
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check username availability first, so we fail fast with a clear error
    const existing = await client.query(
      'SELECT patient_account_id FROM patient_accounts WHERE username = $1',
      [username]
    );

    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'That username is already taken' });
    }

    const patientResult = await client.query(
      `INSERT INTO patients (first_name, last_name, date_of_birth, sex, contact_number, email, address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING patient_id`,
      [firstName, lastName, dateOfBirth, sex || null, contactNumber || null, email || null, address || null]
    );

    const patientId = patientResult.rows[0].patient_id;

    const passwordHash = await bcrypt.hash(password, 10);

    await client.query(
      `INSERT INTO patient_accounts (patient_id, username, password_hash, email)
       VALUES ($1, $2, $3, $4)`,
      [patientId, username, passwordHash, email || null]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Account created successfully',
      patientId,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Patient signup error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  } finally {
    client.release();
  }
};
