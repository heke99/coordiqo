export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { EntityForm } from '@/components/entities/entity-form'
import { FormCard } from '@/components/ui/form-card'
import { createEntityAction } from '@/lib/platform/actions'
import { requireCompanyContext } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function NewEntityPage() {
  const auth = await requireCompanyContext()
  const membership = auth.membership
  const [{ data: entityTypes }, { data: teams }] = await Promise.all([
    supabaseAdmin.from('entity_types').select('id, label_singular, label_plural, code').eq('company_id', membership.companyId).eq('is_active', true).is('archived_at', null).order('sort_order'),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', membership.companyId).is('archived_at', null).order('name'),
  ])

  // entity_type_fields has no company_id column; scope through the company's entity types
  // so dynamic fields can never leak between companies.
  const entityTypeIds = (entityTypes ?? []).map((entityType) => entityType.id)
  const { data: fields } = entityTypeIds.length
    ? await supabaseAdmin
        .from('entity_type_fields')
        .select('id, entity_type_id, field_key, label, field_type, is_required, is_sensitive, config, placeholder, help_text')
        .in('entity_type_id', entityTypeIds)
        .is('archived_at', null)
        .order('sort_order')
    : { data: [] }

  return (
    <AppShell auth={auth} title="Skapa objekt" subtitle="Skapa objekt utifrån företagets branschstyrda objekttyper och dynamiska fält.">
      <FormCard title="Objektuppgifter" description="Objektmodellen styrs av vald objekttyp. Dynamiska fält sparas i custom_fields och kan utvecklas per bransch utan separat app.">
        <EntityForm
          action={createEntityAction}
          entityTypes={entityTypes ?? []}
          teams={teams ?? []}
          fields={fields ?? []}
          submitLabel="Skapa objekt"
        />
      </FormCard>
    </AppShell>
  )
}
