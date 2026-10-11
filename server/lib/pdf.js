/**
 * Agent 1 document parser — real text extraction from uploaded files using
 * only Node built-ins (zlib inflate of PDF content streams).
 *
 * Amounts are cross-validated the way docs/11 §5 requires: if the largest
 * candidate equals the sum of the other line-item candidates the read is
 * self-consistent and confidence is high; a lone unverified figure drops below
 * the 0.90 hard-block threshold so the pipeline suspends instead of guessing.
 */

const zlib = require('zlib');
const crypto = require('crypto');

const AMOUNT_RE = /(?:RM|MYR|S\$|\$|USD|SGD)\s*([\d][\d,]*(?:\.\d{1,2})?)|([\d][\d,]*\.\d{2})\s*(?:RM|MYR)/gi;
const BARE_AMOUNT_RE = /\b(\d{1,3}(?:,\d{3})+|\d+)\.(\d{2})\b/g;
const INVOICE_RE = /\b(?:invoice|inv|bil|tax[\s-]?invoice)\s*(?:no\.?|number|#|:)?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-/]{3,24})/gi;
const DATE_RE = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/g;

function num(s) {
  return Number(String(s).replace(/,/g, ''));
}

/** Pull readable text out of a PDF byte stream. */
function extractPdfText(buf) {
  const raw = buf.toString('latin1');
  const out = [];
  const re = /stream\r?\n?([\s\S]*?)\r?\n?endstream/g;
  let m;
  let streams = 0;
  while ((m = re.exec(raw)) !== null) {
    const chunk = Buffer.from(m[1], 'latin1');
    let decoded = null;
    for (const fn of [() => zlib.inflateSync(chunk), () => zlib.inflateRawSync(chunk), () => zlib.gunzipSync(chunk)]) {
      try { decoded = fn(); break; } catch { /* try next */ }
    }
    if (!decoded) decoded = chunk;
    streams += 1;
    out.push(decodeContentStream(decoded.toString('latin1')));
  }
  // Uncompressed / plain-text PDFs
  if (!streams) out.push(decodeContentStream(raw));
  return out.join('\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function decodeContentStream(s) {
  let text = '';
  const tokenRe = /\((?:\\.|[^\\()])*\)\s*Tj|\[(?:[^\]]*)\]\s*TJ|<[0-9A-Fa-f\s]+>\s*Tj|T\*|TD|Td|ET/g;
  let m;
  while ((m = tokenRe.exec(s)) !== null) {
    const t = m[0];
    if (t === 'T*' || t === 'ET' || /Td$|TD$/.test(t)) { text += '\n'; continue; }
    if (t.startsWith('<')) {
      const hex = t.slice(1, t.indexOf('>')).replace(/\s+/g, '');
      let str = '';
      for (let i = 0; i + 1 < hex.length; i += 2) {
        const code = parseInt(hex.slice(i, i + 2), 16);
        if (code >= 32 && code < 127) str += String.fromCharCode(code);
      }
      text += str;
      continue;
    }
    const parts = t.match(/\((?:\\.|[^\\()])*\)/g) || [];
    for (const part of parts) text += unescapePdfString(part.slice(1, -1));
    text += ' ';
  }
  return text;
}

function unescapePdfString(s) {
  return s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, c) => {
    switch (c) {
      case 'n': return '\n'; case 'r': return '\r'; case 't': return '\t';
      case 'b': return '\b'; case 'f': return '\f';
      case '(': return '('; case ')': return ')'; case '\\': return '\\';
      default: return String.fromCharCode(parseInt(c, 8));
    }
  });
}

function extractPlainText(buf) {
  const s = buf.toString('utf8');
  // Reject if it looks like binary noise
  const printable = (s.slice(0, 4000).match(/[\x20-\x7E\n\r\t]/g) || []).length;
  return printable / Math.min(s.length, 4000) > 0.85 ? s : '';
}

function parse(buf, filename = '') {
  const ext = String(filename).split('.').pop().toLowerCase();
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  let text = '';
  let engine = 'none';

  if (buf.slice(0, 5).toString('latin1') === '%PDF-') { text = extractPdfText(buf); engine = text ? 'pdf-stream-inflate' : 'pdf-no-text-layer'; }
  else if (['txt', 'csv', 'md', 'json', 'log'].includes(ext)) { text = extractPlainText(buf); engine = text ? 'plain-text' : 'binary-rejected'; }
  else { text = extractPlainText(buf); engine = text ? 'plain-text' : 'binary-no-text-layer'; }

  const amounts = [];
  for (const re of [AMOUNT_RE, BARE_AMOUNT_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const v = num(m[1] || `${m[1]}.${m[2]}`);
      if (Number.isFinite(v) && v > 0 && v < 1e9) amounts.push(v);
    }
  }
  const unique = [...new Set(amounts)];
  unique.sort((a, b) => b - a);

  const invoiceNumbers = [];
  INVOICE_RE.lastIndex = 0;
  let im;
  while ((im = INVOICE_RE.exec(text)) !== null) {
    const v = im[1].trim();
    if (v && !invoiceNumbers.includes(v)) invoiceNumbers.push(v);
  }

  const dates = [];
  DATE_RE.lastIndex = 0;
  let dm;
  while ((dm = DATE_RE.exec(text)) !== null) if (!dates.includes(dm[1])) dates.push(dm[1]);

  // Cross-consistency check (docs/11 §5): does the largest figure equal the sum of the rest?
  let parsedAmount = null;
  let confidence = null;
  let basis = 'no_numeric_evidence';
  if (unique.length) {
    const head = unique[0];
    const rest = unique.slice(1);
    const restSum = rest.reduce((a, b) => a + b, 0);
    parsedAmount = head;
    if (rest.length && Math.abs(restSum - head) < 0.01) {
      confidence = 0.99; basis = 'line_items_sum_matches_total';
    } else if (rest.length && Math.abs(restSum - head) / head < 0.005) {
      confidence = 0.96; basis = 'line_items_sum_within_rounding_tolerance';
    } else if (unique.length === 1) {
      confidence = 0.82; basis = 'single_unverified_figure_no_line_item_cross_check';
    } else {
      confidence = 0.74; basis = 'multiple_conflicting_figures_line_items_do_not_sum_to_total';
    }
  }

  return {
    sha256, size_bytes: buf.length, text_length: text.length, parse_engine: engine,
    text_preview: text.slice(0, 1200), amounts_found: unique.slice(0, 20),
    parsed_amount: parsedAmount, amount_confidence: confidence, confidence_basis: basis,
    invoice_numbers: invoiceNumbers.slice(0, 20), dates_found: dates.slice(0, 10),
    scanned_image_only: engine === 'pdf-no-text-layer' || engine === 'binary-no-text-layer'
  };
}

module.exports = { parse, extractPdfText };
