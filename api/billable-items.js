// api/billable-items.js
// GET /api/billable-items?patientId=6 — everything for this patient
// that CAN legally become an invoice line item under this schema:
// appointment services they've had, and pharmacy dispenses to them,
// that aren't already attached to an existing invoice_items row.
//
// invoice_items has a check constraint: every line item must
// reference EITHER a real appointment_service OR a real dispense —
// never a free-typed description/amount. This endpoint is what lets
// the billing dashboard build a valid invoice from real billable
// events instead of arbitrary text.

const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { patientId } = req.query;
  if (!patientId) {
    return res.status(400).json({ error: 'patientId is required' });
  }

  try {
    const servicesResult = await pool.query(
      `SELECT aser.appointment_service_id, s.service_name, s.standard_price, aser.performed_at, aser.status
       FROM appointment_services aser
       JOIN appointments a ON aser.appointment_id = a.appointment_id
       JOIN services s ON aser.service_id = s.service_id
       WHERE a.patient_id = $1
         AND aser.appointment_service_id NOT IN (
           SELECT appointment_service_id FROM invoice_items WHERE appointment_service_id IS NOT NULL
         )
       ORDER BY aser.performed_at DESC NULLS LAST`,
      [patientId]
    );

    const dispensesResult = await pool.query(
      `SELECT d.dispense_id, d.total_price, d.quantity, d.dispensed_at, d.sale_type,
              COALESCE(m.brand_name, m.generic_name) AS medication_name
       FROM dispensing_records d
       LEFT JOIN pharmacy_inventory pi ON d.inventory_id = pi.inventory_id
       LEFT JOIN medications m ON pi.medication_id = m.medication_id
       WHERE d.patient_id = $1
         AND d.dispense_id NOT IN (
           SELECT dispense_id FROM invoice_items WHERE dispense_id IS NOT NULL
         )
       ORDER BY d.dispensed_at DESC`,
      [patientId]
    );

    return res.status(200).json({
      appointmentServices: servicesResult.rows,
      dispenses: dispensesResult.rows,
    });
  } catch (err) {
    console.error('Fetch billable items error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  }
};
