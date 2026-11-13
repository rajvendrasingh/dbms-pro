-- ============================================
--  TRAFFIC VIOLATION & SMART CHALLAN SYSTEM
--  Database Schema
-- ============================================

CREATE DATABASE IF NOT EXISTS traffic_challan_db;
USE traffic_challan_db;

-- -----------------------------------------------
-- ZONES (cities/areas)
-- -----------------------------------------------
CREATE TABLE zones (
    zone_id    INT AUTO_INCREMENT PRIMARY KEY,
    zone_name  VARCHAR(100) NOT NULL,
    city       VARCHAR(100) NOT NULL,
    state      VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------
-- TRAFFIC OFFICERS
-- -----------------------------------------------
CREATE TABLE officers (
    officer_id     INT AUTO_INCREMENT PRIMARY KEY,
    badge_number   VARCHAR(20) UNIQUE NOT NULL,
    full_name      VARCHAR(150) NOT NULL,
    email          VARCHAR(150) UNIQUE NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    phone          VARCHAR(15),
    zone_id        INT,
    rank           ENUM('Constable','Head Constable','ASI','SI','Inspector','DSP','SP') DEFAULT 'Constable',
    is_active      BOOLEAN DEFAULT TRUE,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (zone_id) REFERENCES zones(zone_id) ON DELETE SET NULL
);

-- -----------------------------------------------
-- VEHICLE OWNERS
-- -----------------------------------------------
CREATE TABLE vehicle_owners (
    owner_id    INT AUTO_INCREMENT PRIMARY KEY,
    full_name   VARCHAR(150) NOT NULL,
    email       VARCHAR(150),
    phone       VARCHAR(15) NOT NULL,
    address     TEXT,
    aadhar_no   VARCHAR(20) UNIQUE,
    license_no  VARCHAR(20) UNIQUE NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------
-- VEHICLES
-- -----------------------------------------------
CREATE TABLE vehicles (
    vehicle_id       INT AUTO_INCREMENT PRIMARY KEY,
    registration_no  VARCHAR(20) UNIQUE NOT NULL,
    owner_id         INT NOT NULL,
    vehicle_type     ENUM('Two-Wheeler','Three-Wheeler','Four-Wheeler','Heavy Vehicle','Bus','Truck') NOT NULL,
    make             VARCHAR(100),
    model            VARCHAR(100),
    color            VARCHAR(50),
    year             YEAR,
    insurance_expiry DATE,
    rc_expiry        DATE,
    is_blacklisted   BOOLEAN DEFAULT FALSE,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES vehicle_owners(owner_id) ON DELETE CASCADE
);

-- -----------------------------------------------
-- VIOLATION TYPES
-- -----------------------------------------------
CREATE TABLE violation_types (
    violation_id   INT AUTO_INCREMENT PRIMARY KEY,
    violation_code VARCHAR(20) UNIQUE NOT NULL,
    description    VARCHAR(255) NOT NULL,
    fine_amount    DECIMAL(10,2) NOT NULL,
    severity       ENUM('Minor','Moderate','Major','Critical') DEFAULT 'Minor',
    ipc_section    VARCHAR(50),
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------
-- CHALLANS
-- -----------------------------------------------
CREATE TABLE challans (
    challan_id       INT AUTO_INCREMENT PRIMARY KEY,
    challan_number   VARCHAR(30) UNIQUE NOT NULL,
    vehicle_id       INT NOT NULL,
    officer_id       INT NOT NULL,
    zone_id          INT,
    violation_id     INT NOT NULL,
    violation_date   DATETIME NOT NULL,
    location         VARCHAR(255),
    fine_amount      DECIMAL(10,2) NOT NULL,
    status           ENUM('Pending','Paid','Disputed','Cancelled','Waived') DEFAULT 'Pending',
    due_date         DATE,
    notes            TEXT,
    image_url        VARCHAR(255),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id)  REFERENCES vehicles(vehicle_id)  ON DELETE CASCADE,
    FOREIGN KEY (officer_id)  REFERENCES officers(officer_id)  ON DELETE RESTRICT,
    FOREIGN KEY (zone_id)     REFERENCES zones(zone_id)        ON DELETE SET NULL,
    FOREIGN KEY (violation_id)REFERENCES violation_types(violation_id) ON DELETE RESTRICT
);

-- -----------------------------------------------
-- PAYMENTS
-- -----------------------------------------------
CREATE TABLE payments (
    payment_id       INT AUTO_INCREMENT PRIMARY KEY,
    challan_id       INT NOT NULL UNIQUE,
    amount_paid      DECIMAL(10,2) NOT NULL,
    payment_date     DATETIME DEFAULT CURRENT_TIMESTAMP,
    payment_method   ENUM('Cash','UPI','Net Banking','Card','Demand Draft') DEFAULT 'Cash',
    transaction_ref  VARCHAR(100),
    received_by      INT,
    remarks          TEXT,
    FOREIGN KEY (challan_id)  REFERENCES challans(challan_id)  ON DELETE CASCADE,
    FOREIGN KEY (received_by) REFERENCES officers(officer_id)  ON DELETE SET NULL
);

-- -----------------------------------------------
-- DISPUTES
-- -----------------------------------------------
CREATE TABLE disputes (
    dispute_id    INT AUTO_INCREMENT PRIMARY KEY,
    challan_id    INT NOT NULL,
    raised_by     VARCHAR(150) NOT NULL,
    reason        TEXT NOT NULL,
    status        ENUM('Open','Under Review','Resolved','Rejected') DEFAULT 'Open',
    resolved_by   INT,
    resolution    TEXT,
    raised_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at   TIMESTAMP NULL,
    FOREIGN KEY (challan_id)  REFERENCES challans(challan_id)  ON DELETE CASCADE,
    FOREIGN KEY (resolved_by) REFERENCES officers(officer_id)  ON DELETE SET NULL
);

-- -----------------------------------------------
-- AUDIT LOG
-- -----------------------------------------------
CREATE TABLE audit_log (
    log_id      INT AUTO_INCREMENT PRIMARY KEY,
    officer_id  INT,
    action      VARCHAR(100) NOT NULL,
    table_name  VARCHAR(100),
    record_id   INT,
    details     TEXT,
    ip_address  VARCHAR(45),
    logged_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (officer_id) REFERENCES officers(officer_id) ON DELETE SET NULL
);

-- ============================================
-- INDEXES for fast lookups
-- ============================================
CREATE INDEX idx_challan_vehicle   ON challans(vehicle_id);
CREATE INDEX idx_challan_officer   ON challans(officer_id);
CREATE INDEX idx_challan_status    ON challans(status);
CREATE INDEX idx_challan_date      ON challans(violation_date);
CREATE INDEX idx_vehicle_reg       ON vehicles(registration_no);
CREATE INDEX idx_owner_license     ON vehicle_owners(license_no);
CREATE INDEX idx_officer_badge     ON officers(badge_number);

-- ============================================
-- VIEWS
-- ============================================

-- Full challan details view
CREATE VIEW v_challan_details AS
SELECT
    c.challan_id,
    c.challan_number,
    c.violation_date,
    c.location,
    c.fine_amount,
    c.status,
    c.due_date,
    c.notes,
    v.registration_no,
    v.vehicle_type,
    v.make,
    v.model,
    v.color,
    vo.full_name  AS owner_name,
    vo.phone      AS owner_phone,
    vo.license_no,
    vt.violation_code,
    vt.description AS violation_desc,
    vt.severity,
    vt.ipc_section,
    o.full_name   AS officer_name,
    o.badge_number,
    z.zone_name,
    z.city,
    p.payment_date,
    p.payment_method,
    p.transaction_ref
FROM challans c
JOIN vehicles       v  ON c.vehicle_id   = v.vehicle_id
JOIN vehicle_owners vo ON v.owner_id     = vo.owner_id
JOIN violation_types vt ON c.violation_id = vt.violation_id
JOIN officers       o  ON c.officer_id   = o.officer_id
LEFT JOIN zones     z  ON c.zone_id      = z.zone_id
LEFT JOIN payments  p  ON c.challan_id   = p.challan_id;

-- Revenue summary per zone
CREATE VIEW v_zone_revenue AS
SELECT
    z.zone_name,
    z.city,
    COUNT(c.challan_id)                              AS total_challans,
    SUM(c.fine_amount)                               AS total_fines,
    SUM(CASE WHEN c.status='Paid' THEN p.amount_paid ELSE 0 END) AS collected,
    SUM(CASE WHEN c.status='Pending' THEN c.fine_amount ELSE 0 END) AS pending
FROM zones z
LEFT JOIN challans c ON z.zone_id = c.zone_id
LEFT JOIN payments p ON c.challan_id = p.challan_id
GROUP BY z.zone_id, z.zone_name, z.city;

-- ============================================
-- STORED PROCEDURES
-- ============================================

DELIMITER $$

-- Generate unique challan number
CREATE PROCEDURE sp_generate_challan_number(OUT challan_num VARCHAR(30))
BEGIN
    DECLARE prefix VARCHAR(10);
    DECLARE seq    INT;
    SET prefix = CONCAT('CHL', DATE_FORMAT(NOW(), '%Y%m'));
    SELECT COUNT(*)+1 INTO seq FROM challans
    WHERE challan_number LIKE CONCAT(prefix,'%');
    SET challan_num = CONCAT(prefix, LPAD(seq, 5, '0'));
END$$

-- Mark challan as paid
CREATE PROCEDURE sp_pay_challan(
    IN  p_challan_id     INT,
    IN  p_amount         DECIMAL(10,2),
    IN  p_method         VARCHAR(50),
    IN  p_txn_ref        VARCHAR(100),
    IN  p_officer_id     INT
)
BEGIN
    DECLARE v_status VARCHAR(20);
    SELECT status INTO v_status FROM challans WHERE challan_id = p_challan_id;
    IF v_status = 'Pending' THEN
        INSERT INTO payments(challan_id, amount_paid, payment_method, transaction_ref, received_by)
        VALUES(p_challan_id, p_amount, p_method, p_txn_ref, p_officer_id);
        UPDATE challans SET status='Paid', updated_at=NOW() WHERE challan_id=p_challan_id;
    ELSE
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Challan is not in Pending state';
    END IF;
END$$

-- Get officer stats
CREATE PROCEDURE sp_officer_stats(IN p_officer_id INT)
BEGIN
    SELECT
        COUNT(*)                                        AS total_challans,
        SUM(fine_amount)                                AS total_fines_issued,
        SUM(CASE WHEN status='Paid' THEN fine_amount ELSE 0 END) AS collected,
        SUM(CASE WHEN status='Pending' THEN fine_amount ELSE 0 END) AS pending,
        COUNT(CASE WHEN status='Disputed' THEN 1 END)   AS disputed
    FROM challans
    WHERE officer_id = p_officer_id;
END$$

DELIMITER ;

-- ============================================
-- TRIGGERS
-- ============================================

DELIMITER $$

-- Auto log on challan insert
CREATE TRIGGER trg_challan_insert
AFTER INSERT ON challans
FOR EACH ROW
BEGIN
    INSERT INTO audit_log(action, table_name, record_id, details)
    VALUES('INSERT', 'challans', NEW.challan_id,
           CONCAT('Challan ', NEW.challan_number, ' issued for vehicle_id=', NEW.vehicle_id));
END$$

-- Auto log on challan status change
CREATE TRIGGER trg_challan_update
AFTER UPDATE ON challans
FOR EACH ROW
BEGIN
    IF OLD.status <> NEW.status THEN
        INSERT INTO audit_log(action, table_name, record_id, details)
        VALUES('STATUS_CHANGE', 'challans', NEW.challan_id,
               CONCAT('Status changed from ', OLD.status, ' to ', NEW.status));
    END IF;
END$$

-- Auto blacklist vehicle if 5+ unpaid challans
CREATE TRIGGER trg_auto_blacklist
AFTER INSERT ON challans
FOR EACH ROW
BEGIN
    DECLARE pending_count INT;
    SELECT COUNT(*) INTO pending_count
    FROM challans
    WHERE vehicle_id = NEW.vehicle_id AND status = 'Pending';
    IF pending_count >= 5 THEN
        UPDATE vehicles SET is_blacklisted = TRUE WHERE vehicle_id = NEW.vehicle_id;
    END IF;
END$$

DELIMITER ;

-- ============================================
-- SEED DATA
-- ============================================

INSERT INTO zones(zone_name, city, state) VALUES
('North Zone','Delhi','Delhi'),
('South Zone','Delhi','Delhi'),
('Central Zone','Mumbai','Maharashtra'),
('East Zone','Kolkata','West Bengal'),
('West Zone','Ahmedabad','Gujarat');

INSERT INTO violation_types(violation_code, description, fine_amount, severity, ipc_section) VALUES
('MV-001','Signal Jumping / Red Light Violation',1000.00,'Moderate','Section 177 MV Act'),
('MV-002','Over Speeding (up to 40km/h above limit)',2000.00,'Major','Section 183 MV Act'),
('MV-003','Drunk Driving (DUI)',10000.00,'Critical','Section 185 MV Act'),
('MV-004','No Helmet (Two-Wheeler)',1000.00,'Minor','Section 129 MV Act'),
('MV-005','No Seat Belt',1000.00,'Minor','Section 194B MV Act'),
('MV-006','Using Mobile Phone While Driving',5000.00,'Moderate','Section 184 MV Act'),
('MV-007','Dangerous / Reckless Driving',5000.00,'Major','Section 184 MV Act'),
('MV-008','Driving Without License',5000.00,'Critical','Section 3/181 MV Act'),
('MV-009','Driving Without Insurance',2000.00,'Major','Section 196 MV Act'),
('MV-010','Wrong Side Driving',5000.00,'Moderate','Section 184 MV Act'),
('MV-011','Illegal Parking',500.00,'Minor','Section 122 MV Act'),
('MV-012','Overloading (Passengers)',200.00,'Minor','Section 194 MV Act'),
('MV-013','No PUC Certificate',10000.00,'Major','Section 190(2) MV Act'),
('MV-014','Triple Riding (Two-Wheeler)',1000.00,'Minor','Section 128 MV Act'),
('MV-015','Overspeeding Heavy Vehicle',4000.00,'Major','Section 183 MV Act');

-- Default admin officer (password: Admin@123 — bcrypt hash placeholder)
INSERT INTO officers(badge_number, full_name, email, password_hash, phone, zone_id, rank) VALUES
('ADMIN001','Admin Officer','admin@traffic.gov.in','$2b$10$placeholderhashvalue12345678901234567890','9999999999',1,'SP');
