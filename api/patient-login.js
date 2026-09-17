// api/patient-login.js
// Patient login endpoint. Lives at POST /api/patient-login once deployed.
// Checks patient_accounts (login credentials), joined with patients (name/contact info),
// NOT the staff `users` table — those are two separate audiences.

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const result = await pool.query(
      `SELECT pa.patient_account_id, pa.patient_id, pa.username, pa.password_hash, pa.status,
              p.first_name, p.last_name
       FROM patient_accounts pa
       JOIN patients p ON pa.patient_id = p.patient_id
       WHERE pa.username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const account = result.rows[0];

    if (account.status !== 'active') {
      return res.status(403).json({ error: 'This account is not active' });
    }

    const passwordMatches = await bcrypt.compare(password, account.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    await pool.query(
      'UPDATE patient_accounts SET last_login_at = NOW() WHERE patient_account_id = $1',
      [account.patient_account_id]
    );

    // Note the role here: "Patient" — this lets the frontend tell staff and
    // patient tokens apart, and lets API routes reject patient tokens on staff-only endpoints
    const token = jwt.sign(
      { patientId: account.patient_id, role: 'Patient' },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      token,
      patient: {
        id: account.patient_id,
        username: account.username,
        fullName: `${account.first_name} ${account.last_name}`,
      },
    });
  } catch (err) {
    console.error('Patient login error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  }
};
