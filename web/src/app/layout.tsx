import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HTTPArchive Insights',
  description: 'Ecommerce platform movements and trends from HTTPArchive data',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-bg text-white">
        {children}
      </body>
    </html>
  )
}
