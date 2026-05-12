import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'Coordiqo',
  description: 'AI-driven operations and planning platform for field teams.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="sv" className="h-full antialiased">
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">{children}</body>
    </html>
  )
}
