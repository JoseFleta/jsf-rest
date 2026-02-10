import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getTenantContext } from "@/lib/supabase/tenant";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const tenantContext = await getTenantContext();

  if (!tenantContext.user) {
    redirect("/auth/login");
  }

  const userDisplayName =
    (tenantContext.user.user_metadata.full_name as string | undefined) ??
    (tenantContext.user.email?.split("@")[0] ?? "User");

  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar />
      <div className="md:pl-64">
        <Topbar
          restaurants={tenantContext.restaurants.map((restaurant) => ({
            id: restaurant.id,
            name: restaurant.name,
            organizationName: restaurant.organizationName,
          }))}
          activeRestaurantId={tenantContext.activeRestaurantId}
          userDisplayName={userDisplayName}
          userEmail={tenantContext.user.email ?? ""}
        />
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          {tenantContext.errors.length > 0 ? (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {tenantContext.errors[0]}
            </div>
          ) : null}
          <div className="mx-auto max-w-[1400px] rounded-2xl border border-white/70 bg-card/80 p-4 shadow-[0_6px_32px_rgba(42,55,71,0.08)] backdrop-blur sm:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
