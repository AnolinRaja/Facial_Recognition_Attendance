const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');

const csvPath = process.env.ATTENDANCE_CSV
  ? path.join(__dirname, '..', process.env.ATTENDANCE_CSV)
  : path.join(__dirname, '..', 'attendance.csv');

function readCSV() {
  if (!fs.existsSync(csvPath)) return [];
  const data = fs.readFileSync(csvPath, 'utf8').trim();
  if (!data) return [];
  const lines = data.split('\n').slice(1); // skip header
  return lines.map(line => {
    const parts = line.split(',');
    const name = parts[0];
    const date = parts[1];
    const time = parts[2];
    const department = parts[3] || '';
    const year = parts[4] || '';
    const section = parts[5] || '';
    const rollNumber = parts[6] || '';
    const registerNumber = parts[7] || '';
    const role = parts[8] || '';
    return { name, date, time, department, year, section, rollNumber, registerNumber, role };
  });
}

async function markAttendance(name, department = '', year = '', section = '', rollNumber = '', registerNumber = '', role = 'student') {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0];

  const dir = path.dirname(csvPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const records = readCSV();
  const alreadyMarked = records.some(r => r.name === name && r.date === date);

  if (alreadyMarked) {
    return { name, date, time, skipped: true };
  }

  const csvWriter = createObjectCsvWriter({
    path: csvPath,
    header: [
      { id: 'name', title: 'Name' },
      { id: 'date', title: 'Date' },
      { id: 'time', title: 'Time' },
      { id: 'department', title: 'Department' },
      { id: 'year', title: 'Year' },
      { id: 'section', title: 'Section' },
      { id: 'rollNumber', title: 'RollNumber' },
      { id: 'registerNumber', title: 'RegisterNumber' },
      { id: 'role', title: 'Role' }
    ],
    append: fs.existsSync(csvPath)
  });

  await csvWriter.writeRecords([{ name, date, time, department, year, section, rollNumber, registerNumber, role }]);
  return { name, date, time, skipped: false };
}

module.exports = { markAttendance, csvPath };
