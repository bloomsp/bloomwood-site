import * as React from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const services = [
  {
    key: "onsite-1h",
    title: "1 Hour Onsite",
    subtitle: "Onsite service for any tech support or flatpack service",
    bullets: [
      "Windows PC",
      "Mac and macOS",
      "Virus removal",
      "Backup strategy",
      "Help with OneDrive, Google Cloud, Apple iCloud, or other cloud service",
      "Any smart phone",
      "Any smart TV",
      "Any of your technology",
      "Flat pack furniture assembly - allow 1 hour per flat pack",
    ],
  },
  {
    key: "computer-setup",
    title: "Computer Setup",
    subtitle: "For new computers",
    bullets: [
      "Onsite service only",
      "Windows PC – typically takes 2 hours depending on updates required and speed of internet",
      "For Mac (macOS) typically takes 1 hour",
    ],
  },
  {
    key: "wifi-setup",
    title: "Wifi Setup",
    subtitle: "Setup or troubleshoot your Wifi router/modem",
    bullets: [
      "Onsite service only",
      "Signal quality mapping and diagnostics",
      "Signal interference check",
      "Optimise positioning of Wifi access point",
      "Optimise use of Mesh network",
    ],
  },
  {
    key: "remote-support",
    title: "Remote Support",
    subtitle: "For fully operational computers with high speed internet",
    bullets: [
      "Windows PC",
      "Mac",
      "Any smart phone",
      "$40 to be paid at time of booking",
    ],
  },
  {
    key: "printer-setup",
    title: "Printer Setup",
    subtitle: "For any printer you want to setup",
    bullets: [
      "Onsite service only",
      "Set up printer via Wifi or USB",
      "Set up printing from smart phone",
      "Printer troubleshooting",
    ],
  },
  {
    key: "quick-chat",
    title: "Quick Chat",
    subtitle: "Have some questions? No obligation free chat",
    bullets: [
      "Book a 15 minute phone call",
      "No Fee",
      "No obligation",
      "No question too hard",
      "Any technology topic",
    ],
  },
] as const;

export function ServiceAccordion() {
  return (
    <section className="not-prose">
      <div className="mb-3">
        <h2 className="text-lg font-semibold">Services</h2>
        <p className="text-sm text-muted-foreground">
          Expand any item to see what's included.
        </p>
      </div>

      <Accordion
        type="multiple"
        className="w-full rounded-xl border border-border"
      >
        {services.map((s, idx) => (
          <AccordionItem
            key={s.key}
            value={s.key}
            className={
              idx === services.length - 1
                ? "border-b-0"
                : "border-b border-border"
            }
          >
            <AccordionTrigger className="px-4 py-3 text-left">
              <div>
                <div className="font-medium">{s.title}</div>
                <div className="mt-0.5 text-sm font-normal text-muted-foreground">
                  {s.subtitle}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <ul className="ml-4 list-disc space-y-1 text-sm">
                {s.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
