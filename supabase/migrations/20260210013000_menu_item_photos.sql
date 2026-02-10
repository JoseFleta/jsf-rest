begin;

create table if not exists public.menu_item_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  path text not null,
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  constraint menu_item_photos_unique_path unique (menu_item_id, path)
);

create index if not exists menu_item_photos_menu_item_id_idx
  on public.menu_item_photos (menu_item_id);

create index if not exists menu_item_photos_organization_id_idx
  on public.menu_item_photos (organization_id);

create or replace function public.validate_menu_item_photo_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item_org_id uuid;
begin
  select item.organization_id
    into item_org_id
  from public.menu_items item
  where item.id = new.menu_item_id;

  if item_org_id is null then
    raise exception 'Dish does not exist';
  end if;

  if item_org_id <> new.organization_id then
    raise exception 'Photo and dish must belong to the same organization';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_menu_item_photo_scope on public.menu_item_photos;
create trigger validate_menu_item_photo_scope
before insert or update on public.menu_item_photos
for each row
execute function public.validate_menu_item_photo_scope();

create or replace function public.ensure_single_cover_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_cover then
    update public.menu_item_photos photo
    set is_cover = false
    where photo.menu_item_id = new.menu_item_id
      and photo.id <> new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_single_cover_photo on public.menu_item_photos;
create trigger ensure_single_cover_photo
before insert or update on public.menu_item_photos
for each row
execute function public.ensure_single_cover_photo();

insert into public.menu_item_photos (organization_id, menu_item_id, path, sort_order, is_cover)
select
  item.organization_id,
  item.id,
  item.image_path,
  0,
  true
from public.menu_items item
where item.image_path is not null
  and not exists (
    select 1
    from public.menu_item_photos photo
    where photo.menu_item_id = item.id
      and photo.path = item.image_path
  );

alter table public.menu_item_photos enable row level security;

drop policy if exists menu_item_photos_select on public.menu_item_photos;
create policy menu_item_photos_select
on public.menu_item_photos
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists menu_item_photos_insert on public.menu_item_photos;
create policy menu_item_photos_insert
on public.menu_item_photos
for insert
to authenticated
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'admin', 'manager']::public.organization_role[]
  )
);

drop policy if exists menu_item_photos_update on public.menu_item_photos;
create policy menu_item_photos_update
on public.menu_item_photos
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

drop policy if exists menu_item_photos_delete on public.menu_item_photos;
create policy menu_item_photos_delete
on public.menu_item_photos
for delete
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'admin', 'manager']::public.organization_role[]
  )
);

grant select, insert, update, delete
  on public.menu_item_photos
  to authenticated;

commit;
