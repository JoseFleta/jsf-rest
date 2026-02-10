export type BatchItemType = "food" | "drink" | "ingredient";

export type BatchMenuItemDraft = {
  name: string;
  description: string;
  itemType: BatchItemType;
  category: string;
  price: string;
  status: "draft" | "active";
};

export type BatchNormalizeInput = {
  name?: string | null;
  description?: string | null;
  itemType?: string | null;
  category?: string | null;
  price?: string | number | null;
  status?: string | null;
};

export type PreparedBatchMenuRow = {
  name: string;
  description: string | null;
  category: string;
  price: number;
  status: "draft" | "active";
};

export type PreparedBatchIngredientRow = {
  name: string;
  costPerUnit: number;
};

export function normalizePriceInput(value: string | number | null | undefined) {
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

export function normalizeDraftStatus(value: string | null | undefined): "draft" | "active" {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "draft" || normalized === "borrador" ? "draft" : "active";
}

export function inferItemTypeFromText(text: string): BatchItemType {
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

export function normalizeItemType(
  value: string | null | undefined,
  category: string,
  name: string
) {
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

export function defaultCategoryForType(itemType: BatchItemType) {
  if (itemType === "drink") return "Drinks";
  if (itemType === "ingredient") return "Ingredients";
  return "Food";
}

export function normalizeBatchDraft(input: BatchNormalizeInput): BatchMenuItemDraft | null {
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

export function prepareBatchRowsForPersistence(
  rows: BatchNormalizeInput[]
): {
  menuRows: PreparedBatchMenuRow[];
  ingredientRows: PreparedBatchIngredientRow[];
  invalidRows: number;
  duplicateRows: number;
} {
  const menuRows: PreparedBatchMenuRow[] = [];
  const ingredientRows: PreparedBatchIngredientRow[] = [];
  const seenRows = new Set<string>();
  let invalidRows = 0;
  let duplicateRows = 0;

  for (const row of rows) {
    const normalized = normalizeBatchDraft(row);
    if (!normalized) {
      invalidRows += 1;
      continue;
    }

    const dedupeKey = `${normalized.itemType}:${normalized.name.toLowerCase()}`;
    if (seenRows.has(dedupeKey)) {
      duplicateRows += 1;
      continue;
    }
    seenRows.add(dedupeKey);

    const price = Number(normalized.price);
    if (!Number.isFinite(price) || price < 0) {
      invalidRows += 1;
      continue;
    }

    if (normalized.itemType === "ingredient") {
      ingredientRows.push({
        name: normalized.name,
        costPerUnit: price,
      });
      continue;
    }

    menuRows.push({
      name: normalized.name,
      description: normalized.description.length > 0 ? normalized.description : null,
      category: normalized.category,
      price,
      status: normalized.status,
    });
  }

  return {
    menuRows,
    ingredientRows,
    invalidRows,
    duplicateRows,
  };
}

export function buildBatchRowWarnings(
  rows: Array<{ name: string; price: string }>,
  existingDishNames: Iterable<string>
) {
  const existingNameSet = new Set(
    [...existingDishNames]
      .map((name) => name.trim().toLowerCase())
      .filter((name) => name.length > 0)
  );

  const duplicateCountByName = new Map<string, number>();
  rows.forEach((row) => {
    const normalizedName = row.name.trim().toLowerCase();
    if (!normalizedName) return;
    duplicateCountByName.set(normalizedName, (duplicateCountByName.get(normalizedName) ?? 0) + 1);
  });

  return rows.map((row) => {
    const warnings: string[] = [];
    const normalizedName = row.name.trim().toLowerCase();
    const parsedPrice = Number(row.price);

    if (row.name.trim().length < 2) {
      warnings.push("Name is too short.");
    }
    if (normalizedName && (duplicateCountByName.get(normalizedName) ?? 0) > 1) {
      warnings.push("Duplicate name in this batch.");
    }
    if (normalizedName && existingNameSet.has(normalizedName)) {
      warnings.push("Dish name already exists in your library.");
    }
    if (!Number.isFinite(parsedPrice)) {
      warnings.push("Price is invalid.");
    } else if (parsedPrice <= 0) {
      warnings.push("Price is zero or missing.");
    } else if (parsedPrice > 1000000) {
      warnings.push("Price looks unusually high.");
    }

    return warnings;
  });
}
