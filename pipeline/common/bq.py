"""BigQuery client and INFORMATION_SCHEMA helpers."""

import os
from google.cloud import bigquery


def get_client() -> bigquery.Client:
    return bigquery.Client(project=os.environ["GCP_PROJECT"])


def list_partitions(client: bigquery.Client, min_partition: str = "20200801") -> list[str]:
    """Return sorted list of partition_ids from INFORMATION_SCHEMA (free query)."""
    sql = f"""
        SELECT partition_id
        FROM `httparchive.crawl.INFORMATION_SCHEMA.PARTITIONS`
        WHERE table_name = 'pages'
          AND partition_id != '__NULL__'
          AND partition_id >= '{min_partition}'
        ORDER BY partition_id
    """
    rows = client.query(sql).result()
    return [row.partition_id for row in rows]


def probe_partition(
    client: bigquery.Client,
    partition_id: str,
    tech_names: list[str],
) -> bool:
    """Cheap LIMIT 1 probe — returns True if any matching rows exist in this partition."""
    names_list = ", ".join(f"'{n}'" for n in tech_names)
    crawl_date = f"{partition_id[:4]}-{partition_id[4:6]}-{partition_id[6:]}"
    sql = f"""
        SELECT 1
        FROM `httparchive.crawl.pages`,
        UNNEST(technologies) AS tech
        WHERE date = DATE('{crawl_date}')
          AND tech.technology IN ({names_list})
        LIMIT 1
    """
    rows = list(client.query(sql).result())
    return len(rows) > 0
