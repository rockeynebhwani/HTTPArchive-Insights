"""Unit tests for ecommerce_platforms pipeline (no BQ calls)."""

import sqlite3
import pytest

from pipeline.common.db import open_db, get_queried_months, upsert_snapshots
from pipeline.common.partition_search import find_first_partition


# ---------- db helpers ----------

def test_open_db_creates_table(tmp_path):
    db_path = tmp_path / "test.db"
    conn = open_db(db_path)
    tables = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()
    assert ("platform_snapshots",) in tables
    conn.close()


def test_upsert_and_query_months(tmp_path):
    conn = open_db(tmp_path / "test.db")
    rows = [
        ("2023-01", "example.com", "Shopify", 1000),
        ("2023-01", "store.io", "WooCommerce", 5000),
        ("2023-02", "example.com", "Shopify", 900),
    ]
    upsert_snapshots(conn, rows)
    months = get_queried_months(conn)
    assert months == {"2023-01", "2023-02"}
    conn.close()


def test_upsert_is_idempotent(tmp_path):
    conn = open_db(tmp_path / "test.db")
    row = [("2023-01", "example.com", "Shopify", 1000)]
    upsert_snapshots(conn, row)
    upsert_snapshots(conn, row)  # second write should not duplicate
    count = conn.execute("SELECT COUNT(*) FROM platform_snapshots").fetchone()[0]
    assert count == 1
    conn.close()


def test_upsert_updates_rank(tmp_path):
    conn = open_db(tmp_path / "test.db")
    upsert_snapshots(conn, [("2023-01", "example.com", "Shopify", 1000)])
    upsert_snapshots(conn, [("2023-01", "example.com", "Shopify", 500)])
    rank = conn.execute(
        "SELECT rank FROM platform_snapshots WHERE domain='example.com'"
    ).fetchone()[0]
    assert rank == 500
    conn.close()


# ---------- partition search ----------

def test_find_first_partition_basic():
    partitions = ["20220101", "20220201", "20220301", "20220401", "20220501"]
    # data exists from index 2 onwards
    probe = lambda pid: pid >= "20220301"
    result = find_first_partition(partitions, probe)
    assert result == "20220301"


def test_find_first_partition_all_miss():
    partitions = ["20220101", "20220201", "20220301"]
    result = find_first_partition(partitions, lambda pid: False)
    assert result is None


def test_find_first_partition_first_hit():
    partitions = ["20220101", "20220201", "20220301"]
    result = find_first_partition(partitions, lambda pid: True)
    assert result == "20220101"


def test_find_first_partition_empty():
    result = find_first_partition([], lambda pid: True)
    assert result is None
