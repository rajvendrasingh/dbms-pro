const db = require('../config/db');

// POST /api/vehicles/owner  — register owner
const registerOwner = async (req, res) => {
  const { full_name, email, phone, address, aadhar_no, license_no } = req.body;
  if (!full_name || !phone || !license_no)
    return res.status(400).json({ success: false, message: 'full_name, phone, license_no are required.' });

  try {
    const [dup] = await db.execute(
      'SELECT owner_id FROM vehicle_owners WHERE license_no = ?', [license_no]
    );
    if (dup.length)
      return res.status(409).json({ success: false, message: 'License number already registered.' });

    const [result] = await db.execute(
      `INSERT INTO vehicle_owners(full_name, email, phone, address, aadhar_no, license_no)
       VALUES(?,?,?,?,?,?)`,
      [full_name, email||null, phone, address||null, aadhar_no||null, license_no]
    );
    res.status(201).json({ success: true, message: 'Owner registered.', owner_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/vehicles  — register vehicle
const registerVehicle = async (req, res) => {
  const {
    registration_no, owner_id, vehicle_type,
    make, model, color, year, insurance_expiry, rc_expiry
  } = req.body;

  if (!registration_no || !owner_id || !vehicle_type)
    return res.status(400).json({ success: false, message: 'registration_no, owner_id, vehicle_type required.' });

  try {
    const [dup] = await db.execute(
      'SELECT vehicle_id FROM vehicles WHERE registration_no = ?',
      [registration_no.toUpperCase()]
    );
    if (dup.length)
      return res.status(409).json({ success: false, message: 'Vehicle already registered.' });

    const [result] = await db.execute(
      `INSERT INTO vehicles(registration_no, owner_id, vehicle_type, make, model, color, year, insurance_expiry, rc_expiry)
       VALUES(?,?,?,?,?,?,?,?,?)`,
      [
        registration_no.toUpperCase(), owner_id, vehicle_type,
        make||null, model||null, color||null,
        year||null, insurance_expiry||null, rc_expiry||null
      ]
    );
    res.status(201).json({ success: true, message: 'Vehicle registered.', vehicle_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/vehicles/:reg
const getVehicleByReg = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT v.*, vo.full_name, vo.phone, vo.email, vo.license_no, vo.aadhar_no
       FROM vehicles v
       JOIN vehicle_owners vo ON v.owner_id = vo.owner_id
       WHERE v.registration_no = ?`,
      [req.params.reg.toUpperCase()]
    );
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'Vehicle not found.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/vehicles  — list with pagination
const getAllVehicles = async (req, res) => {
  const { q, blacklisted, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  let where = 'WHERE 1=1';
  const params = [];

  if (q) {
    where += ' AND (v.registration_no LIKE ? OR vo.full_name LIKE ? OR vo.license_no LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (blacklisted !== undefined) {
    where += ' AND v.is_blacklisted = ?';
    params.push(blacklisted === 'true' ? 1 : 0);
  }

  try {
    const [rows] = await db.execute(
      `SELECT v.vehicle_id, v.registration_no, v.vehicle_type, v.make, v.model,
              v.color, v.year, v.is_blacklisted, v.insurance_expiry, v.rc_expiry,
              vo.full_name, vo.phone, vo.license_no
       FROM vehicles v
       JOIN vehicle_owners vo ON v.owner_id = vo.owner_id
       ${where}
       ORDER BY v.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
    const [[{ total }]] = await db.execute(
      `SELECT COUNT(*) AS total FROM vehicles v JOIN vehicle_owners vo ON v.owner_id=vo.owner_id ${where}`,
      params
    );
    res.json({ success: true, data: rows, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PATCH /api/vehicles/:id/blacklist
const toggleBlacklist = async (req, res) => {
  const { blacklist } = req.body;
  try {
    await db.execute(
      'UPDATE vehicles SET is_blacklisted=? WHERE vehicle_id=?',
      [blacklist ? 1 : 0, req.params.id]
    );
    res.json({ success: true, message: `Vehicle ${blacklist ? 'blacklisted' : 'removed from blacklist'}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/vehicles/owners/search?q=
const searchOwners = async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ success: false, message: 'Query required.' });
  try {
    const [rows] = await db.execute(
      `SELECT owner_id, full_name, phone, license_no, aadhar_no
       FROM vehicle_owners
       WHERE full_name LIKE ? OR license_no LIKE ? OR phone LIKE ?
       LIMIT 10`,
      [`%${q}%`, `%${q}%`, `%${q}%`]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { registerOwner, registerVehicle, getVehicleByReg, getAllVehicles, toggleBlacklist, searchOwners };
