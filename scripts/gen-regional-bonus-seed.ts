import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BONUS_LEVELS_JAN_2025 } from '../shared/bonusLevelsJan2025.ts';

const periodId = '2026-Q2';
const lines = [
  '-- Seed regional bonus levels (Jan 2025 PDF)',
  `DELETE FROM workspace.hgv_comp.fact_regional_bonus_tier WHERE period_id = '${periodId}'`,
  `DELETE FROM workspace.hgv_comp.fact_regional_bonus_area WHERE period_id = '${periodId}'`,
  '',
];

for (const area of BONUS_LEVELS_JAN_2025) {
  const siteLine = area.siteLine.replace(/'/g, "''");
  lines.push(
    `INSERT INTO workspace.hgv_comp.fact_regional_bonus_area VALUES ('${area.areaId}', '${periodId}', '${siteLine}', ${area.smtVolume}, ${area.budgetVolume}, ${area.volumeVarPct})`,
  );
  for (const t of area.tiers) {
    lines.push(
      `INSERT INTO workspace.hgv_comp.fact_regional_bonus_tier VALUES ('${area.areaId}', '${periodId}', ${t.level}, ${t.salespeopleCount}, ${t.avgTierVolume}, ${t.totalTierVolume}, ${t.totalCmi}, ${t.costPct})`,
    );
  }
}

const outPath = join(import.meta.dirname, '..', 'data', 'comp', '07a_seed_regional_bonus.sql');
writeFileSync(outPath, `${lines.join('\n')};\n`);
console.log(`Wrote ${lines.length} statements to ${outPath}`);
