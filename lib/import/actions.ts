'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { assertCompanyPermission } from '@/lib/auth/permissions'
import { requireAuth } from '@/lib/auth/session'
import { logAuditEvent } from '@/lib/platform/audit'
import { supabaseAdmin } from '@/lib/supabase/admin'

type ImportTarget = 'staff' | 'resources' | 'entities' | 'tasks' | 'projects'

type ParsedRow = {
  rowNumber: number
  values: Record<string, string>
}

const targetLabels: Record<ImportTarget, string> = {
  staff: 'personal',
  resources: 'resurser',
  entities: 'objekt',
  tasks: 'uppdrag',
  projects: 'projekt',
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null
}

function normalizeHeader(header: string) {
  const normalized = header.trim().toLowerCase().replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  const aliases: Record<string, string> = {
    namn: 'full_name',
    name: 'name',
    full_name: 'full_name',
    personal: 'full_name',
    medarbetare: 'full_name',
    e_post: 'email',
    epost: 'email',
    mail: 'email',
    telefon: 'phone',
    mobil: 'phone',
    team: 'team',
    roll: 'job_title',
    titel: 'job_title',
    befattning: 'job_title',
    resurs: 'name',
    tagg: 'asset_tag',
    asset_tag: 'asset_tag',
    typ: 'resource_type',
    resurstyp: 'resource_type',
    plats: 'location_label',
    adress: 'location_label',
    objekt: 'name',
    kund: 'name',
    kundnummer: 'external_id',
    extern_id: 'external_id',
    uppdrag: 'title',
    titel_uppdrag: 'title',
    projekt: 'name',
    budget: 'budget_amount',
    deadline: 'deadline_date',
    prioritet: 'priority',
    status: 'status',
  }
  return aliases[normalized] ?? normalized
}

function splitLine(line: string) {
  const delimiter = line.includes('\t') ? '\t' : ';'
  const fallbackDelimiter = line.includes(',') && !line.includes(';') && !line.includes('\t') ? ',' : delimiter
  return line.split(fallbackDelimiter).map((cell) => cell.trim().replace(/^"|"$/g, ''))
}

function parseTabularText(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const headers = splitLine(lines[0]).map(normalizeHeader)
  return lines.slice(1).map((line, index) => {
    const cells = splitLine(line)
    const values: Record<string, string> = {}
    headers.forEach((header, cellIndex) => {
      values[header] = cells[cellIndex] ?? ''
    })
    return { rowNumber: index + 2, values }
  })
}

async function requireImportAccess() {
  const auth = await requireAuth()
  if (!auth.membership) redirect('/login')
  assertCompanyPermission(auth.membership.companyRole, 'operations_manager', 'att importera data')
  return auth
}

async function getOrCreateTeam(companyId: string, name: string | null | undefined) {
  if (!name) return null
  const { data: existing } = await supabaseAdmin.from('teams').select('id').eq('company_id', companyId).ilike('name', name).maybeSingle()
  if (existing?.id) return existing.id
  const { data, error } = await supabaseAdmin.from('teams').insert({ company_id: companyId, name, status: 'active' }).select('id').single()
  if (error) throw new Error(error.message)
  return data.id as string
}

async function getOrCreateResourceType(companyId: string, name: string | null | undefined) {
  const resourceName = name || 'Allmän resurs'
  const code = resourceName.toLowerCase().replace(/[^a-z0-9åäö]+/gi, '_').replace(/^_+|_+$/g, '')
  const { data: existing } = await supabaseAdmin.from('resource_types').select('id').eq('company_id', companyId).eq('code', code).maybeSingle()
  if (existing?.id) return existing.id
  const { data, error } = await supabaseAdmin.from('resource_types').insert({ company_id: companyId, code, name: resourceName }).select('id').single()
  if (error) throw new Error(error.message)
  return data.id as string
}

async function getDefaultEntityType(companyId: string) {
  const { data } = await supabaseAdmin.from('entity_types').select('id').eq('company_id', companyId).eq('is_active', true).is('archived_at', null).order('sort_order').limit(1).maybeSingle()
  return data?.id ?? null
}

function parseNumber(value: string | null | undefined) {
  if (!value) return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

async function importRow(target: ImportTarget, companyId: string, actorUserId: string, importRunId: string, row: ParsedRow) {
  const v = row.values
  if (target === 'staff') {
    const fullName = v.full_name || v.name
    if (!fullName) return { status: 'failed' as const, error: 'Namn saknas.' }
    if (v.email) {
      const { data: duplicate } = await supabaseAdmin.from('staff_profiles').select('id').eq('company_id', companyId).eq('email', v.email).is('archived_at', null).maybeSingle()
      if (duplicate) return { status: 'failed' as const, error: 'E-post finns redan på personal.' }
    }
    const teamId = await getOrCreateTeam(companyId, v.team)
    const { data, error } = await supabaseAdmin.from('staff_profiles').insert({
      company_id: companyId,
      full_name: fullName,
      email: v.email || null,
      phone: v.phone || null,
      employee_id: v.employee_id || null,
      job_title: v.job_title || null,
      primary_team_id: teamId,
      status: v.status || 'active',
      staff_kind: 'employee',
      transport_mode: v.transport_mode || 'car',
      created_by: actorUserId,
      updated_by: actorUserId,
      import_run_id: importRunId,
    }).select('id').single()
    if (error) return { status: 'failed' as const, error: error.message }
    return { status: 'imported' as const, entityType: 'staff_profile', entityId: data.id as string }
  }

  if (target === 'resources') {
    const name = v.name
    if (!name) return { status: 'failed' as const, error: 'Resursnamn saknas.' }
    const resourceTypeId = await getOrCreateResourceType(companyId, v.resource_type)
    const { data, error } = await supabaseAdmin.from('resource_assets').insert({
      company_id: companyId,
      name,
      asset_tag: v.asset_tag || null,
      resource_type_id: resourceTypeId,
      status: v.status || 'available',
      location_label: v.location_label || null,
      created_by: actorUserId,
      updated_by: actorUserId,
      import_run_id: importRunId,
    }).select('id').single()
    if (error) return { status: 'failed' as const, error: error.message }
    return { status: 'imported' as const, entityType: 'resource_asset', entityId: data.id as string }
  }

  if (target === 'entities') {
    const name = v.name || v.full_name
    if (!name) return { status: 'failed' as const, error: 'Objektnamn saknas.' }
    const entityTypeId = await getDefaultEntityType(companyId)
    if (!entityTypeId) return { status: 'failed' as const, error: 'Ingen aktiv objekttyp finns.' }
    const teamId = await getOrCreateTeam(companyId, v.team)
    const { data, error } = await supabaseAdmin.from('entities').insert({
      company_id: companyId,
      entity_type_id: entityTypeId,
      primary_team_id: teamId,
      name,
      external_id: v.external_id || null,
      status: v.status || 'active',
      priority: v.priority || 'normal',
      summary: v.summary || null,
      created_by: actorUserId,
      updated_by: actorUserId,
      import_run_id: importRunId,
    }).select('id').single()
    if (error) return { status: 'failed' as const, error: error.message }
    return { status: 'imported' as const, entityType: 'entity', entityId: data.id as string }
  }

  if (target === 'tasks') {
    const title = v.title || v.name
    if (!title) return { status: 'failed' as const, error: 'Uppdragstitel saknas.' }
    const duration = parseNumber(v.duration_minutes) ?? 60
    const { data, error } = await supabaseAdmin.from('tasks').insert({
      company_id: companyId,
      title,
      status: v.status || 'open',
      priority: v.priority || 'normal',
      location_label: v.location_label || null,
      estimated_duration_minutes: duration,
      created_by: actorUserId,
      updated_by: actorUserId,
      import_run_id: importRunId,
    }).select('id').single()
    if (error) return { status: 'failed' as const, error: error.message }
    return { status: 'imported' as const, entityType: 'task', entityId: data.id as string }
  }

  const name = v.name || v.title
  if (!name) return { status: 'failed' as const, error: 'Projektnamn saknas.' }
  const { data, error } = await supabaseAdmin.from('projects').insert({
    company_id: companyId,
    name,
    project_type: v.project_type || 'custom',
    status: v.status || 'draft',
    priority: v.priority || 'normal',
    budget_amount: parseNumber(v.budget_amount),
    deadline_date: v.deadline_date || null,
    created_by: actorUserId,
    updated_by: actorUserId,
    import_run_id: importRunId,
  }).select('id').single()
  if (error) return { status: 'failed' as const, error: error.message }
  return { status: 'imported' as const, entityType: 'project', entityId: data.id as string }
}

export async function runPasteImportAction(formData: FormData) {
  const auth = await requireImportAccess()
  const target = (value(formData, 'target') ?? 'staff') as ImportTarget
  if (!Object.keys(targetLabels).includes(target)) throw new Error('Ogiltig importtyp.')

  const pastedText = value(formData, 'pasted_text')
  const file = formData.get('file')
  const fileText = file instanceof File && file.size > 0 ? await file.text() : null
  const sourceText = pastedText || fileText
  if (!sourceText) throw new Error('Klistra in data eller ladda upp en CSV-fil.')
  const rows = parseTabularText(sourceText)
  if (!rows.length) throw new Error('Importen behöver en rubrikrad och minst en datarad.')

  const companyId = auth.membership!.companyId
  const { data: run, error } = await supabaseAdmin.from('import_runs').insert({
    company_id: companyId,
    import_type: target,
    source_name: file instanceof File && file.size > 0 ? file.name : 'copy-paste',
    status: 'running',
    rows_total: rows.length,
    created_by: auth.userId,
    summary: { source: 'import_center', target },
  }).select('id').single()
  if (error) throw new Error(error.message)

  let imported = 0
  let failed = 0
  for (const row of rows) {
    const result = await importRow(target, companyId, auth.userId, run.id, row)
    if (result.status === 'imported') imported += 1
    else failed += 1
    await supabaseAdmin.from('import_run_items').insert({
      company_id: companyId,
      import_run_id: run.id,
      row_number: row.rowNumber,
      status: result.status === 'imported' ? 'imported' : 'failed',
      source_payload: row.values,
      mapped_entity_type: result.status === 'imported' ? result.entityType : null,
      mapped_entity_id: result.status === 'imported' ? result.entityId : null,
      error_message: result.status === 'failed' ? result.error : null,
    })
  }

  await supabaseAdmin.from('import_runs').update({
    status: failed ? 'partial' : 'completed',
    rows_imported: imported,
    rows_failed: failed,
    completed_at: new Date().toISOString(),
    summary: { imported, failed, total: rows.length, target },
  }).eq('id', run.id)

  await logAuditEvent({
    companyId,
    actorUserId: auth.userId,
    action: 'import.completed',
    entityType: 'import_run',
    entityId: run.id,
    metadata: { imported, failed, target },
  })
  revalidatePath('/import')
}

