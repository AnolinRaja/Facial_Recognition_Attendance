// backend/utils/mailer.js
const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY;

if (!RESEND_API_KEY) {
  console.warn('⚠️  RESEND_API_KEY not configured. Emails will not be sent.');
}

const resend = new Resend(RESEND_API_KEY);

// Test connection on startup
if (RESEND_API_KEY) {
  console.log('🔍 Email config check:');
  console.log('   Service: Resend');
  console.log('   API Key length:', RESEND_API_KEY.length, 'characters');
  console.log('   API Key (masked):', RESEND_API_KEY.substring(0, 5) + '***' + RESEND_API_KEY.substring(RESEND_API_KEY.length - 5));
  console.log('✅ Email transporter (Resend) configured successfully');
} else {
  console.warn('⚠️  RESEND_API_KEY env variable is missing');
}

async function sendAttendanceEmail(to, studentName, timeStr) {
  if (!to) {
    console.warn('⚠️  No email address provided for student:', studentName);
    return false;
  }

  if (!RESEND_API_KEY) {
    console.warn('⚠️  Email not configured; skipping attendance email to:', to);
    return false;
  }

  const html = `
    <p>Hello <b>${studentName}</b>,</p>
    <p>Your attendance has been marked at <b>${timeStr}</b>.</p>
    <p>— Facial Attendance System</p>
  `;
  try {
    const response = await resend.emails.send({
      from: 'Attendance System <onboarding@resend.dev>',
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

  if (!RESEND_API_KEY) {
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
    
    const response = await resend.emails.send({
      from: 'Attendance System <onboarding@resend.dev>',
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
