/* Static hygiene check: imports that are never used, and module-level functions never called. */
const fs = require('fs');

const files = process.argv.slice(2);
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');

  let bodyStart = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^import\s|^\s*\/\*|^$/.test(lines[i])) { bodyStart = i; break; }
  }
  const body = lines.slice(bodyStart).join('\n');
  const importLines = lines.slice(0, bodyStart).join('\n');

  const names = [...importLines.matchAll(/^import\s*\{([^}]+)\}/gm)]
    .flatMap((m) => m[1].split(',').map((s) => s.trim().split(/\s+as\s+/).pop()).filter(Boolean));

  const word = (n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
  const unused = names.filter((n) => !word(n).test(body));

  const decls = [...body.matchAll(/^(?:async\s+)?function\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  const dead = decls.filter((n) => (word(n).exec(body), [...body.matchAll(word(n))].length < 2));

  const calls = [...body.matchAll(/\b([a-zA-Z_$][\w$]*)\s*\(/g)].map((m) => m[1]);
  const defined = new Set([...decls, ...names, ...calls,
    ...[...body.matchAll(/^const\s+([A-Za-z0-9_]+)\s*=/gm)].map((m) => m[1]),
    ...[...body.matchAll(/^let\s+([A-Za-z0-9_]+)\s*=/gm)].map((m) => m[1])]);
  const builtins = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'new', 'typeof', 'await', 'Math', 'Number', 'String', 'Array', 'Object', 'Set', 'Map', 'JSON', 'Promise', 'Boolean', 'Date', 'setTimeout', 'encodeURIComponent', 'decodeURIComponent', 'parseFloat', 'parseInt', 'isNaN', 'fetch', ' FormData', 'FormData', 'Blob', 'File', 'URL', 'URLSearchParams', 'RegExp', 'Error', 'console', 'document', 'window', 'navigator', 'localStorage', 'matchMedia', 'HashChangeEvent', 'Event', 'CustomEvent', 'Audio', 'structuredClone']);
  const maybeMissing = [...new Set(calls)].filter((c) => !defined.has(c) && !builtins.has(c) && /^[a-z]/.test(c));

  console.log(`\n=== ${f}`);
  console.log(`  imports ${names.length} | unused: ${unused.length ? unused.join(', ') : 'none'}`);
  console.log(`  functions ${decls.length} | uncalled: ${dead.length ? dead.join(', ') : 'none'}`);
  console.log(`  possibly-undefined call targets: ${maybeMissing.length ? maybeMissing.join(', ') : 'none'}`);
}
