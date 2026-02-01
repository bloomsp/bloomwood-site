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
}: {
  items: Testimonial[];
}) {
  const safeItems = items?.length ? items : [];
  if (!safeItems.length) return null;

  return (
    <div className="not-prose">
      <Carousel opts={{ loop: true }}>
        <CarouselContent>
          {safeItems.map((t, i) => (
            <CarouselItem key={i}>
              <Card>
                <CardContent className="flex flex-col gap-4">
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
