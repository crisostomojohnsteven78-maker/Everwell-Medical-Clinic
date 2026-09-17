// api/login.js
// Staff login endpoint. Lives at POST /api/login once deployed.
// Checks the `users` table (Admin/Doctor/Nurse/Pharmacist/Front Desk/Billing Staff),
// NOT patient_accounts — patients log in through a separate endpoint.

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
    // Join roles so the frontend knows which dashboard to send the user to
    const result = await pool.query(
      `SELECT u.user_id, u.username, u.password_hash, u.full_name, u.status, r.role_name
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE u.username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      // Same error for "no user" and "wrong password" on purpose —
      // don't reveal which part was wrong to someone probing for valid usernames
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'This account is not active' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Update last_login_at
    await pool.query(
      'UPDATE users SET last_login_at = NOW() WHERE user_id = $1',
      [user.user_id]
    );

    // Issue a token the frontend stores and sends on future requests
    const token = jwt.sign(
      { userId: user.user_id, role: user.role_name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' } // matches a typical clinic shift
    );

    return res.status(200).json({
      token,
      user: {
        id: user.user_id,
        username: user.username,
        fullName: user.full_name,
        role: user.role_name,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  }
};
