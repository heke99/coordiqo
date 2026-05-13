export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { Field, inputClassName, selectClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireAuth } from '@/lib/auth/session'
import { applyCandidateToPlanningDraftItemAction, publishPlanningDraftAction, resolvePlanningConflictAction, savePlanningDraftAsTemplateAction, updatePlanningDraftItemAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function PlanningRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const { id } = await params

  const [{ data: run }, { data: draft }, { data: staff }, { data: teams }, { data: shifts }] = await Promise.all([
    supabaseAdmin.from('planning_runs').select('*, teams(name), staff_profiles(full_name), task_types(name)').eq('id', id).eq('company_id', auth.membership.companyId).is('archived_at', null).maybeSingle(),
    supabaseAdmin.from('planning_drafts').select('*').eq('planning_run_id', id).eq('company_id', auth.membership.companyId).is('archived_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('staff_profiles').select('id, full_name, primary_team_id').eq('company_id', auth.membership.companyId).eq('status', 'active').is('archived_at', null).order('full_name'),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
    supabaseAdmin.from('shifts').select('id, title, starts_at, ends_at, staff_profile_id, team_id, remaining_minutes, staff_profiles(full_name), teams(name)').eq('company_id', auth.membership.companyId).is('archived_at', null).order('starts_at', { ascending: true }).limit(300),
  ])

  if (!run) notFound()

  let items: any[] = []
  let candidates: any[] = []
  let scoreBreakdown: any[] = []
  let conflicts: any[] = []
  let publications: any[] = []
  let resourceAssignments: any[] = []

  if (draft) {
    const [itemsResult, candidatesResult, conflictsResult, publicationsResult, resourceAssignmentsResult] = await Promise.all([
      supabaseAdmin.from('planning_draft_items').select('id, task_id, candidate_id, staff_profile_id, team_id, shift_id, planned_start_at, planned_end_at, status, score, eligible, conflict_level, rejection_reason, explanation, is_locked, metadata, tasks(title, priority, status), staff_profiles(full_name), teams(name), shifts(title)').eq('company_id', auth.membership.companyId).eq('planning_draft_id', draft.id).is('archived_at', null).order('sort_order'),
      supabaseAdmin.from('assignment_candidates').select('id, task_id, staff_profile_id, team_id, shift_id, score, eligible, rejection_reason, explanation, metadata, staff_profiles(full_name), teams(name), shifts(title)').eq('company_id', auth.membership.companyId).eq('planning_draft_id', draft.id).is('archived_at', null).order('score', { ascending: false }).limit(150),
      supabaseAdmin.from('planning_conflicts').select('id, planning_draft_item_id, task_id, conflict_type, severity, status, message, created_at, staff_profiles(full_name), tasks(title)').eq('company_id', auth.membership.companyId).eq('planning_draft_id', draft.id).is('archived_at', null).order('created_at', { ascending: false }).limit(100),
      supabaseAdmin.from('planning_publications').select('id, status, published_assignment_ids, skipped_count, created_at').eq('company_id', auth.membership.companyId).eq('planning_draft_id', draft.id).is('archived_at', null).order('created_at', { ascending: false }),
      supabaseAdmin.from('planning_resource_assignments').select('id, planning_draft_item_id, task_id, resource_asset_id, actual_resource_asset_id, resource_type_id, status, note, resource_assets(name), resource_types(name)').eq('company_id', auth.membership.companyId).eq('planning_draft_id', draft.id).is('archived_at', null).order('created_at'),
    ])

    items = itemsResult.data ?? []
    candidates = candidatesResult.data ?? []
    conflicts = conflictsResult.data ?? []
    publications = publicationsResult.data ?? []
    resourceAssignments = resourceAssignmentsResult.data ?? []

    const candidateIds = candidates.map((candidate: any) => candidate.id).filter(Boolean)
    if (candidateIds.length) {
      const { data } = await supabaseAdmin
        .from('candidate_score_breakdown')
        .select('id, candidate_id, score_key, label, points, max_points, is_blocking, message')
        .eq('company_id', auth.membership.companyId)
        .in('candidate_id', candidateIds)
        .order('created_at')
      scoreBreakdown = data ?? []
    }
  }


  const resourcesByItem = new Map<string, any[]>()
  for (const assignment of resourceAssignments ?? []) {
    if (!assignment.planning_draft_item_id) continue
    const list = resourcesByItem.get(assignment.planning_draft_item_id) ?? []
    list.push(assignment)
    resourcesByItem.set(assignment.planning_draft_item_id, list)
  }

  const conflictsByItem = new Map<string, any[]>()
  for (const conflict of conflicts ?? []) {
    if (!conflict.planning_draft_item_id) continue
    const list = conflictsByItem.get(conflict.planning_draft_item_id) ?? []
    list.push(conflict)
    conflictsByItem.set(conflict.planning_draft_item_id, list)
  }

  const candidatesByTask = new Map<string, any[]>()
  for (const candidate of candidates ?? []) {
    const list = candidatesByTask.get(candidate.task_id) ?? []
    list.push(candidate)
    candidatesByTask.set(candidate.task_id, list)
  }

  const scoreBreakdownByCandidate = new Map<string, any[]>()
  for (const part of scoreBreakdown ?? []) {
    const list = scoreBreakdownByCandidate.get(part.candidate_id) ?? []
    list.push(part)
    scoreBreakdownByCandidate.set(part.candidate_id, list)
  }

  return (
    <AppShell
      auth={auth}
      title={run.name}
      subtitle="Granska planeringsutkast, konflikter, kandidater och publicera valda rader."
      actions={<Link href="/planning/runs/new" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Ny körning</Link>}
    >
      <div className="space-y-5">
        <section className="coordiqo-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">{run.date_from ?? 'datum saknas'} – {run.date_to ?? run.date_from ?? 'datum saknas'} · {run.teams?.name ?? run.staff_profiles?.full_name ?? 'alla'}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Motorn skapade {run.summary?.draftItems ?? 0} draft-rader, {run.summary?.candidates ?? 0} kandidater, {run.summary?.hardConflicts ?? 0} hårda konflikter och {run.summary?.softConflicts ?? 0} mjuka varningar.</p>
              {run.error_message ? <p className="mt-2 text-sm text-red-600">{run.error_message}</p> : null}
            </div>
            <StatusBadge status={run.status} />
          </div>
        </section>

        {draft ? (
          <>
          <form id="save-template-form" action={savePlanningDraftAsTemplateAction} className="hidden">
            <input type="hidden" name="draft_id" value={draft.id} />
            <input type="hidden" name="template_type" value="operational" />
          </form>
          <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
            <section className="space-y-5">
              <form action={publishPlanningDraftAction} className="coordiqo-card p-5">
                <input type="hidden" name="draft_id" value={draft.id} />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">{draft.title}</h2>
                    <p className="mt-1 text-sm text-slate-500">Välj rader och publicera till riktiga task_assignments. Rader med hård konflikt hoppas över.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select name="lock_assignments" defaultValue="false" className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800"><option value="false">Lås inte</option><option value="true">Lås publicerade</option></select>
                    <button className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Publicera valda</button>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-950">Spara som planeringsmall</p>
                  <p className="mt-1 text-xs text-slate-500">Batch 8C: återanvänd samma uppdrag, tider, personal/team och ordning som ett nytt utkast senare.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <input form="save-template-form" name="name" className={inputClassName} placeholder={`Mall · ${run.name}`} />
                    <input form="save-template-form" name="description" className={inputClassName} placeholder="Kort beskrivning" />
                    <button form="save-template-form" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800">Spara mall</button>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {items?.length ? items.map((item: any) => {
                    const itemConflicts = conflictsByItem.get(item.id) ?? []
                    const itemResources = resourcesByItem.get(item.id) ?? []
                    const itemCandidates = candidatesByTask.get(item.task_id) ?? []
                    const canPublish = item.eligible && item.conflict_level !== 'hard' && item.conflict_level !== 'blocked' && item.status !== 'published'
                    return (
                      <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex gap-3">
                            <input type="checkbox" name="draft_item_ids" value={item.id} disabled={!canPublish} defaultChecked={canPublish} className="mt-1" />
                            <div>
                              <p className="font-semibold text-slate-950">{item.tasks?.title ?? 'Uppdrag'}</p>
                              <p className="mt-1 text-sm text-slate-500">{item.staff_profiles?.full_name ?? item.teams?.name ?? 'Ingen kandidat'} · {item.planned_start_at ? new Date(item.planned_start_at).toLocaleString('sv-SE') : 'start saknas'} – {item.planned_end_at ? new Date(item.planned_end_at).toLocaleString('sv-SE') : 'slut saknas'}</p>
                              <p className="mt-2 text-sm leading-6 text-slate-600">{item.explanation}</p>
                              {itemResources.length ? <div className="mt-3 flex flex-wrap gap-2">{itemResources.map((assignment: any) => <span key={assignment.id} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">{assignment.resource_assets?.name ?? assignment.resource_types?.name ?? assignment.note ?? 'Resurs'} · {assignment.status}</span>)}</div> : null}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2"><StatusBadge status={item.status} /><StatusBadge status={item.conflict_level} tone={['hard', 'blocked'].includes(item.conflict_level) ? 'danger' : item.conflict_level === 'none' ? 'success' : 'warning'} /><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">score {item.score}</span></div>
                        </div>

                        {itemConflicts.length ? <div className="mt-4 space-y-2">{itemConflicts.map((conflict: any) => <div key={conflict.id} className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{conflict.message}</div>)}</div> : null}

                        {itemCandidates.length ? <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-800">Visa kandidater och score</summary><div className="mt-3 space-y-3">{itemCandidates.slice(0, 5).map((candidate: any) => {
                          const parts = scoreBreakdownByCandidate.get(candidate.id) ?? []
                          return (
                            <div key={candidate.id} className="rounded-2xl bg-white p-3 text-sm">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-slate-950">{candidate.staff_profiles?.full_name ?? candidate.teams?.name ?? 'Kandidat'}</p>
                                  <p className="mt-1 text-xs text-slate-500">score {candidate.score} · {candidate.eligible ? 'kan användas' : candidate.rejection_reason}</p>
                                </div>
                                <form action={applyCandidateToPlanningDraftItemAction}>
                                  <input type="hidden" name="planning_draft_id" value={draft.id} />
                                  <input type="hidden" name="planning_draft_item_id" value={item.id} />
                                  <input type="hidden" name="candidate_id" value={candidate.id} />
                                  <button disabled={candidate.id === item.candidate_id} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-40">Använd kandidat</button>
                                </form>
                              </div>
                              {parts.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{parts.map((part: any) => <div key={part.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"><p className="text-xs font-semibold text-slate-800">{part.label} · {part.points}p</p>{part.message ? <p className="mt-1 text-xs text-slate-500">{part.message}</p> : null}</div>)}</div> : null}
                            </div>
                          )
                        })}</div></details> : null}
                      </div>
                    )
                  }) : <p className="text-sm text-slate-600">Utkastet saknar rader.</p>}
                </div>
              </form>

              <section className="coordiqo-card p-5">
                <h2 className="text-lg font-semibold text-slate-950">Redigera draft-rad manuellt</h2>
                <p className="mt-1 text-sm text-slate-500">Använd vid snabb justering innan publicering. Efter ändring kan du publicera från listan ovan.</p>
                <form action={updatePlanningDraftItemAction} className="mt-5 grid gap-4">
                  <input type="hidden" name="planning_draft_id" value={draft.id} />
                  <Field label="Draft-rad"><select name="id" required className={selectClassName}><option value="">Välj rad</option>{items?.map((item: any) => <option key={item.id} value={item.id}>{item.tasks?.title ?? item.task_id}</option>)}</select></Field>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Personal"><select name="staff_profile_id" className={selectClassName}><option value="">Ingen</option>{staff?.map((person: any) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></Field>
                    <Field label="Team"><select name="team_id" className={selectClassName}><option value="">Inget</option>{teams?.map((team: any) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>
                    <Field label="Pass"><select name="shift_id" className={selectClassName}><option value="">Inget</option>{shifts?.map((shift: any) => <option key={shift.id} value={shift.id}>{new Date(shift.starts_at).toLocaleString('sv-SE')} · {shift.staff_profiles?.full_name ?? shift.teams?.name ?? 'pass'}</option>)}</select></Field>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Start"><input name="planned_start_at" type="datetime-local" className={inputClassName} /></Field>
                    <Field label="Slut"><input name="planned_end_at" type="datetime-local" className={inputClassName} /></Field>
                    <Field label="Status"><select name="status" defaultValue="proposed" className={selectClassName}><option value="proposed">Föreslagen</option><option value="accepted">Accepterad</option><option value="rejected">Avvisad</option><option value="cancelled">Avbruten</option></select></Field>
                  </div>
                  <Field label="Förklaring"><input name="explanation" className={inputClassName} /></Field>
                  <Field label="Lås rad"><select name="is_locked" defaultValue="false" className={selectClassName}><option value="false">Nej</option><option value="true">Ja</option></select></Field>
                  <Field label="Låsningsorsak"><input name="locked_reason" className={inputClassName} /></Field>
                  <button className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800">Spara draft-rad</button>
                </form>
              </section>
            </section>

            <aside className="space-y-5">
              <section className="coordiqo-card p-5">
                <h2 className="text-lg font-semibold text-slate-950">Konflikter</h2>
                <div className="mt-4 space-y-3">
                  {conflicts?.length ? conflicts.map((conflict: any) => (
                    <div key={conflict.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-semibold text-amber-950">{conflict.message}</p><p className="mt-1 text-xs text-amber-800">{conflict.tasks?.title ?? 'Uppdrag'} · {conflict.status}</p></div>
                        <StatusBadge status={conflict.severity} tone={['hard', 'critical', 'blocked'].includes(conflict.severity) ? 'danger' : 'warning'} />
                      </div>
                      {conflict.status === 'open' ? <form action={resolvePlanningConflictAction} className="mt-3 grid gap-2"><input type="hidden" name="id" value={conflict.id} /><select name="resolution_type" defaultValue="resolved" className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs"><option value="resolved">Löst</option><option value="override">Override</option><option value="accept_risk">Acceptera risk</option></select><input name="reason" className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs" placeholder="Orsak" /><button className="rounded-xl bg-amber-900 px-3 py-2 text-xs font-semibold text-white">Spara</button></form> : null}
                    </div>
                  )) : <p className="text-sm text-slate-600">Inga konflikter.</p>}
                </div>
              </section>

              <section className="coordiqo-card p-5">
                <h2 className="text-lg font-semibold text-slate-950">Publiceringar</h2>
                <div className="mt-4 space-y-3">{publications?.length ? publications.map((publication: any) => <div key={publication.id} className="rounded-2xl border border-slate-200 bg-white p-4"><StatusBadge status={publication.status} /><p className="mt-2 text-sm text-slate-600">{publication.published_assignment_ids?.length ?? 0} tilldelningar · {publication.skipped_count ?? 0} hoppades över</p><p className="mt-1 text-xs text-slate-400">{new Date(publication.created_at).toLocaleString('sv-SE')}</p></div>) : <p className="text-sm text-slate-600">Inte publicerad ännu.</p>}</div>
              </section>
            </aside>
          </div>
          </>
        ) : (
          <section className="coordiqo-card p-5"><p className="text-sm text-slate-600">Ingen draft kopplad till denna körning.</p></section>
        )}
      </div>
    </AppShell>
  )
}
