# VDI deploy zip

Download `hgv-comp-app-edw_dev_hris.zip` from this folder (Databricks Git pull or GitHub).

## Local run on VDI (recommended for demo)

1. Unzip to e.g. `C:\Users\jbarso\Downloads\hgv-comp-app-edw_dev_hris`
2. Copy `scripts/vdi-edw.env.example` → `.env` and set `DATABRICKS_WAREHOUSE_ID` from `databricks warehouses list`
3. `npm install` → `npm start` → open `http://127.0.0.1:8000`

## Databricks App deploy

Upload zip to **Compute → Apps**; attach SQL warehouse + serving endpoint.

- `COMP_CATALOG=edw_dev_hris`, `COMP_SCHEMA=hgv_comp` (in zip `app.yaml`)
- Run `data/comp/edw_dev_hris/12_bootstrap_live_source_views.sql` before demo (live Cognos views)

Rebuild: `npm run package:edw-vdi` then copy `build/hgv-comp-app-edw_dev_hris.zip` here.
