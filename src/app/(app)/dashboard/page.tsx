import Link from "next/link";
import { Building2Icon, PackageIcon, PlusIcon } from "lucide-react";
import { redirect } from "next/navigation";

import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/supabase/tenant";

export const dynamic = "force-dynamic";

type RestaurantRecord = {
  id: string;
  name?: string | null;
  city?: string | null;
  organization_id: string;
  created_at?: string | null;
};

type RestaurantRow = {
  id: string;
  name: string;
  city: string;
  organization: string;
  created: string;
};

const restaurantColumns: DataTableColumn<RestaurantRow>[] = [
  {
    key: "name",
    header: "Restaurant",
    sortable: true,
  },
  {
    key: "city",
    header: "City",
    sortable: true,
  },
  {
    key: "organization",
    header: "Organization",
    sortable: true,
  },
  {
    key: "created",
    header: "Created",
    sortable: true,
  },
];

export default async function DashboardPage() {
  const tenantContext = await getTenantContext();
  if (!tenantContext.user) {
    redirect("/auth/login");
  }

  let restaurants: RestaurantRow[] = [];
  let fetchError: string | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    let query = supabase.from("restaurants").select("*");

    if (tenantContext.activeRestaurantId) {
      query = query.eq("id", tenantContext.activeRestaurantId);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      fetchError = error.message;
    } else {
      const records = (data ?? []) as RestaurantRecord[];
      const organizationNameById = new Map(
        tenantContext.organizations.map((organization) => [
          organization.id,
          organization.name,
        ])
      );

      restaurants = records.map((restaurant, index) => {
        const parsedDate = restaurant.created_at
          ? new Date(restaurant.created_at)
          : null;
        const createdAt =
          parsedDate && !Number.isNaN(parsedDate.getTime())
            ? parsedDate.toLocaleDateString()
            : "-";

        return {
          id: String(restaurant.id ?? index),
          name: restaurant.name ?? "Unnamed restaurant",
          city: restaurant.city ?? "-",
          organization:
            organizationNameById.get(restaurant.organization_id) ?? "Organization",
          created: createdAt,
        };
      });
    }
  } catch (error) {
    fetchError =
      error instanceof Error
        ? error.message
        : "Failed to connect to Supabase. Check your environment variables.";
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Track operations across one or many restaurants from a single control center."
        actions={
          <Button asChild>
            <Link href="/menu/items">
              <PlusIcon className="size-4" />
              New Menu Item
            </Link>
          </Button>
        }
      />

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="space-y-0">
            <CardDescription>Total Restaurants</CardDescription>
            <CardTitle className="text-2xl">
              {tenantContext.restaurants.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-0">
            <CardDescription>Active Restaurant</CardDescription>
            <CardTitle className="text-2xl">
              {tenantContext.restaurants.find(
                (restaurant) => restaurant.id === tenantContext.activeRestaurantId
              )?.name ?? "Not selected"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-0">
            <CardDescription>Setup Status</CardDescription>
            <CardTitle className="text-2xl">
              {fetchError ? "Needs attention" : "Connected"}
            </CardTitle>
          </CardHeader>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2Icon className="size-5" />
            Restaurant Snapshot
          </CardTitle>
          <CardDescription>
            Loaded from Supabase using{" "}
            <code>{"supabase.from('restaurants').select('*')"}</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fetchError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {fetchError}
            </div>
          ) : (
            <DataTable
              data={restaurants}
              columns={restaurantColumns}
              defaultSortKey="name"
              defaultPageSize={5}
              emptyMessage="No restaurants yet. Add one in Supabase."
            />
          )}
        </CardContent>
      </Card>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageIcon className="size-5" />
              Next Step
            </CardTitle>
            <CardDescription>
              Connect your inventory tables and menu items to unlock full
              multi-location reporting.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    </>
  );
}
