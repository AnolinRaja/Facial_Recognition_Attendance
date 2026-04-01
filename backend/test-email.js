// Quick test script to verify Gmail credentials
// Run with: node test-email.js

require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('\n🔍 Gmail Credential Test\n');
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS length:', process.env.EMAIL_PASS?.length, 'characters');
console.log('EMAIL_PASS (visible):', process.env.EMAIL_PASS);

// Show character codes to detect encoding issues
if (process.env.EMAIL_PASS) {
  const pass = process.env.EMAIL_PASS;
  console.log('\n⚠️  Character Analysis:');
  for (let i = Math.max(0, pass.length - 5); i < pass.length; i++) {
    const char = pass[i];
    const code = char.charCodeAt(0);
    console.log(`   Pos ${i}: "${char}" (ASCII: ${code})`);
  }
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

console.log('\n🧪 Testing connection...\n');

transporter.verify((err, success) => {
  if (err) {
    console.error('❌ Connection FAILED');
    console.error('\nError Message:', err.message);
    console.error('Error Code:', err.code);
    console.error('\n💡 SOLUTIONS:');
    console.error('1. Verify 2FA is enabled: https://myaccount.google.com/security');
    console.error('2. Generate new app password: https://myaccount.google.com/apppasswords');
    console.error('3. Make sure EMAIL_PASS has NO spaces and NO quotes');
    console.error('4. Copy the 16-char password directly from Google');
    process.exit(1);
  } else {
    console.log('✅ Connection SUCCESS!');
    console.log('\nYou can now send emails.');
    process.exit(0);
  }
});
