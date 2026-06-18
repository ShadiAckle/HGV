-- =============================================================================
-- DIAGNOSTIC: Find guest / tour-people NAMES in the real Cognos source
--
-- Run each section, paste the result back. Sections are ordered cheap -> heavier.
-- Source catalog.schema = edw_dev_cognos.cognos_fm
-- (same tables 01_MATERIALIZE reads: it_smt_detail / it_smt_marketing / it_smt_personnel)
--
-- Goal: confirm whether real guest names exist anywhere, and in which column,
-- so we can stop falling back to "New Buyer" / "Owner".
-- =============================================================================


-- -----------------------------------------------------------------------------
-- A) Every NAME-ish column across the ENTIRE edw_dev_cognos catalog.
--    This reveals any guest/lead/customer name column we may have missed,
--    including tables we are not joining yet. (metadata only — fast)
-- -----------------------------------------------------------------------------
SELECT table_schema, table_name, column_name, data_type
FROM edw_dev_cognos.information_schema.columns
WHERE LOWER(column_name) LIKE '%name%'
   OR LOWER(column_name) LIKE '%lead%'
   OR LOWER(column_name) LIKE '%guest%'
   OR LOWER(column_name) LIKE '%first_nm%'
   OR LOWER(column_name) LIKE '%last_nm%'
   OR LOWER(column_name) LIKE '%fname%'
   OR LOWER(column_name) LIKE '%lname%'
   OR LOWER(column_name) LIKE '%customer%'
ORDER BY table_schema, table_name, column_name;


-- -----------------------------------------------------------------------------
-- B) List ALL tables in cognos_fm (is there a dedicated lead / guest table?)
-- -----------------------------------------------------------------------------
SHOW TABLES IN edw_dev_cognos.cognos_fm;


-- -----------------------------------------------------------------------------
-- C) it_smt_detail — how populated is lead_name in REAL data (2026 slice)?
--    The 1000-row CSV snippet had lead_name = NULL for every row; this checks
--    the full table. If lead_name_nonblank > 0, names DO exist.
-- -----------------------------------------------------------------------------
SELECT
  COUNT(*)                                                   AS rows_checked,
  COUNT(lead_name)                                           AS lead_name_not_null,
  COUNT(CASE WHEN TRIM(lead_name) <> '' THEN 1 END)         AS lead_name_nonblank,
  COUNT(CASE WHEN TRIM(lead_title_1) <> '' THEN 1 END)      AS lead_title1_nonblank,
  COUNT(CASE WHEN TRIM(lead_title_2) <> '' THEN 1 END)      AS lead_title2_nonblank
FROM edw_dev_cognos.cognos_fm.it_smt_detail
WHERE transaction_date >= DATE '2026-01-01';


-- -----------------------------------------------------------------------------
-- D) Show ACTUAL non-blank lead_name values (if section C found any)
-- -----------------------------------------------------------------------------
SELECT lead_name, lead_title_1, lead_title_2, ownership_status, country, transaction_date
FROM edw_dev_cognos.cognos_fm.it_smt_detail
WHERE lead_name IS NOT NULL AND TRIM(lead_name) <> ''
LIMIT 25;


-- -----------------------------------------------------------------------------
-- E) it_smt_marketing — does the booking grain carry a guest/lead name?
--    (lists this table's name-ish columns + a sample)
-- -----------------------------------------------------------------------------
SELECT column_name, data_type
FROM edw_dev_cognos.information_schema.columns
WHERE table_schema = 'cognos_fm'
  AND table_name = 'it_smt_marketing'
  AND (LOWER(column_name) LIKE '%name%' OR LOWER(column_name) LIKE '%lead%' OR LOWER(column_name) LIKE '%guest%')
ORDER BY column_name;


-- -----------------------------------------------------------------------------
-- F) it_smt_personnel — staff/agent name columns (these we KNOW are populated;
--    confirms whether any column is actually a GUEST vs an employee name)
-- -----------------------------------------------------------------------------
SELECT column_name, data_type
FROM edw_dev_cognos.information_schema.columns
WHERE table_schema = 'cognos_fm'
  AND table_name = 'it_smt_personnel'
  AND LOWER(column_name) LIKE '%name%'
ORDER BY column_name;


-- -----------------------------------------------------------------------------
-- G) Is there a LEAD / CUSTOMER dimension we can join via enterprise_lead_id
--    or lead_id?  (lists candidate tables anywhere in the catalog)
-- -----------------------------------------------------------------------------
SELECT table_schema, table_name
FROM edw_dev_cognos.information_schema.tables
WHERE LOWER(table_name) LIKE '%lead%'
   OR LOWER(table_name) LIKE '%guest%'
   OR LOWER(table_name) LIKE '%customer%'
   OR LOWER(table_name) LIKE '%member%'
   OR LOWER(table_name) LIKE '%owner%'
   OR LOWER(table_name) LIKE '%honors%'
ORDER BY table_schema, table_name;


-- -----------------------------------------------------------------------------
-- H) (Optional, run only if other catalogs are in play)
--    Search ALL catalogs you can see for a guest/lead name column.
--    Uncomment and run if A–G come up empty.
-- -----------------------------------------------------------------------------
-- SELECT table_catalog, table_schema, table_name, column_name
-- FROM system.information_schema.columns
-- WHERE LOWER(column_name) IN
--   ('lead_name','guest_name','customer_name','first_name','last_name',
--    'full_name','primary_guest_name','guest_first_name','guest_last_name',
--    'first_nm','last_nm','cust_name','member_name')
-- ORDER BY table_catalog, table_schema, table_name;

-- =============================================================================
-- END DIAGNOSTIC
-- =============================================================================
