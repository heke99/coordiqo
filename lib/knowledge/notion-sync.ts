import { supabaseAdmin } from '@/lib/supabase/admin'

type NotionSearchResult = {
  id: string
  url?: string
  object?: string
  last_edited_time?: string
  properties?: Record<string, unknown>
}

type NotionSearchResponse = {
  results?: NotionSearchResult[]
}

function notionTitle(page: NotionSearchResult) {
  const properties = page.properties ?? {}
  for (const value of Object.values(properties)) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) continue
    const maybe = value as { type?: string; title?: Array<{ plain_text?: string }>; rich_text?: Array<{ plain_text?: string }> }
    const title = maybe.title?.map((part) => part.plain_text ?? '').join('').trim()
    if (title) return title
    const richText = maybe.rich_text?.map((part) => part.plain_text ?? '').join('').trim()
    if (richText) return richText
  }
  return `Notion document ${page.id.slice(0, 8)}`
}

export async function syncNotionKnowledgeSource(params: {
  companyId: string
  actorUserId: string
  locale: string
}) {
  const apiKey = process.env.NOTION_API_KEY
  if (!apiKey) {
    return { status: 'not_configured' as const, documentsSeen: 0, documentsUpdated: 0, message: 'Kunskapskälla är inte konfigurerad.' }
  }

  const { data: source, error: sourceError } = await supabaseAdmin
    .from('knowledge_sources')
    .insert({
      company_id: params.companyId,
      source_type: 'notion',
      name: 'Notion',
      status: 'active',
      created_by: params.actorUserId,
    })
    .select('id')
    .single()
  if (sourceError) throw new Error(sourceError.message)

  const { data: run, error: runError } = await supabaseAdmin
    .from('notion_sync_runs')
    .insert({
      company_id: params.companyId,
      status: 'running',
      created_by: params.actorUserId,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (runError) throw new Error(runError.message)

  try {
    const response = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'notion-version': '2022-06-28',
      },
      body: JSON.stringify({
        page_size: 25,
        filter: { value: 'page', property: 'object' },
      }),
    })
    const payload = await response.json().catch(() => ({})) as NotionSearchResponse
    if (!response.ok) throw new Error(JSON.stringify(payload))

    let updated = 0
    for (const page of payload.results ?? []) {
      const title = notionTitle(page)
      const { data: existing } = await supabaseAdmin
        .from('knowledge_documents')
        .select('id')
        .eq('company_id', params.companyId)
        .eq('external_id', page.id)
        .maybeSingle()
      const documentPayload = {
        company_id: params.companyId,
        knowledge_source_id: source.id,
        title,
        external_id: page.id,
        url: page.url ?? null,
        locale: params.locale,
        status: 'active',
        last_synced_at: new Date().toISOString(),
        metadata: { object: page.object, lastEditedTime: page.last_edited_time },
      }
      const result = existing?.id
        ? await supabaseAdmin.from('knowledge_documents').update(documentPayload).eq('id', existing.id).select('id').single()
        : await supabaseAdmin.from('knowledge_documents').insert(documentPayload).select('id').single()
      if (result.error) throw new Error(result.error.message)
      updated += 1
    }

    await supabaseAdmin.from('notion_sync_runs').update({
      status: 'completed',
      documents_seen: payload.results?.length ?? 0,
      documents_updated: updated,
      completed_at: new Date().toISOString(),
    }).eq('id', run.id)
    return { status: 'completed' as const, documentsSeen: payload.results?.length ?? 0, documentsUpdated: updated }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Notion kunde inte synkas.'
    await supabaseAdmin.from('notion_sync_runs').update({
      status: 'failed',
      error_message: message,
      completed_at: new Date().toISOString(),
    }).eq('id', run.id)
    return { status: 'failed' as const, documentsSeen: 0, documentsUpdated: 0, message }
  }
}

