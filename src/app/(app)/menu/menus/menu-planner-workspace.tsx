"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarRangeIcon, ChefHatIcon, PlusIcon, UtensilsCrossedIcon } from "lucide-react";

import {
  attachDishToMenuAction,
  createServiceMenuAction,
} from "@/app/(app)/menu/menus/actions";
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

export type ServiceMenuRow = {
  id: string;
  name: string;
  status: "draft" | "active" | "archived";
  schedule: string;
  weekendOnly: boolean;
  dishCount: number;
  updatedAt: string;
};

export type ServiceMenuOption = {
  id: string;
  name: string;
};

export type DishOption = {
  id: string;
  name: string;
  category: string;
};

type MenuPlannerWorkspaceProps = {
  restaurantName: string;
  rows: ServiceMenuRow[];
  menuOptions: ServiceMenuOption[];
  dishOptions: DishOption[];
  dishesByMenu: Record<string, DishOption[]>;
};

type CreateMenuForm = {
  name: string;
  description: string;
  status: "draft" | "active";
  startsOn: string;
  endsOn: string;
  weekendOnly: "false" | "true";
};

type AttachDishForm = {
  serviceMenuId: string;
  menuItemId: string;
};

function statusClassName(status: ServiceMenuRow["status"]) {
  if (status === "active") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  if (status === "draft") return "border-amber-500/30 bg-amber-500/10 text-amber-700";
  return "border-slate-500/30 bg-slate-500/10 text-slate-700";
}

const columns: DataTableColumn<ServiceMenuRow>[] = [
  { key: "name", header: "Menu", sortable: true },
  {
    key: "status",
    header: "Status",
    sortable: true,
    render: (value) => (
      <span
        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClassName(
          String(value) as ServiceMenuRow["status"]
        )}`}
      >
        {String(value)}
      </span>
    ),
  },
  { key: "schedule", header: "Schedule", sortable: true },
  {
    key: "weekendOnly",
    header: "Weekend",
    sortable: true,
    render: (value) => (Boolean(value) ? "Yes" : "No"),
  },
  { key: "dishCount", header: "Dishes", sortable: true },
  { key: "updatedAt", header: "Updated", sortable: true },
];

export function MenuPlannerWorkspace({
  restaurantName,
  rows,
  menuOptions,
  dishOptions,
  dishesByMenu,
}: MenuPlannerWorkspaceProps) {
  const [isPending, startTransition] = useTransition();

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);

  const [createForm, setCreateForm] = useState<CreateMenuForm>({
    name: "",
    description: "",
    status: "active",
    startsOn: "",
    endsOn: "",
    weekendOnly: "false",
  });

  const [attachForm, setAttachForm] = useState<AttachDishForm>({
    serviceMenuId: menuOptions[0]?.id ?? "",
    menuItemId: dishOptions[0]?.id ?? "",
  });

  const selectedMenuId = attachForm.serviceMenuId || menuOptions[0]?.id || "";
  const selectedDishId = attachForm.menuItemId || dishOptions[0]?.id || "";

  const summary = useMemo(() => {
    const totalMenus = rows.length;
    const activeMenus = rows.filter((row) => row.status === "active").length;
    const weekendMenus = rows.filter((row) => row.weekendOnly).length;
    const totalAssignments = rows.reduce((sum, row) => sum + row.dishCount, 0);
    return { totalMenus, activeMenus, weekendMenus, totalAssignments };
  }, [rows]);

  const clearFeedback = () => {
    setMessage(null);
    setError(null);
  };

  const submitCreate = () => {
    clearFeedback();
    startTransition(async () => {
      const result = await createServiceMenuAction(createForm);
      if (!result.ok) {
        setError(result.error ?? "Could not create menu.");
        return;
      }
      setMessage(result.message ?? "Menu created.");
      setCreateOpen(false);
      setCreateForm({
        name: "",
        description: "",
        status: "active",
        startsOn: "",
        endsOn: "",
        weekendOnly: "false",
      });
    });
  };

  const submitAttach = () => {
    clearFeedback();
    startTransition(async () => {
      const result = await attachDishToMenuAction({
        serviceMenuId: selectedMenuId,
        menuItemId: selectedDishId,
      });
      if (!result.ok) {
        setError(result.error ?? "Could not attach dish.");
        return;
      }
      setMessage(result.message ?? "Dish attached.");
      setAttachOpen(false);
    });
  };

  const dishesInSelectedMenu = selectedMenuId ? dishesByMenu[selectedMenuId] ?? [] : [];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-[linear-gradient(135deg,rgba(12,10,9,0.98),rgba(41,37,36,0.98))] p-6 text-stone-100 shadow-xl shadow-black/20">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-stone-300">
              Menu Planner
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              {restaurantName}
            </h2>
            <p className="mt-2 text-sm text-stone-300">
              Build dish libraries first, then compose menus by date, weekend, or seasonal changes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              className="border border-white/10 bg-white/10 text-white hover:bg-white/20"
              onClick={() => {
                clearFeedback();
                setCreateOpen(true);
              }}
            >
              <PlusIcon className="size-4" />
              New Menu
            </Button>
            <Button
              variant="secondary"
              className="border border-white/10 bg-white/10 text-white hover:bg-white/20"
              onClick={() => {
                clearFeedback();
                setAttachOpen(true);
              }}
              disabled={menuOptions.length === 0 || dishOptions.length === 0}
            >
              <ChefHatIcon className="size-4" />
              Add Dish to Menu
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Total Menus
          </p>
          <p className="mt-2 text-3xl font-semibold">{summary.totalMenus}</p>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Active Menus
          </p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">
            {summary.activeMenus}
          </p>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Weekend Menus
          </p>
          <p className="mt-2 flex items-center gap-2 text-3xl font-semibold text-amber-700">
            <CalendarRangeIcon className="size-6" />
            {summary.weekendMenus}
          </p>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Assigned Dishes
          </p>
          <p className="mt-2 flex items-center gap-2 text-3xl font-semibold text-stone-700">
            <UtensilsCrossedIcon className="size-6" />
            {summary.totalAssignments}
          </p>
        </article>
      </section>

      {message ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <DataTable
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        defaultSortKey="name"
        defaultPageSize={8}
        emptyMessage="No menus yet. Create your first menu."
      />

      <section className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Selected Menu Dishes
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {dishesInSelectedMenu.length > 0 ? (
            dishesInSelectedMenu.map((dish) => (
              <span
                key={dish.id}
                className="inline-flex rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium"
              >
                {dish.name}
              </span>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No dishes attached to this menu yet.
            </p>
          )}
        </div>
      </section>

      <DrawerForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create Menu"
        description="Use dates or weekend flag to activate special menus when needed."
        submitLabel={isPending ? "Saving..." : "Save Menu"}
        isSubmitting={isPending}
        onSubmit={(event) => {
          event.preventDefault();
          submitCreate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="service-menu-name">Menu Name</Label>
          <Input
            id="service-menu-name"
            value={createForm.name}
            onChange={(event) =>
              setCreateForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Weekend Specials"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="service-menu-description">Description</Label>
          <Input
            id="service-menu-description"
            value={createForm.description}
            onChange={(event) =>
              setCreateForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            placeholder="Optional note for team"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="service-menu-starts">Starts On</Label>
            <Input
              id="service-menu-starts"
              type="date"
              value={createForm.startsOn}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, startsOn: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="service-menu-ends">Ends On</Label>
            <Input
              id="service-menu-ends"
              type="date"
              value={createForm.endsOn}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, endsOn: event.target.value }))
              }
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={createForm.status}
              onValueChange={(value) =>
                setCreateForm((current) => ({
                  ...current,
                  status: value as CreateMenuForm["status"],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Weekend Only</Label>
            <Select
              value={createForm.weekendOnly}
              onValueChange={(value) =>
                setCreateForm((current) => ({
                  ...current,
                  weekendOnly: value as CreateMenuForm["weekendOnly"],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">No</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </DrawerForm>

      <DrawerForm
        open={attachOpen}
        onOpenChange={setAttachOpen}
        title="Attach Dish to Menu"
        description="Compose menus from your dish library."
        submitLabel={isPending ? "Saving..." : "Save"}
        isSubmitting={isPending}
        onSubmit={(event) => {
          event.preventDefault();
          submitAttach();
        }}
      >
        <div className="space-y-2">
          <Label>Menu</Label>
          <Select
            value={selectedMenuId}
            onValueChange={(value) =>
              setAttachForm((current) => ({ ...current, serviceMenuId: value }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose menu" />
            </SelectTrigger>
            <SelectContent>
              {menuOptions.map((menu) => (
                <SelectItem key={menu.id} value={menu.id}>
                  {menu.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Dish</Label>
          <Select
            value={selectedDishId}
            onValueChange={(value) =>
              setAttachForm((current) => ({ ...current, menuItemId: value }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose dish" />
            </SelectTrigger>
            <SelectContent>
              {dishOptions.map((dish) => (
                <SelectItem key={dish.id} value={dish.id}>
                  {dish.name} ({dish.category})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </DrawerForm>
    </div>
  );
}
