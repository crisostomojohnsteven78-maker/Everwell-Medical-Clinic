// api/invoices.js
// GET  /api/invoices  -> list all invoices, patient name joined in
// POST /api/invoices  -> create an invoice with real line items
//
// Each line item can be:
//   { serviceId, quantity, unitPrice? }   -> creates a real appointment_service
//                                             row for this visit (status: completed),
//                                             then bills it. unitPrice defaults to
//                                             the catalog's standard_price if omitted.
//   { dispenseId, quantity, unitPrice }   -> bills an already-dispensed medication
//
// This is how we keep every invoice line tied to something real, per the
// database's CHECK constraint, without requiring a separate "log the
// service" step before billing can happen.

const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      const result = await pool.query(
        `SELECT i.invoice_id, i.patient_id, i.appointment_id, i.invoice_date,
                i.total_amount, i.payment_status, i.generated_by,
                p.first_name AS patient_first_name, p.last_name AS patient_last_name,
                (SELECT string_agg(ii.description, ', ')
                 FROM invoice_items ii WHERE ii.invoice_id = i.invoice_id) AS item_summary
         FROM invoices i
         JOIN patients p ON i.patient_id = p.patient_id
         ORDER BY i.invoice_date DESC`
      );
      return res.status(200).json({ count: result.rows.length, invoices: result.rows });
    } catch (err) {
      console.error('Fetch invoices error:', err);
      return res.status(500).json({ error: 'Something went wrong, please try again' });
    }
  }

  if (req.method === 'POST') {
    const { patientId, appointmentId, items, generatedBy } = req.body;
    // items: array of { serviceId?, dispenseId?, quantity, unitPrice?, description? }

    if (!patientId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'patientId and at least one line item are required' });
    }

    for (const item of items) {
      const hasService = !!item.serviceId;
      const hasDispense = !!item.dispenseId;
      if (hasService === hasDispense) {
        return res.status(400).json({
          error: 'Each line item must reference exactly one of serviceId or dispenseId',
        });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const resolvedItems = [];

      for (const item of items) {
        if (item.serviceId) {
          if (!appointmentId) {
            throw new Error('appointmentId is required when billing a service');
          }
          const serviceResult = await client.query(
            'SELECT service_name, standard_price FROM services WHERE service_id = $1',
            [item.serviceId]
          );
          if (serviceResult.rows.length === 0) {
            throw new Error('Selected service was not found');
          }
          const { service_name, standard_price } = serviceResult.rows[0];
          const unitPrice = item.unitPrice ?? parseFloat(standard_price);

          // Create the real appointment_service row this invoice line will bill
          const apptServiceResult = await client.query(
            `INSERT INTO appointment_services (appointment_id, service_id, status, performed_at)
             VALUES ($1, $2, 'completed', NOW())
             RETURNING appointment_service_id`,
            [appointmentId, item.serviceId]
          );

          resolvedItems.push({
            appointmentServiceId: apptServiceResult.rows[0].appointment_service_id,
            dispenseId: null,
            description: item.description || service_name,
            quantity: item.quantity || 1,
            unitPrice,
          });
        } else {
          // dispenseId path — item was already dispensed, just bill it
          resolvedItems.push({
            appointmentServiceId: null,
            dispenseId: item.dispenseId,
            description: item.description || 'Dispensed item',
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice,
          });
        }
      }

      const totalAmount = resolvedItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

      const invoiceResult = await client.query(
        `INSERT INTO invoices (patient_id, appointment_id, total_amount, payment_status, generated_by)
         VALUES ($1, $2, $3, 'unpaid', $4)
         RETURNING invoice_id`,
        [patientId, appointmentId || null, totalAmount, generatedBy || 'user']
      );
      const invoiceId = invoiceResult.rows[0].invoice_id;

      for (const item of resolvedItems) {
        const subtotal = item.quantity * item.unitPrice;
        await client.query(
          `INSERT INTO invoice_items
             (invoice_id, appointment_service_id, dispense_id, description, quantity, unit_price, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [invoiceId, item.appointmentServiceId, item.dispenseId, item.description, item.quantity, item.unitPrice, subtotal]
        );
      }

      await client.query('COMMIT');
      return res.status(201).json({ message: 'Invoice created', invoiceId, totalAmount });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Create invoice error:', err);
      return res.status(500).json({ error: err.message || 'Something went wrong, please try again' });
    } finally {
      client.release();
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
