import { describe, expect, it } from "vitest";

import {
  buildBatchRowWarnings,
  normalizeBatchDraft,
  normalizePriceInput,
  prepareBatchRowsForPersistence,
} from "./batch-import";

describe("normalizePriceInput", () => {
  it("parses localized and mixed numeric formats", () => {
    expect(normalizePriceInput("$35.000")).toBe(35000);
    expect(normalizePriceInput("4,500")).toBe(4500);
    expect(normalizePriceInput("1.234,56")).toBe(1234.56);
    expect(normalizePriceInput("1,234.56")).toBe(1234.56);
  });

  it("returns null for invalid input", () => {
    expect(normalizePriceInput("")).toBeNull();
    expect(normalizePriceInput("abc")).toBeNull();
  });
});

describe("normalizeBatchDraft", () => {
  it("infers type/category and normalizes status", () => {
    const drinkRow = normalizeBatchDraft({
      name: "Coca-Cola",
      category: "Bebidas",
      price: "4500",
      status: "active",
    });
    expect(drinkRow).toMatchObject({
      itemType: "drink",
      category: "Bebidas",
      price: "4500.00",
      status: "active",
    });

    const ingredientRow = normalizeBatchDraft({
      name: "Pesto",
      itemType: "ingrediente",
      category: "",
      price: "3000",
      status: "borrador",
    });
    expect(ingredientRow).toMatchObject({
      itemType: "ingredient",
      category: "Ingredients",
      price: "3000.00",
      status: "draft",
    });
  });

  it("rejects invalid names and negative prices", () => {
    expect(
      normalizeBatchDraft({
        name: "A",
        price: "10",
      })
    ).toBeNull();

    expect(
      normalizeBatchDraft({
        name: "Valid Name",
        price: "-5",
      })
    ).toBeNull();
  });
});

describe("prepareBatchRowsForPersistence", () => {
  it("routes dishes and ingredients while tracking invalid/duplicate rows", () => {
    const prepared = prepareBatchRowsForPersistence([
      { name: "Burger", itemType: "food", category: "", price: "14.99", status: "active" },
      { name: "Burger", itemType: "food", category: "Food", price: "12", status: "active" },
      { name: "Pesto", itemType: "ingredient", category: "", price: "$3.000", status: "active" },
      { name: "A", itemType: "food", category: "Food", price: "10", status: "active" },
      { name: "Bad Price", itemType: "food", category: "Food", price: "-1", status: "active" },
      { name: "Coca-Cola", itemType: "drink", category: "", price: "4,500", status: "active" },
    ]);

    expect(prepared.menuRows).toEqual([
      {
        name: "Burger",
        description: null,
        category: "Food",
        price: 14.99,
        status: "active",
      },
      {
        name: "Coca-Cola",
        description: null,
        category: "Drinks",
        price: 4500,
        status: "active",
      },
    ]);
    expect(prepared.ingredientRows).toEqual([{ name: "Pesto", costPerUnit: 3000 }]);
    expect(prepared.invalidRows).toBe(2);
    expect(prepared.duplicateRows).toBe(1);
  });
});

describe("buildBatchRowWarnings", () => {
  it("flags duplicate, existing, short-name, and invalid price issues", () => {
    const warnings = buildBatchRowWarnings(
      [
        { name: "Burger", price: "0" },
        { name: "Burger", price: "12" },
        { name: "X", price: "abc" },
      ],
      ["burger", "pizza"]
    );

    expect(warnings[0]).toEqual(
      expect.arrayContaining([
        "Duplicate name in this batch.",
        "Dish name already exists in your library.",
        "Price is zero or missing.",
      ])
    );
    expect(warnings[1]).toEqual(
      expect.arrayContaining([
        "Duplicate name in this batch.",
        "Dish name already exists in your library.",
      ])
    );
    expect(warnings[2]).toEqual(
      expect.arrayContaining(["Name is too short.", "Price is invalid."])
    );
  });
});
