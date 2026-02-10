import { redirect } from "next/navigation";

import {
  MenuPlannerWorkspace,
  type DishOption,
  type ServiceMenuOption,
  type ServiceMenuRow,
} from "@/app/(app)/menu/menus/menu-planner-workspace";
import { PageHeader } from "@/components/shared/page-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/supabase/tenant";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleDateString();
}

function buildScheduleLabel(
  startsOn: string | null,
  endsOn: string | null,
  weekendOnly: boolean
) {
  const window =
    startsOn || endsOn
      ? `${startsOn ? formatDate(startsOn) : "Now"} - ${endsOn ? formatDate(endsOn) : "Open"}`
      : "Always on";

  return weekendOnly ? `${window} (weekend)` : window;
}

export default async function MenuPlannerPage() {
  const tenantContext = await getTenantContext();
  if (!tenantContext.user) {
    redirect("/auth/login");
  }

  if (!tenantContext.activeOrganizationId || !tenantContext.activeRestaurantId) {
    return (
      <>
        <PageHeader
          title="Menu Planner"
          description="Select a restaurant from the top bar to compose menus."
        />
      </>
    );
  }

  const supabase = await createSupabaseServerClient();
  const organizationId = tenantContext.activeOrganizationId;
  const restaurantId = tenantContext.activeRestaurantId;

  const [serviceMenusQuery, serviceMenuItemsQuery, dishesQuery] = await Promise.all([
    supabase
      .from("service_menus")
      .select("id, restaurant_id, name, status, starts_on, ends_on, weekend_only, updated_at")
      .eq("organization_id", organizationId)
      .or(`restaurant_id.eq.${restaurantId},restaurant_id.is.null`)
      .order("name"),
    supabase
      .from("service_menu_items")
      .select("id, service_menu_id, menu_item_id")
      .eq("organization_id", organizationId),
    supabase
      .from("menu_items")
      .select("id, name, category, status")
      .eq("organization_id", organizationId)
      .neq("status", "archived")
      .order("name"),
  ]);

  const errors = [
    serviceMenusQuery.error?.message,
    serviceMenuItemsQuery.error?.message,
    dishesQuery.error?.message,
  ].filter(Boolean) as string[];

  if (errors.length > 0) {
    return (
      <>
        <PageHeader
          title="Menu Planner"
          description="Compose menus from your dish library."
        />
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          {errors[0]}
        </div>
      </>
    );
  }

  const serviceMenus = (serviceMenusQuery.data ?? []) as Array<{
    id: string;
    restaurant_id: string | null;
    name: string;
    status: "draft" | "active" | "archived";
    starts_on: string | null;
    ends_on: string | null;
    weekend_only: boolean;
    updated_at: string;
  }>;
  const serviceMenuItems = (serviceMenuItemsQuery.data ?? []) as Array<{
    id: string;
    service_menu_id: string;
    menu_item_id: string;
  }>;
  const dishes = (dishesQuery.data ?? []) as Array<{
    id: string;
    name: string;
    category: string;
    status: "draft" | "active" | "archived";
  }>;

  const dishCountByMenuId = new Map<string, number>();
  serviceMenuItems.forEach((entry) => {
    dishCountByMenuId.set(
      entry.service_menu_id,
      (dishCountByMenuId.get(entry.service_menu_id) ?? 0) + 1
    );
  });

  const rows: ServiceMenuRow[] = serviceMenus.map((menu) => ({
    id: menu.id,
    name: menu.name,
    status: menu.status,
    schedule: buildScheduleLabel(menu.starts_on, menu.ends_on, menu.weekend_only),
    weekendOnly: menu.weekend_only,
    dishCount: dishCountByMenuId.get(menu.id) ?? 0,
    updatedAt: formatDate(menu.updated_at),
  }));

  const dishById = new Map(
    dishes.map((dish) => [
      dish.id,
      { id: dish.id, name: dish.name, category: dish.category } as DishOption,
    ])
  );

  const dishesByMenu: Record<string, DishOption[]> = {};
  serviceMenus.forEach((menu) => {
    const entries = serviceMenuItems
      .filter((entry) => entry.service_menu_id === menu.id)
      .map((entry) => dishById.get(entry.menu_item_id))
      .filter(Boolean) as DishOption[];

    dishesByMenu[menu.id] = entries;
  });

  const menuOptions: ServiceMenuOption[] = serviceMenus.map((menu) => ({
    id: menu.id,
    name: menu.name,
  }));

  const dishOptions: DishOption[] = dishes.map((dish) => ({
    id: dish.id,
    name: dish.name,
    category: dish.category,
  }));

  const restaurantName =
    tenantContext.restaurants.find(
      (restaurant) => restaurant.id === tenantContext.activeRestaurantId
    )?.name ?? "Active Restaurant";

  return (
    <>
      <PageHeader
        title="Menu Planner"
        description="Create time-based menus and attach dishes from your dish library."
      />
      <MenuPlannerWorkspace
        restaurantName={restaurantName}
        rows={rows}
        menuOptions={menuOptions}
        dishOptions={dishOptions}
        dishesByMenu={dishesByMenu}
      />
    </>
  );
}
