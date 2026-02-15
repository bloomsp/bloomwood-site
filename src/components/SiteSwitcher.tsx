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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="px-2">
          {current === "solutions" ? "Solutions" : "Media"}
          <ChevronDown className="ml-1 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        {current === "solutions" ? (
          <DropdownMenuItem disabled>Switch to Bloomwood Solutions</DropdownMenuItem>
        ) : (
          <DropdownMenuItem asChild>
            <a href="/solutions">Switch to Bloomwood Solutions</a>
          </DropdownMenuItem>
        )}

        {current === "media" ? (
          <DropdownMenuItem disabled>Switch to Bloomwood Media</DropdownMenuItem>
        ) : (
          <DropdownMenuItem asChild>
            <a href="/media">Switch to Bloomwood Media</a>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
