import * as React from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const securityFeatures = [
  {
    key: "direct-connections",
    title: "Direct Connections",
    body: "By default, HelpWire connects operators and clients directly, with no relay servers in between. That means faster sessions, less exposure, and stronger end-to-end security.",
  },
  {
    key: "secure-data-centers",
    title: "Secure Data Centers",
    body: "If a direct connection isn’t possible, HelpWire routes traffic through trusted AWS infrastructure, used by NASA, Netflix, and BMW. All data stays encrypted and fully anonymized.",
  },
  {
    key: "protected-data-flow",
    title: "Protected Data Flow",
    body: "All remote session data is encrypted in transit using WSS and HTTPS protocols, shielding every interaction from interception or tampering.",
  },
  {
    key: "tls-aes",
    title: "TLS/SSL and AES Encryption",
    body: "HelpWire uses TLS/SSL protocols and AES-256 encryption to ensure strong, reliable protection for every remote session.",
  },
  {
    key: "user-controlled-access",
    title: "User-Controlled Access",
    body: "Clients grant access on their terms and can revoke it at any time, using a shortcut or the in-app button.",
  },
  {
    key: "trustworthy-authentication",
    title: "Trustworthy Authentication",
    body: "HelpWire uses Auth0 for secure, standards-based login, trusted by Microsoft, AWS, and Siemens.",
  },
  {
    key: "signed-applications",
    title: "Signed Applications",
    body: "All HelpWire apps are DigiCert-signed to prevent tampering, just like IBM and Cloudflare rely on.",
  },
] as const;

export function SecurityFeaturesAccordion() {
  return (
    <section className="not-prose">
      <Accordion type="multiple" className="w-full rounded-xl border border-border">
        {securityFeatures.map((f, idx) => (
          <AccordionItem
            key={f.key}
            value={f.key}
            className={
              idx === securityFeatures.length - 1
                ? "border-b-0"
                : "border-b border-border"
            }
          >
            <AccordionTrigger className="px-4 py-3 text-left">
              <div className="font-medium">{f.title}</div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <p className="text-sm text-muted-foreground">{f.body}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
