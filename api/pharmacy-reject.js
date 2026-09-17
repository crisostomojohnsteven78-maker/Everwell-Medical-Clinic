// api/pharmacy-reject.js
// POST /api/pharmacy-reject — flags a prescription as rejected/unsafe
// instead of dispensing it. Marks the prescription's validation_status
// 'rejected', records who rejected it, and stores why (rejection_reason)
// so it can show up in the pharmacist dashboard's Safety Alerts panel.
//
// PLACEHOLDER_PHARMACIST_ID: matches pharmacy-dispense.js — this
// dashboard has no real staff login yet, so we use the same
// placeholder "Everwell Pharmacy" account (user_id 15) until real
// staff auth is built for this page.

const pool = require('../lib/db');

const PLACEHOLDER_PHARMACIST_ID = 15; // Everwell Pharmacy (Pharmacist role)

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prescriptionId, reason } = req.body;
  if (!prescriptionId) {
    return res.status(400).json({ error: 'prescriptionId is required' });
  }
  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'A rejection reason is required' });
  }

  try {
    const result = await pool.query(
      `SELECT prescription_id, validation_status FROM prescriptions WHERE prescription_id = $1`,
      [prescriptionId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prescription not found' });
    }
    if (result.rows[0].validation_status === 'rejected') {
      return res.status(409).json({ error: 'This prescription has already been rejected' });
    }

    await pool.query(
      `UPDATE prescriptions
       SET validation_status = 'rejected', validated_by = $1, validated_at = NOW(), rejection_reason = $2
       WHERE prescription_id = $3`,
      [PLACEHOLDER_PHARMACIST_ID, reason.trim(), prescriptionId]
    );

    return res.status(200).json({ message: 'Prescription flagged and rejected' });
  } catch (err) {
    console.error('Reject error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  }
};
