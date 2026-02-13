import * as React from "react";

import { Menubar, MenubarMenu, MenubarTrigger } from "@/components/ui/menubar";
import { cn } from "@/lib/utils";

const items = [
  { key: "services", label: "Services", href: "/media/services/" },
  { key: "editing", label: "Editing", href: "/media/services/editing/" },
  { key: "publishing", label: "Publishing", href: "/media/services/publishing/" },
  { key: "technical-writing", label: "Technical Writing", href: "/media/services/technical-writing/" },
  { key: "video-editing", label: "Video Editing", href: "/media/services/video-editing/" },
  { key: "website-design", label: "Website Design", href: "/media/services/website-design/" },
];

export function MediaServicesMenubar({ currentKey }: { currentKey?: string }) {
  return (
    <nav aria-label="Media services" className="not-prose my-6">
      <Menubar className="w-full flex-wrap justify-start gap-1 h-auto py-1">
        {items.map((i) => (
          <MenubarMenu key={i.key}>
            <MenubarTrigger
              asChild
              className={cn(
                "cursor-pointer",
                currentKey === i.key && "bg-accent text-accent-foreground",
              )}
            >
              <a href={i.href}>{i.label}</a>
            </MenubarTrigger>
          </MenubarMenu>
        ))}
      </Menubar>
    </nav>
  );
}
