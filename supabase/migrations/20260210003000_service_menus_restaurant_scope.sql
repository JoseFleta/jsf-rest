begin;

alter table public.service_menus
  add column if not exists restaurant_id uuid
  references public.restaurants(id) on delete cascade;

create index if not exists service_menus_restaurant_id_idx
  on public.service_menus (restaurant_id);

update public.service_menus menu
set restaurant_id = (
  select restaurant.id
  from public.restaurants restaurant
  where restaurant.organization_id = menu.organization_id
    and restaurant.is_active = true
  order by restaurant.created_at asc
  limit 1
)
where menu.restaurant_id is null;

alter table public.service_menus
  drop constraint if exists service_menus_org_name_unique;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'service_menus_org_restaurant_name_unique'
      and connamespace = 'public'::regnamespace
  ) then
    alter table public.service_menus
      add constraint service_menus_org_restaurant_name_unique
      unique (organization_id, restaurant_id, name);
  end if;
end $$;

create or replace function public.validate_service_menu_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  restaurant_org_id uuid;
begin
  if new.restaurant_id is null then
    return new;
  end if;

  select restaurant.organization_id
    into restaurant_org_id
  from public.restaurants restaurant
  where restaurant.id = new.restaurant_id
    and restaurant.is_active = true;

  if restaurant_org_id is null then
    raise exception 'Selected restaurant does not exist or is inactive';
  end if;

  if restaurant_org_id <> new.organization_id then
    raise exception 'Service menu and restaurant must belong to the same organization';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_service_menu_scope on public.service_menus;
create trigger validate_service_menu_scope
before insert or update on public.service_menus
for each row
execute function public.validate_service_menu_scope();

commit;
