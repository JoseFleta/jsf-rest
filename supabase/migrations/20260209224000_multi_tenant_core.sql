begin;

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'organization_role'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.organization_role as enum ('owner', 'admin', 'manager', 'staff');
  end if;
end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint organizations_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'staff',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organization_id, user_id)
);

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text,
  city text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurants_org_name_unique unique (organization_id, name)
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_organization_id uuid references public.organizations(id) on delete set null,
  active_restaurant_id uuid references public.restaurants(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists organization_memberships_user_id_idx
  on public.organization_memberships (user_id);

create index if not exists restaurants_organization_id_idx
  on public.restaurants (organization_id);

create index if not exists user_preferences_active_restaurant_id_idx
  on public.user_preferences (active_restaurant_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at
before update on public.organizations
for each row
execute function public.set_updated_at();

drop trigger if exists set_organization_memberships_updated_at on public.organization_memberships;
create trigger set_organization_memberships_updated_at
before update on public.organization_memberships
for each row
execute function public.set_updated_at();

drop trigger if exists set_restaurants_updated_at on public.restaurants;
create trigger set_restaurants_updated_at
before update on public.restaurants
for each row
execute function public.set_updated_at();

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at
before update on public.user_preferences
for each row
execute function public.set_updated_at();

create or replace function public.has_org_role(
  target_organization_id uuid,
  allowed_roles public.organization_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.user_id = auth.uid()
      and membership.role = any(allowed_roles)
  );
$$;

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.user_id = auth.uid()
  );
$$;

create or replace function public.handle_organization_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into public.organization_memberships (organization_id, user_id, role)
    values (new.id, new.created_by, 'owner')
    on conflict (organization_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_organization_created on public.organizations;
create trigger on_organization_created
after insert on public.organizations
for each row
execute function public.handle_organization_created();

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_auth_user_created();

create or replace function public.validate_user_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_org_id uuid;
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is not null and new.user_id <> current_user_id then
    raise exception 'Cannot modify preferences for another user';
  end if;

  if new.active_restaurant_id is not null then
    select restaurant.organization_id
      into selected_org_id
    from public.restaurants restaurant
    where restaurant.id = new.active_restaurant_id
      and restaurant.is_active = true;

    if selected_org_id is null then
      raise exception 'Restaurant is invalid or inactive';
    end if;

    if current_user_id is not null and not public.is_org_member(selected_org_id) then
      raise exception 'Not authorized for selected restaurant';
    end if;

    new.active_organization_id := selected_org_id;
  elsif new.active_organization_id is not null then
    if current_user_id is not null and not public.is_org_member(new.active_organization_id) then
      raise exception 'Not authorized for selected organization';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_user_preferences on public.user_preferences;
create trigger validate_user_preferences
before insert or update on public.user_preferences
for each row
execute function public.validate_user_preferences();

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.restaurants enable row level security;
alter table public.user_preferences enable row level security;

drop policy if exists organizations_select on public.organizations;
create policy organizations_select
on public.organizations
for select
to authenticated
using (public.is_org_member(id));

drop policy if exists organizations_insert on public.organizations;
create policy organizations_insert
on public.organizations
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists organizations_update on public.organizations;
create policy organizations_update
on public.organizations
for update
to authenticated
using (
  public.has_org_role(id, array['owner', 'admin']::public.organization_role[])
)
with check (
  public.has_org_role(id, array['owner', 'admin']::public.organization_role[])
);

drop policy if exists organizations_delete on public.organizations;
create policy organizations_delete
on public.organizations
for delete
to authenticated
using (
  public.has_org_role(id, array['owner']::public.organization_role[])
);

drop policy if exists memberships_select on public.organization_memberships;
create policy memberships_select
on public.organization_memberships
for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_org_role(
    organization_id,
    array['owner', 'admin', 'manager']::public.organization_role[]
  )
);

drop policy if exists memberships_insert on public.organization_memberships;
create policy memberships_insert
on public.organization_memberships
for insert
to authenticated
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'admin']::public.organization_role[]
  )
);

drop policy if exists memberships_update on public.organization_memberships;
create policy memberships_update
on public.organization_memberships
for update
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'admin']::public.organization_role[]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'admin']::public.organization_role[]
  )
);

drop policy if exists memberships_delete on public.organization_memberships;
create policy memberships_delete
on public.organization_memberships
for delete
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'admin']::public.organization_role[]
  )
);

drop policy if exists restaurants_select on public.restaurants;
create policy restaurants_select
on public.restaurants
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists restaurants_insert on public.restaurants;
create policy restaurants_insert
on public.restaurants
for insert
to authenticated
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'admin', 'manager']::public.organization_role[]
  )
);

drop policy if exists restaurants_update on public.restaurants;
create policy restaurants_update
on public.restaurants
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

drop policy if exists restaurants_delete on public.restaurants;
create policy restaurants_delete
on public.restaurants
for delete
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'admin']::public.organization_role[]
  )
);

drop policy if exists user_preferences_select on public.user_preferences;
create policy user_preferences_select
on public.user_preferences
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists user_preferences_insert on public.user_preferences;
create policy user_preferences_insert
on public.user_preferences
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists user_preferences_update on public.user_preferences;
create policy user_preferences_update
on public.user_preferences
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists user_preferences_delete on public.user_preferences;
create policy user_preferences_delete
on public.user_preferences
for delete
to authenticated
using (user_id = auth.uid());

grant usage on schema public to authenticated;

grant select, insert, update, delete
  on public.organizations
  to authenticated;

grant select, insert, update, delete
  on public.organization_memberships
  to authenticated;

grant select, insert, update, delete
  on public.restaurants
  to authenticated;

grant select, insert, update, delete
  on public.user_preferences
  to authenticated;

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.organization_role[]) to authenticated;

commit;
