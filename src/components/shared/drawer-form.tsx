"use client";

import type { FormEvent, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type DrawerFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
};

export function DrawerForm({
  open,
  onOpenChange,
  title,
  description,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  isSubmitting = false,
  onSubmit,
  children,
}: DrawerFormProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-xl p-0">
        <form onSubmit={onSubmit} className="flex h-full flex-col">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>{title}</SheetTitle>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </SheetHeader>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {children}
          </div>

          <SheetFooter className="border-t px-6 py-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {submitLabel}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
