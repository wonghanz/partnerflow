/* ESM syntax check for every browser module under public/js.
   `node --check path.js` parses as CommonJS here (package.json sets type commonjs),
   so it silently misses errors in `import`-using files. Feed the source to stdin
   with --input-type=module instead. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const root = path.join(__dirname, '..', 'public', 'js');
const files = walk(root);
let bad = 0;

for (const f of files) {
  try {
    execFileSync(process.execPath, ['--input-type=module', '--check'], {
      input: fs.readFileSync(f), stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (err) {
    bad += 1;
    const msg = (err.stderr || Buffer.alloc(0)).toString().replace(/\[stdin\]/g, f);
    console.log(`FAIL ${path.relative(root, f)}\n${msg.split('\n').slice(0, 4).join('\n')}\n`);
  }
}
console.log(bad ? `${bad} / ${files.length} module(s) failed ESM parse` : `OK — all ${files.length} browser modules parse as ESM`);
process.exit(bad ? 1 : 0);
