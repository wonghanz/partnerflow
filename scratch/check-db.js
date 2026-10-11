const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('./server/data/partnerflow.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name));
let count = 0;
for (const t of tables) {
  const rows = db.prepare('SELECT * FROM ' + t.name).all();
  for (const r of rows) {
    const str = JSON.stringify(r);
    const m = str.match(/[\u4e00-\u9fa5]+/g);
    if (m) {
      count += m.length;
      console.log('Match in ' + t.name + ' (' + (r.id || r.submission_id) + '): ' + m.slice(0, 3).join(', '));
    }
  }
}
console.log('Total Chinese words in SQLite:', count);
