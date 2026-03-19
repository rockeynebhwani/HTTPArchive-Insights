# HTTPArchive-Insights — CLAUDE.md

## Project overview

A personal analytics platform that queries HTTPArchive's public BigQuery dataset
and publishes web technology insights (ecommerce platform movements, etc.) on a
static/Next.js site.

---

## Pipeline pattern (BQ → SQLite → GitHub Actions → deploy)

### How it works

1. **Enumerate partitions** — `INFORMATION_SCHEMA.PARTITIONS` query (free, no scan).
2. **Find first partition** — binary search via `--find-start` (run once per new insight).
3. **Skip queried months** — check existing SQLite rows before querying BQ.
4. **Query one month at a time** — always filter `WHERE date = DATE('YYYY-MM-01')` to scan a single partition (~$0.05–0.10).
5. **Upsert into SQLite** — `INSERT OR REPLACE` keyed on `(snapshot_month, domain, ...)`.
6. **Commit to `data` branch** — `[vercel skip]` tag prevents Vercel from building that branch.
7. **sync-db-to-main** workflow copies the DB to `main` after converting WAL → DELETE mode (Vercel requirement).

### Cost model

| Operation | Cost |
|-----------|------|
| `INFORMATION_SCHEMA` query | Free |
| `LIMIT 1` probe | < $0.01 |
| Full month scan (`crawl.pages`) | ~$0.05–0.10 |
| Full backfill (5 years) | ~$3–6 |

### CLI flags (all pipeline scripts)

| Flag | Effect |
|------|--------|
| _(none)_ | Run the latest unqueried month |
| `--backfill` | Run all unqueried months |
| `--find-start` | Binary search for first data partition (no DB writes) |
| `--month 2024-03` | Run a single specific month |

---

## Directory structure

```
pipeline/
  common/
    bq.py               BigQuery client + INFORMATION_SCHEMA helpers
    db.py               SQLite open/upsert helpers
    partition_search.py Binary search for first partition
  ecommerce_platforms/
    query.py            Shopify/WooCommerce/Magento/BigCommerce pipeline
    tests/
      test_query.py     Unit tests (no BQ calls)
  requirements.txt

scripts/
  prepare-db.js         Convert WAL → DELETE mode before Vercel deploy

.github/workflows/
  ecommerce-platforms.yml   Main pipeline workflow
  sync-db-to-main.yml       Copies DB from data branch → main

data/
  insights.db           SQLite database (committed on data branch)
```

---

## Adding a new insight

1. Create `pipeline/<insight_name>/` with `__init__.py` and `query.py`.
2. Follow the same CLI pattern (`--backfill`, `--find-start`, `--month`).
3. Add new tables to `data/insights.db` via `db.py` helpers.
4. Copy `.github/workflows/ecommerce-platforms.yml` → `<insight-name>.yml` and update the module path.
5. Run `--find-start` to discover `_FIRST_PARTITION` for the new category.
6. Document the new category in `~/.claude/memory/httparchive_categories.md`.

---

## SQLite schema

### `platform_snapshots`

Populated by `pipeline/ecommerce_platforms/query.py`.

| Column | Type | Notes |
|--------|------|-------|
| `snapshot_month` | TEXT | `'YYYY-MM'` |
| `domain` | TEXT | Registered domain (e.g. `example.com`) |
| `platform` | TEXT | `'Shopify'`, `'WooCommerce'`, `'Magento'`, `'BigCommerce'` |
| `rank` | INTEGER | CrUX rank (lower = more popular); NULL if not in CrUX |

Primary key: `(snapshot_month, domain, platform)`

---

## GitHub Secrets required

| Secret | Description |
|--------|-------------|
| `GCP_SA_KEY` | Full JSON of GCP service account key |
| `GCP_PROJECT` | GCP project ID (billing target) |

---

## Running locally

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/gcp-key.json
export GCP_PROJECT=my-project-id

# Find first partition (run once)
python -m pipeline.ecommerce_platforms.query --find-start

# Backfill all history
python -m pipeline.ecommerce_platforms.query --backfill

# Run latest month
python -m pipeline.ecommerce_platforms.query

# Run specific month
python -m pipeline.ecommerce_platforms.query --month 2024-03

# Tests (no GCP creds needed)
pytest pipeline/
```

---

## Known first partitions

| Category | First Partition | Notes |
|----------|----------------|-------|
| `'Cross border ecommerce'` | `2022-05-01` | Found 2026-03-18 |
| `'Ecommerce'` | TBD — run `--find-start` | Likely earlier than 2022 |
