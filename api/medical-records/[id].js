// api/patients/[id].js
// Vercel's [id] filename makes this a dynamic route:
// GET    /api/patients/5  -> view one patient
// PUT    /api/patients/5  -> edit one patient
// DELETE /api/patients/5  -> soft-delete (deactivate) one patient
//
// We NEVER hard-delete a patient row — the plan requires soft deletes on
// clinical data so the record (and its history) is preserved, just hidden
// from normal views. That's what is_active is for.

const pool = require('../../lib/db');

module.exports = async (req, res) => {
  const { id } = req.query;

  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'A valid patient id is required' });
  }

  if (req.method === 'GET') {
    try {
      const result = await pool.query(
        'SELECT * FROM patients WHERE patient_id = $1 AND is_active = TRUE',
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      return res.status(200).json({ patient: result.rows[0] });
    } catch (err) {
      console.error('Fetch patient error:', err);
      return res.status(500).json({ error: 'Something went wrong, please try again' });
    }
  }

  if (req.method === 'PUT') {
    const { firstName, lastName, dateOfBirth, sex, contactNumber, email, address } = req.body;

    try {
      const result = await pool.query(
        `UPDATE patients
         SET first_name = COALESCE($1, first_name),
             last_name = COALESCE($2, last_name),
             date_of_birth = COALESCE($3, date_of_birth),
             sex = COALESCE($4, sex),
             contact_number = COALESCE($5, contact_number),
             email = COALESCE($6, email),
             address = COALESCE($7, address)
         WHERE patient_id = $8 AND is_active = TRUE
         RETURNING *`,
        [firstName, lastName, dateOfBirth, sex, contactNumber, email, address, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      return res.status(200).json({ message: 'Patient updated', patient: result.rows[0] });
    } catch (err) {
      console.error('Update patient error:', err);
      return res.status(500).json({ error: 'Something went wrong, please try again' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const result = await pool.query(
        `UPDATE patients
         SET is_active = FALSE, deleted_at = NOW()
         WHERE patient_id = $1
         RETURNING patient_id`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      return res.status(200).json({ message: 'Patient deactivated' });
    } catch (err) {
      console.error('Delete patient error:', err);
      return res.status(500).json({ error: 'Something went wrong, please try again' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
