require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const attendanceRoutes = require('./routes/attendance');

const app = express();

// Configure CORS to allow all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '20mb' }));

// ✅ Serve uploaded student photos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure required folders exist (uploads for student photos, qrcodes for generated QR images)
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
const qrcodesDir = process.env.QRCODES_DIR || path.join(__dirname, 'qrcodes');

const ensureDirs = [uploadsDir, path.join(uploadsDir, 'students'), qrcodesDir];
for (const d of ensureDirs) {
  if (!fs.existsSync(d)) {
    try {
      fs.mkdirSync(d, { recursive: true });
      console.log('✅ Created directory:', d);
    } catch (err) {
      console.warn('⚠️  Could not create directory', d, err.message || err);
      process.exit(1);
    }
  }
}

// --- Simple PID lock-file guard to avoid double-starts ---
const lockFile = path.join(__dirname, 'server.lock');
try {
  if (fs.existsSync(lockFile)) {
    const otherPid = parseInt(fs.readFileSync(lockFile, 'utf8'), 10);
    if (!Number.isNaN(otherPid)) {
      try {
        process.kill(otherPid, 0); // check if process exists
        console.error(`Another server appears to be running (PID=${otherPid}). Aborting to avoid double-start.`);
        process.exit(1);
      } catch (err) {
        console.warn('Stale lock file found, previous process not running. Overwriting lock.');
      }
    }
  }
  fs.writeFileSync(lockFile, String(process.pid), { encoding: 'utf8' });
  const removeLock = () => {
    try { if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile); } catch (e) { }
  };
  process.on('exit', removeLock);
  process.on('SIGINT', () => { removeLock(); process.exit(0); });
  process.on('SIGTERM', () => { removeLock(); process.exit(0); });
} catch (err) {
  console.warn('Could not create or manage server lock file:', err.message || err);
}

const { MONGO_USER, MONGO_PASS, MONGO_CLUSTER, MONGO_DB, MONGO_URI, PORT = 5000 } = process.env;

// Support multiple connection options so local development works out-of-the-box:
// 1) If MONGO_URI is provided, use it (recommended).
// 2) If MONGO_USER / MONGO_PASS / MONGO_CLUSTER / MONGO_DB are provided, construct Atlas SRV URI.
// 3) Otherwise fall back to a local mongodb instance at mongodb://127.0.0.1:27017/<db>.

let uri = null;
if (MONGO_URI) {
  uri = MONGO_URI;
} else if (MONGO_USER && MONGO_PASS && MONGO_CLUSTER && MONGO_DB) {
  uri = `mongodb+srv://${encodeURIComponent(MONGO_USER)}:${encodeURIComponent(MONGO_PASS)}@${MONGO_CLUSTER}.mongodb.net/${MONGO_DB}?retryWrites=true&w=majority`;
} else {
  const localDb = MONGO_DB || 'facial-attendance';
  uri = `mongodb://127.0.0.1:27017/${localDb}`;
  console.warn('No MongoDB Atlas credentials found; falling back to local MongoDB:', uri);
}

async function connectWithFallback(primaryUri) {
  try {
    await mongoose.connect(primaryUri);
    console.log('✅ Connected to MongoDB');
    return;
  } catch (err) {
    console.error('MongoDB connection error', err);
    // If SRV DNS lookup failed for Atlas, try a local fallback automatically
    if ((err.code === 'ENOTFOUND' || (err.message && err.message.includes('querySrv ENOTFOUND'))) && !primaryUri.startsWith('mongodb://127.0.0.1')) {
      const fallback = `mongodb://127.0.0.1:27017/${MONGO_DB || 'facial-attendance'}`;
      console.warn('Atlas SRV lookup failed; attempting local MongoDB at', fallback);
      try {
        await mongoose.connect(fallback);
        console.log('✅ Connected to local MongoDB fallback');
        return;
      } catch (innerErr) {
        console.error('Local MongoDB fallback failed', innerErr);
      }
    }
  }
}

connectWithFallback(uri);

// 🔹 Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);

// Health endpoint for uptime checks
app.get('/health', (req, res) => {
  const state = mongoose.connection && mongoose.connection.readyState;
  const dbStatus = state === 1 ? 'connected' : (state === 2 ? 'connecting' : 'disconnected');
  res.json({ ok: true, pid: process.pid, db: dbStatus });
});

app.get('/', (req, res) => res.send('Facial Attendance Backend is running'));

// 🔹 Attendance CSV download
const { csvPath } = require('./utils/csvWriter');
app.get('/attendance.csv', (req, res) => {
  if (!csvPath) return res.status(404).send('Not found');
  const absPath = path.resolve(csvPath);
  res.download(absPath, 'attendance.csv', err => {
    if (err) {
      console.error('CSV download error', err);
      res.status(500).send('Error downloading CSV');
    }
  });
});

app.listen(PORT, () => console.log(` Server listening on port ${PORT}. Trying to connect to MongoDB...`));
