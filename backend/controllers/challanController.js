const db = require('../config/db');

// ─── Helper: generate challan number ─────────────────────────────
const generateChallanNumber = async () => {
  const prefix = `CHL${new Date().toISOString().slice(0,7).replace('-','')}`;
  const [rows] = await db.execute(
    'SELECT COUNT(*) AS cnt FROM challans WHERE challan_number LIKE ?',
    [`${prefix}%`]
  );
  const seq = rows[0].cnt + 1;
  return `${prefix}${String(seq).padStart(5,'0')}`;
};

// ─── POST /api/challans ───────────────────────────────────────────
const issueChallan = async (req, res) => {
  const {
    registration_no, violation_id, violation_date,
    location, notes, zone_id
  } = req.body;

  if (!registration_no || !violation_id || !violation_date || !location)
    return res.status(400).json({ success: false, message: 'Missing required fields.' });

  try {
    // Find vehicle
    const [vRows] = await db.execute(
      'SELECT vehicle_id FROM vehicles WHERE registration_no = ?',
      [registration_no.toUpperCase()]
    );
    if (!vRows.length)
      return res.status(404).json({ success: false, message: 'Vehicle not found. Register the vehicle first.' });

    // Get fine amount
    const [vtRows] = await db.execute(
      'SELECT fine_amount FROM violation_types WHERE violation_id = ?',
      [violation_id]
    );
    if (!vtRows.length)
      return res.status(404).json({ success: false, message: 'Violation type not found.' });

    const challan_number = await generateChallanNumber();
    const fine_amount    = vtRows[0].fine_amount;
    // Due date = 60 days from today
    const due_date = new Date(Date.now() + 60*24*60*60*1000).toISOString().split('T')[0];

    const [result] = await db.execute(
      `INSERT INTO challans
         (challan_number, vehicle_id, officer_id, zone_id, violation_id,
          violation_date, location, fine_amount, status, due_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?)`,
      [
        challan_number, vRows[0].vehicle_id,
        req.officer.officer_id,
        zone_id || req.officer.zone_id,
        violation_id, violation_date, location,
        fine_amount, due_date, notes || null
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Challan issued successfully.',
      challan_id:     result.insertId,
      challan_number,
      fine_amount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET /api/challans ────────────────────────────────────────────
const getAllChallans = async (req, res) => {
  const { status, zone_id, from, to, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  let where  = 'WHERE 1=1';
  const params = [];

  if (status)  { where += ' AND c.status = ?';          params.push(status); }
  if (zone_id) { where += ' AND c.zone_id = ?';         params.push(zone_id); }
  if (from)    { where += ' AND c.violation_date >= ?';  params.push(from); }
  if (to)      { where += ' AND c.violation_date <= ?';  params.push(to + ' 23:59:59'); }

  try {
    const [rows] = await db.execute(
      `SELECT
         c.challan_id, c.challan_number, c.violation_date, c.location,
         c.fine_amount, c.status, c.due_date,
         v.registration_no, v.vehicle_type,
         vo.full_name AS owner_name, vo.phone AS owner_phone,
         vt.violation_code, vt.description AS violation_desc, vt.severity,
         o.full_name AS officer_name, o.badge_number,
         z.zone_name
       FROM challans c
       JOIN vehicles v       ON c.vehicle_id   = v.vehicle_id
       JOIN vehicle_owners vo ON v.owner_id    = vo.owner_id
       JOIN violation_types vt ON c.violation_id= vt.violation_id
       JOIN officers o        ON c.officer_id  = o.officer_id
       LEFT JOIN zones z      ON c.zone_id     = z.zone_id
       ${where}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    const [[{ total }]] = await db.execute(
      `SELECT COUNT(*) AS total FROM challans c ${where}`, params
    );

    res.json({ success: true, data: rows, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET /api/challans/:id ────────────────────────────────────────
const getChallanById = async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM v_challan_details WHERE challan_id = ?',
      [req.params.id]
    );
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'Challan not found.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET /api/challans/vehicle/:reg ──────────────────────────────
const getChallansByVehicle = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT * FROM v_challan_details
       WHERE registration_no = ?
       ORDER BY violation_date DESC`,
      [req.params.reg.toUpperCase()]
    );
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── POST /api/challans/:id/pay ───────────────────────────────────
const payChallan = async (req, res) => {
  const { payment_method, transaction_ref } = req.body;
  const challan_id = req.params.id;

  if (!payment_method)
    return res.status(400).json({ success: false, message: 'Payment method required.' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[challan]] = await conn.execute(
      'SELECT challan_id, fine_amount, status FROM challans WHERE challan_id = ? FOR UPDATE',
      [challan_id]
    );
    if (!challan)       throw new Error('Challan not found.');
    if (challan.status !== 'Pending') throw new Error(`Challan is already ${challan.status}.`);

    await conn.execute(
      `INSERT INTO payments(challan_id, amount_paid, payment_method, transaction_ref, received_by)
       VALUES(?, ?, ?, ?, ?)`,
      [challan_id, challan.fine_amount, payment_method,
       transaction_ref || null, req.officer.officer_id]
    );
    await conn.execute(
      "UPDATE challans SET status='Paid', updated_at=NOW() WHERE challan_id=?",
      [challan_id]
    );
    await conn.commit();
    res.json({ success: true, message: 'Payment recorded. Challan marked as Paid.' });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
};

// ─── PATCH /api/challans/:id/status ──────────────────────────────
const updateStatus = async (req, res) => {
  const { status, notes } = req.body;
  const allowed = ['Disputed', 'Cancelled', 'Waived'];
  if (!allowed.includes(status))
    return res.status(400).json({ success: false, message: `Status must be one of: ${allowed.join(', ')}` });

  try {
    const [result] = await db.execute(
      'UPDATE challans SET status=?, notes=COALESCE(?, notes), updated_at=NOW() WHERE challan_id=?',
      [status, notes || null, req.params.id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ success: false, message: 'Challan not found.' });
    res.json({ success: true, message: `Challan status updated to ${status}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET /api/challans/stats/dashboard ───────────────────────────
const getDashboardStats = async (req, res) => {
  try {
    const [[totals]] = await db.execute(
      `SELECT
         COUNT(*)                                            AS total_challans,
         SUM(fine_amount)                                   AS total_fines,
         SUM(CASE WHEN status='Paid'     THEN fine_amount ELSE 0 END) AS collected,
         SUM(CASE WHEN status='Pending'  THEN fine_amount ELSE 0 END) AS pending_amount,
         COUNT(CASE WHEN status='Pending'  THEN 1 END)      AS pending_count,
         COUNT(CASE WHEN status='Paid'     THEN 1 END)      AS paid_count,
         COUNT(CASE WHEN status='Disputed' THEN 1 END)      AS disputed_count,
         COUNT(CASE WHEN status='Cancelled' THEN 1 END)     AS cancelled_count
       FROM challans`
    );

    // Last 7 days trend
    const [trend] = await db.execute(
      `SELECT DATE(violation_date) AS day, COUNT(*) AS count, SUM(fine_amount) AS amount
       FROM challans
       WHERE violation_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY DATE(violation_date)
       ORDER BY day ASC`
    );

    // Top violations
    const [topViolations] = await db.execute(
      `SELECT vt.description, COUNT(*) AS count
       FROM challans c
       JOIN violation_types vt ON c.violation_id = vt.violation_id
       GROUP BY c.violation_id
       ORDER BY count DESC LIMIT 5`
    );

    // Zone-wise stats
    const [zones] = await db.execute(
      `SELECT z.zone_name, COUNT(c.challan_id) AS total,
              SUM(CASE WHEN c.status='Paid' THEN c.fine_amount ELSE 0 END) AS collected
       FROM zones z
       LEFT JOIN challans c ON z.zone_id = c.zone_id
       GROUP BY z.zone_id
       ORDER BY total DESC`
    );

    res.json({ success: true, stats: totals, trend, topViolations, zones });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  issueChallan, getAllChallans, getChallanById,
  getChallansByVehicle, payChallan, updateStatus, getDashboardStats
};
