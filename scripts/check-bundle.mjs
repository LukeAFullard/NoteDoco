// Fails the build if the JavaScript needed to start the app exceeds the budget in
// docs/ARCHITECTURE.md §16 (entry script + everything it preloads, gzipped).
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const BUDGET_KB = 200;
const dist = new URL('../dist/', import.meta.url).pathname;
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const files = [...html.matchAll(/(?:src|href)="[^"]*?(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
if (!files.length) throw new Error('No entry scripts found in dist/index.html');

let total = 0;
for (const f of new Set(files)) {
  const kb = gzipSync(readFileSync(join(dist, f))).length / 1024;
  total += kb;
  console.log(`${kb.toFixed(1).padStart(7)} KB  ${f}`);
}
console.log(`${total.toFixed(1).padStart(7)} KB  total startup JavaScript (budget ${BUDGET_KB} KB)`);
if (total > BUDGET_KB) {
  console.error(`Over budget by ${(total - BUDGET_KB).toFixed(1)} KB. Lazy-load something (see src/app/App.tsx).`);
  process.exit(1);
}
