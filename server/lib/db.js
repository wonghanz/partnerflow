'use strict';
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'partnerflow.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let db = null;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
  }
  return db;
}

function initSchema() {
  const d = getDb();
  d.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      submission_id TEXT PRIMARY KEY,
      run_id TEXT,
      submission_type TEXT,
      state TEXT,
      partner_id TEXT,
      partner_name TEXT,
      partner_tier TEXT,
      title TEXT,
      activity_type TEXT,
      activity_date TEXT,
      submitted_at TEXT,
      updated_at TEXT,
      amount REAL,
      approved_amount REAL,
      currency TEXT,
      programme TEXT,
      parent_pre_approval_id TEXT,
      contact_name TEXT,
      contact_email TEXT,
      notes TEXT,
      amount_confidence REAL,
      attachments_count INTEGER,
      open_questions INTEGER DEFAULT 0,
      raw_json TEXT
    );

    CREATE TABLE IF NOT EXISTS comments (
      comment_id TEXT PRIMARY KEY,
      submission_id TEXT,
      author TEXT,
      author_role TEXT,
      text TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS budget_ledger (
      partner_id TEXT PRIMARY KEY,
      fiscal_year INTEGER,
      allocated_amount REAL,
      committed_amount REAL,
      approved_amount REAL,
      paid_amount REAL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS budget_transactions (
      tx_id TEXT PRIMARY KEY,
      submission_id TEXT,
      partner_id TEXT,
      tx_type TEXT,
      amount REAL,
      currency TEXT,
      created_at TEXT,
      idempotency_key TEXT,
      details_json TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      event_id TEXT PRIMARY KEY,
      submission_id TEXT,
      run_id TEXT,
      actor TEXT,
      actor_type TEXT,
      previous_state TEXT,
      new_state TEXT,
      error_code TEXT,
      rule_id TEXT,
      created_at TEXT,
      details_json TEXT
    );

    CREATE TABLE IF NOT EXISTS programme_rules (
      rule_id TEXT PRIMARY KEY,
      code TEXT,
      name TEXT,
      category TEXT,
      severity TEXT,
      status TEXT,
      raw_json TEXT
    );
  `);
}

function syncFromJson() {
  const d = getDb();
  // 1. Submissions
  const subsFile = path.join(DATA_DIR, 'submissions.json');
  if (fs.existsSync(subsFile)) {
    try {
      const subs = JSON.parse(fs.readFileSync(subsFile, 'utf8'));
      if (Array.isArray(subs)) {
        d.exec('DELETE FROM submissions;');
        const stmt = d.prepare(`
          INSERT INTO submissions (
            submission_id, run_id, submission_type, state, partner_id, partner_name,
            partner_tier, title, activity_type, activity_date, submitted_at, updated_at,
            amount, approved_amount, currency, programme, parent_pre_approval_id,
            contact_name, contact_email, notes, amount_confidence, attachments_count, open_questions, raw_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const s of subs) {
          stmt.run(
            s.submission_id,
            s.run_id || null,
            s.submission_type || 'CLAIM',
            s.state || 'SUBMITTED',
            s.partner_id || '',
            s.partner_name || '',
            s.partner_tier || '',
            s.title || '',
            s.activity_type || '',
            s.activity_date || '',
            s.submitted_at || new Date().toISOString(),
            s.updated_at || new Date().toISOString(),
            Number(s.amount) || 0,
            s.approved_amount !== undefined && s.approved_amount !== null ? Number(s.approved_amount) : null,
            s.currency || 'MYR',
            s.programme || '',
            s.parent_pre_approval_id || null,
            s.contact_name || '',
            s.contact_email || '',
            s.notes || '',
            Number(s.amount_confidence) || null,
            Number(s.attachments_count) || (s.extracted_evidence ? s.extracted_evidence.length : 0),
            Number(s.open_questions) || (s.agent_evaluations?.rule_evaluations?.filter(r => r.requires_clarification)?.length || 0),
            JSON.stringify(s)
          );
        }
      }
    } catch (err) {
      console.error('Error syncing submissions from JSON:', err);
    }
  }

  // 2. Comments
  const cmtFile = path.join(DATA_DIR, 'comments.json');
  if (fs.existsSync(cmtFile)) {
    try {
      const cmts = JSON.parse(fs.readFileSync(cmtFile, 'utf8'));
      if (Array.isArray(cmts)) {
        d.exec('DELETE FROM comments;');
        const stmt = d.prepare(`
          INSERT INTO comments (comment_id, submission_id, author, author_role, text, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const c of cmts) {
          stmt.run(
            c.comment_id,
            c.submission_id,
            typeof c.author === 'object' ? (c.author?.name || JSON.stringify(c.author)) : String(c.author || 'Reviewer'),
            c.author_role || 'HUMAN',
            typeof c.text === 'object' ? (c.text?.text || JSON.stringify(c.text)) : String(c.text || ''),
            c.created_at || new Date().toISOString()
          );
        }
      }
    } catch (err) {
      console.error('Error syncing comments from JSON:', err);
    }
  }

  // 3. Ledger
  const ledgerFile = path.join(DATA_DIR, 'ledger.json');
  if (fs.existsSync(ledgerFile)) {
    try {
      const led = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
      if (led && Array.isArray(led.rows)) {
        d.exec('DELETE FROM budget_ledger;');
        const stmt = d.prepare(`
          INSERT INTO budget_ledger (partner_id, fiscal_year, allocated_amount, committed_amount, approved_amount, paid_amount, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const r of led.rows) {
          stmt.run(
            r.partner_id,
            r.fiscal_year || 2026,
            Number(r.allocated_amount) || 0,
            Number(r.committed_amount) || 0,
            Number(r.approved_amount) || 0,
            Number(r.paid_amount) || 0,
            r.updated_at || new Date().toISOString()
          );
        }
      }
    } catch (err) {
      console.error('Error syncing ledger from JSON:', err);
    }
  }

  // 4. Audit events
  const auditFile = path.join(DATA_DIR, 'audit-events.json');
  if (fs.existsSync(auditFile)) {
    try {
      const evs = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
      if (Array.isArray(evs)) {
        d.exec('DELETE FROM audit_events;');
        const stmt = d.prepare(`
          INSERT INTO audit_events (
            event_id, submission_id, run_id, actor, actor_type, previous_state,
            new_state, error_code, rule_id, created_at, details_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const e of evs) {
          stmt.run(
            e.event_id,
            e.submission_id || null,
            e.run_id || null,
            e.actor || 'system',
            e.actor_type || 'SYSTEM',
            e.previous_state || null,
            e.new_state || null,
            e.error_code || null,
            e.rule_id || null,
            e.created_at || new Date().toISOString(),
            JSON.stringify(e.details || {})
          );
        }
      }
    } catch (err) {
      console.error('Error syncing audit events from JSON:', err);
    }
  }
}

function syncToJson() {
  const d = getDb();
  // 1. Dump submissions to submissions.json
  const subsRows = d.prepare('SELECT * FROM submissions ORDER BY submitted_at DESC;').all();
  const subsList = subsRows.map((r) => {
    let full = {};
    if (r.raw_json) {
      try { full = JSON.parse(r.raw_json); } catch {}
    }
    // Update base columns from SQL in case they were modified via SQL
    full.submission_id = r.submission_id;
    full.run_id = r.run_id;
    full.submission_type = r.submission_type;
    full.state = r.state;
    full.partner_id = r.partner_id;
    full.partner_name = r.partner_name;
    full.partner_tier = r.partner_tier;
    full.title = r.title;
    full.activity_type = r.activity_type;
    full.activity_date = r.activity_date;
    full.submitted_at = r.submitted_at;
    full.updated_at = r.updated_at;
    full.amount = r.amount;
    full.approved_amount = r.approved_amount;
    full.currency = r.currency;
    full.programme = r.programme;
    full.parent_pre_approval_id = r.parent_pre_approval_id;
    full.contact_name = r.contact_name;
    full.contact_email = r.contact_email;
    full.notes = r.notes;
    full.amount_confidence = r.amount_confidence;
    full.attachments_count = r.attachments_count;
    full.open_questions = r.open_questions;
    return full;
  });
  fs.writeFileSync(path.join(DATA_DIR, 'submissions.json'), JSON.stringify(subsList, null, 2), 'utf8');

  // 2. Dump comments to comments.json
  const cmtRows = d.prepare('SELECT * FROM comments ORDER BY created_at ASC;').all();
  fs.writeFileSync(path.join(DATA_DIR, 'comments.json'), JSON.stringify(cmtRows, null, 2), 'utf8');

  // 3. Dump ledger
  const ledRows = d.prepare('SELECT * FROM budget_ledger;').all();
  const ledgerFile = path.join(DATA_DIR, 'ledger.json');
  let currentLedger = { fiscal_year: 2026, currency: 'MYR', company_totals: {}, rows: [] };
  if (fs.existsSync(ledgerFile)) {
    try { currentLedger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')); } catch {}
  }
  currentLedger.rows = ledRows;
  // Compute totals
  let allocated = 0, committed = 0, approved = 0, paid = 0;
  for (const r of ledRows) {
    allocated += Number(r.allocated_amount) || 0;
    committed += Number(r.committed_amount) || 0;
    approved += Number(r.approved_amount) || 0;
    paid += Number(r.paid_amount) || 0;
  }
  currentLedger.company_totals = {
    allocated,
    committed,
    approved,
    paid,
    available: allocated - (committed + approved + paid)
  };
  fs.writeFileSync(ledgerFile, JSON.stringify(currentLedger, null, 2), 'utf8');

  try {
    const store = require('./store');
    if (store && store.invalidate) {
      store.invalidate('submissions.json');
      store.invalidate('comments.json');
      store.invalidate('ledger.json');
      store.invalidate('audit-events.json');
    }
  } catch {}

  return { ok: true, submissions_count: subsList.length, comments_count: cmtRows.length };
}

function execute(sql) {
  const d = getDb();
  d.exec(sql);
  // Synchronize changes to JSON immediately so web UI is in sync
  syncToJson();
  return { ok: true };
}

function query(sql) {
  const d = getDb();
  const stmt = d.prepare(sql);
  return stmt.all();
}

module.exports = {
  getDb,
  initSchema,
  syncFromJson,
  syncToJson,
  execute,
  query,
  DB_PATH
};
