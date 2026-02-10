import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  Settings,
  ShoppingCart,
  Soup,
  UsersRound,
} from "lucide-react";

export type NavigationItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export const navigationItems: NavigationItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Menu",
    href: "/menu",
    icon: Soup,
  },
  {
    title: "Inventory",
    href: "/inventory",
    icon: Boxes,
  },
  {
    title: "Purchasing Orders",
    href: "/purchasing/orders",
    icon: ShoppingCart,
  },
  {
    title: "Team",
    href: "/team",
    icon: UsersRound,
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: BarChart3,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];
