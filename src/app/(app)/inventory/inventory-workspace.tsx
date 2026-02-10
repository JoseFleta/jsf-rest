"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BoxesIcon,
  PackagePlusIcon,
  TriangleAlertIcon,
  WandSparklesIcon,
} from "lucide-react";

import {
  createInventoryItemAction,
  createStockMovementAction,
} from "@/app/(app)/inventory/actions";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { DrawerForm } from "@/components/shared/drawer-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type InventoryStatus = "healthy" | "watch" | "low";

export type InventoryRow = {
  id: string;
  ingredientId: string;
  item: string;
  sku: string;
  currencyCode: string;
  quantity: number;
  reorderLevel: number;
  parLevel: number;
  unitSymbol: string;
  status: InventoryStatus;
  unitCost: number;
  stockValue: number;
  lastMovementAt: string;
};

export type UnitOption = {
  id: string;
  name: string;
  symbol: string;
};

export type MovementFeedRow = {
  id: string;
  item: string;
  movementType: "receive" | "consume" | "adjustment";
  quantityDelta: number;
  createdAt: string;
  note: string;
};

type InventoryWorkspaceProps = {
  restaurantName: string;
  currencyCode: string;
  items: InventoryRow[];
  units: UnitOption[];
  movementFeed: MovementFeedRow[];
};

type AddFormState = {
  name: string;
  sku: string;
  unitId: string;
  openingQuantity: string;
  reorderLevel: string;
  parLevel: string;
  costPerUnit: string;
};

type MovementFormState = {
  inventoryItemId: string;
  movementType: "receive" | "consume" | "adjustment";
  quantity: string;
  unitCost: string;
  note: string;
};

function money(value: number, currencyCode: string) {
  const normalizedCurrency = /^[A-Z]{3}$/.test(currencyCode.toUpperCase())
    ? currencyCode.toUpperCase()
    : "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(value);
  }
}

function statusStyles(status: InventoryStatus) {
  if (status === "low") {
    return "border-red-500/30 bg-red-500/10 text-red-700";
  }
  if (status === "watch") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700";
  }
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
}

function statusLabel(status: InventoryStatus) {
  if (status === "low") return "Low";
  if (status === "watch") return "Watch";
  return "Healthy";
}

const tableColumns: DataTableColumn<InventoryRow>[] = [
  { key: "item", header: "Item", sortable: true },
  {
    key: "sku",
    header: "SKU",
    sortable: true,
    render: (value) => (String(value) === "-" ? "—" : String(value)),
  },
  {
    key: "quantity",
    header: "On Hand",
    sortable: true,
    render: (value, row) => `${Number(value).toFixed(3)} ${row.unitSymbol}`,
  },
  { key: "reorderLevel", header: "Reorder", sortable: true },
  { key: "parLevel", header: "Par", sortable: true },
  {
    key: "unitCost",
    header: "Unit Cost",
    sortable: true,
    render: (value, row) => money(Number(value), row.currencyCode),
  },
  {
    key: "stockValue",
    header: "Stock Value",
    sortable: true,
    render: (value, row) => money(Number(value), row.currencyCode),
  },
  {
    key: "status",
    header: "Status",
    sortable: true,
    render: (value) => (
      <span
        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyles(
          String(value) as InventoryStatus
        )}`}
      >
        {statusLabel(String(value) as InventoryStatus)}
      </span>
    ),
  },
  { key: "lastMovementAt", header: "Last Update", sortable: true },
];

export function InventoryWorkspace({
  restaurantName,
  currencyCode,
  items,
  units,
  movementFeed,
}: InventoryWorkspaceProps) {
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

  const [addForm, setAddForm] = useState<AddFormState>({
    name: "",
    sku: "",
    unitId: units[0]?.id ?? "",
    openingQuantity: "0",
    reorderLevel: "0",
    parLevel: "0",
    costPerUnit: "0",
  });

  const [movementForm, setMovementForm] = useState<MovementFormState>({
    inventoryItemId: items[0]?.id ?? "",
    movementType: "receive",
    quantity: "",
    unitCost: "",
    note: "",
  });

  const summary = useMemo(() => {
    const totalItems = items.length;
    const lowStock = items.filter((item) => item.status === "low").length;
    const watchItems = items.filter((item) => item.status === "watch").length;
    const totalValue = items.reduce((acc, item) => acc + item.stockValue, 0);
    return { totalItems, lowStock, watchItems, totalValue };
  }, [items]);

  const tableData = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        quantity: Number(item.quantity.toFixed(3)),
        reorderLevel: Number(item.reorderLevel.toFixed(3)),
        parLevel: Number(item.parLevel.toFixed(3)),
        unitCost: Number(item.unitCost.toFixed(2)),
        stockValue: Number(item.stockValue.toFixed(2)),
      })),
    [items]
  );
  const selectedUnitId = addForm.unitId || units[0]?.id || "";
  const selectedInventoryItemId = movementForm.inventoryItemId || items[0]?.id || "";

  const resetMessages = () => {
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const submitAddItem = () => {
    resetMessages();
    startTransition(async () => {
      const result = await createInventoryItemAction({
        ...addForm,
        unitId: selectedUnitId,
      });
      if (!result.ok) {
        setErrorMessage(result.error ?? "Could not add item.");
        return;
      }

      setStatusMessage(result.message ?? "Item added.");
      setAddOpen(false);
      setAddForm({
        name: "",
        sku: "",
        unitId: units[0]?.id ?? "",
        openingQuantity: "0",
        reorderLevel: "0",
        parLevel: "0",
        costPerUnit: "0",
      });
    });
  };

  const submitMovement = () => {
    resetMessages();
    startTransition(async () => {
      const result = await createStockMovementAction({
        ...movementForm,
        inventoryItemId: selectedInventoryItemId,
      });
      if (!result.ok) {
        setErrorMessage(result.error ?? "Could not record movement.");
        return;
      }

      setStatusMessage(result.message ?? "Movement recorded.");
      setMoveOpen(false);
      setMovementForm((current) => ({
        ...current,
        quantity: "",
        unitCost: "",
        note: "",
      }));
    });
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.98))] p-6 text-slate-100 shadow-xl shadow-slate-900/20">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
              Active Location
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              {restaurantName}
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Clean control of stock, movement, and restock signals.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              className="border border-white/10 bg-white/10 text-white hover:bg-white/20"
              onClick={() => {
                setAddOpen(true);
                resetMessages();
              }}
            >
              <PackagePlusIcon className="size-4" />
              Add Item
            </Button>
            <Button
              variant="secondary"
              className="border border-white/10 bg-white/10 text-white hover:bg-white/20"
              onClick={() => {
                setMoveOpen(true);
                resetMessages();
              }}
              disabled={items.length === 0}
            >
              <WandSparklesIcon className="size-4" />
              Record Movement
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Tracked Items
          </p>
          <p className="mt-2 text-3xl font-semibold">{summary.totalItems}</p>
        </article>

        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Stock Value
          </p>
          <p className="mt-2 text-3xl font-semibold">{money(summary.totalValue, currencyCode)}</p>
        </article>

        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Low Stock
          </p>
          <p className="mt-2 flex items-center gap-2 text-3xl font-semibold text-red-600">
            <TriangleAlertIcon className="size-6" />
            {summary.lowStock}
          </p>
        </article>

        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Watch List
          </p>
          <p className="mt-2 flex items-center gap-2 text-3xl font-semibold text-amber-600">
            <BoxesIcon className="size-6" />
            {summary.watchItems}
          </p>
        </article>
      </section>

      {statusMessage ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          {statusMessage}
        </div>
      ) : null}
      {errorMessage ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <DataTable
        data={tableData}
        columns={tableColumns}
        getRowId={(row) => row.id}
        defaultSortKey="item"
        defaultPageSize={10}
        emptyMessage="No items yet. Add your first inventory item."
      />

      <section className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Recent Movements
        </h3>
        <div className="mt-3 space-y-2">
          {movementFeed.length > 0 ? (
            movementFeed.map((movement) => {
              const isIn = movement.quantityDelta > 0;
              const absoluteQty = Math.abs(movement.quantityDelta).toFixed(3);
              return (
                <div
                  key={movement.id}
                  className="flex flex-col gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{movement.item}</p>
                    <p className="text-xs text-muted-foreground">{movement.note}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
                        isIn
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                          : "border-slate-400/30 bg-slate-400/10 text-slate-700"
                      }`}
                    >
                      {isIn ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />}
                      {isIn ? "+" : "-"}
                      {absoluteQty}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {movement.createdAt}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">No movements recorded yet.</p>
          )}
        </div>
      </section>

      <DrawerForm
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add Inventory Item"
        description="Create a trackable ingredient for the current restaurant."
        submitLabel={isPending ? "Saving..." : "Save Item"}
        isSubmitting={isPending}
        onSubmit={(event) => {
          event.preventDefault();
          submitAddItem();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="inventory-name">Item Name</Label>
          <Input
            id="inventory-name"
            value={addForm.name}
            onChange={(event) =>
              setAddForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Tomato Sauce"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="inventory-sku">SKU (optional)</Label>
          <Input
            id="inventory-sku"
            value={addForm.sku}
            onChange={(event) =>
              setAddForm((current) => ({ ...current, sku: event.target.value }))
            }
            placeholder="TMS-001"
          />
        </div>

        <div className="space-y-2">
          <Label>Unit</Label>
          <Select
            value={selectedUnitId}
            onValueChange={(value) =>
              setAddForm((current) => ({ ...current, unitId: value }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              {units.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.name} ({unit.symbol})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="opening-qty">Opening Quantity</Label>
            <Input
              id="opening-qty"
              type="number"
              step="0.001"
              value={addForm.openingQuantity}
              onChange={(event) =>
                setAddForm((current) => ({
                  ...current,
                  openingQuantity: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit-cost">Unit Cost</Label>
            <Input
              id="unit-cost"
              type="number"
              step="0.0001"
              value={addForm.costPerUnit}
              onChange={(event) =>
                setAddForm((current) => ({
                  ...current,
                  costPerUnit: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reorder-level">Reorder Level</Label>
            <Input
              id="reorder-level"
              type="number"
              step="0.001"
              value={addForm.reorderLevel}
              onChange={(event) =>
                setAddForm((current) => ({
                  ...current,
                  reorderLevel: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="par-level">Par Level</Label>
            <Input
              id="par-level"
              type="number"
              step="0.001"
              value={addForm.parLevel}
              onChange={(event) =>
                setAddForm((current) => ({
                  ...current,
                  parLevel: event.target.value,
                }))
              }
            />
          </div>
        </div>
      </DrawerForm>

      <DrawerForm
        open={moveOpen}
        onOpenChange={setMoveOpen}
        title="Record Stock Movement"
        description="Receive, consume, or adjust stock without leaving the page."
        submitLabel={isPending ? "Saving..." : "Save Movement"}
        isSubmitting={isPending}
        onSubmit={(event) => {
          event.preventDefault();
          submitMovement();
        }}
      >
        <div className="space-y-2">
          <Label>Item</Label>
          <Select
            value={selectedInventoryItemId}
            onValueChange={(value) =>
              setMovementForm((current) => ({ ...current, inventoryItemId: value }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select item" />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Movement Type</Label>
          <Select
            value={movementForm.movementType}
            onValueChange={(value) =>
              setMovementForm((current) => ({
                ...current,
                movementType: value as MovementFormState["movementType"],
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="receive">Receive</SelectItem>
              <SelectItem value="consume">Consume</SelectItem>
              <SelectItem value="adjustment">Adjustment</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="movement-qty">
            Quantity {movementForm.movementType === "adjustment" ? "(use +/-)" : ""}
          </Label>
          <Input
            id="movement-qty"
            type="number"
            step="0.001"
            value={movementForm.quantity}
            onChange={(event) =>
              setMovementForm((current) => ({
                ...current,
                quantity: event.target.value,
              }))
            }
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="movement-cost">Unit Cost (optional)</Label>
          <Input
            id="movement-cost"
            type="number"
            step="0.0001"
            value={movementForm.unitCost}
            onChange={(event) =>
              setMovementForm((current) => ({
                ...current,
                unitCost: event.target.value,
              }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="movement-note">Note (optional)</Label>
          <Input
            id="movement-note"
            value={movementForm.note}
            onChange={(event) =>
              setMovementForm((current) => ({
                ...current,
                note: event.target.value,
              }))
            }
            placeholder="Delivery from supplier"
          />
        </div>
      </DrawerForm>
    </div>
  );
}
