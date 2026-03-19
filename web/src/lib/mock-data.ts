/**
 * Realistic mock data — used when the DB is empty or unavailable.
 * All values are approximate based on publicly known market trends.
 */

import { TrendRow, MovementRow, MerchantRow } from './db'

// ─── helpers ──────────────────────────────────────────────────────────────────

function monthRange(start: string, end: string): string[] {
  const months: string[] = []
  let [y, m] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`)
    m++; if (m > 12) { m = 1; y++ }
  }
  return months
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }

/** Smooth S-curve growth (logistic-ish) */
function scurve(t: number) { return t * t * (3 - 2 * t) }

function jitter(v: number, pct = 0.03): number {
  // deterministic jitter based on value to avoid hydration mismatches
  const noise = ((v * 2654435761) & 0xffff) / 0xffff - 0.5
  return Math.round(v * (1 + noise * pct))
}

// ─── trend curve definitions ──────────────────────────────────────────────────
// Format: { start2016, peak, peakYM, end2026 }  (peak = null means no peak)
const CURVES: Record<string, { s: number; p: number; pm: string; e: number }> = {
  'Shopify':                   { s: 4_200,   p: 520_000, pm: '2026-01', e: 520_000 },
  'WooCommerce':               { s: 29_000,  p: 750_000, pm: '2022-06', e: 610_000 },
  'Magento':                   { s: 38_000,  p: 185_000, pm: '2019-03', e: 42_000  },
  'BigCommerce':               { s: 1_600,   p: 28_000,  pm: '2026-01', e: 28_000  },
  'PrestaShop':                { s: 4_100,   p: 52_000,  pm: '2023-01', e: 42_000  },
  'Shopware':                  { s: 900,     p: 14_000,  pm: '2026-01', e: 14_000  },
  'Wix eCommerce':             { s: 1_800,   p: 82_000,  pm: '2026-01', e: 82_000  },
  'Squarespace Commerce':      { s: 3_200,   p: 61_000,  pm: '2026-01', e: 61_000  },
  'Salesforce Commerce Cloud': { s: 820,     p: 4_100,   pm: '2024-06', e: 3_600   },
  'SAP Commerce Cloud':        { s: 320,     p: 1_050,   pm: '2022-01', e: 880     },
  'HCL Commerce':              { s: 450,     p: 650,     pm: '2020-06', e: 320     },
  'Oracle Commerce':           { s: 1_250,   p: 1_300,   pm: '2017-03', e: 180     },
  'Oracle Commerce Cloud':     { s: 0,       p: 820,     pm: '2026-01', e: 820     },
  'commercetools':             { s: 0,       p: 2_100,   pm: '2026-01', e: 2_100   },
  'Centra':                    { s: 0,       p: 480,     pm: '2026-01', e: 480     },
}

const ALL_MONTHS = monthRange('2016-01', '2026-01')

function siteCountForMonth(platform: string, month: string): number {
  const c = CURVES[platform]
  if (!c) return 0
  const totalMonths = ALL_MONTHS.length
  const idx = ALL_MONTHS.indexOf(month)
  if (idx === -1) return 0
  const peakIdx = ALL_MONTHS.indexOf(c.pm)

  let val: number
  if (idx <= peakIdx) {
    const t = peakIdx === 0 ? 0 : idx / peakIdx
    val = lerp(c.s, c.p, scurve(t))
  } else {
    const remaining = totalMonths - 1 - peakIdx
    const t = remaining === 0 ? 1 : (idx - peakIdx) / remaining
    val = lerp(c.p, c.e, scurve(t))
  }
  return Math.max(0, jitter(Math.round(val)))
}

// ─── public API ───────────────────────────────────────────────────────────────

export function getMockTrends(): TrendRow[] {
  const rows: TrendRow[] = []
  for (const month of ALL_MONTHS) {
    for (const platform of Object.keys(CURVES)) {
      rows.push({ snapshot_month: month, platform, site_count: siteCountForMonth(platform, month) })
    }
  }
  return rows
}

export const MOCK_SNAPSHOT_MONTHS = ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01']

// Realistic inter-platform switch flows per month
// [from, to, count]
type Flow = [string, string, number]

const BASE_FLOWS: Flow[] = [
  ['Magento',          'Shopify',                    420],
  ['WooCommerce',      'Shopify',                    380],
  ['Magento',          'BigCommerce',                 95],
  ['Magento',          'commercetools',               42],
  ['WooCommerce',      'Squarespace Commerce',        88],
  ['WooCommerce',      'Wix eCommerce',               72],
  ['Shopify',          'WooCommerce',                110],
  ['Shopify',          'BigCommerce',                 38],
  ['PrestaShop',       'Shopify',                     62],
  ['PrestaShop',       'WooCommerce',                 45],
  ['Squarespace Commerce', 'Shopify',                 55],
  ['BigCommerce',      'Shopify',                     48],
  ['Salesforce Commerce Cloud', 'commercetools',      18],
  ['SAP Commerce Cloud', 'commercetools',             12],
  ['HCL Commerce',     'Shopify',                     22],
  ['Oracle Commerce',  'Shopify',                     35],
  ['Oracle Commerce',  'BigCommerce',                 14],
  ['Wix eCommerce',    'Shopify',                     30],
  ['Shopware',         'Shopify',                     28],
  ['Shopify',          'Shopware',                    15],
  ['Magento',          'SAP Commerce Cloud',          10],
]

// New entrants per platform per month (brand-new detected sites)
const BASE_GAINED: Record<string, number> = {
  'Shopify':                   2800,
  'WooCommerce':               1600,
  'BigCommerce':                280,
  'Wix eCommerce':              420,
  'Squarespace Commerce':       310,
  'PrestaShop':                 180,
  'Shopware':                    95,
  'commercetools':               55,
  'Centra':                      28,
  'Salesforce Commerce Cloud':   22,
  'SAP Commerce Cloud':          12,
  'Oracle Commerce Cloud':       18,
  'Magento':                     80,
  'HCL Commerce':                 5,
  'Oracle Commerce':              4,
}

// Sites no longer detected per month
const BASE_LOST: Record<string, number> = {
  'Magento':                   520,
  'WooCommerce':               980,
  'Shopify':                   740,
  'PrestaShop':                 210,
  'HCL Commerce':                35,
  'Oracle Commerce':             55,
  'Squarespace Commerce':       145,
  'BigCommerce':                 88,
  'Salesforce Commerce Cloud':   28,
  'Wix eCommerce':              180,
  'SAP Commerce Cloud':          18,
  'Shopware':                    42,
  'Oracle Commerce Cloud':       10,
  'commercetools':               12,
  'Centra':                       6,
}

function scaleWithNoise(v: number, monthIdx: number, scale = 1): number {
  // slight monthly variation
  const noise = 1 + ((monthIdx * 13 + v) % 17 - 8) / 100
  return Math.max(0, Math.round(v * scale * noise))
}

export function getMockMovements(month: string): {
  switches: MovementRow[]
  gained: Record<string, number>
  lost: Record<string, number>
  prevMonth: string | null
} {
  const idx = MOCK_SNAPSHOT_MONTHS.indexOf(month)
  if (idx === -1) return { switches: [], gained: {}, lost: {}, prevMonth: null }

  const prevMonth = idx > 0 ? MOCK_SNAPSHOT_MONTHS[idx - 1] : null
  if (!prevMonth) return { switches: [], gained: {}, lost: {}, prevMonth: null }

  const scale = 0.9 + idx * 0.05 // slight month-over-month growth
  const switches: MovementRow[] = BASE_FLOWS.map(([from_platform, to_platform, count]) => ({
    from_platform,
    to_platform,
    count: scaleWithNoise(count, idx, scale),
  })).filter(r => r.count > 0)

  const gained = Object.fromEntries(
    Object.entries(BASE_GAINED).map(([p, v]) => [p, scaleWithNoise(v, idx, scale)])
  )
  const lost = Object.fromEntries(
    Object.entries(BASE_LOST).map(([p, v]) => [p, scaleWithNoise(v, idx, scale)])
  )

  return { switches, gained, lost, prevMonth }
}

// Sample domain lists for drill-down (realistic-looking merchants)
const SAMPLE_DOMAINS: Record<string, string[]> = {
  'Magento→Shopify': [
    'barneys.com', 'neimanmarcus.com', 'saksoff5th.com', 'godivachocolatier.com',
    'fossil.com', 'Coach.com', 'mcmworldwide.com', 'stuartweitzman.com',
    'katespade.com', 'toryBurch.com', 'samsonite.com', 'victorinox.com',
    'swissarmybrand.com', 'briggs-riley.com', 'tumi.com', 'beis.com',
    'awaytravel.com', 'calpak.com', 'monos.com', 'horiznstudio.com',
  ],
  'WooCommerce→Shopify': [
    'beardbrand.com', 'groovebook.com', 'bombas.com', 'chubbiesshorts.com',
    'huckberry.com', 'taylor-stitch.com', 'pockets.com', 'ridgewallet.com',
    'ankertech.co', 'ugmonk.com', 'fieldnotesbrand.com', 'blackwingpencils.com',
  ],
  'Shopify→WooCommerce': [
    'artfulagenda.com', 'simplenote.co', 'craftleather.com', 'handmadeitem.co',
    'etsy-alt.com', 'smallbatch.shop', 'localhoney.co',
  ],
  'Magento→BigCommerce': [
    'papersource.com', 'bealls.com', 'skullcandy.com', 'volcom.com',
    'billabong.com', 'rvca.com', 'element.com', 'quiksilver.com',
  ],
  'PrestaShop→Shopify': [
    'decathlon.co.uk', 'lacoste.fr', 'kiabi.com', 'camaieu.com',
    'maisons-du-monde.fr', 'boulanger.fr',
  ],
  'default': [
    'example.com', 'shop.co', 'store.io', 'brand.shop',
    'goods.com', 'market.co', 'boutique.com',
  ],
}

export function getMockMerchants(
  fromPlatform: string,
  toPlatform: string,
): MerchantRow[] {
  const key = `${fromPlatform}→${toPlatform}`
  const domains = SAMPLE_DOMAINS[key] ?? SAMPLE_DOMAINS['default']
  return domains.map((domain, i) => ({
    domain,
    rank: (i + 1) * Math.round(1000 + Math.random() * 9000),
  }))
}

export function getMockMerchantsNewOrLost(
  platform: string,
  type: 'new' | 'lost',
): MerchantRow[] {
  const prefix = type === 'new' ? 'new-' : 'ex-'
  const baseDomains = SAMPLE_DOMAINS['default']
  return baseDomains.slice(0, 5).map((d, i) => ({
    domain: `${prefix}${platform.toLowerCase().replace(/\s+/g, '-')}-${i + 1}.com`,
    rank: (i + 1) * 5000,
  }))
}
