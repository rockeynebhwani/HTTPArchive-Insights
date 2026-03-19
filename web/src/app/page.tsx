'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const TrendsChart   = dynamic(() => import('@/components/TrendsChart'),   { ssr: false })
const MovementsView = dynamic(() => import('@/components/MovementsView'), { ssr: false })
const BubbleRace    = dynamic(() => import('@/components/BubbleRace'),    { ssr: false })

type Tab = 'trends' | 'movements' | 'bubble'

export default function Home() {
  const [tab, setTab] = useState<Tab>('trends')

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight">
            HTTPArchive Insights
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Ecommerce platform trends &amp; merchant movements
          </p>
        </div>
        <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1">
          {([
            ['trends',    'Growth Trends'],
            ['movements', 'Platform Movements'],
            ['bubble',    'Bubble Race'],
          ] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                tab === id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-muted hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 px-6 py-8 max-w-7xl mx-auto w-full">
        {tab === 'trends' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white">Platform Growth (2016 → present)</h2>
              <p className="text-sm text-muted mt-1">
                Number of sites detected per platform across all HTTPArchive monthly crawls
              </p>
            </div>
            <TrendsChart />
          </div>
        )}

        {tab === 'movements' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white">Merchant Movements</h2>
              <p className="text-sm text-muted mt-1">
                Month-over-month platform switches among top-ranked sites — click any flow to drill into merchants
              </p>
            </div>
            <MovementsView />
          </div>
        )}

        {tab === 'bubble' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white">Bubble Race</h2>
              <p className="text-sm text-muted mt-1">
                Platform market share animated over time — bubble size = number of detected sites. Hit Play to watch the ecommerce landscape evolve.
              </p>
            </div>
            <BubbleRace />
          </div>
        )}
      </main>

      <footer className="border-t border-border px-6 py-4 text-xs text-muted flex items-center justify-between">
        <span>Data: HTTPArchive · BigQuery public dataset</span>
        <form action="/api/auth" method="post" onSubmit={async e => {
          e.preventDefault()
          await fetch('/api/auth', { method: 'DELETE' })
          window.location.href = '/login'
        }}>
          <button type="submit" className="hover:text-white transition-colors">
            Sign out
          </button>
        </form>
      </footer>
    </div>
  )
}
