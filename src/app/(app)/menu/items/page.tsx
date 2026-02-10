import { redirect } from "next/navigation";

import {
  type MenuCostPhoto,
  MenuCostingWorkspace,
  type IngredientOption,
  type MenuCostRow,
  type MenuItemOption,
  type RecipeDetailRow,
  type ServiceMenuOption,
} from "@/app/(app)/menu/items/menu-costing-workspace";
import { PageHeader } from "@/components/shared/page-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/supabase/tenant";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleDateString();
}

function getCostRisk({
  foodCostPct,
  ingredientCount,
  missingCostCount,
}: {
  foodCostPct: number;
  ingredientCount: number;
  missingCostCount: number;
}): MenuCostRow["risk"] {
  if (ingredientCount === 0 || missingCostCount > 0) return "incomplete";
  if (foodCostPct > 40) return "high";
  if (foodCostPct > 30) return "watch";
  return "healthy";
}

export default async function MenuItemsPage() {
  const tenantContext = await getTenantContext();
  if (!tenantContext.user) {
    redirect("/auth/login");
  }

  if (!tenantContext.activeOrganizationId || !tenantContext.activeRestaurantId) {
    return (
      <>
        <PageHeader
          title="Menu Costing"
          description="Select a restaurant from the top bar to calculate food cost and margin."
        />
      </>
    );
  }

  const supabase = await createSupabaseServerClient();
  const organizationId = tenantContext.activeOrganizationId;
  const restaurantId = tenantContext.activeRestaurantId;

  const [menuItemsQuery, recipesQuery, recipeIngredientsQuery, ingredientsQuery, unitsQuery, inventoryItemsQuery, serviceMenusQuery, menuItemPhotosQuery, restaurantSettingsQuery] =
    await Promise.all([
      supabase
        .from("menu_items")
        .select("id, name, category, description, price, status, image_path, updated_at")
        .eq("organization_id", organizationId)
        .order("name"),
      supabase
        .from("recipes")
        .select("id, menu_item_id, yield_quantity")
        .eq("organization_id", organizationId),
      supabase
        .from("recipe_ingredients")
        .select("id, recipe_id, ingredient_id, quantity")
        .eq("organization_id", organizationId),
      supabase
        .from("ingredients")
        .select("id, name, base_unit_id")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("units")
        .select("id, symbol")
        .eq("organization_id", organizationId),
      supabase
        .from("inventory_items")
        .select("ingredient_id, cost_per_unit")
        .eq("organization_id", organizationId)
        .eq("restaurant_id", restaurantId),
      supabase
        .from("service_menus")
        .select("id, name")
        .eq("organization_id", organizationId)
        .or(`restaurant_id.eq.${restaurantId},restaurant_id.is.null`)
        .neq("status", "archived")
        .order("name"),
      supabase
        .from("menu_item_photos")
        .select("menu_item_id, path, is_cover, sort_order, created_at")
        .eq("organization_id", organizationId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("restaurants")
        .select("currency_code")
        .eq("id", restaurantId)
        .eq("organization_id", organizationId)
        .maybeSingle(),
    ]);

  const errors = [
    menuItemsQuery.error?.message,
    recipesQuery.error?.message,
    recipeIngredientsQuery.error?.message,
    ingredientsQuery.error?.message,
    unitsQuery.error?.message,
    inventoryItemsQuery.error?.message,
    serviceMenusQuery.error?.message,
    menuItemPhotosQuery.error?.message,
    restaurantSettingsQuery.error?.message,
  ].filter(Boolean) as string[];

  if (errors.length > 0) {
    return (
      <>
        <PageHeader
          title="Menu Costing"
          description="Track real recipe cost and margin by restaurant."
        />
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          {errors[0]}
        </div>
      </>
    );
  }

  const menuItems = (menuItemsQuery.data ?? []) as Array<{
    id: string;
    name: string;
    category: string;
    description: string | null;
    price: number;
    status: "draft" | "active" | "archived";
    image_path: string | null;
    updated_at: string;
  }>;
  const recipes = (recipesQuery.data ?? []) as Array<{
    id: string;
    menu_item_id: string;
    yield_quantity: number;
  }>;
  const recipeIngredients = (recipeIngredientsQuery.data ?? []) as Array<{
    id: string;
    recipe_id: string;
    ingredient_id: string;
    quantity: number;
  }>;
  const ingredients = (ingredientsQuery.data ?? []) as Array<{
    id: string;
    name: string;
    base_unit_id: string | null;
  }>;
  const units = (unitsQuery.data ?? []) as Array<{
    id: string;
    symbol: string;
  }>;
  const inventoryItems = (inventoryItemsQuery.data ?? []) as Array<{
    ingredient_id: string;
    cost_per_unit: number | null;
  }>;
  const serviceMenus = (serviceMenusQuery.data ?? []) as Array<{
    id: string;
    name: string;
  }>;
  const menuItemPhotos = (menuItemPhotosQuery.data ?? []) as Array<{
    menu_item_id: string;
    path: string;
    is_cover: boolean;
    sort_order: number;
    created_at: string;
  }>;

  const recipeByMenuItemId = new Map(recipes.map((recipe) => [recipe.menu_item_id, recipe]));
  const ingredientsByRecipeId = new Map<string, typeof recipeIngredients>();
  recipeIngredients.forEach((entry) => {
    const collection = ingredientsByRecipeId.get(entry.recipe_id) ?? [];
    collection.push(entry);
    ingredientsByRecipeId.set(entry.recipe_id, collection);
  });

  const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const unitSymbolById = new Map(units.map((unit) => [unit.id, unit.symbol]));
  const costByIngredientId = new Map(
    inventoryItems.map((item) => [item.ingredient_id, Number(item.cost_per_unit ?? 0)])
  );

  const photosByMenuItemId = new Map<string, typeof menuItemPhotos>();
  menuItemPhotos.forEach((photo) => {
    const list = photosByMenuItemId.get(photo.menu_item_id) ?? [];
    list.push(photo);
    photosByMenuItemId.set(photo.menu_item_id, list);
  });

  const rows: MenuCostRow[] = menuItems.map((item) => {
    const recipe = recipeByMenuItemId.get(item.id);
    const recipeRows = recipe ? ingredientsByRecipeId.get(recipe.id) ?? [] : [];

    let recipeCostTotal = 0;
    let missingCostCount = 0;

    recipeRows.forEach((ingredientEntry) => {
      const costPerUnit = costByIngredientId.get(ingredientEntry.ingredient_id);
      if (costPerUnit === undefined) {
        missingCostCount += 1;
        return;
      }
      recipeCostTotal += Number(ingredientEntry.quantity) * costPerUnit;
    });

    const yieldQty = Number(recipe?.yield_quantity ?? 1) || 1;
    const recipeCost = recipeCostTotal / yieldQty;
    const foodCostPct = item.price > 0 ? (recipeCost / item.price) * 100 : 0;
    const margin = item.price - recipeCost;
    const ingredientCount = recipeRows.length;
    const risk = getCostRisk({
      foodCostPct,
      ingredientCount,
      missingCostCount,
    });

    const photoList = [...(photosByMenuItemId.get(item.id) ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order
    );
    const photos: MenuCostPhoto[] = photoList.map((photo) => ({
      path: photo.path,
      imageUrl: supabase.storage.from("menu-item-images").getPublicUrl(photo.path).data
        .publicUrl,
      sortOrder: photo.sort_order,
      isCover: photo.is_cover,
    }));

    const coverPhoto =
      photos.find((photo) => photo.isCover) ??
      photos[0] ??
      null;
    const effectivePath = coverPhoto?.path ?? item.image_path;
    const imageUrl = effectivePath
      ? supabase.storage.from("menu-item-images").getPublicUrl(effectivePath).data
          .publicUrl
      : null;

    return {
      id: item.id,
      name: item.name,
      category: item.category,
      description: item.description ?? "",
      photos,
      status: item.status,
      imageUrl,
      price: Number(item.price ?? 0),
      recipeCost,
      foodCostPct,
      margin,
      ingredientCount,
      missingCostCount,
      risk,
      updatedAt: formatDate(item.updated_at),
    };
  });

  const recipeDetails: Record<string, RecipeDetailRow[]> = {};
  menuItems.forEach((item) => {
    const recipe = recipeByMenuItemId.get(item.id);
    const recipeRows = recipe ? ingredientsByRecipeId.get(recipe.id) ?? [] : [];

    recipeDetails[item.id] = recipeRows.map((entry) => {
      const ingredient = ingredientById.get(entry.ingredient_id);
      const unitSymbol = ingredient?.base_unit_id
        ? unitSymbolById.get(ingredient.base_unit_id) ?? "u"
        : "u";
      const costPerUnit = costByIngredientId.get(entry.ingredient_id);
      const ingredientCost =
        costPerUnit === undefined ? null : Number(entry.quantity) * costPerUnit;

      return {
        ingredientName: ingredient?.name ?? "Ingredient",
        quantity: Number(entry.quantity ?? 0),
        unitSymbol,
        ingredientCost,
      };
    });
  });

  const menuItemOptions: MenuItemOption[] = menuItems.map((item) => ({
    id: item.id,
    name: item.name,
  }));

  const ingredientOptions: IngredientOption[] = ingredients.map((ingredient) => ({
    id: ingredient.id,
    name: ingredient.name,
    unitSymbol: ingredient.base_unit_id
      ? unitSymbolById.get(ingredient.base_unit_id) ?? "u"
      : "u",
  }));
  const serviceMenuOptions: ServiceMenuOption[] = serviceMenus.map((menu) => ({
    id: menu.id,
    name: menu.name,
  }));

  const restaurantName =
    tenantContext.restaurants.find(
      (restaurant) => restaurant.id === tenantContext.activeRestaurantId
    )?.name ?? "Active Restaurant";
  const currencyCode = restaurantSettingsQuery.data?.currency_code ?? "USD";

  return (
    <>
      <PageHeader
        title="Dishes Library"
        description="Create dishes and keep costs/margins synced with live inventory."
      />
      <MenuCostingWorkspace
        restaurantName={restaurantName}
        currencyCode={currencyCode}
        rows={rows}
        menuItems={menuItemOptions}
        ingredients={ingredientOptions}
        recipeDetails={recipeDetails}
        serviceMenus={serviceMenuOptions}
      />
    </>
  );
}
