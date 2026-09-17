// api/refill.js
// POST /api/refill — requests a refill of an existing prescription
// item. Pulls the medication/dosage/frequency/etc from the ORIGINAL
// item server-side (never trusts client-submitted drug details), and
// creates a new prescriptions + prescription_items row with
// validation_status/dispensing_status both 'pending' — a refill isn't
// auto-approved, it needs a doctor or pharmacist to actually validate
// it, same as any other prescription.

const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prescriptionItemId, patientId } = req.body;
  if (!prescriptionItemId || !patientId) {
    return res.status(400).json({ error: 'prescriptionItemId and patientId are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const original = await client.query(
      `SELECT pi.medication_id, pi.dosage, pi.frequency, pi.duration_days, pi.quantity_prescribed, pi.instructions,
              pr.doctor_id, pr.patient_id
       FROM prescription_items pi
       JOIN prescriptions pr ON pi.prescription_id = pr.prescription_id
       WHERE pi.prescription_item_id = $1 AND pr.patient_id = $2`,
      [prescriptionItemId, patientId]
    );

    if (original.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Original prescription item not found' });
    }

    const o = original.rows[0];

    const newPrescription = await client.query(
      `INSERT INTO prescriptions (record_id, patient_id, doctor_id, prescribed_at, validation_status)
       VALUES (NULL, $1, $2, NOW(), 'pending')
       RETURNING prescription_id`,
      [patientId, o.doctor_id]
    );
    const newPrescriptionId = newPrescription.rows[0].prescription_id;

    await client.query(
      `INSERT INTO prescription_items (prescription_id, medication_id, dosage, frequency, duration_days, quantity_prescribed, instructions, dispensing_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
      [newPrescriptionId, o.medication_id, o.dosage, o.frequency, o.duration_days, o.quantity_prescribed, o.instructions]
    );

    await client.query('COMMIT');
    return res.status(201).json({ message: 'Refill requested', prescriptionId: newPrescriptionId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Refill request error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  } finally {
    client.release();
  }
};
