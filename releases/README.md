# VDI deploy zip (temporary)

Download `hgv-comp-app-edw_dev_hris.zip` from this folder on VDI, then upload to **Compute → Apps**.

- `COMP_CATALOG=edw_dev_hris`, `COMP_SCHEMA=hgv_comp` (included in zip `app.yaml`)
- Remove this zip from the repo after VDI deploy to avoid bloating git history.

Rebuild locally: `npm run package:edw-vdi` then copy to `releases/`.
