#!/usr/bin/env node
// Regenerates assets/packs/index.ts from the *.json files in assets/packs.
// Metro needs static require()/import paths, so every pack file must be listed there.
// Usage: npm run packs:index
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'assets', 'packs');
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -'.json'.length))
  .sort();

const ident = (name) => {
  const [first, ...rest] = name.split('-');
  return first + rest.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
};

const lines = [
  '// Generated list of bundled starter packs. Metro needs static requires, so every',
  '// assets/packs/*.json file must be listed here (a test enforces it).',
  '',
  ...files.map((f) => `import ${ident(f)} from './${f}.json';`),
  '',
  'export const BUILTIN_PACKS: unknown[] = [',
  ...files.map((f) => `  ${ident(f)},`),
  '];',
  '',
];
fs.writeFileSync(path.join(dir, 'index.ts'), lines.join('\n'));
console.log(`assets/packs/index.ts: ${files.length} packs`);
