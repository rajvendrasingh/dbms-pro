const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.use(verifyToken);

// GET all violation types
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM violation_types ORDER BY severity DESC, fine_amount DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET zones
router.get('/zones', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM zones ORDER BY city ASC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST create violation type (admin)
router.post('/', requireAdmin, async (req, res) => {
  const { violation_code, description, fine_amount, severity, ipc_section } = req.body;
  if (!violation_code || !description || !fine_amount)
    return res.status(400).json({ success: false, message: 'violation_code, description, fine_amount required.' });
  try {
    const [result] = await db.execute(
      'INSERT INTO violation_types(violation_code,description,fine_amount,severity,ipc_section) VALUES(?,?,?,?,?)',
      [violation_code, description, fine_amount, severity||'Minor', ipc_section||null]
    );
    res.status(201).json({ success: true, violation_id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET disputes list
router.get('/disputes', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT d.*, c.challan_number, c.fine_amount, v.registration_no
       FROM disputes d
       JOIN challans c ON d.challan_id = c.challan_id
       JOIN vehicles v ON c.vehicle_id = v.vehicle_id
       ORDER BY d.raised_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST raise dispute
router.post('/disputes', async (req, res) => {
  const { challan_id, raised_by, reason } = req.body;
  if (!challan_id || !raised_by || !reason)
    return res.status(400).json({ success: false, message: 'challan_id, raised_by, reason required.' });
  try {
    const [result] = await db.execute(
      'INSERT INTO disputes(challan_id, raised_by, reason) VALUES(?,?,?)',
      [challan_id, raised_by, reason]
    );
    await db.execute(
      "UPDATE challans SET status='Disputed' WHERE challan_id=? AND status='Pending'",
      [challan_id]
    );
    res.status(201).json({ success: true, dispute_id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PATCH resolve dispute (admin)
router.patch('/disputes/:id', requireAdmin, async (req, res) => {
  const { status, resolution } = req.body;
  if (!['Resolved','Rejected'].includes(status))
    return res.status(400).json({ success: false, message: 'Status must be Resolved or Rejected.' });
  try {
    await db.execute(
      `UPDATE disputes SET status=?, resolution=?, resolved_by=?, resolved_at=NOW()
       WHERE dispute_id=?`,
      [status, resolution||null, req.officer.officer_id, req.params.id]
    );
    res.json({ success: true, message: `Dispute ${status}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
