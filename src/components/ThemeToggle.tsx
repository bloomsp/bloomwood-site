import * as React from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;

  root.classList.remove("dark");

  if (theme === "dark") {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
    return;
  }

  if (theme === "light") {
    root.style.colorScheme = "light";
    return;
  }

  // system
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  if (prefersDark) {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  } else {
    root.style.colorScheme = "light";
  }
}

function getStoredTheme(): Theme {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

export function ThemeToggle() {
  const [theme, setTheme] = React.useState<Theme>("system");

  React.useEffect(() => {
    const stored = getStoredTheme();
    setTheme(stored);
    applyTheme(stored);

    const mql = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onChange = () => {
      // If user chose "system", keep in sync.
      if (getStoredTheme() === "system") {
        applyTheme("system");
      }
    };

    mql?.addEventListener?.("change", onChange);
    return () => mql?.removeEventListener?.("change", onChange);
  }, []);

  const setAndStore = (next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next);
    setTheme(next);
    applyTheme(next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Toggle theme">
          {/* Simple indicator: sun = light/system, moon = dark */}
          {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setAndStore("light")}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setAndStore("dark")}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setAndStore("system")}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
