import * as React from "react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
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

  // For vertical carousels, Embla determines how many slides are visible based on the
  // *height* of each slide and the viewport height.
  // We set an explicit slide height so exactly 3 are visible at once.
  const verticalSlideHeightClass = "h-72"; // 18rem
  const verticalViewportHeightClass = "h-[54rem]"; // 3 * 18rem

  return (
    <div className="not-prose">
      <Carousel
        orientation={orientation}
        // align:start helps multi-slide layouts feel predictable
        opts={{ loop: true, align: "start", slidesToScroll: scrollBy }}
        className={isVertical ? verticalViewportHeightClass : undefined}
      >
        <CarouselContent className={isVertical ? "flex-col" : undefined}>
          {safeItems.map((t, i) => (
            <CarouselItem
              key={i}
              className={isVertical ? verticalSlideHeightClass : undefined}
            >
              <Card className="h-full">
                <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
                  <blockquote className="text-base leading-relaxed">
                    “{t.quote}”
                  </blockquote>
                  <div>
                    <div className="font-semibold">{t.name}</div>
                    {t.title ? (
                      <div className="text-muted-foreground text-sm">
                        {t.title}
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>

        {/* Controls live outside CarouselContent so they don't repeat per-slide */}
        <div className="mt-4 flex items-center justify-end gap-2">
          <CarouselPrevious />
          <CarouselNext />
        </div>
      </Carousel>
    </div>
  );
}
