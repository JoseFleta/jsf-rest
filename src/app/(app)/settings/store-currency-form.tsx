"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateStoreCurrencyAction } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const currencyOptions = [
  { code: "USD", label: "US Dollar (USD)" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "GBP", label: "British Pound (GBP)" },
  { code: "CAD", label: "Canadian Dollar (CAD)" },
  { code: "MXN", label: "Mexican Peso (MXN)" },
  { code: "BRL", label: "Brazilian Real (BRL)" },
  { code: "COP", label: "Colombian Peso (COP)" },
  { code: "ARS", label: "Argentine Peso (ARS)" },
  { code: "CLP", label: "Chilean Peso (CLP)" },
  { code: "PEN", label: "Peruvian Sol (PEN)" },
  { code: "JPY", label: "Japanese Yen (JPY)" },
  { code: "AUD", label: "Australian Dollar (AUD)" },
] as const;

type StoreCurrencyFormProps = {
  initialCurrencyCode: string;
};

export function StoreCurrencyForm({
  initialCurrencyCode,
}: StoreCurrencyFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currencyCode, setCurrencyCode] = useState(initialCurrencyCode);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const saveCurrency = () => {
    setFeedback(null);
    startTransition(async () => {
      const result = await updateStoreCurrencyAction(currencyCode);
      if (!result.ok) {
        setFeedback({
          type: "error",
          message: result.error ?? "Could not update store currency.",
        });
        return;
      }

      setFeedback({
        type: "success",
        message: result.message ?? "Store currency updated.",
      });
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="max-w-md space-y-2">
        <Select value={currencyCode} onValueChange={setCurrencyCode}>
          <SelectTrigger>
            <SelectValue placeholder="Select currency" />
          </SelectTrigger>
          <SelectContent>
            {currencyOptions.map((option) => (
              <SelectItem key={option.code} value={option.code}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={saveCurrency}
          disabled={isPending || currencyCode === initialCurrencyCode}
        >
          {isPending ? "Saving..." : "Save Currency"}
        </Button>
        {feedback ? (
          <p
            className={`text-sm ${
              feedback.type === "error" ? "text-red-700" : "text-emerald-700"
            }`}
          >
            {feedback.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
