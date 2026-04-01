// backend/utils/mailer.js
const nodemailer = require('nodemailer');

// Check if EMAIL credentials are configured
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn('⚠️  EMAIL_USER or EMAIL_PASS not configured. Emails will not be sent.');
}

// Remove quotes from password if present (sometimes added by env parsers)
const emailPass = (process.env.EMAIL_PASS || '').replace(/"/g, '').trim();
const emailUser = (process.env.EMAIL_USER || '').trim();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: emailUser,
    pass: emailPass
  }
});

// Test connection on startup
if (emailUser && emailPass) {
  console.log('🔍 Email config check:');
  console.log('   User:', emailUser);
  console.log('   Pass length:', emailPass.length, 'characters');
  console.log('   Pass (masked):', emailPass.substring(0, 3) + '***' + emailPass.substring(emailPass.length - 3));
  
  transporter.verify((err, success) => {
    if (err) {
      console.error('❌ Email transporter verification FAILED');
      console.error('   Error details:', err.message);
      console.error('   Error code:', err.code);
      console.error('\n💡 TROUBLESHOOTING:');
      console.error('   1. Verify EMAIL_USER in .env is your full Gmail address (e.g., user@gmail.com)');
      console.error('   2. Verify EMAIL_PASS is a Gmail APP PASSWORD (not your regular password)');
      console.error('   3. App passwords require 2FA enabled: https://myaccount.google.com/security');
      console.error('   4. To generate new app password: https://myaccount.google.com/apppasswords');
      console.error('   5. Select "Mail" and "Windows Computer", copy the 16-character password exactly');
    } else if (success) {
      console.log('✅ Email transporter connected successfully');
    }
  });
} else {
  console.warn('⚠️  EMAIL_USER and/or EMAIL_PASS env variables are missing or empty');
}

async function sendAttendanceEmail(to, studentName, timeStr) {
  if (!to) {
    console.warn('⚠️  No email address provided for student:', studentName);
    return false;
  }

  if (!process.env.EMAIL_USER || !emailPass) {
    console.warn('⚠️  Email not configured; skipping attendance email to:', to);
    return false;
  }

  const html = `
    <p>Hello <b>${studentName}</b>,</p>
    <p>Your attendance has been marked at <b>${timeStr}</b>.</p>
    <p>— Attendance System</p>
  `;
  try {
    const info = await transporter.sendMail({
      from: `"Attendance System" <${process.env.EMAIL_USER}>`,
      to,
      subject: 'Attendance marked',
      html
    });
    console.log('📧 Attendance email sent:', info.messageId, 'to', to, '(', studentName, ')');
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

  if (!process.env.EMAIL_USER || !emailPass) {
    console.warn('⚠️  Email not configured; skipping QR code email to:', to);
    return false;
  }

  const html = `
    <p>Hello <b>${studentName}</b>,</p>
    <p>Your registration is complete. Please find your QR code attached.</p>
    <p>— Attendance System</p>
  `;
  try {
    const info = await transporter.sendMail({
      from: `"Attendance System" <${process.env.EMAIL_USER}>`,
      to,
      subject: 'QR Code for Attendance',
      html,
      attachments: [
        {
          filename: 'qrcode.png',
          content: qrCodeData.split("base64,")[1],
          encoding: 'base64'
        }
      ]
    });
    console.log('📧 QR Code email sent:', info.messageId, 'to', to, '(', studentName, ')');
    return true;
  } catch (err) {
    console.error('❌ QR Code email error for', to, ':', err.message);
    return false;
  }
}

module.exports = { sendAttendanceEmail, sendQrCodeEmail };
