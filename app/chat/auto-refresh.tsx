'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function ChatAutoRefresh() {
  const router = useRouter()
  useEffect(() => {
    const id = window.setInterval(() => router.refresh(), 15000)
    return () => window.clearInterval(id)
  }, [router])

  return null
}

