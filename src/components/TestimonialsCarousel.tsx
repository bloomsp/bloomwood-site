import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowDown, ArrowUp } from "lucide-react";

export type Testimonial = {
  quote: string;
  name: string;
  title?: string;
};

function VerticalPrevControl({ onClick }: { onClick: () => void }) {
  return (
    <div className="mb-6 flex justify-center">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10 rounded-full"
        onClick={onClick}
        aria-label="Previous testimonials"
      >
        <ArrowUp className="h-5 w-5" />
      </Button>
    </div>
  );
}

function VerticalNextControl({ onClick }: { onClick: () => void }) {
  return (
    <div className="mt-6 flex justify-center">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10 rounded-full"
        onClick={onClick}
        aria-label="Next testimonials"
      >
        <ArrowDown className="h-5 w-5" />
      </Button>
    </div>
  );
}

export default function TestimonialsCarousel({
  items,
  orientation = "horizontal",
  perView = 1,
  scrollBy = 1,
}: {
  items: Testimonial[];
  orientation?: "horizontal" | "vertical";
  /** How many testimonials should be visible at once (best-effort; requires a fixed carousel height for vertical). */
  perView?: number;
  /** How many testimonials to advance per Next/Prev click. */
  scrollBy?: number;
}) {
  const safeItems = items?.length ? items : [];
  if (!safeItems.length) return null;

  const isVertical = orientation === "vertical";

  // Vertical layout on the Media testimonials page needs strict “3-at-a-time” paging.
  // Using Embla here has been brittle across SSR/hydration and layout measurement.
  // So we implement deterministic paging in React.
  if (isVertical) {
    const pageSize = perView;
    const step = scrollBy;

    const [start, setStart] = React.useState(0);

    const wrap = React.useCallback(
      (n: number) => {
        const len = safeItems.length;
        if (len === 0) return 0;
        return ((n % len) + len) % len;
      },
      [safeItems.length]
    );

    const visible = React.useMemo(() => {
      const len = safeItems.length;
      if (len === 0) return [] as Testimonial[];

      const out: Testimonial[] = [];
      for (let i = 0; i < Math.min(pageSize, len); i++) {
        out.push(safeItems[wrap(start + i)]);
      }
      return out;
    }, [safeItems, start, pageSize, wrap]);

    const prev = () => setStart((s) => wrap(s - step));
    const next = () => setStart((s) => wrap(s + step));

    return (
      <div className="not-prose">
        <VerticalPrevControl onClick={prev} />

        <div className="space-y-4">
          {visible.map((t, idx) => (
            <Card key={`${t.name}-${idx}`} className="overflow-hidden">
              <CardContent className="flex flex-col gap-4 p-6">
                <blockquote className="text-base leading-relaxed">
                  “{t.quote}”
                </blockquote>
                <div>
                  <div className="font-semibold">{t.name}</div>
                  {t.title ? (
                    <div className="text-muted-foreground text-sm">{t.title}</div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <VerticalNextControl onClick={next} />
      </div>
    );
  }

  // Fallback (horizontal) uses simple list for now.
  return (
    <div className="not-prose space-y-4">
      {safeItems.map((t, i) => (
        <Card key={i} className="overflow-hidden">
          <CardContent className="flex flex-col gap-4 p-6">
            <blockquote className="text-base leading-relaxed">“{t.quote}”</blockquote>
            <div>
              <div className="font-semibold">{t.name}</div>
              {t.title ? (
                <div className="text-muted-foreground text-sm">{t.title}</div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
