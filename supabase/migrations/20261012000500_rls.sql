-- Row Level Security and grants.
-- Principle: public catalog data is readable by everyone; anything personal or unmoderated
-- is readable only by its owner or staff; writes from browsers are limited to admin CRUD
-- through RLS, and all price/moderation writes go through checked functions or the server.

-- Explicit grants (do not rely on project defaults).
grant usage on schema public to anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Enable RLS everywhere.
alter table public.cities enable row level security;
alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.app_settings enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.stores enable row level security;
alter table public.store_branches enable row level security;
alter table public.product_categories enable row level security;
alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.product_barcodes enable row level security;
alter table public.product_equivalence_groups enable row level security;
alter table public.product_equivalences enable row level security;
alter table public.price_submissions enable row level security;
alter table public.price_evidence enable row level security;
alter table public.verified_prices enable row level security;
alter table public.price_history enable row level security;
alter table public.price_requests enable row level security;
alter table public.reports enable row level security;
alter table public.user_reputation enable row level security;
alter table public.reputation_events enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.product_views_daily enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;

-- ---------------------------------------------------------------------------
-- Public catalog: read for all, write for admins.
-- ---------------------------------------------------------------------------
grant select on public.cities, public.product_categories, public.brands, public.products,
  public.product_barcodes, public.product_equivalence_groups, public.product_equivalences,
  public.stores, public.store_branches, public.app_settings, public.roles
  to anon, authenticated;
grant insert, update, delete on public.cities, public.product_categories, public.brands, public.products,
  public.product_barcodes, public.product_equivalence_groups, public.product_equivalences,
  public.stores, public.store_branches
  to authenticated;
grant update on public.app_settings to authenticated;

create policy cities_read on public.cities for select using (is_active or public.is_admin());
create policy cities_admin on public.cities for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy roles_read on public.roles for select using (true);

create policy categories_read on public.product_categories for select using (is_active or public.is_admin());
create policy categories_admin on public.product_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy brands_read on public.brands for select using (true);
create policy brands_admin on public.brands for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy products_read on public.products for select using (is_active or public.is_moderator());
create policy products_admin on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy barcodes_read on public.product_barcodes for select using (true);
create policy barcodes_admin on public.product_barcodes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy eq_groups_read on public.product_equivalence_groups for select using (true);
create policy eq_groups_admin on public.product_equivalence_groups for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy eq_read on public.product_equivalences for select using (true);
create policy eq_admin on public.product_equivalences for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy stores_read on public.stores for select
  using ((is_active and (not is_demo or public.demo_mode_enabled())) or public.is_moderator());
create policy stores_admin on public.stores for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy branches_read on public.store_branches for select
  using (public.branch_visible(id) or public.is_moderator());
create policy branches_admin on public.store_branches for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy settings_read on public.app_settings for select using (true);
create policy settings_admin on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Prices: public read of moderated data only. Writes only via functions.
-- ---------------------------------------------------------------------------
grant select on public.verified_prices, public.price_history to anon, authenticated;
grant select on public.current_prices to anon, authenticated;

create policy verified_prices_read on public.verified_prices for select
  using (public.branch_visible(branch_id) or public.is_moderator());
create policy price_history_read on public.price_history for select
  using (public.branch_visible(branch_id) or public.is_moderator());

-- Submissions/evidence: inserted by the server (service role) after validation and rate limiting.
grant select on public.price_submissions, public.price_evidence to authenticated;
create policy submissions_read on public.price_submissions for select to authenticated
  using (user_id = auth.uid() or public.is_moderator());
create policy evidence_read on public.price_evidence for select to authenticated
  using (public.is_moderator());

grant select on public.price_requests, public.price_request_stats, public.reports,
  public.moderation_actions, public.moderation_queue, public.product_views_daily,
  public.admin_audit_logs to authenticated;
create policy price_requests_read on public.price_requests for select to authenticated
  using (user_id = auth.uid() or public.is_moderator());
create policy reports_read on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_moderator());
create policy moderation_actions_read on public.moderation_actions for select to authenticated
  using (public.is_moderator());
create policy views_read on public.product_views_daily for select to authenticated
  using (public.is_moderator());
create policy audit_read on public.admin_audit_logs for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Personal data.
-- ---------------------------------------------------------------------------
grant select, update on public.profiles to authenticated;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- Users may only change their display name.
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select on public.user_roles to authenticated;
create policy user_roles_read on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

grant select on public.user_reputation, public.reputation_events to authenticated;
create policy reputation_read on public.user_reputation for select to authenticated
  using (user_id = auth.uid() or public.is_moderator());
create policy reputation_events_read on public.reputation_events for select to authenticated
  using (user_id = auth.uid() or public.is_moderator());

grant select, insert, update, delete on public.shopping_lists, public.shopping_list_items to authenticated;
create policy shopping_lists_owner on public.shopping_lists for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy shopping_list_items_owner on public.shopping_list_items for all to authenticated
  using (exists (select 1 from public.shopping_lists l where l.id = list_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.shopping_lists l where l.id = list_id and l.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Function execution.
-- ---------------------------------------------------------------------------
grant execute on function public.is_admin(), public.is_moderator(), public.demo_mode_enabled(),
  public.setting_int(text, integer), public.branch_visible(uuid),
  public.record_product_view(uuid), public.price_request_counts(uuid[])
  to anon, authenticated;
grant execute on function
  public.approve_price_submission(uuid, text, text),
  public.reject_price_submission(uuid, text),
  public.resolve_report(uuid, text, text),
  public.staff_upsert_prices(jsonb),
  public.staff_remove_price(uuid, text),
  public.admin_set_role(uuid, text, boolean),
  public.delete_my_data(),
  public.qaiarzan_dashboard_stats()
  to authenticated;
-- Internal helpers stay private (no EXECUTE for clients): award_reputation,
-- apply_accepted_price, write_audit, handle_new_user and trigger functions.
