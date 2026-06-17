#!/bin/bash
# Local script to run Cognos diagnostic queries via Databricks CLI
# Usage: ./scripts/run-diagnostics-local.sh [profile] [warehouse-id]

set -e

PROFILE="${1:-hgv-premium}"
WAREHOUSE_ID="${2:-your-warehouse-id}"
OUTPUT_DIR="diagnostic-results"

echo "==================================================================="
echo "Running Cognos Marketing Schema Diagnostics"
echo "==================================================================="
echo "Profile: $PROFILE"
echo "Warehouse: $WAREHOUSE_ID"
echo "Output: $OUTPUT_DIR/"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check if Databricks CLI is installed
if ! command -v databricks &> /dev/null; then
    echo "ERROR: Databricks CLI not found. Install with: pip install databricks-cli"
    exit 1
fi

echo "Running queries..."
echo ""

# Query 1: Tour Status Distribution
echo "[1/5] Tour Status Distribution..."
databricks sql statement execute \
  --profile "$PROFILE" \
  --warehouse-id "$WAREHOUSE_ID" \
  --statement "$(cat <<'EOF'
SELECT 
  'QUERY_1' AS query_label,
  tour_status_desc,
  COUNT(*) AS tour_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS pct_of_total
FROM edw_dev_cognos.cognos_fm.it_smt_marketing
WHERE TO_DATE(tour_booked_date) BETWEEN DATE '2026-04-01' AND DATE '2026-04-30'
GROUP BY tour_status_desc
ORDER BY tour_count DESC
LIMIT 20
EOF
)" > "$OUTPUT_DIR/query1-tour-status.txt" 2>&1
echo "   ✓ Saved to $OUTPUT_DIR/query1-tour-status.txt"

# Query 2: Personnel Deduplication
echo "[2/5] Personnel Deduplication Analysis..."
databricks sql statement execute \
  --profile "$PROFILE" \
  --warehouse-id "$WAREHOUSE_ID" \
  --statement "$(cat <<'EOF'
SELECT 
  'QUERY_2' AS query_label,
  rep_count,
  COUNT(*) AS tour_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS pct_of_tours
FROM (
  SELECT tour_key_hash, COUNT(*) AS rep_count
  FROM edw_dev_cognos.cognos_fm.it_smt_personnel
  WHERE opc_person_1_employee_id IS NOT NULL
    AND CAST(opc_person_1_employee_id AS BIGINT) <> 0
  GROUP BY tour_key_hash
) tour_rep_counts
GROUP BY rep_count
ORDER BY rep_count
EOF
)" > "$OUTPUT_DIR/query2-personnel-dedupe.txt" 2>&1
echo "   ✓ Saved to $OUTPUT_DIR/query2-personnel-dedupe.txt"

# Query 3: Sample Tours
echo "[3/5] Sample Tours with Full Context..."
databricks sql statement execute \
  --profile "$PROFILE" \
  --warehouse-id "$WAREHOUSE_ID" \
  --statement "$(cat scripts/diagnose-cognos-schema.sql | sed -n '/Query 4:/,/Query 5:/p' | head -n -3)" \
  > "$OUTPUT_DIR/query3-sample-tours.txt" 2>&1
echo "   ✓ Saved to $OUTPUT_DIR/query3-sample-tours.txt"

# Query 4: Top Reps
echo "[4/5] Top Reps by Tour Count..."
databricks sql statement execute \
  --profile "$PROFILE" \
  --warehouse-id "$WAREHOUSE_ID" \
  --statement "$(cat scripts/diagnose-cognos-schema.sql | sed -n '/Query 5:/,$p')" \
  > "$OUTPUT_DIR/query4-top-reps.txt" 2>&1
echo "   ✓ Saved to $OUTPUT_DIR/query4-top-reps.txt"

echo ""
echo "==================================================================="
echo "Diagnostic queries complete!"
echo "==================================================================="
echo "Results saved to: $OUTPUT_DIR/"
echo ""
echo "Quick preview of Query 1 (Tour Status):"
echo "-------------------------------------------------------------------"
head -30 "$OUTPUT_DIR/query1-tour-status.txt"
echo ""
echo "Full results in $OUTPUT_DIR/*.txt files"
echo "Share these files to proceed with SQL corrections."
