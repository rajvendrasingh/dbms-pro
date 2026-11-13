/**
 * Run this ONCE after importing schema.sql to set admin password.
 * Usage:  node seed-admin.js
 */
require('dotenv').config();
const db     = require('./config/db');
const bcrypt = require('bcryptjs');

(async () => {
  try {
    const hash = await bcrypt.hash('Admin@123', 10);
    const [result] = await db.execute(
      `UPDATE officers SET password_hash = ? WHERE badge_number = 'ADMIN001'`,
      [hash]
    );
    if (result.affectedRows > 0) {
      console.log('✅ Admin password set to: Admin@123');
    } else {
      console.log('⚠️  No officer with badge ADMIN001 found. Make sure schema.sql was imported.');
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
