import * as React from "react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useCarousel } from "@/components/ui/carousel";

export type Testimonial = {
  quote: string;
  name: string;
  title?: string;
};

function VerticalPrevControl() {
  const { scrollPrev } = useCarousel();

  return (
    <div className="mb-3 flex justify-center">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10 rounded-full"
        onClick={scrollPrev}
        aria-label="Previous testimonials"
      >
        <ArrowUp className="h-5 w-5" />
      </Button>
    </div>
  );
}

function VerticalNextControl() {
  const { scrollNext } = useCarousel();

  return (
    <div className="mt-3 flex justify-center">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10 rounded-full"
        onClick={scrollNext}
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

  // For vertical carousels, Embla determines how many slides are visible based on the
  // *height* of each slide and the viewport height.
  // We set an explicit slide height so exactly 3 are visible at once.
  const verticalSlideHeightClass = "flex-none h-72 pt-4"; // 18rem + spacing
  const verticalViewportHeightClass = "h-[54rem]"; // 3 * 18rem

  return (
    <div className="not-prose">
      <Carousel
        orientation={orientation}
        // align:start helps multi-slide layouts feel predictable
        opts={{ loop: true, align: "start", slidesToScroll: scrollBy }}
        className={isVertical ? verticalViewportHeightClass : undefined}
      >
        {isVertical ? <VerticalPrevControl /> : null}

        {/* NOTE: Embla doesn't measure well with CSS `gap` on the track. Use padding on items instead. */}
        <CarouselContent className={isVertical ? "flex-col -mt-4" : undefined}>
          {safeItems.map((t, i) => (
            <CarouselItem
              key={i}
              className={isVertical ? verticalSlideHeightClass : undefined}
            >
              <Card className="h-full overflow-hidden">
                <CardContent className="flex h-full min-h-0 flex-col gap-4 p-6">
                  <div className="min-h-0 flex-1 overflow-auto">
                    <blockquote className="text-base leading-relaxed">
                      “{t.quote}”
                    </blockquote>
                  </div>

                  <div>
                    <div className="font-semibold">{t.name}</div>
                    {t.title ? (
                      <div className="text-muted-foreground text-sm">{t.title}</div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>

        {isVertical ? <VerticalNextControl /> : null}
      </Carousel>
    </div>
  );
}
