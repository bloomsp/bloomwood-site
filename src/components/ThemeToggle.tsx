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

function safeStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // iOS Safari (especially Private Browsing) can throw on localStorage access.
    return null;
  }
}

function safeStorageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore: theme will still work for this session, just won't persist.
  }
}

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
  const raw = safeStorageGet(STORAGE_KEY);
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

    // addEventListener is the modern API; older Safari uses addListener/removeListener.
    // @ts-expect-error - older Safari types
    mql?.addEventListener?.("change", onChange);
    // @ts-expect-error - older Safari types
    mql?.addListener?.(onChange);

    return () => {
      // @ts-expect-error - older Safari types
      mql?.removeEventListener?.("change", onChange);
      // @ts-expect-error - older Safari types
      mql?.removeListener?.(onChange);
    };
  }, []);

  const setAndStore = (next: Theme) => {
    safeStorageSet(STORAGE_KEY, next);
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
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setAndStore("light");
          }}
        >
          Light
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setAndStore("dark");
          }}
        >
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setAndStore("system");
          }}
        >
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
