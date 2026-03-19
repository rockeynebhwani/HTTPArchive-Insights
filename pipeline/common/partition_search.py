"""Binary search to find the first partition with data for a given category."""

from typing import Callable


def find_first_partition(
    partitions: list[str],
    probe_fn: Callable[[str], bool],
) -> str | None:
    """
    Binary search over `partitions` to find the earliest one where probe_fn returns True.
    Prints progress to stdout. Returns the partition_id string, or None if none found.
    """
    if not partitions:
        return None

    lo, hi = 0, len(partitions) - 1
    result = None

    while lo <= hi:
        mid = (lo + hi) // 2
        pid = partitions[mid]
        print(f"  probing {pid} ...", end=" ", flush=True)
        found = probe_fn(pid)
        print("HIT" if found else "miss")
        if found:
            result = pid
            hi = mid - 1  # search earlier
        else:
            lo = mid + 1  # search later

    return result
