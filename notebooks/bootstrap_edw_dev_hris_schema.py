# Databricks notebook source
# MAGIC %md
# MAGIC # Bootstrap `edw_dev_hris.hgv_comp` schema
# MAGIC
# MAGIC Run this notebook after cloning the repo into **Workspace → Repos**.
# MAGIC
# MAGIC 1. Attach to a SQL warehouse (or use serverless)
# MAGIC 2. Set `repo_root` below if your clone path differs
# MAGIC 3. **Run all** cells
# MAGIC
# MAGIC DDL only — no demo seeds. For seeds, run `setup-comp-data-edw-dev-hris.ps1 -IncludeSeeds` from a machine with the CLI.

# COMMAND ----------

repo_root = "/Workspace/Repos"  # edit: e.g. /Workspace/Repos/you@corp/hilton-kb-chat

import os
import glob

# Auto-detect repo if bootstrap file exists under Repos
candidates = glob.glob(f"{repo_root}/**/data/comp/edw_dev_hris/00_bootstrap_all_ddl.sql", recursive=True)
if not candidates:
    raise FileNotFoundError(
        "Clone hilton-kb-chat into Repos first, then set repo_root. "
        "Expected data/comp/edw_dev_hris/00_bootstrap_all_ddl.sql"
    )
bootstrap_path = candidates[0]
sql_root = os.path.dirname(bootstrap_path)
print(f"Using SQL root: {sql_root}")

# COMMAND ----------

def run_sql_file(path: str) -> None:
    with open(path, encoding="utf-8") as f:
        raw = f.read()
    # Split on semicolon at end of statement (same as setup-comp-data.ps1)
    import re
    chunks = [c.strip() for c in re.split(r";\s*(?=\r?\n|$)", raw) if c.strip()]
    for i, chunk in enumerate(chunks, 1):
        lines = [ln for ln in chunk.splitlines() if not ln.strip().startswith("--")]
        stmt = "\n".join(lines).strip()
        if not stmt:
            continue
        preview = stmt.split("\n", 1)[0][:80]
        print(f"  [{i}] {preview}...")
        spark.sql(stmt)

# COMMAND ----------

# Option A — one-shot file (fastest)
run_sql_file(f"{sql_root}/00_bootstrap_all_ddl.sql")
print("DDL bootstrap complete.")

# COMMAND ----------

display(spark.sql("SHOW TABLES IN edw_dev_hris.hgv_comp"))
