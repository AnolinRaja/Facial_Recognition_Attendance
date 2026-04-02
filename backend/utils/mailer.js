// backend/utils/mailer.js
const nodemailer = require('nodemailer');

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

let transporter = null;

if (!EMAIL_USER || !EMAIL_PASS) {
  console.warn('⚠️  EMAIL_USER or EMAIL_PASS not configured. Emails will not be sent.');
} else {
  try {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });
    console.log('🔍 Email config check:');
    console.log('   Service: Gmail');
    console.log('   Email User:', EMAIL_USER);
    console.log('✅ Email transporter (Gmail) configured successfully');
  } catch (err) {
    console.error('❌ Failed to initialize Gmail transporter:', err.message);
    transporter = null;
  }
}

async function sendAttendanceEmail(to, studentName, timeStr) {
  if (!to) {
    console.warn('⚠️  No email address provided for student:', studentName);
    return false;
  }

  if (!transporter) {
    console.warn('⚠️  Email not configured; skipping attendance email to:', to);
    return false;
  }

  const html = `
    <p>Hello <b>${studentName}</b>,</p>
    <p>Your attendance has been marked at <b>${timeStr}</b>.</p>
    <p>— Facial Attendance System</p>
  `;
  
  try {
    const response = await transporter.sendMail({
      from: EMAIL_USER,
      to,
      subject: 'Attendance marked',
      html
    });
    console.log('📧 Attendance email sent to', to, '(', studentName, ')');
    return true;
  } catch (err) {
    console.error('❌ Attendance email error for', to, ':', err.message);
    return false;
  }
}

async function sendQrCodeEmail(to, studentName, qrCodeData) {
  if (!to) {
    console.warn('⚠️  No email address provided for student:', studentName);
    return false;
  }

  if (!transporter) {
    console.warn('⚠️  Email not configured; skipping QR code email to:', to);
    return false;
  }

  const html = `
    <p>Hello <b>${studentName}</b>,</p>
    <p>Your registration is complete. Please find your QR code attached below.</p>
    <p>— Facial Attendance System</p>
  `;
  
  try {
    const base64Data = qrCodeData.split("base64,")[1];
    
    const response = await transporter.sendMail({
      from: EMAIL_USER,
      to,
      subject: 'QR Code for Attendance',
      html,
      attachments: [
        {
          filename: 'qrcode.png',
          content: Buffer.from(base64Data, 'base64')
        }
      ]
    });
    console.log('📧 QR Code email sent to', to, '(', studentName, ')');
    return true;
  } catch (err) {
    console.error('❌ QR Code email error for', to, ':', err.message);
    return false;
  }
}

module.exports = { sendAttendanceEmail, sendQrCodeEmail };
