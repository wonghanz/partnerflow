/* Bracket-balance tracer for JS: walks the source with a mode stack so template
   literals (including ${} nesting), strings and comments are skipped correctly.
   Reports the end-of-line depth so an over/under-closed statement can be pinpointed. */
const fs = require('fs');

const file = process.argv[2];
const from = Number(process.argv[3] || 1);
const to = Number(process.argv[4] || 0);

const src = fs.readFileSync(file, 'utf8');
const modes = [];            // 'code' | 'sq' | 'dq' | 'tpl' | 'line' | 'block'
const tplStack = [];         // tracks whether a `}` returns us into a template
let mode = 'code';
let round = 0, curly = 0, square = 0;
let line = 1;
const rows = [];
let lastZero = 1;

for (let i = 0; i < src.length; i += 1) {
  const c = src[i];
  const n = src[i + 1];

  if (c === '\n') {
    if (mode === 'line') mode = 'code';
    rows.push({ line, round, curly, square });
    if (round === 0 && curly === 0 && square === 0) lastZero = line;
    line += 1;
    continue;
  }

  if (mode === 'sq') { if (c === '\\') { i += 1; continue; } if (c === "'") mode = 'code'; continue; }
  if (mode === 'dq') { if (c === '\\') { i += 1; continue; } if (c === '"') mode = 'code'; continue; }
  if (mode === 'line') continue;
  if (mode === 'block') { if (c === '*' && n === '/') { mode = 'code'; i += 1; } continue; }
  if (mode === 'tpl') {
    if (c === '\\') { i += 1; continue; }
    if (c === '`') { mode = 'code'; continue; }
    if (c === '$' && n === '{') { tplStack.push(curly); curly += 1; mode = 'code'; i += 1; continue; }
    continue;
  }

  // code
  if (c === "'" ) { mode = 'sq'; continue; }
  if (c === '"' ) { mode = 'dq'; continue; }
  if (c === '`' ) { mode = 'tpl'; continue; }
  if (c === '/' && n === '/') { mode = 'line'; i += 1; continue; }
  if (c === '/' && n === '*') { mode = 'block'; i += 1; continue; }

  if (c === '(') round += 1;
  else if (c === ')') { round -= 1; if (round < 0) { rows.push({ line, round, curly, square, alert: 'paren below zero' }); round = 0; } }
  else if (c === '{') curly += 1;
  else if (c === '}') {
    curly -= 1;
    if (tplStack.length && curly === tplStack[tplStack.length - 1]) { tplStack.pop(); mode = 'tpl'; }
  } else if (c === '[') square += 1;
  else if (c === ']') square -= 1;
}

const end = rows[rows.length - 1];
console.log(file + '  final: ( ' + end.round + '  { ' + end.curly + '  [ ' + end.square +
  '   last all-zero line: ' + lastZero + ' / ' + rows.length);

const lo = from, hi = to || Math.min(rows.length, from + 20);
for (const r of rows) {
  if (r.line < lo || r.line > hi) continue;
  console.log('  L' + String(r.line).padStart(4) + '   ( ' + String(r.round).padStart(3) +
    '   { ' + String(r.curly).padStart(3) + '   [ ' + String(r.square).padStart(3) +
    (r.alert ? '   << ' + r.alert : '') + '   ' + (src.split(/\r?\n/)[r.line - 1] || '').trim().slice(0, 48));
}
