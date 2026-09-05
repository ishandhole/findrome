/**
 * Findrome Recruitment Portal - Backend Server
 * Handles form submissions, Excel file generation, and admin portal.
 */

const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const multer = require("multer");
const ExcelJS = require("exceljs");
const sqlite3 = require("sqlite3").verbose();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "findrome_secret_2026";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "findrome2026";

// -------------------------------------------------------------
// 1. Storage & Database Setup
// -------------------------------------------------------------
const dataDir = path.join(__dirname, "data");
const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const dbPath = path.join(dataDir, "submissions.db");
const excelPath = path.join(dataDir, "submissions.xlsx");

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(__dirname));

// Multer storage for SOP PDF uploads
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadsDir),
        filename: (req, file, cb) => {
            const sapId = (req.body.sapId || "user").replace(/\D/g, "");
            const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9.]/g, "_");
            cb(null, `${sapId}_${Date.now()}_${safeName}`);
        }
    }),
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

// SQLite Database Initialization
const db = new sqlite3.Database(dbPath);
db.run(`
    CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submitted_at TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        sap_id TEXT NOT NULL,
        program TEXT NOT NULL,
        branch TEXT NOT NULL,
        year_of_study TEXT NOT NULL,
        position TEXT NOT NULL,
        first_preference TEXT NOT NULL,
        second_preference TEXT NOT NULL,
        third_preference TEXT NOT NULL,
        previous_findrome TEXT NOT NULL,
        referral TEXT,
        sop_filename TEXT,
        sop_original_name TEXT
    )
`);

// -------------------------------------------------------------
// 2. Excel Generation Helpers
// -------------------------------------------------------------
const excelColumns = [
    { header: "ID", key: "id", width: 8 },
    { header: "Date & Time", key: "submitted_at", width: 22 },
    { header: "Full Name", key: "full_name", width: 25 },
    { header: "Email Address", key: "email", width: 28 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "SAP ID", key: "sap_id", width: 16 },
    { header: "Program", key: "program", width: 16 },
    { header: "Branch", key: "branch", width: 26 },
    { header: "Year", key: "year_of_study", width: 10 }
];

// Generate full Excel spreadsheet from SQLite data
function createExcelFromDatabase() {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM submissions ORDER BY id ASC", async (err, rows) => {
            if (err) return reject(err);

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("Event Registrations 2026", {
                views: [{ state: "frozen", xSplit: 0, ySplit: 1 }]
            });

            worksheet.columns = excelColumns;

            // Style header row (Green background with bold white text)
            const headerRow = worksheet.getRow(1);
            headerRow.height = 28;
            headerRow.eachCell(cell => {
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0EAA72" } };
                cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
                cell.alignment = { vertical: "middle", horizontal: "center" };
            });

            // Add rows
            rows.forEach((r, idx) => {
                const row = worksheet.addRow({
                    id: r.id,
                    submitted_at: r.submitted_at,
                    full_name: r.full_name,
                    email: r.email,
                    phone: r.phone,
                    sap_id: r.sap_id,
                    program: r.program,
                    branch: r.branch,
                    year_of_study: r.year_of_study
                });

                row.height = 20;
                const isEven = (idx % 2 === 0);
                row.eachCell(cell => {
                    cell.font = { name: "Arial", size: 10 };
                    cell.alignment = { vertical: "middle", horizontal: "left" };
                    if (isEven) {
                        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7FAF9" } };
                    }
                });
            });

            await workbook.xlsx.writeFile(excelPath);
            resolve(workbook);
        });
    });
}

// -------------------------------------------------------------
// 3. Public Form Submission API
// -------------------------------------------------------------
app.post("/api/submit", upload.single("sop"), (req, res) => {
    const {
        fullName, email, phone, sapId,
        program, branch, yearOfStudy
    } = req.body;

    // Validate required fields
    if (!fullName || !email || !phone || !sapId || !program || !branch || !yearOfStudy) {
        return res.status(400).json({ success: false, message: "Please fill in all required fields." });
    }

    const submittedAt = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short"
    });

    const sopFilename = req.file ? req.file.filename : null;
    const sopOriginalName = req.file ? req.file.originalname : null;

    const sql = `
        INSERT INTO submissions (
            submitted_at, full_name, email, phone, sap_id,
            program, branch, year_of_study, position,
            first_preference, second_preference, third_preference,
            previous_findrome, referral, sop_filename, sop_original_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(sql, [
        submittedAt, fullName.trim(), email.trim().toLowerCase(), phone.trim(), sapId.trim(),
        program, branch.trim(), yearOfStudy, req.body.position ? req.body.position.trim() : "",
        req.body.firstPreference ? req.body.firstPreference.trim() : "",
        req.body.secondPreference ? req.body.secondPreference.trim() : "",
        req.body.thirdPreference ? req.body.thirdPreference.trim() : "",
        req.body.previousFindrome ? req.body.previousFindrome.trim() : "no",
        req.body.referral ? req.body.referral.trim() : "",
        sopFilename, sopOriginalName
    ], async function (err) {
        if (err) {
            console.error("Database insert error:", err.message);
            return res.status(500).json({ success: false, message: "Failed to save submission." });
        }

        // Update Excel file
        await createExcelFromDatabase().catch(console.error);

        res.json({
            success: true,
            message: "Your event registration has been successfully submitted!",
            submissionId: this.lastID
        });
    });
});

// -------------------------------------------------------------
// 4. Admin Security & Management APIs
// -------------------------------------------------------------

// Admin Auth Middleware
function requireAdmin(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = (authHeader && authHeader.startsWith("Bearer "))
        ? authHeader.split(" ")[1]
        : (req.cookies ? req.cookies.adminToken : null);

    if (!token) {
        return res.status(401).json({ success: false, message: "Unauthorized: Admin login required." });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && decoded.role === "admin") return next();
        return res.status(403).json({ success: false, message: "Forbidden: Invalid permissions." });
    } catch (err) {
        return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
    }
}

// Admin Login
app.post("/api/admin/login", (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "24h" });
        res.cookie("adminToken", token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
        return res.json({ success: true, message: "Admin login successful", token });
    }
    return res.status(401).json({ success: false, message: "Incorrect admin password." });
});

// Check Auth Status
app.get("/api/admin/check-auth", requireAdmin, (req, res) => {
    res.json({ success: true });
});

// Admin Logout
app.post("/api/admin/logout", (req, res) => {
    res.clearCookie("adminToken");
    res.json({ success: true });
});

// Get Submissions List (Admin Only)
app.get("/api/admin/submissions", requireAdmin, (req, res) => {
    db.all("SELECT * FROM submissions ORDER BY id DESC", (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: "Database query error." });
        res.json({ success: true, count: rows.length, submissions: rows });
    });
});

// Get Dashboard Statistics (Admin Only)
app.get("/api/admin/stats", requireAdmin, (req, res) => {
    db.all("SELECT COUNT(*) as total FROM submissions", (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: "Database query error." });
        res.json({ success: true, total: rows[0] ? rows[0].total : 0 });
    });
});

// Download Excel File (Admin Only)
app.get("/api/admin/download-excel", requireAdmin, async (req, res) => {
    try {
        await createExcelFromDatabase();
        const downloadName = `Findrome_Event_Registrations_${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.download(excelPath, downloadName);
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to export Excel file." });
    }
});

// View Candidate SOP PDF (Admin Only)
app.get("/api/admin/sop/:filename", requireAdmin, (req, res) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).send("SOP file not found.");
    }
    res.sendFile(filePath);
});

// Clear All Test Entries (Admin Only)
app.post("/api/admin/clear-all", requireAdmin, async (req, res) => {
    try {
        // Clear SQLite database
        db.serialize(() => {
            db.run("DELETE FROM submissions");
            db.run("DELETE FROM sqlite_sequence WHERE name='submissions'");
        });

        // Delete test uploads
        if (fs.existsSync(uploadsDir)) {
            fs.readdirSync(uploadsDir).forEach(file => {
                if (file !== ".gitkeep") {
                    try { fs.unlinkSync(path.join(uploadsDir, file)); } catch (e) {}
                }
            });
        }

        // Reset Excel file
        await createExcelFromDatabase();

        res.json({ success: true, message: "All test entries have been cleared successfully." });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to clear entries: " + err.message });
    }
});

// -------------------------------------------------------------
// 5. Start Server
// -------------------------------------------------------------
createExcelFromDatabase().catch(console.error);

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📋 Form: http://localhost:${PORT}`);
    console.log(`🔒 Admin: http://localhost:${PORT}/admin.html (Password: ${ADMIN_PASSWORD})`);
});
