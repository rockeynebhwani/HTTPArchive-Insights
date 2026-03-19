"""
Ecommerce Platform Movements pipeline.

Two-table design:
  platform_trends    — aggregate site counts per platform per month, full history from 2016
  platform_snapshots — individual domains, last 24 months only (for movement/churn analysis)

Usage:
    python -m pipeline.ecommerce_platforms.query              # run latest month only
    python -m pipeline.ecommerce_platforms.query --backfill   # run all unqueried months
    python -m pipeline.ecommerce_platforms.query --find-start # binary search for first partition
    python -m pipeline.ecommerce_platforms.query --month 2024-03  # run a specific month
"""

import argparse
import sys
from datetime import datetime, timezone

from pipeline.common.bq import get_client, list_partitions, probe_partition
from pipeline.common.db import (
    open_db,
    get_queried_months_trends,
    get_queried_months_snapshots,
    upsert_trends,
    upsert_snapshots,
)
from pipeline.common.partition_search import find_first_partition

# Confirmed via --find-start 2026-03-19
_FIRST_PARTITION = "20160101"

# How many months back to store domain-level snapshots
_SNAPSHOT_MONTHS = 24

PLATFORMS = [
    # Mass market
    "Shopify",
    "WooCommerce",
    "Magento",
    "BigCommerce",
    "PrestaShop",
    "Shopware",
    "Wix eCommerce",
    "Squarespace Commerce",
    # Enterprise
    "Salesforce Commerce Cloud",
    "SAP Commerce Cloud",
    "HCL Commerce",
    "Oracle Commerce",
    "Oracle Commerce Cloud",
    "commercetools",
    "Centra",
]


def _cutoff_month(n_months: int) -> str:
    """Return the snapshot_month string N months before today, e.g. '2024-03'."""
    now = datetime.now(timezone.utc)
    total_months = now.year * 12 + now.month - 1 - n_months
    y, m = divmod(total_months, 12)
    return f"{y:04d}-{m+1:02d}"


def query_month_trends(client, partition_id: str) -> list[tuple]:
    """
    Aggregate count of distinct domains per platform for this partition.
    Returns list of (snapshot_month, platform, site_count).
    """
    crawl_date = f"{partition_id[:4]}-{partition_id[4:6]}-{partition_id[6:]}"
    snapshot_month = f"{partition_id[:4]}-{partition_id[4:6]}"
    names_list = ", ".join(f"'{p}'" for p in PLATFORMS)

    sql = f"""
        SELECT
          tech.technology             AS platform,
          COUNT(DISTINCT NET.REG_DOMAIN(page)) AS site_count
        FROM `httparchive.crawl.pages`,
        UNNEST(technologies) AS tech
        WHERE date = DATE('{crawl_date}')
          AND tech.technology IN ({names_list})
          AND NET.REG_DOMAIN(page) IS NOT NULL
        GROUP BY platform
    """

    rows = []
    for row in client.query(sql).result():
        rows.append((snapshot_month, row.platform, row.site_count))
    return rows


def query_month_snapshots(client, partition_id: str) -> list[tuple]:
    """
    Individual domain rows for this partition.
    Returns list of (snapshot_month, domain, platform, rank).
    """
    crawl_date = f"{partition_id[:4]}-{partition_id[4:6]}-{partition_id[6:]}"
    snapshot_month = f"{partition_id[:4]}-{partition_id[4:6]}"
    names_list = ", ".join(f"'{p}'" for p in PLATFORMS)

    sql = f"""
        SELECT
          NET.REG_DOMAIN(page) AS domain,
          tech.technology      AS platform,
          MIN(rank)            AS rank
        FROM `httparchive.crawl.pages`,
        UNNEST(technologies) AS tech
        WHERE date = DATE('{crawl_date}')
          AND tech.technology IN ({names_list})
          AND NET.REG_DOMAIN(page) IS NOT NULL
        GROUP BY domain, platform
    """

    rows = []
    for row in client.query(sql).result():
        rows.append((snapshot_month, row.domain, row.platform, row.rank))
    return rows


def run(backfill: bool, find_start: bool, month: str | None) -> None:
    client = get_client()

    print(f"Fetching available partitions (>= {_FIRST_PARTITION})...")
    all_partitions = list_partitions(client, min_partition=_FIRST_PARTITION)
    print(f"  {len(all_partitions)} partitions available")

    # --- find-start mode ---
    if find_start:
        print("\nRunning binary search for first partition with ecommerce data...")
        def probe(pid: str) -> bool:
            return probe_partition(client, pid, PLATFORMS)
        first = find_first_partition(all_partitions, probe)
        if first:
            print(f"\nFirst partition with data: {first}")
            print(f"  Update _FIRST_PARTITION = \"{first}\" in query.py")
        else:
            print("\nNo data found in any partition.")
        return

    conn = open_db()
    trends_done = get_queried_months_trends(conn)
    snapshots_done = get_queried_months_snapshots(conn)
    cutoff = _cutoff_month(_SNAPSHOT_MONTHS)
    print(f"  trends: {len(trends_done)} months done | snapshots: {len(snapshots_done)} months done")
    print(f"  snapshot cutoff: {cutoff} (last {_SNAPSHOT_MONTHS} months)")

    # --- determine pending partitions ---
    if month:
        target_pid = month.replace("-", "") + "01"
        if target_pid not in all_partitions:
            print(f"Partition {target_pid} not available.")
            sys.exit(1)
        pending = [target_pid]
    elif backfill:
        pending = [p for p in all_partitions if f"{p[:4]}-{p[4:6]}" not in trends_done]
    else:
        pending = [p for p in all_partitions if f"{p[:4]}-{p[4:6]}" not in trends_done]
        pending = pending[-1:] if pending else []

    if not pending:
        print("Nothing to do — all available months already queried.")
        conn.close()
        return

    print(f"\nProcessing {len(pending)} partition(s): {pending[0]} … {pending[-1]}")

    for pid in pending:
        snap = f"{pid[:4]}-{pid[4:6]}"
        needs_snapshot = snap >= cutoff and snap not in snapshots_done

        print(f"  [{snap}] trends...", end=" ", flush=True)
        trend_rows = query_month_trends(client, pid)
        upsert_trends(conn, trend_rows)
        print(f"{len(trend_rows)} platforms", end="")

        if needs_snapshot:
            print(f" | snapshots...", end=" ", flush=True)
            snap_rows = query_month_snapshots(client, pid)
            upsert_snapshots(conn, snap_rows)
            print(f"{len(snap_rows):,} domains", end="")

        print()

    conn.close()
    print(f"\nDone. {len(pending)} month(s) processed.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ecommerce platform pipeline")
    parser.add_argument("--backfill", action="store_true", help="Process all unqueried months")
    parser.add_argument("--find-start", action="store_true", help="Binary search for first partition (no DB writes)")
    parser.add_argument("--month", type=str, default=None, help="Process a single month e.g. 2024-03")
    args = parser.parse_args()

    run(backfill=args.backfill, find_start=args.find_start, month=args.month)


if __name__ == "__main__":
    main()
