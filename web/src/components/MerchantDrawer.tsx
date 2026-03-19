'use client'

import { useEffect, useState } from 'react'
import { PLATFORM_COLORS } from '@/lib/colors'

interface Merchant {
  domain: string
  rank: number | null
}

interface DrawerSelection {
  month: string
  from: string
  to: string
  count: number
  type?: 'switch' | 'new' | 'lost'
}

interface Props {
  selection: DrawerSelection | null
  onClose: () => void
}

export default function MerchantDrawer({ selection, onClose }: Props) {
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selection) return
    setLoading(true)
    setMerchants([])

    const params = new URLSearchParams({ month: selection.month, to: selection.to })
    if (selection.type === 'new') {
      params.set('type', 'new')
    } else if (selection.type === 'lost') {
      params.set('type', 'lost')
      params.set('to', selection.from)
    } else {
      params.set('from', selection.from)
    }

    fetch(`/api/merchants?${params}`)
      .then(r => r.json())
      .then(d => { setMerchants(d.merchants ?? []); setLoading(false) })
  }, [selection])

  const isOpen = !!selection

  const title = selection
    ? selection.type === 'new'
      ? `New on ${selection.to}`
      : selection.type === 'lost'
      ? `Left ${selection.from}`
      : `${selection.from} → ${selection.to}`
    : ''

  const fromColor = selection ? PLATFORM_COLORS[selection.from] ?? '#888' : '#888'
  const toColor = selection ? PLATFORM_COLORS[selection.to] ?? '#888' : '#888'

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-surface border-l border-border z-50 flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              {selection?.type !== 'new' && selection?.type !== 'lost' && (
                <>
                  <span style={{ color: fromColor }}>{selection?.from}</span>
                  <span className="text-muted">→</span>
                  <span style={{ color: toColor }}>{selection?.to}</span>
                </>
              )}
              {(selection?.type === 'new' || selection?.type === 'lost') && (
                <span style={{ color: toColor }}>{title}</span>
              )}
            </div>
            <p className="text-xs text-muted mt-0.5">
              {selection?.count.toLocaleString()} merchants · {selection?.month}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-white transition-colors p-1"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex items-center justify-center h-40 text-muted text-sm">
              Loading…
            </div>
          )}
          {!loading && merchants.length === 0 && (
            <div className="text-muted text-sm text-center mt-10">No merchants found.</div>
          )}
          {!loading && merchants.length > 0 && (
            <div className="space-y-1.5">
              {merchants.map((m, i) => (
                <div
                  key={m.domain}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted w-5 text-right">{i + 1}</span>
                    <a
                      href={`https://${m.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-white hover:text-indigo-400 transition-colors font-mono"
                    >
                      {m.domain}
                    </a>
                  </div>
                  {m.rank != null && (
                    <span className="text-xs text-muted">
                      #{m.rank.toLocaleString()}
                    </span>
                  )}
                </div>
              ))}
              {merchants.length === 500 && (
                <p className="text-xs text-muted text-center pt-3">
                  Showing top 500 by rank
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
