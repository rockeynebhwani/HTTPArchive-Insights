"""Unit tests for ecommerce_platforms pipeline (no BQ calls)."""

import pytest

from pipeline.common.db import (
    open_db,
    get_queried_months_trends,
    get_queried_months_snapshots,
    upsert_trends,
    upsert_snapshots,
)
from pipeline.common.partition_search import find_first_partition


# ---------- db: platform_trends ----------

def test_open_db_creates_tables(tmp_path):
    conn = open_db(tmp_path / "test.db")
    tables = {r[0] for r in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()}
    assert "platform_trends" in tables
    assert "platform_snapshots" in tables
    conn.close()


def test_upsert_trends_and_queried_months(tmp_path):
    conn = open_db(tmp_path / "test.db")
    rows = [
        ("2023-01", "Shopify", 120000),
        ("2023-01", "WooCommerce", 85000),
        ("2023-02", "Shopify", 125000),
    ]
    upsert_trends(conn, rows)
    months = get_queried_months_trends(conn)
    assert months == {"2023-01", "2023-02"}
    conn.close()


def test_upsert_trends_idempotent(tmp_path):
    conn = open_db(tmp_path / "test.db")
    row = [("2023-01", "Shopify", 120000)]
    upsert_trends(conn, row)
    upsert_trends(conn, row)
    count = conn.execute("SELECT COUNT(*) FROM platform_trends").fetchone()[0]
    assert count == 1
    conn.close()


def test_upsert_trends_updates_count(tmp_path):
    conn = open_db(tmp_path / "test.db")
    upsert_trends(conn, [("2023-01", "Shopify", 120000)])
    upsert_trends(conn, [("2023-01", "Shopify", 121500)])
    count = conn.execute(
        "SELECT site_count FROM platform_trends WHERE snapshot_month='2023-01' AND platform='Shopify'"
    ).fetchone()[0]
    assert count == 121500
    conn.close()


# ---------- db: platform_snapshots ----------

def test_upsert_snapshots_and_queried_months(tmp_path):
    conn = open_db(tmp_path / "test.db")
    rows = [
        ("2024-01", "example.com", "Shopify", 1000),
        ("2024-01", "store.io", "WooCommerce", 5000),
        ("2024-02", "example.com", "Shopify", 900),
    ]
    upsert_snapshots(conn, rows)
    months = get_queried_months_snapshots(conn)
    assert months == {"2024-01", "2024-02"}
    conn.close()


def test_upsert_snapshots_idempotent(tmp_path):
    conn = open_db(tmp_path / "test.db")
    row = [("2024-01", "example.com", "Shopify", 1000)]
    upsert_snapshots(conn, row)
    upsert_snapshots(conn, row)
    count = conn.execute("SELECT COUNT(*) FROM platform_snapshots").fetchone()[0]
    assert count == 1
    conn.close()


def test_upsert_snapshots_updates_rank(tmp_path):
    conn = open_db(tmp_path / "test.db")
    upsert_snapshots(conn, [("2024-01", "example.com", "Shopify", 1000)])
    upsert_snapshots(conn, [("2024-01", "example.com", "Shopify", 500)])
    rank = conn.execute(
        "SELECT rank FROM platform_snapshots WHERE domain='example.com'"
    ).fetchone()[0]
    assert rank == 500
    conn.close()


# ---------- partition search ----------

def test_find_first_partition_basic():
    partitions = ["20220101", "20220201", "20220301", "20220401", "20220501"]
    result = find_first_partition(partitions, lambda pid: pid >= "20220301")
    assert result == "20220301"


def test_find_first_partition_all_miss():
    result = find_first_partition(["20220101", "20220201"], lambda pid: False)
    assert result is None


def test_find_first_partition_first_hit():
    partitions = ["20220101", "20220201", "20220301"]
    result = find_first_partition(partitions, lambda pid: True)
    assert result == "20220101"


def test_find_first_partition_empty():
    assert find_first_partition([], lambda pid: True) is None
