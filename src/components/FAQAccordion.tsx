import * as React from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export type FAQLink = {
  label: string;
  href: string;
};

export type FAQItem = {
  key: string;
  question: string;
  /** Plain text answer (keeps MDX → React interop safe during SSR) */
  answer: string;
  links?: FAQLink[];
};

export function FAQAccordion({
  items,
  heading = "Frequently Asked Questions",
  intro,
}: {
  items: FAQItem[];
  heading?: string;
  intro?: string;
}) {
  if (!items?.length) return null;

  return (
    <section className="not-prose">
      <div className="mb-3">
        <h2 className="text-lg font-semibold">{heading}</h2>
        {intro ? <p className="text-sm text-muted-foreground">{intro}</p> : null}
      </div>

      <Accordion
        type="single"
        collapsible
        className="w-full rounded-xl border border-border"
      >
        {items.map((item, idx) => (
          <AccordionItem
            key={item.key}
            value={item.key}
            className={
              idx === items.length - 1 ? "border-b-0" : "border-b border-border"
            }
          >
            <AccordionTrigger className="px-4 py-3 text-left">
              <div className="font-medium">{item.question}</div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3 text-sm text-slate-700">
                <p>{item.answer}</p>
                {item.links?.length ? (
                  <ul className="ml-4 list-disc space-y-1">
                    {item.links.map((l) => (
                      <li key={l.href}>
                        <a className="underline" href={l.href}>
                          {l.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
