export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { requireAuth } from '@/lib/auth/session'

export default async function TasksPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null

  return (
    <AppShell auth={auth} title="Uppdrag" subtitle="Här byggs senare ärenden, besök, arbetsorder och återkommande uppdrag.">
      <EmptyState
        eyebrow="Kommande modul"
        title="Uppdragsmotorn kommer efter branschmotor och resurser"
        description="Den här sidan är förberedd i appskalet så navigationen känns komplett. Uppdrag, ärenden och arbetsorder byggs när personal, resurser och objektmodellen sitter korrekt."
      />
    </AppShell>
  )
}
