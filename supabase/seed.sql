-- Sat+ / QaiArzan reference seed (safe for production).
-- Contains NO prices. Store branches have no address, coordinates, hours or phones:
-- these are unverified and must be filled in by an administrator after checking.

insert into public.roles (code, name_ru, description) values
  ('moderator', 'Модератор', 'Проверяет цены и жалобы'),
  ('admin', 'Администратор', 'Полный доступ к QaiArzan')
on conflict (code) do nothing;

insert into public.app_settings (key, value, description) values
  ('price_stale_days', '14', 'Через сколько дней цена считается устаревшей'),
  ('anomaly_threshold_pct', '40', 'Отклонение от текущей цены (%), при котором заявка помечается как аномальная'),
  ('submission_limit_anon_hour', '5', 'Заявок цен в час с одного устройства без входа'),
  ('submission_limit_user_hour', '30', 'Заявок цен в час на пользователя'),
  ('demo_mode', 'false', 'Показывать DEMO-магазины и DEMO-цены (только для разработки)')
on conflict (key) do nothing;

insert into public.cities (slug, name_ru, name_kk, is_active) values
  ('satpaev', 'Сатпаев', 'Сәтбаев', true),
  ('zhezkazgan', 'Жезказган', 'Жезқазған', false)
on conflict (slug) do nothing;

insert into public.product_categories (slug, name_ru, name_kk, icon, sort_order) values
  ('dairy', 'Молочные продукты', 'Сүт өнімдері', 'milk', 10),
  ('bakery', 'Хлеб и выпечка', 'Нан және тоқаш', 'croissant', 20),
  ('grocery', 'Крупы и бакалея', 'Жарма және бакалея', 'wheat', 30),
  ('produce', 'Овощи и фрукты', 'Көкөніс және жеміс', 'apple', 40),
  ('meat', 'Мясо и птица', 'Ет және құс еті', 'beef', 50),
  ('drinks', 'Напитки', 'Сусындар', 'cup-soda', 60),
  ('sweets', 'Сладости', 'Тәттілер', 'candy', 70),
  ('household', 'Бытовая химия', 'Тұрмыстық химия', 'spray-can', 80),
  ('hygiene', 'Личная гигиена', 'Жеке гигиена', 'droplets', 90),
  ('kids', 'Детские товары', 'Балалар тауарлары', 'baby', 100)
on conflict (slug) do nothing;

-- Store chains are candidates for the catalog. Presence in Satpayev must be verified.
insert into public.stores (slug, name, verification_status, sort_order) values
  ('akcent', 'Акцент', 'needs_check', 10),
  ('samadi', 'Самади', 'needs_check', 20),
  ('fix-price', 'Fix Price', 'needs_check', 30),
  ('magnit', 'Магнит', 'needs_check', 40),
  ('svetofor', 'Светофор', 'needs_check', 50),
  ('ersultan', 'Ерсұлтан', 'needs_check', 60),
  ('kaspiy', 'Каспий', 'needs_check', 70)
on conflict (slug) do nothing;

insert into public.store_branches (store_id, city_id, slug, name, verification_status)
select s.id, c.id, s.slug || '-satpaev-1', s.name || ' (Сатпаев)', 'needs_check'
from public.stores s cross join public.cities c
where c.slug = 'satpaev' and not s.is_demo
on conflict (slug) do nothing;

insert into public.brands (slug, name, manufacturer) values
  ('zenchenko', 'Зенченко', 'ТОО «Зенченко и К»')
on conflict (slug) do nothing;

-- 53 starter positions. Generic positions use comparison_mode = 'analog': every price
-- records its own brand and pack, and ranking is by price per kg / l / piece.
-- Weighted produce and meat are priced per 1 kg.
-- Exact packaging for branded goods is left empty until verified (specs_verified = false).
with c as (select slug, id from public.product_categories),
data (slug, cat, name_ru, name_kk, unit, mode, weighted, fat, brand, pop) as (values
  ('moloko-zenchenko-3-2', 'dairy', 'Молоко «Зенченко» 3,2%', '«Зенченко» сүті 3,2%', 'l', 'identical', false, 3.2, 'zenchenko', 100),
  ('moloko-2-5', 'dairy', 'Молоко 2,5%', 'Сүт 2,5%', 'l', 'analog', false, 2.5, null, 98),
  ('kefir-2-5', 'dairy', 'Кефир 2,5%', 'Кефир 2,5%', 'l', 'analog', false, 2.5, null, 90),
  ('smetana-20', 'dairy', 'Сметана 20%', 'Қаймақ 20%', 'kg', 'analog', false, 20, null, 85),
  ('maslo-slivochnoe-72-5', 'dairy', 'Масло сливочное 72,5%', 'Сары май 72,5%', 'kg', 'analog', false, 72.5, null, 84),
  ('yaytsa-c1', 'dairy', 'Яйца куриные С1', 'Тауық жұмыртқасы С1', 'pcs', 'analog', false, null, null, 97),
  ('tvorog-5', 'dairy', 'Творог 5%', 'Сүзбе 5%', 'kg', 'analog', false, 5, null, 70),
  ('syr-tverdyy', 'dairy', 'Сыр твёрдый', 'Қатты ірімшік', 'kg', 'analog', false, null, null, 68),
  ('yogurt-pitevoy', 'dairy', 'Йогурт питьевой', 'Ішетін йогурт', 'l', 'analog', false, null, null, 55),
  ('hleb-belyy', 'bakery', 'Хлеб белый формовой', 'Ақ нан (қалыптық)', 'kg', 'analog', false, null, null, 99),
  ('hleb-rzhanoy', 'bakery', 'Хлеб ржаной', 'Қара бидай наны', 'kg', 'analog', false, null, null, 72),
  ('baton', 'bakery', 'Батон нарезной', 'Туралған батон', 'kg', 'analog', false, null, null, 75),
  ('muka-vysshiy-sort', 'grocery', 'Мука пшеничная высшего сорта', 'Жоғары сұрыпты бидай ұны', 'kg', 'analog', false, null, null, 88),
  ('sahar', 'grocery', 'Сахар-песок', 'Құмшекер', 'kg', 'analog', false, null, null, 92),
  ('ris-kruglyy', 'grocery', 'Рис круглозёрный', 'Дөңгелек дәнді күріш', 'kg', 'analog', false, null, null, 80),
  ('ris-dlinnyy', 'grocery', 'Рис длиннозёрный', 'Ұзын дәнді күріш', 'kg', 'analog', false, null, null, 74),
  ('grechka', 'grocery', 'Гречка ядрица', 'Қарақұмық жармасы', 'kg', 'analog', false, null, null, 82),
  ('makarony', 'grocery', 'Макароны', 'Макарон', 'kg', 'analog', false, null, null, 86),
  ('maslo-podsolnechnoe', 'grocery', 'Масло подсолнечное рафинированное', 'Тазартылған күнбағыс майы', 'l', 'analog', false, null, null, 91),
  ('sol', 'grocery', 'Соль поваренная', 'Ас тұзы', 'kg', 'analog', false, null, null, 60),
  ('ovsyanye-hlopya', 'grocery', 'Овсяные хлопья', 'Сұлы үлпектері', 'kg', 'analog', false, null, null, 58),
  ('chay-chernyy', 'grocery', 'Чай чёрный', 'Қара шай', 'kg', 'analog', false, null, null, 89),
  ('kofe-rastvorimyy', 'grocery', 'Кофе растворимый', 'Ерігіш кофе', 'kg', 'analog', false, null, null, 66),
  ('tomatnaya-pasta', 'grocery', 'Томатная паста', 'Томат пастасы', 'kg', 'analog', false, null, null, 57),
  ('kartofel', 'produce', 'Картофель', 'Картоп', 'kg', 'identical', true, null, null, 96),
  ('luk', 'produce', 'Лук репчатый', 'Пияз', 'kg', 'identical', true, null, null, 93),
  ('morkov', 'produce', 'Морковь', 'Сәбіз', 'kg', 'identical', true, null, null, 90),
  ('kapusta', 'produce', 'Капуста белокочанная', 'Ақ қауданды қырыққабат', 'kg', 'identical', true, null, null, 83),
  ('pomidory', 'produce', 'Помидоры', 'Қызанақ', 'kg', 'identical', true, null, null, 87),
  ('ogurtsy', 'produce', 'Огурцы', 'Қияр', 'kg', 'identical', true, null, null, 86),
  ('yabloki', 'produce', 'Яблоки', 'Алма', 'kg', 'identical', true, null, null, 85),
  ('banany', 'produce', 'Бананы', 'Банан', 'kg', 'identical', true, null, null, 84),
  ('limony', 'produce', 'Лимоны', 'Лимон', 'kg', 'identical', true, null, null, 60),
  ('kuritsa-tushka', 'meat', 'Курица (тушка)', 'Тауық (тұтас ұша)', 'kg', 'identical', true, null, null, 94),
  ('okorochka', 'meat', 'Окорочка куриные', 'Тауық сандары', 'kg', 'identical', true, null, null, 88),
  ('govyadina-myakot', 'meat', 'Говядина (мякоть)', 'Сиыр еті (жұмсақ еті)', 'kg', 'identical', true, null, null, 91),
  ('farsh-govyazhiy', 'meat', 'Фарш говяжий', 'Сиыр етінен тартылған ет', 'kg', 'identical', true, null, null, 80),
  ('pelmeni', 'meat', 'Пельмени', 'Тұшпара', 'kg', 'analog', false, null, null, 79),
  ('sosiski', 'meat', 'Сосиски', 'Сосиска', 'kg', 'analog', false, null, null, 70),
  ('voda-negazirovannaya', 'drinks', 'Вода питьевая негазированная', 'Газсыз ауыз су', 'l', 'analog', false, null, null, 82),
  ('sok', 'drinks', 'Сок', 'Шырын', 'l', 'analog', false, null, null, 65),
  ('gazirovannyy-napitok', 'drinks', 'Газированный напиток', 'Газдалған сусын', 'l', 'analog', false, null, null, 62),
  ('pechene', 'sweets', 'Печенье', 'Печенье', 'kg', 'analog', false, null, null, 64),
  ('shokolad-molochnyy', 'sweets', 'Шоколад молочный', 'Сүтті шоколад', 'kg', 'analog', false, null, null, 61),
  ('tualetnaya-bumaga', 'household', 'Туалетная бумага', 'Дәретхана қағазы', 'pcs', 'analog', false, null, null, 81),
  ('stiralnyy-poroshok', 'household', 'Стиральный порошок', 'Кір жуғыш ұнтақ', 'kg', 'analog', false, null, null, 78),
  ('sredstvo-dlya-posudy', 'household', 'Средство для мытья посуды', 'Ыдыс жуғыш құрал', 'l', 'analog', false, null, null, 77),
  ('mylo-tualetnoe', 'hygiene', 'Мыло туалетное', 'Қол сабыны', 'pcs', 'analog', false, null, null, 63),
  ('zubnaya-pasta', 'hygiene', 'Зубная паста', 'Тіс пастасы', 'l', 'analog', false, null, null, 67),
  ('shampun', 'hygiene', 'Шампунь', 'Сусабын', 'l', 'analog', false, null, null, 59),
  ('podguzniki', 'kids', 'Подгузники детские', 'Балаларға арналған жаялық', 'pcs', 'analog', false, null, null, 69),
  ('detskoe-pyure', 'kids', 'Детское пюре', 'Балалар пюресі', 'kg', 'analog', false, null, null, 54),
  ('detskaya-smes', 'kids', 'Детская молочная смесь', 'Балаларға арналған сүт қоспасы', 'kg', 'analog', false, null, null, 53)
)
insert into public.products (slug, category_id, brand_id, name_ru, name_kk, unit, comparison_mode,
  is_weighted, fat_percent, popularity, specs_verified, manufacturer)
select d.slug, c.id, b.id, d.name_ru, d.name_kk, d.unit, d.mode, d.weighted, d.fat, d.pop, false,
  b.manufacturer
from data d
join c on c.slug = d.cat
left join public.brands b on b.slug = d.brand
on conflict (slug) do nothing;

insert into public.product_equivalence_groups (slug, name_ru, name_kk, base_unit) values
  ('moloko', 'Молоко', 'Сүт', 'l'),
  ('ris', 'Рис', 'Күріш', 'kg'),
  ('hleb-pshenichnyy', 'Пшеничный хлеб', 'Бидай наны', 'kg'),
  ('kuritsa', 'Курица', 'Тауық еті', 'kg')
on conflict (slug) do nothing;

insert into public.product_equivalences (group_id, product_id)
select g.id, p.id
from (values
  ('moloko', 'moloko-zenchenko-3-2'), ('moloko', 'moloko-2-5'),
  ('ris', 'ris-kruglyy'), ('ris', 'ris-dlinnyy'),
  ('hleb-pshenichnyy', 'hleb-belyy'), ('hleb-pshenichnyy', 'baton'),
  ('kuritsa', 'kuritsa-tushka'), ('kuritsa', 'okorochka')
) as m (g, p)
join public.product_equivalence_groups g on g.slug = m.g
join public.products p on p.slug = m.p
on conflict do nothing;
