# VDI deploy zip

Download `hgv-comp-app-edw_dev_hris.zip` from this folder (Databricks Git pull or GitHub).

## Local run on VDI (recommended for demo)

1. Unzip to **`C:\Users\jbarso\Downloads\hgv-comp`** (avoid OneDrive — it breaks `node_modules`)
2. Edit `.env` — set `DATABRICKS_WAREHOUSE_ID=9e9c06ad1c397404` (Serverless Starter)
3. `npm install` (wait until it finishes with no errors)
4. `npm start` → open `http://127.0.0.1:8000`

If `npm start` fails, run directly:
`node --env-file-if-exists=./.env ./dist/server.js`

## Databricks App deploy

Upload zip to **Compute → Apps**; attach SQL warehouse + serving endpoint.

- `COMP_CATALOG=edw_dev_hris`, `COMP_SCHEMA=hgv_comp` (in zip `app.yaml`)
- Run `data/comp/edw_dev_hris/12_bootstrap_live_source_views.sql` before demo (live Cognos views)

Rebuild: `npm run package:edw-vdi` then copy `build/hgv-comp-app-edw_dev_hris.zip` here.
