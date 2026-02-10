begin;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'menu_item_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.menu_item_status as enum (
      'draft',
      'active',
      'archived'
    );
  end if;
end $$;

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category text not null default 'General',
  price numeric(12, 2) not null default 0,
  status public.menu_item_status not null default 'draft',
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint menu_items_org_name_unique unique (organization_id, name),
  constraint menu_items_price_non_negative check (price >= 0)
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  yield_quantity numeric(12, 3) not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint recipes_menu_item_unique unique (menu_item_id),
  constraint recipes_yield_positive check (yield_quantity > 0)
);

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  quantity numeric(12, 3) not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint recipe_ingredients_recipe_ingredient_unique unique (recipe_id, ingredient_id),
  constraint recipe_ingredients_quantity_positive check (quantity > 0)
);

create index if not exists menu_items_organization_id_idx
  on public.menu_items (organization_id);

create index if not exists recipes_organization_id_idx
  on public.recipes (organization_id);

create index if not exists recipe_ingredients_organization_id_idx
  on public.recipe_ingredients (organization_id);

create index if not exists recipe_ingredients_recipe_id_idx
  on public.recipe_ingredients (recipe_id);

drop trigger if exists set_menu_items_updated_at on public.menu_items;
create trigger set_menu_items_updated_at
before update on public.menu_items
for each row
execute function public.set_updated_at();

drop trigger if exists set_recipes_updated_at on public.recipes;
create trigger set_recipes_updated_at
before update on public.recipes
for each row
execute function public.set_updated_at();

drop trigger if exists set_recipe_ingredients_updated_at on public.recipe_ingredients;
create trigger set_recipe_ingredients_updated_at
before update on public.recipe_ingredients
for each row
execute function public.set_updated_at();

create or replace function public.ensure_recipe_for_menu_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.recipes (organization_id, menu_item_id, yield_quantity)
  values (new.organization_id, new.id, 1)
  on conflict (menu_item_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_menu_item_created on public.menu_items;
create trigger on_menu_item_created
after insert on public.menu_items
for each row
execute function public.ensure_recipe_for_menu_item();

create or replace function public.validate_recipe_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  menu_item_org_id uuid;
begin
  select item.organization_id
    into menu_item_org_id
  from public.menu_items item
  where item.id = new.menu_item_id;

  if menu_item_org_id is null then
    raise exception 'Selected menu item does not exist';
  end if;

  if menu_item_org_id <> new.organization_id then
    raise exception 'Recipe and menu item must belong to the same organization';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_recipe_scope on public.recipes;
create trigger validate_recipe_scope
before insert or update on public.recipes
for each row
execute function public.validate_recipe_scope();

create or replace function public.validate_recipe_ingredient_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipe_org_id uuid;
  ingredient_org_id uuid;
begin
  select recipe.organization_id
    into recipe_org_id
  from public.recipes recipe
  where recipe.id = new.recipe_id;

  if recipe_org_id is null then
    raise exception 'Selected recipe does not exist';
  end if;

  select ingredient.organization_id
    into ingredient_org_id
  from public.ingredients ingredient
  where ingredient.id = new.ingredient_id;

  if ingredient_org_id is null then
    raise exception 'Selected ingredient does not exist';
  end if;

  if recipe_org_id <> ingredient_org_id then
    raise exception 'Recipe and ingredient must belong to the same organization';
  end if;

  if new.organization_id <> recipe_org_id then
    raise exception 'Recipe ingredient organization does not match recipe organization';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_recipe_ingredient_scope on public.recipe_ingredients;
create trigger validate_recipe_ingredient_scope
before insert or update on public.recipe_ingredients
for each row
execute function public.validate_recipe_ingredient_scope();

alter table public.menu_items enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;

drop policy if exists menu_items_select on public.menu_items;
create policy menu_items_select
on public.menu_items
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists menu_items_insert on public.menu_items;
create policy menu_items_insert
on public.menu_items
for insert
to authenticated
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'admin', 'manager']::public.organization_role[]
  )
);

drop policy if exists menu_items_update on public.menu_items;
create policy menu_items_update
on public.menu_items
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

drop policy if exists menu_items_delete on public.menu_items;
create policy menu_items_delete
on public.menu_items
for delete
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'admin']::public.organization_role[]
  )
);

drop policy if exists recipes_select on public.recipes;
create policy recipes_select
on public.recipes
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists recipes_insert on public.recipes;
create policy recipes_insert
on public.recipes
for insert
to authenticated
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'admin', 'manager']::public.organization_role[]
  )
);

drop policy if exists recipes_update on public.recipes;
create policy recipes_update
on public.recipes
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

drop policy if exists recipes_delete on public.recipes;
create policy recipes_delete
on public.recipes
for delete
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'admin']::public.organization_role[]
  )
);

drop policy if exists recipe_ingredients_select on public.recipe_ingredients;
create policy recipe_ingredients_select
on public.recipe_ingredients
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists recipe_ingredients_insert on public.recipe_ingredients;
create policy recipe_ingredients_insert
on public.recipe_ingredients
for insert
to authenticated
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'admin', 'manager']::public.organization_role[]
  )
);

drop policy if exists recipe_ingredients_update on public.recipe_ingredients;
create policy recipe_ingredients_update
on public.recipe_ingredients
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

drop policy if exists recipe_ingredients_delete on public.recipe_ingredients;
create policy recipe_ingredients_delete
on public.recipe_ingredients
for delete
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'admin']::public.organization_role[]
  )
);

grant select, insert, update, delete
  on public.menu_items
  to authenticated;

grant select, insert, update, delete
  on public.recipes
  to authenticated;

grant select, insert, update, delete
  on public.recipe_ingredients
  to authenticated;

commit;
