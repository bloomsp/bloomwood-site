import * as React from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export type RecipeAccordionProps = {
  title: string;
  byline?: string;
  summary?: string;
  ingredients?: string[];
  directions?: string[];
  pdfHref?: string;
  recipePageHref?: string;
};

/**
 * Recipe accordion designed to be safe to embed in MDX during SSR.
 * (Avoids putting rich markdown inside AccordionContent.)
 */
export function RecipeAccordion({
  title,
  byline,
  summary,
  ingredients = [],
  directions = [],
  pdfHref,
  recipePageHref,
}: RecipeAccordionProps) {
  return (
    <section className="not-prose">
      <Accordion type="single" collapsible className="w-full rounded-xl border border-border">
        <AccordionItem value="recipe" className="border-b-0">
          <AccordionTrigger className="px-4 py-3 text-left">
            <div className="font-medium">Recipe: {title}</div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-3 text-sm text-slate-700">
              {byline ? (
                <p>
                  <span className="font-medium">Recipe by:</span> {byline}
                </p>
              ) : null}
              {summary ? (
                <p>
                  <span className="font-medium">Summary:</span> {summary}
                </p>
              ) : null}

              {ingredients.length ? (
                <div>
                  <div className="mb-1 font-medium">Ingredients</div>
                  <ul className="ml-4 list-disc space-y-1">
                    {ingredients.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {directions.length ? (
                <div>
                  <div className="mb-1 font-medium">Directions</div>
                  <ol className="ml-4 list-decimal space-y-1">
                    {directions.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {pdfHref || recipePageHref ? (
                <p className="text-xs text-muted-foreground">
                  {pdfHref ? (
                    <>
                      Original PDF: <a className="underline" href={pdfHref}>PDF</a>
                    </>
                  ) : null}
                  {pdfHref && recipePageHref ? " · " : null}
                  {recipePageHref ? (
                    <>
                      Full recipe page: <a className="underline" href={recipePageHref}>{title}</a>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
