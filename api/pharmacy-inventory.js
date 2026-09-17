// api/pharmacy-inventory.js
// GET  /api/pharmacy-inventory — every batch on hand, joined with its
//      medication (name, whether it requires a prescription).
// POST /api/pharmacy-inventory — add a new inventory batch for an
//      existing medication.
// PUT  /api/pharmacy-inventory — update an existing inventory batch
//      (stock count, reorder level, batch number, expiry, unit cost).

const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      const result = await pool.query(
        `SELECT
           inv.inventory_id, inv.medication_id, inv.batch_number, inv.expiry_date,
           inv.quantity_on_hand, inv.reorder_level, inv.unit_cost, inv.last_restocked_at,
           m.generic_name, m.brand_name, m.dosage_form, m.strength, m.requires_prescription
         FROM pharmacy_inventory inv
         JOIN medications m ON inv.medication_id = m.medication_id
         ORDER BY m.generic_name`
      );
      return res.status(200).json({ count: result.rows.length, inventory: result.rows });
    } catch (err) {
      console.error('Fetch inventory error:', err);
      return res.status(500).json({ error: 'Something went wrong, please try again' });
    }
  }

  if (req.method === 'POST') {
    const { medicationId, batchNumber, expiryDate, quantityOnHand, reorderLevel, unitCost } = req.body;

    if (!medicationId || quantityOnHand === undefined || reorderLevel === undefined) {
      return res.status(400).json({ error: 'medicationId, quantityOnHand, and reorderLevel are required' });
    }

    try {
      const result = await pool.query(
        `INSERT INTO pharmacy_inventory (medication_id, batch_number, expiry_date, quantity_on_hand, reorder_level, unit_cost, last_restocked_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING inventory_id`,
        [medicationId, batchNumber || null, expiryDate || null, quantityOnHand, reorderLevel, unitCost || null]
      );
      return res.status(201).json({ message: 'Inventory batch added', inventoryId: result.rows[0].inventory_id });
    } catch (err) {
      console.error('Add inventory error:', err);
      return res.status(500).json({ error: 'Something went wrong, please try again' });
    }
  }

  if (req.method === 'PUT') {
    const { inventoryId, batchNumber, expiryDate, quantityOnHand, reorderLevel, unitCost } = req.body;

    if (!inventoryId) {
      return res.status(400).json({ error: 'inventoryId is required' });
    }
    if (quantityOnHand === undefined || reorderLevel === undefined) {
      return res.status(400).json({ error: 'quantityOnHand and reorderLevel are required' });
    }

    try {
      const result = await pool.query(
        `UPDATE pharmacy_inventory
         SET batch_number = $1, expiry_date = $2, quantity_on_hand = $3, reorder_level = $4, unit_cost = $5
         WHERE inventory_id = $6
         RETURNING inventory_id`,
        [batchNumber || null, expiryDate || null, quantityOnHand, reorderLevel, unitCost || null, inventoryId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Inventory item not found' });
      }
      return res.status(200).json({ message: 'Inventory item updated' });
    } catch (err) {
      console.error('Update inventory error:', err);
      return res.status(500).json({ error: 'Something went wrong, please try again' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};