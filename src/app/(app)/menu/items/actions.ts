"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type MenuActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
  createdMenuItemId?: string;
  createdMenuItems?: Array<{
    id: string;
    name: string;
  }>;
};

type MenuScope = {
  organizationId: string;
  restaurantId: string;
};

type CreateMenuItemInput = {
  name: string;
  description: string;
  category: string;
  price: string;
  status: "draft" | "active";
  addToAllMenus: boolean;
  selectedMenuIds: string[];
};

type AddRecipeIngredientInput = {
  menuItemId: string;
  ingredientId: string;
  quantity: string;
};

type UpdateMenuItemInput = {
  menuItemId: string;
  name: string;
  description: string;
  category: string;
  price: string;
  status: "draft" | "active" | "archived";
};

type DeleteMenuItemInput = {
  menuItemId: string;
};

type BulkUpdateMenuItemsInput = {
  menuItemIds: string[];
  category?: string;
  price?: string;
};

type BulkDeleteMenuItemsInput = {
  menuItemIds: string[];
};

type SyncMenuItemPhotosInput = {
  menuItemId: string;
  orderedPhotoPaths: string[];
};

type GenerateMenuItemImageInput = {
  name: string;
  description?: string;
};

type GenerateMenuItemImageResult = {
  ok: boolean;
  error?: string;
  imageBase64?: string;
  mimeType?: string;
};

type BatchItemType = "food" | "drink" | "ingredient";

type BatchMenuItemDraft = {
  name: string;
  description: string;
  itemType: BatchItemType;
  category: string;
  price: string;
  status: "draft" | "active";
};

type ParseBatchMenuItemsResult = {
  ok: boolean;
  error?: string;
  items?: BatchMenuItemDraft[];
  summary?: string;
};

type CreateMenuItemsBatchInput = {
  items: BatchMenuItemDraft[];
  addToAllMenus: boolean;
  selectedMenuIds: string[];
};

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getFileExtension(fileName: string) {
  const parts = fileName.split(".");
  if (parts.length < 2) return "jpg";
  return parts[parts.length - 1].toLowerCase();
}

function normalizeImageMimeType(mimeType: string) {
  const normalized = mimeType.toLowerCase().trim();
  if (normalized === "image/jpg") return "image/jpeg";
  return normalized;
}

function normalizePriceInput(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const cleaned = raw.replace(/\s+/g, "").replace(/[^0-9,.\-]/g, "");
  if (!cleaned) return null;

  let normalized = cleaned;
  const hasDot = normalized.includes(".");
  const hasComma = normalized.includes(",");

  if (hasDot && hasComma) {
    const lastDot = normalized.lastIndexOf(".");
    const lastComma = normalized.lastIndexOf(",");
    const decimalSep = lastDot > lastComma ? "." : ",";
    const thousandsSep = decimalSep === "." ? "," : ".";
    normalized = normalized.split(thousandsSep).join("");
    normalized = normalized.replace(decimalSep, ".");
  } else if (hasDot || hasComma) {
    const sep = hasDot ? "." : ",";
    const parts = normalized.split(sep);
    if (parts.length > 2) {
      const allThousands = parts.slice(1).every((part) => part.length === 3);
      if (allThousands) {
        normalized = parts.join("");
      } else {
        const last = parts.pop() ?? "";
        normalized = `${parts.join("")}.${last}`;
      }
    } else if (parts.length === 2) {
      const fractional = parts[1] ?? "";
      if (fractional.length === 3) {
        normalized = parts.join("");
      } else if (fractional.length === 0) {
        normalized = parts[0] ?? "";
      } else {
        normalized = `${parts[0] ?? ""}.${fractional}`;
      }
    }
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDraftStatus(value: string | null | undefined): "draft" | "active" {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "draft" || normalized === "borrador" ? "draft" : "active";
}

function inferItemTypeFromText(text: string): BatchItemType {
  const normalized = text.toLowerCase();

  if (
    /\b(bebida|bebidas|drink|drinks|soda|cola|agua|water|juice|jugo|cerveza|beer|vino|wine|cocktail|cafe|coffee|tea|te)\b/.test(
      normalized
    )
  ) {
    return "drink";
  }

  if (
    /\b(ingrediente|ingredientes|adicion|adiciones|addon|add-on|extra|extras|topping|salsa|queso|proteina|verdura|jamon|serrano|pesto)\b/.test(
      normalized
    )
  ) {
    return "ingredient";
  }

  return "food";
}

function normalizeItemType(value: string | null | undefined, category: string, name: string) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (
    normalized === "drink" ||
    normalized === "drinks" ||
    normalized === "bebida" ||
    normalized === "bebidas"
  ) {
    return "drink" satisfies BatchItemType;
  }
  if (
    normalized === "ingredient" ||
    normalized === "ingredients" ||
    normalized === "ingrediente" ||
    normalized === "ingredientes" ||
    normalized === "addon" ||
    normalized === "add-on" ||
    normalized === "adicion" ||
    normalized === "adiciones"
  ) {
    return "ingredient" satisfies BatchItemType;
  }
  if (normalized === "food" || normalized === "dish" || normalized === "plato") {
    return "food" satisfies BatchItemType;
  }

  return inferItemTypeFromText(`${category} ${name}`);
}

function defaultCategoryForType(itemType: BatchItemType) {
  if (itemType === "drink") return "Drinks";
  if (itemType === "ingredient") return "Ingredients";
  return "Food";
}

function normalizeBatchDraft(input: {
  name?: string | null;
  description?: string | null;
  itemType?: string | null;
  category?: string | null;
  price?: string | number | null;
  status?: string | null;
}): BatchMenuItemDraft | null {
  const name = String(input.name ?? "").trim();
  if (name.length < 2) {
    return null;
  }

  const itemType = normalizeItemType(input.itemType, String(input.category ?? ""), name);
  const price = normalizePriceInput(input.price ?? "");
  const safePrice = price === null ? 0 : price;
  if (safePrice < 0) {
    return null;
  }

  const rawCategory = String(input.category ?? "").trim();
  const category = rawCategory.length > 0 ? rawCategory : defaultCategoryForType(itemType);

  return {
    name,
    description: String(input.description ?? "").trim(),
    itemType,
    category,
    price: safePrice.toFixed(2),
    status: normalizeDraftStatus(input.status),
  };
}

function parseCsvRows(csvText: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(cell.trim());
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some((value) => value.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

function parseJsonPayload(raw: string): unknown {
  const codeFenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const trimmed = (codeFenceMatch?.[1] ?? raw).trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function getMenuScope(): Promise<
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
      scope: MenuScope;
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

async function resolveEligibleServiceMenuIds(
  scope: MenuScope,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  addToAllMenus: boolean,
  selectedMenuIds: string[]
) {
  if (!addToAllMenus && selectedMenuIds.length === 0) {
    return { ok: true as const, menuIds: [] as string[] };
  }

  if (addToAllMenus) {
    const { data: allMenus, error } = await supabase
      .from("service_menus")
      .select("id")
      .eq("organization_id", scope.organizationId)
      .or(`restaurant_id.eq.${scope.restaurantId},restaurant_id.is.null`);

    if (error) {
      return { ok: false as const, error: "Menu assignment failed." };
    }

    return { ok: true as const, menuIds: (allMenus ?? []).map((menu) => menu.id) };
  }

  const { data: selectedMenus, error } = await supabase
    .from("service_menus")
    .select("id")
    .eq("organization_id", scope.organizationId)
    .in("id", selectedMenuIds)
    .or(`restaurant_id.eq.${scope.restaurantId},restaurant_id.is.null`);

  if (error) {
    return { ok: false as const, error: "Menu assignment failed." };
  }

  return {
    ok: true as const,
    menuIds: (selectedMenus ?? []).map((menu) => menu.id),
  };
}

async function parseCsvMenuItems(file: File): Promise<ParseBatchMenuItemsResult> {
  const rawText = await file.text();
  const rows = parseCsvRows(rawText);

  if (rows.length === 0) {
    return { ok: false, error: "CSV is empty." };
  }

  const firstRow = rows[0].map((cell) => cell.toLowerCase().trim());
  const findColumn = (aliases: string[]) =>
    firstRow.findIndex((cell) =>
      aliases.some((alias) => cell === alias || cell.includes(alias))
    );

  const nameColumn = findColumn(["name", "dish", "item", "producto", "plato"]);
  const hasHeader = nameColumn >= 0;
  const descriptionColumn = findColumn(["description", "details", "notes", "descripcion"]);
  const typeColumn = findColumn(["type", "item type", "item_type", "kind", "tipo"]);
  const categoryColumn = findColumn(["category", "section", "group", "grupo", "categoria"]);
  const priceColumn = findColumn(["price", "cost", "amount"]);
  const statusColumn = findColumn(["status", "state"]);

  const bodyRows = hasHeader ? rows.slice(1) : rows;
  const items = bodyRows
    .map((row) => {
      if (hasHeader) {
        return normalizeBatchDraft({
          name: row[nameColumn] ?? "",
          description: row[descriptionColumn] ?? "",
          itemType: row[typeColumn] ?? "",
          category: row[categoryColumn] ?? "",
          price: row[priceColumn] ?? "0",
          status: row[statusColumn] ?? "active",
        });
      }

      const hasTypeColumnWithoutHeader = row.length >= 6;
      return normalizeBatchDraft({
        name: row[0] ?? "",
        description: row[1] ?? "",
        itemType: hasTypeColumnWithoutHeader ? row[2] ?? "" : "",
        category: hasTypeColumnWithoutHeader ? row[3] ?? "" : row[2] ?? "",
        price: hasTypeColumnWithoutHeader ? row[4] ?? "0" : row[3] ?? "0",
        status: hasTypeColumnWithoutHeader ? row[5] ?? "active" : row[4] ?? "active",
      });
    })
    .filter((item): item is BatchMenuItemDraft => item !== null);

  if (items.length === 0) {
    return {
      ok: false,
      error:
        "No valid menu rows found. Include at least a name and a valid price (zero or greater).",
    };
  }

  const foods = items.filter((item) => item.itemType === "food").length;
  const drinks = items.filter((item) => item.itemType === "drink").length;
  const ingredients = items.filter((item) => item.itemType === "ingredient").length;

  return {
    ok: true,
    items: items.slice(0, 300),
    summary: `Parsed ${Math.min(items.length, 300)} item(s) from CSV (${foods} food, ${drinks} drinks, ${ingredients} ingredients).`,
  };
}

async function parsePdfMenuItems(file: File): Promise<ParseBatchMenuItemsResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Missing OPENAI_API_KEY in .env.local." };
  }

  const fileBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const model = process.env.OPENAI_PDF_MODEL ?? "gpt-4.1";
  const callResponsesApi = async (fileData: string, instructions: string) =>
    fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_output_tokens: 7000,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_file",
                filename: file.name || "menu.pdf",
                file_data: fileData,
              },
              {
                type: "input_text",
                text: instructions,
              },
            ],
          },
        ],
      }),
      cache: "no-store",
    });

  const parseResponse = async (instructions: string) => {
    let completionResponse = await callResponsesApi(fileBase64, instructions);
    let payload = (await completionResponse.json().catch(() => null)) as
      | {
          output_text?: string;
          output?: Array<{
            content?: Array<{
              type?: string;
              text?: string;
            }>;
          }>;
          error?: { message?: string };
        }
      | null;

    if (
      !completionResponse.ok &&
      (payload?.error?.message?.toLowerCase().includes("file_data") ?? false)
    ) {
      completionResponse = await callResponsesApi(
        `data:application/pdf;base64,${fileBase64}`,
        instructions
      );
      payload = (await completionResponse.json().catch(() => null)) as typeof payload;
    }

    return { completionResponse, payload };
  };

  const parseItemsFromPayload = (
    payload: {
      output_text?: string;
      output?: Array<{
        content?: Array<{
          type?: string;
          text?: string;
        }>;
      }>;
    } | null
  ) => {
    const contentFromOutput =
      payload?.output
        ?.flatMap((item) => item.content ?? [])
        .find((entry) => entry.type === "output_text" && typeof entry.text === "string")
        ?.text ?? "";
    const content = payload?.output_text ?? contentFromOutput;
    const parsed = parseJsonPayload(content);
    const rawItems =
      typeof parsed === "object" &&
      parsed !== null &&
      "items" in parsed &&
      Array.isArray(parsed.items)
        ? parsed.items
        : [];

    return rawItems
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const candidate = entry as {
          name?: string;
          description?: string;
          itemType?: string;
          type?: string;
          category?: string;
          price?: string | number;
          status?: string;
        };
        return normalizeBatchDraft({
          ...candidate,
          itemType: candidate.itemType ?? candidate.type,
        });
      })
      .filter((item): item is BatchMenuItemDraft => item !== null);
  };

  const baseInstructions =
    "Read this restaurant menu PDF carefully, including all columns/sections and stylized dotted price lines. Return strict JSON only in this shape: " +
    "{\"items\":[{\"name\":\"\",\"description\":\"\",\"itemType\":\"food|drink|ingredient\",\"category\":\"\",\"price\":0,\"status\":\"active\"}]}. " +
    "Rules: extract every sellable line item you can find, keep original language text in names, infer itemType from section labels (e.g., Bebidas=drink, Adiciones=ingredient), keep category as section name if present, and set price as numeric value preserving thousands (e.g., $35.000 => 35000). If a price is missing, use 0.";

  const targetedInstructions =
    "Focus on complete recall: list every item with a price and every ingredient/add-on option from all sections. " +
    "Do not skip small text, side columns, or decorative line layouts. Return strict JSON with the same shape only.";

  const primary = await parseResponse(baseInstructions);
  if (!primary.completionResponse.ok) {
    return {
      ok: false,
      error: primary.payload?.error?.message ?? "AI could not parse this PDF.",
    };
  }

  const primaryItems = parseItemsFromPayload(primary.payload);
  let mergedItems = [...primaryItems];

  if (primaryItems.length < 14) {
    const secondary = await parseResponse(targetedInstructions);
    if (secondary.completionResponse.ok) {
      const secondaryItems = parseItemsFromPayload(secondary.payload);
      const seen = new Set(
        primaryItems.map(
          (item) => `${item.itemType}:${item.name.toLowerCase().replace(/\s+/g, " ")}`
        )
      );

      secondaryItems.forEach((item) => {
        const key = `${item.itemType}:${item.name.toLowerCase().replace(/\s+/g, " ")}`;
        if (seen.has(key)) return;
        seen.add(key);
        mergedItems.push(item);
      });
    }
  }

  const deduped = new Map<string, BatchMenuItemDraft>();
  mergedItems.forEach((item) => {
    const key = `${item.itemType}:${item.name.toLowerCase().replace(/\s+/g, " ")}`;
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, item);
      return;
    }

    if (Number(item.price) > Number(existing.price)) {
      deduped.set(key, item);
    }
  });
  mergedItems = [...deduped.values()];

  if (mergedItems.length === 0) {
    return {
      ok: false,
      error: "AI did not return valid menu items. Try another PDF or use CSV.",
    };
  }

  const foods = mergedItems.filter((item) => item.itemType === "food").length;
  const drinks = mergedItems.filter((item) => item.itemType === "drink").length;
  const ingredients = mergedItems.filter((item) => item.itemType === "ingredient").length;

  return {
    ok: true,
    items: mergedItems.slice(0, 300),
    summary: `Parsed ${Math.min(mergedItems.length, 300)} item(s) from PDF with AI (${foods} food, ${drinks} drinks, ${ingredients} ingredients).`,
  };
}

export async function parseBatchMenuItemsAction(
  formData: FormData
): Promise<ParseBatchMenuItemsResult> {
  const sourceType = String(formData.get("sourceType") ?? "").trim().toLowerCase();
  if (sourceType !== "csv" && sourceType !== "pdf") {
    return { ok: false, error: "Choose CSV or PDF source first." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Select a file first." };
  }

  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: "File size must be 10MB or less." };
  }

  const scopeResult = await getMenuScope();
  if (!scopeResult.ok) {
    return { ok: false, error: scopeResult.error };
  }

  if (sourceType === "csv") {
    return parseCsvMenuItems(file);
  }

  return parsePdfMenuItems(file);
}

export async function createMenuItemsBatchAction(
  input: CreateMenuItemsBatchInput
): Promise<MenuActionResult> {
  if (input.items.length === 0) {
    return { ok: false, error: "Add at least one row before saving." };
  }

  const scopeResult = await getMenuScope();
  if (!scopeResult.ok) {
    return { ok: false, error: scopeResult.error };
  }

  const { supabase, scope } = scopeResult;
  const validItems: Array<{
    organization_id: string;
    name: string;
    description: string | null;
    category: string;
    price: number;
    status: "draft" | "active";
  }> = [];
  const seenNames = new Set<string>();
  let invalidRows = 0;
  let duplicateRows = 0;

  for (const row of input.items.slice(0, 300)) {
    const normalized = normalizeBatchDraft(row);
    if (!normalized) {
      invalidRows += 1;
      continue;
    }

    const dedupeKey = normalized.name.toLowerCase();
    if (seenNames.has(dedupeKey)) {
      duplicateRows += 1;
      continue;
    }
    seenNames.add(dedupeKey);

    const price = toNumber(normalized.price);
    if (price === null || price < 0) {
      invalidRows += 1;
      continue;
    }

    validItems.push({
      organization_id: scope.organizationId,
      name: normalized.name,
      description: normalized.description.length > 0 ? normalized.description : null,
      category: normalized.category,
      price,
      status: normalized.status,
    });
  }

  if (validItems.length === 0) {
    return { ok: false, error: "No valid rows to create. Check name and price values." };
  }

  const { data: createdRows, error: insertError } = await supabase
    .from("menu_items")
    .upsert(validItems, {
      onConflict: "organization_id,name",
      ignoreDuplicates: true,
    })
    .select("id,name");

  if (insertError) {
    return { ok: false, error: "Could not create batch menu items." };
  }

  const createdIds = (createdRows ?? []).map((row) => row.id);
  const createdMenuItems = (createdRows ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
  }));
  const skippedExisting = validItems.length - createdIds.length;
  const totalSkipped = invalidRows + duplicateRows + skippedExisting;

  if (createdIds.length > 0 && (input.addToAllMenus || input.selectedMenuIds.length > 0)) {
    const eligibleResult = await resolveEligibleServiceMenuIds(
      scope,
      supabase,
      input.addToAllMenus,
      input.selectedMenuIds
    );
    if (!eligibleResult.ok) {
      return { ok: false, error: "Items created, but menu assignment failed." };
    }

    if (eligibleResult.menuIds.length > 0) {
      const assignmentPayload = eligibleResult.menuIds.flatMap((menuId) =>
        createdIds.map((menuItemId) => ({
          organization_id: scope.organizationId,
          service_menu_id: menuId,
          menu_item_id: menuItemId,
        }))
      );

      const { error: assignError } = await supabase
        .from("service_menu_items")
        .upsert(assignmentPayload, {
          onConflict: "service_menu_id,menu_item_id",
        });

      if (assignError) {
        return { ok: false, error: "Items created, but menu assignment failed." };
      }
    }
  }

  revalidatePath("/menu/items");
  revalidatePath("/menu");
  revalidatePath("/menu/menus");

  if (createdIds.length === 0) {
    return {
      ok: false,
      error: "No new items were created. They may already exist.",
    };
  }

  return {
    ok: true,
    message:
      totalSkipped > 0
        ? `${createdIds.length} item(s) created. ${totalSkipped} row(s) skipped.`
        : `${createdIds.length} item(s) created.`,
    createdMenuItems,
  };
}

export async function createMenuItemAction(
  input: CreateMenuItemInput
): Promise<MenuActionResult> {
  const name = input.name.trim();
  if (name.length < 2) {
    return { ok: false, error: "Item name is too short." };
  }
  const description = input.description.trim();

  const category = input.category.trim() || "General";
  const price = toNumber(input.price);
  if (price === null || price < 0) {
    return { ok: false, error: "Price must be zero or greater." };
  }

  const scopeResult = await getMenuScope();
  if (!scopeResult.ok) {
    return { ok: false, error: scopeResult.error };
  }

  const { supabase, scope } = scopeResult;

  const { data: createdMenuItem, error } = await supabase
    .from("menu_items")
    .insert({
      organization_id: scope.organizationId,
      name,
      description: description.length > 0 ? description : null,
      category,
      price,
      status: input.status,
    })
    .select("id")
    .maybeSingle();

  if (error || !createdMenuItem) {
    if (error?.message?.toLowerCase().includes("unique")) {
      return { ok: false, error: "This menu item already exists." };
    }
    return { ok: false, error: "Could not create menu item." };
  }

  const attachToMenus =
    input.addToAllMenus || input.selectedMenuIds.length > 0;

  if (attachToMenus) {
    let eligibleMenuIds = input.selectedMenuIds;

    if (input.addToAllMenus) {
      const { data: allMenus, error: menusError } = await supabase
        .from("service_menus")
        .select("id")
        .eq("organization_id", scope.organizationId)
        .or(`restaurant_id.eq.${scope.restaurantId},restaurant_id.is.null`);

      if (menusError) {
        return { ok: false, error: "Item created, but menu assignment failed." };
      }

      eligibleMenuIds = (allMenus ?? []).map((menu) => menu.id);
    } else {
      const { data: selectedMenus, error: selectedMenusError } = await supabase
        .from("service_menus")
        .select("id")
        .eq("organization_id", scope.organizationId)
        .in("id", input.selectedMenuIds)
        .or(`restaurant_id.eq.${scope.restaurantId},restaurant_id.is.null`);

      if (selectedMenusError) {
        return { ok: false, error: "Item created, but menu assignment failed." };
      }

      eligibleMenuIds = (selectedMenus ?? []).map((menu) => menu.id);
    }

    if (eligibleMenuIds.length > 0) {
      const payload = eligibleMenuIds.map((menuId) => ({
        organization_id: scope.organizationId,
        service_menu_id: menuId,
        menu_item_id: createdMenuItem.id,
      }));

      const { error: attachError } = await supabase
        .from("service_menu_items")
        .upsert(payload, {
          onConflict: "service_menu_id,menu_item_id",
        });

      if (attachError) {
        return { ok: false, error: "Item created, but menu assignment failed." };
      }
    }
  }

  revalidatePath("/menu/items");
  revalidatePath("/menu");
  revalidatePath("/menu/menus");

  return {
    ok: true,
    message: "Dish created successfully.",
    createdMenuItemId: createdMenuItem.id,
  };
}

export async function addRecipeIngredientAction(
  input: AddRecipeIngredientInput
): Promise<MenuActionResult> {
  if (!input.menuItemId) {
    return { ok: false, error: "Choose a menu item." };
  }
  if (!input.ingredientId) {
    return { ok: false, error: "Choose an ingredient." };
  }

  const quantity = toNumber(input.quantity);
  if (quantity === null || quantity <= 0) {
    return { ok: false, error: "Quantity must be greater than zero." };
  }

  const scopeResult = await getMenuScope();
  if (!scopeResult.ok) {
    return { ok: false, error: scopeResult.error };
  }

  const { supabase, scope } = scopeResult;

  const { data: menuItem, error: menuItemError } = await supabase
    .from("menu_items")
    .select("id")
    .eq("id", input.menuItemId)
    .eq("organization_id", scope.organizationId)
    .maybeSingle();

  if (menuItemError || !menuItem) {
    return { ok: false, error: "Selected menu item is not available." };
  }

  const { data: ingredient, error: ingredientError } = await supabase
    .from("ingredients")
    .select("id")
    .eq("id", input.ingredientId)
    .eq("organization_id", scope.organizationId)
    .maybeSingle();

  if (ingredientError || !ingredient) {
    return { ok: false, error: "Selected ingredient is not available." };
  }

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("id")
    .eq("menu_item_id", input.menuItemId)
    .eq("organization_id", scope.organizationId)
    .maybeSingle();

  if (recipeError) {
    return { ok: false, error: "Could not load recipe." };
  }

  let recipeId = recipe?.id ?? null;

  if (!recipeId) {
    const { data: createdRecipe, error: createRecipeError } = await supabase
      .from("recipes")
      .insert({
        organization_id: scope.organizationId,
        menu_item_id: input.menuItemId,
        yield_quantity: 1,
      })
      .select("id")
      .maybeSingle();

    if (createRecipeError || !createdRecipe) {
      return { ok: false, error: "Could not initialize recipe." };
    }

    recipeId = createdRecipe.id;
  }

  const { error: recipeIngredientError } = await supabase
    .from("recipe_ingredients")
    .upsert(
      {
        organization_id: scope.organizationId,
        recipe_id: recipeId,
        ingredient_id: input.ingredientId,
        quantity,
      },
      {
        onConflict: "recipe_id,ingredient_id",
      }
    );

  if (recipeIngredientError) {
    return { ok: false, error: "Could not save recipe ingredient." };
  }

  revalidatePath("/menu/items");
  return { ok: true, message: "Recipe updated." };
}

export async function uploadMenuItemImageAction(
  formData: FormData
): Promise<MenuActionResult> {
  const fileField = formData.get("image");
  if (!(fileField instanceof File)) {
    return { ok: false, error: "Please choose an image file." };
  }

  formData.delete("image");
  formData.append("images", fileField);
  formData.append("replaceExisting", "true");

  return uploadMenuItemImagesAction(formData);
}

export async function uploadMenuItemImagesAction(
  formData: FormData
): Promise<MenuActionResult> {
  const menuItemId = String(formData.get("menuItemId") ?? "").trim();
  const replaceExisting = String(formData.get("replaceExisting") ?? "false") === "true";
  const files = formData
    .getAll("images")
    .filter((file): file is File => file instanceof File && file.size > 0);

  if (!menuItemId) {
    return { ok: false, error: "Missing dish reference." };
  }

  if (files.length === 0) {
    return { ok: false, error: "Please choose at least one image." };
  }

  const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
  for (const file of files) {
    const normalizedType = normalizeImageMimeType(file.type);
    if (!allowedTypes.has(normalizedType)) {
      return {
        ok: false,
        error: "Use PNG, JPG, or WEBP image formats.",
      };
    }
    if (file.size > 5 * 1024 * 1024) {
      return {
        ok: false,
        error: "Each image must be up to 5MB.",
      };
    }
  }

  const scopeResult = await getMenuScope();
  if (!scopeResult.ok) {
    return { ok: false, error: scopeResult.error };
  }

  const { supabase, scope } = scopeResult;

  const { data: menuItem, error: menuItemError } = await supabase
    .from("menu_items")
    .select("id, image_path")
    .eq("id", menuItemId)
    .eq("organization_id", scope.organizationId)
    .maybeSingle();

  if (menuItemError || !menuItem) {
    return { ok: false, error: "Dish not found." };
  }

  if (replaceExisting) {
    const { data: existingPhotos } = await supabase
      .from("menu_item_photos")
      .select("path")
      .eq("organization_id", scope.organizationId)
      .eq("menu_item_id", menuItemId);

    const existingPaths = (existingPhotos ?? []).map((photo) => photo.path);

    if (existingPaths.length > 0) {
      await supabase.storage.from("menu-item-images").remove(existingPaths);
      await supabase
        .from("menu_item_photos")
        .delete()
        .eq("organization_id", scope.organizationId)
        .eq("menu_item_id", menuItemId);
    }
  }

  const { data: latestPhoto } = await supabase
    .from("menu_item_photos")
    .select("sort_order")
    .eq("organization_id", scope.organizationId)
    .eq("menu_item_id", menuItemId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextSortOrder = (latestPhoto?.sort_order ?? -1) + 1;
  const photosToInsert: Array<{
    organization_id: string;
    menu_item_id: string;
    path: string;
    sort_order: number;
    is_cover: boolean;
  }> = [];

  let firstUploadedPath: string | null = null;

  for (const file of files) {
    const extension = getFileExtension(file.name);
    const objectPath = `${scope.organizationId}/${menuItemId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("menu-item-images")
      .upload(objectPath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: normalizeImageMimeType(file.type),
      });

    if (uploadError) {
      return { ok: false, error: "Could not upload one or more images." };
    }

    if (!firstUploadedPath) {
      firstUploadedPath = objectPath;
    }

    photosToInsert.push({
      organization_id: scope.organizationId,
      menu_item_id: menuItemId,
      path: objectPath,
      sort_order: nextSortOrder,
      is_cover: replaceExisting && nextSortOrder === 0,
    });
    nextSortOrder += 1;
  }

  const { data: existingCover } = await supabase
    .from("menu_item_photos")
    .select("id")
    .eq("organization_id", scope.organizationId)
    .eq("menu_item_id", menuItemId)
    .eq("is_cover", true)
    .limit(1)
    .maybeSingle();

  if (!existingCover && photosToInsert.length > 0) {
    photosToInsert[0].is_cover = true;
  }

  const { error: insertError } = await supabase
    .from("menu_item_photos")
    .insert(photosToInsert);

  if (insertError) {
    return { ok: false, error: "Could not save image references." };
  }

  const { data: coverPhoto } = await supabase
    .from("menu_item_photos")
    .select("path")
    .eq("organization_id", scope.organizationId)
    .eq("menu_item_id", menuItemId)
    .eq("is_cover", true)
    .limit(1)
    .maybeSingle();

  const fallbackCoverPath = coverPhoto?.path ?? firstUploadedPath ?? menuItem.image_path;
  if (fallbackCoverPath) {
    await supabase
      .from("menu_items")
      .update({ image_path: fallbackCoverPath })
      .eq("id", menuItemId)
      .eq("organization_id", scope.organizationId);
  }

  revalidatePath("/menu/items");
  revalidatePath("/menu");

  return { ok: true, message: `${files.length} image(s) uploaded.` };
}

export async function updateMenuItemAction(
  input: UpdateMenuItemInput
): Promise<MenuActionResult> {
  if (!input.menuItemId) {
    return { ok: false, error: "Missing dish reference." };
  }

  const name = input.name.trim();
  if (name.length < 2) {
    return { ok: false, error: "Item name is too short." };
  }
  const description = input.description.trim();

  const category = input.category.trim() || "General";
  const price = toNumber(input.price);
  if (price === null || price < 0) {
    return { ok: false, error: "Price must be zero or greater." };
  }

  const scopeResult = await getMenuScope();
  if (!scopeResult.ok) {
    return { ok: false, error: scopeResult.error };
  }

  const { supabase, scope } = scopeResult;

  const { data: existingItem, error: existingItemError } = await supabase
    .from("menu_items")
    .select("id")
    .eq("id", input.menuItemId)
    .eq("organization_id", scope.organizationId)
    .maybeSingle();

  if (existingItemError || !existingItem) {
    return { ok: false, error: "Dish not found." };
  }

  const { error: updateError } = await supabase
    .from("menu_items")
    .update({
      name,
      description: description.length > 0 ? description : null,
      category,
      price,
      status: input.status,
    })
    .eq("id", input.menuItemId)
    .eq("organization_id", scope.organizationId);

  if (updateError) {
    if (updateError.message.toLowerCase().includes("unique")) {
      return { ok: false, error: "A dish with this name already exists." };
    }
    return { ok: false, error: "Could not save dish changes." };
  }

  revalidatePath("/menu/items");
  revalidatePath("/menu");

  return { ok: true, message: "Dish updated." };
}

export async function generateMenuItemImageAction(
  input: GenerateMenuItemImageInput
): Promise<GenerateMenuItemImageResult> {
  const name = input.name.trim();
  const description = (input.description ?? "").trim();

  if (name.length < 2) {
    return { ok: false, error: "Add an item name before generating an image." };
  }

  const scopeResult = await getMenuScope();
  if (!scopeResult.ok) {
    return { ok: false, error: scopeResult.error };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "Missing OPENAI_API_KEY in .env.local.",
    };
  }

  const prompt = [
    "Create a photorealistic restaurant menu photo.",
    `Dish name: ${name}.`,
    description.length > 0 ? `Description: ${description}.` : null,
    "Style: natural lighting, appetizing plating, realistic textures.",
    "No text, logos, labels, watermarks, hands, or people.",
  ]
    .filter(Boolean)
    .join("\n");

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1",
        prompt,
        size: "1024x1024",
        quality: "low",
        output_format: "webp",
      }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Could not connect to the image service." };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "object" &&
      payload.error !== null &&
      "message" in payload.error &&
      typeof payload.error.message === "string"
        ? payload.error.message
        : "Image generation failed.";
    return { ok: false, error: message };
  }

  const data =
    typeof payload === "object" &&
    payload !== null &&
    "data" in payload &&
    Array.isArray(payload.data)
      ? payload.data
      : [];

  const first = data[0];
  if (!first || typeof first !== "object") {
    return { ok: false, error: "Image generation returned an empty result." };
  }

  const b64 =
    "b64_json" in first && typeof first.b64_json === "string"
      ? first.b64_json
      : null;
  const mimeType =
    "mime_type" in first && typeof first.mime_type === "string"
      ? first.mime_type
      : "image/png";

  if (b64) {
    return { ok: true, imageBase64: b64, mimeType };
  }

  if ("url" in first && typeof first.url === "string" && first.url.length > 0) {
    try {
      const imageResponse = await fetch(first.url, { cache: "no-store" });
      if (!imageResponse.ok) {
        return {
          ok: false,
          error: "Image generated, but downloading it failed.",
        };
      }
      const arrayBuffer = await imageResponse.arrayBuffer();
      const imageBase64 = Buffer.from(arrayBuffer).toString("base64");
      const downloadedMimeType =
        imageResponse.headers.get("content-type") ?? mimeType;
      return {
        ok: true,
        imageBase64,
        mimeType: downloadedMimeType,
      };
    } catch {
      return {
        ok: false,
        error: "Image generated, but downloading it failed.",
      };
    }
  }

  return { ok: false, error: "Image generation did not return image data." };
}

export async function syncMenuItemPhotosAction(
  input: SyncMenuItemPhotosInput
): Promise<MenuActionResult> {
  if (!input.menuItemId) {
    return { ok: false, error: "Missing dish reference." };
  }

  const scopeResult = await getMenuScope();
  if (!scopeResult.ok) {
    return { ok: false, error: scopeResult.error };
  }

  const { supabase, scope } = scopeResult;
  const menuItemId = input.menuItemId;

  const { data: existingItem, error: itemError } = await supabase
    .from("menu_items")
    .select("id")
    .eq("id", menuItemId)
    .eq("organization_id", scope.organizationId)
    .maybeSingle();

  if (itemError || !existingItem) {
    return { ok: false, error: "Dish not found." };
  }

  const { data: existingPhotos, error: existingPhotosError } = await supabase
    .from("menu_item_photos")
    .select("path")
    .eq("organization_id", scope.organizationId)
    .eq("menu_item_id", menuItemId);

  if (existingPhotosError) {
    return { ok: false, error: "Could not load existing photos." };
  }

  const existingPaths = (existingPhotos ?? []).map((photo) => photo.path);
  const existingPathSet = new Set(existingPaths);
  const orderedPhotoPaths: string[] = [];
  input.orderedPhotoPaths.forEach((path) => {
    if (!existingPathSet.has(path)) return;
    if (orderedPhotoPaths.includes(path)) return;
    orderedPhotoPaths.push(path);
  });

  const keepPathSet = new Set(orderedPhotoPaths);
  const pathsToDelete = existingPaths.filter((path) => !keepPathSet.has(path));

  if (pathsToDelete.length > 0) {
    const { error: deleteRefsError } = await supabase
      .from("menu_item_photos")
      .delete()
      .eq("organization_id", scope.organizationId)
      .eq("menu_item_id", menuItemId)
      .in("path", pathsToDelete);

    if (deleteRefsError) {
      return { ok: false, error: "Could not delete removed photo references." };
    }

    await supabase.storage.from("menu-item-images").remove(pathsToDelete);
  }

  if (orderedPhotoPaths.length > 0) {
    const { error: resetCoverError } = await supabase
      .from("menu_item_photos")
      .update({ is_cover: false })
      .eq("organization_id", scope.organizationId)
      .eq("menu_item_id", menuItemId);

    if (resetCoverError) {
      return { ok: false, error: "Could not update photo ordering." };
    }

    for (let index = 0; index < orderedPhotoPaths.length; index += 1) {
      const path = orderedPhotoPaths[index];
      const { error: updatePhotoError } = await supabase
        .from("menu_item_photos")
        .update({
          sort_order: index,
          is_cover: index === 0,
        })
        .eq("organization_id", scope.organizationId)
        .eq("menu_item_id", menuItemId)
        .eq("path", path);

      if (updatePhotoError) {
        return { ok: false, error: "Could not update photo ordering." };
      }
    }

    const { error: updateItemCoverError } = await supabase
      .from("menu_items")
      .update({ image_path: orderedPhotoPaths[0] })
      .eq("id", menuItemId)
      .eq("organization_id", scope.organizationId);

    if (updateItemCoverError) {
      return { ok: false, error: "Could not set cover image." };
    }
  } else {
    const { error: clearCoverError } = await supabase
      .from("menu_items")
      .update({ image_path: null })
      .eq("id", menuItemId)
      .eq("organization_id", scope.organizationId);

    if (clearCoverError) {
      return { ok: false, error: "Could not clear cover image." };
    }
  }

  revalidatePath("/menu/items");
  revalidatePath("/menu");

  return { ok: true, message: "Photo gallery updated." };
}

export async function deleteMenuItemAction(
  input: DeleteMenuItemInput
): Promise<MenuActionResult> {
  if (!input.menuItemId) {
    return { ok: false, error: "Missing dish reference." };
  }

  const scopeResult = await getMenuScope();
  if (!scopeResult.ok) {
    return { ok: false, error: scopeResult.error };
  }

  const { supabase, scope } = scopeResult;

  const { data: existingPhotos } = await supabase
    .from("menu_item_photos")
    .select("path")
    .eq("organization_id", scope.organizationId)
    .eq("menu_item_id", input.menuItemId);

  const { error: deleteError } = await supabase
    .from("menu_items")
    .delete()
    .eq("id", input.menuItemId)
    .eq("organization_id", scope.organizationId);

  if (deleteError) {
    return { ok: false, error: "Could not delete dish." };
  }

  const paths = (existingPhotos ?? []).map((photo) => photo.path);
  if (paths.length > 0) {
    await supabase.storage.from("menu-item-images").remove(paths);
  }

  revalidatePath("/menu/items");
  revalidatePath("/menu");
  revalidatePath("/menu/menus");

  return { ok: true, message: "Dish deleted." };
}

export async function bulkUpdateMenuItemsAction(
  input: BulkUpdateMenuItemsInput
): Promise<MenuActionResult> {
  const menuItemIds = [...new Set(input.menuItemIds.filter(Boolean))];
  if (menuItemIds.length === 0) {
    return { ok: false, error: "Choose at least one dish." };
  }

  const category = (input.category ?? "").trim();
  const hasCategory = category.length > 0;

  const rawPrice = (input.price ?? "").trim();
  const hasPrice = rawPrice.length > 0;
  const price = hasPrice ? toNumber(rawPrice) : null;

  if (!hasCategory && !hasPrice) {
    return { ok: false, error: "Provide a category or a price to update." };
  }
  if (hasPrice && (price === null || price < 0)) {
    return { ok: false, error: "Price must be zero or greater." };
  }

  const scopeResult = await getMenuScope();
  if (!scopeResult.ok) {
    return { ok: false, error: scopeResult.error };
  }

  const { supabase, scope } = scopeResult;
  const { data: existingItems, error: existingItemsError } = await supabase
    .from("menu_items")
    .select("id")
    .eq("organization_id", scope.organizationId)
    .in("id", menuItemIds);

  if (existingItemsError) {
    return { ok: false, error: "Could not load selected dishes." };
  }

  const validIds = (existingItems ?? []).map((item) => item.id);
  if (validIds.length === 0) {
    return { ok: false, error: "Selected dishes are not available." };
  }

  const updatePayload: {
    category?: string;
    price?: number;
  } = {};
  if (hasCategory) {
    updatePayload.category = category;
  }
  if (hasPrice && price !== null) {
    updatePayload.price = price;
  }

  const { error: updateError } = await supabase
    .from("menu_items")
    .update(updatePayload)
    .eq("organization_id", scope.organizationId)
    .in("id", validIds);

  if (updateError) {
    return { ok: false, error: "Could not update selected dishes." };
  }

  revalidatePath("/menu/items");
  revalidatePath("/menu");

  return {
    ok: true,
    message: `${validIds.length} dish(es) updated.`,
  };
}

export async function bulkDeleteMenuItemsAction(
  input: BulkDeleteMenuItemsInput
): Promise<MenuActionResult> {
  const menuItemIds = [...new Set(input.menuItemIds.filter(Boolean))];
  if (menuItemIds.length === 0) {
    return { ok: false, error: "Choose at least one dish." };
  }

  const scopeResult = await getMenuScope();
  if (!scopeResult.ok) {
    return { ok: false, error: scopeResult.error };
  }

  const { supabase, scope } = scopeResult;
  const { data: existingItems, error: existingItemsError } = await supabase
    .from("menu_items")
    .select("id")
    .eq("organization_id", scope.organizationId)
    .in("id", menuItemIds);

  if (existingItemsError) {
    return { ok: false, error: "Could not load selected dishes." };
  }

  const validIds = (existingItems ?? []).map((item) => item.id);
  if (validIds.length === 0) {
    return { ok: false, error: "Selected dishes are not available." };
  }

  const { data: existingPhotos } = await supabase
    .from("menu_item_photos")
    .select("path")
    .eq("organization_id", scope.organizationId)
    .in("menu_item_id", validIds);

  const { error: deleteError } = await supabase
    .from("menu_items")
    .delete()
    .eq("organization_id", scope.organizationId)
    .in("id", validIds);

  if (deleteError) {
    return { ok: false, error: "Could not delete selected dishes." };
  }

  const paths = (existingPhotos ?? []).map((photo) => photo.path);
  if (paths.length > 0) {
    await supabase.storage.from("menu-item-images").remove(paths);
  }

  revalidatePath("/menu/items");
  revalidatePath("/menu");
  revalidatePath("/menu/menus");

  return {
    ok: true,
    message: `${validIds.length} dish(es) deleted.`,
  };
}
