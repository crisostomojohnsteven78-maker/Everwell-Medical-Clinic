// api/pharmacy-queue.js
// GET /api/pharmacy-queue — every prescription item across ALL
// patients (not scoped to one patient, this is the pharmacist's
// working queue), joined with the prescription, patient, and
// medication. Includes refill requests, since those are just regular
// prescription rows with validation_status = 'pending'.

const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await pool.query(
      `SELECT
         pi.prescription_item_id, pi.prescription_id, pi.dosage, pi.frequency,
         pi.duration_days, pi.quantity_prescribed, pi.instructions, pi.dispensing_status,
         pr.patient_id, pr.doctor_id, pr.prescribed_at, pr.validation_status, pr.rejection_reason,
         p.first_name, p.last_name,
         m.medication_id, m.generic_name, m.brand_name
       FROM prescription_items pi
       JOIN prescriptions pr ON pi.prescription_id = pr.prescription_id
       JOIN patients p ON pr.patient_id = p.patient_id
       JOIN medications m ON pi.medication_id = m.medication_id
       ORDER BY pr.prescribed_at DESC`
    );
    return res.status(200).json({ count: result.rows.length, queue: result.rows });
  } catch (err) {
    console.error('Fetch pharmacy queue error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  }
};