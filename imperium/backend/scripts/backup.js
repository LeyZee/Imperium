const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'imperium.db');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const MAX_BACKUPS = 10;

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(BACKUP_DIR, `imperium-${timestamp}.db`);

try {
  fs.copyFileSync(DB_PATH, backupPath);
  console.log(`Backup created: ${backupPath}`);

  // Rotate: keep only last MAX_BACKUPS
  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('imperium-') && f.endsWith('.db'))
    .sort()
    .reverse();

  for (let i = MAX_BACKUPS; i < backups.length; i++) {
    fs.unlinkSync(path.join(BACKUP_DIR, backups[i]));
    console.log(`Deleted old backup: ${backups[i]}`);
  }
} catch (err) {
  console.error('Backup failed:', err.message);
  process.exit(1);
}
