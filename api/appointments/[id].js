// api/appointments/[id].js
// PUT    /api/appointments/5  -> edit an appointment (status, reschedule, etc.)
// DELETE /api/appointments/5  -> cancel an appointment
//
// We don't hard-delete appointments either — "deleting" one just sets
// status to 'cancelled', so the visit history and any linked records
// (triage, SOAP notes, billing) aren't left pointing at nothing.

const pool = require('../../lib/db');

module.exports = async (req, res) => {
  const { id } = req.query;

  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'A valid appointment id is required' });
  }

  if (req.method === 'PUT') {
    const { doctorId, appointmentType, scheduledAt, status, checkedInAt } = req.body;

    try {
      const result = await pool.query(
        `UPDATE appointments
         SET doctor_id = COALESCE($1, doctor_id),
             appointment_type = COALESCE($2, appointment_type),
             scheduled_at = COALESCE($3, scheduled_at),
             status = COALESCE($4, status),
             checked_in_at = COALESCE($5, checked_in_at)
         WHERE appointment_id = $6
         RETURNING *`,
        [doctorId, appointmentType, scheduledAt, status, checkedInAt, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      return res.status(200).json({ message: 'Appointment updated', appointment: result.rows[0] });
    } catch (err) {
      console.error('Update appointment error:', err);
      return res.status(500).json({ error: 'Something went wrong, please try again' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const result = await pool.query(
        `UPDATE appointments
         SET status = 'cancelled'
         WHERE appointment_id = $1
         RETURNING appointment_id`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      return res.status(200).json({ message: 'Appointment cancelled' });
    } catch (err) {
      console.error('Cancel appointment error:', err);
      return res.status(500).json({ error: 'Something went wrong, please try again' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
