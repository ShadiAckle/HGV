#!/usr/bin/env node
/**
 * Stage mcp-hgv-comp-hub app artifacts into mcp-app/ for a separate Databricks App
 * (required: distinct source_code_path + mcp- name prefix for AI Playground discovery).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stage = path.join(root, 'mcp-app');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function rmDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) rmDir(target);
    else fs.unlinkSync(target);
  }
  fs.rmdirSync(dir);
}

for (const sub of ['dist', 'client']) {
  const target = path.join(stage, sub);
  rmDir(target);
}

copyDir(path.join(root, 'dist'), path.join(stage, 'dist'));
copyDir(path.join(root, 'client', 'dist'), path.join(stage, 'client', 'dist'));

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const stagedPkg = {
  name: 'mcp-hgv-comp-hub',
  version: pkg.version,
  type: pkg.type,
  main: pkg.main,
  dependencies: pkg.dependencies,
};
fs.writeFileSync(path.join(stage, 'package.json'), `${JSON.stringify(stagedPkg, null, 2)}\n`);

console.log('[stage-mcp-app] Staged dist + client/dist into mcp-app/');
