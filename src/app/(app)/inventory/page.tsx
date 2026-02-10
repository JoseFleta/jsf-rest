import { redirect } from "next/navigation";

import { InventoryWorkspace, type InventoryRow, type MovementFeedRow, type UnitOption } from "@/app/(app)/inventory/inventory-workspace";
import { PageHeader } from "@/components/shared/page-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/supabase/tenant";

export const dynamic = "force-dynamic";

function getInventoryStatus(
  quantity: number,
  reorderLevel: number,
  parLevel: number
): InventoryRow["status"] {
  if (quantity <= reorderLevel) return "low";
  if (quantity <= parLevel) return "watch";
  return "healthy";
}

function formatDate(value: string | null) {
  if (!value) return "No movement yet";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "No movement yet"
    : parsed.toLocaleString();
}

export default async function InventoryPage() {
  const tenantContext = await getTenantContext();
  if (!tenantContext.user) {
    redirect("/auth/login");
  }

  if (!tenantContext.activeOrganizationId || !tenantContext.activeRestaurantId) {
    return (
      <>
        <PageHeader
          title="Inventory"
          description="Select a restaurant from the top bar to start tracking stock."
        />
      </>
    );
  }

  const supabase = await createSupabaseServerClient();
  const activeRestaurantId = tenantContext.activeRestaurantId;
  const activeOrganizationId = tenantContext.activeOrganizationId;

  const [unitsQuery, ingredientsQuery, inventoryItemsQuery, movementFeedQuery, restaurantSettingsQuery] =
    await Promise.all([
      supabase
        .from("units")
        .select("id, name, symbol")
        .eq("organization_id", activeOrganizationId)
        .order("name"),
      supabase
        .from("ingredients")
        .select("id, name, sku, base_unit_id")
        .eq("organization_id", activeOrganizationId)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("inventory_items")
        .select(
          "id, ingredient_id, current_quantity, reorder_level, par_level, cost_per_unit, last_movement_at"
        )
        .eq("restaurant_id", activeRestaurantId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("stock_movements")
        .select(
          "id, inventory_item_id, movement_type, quantity_delta, created_at, note"
        )
        .eq("restaurant_id", activeRestaurantId)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("restaurants")
        .select("currency_code")
        .eq("id", activeRestaurantId)
        .eq("organization_id", activeOrganizationId)
        .maybeSingle(),
    ]);

  const errors = [
    unitsQuery.error?.message,
    ingredientsQuery.error?.message,
    inventoryItemsQuery.error?.message,
    movementFeedQuery.error?.message,
    restaurantSettingsQuery.error?.message,
  ].filter(Boolean) as string[];

  if (errors.length > 0) {
    return (
      <>
        <PageHeader
          title="Inventory"
          description="Monitor stock levels, movements, and restock signals."
        />
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          {errors[0]}
        </div>
      </>
    );
  }

  const units = (unitsQuery.data ?? []) as UnitOption[];
  const ingredients = (ingredientsQuery.data ??
    []) as Array<{ id: string; name: string; sku: string | null; base_unit_id: string | null }>;
  const inventoryItems = (inventoryItemsQuery.data ?? []) as Array<{
    id: string;
    ingredient_id: string;
    current_quantity: number | null;
    reorder_level: number | null;
    par_level: number | null;
    cost_per_unit: number | null;
    last_movement_at: string | null;
  }>;
  const movementFeedRows = (movementFeedQuery.data ?? []) as Array<{
    id: string;
    inventory_item_id: string;
    movement_type: "receive" | "consume" | "adjustment";
    quantity_delta: number;
    created_at: string;
    note: string | null;
  }>;

  const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const currencyCode = restaurantSettingsQuery.data?.currency_code ?? "USD";

  const items: InventoryRow[] = inventoryItems.map((item) => {
    const ingredient = ingredientById.get(item.ingredient_id);
    const unit = ingredient?.base_unit_id
      ? unitById.get(ingredient.base_unit_id)
      : null;

    const quantity = Number(item.current_quantity ?? 0);
    const reorderLevel = Number(item.reorder_level ?? 0);
    const parLevel = Number(item.par_level ?? 0);
    const unitCost = Number(item.cost_per_unit ?? 0);

    return {
      id: item.id,
      ingredientId: item.ingredient_id,
      item: ingredient?.name ?? "Unnamed item",
      sku: ingredient?.sku ?? "-",
      currencyCode,
      quantity,
      reorderLevel,
      parLevel,
      unitSymbol: unit?.symbol ?? "u",
      status: getInventoryStatus(quantity, reorderLevel, parLevel),
      unitCost,
      stockValue: quantity * unitCost,
      lastMovementAt: formatDate(item.last_movement_at),
    };
  });

  const itemNameById = new Map(items.map((item) => [item.id, item.item]));
  const movementFeed: MovementFeedRow[] = movementFeedRows.map((movement) => ({
    id: movement.id,
    item: itemNameById.get(movement.inventory_item_id) ?? "Inventory item",
    movementType: movement.movement_type,
    quantityDelta: Number(movement.quantity_delta ?? 0),
    createdAt: formatDate(movement.created_at),
    note: movement.note ?? "No note",
  }));

  const restaurantName =
    tenantContext.restaurants.find(
      (restaurant) => restaurant.id === tenantContext.activeRestaurantId
    )?.name ?? "Active Restaurant";

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Monitor stock levels, movements, and restock signals."
      />
      <InventoryWorkspace
        restaurantName={restaurantName}
        currencyCode={currencyCode}
        items={items}
        units={units}
        movementFeed={movementFeed}
      />
    </>
  );
}
