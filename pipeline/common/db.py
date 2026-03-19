"""SQLite open/upsert helpers."""

import sqlite3
from pathlib import Path


DB_PATH = Path(__file__).parents[2] / "data" / "insights.db"


def open_db(path: Path = DB_PATH) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS platform_snapshots (
            snapshot_month TEXT NOT NULL,
            domain         TEXT NOT NULL,
            platform       TEXT NOT NULL,
            rank           INTEGER,
            PRIMARY KEY (snapshot_month, domain, platform)
        )
    """)
    conn.commit()
    return conn


def get_queried_months(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute("SELECT DISTINCT snapshot_month FROM platform_snapshots").fetchall()
    return {row[0] for row in rows}


def upsert_snapshots(conn: sqlite3.Connection, rows: list[tuple]) -> int:
    """rows: list of (snapshot_month, domain, platform, rank)"""
    conn.executemany("""
        INSERT OR REPLACE INTO platform_snapshots
            (snapshot_month, domain, platform, rank)
        VALUES (?, ?, ?, ?)
    """, rows)
    conn.commit()
    return len(rows)
