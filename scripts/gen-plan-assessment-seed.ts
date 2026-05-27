import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MARKETING_PLAN_ASSESSMENTS, SALES_MANAGER_ASSESSMENT } from '../shared/planAssessmentCatalog.ts';

const periodId = '2026-Q2';
const lines: string[] = [
  '-- Seed plan assessment profiles and segments',
  `DELETE FROM workspace.hgv_comp.plan_assessment_segment WHERE effective_period = '${periodId}'`,
  `DELETE FROM workspace.hgv_comp.plan_assessment_profile WHERE effective_period = '${periodId}'`,
  '',
];

function esc(s: string) {
  return s.replace(/'/g, "''");
}

function addPersona(
  personaId: string,
  planId: string,
  roleTitle: string,
  channelCode: string,
  rows: Array<{ attribute: string; hgvPlan: Array<{ label?: string; value: string }>; marketStandard: Array<{ label?: string; value: string }> }>,
) {
  lines.push(
    `INSERT INTO workspace.hgv_comp.plan_assessment_profile VALUES ('${personaId}', '${planId}', '${esc(roleTitle)}', '${channelCode}', '${periodId}')`,
  );
  rows.forEach((row, attrIdx) => {
    row.hgvPlan.forEach((seg, segIdx) => {
      const label = seg.label ? `'${esc(seg.label)}'` : 'NULL';
      lines.push(
        `INSERT INTO workspace.hgv_comp.plan_assessment_segment VALUES ('${personaId}', '${periodId}', '${esc(row.attribute)}', ${attrIdx + 1}, 'hgv', ${segIdx + 1}, ${label}, '${esc(seg.value)}')`,
      );
    });
    row.marketStandard.forEach((seg, segIdx) => {
      const label = seg.label ? `'${esc(seg.label)}'` : 'NULL';
      lines.push(
        `INSERT INTO workspace.hgv_comp.plan_assessment_segment VALUES ('${personaId}', '${periodId}', '${esc(row.attribute)}', ${attrIdx + 1}, 'market', ${segIdx + 1}, ${label}, '${esc(seg.value)}')`,
      );
    });
  });
  lines.push('');
}

for (const assessment of Object.values(MARKETING_PLAN_ASSESSMENTS)) {
  addPersona(assessment.personaId, assessment.planId, assessment.roleTitle, assessment.channelCode, assessment.rows);
}

addPersona('sales_manager', SALES_MANAGER_ASSESSMENT.planId, SALES_MANAGER_ASSESSMENT.roleTitle, SALES_MANAGER_ASSESSMENT.channelCode, SALES_MANAGER_ASSESSMENT.rows);

const outPath = join(import.meta.dirname, '..', 'data', 'comp', '10a_seed_plan_assessment.sql');
writeFileSync(outPath, `${lines.join(';\n')};\n`);
console.log(`Wrote ${lines.length} lines to ${outPath}`);
