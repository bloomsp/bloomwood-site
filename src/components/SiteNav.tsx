import * as React from "react";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { Home } from "lucide-react";

export type NavLink = {
  label: string;
  href: string;
  description?: string;
  /** Optional icon-only nav item (label still used for screen readers). */
  icon?: "home";
};

export type NavItem =
  | NavLink
  | {
      label: string;
      items: NavLink[];
    };

function isGroup(item: NavItem): item is { label: string; items: NavLink[] } {
  return (item as any).items?.length >= 0;
}

export function SiteNav({ nav }: { nav: NavItem[] }) {
  return (
    <NavigationMenu>
      <NavigationMenuList>
        {nav.map((item) => {
          if (!isGroup(item)) {
            const isIconOnly = item.icon === "home";

            return (
              <NavigationMenuItem key={item.href}>
                <NavigationMenuLink
                  asChild
                  className={cn(
                    navigationMenuTriggerStyle(),
                    isIconOnly && "px-2",
                  )}
                >
                  <a href={item.href} aria-label={isIconOnly ? item.label : undefined}>
                    {isIconOnly ? (
                      <>
                        <Home className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">{item.label}</span>
                      </>
                    ) : (
                      item.label
                    )}
                  </a>
                </NavigationMenuLink>
              </NavigationMenuItem>
            );
          }

          return (
            <NavigationMenuItem key={item.label} className="relative">
              <NavigationMenuTrigger>{item.label}</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-90 gap-1 p-2">
                  {item.items.map((sub) => (
                    <li key={sub.href}>
                      <a
                        href={sub.href}
                        className={cn(
                          "block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors",
                          "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                        )}
                      >
                        <div className="text-sm font-medium leading-none">
                          {sub.label}
                        </div>
                        {sub.description ? (
                          <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted-foreground">
                            {sub.description}
                          </p>
                        ) : null}
                      </a>
                    </li>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
          );
        })}
      </NavigationMenuList>
    </NavigationMenu>
  );
}
