// api/update-appointment-status.js
// POST /api/update-appointment-status — updates an appointment's
// status. Used by the doctor's Consultation Workspace to mark a
// visit 'completed' once the SOAP note is saved. Generic/reusable —
// not tied to one specific status transition.

const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { appointmentId, status } = req.body;

  if (!appointmentId || !status) {
    return res.status(400).json({ error: 'appointmentId and status are required' });
  }

  try {
    const result = await pool.query(
      `UPDATE appointments SET status = $1 WHERE appointment_id = $2 RETURNING appointment_id`,
      [status, appointmentId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    return res.status(200).json({ message: 'Appointment status updated' });
  } catch (err) {
    console.error('Update appointment status error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  }
};
