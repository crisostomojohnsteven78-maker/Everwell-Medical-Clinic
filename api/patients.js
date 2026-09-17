// api/patients.js
// GET  /api/patients  -> list all active patients
// POST /api/patients  -> front-desk registration: creates a patient record
//                        WITHOUT a login account (that's what patient-signup.js
//                        is for). Matches the plan's registered_by/registered_at
//                        front-desk-driven registration flow.

const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      const result = await pool.query(
        `SELECT patient_id, first_name, last_name, date_of_birth, sex,
                contact_number, email, address, registered_at
         FROM patients
         WHERE is_active = TRUE
         ORDER BY registered_at DESC`
      );
      return res.status(200).json({ count: result.rows.length, patients: result.rows });
    } catch (err) {
      console.error('Fetch patients error:', err);
      return res.status(500).json({ error: 'Something went wrong, please try again' });
    }
  }

  if (req.method === 'POST') {
    const { firstName, lastName, dateOfBirth, sex, contactNumber, email, address, registeredBy } = req.body;

    if (!firstName || !lastName || !dateOfBirth) {
      return res.status(400).json({ error: 'firstName, lastName, and dateOfBirth are required' });
    }

    try {
      const result = await pool.query(
        `INSERT INTO patients (first_name, last_name, date_of_birth, sex, contact_number, email, address, registered_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [firstName, lastName, dateOfBirth, sex || null, contactNumber || null, email || null, address || null, registeredBy || null]
      );
      return res.status(201).json({ message: 'Patient registered', patient: result.rows[0] });
    } catch (err) {
      console.error('Register patient error:', err);
      return res.status(500).json({ error: 'Something went wrong, please try again' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};