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
    <div className="mb-4 flex justify-center">
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
  const verticalViewportHeightClass = "h-[60vh] min-h-[30rem]";

  const opts = React.useMemo(
    () => ({ loop: true, align: "start" as const, slidesToScroll: scrollBy }),
    [scrollBy],
  );

  return (
    <div className="not-prose">
      <Carousel
        orientation={orientation}
        opts={{ ...opts, axis: isVertical ? "y" : "x" }}
        // align:start helps multi-slide layouts feel predictable
        className={
          isVertical
            ? `flex flex-col ${verticalViewportHeightClass} [&>div.overflow-hidden]:flex-1 [&>div.overflow-hidden]:min-h-0`
            : undefined
        }
      >
        {isVertical ? <VerticalPrevControl /> : null}

        {/* NOTE: Embla doesn't measure well with CSS `gap` on the track. Use padding on items instead. */}
        <CarouselContent
          className={isVertical ? "-mt-4 flex-col flex-1 min-h-0" : undefined}
        >
          {safeItems.map((t, i) => (
            <CarouselItem
              key={i}
              style={{ flexBasis: `${100 / perView}%` }}
              className={isVertical ? "pt-4" : "pl-4"}
            >
              <Card className="h-full overflow-hidden">
                <CardContent className="flex h-full min-h-0 flex-col gap-4 p-6">
                  <div className="flex-1">
                    <blockquote className="text-base leading-relaxed">
                      “{t.quote}”
                    </blockquote>
                  </div>

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

        {isVertical ? <VerticalNextControl /> : null}
      </Carousel>
    </div>
  );
}
