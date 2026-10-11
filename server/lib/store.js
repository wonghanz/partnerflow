'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

for (const dir of [DATA_DIR, UPLOAD_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const MUTABLE = new Set([
  'submissions.json', 'ledger.json', 'audit-events.json', 'comments.json',
  'tiers.json', 'rules.json', 'brain.json', 'clarifications.json', 'ai-log.json',
  'budget-transactions.json', 'rule-conflicts.json', 'uploads.json', 'setup-wizard.json'
]);

const cache = new Map();

function fileFor(name) {
  return path.join(DATA_DIR, name);
}

const cacheMtime = new Map();

function read(name) {
  const p = fileFor(name);
  if (!fs.existsSync(p)) {
    const empty = name.endsWith('.json') ? (looksLikeArray(name) ? [] : {}) : null;
    return empty;
  }
  try {
    const stat = fs.statSync(p);
    if (cache.has(name) && cacheMtime.get(name) === stat.mtimeMs) {
      return cache.get(name);
    }
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    cache.set(name, data);
    cacheMtime.set(name, stat.mtimeMs);
    return data;
  } catch {
    if (cache.has(name)) return cache.get(name);
    return name.endsWith('.json') ? (looksLikeArray(name) ? [] : {}) : null;
  }
}

function looksLikeArray(name) {
  return [
    'submissions.json', 'audit-events.json', 'comments.json', 'clarifications.json',
    'ai-log.json', 'budget-transactions.json', 'rule-conflicts.json', 'uploads.json'
  ].includes(name);
}

function write(name, data) {
  if (!MUTABLE.has(name)) {
    throw new Error(`Refusing to write immutable seed file: ${name}`);
  }
  cache.set(name, data);
  const p = fileFor(name);
  const tmp = `${p}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  try {
    fs.renameSync(tmp, p);
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES') {
      let ok = false;
      for (let i = 0; i < 6; i++) {
        try {
          const at = Date.now() + 8 * (i + 1);
          while (Date.now() < at) {}
          fs.renameSync(tmp, p);
          ok = true;
          break;
        } catch {}
      }
      if (!ok) {
        fs.copyFileSync(tmp, p);
        try { fs.unlinkSync(tmp); } catch {}
      }
    } else {
      try { fs.unlinkSync(tmp); } catch {}
      throw err;
    }
  }
}

function exists(name) {
  return fs.existsSync(fileFor(name));
}

function invalidate(name) {
  cache.delete(name);
}

function saveUpload(buffer, originalName) {
  const safeBase = String(originalName || 'upload.bin').replace(/[^\w.\-]+/g, '_').slice(-80);
  const id = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
  const stored = `${id}-${safeBase}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, stored), buffer);
  return { stored, id };
}

function readUpload(stored) {
  const p = path.join(UPLOAD_DIR, stored);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p);
}

function removeUpload(stored) {
  const p = path.join(UPLOAD_DIR, stored);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

module.exports = { read, write, exists, invalidate, saveUpload, readUpload, removeUpload, DATA_DIR, UPLOAD_DIR };
