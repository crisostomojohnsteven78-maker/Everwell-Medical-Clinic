// api/appointment-vitals.js
// GET /api/appointment-vitals?appointmentId=27 — the triage_vitals row
// recorded for this specific appointment (if a nurse has recorded
// one yet). Used by the doctor's Consultation Workspace to show what
// the nurse already recorded before the doctor documents the visit.

const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { appointmentId } = req.query;
  if (!appointmentId) {
    return res.status(400).json({ error: 'appointmentId is required' });
  }

  try {
    const result = await pool.query(
      `SELECT blood_pressure, temperature_celsius, pulse_rate_bpm, respiratory_rate, weight_kg, chief_complaint, urgency_level, recorded_at
       FROM triage_vitals
       WHERE appointment_id = $1
       ORDER BY recorded_at DESC
       LIMIT 1`,
      [appointmentId]
    );
    return res.status(200).json({ vitals: result.rows[0] || null });
  } catch (err) {
    console.error('Fetch appointment vitals error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  }
};
