"""
Ecommerce Platform Movements pipeline.

Queries httparchive.crawl.pages for Shopify, WooCommerce, Magento, BigCommerce
domains per crawl month, stores results in SQLite platform_snapshots table.

Usage:
    python -m pipeline.ecommerce_platforms.query              # run latest month only
    python -m pipeline.ecommerce_platforms.query --backfill   # run all unqueried months
    python -m pipeline.ecommerce_platforms.query --find-start # binary search for first partition
    python -m pipeline.ecommerce_platforms.query --month 2024-03  # run a specific month
"""

import argparse
import sys

from pipeline.common.bq import get_client, list_partitions, probe_partition
from pipeline.common.db import open_db, get_queried_months, upsert_snapshots
from pipeline.common.partition_search import find_first_partition

# Update after running --find-start for the 'Ecommerce' category
_FIRST_PARTITION = "20200801"

PLATFORMS = ["Shopify", "WooCommerce", "Magento", "BigCommerce"]


def query_month(client, partition_id: str) -> list[tuple]:
    """
    Query all ecommerce platform domains for a given partition.
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
        GROUP BY domain, platform
    """

    rows = []
    for row in client.query(sql).result():
        if row.domain:
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

    # --- determine which months to process ---
    conn = open_db()
    already_queried = get_queried_months(conn)
    print(f"  {len(already_queried)} months already in DB")

    if month:
        # single month: convert '2024-03' → '20240301'
        target_pid = month.replace("-", "") + "01"
        if target_pid not in all_partitions:
            print(f"Partition {target_pid} not available. Available partitions:")
            for p in all_partitions[-5:]:
                print(f"  {p}")
            sys.exit(1)
        pending = [target_pid]
    elif backfill:
        pending = [p for p in all_partitions if f"{p[:4]}-{p[4:6]}" not in already_queried]
    else:
        # default: latest unqueried month only
        pending = [p for p in all_partitions if f"{p[:4]}-{p[4:6]}" not in already_queried]
        pending = pending[-1:] if pending else []

    if not pending:
        print("Nothing to do — all available months already queried.")
        return

    print(f"\nProcessing {len(pending)} partition(s): {pending[0]} … {pending[-1]}")

    total_rows = 0
    for pid in pending:
        snap = f"{pid[:4]}-{pid[4:6]}"
        print(f"  [{snap}] querying...", end=" ", flush=True)
        rows = query_month(client, pid)
        upsert_snapshots(conn, rows)
        total_rows += len(rows)
        print(f"{len(rows):,} rows")

    conn.close()
    print(f"\nDone. {total_rows:,} total rows written.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ecommerce platform pipeline")
    parser.add_argument("--backfill", action="store_true", help="Process all unqueried months")
    parser.add_argument("--find-start", action="store_true", help="Binary search for first partition (no DB writes)")
    parser.add_argument("--month", type=str, default=None, help="Process a single month e.g. 2024-03")
    args = parser.parse_args()

    run(backfill=args.backfill, find_start=args.find_start, month=args.month)


if __name__ == "__main__":
    main()
