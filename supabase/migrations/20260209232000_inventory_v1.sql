begin;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'inventory_unit_kind'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.inventory_unit_kind as enum (
      'weight',
      'volume',
      'count',
      'other'
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'inventory_movement_type'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.inventory_movement_type as enum (
      'receive',
      'consume',
      'adjustment'
    );
  end if;
end $$;

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  symbol text not null,
  kind public.inventory_unit_kind not null default 'count',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint units_org_name_unique unique (organization_id, name),
  constraint units_org_symbol_unique unique (organization_id, symbol)
);

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  sku text,
  base_unit_id uuid references public.units(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ingredients_org_name_unique unique (organization_id, name)
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  contact_email text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint suppliers_org_name_unique unique (organization_id, name)
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  current_quantity numeric(12, 3) not null default 0,
  reorder_level numeric(12, 3) not null default 0,
  par_level numeric(12, 3) not null default 0,
  cost_per_unit numeric(12, 4) not null default 0,
  last_movement_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint inventory_items_restaurant_ingredient_unique unique (restaurant_id, ingredient_id)
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  movement_type public.inventory_movement_type not null,
  quantity_delta numeric(12, 3) not null,
  unit_cost numeric(12, 4),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint stock_movements_non_zero_quantity check (quantity_delta <> 0)
);

create index if not exists units_organization_id_idx
  on public.units (organization_id);

create index if not exists ingredients_organization_id_idx
  on public.ingredients (organization_id);

create index if not exists inventory_items_restaurant_id_idx
  on public.inventory_items (restaurant_id);

create index if not exists inventory_items_organization_id_idx
  on public.inventory_items (organization_id);

create index if not exists stock_movements_inventory_item_id_idx
  on public.stock_movements (inventory_item_id);

create index if not exists stock_movements_restaurant_created_at_idx
  on public.stock_movements (restaurant_id, created_at desc);

drop trigger if exists set_units_updated_at on public.units;
create trigger set_units_updated_at
before update on public.units
for each row
execute function public.set_updated_at();

drop trigger if exists set_ingredients_updated_at on public.ingredients;
create trigger set_ingredients_updated_at
before update on public.ingredients
for each row
execute function public.set_updated_at();

drop trigger if exists set_suppliers_updated_at on public.suppliers;
create trigger set_suppliers_updated_at
before update on public.suppliers
for each row
execute function public.set_updated_at();

drop trigger if exists set_inventory_items_updated_at on public.inventory_items;
create trigger set_inventory_items_updated_at
before update on public.inventory_items
for each row
execute function public.set_updated_at();

create or replace function public.seed_default_units(target_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.units (organization_id, name, symbol, kind)
  values
    (target_organization_id, 'Kilogram', 'kg', 'weight'),
    (target_organization_id, 'Gram', 'g', 'weight'),
    (target_organization_id, 'Liter', 'L', 'volume'),
    (target_organization_id, 'Milliliter', 'ml', 'volume'),
    (target_organization_id, 'Piece', 'pc', 'count'),
    (target_organization_id, 'Pack', 'pack', 'count')
  on conflict (organization_id, name) do nothing;
end;
$$;

create or replace function public.handle_organization_seed_units()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_units(new.id);
  return new;
end;
$$;

drop trigger if exists on_organization_seed_units on public.organizations;
create trigger on_organization_seed_units
after insert on public.organizations
for each row
execute function public.handle_organization_seed_units();

create or replace function public.validate_ingredient_unit_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  unit_org_id uuid;
begin
  if new.base_unit_id is null then
    return new;
  end if;

  select unit.organization_id
    into unit_org_id
  from public.units unit
  where unit.id = new.base_unit_id;

  if unit_org_id is null then
    raise exception 'Selected unit does not exist';
  end if;

  if unit_org_id <> new.organization_id then
    raise exception 'Unit and ingredient must belong to the same organization';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_ingredient_unit_scope on public.ingredients;
create trigger validate_ingredient_unit_scope
before insert or update on public.ingredients
for each row
execute function public.validate_ingredient_unit_scope();

create or replace function public.validate_inventory_item_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ingredient_org_id uuid;
  restaurant_org_id uuid;
begin
  select ingredient.organization_id
    into ingredient_org_id
  from public.ingredients ingredient
  where ingredient.id = new.ingredient_id;

  if ingredient_org_id is null then
    raise exception 'Selected ingredient does not exist';
  end if;

  select restaurant.organization_id
    into restaurant_org_id
  from public.restaurants restaurant
  where restaurant.id = new.restaurant_id;

  if restaurant_org_id is null then
    raise exception 'Selected restaurant does not exist';
  end if;

  if ingredient_org_id <> restaurant_org_id then
    raise exception 'Ingredient and restaurant must belong to the same organization';
  end if;

  if new.organization_id <> restaurant_org_id then
    raise exception 'Inventory item organization does not match restaurant organization';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_inventory_item_scope on public.inventory_items;
create trigger validate_inventory_item_scope
before insert or update on public.inventory_items
for each row
execute function public.validate_inventory_item_scope();

create or replace function public.validate_stock_movement_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item_org_id uuid;
  item_restaurant_id uuid;
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  select item.organization_id, item.restaurant_id
    into item_org_id, item_restaurant_id
  from public.inventory_items item
  where item.id = new.inventory_item_id;

  if item_org_id is null then
    raise exception 'Inventory item does not exist';
  end if;

  if new.organization_id <> item_org_id then
    raise exception 'Movement organization does not match inventory item organization';
  end if;

  if new.restaurant_id <> item_restaurant_id then
    raise exception 'Movement restaurant does not match inventory item restaurant';
  end if;

  if new.movement_type = 'receive' and new.quantity_delta <= 0 then
    raise exception 'Receive movement requires a positive quantity';
  end if;

  if new.movement_type = 'consume' and new.quantity_delta >= 0 then
    raise exception 'Consume movement requires a negative quantity';
  end if;

  if current_user_id is not null then
    if new.created_by is null then
      new.created_by := current_user_id;
    elsif new.created_by <> current_user_id then
      raise exception 'Cannot write movements on behalf of another user';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_stock_movement_scope on public.stock_movements;
create trigger validate_stock_movement_scope
before insert on public.stock_movements
for each row
execute function public.validate_stock_movement_scope();

create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.inventory_items item
  set
    current_quantity = item.current_quantity + new.quantity_delta,
    last_movement_at = new.created_at,
    updated_at = timezone('utc', now())
  where item.id = new.inventory_item_id;

  return new;
end;
$$;

drop trigger if exists apply_stock_movement on public.stock_movements;
create trigger apply_stock_movement
after insert on public.stock_movements
for each row
execute function public.apply_stock_movement();

insert into public.units (organization_id, name, symbol, kind)
select organization.id, seed.name, seed.symbol, seed.kind
from public.organizations organization
cross join (
  values
    ('Kilogram', 'kg', 'weight'::public.inventory_unit_kind),
    ('Gram', 'g', 'weight'::public.inventory_unit_kind),
    ('Liter', 'L', 'volume'::public.inventory_unit_kind),
    ('Milliliter', 'ml', 'volume'::public.inventory_unit_kind),
    ('Piece', 'pc', 'count'::public.inventory_unit_kind),
    ('Pack', 'pack', 'count'::public.inventory_unit_kind)
) as seed(name, symbol, kind)
on conflict (organization_id, name) do nothing;

alter table public.units enable row level security;
alter table public.ingredients enable row level security;
alter table public.suppliers enable row level security;
alter table public.inventory_items enable row level security;
alter table public.stock_movements enable row level security;

drop policy if exists units_select on public.units;
create policy units_select
on public.units
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists units_insert on public.units;
create policy units_insert
on public.units
for insert
to authenticated
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'admin', 'manager']::public.organization_role[]
  )
);

drop policy if exists units_update on public.units;
create policy units_update
on public.units
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

drop policy if exists units_delete on public.units;
create policy units_delete
on public.units
for delete
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'admin']::public.organization_role[]
  )
);

drop policy if exists ingredients_select on public.ingredients;
create policy ingredients_select
on public.ingredients
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists ingredients_insert on public.ingredients;
create policy ingredients_insert
on public.ingredients
for insert
to authenticated
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'admin', 'manager']::public.organization_role[]
  )
);

drop policy if exists ingredients_update on public.ingredients;
create policy ingredients_update
on public.ingredients
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

drop policy if exists ingredients_delete on public.ingredients;
create policy ingredients_delete
on public.ingredients
for delete
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'admin']::public.organization_role[]
  )
);

drop policy if exists suppliers_select on public.suppliers;
create policy suppliers_select
on public.suppliers
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists suppliers_insert on public.suppliers;
create policy suppliers_insert
on public.suppliers
for insert
to authenticated
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'admin', 'manager']::public.organization_role[]
  )
);

drop policy if exists suppliers_update on public.suppliers;
create policy suppliers_update
on public.suppliers
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

drop policy if exists suppliers_delete on public.suppliers;
create policy suppliers_delete
on public.suppliers
for delete
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'admin']::public.organization_role[]
  )
);

drop policy if exists inventory_items_select on public.inventory_items;
create policy inventory_items_select
on public.inventory_items
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists inventory_items_insert on public.inventory_items;
create policy inventory_items_insert
on public.inventory_items
for insert
to authenticated
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'admin', 'manager']::public.organization_role[]
  )
);

drop policy if exists inventory_items_update on public.inventory_items;
create policy inventory_items_update
on public.inventory_items
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

drop policy if exists inventory_items_delete on public.inventory_items;
create policy inventory_items_delete
on public.inventory_items
for delete
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'admin']::public.organization_role[]
  )
);

drop policy if exists stock_movements_select on public.stock_movements;
create policy stock_movements_select
on public.stock_movements
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists stock_movements_insert on public.stock_movements;
create policy stock_movements_insert
on public.stock_movements
for insert
to authenticated
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'admin', 'manager', 'staff']::public.organization_role[]
  )
);

drop policy if exists stock_movements_update on public.stock_movements;
create policy stock_movements_update
on public.stock_movements
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

drop policy if exists stock_movements_delete on public.stock_movements;
create policy stock_movements_delete
on public.stock_movements
for delete
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'admin']::public.organization_role[]
  )
);

grant select, insert, update, delete
  on public.units
  to authenticated;

grant select, insert, update, delete
  on public.ingredients
  to authenticated;

grant select, insert, update, delete
  on public.suppliers
  to authenticated;

grant select, insert, update, delete
  on public.inventory_items
  to authenticated;

grant select, insert, update, delete
  on public.stock_movements
  to authenticated;

grant execute on function public.seed_default_units(uuid) to authenticated;

commit;
