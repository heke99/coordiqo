export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { createTeamAction } from '@/lib/platform/actions'
import { requireAuth } from '@/lib/auth/session'

export default async function NewTeamPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null

  return (
    <AppShell auth={auth} title="Skapa team" subtitle="Lägg upp team, distrikt, patruller eller projektgrupper som kan användas i planeringen.">
      <FormCard title="Teamuppgifter" description="Håll teammodellen enkel i början. Områden och ansvarszoner kopplas på senare.">
        <form action={createTeamAction} className="grid gap-4 sm:grid-cols-2">
          <Field label="Namn"><input name="name" required className={inputClassName} placeholder="Till exempel Huvudteam" /></Field>
          <Field label="Kod"><input name="code" className={inputClassName} placeholder="DAG-SYD" /></Field>
          <Field label="Status"><select name="status" defaultValue="active" className={selectClassName}><option value="active">Aktiv</option><option value="inactive">Inaktiv</option></select></Field>
          <div className="sm:col-span-2"><Field label="Beskrivning"><textarea name="description" className={textareaClassName} placeholder="Vad ansvarar teamet för?" /></Field></div>
          <div className="sm:col-span-2"><button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Skapa team</button></div>
        </form>
      </FormCard>
    </AppShell>
  )
}
