# HTTPArchive Insights

Personal analytics platform querying [HTTPArchive](https://httparchive.org/)'s public BigQuery dataset to produce web technology insights, published on my blog.

## Insights

### Ecommerce Platform Movements

Tracks which sites run Shopify, WooCommerce, Magento, and BigCommerce month-over-month using HTTPArchive crawl data — identifying churn, new adoption, and platform switches.

Data: `data/insights.db` → table `platform_snapshots`

## Pipeline

BigQuery → SQLite → GitHub Actions → static site

See [CLAUDE.md](CLAUDE.md) for the full pipeline pattern, cost model, and how to add new insights.

## Running locally

```bash
pip install -r pipeline/requirements.txt

export GOOGLE_APPLICATION_CREDENTIALS=/path/to/gcp-key.json
export GCP_PROJECT=my-gcp-project

# Find the first available partition for ecommerce data
python -m pipeline.ecommerce_platforms.query --find-start

# Backfill all history
python -m pipeline.ecommerce_platforms.query --backfill

# Run tests
pytest pipeline/
```

## GitHub Secrets

Set `GCP_SA_KEY` and `GCP_PROJECT` in the repo settings before triggering workflows.
