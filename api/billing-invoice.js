// api/billing-invoice.js
// POST /api/billing-invoice — creates a new invoice from one or more
// real billable items for a patient: appointment services and/or
// pharmacy dispenses (see api/billable-items.js). This is required
// by the invoice_items schema, which has a check constraint —
// chk_invoice_item_exactly_one — meaning every line item MUST
// reference either a real appointment_service_id or a real
// dispense_id. Free-typed descriptions/amounts are not allowed.
//
// Prices are looked up server-side from the source tables (never
// trusted from the client), and each selected item is re-checked
// for "not already invoiced" inside the transaction to avoid a
// race where two billing staff invoice the same item at once.
//
// PLACEHOLDER: no real staff login yet on this dashboard, so
// generated_by is stamped with a placeholder label, matching the
// PLACEHOLDER_PHARMACIST_ID pattern used elsewhere until real staff
// auth is built. generated_by is VARCHAR(20), so keep it short.

const pool = require('../lib/db');

const PLACEHOLDER_GENERATED_BY = 'Everwell Billing'; // 17 chars — fits VARCHAR(20)

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { patientId, appointmentServiceIds = [], dispenseIds = [] } = req.body;

  if (!patientId) {
    return res.status(400).json({ error: 'patientId is required' });
  }
  if (appointmentServiceIds.length === 0 && dispenseIds.length === 0) {
    return res.status(400).json({ error: 'Select at least one billable service or dispense' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const lineItems = []; // { description, quantity, unitPrice, subtotal, appointmentServiceId, dispenseId }

    if (appointmentServiceIds.length > 0) {
      const servicesResult = await client.query(
        `SELECT aser.appointment_service_id, s.service_name, s.standard_price
         FROM appointment_services aser
         JOIN appointments a ON aser.appointment_id = a.appointment_id
         JOIN services s ON aser.service_id = s.service_id
         WHERE aser.appointment_service_id = ANY($1::bigint[])
           AND a.patient_id = $2
           AND aser.appointment_service_id NOT IN (
             SELECT appointment_service_id FROM invoice_items WHERE appointment_service_id IS NOT NULL
           )`,
        [appointmentServiceIds, patientId]
      );
      if (servicesResult.rows.length !== appointmentServiceIds.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'One or more selected services are no longer available to bill (already invoiced, or not found)' });
      }
      for (const row of servicesResult.rows) {
        const price = Number(row.standard_price);
        lineItems.push({
          description: row.service_name,
          quantity: 1,
          unitPrice: price,
          subtotal: price,
          appointmentServiceId: row.appointment_service_id,
          dispenseId: null,
        });
      }
    }

    if (dispenseIds.length > 0) {
      const dispensesResult = await client.query(
        `SELECT d.dispense_id, d.total_price, d.quantity,
                COALESCE(m.brand_name, m.generic_name) AS medication_name
         FROM dispensing_records d
         LEFT JOIN pharmacy_inventory pi ON d.inventory_id = pi.inventory_id
         LEFT JOIN medications m ON pi.medication_id = m.medication_id
         WHERE d.dispense_id = ANY($1::bigint[])
           AND d.patient_id = $2
           AND d.dispense_id NOT IN (
             SELECT dispense_id FROM invoice_items WHERE dispense_id IS NOT NULL
           )`,
        [dispenseIds, patientId]
      );
      if (dispensesResult.rows.length !== dispenseIds.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'One or more selected pharmacy items are no longer available to bill (already invoiced, or not found)' });
      }
      for (const row of dispensesResult.rows) {
        const subtotal = Number(row.total_price);
        const qty = row.quantity || 1;
        lineItems.push({
          description: row.medication_name || 'Pharmacy dispense',
          quantity: qty,
          unitPrice: subtotal / qty,
          subtotal,
          appointmentServiceId: null,
          dispenseId: row.dispense_id,
        });
      }
    }

    const totalAmount = lineItems.reduce((sum, li) => sum + li.subtotal, 0);

    const invoiceResult = await client.query(
      `INSERT INTO invoices (patient_id, appointment_id, invoice_date, total_amount, payment_status, generated_by)
       VALUES ($1, NULL, NOW(), $2, 'unpaid', $3)
       RETURNING invoice_id`,
      [patientId, totalAmount, PLACEHOLDER_GENERATED_BY]
    );
    const invoiceId = invoiceResult.rows[0].invoice_id;

    for (const li of lineItems) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, appointment_service_id, dispense_id, description, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [invoiceId, li.appointmentServiceId, li.dispenseId, li.description, li.quantity, li.unitPrice, li.subtotal]
      );
    }

    await client.query('COMMIT');
    return res.status(201).json({ message: 'Invoice created', invoiceId, totalAmount });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create invoice error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  } finally {
    client.release();
  }
};