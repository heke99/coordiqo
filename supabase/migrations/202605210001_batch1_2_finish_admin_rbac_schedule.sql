-- Coordiqo Batch 1 + 2 finish
-- Admin governance, readiness, notifications and scheduling hardening.

create extension if not exists pgcrypto;

-- Company governance without breaking the existing active/inactive enum used by runtime.
alter table public.companies add column if not exists lifecycle_status text not null default 'active'
  check (lifecycle_status in ('pending_approval', 'active', 'paused', 'rejected', 'archived'));
alter table public.companies add column if not exists approval_note text;
alter table public.companies add column if not exists approved_by uuid references public.profiles(id) on delete set null;
alter table public.companies add column if not exists approved_at timestamptz;
alter table public.companies add column if not exists paused_by uuid references public.profiles(id) on delete set null;
alter table public.companies add column if not exists paused_at timestamptz;
alter table public.companies add column if not exists archived_by uuid references public.profiles(id) on delete set null;
alter table public.companies add column if not exists archived_at timestamptz;

create index if not exists idx_companies_lifecycle_status on public.companies(lifecycle_status, created_at desc);
create index if not exists idx_companies_archived_at on public.companies(archived_at) where archived_at is null;

-- More explicit metadata for memberships and invitation management.
alter table public.company_memberships add column if not exists disabled_by uuid references public.profiles(id) on delete set null;
alter table public.company_memberships add column if not exists disabled_at timestamptz;
alter table public.company_memberships add column if not exists disabled_reason text;

alter table public.company_invitations add column if not exists revoked_by uuid references public.profiles(id) on delete set null;
alter table public.company_invitations add column if not exists resend_count integer not null default 0;
alter table public.company_invitations add column if not exists last_resent_at timestamptz;

-- Notification center v1.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  recipient_user_id uuid references public.profiles(id) on delete cascade,
  recipient_membership_id uuid references public.company_memberships(id) on delete cascade,
  title text not null,
  body text,
  notification_type text not null default 'system',
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'danger')),
  status text not null default 'unread' check (status in ('unread', 'read', 'archived')),
  action_href text,
  related_entity_type text,
  related_entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_notifications_company_status on public.notifications(company_id, status, created_at desc) where archived_at is null;
create index if not exists idx_notifications_user_status on public.notifications(recipient_user_id, status, created_at desc) where archived_at is null;

alter table public.notifications enable row level security;

drop policy if exists notifications_company_select on public.notifications;
create policy notifications_company_select on public.notifications
for select using (
  public.is_platform_admin()
  or (company_id is not null and public.is_company_member(company_id))
  or recipient_user_id = auth.uid()
);

drop policy if exists notifications_company_write on public.notifications;
create policy notifications_company_write on public.notifications
for all using (
  public.is_platform_admin()
  or (company_id is not null and public.has_company_role(company_id, 'planner'))
  or recipient_user_id = auth.uid()
)
with check (
  public.is_platform_admin()
  or (company_id is not null and public.has_company_role(company_id, 'planner'))
  or recipient_user_id = auth.uid()
);

-- Shift copy/mass update support.
alter table public.shifts add column if not exists copied_from_shift_id uuid references public.shifts(id) on delete set null;
alter table public.shifts add column if not exists copied_from_week_start date;
alter table public.shifts add column if not exists copied_to_week_start date;

create index if not exists shifts_copied_from_idx on public.shifts(company_id, copied_from_shift_id) where copied_from_shift_id is not null;

-- Access request hardening.
alter table public.company_access_requests add column if not exists created_company_id uuid references public.companies(id) on delete set null;
alter table public.company_access_requests add column if not exists assigned_membership_id uuid references public.company_memberships(id) on delete set null;

-- Keep companies lifecycle in sync for older rows.
update public.companies set lifecycle_status = 'active' where lifecycle_status is null;
