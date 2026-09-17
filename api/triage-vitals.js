// api/triage-vitals.js
// POST /api/triage-vitals — records real vital signs for a visit.
// One record per appointment (matches the UNIQUE constraint on
// appointment_id in the schema). After recording, the appointment's
// status moves to 'in-progress', since triage being done is what
// signals the doctor can see the patient next.

const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    appointmentId, recordedBy, bloodPressure, temperatureCelsius,
    pulseRateBpm, respiratoryRate, weightKg, heightCm,
    chiefComplaint, urgencyLevel,
  } = req.body;

  if (!appointmentId || !recordedBy || !urgencyLevel) {
    return res.status(400).json({ error: 'appointmentId, recordedBy, and urgencyLevel are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO triage_vitals
         (appointment_id, recorded_by, blood_pressure, temperature_celsius,
          pulse_rate_bpm, respiratory_rate, weight_kg, height_cm,
          chief_complaint, urgency_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [appointmentId, recordedBy, bloodPressure || null, temperatureCelsius || null,
       pulseRateBpm || null, respiratoryRate || null, weightKg || null, heightCm || null,
       chiefComplaint || null, urgencyLevel]
    );

    await client.query(
      `UPDATE appointments SET status = 'in-progress' WHERE appointment_id = $1`,
      [appointmentId]
    );

    await client.query('COMMIT');
    return res.status(201).json({ message: 'Vitals recorded', vitals: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Vitals were already recorded for this appointment' });
    }
    console.error('Record vitals error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  } finally {
    client.release();
  }
};
