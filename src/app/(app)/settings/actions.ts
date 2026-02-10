"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type SettingsActionResult = {
  ok: boolean;
  error?: string;
  message?: string;
};

export async function updateStoreCurrencyAction(
  currencyCode: string
): Promise<SettingsActionResult> {
  const normalizedCurrency = currencyCode.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
    return { ok: false, error: "Currency must be a 3-letter ISO code." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, error: "You must be authenticated." };
  }

  const { data: preferences, error: preferencesError } = await supabase
    .from("user_preferences")
    .select("active_restaurant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (preferencesError) {
    return { ok: false, error: "Could not load active restaurant." };
  }

  if (!preferences?.active_restaurant_id) {
    return { ok: false, error: "Select a restaurant first." };
  }

  const { data: updatedRestaurant, error: updateError } = await supabase
    .from("restaurants")
    .update({ currency_code: normalizedCurrency })
    .eq("id", preferences.active_restaurant_id)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return { ok: false, error: updateError.message };
  }
  if (!updatedRestaurant) {
    return { ok: false, error: "Could not update active restaurant currency." };
  }

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true, message: "Store currency updated." };
}
