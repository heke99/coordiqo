export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireAuth } from '@/lib/auth/session'
import { markAllNotificationsReadAction, markNotificationReadAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function NotificationsPage() {
  const auth = await requireAuth()
  const companyId = auth.membership?.companyId

  let query = supabaseAdmin.from('notifications').select('*').order('created_at', { ascending: false }).limit(100)
  if (companyId) query = query.or(`recipient_user_id.eq.${auth.userId},company_id.eq.${companyId}`)
  else query = query.eq('recipient_user_id', auth.userId)
  const { data: notifications } = await query

  const unread = (notifications ?? []).filter((notification: any) => notification.status === 'unread').length

  return (
    <AppShell auth={auth} title="Notiser" subtitle="In-app notiser för invites, bolagsansökningar, avvikelser, resurser och driftbeslut.">
      <div className="space-y-5">
        <section className="coordiqo-card flex flex-wrap items-center justify-between gap-3 p-5">
          <div><p className="text-sm text-slate-500">Olästa notiser</p><p className="mt-1 text-3xl font-semibold text-slate-950">{unread}</p></div>
          <form action={markAllNotificationsReadAction}><button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Markera alla lästa</button></form>
        </section>

        <section className="space-y-3">
          {(notifications ?? []).map((notification: any) => (
            <div key={notification.id} className="coordiqo-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{notification.title}</p>
                  {notification.body ? <p className="mt-2 text-sm leading-6 text-slate-600">{notification.body}</p> : null}
                  <p className="mt-2 text-xs text-slate-500">{new Date(notification.created_at).toLocaleString('sv-SE')} · {notification.notification_type ?? 'notis'}</p>
                </div>
                <div className="flex flex-wrap gap-2"><StatusBadge status={notification.status} /><StatusBadge status={notification.severity ?? 'info'} /></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {notification.action_href ? <Link href={notification.action_href} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold">Öppna</Link> : null}
                {notification.status === 'unread' ? <form action={markNotificationReadAction}><input type="hidden" name="id" value={notification.id} /><button className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold">Markera läst</button></form> : null}
              </div>
            </div>
          ))}
          {!notifications?.length ? <section className="coordiqo-card p-6 text-sm text-slate-600">Inga notiser ännu.</section> : null}
        </section>
      </div>
    </AppShell>
  )
}
