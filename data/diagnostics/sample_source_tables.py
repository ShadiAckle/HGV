# Databricks notebook source
# =============================================================================
# Stage LIMIT-N samples of edw_dev_cognos source tables back into the GitHub repo
# so they can be pulled down and analyzed offline.
#
# HOW TO USE
#   1. In Databricks Repos, open this notebook and "Run all".
#   2. It writes results next to this notebook under  ./source_samples/
#        - _SOURCE_SAMPLES.md   (columns + N sample rows per table — read this)
#        - _NAME_COLUMNS.md     (every name/lead/guest/customer column found)
#        - csv/<schema>.<table>.csv  (raw LIMIT-N sample per table)
#   3. In the Repos UI: Commit & Push the new files.
#   4. Tell the agent it's pushed; it will pull and analyze.
#
# Tweak the CONFIG cell below (patterns / schemas / row count) as needed.
# Safe to re-run — it overwrites the output folder each time.
# =============================================================================

# COMMAND ----------
# ---- CONFIG -----------------------------------------------------------------
CATALOG      = "edw_dev_cognos"
SCHEMAS      = []                       # [] = all schemas; or e.g. ["cognos_fm"]
PATTERNS     = ["it_uni_%", "it_smt_%"] # table-name LIKE patterns (lowercased)
SAMPLE_ROWS  = 3
MAX_TABLES   = 400                      # safety cap
WRITE_CSV    = True
VALUE_TRUNC  = 160                      # truncate long cell values in the markdown
# Highlight columns whose name hints at a person/guest/lead.
NAME_HINTS   = ["name", "lead", "guest", "customer", "first", "last",
                "fname", "lname", "member", "owner", "contact"]
# -----------------------------------------------------------------------------

import os, json, datetime, traceback

# COMMAND ----------
# ---- Resolve an output dir next to this notebook (inside the repo) -----------
def resolve_out_dir():
    candidates = []
    try:
        ctx = dbutils.notebook.entry_point.getDbutils().notebook().getContext()  # noqa: F821
        nb_path = ctx.notebookPath().get()  # e.g. /Repos/you/HGV/data/diagnostics/sample_source_tables
        nb_dir  = os.path.dirname(nb_path)
        candidates.append("/Workspace" + nb_dir + "/source_samples")
        candidates.append(nb_dir + "/source_samples")
    except Exception:
        pass
    candidates.append(os.path.join(os.getcwd(), "source_samples"))
    for c in candidates:
        try:
            os.makedirs(c, exist_ok=True)
            test = os.path.join(c, ".write_test")
            with open(test, "w") as f:
                f.write("ok")
            os.remove(test)
            return c
        except Exception:
            continue
    raise RuntimeError("Could not find a writable output dir. Candidates: " + str(candidates))

OUT_DIR = resolve_out_dir()
CSV_DIR = os.path.join(OUT_DIR, "csv")
if WRITE_CSV:
    os.makedirs(CSV_DIR, exist_ok=True)
print("Writing output to:", OUT_DIR)

# COMMAND ----------
# ---- Discover matching tables ----------------------------------------------
patt_clause = " OR ".join([f"LOWER(table_name) LIKE '{p.lower()}'" for p in PATTERNS])
schema_clause = ""
if SCHEMAS:
    inlist = ", ".join([f"'{s}'" for s in SCHEMAS])
    schema_clause = f"AND table_schema IN ({inlist})"

tables = spark.sql(f"""
    SELECT table_schema, table_name
    FROM {CATALOG}.information_schema.tables
    WHERE ({patt_clause})
    {schema_clause}
    ORDER BY table_schema, table_name
""").collect()

tables = tables[:MAX_TABLES]
print(f"Matched {len(tables)} tables")
for t in tables:
    print(f"  {t.table_schema}.{t.table_name}")

# COMMAND ----------
# ---- Catalog-wide name-ish column inventory (the key hunt) -------------------
hint_clause = " OR ".join([f"LOWER(column_name) LIKE '%{h}%'" for h in NAME_HINTS])
name_cols = spark.sql(f"""
    SELECT table_schema, table_name, column_name, data_type
    FROM {CATALOG}.information_schema.columns
    WHERE {hint_clause}
    ORDER BY table_schema, table_name, column_name
""").collect()

with open(os.path.join(OUT_DIR, "_NAME_COLUMNS.md"), "w", encoding="utf-8") as f:
    f.write(f"# Name-ish columns in `{CATALOG}` (generated {datetime.datetime.now():%Y-%m-%d %H:%M})\n\n")
    f.write(f"Hints: {', '.join(NAME_HINTS)}\n\n")
    f.write("| schema | table | column | type |\n|---|---|---|---|\n")
    for r in name_cols:
        f.write(f"| {r.table_schema} | {r.table_name} | {r.column_name} | {r.data_type} |\n")
print(f"Wrote _NAME_COLUMNS.md ({len(name_cols)} columns)")

# COMMAND ----------
# ---- Sample each table ------------------------------------------------------
def trunc(v):
    s = "" if v is None else str(v)
    s = s.replace("\n", " ").replace("\r", " ")
    return s if len(s) <= VALUE_TRUNC else s[:VALUE_TRUNC] + "…"

md = [f"# Source table samples — `{CATALOG}` (generated {datetime.datetime.now():%Y-%m-%d %H:%M})",
      f"\nPatterns: `{', '.join(PATTERNS)}` · {SAMPLE_ROWS} rows each · {len(tables)} tables\n"]

for t in tables:
    fqn = f"{CATALOG}.{t.table_schema}.{t.table_name}"
    md.append(f"\n---\n\n## {t.table_schema}.{t.table_name}\n")
    try:
        df = spark.sql(f"SELECT * FROM {fqn} LIMIT {SAMPLE_ROWS}")
        cols = df.columns
        rows = [r.asDict() for r in df.collect()]

        # flag likely person/guest columns
        flagged = [c for c in cols if any(h in c.lower() for h in NAME_HINTS)]
        if flagged:
            md.append(f"**Name-ish columns:** {', '.join('`'+c+'`' for c in flagged)}\n")

        md.append(f"**Columns ({len(cols)}):** " + ", ".join(f"`{c}`" for c in cols) + "\n")

        if rows:
            md.append("\n**Sample rows:**\n")
            for i, row in enumerate(rows, 1):
                compact = {k: trunc(v) for k, v in row.items()}
                md.append(f"\n_Row {i}_\n\n```json\n{json.dumps(compact, ensure_ascii=False, indent=1)}\n```\n")
        else:
            md.append("\n_(no rows returned)_\n")

        if WRITE_CSV and rows:
            try:
                pdf = df.toPandas()
                pdf.to_csv(os.path.join(CSV_DIR, f"{t.table_schema}.{t.table_name}.csv"), index=False)
            except Exception as e:
                md.append(f"\n_(csv export failed: {e})_\n")

    except Exception as e:
        md.append(f"\n**ERROR sampling this table:** `{e}`\n")
        md.append("```\n" + traceback.format_exc()[-800:] + "\n```\n")

with open(os.path.join(OUT_DIR, "_SOURCE_SAMPLES.md"), "w", encoding="utf-8") as f:
    f.write("\n".join(md))

print("Done. Files written to:", OUT_DIR)
print(" - _SOURCE_SAMPLES.md")
print(" - _NAME_COLUMNS.md")
if WRITE_CSV:
    print(" - csv/<schema>.<table>.csv")
print("\nNext: in the Databricks Repos UI, Commit & Push these files, then tell the agent.")
