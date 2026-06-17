#!/usr/bin/env node
/**
 * Compile standalone ETL scripts that aren't bundled by tsdown
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distEtl = path.join(root, 'dist', 'scripts', 'etl');

// Ensure dist/scripts/etl exists
fs.mkdirSync(distEtl, { recursive: true });

// Compile ETL TypeScript files
const etlFiles = [
  'scripts/etl/varicent_mapping_config.ts',
  'scripts/etl/varicent_etl_processor.ts',
];

console.log('[build-etl] Compiling ETL scripts...');

for (const file of etlFiles) {
  try {
    execSync(
      `npx tsc ${file} --outDir dist/scripts/etl --module esnext --target es2020 --moduleResolution node`,
      { cwd: root, stdio: 'inherit' }
    );
  } catch (err) {
    console.error(`[build-etl] Failed to compile ${file}`);
    process.exit(1);
  }
}

console.log('[build-etl] ✓ ETL scripts compiled');
