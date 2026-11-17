import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOTS = [
  join(import.meta.dirname, '.'),
  join(import.meta.dirname, '../../../packages/ui/src'),
];

describe('UI sources', () => {
  it('no Fluent anywhere in the UI sources', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name) && !name.endsWith('.test.ts')) files.push(path);
      }
    };
    ROOTS.forEach(walk);
    expect(files.length).toBeGreaterThan(20);
    const offenders = files.filter((f) => readFileSync(f, 'utf8').includes('@fluentui/'));
    expect(offenders).toEqual([]);
  });
});
