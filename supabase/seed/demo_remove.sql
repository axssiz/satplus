-- Removes all DEMO data and turns demo mode off.
begin;

update public.app_settings set value = 'false' where key = 'demo_mode';
delete from public.stores where is_demo; -- cascades to branches, prices and history

commit;
