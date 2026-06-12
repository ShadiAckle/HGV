/**
 * Stage a Databricks App deploy zip for VDI upload (edw_dev_hris catalog).
 * Usage: node scripts/package-edw-vdi-deploy.mjs [--skip-build]
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { platform } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const skipBuild = process.argv.includes('--skip-build');

const COMP_CATALOG = process.env.COMP_CATALOG ?? 'edw_dev_hris';
const COMP_SCHEMA = process.env.COMP_SCHEMA ?? 'hgv_comp';
const COMP_UC = `${COMP_CATALOG}.${COMP_SCHEMA}`;

if (!skipBuild) {
  console.log('Building artifacts…');
  execSync('npm run build:artifacts', { cwd: root, stdio: 'inherit' });
}

const required = ['dist/server.js', 'client/dist/index.html', 'app.yaml', 'package.json'];
for (const rel of required) {
  if (!existsSync(join(root, rel))) {
    console.error(`Missing ${rel} after build.`);
    process.exit(1);
  }
}

const staging = join(root, 'build', 'edw-vdi-deploy');
const zipPath = join(root, 'build', `hgv-comp-app-${COMP_CATALOG}.zip`);

rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });

function copyTree(src, dest) {
  cpSync(join(root, src), join(staging, dest), { recursive: true });
}

copyTree('dist', 'dist');
copyTree('client/dist', 'client/dist');
copyTree('package.json', 'package.json');
if (existsSync(join(root, 'package-lock.json'))) {
  copyTree('package-lock.json', 'package-lock.json');
}
if (existsSync(join(root, 'manifest.yaml'))) {
  copyTree('manifest.yaml', 'manifest.yaml');
}

// Analytics SQL (read from disk at runtime — patch catalog for edw)
const queriesSrc = join(root, 'config', 'queries');
const queriesDest = join(staging, 'config', 'queries');
mkdirSync(queriesDest, { recursive: true });
for (const name of readdirSync(queriesSrc)) {
  if (!name.endsWith('.sql')) continue;
  const raw = readFileSync(join(queriesSrc, name), 'utf8');
  const patched = raw.replaceAll('workspace.hgv_comp', COMP_UC);
  writeFileSync(join(queriesDest, name), patched);
}

// app.yaml with edw catalog env
const appYaml = readFileSync(join(root, 'app.yaml'), 'utf8');
let patchedYaml = appYaml;
if (!patchedYaml.includes('COMP_CATALOG')) {
  patchedYaml = patchedYaml.replace(
    /(  - name: DATABRICKS_SERVING_ENDPOINT_NAME\n    valueFrom: serving-endpoint\n)/,
    `$1  - name: COMP_CATALOG
    value: ${COMP_CATALOG}
  - name: COMP_SCHEMA
    value: ${COMP_SCHEMA}
`,
  );
}
if (!patchedYaml.includes('COMP_DATA_MODE')) {
  patchedYaml = patchedYaml.replace(
    /(  - name: COMP_SCHEMA\n    value: .*?\n)/,
    `$1  - name: COMP_DATA_MODE
    value: production
`,
  );
}
writeFileSync(join(staging, 'app.yaml'), patchedYaml);

const vdiEnv = join(root, 'scripts', 'vdi-edw.env.example');
if (existsSync(vdiEnv)) {
  const envText = readFileSync(vdiEnv, 'utf8');
  writeFileSync(join(staging, '.env.example'), envText);
  // Pre-baked .env so npm start skips demo bootstrap without a manual copy step.
  writeFileSync(join(staging, '.env'), envText);
}

writeFileSync(
  join(staging, 'DEPLOY_README.txt'),
  `HGV Compensation Hub — VDI App Deploy (${COMP_UC})
================================================

1. Upload ${zipPath.split(/[/\\]/).pop()} to your Databricks workspace (or transfer via approved channel).

2. Compute → Apps → Create app → Upload source code (this zip).

3. Attach resources when prompted:
   - SQL warehouse (same one used for bootstrap DDL)
   - Model serving endpoint (e.g. databricks-claude-sonnet-4-6)

4. Environment variables (also in app.yaml and .env for local npm start):
   COMP_CATALOG=${COMP_CATALOG}
   COMP_SCHEMA=${COMP_SCHEMA}
   COMP_DATA_MODE=production

   Local VDI demo: unzip → npm install → npm start → http://127.0.0.1:8000
   On startup you should see: "live data — skipping demo bootstrap"
   (No "Seeding marketing team roster" lines.)

5. After first deploy, note the app service principal client id, then run:
   data/comp/edw_dev_hris/08_grant_app_permissions.sql
   (replace the SP UUID in that file with your new app's SP)

6. Schema DDL should already exist from 00_bootstrap_all_ddl.sql.

Catalog wiring: runtime SQL uses COMP_CATALOG/COMP_SCHEMA; analytics queries in config/queries/ are pre-patched to ${COMP_UC} in this zip.
`,
);

rmSync(zipPath, { force: true });
mkdirSync(dirname(zipPath), { recursive: true });

if (platform() === 'win32') {
  const psStaging = staging.replace(/'/g, "''");
  const psZip = zipPath.replace(/'/g, "''");
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${psStaging}\\*' -DestinationPath '${psZip}' -Force"`,
    { stdio: 'inherit' },
  );
} else {
  execSync(`zip -r -q "${zipPath}" .`, { cwd: staging, stdio: 'inherit' });
}

console.log(`\nDeploy zip ready: ${zipPath}`);
console.log(`Staging folder:   ${staging}`);
