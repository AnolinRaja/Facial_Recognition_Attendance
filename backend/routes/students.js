const express = require("express");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Student = require("../models/Student");
const QRCode = require("qrcode");
const { sendQrCodeEmail } = require("../utils/mailer");

const router = express.Router();

// 🔹 Admin Auth Middleware
function adminAuth(req, res, next) {
  const header = req.headers["authorization"];
  if (!header) return res.status(401).json({ error: "No token" });

  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({ error: "Malformed authorization header" });
  }

  const token = parts[1];
  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin")
      return res.status(403).json({ error: "Forbidden" });
    req.user = decoded; // ✅ so we know who is making the request
    next();
  } catch (err) {
    console.error('JWT verification error:', err.message);
    return res.status(401).json({ error: "Invalid token", details: err.message });
  }
}

// 🔹 Multer storage config (to save student photos)
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads', 'students');
const qrcodesDir = process.env.QRCODES_DIR || path.join(__dirname, '..', 'qrcodes');

// Ensure directories exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(qrcodesDir)) {
  fs.mkdirSync(qrcodesDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // unique name
  },
});

const upload = multer({ storage });

/**
 * 🔹 Register student with:
 *  - Name
 *  - Email
 *  - Face embedding
 *  - Photo (saved in uploads/students/)
 */
router.post("/register", adminAuth, upload.single("photo"), async (req, res) => {
  try {
    const { name, email, embedding, workingStart, workingEnd, department, year, section, rollNumber, registerNumber, role } = req.body;

    if (!name || !email || !embedding) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // Parse embedding (sent as JSON string from frontend)
    // Handle embedding (can be array OR JSON string)
let parsedEmbedding = embedding;

if (typeof embedding === "string") {
  try {
    parsedEmbedding = JSON.parse(embedding);
  } catch (err) {
    return res.status(400).json({ error: "Invalid embedding JSON" });
  }
}

if (!Array.isArray(parsedEmbedding)) {
  return res.status(400).json({ error: "Embedding must be an array" });
}


    // Check duplicate student
    const existing = await Student.findOne({ name });
    if (existing) return res.status(400).json({ error: "Student exists" });

    // Save photo path if uploaded
    const photoPath = req.file
      ? `/uploads/students/${req.file.filename}`
      : null;

    const student = await Student.create({
      name,
      email, // ✅ now stored in DB
      department: department || null,
      year: year || null,
      section: section || null,
      rollNumber: rollNumber || null,
      registerNumber: registerNumber || null,
      embedding: parsedEmbedding,
      photo: photoPath,
      workingTime: {
        start: workingStart || null,
        end: workingEnd || null,
      },
      role: role || 'student',
    });

    if (student && student.registerNumber) {
      console.log("Generating QR code for register number:", student.registerNumber);
      const qrCodeData = await QRCode.toDataURL(student.registerNumber);
      console.log("Generated QR code data URL:", qrCodeData.substring(0, 50) + "...");
      student.qrCodeData = qrCodeData;
      await student.save();
      console.log("Student saved with QR code.");

      // Save QR code to file
      const sanitizedName = student.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const qrCodePath = path.join(qrcodesDir, `${sanitizedName}.png`);
      const base64Data = qrCodeData.replace(/^data:image\/png;base64,/, "");
      try {
        fs.writeFileSync(qrCodePath, base64Data, 'base64');
        console.log("QR code saved to file:", qrCodePath);
        sendQrCodeEmail(student.email, student.name, qrCodeData);
      } catch (err) {
        console.error("Error saving QR code:", err);
      }
    }

    res.json({
      message: "Registered",
      id: student._id,
      name: student.name,
      email: student.email,
      photo: student.photo,
      role: student.role,
      qrCodeData: student.qrCodeData,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 List students (with name, email, photo & createdAt)
router.get("/", adminAuth, async (req, res) => {
  const students = await Student.find(
    {},
    { name: 1, email: 1, photo: 1, createdAt: 1, workingTime: 1, department: 1, year: 1, section: 1, rollNumber: 1, registerNumber: 1, role: 1 }
  );
  res.json(students);
});

// Public endpoint to fetch labeled embeddings for client-side matching
router.get('/public', async (req, res) => {
  try {
  const students = await Student.find({}, { name: 1, embedding: 1, photo: 1, department: 1, year: 1, section: 1, rollNumber: 1, registerNumber: 1, role: 1 });
  // return minimal data
    // Some older/other code paths may have stored `embeddings` (array of arrays)
    // or `embedding` (single array). Normalize both to make the client robust.
    const out = students.map(s => {
      const doc = s.toObject ? s.toObject() : s;
      const embeddingsField = doc.embeddings || (doc.embedding ? (Array.isArray(doc.embedding[0]) ? doc.embedding : [doc.embedding]) : []);
      // choose a primary embedding (first) for single-descriptor clients
      const primary = (embeddingsField && embeddingsField.length) ? embeddingsField[0] : (doc.embedding || []);
      return {
        name: doc.name,
        embedding: primary || [],
        embeddings: embeddingsField || [],
        photo: doc.photo,
        department: doc.department,
        year: doc.year,
        section: doc.section,
        rollNumber: doc.rollNumber,
        registerNumber: doc.registerNumber,
        role: doc.role
      };
    });
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
