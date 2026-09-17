// api/pharmacy-dispense.js
// POST /api/pharmacy-dispense — validates and dispenses a prescription
// item in one step (matches the dashboard's single "Validate" action).
// Marks the item's dispensing_status 'dispensed' and the parent
// prescription's validation_status 'validated', recording who did it.
//
// PLACEHOLDER_PHARMACIST_ID: this dashboard has no real staff login
// yet, so there's no way to know which pharmacist is actually using
// it. Using a placeholder "Everwell Pharmacy" account (user_id 15)
// until real staff auth is built for this page.

const pool = require('../lib/db');

const PLACEHOLDER_PHARMACIST_ID = 15; // Everwell Pharmacy (Pharmacist role)

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prescriptionItemId } = req.body;
  if (!prescriptionItemId) {
    return res.status(400).json({ error: 'prescriptionItemId is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const itemResult = await client.query(
      `SELECT prescription_item_id, prescription_id, dispensing_status FROM prescription_items WHERE prescription_item_id = $1`,
      [prescriptionItemId]
    );
    if (itemResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Prescription item not found' });
    }
    if (itemResult.rows[0].dispensing_status === 'dispensed') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This item has already been dispensed' });
    }

    await client.query(
      `UPDATE prescription_items SET dispensing_status = 'dispensed' WHERE prescription_item_id = $1`,
      [prescriptionItemId]
    );

    await client.query(
      `UPDATE prescriptions SET validation_status = 'validated', validated_by = $1, validated_at = NOW()
       WHERE prescription_id = $2`,
      [PLACEHOLDER_PHARMACIST_ID, itemResult.rows[0].prescription_id]
    );

    await client.query('COMMIT');
    return res.status(200).json({ message: 'Validated and dispensed' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Dispense error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  } finally {
    client.release();
  }
};
