# VDI deploy zip

Download `hgv-comp-app-edw_dev_hris.zip` from this folder (Databricks Git pull or GitHub).

## Local run on VDI (recommended for demo)

1. Unzip to **`C:\Users\jbarso\Downloads\hgv-comp`** (avoid OneDrive — it breaks `node_modules`)
2. Edit `.env` if needed — default host is `adb-7405610243855520.0.azuredatabricks.net`; set `DATABRICKS_WAREHOUSE_ID=9e9c06ad1c397404`
3. **`npm install`** — required every time you unzip to a new folder (wait until zero errors)
4. **PATs are disabled** on HGV — use OAuth + token bridge:
   ```powershell
   databricks auth login --host https://adb-7405610243855520.0.azuredatabricks.net --profile hgv-edw
   powershell -ExecutionPolicy Bypass -File .\scripts\vdi-start.ps1
   ```
5. Open `http://127.0.0.1:8000`

## Databricks App deploy

Upload zip to **Compute → Apps**; attach SQL warehouse + serving endpoint.

- `COMP_CATALOG=edw_dev_hris`, `COMP_SCHEMA=hgv_comp` (in zip `app.yaml`)
- Run `data/comp/edw_dev_hris/12_bootstrap_live_source_views.sql` before demo (live Cognos views)

Rebuild: `npm run package:edw-vdi` then copy `build/hgv-comp-app-edw_dev_hris.zip` here.
