import { redirect } from "next/navigation";

import { StoreCurrencyForm } from "@/app/(app)/settings/store-currency-form";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/supabase/tenant";

export default async function SettingsPage() {
  const tenantContext = await getTenantContext();
  if (!tenantContext.user) {
    redirect("/auth/login");
  }

  if (!tenantContext.activeOrganizationId || !tenantContext.activeRestaurantId) {
    return (
      <>
        <PageHeader
          title="Settings"
          description="Configure organization defaults, integrations, and billing."
        />
        <Card>
          <CardHeader>
            <CardTitle>Store Currency</CardTitle>
            <CardDescription>Select a restaurant first from the top bar.</CardDescription>
          </CardHeader>
        </Card>
      </>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id, name, currency_code")
    .eq("id", tenantContext.activeRestaurantId)
    .eq("organization_id", tenantContext.activeOrganizationId)
    .maybeSingle();

  const restaurantName = restaurant?.name ?? "Active Restaurant";
  const initialCurrencyCode = restaurant?.currency_code ?? "USD";

  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure organization defaults, integrations, and billing."
      />
      <Card>
        <CardHeader>
          <CardTitle>Store Currency</CardTitle>
          <CardDescription>
            Set the default currency for {restaurantName}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {restaurantError ? (
            <p className="text-sm text-red-700">{restaurantError.message}</p>
          ) : (
            <StoreCurrencyForm initialCurrencyCode={initialCurrencyCode} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
