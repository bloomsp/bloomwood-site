import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Pack = {
  key: string;
  name: string;
  hours: number;
  price: string;
  bullets: string[];
  buyHref: string;
};

const packs: Pack[] = [
  {
    key: "explorer-5",
    name: "Explorer",
    hours: 5,
    price: "$540",
    bullets: [
      "Hours can be used for Onsite or Remote Support",
      "Value $600",
      "Save up to $60 off standard onsite rate",
    ],
    buyHref: "https://www.paypal.com/ncp/payment/HKPT5UNC9B9EQ",
  },
  {
    key: "adventurer-10",
    name: "Adventurer",
    hours: 10,
    price: "$1080",
    bullets: [
      "Hours can be used for Onsite or Remote Support",
      "Value $1200",
      "Save up to $120 off standard onsite rate",
    ],
    buyHref: "https://www.paypal.com/ncp/payment/HPMQT4H3K9EGJ",
  },
  {
    key: "hero-20",
    name: "Hero",
    hours: 20,
    price: "$2040",
    bullets: [
      "Hours can be used for Onsite or Remote Support",
      "Value $2400",
      "Save up to $360 off standard onsite rate",
    ],
    buyHref: "https://www.paypal.com/ncp/payment/TKYRXWZBGNBAJ",
  },
  {
    key: "legend-40",
    name: "Legend",
    hours: 40,
    price: "$3840",
    bullets: [
      "Hours can be used for Onsite or Remote Support",
      "Value $4800",
      "Save up to $960 off standard onsite rate",
    ],
    buyHref: "https://www.paypal.com/ncp/payment/W63EWRTTHU4GC",
  },
];

export function ServicePacks() {
  return (
    <section className="not-prose">
      <div className="grid gap-4 sm:grid-cols-2">
        {packs.map((p) => (
          <Card key={p.key} className="flex h-full flex-col">
            <CardHeader>
              <CardTitle>
                {p.name}
                <span className="ml-2 text-sm font-normal text-muted-foreground">{p.hours} hours</span>
              </CardTitle>
              <CardDescription>Pre-paid service pack</CardDescription>
            </CardHeader>

            <CardContent className="flex-1 space-y-3">
              <div className="text-2xl font-semibold">{p.price}</div>
              <ul className="ml-4 list-disc space-y-1 text-sm">
                {p.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </CardContent>

            <CardFooter>
              <Button asChild className="w-full">
                <a href={p.buyHref} target="_blank" rel="noopener noreferrer">
                  Buy {p.hours} hours
                </a>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}
