begin;
-- Existing organizations keep their UUID and name. Phase 11 imports can
-- resolve stable business codes without forcing a migration of current rows.
alter table public.organizations add column code text
 check(code is null or code ~ '^[A-Z][A-Z0-9_-]{1,39}$');
create unique index organizations_code_unique on public.organizations(code) where code is not null;
commit;
