import * as React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';

function extractText(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');

  // ReactElement
  if (React.isValidElement(node)) {
    return extractText(node.props.children);
  }

  return '';
}

function firstSentence(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return '';

  // Grab up to the first sentence terminator.
  const m = clean.match(/^(.+?[.!?])\s/);
  if (m?.[1]) return m[1];

  // Fallback: short preview.
  return clean.length > 140 ? `${clean.slice(0, 140).trim()}…` : clean;
}

export default function BookDescriptionAccordion({
  children,
  label = 'Synopsis',
}: {
  children: React.ReactNode;
  label?: string;
}) {
  const full = extractText(children);
  const preview = firstSentence(full);

  return (
    <Accordion type="single" collapsible className="mt-2">
      <AccordionItem value="desc" className="border-none">
        <AccordionTrigger className="py-2 text-left hover:no-underline">
          <div className="flex w-full flex-col gap-1">
            <span className="text-sm font-medium">{label}</span>
            {preview ? <span className="text-sm text-muted-foreground">{preview}</span> : null}
          </div>
        </AccordionTrigger>
        <AccordionContent className="pb-0">
          <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
