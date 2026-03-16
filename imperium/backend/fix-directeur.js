/**
 * Fix: Add 'directeur' to chatteurs role CHECK constraint
 * and set SACHA as directeur + actif
 */
const { Database } = require('node-sqlite3-wasm');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'imperium.db');

// Clean lock
const lockDir = DB_PATH + '.lock';
try { if (fs.existsSync(lockDir)) fs.rmdirSync(lockDir); } catch {}

// Step 1: Patch schema
const db1 = new Database(DB_PATH);
const schemaRow = db1.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='chatteurs'").get();
console.log('Current CHECK:', schemaRow.sql.match(/CHECK\(role.+?\)/)?.[0]);

if (!schemaRow.sql.includes('directeur')) {
  db1.exec('PRAGMA writable_schema = ON');
  const newSql = schemaRow.sql.replace(
    "CHECK(role IN ('chatteur', 'manager', 'va'))",
    "CHECK(role IN ('chatteur', 'manager', 'va', 'directeur'))"
  );
  const escaped = newSql.replace(/'/g, "''");
  db1.exec("UPDATE sqlite_master SET sql = '" + escaped + "' WHERE type='table' AND name='chatteurs'");
  db1.exec('PRAGMA writable_schema = OFF');
  console.log('Schema patched');
} else {
  console.log('directeur already in CHECK');
}
db1.close();

// Step 2: Reopen DB (schema reloaded) and update SACHA
try { if (fs.existsSync(lockDir)) fs.rmdirSync(lockDir); } catch {}
const db2 = new Database(DB_PATH);

// Verify schema
const check = db2.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='chatteurs'").get();
console.log('Verified CHECK:', check.sql.match(/CHECK\(role.+?\)/)?.[0]);

db2.exec("UPDATE chatteurs SET role = 'directeur', actif = 1 WHERE prenom = 'SACHA'");
const sacha = db2.prepare("SELECT id, prenom, role, actif FROM chatteurs WHERE prenom = 'SACHA'").get();
console.log('SACHA:', sacha);

db2.close();
console.log('Done!');
