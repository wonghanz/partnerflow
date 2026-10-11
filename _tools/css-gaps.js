'use strict';

/* Reports class tokens the UI emits that no stylesheet rule defines. */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(js|html|css)$/.test(name)) acc.push(p);
  }
  return acc;
}

const files = walk(path.join(ROOT, 'public'));
const cssFiles = files.filter((f) => f.endsWith('.css'));
const sourceFiles = files.filter((f) => !f.endsWith('.css'));

/* Classes a rule defines — ignore the text inside attribute selectors like [class*="x"]. */
const defined = new Set();
for (const f of cssFiles) {
  const css = fs.readFileSync(f, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/"[^"]*"|'[^']*'/g, '""')       /* strings can contain .foo */
    .replace(/\[[^\]]*\]/g, '');              /* attribute selectors match, they don't define */
  for (const m of css.matchAll(/(^|[^.\w-])\.([A-Za-z][\w-]*)/g)) defined.add(m[2]);
  for (const m of css.matchAll(/([A-Za-z0-9_-])\.([A-Za-z][\w-]*)/g)) defined.add(m[2]);   /* compound: .num.ok */
}

/* Tokens the UI emits. Interpolated `class: x ? 'a b' : 'c'` splits cleanly on whitespace. */
const emitted = new Map();
const DYNAMIC = /\$\{|' \+|\+ '|template|\bif\b/;

for (const f of sourceFiles) {
  const text = fs.readFileSync(f, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    const buckets = [];
    for (const m of line.matchAll(/class:\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/g)) buckets.push(m[1] ?? m[2] ?? m[3] ?? '');
    for (const m of line.matchAll(/class="([^"]*)"/g)) buckets.push(m[1]);
    for (const m of line.matchAll(/classList\.(?:add|remove|toggle)\(([^)]*)\)/g)) {
      for (const q of m[1].matchAll(/['"]([^'"]*)['"]/g)) buckets.push(q[1]);   /* ignore the boolean/identifier args */
    }
    for (const raw of buckets) {
      for (const tok of raw.split(/[\s,?::]+/)) {
        if (!/^[a-z][a-z0-9-]*$/.test(tok)) continue;
        if (!emitted.has(tok)) emitted.set(tok, { file: path.relative(ROOT, f), line: i + 1, dynamic: DYNAMIC.test(line) });
      }
    }
  });
}

const missing = [...emitted.entries()].filter(([tok]) => !defined.has(tok));
const staticMissing = missing.filter(([, w]) => !w.dynamic);

console.log(`CSS defines ${defined.size} classes. UI emits ${emitted.size}.`);
if (!staticMissing.length) console.log('OK — every statically-emitted class token has a stylesheet rule.');
for (const [tok, w] of staticMissing) console.log(`  MISSING  ${tok.padEnd(26)} ${w.file}:${w.line}`);
if (missing.length !== staticMissing.length) {
  console.log(`\n${missing.length - staticMissing.length} token(s) sit in dynamically-built class strings and need a human eye:`);
  for (const [tok, w] of missing.filter(([, x]) => x.dynamic)) console.log(`  check    ${tok.padEnd(26)} ${w.file}:${w.line}`);
}
process.exit(staticMissing.length ? 1 : 0);
