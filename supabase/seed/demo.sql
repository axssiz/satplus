-- DEMO DATA — for local development and visual review ONLY. Never run in production.
-- Creates three fictional "Демо-магазин" stores with DEMO prices and DEMO history.
-- Real store chains never receive DEMO prices (enforced by a trigger), and DEMO stores
-- are hidden by RLS as soon as app_settings.demo_mode is false.
-- Remove with: supabase/seed/demo_remove.sql

begin;

update public.app_settings set value = 'true' where key = 'demo_mode';

insert into public.stores (slug, name, verification_status, is_demo, sort_order, description) values
  ('demo-a', 'Демо-магазин А', 'unverified', true, 900, 'Вымышленный магазин для проверки интерфейса. Цены DEMO.'),
  ('demo-b', 'Демо-магазин Б', 'unverified', true, 901, 'Вымышленный магазин для проверки интерфейса. Цены DEMO.'),
  ('demo-c', 'Демо-магазин В', 'unverified', true, 902, 'Вымышленный магазин для проверки интерфейса. Цены DEMO.')
on conflict (slug) do nothing;

insert into public.store_branches (store_id, city_id, slug, name, verification_status)
select s.id, c.id, s.slug || '-1', s.name || ' (DEMO)', 'unverified'
from public.stores s cross join public.cities c
where s.is_demo and c.slug = 'satpaev'
on conflict (slug) do nothing;

-- Base DEMO prices (tenge) and the pack each DEMO price refers to.
create temporary table demo_base (slug text, base numeric, pack_q numeric, pack_u text, brand text) on commit drop;
insert into demo_base values
  ('moloko-zenchenko-3-2', 520, null, null, null),
  ('moloko-2-5', 450, 1, 'l', 'DEMO-бренд'),
  ('kefir-2-5', 480, 1, 'l', 'DEMO-бренд'),
  ('smetana-20', 390, 400, 'g', 'DEMO-бренд'),
  ('maslo-slivochnoe-72-5', 1100, 200, 'g', 'DEMO-бренд'),
  ('yaytsa-c1', 900, 10, 'pcs', 'DEMO-бренд'),
  ('tvorog-5', 650, 400, 'g', 'DEMO-бренд'),
  ('hleb-belyy', 200, 500, 'g', 'DEMO-пекарня'),
  ('baton', 230, 400, 'g', 'DEMO-пекарня'),
  ('muka-vysshiy-sort', 1200, 5, 'kg', 'DEMO-бренд'),
  ('sahar', 520, 1, 'kg', 'DEMO-бренд'),
  ('ris-kruglyy', 650, 1, 'kg', 'DEMO-бренд'),
  ('ris-dlinnyy', 780, 1, 'kg', 'DEMO-бренд'),
  ('grechka', 600, 800, 'g', 'DEMO-бренд'),
  ('makarony', 380, 400, 'g', 'DEMO-бренд'),
  ('maslo-podsolnechnoe', 1050, 1, 'l', 'DEMO-бренд'),
  ('chay-chernyy', 1400, 250, 'g', 'DEMO-бренд'),
  ('kartofel', 180, null, null, null),
  ('luk', 160, null, null, null),
  ('morkov', 170, null, null, null),
  ('kapusta', 140, null, null, null),
  ('pomidory', 900, null, null, null),
  ('ogurtsy', 750, null, null, null),
  ('yabloki', 650, null, null, null),
  ('banany', 850, null, null, null),
  ('kuritsa-tushka', 1700, null, null, null),
  ('okorochka', 1500, null, null, null),
  ('govyadina-myakot', 4200, null, null, null),
  ('pelmeni', 1600, 800, 'g', 'DEMO-бренд'),
  ('voda-negazirovannaya', 260, 1.5, 'l', 'DEMO-бренд'),
  ('tualetnaya-bumaga', 700, 4, 'pcs', 'DEMO-бренд'),
  ('stiralnyy-poroshok', 2300, 3, 'kg', 'DEMO-бренд'),
  ('sredstvo-dlya-posudy', 650, 500, 'ml', 'DEMO-бренд');

-- History: one point every 9 days for 90 days, deterministic pseudo-random walk per store.
-- Some products are intentionally missing in some stores to exercise "нет данных" logic.
insert into public.price_history (product_id, branch_id, price, status, pack_quantity, pack_unit,
  brand_label, source_type, observed_at, is_demo)
select p.id, b.id,
  round(d.base * (0.9 + (s.sort_order - 900) * 0.06
        + ((abs(hashtext(p.slug || b.slug || g.n::text)) % 100) - 50) / 1000.0)),
  'verified', d.pack_q, d.pack_u, d.brand, 'demo',
  now() - make_interval(days => 90 - g.n * 9) - interval '3 hours', true
from demo_base d
join public.products p on p.slug = d.slug
cross join public.store_branches b
join public.stores s on s.id = b.store_id and s.is_demo
cross join generate_series(0, 10) as g (n)
where abs(hashtext(p.slug || s.slug)) % 7 <> 0;

-- Current price = latest history point per product/branch.
insert into public.verified_prices (product_id, branch_id, price, status, pack_quantity, pack_unit,
  brand_label, source_type, source_note, observed_at, is_demo)
select distinct on (h.product_id, h.branch_id)
  h.product_id, h.branch_id, h.price, h.status, h.pack_quantity, h.pack_unit, h.brand_label,
  'demo', 'DEMO-данные для проверки интерфейса', h.observed_at, true
from public.price_history h
where h.is_demo
order by h.product_id, h.branch_id, h.observed_at desc
on conflict (product_id, branch_id) do nothing;

-- One DEMO "estimated" price and one DEMO stale price, to show these states in the UI.
update public.verified_prices vp set status = 'estimated', source_note = 'DEMO: пример ориентировочной цены'
from public.products p, public.store_branches b
where vp.product_id = p.id and vp.branch_id = b.id and p.slug = 'sahar' and b.slug = 'demo-c-1';
update public.verified_prices vp set observed_at = now() - interval '30 days'
from public.products p, public.store_branches b
where vp.product_id = p.id and vp.branch_id = b.id and p.slug = 'grechka' and b.slug = 'demo-b-1';

commit;
