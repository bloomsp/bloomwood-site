import * as React from "react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { CarouselApi } from "@/components/ui/carousel";

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
  const [api, setApi] = React.useState<CarouselApi | null>(null);

  const scrollPrevN = React.useCallback(() => {
    if (!api) return;
    for (let i = 0; i < scrollBy; i++) api.scrollPrev();
  }, [api, scrollBy]);

  const scrollNextN = React.useCallback(() => {
    if (!api) return;
    for (let i = 0; i < scrollBy; i++) api.scrollNext();
  }, [api, scrollBy]);

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
        opts={opts}
        setApi={setApi}
        className={isVertical ? `flex flex-col ${verticalViewportHeightClass}` : undefined}
      >
        {isVertical ? <VerticalPrevControl onClick={scrollPrevN} /> : null}

        {/* NOTE: Embla doesn't measure well with CSS `gap` on the track. Use padding on items instead. */}
        <CarouselContent
          viewportClassName={isVertical ? "flex-1 min-h-0" : undefined}
          className={isVertical ? "-mt-4 flex-col" : undefined}
        >
          {safeItems.map((t, i) => (
            <CarouselItem
              key={i}
              style={{ flexBasis: `${100 / perView}%` }}
              className={isVertical ? "pt-4" : "pl-4"}
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

        {isVertical ? <VerticalNextControl onClick={scrollNextN} /> : null}
      </Carousel>
    </div>
  );
}
