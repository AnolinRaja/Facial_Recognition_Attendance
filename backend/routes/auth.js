const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();
const SALT_ROUNDS = 10;

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '4h' });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// One-time setup endpoint: create admin from ADMIN_USER / ADMIN_PASS in .env
router.post('/setup-admin', async (req, res) => {
  try {
    const adminUser = process.env.ADMIN_USER;
    const adminPass = process.env.ADMIN_PASS;
    if (!adminUser || !adminPass) return res.status(500).json({ error: 'ADMIN_USER / ADMIN_PASS not set' });

    const exists = await User.findOne({ username: adminUser });
    if (exists) return res.json({ message: 'Admin already exists' });

    const hash = await bcrypt.hash(adminPass, SALT_ROUNDS);
    await User.create({ username: adminUser, passwordHash: hash, role: 'admin' });
    res.json({ message: 'Admin user created' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
