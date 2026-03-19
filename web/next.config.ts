import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  transpilePackages: ['d3-chord', 'd3-hierarchy', 'd3-sankey', 'd3-shape'],
}

export default nextConfig
