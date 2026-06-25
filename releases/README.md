# VDI deploy zip

**Current:** `v1.10.1` — ICM plan model, tier ladder from `fact_plan`, `VDI_QUICKSTART.txt` in zip.

Download `hgv-comp-app-edw_dev_hris.zip` from this folder (Databricks Git pull or GitHub).

## Local run on VDI (recommended for demo)

1. Unzip to **`C:\Users\jbarso\Downloads\hgv-comp`** (avoid OneDrive — it breaks `node_modules`)
2. Edit `.env` if needed — default host is `adb-7405610243855520.0.azuredatabricks.net`; set `DATABRICKS_WAREHOUSE_ID=9e9c06ad1c397404`
3. **`npm install`** — required every time you unzip to a new folder (wait until zero errors)
4. **`npm start`** — or for first-time CLI OAuth: `powershell -ExecutionPolicy Bypass -File .\scripts\vdi-start.ps1`
5. Open `http://127.0.0.1:8000`

## Warehouse SQL (run in SQL editor before demo)

Included inside the zip under `data/comp/edw_dev_hris/`:

1. `00_CLEAN_AND_REBUILD.sql`
2. `18a_seed_icm_plan_marketing.sql`
3. `01_MATERIALIZE_ALL_TABLES.sql`
4. `08_grant_app_permissions.sql`

## Databricks App deploy

Upload zip to **Compute → Apps**; attach SQL warehouse + serving endpoint.

- `COMP_CATALOG=edw_dev_hris`, `COMP_SCHEMA=hgv_comp` (in zip `app.yaml`)
- Profile: **hgv-edw** (NOT hgv-premium-legacy)

Rebuild: `npm run package:edw-vdi` then copy `build/hgv-comp-v*.zip` to `releases/hgv-comp-app-edw_dev_hris.zip` and commit.
