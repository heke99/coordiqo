export const dynamic = 'force-dynamic'

import { Field, FormCard, inputClassName } from '@/components/ui/form-card'
import { acceptInvitationAction } from '@/lib/platform/actions'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function AcceptInvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams
  const token = params.token ?? ''
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: invite } = token
    ? await supabaseAdmin.from('company_invitations').select('email, full_name, role, status, expires_at, companies(name)').eq('token', token).maybeSingle()
    : { data: null as any }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white">Cq</div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">Acceptera inbjudan</h1>
          <p className="mt-2 text-sm text-slate-600">Du behöver vara inloggad med samma e-postadress som inbjudan skickades till.</p>
        </div>
        <FormCard title="Invite" description={invite ? `Inbjudan till ${invite.companies?.name ?? 'företag'} som ${invite.role}.` : 'Länken kunde inte läsas eller saknar token.'}>
          {invite ? (
            <form action={acceptInvitationAction} className="grid gap-4">
              <input type="hidden" name="token" value={token} />
              <Field label="Inbjudan gäller"><input readOnly value={invite.email} className={inputClassName} /></Field>
              <Field label="Du är inloggad som"><input readOnly value={user?.email ?? 'Inte inloggad'} className={inputClassName} /></Field>
              {!user ? <a href="/login" className="rounded-2xl bg-slate-950 px-5 py-3 text-center text-sm font-semibold text-white">Logga in först</a> : <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Acceptera inbjudan</button>}
            </form>
          ) : <p className="text-sm text-slate-600">Be administratören skicka en ny inbjudan.</p>}
        </FormCard>
      </div>
    </main>
  )
}
