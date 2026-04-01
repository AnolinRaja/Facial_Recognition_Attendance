const express = require('express');
const Student = require('../models/Student');
const { markAttendance, csvPath } = require('../utils/csvWriter');
const { sendAttendanceEmail } = require('../utils/mailer'); // ✅ import mailer

const router = express.Router();

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 🔹 Mark attendance
router.post('/mark', async (req, res) => {
  try {
    // Support two modes:
    // 1) Client sends { name } after doing client-side matching with faceapi.FaceMatcher
    // 2) Client sends { embedding } (legacy) and server will match using cosine similarity
    // 3) Client sends { registerNumber } from QR code scan
    const { embedding, name, registerNumber } = req.body;

    if (registerNumber) {
      const student = await Student.findOne({ registerNumber });
      if (!student) return res.status(400).json({ error: 'Student not found' });

      const result = await markAttendance(
        student.name,
        student.department || '',
        student.year || '',
        student.section || '',
        student.rollNumber || '',
        student.registerNumber || '',
        student.role || 'student'
      );
      const message = result.skipped ? 'Already marked today' : 'Attendance marked';

      if (!result.skipped && student.email) {
        await sendAttendanceEmail(student.email, student.name, result.time).catch(err => {
          console.error('Failed to send email:', err.message);
        });
      }

      return res.json({ matched: true, name: student.name, message });
    }

    if (name) {
      const student = await Student.findOne({ name });
      if (!student) return res.status(400).json({ error: 'Student not found' });

      const result = await markAttendance(
        student.name,
        student.department || '',
        student.year || '',
        student.section || '',
        student.rollNumber || '',
        student.registerNumber || '',
        student.role || 'student'
      );
      const message = result.skipped ? 'Already marked today' : 'Attendance marked';

      if (!result.skipped && student.email) {
        await sendAttendanceEmail(student.email, student.name, result.time).catch(err => {
          console.error('Failed to send email:', err.message);
        });
      }

      return res.json({ matched: true, name: student.name, similarity: 1, message });
    }

    if (!embedding || !Array.isArray(embedding))
      return res.status(400).json({ error: 'Missing or invalid embedding' });

    const students = await Student.find({});
    if (!students || students.length === 0)
      return res.status(400).json({ error: 'No registered students' });

    let bestSim = -1;
    let bestStudent = null;
    for (const s of students) {
      if (!s.embedding || s.embedding.length !== embedding.length) continue;
      const sim = cosineSimilarity(embedding, s.embedding);
      if (sim > bestSim) {
        bestSim = sim;
        bestStudent = s;
      }
    }

    const THRESHOLD = 0.75; // legacy threshold; client-side matching should be stricter (~0.6 euclidean)
    if (bestSim >= THRESHOLD && bestStudent) {
      const result = await markAttendance(bestStudent.name);
      const message = result.skipped ? 'Already marked today' : 'Attendance marked';

      if (!result.skipped && bestStudent.email) {
        await sendAttendanceEmail(bestStudent.email, bestStudent.name, result.time).catch(err => {
          console.error('Failed to send email:', err.message);
        });
      }

      return res.json({ matched: true, name: bestStudent.name, similarity: bestSim, message });
    } else {
      return res.json({ matched: false, similarity: bestSim });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 🔹 Provide CSV path
router.get('/csvpath', (req, res) => {
  res.json({ csvPath });
});

module.exports = router;
