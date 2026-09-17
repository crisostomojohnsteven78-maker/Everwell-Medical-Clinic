// api/book-appointment.js
// POST /api/book-appointment. Creates the appointment, and — if a
// serviceId is provided — also creates a linked appointment_service
// row, so "what service was this for" is real, queryable data, not
// something the frontend has to remember and redisplay on its own.
//
// AUTO_COMPLETE_VISIT: when true, every booking also instantly gets a
// completed appointment_service result, a medical_records SOAP note,
// a triage_vitals reading, a sample prescription, AND — since the
// booking UI already collects a payment method and shows a receipt —
// a real invoice for that service, charged and paid immediately. This
// is requested behavior, not a realistic clinical workflow — none of
// this exists yet at the moment someone books an appointment in a
// real clinic. Flip this back to false to go back to the realistic
// flow (appointment only, nothing else, until staff actually enter
// results/notes/vitals/prescriptions/billing later).
//
// generated_by on invoices is VARCHAR(20) — keep the label short.

const pool = require('../lib/db');

const AUTO_COMPLETE_VISIT = true;
const ONLINE_PAYMENT_RECEIVER_ID = 14; // Everwell Billing (Billing Staff role) — same as api/payments.js
const INVOICE_GENERATED_BY = 'Online Booking'; // 15 chars — fits VARCHAR(20)

const SAMPLE_RESULT_SUMMARIES = [
  'Findings within normal range. No abnormalities detected.',
  'Results normal. No further action needed at this time.',
  'No significant findings. Consistent with a healthy baseline.',
  'Within normal limits. Continue routine monitoring as advised.',
];

const SAMPLE_SUBJECTIVE = [
  'Patient reports mild discomfort for the past few days, otherwise feeling well.',
  'Routine visit, no acute complaints at this time.',
  'Patient reports mild fatigue, no other symptoms noted.',
];

const SAMPLE_ASSESSMENT = [
  'Findings within normal range. Advised to continue current care plan and monitor for changes.',
  'No acute concerns noted. Follow-up recommended if symptoms persist beyond two weeks.',
  'Stable presentation. Conservative management recommended for now.',
];

const SAMPLE_PLAN = [
  'Advised rest, hydration, and follow-up if symptoms persist.',
  'Continue current care plan. Return if symptoms worsen.',
  'Routine follow-up in the coming weeks if needed.',
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function sampleVitals() {
  return {
    bp: `${104 + Math.floor(Math.random() * 26)}/${66 + Math.floor(Math.random() * 14)}`,
    hr: 62 + Math.floor(Math.random() * 26),
    temp: (36.3 + Math.random() * 0.9).toFixed(1),
    respiratoryRate: 14 + Math.floor(Math.random() * 6),
    weight: Math.round(52 + Math.random() * 30),
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { patientId, doctorId, appointmentType, scheduledAt, createdBy, serviceId, notes, paymentMethod } = req.body;

  if (!patientId || !doctorId || !appointmentType || !scheduledAt) {
    return res.status(400).json({
      error: 'patientId, doctorId, appointmentType, and scheduledAt are required',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const patientCheck = await client.query(
      'SELECT patient_id FROM patients WHERE patient_id = $1 AND is_active = TRUE',
      [patientId]
    );
    if (patientCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Patient not found' });
    }

    const doctorCheck = await client.query(
      `SELECT u.user_id FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE u.user_id = $1 AND r.role_name = 'Doctor' AND u.status = 'active'`,
      [doctorId]
    );
    if (doctorCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Selected doctor is not valid or not active' });
    }

    const apptResult = await client.query(
      `INSERT INTO appointments (patient_id, doctor_id, appointment_type, scheduled_at, created_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING appointment_id, status, scheduled_at`,
      [patientId, doctorId, appointmentType, scheduledAt, createdBy || null, notes || null]
    );
    const appointment = apptResult.rows[0];

    let invoice = null;

    if (serviceId) {
      let appointmentServiceId = null;

      if (AUTO_COMPLETE_VISIT) {
        const asResult = await client.query(
          `INSERT INTO appointment_services (appointment_id, service_id, status, result_summary, resulted_at)
           VALUES ($1, $2, 'completed', $3, NOW())
           RETURNING appointment_service_id`,
          [appointment.appointment_id, serviceId, pick(SAMPLE_RESULT_SUMMARIES)]
        );
        appointmentServiceId = asResult.rows[0].appointment_service_id;

        // Bill it immediately: booking already shows the patient a
        // receipt with the fee and their chosen payment method, so
        // make that real instead of just a client-side display.
        const svcResult = await client.query(
          'SELECT service_name, standard_price FROM services WHERE service_id = $1',
          [serviceId]
        );
        if (svcResult.rows.length > 0) {
          const price = Number(svcResult.rows[0].standard_price);
          const invResult = await client.query(
            `INSERT INTO invoices (patient_id, appointment_id, invoice_date, total_amount, payment_status, generated_by)
             VALUES ($1, $2, NOW(), $3, 'unpaid', $4)
             RETURNING invoice_id`,
            [patientId, appointment.appointment_id, price, INVOICE_GENERATED_BY]
          );
          const invoiceId = invResult.rows[0].invoice_id;

          await client.query(
            `INSERT INTO invoice_items (invoice_id, appointment_service_id, description, quantity, unit_price, subtotal)
             VALUES ($1, $2, $3, 1, $4, $4)`,
            [invoiceId, appointmentServiceId, svcResult.rows[0].service_name, price]
          );

          let paymentStatus = 'unpaid';
          if (paymentMethod) {
            await client.query(
              `INSERT INTO payments (invoice_id, amount_paid, payment_method, received_by, paid_at)
               VALUES ($1, $2, $3, $4, NOW())`,
              [invoiceId, price, paymentMethod, ONLINE_PAYMENT_RECEIVER_ID]
            );
            paymentStatus = 'paid';
            await client.query(`UPDATE invoices SET payment_status = 'paid' WHERE invoice_id = $1`, [invoiceId]);
          }

          invoice = { invoiceId, amount: price, paymentStatus };
        }
      } else {
        await client.query(
          `INSERT INTO appointment_services (appointment_id, service_id, status)
           VALUES ($1, $2, 'ordered')`,
          [appointment.appointment_id, serviceId]
        );
      }
    }

    if (AUTO_COMPLETE_VISIT) {
      const v = sampleVitals();

      const recordResult = await client.query(
        `INSERT INTO medical_records (appointment_id, doctor_id, subjective, objective, assessment, plan, diagnosis_description)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING record_id`,
        [
          appointment.appointment_id,
          doctorId,
          pick(SAMPLE_SUBJECTIVE),
          `Temp ${v.temp}C, BP ${v.bp}, HR ${v.hr} bpm, alert and ambulatory.`,
          pick(SAMPLE_ASSESSMENT),
          pick(SAMPLE_PLAN),
          'Routine visit — no significant diagnosis',
        ]
      );
      const recordId = recordResult.rows[0].record_id;

      await client.query(
        `INSERT INTO triage_vitals (appointment_id, recorded_by, blood_pressure, temperature_celsius, pulse_rate_bpm, respiratory_rate, weight_kg, chief_complaint, urgency_level, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [appointment.appointment_id, doctorId, v.bp, v.temp, v.hr, v.respiratoryRate, v.weight, pick(SAMPLE_SUBJECTIVE), 'Routine']
      );

      const medResult = await client.query('SELECT medication_id FROM medications ORDER BY RANDOM() LIMIT 1');
      if (medResult.rows.length > 0) {
        const prescriptionResult = await client.query(
          `INSERT INTO prescriptions (record_id, patient_id, doctor_id, prescribed_at, validation_status)
           VALUES ($1, $2, $3, NOW(), 'validated')
           RETURNING prescription_id`,
          [recordId, patientId, doctorId]
        );
        const prescriptionId = prescriptionResult.rows[0].prescription_id;

        await client.query(
          `INSERT INTO prescription_items (prescription_id, medication_id, dosage, frequency, duration_days, quantity_prescribed, instructions, dispensing_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
          [prescriptionId, medResult.rows[0].medication_id, 'As directed', 'Once daily', 5, 10, 'Take with food.']
        );
      }
    }

    await client.query('COMMIT');
    return res.status(201).json({
      message: 'Appointment booked successfully',
      appointment,
      invoice,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Booking error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  } finally {
    client.release();
  }
};