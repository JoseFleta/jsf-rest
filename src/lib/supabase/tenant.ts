import type { User } from "@supabase/supabase-js";
import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OrganizationRole = "owner" | "admin" | "manager" | "staff";

export type TenantRestaurant = {
  id: string;
  name: string;
  city: string | null;
  organizationId: string;
  organizationName: string;
};

export type TenantContext = {
  user: User | null;
  organizations: Array<{
    id: string;
    name: string;
    role: OrganizationRole;
  }>;
  restaurants: TenantRestaurant[];
  activeOrganizationId: string | null;
  activeRestaurantId: string | null;
  errors: string[];
};

async function ensureDefaultTenantForUser(user: User, errors: string[]) {
  const supabase = await createSupabaseServerClient();
  const slug = `org-${user.id.replace(/-/g, "")}`;
  const nameSeed =
    (user.user_metadata.full_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "My";
  const organizationName = `${nameSeed} Organization`;

  const { error: insertOrganizationError } = await supabase
    .from("organizations")
    .insert({
      name: organizationName,
      slug,
      created_by: user.id,
    });

  if (
    insertOrganizationError &&
    !insertOrganizationError.message.toLowerCase().includes("duplicate")
  ) {
    errors.push(insertOrganizationError.message);
    return;
  }

  const { data: organizations, error: fetchOrganizationError } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .limit(1);

  if (fetchOrganizationError) {
    errors.push(fetchOrganizationError.message);
    return;
  }

  const organizationId = organizations?.[0]?.id;
  if (!organizationId) {
    errors.push("Could not create or fetch the default organization.");
    return;
  }

  const { data: restaurants, error: fetchRestaurantError } = await supabase
    .from("restaurants")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .limit(1);

  if (fetchRestaurantError) {
    errors.push(fetchRestaurantError.message);
    return;
  }

  let restaurantId = restaurants?.[0]?.id ?? null;

  if (!restaurantId) {
    const { data: insertedRestaurants, error: insertRestaurantError } =
      await supabase
        .from("restaurants")
        .insert({
          organization_id: organizationId,
          name: "Main Location",
          code: "MAIN",
          city: null,
        })
        .select("id")
        .limit(1);

    if (insertRestaurantError) {
      errors.push(insertRestaurantError.message);
      return;
    }

    restaurantId = insertedRestaurants?.[0]?.id ?? null;
  }

  const { error: preferenceError } = await supabase.from("user_preferences").upsert(
    {
      user_id: user.id,
      active_organization_id: organizationId,
      active_restaurant_id: restaurantId,
    },
    { onConflict: "user_id" }
  );

  if (preferenceError) {
    errors.push(preferenceError.message);
  }
}

async function buildTenantContext(): Promise<TenantContext> {
  const supabase = await createSupabaseServerClient();
  const errors: string[] = [];

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    errors.push(userError.message);
  }

  if (!user) {
    return {
      user: null,
      organizations: [],
      restaurants: [],
      activeOrganizationId: null,
      activeRestaurantId: null,
      errors,
    };
  }

  let { data: membershipRows, error: membershipsError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id);

  if (membershipsError) {
    errors.push(membershipsError.message);
  }

  if ((membershipRows ?? []).length === 0) {
    await ensureDefaultTenantForUser(user, errors);

    const { data: reloadedMembershipRows, error: reloadedMembershipsError } =
      await supabase
        .from("organization_memberships")
        .select("organization_id, role")
        .eq("user_id", user.id);

    if (reloadedMembershipsError) {
      errors.push(reloadedMembershipsError.message);
    } else {
      membershipRows = reloadedMembershipRows;
      membershipsError = null;
    }
  }

  const organizationIds = [
    ...new Set((membershipRows ?? []).map((membership) => membership.organization_id)),
  ];

  let organizationRows: Array<{ id: string; name: string }> = [];
  if (organizationIds.length > 0) {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name")
      .in("id", organizationIds)
      .order("name");

    if (error) {
      errors.push(error.message);
    } else {
      organizationRows = data ?? [];
    }
  }

  let restaurantRows: Array<{
    id: string;
    name: string;
    city: string | null;
    organization_id: string;
  }> = [];

  if (organizationIds.length > 0) {
    const { data, error } = await supabase
      .from("restaurants")
      .select("id, name, city, organization_id")
      .in("organization_id", organizationIds)
      .eq("is_active", true)
      .order("name");

    if (error) {
      errors.push(error.message);
    } else {
      restaurantRows = data ?? [];
    }
  }

  const { data: preferenceRow, error: preferenceError } = await supabase
    .from("user_preferences")
    .select("active_organization_id, active_restaurant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (preferenceError) {
    errors.push(preferenceError.message);
  }

  const organizationNameById = new Map(
    organizationRows.map((organization) => [organization.id, organization.name])
  );

  const organizations = (membershipRows ?? []).map((membership) => ({
    id: membership.organization_id,
    role: membership.role,
    name: organizationNameById.get(membership.organization_id) ?? "Organization",
  }));

  const restaurants = restaurantRows.map((restaurant) => ({
    id: restaurant.id,
    name: restaurant.name,
    city: restaurant.city,
    organizationId: restaurant.organization_id,
    organizationName:
      organizationNameById.get(restaurant.organization_id) ?? "Organization",
  }));

  const preferredRestaurantId = preferenceRow?.active_restaurant_id ?? null;
  const activeRestaurantId = restaurants.some(
    (restaurant) => restaurant.id === preferredRestaurantId
  )
    ? preferredRestaurantId
    : (restaurants[0]?.id ?? null);

  const activeRestaurant = restaurants.find(
    (restaurant) => restaurant.id === activeRestaurantId
  );

  return {
    user,
    organizations,
    restaurants,
    activeOrganizationId:
      activeRestaurant?.organizationId ??
      preferenceRow?.active_organization_id ??
      null,
    activeRestaurantId,
    errors,
  };
}

export const getTenantContext = cache(buildTenantContext);
