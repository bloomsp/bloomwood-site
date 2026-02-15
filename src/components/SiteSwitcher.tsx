import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Section = "solutions" | "media";

export function SiteSwitcher({ current }: { current: Section }) {
  const go = (href: string) => {
    // iOS Safari can be flaky with <a> inside Radix portal menus.
    // Use explicit navigation on select.
    window.location.assign(href);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="px-2">
          {current === "solutions" ? "Solutions" : "Media"}
          <ChevronDown className="ml-1 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        <DropdownMenuItem
          disabled={current === "solutions"}
          onSelect={(e) => {
            e.preventDefault();
            if (current !== "solutions") go("/solutions");
          }}
        >
          Switch to Bloomwood Solutions
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={current === "media"}
          onSelect={(e) => {
            e.preventDefault();
            if (current !== "media") go("/media");
          }}
        >
          Switch to Bloomwood Media
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
