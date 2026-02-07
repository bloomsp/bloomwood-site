import * as React from "react";

import { ArrowUp } from "lucide-react";

import { Button } from "@/components/ui/button";

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

export default function BackToTop() {
  const [visible, setVisible] = React.useState(false);
  // Avoid hydration mismatch by not reading browser-only preferences during the initial render.
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    setReduced(prefersReducedMotion());

    let raf = 0;

    const update = () => {
      raf = 0;
      const y = window.scrollY || 0;
      setVisible(y > 300);
    };

    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(update);
    };

    // Initialize on mount
    update();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const onClick = () => {
    window.scrollTo({
      top: 0,
      behavior: reduced ? "auto" : "smooth",
    });
  };

  return (
    <div
      className={
        "fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6 " +
        (reduced ? "" : "transition")
      }
    >
      <Button
        type="button"
        onClick={onClick}
        aria-label="Back to top"
        size="icon"
        variant="outline"
        className={
          "h-11 w-11 rounded-full border bg-background shadow-sm " +
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
          (reduced ? "" : "transition") +
          " " +
          (visible
            ? "pointer-events-auto opacity-100 translate-y-0"
            : "pointer-events-none opacity-0 translate-y-2")
        }
      >
        <ArrowUp className="h-5 w-5" aria-hidden="true" />
      </Button>
    </div>
  );
}
