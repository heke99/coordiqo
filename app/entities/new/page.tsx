export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { EntityForm } from '@/components/entities/entity-form'
import { FormCard } from '@/components/ui/form-card'
import { createEntityAction } from '@/lib/platform/actions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function NewEntityPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const [{ data: entityTypes }, { data: teams }, { data: fields }] = await Promise.all([
    supabaseAdmin.from('entity_types').select('id, label_singular, label_plural, code').eq('company_id', auth.membership.companyId).eq('is_active', true).is('archived_at', null).order('sort_order'),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
    supabaseAdmin.from('entity_type_fields').select('id, entity_type_id, field_key, label, field_type, is_required, is_sensitive, config, placeholder, help_text').is('archived_at', null).order('sort_order'),
  ])

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
