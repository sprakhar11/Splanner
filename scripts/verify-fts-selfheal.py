#!/usr/bin/env python3
"""
Proves ensureSearchIndex() recovers from the two broken states this task fixed:
  1. a legacy contentless table (unreadable results)
  2. index drift (orphan rows left by triggers that could not delete)

Works on a COPY of the database so the live one is never at risk.
Run: python3 scripts/verify-fts-selfheal.py
"""

import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile

passed, failed = [], []


def check(name, cond, detail=""):
    (passed if cond else failed).append(name)
    print(("  PASS  " if cond else "  FAIL  ") + name + (f"   {detail}" if detail and not cond else ""))


SRC = "data/splanner.db"
tmpdir = tempfile.mkdtemp(prefix="splanner-fts-")
DB = os.path.join(tmpdir, "test.db")
shutil.copy(SRC, DB)

# Drop WAL side files so the copy is self-contained.
for ext in ("-wal", "-shm"):
    if os.path.exists(SRC + ext):
        try:
            shutil.copy(SRC + ext, DB + ext)
        except Exception:
            pass

SOURCES = [
    ("TASK", "tasks"), ("NOTE", "notes"), ("REVISION", "revision_items"),
    ("DSA", "dsa_problems"), ("SYSTEM_DESIGN", "system_design"),
    ("LLD", "lld_designs"), ("HR", "hr_stories"),
]


def source_total(con):
    return sum(con.execute(f"select count(*) from {t}").fetchone()[0] for _, t in SOURCES)


def run_ensure():
    """Runs ensureSearchIndex() against the copy via tsx."""
    env = dict(os.environ, DB_FILE_NAME=DB)
    return subprocess.run(
        ["npx", "tsx", "-e",
         "import {ensureSearchIndex, countRows} from './src/server/db/search-index';"
         "ensureSearchIndex(); console.log(JSON.stringify({total: countRows()}));"],
        capture_output=True, text=True, env=env, timeout=180,
    )


# ---------------------------------------------------------------- baseline
con = sqlite3.connect(DB)
expected = source_total(con)
print(f"\nBaseline: {expected} source rows across {len(SOURCES)} tables")

# ------------------------------------------- state 1: contentless table
print("\nState 1 — legacy contentless table")
con.executescript("""
  DROP TABLE IF EXISTS search_index;
  CREATE VIRTUAL TABLE search_index USING fts5(
    entity_type, entity_id, searchable_text, content='', tokenize='porter unicode61'
  );
""")
con.execute("insert into search_index(entity_type, entity_id, searchable_text) values ('TASK','x','hello world')")
con.commit()

sql = con.execute("select sql from sqlite_master where name='search_index'").fetchone()[0]
check("the broken state is contentless", "content=''" in sql.replace(" ", ""))
row = con.execute("select entity_type, entity_id from search_index limit 1").fetchone()
check("the broken state reads back NULL columns", row == (None, None), str(row))
con.close()

res = run_ensure()
if res.returncode != 0:
    print("  ensureSearchIndex failed:\n", res.stdout, res.stderr)
    sys.exit(1)
check("ensureSearchIndex reported a rebuild", "Rebuilding contentless" in res.stdout, res.stdout.strip())

con = sqlite3.connect(DB)
sql = con.execute("select sql from sqlite_master where name='search_index'").fetchone()[0]
check("the rebuilt table is no longer contentless", "content=''" not in sql.replace(" ", ""))

total = con.execute("select count(*) from search_index").fetchone()[0]
check("the rebuilt index matches the source row count", total == expected, f"{total} vs {expected}")

row = con.execute("select entity_type, entity_id, searchable_text from search_index limit 1").fetchone()
check("columns are now readable", all(v is not None for v in row), str(row))

types = {t for (t,) in con.execute("select distinct entity_type from search_index")}
non_empty = {typ for typ, tbl in SOURCES
             if con.execute(f"select count(*) from {tbl}").fetchone()[0] > 0}
check("every non-empty source table is represented", types == non_empty, f"{types} vs {non_empty}")

hits = con.execute(
    "select entity_type, entity_id from search_index where search_index match '\"design\"*'").fetchall()
check("MATCH returns readable rows after the rebuild",
      len(hits) > 0 and all(h[0] and h[1] for h in hits), str(hits[:3]))

check("the stale pre-rebuild row was discarded",
      con.execute("select count(*) from search_index where entity_id='x'").fetchone()[0] == 0)

# --------------------------------------------------- state 2: index drift
print("\nState 2 — index drift (orphan rows)")
for i in range(37):
    con.execute(
        "insert into search_index(entity_type, entity_id, searchable_text) values (?,?,?)",
        ("TASK", f"orphan-{i}", "orphaned junk text"))
con.commit()
drifted = con.execute("select count(*) from search_index").fetchone()[0]
check("orphans were injected", drifted == expected + 37, f"{drifted}")
con.close()

res = run_ensure()
check("ensureSearchIndex detected the drift", "drift detected" in res.stdout.lower(), res.stdout.strip())

con = sqlite3.connect(DB)
total = con.execute("select count(*) from search_index").fetchone()[0]
check("the index was reconciled back to the source count", total == expected, f"{total} vs {expected}")
check("no orphan rows remain",
      con.execute("select count(*) from search_index where entity_id like 'orphan-%'").fetchone()[0] == 0)

# ------------------------------------------ state 3: already healthy (no-op)
print("\nState 3 — already healthy")
con.close()
res = run_ensure()
check("a healthy index triggers no rebuild", "Rebuilding" not in res.stdout, res.stdout.strip())
check("a healthy index triggers no reindex", "drift detected" not in res.stdout.lower(), res.stdout.strip())
try:
    reported = json.loads(res.stdout.strip().splitlines()[-1])["total"]
    check("the reported total is still correct", reported == expected, f"{reported} vs {expected}")
except Exception as e:
    check("the reported total is still correct", False, f"parse error {e}: {res.stdout}")

# --------------------------------------- state 4: missing table entirely
print("\nState 4 — table missing (fresh install)")
con = sqlite3.connect(DB)
con.executescript("DROP TABLE IF EXISTS search_index;")
con.commit()
con.close()
res = run_ensure()
check("ensureSearchIndex created the table", "Creating FTS5 index" in res.stdout, res.stdout.strip())
con = sqlite3.connect(DB)
total = con.execute("select count(*) from search_index").fetchone()[0]
check("a fresh index is fully backfilled", total == expected, f"{total} vs {expected}")
con.close()

shutil.rmtree(tmpdir, ignore_errors=True)

print(f"\n{len(passed)}/{len(passed) + len(failed)} checks passed")
if failed:
    print("FAILED: " + ", ".join(failed))
    raise SystemExit(1)
print("FTS5 index self-healing verified (live database untouched).")
