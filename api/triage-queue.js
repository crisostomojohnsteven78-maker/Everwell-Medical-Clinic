// api/triage-queue.js
// GET /api/triage-queue — heavy/urgent service bookings that still need
// nurse triage, ordered by their nearest booking date. Future bookings are
// included so the nurse can see how far away each appointment is; completed,
// cancelled, no-show, and already handed-off appointments are excluded.

const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await pool.query(
      `SELECT
         a.appointment_id, a.patient_id, a.scheduled_at, a.status,
         p.first_name, p.last_name,
         svc.service_name,
         svc.service_category_name,
         (SELECT string_agg(DISTINCT COALESCE(m.generic_name, pa.allergen_description), ', ')
          FROM patient_allergies pa
          LEFT JOIN medications m ON pa.allergen_medication_id = m.medication_id
          WHERE pa.patient_id = a.patient_id) AS allergies
       FROM appointments a
       JOIN patients p ON a.patient_id = p.patient_id
       LEFT JOIN LATERAL (
         SELECT s.service_name, sc.category_name AS service_category_name
         FROM appointment_services aps
         JOIN services s ON aps.service_id = s.service_id
         JOIN service_categories sc ON s.category_id = sc.category_id
         WHERE aps.appointment_id = a.appointment_id
         ORDER BY s.service_name ASC
         LIMIT 1
       ) svc ON true
       WHERE a.status NOT IN ('cancelled', 'completed', 'in-progress', 'no-show')
         AND lower(concat_ws(' ', svc.service_name, svc.service_category_name)) ~
           '(emergency|urgent|critical|stat|heart monitoring|cardiac|cardio|cardiology|ob[ /-]?gyn|obstetric|gynaec|gynec|surg|dialysis|chemotherapy|infusion|imaging|diagnostic|mri|ct scan|computed tomography|ultrasound|x[ /-]?ray|mammogram|endoscopy|colonoscopy|specialist|procedure)'
       ORDER BY a.scheduled_at ASC`
    );
    return res.status(200).json({ count: result.rows.length, queue: result.rows });
  } catch (err) {
    console.error('Fetch triage queue error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  }
};
