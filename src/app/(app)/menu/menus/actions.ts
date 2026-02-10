"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type MenuPlannerActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
};

type MenuPlannerScope = {
  organizationId: string;
  restaurantId: string;
};

type CreateServiceMenuInput = {
  name: string;
  description: string;
  status: "draft" | "active";
  startsOn: string;
  endsOn: string;
  weekendOnly: "true" | "false";
};

type AttachDishInput = {
  serviceMenuId: string;
  menuItemId: string;
};

async function getMenuPlannerScope(): Promise<
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
      scope: MenuPlannerScope;
    }
  | { ok: false; error: string }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, error: "You must be signed in." };
  }

  const { data: preferences, error: preferencesError } = await supabase
    .from("user_preferences")
    .select("active_organization_id, active_restaurant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (preferencesError) {
    return { ok: false, error: "Could not load your organization." };
  }

  if (!preferences?.active_organization_id) {
    return { ok: false, error: "Select an organization first." };
  }
  if (!preferences.active_restaurant_id) {
    return { ok: false, error: "Select a restaurant first." };
  }

  return {
    ok: true,
    supabase,
    scope: {
      organizationId: preferences.active_organization_id,
      restaurantId: preferences.active_restaurant_id,
    },
  };
}

export async function createServiceMenuAction(
  input: CreateServiceMenuInput
): Promise<MenuPlannerActionResult> {
  const name = input.name.trim();
  if (name.length < 2) {
    return { ok: false, error: "Menu name is too short." };
  }

  const startsOn = input.startsOn || null;
  const endsOn = input.endsOn || null;
  if (startsOn && endsOn && startsOn > endsOn) {
    return { ok: false, error: "Start date must be before end date." };
  }

  const scopeResult = await getMenuPlannerScope();
  if (!scopeResult.ok) {
    return { ok: false, error: scopeResult.error };
  }

  const { supabase, scope } = scopeResult;

  const { error } = await supabase.from("service_menus").insert({
    organization_id: scope.organizationId,
    restaurant_id: scope.restaurantId,
    name,
    description: input.description.trim() || null,
    status: input.status,
    starts_on: startsOn,
    ends_on: endsOn,
    weekend_only: input.weekendOnly === "true",
  });

  if (error) {
    if (error.message.toLowerCase().includes("unique")) {
      return { ok: false, error: "This menu already exists." };
    }
    return { ok: false, error: "Could not create menu." };
  }

  revalidatePath("/menu");
  revalidatePath("/menu/menus");
  return { ok: true, message: "Menu created." };
}

export async function attachDishToMenuAction(
  input: AttachDishInput
): Promise<MenuPlannerActionResult> {
  if (!input.serviceMenuId) {
    return { ok: false, error: "Choose a menu." };
  }
  if (!input.menuItemId) {
    return { ok: false, error: "Choose a dish." };
  }

  const scopeResult = await getMenuPlannerScope();
  if (!scopeResult.ok) {
    return { ok: false, error: scopeResult.error };
  }

  const { supabase, scope } = scopeResult;

  const { data: serviceMenu, error: serviceMenuError } = await supabase
    .from("service_menus")
    .select("id")
    .eq("id", input.serviceMenuId)
    .eq("organization_id", scope.organizationId)
    .eq("restaurant_id", scope.restaurantId)
    .maybeSingle();

  if (serviceMenuError || !serviceMenu) {
    return { ok: false, error: "Selected menu is not available." };
  }

  const { data: dish, error: dishError } = await supabase
    .from("menu_items")
    .select("id")
    .eq("id", input.menuItemId)
    .eq("organization_id", scope.organizationId)
    .maybeSingle();

  if (dishError || !dish) {
    return { ok: false, error: "Selected dish is not available." };
  }

  const { error } = await supabase
    .from("service_menu_items")
    .upsert(
      {
        organization_id: scope.organizationId,
        service_menu_id: input.serviceMenuId,
        menu_item_id: input.menuItemId,
      },
      {
        onConflict: "service_menu_id,menu_item_id",
      }
    );

  if (error) {
    return { ok: false, error: "Could not add dish to menu." };
  }

  revalidatePath("/menu");
  revalidatePath("/menu/menus");
  return { ok: true, message: "Dish added to menu." };
}
