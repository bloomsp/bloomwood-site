import * as React from "react";

import { Card, CardContent } from "@/components/ui/card";

export type Testimonial = {
  quote: string;
  name: string;
  title?: string;
};


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

  // Vertical layout: just show all testimonials stacked.
  if (isVertical) {
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
