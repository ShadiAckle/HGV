import fs from 'fs';
import path from 'path';

const roots = ['data', 'server', 'client', 'shared', 'scripts', 'tests'];
const exts = new Set(['.sql', '.ts', '.tsx']);
const skip = /node_modules|dist|\.databricks|compPeriods\.ts|migrate-periods-2026/;

const reps = [
  ['2025-Q1', '2026-Q2'],
  ['2024-Q4', '2025-Q4'],
  ['Q1 2025', 'Q2 2026'],
  ['Q4 2024', 'Q4 2025'],
  ["DATE '2025-01-01'", "DATE '2026-04-01'"],
  ["DATE '2025-03-31'", "DATE '2026-06-30'"],
  ["DATE '2024-10-01'", "DATE '2025-10-01'"],
  ["DATE '2024-12-31'", "DATE '2025-12-31'"],
  ["DATE '2025-02-10'", "DATE '2026-05-10'"],
  ["DATE '2025-02-15'", "DATE '2026-05-15'"],
  ["DATE '2025-02-12'", "DATE '2026-05-12'"],
  ["'2025-05-24", "'2026-05-24"],
  ["'2025-05-25", "'2026-05-25"],
  ['2025-02-15', '2026-05-15'],
  ['2025-01-01', '2026-04-01'],
  ['PLAN-FT-2025', 'PLAN-FT-2026'],
  ['PLAN-2025-V1', 'PLAN-2026-V1'],
  ['PLAN-MKT-REP-2025', 'PLAN-MKT-REP-2026'],
  ['Ocean Breeze Q1 SPIFF', 'Ocean Breeze Q2 SPIFF'],
];

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (skip.test(p)) continue;
    if (ent.isDirectory()) walk(p, out);
    else if (exts.has(path.extname(ent.name))) out.push(p);
  }
  return out;
}

let changed = 0;
for (const root of roots) {
  const full = path.join(process.cwd(), root);
  if (!fs.existsSync(full)) continue;
  for (const f of walk(full)) {
    let c = fs.readFileSync(f, 'utf8');
    const orig = c;
    for (const [a, b] of reps) c = c.split(a).join(b);
    if (c !== orig) {
      fs.writeFileSync(f, c);
      changed++;
      console.log('updated', f);
    }
  }
}
console.log('files changed:', changed);
