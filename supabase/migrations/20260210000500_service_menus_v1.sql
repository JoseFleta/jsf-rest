begin;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'service_menu_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.service_menu_status as enum (
      'draft',
      'active',
      'archived'
    );
  end if;
end $$;

create table if not exists public.service_menus (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  status public.service_menu_status not null default 'draft',
  starts_on date,
  ends_on date,
  weekend_only boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint service_menus_org_name_unique unique (organization_id, name),
  constraint service_menus_dates_valid check (
    starts_on is null
    or ends_on is null
    or starts_on <= ends_on
  )
);

create table if not exists public.service_menu_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  service_menu_id uuid not null references public.service_menus(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint service_menu_items_unique unique (service_menu_id, menu_item_id)
);

create index if not exists service_menus_organization_id_idx
  on public.service_menus (organization_id);

create index if not exists service_menus_status_idx
  on public.service_menus (status);

create index if not exists service_menu_items_organization_id_idx
  on public.service_menu_items (organization_id);

create index if not exists service_menu_items_menu_id_idx
  on public.service_menu_items (service_menu_id);

drop trigger if exists set_service_menus_updated_at on public.service_menus;
create trigger set_service_menus_updated_at
before update on public.service_menus
for each row
execute function public.set_updated_at();

drop trigger if exists set_service_menu_items_updated_at on public.service_menu_items;
create trigger set_service_menu_items_updated_at
before update on public.service_menu_items
for each row
execute function public.set_updated_at();

create or replace function public.validate_service_menu_item_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  menu_org_id uuid;
  dish_org_id uuid;
begin
  select service_menu.organization_id
    into menu_org_id
  from public.service_menus service_menu
  where service_menu.id = new.service_menu_id;

  if menu_org_id is null then
    raise exception 'Service menu does not exist';
  end if;

  select item.organization_id
    into dish_org_id
  from public.menu_items item
  where item.id = new.menu_item_id;

  if dish_org_id is null then
    raise exception 'Dish does not exist';
  end if;

  if menu_org_id <> dish_org_id then
    raise exception 'Dish and service menu must belong to the same organization';
  end if;

  if new.organization_id <> menu_org_id then
    raise exception 'Service menu item organization mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_service_menu_item_scope on public.service_menu_items;
create trigger validate_service_menu_item_scope
before insert or update on public.service_menu_items
for each row
execute function public.validate_service_menu_item_scope();

alter table public.service_menus enable row level security;
alter table public.service_menu_items enable row level security;

drop policy if exists service_menus_select on public.service_menus;
create policy service_menus_select
on public.service_menus
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists service_menus_insert on public.service_menus;
create policy service_menus_insert
on public.service_menus
for insert
to authenticated
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'admin', 'manager']::public.organization_role[]
  )
);

drop policy if exists service_menus_update on public.service_menus;
create policy service_menus_update
on public.service_menus
for update
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'admin', 'manager']::public.organization_role[]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'admin', 'manager']::public.organization_role[]
  )
);

drop policy if exists service_menus_delete on public.service_menus;
create policy service_menus_delete
on public.service_menus
for delete
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'admin']::public.organization_role[]
  )
);

drop policy if exists service_menu_items_select on public.service_menu_items;
create policy service_menu_items_select
on public.service_menu_items
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists service_menu_items_insert on public.service_menu_items;
create policy service_menu_items_insert
on public.service_menu_items
for insert
to authenticated
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'admin', 'manager']::public.organization_role[]
  )
);

drop policy if exists service_menu_items_update on public.service_menu_items;
create policy service_menu_items_update
on public.service_menu_items
for update
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'admin', 'manager']::public.organization_role[]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'admin', 'manager']::public.organization_role[]
  )
);

drop policy if exists service_menu_items_delete on public.service_menu_items;
create policy service_menu_items_delete
on public.service_menu_items
for delete
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'admin']::public.organization_role[]
  )
);

grant select, insert, update, delete
  on public.service_menus
  to authenticated;

grant select, insert, update, delete
  on public.service_menu_items
  to authenticated;

commit;
