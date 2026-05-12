-- Coordiqo Batch 5 + operations hardening
-- Tasks, cases/work orders, invite acceptance, document storage metadata, audit, permission overrides and support mode.

create extension if not exists pgcrypto;

-- Storage bucket for tenant-scoped operational documents.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('coordiqo-documents', 'coordiqo-documents', false, 52428800, null)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit;

-- Operational cases/service requests.
create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entity_id uuid references public.entities(id) on delete set null,
  title text not null,
  description text,
  request_type text not null default 'general',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'triaged', 'in_progress', 'resolved', 'closed', 'cancelled', 'archived')),
  source text not null default 'internal' check (source in ('internal', 'portal', 'email', 'phone', 'import', 'api')),
  reported_by_name text,
  reported_by_email text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.task_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  default_duration_minutes int not null default 60,
  default_priority text not null default 'normal' check (default_priority in ('low', 'normal', 'high', 'urgent')),
  requires_scheduling boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  unique(company_id, code)
);

create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  service_request_id uuid references public.service_requests(id) on delete set null,
  entity_id uuid references public.entities(id) on delete set null,
  title text not null,
  description text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'draft' check (status in ('draft', 'open', 'scheduled', 'in_progress', 'completed', 'cancelled', 'archived')),
  due_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  task_type_id uuid references public.task_types(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  service_request_id uuid references public.service_requests(id) on delete set null,
  entity_id uuid references public.entities(id) on delete set null,
  assigned_team_id uuid references public.teams(id) on delete set null,
  assigned_staff_id uuid references public.staff_profiles(id) on delete set null,
  title text not null,
  description text,
  instructions text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'unscheduled' check (status in ('unscheduled', 'scheduled', 'assigned', 'in_progress', 'blocked', 'completed', 'cancelled', 'archived')),
  time_window_start timestamptz,
  time_window_end timestamptz,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  estimated_duration_minutes int not null default 60,
  sla_due_at timestamptz,
  recurrence_rule text,
  custom_fields jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.task_status_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  old_status text,
  new_status text not null,
  reason text,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_user_id uuid references public.profiles(id) on delete set null,
  comment text not null,
  visibility text not null default 'internal' check (visibility in ('internal', 'staff', 'external')),
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint,
  attachment_type text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.task_recurrence_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  task_template_id uuid references public.tasks(id) on delete cascade,
  name text not null,
  rrule text not null,
  active_from date,
  active_until date,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

-- Invite hardening: delivery state and accept audit.
alter table public.company_invitations add column if not exists email_delivery_status text not null default 'queued' check (email_delivery_status in ('queued', 'sent', 'failed', 'skipped'));
alter table public.company_invitations add column if not exists email_sent_at timestamptz;
alter table public.company_invitations add column if not exists last_email_error text;

create table if not exists public.outbound_emails (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  to_email text not null,
  subject text not null,
  body_text text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'cancelled')),
  provider text,
  provider_message_id text,
  error_message text,
  related_entity_type text,
  related_entity_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  sent_at timestamptz
);

-- Support mode / impersonation audit trail.
create table if not exists public.support_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  support_user_id uuid not null references public.profiles(id) on delete cascade,
  target_membership_id uuid references public.company_memberships(id) on delete set null,
  reason text not null,
  status text not null default 'active' check (status in ('active', 'ended', 'expired')),
  started_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  expires_at timestamptz not null default timezone('utc', now()) + interval '2 hours'
);

-- Generic document hardening for entities.
alter table public.entity_documents add column if not exists file_size_bytes bigint;
alter table public.entity_documents add column if not exists description text;
alter table public.entity_documents add column if not exists status text not null default 'active' check (status in ('active', 'archived'));

-- Notes/relations editable + soft deletable.
alter table public.entity_notes add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.entity_notes add column if not exists archived_at timestamptz;
alter table public.entity_relations add column if not exists notes text;
alter table public.entity_relations add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.entity_relations add column if not exists archived_at timestamptz;

-- Permission override metadata.
alter table public.company_role_permissions add column if not exists updated_by uuid references public.profiles(id) on delete set null;

-- Module seed.
insert into public.platform_modules (code, name, description, is_core, sort_order)
values
  ('tasks', 'Uppdrag och arbetsorder', 'Ärenden, uppdrag, arbetsorder, status och kommentarer.', false, 40),
  ('audit_control', 'Audit och support', 'Full auditlogg, supportläge och permission overrides.', false, 45),
  ('document_storage', 'Dokumenthantering', 'Privat Supabase Storage för objekt- och uppdragsdokument.', false, 46)
on conflict (code) do update set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order, updated_at = timezone('utc', now());

insert into public.company_modules (company_id, module_code, status, enabled_at)
select c.id, v.module_code, 'active', timezone('utc', now())
from public.companies c
cross join (values ('tasks'), ('audit_control'), ('document_storage')) as v(module_code)
on conflict (company_id, module_code) do update set status = excluded.status, enabled_at = coalesce(public.company_modules.enabled_at, excluded.enabled_at), updated_at = timezone('utc', now());

update public.company_settings
set active_modules = array(select distinct unnest(coalesce(active_modules, '{}'::text[]) || array['tasks', 'audit_control', 'document_storage'])),
    updated_at = timezone('utc', now())
where true;

-- Default task types for existing companies.
insert into public.task_types (company_id, code, name, description, default_duration_minutes, default_priority)
select c.id, v.code, v.name, v.description, v.duration, v.priority
from public.companies c
cross join (values
  ('general_visit', 'Generellt besök', 'Standarduppdrag med tidsfönster och instruktioner.', 60, 'normal'),
  ('inspection', 'Kontroll/Besiktning', 'Kontroll, rond eller besiktning.', 45, 'normal'),
  ('maintenance', 'Åtgärd/Service', 'Praktiskt arbete, underhåll eller service.', 90, 'high')
) as v(code, name, description, duration, priority)
on conflict (company_id, code) do nothing;

-- Indexes.
create index if not exists idx_service_requests_company_status on public.service_requests(company_id, status) where archived_at is null;
create index if not exists idx_work_orders_company_status on public.work_orders(company_id, status) where archived_at is null;
create index if not exists idx_tasks_company_status on public.tasks(company_id, status) where archived_at is null;
create index if not exists idx_tasks_company_entity on public.tasks(company_id, entity_id) where archived_at is null;
create index if not exists idx_tasks_company_staff on public.tasks(company_id, assigned_staff_id) where archived_at is null;
create index if not exists idx_tasks_company_team on public.tasks(company_id, assigned_team_id) where archived_at is null;
create index if not exists idx_tasks_time_window on public.tasks(company_id, time_window_start, time_window_end) where archived_at is null;
create index if not exists idx_outbound_emails_company_status on public.outbound_emails(company_id, status);
create index if not exists idx_support_sessions_company_status on public.support_sessions(company_id, status);
create index if not exists idx_entity_notes_active on public.entity_notes(company_id, entity_id, created_at desc) where archived_at is null;

-- Updated-at triggers.
drop trigger if exists set_service_requests_updated_at on public.service_requests;
create trigger set_service_requests_updated_at before update on public.service_requests for each row execute function public.set_updated_at();
drop trigger if exists set_task_types_updated_at on public.task_types;
create trigger set_task_types_updated_at before update on public.task_types for each row execute function public.set_updated_at();
drop trigger if exists set_work_orders_updated_at on public.work_orders;
create trigger set_work_orders_updated_at before update on public.work_orders for each row execute function public.set_updated_at();
drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();
drop trigger if exists set_task_recurrence_rules_updated_at on public.task_recurrence_rules;
create trigger set_task_recurrence_rules_updated_at before update on public.task_recurrence_rules for each row execute function public.set_updated_at();
drop trigger if exists set_entity_notes_updated_at on public.entity_notes;
create trigger set_entity_notes_updated_at before update on public.entity_notes for each row execute function public.set_updated_at();

-- RLS.
alter table public.service_requests enable row level security;
alter table public.task_types enable row level security;
alter table public.work_orders enable row level security;
alter table public.tasks enable row level security;
alter table public.task_status_history enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_attachments enable row level security;
alter table public.task_recurrence_rules enable row level security;
alter table public.outbound_emails enable row level security;
alter table public.support_sessions enable row level security;

-- Company-scoped policies.
drop policy if exists "service requests visible to company members" on public.service_requests;
create policy "service requests visible to company members" on public.service_requests for select using (public.is_platform_admin() or public.is_company_member(company_id));
drop policy if exists "service requests managed by planners" on public.service_requests;
create policy "service requests managed by planners" on public.service_requests for all using (public.is_platform_admin() or public.has_company_role(company_id, 'planner')) with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));

drop policy if exists "task types visible to company members" on public.task_types;
create policy "task types visible to company members" on public.task_types for select using (public.is_platform_admin() or public.is_company_member(company_id));
drop policy if exists "task types managed by operations managers" on public.task_types;
create policy "task types managed by operations managers" on public.task_types for all using (public.is_platform_admin() or public.has_company_role(company_id, 'operations_manager')) with check (public.is_platform_admin() or public.has_company_role(company_id, 'operations_manager'));

drop policy if exists "work orders visible to company members" on public.work_orders;
create policy "work orders visible to company members" on public.work_orders for select using (public.is_platform_admin() or public.is_company_member(company_id));
drop policy if exists "work orders managed by planners" on public.work_orders;
create policy "work orders managed by planners" on public.work_orders for all using (public.is_platform_admin() or public.has_company_role(company_id, 'planner')) with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));

drop policy if exists "tasks visible to company members" on public.tasks;
create policy "tasks visible to company members" on public.tasks for select using (public.is_platform_admin() or public.is_company_member(company_id));
drop policy if exists "tasks managed by planners" on public.tasks;
create policy "tasks managed by planners" on public.tasks for all using (public.is_platform_admin() or public.has_company_role(company_id, 'planner')) with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));

drop policy if exists "task status visible to company members" on public.task_status_history;
create policy "task status visible to company members" on public.task_status_history for select using (public.is_platform_admin() or public.is_company_member(company_id));
drop policy if exists "task comments visible to company members" on public.task_comments;
create policy "task comments visible to company members" on public.task_comments for select using (public.is_platform_admin() or public.is_company_member(company_id));
drop policy if exists "task comments managed by planners" on public.task_comments;
create policy "task comments managed by planners" on public.task_comments for all using (public.is_platform_admin() or public.has_company_role(company_id, 'planner')) with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));

drop policy if exists "task attachments visible to company members" on public.task_attachments;
create policy "task attachments visible to company members" on public.task_attachments for select using (public.is_platform_admin() or public.is_company_member(company_id));
drop policy if exists "task recurrence visible to company members" on public.task_recurrence_rules;
create policy "task recurrence visible to company members" on public.task_recurrence_rules for select using (public.is_platform_admin() or public.is_company_member(company_id));
drop policy if exists "task recurrence managed by planners" on public.task_recurrence_rules;
create policy "task recurrence managed by planners" on public.task_recurrence_rules for all using (public.is_platform_admin() or public.has_company_role(company_id, 'planner')) with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));

drop policy if exists "outbound emails visible to managers" on public.outbound_emails;
create policy "outbound emails visible to managers" on public.outbound_emails for select using (public.is_platform_admin() or public.has_company_role(company_id, 'operations_manager'));
drop policy if exists "support sessions visible to platform admins" on public.support_sessions;
create policy "support sessions visible to platform admins" on public.support_sessions for select using (public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'));

-- Storage policies: path must start with company_id/...
drop policy if exists "tenant documents readable by company members" on storage.objects;
create policy "tenant documents readable by company members" on storage.objects for select using (
  bucket_id = 'coordiqo-documents'
  and (
    public.is_platform_admin()
    or public.is_company_member((storage.foldername(name))[1]::uuid)
  )
);

drop policy if exists "tenant documents writable by planners" on storage.objects;
create policy "tenant documents writable by planners" on storage.objects for insert with check (
  bucket_id = 'coordiqo-documents'
  and (
    public.is_platform_admin()
    or public.has_company_role((storage.foldername(name))[1]::uuid, 'planner')
  )
);

-- Permission seed for new permission keys.
insert into public.company_role_permissions (company_id, role, permission_key, is_allowed, source)
select c.id, matrix.role, matrix.permission_key, matrix.is_allowed, 'system_default'
from public.companies c
cross join (values
  ('company_admin', 'task.manage', true),
  ('company_admin', 'work_order.manage', true),
  ('company_admin', 'document.manage', true),
  ('company_admin', 'support.manage', true),
  ('operations_manager', 'task.manage', true),
  ('operations_manager', 'work_order.manage', true),
  ('operations_manager', 'document.manage', true),
  ('operations_manager', 'support.manage', false),
  ('planner', 'task.manage', true),
  ('planner', 'work_order.manage', true),
  ('planner', 'document.manage', true),
  ('supervisor', 'task.manage', true),
  ('dispatcher', 'task.manage', true),
  ('team_lead', 'task.manage', false),
  ('staff', 'task.manage', false),
  ('contractor', 'task.manage', false),
  ('read_only', 'task.manage', false)
) as matrix(role, permission_key, is_allowed)
on conflict (company_id, role, permission_key) do nothing;
