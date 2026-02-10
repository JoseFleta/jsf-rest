"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, LogOutIcon, UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  setActiveRestaurantAction,
  signOutAction,
} from "@/app/(app)/actions";
import { MobileSidebarTrigger } from "@/components/layout/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TopbarRestaurant = {
  id: string;
  name: string;
  organizationName: string;
};

type TopbarProps = {
  restaurants: TopbarRestaurant[];
  activeRestaurantId: string | null;
  userDisplayName: string;
  userEmail: string;
};

function getInitials(label: string) {
  const parts = label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "U";
}

export function Topbar({
  restaurants,
  activeRestaurantId,
  userDisplayName,
  userEmail,
}: TopbarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const restaurantId = activeRestaurantId ?? restaurants[0]?.id ?? "";

  const selectedRestaurant = restaurants.find(
    (restaurant) => restaurant.id === restaurantId
  );

  const onRestaurantChange = (nextRestaurantId: string) => {
    setSelectionError(null);

    startTransition(async () => {
      const result = await setActiveRestaurantAction(nextRestaurantId);
      if (!result.ok) {
        setSelectionError(result.error ?? "Could not update restaurant.");
        return;
      }

      router.refresh();
    });
  };

  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 px-4 py-2 backdrop-blur-xl md:px-6">
      <div className="flex h-12 items-center gap-3">
        <MobileSidebarTrigger />
        <div className="hidden md:block">
          <p className="text-sm text-muted-foreground">Operations center</p>
          {selectedRestaurant ? (
            <p className="text-xs text-muted-foreground">
              {selectedRestaurant.organizationName}
            </p>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <Select
            value={restaurantId}
            onValueChange={onRestaurantChange}
            disabled={restaurants.length === 0 || isPending}
          >
            <SelectTrigger className="w-[260px] border-border/70 bg-white/80 shadow-sm">
              <SelectValue
                placeholder={
                  restaurants.length > 0
                    ? "Select restaurant"
                    : "No restaurants available"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {restaurants.map((restaurant) => (
                <SelectItem key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isPending ? (
            <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-10 gap-2 rounded-full border border-border/60 bg-white/80 px-2 shadow-sm hover:bg-muted"
              >
                <Avatar size="sm">
                  <AvatarImage src="" alt="User avatar" />
                  <AvatarFallback>{getInitials(userDisplayName)}</AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium sm:inline">
                  {userDisplayName}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{userDisplayName}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {userEmail}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <UserIcon className="size-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <UserIcon className="size-4" />
                Team & Billing
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <form action={signOutAction} className="w-full">
                <DropdownMenuItem variant="destructive" asChild>
                  <button type="submit" className="w-full cursor-pointer">
                    <LogOutIcon className="size-4" />
                    Sign out
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {selectionError ? (
        <p className="mt-1 text-xs text-destructive">{selectionError}</p>
      ) : null}
    </header>
  );
}
