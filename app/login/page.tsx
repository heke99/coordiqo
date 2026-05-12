import { Suspense } from 'react'

import { LoginForm } from '@/components/auth/login-form'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8">
          <div className="coordiqo-shell coordiqo-card p-8 text-sm text-slate-600">Laddar inloggning...</div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
