// Core ETL processor logic in TypeScript for parsing, validating, transforming, and loading Varicent data

import { VARICENT_MAPPINGS } from './varicent_mapping_config';

// Simple quote-aware CSV parser
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  const records: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^["']|["']$/g, ''));
    
    if (values.length >= headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] ?? null;
      });
      records.push(row);
    }
  }
  return records;
}

interface ProcessedTarget {
  table: string;
  uniqueKeys: readonly string[];
  mode: string;
  records: Record<string, any>[];
  fields: string[];
}

interface PreflightLog {
  table: string;
  rowsDetected: number;
  rowsValid: number;
  rowsInvalid: number;
  logs: { row: number; status: string; message: string; rowSnippet: string }[];
}

interface EtlReport {
  valid: boolean;
  validCount: number;
  invalidCount: number;
  targets: ProcessedTarget[];
  preflight: PreflightLog[];
}

// Validates, transforms, and prepares target dataset with column mapping
export function processEtlRecords(exportType: 'payees' | 'deals' | 'payouts', rawText: string, modeOverride: string | null = null): EtlReport {
  const config = VARICENT_MAPPINGS[exportType];
  if (!config) throw new Error(`Invalid export type: ${exportType}`);

  let rawRecords: Record<string, any>[] = [];
  try {
    if (config.sourceFormat === "json") {
      const parsed = JSON.parse(rawText);
      rawRecords = Array.isArray(parsed) ? parsed : [parsed];
    } else {
      rawRecords = parseCsv(rawText);
    }
  } catch (err: any) {
    throw new Error(`Failed to parse ${config.sourceFormat.toUpperCase()} input: ${err.message}`);
  }

  const results: ProcessedTarget[] = [];
  const preflightLogs: PreflightLog[] = [];
  let validCount = 0;
  let invalidCount = 0;

  for (const targetConfig of config.targets) {
    const mappedRows: Record<string, any>[] = [];
    const tableLogs: { row: number; status: string; message: string; rowSnippet: string }[] = [];
    const mode = modeOverride || targetConfig.ingestionMode;

    rawRecords.forEach((rawRow, idx) => {
      const mappedRow: Record<string, any> = {};
      const rowErrors: string[] = [];
      const rowNum = idx + 1;

      // Extract and map each field
      Object.entries(targetConfig.fields).forEach(([targetField, fieldDef]: [string, any]) => {
        let rawVal = rawRow[fieldDef.source];
        
        // Handle undefined/null default values
        if ((rawVal === undefined || rawVal === null || rawVal === "") && fieldDef.defaultValue !== undefined) {
          rawVal = fieldDef.defaultValue;
        }

        // Apply custom transform function if exists
        let finalVal = rawVal;
        if (fieldDef.transform && rawVal !== null && rawVal !== undefined) {
          try {
            finalVal = fieldDef.transform(rawVal, rawRow);
          } catch (err: any) {
            rowErrors.push(`Field '${targetField}': custom transform error: ${err.message}`);
            finalVal = null;
          }
        }

        // Validate required constraints
        if (fieldDef.required && (finalVal === null || finalVal === undefined || finalVal === "")) {
          rowErrors.push(`Required field '${targetField}' (source: '${fieldDef.source}') is missing/null`);
        }

        // Validate and enforce types
        if (finalVal !== null && finalVal !== undefined) {
          if (fieldDef.type === "int") {
            const parsed = parseInt(finalVal, 10);
            if (isNaN(parsed)) rowErrors.push(`Field '${targetField}': failed to cast '${finalVal}' to Integer`);
            finalVal = parsed;
          } else if (fieldDef.type === "decimal") {
            const parsed = parseFloat(finalVal);
            if (isNaN(parsed)) rowErrors.push(`Field '${targetField}': failed to cast '${finalVal}' to Decimal`);
            finalVal = parsed;
          } else if (fieldDef.type === "boolean") {
            if (typeof finalVal !== "boolean") {
              finalVal = String(finalVal).toLowerCase() === "true" || finalVal === 1 || finalVal === "1" || finalVal === "1.00";
            }
          } else if (fieldDef.type === "date") {
            if (finalVal instanceof Date) {
              finalVal = finalVal.toISOString().split('T')[0];
            } else {
              const str = String(finalVal).trim();
              if (str.match(/^\d{4}-\d{2}-\d{2}/)) {
                finalVal = str.slice(0, 10);
              } else {
                const d = new Date(str);
                if (isNaN(d.getTime())) {
                  rowErrors.push(`Field '${targetField}': failed to parse date '${str}'`);
                } else {
                  finalVal = d.toISOString().split('T')[0];
                }
              }
            }
          }
        }

        mappedRow[targetField] = finalVal;
      });

      if (rowErrors.length > 0) {
        tableLogs.push({
          row: rowNum,
          status: "FAILED",
          message: rowErrors.join("; "),
          rowSnippet: JSON.stringify(rawRow).slice(0, 80) + "..."
        });
        invalidCount++;
      } else {
        mappedRows.push(mappedRow);
        validCount++;
      }
    });

    results.push({
      table: targetConfig.table,
      uniqueKeys: targetConfig.uniqueKeys as readonly string[],
      mode,
      records: mappedRows,
      fields: Object.keys(targetConfig.fields)
    });

    preflightLogs.push({
      table: targetConfig.table,
      rowsDetected: rawRecords.length,
      rowsValid: mappedRows.length,
      rowsInvalid: tableLogs.length,
      logs: tableLogs
    });
  }

  return {
    valid: invalidCount === 0,
    validCount,
    invalidCount,
    targets: results,
    preflight: preflightLogs
  };
}

// Helper to escape SQL string literals safely
export function escapeSqlStr(val: any): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "number") return String(val);
  return `'${String(val).replace(/'/g, "''")}'`;
}

// Builds SQL statements based on ingestion mode
export function generateIngestionSql(processedTarget: ProcessedTarget): string[] {
  const { table, uniqueKeys, mode, records, fields } = processedTarget;
  if (records.length === 0) return [];

  const statements: string[] = [];

  // OVERWRITE MODE: Delete all records or drop partition, then insert
  if (mode === "OVERWRITE") {
    if (fields.includes("period_id")) {
      const distinctPeriods = [...new Set(records.map(r => r.period_id).filter(Boolean))];
      distinctPeriods.forEach(period => {
        statements.push(`DELETE FROM ${table} WHERE period_id = ${escapeSqlStr(period)}`);
      });
    } else {
      statements.push(`TRUNCATE TABLE ${table}`);
    }
  }

  // MERGE MODE (Upsert): Safely delete matching unique records first, then standard insert
  else if (mode === "MERGE" && uniqueKeys?.length > 0) {
    const keyClauses = records.map(row => {
      const conditions = uniqueKeys.map(k => `${k} = ${escapeSqlStr(row[k])}`);
      return `(${conditions.join(" AND ")})`;
    });

    const chunkSize = 100;
    for (let i = 0; i < keyClauses.length; i += chunkSize) {
      const chunk = keyClauses.slice(i, i + chunkSize);
      statements.push(`DELETE FROM ${table} WHERE ${chunk.join(" OR ")}`);
    }
  }

  // Insert statement generation (values insertion)
  const batchSize = 300;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    const valueGroups = batch.map(row => {
      const vals = fields.map(f => {
        const val = row[f];
        
        // Find configuration mapping to identify if field type is Date or Timestamp
        const exportKey = Object.keys(VARICENT_MAPPINGS).find(k => 
          (VARICENT_MAPPINGS as any)[k].targets.some((t: any) => t.table === table)
        ) as 'payees' | 'deals' | 'payouts' | undefined;
        
        const fieldDef = exportKey 
          ? ((VARICENT_MAPPINGS as any)[exportKey].targets.find((t: any) => t.table === table) as any)?.fields[f]
          : null;
        
        if (val === null || val === undefined) return "NULL";
        if (fieldDef?.type === "date") return `DATE ${escapeSqlStr(val)}`;
        if (fieldDef?.type === "timestamp") return `TIMESTAMP ${escapeSqlStr(val)}`;
        return escapeSqlStr(val);
      });
      return `(${vals.join(", ")})`;
    });

    statements.push(`
      INSERT INTO ${table} (${fields.join(", ")})
      VALUES ${valueGroups.join(",\n")}
    `);
  }

  return statements;
}
