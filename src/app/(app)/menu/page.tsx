import Link from "next/link";
import { ArrowRightIcon, CalendarRangeIcon, ListIcon, PlusIcon } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function MenuPage() {
  return (
    <>
      <PageHeader
        title="Menu"
        description="First build your dish library, then compose date-based menus."
        actions={
          <Button asChild>
            <Link href="/menu/items">
              <PlusIcon className="size-4" />
              Add Item
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListIcon className="size-5" />
              1) Dishes Library
            </CardTitle>
            <CardDescription>
              Create every dish, define recipes, and lock food-cost and margin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/menu/items">
                Open Dishes
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarRangeIcon className="size-5" />
              2) Menus Planner
            </CardTitle>
            <CardDescription>
              Compose special menus by weekend, date window, or seasonal campaigns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/menu/menus">
                Open Menus
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
