"use client";

import { useMemo, useState } from "react";
import { ArrowUpDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type DataTableColumn<TData extends Record<string, unknown>> = {
  key: keyof TData & string;
  header: React.ReactNode;
  sortable?: boolean;
  className?: string;
  render?: (value: unknown, row: TData) => React.ReactNode;
};

type DataTableProps<TData extends Record<string, unknown>> = {
  data: TData[];
  columns: Array<DataTableColumn<TData>>;
  getRowId?: (row: TData, index: number) => string;
  onRowClick?: (row: TData) => void;
  defaultSortKey?: keyof TData & string;
  defaultSortDirection?: "asc" | "desc";
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  emptyMessage?: string;
};

function normalizeValue(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return value.toLowerCase();
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase();
}

export function DataTable<TData extends Record<string, unknown>>({
  data,
  columns,
  getRowId,
  onRowClick,
  defaultSortKey,
  defaultSortDirection = "asc",
  defaultPageSize = 10,
  pageSizeOptions = [10, 20, 50],
  emptyMessage = "No records found.",
}: DataTableProps<TData>) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey ?? null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
    defaultSortDirection
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const sortedData = useMemo(() => {
    if (!sortKey) return data;

    return [...data].sort((a, b) => {
      const aValue = normalizeValue(a[sortKey as keyof TData]);
      const bValue = normalizeValue(b[sortKey as keyof TData]);

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  const rows = sortedData.slice(start, end);

  const onSort = (columnKey: string) => {
    setPage(1);

    if (sortKey !== columnKey) {
      setSortKey(columnKey);
      setSortDirection("asc");
      return;
    }

    setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
  };

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key} className={column.className}>
                {column.sortable ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3 h-8"
                    onClick={() => onSort(column.key)}
                  >
                    {column.header}
                    <ArrowUpDownIcon className="size-3.5" />
                  </Button>
                ) : (
                  column.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length > 0 ? (
            rows.map((row, index) => (
              <TableRow
                key={
                  getRowId
                    ? getRowId(row, index)
                    : `${String(row[columns[0]?.key] ?? index)}-${index}`
                }
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? "cursor-pointer hover:bg-muted/50" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
              >
                {columns.map((column) => {
                  const value = row[column.key];
                  return (
                    <TableCell key={column.key} className={column.className}>
                      {column.render ? column.render(value, row) : String(value ?? "-")}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {rows.length === 0 ? 0 : start + 1}-{Math.min(end, sortedData.length)} of{" "}
          {sortedData.length}
        </p>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              setPageSize(Number(value));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={safePage === 1}
          >
            <ChevronLeftIcon className="size-4" />
            <span className="sr-only">Previous page</span>
          </Button>
          <span className="w-24 text-center text-sm">
            Page {safePage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
            disabled={safePage === totalPages}
          >
            <ChevronRightIcon className="size-4" />
            <span className="sr-only">Next page</span>
          </Button>
        </div>
      </div>
    </section>
  );
}
