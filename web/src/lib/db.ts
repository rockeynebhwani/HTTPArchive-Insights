import path from 'path'

// Lazy require — keeps better-sqlite3 out of webpack's dependency graph at build time.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BetterSqlite3 = any

const DB_PATH = path.join(process.cwd(), '..', 'data', 'insights.db')

function getDb(): BetterSqlite3 | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3')
    return new Database(DB_PATH, { readonly: true, fileMustExist: true })
  } catch {
    return null
  }
}

export interface TrendRow {
  snapshot_month: string
  platform: string
  site_count: number
}

export interface MovementRow {
  from_platform: string
  to_platform: string
  count: number
}

export interface MerchantRow {
  domain: string
  rank: number | null
}

export function getTrends(): TrendRow[] {
  const db = getDb()
  if (!db) return []
  return db
    .prepare('SELECT snapshot_month, platform, site_count FROM platform_trends ORDER BY snapshot_month')
    .all() as TrendRow[]
}

export function getAvailableSnapshotMonths(): string[] {
  const db = getDb()
  if (!db) return []
  const rows = db
    .prepare('SELECT DISTINCT snapshot_month FROM platform_snapshots ORDER BY snapshot_month')
    .all() as { snapshot_month: string }[]
  return rows.map(r => r.snapshot_month)
}

export function getMovements(month: string): {
  switches: MovementRow[]
  gained: Record<string, number>
  lost: Record<string, number>
  prevMonth: string | null
} {
  const db = getDb()
  if (!db) return { switches: [], gained: {}, lost: {}, prevMonth: null }

  const prevRow = db
    .prepare('SELECT MAX(snapshot_month) as m FROM platform_snapshots WHERE snapshot_month < ?')
    .get(month) as { m: string | null }
  const prevMonth = prevRow?.m ?? null

  if (!prevMonth) return { switches: [], gained: {}, lost: {}, prevMonth: null }

  const switches = db.prepare(`
    SELECT
      prev.platform  AS from_platform,
      curr.platform  AS to_platform,
      COUNT(*)       AS count
    FROM platform_snapshots curr
    JOIN platform_snapshots prev
      ON curr.domain = prev.domain
     AND prev.snapshot_month = ?
    WHERE curr.snapshot_month = ?
      AND curr.platform != prev.platform
    GROUP BY from_platform, to_platform
    ORDER BY count DESC
  `).all(prevMonth, month) as MovementRow[]

  const gainedRows = db.prepare(`
    SELECT curr.platform, COUNT(*) as count
    FROM platform_snapshots curr
    WHERE curr.snapshot_month = ?
      AND NOT EXISTS (
        SELECT 1 FROM platform_snapshots prev
        WHERE prev.domain = curr.domain AND prev.snapshot_month = ?
      )
    GROUP BY curr.platform
  `).all(month, prevMonth) as { platform: string; count: number }[]

  const lostRows = db.prepare(`
    SELECT prev.platform, COUNT(*) as count
    FROM platform_snapshots prev
    WHERE prev.snapshot_month = ?
      AND NOT EXISTS (
        SELECT 1 FROM platform_snapshots curr
        WHERE curr.domain = prev.domain AND curr.snapshot_month = ?
      )
    GROUP BY prev.platform
  `).all(prevMonth, month) as { platform: string; count: number }[]

  const gained = Object.fromEntries(gainedRows.map(r => [r.platform, r.count]))
  const lost = Object.fromEntries(lostRows.map(r => [r.platform, r.count]))

  return { switches, gained, lost, prevMonth }
}

export function getMerchants(
  month: string,
  fromPlatform: string,
  toPlatform: string,
): MerchantRow[] {
  const db = getDb()
  if (!db) return []

  const prevRow = db
    .prepare('SELECT MAX(snapshot_month) as m FROM platform_snapshots WHERE snapshot_month < ?')
    .get(month) as { m: string | null }
  const prevMonth = prevRow?.m
  if (!prevMonth) return []

  return db.prepare(`
    SELECT curr.domain, curr.rank
    FROM platform_snapshots curr
    JOIN platform_snapshots prev
      ON curr.domain = prev.domain
     AND prev.snapshot_month = ?
     AND prev.platform = ?
    WHERE curr.snapshot_month = ?
      AND curr.platform = ?
    ORDER BY curr.rank ASC NULLS LAST
    LIMIT 500
  `).all(prevMonth, fromPlatform, month, toPlatform) as MerchantRow[]
}

// For "new entrants" or "churned" drill-down
export function getMerchantsNewOrLost(
  month: string,
  platform: string,
  type: 'new' | 'lost',
): MerchantRow[] {
  const db = getDb()
  if (!db) return []

  const prevRow = db
    .prepare('SELECT MAX(snapshot_month) as m FROM platform_snapshots WHERE snapshot_month < ?')
    .get(month) as { m: string | null }
  const prevMonth = prevRow?.m
  if (!prevMonth) return []

  if (type === 'new') {
    return db.prepare(`
      SELECT curr.domain, curr.rank
      FROM platform_snapshots curr
      WHERE curr.snapshot_month = ? AND curr.platform = ?
        AND NOT EXISTS (
          SELECT 1 FROM platform_snapshots prev
          WHERE prev.domain = curr.domain AND prev.snapshot_month = ?
        )
      ORDER BY curr.rank ASC NULLS LAST
      LIMIT 500
    `).all(month, platform, prevMonth) as MerchantRow[]
  } else {
    return db.prepare(`
      SELECT prev.domain, prev.rank
      FROM platform_snapshots prev
      WHERE prev.snapshot_month = ? AND prev.platform = ?
        AND NOT EXISTS (
          SELECT 1 FROM platform_snapshots curr
          WHERE curr.domain = prev.domain AND curr.snapshot_month = ?
        )
      ORDER BY prev.rank ASC NULLS LAST
      LIMIT 500
    `).all(prevMonth, platform, month) as MerchantRow[]
  }
}
