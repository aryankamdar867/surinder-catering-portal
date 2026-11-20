-- =============================================================================
-- Surinder Caterers – Row Level Security and privileges
--
-- Principles
--   * RLS is enabled on every table. No policy = no access.
--   * The anonymous (logged-out) role has no table access at all.
--   * Customers only ever see their own rows, and never draft quotations.
--   * Customers cannot write enquiries, selections or quotations directly.
--     Those writes go through validated SECURITY DEFINER functions added in
--     later phases (submit enquiry, cancel enquiry, accept/reject quotation).
--   * Admin = profiles.role = 'admin', which no API user can change.
-- =============================================================================

alter table public.profiles               enable row level security;
alter table public.categories             enable row level security;
alter table public.cuisines               enable row level security;
alter table public.dishes                 enable row level security;
alter table public.enquiries              enable row level security;
alter table public.event_details          enable row level security;
alter table public.menu_selections        enable row level security;
alter table public.enquiry_status_history enable row level security;
alter table public.admin_notes            enable row level security;
alter table public.quotations             enable row level security;
alter table public.quotation_versions     enable row level security;
alter table public.quotation_items        enable row level security;
alter table public.notifications          enable row level security;

-- -----------------------------------------------------------------------------
-- Table and function privileges (layered underneath RLS)
-- -----------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon, authenticated;

-- profiles: rows are created by trigger; users may edit only these columns.
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, phone, address, company_name, gst_number) on public.profiles to authenticated;

-- Write-protected for API users (writes happen via SECURITY DEFINER functions/triggers).
revoke insert, update, delete on public.menu_selections from authenticated;
revoke insert, update, delete on public.enquiry_status_history from authenticated;

-- notifications: users may only mark as read (and delete their own).
revoke insert, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Functions: nothing callable by default; grant explicitly.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------

create policy "profiles: read own, admins read all"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Catalogue – any signed-in user can browse; only admins manage.
-- -----------------------------------------------------------------------------

create policy "categories: signed-in read"
  on public.categories for select to authenticated
  using (is_active or (select public.is_admin()));

create policy "categories: admin insert"
  on public.categories for insert to authenticated
  with check ((select public.is_admin()));

create policy "categories: admin update"
  on public.categories for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "categories: admin delete"
  on public.categories for delete to authenticated
  using ((select public.is_admin()));

create policy "cuisines: signed-in read"
  on public.cuisines for select to authenticated
  using (is_active or (select public.is_admin()));

create policy "cuisines: admin insert"
  on public.cuisines for insert to authenticated
  with check ((select public.is_admin()));

create policy "cuisines: admin update"
  on public.cuisines for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "cuisines: admin delete"
  on public.cuisines for delete to authenticated
  using ((select public.is_admin()));

-- Unavailable dishes stay visible so the UI can show them as "unavailable".
create policy "dishes: signed-in read"
  on public.dishes for select to authenticated
  using (true);

create policy "dishes: admin insert"
  on public.dishes for insert to authenticated
  with check ((select public.is_admin()));

create policy "dishes: admin update"
  on public.dishes for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "dishes: admin delete"
  on public.dishes for delete to authenticated
  using ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Enquiries and their child tables
-- -----------------------------------------------------------------------------

create policy "enquiries: read own, admins read all"
  on public.enquiries for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_admin()));

create policy "enquiries: admin update"
  on public.enquiries for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "event_details: read own, admins read all"
  on public.event_details for select to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.enquiries e
                where e.id = event_details.enquiry_id and e.customer_id = (select auth.uid()))
  );

create policy "event_details: admin update"
  on public.event_details for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "menu_selections: read own, admins read all"
  on public.menu_selections for select to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.enquiries e
                where e.id = menu_selections.enquiry_id and e.customer_id = (select auth.uid()))
  );

create policy "enquiry_status_history: read own, admins read all"
  on public.enquiry_status_history for select to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.enquiries e
                where e.id = enquiry_status_history.enquiry_id and e.customer_id = (select auth.uid()))
  );

-- -----------------------------------------------------------------------------
-- Admin notes – admins only, entirely hidden from customers
-- -----------------------------------------------------------------------------

create policy "admin_notes: admin read"
  on public.admin_notes for select to authenticated
  using ((select public.is_admin()));

create policy "admin_notes: admin insert as self"
  on public.admin_notes for insert to authenticated
  with check ((select public.is_admin()) and author_id = (select auth.uid()));

create policy "admin_notes: author update"
  on public.admin_notes for update to authenticated
  using ((select public.is_admin()) and author_id = (select auth.uid()))
  with check ((select public.is_admin()) and author_id = (select auth.uid()));

create policy "admin_notes: author delete"
  on public.admin_notes for delete to authenticated
  using ((select public.is_admin()) and author_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Quotations – admins manage; customers read their own non-draft quotations.
-- Accept/reject happens through a SECURITY DEFINER function (Phase 7).
-- -----------------------------------------------------------------------------

create policy "quotations: admin all, customer reads own sent"
  on public.quotations for select to authenticated
  using (
    (select public.is_admin())
    or (customer_id = (select auth.uid()) and status <> 'draft')
  );

create policy "quotations: admin insert"
  on public.quotations for insert to authenticated
  with check ((select public.is_admin()));

create policy "quotations: admin update"
  on public.quotations for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "quotations: admin delete drafts"
  on public.quotations for delete to authenticated
  using ((select public.is_admin()) and status = 'draft');

create policy "quotation_versions: admin all, customer reads own sent"
  on public.quotation_versions for select to authenticated
  using (
    (select public.is_admin())
    or (status <> 'draft' and exists (
          select 1 from public.quotations q
           where q.id = quotation_versions.quotation_id
             and q.customer_id = (select auth.uid())
             and q.status <> 'draft'))
  );

create policy "quotation_versions: admin insert"
  on public.quotation_versions for insert to authenticated
  with check ((select public.is_admin()));

create policy "quotation_versions: admin update"
  on public.quotation_versions for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "quotation_versions: admin delete"
  on public.quotation_versions for delete to authenticated
  using ((select public.is_admin()));

create policy "quotation_items: admin all, customer reads own sent"
  on public.quotation_items for select to authenticated
  using (
    (select public.is_admin())
    or exists (
         select 1 from public.quotation_versions v
           join public.quotations q on q.id = v.quotation_id
          where v.id = quotation_items.version_id
            and v.status <> 'draft'
            and q.status <> 'draft'
            and q.customer_id = (select auth.uid()))
  );

create policy "quotation_items: admin insert"
  on public.quotation_items for insert to authenticated
  with check ((select public.is_admin()));

create policy "quotation_items: admin update"
  on public.quotation_items for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "quotation_items: admin delete"
  on public.quotation_items for delete to authenticated
  using ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Notifications – recipients only
-- -----------------------------------------------------------------------------

create policy "notifications: read own"
  on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));

create policy "notifications: mark own as read"
  on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create policy "notifications: delete own"
  on public.notifications for delete to authenticated
  using (recipient_id = (select auth.uid()));
