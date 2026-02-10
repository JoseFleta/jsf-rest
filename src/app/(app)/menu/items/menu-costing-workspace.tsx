"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import {
  CheckIcon,
  CircleDollarSignIcon,
  FlameIcon,
  GripVerticalIcon,
  Loader2Icon,
  LayersIcon,
  PlusCircleIcon,
  PlusIcon,
  ReceiptTextIcon,
  SparklesIcon,
  Table2Icon,
  Trash2Icon,
  UploadCloudIcon,
  UtensilsCrossedIcon,
  XIcon,
} from "lucide-react";

import {
  addRecipeIngredientAction,
  bulkDeleteMenuItemsAction,
  bulkUpdateMenuItemsAction,
  createMenuItemsBatchAction,
  createMenuItemAction,
  deleteMenuItemAction,
  generateMenuItemImageAction,
  parseBatchMenuItemsAction,
  syncMenuItemPhotosAction,
  updateMenuItemAction,
  uploadMenuItemImagesAction,
} from "@/app/(app)/menu/items/actions";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
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

export type MenuCostRisk = "healthy" | "watch" | "high" | "incomplete";
export type MenuCostPhoto = {
  path: string;
  imageUrl: string;
  sortOrder: number;
  isCover: boolean;
};

export type MenuCostRow = {
  id: string;
  name: string;
  category: string;
  description: string;
  photos: MenuCostPhoto[];
  status: "draft" | "active" | "archived";
  imageUrl: string | null;
  price: number;
  recipeCost: number;
  foodCostPct: number;
  margin: number;
  ingredientCount: number;
  missingCostCount: number;
  risk: MenuCostRisk;
  updatedAt: string;
};

export type MenuItemOption = { id: string; name: string };
export type ServiceMenuOption = { id: string; name: string };
export type IngredientOption = { id: string; name: string; unitSymbol: string };
export type RecipeDetailRow = {
  ingredientName: string;
  quantity: number;
  unitSymbol: string;
  ingredientCost: number | null;
};

type MenuCostingWorkspaceProps = {
  restaurantName: string;
  currencyCode: string;
  rows: MenuCostRow[];
  menuItems: MenuItemOption[];
  serviceMenus: ServiceMenuOption[];
  ingredients: IngredientOption[];
  recipeDetails: Record<string, RecipeDetailRow[]>;
};

type CreateMenuItemForm = {
  name: string;
  description: string;
  category: string;
  price: string;
  status: "draft" | "active";
};

type EditMenuItemForm = {
  menuItemId: string;
  name: string;
  description: string;
  category: string;
  price: string;
  status: "draft" | "active" | "archived";
};

type AddRecipeIngredientForm = {
  menuItemId: string;
  ingredientId: string;
  quantity: string;
};

type AssignmentForm = {
  applyToAll: boolean;
  selectedMenuIds: string[];
};

type BatchSourceType = "csv" | "pdf";
type BatchItemType = "food" | "drink" | "ingredient";

type BatchMenuItemFormRow = {
  id: string;
  name: string;
  description: string;
  itemType: BatchItemType;
  category: string;
  price: string;
  status: "draft" | "active";
  imageFiles: File[];
};

type MenuCostDisplayRow = MenuCostRow & {
  selected: boolean;
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

function riskLabel(risk: MenuCostRisk) {
  if (risk === "high") return "High";
  if (risk === "watch") return "Watch";
  if (risk === "incomplete") return "Incomplete";
  return "Healthy";
}

function riskStyle(risk: MenuCostRisk) {
  if (risk === "high") return "border-red-500/30 bg-red-500/10 text-red-700";
  if (risk === "watch") return "border-amber-500/30 bg-amber-500/10 text-amber-700";
  if (risk === "incomplete") return "border-slate-500/30 bg-slate-500/10 text-slate-700";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
}

function ImageDropzone({
  files,
  setFiles,
  label,
}: {
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files]
  );

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  const appendFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list).filter((file) => file.type.startsWith("image/"));
    if (incoming.length === 0) return;
    setFiles((current) => [...current, ...incoming]);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
        onChange={(event) => appendFiles(event.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          appendFiles(event.dataTransfer.files);
        }}
        className={`w-full rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
          isDragging
            ? "border-cyan-600 bg-cyan-50"
            : "border-slate-300 bg-slate-50/70 hover:border-cyan-500 hover:bg-cyan-50/60"
        }`}
      >
        <UploadCloudIcon className="mx-auto size-6 text-cyan-700" />
        <p className="mt-2 text-sm font-medium text-slate-800">Drag and drop photos here</p>
        <p className="text-xs text-slate-500">or click to browse. PNG, JPG, WEBP, max 5MB each.</p>
      </button>

      {files.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {previews.map((preview, index) => (
            <div key={`${preview.file.name}-${index}`} className="group relative overflow-hidden rounded-lg border border-slate-200">
              <Image src={preview.url} alt={preview.file.name} width={240} height={150} unoptimized className="aspect-[4/3] w-full object-cover" />
              <button
                type="button"
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                onClick={(event) => {
                  event.stopPropagation();
                  setFiles((current) => current.filter((_, i) => i !== index));
                }}
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function MenuCostingWorkspace({
  restaurantName,
  currencyCode,
  rows,
  menuItems,
  serviceMenus,
  ingredients,
  recipeDetails,
}: MenuCostingWorkspaceProps) {
  const [isPending, startTransition] = useTransition();
  const [isBulkPending, startBulkTransition] = useTransition();
  const [isBatchParsing, startBatchParsingTransition] = useTransition();
  const [isBatchSaving, startBatchSavingTransition] = useTransition();
  const [isGeneratingCreateImage, startCreateImageTransition] = useTransition();
  const [isGeneratingEditImage, startEditImageTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [batchActionsOpen, setBatchActionsOpen] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [bulkCategoryValue, setBulkCategoryValue] = useState("");
  const [bulkPriceValue, setBulkPriceValue] = useState("");

  const [createForm, setCreateForm] = useState<CreateMenuItemForm>({
    name: "",
    description: "",
    category: "Main",
    price: "0",
    status: "active",
  });
  const [editForm, setEditForm] = useState<EditMenuItemForm>({
    menuItemId: "",
    name: "",
    description: "",
    category: "Main",
    price: "0",
    status: "active",
  });
  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm>({
    applyToAll: false,
    selectedMenuIds: [],
  });
  const [recipeForm, setRecipeForm] = useState<AddRecipeIngredientForm>({
    menuItemId: menuItems[0]?.id ?? "",
    ingredientId: ingredients[0]?.id ?? "",
    quantity: "1",
  });
  const [createdMenuItemId, setCreatedMenuItemId] = useState<string | null>(null);
  const [createImageFiles, setCreateImageFiles] = useState<File[]>([]);
  const [batchSourceType, setBatchSourceType] = useState<BatchSourceType>("csv");
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchRows, setBatchRows] = useState<BatchMenuItemFormRow[]>([]);
  const [batchStep, setBatchStep] = useState<"upload" | "review">("upload");
  const [batchSummary, setBatchSummary] = useState<string | null>(null);
  const [editImageFiles, setEditImageFiles] = useState<File[]>([]);
  const [editExistingPhotos, setEditExistingPhotos] = useState<MenuCostPhoto[]>([]);
  const [draggingExistingPhotoPath, setDraggingExistingPhotoPath] = useState<string | null>(null);
  const [dragOverExistingPhotoPath, setDragOverExistingPhotoPath] = useState<string | null>(null);
  const [initialEditPhotoPathsKey, setInitialEditPhotoPathsKey] = useState("");
  const [initialEditForm, setInitialEditForm] = useState<EditMenuItemForm | null>(null);
  const batchFileInputRef = useRef<HTMLInputElement | null>(null);
  const batchCsvTemplateContent = `name,itemType,description,category,price,status
Hamburguesa Clasica,food,Hamburguesa con queso y papas,Food,14.99,active
Coca Cola 350ml,drink,Bebida gaseosa lata,Drinks,4.50,active
Salsa de la casa,ingredient,Salsa extra para acompanamiento,Ingredients,2.00,active`;
  const editPhotoInputRef = useRef<HTMLInputElement | null>(null);

  const selectedMenuItemId = recipeForm.menuItemId || menuItems[0]?.id || "";
  const selectedIngredientId = recipeForm.ingredientId || ingredients[0]?.id || "";
  const selectedRecipeDetails = selectedMenuItemId ? recipeDetails[selectedMenuItemId] ?? [] : [];

  const summary = useMemo(() => {
    const totalItems = rows.length;
    const highRisk = rows.filter((row) => row.risk === "high").length;
    const incomplete = rows.filter((row) => row.risk === "incomplete").length;
    const pricedRows = rows.filter((row) => row.price > 0);
    const avgFoodCostPct = pricedRows.length > 0 ? pricedRows.reduce((sum, row) => sum + row.foodCostPct, 0) / pricedRows.length : 0;
    return { totalItems, highRisk, incomplete, avgFoodCostPct };
  }, [rows]);

  const availableCategories = useMemo(
    () =>
      [...new Set(rows.map((row) => row.category.trim()).filter((category) => category.length > 0))]
        .sort((a, b) => a.localeCompare(b)),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const normalizedName = nameFilter.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesName =
        normalizedName.length === 0 ||
        row.name.toLowerCase().includes(normalizedName) ||
        row.description.toLowerCase().includes(normalizedName);
      const matchesCategory =
        categoryFilter === "all" || row.category.toLowerCase() === categoryFilter.toLowerCase();
      return matchesName && matchesCategory;
    });
  }, [categoryFilter, nameFilter, rows]);

  const selectedRowIdSet = useMemo(() => new Set(selectedRowIds), [selectedRowIds]);
  const displayRows = useMemo<MenuCostDisplayRow[]>(
    () =>
      filteredRows.map((row) => ({
        ...row,
        selected: selectedRowIdSet.has(row.id),
      })),
    [filteredRows, selectedRowIdSet]
  );
  const allFilteredRowsSelected =
    filteredRows.length > 0 && filteredRows.every((row) => selectedRowIdSet.has(row.id));
  const someFilteredRowsSelected =
    filteredRows.some((row) => selectedRowIdSet.has(row.id)) && !allFilteredRowsSelected;

  const assignmentSummary = useMemo(() => {
    if (serviceMenus.length === 0) return "No menus available yet";
    if (assignmentForm.applyToAll) return `Apply to all menus (${serviceMenus.length})`;
    if (assignmentForm.selectedMenuIds.length === 0) return "No menu selected";
    return `${assignmentForm.selectedMenuIds.length} menu(s) selected`;
  }, [assignmentForm, serviceMenus.length]);

  const editPendingPreviews = useMemo(
    () =>
      editImageFiles.map((file, index) => ({
        file,
        key: `${file.name}-${index}`,
        url: URL.createObjectURL(file),
      })),
    [editImageFiles]
  );

  const batchImagePreviews = useMemo(
    () =>
      batchRows
        .filter((row) => row.imageFiles.length > 0)
        .map((row) => ({
          rowId: row.id,
          url: URL.createObjectURL(row.imageFiles[0]),
        })),
    [batchRows]
  );
  const batchImagePreviewByRowId = useMemo(
    () => new Map(batchImagePreviews.map((entry) => [entry.rowId, entry.url])),
    [batchImagePreviews]
  );

  useEffect(() => {
    return () => {
      editPendingPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [editPendingPreviews]);

  useEffect(() => {
    return () => {
      batchImagePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [batchImagePreviews]);

  useEffect(() => {
    if (!createOpen && !batchOpen && !editOpen && !successOpen && !discardConfirmOpen && !batchActionsOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [createOpen, batchOpen, editOpen, successOpen, discardConfirmOpen, batchActionsOpen]);

  const clearFeedback = () => {
    setMessage(null);
    setError(null);
  };

  const resetBatchState = useCallback(() => {
    setBatchSourceType("csv");
    setBatchFile(null);
    setBatchRows([]);
    setBatchStep("upload");
    setBatchSummary(null);
  }, []);

  const openBatchDialog = () => {
    clearFeedback();
    resetBatchState();
    setBatchOpen(true);
  };

  const closeBatchDialog = () => {
    setBatchOpen(false);
    resetBatchState();
  };

  const parseBatchFile = () => {
    if (!batchFile) {
      setError("Choose a CSV or PDF file first.");
      return;
    }

    clearFeedback();
    startBatchParsingTransition(async () => {
      const formData = new FormData();
      formData.append("sourceType", batchSourceType);
      formData.append("file", batchFile);
      const result = await parseBatchMenuItemsAction(formData);
      if (!result.ok || !result.items) {
        setError(result.error ?? "Could not parse file.");
        return;
      }

      setBatchRows(
        result.items.map((item) => ({
          id: crypto.randomUUID(),
          name: item.name,
          description: item.description,
          itemType: item.itemType,
          category: item.category,
          price: item.price,
          status: item.status,
          imageFiles: [],
        }))
      );
      setBatchSummary(result.summary ?? null);
      setBatchStep("review");
      setMessage(result.summary ?? "Batch file parsed. Review before saving.");
    });
  };

  const updateBatchRow = (
    id: string,
    field: keyof Omit<BatchMenuItemFormRow, "id" | "imageFiles">,
    value: string
  ) => {
    setBatchRows((current) =>
      current.map((row) => {
        if (row.id !== id) return row;
        const nextRow = { ...row, [field]: value };

        if (field === "itemType") {
          const normalizedType = value as BatchItemType;
          const defaultCategory =
            normalizedType === "drink"
              ? "Drinks"
              : normalizedType === "ingredient"
                ? "Ingredients"
                : "Food";
          if (
            row.category.trim().length === 0 ||
            row.category === "Food" ||
            row.category === "Drinks" ||
            row.category === "Ingredients"
          ) {
            nextRow.category = defaultCategory;
          }
        }

        return nextRow;
      })
    );
  };

  const addBatchRow = () => {
    setBatchRows((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: "",
        description: "",
        itemType: "food",
        category: "Food",
        price: "0",
        status: "active",
        imageFiles: [],
      },
    ]);
  };

  const removeBatchRow = (id: string) => {
    setBatchRows((current) => current.filter((row) => row.id !== id));
  };

  const setBatchRowImages = (id: string, files: File[]) => {
    setBatchRows((current) =>
      current.map((row) => (row.id === id ? { ...row, imageFiles: files } : row))
    );
  };

  const downloadCsvTemplate = () => {
    const blob = new Blob([batchCsvTemplateContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "menu-items-template.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const saveBatchRows = () => {
    if (batchRows.length === 0) {
      setError("Add at least one row before saving.");
      return;
    }

    clearFeedback();
    startBatchSavingTransition(async () => {
      const result = await createMenuItemsBatchAction({
        items: batchRows.map((row) => ({
          name: row.name,
          description: row.description,
          itemType: row.itemType,
          category: row.category,
          price: row.price,
          status: row.status,
        })),
        addToAllMenus: assignmentForm.applyToAll,
        selectedMenuIds: assignmentForm.selectedMenuIds,
      });

      if (!result.ok) {
        setError(result.error ?? "Could not create batch menu items.");
        return;
      }

      const createdMenuItems = result.createdMenuItems ?? [];
      const rowsWithImages = batchRows.filter((row) => row.imageFiles.length > 0);
      if (createdMenuItems.length > 0 && rowsWithImages.length > 0) {
        const createdByName = new Map(
          createdMenuItems.map((item) => [item.name.trim().toLowerCase(), item.id])
        );
        let uploadFailures = 0;

        for (const row of rowsWithImages) {
          const menuItemId = createdByName.get(row.name.trim().toLowerCase());
          if (!menuItemId || row.imageFiles.length === 0) continue;
          const uploadResult = await uploadPhotos(menuItemId, row.imageFiles, true);
          if (!uploadResult.ok) {
            uploadFailures += 1;
          }
        }

        if (uploadFailures > 0) {
          setMessage(
            `${result.message ?? "Batch menu items created."} ${uploadFailures} image upload(s) failed.`
          );
          closeBatchDialog();
          return;
        }
      }

      closeBatchDialog();
      setMessage(result.message ?? "Batch menu items created.");
    });
  };

  const openEditor = (row: MenuCostRow) => {
    const nextForm: EditMenuItemForm = {
      menuItemId: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      price: String(row.price),
      status: row.status,
    };
    setInitialEditForm(nextForm);
    setEditForm(nextForm);
    setEditExistingPhotos(row.photos);
    setDraggingExistingPhotoPath(null);
    setDragOverExistingPhotoPath(null);
    setInitialEditPhotoPathsKey(row.photos.map((photo) => photo.path).join("|"));
    setEditImageFiles([]);
    setDiscardConfirmOpen(false);
    clearFeedback();
    setEditOpen(true);
  };

  const currentEditPhotoPathsKey = useMemo(
    () => editExistingPhotos.map((photo) => photo.path).join("|"),
    [editExistingPhotos]
  );

  const editHasUnsavedChanges = useMemo(() => {
    if (!editOpen) return false;
    if (!initialEditForm) return false;

    return (
      initialEditForm.name !== editForm.name ||
      initialEditForm.description !== editForm.description ||
      initialEditForm.category !== editForm.category ||
      initialEditForm.price !== editForm.price ||
      initialEditForm.status !== editForm.status ||
      initialEditPhotoPathsKey !== currentEditPhotoPathsKey ||
      editImageFiles.length > 0
    );
  }, [currentEditPhotoPathsKey, editForm, editImageFiles.length, editOpen, initialEditForm, initialEditPhotoPathsKey]);

  const closeEditDialog = useCallback((forceDiscard = false) => {
    if (!forceDiscard && editHasUnsavedChanges) {
      setDiscardConfirmOpen(true);
      return;
    }
    setDiscardConfirmOpen(false);
    setEditOpen(false);
    setEditImageFiles([]);
    setEditExistingPhotos([]);
    setDraggingExistingPhotoPath(null);
    setDragOverExistingPhotoPath(null);
    setInitialEditPhotoPathsKey("");
    setInitialEditForm(null);
  }, [editHasUnsavedChanges]);

  useEffect(() => {
    if (!editOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeEditDialog(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editOpen, closeEditDialog]);

  const toggleRowSelection = useCallback((rowId: string, checked: boolean) => {
    setSelectedRowIds((current) => {
      if (checked) {
        if (current.includes(rowId)) return current;
        return [...current, rowId];
      }
      return current.filter((id) => id !== rowId);
    });
  }, []);

  const toggleSelectAllFiltered = useCallback(() => {
    if (allFilteredRowsSelected) {
      const filteredSet = new Set(filteredRows.map((row) => row.id));
      setSelectedRowIds((current) => current.filter((id) => !filteredSet.has(id)));
      return;
    }

    setSelectedRowIds((current) => {
      const next = new Set(current);
      filteredRows.forEach((row) => next.add(row.id));
      return [...next];
    });
  }, [allFilteredRowsSelected, filteredRows]);

  const clearSelectedRows = () => {
    setSelectedRowIds([]);
  };

  const openBatchActionsDialog = () => {
    if (selectedRowIds.length === 0) {
      setError("Select dishes first.");
      return;
    }
    clearFeedback();
    setBatchActionsOpen(true);
  };

  const closeBatchActionsDialog = () => {
    setBatchActionsOpen(false);
    setBulkCategoryValue("");
    setBulkPriceValue("");
  };

  const applyBatchActionsChanges = () => {
    const normalizedCategory = bulkCategoryValue.trim();
    const normalizedPrice = bulkPriceValue.trim();
    if (selectedRowIds.length === 0) {
      setError("Select dishes first.");
      return;
    }
    if (normalizedCategory.length === 0 && normalizedPrice.length === 0) {
      setError("Enter a new category or a new price.");
      return;
    }

    clearFeedback();
    startBulkTransition(async () => {
      const result = await bulkUpdateMenuItemsAction({
        menuItemIds: selectedRowIds,
        category: normalizedCategory.length > 0 ? normalizedCategory : undefined,
        price: normalizedPrice.length > 0 ? normalizedPrice : undefined,
      });
      if (!result.ok) {
        setError(result.error ?? "Could not apply batch changes.");
        return;
      }

      setMessage(result.message ?? "Selected dishes updated.");
      setSelectedRowIds([]);
      closeBatchActionsDialog();
    });
  };

  const applyBulkDelete = (closeModalAfterSuccess = false) => {
    if (selectedRowIds.length === 0) {
      setError("Select dishes first.");
      return;
    }

    const accepted = globalThis.confirm(
      `Delete ${selectedRowIds.length} selected dish(es)? This cannot be undone.`
    );
    if (!accepted) return;

    clearFeedback();
    startBulkTransition(async () => {
      const result = await bulkDeleteMenuItemsAction({
        menuItemIds: selectedRowIds,
      });
      if (!result.ok) {
        setError(result.error ?? "Could not delete selected dishes.");
        return;
      }

      setMessage(result.message ?? "Selected dishes deleted.");
      setSelectedRowIds([]);
      if (closeModalAfterSuccess) {
        closeBatchActionsDialog();
      }
    });
  };

  const columns = useMemo<DataTableColumn<MenuCostDisplayRow>[]>(
    () => [
      {
        key: "selected",
        header: (
          <input
            type="checkbox"
            className="size-4 rounded border-slate-300"
            checked={allFilteredRowsSelected}
            aria-checked={someFilteredRowsSelected ? "mixed" : allFilteredRowsSelected}
            onChange={toggleSelectAllFiltered}
          />
        ),
        render: (value, row) => (
          <input
            type="checkbox"
            className="size-4 rounded border-slate-300"
            checked={Boolean(value)}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => toggleRowSelection(row.id, event.target.checked)}
          />
        ),
      },
      {
        key: "imageUrl",
        header: "Photo",
        render: (value, row) => (
          <div className="size-11 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            {typeof value === "string" && value.length > 0 ? (
              <Image src={value} alt={row.name} width={44} height={44} unoptimized className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-100 to-emerald-100 text-[10px] font-semibold uppercase tracking-[0.12em] text-teal-700">No</div>
            )}
          </div>
        ),
      },
      { key: "name", header: "Dish", sortable: true },
      { key: "category", header: "Category", sortable: true },
      {
        key: "status",
        header: "Status",
        sortable: true,
        render: (value) => <span className="inline-flex rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium capitalize">{String(value)}</span>,
      },
      { key: "price", header: "Price", sortable: true, render: (value) => money(Number(value), currencyCode) },
      {
        key: "recipeCost",
        header: "Recipe Cost",
        sortable: true,
        render: (value, row) => <span>{money(Number(value), currencyCode)}{row.missingCostCount > 0 ? <span className="ml-1 text-xs text-muted-foreground">(+{row.missingCostCount} missing)</span> : null}</span>,
      },
      { key: "foodCostPct", header: "Food Cost %", sortable: true, render: (value) => `${Number(value).toFixed(1)}%` },
      { key: "margin", header: "Margin", sortable: true, render: (value) => money(Number(value), currencyCode) },
      {
        key: "risk",
        header: "Cost Risk",
        sortable: true,
        render: (value) => <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${riskStyle(String(value) as MenuCostRisk)}`}>{riskLabel(String(value) as MenuCostRisk)}</span>,
      },
      {
        key: "id",
        header: "Ingredients",
        render: (_, row) => (
          <Button
            variant="outline"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              setRecipeForm((current) => ({ ...current, menuItemId: row.id, ingredientId: current.ingredientId || ingredients[0]?.id || "" }));
              setRecipeOpen(true);
              clearFeedback();
            }}
            disabled={ingredients.length === 0}
          >
            Manage
          </Button>
        ),
      },
    ],
    [allFilteredRowsSelected, currencyCode, ingredients, someFilteredRowsSelected, toggleRowSelection, toggleSelectAllFiltered]
  );

  const uploadPhotos = async (menuItemId: string, files: File[], replaceExisting: boolean) => {
    if (files.length === 0) return { ok: true as const };
    const formData = new FormData();
    formData.append("menuItemId", menuItemId);
    formData.append("replaceExisting", replaceExisting ? "true" : "false");
    files.forEach((file) => formData.append("images", file));
    return uploadMenuItemImagesAction(formData);
  };

  const addEditFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list).filter((file) => file.type.startsWith("image/"));
    if (incoming.length === 0) return;
    setEditImageFiles((current) => [...current, ...incoming]);
  };

  const removeEditExistingPhoto = (path: string) => {
    setEditExistingPhotos((current) => current.filter((photo) => photo.path !== path));
  };

  const handleExistingPhotoDragStart = (path: string) => {
    setDraggingExistingPhotoPath(path);
    setDragOverExistingPhotoPath(path);
  };

  const clearExistingPhotoDragState = () => {
    setDraggingExistingPhotoPath(null);
    setDragOverExistingPhotoPath(null);
  };

  const handleExistingPhotoDrop = (targetPath: string) => {
    if (!draggingExistingPhotoPath || draggingExistingPhotoPath === targetPath) {
      clearExistingPhotoDragState();
      return;
    }

    setEditExistingPhotos((current) => {
      const fromIndex = current.findIndex((photo) => photo.path === draggingExistingPhotoPath);
      const toIndex = current.findIndex((photo) => photo.path === targetPath);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return current;

      const next = [...current];
      const [moving] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moving);
      return next;
    });

    clearExistingPhotoDragState();
  };

  const addGeneratedImageToForm = async (
    mode: "create" | "edit",
    name: string,
    description: string
  ) => {
    clearFeedback();
    const result = await generateMenuItemImageAction({ name, description });
    if (!result.ok || !result.imageBase64) {
      setError(result.error ?? "Could not generate an image.");
      return;
    }

    const rawMimeType = (result.mimeType ?? "image/png").toLowerCase().trim();
    const mimeType = rawMimeType === "image/jpg" ? "image/jpeg" : rawMimeType;
    const extension =
      mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png";
    const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const fileName = `${safeName || "menu-item"}-ai-${Date.now()}.${extension}`;
    const response = await fetch(`data:${mimeType};base64,${result.imageBase64}`);
    const blob = await response.blob();
    const file = new File([blob], fileName, { type: mimeType });

    if (mode === "create") {
      setCreateImageFiles((current) => [...current, file]);
      setMessage("AI image generated. Save item to upload it.");
      return;
    }

    setEditImageFiles((current) => [...current, file]);
    setMessage("AI image generated. Save changes to upload it.");
  };

  const generateCreateImage = () => {
    startCreateImageTransition(async () => {
      await addGeneratedImageToForm("create", createForm.name, createForm.description);
    });
  };

  const generateEditImage = () => {
    startEditImageTransition(async () => {
      await addGeneratedImageToForm("edit", editForm.name, editForm.description);
    });
  };

  const submitCreateItem = () => {
    clearFeedback();
    startTransition(async () => {
      const result = await createMenuItemAction({ ...createForm, addToAllMenus: assignmentForm.applyToAll, selectedMenuIds: assignmentForm.selectedMenuIds });
      if (!result.ok || !result.createdMenuItemId) {
        setError(result.error ?? "Could not create menu item.");
        return;
      }

      const uploadResult = await uploadPhotos(result.createdMenuItemId, createImageFiles, true);
      if (!uploadResult.ok) {
        setError(uploadResult.error ?? "Dish created, but image upload failed.");
        return;
      }

      setCreateOpen(false);
      setCreatedMenuItemId(result.createdMenuItemId);
      setRecipeForm((current) => ({ ...current, menuItemId: result.createdMenuItemId! }));
      setCreateForm({ name: "", description: "", category: "Main", price: "0", status: "active" });
      setCreateImageFiles([]);
      setAssignmentForm({ applyToAll: false, selectedMenuIds: [] });
      setMessage(result.message ?? "Dish created successfully.");
      setSuccessOpen(true);
    });
  };

  const submitEditItem = () => {
    clearFeedback();
    startTransition(async () => {
      const result = await updateMenuItemAction(editForm);
      if (!result.ok) {
        setError(result.error ?? "Could not save dish changes.");
        return;
      }

      const syncPhotosResult = await syncMenuItemPhotosAction({
        menuItemId: editForm.menuItemId,
        orderedPhotoPaths: editExistingPhotos.map((photo) => photo.path),
      });
      if (!syncPhotosResult.ok) {
        setError(syncPhotosResult.error ?? "Could not update photo gallery.");
        return;
      }

      const uploadResult = await uploadPhotos(editForm.menuItemId, editImageFiles, false);
      if (!uploadResult.ok) {
        setError(uploadResult.error ?? "Dish updated, but photo upload failed.");
        return;
      }
      setDiscardConfirmOpen(false);
      setEditOpen(false);
      setEditImageFiles([]);
      setEditExistingPhotos([]);
      setDraggingExistingPhotoPath(null);
      setDragOverExistingPhotoPath(null);
      setInitialEditPhotoPathsKey("");
      setMessage("Dish updated successfully.");
    });
  };

  const submitDeleteItem = () => {
    if (!editForm.menuItemId) return;
    const accepted = globalThis.confirm("Delete this dish permanently? This cannot be undone.");
    if (!accepted) return;

    clearFeedback();
    startTransition(async () => {
      const result = await deleteMenuItemAction({ menuItemId: editForm.menuItemId });
      if (!result.ok) {
        setError(result.error ?? "Could not delete dish.");
        return;
      }
      setDiscardConfirmOpen(false);
      setEditOpen(false);
      setEditImageFiles([]);
      setEditExistingPhotos([]);
      setDraggingExistingPhotoPath(null);
      setDragOverExistingPhotoPath(null);
      setInitialEditPhotoPathsKey("");
      setMessage(result.message ?? "Dish deleted.");
    });
  };

  const submitRecipeIngredient = () => {
    clearFeedback();
    startTransition(async () => {
      const result = await addRecipeIngredientAction({ ...recipeForm, menuItemId: selectedMenuItemId, ingredientId: selectedIngredientId });
      if (!result.ok) {
        setError(result.error ?? "Could not update recipe.");
        return;
      }
      setMessage(result.message ?? "Recipe updated.");
      setRecipeOpen(false);
      setRecipeForm((current) => ({ ...current, quantity: "1" }));
    });
  };

  const toggleMenuSelection = (menuId: string, checked: boolean) => {
    setAssignmentForm((current) => {
      const selectedSet = new Set(current.selectedMenuIds);
      if (checked) selectedSet.add(menuId);
      else selectedSet.delete(menuId);
      return { ...current, selectedMenuIds: [...selectedSet] };
    });
  };

  const canUsePortal = typeof document !== "undefined";
  const batchDialogWidthClass =
    batchStep === "review" && batchSourceType === "pdf"
      ? "max-w-[95vw] xl:max-w-6xl"
      : "max-w-2xl";

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-stone-50 via-white to-cyan-50/70 p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Dishes</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-800">{restaurantName}</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">Build dishes first, then control profitability with live inventory costs.</p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <Button
              className="bg-cyan-800 text-white hover:bg-cyan-700"
              onClick={() => {
                setCreateOpen(true);
                clearFeedback();
              }}
            >
              <PlusIcon className="size-4" />
              Add Menu Item
            </Button>
            <Button type="button" variant="outline" onClick={openBatchDialog}>
              <UploadCloudIcon className="size-4" />
              Batch Menu Items
            </Button>
          </div>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200/80 bg-white/90 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Dishes</p>
          <p className="mt-2 text-3xl font-semibold text-slate-800">{summary.totalItems}</p>
        </article>
        <article className="rounded-xl border border-teal-200/70 bg-teal-50/70 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-teal-700">Avg Food Cost</p>
          <p className="mt-2 flex items-center gap-2 text-3xl font-semibold text-teal-900"><CircleDollarSignIcon className="size-6 text-teal-700" />{summary.avgFoodCostPct.toFixed(1)}%</p>
        </article>
        <article className="rounded-xl border border-rose-200/70 bg-rose-50/70 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-rose-700">High Risk</p>
          <p className="mt-2 flex items-center gap-2 text-3xl font-semibold text-rose-800"><FlameIcon className="size-6" />{summary.highRisk}</p>
        </article>
        <article className="rounded-xl border border-amber-200/70 bg-amber-50/70 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-amber-700">Incomplete</p>
          <p className="mt-2 flex items-center gap-2 text-3xl font-semibold text-amber-800"><ReceiptTextIcon className="size-6" />{summary.incomplete}</p>
        </article>
      </section>

      {message ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white/80 p-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_240px_auto]">
          <Input
            value={nameFilter}
            onChange={(event) => setNameFilter(event.target.value)}
            placeholder="Filter by name or description"
          />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {availableCategories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
            <Button type="button" variant={viewMode === "table" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("table")}><Table2Icon className="size-4" />Table</Button>
            <Button type="button" variant={viewMode === "cards" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("cards")}><LayersIcon className="size-4" />Cards</Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>Showing {filteredRows.length} of {rows.length} dishes</span>
          <div className="flex items-center gap-2">
            {(nameFilter.length > 0 || categoryFilter !== "all") ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setNameFilter("");
                  setCategoryFilter("all");
                }}
              >
                Clear filters
              </Button>
            ) : null}
            {viewMode === "table" ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={toggleSelectAllFiltered} disabled={filteredRows.length === 0}>
                  {allFilteredRowsSelected ? "Unselect All" : "Select All"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={clearSelectedRows} disabled={selectedRowIds.length === 0}>
                  Clear
                </Button>
                <span>{selectedRowIds.length} selected</span>
                <Button type="button" size="sm" onClick={openBatchActionsDialog} disabled={selectedRowIds.length === 0 || isBulkPending}>
                  Batch Actions
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {viewMode === "table" ? (
        <DataTable data={displayRows} columns={columns} getRowId={(row) => row.id} onRowClick={openEditor} defaultSortKey="name" defaultPageSize={10} emptyMessage="No dishes match this filter." />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {displayRows.length > 0 ? displayRows.map((row) => (
            <article key={row.id} role="button" tabIndex={0} onClick={() => openEditor(row)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openEditor(row); } }} className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="mb-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                {row.imageUrl ? <Image src={row.imageUrl} alt={row.name} width={640} height={360} unoptimized className="aspect-[16/9] w-full object-cover" /> : <div className="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-teal-100 to-emerald-100 text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">No Image</div>}
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{row.name}</p>
                  <p className="text-xs text-slate-500">{row.category}</p>
                </div>
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${riskStyle(row.risk)}`}>{riskLabel(row.risk)}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-slate-50 p-2"><p className="text-xs text-slate-500">Price</p><p className="font-medium text-slate-800">{money(row.price, currencyCode)}</p></div>
                <div className="rounded-lg bg-slate-50 p-2"><p className="text-xs text-slate-500">Recipe Cost</p><p className="font-medium text-slate-800">{money(row.recipeCost, currencyCode)}</p></div>
                <div className="rounded-lg bg-slate-50 p-2"><p className="text-xs text-slate-500">Food Cost</p><p className="font-medium text-slate-800">{row.foodCostPct.toFixed(1)}%</p></div>
                <div className="rounded-lg bg-slate-50 p-2"><p className="text-xs text-slate-500">Margin</p><p className="font-medium text-slate-800">{money(row.margin, currencyCode)}</p></div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs capitalize text-slate-500">{row.status}</span>
                <Button variant="outline" size="sm" onClick={(event) => { event.stopPropagation(); setRecipeForm((current) => ({ ...current, menuItemId: row.id, ingredientId: current.ingredientId || ingredients[0]?.id || "" })); setRecipeOpen(true); clearFeedback(); }} disabled={ingredients.length === 0}>Ingredients</Button>
              </div>
            </article>
          )) : <div className="col-span-full rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No dishes match this filter.</div>}
        </section>
      )}

      <section className="rounded-xl border border-slate-200/80 bg-card/90 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Recipe Snapshot</h3>
        <div className="mt-3 space-y-2">
          {selectedRecipeDetails.length > 0 ? selectedRecipeDetails.map((entry) => (
            <div key={`${entry.ingredientName}-${entry.unitSymbol}`} className="flex flex-col gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">{entry.ingredientName}</p>
                <p className="text-xs text-muted-foreground">{entry.quantity.toFixed(3)} {entry.unitSymbol}</p>
              </div>
              <p className="text-sm font-medium">{entry.ingredientCost === null ? "Missing cost" : money(entry.ingredientCost, currencyCode)}</p>
            </div>
          )) : <p className="text-sm text-muted-foreground">Select a dish and add ingredients to build a recipe.</p>}
        </div>
      </section>
      {canUsePortal && batchActionsOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
              onMouseDown={(event) => {
                if (event.target !== event.currentTarget) return;
                closeBatchActionsDialog();
              }}
            >
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  applyBatchActionsChanges();
                }}
                className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
              >
                <div className="flex items-center justify-between border-b px-6 py-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Batch Actions</h3>
                    <p className="text-sm text-slate-600">
                      Apply updates to {selectedRowIds.length} selected dish(es).
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={closeBatchActionsDialog}>
                    <XIcon className="size-4" />
                  </Button>
                </div>

                <div className="space-y-4 px-6 py-5">
                  <div className="space-y-2">
                    <Label htmlFor="batch-action-category">New Category (optional)</Label>
                    <Input
                      id="batch-action-category"
                      value={bulkCategoryValue}
                      onChange={(event) => setBulkCategoryValue(event.target.value)}
                      placeholder="e.g. Main"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="batch-action-price">New Price (optional)</Label>
                    <Input
                      id="batch-action-price"
                      type="number"
                      step="0.01"
                      value={bulkPriceValue}
                      onChange={(event) => setBulkPriceValue(event.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t px-6 py-4">
                  <Button
                    type="button"
                    onClick={() => applyBulkDelete(true)}
                    className="border border-rose-300/60 bg-gradient-to-r from-rose-600 to-red-700 text-white hover:from-rose-500 hover:to-red-600"
                    disabled={isBulkPending || selectedRowIds.length === 0}
                  >
                    <Trash2Icon className="size-4" />
                    Delete Selected
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={closeBatchActionsDialog}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        isBulkPending ||
                        selectedRowIds.length === 0 ||
                        (bulkCategoryValue.trim().length === 0 &&
                          bulkPriceValue.trim().length === 0)
                      }
                    >
                      {isBulkPending ? "Applying..." : "Apply Changes"}
                    </Button>
                  </div>
                </div>
              </form>
            </div>,
            document.body
          )
        : null}
      {canUsePortal && createOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
              onMouseDown={(event) => {
                if (event.target !== event.currentTarget) return;
                setCreateOpen(false);
              }}
            >
              <form onSubmit={(event) => { event.preventDefault(); submitCreateItem(); }} className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b px-6 py-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Add Menu Item</h3>
                    <p className="text-sm text-slate-600">Create a new dish and decide which menus should include it.</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setCreateOpen(false)}><XIcon className="size-4" /></Button>
                </div>

                <div className="max-h-[72vh] space-y-4 overflow-y-auto px-6 py-5">
                  <div className="space-y-2">
                    <Label htmlFor="menu-item-name">Name</Label>
                    <Input id="menu-item-name" value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} placeholder="Chicken Burrito" required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="menu-item-description">Description</Label>
                    <textarea
                      id="menu-item-description"
                      value={createForm.description}
                      onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Short description of ingredients, flavor profile, and plating."
                      rows={3}
                      className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:ring-[3px]"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="menu-item-category">Category</Label>
                      <Input id="menu-item-category" value={createForm.category} onChange={(event) => setCreateForm((current) => ({ ...current, category: event.target.value }))} placeholder="Main" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="menu-item-price">Price</Label>
                      <Input id="menu-item-price" type="number" step="0.01" value={createForm.price} onChange={(event) => setCreateForm((current) => ({ ...current, price: event.target.value }))} />
                    </div>
                  </div>

                  <ImageDropzone files={createImageFiles} setFiles={setCreateImageFiles} label="Pictures" />
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-600">Or generate one with AI using dish name and description.</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={generateCreateImage}
                        disabled={isGeneratingCreateImage || createForm.name.trim().length < 2}
                      >
                        {isGeneratingCreateImage ? <Loader2Icon className="size-4 animate-spin" /> : <SparklesIcon className="size-4" />}
                        {isGeneratingCreateImage ? "Generating..." : "Generate with AI"}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={createForm.status} onValueChange={(value) => setCreateForm((current) => ({ ...current, status: value as CreateMenuItemForm["status"] }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">Add to Menu</p>
                        <p className="text-xs text-slate-600">{assignmentSummary}</p>
                      </div>
                      <Button type="button" variant="outline" onClick={() => setAssignmentOpen(true)} disabled={serviceMenus.length === 0}>Add to Menu</Button>
                    </div>
                    {serviceMenus.length === 0 ? <p className="mt-2 text-xs text-slate-500">Create menus first in Menu Planner to assign dishes.</p> : null}
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t px-6 py-4">
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save Item"}</Button>
                </div>
              </form>
            </div>,
            document.body
          )
        : null}

      {canUsePortal && batchOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
              onMouseDown={(event) => {
                if (event.target !== event.currentTarget) return;
                closeBatchDialog();
              }}
            >
              <div
                className={`w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ${batchDialogWidthClass}`}
              >
                <div className="flex items-center justify-between border-b px-6 py-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Batch Menu Items</h3>
                    <p className="text-sm text-slate-600">
                      Upload CSV or PDF, review parsed rows, then save all at once.
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={closeBatchDialog}>
                    <XIcon className="size-4" />
                  </Button>
                </div>

                <div className="max-h-[72vh] space-y-4 overflow-y-auto px-6 py-5">
                  {batchStep === "upload" ? (
                    <>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          className={`rounded-xl border p-4 text-left transition ${
                            batchSourceType === "csv"
                              ? "border-cyan-800 bg-cyan-800 text-white"
                              : "border-slate-200 bg-white text-slate-700"
                          }`}
                          onClick={() => setBatchSourceType("csv")}
                        >
                          <p className="text-sm font-medium">CSV Upload</p>
                          <p className="mt-1 text-xs opacity-80">
                            Best for spreadsheets. Columns: name, type, description, category,
                            price, status.
                          </p>
                        </button>
                        <button
                          type="button"
                          className={`rounded-xl border p-4 text-left transition ${
                            batchSourceType === "pdf"
                              ? "border-cyan-800 bg-cyan-800 text-white"
                              : "border-slate-200 bg-white text-slate-700"
                          }`}
                          onClick={() => setBatchSourceType("pdf")}
                        >
                          <p className="text-sm font-medium">PDF Upload (AI)</p>
                          <p className="mt-1 text-xs opacity-80">
                            AI extracts menu items from the uploaded PDF into editable rows.
                          </p>
                        </button>
                      </div>

                      <input
                        ref={batchFileInputRef}
                        type="file"
                        className="hidden"
                        accept={batchSourceType === "csv" ? ".csv,text/csv" : ".pdf,application/pdf"}
                        onChange={(event) => setBatchFile(event.target.files?.[0] ?? null)}
                      />
                      <button
                        type="button"
                        onClick={() => batchFileInputRef.current?.click()}
                        className="w-full rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-left transition hover:border-cyan-500 hover:bg-cyan-50"
                      >
                        <p className="text-sm font-medium text-slate-800">
                          {batchFile
                            ? `Selected: ${batchFile.name}`
                            : `Choose a ${batchSourceType.toUpperCase()} file`}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Max 10MB. You will review and edit all rows before saving.
                        </p>
                      </button>
                      {batchSourceType === "csv" ? (
                        <div className="flex justify-end">
                          <Button type="button" variant="outline" size="sm" onClick={downloadCsvTemplate}>
                            Download CSV Template
                          </Button>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                          Import Summary
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          {batchSummary ?? `Parsed ${batchRows.length} rows.`}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-slate-900">Add to Menu</p>
                            <p className="text-xs text-slate-600">{assignmentSummary}</p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setAssignmentOpen(true)}
                            disabled={serviceMenus.length === 0}
                          >
                            Add to Menu
                          </Button>
                        </div>
                        {serviceMenus.length === 0 ? (
                          <p className="mt-2 text-xs text-slate-500">
                            Create menus first in Menu Planner to assign dishes.
                          </p>
                        ) : null}
                      </div>

                      <div className="overflow-hidden rounded-xl border border-slate-200">
                        <div className="max-h-[44vh] overflow-auto">
                          <table className="w-full min-w-[1040px] text-left text-sm">
                            <thead className="sticky top-0 bg-slate-100 text-xs uppercase tracking-[0.1em] text-slate-600">
                              <tr>
                                <th className="px-3 py-2">Photo</th>
                                <th className="px-3 py-2">Name</th>
                                <th className="px-3 py-2">Type</th>
                                <th className="px-3 py-2">Description</th>
                                <th className="px-3 py-2">Category</th>
                                <th className="px-3 py-2">Price</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {batchRows.map((row) => (
                                <tr key={row.id} className="border-t align-top">
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <label
                                        htmlFor={`batch-photo-${row.id}`}
                                        className="group relative block size-12 cursor-pointer overflow-hidden rounded-md border border-slate-200 bg-slate-100"
                                        title="Click to upload image(s)"
                                      >
                                        {batchImagePreviewByRowId.get(row.id) ? (
                                          <Image
                                            src={batchImagePreviewByRowId.get(row.id)!}
                                            alt={`${row.name || "row"} preview`}
                                            width={48}
                                            height={48}
                                            unoptimized
                                            className="h-full w-full object-cover"
                                          />
                                        ) : (
                                          <div className="flex h-full w-full items-center justify-center text-[10px] font-medium text-slate-500">
                                            Add
                                          </div>
                                        )}
                                        <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-[10px] font-medium text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
                                          Upload
                                        </span>
                                      </label>
                                      <div className="space-y-1">
                                        <label
                                          htmlFor={`batch-photo-${row.id}`}
                                          className="inline-flex cursor-pointer items-center rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:border-cyan-500 hover:text-cyan-700"
                                        >
                                          {row.imageFiles.length > 1
                                            ? `${row.imageFiles.length} files`
                                            : row.imageFiles.length === 1
                                              ? "1 file"
                                              : "Upload"}
                                        </label>
                                        {row.imageFiles.length > 0 ? (
                                          <button
                                            type="button"
                                            className="block text-xs text-rose-600 hover:text-rose-700"
                                            onClick={() => setBatchRowImages(row.id, [])}
                                          >
                                            Remove
                                          </button>
                                        ) : null}
                                      </div>
                                      <input
                                        id={`batch-photo-${row.id}`}
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        multiple
                                        className="hidden"
                                        onChange={(event) =>
                                          setBatchRowImages(
                                            row.id,
                                            event.target.files ? Array.from(event.target.files) : []
                                          )
                                        }
                                      />
                                    </div>
                                  </td>
                                  <td className="px-3 py-2">
                                    <Input
                                      value={row.name}
                                      onChange={(event) =>
                                        updateBatchRow(row.id, "name", event.target.value)
                                      }
                                      placeholder="Dish name"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <select
                                      value={row.itemType}
                                      onChange={(event) =>
                                        updateBatchRow(row.id, "itemType", event.target.value)
                                      }
                                      className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-white px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:ring-[3px]"
                                    >
                                      <option value="food">Food</option>
                                      <option value="drink">Drink</option>
                                      <option value="ingredient">Ingredient</option>
                                    </select>
                                  </td>
                                  <td className="px-3 py-2">
                                    <textarea
                                      value={row.description}
                                      onChange={(event) =>
                                        updateBatchRow(row.id, "description", event.target.value)
                                      }
                                      rows={2}
                                      className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-white px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:ring-[3px]"
                                      placeholder="Description"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <Input
                                      value={row.category}
                                      onChange={(event) =>
                                        updateBatchRow(row.id, "category", event.target.value)
                                      }
                                      placeholder="Category"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={row.price}
                                      onChange={(event) =>
                                        updateBatchRow(row.id, "price", event.target.value)
                                      }
                                      placeholder="0.00"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <select
                                      value={row.status}
                                      onChange={(event) =>
                                        updateBatchRow(row.id, "status", event.target.value)
                                      }
                                      className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-white px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:ring-[3px]"
                                    >
                                      <option value="active">Active</option>
                                      <option value="draft">Draft</option>
                                    </select>
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => removeBatchRow(row.id)}
                                    >
                                      <Trash2Icon className="size-4" />
                                      Remove
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t px-6 py-4">
                  <div>
                    {batchStep === "review" ? (
                      <Button type="button" variant="outline" onClick={addBatchRow}>
                        <PlusCircleIcon className="size-4" />
                        Add Row
                      </Button>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    {batchStep === "review" ? (
                      <Button type="button" variant="outline" onClick={() => setBatchStep("upload")}>
                        Re-upload
                      </Button>
                    ) : null}
                    <Button type="button" variant="outline" onClick={closeBatchDialog}>
                      Cancel
                    </Button>
                    {batchStep === "upload" ? (
                      <Button type="button" onClick={parseBatchFile} disabled={isBatchParsing}>
                        {isBatchParsing ? (
                          <Loader2Icon className="size-4 animate-spin" />
                        ) : (
                          <UploadCloudIcon className="size-4" />
                        )}
                        {isBatchParsing ? "Parsing..." : "Preview Items"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={saveBatchRows}
                        disabled={isBatchSaving || batchRows.length === 0}
                      >
                        {isBatchSaving ? (
                          <Loader2Icon className="size-4 animate-spin" />
                        ) : (
                          <CheckIcon className="size-4" />
                        )}
                        {isBatchSaving ? "Saving..." : "Save All Items"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      <DrawerForm
        open={assignmentOpen}
        onOpenChange={setAssignmentOpen}
        title="Add to Menu"
        description="Choose where this dish will be available."
        submitLabel="Save"
        onSubmit={(event) => { event.preventDefault(); setAssignmentOpen(false); }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button type="button" className={`rounded-xl border p-3 text-left transition ${assignmentForm.applyToAll ? "border-cyan-800 bg-cyan-800 text-white" : "border-slate-200 bg-white text-slate-700"}`} onClick={() => setAssignmentForm((current) => ({ ...current, applyToAll: true, selectedMenuIds: [] }))}>
            <p className="text-sm font-medium">Apply to all</p>
            <p className="mt-1 text-xs opacity-80">Dish will be added to every menu.</p>
          </button>
          <button type="button" className={`rounded-xl border p-3 text-left transition ${!assignmentForm.applyToAll ? "border-cyan-800 bg-cyan-800 text-white" : "border-slate-200 bg-white text-slate-700"}`} onClick={() => setAssignmentForm((current) => ({ ...current, applyToAll: false }))}>
            <p className="text-sm font-medium">Select specific menus</p>
            <p className="mt-1 text-xs opacity-80">Pick one or multiple menus.</p>
          </button>
        </div>

        {!assignmentForm.applyToAll ? (
          <div className="space-y-2">
            <Label>Menus</Label>
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
              {serviceMenus.map((menu) => {
                const checked = assignmentForm.selectedMenuIds.includes(menu.id);
                return (
                  <label key={menu.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
                    <input type="checkbox" className="size-4 rounded border-slate-300" checked={checked} onChange={(event) => toggleMenuSelection(menu.id, event.target.checked)} />
                    <span className="text-sm text-slate-700">{menu.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
      </DrawerForm>

      <DrawerForm
        open={recipeOpen}
        onOpenChange={setRecipeOpen}
        title="Add Ingredients"
        description="Define what goes into this dish to complete costing."
        submitLabel={isPending ? "Saving..." : "Save Ingredient"}
        isSubmitting={isPending}
        onSubmit={(event) => { event.preventDefault(); submitRecipeIngredient(); }}
      >
        <div className="space-y-2">
          <Label>Dish</Label>
          <Select value={selectedMenuItemId} onValueChange={(value) => setRecipeForm((current) => ({ ...current, menuItemId: value }))}>
            <SelectTrigger><SelectValue placeholder="Choose dish" /></SelectTrigger>
            <SelectContent>
              {menuItems.map((item) => (<SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Ingredient</Label>
          <Select value={selectedIngredientId} onValueChange={(value) => setRecipeForm((current) => ({ ...current, ingredientId: value }))}>
            <SelectTrigger><SelectValue placeholder="Choose ingredient" /></SelectTrigger>
            <SelectContent>
              {ingredients.map((ingredient) => (<SelectItem key={ingredient.id} value={ingredient.id}>{ingredient.name} ({ingredient.unitSymbol})</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="recipe-quantity">Quantity</Label>
          <Input id="recipe-quantity" type="number" step="0.001" value={recipeForm.quantity} onChange={(event) => setRecipeForm((current) => ({ ...current, quantity: event.target.value }))} required />
        </div>
      </DrawerForm>
      {canUsePortal && editOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
              onMouseDown={(event) => {
                if (event.target !== event.currentTarget) return;
                closeEditDialog(false);
              }}
            >
              <form onSubmit={(event) => { event.preventDefault(); submitEditItem(); }} className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b px-6 py-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Edit Dish</h3>
                    <p className="text-sm text-slate-600">Update details, reorder photos, or add new ones.</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => closeEditDialog(false)}><XIcon className="size-4" /></Button>
                </div>

                <div className="max-h-[72vh] space-y-4 overflow-y-auto px-6 py-5">
                  <div className="space-y-2">
                    <Label htmlFor="edit-dish-name">Name</Label>
                    <Input id="edit-dish-name" value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-dish-description">Description</Label>
                    <textarea
                      id="edit-dish-description"
                      value={editForm.description}
                      onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Short description of ingredients, flavor profile, and plating."
                      rows={3}
                      className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:ring-[3px]"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-dish-category">Category</Label>
                      <Input id="edit-dish-category" value={editForm.category} onChange={(event) => setEditForm((current) => ({ ...current, category: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-dish-price">Price</Label>
                      <Input id="edit-dish-price" type="number" step="0.01" value={editForm.price} onChange={(event) => setEditForm((current) => ({ ...current, price: event.target.value }))} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Pictures</Label>
                      <span className="text-xs text-slate-500">Drag to reorder, first photo is cover</span>
                    </div>
                    <input
                      ref={editPhotoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      className="hidden"
                      onChange={(event) => addEditFiles(event.target.files)}
                    />
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {editExistingPhotos.map((photo, index) => (
                        <div
                          key={photo.path}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "move";
                            handleExistingPhotoDragStart(photo.path);
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "move";
                            setDragOverExistingPhotoPath(photo.path);
                          }}
                          onDragLeave={() => {
                            if (dragOverExistingPhotoPath !== photo.path) return;
                            setDragOverExistingPhotoPath(null);
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            handleExistingPhotoDrop(photo.path);
                          }}
                          onDragEnd={clearExistingPhotoDragState}
                          className={`group relative overflow-hidden rounded-lg border bg-slate-100 transition ${
                            draggingExistingPhotoPath === photo.path
                              ? "cursor-grabbing opacity-70"
                              : "cursor-grab"
                          } ${
                            dragOverExistingPhotoPath === photo.path &&
                            draggingExistingPhotoPath !== photo.path
                              ? "border-cyan-500 ring-2 ring-cyan-500/40"
                              : "border-slate-200"
                          }`}
                        >
                          <Image
                            src={photo.imageUrl}
                            alt={`${editForm.name} photo ${index + 1}`}
                            width={240}
                            height={180}
                            unoptimized
                            className="aspect-[4/3] w-full object-cover"
                          />
                          {index === 0 ? (
                            <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                              Cover
                            </span>
                          ) : null}
                          <div className="absolute right-1 top-1 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                            <span className="inline-flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-1 text-[10px] font-medium text-white">
                              <GripVerticalIcon className="size-3" />
                              Drag
                            </span>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md border border-rose-200/40 bg-gradient-to-r from-rose-600/95 to-red-600/95 px-1.5 py-1 text-[10px] font-medium text-white shadow transition hover:from-rose-500 hover:to-red-500"
                              onClick={() => removeEditExistingPhoto(photo.path)}
                            >
                              <Trash2Icon className="size-3" />
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}

                      {editPendingPreviews.map((preview, index) => (
                        <div key={preview.key} className="group relative overflow-hidden rounded-lg border border-dashed border-cyan-300 bg-cyan-50/60">
                          <Image
                            src={preview.url}
                            alt={preview.file.name}
                            width={240}
                            height={180}
                            unoptimized
                            className="aspect-[4/3] w-full object-cover"
                          />
                          <span className="absolute left-1 top-1 rounded bg-cyan-800/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
                            New
                          </span>
                          <button
                            type="button"
                            className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                            onClick={() => setEditImageFiles((current) => current.filter((_, i) => i !== index))}
                          >
                            <XIcon className="size-3.5" />
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => editPhotoInputRef.current?.click()}
                        className="flex aspect-[4/3] items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-xs font-medium text-slate-600 transition hover:border-cyan-500 hover:bg-cyan-50"
                      >
                        <PlusCircleIcon className="size-4" />
                        Add photos
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-600">Or generate one with AI from dish name and description.</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={generateEditImage}
                        disabled={isGeneratingEditImage || editForm.name.trim().length < 2}
                      >
                        {isGeneratingEditImage ? <Loader2Icon className="size-4 animate-spin" /> : <SparklesIcon className="size-4" />}
                        {isGeneratingEditImage ? "Generating..." : "Generate with AI"}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={editForm.status} onValueChange={(value) => setEditForm((current) => ({ ...current, status: value as EditMenuItemForm["status"] }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-2">
                    {editForm.status === "archived" ? (
                      <Button type="button" variant="outline" onClick={() => setEditForm((current) => ({ ...current, status: "active" }))}>Restore</Button>
                    ) : (
                      <Button type="button" variant="outline" onClick={() => setEditForm((current) => ({ ...current, status: "archived" }))}>Archive</Button>
                    )}
                    <Button
                      type="button"
                      onClick={submitDeleteItem}
                      className="group relative overflow-hidden border border-rose-300/60 bg-gradient-to-r from-rose-600 to-red-700 text-white shadow-sm transition hover:from-rose-500 hover:to-red-600"
                    >
                      <span className="absolute inset-0 translate-y-full bg-white/10 transition-transform duration-200 group-hover:translate-y-0" />
                      <span className="relative inline-flex items-center gap-2">
                        <Trash2Icon className="size-4" />
                        Delete Dish
                      </span>
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => closeEditDialog(false)}>Cancel</Button>
                    <Button type="submit" disabled={isPending}>Save Changes</Button>
                  </div>
                </div>
              </form>

              {discardConfirmOpen ? (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/25 p-4">
                  <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
                    <h4 className="text-base font-semibold text-slate-900">Discard changes?</h4>
                    <p className="mt-1 text-sm text-slate-600">You have unsaved edits. If you close now, your changes will be lost.</p>
                    <div className="mt-4 flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setDiscardConfirmOpen(false)}>Keep Editing</Button>
                      <Button type="button" variant="destructive" onClick={() => closeEditDialog(true)}>Discard</Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>,
            document.body
          )
        : null}

      {canUsePortal && successOpen
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
              <div className="w-full max-w-md animate-in fade-in zoom-in-95 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
                <div className="flex items-start gap-3">
                  <span className="inline-flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CheckIcon className="size-5" /></span>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">Dish created</h3>
                    <p className="mt-1 text-sm text-slate-600">Your dish was saved successfully. Do you want to add ingredients now?</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={() => { setSuccessOpen(false); setCreatedMenuItemId(null); }}>Do Later</Button>
                  <Button type="button" className="bg-cyan-800 text-white hover:bg-cyan-700" onClick={() => { setSuccessOpen(false); setRecipeForm((current) => ({ ...current, menuItemId: createdMenuItemId ?? current.menuItemId })); setRecipeOpen(true); }}>
                    <UtensilsCrossedIcon className="size-4" />
                    Add Ingredients Now
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
