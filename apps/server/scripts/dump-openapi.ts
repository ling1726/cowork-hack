import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { openApiDocument } from '../src/openapi.ts';

const out = process.argv[2];
if (!out) {
  console.error('usage: tsx scripts/dump-openapi.ts <output.json>');
  process.exit(2);
}
const target = resolve(process.cwd(), out);
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(await openApiDocument(), null, 2)}\n`);
console.log(`wrote ${target}`);
