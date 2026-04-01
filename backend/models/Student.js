const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  embedding: { type: [Number], required: true }, // 128-length descriptor array
  email: { type: String }, 
  department: { type: String },
  year: { type: String },
  section: { type: String },
  rollNumber: { type: String },
  registerNumber: { type: String },
  // workingTime: store expected working hours for the student
  // Example: { start: '09:00', end: '17:00' }
  workingTime: {
    start: { type: String },
    end: { type: String }
  },
  createdAt: { type: Date, default: Date.now },
   photo: { type: String }, // store image path
  qrCodeData: { type: String },
  role: { type: String, enum: ['student', 'teacher'], default: 'student' }
});

module.exports = mongoose.model('Student', studentSchema);
