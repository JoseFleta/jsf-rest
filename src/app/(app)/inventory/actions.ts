"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type InventoryActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
};

type InventoryScope = {
  organizationId: string;
  restaurantId: string;
  userId: string;
};

type CreateInventoryItemInput = {
  name: string;
  sku?: string;
  unitId: string;
  openingQuantity: string;
  reorderLevel: string;
  parLevel: string;
  costPerUnit: string;
};

type CreateStockMovementInput = {
  inventoryItemId: string;
  movementType: "receive" | "consume" | "adjustment";
  quantity: string;
  unitCost?: string;
  note?: string;
};

function toNumber(raw: string) {
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

async function getInventoryScope(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>; scope: InventoryScope }
  | { ok: false; error: string }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      error: "You must be signed in.",
    };
  }

  const { data: preferences, error: preferencesError } = await supabase
    .from("user_preferences")
    .select("active_organization_id, active_restaurant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (preferencesError) {
    return {
      ok: false,
      error: "Could not load your active restaurant.",
    };
  }

  if (!preferences?.active_organization_id || !preferences.active_restaurant_id) {
    return {
      ok: false,
      error: "Select a restaurant first.",
    };
  }

  return {
    ok: true,
    supabase,
    scope: {
      organizationId: preferences.active_organization_id,
      restaurantId: preferences.active_restaurant_id,
      userId: user.id,
    },
  };
}

export async function createInventoryItemAction(
  input: CreateInventoryItemInput
): Promise<InventoryActionResult> {
  const name = input.name.trim();
  if (name.length < 2) {
    return { ok: false, error: "Item name is too short." };
  }

  if (!input.unitId) {
    return { ok: false, error: "Choose a unit." };
  }

  const openingQuantity = toNumber(input.openingQuantity);
  const reorderLevel = toNumber(input.reorderLevel);
  const parLevel = toNumber(input.parLevel);
  const costPerUnit = toNumber(input.costPerUnit);

  if (
    openingQuantity === null ||
    reorderLevel === null ||
    parLevel === null ||
    costPerUnit === null
  ) {
    return {
      ok: false,
      error: "Use valid numeric values for quantity and levels.",
    };
  }

  if (reorderLevel < 0 || parLevel < 0 || costPerUnit < 0) {
    return {
      ok: false,
      error: "Quantity, levels, and cost must be zero or greater.",
    };
  }

  const scopeResult = await getInventoryScope();
  if (!scopeResult.ok) {
    return { ok: false, error: scopeResult.error };
  }

  const { supabase, scope } = scopeResult;

  const { data: unit, error: unitError } = await supabase
    .from("units")
    .select("id")
    .eq("id", input.unitId)
    .eq("organization_id", scope.organizationId)
    .maybeSingle();

  if (unitError || !unit) {
    return { ok: false, error: "Selected unit is not available." };
  }

  const { data: existingIngredient, error: existingIngredientError } = await supabase
    .from("ingredients")
    .select("id")
    .eq("organization_id", scope.organizationId)
    .ilike("name", name)
    .maybeSingle();

  if (existingIngredientError) {
    return { ok: false, error: "Could not validate the ingredient." };
  }

  let ingredientId = existingIngredient?.id ?? null;

  if (!ingredientId) {
    const { data: newIngredient, error: createIngredientError } = await supabase
      .from("ingredients")
      .insert({
        organization_id: scope.organizationId,
        name,
        sku: input.sku?.trim() || null,
        base_unit_id: input.unitId,
      })
      .select("id")
      .maybeSingle();

    if (createIngredientError || !newIngredient) {
      return { ok: false, error: "Could not create the ingredient." };
    }

    ingredientId = newIngredient.id;
  } else {
    await supabase
      .from("ingredients")
      .update({
        base_unit_id: input.unitId,
        sku: input.sku?.trim() || null,
      })
      .eq("id", ingredientId)
      .eq("organization_id", scope.organizationId);
  }

  const { data: existingInventoryItem, error: existingInventoryItemError } =
    await supabase
      .from("inventory_items")
      .select("id")
      .eq("restaurant_id", scope.restaurantId)
      .eq("ingredient_id", ingredientId)
      .maybeSingle();

  if (existingInventoryItemError) {
    return { ok: false, error: "Could not validate the inventory item." };
  }

  if (existingInventoryItem) {
    return {
      ok: false,
      error: "This item already exists for the selected restaurant.",
    };
  }

  const { data: inventoryItem, error: createInventoryItemError } = await supabase
    .from("inventory_items")
    .insert({
      organization_id: scope.organizationId,
      restaurant_id: scope.restaurantId,
      ingredient_id: ingredientId,
      current_quantity: 0,
      reorder_level: reorderLevel,
      par_level: parLevel,
      cost_per_unit: costPerUnit,
    })
    .select("id")
    .maybeSingle();

  if (createInventoryItemError || !inventoryItem) {
    return { ok: false, error: "Could not add the inventory item." };
  }

  if (openingQuantity !== 0) {
    const { error: movementError } = await supabase.from("stock_movements").insert({
      organization_id: scope.organizationId,
      restaurant_id: scope.restaurantId,
      inventory_item_id: inventoryItem.id,
      movement_type: "adjustment",
      quantity_delta: openingQuantity,
      unit_cost: costPerUnit,
      note: "Opening balance",
      created_by: scope.userId,
    });

    if (movementError) {
      return { ok: false, error: "Item created, but opening stock failed to save." };
    }
  }

  revalidatePath("/inventory");
  return {
    ok: true,
    message: "Item added to inventory.",
  };
}

export async function createStockMovementAction(
  input: CreateStockMovementInput
): Promise<InventoryActionResult> {
  if (!input.inventoryItemId) {
    return { ok: false, error: "Choose an item first." };
  }

  const quantity = toNumber(input.quantity);
  if (quantity === null || quantity === 0) {
    return { ok: false, error: "Quantity must be a non-zero number." };
  }

  const parsedUnitCost = input.unitCost ? toNumber(input.unitCost) : null;
  if (input.unitCost && parsedUnitCost === null) {
    return { ok: false, error: "Unit cost must be a valid number." };
  }

  const scopeResult = await getInventoryScope();
  if (!scopeResult.ok) {
    return { ok: false, error: scopeResult.error };
  }

  const { supabase, scope } = scopeResult;

  const { data: item, error: itemError } = await supabase
    .from("inventory_items")
    .select("id")
    .eq("id", input.inventoryItemId)
    .eq("restaurant_id", scope.restaurantId)
    .eq("organization_id", scope.organizationId)
    .maybeSingle();

  if (itemError || !item) {
    return { ok: false, error: "Selected inventory item is not available." };
  }

  let quantityDelta = quantity;
  if (input.movementType === "receive") {
    quantityDelta = Math.abs(quantity);
  } else if (input.movementType === "consume") {
    quantityDelta = -Math.abs(quantity);
  }

  const { error: movementError } = await supabase.from("stock_movements").insert({
    organization_id: scope.organizationId,
    restaurant_id: scope.restaurantId,
    inventory_item_id: input.inventoryItemId,
    movement_type: input.movementType,
    quantity_delta: quantityDelta,
    unit_cost: parsedUnitCost,
    note: input.note?.trim() || null,
    created_by: scope.userId,
  });

  if (movementError) {
    return { ok: false, error: "Could not save the movement." };
  }

  revalidatePath("/inventory");

  const messageByType: Record<CreateStockMovementInput["movementType"], string> = {
    receive: "Stock received.",
    consume: "Usage recorded.",
    adjustment: "Stock adjusted.",
  };

  return {
    ok: true,
    message: messageByType[input.movementType],
  };
}
