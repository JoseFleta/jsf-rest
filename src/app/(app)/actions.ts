"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type ActionResult = {
  ok: boolean;
  error?: string;
};

export async function setActiveRestaurantAction(
  restaurantId: string
): Promise<ActionResult> {
  if (!restaurantId) {
    return { ok: false, error: "Restaurant id is required." };
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      error: userError?.message ?? "You must be authenticated.",
    };
  }

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id, organization_id")
    .eq("id", restaurantId)
    .maybeSingle();

  if (restaurantError) {
    return { ok: false, error: restaurantError.message };
  }

  if (!restaurant) {
    return {
      ok: false,
      error: "The selected restaurant was not found or is not accessible.",
    };
  }

  const { error: preferenceError } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: user.id,
        active_organization_id: restaurant.organization_id,
        active_restaurant_id: restaurant.id,
      },
      { onConflict: "user_id" }
    );

  if (preferenceError) {
    return { ok: false, error: preferenceError.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
