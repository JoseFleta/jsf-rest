begin;

alter table public.restaurants
  add column if not exists currency_code text;

update public.restaurants
set currency_code = upper(coalesce(currency_code, 'USD'));

update public.restaurants
set currency_code = 'USD'
where currency_code !~ '^[A-Z]{3}$';

alter table public.restaurants
  alter column currency_code set default 'USD';

alter table public.restaurants
  alter column currency_code set not null;

alter table public.restaurants
  drop constraint if exists restaurants_currency_code_format;

alter table public.restaurants
  add constraint restaurants_currency_code_format
  check (currency_code ~ '^[A-Z]{3}$');

commit;
