-- =============================================================================
-- Surinder Caterers – Phase 8: in-app notifications
--
-- * Notifications are already created by the database functions (enquiries and
--   quotations) and readable only by their recipient (RLS). Signed-in users may
--   only update read_at (column grant) and delete their own rows.
-- * This migration:
--     1. publishes public.notifications to Supabase Realtime, so the bell updates
--        live (Realtime applies the same RLS: users only receive their own rows);
--     2. makes read_at "set once": API users can mark a notification as read, but
--        can't backdate it, move it, or mark it unread again. The time is always the
--        server's now().
-- Safe to re-run.
-- =============================================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

create or replace function public.notifications_guard_read_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if old.read_at is not null then
      new.read_at := old.read_at;         -- already read: stays as it was
    elsif new.read_at is not null then
      new.read_at := now();               -- marking as read: server time only
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.notifications_guard_read_at() from public, anon, authenticated;

drop trigger if exists notifications_guard_read_at on public.notifications;
create trigger notifications_guard_read_at
  before update of read_at on public.notifications
  for each row execute function public.notifications_guard_read_at();
