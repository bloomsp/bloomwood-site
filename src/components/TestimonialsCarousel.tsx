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

  return (
    <div className="not-prose">
      <Carousel
        orientation={orientation}
        // align:start helps multi-slide layouts feel predictable
        opts={{ loop: true, align: "start", slidesToScroll: scrollBy }}
        className={isVertical ? "h-[54rem]" : undefined}
      >
        <CarouselContent className={isVertical ? "flex-col" : undefined}>
          {safeItems.map((t, i) => (
            <CarouselItem
              key={i}
              className={
                isVertical
                  ? "basis-[calc(100%/3)]"
                  : undefined
              }
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
