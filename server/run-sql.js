'use strict';
const db = require('./lib/db');

const sql = process.argv.slice(2).join(' ').trim();

if (!sql) {
  console.log(`
======================================================
 PartnerFlow SQLite Database CLI (server/data/partnerflow.db)
======================================================
Usage:
  node server/run-sql.js "<SQL STATEMENT>"

Examples:
  # View all submissions:
  node server/run-sql.js "SELECT submission_id, state, partner_name, amount FROM submissions;"

  # View all comments:
  node server/run-sql.js "SELECT comment_id, submission_id, author, text FROM comments;"

  # Edit a record (UPDATE):
  node server/run-sql.js "UPDATE submissions SET state = 'APPROVED', approved_amount = 18750 WHERE submission_id = 'SUB-2026-MY-0002';"

  # Delete a record (DELETE):
  node server/run-sql.js "DELETE FROM submissions WHERE submission_id = 'SUB-2026-MY-0005';"

  # Sync JSON to SQLite:
  node server/run-sql.js "--sync-from-json"
======================================================
`);

  const d = db.getDb();
  console.log('Current Database Status:');
  const tables = ['submissions', 'comments', 'budget_ledger', 'audit_events'];
  for (const t of tables) {
    try {
      const count = d.prepare(`SELECT COUNT(*) as cnt FROM ${t};`).get()?.cnt;
      console.log(`  - Table [${t}]: ${count} records`);
    } catch (e) {
      console.log(`  - Table [${t}]: (error: ${e.message})`);
    }
  }
  process.exit(0);
}

if (sql === '--sync-from-json') {
  console.log('Syncing SQLite tables from JSON files...');
  db.syncFromJson();
  console.log('Sync complete.');
  process.exit(0);
}

if (sql === '--sync-to-json') {
  console.log('Syncing SQLite tables to JSON files...');
  db.syncToJson();
  console.log('Sync complete.');
  process.exit(0);
}

try {
  const isSelect = /^\s*SELECT/i.test(sql);
  if (isSelect) {
    const rows = db.query(sql);
    console.log(`\nResults (${rows.length} rows):`);
    console.table(rows);
  } else {
    db.execute(sql);
    console.log('\n[SUCCESS] Executed statement successfully:');
    console.log(sql);
    console.log('[SYNC] Database changes synchronized to JSON stores.\n');
  }
} catch (err) {
  console.error('\n[SQL ERROR]:', err.message);
  process.exit(1);
}
